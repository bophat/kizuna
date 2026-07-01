import os
import requests
from flask import Flask, request, jsonify, render_template, redirect, url_for
import json
import time
import queue
from dotenv import load_dotenv
from flask_cors import CORS

# Import functions from chatbot
from AI.chatbot.chatbot import (
    init_db, generate_reply, search_product_japan, add_product_to_local_db,
    save_missing_products, save_order, get_today_orders,
    is_greeting_only, greeting_reply,
)
from AI.chatbot.django_bridge import fetch_product_catalog, fetch_bot_config, create_pending_reply

load_dotenv()

app = Flask(__name__)
CORS(app)

# Global list of queues for SSE clients
clients = []

# Chat sessions for Live Chat
chat_sessions = {}
session_clients = {}

def notify_session(session_id, data):
    if session_id in session_clients:
        for q in session_clients[session_id]:
            q.put(data)

def notify_clients(notification_data):
    for q in clients:
        q.put(notification_data)

VERIFY_TOKEN = os.getenv("VERIFY_TOKEN", "my_secure_verify_token")
PAGE_ACCESS_TOKEN = os.getenv("FACEBOOK_ACCESS_TOKEN", "your_page_access_token")
BOT_INTERNAL_TOKEN = os.getenv("CHATBOT_INTERNAL_TOKEN", "")
KB_FILE = "knowledge_base.json"

# Sync tokens from Django settings when available
_bot_config = fetch_bot_config()
if _bot_config.get('facebook_page_access_token'):
    PAGE_ACCESS_TOKEN = _bot_config['facebook_page_access_token']
if _bot_config.get('facebook_verify_token'):
    VERIFY_TOKEN = _bot_config['facebook_verify_token']

# Khởi tạo DB khi khởi chạy app
init_db()

