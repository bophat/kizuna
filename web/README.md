# 🚀 AUTO-DEPLOY GUIDE — Full System Architecture

> **Dành cho AI Agent:** Đọc toàn bộ file này trước khi thực hiện bất kỳ bước nào.
> Thực hiện tuần tự Phase 1 → Phase 6. Không bỏ qua bước nào.

---

## 📐 KIẾN TRÚC TỔNG THỂ

```
                        ┌─────────────────────────────────────────┐
                        │           FACEBOOK PLATFORM             │
                        │   Messenger (Fanpage) ◄──► Meta Webhook │
                        └───────────────┬─────────────────────────┘
                                        │ Webhook POST
                    ┌───────────────────▼──────────────────────┐
┌───────────────┐   │           CHATBOT SERVICE                │   ┌──────────────┐
│  Enduser Web  │   │   Python (code riêng) + FastAPI          │   │ Admin Web    │
│  React #1     ├──►│   Deploy: Render Service #2              │   │ React #2     │
│  Vercel #1    │   │                                          │   │ Vercel #2    │
└───────────────┘   │  Chức năng:                              │   └──────┬───────┘
                    │  • Nhận tin từ Web widget                │          │
                    │  • Nhận tin từ FB Messenger              │          │
                    │  • Gọi LLM API (OpenAI/Gemini/Claude)    │          │
                    │  • Tra DB: sản phẩm, đơn hàng           │          │
                    │  • Search web nếu hàng chưa có DB        │          │
                    │  • Lưu lịch sử hội thoại vào DB         │          │
                    │  • Gửi thông báo → Django khi cần duyệt │          │
                    └───────────────┬──────────────────────────┘          │
                                    │ Internal API (HTTP)                  │
                    ┌───────────────▼──────────────────────────┐          │
                    │           DJANGO BACKEND                 │◄─────────┘
                    │   Render Service #1                      │
                    │                                          │
                    │  • REST API cho Enduser & Admin          │
                    │  • Auth (JWT)                            │
                    │  • Quản lý đơn hàng, sản phẩm           │
                    │  • Nhận yêu cầu duyệt từ Chatbot        │
                    │  • Gửi thông báo Admin (web + Messenger) │
                    │  • Webhook thanh toán                    │
                    └───────────────┬──────────────────────────┘
                                    │ DATABASE_URL (dùng chung)
                    ┌───────────────▼──────────────────────────┐
                    │           PostgreSQL                     │
                    │           Neon.tech (free)               │
                    │                                          │
                    │  Tables:                                 │
                    │  • users, products, orders               │
                    │  • chat_sessions, chat_messages          │
                    │  • pending_product_requests              │
                    └──────────────────────────────────────────┘
```

---

## 🗂️ BẢNG TỔNG HỢP SERVICES

| Service | Technology | Platform | URL dạng |
|---|---|---|---|
| Enduser Frontend | React | Vercel Project #1 | `your-store.vercel.app` |
| Admin Frontend | React | Vercel Project #2 | `your-admin.vercel.app` |
| Django Backend | Django + Gunicorn | Render Service #1 | `your-backend.onrender.com` |
| Chatbot Service | Python + FastAPI | Render Service #2 | `your-chatbot.onrender.com` |
| Database | PostgreSQL | Neon.tech | Connection String |
| Uptime | - | UptimeRobot | Ping cả 2 Render service |
| **Tổng chi phí** | | | **$0/tháng** |

---

## 📁 CẤU TRÚC REPO

```
your-repo/
├── backend/                        ← Django (Render Service #1)
│   ├── your_project_name/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── users/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── payments/
│   │   └── notifications/          ← Gửi thông báo admin (web + Messenger)
│   ├── requirements.txt
│   ├── Dockerfile                  ← Thêm mới — Render dùng để build image
│   ├── .dockerignore               ← Thêm mới
│   ├── Procfile                    ← Fallback nếu không dùng Docker
│   ├── build.sh
│   └── manage.py
│
├── chatbot/                        ← Chatbot Service (Render Service #2)
│   ├── main.py                     ← FastAPI app, expose endpoints
│   ├── bot_logic/
│   │   ├── llm_handler.py          ← Gọi OpenAI / Gemini / Claude API
│   │   ├── messenger_handler.py    ← Xử lý webhook FB Messenger
│   │   ├── web_handler.py          ← Xử lý chat từ website
│   │   ├── search_handler.py       ← Web search khi hàng chưa có DB
│   │   └── session_manager.py      ← Lưu lịch sử hội thoại
│   ├── requirements.txt
│   ├── Dockerfile                  ← Thêm mới — Render dùng để build image
│   ├── .dockerignore               ← Thêm mới
│   ├── Procfile                    ← Fallback nếu không dùng Docker
│   └── build.sh
│
├── frontend-enduser/               ← React App #1 (Vercel #1)
│   ├── src/
│   │   └── components/
│   │       └── ChatWidget/         ← Chat widget nhúng vào web
│   ├── .env.production
│   └── package.json
│
├── frontend-admin/                 ← React App #2 (Vercel #2)
│   ├── src/
│   │   └── pages/
│   │       └── PendingRequests/    ← Trang duyệt yêu cầu hàng mới
│   ├── .env.production
│   └── package.json
│
└── docker-compose.yml              ← Thêm mới — chạy toàn bộ hệ thống local
```

