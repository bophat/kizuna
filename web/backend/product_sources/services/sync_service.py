from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from product_sources.enums import (
    ImportJobStatus,
    ImportJobType,
    SourceAvailability,
    SourceSyncStatus,
)
from product_sources.exceptions import SourceImportError
from product_sources.models import ProductPriceHistory, ProductSource, SourceImportJob
from product_sources.providers import build_provider_registry
from product_sources.services.audit_service import AuditService
from product_sources.services.normalize_service import normalize_provider_product
from product_sources.services.pricing_service import ProductPricingService
from shop.models import ProductStatus

def _safe_provider_error(exc: Exception) -> str:
    if isinstance(exc, SourceImportError):
        return exc.message
    return f'Provider request failed ({type(exc).__name__}).'


def _serialize_updates(updates: dict) -> dict:
    return {
        key: str(value) if isinstance(value, Decimal) else value
        for key, value in updates.items()
    }


class SyncService:
    def __init__(self, *, provider_registry=None):
        self.provider_registry = provider_registry or build_provider_registry()
        self.pricing_service = ProductPricingService()
        self.audit_service = AuditService()

    def sync_product(
        self,
        *,
        product_id: str,
        update_product_price: bool = False,
        update_stock: bool = True,
        dry_run: bool = True,
        actor=None,
    ) -> dict:
        try:
            source = ProductSource.objects.select_related('product').get(product_id=product_id)
        except ProductSource.DoesNotExist:
            return {
                'success': False,
                'error_code': 'PRODUCT_NOT_FOUND',
                'error': f'ProductSource not found for product_id={product_id}',
            }

        provider = self.provider_registry.get_by_code(source.provider)
        try:
            provider_product = provider.get_product(
                source.source_product_id,
                canonical_url=source.canonical_url,
            )
            normalized = normalize_provider_product(provider_product)
        except Exception as exc:
            error_message = _safe_provider_error(exc)
            if not dry_run:
                with transaction.atomic():
                    locked_source = ProductSource.objects.select_for_update().get(pk=source.pk)
                    locked_source.sync_status = SourceSyncStatus.FAILED
                    locked_source.last_error = error_message
                    locked_source.last_synced_at = timezone.now()
                    locked_source.save(
                        update_fields=['sync_status', 'last_error', 'last_synced_at', 'updated_at'],
                    )
                    self.audit_service.log(
                        action='product_source.sync_failed',
                        actor=actor,
                        product_id=product_id,
                        provider=source.provider,
                        source_product_id=source.source_product_id,
                        dry_run=False,
                        result_summary={'error': error_message},
                    )
            return {
                'success': False,
                'error_code': getattr(exc, 'code', 'PROVIDER_TEMPORARY_ERROR'),
                'error': error_message,
                'dry_run': dry_run,
            }

        old_source_price = source.source_price_jpy
        old_source_currency = source.source_currency
        new_source_price = normalized.source_price
        new_source_currency = normalized.source_currency
        previous_product_price = source.product.price
        warnings: list[str] = []
        updates: dict = {}
        price_changed = (
            new_source_price is not None
            and (
                new_source_price != old_source_price
                or new_source_currency != old_source_currency
            )
        )
        calculated_price = previous_product_price
        calculation_snapshot: dict = {}

        if price_changed:
            weight = normalized.weight_kg or source.product.weight
            if weight is None:
                warnings.append('Không thể tính lại giá vì thiếu weight; cần admin review.')
                updates['status'] = ProductStatus.REVIEW
                calculation_snapshot = {'error': 'WEIGHT_REQUIRED'}
            else:
                pricing = self.pricing_service.calculate(
                    source_price_jpy=new_source_price,
                    source_currency=new_source_currency,
                    weight_kg=weight,
                    usd_vnd_rate=Decimal(str(settings.USD_VND_RATE)),
                )
                calculated_price = pricing.selling_price_usd
                calculation_snapshot = pricing.calculation_snapshot

                if new_source_currency != old_source_currency:
                    warnings.append(
                        'Đơn vị tiền nguồn đã thay đổi; sản phẩm cần admin kiểm tra.'
                    )
                    updates['status'] = ProductStatus.REVIEW
                    if update_product_price:
                        updates['price'] = calculated_price
                elif old_source_price is None or old_source_price <= 0:
                    warnings.append('Chưa có giá nguồn trước đó để tính phần trăm thay đổi.')
                    updates['status'] = ProductStatus.REVIEW
                else:
                    change_percent = (
                        (new_source_price - old_source_price) / old_source_price
                    ) * Decimal('100')
                    auto_update_threshold = Decimal(
                        str(settings.AUTO_UPDATE_MAX_INCREASE_PERCENT),
                    )
                    review_threshold = Decimal(str(settings.REVIEW_PRICE_INCREASE_PERCENT))

                    if change_percent >= review_threshold:
                        warnings.append(
                            f'Giá nguồn tăng quá mạnh (+{change_percent:.1f}%); đã đình chỉ sản phẩm.',
                        )
                        updates['status'] = ProductStatus.SUSPENDED
                    elif change_percent > auto_update_threshold:
                        warnings.append(
                            f'Giá nguồn tăng +{change_percent:.1f}%; cần admin review.',
                        )
                        updates['status'] = ProductStatus.REVIEW
                    elif change_percent > 0:
                        if update_product_price:
                            updates['price'] = calculated_price
                        else:
                            warnings.append(
                                'Giá nguồn tăng nhưng update_product_price=false; giữ nguyên giá bán.',
                            )
                    else:
                        warnings.append('Giá nguồn giảm; giữ nguyên giá bán theo policy hiện tại.')

        # Availability unknown/available never changes internal stock implicitly.
        if (
            update_stock
            and normalized.availability == SourceAvailability.UNAVAILABLE
            and source.product.stock != 0
        ):
            updates['stock'] = 0

        result = {
            'success': True,
            'dry_run': dry_run,
            'updates': _serialize_updates(updates),
            'warnings': warnings,
            'price_changed': price_changed,
            'new_calculated_price_usd': str(calculated_price),
        }
        if dry_run:
            return result

        with transaction.atomic():
            locked_source = ProductSource.objects.select_for_update().select_related('product').get(
                pk=source.pk,
            )
            product = locked_source.product

            if 'price' in updates:
                product.price = updates['price']
            if 'status' in updates:
                product.status = updates['status']
            if 'stock' in updates:
                product.stock = updates['stock']
            if updates:
                product.save()

            if new_source_price is not None:
                locked_source.source_price_jpy = new_source_price
            locked_source.source_currency = normalized.source_currency
            locked_source.source_availability = normalized.availability
            locked_source.source_stock_quantity = normalized.stock_quantity
            locked_source.external_image_url = (
                str(normalized.images[0].url) if normalized.images else None
            )
            locked_source.affiliate_url = (
                str(normalized.affiliate_url) if normalized.affiliate_url is not None else None
            )
            locked_source.fetched_at = normalized.fetched_at
            locked_source.expires_at = normalized.expires_at
            locked_source.sync_status = SourceSyncStatus.SUCCESS
            locked_source.last_error = None
            locked_source.last_synced_at = timezone.now()
            locked_source.raw_data = normalized.raw_data
            locked_source.data_hash = ProductSource.compute_data_hash(normalized.raw_data)
            locked_source.save()

            if price_changed and new_source_price is not None:
                ProductPriceHistory.objects.create(
                    product=product,
                    source=locked_source,
                    source_price_jpy=new_source_price,
                    calculated_price_usd=calculated_price,
                    previous_product_price_usd=previous_product_price,
                    calculation_snapshot=calculation_snapshot,
                )

            self.audit_service.log(
                action='product_source.sync',
                actor=actor,
                product_id=product.id,
                provider=locked_source.provider,
                source_product_id=locked_source.source_product_id,
                dry_run=False,
                input_summary={
                    'update_product_price': update_product_price,
                    'update_stock': update_stock,
                },
                result_summary=result,
            )
        return result

    def bulk_sync(
        self,
        *,
        provider: str | None = None,
        product_ids: list[str] | None = None,
        limit: int = 100,
        update_product_price: bool = False,
        update_stock: bool = True,
        dry_run: bool = True,
        actor=None,
    ) -> dict:
        queryset = ProductSource.objects.all().order_by('pk')
        if provider:
            queryset = queryset.filter(provider=provider)
        if product_ids:
            queryset = queryset.filter(product_id__in=product_ids)
        selected_product_ids = list(
            queryset.values_list('product_id', flat=True)[:limit],
        )

        safe_actor = actor if getattr(actor, 'is_authenticated', False) else None
        job = None
        if not dry_run:
            job = SourceImportJob.objects.create(
                job_type=ImportJobType.SYNC,
                provider=provider or '',
                status=ImportJobStatus.RUNNING,
                dry_run=False,
                total=len(selected_product_ids),
                payload={
                    'product_ids': selected_product_ids,
                    'update_product_price': update_product_price,
                    'update_stock': update_stock,
                },
                initiated_by=safe_actor,
                started_at=timezone.now(),
            )

        items = []
        succeeded = 0
        failed = 0
        for product_id in selected_product_ids:
            item_result = self.sync_product(
                product_id=product_id,
                update_product_price=update_product_price,
                update_stock=update_stock,
                dry_run=dry_run,
                actor=actor,
            )
            items.append({'product_id': product_id, **item_result})
            if item_result.get('success'):
                succeeded += 1
            else:
                failed += 1

        if job is not None:
            job.succeeded = succeeded
            job.failed = failed
            job.status = (
                ImportJobStatus.SUCCESS
                if failed == 0
                else (ImportJobStatus.FAILED if succeeded == 0 else ImportJobStatus.PARTIAL)
            )
            job.result = {'items': items}
            job.finished_at = timezone.now()
            job.save(
                update_fields=['succeeded', 'failed', 'status', 'result', 'finished_at'],
            )

        return {
            'job_id': job.id if job is not None else None,
            'dry_run': dry_run,
            'total': len(selected_product_ids),
            'succeeded': succeeded,
            'failed': failed,
            'items': items,
        }
