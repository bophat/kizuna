from django.db.models import Sum
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .affiliates import normalize_affiliate_code, refresh_available_commissions
from .models import AffiliateCommission, AffiliateProfile, AffiliateVisit


class AffiliateTrackView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        code = normalize_affiliate_code(request.data.get('code'))
        session_id = str(request.data.get('session_id') or '').strip()[:64]
        landing_path = str(request.data.get('landing_path') or '').strip()[:500]
        if not code or not session_id:
            return Response({'valid': False}, status=status.HTTP_400_BAD_REQUEST)
        affiliate = AffiliateProfile.objects.filter(
            code=code, status=AffiliateProfile.Status.ACTIVE
        ).first()
        if not affiliate:
            return Response({'valid': False}, status=status.HTTP_404_NOT_FOUND)
        AffiliateVisit.objects.get_or_create(
            affiliate=affiliate,
            session_id=session_id,
            defaults={'landing_path': landing_path},
        )
        return Response({
            'valid': True,
            'code': affiliate.code,
            'cookie_days': affiliate.cookie_days,
        })


class AffiliateDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        refresh_available_commissions()
        try:
            affiliate = request.user.affiliate_profile
        except AffiliateProfile.DoesNotExist:
            return Response({'is_affiliate': False})

        commissions = affiliate.commissions.all()
        totals = {}
        for status_code in (
            AffiliateCommission.Status.PENDING,
            AffiliateCommission.Status.AVAILABLE,
            AffiliateCommission.Status.PAID,
            AffiliateCommission.Status.REVERSED,
        ):
            status_commissions = commissions.filter(status=status_code)
            if status_code == AffiliateCommission.Status.AVAILABLE:
                status_commissions = status_commissions.filter(payout__isnull=True)
            totals[status_code] = (
                status_commissions.aggregate(total=Sum('amount'))['total'] or 0
            )
        recent = commissions.select_related('order')[:20]
        return Response({
            'is_affiliate': True,
            'code': affiliate.code,
            'status': affiliate.status,
            'commission_rate': affiliate.commission_rate,
            'cookie_days': affiliate.cookie_days,
            'visits_count': affiliate.visits.count(),
            'orders_count': commissions.count(),
            'totals': totals,
            'recent_commissions': [
                {
                    'id': item.id,
                    'order_id': item.order_id,
                    'status': item.status,
                    'base_amount': item.base_amount,
                    'amount': item.amount,
                    'created_at': item.created_at,
                }
                for item in recent
            ],
        })
