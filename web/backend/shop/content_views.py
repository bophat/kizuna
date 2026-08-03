from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from .models import ContactInfo, StorePage
from .serializers import (
    ContactInfoPublicSerializer,
    ContactMessageSubmitSerializer,
    StorePagePublicSerializer,
)


class ContactSubmitThrottle(SimpleRateThrottle):
    scope = 'contact_submit'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class StorePageDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = StorePagePublicSerializer
    lookup_field = 'slug'

    def get_queryset(self):
        return StorePage.objects.filter(is_published=True)


class ContactInfoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        contact_info = ContactInfo.objects.order_by('id').first()
        if contact_info is None:
            return Response({
                'phone': '',
                'email': '',
                'address': '',
                'working_hours': '',
                'facebook_url': '',
                'zalo_url': '',
                'instagram_url': '',
                'tiktok_url': '',
                'updated_at': None,
            })
        return Response(ContactInfoPublicSerializer(contact_info).data)


class ContactSubmitView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [ContactSubmitThrottle]
    serializer_class = ContactMessageSubmitSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'success': True, 'message': 'Your message has been received.'},
            status=status.HTTP_201_CREATED,
        )
