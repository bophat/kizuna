from django.db import models
from django.contrib.auth.models import User

class Role(models.Model):
    name = models.CharField(max_length=100, unique=True)
    users = models.ManyToManyField(User, related_name='roles')

    def __str__(self):
        return self.name


class TwoFactorSetting(models.Model):
    """TOTP second factor for an account.

    The secret exists from the moment setup starts but `is_enabled` only flips
    once the user has proved they can generate a code, so a half-finished setup
    can never lock anyone out.
    """

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='two_factor'
    )
    secret = models.CharField(max_length=64)
    is_enabled = models.BooleanField(default=False, db_index=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    # SHA-256 of each unused recovery code; the plaintext is shown once at setup.
    recovery_code_hashes = models.JSONField(default=list, blank=True)
    # Blocks a replay of the same code inside its validity window.
    last_used_step = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        state = 'enabled' if self.is_enabled else 'pending'
        return f'2FA ({state}) for {self.user_id}'
