"""Birthday-email rendering and idempotent daily delivery."""

from __future__ import annotations

import calendar
from datetime import date
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from admin_api.models import MarketingEmailSuppression

from .models import BirthdayEmailDelivery, UserProfile


EMAIL_COPY = {
    'en': {
        'subject': 'Happy birthday from KIZUNA!',
        'title': 'Happy birthday!',
        'greeting': 'Hello {name},',
        'body': 'KIZUNA wishes you a joyful birthday and a wonderful year ahead.',
        'button': 'Visit KIZUNA',
        'preference': 'You can manage birthday email preferences in your profile.',
    },
    'ja': {
        'subject': 'KIZUNAよりお誕生日おめでとうございます！',
        'title': 'お誕生日おめでとうございます！',
        'greeting': '{name} 様',
        'body': '素敵なお誕生日と、幸せに満ちた一年になりますようKIZUNAより心を込めてお祝い申し上げます。',
        'button': 'KIZUNAを見る',
        'preference': '誕生日メールの設定はプロフィールから変更できます。',
    },
    'vi': {
        'subject': 'KIZUNA chúc mừng sinh nhật bạn!',
        'title': 'Chúc mừng sinh nhật!',
        'greeting': 'Xin chào {name},',
        'body': 'KIZUNA chúc bạn có một sinh nhật thật vui và một năm mới nhiều điều tuyệt vời.',
        'button': 'Ghé thăm KIZUNA',
        'preference': 'Bạn có thể quản lý email sinh nhật trong hồ sơ cá nhân.',
    },
}


def normalize_email(value: str) -> str:
    return str(value or '').strip().lower()


def normalize_language(value: str) -> str:
    language = str(value or 'vi').split('-')[0].lower()
    return language if language in EMAIL_COPY else 'vi'


def _customer_name(user) -> str:
    return user.get_full_name().strip() or user.username or normalize_email(user.email)


def birthday_profile_filter(run_date: date) -> Q:
    query = Q(
        date_of_birth__month=run_date.month,
        date_of_birth__day=run_date.day,
    )
    if run_date.month == 2 and run_date.day == 28 and not calendar.isleap(run_date.year):
        query |= Q(date_of_birth__month=2, date_of_birth__day=29)
    return query


