import json
import os
import re
from datetime import datetime

import requests
from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from shop.models import Product

from .bot_auth import IsChatbotService
from .models import PendingReply, RepostLog, Setting, TrendingProductLead
from .serializers import (
    PendingReplySerializer,
    TrendingProductLeadSerializer,
)

INTEGRATION_SETTING_KEYS = frozenset({
    'facebook_page_access_token',
    'facebook_verify_token',
    'facebook_page_id',
    'gemini_api_key',
    'serper_api_key',
    'facebook_group_ids',
    'repost_enabled',
    'repost_posts_per_day',
    'repost_delay_minutes',
    'chatbot_service_url',
    'chatbot_internal_token',
})


def _get_setting(key: str, default: str = '') -> str:
    try:
        return Setting.objects.get(key=key).value
    except Setting.DoesNotExist:
        return default


def _products_to_kb():
    products = Product.objects.all().order_by('-sales', '-likes')[:200]
    return {
        'shop_info': {
            'name': _get_setting('PUBLIC_SITE_URL', 'KIZUNA'),
            'style': 'Thân thiện, dạ thưa, nhiệt tình tư vấn sản phẩm Nhật',
        },
        'products': [
            {
                'id': p.id,
                'name': p.name,
                'price': f'{p.price} {p.currency}',
                'stock': p.stock,
                'brand': p.brand or '',
                'description': (p.description or '')[:300],
                'features': [
                    f'Category: {p.category.name}' if p.category else '',
                    f'Sales: {p.sales}',
                    'Featured' if p.is_featured else '',
                ],
            }
            for p in products
        ],
    }


def _parse_llm_json(text: str) -> dict:
    text = text.strip()
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        text = match.group(0)
    return json.loads(text)


def _serper_search(query: str, serper_key: str) -> list:
    if not serper_key:
        return []
    res = requests.post(
        'https://google.serper.dev/search',
        headers={'X-API-KEY': serper_key, 'Content-Type': 'application/json'},
        json={'q': query, 'gl': 'jp', 'hl': 'vi'},
        timeout=30,
    )
    if res.status_code != 200:
        return []
    return res.json().get('organic', [])


def _gemini_summarize(prompt: str, gemini_key: str) -> str:
    if not gemini_key:
        return ''
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=gemini_key)
        response = client.models.generate_content(
            model='gemini-2.5-pro',
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2),
        )
        return response.text or ''
    except Exception as exc:
        print(f'[AI] Gemini error: {exc}')
        return ''


def _dispatch_approved_reply(pending: PendingReply) -> bool:
    """Ask chatbot service to send an approved message."""
    service_url = _get_setting('chatbot_service_url', os.environ.get('CHATBOT_SERVICE_URL', 'http://127.0.0.1:8080'))
    token = _get_setting('chatbot_internal_token', os.environ.get('CHATBOT_INTERNAL_TOKEN', ''))
    if not token:
        return False
    try:
        res = requests.post(
            f'{service_url.rstrip("/")}/api/internal/dispatch',
            headers={'X-Bot-Token': token, 'Content-Type': 'application/json'},
            json={
                'channel': pending.channel,
                'customer_id': pending.customer_id,
                'message': pending.draft_reply,
                'metadata': pending.metadata,
            },
            timeout=15,
        )
        return res.status_code == 200
    except Exception as exc:
        print(f'[AI] Dispatch error: {exc}')
        return False


class BotProductsView(APIView):
    permission_classes = [IsChatbotService]

    def get(self, request):
        return Response(_products_to_kb())


class BotConfigView(APIView):
    permission_classes = [IsChatbotService]

    def get(self, request):
        data = {key: _get_setting(key) for key in INTEGRATION_SETTING_KEYS}
        return Response(data)


class BotPendingReplyCreateView(APIView):
    permission_classes = [IsChatbotService]

    def post(self, request):
        serializer = PendingReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pending = serializer.save()
        return Response(PendingReplySerializer(pending).data, status=status.HTTP_201_CREATED)


