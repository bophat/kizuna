from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import LoyaltyPointTransaction, UserProfile
from .serializers import LoyaltyPointTransactionSerializer


class LoyaltyDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        transactions = LoyaltyPointTransaction.objects.filter(
            user=request.user
        ).select_related('order')[:50]
        return Response({
            'points': profile.points,
            'earn_rate': {
                'currency': 'VND',
                'amount': 25000,
                'points': 1,
                'shipping_included': False,
            },
            'transactions': LoyaltyPointTransactionSerializer(
                transactions, many=True
            ).data,
        })
