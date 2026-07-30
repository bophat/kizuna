from django.db import models


class SourceProvider(models.TextChoices):
    AMAZON_JP = 'amazon_jp', 'Amazon Japan'
    QOO10_JP = 'qoo10_jp', 'Qoo10 Japan'
    MANUAL = 'manual', 'Manual'


class SourceAvailability(models.TextChoices):
    AVAILABLE = 'available', 'Available'
    UNAVAILABLE = 'unavailable', 'Unavailable'
    UNKNOWN = 'unknown', 'Unknown'


class SourceSyncStatus(models.TextChoices):
    NEVER = 'never', 'Never synced'
    SUCCESS = 'success', 'Success'
    FAILED = 'failed', 'Failed'
    STALE = 'stale', 'Stale'


class ImageMode(models.TextChoices):
    SKIP = 'skip', 'Skip'
    REMOTE = 'remote', 'Remote URL'
    DOWNLOAD = 'download', 'Download'


class ImportJobType(models.TextChoices):
    IMPORT = 'import', 'Import'
    SYNC = 'sync', 'Sync'
    REPRICE = 'reprice', 'Reprice'


class ImportJobStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    RUNNING = 'running', 'Running'
    SUCCESS = 'success', 'Success'
    PARTIAL = 'partial', 'Partial'
    FAILED = 'failed', 'Failed'
