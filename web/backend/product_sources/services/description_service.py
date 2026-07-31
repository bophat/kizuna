from product_sources.services.product_id_generator import provider_location


def build_description_draft(
    *,
    product_name: str,
    brand: str | None,
    provider: str,
    weight_kg: str | None,
    facts: list[str] | None = None,
) -> str:
    brand_line = brand or 'Đang cập nhật'
    weight_line = f'{weight_kg} kg' if weight_kg else 'Đang cập nhật'
    source_label = provider_location(provider)

    fact_lines = [
        f'- {fact.strip()}'
        for fact in (facts or [])[:5]
        if fact and fact.strip()
    ]
    details = (
        'Thông tin nổi bật:\n' + '\n'.join(fact_lines)
        if fact_lines
        else (
            'Thông tin chi tiết đang được cập nhật. '
            'Vui lòng kiểm tra thông tin sản phẩm trước khi đặt hàng.'
        )
    )

    return (
        f'{product_name}\n\n'
        f'Thương hiệu: {brand_line}\n'
        f'Nguồn sản phẩm: {source_label}\n'
        f'Khối lượng tham khảo: {weight_line}\n\n'
        f'{details}'
    )
