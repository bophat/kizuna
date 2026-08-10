# 🛍️ E-Commerce Chatbot System

Hệ thống chatbot thương mại điện tử hoàn chỉnh với tích hợp Facebook Messenger, web widget, và quản trị admin.

## 📐 Kiến Trúc Hệ Thống

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Enduser Web    │     │   Admin Web      │     │  FB Messenger   │
│  React (Vercel) │     │  React (Vercel)  │     │  (Meta Webhook) │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │    CHATBOT SERVICE     │
                    │   FastAPI + Python     │
                    │    (Render #2)         │
                    └───────────┬────────────┘
                                │ HTTP Internal API
                                ▼
                    ┌────────────────────────┐
                    │    DJANGO BACKEND      │
                    │   Django + DRF + JWT   │
                    │    (Render #1)         │
                    └───────────┬────────────┘
                                │ DATABASE_URL
                                ▼
                    ┌────────────────────────┐
                    │    POSTGRESQL DB       │
                    │     (Neon.tech)        │
                    └────────────────────────┘
```

## 🗂️ Cấu Trúc Repository

```
myprj-AIv2/
├── web/
│   ├── backend/                    # Django Backend (Render Service #1)
│   │   ├── apps/
│   │   │   ├── users/              # Quản lý người dùng
│   │   │   ├── products/           # Sản phẩm, danh mục
│   │   │   ├── orders/             # Đơn hàng
│   │   │   ├── payments/           # Thanh toán
│   │   │   ├── chat/               # ChatSession, ChatMessage, PendingProductRequest
│   │   │   └── notifications/      # Thông báo admin (web + Messenger)
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── manage.py
│   │
│   ├── chatbot/                    # Chatbot Service (Render Service #2)
│   │   ├── main.py                 # FastAPI app
│   │   ├── bot_logic/
│   │   │   ├── llm_handler.py      # Gọi OpenAI/Gemini/Claude
│   │   │   ├── messenger_handler.py # Webhook FB Messenger
│   │   │   ├── web_handler.py      # Xử lý chat từ website
│   │   │   ├── search_handler.py   # Web search hàng chưa có DB
│   │   │   └── session_manager.py  # Lưu lịch sử hội thoại
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   ├── website/                    # Enduser Frontend (Vercel #1)
│   │   ├── src/components/ChatWidget/  # Chat widget nhúng
│   │   └── package.json
│   │
│   ├── admin/                      # Admin Frontend (Vercel #2)
│   │   ├── src/pages/PendingRequests/  # Duyệt yêu cầu hàng mới
│   │   └── package.json
│   │
│   ├── docker-compose.yml          # Chạy local toàn bộ hệ thống
│   ├── DEPLOY.md                   # Hướng dẫn deploy chi tiết
│   └── README.md                   # Hướng dẫn deploy đầy đủ (xem file này)
│
├── CLAUDE.md                       # Specification cho Claude Code
└── README.md                       # File này - Tổng quan dự án
```

## 🚀 Các Tính Năng Chính

| Tính năng | Mô tả |
|-----------|-------|
| **Chat đa kênh** | Hỗ trợ Web Widget + Facebook Messenger |
| **AI Chatbot** | Tích hợp LLM (OpenAI/Gemini/Claude) để hiểu ngữ cảnh |
| **Tìm kiếm sản phẩm** | Tự động search web khi hàng chưa có trong DB |
| **Quy trình duyệt hàng** | Khách yêu cầu → Chatbot báo giá → Admin duyệt qua dashboard |
| **Thông báo realtime** | Gửi Messenger + Web notification cho admin |
| **Quản trị đơn hàng** | Admin dashboard quản lý sản phẩm, đơn hàng, yêu cầu nhập hàng |
| **JWT Authentication** | Bảo mật API cho cả user và admin |

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend API | Django 4.x + Django REST Framework + SimpleJWT |
| Chatbot | FastAPI + Uvicorn |
| Database | PostgreSQL (Neon.tech) |
| Enduser Frontend | React 18 + Vite (Deploy: Vercel) |
| Admin Frontend | React 18 + Vite (Deploy: Vercel) |
| Deployment | Docker + Render (Backend) + Vercel (Frontend) |
| Cache/Queue | In-memory (có thể mở rộng Redis) |
| Monitoring | UptimeRobot |

## 📋 Yêu Cầu Hệ Thống

- Docker Desktop
- Node.js 20+
- Python 3.11+
- Tài khoản: GitHub, Vercel, Render, Neon.tech, UptimeRobot
- API Keys: LLM (OpenAI/Gemini/Claude), Facebook App, Search API (SerpAPI/Tavily)

## 🏃‍♂️ Chạy Local (Development)

```bash
cd web

# Build và chạy tất cả services
docker-compose up --build

# Chạy background
docker-compose up -d

# Xem logs
docker-compose logs -f backend
docker-compose logs -f chatbot

# Dừng
docker-compose down
```

### Kiểm tra local

| Service | URL | Kết quả |
|---------|-----|---------|
| Django API | http://localhost:8000/api/health/ | `{"status": "ok"}` |
| Chatbot | http://localhost:8001/health | `{"status": "ok"}` |
| Enduser Web | http://localhost:3000 | Website hiển thị |
| Admin Web | http://localhost:3001 | Dashboard hiển thị |
| Django Admin | http://localhost:8000/django-admin/ | Admin panel |

## ☁️ Deploy Production

Xem chi tiết tại: [web/README.md](web/README.md) hoặc [web/DEPLOY.md](web/DEPLOY.md)

### Tóm tắt quy trình:

1. **Phase 0**: Dockerize tất cả services → Test local với docker-compose
2. **Phase 1**: Tạo PostgreSQL trên Neon.tech → Lấy DATABASE_URL
3. **Phase 2**: Deploy Django lên Render (Service #1) → Cấu hình env vars
4. **Phase 3**: Deploy Chatbot lên Render (Service #2) → Cấu hình Facebook Webhook
5. **Phase 4**: Deploy Enduser React lên Vercel #1
6. **Phase 5**: Deploy Admin React lên Vercel #2 → Cập nhật CORS Django
7. **Phase 6**: Cấu hình UptimeRobot ping cả 2 Render services

## 🔑 Biến Môi Trường Chính

### Django (Render #1)
```env
SECRET_KEY=<random-50-chars>
DATABASE_URL=postgres://...
DEBUG=False
CHATBOT_INTERNAL_TOKEN=<shared-secret>
FB_PAGE_ACCESS_TOKEN=<from-facebook>
FB_ADMIN_PSID=<admin-psid>
```

### Chatbot (Render #2)
```env
DJANGO_API_URL=https://your-backend.onrender.com
DATABASE_URL=postgres://...          # Cùng DB với Django
CHATBOT_INTERNAL_TOKEN=<shared-secret>
LLM_API_KEY=<openai/gemini/claude-key>
FB_PAGE_ACCESS_TOKEN=<from-facebook>
FB_VERIFY_TOKEN=<self-defined>
SEARCH_API_KEY=<serpapi/tavily-key>
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

## 📚 Tài Liệu Tham Khảo

- [Hướng dẫn Deploy đầy đủ](web/README.md)
- [Quick Deploy Guide](web/DEPLOY.md)
- [Google Cloud Deploy](web/GOOGLE_CLOUD_DEPLOY.md)
- [Source URL Import](web/DEPLOY_SOURCE_URL_IMPORT.md)
- [Claude Specification](CLAUDE.md)

## 💰 Chi Phí Dự Kiến

| Service | Platform | Chi phí |
|---------|----------|---------|
| Backend | Render Free Tier | $0 |
| Chatbot | Render Free Tier | $0 |
| Enduser Web | Vercel Hobby | $0 |
| Admin Web | Vercel Hobby | $0 |
| Database | Neon.tech Free | $0 |
| Monitoring | UptimeRobot Free | $0 |
| **Tổng** | | **$0/tháng** |

## 🤝 Đóng Góp

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.

## 📞 Hỗ Trợ

Nếu có vấn đề khi deploy hoặc chạy dự án, vui lòng tạo Issue trên GitHub repository.