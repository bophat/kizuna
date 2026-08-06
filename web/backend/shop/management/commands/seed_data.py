"""Create deterministic catalog data for development and load testing."""

from decimal import Decimal, ROUND_HALF_UP
import random

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from shop.models import Category, Coupon, Product, ProductStatus


PRODUCT_PREFIX = 'SEED-P'
COUPON_PREFIX = 'SEED-'
CATEGORY_PREFIX = 'seed-'
USD_TO_VND = Decimal('25000')

CATEGORY_DATA = [
    ('ceramics', 'Ceramics', '陶磁器', 'Gốm sứ'),
    ('tea', 'Tea utensils', '茶道具', 'Dụng cụ trà'),
    ('woodwork', 'Woodwork', '木工品', 'Đồ gỗ'),
    ('textiles', 'Textiles', '織物', 'Dệt may'),
    ('kitchenware', 'Kitchenware', '台所用品', 'Đồ dùng nhà bếp'),
    ('stationery', 'Stationery', '文房具', 'Văn phòng phẩm'),
    ('home-decor', 'Home decor', 'インテリア', 'Trang trí nhà'),
    ('fashion', 'Fashion', 'ファッション', 'Thời trang'),
    ('accessories', 'Accessories', 'アクセサリー', 'Phụ kiện'),
    ('beauty', 'Beauty', '美容', 'Làm đẹp'),
    ('food', 'Japanese food', '日本食品', 'Thực phẩm Nhật'),
    ('snacks', 'Snacks', 'お菓子', 'Bánh kẹo'),
    ('toys', 'Toys', 'おもちゃ', 'Đồ chơi'),
    ('collectibles', 'Collectibles', 'コレクション', 'Đồ sưu tầm'),
    ('anime', 'Anime goods', 'アニメグッズ', 'Sản phẩm anime'),
    ('electronics', 'Electronics', '電化製品', 'Điện tử'),
    ('outdoor', 'Outdoor', 'アウトドア', 'Ngoài trời'),
    ('travel', 'Travel goods', '旅行用品', 'Đồ du lịch'),
    ('wellness', 'Wellness', '健康用品', 'Chăm sóc sức khỏe'),
    ('gifts', 'Japanese gifts', '日本の贈り物', 'Quà tặng Nhật Bản'),
]

SERIES_DATA = [
    ('Artisan', '職人仕上げ', 'Thủ công'),
    ('Classic', '定番', 'Cổ điển'),
    ('Modern', 'モダン', 'Hiện đại'),
    ('Premium', '上質', 'Cao cấp'),
    ('Everyday', '日常使い', 'Hằng ngày'),
]

BRANDS = [
    'Aozora', 'Hikari', 'Kintsugi Lab', 'Mori', 'Nippon Craft',
    'Sakura Works', 'Shiro', 'Takumi', 'Tsuki', 'Yamato',
]
LOCATIONS = [
    'Tokyo', 'Kyoto', 'Osaka', 'Aichi', 'Fukuoka',
    'Hokkaido', 'Ishikawa', 'Kagawa', 'Nara', 'Okinawa',
]


