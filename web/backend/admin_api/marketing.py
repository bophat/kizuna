"""Safe, resumable marketing-email delivery helpers."""

from __future__ import annotations

from html import escape
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.mail import EmailMultiAlternatives, get_connection
from django.db import transaction
from django.utils import timezone

from .models import (
    MarketingCampaign,
    MarketingEmailDelivery,
    MarketingEmailSuppression,
)


UNSUBSCRIBE_TOKEN_SALT = 'kizuna.marketing.unsubscribe'
DEFAULT_BATCH_SIZE = 20
MAX_BATCH_SIZE = 50


def normalize_email(value: str) -> str:
    return str(value or '').strip().lower()


def create_unsubscribe_token(email: str) -> str:
    return signing.dumps(
        {'email': normalize_email(email)},
        salt=UNSUBSCRIBE_TOKEN_SALT,
        compress=True,
    )


def read_unsubscribe_token(token: str) -> str:
    payload = signing.loads(token, salt=UNSUBSCRIBE_TOKEN_SALT)
    email = normalize_email(payload.get('email', ''))
    if not email or '@' not in email:
        raise signing.BadSignature('Invalid marketing unsubscribe token')
    return email


def unsubscribe_url(email: str, base_url: str) -> str:
    return f'{base_url}?{urlencode({"token": create_unsubscribe_token(email)})}'


def _customer_name(user) -> str:
    return user.get_full_name().strip() or user.username or normalize_email(user.email)


def initialize_campaign_deliveries(campaign: MarketingCampaign) -> int:
    """Snapshot eligible customers exactly once and deduplicate shared addresses."""

    if campaign.deliveries.exists():
        return campaign.deliveries.count()

    suppressed = {
        normalize_email(email)
        for email in MarketingEmailSuppression.objects.values_list('email', flat=True)
    }
    users = (
        get_user_model().objects
        .filter(is_active=True, is_staff=False, is_superuser=False)
        .exclude(email='')
        .only('id', 'email', 'first_name', 'last_name', 'username')
        .order_by('id')
    )
    seen = set()
    deliveries = []
    for user in users.iterator(chunk_size=500):
        email = normalize_email(user.email)
        if not email or email in seen or email in suppressed:
            continue
        seen.add(email)
        deliveries.append(
            MarketingEmailDelivery(
                campaign=campaign,
                user=user,
                email=email,
                customer_name=_customer_name(user),
            )
        )

    MarketingEmailDelivery.objects.bulk_create(deliveries, batch_size=500)
    return len(deliveries)


def _resolved_cta_url(campaign: MarketingCampaign) -> str:
    if campaign.cta_url:
        return campaign.cta_url
    if campaign.product_id:
        return f'{settings.WEBSITE_URL.rstrip("/")}/product/{campaign.product_id}'
    return settings.WEBSITE_URL.rstrip('/')


def build_campaign_message(
    campaign: MarketingCampaign,
    delivery: MarketingEmailDelivery,
    unsubscribe_base_url: str,
    *,
    connection=None,
) -> EmailMultiAlternatives:
    customer_name = delivery.customer_name or delivery.email
    cta_url = _resolved_cta_url(campaign)
    cta_text = campaign.cta_text.strip() or 'Xem chi tiết'
    opt_out_url = unsubscribe_url(delivery.email, unsubscribe_base_url)
    text_body = '\n\n'.join(
        [
            f'Xin chào {customer_name},',
            campaign.body.strip(),
            f'{cta_text}: {cta_url}',
            f'Không muốn nhận email marketing? {opt_out_url}',
        ]
    )
    safe_body = '<br>'.join(escape(campaign.body.strip()).splitlines())
    image_html = ''
    if campaign.image_url:
        image_html = (
            f'<img src="{escape(campaign.image_url, quote=True)}" alt="" '
            'style="display:block;width:100%;max-height:360px;object-fit:cover;'
            'border-radius:12px;margin:0 0 24px" />'
        )
    html_body = f"""
      <div style="background:#f7f4f1;padding:32px 12px;font-family:Arial,sans-serif;color:#24201f">
        <div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e8e1dc;border-radius:16px;overflow:hidden">
          <div style="padding:24px 32px;border-bottom:1px solid #eee6e1;font-family:Georgia,serif;font-size:24px;font-weight:bold;color:#99051d">KIZUNA</div>
          <div style="padding:32px">
            {image_html}
            <p style="font-size:16px">Xin chào {escape(customer_name)},</p>
            <h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2;margin:18px 0">{escape(campaign.subject)}</h1>
            <div style="font-size:16px;line-height:1.7;color:#4b4542">{safe_body}</div>
            <p style="margin:32px 0">
              <a href="{escape(cta_url, quote=True)}" style="display:inline-block;background:#99051d;color:#fff;padding:14px 24px;text-decoration:none;border-radius:8px;font-weight:bold">{escape(cta_text)}</a>
            </p>
            <p style="border-top:1px solid #eee6e1;padding-top:20px;font-size:12px;line-height:1.6;color:#777">
              Email này được gửi vì bạn là khách hàng của KIZUNA.
              <a href="{escape(opt_out_url, quote=True)}" style="color:#777">Hủy nhận email marketing</a>.
            </p>
          </div>
        </div>
      </div>
    """

    message = EmailMultiAlternatives(
        subject=campaign.subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[delivery.email],
        connection=connection,
        headers={
            'List-Unsubscribe': f'<{opt_out_url}>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'X-KIZUNA-Campaign-ID': str(campaign.pk),
        },
    )
    message.attach_alternative(html_body, 'text/html')
    return message


