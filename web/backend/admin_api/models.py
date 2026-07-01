from django.db import models
from django.contrib.auth.models import User

class Setting(models.Model):
    key = models.CharField(max_length=100, unique=True)
    value = models.TextField()
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.key

    class Meta:
        db_table = 'settings'
        ordering = ['key']


class PendingReply(models.Model):
  """AI draft replies awaiting admin approval before sending to customers."""

  class Channel(models.TextChoices):
    MESSENGER = 'messenger', 'Messenger'
    COMMENT = 'comment', 'Comment'
    WEBSITE = 'website', 'Website'

  class Status(models.TextChoices):
    PENDING = 'pending', 'Pending'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'
    SENT = 'sent', 'Sent'

  channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.MESSENGER)
  customer_id = models.CharField(max_length=255)
  customer_name = models.CharField(max_length=255, blank=True)
  incoming_message = models.TextField()
  draft_reply = models.TextField()
  status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
  is_greeting = models.BooleanField(default=False)
  metadata = models.JSONField(default=dict, blank=True)
  created_at = models.DateTimeField(auto_now_add=True)
  reviewed_at = models.DateTimeField(null=True, blank=True)
  reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
  sent_at = models.DateTimeField(null=True, blank=True)

  class Meta:
    db_table = 'pending_replies'
    ordering = ['-created_at']

  def __str__(self):
    return f'{self.channel}:{self.customer_id} ({self.status})'


class TrendingProductLead(models.Model):
  """AI-discovered hot products from social / web search."""

  class Status(models.TextChoices):
    NEW = 'new', 'New'
    IMPORTED = 'imported', 'Imported'
    DISMISSED = 'dismissed', 'Dismissed'

  query = models.CharField(max_length=500, blank=True)
  product_name = models.CharField(max_length=500)
  platform = models.CharField(max_length=50, blank=True)
  source_url = models.URLField(blank=True)
  price_info = models.TextField(blank=True)
  status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
  raw_data = models.JSONField(default=dict, blank=True)
  created_at = models.DateTimeField(auto_now_add=True)

  class Meta:
    db_table = 'trending_product_leads'
    ordering = ['-created_at']

  def __str__(self):
    return self.product_name


class RepostLog(models.Model):
  """Log of auto-repost actions to Facebook groups."""

  class Status(models.TextChoices):
    PENDING = 'pending', 'Pending'
    SUCCESS = 'success', 'Success'
    FAILED = 'failed', 'Failed'

  source_post_id = models.CharField(max_length=255)
  group_id = models.CharField(max_length=255)
  message_preview = models.TextField(blank=True)
  status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
  error_message = models.TextField(blank=True)
  created_at = models.DateTimeField(auto_now_add=True)

  class Meta:
    db_table = 'repost_logs'
    ordering = ['-created_at']
