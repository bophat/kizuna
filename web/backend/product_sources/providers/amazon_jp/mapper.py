from __future__ import annotations

from datetime import timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from django.utils import timezone

from product_sources.enums import SourceProvider
from product_sources.exceptions import ProviderTemporaryError
from product_sources.schemas.provider_product import ProviderImage, ProviderProduct


def _display_value(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    display_value = value.get('displayValue')
    if display_value is None:
        return None
    cleaned = str(display_value).strip()
    return cleaned or None


def _weight_kg(item_info: dict[str, Any]) -> Decimal | None:
    product_info = item_info.get('productInfo')
    if not isinstance(product_info, dict):
        return None
    dimensions = product_info.get('itemDimensions')
    if not isinstance(dimensions, dict):
        return None
    weight = dimensions.get('weight')
    if not isinstance(weight, dict):
        return None
    try:
        value = Decimal(str(weight.get('displayValue')))
    except (InvalidOperation, TypeError, ValueError):
        return None
    unit = str(weight.get('unit', '')).strip().lower()
    factors = {
        'kg': Decimal('1'),
        'kilogram': Decimal('1'),
        'kilograms': Decimal('1'),
        'g': Decimal('0.001'),
        'gram': Decimal('0.001'),
        'grams': Decimal('0.001'),
        'pound': Decimal('0.45359237'),
        'pounds': Decimal('0.45359237'),
        'lb': Decimal('0.45359237'),
        'lbs': Decimal('0.45359237'),
        'ounce': Decimal('0.028349523125'),
        'ounces': Decimal('0.028349523125'),
        'oz': Decimal('0.028349523125'),
    }
    factor = factors.get(unit)
    if factor is None or value < 0:
        return None
    return (value * factor).quantize(Decimal('0.001'))


def _images(item: dict[str, Any]) -> list[ProviderImage]:
    image_data = item.get('images')
    if not isinstance(image_data, dict):
        return []
    result: list[ProviderImage] = []
    primary = image_data.get('primary')
    if isinstance(primary, dict):
        for size in ('large', 'hiRes', 'medium', 'small'):
            details = primary.get(size)
            url = details.get('url') if isinstance(details, dict) else None
            if isinstance(url, str) and url:
                result.append(ProviderImage(url=url, is_primary=True, sort_order=0))
                break

    variants = image_data.get('variants')
    if isinstance(variants, list):
        for index, variant in enumerate(variants, start=1):
            if not isinstance(variant, dict):
                continue
            for size in ('large', 'hiRes', 'medium', 'small'):
                details = variant.get(size)
                url = details.get('url') if isinstance(details, dict) else None
                if isinstance(url, str) and url:
                    result.append(
                        ProviderImage(url=url, is_primary=False, sort_order=index),
                    )
                    break
    return result


def _listing_data(item: dict[str, Any]) -> tuple[dict[str, Any] | None, Decimal | None, str]:
    offers = item.get('offersV2')
    listings = offers.get('listings') if isinstance(offers, dict) else None
    valid_listings = [value for value in listings or [] if isinstance(value, dict)]
    if not valid_listings:
        return None, None, 'JPY'
    listing = next(
        (value for value in valid_listings if value.get('isBuyBoxWinner') is True),
        valid_listings[0],
    )
    price = listing.get('price')
    money = price.get('money') if isinstance(price, dict) else None
    if not isinstance(money, dict):
        return listing, None, 'JPY'
    try:
        amount = Decimal(str(money.get('amount')))
    except (InvalidOperation, TypeError, ValueError):
        amount = None
    currency = str(money.get('currency') or 'JPY').upper()
    return listing, amount, currency


def _availability(listing: dict[str, Any] | None) -> str:
    if not listing:
        return 'unknown'
    availability = listing.get('availability')
    availability_type = (
        str(availability.get('type', '')).strip().upper().replace(' ', '_')
        if isinstance(availability, dict)
        else ''
    )
    if availability_type in {'IN_STOCK', 'IN_STOCK_SCARCE', 'LEADTIME', 'PREORDER'}:
        return 'available'
    if availability_type in {'OUT_OF_STOCK', 'UNAVAILABLE', 'AVAILABLE_DATE'}:
        return 'unavailable'
    return 'unknown'


def _jan_code(item_info: dict[str, Any]) -> str | None:
    external_ids = item_info.get('externalIds')
    if not isinstance(external_ids, dict):
        return None
    for key in ('eans', 'upcs', 'isbns'):
        identifier = external_ids.get(key)
        values = identifier.get('displayValues') if isinstance(identifier, dict) else None
        if isinstance(values, list) and values:
            value = str(values[0]).strip()
            if value:
                return value
    return None


def map_amazon_item(
    item: dict[str, Any],
    *,
    source_product_id: str,
    canonical_url: str,
) -> ProviderProduct:
    item_info = item.get('itemInfo')
    if not isinstance(item_info, dict):
        item_info = {}
    name = _display_value(item_info.get('title'))
    if not name:
        raise ProviderTemporaryError(
            'Amazon không trả tên sản phẩm.',
            details={'source_product_id': source_product_id},
        )

    byline = item_info.get('byLineInfo')
    byline = byline if isinstance(byline, dict) else {}
    brand = _display_value(byline.get('brand')) or _display_value(byline.get('manufacturer'))

    classifications = item_info.get('classifications')
    classifications = classifications if isinstance(classifications, dict) else {}
    source_category = _display_value(classifications.get('productGroup'))

    listing, source_price, currency = _listing_data(item)
    if source_price is not None and currency != 'JPY':
        raise ProviderTemporaryError(
            'Amazon trả giá không phải JPY; đã dừng import để tránh tính sai giá.',
            details={'source_product_id': source_product_id, 'currency': currency},
        )
    merchant = listing.get('merchantInfo') if isinstance(listing, dict) else None
    seller = (
        str(merchant.get('name')).strip()
        if isinstance(merchant, dict) and merchant.get('name')
        else None
    )
    features = item_info.get('features')
    description_facts = features.get('displayValues') if isinstance(features, dict) else []
    description_facts = [
        str(value).strip()[:500]
        for value in description_facts or []
        if str(value).strip()
    ][:10]

    now = timezone.now()
    affiliate_url = item.get('detailPageURL')
    return ProviderProduct(
        provider=SourceProvider.AMAZON_JP,
        source_product_id=source_product_id,
        canonical_url=canonical_url,
        affiliate_url=affiliate_url if isinstance(affiliate_url, str) else None,
        name=name,
        brand=brand,
        seller=seller,
        source_category=source_category,
        jan_code=_jan_code(item_info),
        source_price=source_price,
        source_currency=currency,
        availability=_availability(listing),
        stock_quantity=None,
        weight_kg=_weight_kg(item_info),
        description_facts=description_facts,
        images=_images(item),
        fetched_at=now,
        expires_at=now + timedelta(hours=6),
        raw_data={'item': item},
    )
