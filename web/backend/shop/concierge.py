import json
import os
import re


def _get_gemini_key() -> str:
    try:
        from admin_api.models import Setting

        return Setting.objects.get(key='gemini_api_key').value.strip()
    except Exception:
        return os.environ.get('GEMINI_API_KEY', '').strip()


def generate_concierge_reply(message: str, history: list | None = None) -> str:
    gemini_key = _get_gemini_key()
    if not gemini_key:
        raise RuntimeError('Gemini API key is not configured')

    from google import genai
    from google.genai import types

    system_instruction = (
        "You are Kenji, an expert Japanese artisan concierge for 'KIZUNA'. "
        "You are sophisticated, polite, and deeply knowledgeable about Japanese traditional crafts. "
        "Keep your tone serene and premium."
    )

    contents = []
    for item in (history or [])[-12:]:
        role = item.get('role')
        text = (item.get('content') or '').strip()
        if not text:
            continue
        contents.append(
            types.Content(
                role='user' if role == 'user' else 'model',
                parts=[types.Part(text=text)],
            )
        )
    contents.append(types.Content(role='user', parts=[types.Part(text=message)]))

    client = genai.Client(api_key=gemini_key)
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.4,
        ),
    )
    text = (response.text or '').strip()
    if not text:
        raise RuntimeError('Empty AI response')
    return text
