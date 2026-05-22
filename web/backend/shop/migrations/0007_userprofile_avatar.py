from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0006_userprofile_points'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='avatar',
            field=models.ImageField(blank=True, null=True, upload_to='avatars/'),
        ),
    ]
