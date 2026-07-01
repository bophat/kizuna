import json
import time
from typing import Any

from django.db.models import Max
from django.utils import timezone

from .concierge import generate_concierge_reply
from .models import ConciergeMessage, ConciergeSession


def is_ai_enabled() -> bool:
    from admin_api.chat_proxy import is_chatbot_enabled

    return is_chatbot_enabled()


def get_or_create_session(session_id: str) -> ConciergeSession:
    session, _ = ConciergeSession.objects.get_or_create(session_id=session_id)
    return session


def _message_to_dict(msg: ConciergeMessage) -> dict[str, Any]:
    return {
        'id': str(msg.id),
        'role': msg.role,
        'content': msg.content,
        'is_admin': msg.is_admin,
        'timestamp': msg.created_at.timestamp(),
    }


def _history_for_ai(session: ConciergeSession, limit: int = 12) -> list[dict]:
    msgs = list(session.messages.order_by('-created_at')[:limit])
    msgs.reverse()
    return [{'role': m.role, 'content': m.content} for m in msgs]


def append_user_message(session_id: str, content: str) -> ConciergeMessage:
    session = get_or_create_session(session_id)
    msg = ConciergeMessage.objects.create(
        session=session,
        role=ConciergeMessage.Role.USER,
        content=content,
    )
    session.updated_at = timezone.now()
    session.save(update_fields=['updated_at'])
    return msg


def append_assistant_message(
    session: ConciergeSession,
    content: str,
    *,
    is_ai: bool = False,
    is_admin: bool = False,
) -> ConciergeMessage:
    msg = ConciergeMessage.objects.create(
        session=session,
        role=ConciergeMessage.Role.ASSISTANT,
        content=content,
        is_ai=is_ai,
        is_admin=is_admin,
    )
    session.updated_at = timezone.now()
    session.save(update_fields=['updated_at'])
    return msg


def handle_user_message(session_id: str, content: str) -> dict[str, Any]:
    """Save user message; auto-reply with AI when enabled, else queue for admin."""
    session = get_or_create_session(session_id)
    ConciergeMessage.objects.create(
        session=session,
        role=ConciergeMessage.Role.USER,
        content=content,
    )
    session.updated_at = timezone.now()
    session.save(update_fields=['updated_at'])

    if session.admin_took_over:
        return {
            'status': 'success',
            'adminTookOver': True,
            'aiEnabled': is_ai_enabled(),
            'waitingForAdmin': True,
            'reply': None,
        }

    if is_ai_enabled():
        try:
            history = _history_for_ai(session)
            reply_text = generate_concierge_reply(content, history)
            append_assistant_message(session, reply_text, is_ai=True)
            return {
                'status': 'success',
                'adminTookOver': False,
                'aiEnabled': True,
                'waitingForAdmin': False,
                'reply': reply_text,
            }
        except Exception:
            return {
                'status': 'success',
                'adminTookOver': False,
                'aiEnabled': True,
                'waitingForAdmin': True,
                'reply': None,
                'error': 'AI service unavailable',
            }

    return {
        'status': 'success',
        'adminTookOver': False,
        'aiEnabled': False,
        'waitingForAdmin': True,
        'reply': None,
    }


def admin_reply(session_id: str, content: str) -> dict[str, Any]:
    session = get_or_create_session(session_id)
    session.admin_took_over = True
    session.updated_at = timezone.now()
    session.save(update_fields=['admin_took_over', 'updated_at'])
    msg = append_assistant_message(session, content, is_admin=True)
    return {'status': 'success', 'message': _message_to_dict(msg)}


def sessions_for_admin() -> dict[str, Any]:
    sessions = ConciergeSession.objects.prefetch_related('messages').order_by('-updated_at')
    result: dict[str, Any] = {}
    for session in sessions:
        messages = [_message_to_dict(m) for m in session.messages.all()]
        if not messages:
            continue
        result[session.session_id] = {
            'messages': messages,
            'adminTookOver': session.admin_took_over,
            'updated_at': session.updated_at.timestamp(),
        }
    return result


def session_history(session_id: str) -> dict[str, Any] | None:
    try:
        session = ConciergeSession.objects.prefetch_related('messages').get(session_id=session_id)
    except ConciergeSession.DoesNotExist:
        return None
    return {
        'messages': [_message_to_dict(m) for m in session.messages.all()],
        'adminTookOver': session.admin_took_over,
        'aiEnabled': is_ai_enabled(),
    }


def stream_concierge_session_messages(session_id: str):
    """SSE: push new admin replies to the website concierge page."""
    try:
        session = ConciergeSession.objects.get(session_id=session_id)
    except ConciergeSession.DoesNotExist:
        yield b': no-session\n\n'
        return

    last_id = (
        ConciergeMessage.objects.filter(
            session=session,
            role=ConciergeMessage.Role.ASSISTANT,
            is_admin=True,
        ).aggregate(m=Max('id'))['m']
        or 0
    )

    idle_ticks = 0
    max_idle = 300

    while idle_ticks < max_idle:
        new_msgs = ConciergeMessage.objects.filter(
            session=session,
            role=ConciergeMessage.Role.ASSISTANT,
            is_admin=True,
            id__gt=last_id,
        ).order_by('id')

        found = False
        for msg in new_msgs:
            payload = json.dumps({
                'id': str(msg.id),
                'content': msg.content,
                'is_admin': True,
            })
            yield f'data: {payload}\n\n'.encode()
            last_id = msg.id
            found = True
            idle_ticks = 0

        if not found:
            idle_ticks += 1
            yield b': keepalive\n\n'
        time.sleep(1)
