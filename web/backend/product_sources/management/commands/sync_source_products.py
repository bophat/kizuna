import json

from django.core.management.base import BaseCommand

from product_sources.services.sync_service import SyncService


class Command(BaseCommand):
    help = 'Preview or execute synchronization for imported source products.'

    def add_arguments(self, parser):
        parser.add_argument('--provider', choices=['amazon_jp', 'qoo10_jp'])
        parser.add_argument('--product-id', action='append', dest='product_ids', default=[])
        parser.add_argument('--limit', type=int, default=100)
        parser.add_argument('--update-product-price', action='store_true')
        parser.add_argument('--no-update-stock', action='store_true')
        parser.add_argument(
            '--execute',
            action='store_true',
            help='Write changes. Without this flag the command is a dry-run.',
        )

    def handle(self, *args, **options):
        result = SyncService().bulk_sync(
            provider=options['provider'],
            product_ids=options['product_ids'],
            limit=max(1, min(options['limit'], 1000)),
            update_product_price=options['update_product_price'],
            update_stock=not options['no_update_stock'],
            dry_run=not options['execute'],
        )
        self.stdout.write(json.dumps(result, ensure_ascii=False, indent=2, default=str))
