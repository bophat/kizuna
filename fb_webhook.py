import os
import requests
from flask import Flask, request, jsonify, render_template, redirect, url_for
import json
import time
from dotenv import load_dotenv

# Import functions from chatbot
from chatbot import init_db, generate_reply, search_product_japan, add_product_to_local_db, save_missing_products, save_order, get_today_orders

load_dotenv()

app = Flask(__name__)

VERIFY_TOKEN = os.getenv("VERIFY_TOKEN", "my_secure_verify_token")
PAGE_ACCESS_TOKEN = os.getenv("FACEBOOK_ACCESS_TOKEN", "your_page_access_token")
KB_FILE = "knowledge_base.json"

# Khởi tạo DB khi khởi chạy app
init_db()
sync_page_name_to_kb()

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
        return

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
    except Exception as e:
        print("❌ Lỗi Call API FB:", str(e))

def process_image(image_url):
    """
    Xử lý hình ảnh nếu cần thiết.
    """
    pass

@app.route("/", methods=["GET"])
def index():
    return "Bot is running! Go to <a href='/admin'>/admin</a> to manage products.", 200

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
                            send_message(sender_id, "Dạ bạn vui lòng nhập thêm tên/thông tin sản phẩm đi kèm với ảnh để bên mình dễ tìm giá nhé!")
                            return "EVENT_RECEIVED", 200
                        elif not user_input:
                            return "EVENT_RECEIVED", 200

                        # 2. Sinh câu trả lời với AI flow
                        reply, missing_products = generate_reply(user_input)
                        final_reply = reply

                        if missing_products:
                            for product in missing_products:
                                # AI Search
                                temp_price_info, price_jpy, price_vnd = search_product_japan(product)
                                
                                final_reply += (f"\n\nDạ, riêng món '{product}', "
                                                f"hiện bên Nhật đang có giá khoảng: {temp_price_info}. "
                                                f"Bên em sẽ check thêm chính xác phí vận chuyển và báo lại nha!")
                                
                                # Auto-filling DB
                                add_product_to_local_db(product, temp_price_info)
                                
                                # Log order record
                                save_order(product, price_jpy, price_vnd)

                            save_missing_products(missing_products, user_input)
                        
                        send_message(sender_id, final_reply)
                        
            return "EVENT_RECEIVED", 200
        else:
            return "Not Found", 404

if __name__ == "__main__":
    app.run(port=8080, debug=True)

