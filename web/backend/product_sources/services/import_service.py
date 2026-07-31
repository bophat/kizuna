from dataclasses import dataclass
from decimal import Decimal

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.utils import timezone

from product_sources.enums import ImageMode, ImportJobStatus, ImportJobType, SourceSyncStatus
from product_sources.exceptions import (
    CategoryRequiredError,
    DuplicateSourceProductError,
    InvalidImportRequestError,
    PriceUnavailableError,
    WeightRequiredError,
)
from product_sources.models import ProductPriceHistory, ProductSource, SourceImportJob
from product_sources.providers import build_provider_registry
from product_sources.schemas.import_request import (
    BulkImportRequest,
    ImportSourceProductRequest,
    PreviewImportRequest,
)
from product_sources.schemas.import_result import (
    BulkImportItemResult,
    BulkImportResult,
    ImportPreview,
    ImportResult,
    PricingPreview,
    ProductPayloadPreview,
    SourcePreviewInfo,
)
from product_sources.schemas.provider_product import ProviderProduct
from product_sources.services.audit_service import AuditService
from product_sources.services.category_mapping_service import CategoryMappingService
from product_sources.services.compliance_service import get_allowed_source_hosts, validate_external_url
from product_sources.services.description_service import build_description_draft
from product_sources.services.image_download_service import ImageDownloadService
from product_sources.services.normalize_service import normalize_provider_product
from product_sources.services.pricing_service import ProductPricingService, PricingResult
from product_sources.services.product_id_generator import generate_product_id, provider_location
from shop.models import Category, Product, ProductStatus

@dataclass(frozen=True)
class _PreparedImport:
    product: ProviderProduct
    preview: ImportPreview
    pricing: PricingResult | None


