from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('shop', '0011_localized_category_product_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='conciergesession',
            name='user',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='concierge_sessions',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
