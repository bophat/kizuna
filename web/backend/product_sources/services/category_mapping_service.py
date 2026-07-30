from django.conf import settings

from product_sources.exceptions import CategoryRequiredError
from product_sources.models import SourceCategoryMapping
from shop.models import Category


class CategoryMappingService:
    def resolve_category(
        self,
        *,
        provider: str,
        source_category: str | None,
        category_id: int | None,
    ) -> tuple[Category | None, bool]:
        """
        Returns (category, category_required).
        category_required=True when admin must pick a category before import.
        """
        if category_id is not None:
            try:
                return Category.objects.get(pk=category_id), False
            except Category.DoesNotExist as exc:
                raise CategoryRequiredError(
                    f'Category id={category_id} không tồn tại.',
                    details={'category_id': category_id},
                ) from exc

        if source_category:
            mapping = SourceCategoryMapping.objects.filter(
                provider=provider,
                source_category__iexact=source_category.strip(),
            ).select_related('target_category').first()
            if mapping:
                return mapping.target_category, False

        return None, True

    def get_or_create_from_name(self, name: str) -> Category | None:
        if not name or not name.strip():
            return None
        allow_auto = getattr(settings, 'ALLOW_AUTO_CREATE_CATEGORY', False)
        if not allow_auto:
            return None
        from django.utils.text import slugify

        category_name = name.strip()[:100]
        existing = Category.objects.filter(name__iexact=category_name).first()
        if existing:
            return existing
        base_slug = slugify(category_name) or 'category'
        slug = base_slug
        counter = 1
        while Category.objects.filter(slug=slug).exists():
            slug = f'{base_slug}-{counter}'
            counter += 1
        return Category.objects.create(name=category_name, slug=slug)