class SourceImportService:
    def __init__(self, *, provider_registry=None, image_download_service=None):
        self.provider_registry = provider_registry or build_provider_registry()
        self.image_download_service = image_download_service or ImageDownloadService()
        self.pricing_service = ProductPricingService()
        self.category_mapping = CategoryMappingService()
        self.audit_service = AuditService()

    def _prepare(self, request: PreviewImportRequest) -> _PreparedImport:
        validate_external_url(request.url, allowed_hosts=get_allowed_source_hosts())

        provider = self.provider_registry.resolve_by_url(request.url)
        canonical_url = provider.canonicalize_url(request.url)
        source_product_id = provider.extract_source_product_id(request.url)
        duplicate = ProductSource.objects.filter(
            provider=provider.provider_code,
            source_product_id=source_product_id,
        ).exists()

        provider_product = provider.get_product(
            source_product_id,
            canonical_url=canonical_url,
        )
        normalized = normalize_provider_product(provider_product)

        target_category, category_required = self.category_mapping.resolve_category(
            provider=provider.provider_code,
            source_category=normalized.source_category,
            category_id=request.category_id,
        )

        warnings: list[str] = []
        weight = normalized.weight_kg
        if weight is None and request.default_weight_kg is not None:
            weight = request.default_weight_kg
            warnings.append(
                f'Provider không cung cấp weight; đã dùng {request.default_weight_kg} kg.',
            )
        elif weight is None:
            warnings.append('Provider không cung cấp weight; cần nhập default_weight_kg.')

        pricing_result = None
        pricing_preview = None
        if normalized.source_price is None:
            warnings.append('Provider không cung cấp giá nguồn.')
        elif weight is None:
            warnings.append('Chưa thể tính giá vì thiếu weight.')
        else:
            pricing_result = self.pricing_service.calculate(
                source_price_jpy=normalized.source_price,
                weight_kg=weight,
                usd_vnd_rate=Decimal(str(settings.USD_VND_RATE)),
            )
            pricing_preview = PricingPreview(
                import_cost_vnd=str(pricing_result.import_cost_vnd),
                shipping_vnd=str(pricing_result.shipping_vnd),
                selling_price_vnd=str(pricing_result.selling_price_vnd),
                selling_price_usd=str(pricing_result.selling_price_usd),
                calculation_snapshot=pricing_result.calculation_snapshot,
            )

        description = build_description_draft(
            product_name=normalized.name,
            brand=normalized.brand,
            provider=provider.provider_code,
            weight_kg=str(weight) if weight is not None else None,
        )
        product_id = generate_product_id(provider.provider_code, source_product_id)

        preview = ImportPreview(
            provider=provider.provider_code,
            source_product_id=source_product_id,
            canonical_url=canonical_url,
            duplicate=duplicate,
            category_required=category_required,
            product_payload=ProductPayloadPreview(
                id=product_id,
                name=normalized.name[:200],
                price=pricing_preview.selling_price_usd if pricing_preview else '0.00',
                currency='USD',
                category=target_category.id if target_category else None,
                stock=request.default_stock,
                description=description,
                brand=normalized.brand,
                location=provider_location(provider.provider_code),
                weight=str(weight) if weight is not None else None,
                is_new=True,
                status=ProductStatus.DRAFT,
            ),
            source=SourcePreviewInfo(
                source_price_jpy=(
                    str(normalized.source_price) if normalized.source_price is not None else None
                ),
                availability=normalized.availability,
                images=[str(image.url) for image in normalized.images],
            ),
            pricing=pricing_preview,
            warnings=warnings,
        )
        return _PreparedImport(product=normalized, preview=preview, pricing=pricing_result)

    def preview(self, request: PreviewImportRequest) -> ImportPreview:
        return self._prepare(request).preview

    def import_product(self, request: ImportSourceProductRequest, actor=None) -> ImportResult:
        prepared = self._prepare(request)
        preview = prepared.preview

        if preview.duplicate:
            raise DuplicateSourceProductError(
                'Sản phẩm nguồn đã tồn tại.',
                details={
                    'provider': preview.provider,
                    'source_product_id': preview.source_product_id,
                },
            )
        if preview.category_required or preview.product_payload.category is None:
            raise CategoryRequiredError('Yêu cầu chọn Category trước khi import.')
        if prepared.product.source_price is None or prepared.pricing is None:
            if preview.product_payload.weight is None:
                raise WeightRequiredError('Cần weight nguồn hoặc default_weight_kg để tính giá.')
            raise PriceUnavailableError('Provider không cung cấp giá nguồn để import.')
        if preview.product_payload.weight is None:
            raise WeightRequiredError('Cần weight nguồn hoặc default_weight_kg để import.')

        if request.dry_run:
            return ImportResult(
                success=True,
                warnings=preview.warnings,
                dry_run=True,
                preview=preview,
            )

        downloaded_image = None
        if request.image_mode == ImageMode.DOWNLOAD:
            if preview.source.images:
                downloaded_image = self.image_download_service.download(
                    preview.source.images[0],
                    filename_stem=preview.product_payload.id,
                )
            else:
                preview.warnings.append(
                    'Provider không cung cấp ảnh; sản phẩm được import không có ảnh.',
                )

        if Product.objects.filter(pk=preview.product_payload.id).exists():
            raise DuplicateSourceProductError(
                'Product ID đã tồn tại và không thể gắn với source mới.',
                details={'product_id': preview.product_payload.id},
            )

        stored_image_name = None
        stored_image_storage = None
        try:
            with transaction.atomic():
                if ProductSource.objects.filter(
                    provider=preview.provider,
                    source_product_id=preview.source_product_id,
                ).exists():
                    raise DuplicateSourceProductError('Sản phẩm nguồn đã tồn tại.')
                if Product.objects.filter(pk=preview.product_payload.id).exists():
                    raise DuplicateSourceProductError(
                        'Product ID đã tồn tại và không thể gắn với source mới.',
                        details={'product_id': preview.product_payload.id},
                    )

                try:
                    category = Category.objects.get(pk=preview.product_payload.category)
                except Category.DoesNotExist as exc:
                    raise CategoryRequiredError('Category đã chọn không còn tồn tại.') from exc

                product = Product.objects.create(
                    id=preview.product_payload.id,
                    name=preview.product_payload.name,
                    price=prepared.pricing.selling_price_usd,
                    currency='USD',
                    category=category,
                    brand=preview.product_payload.brand or '',
                    location=preview.product_payload.location or '',
                    description=preview.product_payload.description,
                    stock=preview.product_payload.stock,
                    weight=Decimal(preview.product_payload.weight),
                    status=ProductStatus.DRAFT,
                    is_new=True,
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
                    request.image_mode in (ImageMode.REMOTE, ImageMode.DOWNLOAD)
                    and preview.source.images
                ):
                    external_image_url = preview.source.images[0]

                product_source = ProductSource.objects.create(
                    product=product,
                    provider=preview.provider,
                    source_product_id=preview.source_product_id,
                    source_url=request.url,
                    canonical_url=preview.canonical_url,
                    source_price_jpy=prepared.product.source_price,
                    source_currency=prepared.product.source_currency,
                    source_availability=prepared.product.availability,
                    source_stock_quantity=prepared.product.stock_quantity,
                    external_image_url=external_image_url,
                    affiliate_url=(
                        str(prepared.product.affiliate_url)
                        if prepared.product.affiliate_url is not None
                        else None
                    ),
                    raw_data=prepared.product.raw_data,
                    data_hash=ProductSource.compute_data_hash(prepared.product.raw_data),
                    fetched_at=prepared.product.fetched_at,
                    expires_at=prepared.product.expires_at,
                    last_synced_at=timezone.now(),
                    sync_status=SourceSyncStatus.SUCCESS,
                )

                ProductPriceHistory.objects.create(
                    product=product,
                    source=product_source,
                    source_price_jpy=prepared.product.source_price,
                    calculated_price_usd=prepared.pricing.selling_price_usd,
                    calculation_snapshot=prepared.pricing.calculation_snapshot,
                )

                self.audit_service.log(
                    action='product_source.import',
                    actor=actor,
                    product_id=product.id,
                    provider=preview.provider,
                    source_product_id=preview.source_product_id,
                    dry_run=False,
                    input_summary=request.model_dump(mode='json'),
                    result_summary={'product_id': product.id, 'source_id': product_source.id},
                )
        except IntegrityError as exc:
            self._delete_stored_image(stored_image_storage, stored_image_name)
            if (
                ProductSource.objects.filter(
                    provider=preview.provider,
                    source_product_id=preview.source_product_id,
                ).exists()
                or Product.objects.filter(pk=preview.product_payload.id).exists()
            ):
                raise DuplicateSourceProductError(
                    'Sản phẩm nguồn hoặc Product ID đã tồn tại.',
                    details={
                        'provider': preview.provider,
                        'source_product_id': preview.source_product_id,
                        'product_id': preview.product_payload.id,
                    },
                ) from exc
            raise
        except Exception:
            self._delete_stored_image(stored_image_storage, stored_image_name)
            raise

        return ImportResult(
            success=True,
            product_id=product.id,
            source_id=product_source.id,
            status=product.status,
            warnings=preview.warnings,
            dry_run=False,
        )

    def bulk_import(self, request: BulkImportRequest, actor=None) -> BulkImportResult:
        max_batch = min(50, max(1, settings.SOURCE_IMPORT_MAX_BATCH))
        if len(request.urls) > max_batch:
            raise InvalidImportRequestError(
                f'Batch vượt quá giới hạn {max_batch} URL.',
                details={'max_batch': max_batch, 'total': len(request.urls)},
            )

        safe_actor = actor if getattr(actor, 'is_authenticated', False) else None
        job = None
        if not request.dry_run:
            job = SourceImportJob.objects.create(
                job_type=ImportJobType.IMPORT,
                status=ImportJobStatus.RUNNING,
                dry_run=False,
                total=len(request.urls),
                payload=request.model_dump(mode='json'),
                initiated_by=safe_actor,
                started_at=timezone.now(),
            )

        succeeded = 0
        failed = 0
        items: list[BulkImportItemResult] = []
        for url in request.urls:
            try:
                result = self.import_product(
                    ImportSourceProductRequest(
                        url=url,
                        category_id=request.category_id,
                        default_weight_kg=request.default_weight_kg,
                        default_stock=request.default_stock,
                        image_mode=request.image_mode,
                        dry_run=request.dry_run,
                    ),
                    actor,
                )
                items.append(
                    BulkImportItemResult(
                        url=url,
                        success=True,
                        product_id=result.product_id,
                        source_id=result.source_id,
                        preview=(
                            result.preview.model_dump(mode='json') if result.preview else None
                        ),
                    ),
                )
                succeeded += 1
            except Exception as exc:  # each URL must produce its own result
                failed += 1
                items.append(
                    BulkImportItemResult(
                        url=url,
                        success=False,
                        error_code=getattr(exc, 'code', 'IMPORT_FAILED'),
                        message=str(exc),
                    ),
                )

        if job is not None:
            job.succeeded = succeeded
            job.failed = failed
            job.status = (
                ImportJobStatus.SUCCESS
                if failed == 0
                else (ImportJobStatus.FAILED if succeeded == 0 else ImportJobStatus.PARTIAL)
            )
            job.result = {'items': [item.model_dump(mode='json') for item in items]}
            job.finished_at = timezone.now()
            job.save(
                update_fields=[
                    'succeeded', 'failed', 'status', 'result', 'finished_at',
                ],
            )

        return BulkImportResult(
            job_id=job.id if job is not None else None,
            dry_run=request.dry_run,
            total=len(request.urls),
            succeeded=succeeded,
            failed=failed,
            items=items,
        )

    @staticmethod
    def _delete_stored_image(storage, name: str | None) -> None:
        if storage is None or not name:
            return
        try:
            storage.delete(name)
        except Exception:
            # Preserve the original database/import error. Storage cleanup can be
            # retried separately if the backend is temporarily unavailable.
            pass
