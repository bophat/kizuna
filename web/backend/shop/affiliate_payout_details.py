import json

from admin_api.secrets import decrypt_at_rest, encrypt_at_rest, mask_secret


PAYOUT_FIELDS = ('bank_name', 'account_name', 'account_number')


def encrypt_payout_details(details):
    payload = {
        field: str(details.get(field) or '').strip()
        for field in PAYOUT_FIELDS
    }
    if not any(payload.values()):
        return ''
    return encrypt_at_rest(json.dumps(payload, ensure_ascii=False))


def decrypt_payout_details(value):
    if not value:
        return {field: '' for field in PAYOUT_FIELDS}
    try:
        payload = json.loads(decrypt_at_rest(value))
    except (ValueError, TypeError):
        return {field: '' for field in PAYOUT_FIELDS}
    return {field: str(payload.get(field) or '') for field in PAYOUT_FIELDS}


def masked_payout_details(value):
    details = decrypt_payout_details(value)
    return {
        'bank_name': details['bank_name'],
        'account_name': details['account_name'],
        'account_number': mask_secret(details['account_number']),
        'configured': bool(details['account_number']),
    }
