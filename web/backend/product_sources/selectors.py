from django.db.models import Q, QuerySet

from product_sources.models import ProductSource


def source_products_needing_review() -> QuerySet[ProductSource]:
    return (
        ProductSource.objects.select_related('product')
        .filter(
            Q(product__status__in=['review', 'suspended'])
            | Q(sync_status__in=['failed', 'stale']),
        )
        .distinct()
        .order_by('product_id')
    )