class Command(BaseCommand):
    help = (
        'Create deterministic seed data. Defaults to 1,000 products, '
        '20 localized categories and 50 coupons.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--products',
            dest='product_count',
            type=int,
            default=1000,
            help='Number of products to create (default: 1000).',
        )
        parser.add_argument(
            '--coupons',
            dest='coupon_count',
            type=int,
            default=50,
            help='Number of general coupons to create (default: 50).',
        )
        parser.add_argument(
            '--seed',
            dest='random_seed',
            type=int,
            default=2026,
            help='Deterministic random seed (default: 2026).',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=500,
            help='Database insert batch size (default: 500).',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete prior SEED-* rows before creating fresh data.',
        )
        parser.add_argument(
            '--clear-only',
            action='store_true',
            help='Delete prior SEED-* rows and stop without creating data.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Validate and print the plan without writing to the database.',
        )

    def handle(self, *args, **options):
        product_count = options['product_count']
        coupon_count = options['coupon_count']
        batch_size = options['batch_size']
        self._validate_options(product_count, coupon_count, batch_size)

        if options['dry_run']:
            self.stdout.write(
                'Dry run: '
                f'products={product_count} categories={len(CATEGORY_DATA)} '
                f'coupons={coupon_count} seed={options["random_seed"]}'
            )
            return

        with transaction.atomic():
            removed = {'products': 0, 'categories': 0, 'coupons': 0, 'protected': 0}
            if options['clear'] or options['clear_only']:
                removed = self._clear_seed_data()
            if options['clear_only']:
                self.stdout.write(self.style.SUCCESS(self._clear_message(removed)))
                return

            categories = self._upsert_categories()
            product_result = self._create_products(
                product_count,
                categories,
                options['random_seed'],
                batch_size,
            )
            coupon_result = self._create_coupons(coupon_count, batch_size)

        if options['clear']:
            self.stdout.write(self._clear_message(removed))
        self.stdout.write(
            self.style.SUCCESS(
                'Seed complete: '
                f'products created={product_result[0]} skipped={product_result[1]} '
                f'total={product_count}; categories={len(categories)}; '
                f'coupons created={coupon_result[0]} skipped={coupon_result[1]} '
                f'total={coupon_count}.'
            )
        )

    @staticmethod
    def _validate_options(product_count, coupon_count, batch_size):
        if not 0 <= product_count <= 100000:
            raise CommandError('--products must be between 0 and 100000.')
        if not 0 <= coupon_count <= 5000:
            raise CommandError('--coupons must be between 0 and 5000.')
        if not 1 <= batch_size <= 5000:
            raise CommandError('--batch-size must be between 1 and 5000.')

    @staticmethod
    def _clear_message(removed):
        message = (
            'Seed data removed: '
            f'products={removed["products"]} categories={removed["categories"]} '
            f'coupons={removed["coupons"]}'
        )
        if removed['protected']:
            message += f'; retained used coupons={removed["protected"]}'
        return message + '.'

    @staticmethod
    def _clear_seed_data():
        products, _ = Product.objects.filter(id__startswith=PRODUCT_PREFIX).delete()

        coupon_queryset = Coupon.objects.filter(code__startswith=COUPON_PREFIX)
        protected_ids = list(
            coupon_queryset.filter(redemptions__isnull=False)
            .values_list('id', flat=True)
            .distinct()
        )
        coupons, _ = coupon_queryset.exclude(id__in=protected_ids).delete()
        categories, _ = Category.objects.filter(
            slug__startswith=CATEGORY_PREFIX
        ).delete()
        return {
            'products': products,
            'categories': categories,
            'coupons': coupons,
            'protected': len(protected_ids),
        }

    @staticmethod
    def _upsert_categories():
        categories = []
        for slug_suffix, name_en, name_ja, name_vi in CATEGORY_DATA:
            category, _ = Category.objects.update_or_create(
                slug=f'{CATEGORY_PREFIX}{slug_suffix}',
                defaults={
                    'name': name_en,
                    'name_en': name_en,
                    'name_ja': name_ja,
                    'name_vi': name_vi,
                },
            )
            categories.append(category)
        return categories

    @staticmethod
    def _create_products(product_count, categories, random_seed, batch_size):
        requested_ids = [
            f'{PRODUCT_PREFIX}{index:06d}' for index in range(1, product_count + 1)
        ]
        requested_id_set = set(requested_ids)
        existing_ids = set(
            Product.objects.filter(id__startswith=PRODUCT_PREFIX).values_list(
                'id', flat=True
            )
        ).intersection(requested_id_set)
        rng = random.Random(random_seed)
        products = []
        for index, product_id in enumerate(requested_ids, start=1):
            category = categories[(index - 1) % len(categories)]
            series_en, series_ja, series_vi = SERIES_DATA[(index - 1) % len(SERIES_DATA)]
            price = Decimal(rng.randrange(8, 401)).quantize(Decimal('0.01'))
            cost_ratio = Decimal(rng.randrange(55, 81)) / Decimal('100')
            cost_price_vnd = (price * USD_TO_VND * cost_ratio).quantize(
                Decimal('1'), rounding=ROUND_HALF_UP
            )
            if product_id in existing_ids:
                continue
            products.append(
                Product(
                    id=product_id,
                    name=f'{series_en} {category.name_en} {index:04d}',
                    name_en=f'{series_en} {category.name_en} {index:04d}',
                    name_ja=f'{category.name_ja} {series_ja} {index:04d}',
                    name_vi=f'{category.name_vi} {series_vi} {index:04d}',
                    price=price,
                    cost_price_vnd=cost_price_vnd,
                    currency='USD',
                    status=ProductStatus.PUBLISHED,
                    category=category,
                    brand=BRANDS[(index - 1) % len(BRANDS)],
                    location=LOCATIONS[(index - 1) % len(LOCATIONS)],
                    description=(
                        f'Deterministic KIZUNA demo product {index}. '
                        'Created for catalog, search and performance testing.'
                    ),
                    description_en=(
                        f'Deterministic KIZUNA demo product {index}. '
                        'Created for catalog, search and performance testing.'
                    ),
                    description_ja=(
                        f'KIZUNAのデモ商品 {index}。カタログ、検索、性能テスト用のデータです。'
                    ),
                    description_vi=(
                        f'Sản phẩm mẫu KIZUNA số {index}, dùng để kiểm tra danh mục, '
                        'tìm kiếm và hiệu năng.'
                    ),
                    image=f'https://picsum.photos/seed/kizuna-{index:06d}/800/1000',
                    is_limited=index % 11 == 0,
                    is_new=index % 5 == 0,
                    is_featured=index % 17 == 0,
                    is_cheap=price <= Decimal('50'),
                    likes=rng.randrange(0, 1001),
                    sales=rng.randrange(0, 251),
                    stock=rng.randrange(0, 101),
                    weight=(Decimal(rng.randrange(10, 301)) / Decimal('100')).quantize(
                        Decimal('0.01')
                    ),
                )
            )
        Product.objects.bulk_create(products, batch_size=batch_size)
        return len(products), len(existing_ids)

    @staticmethod
    def _create_coupons(coupon_count, batch_size):
        requested_codes = [
            f'{COUPON_PREFIX}{index:04d}' for index in range(1, coupon_count + 1)
        ]
        requested_code_set = set(requested_codes)
        existing_codes = set(
            Coupon.objects.filter(code__startswith=COUPON_PREFIX).values_list(
                'code', flat=True
            )
        ).intersection(requested_code_set)
        coupons = []
        for index, code in enumerate(requested_codes, start=1):
            if code in existing_codes:
                continue
            fixed_amount = index % 4 == 0
            coupons.append(
                Coupon(
                    code=code,
                    description=f'Generated demo coupon {index}',
                    discount_type=(
                        Coupon.DiscountType.FIXED
                        if fixed_amount
                        else Coupon.DiscountType.PERCENTAGE
                    ),
                    discount_value=(
                        Decimal(50000 + (index % 5) * 25000)
                        if fixed_amount
                        else Decimal(5 + (index % 5) * 5)
                    ),
                    amount_currency=Coupon.AmountCurrency.VND,
                    minimum_order_amount=Decimal(300000 + (index % 6) * 150000),
                    maximum_discount_amount=(
                        None
                        if fixed_amount
                        else Decimal(100000 + (index % 5) * 50000)
                    ),
                    usage_limit=100,
                    per_user_limit=1,
                    starts_at=None,
                    expires_at=None,
                    is_active=True,
                    source=Coupon.Source.MANUAL,
                )
            )
        Coupon.objects.bulk_create(coupons, batch_size=batch_size)
        return len(coupons), len(existing_codes)
