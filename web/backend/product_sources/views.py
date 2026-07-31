from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from product_sources.exceptions import SourceImportError
from product_sources.schemas.import_request import BulkImportRequest, ImportSourceProductRequest, PreviewImportRequest
from product_sources.schemas.manual_import import ManualBulkRequest
from product_sources.services.import_service import SourceImportService
from product_sources.services.manual_import_service import ManualImportService
from product_sources.services.sync_service import SyncService
from product_sources.serializers import (
    BulkImportSerializer,
    BulkSyncSerializer,
    ImportSourceProductSerializer,
    ManualBulkSerializer,
    PreviewImportSerializer,
    SyncSourceSerializer,
)


class BaseImportView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def handle_exception(self, exc):
        if isinstance(exc, SourceImportError):
            return Response(
                {
                    "error": {
                        "code": exc.code,
                        "message": exc.message,
                        "details": exc.details,
                    }
                },
                status=exc.http_status,
            )
        return super().handle_exception(exc)


class PreviewImportView(BaseImportView):
    def post(self, request, *args, **kwargs):
        serializer = PreviewImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        req_schema = PreviewImportRequest(**serializer.validated_data)
        service = SourceImportService()
        preview_res = service.preview(req_schema)
        return Response(preview_res.model_dump(mode="json"), status=status.HTTP_200_OK)


class ImportSourceProductView(BaseImportView):
    def post(self, request, *args, **kwargs):
        serializer = ImportSourceProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        req_schema = ImportSourceProductRequest(**serializer.validated_data)
        service = SourceImportService()
        import_res = service.import_product(req_schema, request.user)
        response_status = status.HTTP_200_OK if req_schema.dry_run else status.HTTP_201_CREATED
        return Response(import_res.model_dump(mode="json"), status=response_status)


class BulkImportView(BaseImportView):
    def post(self, request, *args, **kwargs):
        serializer = BulkImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        req_schema = BulkImportRequest(**serializer.validated_data)
        service = SourceImportService()
        bulk_res = service.bulk_import(req_schema, request.user)
        return Response(bulk_res.model_dump(mode="json"), status=status.HTTP_200_OK)


class PreviewManualBulkView(BaseImportView):
    def post(self, request, *args, **kwargs):
        serializer = ManualBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req_schema = ManualBulkRequest(**serializer.validated_data)
        result = ManualImportService().preview_bulk(req_schema)
        return Response(result.model_dump(mode='json'), status=status.HTTP_200_OK)


class ImportManualBulkView(BaseImportView):
    def post(self, request, *args, **kwargs):
        serializer = ManualBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req_schema = ManualBulkRequest(**serializer.validated_data)
        result = ManualImportService().import_bulk(req_schema, request.user)
        return Response(result.model_dump(mode='json'), status=status.HTTP_200_OK)


class SyncSourceProductView(BaseImportView):
    def post(self, request, product_id, *args, **kwargs):
        serializer = SyncSourceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = SyncService().sync_product(
            product_id=product_id,
            actor=request.user,
            **serializer.validated_data,
        )
        if not result.get('success'):
            error_code = result.get('error_code', 'PROVIDER_TEMPORARY_ERROR')
            response_status = (
                status.HTTP_404_NOT_FOUND
                if error_code == 'PRODUCT_NOT_FOUND'
                else status.HTTP_503_SERVICE_UNAVAILABLE
            )
            return Response(
                {
                    'error': {
                        'code': error_code,
                        'message': result.get('error', 'Không thể sync sản phẩm.'),
                        'details': {'product_id': product_id},
                    },
                },
                status=response_status,
            )
        return Response(result, status=status.HTTP_200_OK)


class BulkSyncSourcesView(BaseImportView):
    def post(self, request, *args, **kwargs):
        serializer = BulkSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = SyncService().bulk_sync(
            actor=request.user,
            **serializer.validated_data,
        )
        return Response(result, status=status.HTTP_200_OK)
