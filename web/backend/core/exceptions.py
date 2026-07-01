from rest_framework.views import exception_handler
from rest_framework.response import Response
from django.utils.translation import gettext_lazy as _

def custom_exception_handler(exc, context):
    """
    Custom exception handler that standardizes error responses.
    It preserves the original DRF error structure but injects a guaranteed
    'message' string for the frontend to display in toasts, and 'success': False.
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    if response is not None:
        data = response.data
        
        # If response.data is a list (rare, but possible in some bulk operations), 
        # we can't inject keys into it directly. Wrap it in a dict.
        if isinstance(data, list):
            data = {"errors": data}
            response.data = data
        
        if isinstance(data, dict):
            # Inject generic success flag
            data['success'] = False
            
            # Determine a user-friendly message
            if 'detail' in data:
                data['message'] = str(data['detail'])
            else:
                # It's likely a validation error dictionary, e.g. {"username": ["This field is required."]}
                try:
                    # Find the first field that has an error
                    field = next((k for k in data.keys() if k not in ('success', 'message', 'status_code')), None)
                    if field:
                        error_detail = data[field]
                        if isinstance(error_detail, list) and len(error_detail) > 0:
                            data['message'] = f"{field.replace('_', ' ').capitalize()}: {error_detail[0]}"
                        elif isinstance(error_detail, str):
                            data['message'] = f"{field.replace('_', ' ').capitalize()}: {error_detail}"
                        else:
                            data['message'] = _("Validation error occurred")
                    else:
                        data['message'] = _("An error occurred")
                except Exception:
                    data['message'] = _("An error occurred")

    return response
