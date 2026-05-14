from django.core.management.base import BaseCommand
from shop.models import Product, Category
from django.utils.text import slugify

class Command(BaseCommand):
    help = 'Seed the database with initial product data'

    def handle(self, *args, **kwargs):
        products_data = [
            {
                'id': 'hakeme-bowl',
                'name': 'Hakeme Stoneware Bowl',
                'price': 145,
                'category': 'Ceramics',
                'description': 'Rustic handmade ceramic stoneware bowl with hakeme brush strokes.',
                'image': 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=2070&auto=format&fit=crop',
                'likes': 124,
                'sales': 45,
            },
            {
                'id': 'hinoki-bento',
                'name': 'Vintage Hinoki Wood Bento Box',
                'price': 450,
                'category': 'Woodwork',
                'description': 'Authentic, early-Showa era piece crafted from premium Hinoki wood.',
                'image': 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?q=80&w=2069&auto=format&fit=crop',
                'likes': 89,
                'sales': 12,
            },
            {
                'id': 'takayama-chasen',
                'name': 'Takayama Chasen',
                'price': 65,
                'category': 'Tea',
                'description': 'Hand-carved bamboo matcha whisk.',
                'image': 'https://images.unsplash.com/photo-1544787210-2211d40369cc?q=80&w=1974&auto=format&fit=crop',
                'likes': 215,
                'sales': 82,
            },
            {
                'id': 'organic-linen',
                'name': 'Organic Linen Set',
                'price': 80,
                'category': 'Textiles',
                'description': 'Hand-woven organic linen napkins in muted tones.',
                'image': 'https://images.unsplash.com/photo-1528459840556-42d0aa990650?q=80&w=2072&auto=format&fit=crop',
                'likes': 56,
                'sales': 18,
            },
            {
                'id': 'tetsubin-kettle',
                'name': 'Cast Iron Tetsubin Kettle',
                'price': 285,
                'category': 'Tea',
                'description': 'Traditional Nanbu Tekki cast iron kettle with dragonfly motif.',
                'image': 'https://images.unsplash.com/photo-1563228186-0775d7139f4e?q=80&w=2070&auto=format&fit=crop',
                'likes': 178,
                'sales': 34,
            },
            {
                'id': 'bamboo-basket',
                'name': 'Woven Bamboo Flower Basket',
                'price': 120,
                'category': 'Woodwork',
                'description': 'Hand-woven bamboo basket for ikebana arrangements.',
                'image': 'https://images.unsplash.com/photo-1590123512217-1a48c18c460d?q=80&w=2070&auto=format&fit=crop',
                'likes': 42,
                'sales': 9,
            },
            {
                'id': 'indigo-scarf',
                'name': 'Natural Indigo Hand-Dyed Scarf',
                'price': 155,
                'category': 'Textiles',
                'description': '100% silk scarf dyed with fermented natural indigo.',
                'image': 'https://images.unsplash.com/photo-1520903074185-8ec362b39c67?q=80&w=2070&auto=format&fit=crop',
                'likes': 92,
                'sales': 27,
            },
            {
                'id': 'sake-set',
                'name': 'Hammered Copper Sake Set',
                'price': 320,
                'category': 'Ceramics',
                'description': 'Hand-hammered copper sake server and two matching cups.',
                'image': 'https://images.unsplash.com/photo-1582715434382-97e42cf41c39?q=80&w=2070&auto=format&fit=crop',
                'likes': 145,
                'sales': 15,
            }
        ]

        for item in products_data:
            category, _ = Category.objects.get_or_create(
                name=item['category'],
                defaults={'slug': slugify(item['category'])}
            )
            Product.objects.get_or_create(
                id=item['id'],
                defaults={
                    'name': item['name'],
                    'price': item['price'],
                    'category': category,
                    'description': item['description'],
                    'image': item['image'],
                    'stock': 50,
                    'likes': item['likes'],
                    'sales': item['sales'],
                }
            )

        self.stdout.write(self.style.SUCCESS('Successfully seeded product data'))