---

## ⚠️ ĐIỀU KIỆN TIÊN QUYẾT

- [ ] Repo đã push lên GitHub
- [ ] Có API Key của LLM (OpenAI / Gemini / Claude)
- [ ] Có Facebook App + Page Access Token (cho Messenger)
- [ ] Đã có tài khoản: GitHub, Vercel, Render, Neon.tech, UptimeRobot
- [ ] Đã cài Docker Desktop (để test local trước khi deploy)

---

## PHASE 0 — DOCKERIZATION (Làm trước khi deploy)

> **Mục tiêu:** Đóng gói từng service thành Docker image.
> Render hỗ trợ deploy bằng Dockerfile — ổn định hơn dùng buildpack thuần.
> Sau khi Dockerize xong, test local bằng `docker-compose` trước khi push lên Render.

### 0.1 Dockerfile — Django Backend

Tạo file `backend/Dockerfile`:

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

# Tránh Python tạo file .pyc và buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Cài dependencies trước (tận dụng Docker layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ source code
COPY . .

# Collect static files (WhiteNoise serve trực tiếp)
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Chạy bằng Gunicorn — thay your_project_name bằng tên thực
CMD ["gunicorn", "your_project_name.wsgi", "--bind", "0.0.0.0:8000", "--workers", "2", "--log-file", "-"]
```

Tạo file `backend/.dockerignore`:

```
__pycache__/
*.pyc
*.pyo
.env
.env.*
db.sqlite3
media/
staticfiles/
.git/
.gitignore
README.md
```

### 0.2 Dockerfile — Chatbot Service

Tạo file `chatbot/Dockerfile`:

```dockerfile
# chatbot/Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

# Chạy bằng Uvicorn (FastAPI)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

Tạo file `chatbot/.dockerignore`:

```
__pycache__/
*.pyc
*.pyo
.env
.env.*
.git/
.gitignore
README.md
```

### 0.3 docker-compose.yml — Chạy toàn bộ hệ thống local

Tạo file `docker-compose.yml` ở **root repo**:

```yaml
# docker-compose.yml
# Dùng để phát triển và test LOCAL — KHÔNG dùng file này để deploy production

version: '3.9'

services:

  # ── PostgreSQL local (thay thế Neon.tech khi dev) ──────────────────────────
  db:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB:       ecommerce_db
      POSTGRES_USER:     postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ── Django Backend ──────────────────────────────────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      SECRET_KEY:               dev-secret-key-change-in-production
      DEBUG:                    "True"
      DATABASE_URL:             postgres://postgres:postgres@db:5432/ecommerce_db
      CHATBOT_INTERNAL_TOKEN:   dev-internal-token
      FB_PAGE_ACCESS_TOKEN:     ""          # Điền khi test Messenger
      FB_ADMIN_PSID:            ""
    depends_on:
      db:
        condition: service_healthy
    # Override CMD để chạy migrate trước khi start server
    command: >
      sh -c "python manage.py migrate &&
             python manage.py collectstatic --noinput &&
             gunicorn your_project_name.wsgi --bind 0.0.0.0:8000 --workers 2 --log-file -"
    volumes:
      - ./backend:/app        # Hot reload — mount source code vào container
      - static_volume:/app/staticfiles

  # ── Chatbot Service ─────────────────────────────────────────────────────────
  chatbot:
    build:
      context: ./chatbot
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "8001:8001"
    environment:
      DJANGO_API_URL:           http://backend:8000    # Gọi nội bộ trong Docker network
      DATABASE_URL:             postgres://postgres:postgres@db:5432/ecommerce_db
      CHATBOT_INTERNAL_TOKEN:   dev-internal-token
      LLM_API_KEY:              ""                     # Điền API key LLM
      FB_PAGE_ACCESS_TOKEN:     ""
      FB_VERIFY_TOKEN:          dev-verify-token
      SEARCH_API_KEY:           ""
    depends_on:
      - backend
    volumes:
      - ./chatbot:/app          # Hot reload

  # ── Enduser Frontend ────────────────────────────────────────────────────────
  frontend-enduser:
    image: node:20-alpine
    working_dir: /app
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL:        http://localhost:8000/api
      REACT_APP_CHATBOT_URL:    http://localhost:8001
    volumes:
      - ./frontend-enduser:/app
      - /app/node_modules
    command: sh -c "npm install && npm start"

  # ── Admin Frontend ──────────────────────────────────────────────────────────
  frontend-admin:
    image: node:20-alpine
    working_dir: /app
    ports:
      - "3001:3001"
    environment:
      REACT_APP_API_URL:        http://localhost:8000/api
      PORT:                     "3001"
    volumes:
      - ./frontend-admin:/app
      - /app/node_modules
    command: sh -c "npm install && npm start"

volumes:
  postgres_data:
  static_volume:
```