def load_kb():
    """Tải dữ liệu từ file JSON kiến thức"""
    if not os.path.exists(KB_FILE):
        return {"shop_info": {}, "products": []}
    with open(KB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_kb(data):
    """Lưu dữ liệu vào file JSON kiến thức"""
    with open(KB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def fetch_facebook_page_name():
    """Lấy tên fanpage từ Facebook Graph API."""
    if not PAGE_ACCESS_TOKEN or PAGE_ACCESS_TOKEN == "your_page_access_token":
        return None
    
    url = f"https://graph.facebook.com/v21.0/me?fields=name&access_token={PAGE_ACCESS_TOKEN}"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            return response.json().get("name")
    except Exception as e:
        print(f"❌ Lỗi lấy tên Page: {e}")
    return None

def sync_page_name_to_kb():
    """Tự động cập nhật tên fanpage vào file JSON kiến thức."""
    fb_name = fetch_facebook_page_name()
    if fb_name:
        print(f"✅ [HỆ THỐNG]: Tự động lấy tên fanpage: {fb_name}")
        kb_data = load_kb()
        if kb_data.get("shop_info", {}).get("name") != fb_name:
            if "shop_info" not in kb_data:
                kb_data["shop_info"] = {}
            kb_data["shop_info"]["name"] = fb_name
            if "style" not in kb_data["shop_info"]:
                kb_data["shop_info"]["style"] = "Thân thiện, dạ thưa, nhiệt tình chốt sale"
            save_kb(kb_data)
            print(f"📝 [HỆ THỐNG]: Đã cập nhật tên Shop vào Database.")
    else:
        print("⚠️ [HỆ THỐNG]: Không lấy được tên fanpage từ Facebook (Token hết hạn hoặc chưa cấu hình).")

@app.route("/admin", methods=["GET"])
def admin_dashboard():
    """Hiển thị màn hình Admin"""
    kb_data = load_kb()
    return render_template("admin.html", 
                           products=kb_data.get("products", []), 
                           shop_info=kb_data.get("shop_info", {}))

@app.route("/admin/add", methods=["POST"])
def admin_add_product():
    """Thêm sản phẩm thủ công từ Form"""
    name = request.form.get("name")
    price = request.form.get("price")
    stock = request.form.get("stock")
    features_raw = request.form.get("features", "")
    
    # Xử lý list tính năng từ xuống dòng
    features = [f.strip() for f in features_raw.split("\n") if f.strip()]
    
    kb_data = load_kb()
    new_id = f"SP_MAN_{int(time.time())}"
    
    new_product = {
        "id": new_id,
        "name": name,
        "price": price,
        "stock": int(stock) if stock else 0,
        "features": features
    }
    
    kb_data["products"].append(new_product)
    save_kb(kb_data)
    return redirect(url_for("admin_dashboard"))

@app.route("/admin/delete/<product_id>", methods=["POST"])
def admin_delete_product(product_id):
    """Xóa sản phẩm theo ID"""
    kb_data = load_kb()
    kb_data["products"] = [p for p in kb_data["products"] if p.get("id") != product_id]
    save_kb(kb_data)
    return redirect(url_for("admin_dashboard"))

def send_message(recipient_id, message_text):
    """Gửi tin nhắn qua Facebook Graph API"""
    if PAGE_ACCESS_TOKEN == "your_page_access_token":
        print(f"⚠️ [MOCK DB] Sẽ gửi tới {recipient_id}: {message_text}")
        return True

    headers = {"Content-Type": "application/json"}
    params = {"access_token": PAGE_ACCESS_TOKEN}
    data = {
        "recipient": {"id": recipient_id},
        "message": {"text": message_text}
    }
    
    url = "https://graph.facebook.com/v21.0/me/messages"
    try:
        response = requests.post(url, params=params, headers=headers, json=data)
        if response.status_code != 200:
            print("❌ Lỗi gửi tin nhắn:", response.json())
            return False
        return True
    except Exception as e:
        print("❌ Lỗi Call API FB:", str(e))
        return False


def queue_or_send_messenger(sender_id, user_input, final_reply, metadata=None):
    """
    Greetings → gửi ngay. Các tin khác → hàng đợi duyệt trên Admin.
    """
    if is_greeting_only(user_input):
        send_message(sender_id, greeting_reply())
        return

    pending = create_pending_reply(
        channel='messenger',
        customer_id=sender_id,
        incoming_message=user_input,
        draft_reply=final_reply,
        is_greeting=False,
        metadata=metadata or {},
    )
    if pending:
        notify_clients({
            "id": f"notif_pending_{pending.get('id', int(time.time() * 1000))}",
            "type": "APPROVAL",
            "title": "Tin nhắn chờ duyệt",
            "message": f"Khách: {user_input[:80]}",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "pending_id": pending.get('id'),
        })
    else:
        print(f"⚠️ [QUEUE] Không lưu được hàng đợi — tin chưa gửi: {final_reply[:80]}...")


def build_ai_reply(user_input, kb=None):
    """Sinh câu trả lời AI từ catalog Django hoặc JSON local."""
    if kb is None:
        kb = fetch_product_catalog() or load_kb()
    reply, missing_products = generate_reply(user_input, kb=kb)
    final_reply = reply

    if missing_products:
        for product in missing_products:
            temp_price_info, price_jpy, price_vnd = search_product_japan(product)
            final_reply += (
                f"\n\nDạ, riêng món '{product}', "
                f"hiện bên Nhật đang có giá khoảng: {temp_price_info}. "
                f"Bên em sẽ check thêm chính xác phí vận chuyển và báo lại nha!"
            )
            add_product_to_local_db(product, temp_price_info)
            save_order(product, price_jpy, price_vnd)
            notify_clients({
                "id": f"notif_order_{int(time.time() * 1000)}_{product}",
                "type": "ORDER",
                "title": "Đơn hàng mới",
                "message": f"Sản phẩm: {product}",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            })
        save_missing_products(missing_products, user_input)

    return final_reply

def process_image(image_url):
    """
    Xử lý hình ảnh nếu cần thiết.
    """
    pass

@app.route("/", methods=["GET"])
def index():
    return "Bot is running! Go to <a href='/admin'>/admin</a> to manage products.", 200

@app.route("/api/notifications/stream", methods=["GET"])
def stream_notifications():
    def event_stream():
        q = queue.Queue()
        clients.append(q)
        try:
            while True:
                data = q.get()
                yield f"data: {json.dumps(data)}\n\n"
        except GeneratorExit:
            clients.remove(q)
    return app.response_class(event_stream(), mimetype="text/event-stream")

@app.route("/api/concierge/message", methods=["POST"])
def concierge_message():
    data = request.json
    user_input = data.get("message", "")
    session_id = data.get("session_id", "default")
    sender = data.get("sender", "user")

    if session_id not in chat_sessions:
        chat_sessions[session_id] = {"messages": [], "adminTookOver": False, "updated_at": time.time()}
    
    if user_input:
        chat_sessions[session_id]["messages"].append({
            "id": str(int(time.time() * 1000)),
            "role": "user" if sender == "user" else "assistant",
            "content": user_input,
            "timestamp": time.time()
        })
        chat_sessions[session_id]["updated_at"] = time.time()

        if sender == "user":
            notify_clients({
                "id": f"notif_concierge_{int(time.time() * 1000)}",
                "type": "CHAT",
                "title": "Tin nhắn từ Website",
                "message": f"Khách: {user_input}",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "session_id": session_id
            })
    return jsonify({"status": "success", "adminTookOver": chat_sessions[session_id]["adminTookOver"]}), 200

@app.route("/api/chat/sessions", methods=["GET"])
def get_chat_sessions():
    return jsonify(chat_sessions)

@app.route("/api/chat/<session_id>/reply", methods=["POST"])
def admin_reply(session_id):
    data = request.json
    message = data.get("message", "")
    if session_id in chat_sessions:
        chat_sessions[session_id]["adminTookOver"] = True
        msg_obj = {
            "id": str(int(time.time() * 1000)),
            "role": "assistant",
            "content": message,
            "is_admin": True,
            "timestamp": time.time()
        }
        chat_sessions[session_id]["messages"].append(msg_obj)
        chat_sessions[session_id]["updated_at"] = time.time()
        notify_session(session_id, msg_obj)
        return jsonify({"status": "success", "message": msg_obj})
    return jsonify({"error": "Session not found"}), 404

@app.route("/api/chat/<session_id>/stream", methods=["GET"])
def stream_session(session_id):
    def event_stream():
        q = queue.Queue()
        if session_id not in session_clients:
            session_clients[session_id] = []
        session_clients[session_id].append(q)
        try:
            while True:
                data = q.get()
                yield f"data: {json.dumps(data)}\n\n"
        except GeneratorExit:
            session_clients[session_id].remove(q)
    return app.response_class(event_stream(), mimetype="text/event-stream")


@app.route("/api/internal/dispatch", methods=["POST"])
def internal_dispatch():
    """Django gọi sau khi admin duyệt tin nhắn."""
    token = request.headers.get("X-Bot-Token", "")
    if not BOT_INTERNAL_TOKEN or token != BOT_INTERNAL_TOKEN:
        return jsonify({"error": "Forbidden"}), 403

    data = request.json or {}
    channel = data.get("channel", "messenger")
    customer_id = data.get("customer_id", "")
    message = data.get("message", "")
    metadata = data.get("metadata") or {}

    if not message or not customer_id:
        return jsonify({"error": "Missing fields"}), 400

    if channel == "messenger":
        ok = send_message(customer_id, message)
    elif channel == "website":
        msg_obj = {
            "id": str(int(time.time() * 1000)),
            "role": "assistant",
            "content": message,
            "is_admin": True,
            "timestamp": time.time()
        }
        if customer_id in chat_sessions:
            chat_sessions[customer_id]["messages"].append(msg_obj)
            notify_session(customer_id, msg_obj)
        ok = True
    elif channel == "comment":
        comment_id = metadata.get("comment_id")
        ok = send_private_reply_to_comment(comment_id, message) if comment_id else False
    else:
        ok = False

    return jsonify({"status": "sent" if ok else "failed"}), 200 if ok else 502


def send_private_reply_to_comment(comment_id, message):
    """Gửi inbox từ comment (cần quyền pages_messaging)."""
    if not comment_id or PAGE_ACCESS_TOKEN == "your_page_access_token":
        return False
    url = f"https://graph.facebook.com/v21.0/{comment_id}/private_replies"
    try:
        res = requests.post(
            url,
            params={"access_token": PAGE_ACCESS_TOKEN},
            json={"message": message},
            timeout=15,
        )
        return res.status_code == 200
    except Exception as e:
        print(f"❌ private_replies error: {e}")
        return False


@app.route("/api/order/new", methods=["POST"])
def new_order_notification():
    data = request.json or {}
    order_id = data.get("order_id", "Unknown")
    total = data.get("total", "0")
    
    notify_clients({
        "id": f"notif_order_web_{int(time.time() * 1000)}",
        "type": "ORDER",
        "title": "Đơn hàng mới từ Website",
        "message": f"Mã đơn: #{order_id} - Tổng: ${total}",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    })
    return jsonify({"status": "success"}), 200

@app.route("/webhook", methods=["GET", "POST"])
def webhook():
    if request.method == "GET":
        mode = request.args.get("hub.mode")
        token = request.args.get("hub.verify_token")
        challenge = request.args.get("hub.challenge")

        if mode and token:
            if mode == "subscribe" and token == VERIFY_TOKEN:
                print("WEBHOOK_VERIFIED")
                return challenge, 200
            else:
                return "Forbidden", 403
        return "OK", 200

    if request.method == "POST":
        data = request.json
        if data.get("object") == "page":
            for entry in data.get("entry", []):
                # --- Feed comments ---
                for change in entry.get("changes", []):
                    if change.get("field") == "feed":
                        value = change.get("value", {})
                        if value.get("item") == "comment" and value.get("verb") == "add":
                            comment_id = value.get("comment_id")
                            post_id = value.get("post_id")
                            sender_id = value.get("from", {}).get("id", "")
                            sender_name = value.get("from", {}).get("name", "")
                            message = value.get("message", "")
                            if message and sender_id:
                                kb = fetch_product_catalog() or load_kb()
                                final_reply = build_ai_reply(message, kb=kb)
                                create_pending_reply(
                                    channel='comment',
                                    customer_id=sender_id,
                                    customer_name=sender_name,
                                    incoming_message=message,
                                    draft_reply=final_reply,
                                    metadata={'comment_id': comment_id, 'post_id': post_id},
                                )
                                notify_clients({
                                    "id": f"notif_comment_{comment_id}",
                                    "type": "APPROVAL",
                                    "title": "Comment chờ duyệt",
                                    "message": f"{sender_name}: {message[:60]}",
                                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                                })

                for messaging_event in entry.get("messaging", []):
                    # Bỏ qua tin nhắn từ chính Bot
                    if messaging_event.get("message") and not messaging_event.get("message").get("is_echo"):
                        sender_id = messaging_event["sender"]["id"]
                        message = messaging_event["message"]
                        text = message.get("text", "")
                        attachments = message.get("attachments", [])
                        
                        has_image = False
                        for att in attachments:
                            if att.get("type") == "image":
                                has_image = True
                                image_url = att.get("payload", {}).get("url")
                                process_image(image_url)

                        user_input = text.strip()
                        
                        if user_input:
                            notify_clients({
                                "id": f"notif_{int(time.time() * 1000)}",
                                "type": "CHAT",
                                "title": "Tin nhắn mới",
                                "message": f"Khách hàng: {user_input}",
                                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                            })

                        
                        # 1. Trả về report nếu nhắn đúng lệnh
                        if user_input.lower() == "report list order hôm nay":
                            orders = get_today_orders()
                            if not orders:
                                send_message(sender_id, "Hôm nay chưa có yêu cầu báo giá/order nào.")
                                return "EVENT_RECEIVED", 200
                            
                            report_str = f"🚀 REPORT LIST ORDER HÔM NAY:\n"
                            for order in orders:
                                order_date, product_name, price_jpy, price_vnd = order
                                report_str += (f"\nNgày order: {order_date}\n"
                                               f"Tên sản phẩm: {product_name}\n"
                                               f"Giá: {price_jpy} = {price_vnd} VNĐ\n"
                                               f"--------------")
                            
                            send_message(sender_id, report_str)
                            return "EVENT_RECEIVED", 200

                        # Nếu có ảnh mà ko có text, nhắc khách
                        if has_image and not user_input:
                            queue_or_send_messenger(
                                sender_id,
                                "[Ảnh sản phẩm]",
                                "Dạ bạn vui lòng nhập thêm tên/thông tin sản phẩm đi kèm với ảnh để bên mình dễ tìm giá nhé!",
                            )
                            return "EVENT_RECEIVED", 200
                        elif not user_input:
                            return "EVENT_RECEIVED", 200

                        # 2. Sinh câu trả lời với AI flow
                        final_reply = build_ai_reply(user_input)
                        queue_or_send_messenger(sender_id, user_input, final_reply)
                        
            return "EVENT_RECEIVED", 200
        else:
            return "Not Found", 404

if __name__ == "__main__":
    sync_page_name_to_kb()
    app.run(port=8080, debug=True)