def build_birthday_message(
    user,
    *,
    recipient_email: str | None = None,
    language: str | None = None,
) -> EmailMultiAlternatives:
    email = normalize_email(recipient_email or user.email)
    if not email:
        raise ValueError('Customer does not have an email address.')

    profile = getattr(user, 'profile', None)
    language = normalize_language(
        language or getattr(profile, 'preferred_language', 'vi')
    )
    copy = EMAIL_COPY[language]
    name = _customer_name(user)
    website_url = settings.WEBSITE_URL.rstrip('/')
    profile_url = f'{website_url}/profile'
    greeting = copy['greeting'].format(name=name)

    text_body = '\n\n'.join(
        [
            greeting,
            copy['body'],
            website_url,
            f"{copy['preference']} {profile_url}",
        ]
    )
    html_body = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
          <div style="border-top:5px solid #b10f2e;padding:28px 24px;background:#fffaf8">
            <p style="font-size:13px;letter-spacing:0.18em;color:#b10f2e;margin:0 0 18px">KIZUNA</p>
            <h1 style="font-size:28px;margin:0 0 22px">{escape(copy['title'])}</h1>
            <p>{escape(greeting)}</p>
            <p style="line-height:1.7">{escape(copy['body'])}</p>
            <p style="margin:30px 0">
              <a href="{escape(website_url, quote=True)}"
                 style="background:#111;color:#fff;padding:14px 22px;text-decoration:none;border-radius:4px">
                {escape(copy['button'])}
              </a>
            </p>
            <p style="font-size:12px;color:#777">
              {escape(copy['preference'])}
              <a href="{escape(profile_url, quote=True)}">{escape(profile_url)}</a>
            </p>
          </div>
        </div>
    """

    message = EmailMultiAlternatives(
        subject=copy['subject'],
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email],
    )
    message.attach_alternative(html_body, 'text/html')
    return message


def send_birthday_test_email(user, recipient_email: str, language: str | None = None):
    message = build_birthday_message(
        user,
        recipient_email=recipient_email,
        language=language,
    )
    if message.send(fail_silently=False) != 1:
        raise RuntimeError('Birthday test email was not accepted by the email backend.')
    return message.to[0]


def birthday_matches(profile: UserProfile, run_date: date) -> bool:
    birthday = profile.date_of_birth
    if not birthday:
        return False
    if (birthday.month, birthday.day) == (run_date.month, run_date.day):
        return True
    return (
        birthday.month == 2
        and birthday.day == 29
        and run_date.month == 2
        and run_date.day == 28
        and not calendar.isleap(run_date.year)
    )


def send_birthday_email_for_customer(
    user,
    run_date: date,
    *,
    suppressed_emails: set[str] | None = None,
) -> dict:
    """Send one tracked birthday email to a selected customer."""

    if not user.is_active or user.is_staff or user.is_superuser:
        return {'status': 'ineligible'}
    email = normalize_email(user.email)
    if not email:
        return {'status': 'missing_email'}
    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        return {'status': 'missing_birthday'}
    if not birthday_matches(profile, run_date):
        return {'status': 'not_birthday'}
    if not profile.birthday_email_enabled:
        return {'status': 'disabled'}
    is_suppressed = (
        email in suppressed_emails
        if suppressed_emails is not None
        else MarketingEmailSuppression.objects.filter(email__iexact=email).exists()
    )
    if is_suppressed:
        return {'status': 'suppressed'}

    with transaction.atomic():
        delivery, _ = BirthdayEmailDelivery.objects.select_for_update().get_or_create(
            user=user,
            birthday_year=run_date.year,
            defaults={
                'email': email,
                'status': BirthdayEmailDelivery.Status.FAILED,
            },
        )
        if delivery.status == BirthdayEmailDelivery.Status.SENT:
            return {'status': 'already_sent', 'sent_to': delivery.email}

        delivery.email = email
        delivery.attempt_count += 1
        try:
            message = build_birthday_message(user)
            if message.send(fail_silently=False) != 1:
                raise RuntimeError('Email backend did not accept the message.')
        except Exception as exc:
            delivery.status = BirthdayEmailDelivery.Status.FAILED
            delivery.error_message = str(exc)[:500]
            delivery.sent_at = None
            delivery.save()
            return {'status': 'failed', 'error': str(exc)}

        delivery.status = BirthdayEmailDelivery.Status.SENT
        delivery.error_message = ''
        delivery.sent_at = timezone.now()
        delivery.save()
        return {'status': 'sent', 'sent_to': email}


def process_birthday_emails(run_date: date, *, dry_run: bool = False) -> dict:
    profiles = (
        UserProfile.objects.select_related('user')
        .filter(
            birthday_profile_filter(run_date),
            birthday_email_enabled=True,
            user__is_active=True,
            user__is_staff=False,
            user__is_superuser=False,
        )
        .exclude(user__email='')
        .order_by('user_id')
    )
    suppressed = {
        normalize_email(email)
        for email in MarketingEmailSuppression.objects.values_list('email', flat=True)
    }
    result = {
        'date': run_date.isoformat(),
        'eligible': 0,
        'sent': 0,
        'already_sent': 0,
        'suppressed': 0,
        'failed': 0,
        'dry_run': dry_run,
        'recipients': [],
        'errors': [],
    }

    for profile in profiles.iterator(chunk_size=200):
        user = profile.user
        email = normalize_email(user.email)
        if dry_run:
            if email in suppressed:
                result['suppressed'] += 1
                continue
            result['eligible'] += 1
            result['recipients'].append(email)
            continue

        delivery_result = send_birthday_email_for_customer(
            user,
            run_date,
            suppressed_emails=suppressed,
        )
        delivery_status = delivery_result['status']
        if delivery_status == 'suppressed':
            result['suppressed'] += 1
            continue
        result['eligible'] += 1
        if delivery_status == 'sent':
            result['sent'] += 1
        elif delivery_status == 'already_sent':
            result['already_sent'] += 1
        elif delivery_status == 'failed':
            result['failed'] += 1
            result['errors'].append({
                'user_id': user.id,
                'email': email,
                'error': delivery_result.get('error', 'Unknown email error'),
            })

    return result
