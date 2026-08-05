from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from shop.birthday_emails import process_birthday_emails


class Command(BaseCommand):
    help = 'Send one birthday email per eligible customer per calendar year.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            dest='run_date',
            help='Override the local run date (YYYY-MM-DD), useful for tests.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List eligible recipients without creating delivery records or sending email.',
        )

    def handle(self, *args, **options):
        if options['run_date']:
            try:
                run_date = date.fromisoformat(options['run_date'])
            except ValueError as exc:
                raise CommandError('--date must use YYYY-MM-DD format.') from exc
        else:
            try:
                local_zone = ZoneInfo(settings.BIRTHDAY_EMAIL_TIME_ZONE)
            except ZoneInfoNotFoundError as exc:
                raise CommandError(
                    f'Unknown BIRTHDAY_EMAIL_TIME_ZONE: {settings.BIRTHDAY_EMAIL_TIME_ZONE}'
                ) from exc
            run_date = timezone.localdate(timezone=local_zone)

        result = process_birthday_emails(run_date, dry_run=options['dry_run'])
        self.stdout.write(
            'Birthday email result: '
            f"date={result['date']} eligible={result['eligible']} sent={result['sent']} "
            f"already_sent={result['already_sent']} suppressed={result['suppressed']} "
            f"failed={result['failed']} dry_run={result['dry_run']}"
        )
        if options['dry_run']:
            for email in result['recipients']:
                self.stdout.write(f'  - {email}')
        if result['failed']:
            for failure in result['errors']:
                self.stderr.write(
                    f"user_id={failure['user_id']} email={failure['email']}: {failure['error']}"
                )
            raise CommandError(f"{result['failed']} birthday email(s) failed.")