### 0.4 Lệnh chạy local

```bash
# Lần đầu — build images và khởi động tất cả services
docker-compose up --build

# Những lần sau — khởi động nhanh
docker-compose up

# Chạy nền (background)
docker-compose up -d

# Xem logs của 1 service cụ thể
docker-compose logs -f backend
docker-compose logs -f chatbot

# Chạy migrate thủ công (nếu cần)
docker-compose exec backend python manage.py migrate

# Tạo superuser Django
docker-compose exec backend python manage.py createsuperuser

# Tắt tất cả
docker-compose down

# Tắt và xóa cả volume DB (reset sạch)
docker-compose down -v
```

### 0.5 Kiểm tra local trước khi deploy

Sau khi `docker-compose up --build` thành công, kiểm tra:

| URL | Kết quả mong đợi |
|---|---|
| `http://localhost:8000/api/health/` | `{"status": "ok"}` |
| `http://localhost:8001/health` | `{"status": "ok"}` |
| `http://localhost:3000` | Enduser website |
| `http://localhost:3001` | Admin dashboard |
| `http://localhost:8000/django-admin/` | Django admin panel |

> **Chỉ khi tất cả 5 URL trên hoạt động**, mới tiến hành deploy lên Render & Vercel.

### 0.6 Cấu hình Render dùng Dockerfile

Khi tạo Web Service trên Render, **chọn "Docker"** thay vì "Python":

- **Django:** Root Directory = `backend` → Render tự detect `backend/Dockerfile`
- **Chatbot:** Root Directory = `chatbot` → Render tự detect `chatbot/Dockerfile`

Render sẽ tự động build Docker image mỗi lần push code lên GitHub.

---

## PHASE 1 — DATABASE (Neon.tech)

> 1 DB PostgreSQL dùng chung cho toàn bộ hệ thống.

