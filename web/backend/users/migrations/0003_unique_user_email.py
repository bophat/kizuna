"""Make one email mean one account.

RegisterSerializer already refused a duplicate email, but only for requests
that went through it - the admin panel, management commands and any concurrent
pair of signups could still land two rows with the same address. That matters
now that guest checkout looks an account up by email.

Existing duplicates are suffixed rather than deleted: four of the five
test@test.com rows own orders, and dropping a User cascades to them.
"""

from django.db import migrations


def dedupe_emails(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    seen = {}
    for user in User.objects.exclude(email='').order_by('id'):
        key = user.email.strip().lower()
        if key not in seen:
            seen[key] = user.id
            continue
        # Keep the oldest account on the original address and park the rest on
        # a tagged variant so the data survives and the constraint can apply.
        local, _, domain = key.partition('@')
        user.email = f'{local}+dup{user.id}@{domain}'
        user.save(update_fields=['email'])


def noop(apps, schema_editor):
    """Suffixed addresses are left alone; restoring them would re-duplicate."""


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_twofactorsetting'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(dedupe_emails, noop),
        # Case-insensitive so Test@x.com cannot shadow test@x.com, and partial
        # so the accounts with no email on file stay valid.
        migrations.RunSQL(
            sql=(
                'CREATE UNIQUE INDEX IF NOT EXISTS users_user_email_unique_ci '
                "ON auth_user (LOWER(email)) WHERE email != '';"
            ),
            reverse_sql='DROP INDEX IF EXISTS users_user_email_unique_ci;',
        ),
    ]
