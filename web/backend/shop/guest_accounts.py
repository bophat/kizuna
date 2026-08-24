"""Attaching guest orders to a user record.

Order and everything hanging off it (loyalty points, affiliate commissions,
invoices, order history) is keyed on a User, so a guest checkout still needs
one. Rather than making those relations nullable, a guest order creates a
placeholder account with an unusable password: the customer can claim it later
through the normal password-reset flow and their order history is already there.
"""

import uuid

from django.contrib.auth.models import User

from .models import UserProfile


class ExistingAccountError(Exception):
    """The email already belongs to an account that can sign in."""


def _unique_username(email):
    base = (email.split('@')[0] or 'guest')[:20].strip() or 'guest'
    return f'{base}-{uuid.uuid4().hex[:8]}'


def resolve_guest_user(email, first_name='', last_name=''):
    """Return the User a guest order should belong to.

    Raises ExistingAccountError when the email belongs to a registered account.
    Silently attaching would put a stranger's order in that person's history,
    so the caller must ask the customer to sign in instead.
    """
    email = (email or '').strip()
    if not email:
        raise ValueError('email is required')

    matches = list(User.objects.filter(email__iexact=email))
    if any(user.has_usable_password() for user in matches):
        raise ExistingAccountError(email)

    # Reuse the placeholder from this guest's previous order, if any.
    if matches:
        guest_user = matches[0]
    else:
        guest_user = User(username=_unique_username(email), email=email)
        guest_user.set_unusable_password()
        guest_user.save()

    updates = []
    if first_name and guest_user.first_name != first_name:
        guest_user.first_name = first_name
        updates.append('first_name')
    if last_name and guest_user.last_name != last_name:
        guest_user.last_name = last_name
        updates.append('last_name')
    if updates:
        guest_user.save(update_fields=updates)

    UserProfile.objects.get_or_create(user=guest_user)
    return guest_user