1. Vào [https://neon.tech](https://neon.tech) → **New Project** → Region: `AWS Singapore`
2. Copy **Connection String**:
   ```
   postgres://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/dbname?sslmode=require
   ```
3. Lưu lại → Đây là `DATABASE_URL`, dùng cho cả Django và Chatbot.

### Schema bổ sung cho Chatbot

Django sẽ tự migrate các bảng sau (tạo trong `apps/chat/models.py`):

```python
# apps/chat/models.py
from django.db import models

class ChatSession(models.Model):
    """Phiên hội thoại — dùng chung cho Web và Messenger"""
    SESSION_TYPE = [('web', 'Website'), ('messenger', 'FB Messenger')]

    session_id   = models.CharField(max_length=255, unique=True)  # fb_psid hoặc uuid
    session_type = models.CharField(max_length=20, choices=SESSION_TYPE)
    user         = models.ForeignKey('auth.User', null=True, blank=True, on_delete=models.SET_NULL)
    fb_psid      = models.CharField(max_length=100, blank=True)   # Facebook Page-Scoped ID
    created_at   = models.DateTimeField(auto_now_add=True)

class ChatMessage(models.Model):
    """Tin nhắn trong hội thoại"""
    ROLE = [('user', 'User'), ('bot', 'Bot')]

    session  = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role     = models.CharField(max_length=10, choices=ROLE)
    content  = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class PendingProductRequest(models.Model):
    """Hàng chưa có DB — chờ admin duyệt"""
    STATUS = [('pending', 'Chờ duyệt'), ('approved', 'Đã duyệt'), ('rejected', 'Từ chối')]

    session      = models.ForeignKey(ChatSession, on_delete=models.SET_NULL, null=True)
    product_name = models.CharField(max_length=500)
    description  = models.TextField(blank=True)
    search_result = models.JSONField(default=dict)  # Kết quả search web
    quoted_price = models.DecimalField(max_digits=15, decimal_places=0, null=True)
    status       = models.CharField(max_length=20, choices=STATUS, default='pending')
    admin_note   = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    reviewed_at  = models.DateTimeField(null=True)
    reviewed_by  = models.ForeignKey('auth.User', null=True, on_delete=models.SET_NULL)
```

---

## PHASE 2 — BACKEND DJANGO (Render Service #1)

### 2.1 Cài đặt dependencies

```bash
cd backend/
pip install gunicorn dj-database-url psycopg2-binary whitenoise django-cors-headers \
            djangorestframework djangorestframework-simplejwt python-dotenv requests
pip freeze > requirements.txt
```

### 2.2 Cập nhật `settings.py`

```python
import os, dj_database_url
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'fallback-dev-only')
DEBUG      = os.environ.get('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = [
    'localhost', '127.0.0.1',
    '.onrender.com',
    os.environ.get('RENDER_EXTERNAL_HOSTNAME', ''),
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'apps.users',
    'apps.products',
    'apps.orders',
    'apps.payments',
    'apps.chat',           # Models ChatSession, ChatMessage, PendingProductRequest
    'apps.notifications',  # Gửi thông báo admin
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Cho phép cả 2 Vercel frontend + Chatbot service gọi vào
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://your-enduser-app.vercel.app",   # ← Thay sau khi deploy
    "https://your-admin-app.vercel.app",     # ← Thay sau khi deploy
    "https://your-chatbot.onrender.com",     # ← Chatbot gọi internal API
]
CORS_ALLOW_CREDENTIALS = True

DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=True,
    )
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

# Internal token để Chatbot service gọi vào Django
CHATBOT_INTERNAL_TOKEN = os.environ.get('CHATBOT_INTERNAL_TOKEN', '')

# Facebook Messenger — dùng để gửi thông báo admin
FB_PAGE_ACCESS_TOKEN = os.environ.get('FB_PAGE_ACCESS_TOKEN', '')
FB_ADMIN_PSID        = os.environ.get('FB_ADMIN_PSID', '')  # PSID của tài khoản admin

STATIC_URL  = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

### 2.3 API Django nhận yêu cầu từ Chatbot

```python
# apps/chat/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.conf import settings
from .models import PendingProductRequest, ChatSession
from apps.notifications.services import notify_admin_new_request

@api_view(['POST'])
@permission_classes([AllowAny])
def receive_pending_request(request):
    """
    Chatbot gọi endpoint này khi khách hỏi hàng chưa có DB.
    Chatbot phải gửi kèm CHATBOT_INTERNAL_TOKEN để xác thực.
    """
    token = request.headers.get('X-Internal-Token', '')
    if token != settings.CHATBOT_INTERNAL_TOKEN:
        return Response({"error": "Unauthorized"}, status=401)

    session_id   = request.data.get('session_id')
    product_name = request.data.get('product_name')
    search_result = request.data.get('search_result', {})
    quoted_price  = request.data.get('quoted_price')

    session = ChatSession.objects.get(session_id=session_id)
    req = PendingProductRequest.objects.create(
        session=session,
        product_name=product_name,
        search_result=search_result,
        quoted_price=quoted_price,
    )

    # Gửi thông báo admin qua web + Messenger
    notify_admin_new_request(req)

    return Response({"status": "created", "request_id": req.id})


@api_view(['POST'])
def approve_pending_request(request, request_id):
    """Admin duyệt yêu cầu từ dashboard."""
    from rest_framework.permissions import IsAdminUser
    req = PendingProductRequest.objects.get(id=request_id)
    req.status      = 'approved'
    req.reviewed_by = request.user
    req.save()

    # TODO: Tạo đơn hàng tự động hoặc thông báo chatbot tiếp tục flow
    return Response({"status": "approved"})
```

### 2.4 Notification Service

```python
# apps/notifications/services.py
import requests
from django.conf import settings

def notify_admin_new_request(pending_request):
    """Gửi thông báo admin qua 2 kênh khi có yêu cầu hàng mới."""

    message = (
        f"🛎️ Yêu cầu hàng mới cần duyệt!\n"
        f"Sản phẩm: {pending_request.product_name}\n"
        f"Báo giá: {pending_request.quoted_price:,}đ\n"
        f"Xem tại: https://your-admin-app.vercel.app/pending-requests/{pending_request.id}"
    )

    # ── Kênh 1: Messenger (gửi tới PSID admin) ────────────────────────
    _send_messenger(settings.FB_ADMIN_PSID, message)

    # ── Kênh 2: Web notification lưu vào DB (Admin dashboard tự fetch) ─
    from apps.notifications.models import AdminNotification
    AdminNotification.objects.create(
        title=f"Yêu cầu hàng mới: {pending_request.product_name}",
        body=message,
        related_request=pending_request,
    )


def _send_messenger(recipient_psid, message_text):
    """Gửi tin nhắn qua Facebook Send API."""
    url = "https://graph.facebook.com/v19.0/me/messages"
    payload = {
        "recipient": {"id": recipient_psid},
        "message":   {"text": message_text},
    }
    requests.post(
        url,
        json=payload,
        params={"access_token": settings.FB_PAGE_ACCESS_TOKEN},
        timeout=10,
    )
```

### 2.5 `Procfile` và `build.sh`

```
# backend/Procfile
web: gunicorn your_project_name.wsgi --log-file -
```

```bash
# backend/build.sh
#!/usr/bin/env bash
set -o errexit
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate
```

```bash
chmod +x backend/build.sh
```

### 2.6 Deploy Django lên Render (Service #1)

1. Render → **New → Web Service** → Kết nối repo
2. Root Directory: `backend` | Build: `./build.sh` | Start: `gunicorn your_project_name.wsgi`
3. **Environment Variables:**

| Key | Value |
|---|---|
| `SECRET_KEY` | Chuỗi ngẫu nhiên 50+ ký tự |
| `DATABASE_URL` | Connection string Neon.tech |
| `DEBUG` | `False` |
| `CHATBOT_INTERNAL_TOKEN` | Chuỗi bí mật tự đặt (dùng chung với Chatbot service) |
| `FB_PAGE_ACCESS_TOKEN` | Token từ Facebook Developer Console |
| `FB_ADMIN_PSID` | PSID tài khoản Facebook của admin |
| `PYTHON_VERSION` | `3.11.0` |

4. Deploy → Copy URL: `https://your-backend.onrender.com`

---

## PHASE 3 — CHATBOT SERVICE (Render Service #2)

> Giữ nguyên code Python hiện tại, bọc thêm FastAPI để expose endpoints.

### 3.1 Cài đặt dependencies

```bash
cd chatbot/
pip install fastapi uvicorn httpx dj-database-url psycopg2-binary python-dotenv \
            openai  # hoặc google-generativeai / anthropic tùy LLM bạn dùng
pip freeze > requirements.txt
```

### 3.2 `main.py` — FastAPI wrapper

```python
# chatbot/main.py
from fastapi import FastAPI, Request, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os, httpx

from bot_logic.web_handler       import handle_web_message
from bot_logic.messenger_handler import handle_messenger_webhook, verify_webhook

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-enduser-app.vercel.app",  # ← Thay sau khi deploy
        "http://localhost:3000",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

DJANGO_API_URL           = os.environ.get('DJANGO_API_URL')
CHATBOT_INTERNAL_TOKEN   = os.environ.get('CHATBOT_INTERNAL_TOKEN')

# ── Endpoint cho Web Widget ────────────────────────────────────────────────
@app.post("/chat/web")
async def web_chat(request: Request):
    body = await request.json()
    session_id = body.get("session_id")   # UUID từ browser
    message    = body.get("message")
    reply = await handle_web_message(session_id, message)
    return {"reply": reply}

# ── Endpoint cho FB Messenger Webhook ─────────────────────────────────────
@app.get("/webhook/messenger")
async def messenger_verify(request: Request):
    """Facebook gọi GET để xác minh webhook khi cài đặt."""
    return verify_webhook(request.query_params)

@app.post("/webhook/messenger")
async def messenger_webhook(request: Request):
    """Facebook gọi POST mỗi khi có tin nhắn mới."""
    body = await request.json()
    await handle_messenger_webhook(body)
    return {"status": "ok"}

# ── Health check ──────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}
```

### 3.3 Luồng xử lý hàng chưa có DB

```python
# chatbot/bot_logic/search_handler.py
import httpx, os

DJANGO_API_URL         = os.environ.get('DJANGO_API_URL')
CHATBOT_INTERNAL_TOKEN = os.environ.get('CHATBOT_INTERNAL_TOKEN')

async def handle_unknown_product(session_id: str, product_name: str):
    """
    Khi LLM xác định sản phẩm chưa có trong DB:
    1. Dùng web search tìm giá thị trường
    2. Báo giá cho khách
    3. Nếu khách đồng ý → gửi về Django để admin duyệt
    """

    # Bước 1: Search web lấy giá (dùng SerpAPI, Tavily, hoặc Brave Search)
    search_result = await search_product_price(product_name)
    quoted_price  = extract_price_from_result(search_result)

    # Bước 2: Trả lời khách
    reply = (
        f"Sản phẩm '{product_name}' hiện chưa có trong kho.\n"
        f"Qua khảo sát thị trường, giá tham khảo khoảng {quoted_price:,}đ.\n"
        f"Bạn có muốn đặt yêu cầu để chúng tôi xem xét nhập hàng không?"
    )
    return reply, search_result, quoted_price


async def submit_pending_request(session_id, product_name, search_result, quoted_price):
    """Khách đồng ý → gửi yêu cầu về Django để admin duyệt."""
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{DJANGO_API_URL}/api/chat/pending-request/",
            json={
                "session_id":   session_id,
                "product_name": product_name,
                "search_result": search_result,
                "quoted_price": quoted_price,
            },
            headers={"X-Internal-Token": CHATBOT_INTERNAL_TOKEN},
            timeout=10,
        )
```

### 3.4 `Procfile` và `build.sh`

```
# chatbot/Procfile
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

```bash
# chatbot/build.sh
#!/usr/bin/env bash
set -o errexit
pip install -r requirements.txt
```

```bash
chmod +x chatbot/build.sh
```

### 3.5 Deploy Chatbot lên Render (Service #2)

1. Render → **New → Web Service** → Kết nối cùng repo
2. Root Directory: `chatbot` | Build: `./build.sh` | Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. **Environment Variables:**

| Key | Value |
|---|---|
| `DJANGO_API_URL` | `https://your-backend.onrender.com` |
| `CHATBOT_INTERNAL_TOKEN` | Chuỗi bí mật (giống với Django) |
| `LLM_API_KEY` | API Key của OpenAI / Gemini / Claude |
| `DATABASE_URL` | Connection string Neon.tech (để lưu chat history) |
| `FB_PAGE_ACCESS_TOKEN` | Token Facebook (để bot reply Messenger) |
| `FB_VERIFY_TOKEN` | Chuỗi tự đặt, dùng khi verify webhook với Facebook |
| `SEARCH_API_KEY` | Key của SerpAPI / Tavily (search hàng chưa có DB) |

4. Deploy → Copy URL: `https://your-chatbot.onrender.com`

### 3.6 Cấu hình Facebook Messenger Webhook

1. Vào [Facebook Developer Console](https://developers.facebook.com)
2. App → **Messenger → Settings → Webhooks**
3. Callback URL:
   ```
   https://your-chatbot.onrender.com/webhook/messenger
   ```
4. Verify Token: Giá trị `FB_VERIFY_TOKEN` bạn đã đặt
5. Subscribe events: `messages`, `messaging_postbacks`

---

## PHASE 4 — FRONTEND ENDUSER — React #1 (Vercel #1)

### 4.1 `.env.production`

```env
REACT_APP_API_URL=https://your-backend.onrender.com/api
REACT_APP_CHATBOT_URL=https://your-chatbot.onrender.com
```

### 4.2 Chat Widget nhúng vào web

```javascript
// src/components/ChatWidget/ChatWidget.jsx
import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const CHATBOT_URL = process.env.REACT_APP_CHATBOT_URL;

export default function ChatWidget() {
    const [messages, setMessages]   = useState([]);
    const [input, setInput]         = useState('');
    const [sessionId]               = useState(() => {
        // Giữ session_id trong localStorage để lưu lịch sử hội thoại
        const stored = localStorage.getItem('chat_session_id');
        if (stored) return stored;
        const newId = uuidv4();
        localStorage.setItem('chat_session_id', newId);
        return newId;
    });

    const sendMessage = async () => {
        if (!input.trim()) return;
        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');

        const res = await fetch(`${CHATBOT_URL}/chat/web`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, message: input }),
        });
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'bot', content: data.reply }]);
    };

    return (
        <div className="chat-widget">
            <div className="messages">
                {messages.map((m, i) => (
                    <div key={i} className={`message ${m.role}`}>{m.content}</div>
                ))}
            </div>
            <input value={input} onChange={e => setInput(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && sendMessage()} />
            <button onClick={sendMessage}>Gửi</button>
        </div>
    );
}
```

### 4.3 Deploy lên Vercel #1

1. Vercel → **New Project** → Root Directory: `frontend-enduser`
2. Environment Variables:
   - `REACT_APP_API_URL` = `https://your-backend.onrender.com/api`
   - `REACT_APP_CHATBOT_URL` = `https://your-chatbot.onrender.com`
3. Deploy → Copy URL: `https://your-enduser-app.vercel.app`

---

## PHASE 5 — FRONTEND ADMIN — React #2 (Vercel #2)

### 5.1 `.env.production`

```env
REACT_APP_API_URL=https://your-backend.onrender.com/api
```

### 5.2 Trang duyệt yêu cầu hàng mới

```javascript
// src/pages/PendingRequests/PendingRequests.jsx
import { useEffect, useState } from 'react';

const API = process.env.REACT_APP_API_URL;

export default function PendingRequests() {
    const [requests, setRequests] = useState([]);

    useEffect(() => {
        fetch(`${API}/admin/pending-requests/`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).then(r => r.json()).then(setRequests);
    }, []);

    const approve = async (id) => {
        await fetch(`${API}/admin/pending-requests/${id}/approve/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setRequests(prev => prev.filter(r => r.id !== id));
    };

    return (
        <div>
            <h1>Yêu cầu hàng chờ duyệt</h1>
            {requests.map(r => (
                <div key={r.id} className="request-card">
                    <h3>{r.product_name}</h3>
                    <p>Báo giá: {r.quoted_price?.toLocaleString()}đ</p>
                    <pre>{JSON.stringify(r.search_result, null, 2)}</pre>
                    <button onClick={() => approve(r.id)}>✅ Duyệt</button>
                </div>
            ))}
        </div>
    );
}
```

### 5.3 Deploy lên Vercel #2

1. Vercel → **New Project** → Root Directory: `frontend-admin`
2. Environment Variables: `REACT_APP_API_URL` = `https://your-backend.onrender.com/api`
3. Deploy → Copy URL: `https://your-admin-app.vercel.app`