def refresh_campaign_counts(campaign: MarketingCampaign) -> MarketingCampaign:
    counts = {
        status_code: campaign.deliveries.filter(status=status_code).count()
        for status_code in (
            MarketingEmailDelivery.Status.PENDING,
            MarketingEmailDelivery.Status.SENT,
            MarketingEmailDelivery.Status.FAILED,
            MarketingEmailDelivery.Status.SUPPRESSED,
        )
    }
    pending_count = counts[MarketingEmailDelivery.Status.PENDING]
    campaign.recipient_count = sum(counts.values())
    campaign.sent_count = counts[MarketingEmailDelivery.Status.SENT]
    campaign.failed_count = counts[MarketingEmailDelivery.Status.FAILED]
    campaign.status = (
        MarketingCampaign.Status.SENDING
        if pending_count
        else MarketingCampaign.Status.PARTIAL
        if campaign.failed_count
        else MarketingCampaign.Status.SENT
    )
    campaign.completed_at = None if pending_count else timezone.now()
    campaign.save(
        update_fields=[
            'recipient_count', 'sent_count', 'failed_count', 'status',
            'completed_at', 'updated_at',
        ]
    )
    return campaign


def send_campaign_batch(
    campaign: MarketingCampaign,
    unsubscribe_base_url: str,
    batch_size: int = DEFAULT_BATCH_SIZE,
) -> dict:
    batch_size = max(1, min(int(batch_size or DEFAULT_BATCH_SIZE), MAX_BATCH_SIZE))
    if campaign.status == MarketingCampaign.Status.DRAFT:
        with transaction.atomic():
            locked = MarketingCampaign.objects.select_for_update().get(pk=campaign.pk)
            initialize_campaign_deliveries(locked)
            if not locked.started_at:
                locked.started_at = timezone.now()
            locked.status = MarketingCampaign.Status.SENDING
            locked.save(update_fields=['started_at', 'status', 'updated_at'])
        campaign.refresh_from_db()

    pending = list(
        campaign.deliveries
        .filter(status=MarketingEmailDelivery.Status.PENDING)
        .order_by('id')[:batch_size]
    )
    suppressed = {
        normalize_email(email)
        for email in MarketingEmailSuppression.objects.filter(
            email__in=[delivery.email for delivery in pending]
        ).values_list('email', flat=True)
    }

    connection = get_connection()
    try:
        connection.open()
        for delivery in pending:
            delivery.attempt_count += 1
            if normalize_email(delivery.email) in suppressed:
                delivery.status = MarketingEmailDelivery.Status.SUPPRESSED
                delivery.error_message = ''
                delivery.save(
                    update_fields=['status', 'error_message', 'attempt_count', 'updated_at']
                )
                continue
            try:
                message = build_campaign_message(
                    campaign,
                    delivery,
                    unsubscribe_base_url,
                    connection=connection,
                )
                if message.send(fail_silently=False) != 1:
                    raise RuntimeError('Email backend did not accept the message')
                delivery.status = MarketingEmailDelivery.Status.SENT
                delivery.sent_at = timezone.now()
                delivery.error_message = ''
            except Exception as exc:  # SMTP providers expose several exception types.
                delivery.status = MarketingEmailDelivery.Status.FAILED
                delivery.error_message = str(exc)[:500]
            delivery.save(
                update_fields=[
                    'status', 'sent_at', 'error_message', 'attempt_count', 'updated_at',
                ]
            )
    finally:
        connection.close()

    refresh_campaign_counts(campaign)
    pending_count = campaign.deliveries.filter(
        status=MarketingEmailDelivery.Status.PENDING
    ).count()
    suppressed_count = campaign.deliveries.filter(
        status=MarketingEmailDelivery.Status.SUPPRESSED
    ).count()
    return {
        'has_more': pending_count > 0,
        'pending_count': pending_count,
        'suppressed_count': suppressed_count,
    }
