from html import escape
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.mail import EmailMultiAlternatives
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode


password_reset_token_generator = PasswordResetTokenGenerator()


EMAIL_COPY = {
    'en': {
        'subject': 'Reset your KIZUNA password',
        'title': 'Reset your password',
        'greeting': 'Hello {username},',
        'body': 'Use the secure link below to choose a new password for your KIZUNA account.',
        'button': 'Choose a new password',
        'expires': 'This link expires in {minutes} minutes and can only be used once.',
        'ignore': 'If you did not request this change, you can safely ignore this email.',
    },
    'ja': {
        'subject': 'KIZUNA パスワード再設定',
        'title': 'パスワードを再設定してください',
        'greeting': '{username} 様',
        'body': '以下の安全なリンクから、KIZUNA アカウントの新しいパスワードを設定してください。',
        'button': '新しいパスワードを設定',
        'expires': 'このリンクは {minutes} 分後に期限切れとなり、一度だけ使用できます。',
        'ignore': 'この変更をリクエストしていない場合は、このメールを無視してください。',
    },
    'vi': {
        'subject': 'Đặt lại mật khẩu KIZUNA',
        'title': 'Đặt lại mật khẩu của bạn',
        'greeting': 'Xin chào {username},',
        'body': 'Hãy dùng liên kết bảo mật dưới đây để tạo mật khẩu mới cho tài khoản KIZUNA.',
        'button': 'Tạo mật khẩu mới',
        'expires': 'Liên kết hết hạn sau {minutes} phút và chỉ sử dụng được một lần.',
        'ignore': 'Nếu bạn không yêu cầu thay đổi này, hãy bỏ qua email.',
    },
}


def create_password_reset_credentials(user):
    return (
        urlsafe_base64_encode(force_bytes(user.pk)),
        password_reset_token_generator.make_token(user),
    )


def get_password_reset_user(uid, token):
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id, is_active=True)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None

    if not password_reset_token_generator.check_token(user, token):
        return None
    return user


def build_password_reset_url(user):
    uid, token = create_password_reset_credentials(user)
    query = urlencode({'uid': uid, 'token': token})
    return f"{settings.WEBSITE_URL.rstrip('/')}/reset-password?{query}"


def send_password_reset_email(user, language='en'):
    language = (language or 'en').split('-')[0].lower()
    copy = EMAIL_COPY.get(language, EMAIL_COPY['en'])
    reset_url = build_password_reset_url(user)
    minutes = max(1, settings.PASSWORD_RESET_TIMEOUT // 60)
    username = user.get_full_name().strip() or user.username

    text_body = '\n\n'.join([
        copy['greeting'].format(username=username),
        copy['body'],
        reset_url,
        copy['expires'].format(minutes=minutes),
        copy['ignore'],
    ])
    html_body = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
          <h1 style="font-size:24px">{escape(copy['title'])}</h1>
          <p>{escape(copy['greeting'].format(username=username))}</p>
          <p>{escape(copy['body'])}</p>
          <p style="margin:32px 0">
            <a href="{escape(reset_url, quote=True)}"
               style="background:#111;color:#fff;padding:14px 22px;text-decoration:none;border-radius:4px">
              {escape(copy['button'])}
            </a>
          </p>
          <p style="font-size:13px;color:#666">{escape(copy['expires'].format(minutes=minutes))}</p>
          <p style="font-size:13px;color:#666">{escape(copy['ignore'])}</p>
        </div>
    """

    message = EmailMultiAlternatives(
        subject=copy['subject'],
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    message.attach_alternative(html_body, 'text/html')
    if message.send(fail_silently=False) != 1:
        raise RuntimeError('Password reset email was not accepted by the email backend')

    return reset_url