### 5.4 Cập nhật CORS Django sau khi có đủ URLs

```python
# backend/settings.py
CORS_ALLOWED_ORIGINS = [
    "https://your-enduser-app.vercel.app",
    "https://your-admin-app.vercel.app",
    "https://your-chatbot.onrender.com",
]
```

→ Push → Render tự redeploy.

---

## PHASE 6 — UPTIME (UptimeRobot)

> Cần ping **cả 2 Render services** để tránh ngủ.

1. Đăng ký [https://uptimerobot.com](https://uptimerobot.com)
2. Tạo **2 monitors**:

| Monitor | URL | Interval |
|---|---|---|
| Django Backend | `https://your-backend.onrender.com/api/health/` | 5 phút |
| Chatbot Service | `https://your-chatbot.onrender.com/health` | 5 phút |

---

## ✅ CHECKLIST CUỐI

```
PHASE 0 — Dockerization
  [ ] backend/Dockerfile đã tạo
  [ ] backend/.dockerignore đã tạo
  [ ] chatbot/Dockerfile đã tạo
  [ ] chatbot/.dockerignore đã tạo
  [ ] docker-compose.yml ở root repo đã tạo
  [ ] docker-compose up --build chạy thành công không có lỗi
  [ ] localhost:8000/api/health/ → {"status":"ok"}
  [ ] localhost:8001/health → {"status":"ok"}
  [ ] localhost:3000 — Enduser web hiển thị
  [ ] localhost:3001 — Admin web hiển thị
  [ ] Render cấu hình dùng Docker (không dùng buildpack Python)

PHASE 1 — Database
  [ ] PostgreSQL Neon.tech đã tạo, có DATABASE_URL
  [ ] Bảng chat_sessions, chat_messages, pending_product_requests đã migrate

PHASE 2 — Django Backend
  [ ] requirements.txt đầy đủ
  [ ] CHATBOT_INTERNAL_TOKEN đã set (dùng chung với Chatbot)
  [ ] FB_PAGE_ACCESS_TOKEN + FB_ADMIN_PSID đã set
  [ ] Endpoint /api/chat/pending-request/ hoạt động
  [ ] Endpoint /api/admin/pending-requests/{id}/approve/ hoạt động
  [ ] Health check: /api/health/ → {"status":"ok"}

PHASE 3 — Chatbot Service
  [ ] FastAPI wrap đúng code Python hiện tại
  [ ] /chat/web nhận và trả lời tin nhắn web
  [ ] /webhook/messenger verify + xử lý tin nhắn FB
  [ ] Logic hàng chưa có DB: search → báo giá → submit về Django
  [ ] FB Messenger Webhook đã cấu hình trên Facebook Developer Console
  [ ] Health check: /health → {"status":"ok"}

PHASE 4 — Enduser Frontend
  [ ] REACT_APP_CHATBOT_URL trỏ đúng Chatbot service
  [ ] Chat widget hoạt động, lưu session_id
  [ ] Gọi được API Django cho sản phẩm, đơn hàng

PHASE 5 — Admin Frontend
  [ ] Trang PendingRequests hiển thị yêu cầu chờ duyệt
  [ ] Nút duyệt gọi đúng API Django
  [ ] CORS Django đã whitelist cả 2 Vercel URL + Chatbot URL

PHASE 6 — Uptime
  [ ] UptimeRobot ping Django mỗi 5 phút
  [ ] UptimeRobot ping Chatbot mỗi 5 phút
```

---

## 🐛 XỬ LÝ LỖI THƯỜNG GẶP

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| `docker-compose up` lỗi "port already in use" | Port 8000/3000 đang bị chiếm | `lsof -i :8000` rồi kill process, hoặc đổi port trong compose |
| Backend container crash ngay khi start | DB chưa ready khi Django connect | `depends_on` + `healthcheck` đã xử lý; kiểm tra log `docker-compose logs db` |
| `python manage.py migrate` lỗi trong container | DATABASE_URL sai format | Kiểm tra `postgres://user:pass@db:5432/dbname` — host phải là `db` (tên service) |
| Render build Docker thất bại | `your_project_name` chưa thay trong CMD | Thay đúng tên Django project trong `Dockerfile` dòng CMD |
| FB Webhook verify thất bại | `FB_VERIFY_TOKEN` không khớp | Kiểm tra lại token trên Facebook Developer Console |
| Chatbot không gọi được Django | `CHATBOT_INTERNAL_TOKEN` sai hoặc CORS chưa whitelist Chatbot URL | Kiểm tra token + thêm URL chatbot vào CORS_ALLOWED_ORIGINS |
| Chat widget không kết nối | `REACT_APP_CHATBOT_URL` sai | Kiểm tra .env.production, rebuild Vercel |
| Admin không nhận Messenger notification | `FB_ADMIN_PSID` sai hoặc token hết hạn | Lấy lại PSID qua Graph API Explorer |
| Pending request không hiện trên dashboard | Django chưa migrate bảng mới | `docker-compose exec backend python manage.py migrate` |
| Cả 2 Render service ngủ cùng lúc | UptimeRobot chưa ping Chatbot | Tạo thêm monitor cho Chatbot service |

---

## 🔑 BIẾN MÔI TRƯỜNG — TỔNG HỢP

### Django (Render Service #1)
```env
SECRET_KEY=<random-50-chars>
DATABASE_URL=postgres://...
DEBUG=False
PYTHON_VERSION=3.11.0
CHATBOT_INTERNAL_TOKEN=<shared-secret>
FB_PAGE_ACCESS_TOKEN=<from-facebook-developer-console>
FB_ADMIN_PSID=<facebook-page-scoped-id-of-admin>
```

### Chatbot (Render Service #2)
```env
DJANGO_API_URL=https://your-backend.onrender.com
DATABASE_URL=postgres://...          # Cùng DB với Django
CHATBOT_INTERNAL_TOKEN=<shared-secret>
LLM_API_KEY=<openai-or-gemini-or-claude-key>
FB_PAGE_ACCESS_TOKEN=<from-facebook-developer-console>
FB_VERIFY_TOKEN=<self-defined-string>
SEARCH_API_KEY=<serpapi-or-tavily-key>
```

### Enduser Frontend (Vercel #1)
```env
REACT_APP_API_URL=https://your-backend.onrender.com/api
REACT_APP_CHATBOT_URL=https://your-chatbot.onrender.com
```

### Admin Frontend (Vercel #2)
```env
REACT_APP_API_URL=https://your-backend.onrender.com/api
```