import os
import django
from django.conf import settings
from django.core.files.storage import default_storage

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

print("URL:", default_storage.url('system_images/login_background/test.png'))