class PendingReplyViewSet(viewsets.ModelViewSet):
    queryset = PendingReply.objects.all()
    serializer_class = PendingReplySerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['get', 'patch', 'post', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        pending = self.get_object()
        draft = request.data.get('draft_reply', pending.draft_reply)
        pending.draft_reply = draft
        pending.status = PendingReply.Status.APPROVED
        pending.reviewed_by = request.user
        pending.reviewed_at = timezone.now()
        pending.save()

        if pending.is_greeting or _dispatch_approved_reply(pending):
            pending.status = PendingReply.Status.SENT
            pending.sent_at = timezone.now()
            pending.save()

        return Response(PendingReplySerializer(pending).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        pending = self.get_object()
        pending.status = PendingReply.Status.REJECTED
        pending.reviewed_by = request.user
        pending.reviewed_at = timezone.now()
        pending.save()
        return Response(PendingReplySerializer(pending).data)


class TrendingProductLeadViewSet(viewsets.ModelViewSet):
    queryset = TrendingProductLead.objects.all()
    serializer_class = TrendingProductLeadSerializer
    permission_classes = [permissions.IsAdminUser]
    http_method_names = ['get', 'patch', 'post', 'head', 'options']

    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        lead = self.get_object()
        lead.status = TrendingProductLead.Status.DISMISSED
        lead.save()
        return Response(TrendingProductLeadSerializer(lead).data)


class AiDiscoverView(APIView):
    """Search trending / hot products on social media & web via Serper + Gemini."""

    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        query = (request.data.get('query') or '').strip()
        platforms = request.data.get('platforms') or ['facebook', 'instagram', 'tiktok']
        if not query:
            return Response({'error': 'query is required'}, status=status.HTTP_400_BAD_REQUEST)

        serper_key = _get_setting('serper_api_key', os.environ.get('SERPER_API_KEY', ''))
        gemini_key = _get_setting('gemini_api_key', os.environ.get('GEMINI_API_KEY', ''))

        platform_str = ' OR '.join(platforms)
        search_query = f'{query} trending hot product {platform_str} japan cosmetics 2025'
        results = _serper_search(search_query, serper_key)

        if not results:
            return Response({'leads': [], 'message': 'No search results'})

        context = '\n'.join(
            f"- {r.get('title', '')}: {r.get('snippet', '')} ({r.get('link', '')})"
            for r in results[:8]
        )
        prompt = f"""Phân tích kết quả tìm kiếm sản phẩm đang hot trên mạng xã hội cho chủ đề: "{query}".

Kết quả web:
{context}

Trả về JSON duy nhất:
{{
  "products": [
    {{
      "product_name": "Tên sản phẩm",
      "platform": "facebook|instagram|tiktok|web",
      "source_url": "URL nếu có",
      "price_info": "Giá tham khảo hoặc mô tả ngắn",
      "why_trending": "Lý do đang hot"
    }}
  ]
}}
Tối đa 8 sản phẩm. Chỉ JSON, không markdown."""

        raw = _gemini_summarize(prompt, gemini_key)
        leads = []
        try:
            parsed = _parse_llm_json(raw)
            for item in parsed.get('products', []):
                lead = TrendingProductLead.objects.create(
                    query=query,
                    product_name=item.get('product_name', 'Unknown')[:500],
                    platform=(item.get('platform') or '')[:50],
                    source_url=item.get('source_url', '')[:200],
                    price_info=item.get('price_info', ''),
                    raw_data=item,
                )
                leads.append(lead)
        except (json.JSONDecodeError, TypeError):
            return Response(
                {'error': 'AI failed to parse results', 'raw': raw[:500]},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({
            'leads': TrendingProductLeadSerializer(leads, many=True).data,
            'count': len(leads),
        })


class RepostLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = RepostLog.objects.all()
    permission_classes = [permissions.IsAdminUser]

    def list(self, request, *args, **kwargs):
        logs = RepostLog.objects.all()[:100]
        data = [
            {
                'id': log.id,
                'source_post_id': log.source_post_id,
                'group_id': log.group_id,
                'message_preview': log.message_preview,
                'status': log.status,
                'error_message': log.error_message,
                'created_at': log.created_at.isoformat(),
            }
            for log in logs
        ]
        return Response(data)
