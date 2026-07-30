from rest_framework import status


class SourceImportError(Exception):
    """Base exception for source import operations."""

    code = 'IMPORT_FAILED'
    http_status = status.HTTP_500_INTERNAL_SERVER_ERROR

    def __init__(self, message: str, *, details: dict | None = None):
        self.message = message
        self.details = details or {}
        super().__init__(message)


class InvalidSourceUrlError(SourceImportError):
    code = 'INVALID_SOURCE_URL'
    http_status = status.HTTP_400_BAD_REQUEST


class InvalidImportRequestError(SourceImportError):
    code = 'INVALID_IMPORT_REQUEST'
    http_status = status.HTTP_400_BAD_REQUEST


class UnsupportedProviderError(SourceImportError):
    code = 'UNSUPPORTED_PROVIDER'
    http_status = status.HTTP_400_BAD_REQUEST


class CategoryRequiredError(SourceImportError):
    code = 'CATEGORY_REQUIRED'
    http_status = status.HTTP_400_BAD_REQUEST


class PriceUnavailableError(SourceImportError):
    code = 'PRICE_UNAVAILABLE'
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY


class WeightRequiredError(SourceImportError):
    code = 'WEIGHT_REQUIRED'
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY


class DuplicateSourceProductError(SourceImportError):
    code = 'DUPLICATE_SOURCE_PRODUCT'
    http_status = status.HTTP_409_CONFLICT


class ProviderConfigurationError(SourceImportError):
    code = 'PROVIDER_AUTH_ERROR'
    http_status = status.HTTP_502_BAD_GATEWAY


class ProviderPermissionError(SourceImportError):
    code = 'PROVIDER_PERMISSION_ERROR'
    http_status = status.HTTP_502_BAD_GATEWAY


class ProviderRateLimitError(SourceImportError):
    code = 'PROVIDER_RATE_LIMIT'
    http_status = status.HTTP_503_SERVICE_UNAVAILABLE


class ProviderTemporaryError(SourceImportError):
    code = 'PROVIDER_TEMPORARY_ERROR'
    http_status = status.HTTP_503_SERVICE_UNAVAILABLE


class ProductNotFoundError(SourceImportError):
    code = 'PRODUCT_NOT_FOUND'
    http_status = status.HTTP_404_NOT_FOUND


class ImageValidationError(SourceImportError):
    code = 'IMAGE_VALIDATION_ERROR'
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY


class SSRFBlockedError(SourceImportError):
    code = 'INVALID_SOURCE_URL'
    http_status = status.HTTP_400_BAD_REQUEST
