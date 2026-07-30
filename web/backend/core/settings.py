import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Core ---
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-dummy-key-for-dev')
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('1', 'true', 'yes')
ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get('DJANGO_ALLOWED_HOSTS', '*').split(',')
    if h.strip()
]

# Render / reverse proxy HTTPS
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'users',
    'shop',
    'admin_api',
    'product_sources',
]

EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    (
        'django.core.mail.backends.console.EmailBackend'
        if DEBUG
        else 'django.core.mail.backends.smtp.EmailBackend'
    ),
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() in ('1', 'true', 'yes')
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False').lower() in ('1', 'true', 'yes')
EMAIL_TIMEOUT = int(os.environ.get('EMAIL_TIMEOUT', '10'))
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'KIZUNA <no-reply@localhost>')
WEBSITE_URL = os.environ.get('WEBSITE_URL', 'http://localhost:3000').rstrip('/')
EMAIL_VERIFICATION_TIMEOUT = int(os.environ.get('EMAIL_VERIFICATION_TIMEOUT', '86400'))
PASSWORD_RESET_TIMEOUT = int(os.environ.get('PASSWORD_RESET_TIMEOUT', '3600'))

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'core.api_i18n.ApiErrorLocalizationMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# --- Database (Render Postgres: DATABASE_URL) ---
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    import dj_database_url

    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR.parent / 'database' / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
LANGUAGES = [
    ('en', 'English'),
    ('ja', 'Japanese'),
    ('vi', 'Vietnamese'),
]
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

MEDIA_URL = '/media/'
MEDIA_ROOT = os.environ.get('MEDIA_ROOT', str(BASE_DIR / 'media'))
GCS_BUCKET_NAME = os.environ.get('GCS_BUCKET_NAME', '').strip()
if GCS_BUCKET_NAME:
    STORAGES['default'] = {
        'BACKEND': 'core.storage.CloudRunMediaStorage',
        'OPTIONS': {
            'bucket_name': GCS_BUCKET_NAME,
            'default_acl': None,
            'file_overwrite': False,
        },
    }

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'users.authentication.CookieJWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '120/hour',
        'user': '600/hour',
        'login': '20/hour',
        'register': '10/hour',
        'verify_email': '30/hour',
        'resend_verification': '5/hour',
        'password_reset_request': '5/hour',
        'password_reset_confirm': '20/hour',
        'password_change_request': '5/hour',
        'concierge': '30/hour',
    },
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'SLIDING_TOKEN_REFRESH_LIFETIME': timedelta(days=1),
    'CHECK_REVOKE_TOKEN': True,
}

AUTHENTICATION_BACKENDS = [
    'users.backends.EmailBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# --- CORS (Vercel frontends) ---
_cors_origins = os.environ.get('CORS_ALLOWED_ORIGINS', '')
if _cors_origins.strip():
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins.split(',') if o.strip()]
    CORS_ALLOW_ALL_ORIGINS = False
else:
    CORS_ALLOW_ALL_ORIGINS = DEBUG

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',')
    if o.strip()
]

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

EXCHANGE_RATE_CACHE_SECONDS = int(os.environ.get('EXCHANGE_RATE_CACHE_SECONDS', '3600'))
PUBLIC_API_CACHE_SECONDS = int(os.environ.get(
    'PUBLIC_API_CACHE_SECONDS',
    '0' if DEBUG else '60',
))
EXCHANGE_RATE_API_URL = os.environ.get(
    'EXCHANGE_RATE_API_URL',
    'https://api.frankfurter.app/latest?from=USD&to=VND,JPY',
)

# --- Amazon/Qoo10 source imports ---
USD_VND_RATE = os.environ.get('USD_VND_RATE', '25000')
SOURCE_IMPORT_USE_FAKE_PROVIDERS = os.environ.get(
    'SOURCE_IMPORT_USE_FAKE_PROVIDERS',
    str(DEBUG),
).lower() in ('1', 'true', 'yes')
ALLOW_AUTO_CREATE_CATEGORY = os.environ.get(
    'ALLOW_AUTO_CREATE_CATEGORY',
    'false',
).lower() in ('1', 'true', 'yes')
SOURCE_IMPORT_MAX_BATCH = int(os.environ.get('SOURCE_IMPORT_MAX_BATCH', '50'))
SOURCE_IMPORT_JPY_BUFFER = os.environ.get('SOURCE_IMPORT_JPY_BUFFER', '1000')
SOURCE_IMPORT_JPY_TO_VND_RATE = os.environ.get('SOURCE_IMPORT_JPY_TO_VND_RATE', '200')
SOURCE_IMPORT_MARKUP_RATE = os.environ.get('SOURCE_IMPORT_MARKUP_RATE', '0.15')
SOURCE_IMPORT_LIGHT_SHIPPING_VND = os.environ.get('SOURCE_IMPORT_LIGHT_SHIPPING_VND', '20000')
SOURCE_IMPORT_HEAVY_SHIPPING_PER_KG_VND = os.environ.get(
    'SOURCE_IMPORT_HEAVY_SHIPPING_PER_KG_VND',
    '180000',
)
SOURCE_IMPORT_HEAVY_WEIGHT_THRESHOLD_KG = os.environ.get(
    'SOURCE_IMPORT_HEAVY_WEIGHT_THRESHOLD_KG',
    '0.5',
)
SOURCE_IMPORT_ALLOWED_IMAGE_HOSTS = [
    host.strip().lower()
    for host in os.environ.get('SOURCE_IMPORT_ALLOWED_IMAGE_HOSTS', '').split(',')
    if host.strip()
]
AUTO_UPDATE_MAX_INCREASE_PERCENT = os.environ.get('AUTO_UPDATE_MAX_INCREASE_PERCENT', '5')
REVIEW_PRICE_INCREASE_PERCENT = os.environ.get('REVIEW_PRICE_INCREASE_PERCENT', '15')
MCP_SYSTEM_USERNAME = os.environ.get('MCP_SYSTEM_USERNAME', 'mcp_system_user')

CHATBOT_INTERNAL_TOKEN = os.environ.get('CHATBOT_INTERNAL_TOKEN', '')
CHATBOT_SERVICE_URL = os.environ.get('CHATBOT_SERVICE_URL', 'http://127.0.0.1:8080')

if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True').lower() in (
        '1',
        'true',
        'yes',
    )
