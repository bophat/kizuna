from html import escape
from urllib.parse import urlencode

from django.conf import settings
from django.core import signing
from django.core.mail import EmailMultiAlternatives


TOKEN_SALT = 'kizuna.users.email-verification'


EMAIL_COPY = {
    'en': {
        'subject': 'Verify your KIZUNA email address',
        'title': 'Verify your email address',
        'greeting': 'Hello {username},',
        'body': 'Confirm this email address to activate your KIZUNA account.',
        'button': 'Verify email',
        'expires': 'This link expires in {hours} hours.',
        'ignore': 'If you did not create this account, you can ignore this email.',
    },
    'ja': {
        'subject': 'KIZUNA メールアドレス認証',
        'title': 'メールアドレスを認証してください',
        'greeting': '{username} 様',
        'body': 'KIZUNA アカウントを有効にするには、メールアドレスを認証してください。',
        'button': 'メールアドレスを認証',
        'expires': 'このリンクの有効期限は {hours} 時間です。',
        'ignore': 'このアカウントを作成していない場合は、このメールを無視してください。',
    },
    'vi': {
        'subject': 'Xác minh địa chỉ email KIZUNA',
        'title': 'Xác minh địa chỉ email của bạn',
        'greeting': 'Xin chào {username},',
        'body': 'Hãy xác nhận địa chỉ email này để kích hoạt tài khoản KIZUNA.',
        'button': 'Xác minh email',
        'expires': 'Liên kết này hết hạn sau {hours} giờ.',
        'ignore': 'Nếu bạn không tạo tài khoản này, bạn có thể bỏ qua email.',
    },
}


def create_verification_token(user):
    return signing.dumps(
        {'user_id': user.pk, 'email': user.email.strip().lower()},
        salt=TOKEN_SALT,
        compress=True,
    )


def read_verification_token(token):
    return signing.loads(
        token,
        salt=TOKEN_SALT,
        max_age=settings.EMAIL_VERIFICATION_TIMEOUT,
    )


def build_verification_url(user):
    query = urlencode({'token': create_verification_token(user)})
    return f"{settings.WEBSITE_URL.rstrip('/')}/verify-email?{query}"


def send_verification_email(user, language='en'):
    language = (language or 'en').split('-')[0].lower()
    copy = EMAIL_COPY.get(language, EMAIL_COPY['en'])
    verification_url = build_verification_url(user)
    hours = max(1, settings.EMAIL_VERIFICATION_TIMEOUT // 3600)
    username = user.get_full_name().strip() or user.username

    text_body = '\n\n'.join([
        copy['greeting'].format(username=username),
        copy['body'],
        verification_url,
        copy['expires'].format(hours=hours),
        copy['ignore'],
    ])
    html_body = f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
          <h1 style="font-size:24px">{escape(copy['title'])}</h1>
          <p>{escape(copy['greeting'].format(username=username))}</p>
          <p>{escape(copy['body'])}</p>
          <p style="margin:32px 0">
            <a href="{escape(verification_url, quote=True)}"
               style="background:#111;color:#fff;padding:14px 22px;text-decoration:none;border-radius:4px">
              {escape(copy['button'])}
            </a>
          </p>
          <p style="font-size:13px;color:#666">{escape(copy['expires'].format(hours=hours))}</p>
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
        raise RuntimeError('Verification email was not accepted by the email backend')

    return verification_url
