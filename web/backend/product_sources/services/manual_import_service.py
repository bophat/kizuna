import hashlib
import re
from dataclasses import dataclass
from decimal import Decimal

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.utils import timezone

from product_sources.enums import (
    ImageMode,
    ImportJobStatus,
    ImportJobType,
    SourceAvailability,
    SourceProvider,
    SourceSyncStatus,
)
from product_sources.exceptions import (
    CategoryRequiredError,
    DuplicateSourceProductError,
)
from product_sources.models import ProductPriceHistory, ProductSource, SourceImportJob
from product_sources.schemas.import_result import (
    BulkImportItemResult,
    BulkImportResult,
    ImportPreview,
    ImportResult,
    PricingPreview,
    ProductPayloadPreview,
    SourcePreviewInfo,
)
from product_sources.schemas.manual_import import ManualBulkRequest, ManualProductInput
from product_sources.services.audit_service import AuditService
from product_sources.services.image_download_service import ImageDownloadService
from product_sources.services.pricing_service import ProductPricingService, PricingResult
from shop.models import Category, Product, ProductStatus


@dataclass(frozen=True)
class _PreparedManualImport:
    request: ManualProductInput
    preview: ImportPreview
    pricing: PricingResult


class ManualImportService:
    """Preview and import user-entered products without marketplace credentials."""

    def __init__(self, *, image_download_service=None):
        self.image_download_service = image_download_service or ImageDownloadService()
        self.pricing_service = ProductPricingService()
        self.audit_service = AuditService()

    @staticmethod
    def _identifiers(item: ManualProductInput) -> tuple[str, str]:
        url_digest = hashlib.sha256(
            str(item.source_url).encode('utf-8'),
        ).hexdigest()[:16].upper()
        raw_product_id = item.sku or url_digest
        product_suffix = re.sub(
            r'[^A-Za-z0-9._-]+',
            '-',
            raw_product_id,
        ).strip('-._').upper()
        product_suffix = product_suffix or url_digest
        product_id = (
            product_suffix
            if product_suffix.startswith('MAN-')
            else f'MAN-{product_suffix}'
        )
        return f'URL-{url_digest}', product_id[:100]

    def _prepare(self, item: ManualProductInput) -> _PreparedManualImport:
        try:
            category = Category.objects.get(pk=item.category_id)
        except Category.DoesNotExist as exc:
            raise CategoryRequiredError(
                'Danh mục đã chọn không tồn tại.',
                details={'category_id': item.category_id},
            ) from exc

        source_id, product_id = self._identifiers(item)
        duplicate = (
            Product.objects.filter(pk=product_id).exists()
            or ProductSource.objects.filter(
                provider=SourceProvider.MANUAL,
                source_product_id=source_id,
            ).exists()
        )
        pricing = self.pricing_service.calculate(
            source_price_jpy=item.source_price_jpy,
            weight_kg=item.weight_kg,
            usd_vnd_rate=Decimal(str(settings.USD_VND_RATE)),
        )
        pricing_preview = PricingPreview(
            import_cost_vnd=str(pricing.import_cost_vnd),
            shipping_vnd=str(pricing.shipping_vnd),
            selling_price_vnd=str(pricing.selling_price_vnd),
            selling_price_usd=str(pricing.selling_price_usd),
            calculation_snapshot=pricing.calculation_snapshot,
        )
        warnings = []
        if not item.description:
            warnings.append('Chưa nhập mô tả; tên sản phẩm sẽ được dùng làm mô tả.')
        if item.image_url is None:
            warnings.append('Chưa nhập URL ảnh.')

        preview = ImportPreview(
            provider=SourceProvider.MANUAL,
            source_product_id=source_id,
            canonical_url=str(item.source_url),
            duplicate=duplicate,
            category_required=False,
            product_payload=ProductPayloadPreview(
                id=product_id,
                name=item.name,
                price=str(pricing.selling_price_usd),
                currency='USD',
                category=category.id,
                stock=item.stock,
                description=item.description or item.name,
                brand=item.brand,
                location=item.location or 'Japan',
                weight=str(item.weight_kg),
                is_new=item.is_new,
                status=ProductStatus.DRAFT,
            ),
            source=SourcePreviewInfo(
                source_price_jpy=str(item.source_price_jpy),
                availability=SourceAvailability.UNKNOWN,
                images=[str(item.image_url)] if item.image_url is not None else [],
            ),
            pricing=pricing_preview,
            warnings=warnings,
        )
        return _PreparedManualImport(request=item, preview=preview, pricing=pricing)

    def preview_bulk(self, request: ManualBulkRequest) -> BulkImportResult:
        items: list[BulkImportItemResult] = []
        succeeded = 0
        failed = 0
        for item in request.items:
            url = str(item.source_url)
            try:
                preview = self._prepare(item).preview
                items.append(
                    BulkImportItemResult(
                        url=url,
                        success=True,
                        preview=preview.model_dump(mode='json'),
                    ),
                )
                succeeded += 1
            except Exception as exc:
                items.append(
                    BulkImportItemResult(
                        url=url,
                        success=False,
                        error_code=getattr(exc, 'code', 'PREVIEW_FAILED'),
                        message=str(exc),
                    ),
                )
                failed += 1
        return BulkImportResult(
            dry_run=True,
            total=len(request.items),
            succeeded=succeeded,
            failed=failed,
            items=items,
        )

    def import_product(
        self,
        item: ManualProductInput,
        *,
        image_mode: ImageMode,
        actor=None,
    ) -> ImportResult:
        prepared = self._prepare(item)
        preview = prepared.preview
        if preview.duplicate:
            raise DuplicateSourceProductError(
                'SKU hoặc URL nguồn đã tồn tại.',
                details={
                    'product_id': preview.product_payload.id,
                    'source_product_id': preview.source_product_id,
                },
            )

        downloaded_image = None
        if image_mode == ImageMode.DOWNLOAD and preview.source.images:
            downloaded_image = self.image_download_service.download(
                preview.source.images[0],
                filename_stem=preview.product_payload.id,
            )

        stored_image_name = None
        stored_image_storage = None
        try:
            with transaction.atomic():
                if (
                    Product.objects.filter(pk=preview.product_payload.id).exists()
                    or ProductSource.objects.filter(
                        provider=SourceProvider.MANUAL,
                        source_product_id=preview.source_product_id,
                    ).exists()
                ):
                    raise DuplicateSourceProductError('SKU hoặc URL nguồn đã tồn tại.')

                category = Category.objects.select_for_update().get(
                    pk=preview.product_payload.category,
                )
                product = Product.objects.create(
                    id=preview.product_payload.id,
                    name=preview.product_payload.name,
                    price=prepared.pricing.selling_price_usd,
                    currency='USD',
                    status=ProductStatus.DRAFT,
                    category=category,
                    brand=preview.product_payload.brand or '',
                    location=preview.product_payload.location or '',
                    description=preview.product_payload.description,
                    stock=preview.product_payload.stock,
                    weight=Decimal(preview.product_payload.weight),
                    is_new=item.is_new,
                    is_limited=item.is_limited,
                    is_featured=item.is_featured,
                    is_cheap=item.is_cheap,
                )

                if downloaded_image is not None:
                    product.image.save(
                        downloaded_image.filename,
                        ContentFile(downloaded_image.content),
                        save=False,
                    )
                    stored_image_name = product.image.name
                    stored_image_storage = product.image.storage
                    product.save(update_fields=['image'])

                external_image_url = None
                if (
                    image_mode in (ImageMode.REMOTE, ImageMode.DOWNLOAD)
                    and preview.source.images
                ):
                    external_image_url = preview.source.images[0]

                raw_data = item.model_dump(mode='json')
                source = ProductSource.objects.create(
                    product=product,
                    provider=SourceProvider.MANUAL,
                    source_product_id=preview.source_product_id,
                    source_url=str(item.source_url),
                    canonical_url=str(item.source_url),
                    source_price_jpy=item.source_price_jpy,
                    source_currency='JPY',
                    source_availability=SourceAvailability.UNKNOWN,
                    source_stock_quantity=item.stock,
                    external_image_url=external_image_url,
                    raw_data=raw_data,
                    data_hash=ProductSource.compute_data_hash(raw_data),
                    sync_status=SourceSyncStatus.NEVER,
                )
                ProductPriceHistory.objects.create(
                    product=product,
                    source=source,
                    source_price_jpy=item.source_price_jpy,
                    calculated_price_usd=prepared.pricing.selling_price_usd,
                    calculation_snapshot=prepared.pricing.calculation_snapshot,
                )
                self.audit_service.log(
                    action='product_source.import_manual',
                    actor=actor,
                    product_id=product.id,
                    provider=SourceProvider.MANUAL,
                    source_product_id=preview.source_product_id,
                    input_summary={
                        'item': raw_data,
                        'image_mode': image_mode,
                    },
                    result_summary={
                        'product_id': product.id,
                        'source_id': source.id,
                    },
                )
        except IntegrityError as exc:
            self._delete_stored_image(stored_image_storage, stored_image_name)
            raise DuplicateSourceProductError(
                'SKU hoặc URL nguồn đã tồn tại.',
                details={'product_id': preview.product_payload.id},
            ) from exc
        except Exception:
            self._delete_stored_image(stored_image_storage, stored_image_name)
            raise

        return ImportResult(
            success=True,
            product_id=product.id,
            source_id=source.id,
            status=product.status,
            warnings=preview.warnings,
            dry_run=False,
        )

    def import_bulk(self, request: ManualBulkRequest, actor=None) -> BulkImportResult:
        safe_actor = actor if getattr(actor, 'is_authenticated', False) else None
        job = SourceImportJob.objects.create(
            job_type=ImportJobType.IMPORT,
            provider=SourceProvider.MANUAL,
            status=ImportJobStatus.RUNNING,
            dry_run=False,
            total=len(request.items),
            payload=request.model_dump(mode='json'),
            initiated_by=safe_actor,
            started_at=timezone.now(),
        )
        results: list[BulkImportItemResult] = []
        succeeded = 0
        failed = 0
        for item in request.items:
            url = str(item.source_url)
            try:
                result = self.import_product(
                    item,
                    image_mode=request.image_mode,
                    actor=actor,
                )
                results.append(
                    BulkImportItemResult(
                        url=url,
                        success=True,
                        product_id=result.product_id,
                        source_id=result.source_id,
                    ),
                )
                succeeded += 1
            except Exception as exc:
                results.append(
                    BulkImportItemResult(
                        url=url,
                        success=False,
                        error_code=getattr(exc, 'code', 'IMPORT_FAILED'),
                        message=str(exc),
                    ),
                )
                failed += 1

        job.succeeded = succeeded
        job.failed = failed
        job.status = (
            ImportJobStatus.SUCCESS
            if failed == 0
            else (ImportJobStatus.FAILED if succeeded == 0 else ImportJobStatus.PARTIAL)
        )
        job.result = {'items': [item.model_dump(mode='json') for item in results]}
        job.finished_at = timezone.now()
        job.save(
            update_fields=['succeeded', 'failed', 'status', 'result', 'finished_at'],
        )
        return BulkImportResult(
            job_id=job.id,
            dry_run=False,
            total=len(request.items),
            succeeded=succeeded,
            failed=failed,
            items=results,
        )

    @staticmethod
    def _delete_stored_image(storage, name: str | None) -> None:
        if storage is None or not name:
            return
        try:
            storage.delete(name)
        except Exception:
            pass
