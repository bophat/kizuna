from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from shop.models import ProductImage
from .serializers import ProductImageSerializer

class ProductImageViewSet(viewsets.ModelViewSet):
    """
    API for managing product gallery images
    """
    queryset = ProductImage.objects.all()
    serializer_class = ProductImageSerializer
    permission_classes = [permissions.IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        product_id = self.request.query_params.get('product_id')
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        return queryset

    @action(detail=False, methods=['post'])
    def bulk_upload(self, request):
        """
        Upload multiple images for a product
        """
        product_id = request.data.get('product_id')
        images = request.FILES.getlist('images')

        if not product_id:
            return Response({'error': 'product_id is required'}, status=400)

        if not images:
            return Response({'error': 'At least one image is required'}, status=400)

        uploaded = []
        for image in images:
            img = ProductImage.objects.create(
                product_id=product_id,
                image=image
            )
            uploaded.append(img)

        serializer = self.get_serializer(uploaded, many=True)
        return Response(serializer.data, status=201)

    @action(detail=False, methods=['post'])
    def reorder(self, request):
        """
        Reorder images by setting display_order
        Expects: {images: [{id: 1, display_order: 1}, ...]}
        """
        try:
            for item in request.data.get('images', []):
                ProductImage.objects.filter(id=item['id']).update(display_order=item['display_order'])
            return Response({'success': True})
        except Exception as e:
            return Response({'error': str(e)}, status=400)
