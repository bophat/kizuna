import os
import json
import sqlite3
import time
import re
import requests
from dotenv import load_dotenv

from google import genai
from google.genai import types

# Load environment variables
load_dotenv()

# Cấu hình Files
DB_NAME = "post_history.sqlite"
DB_JSON = "knowledge_base.json"

def init_db():
    """Khởi tạo database SQLite lưu lịch sử và Queue các sản phẩm chờ xử lý."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    # Bảng lưu tin nhắn
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Leads (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            message TEXT,
            reply TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Bảng lưu sản phẩm khách hỏi mà Shop cần check thêm, lưu thành Queue
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS MissingProducts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_name TEXT,
            customer_message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Bảng lưu Order trong ngày (các yêu cầu đã báo giá)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_date TEXT DEFAULT (date('now', 'localtime')),
            product_name TEXT,
            price_jpy TEXT,
            price_vnd TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def save_order(product_name, price_jpy, price_vnd):
    """Lưu trữ thông tin order/inquiry vào database."""
    if price_jpy in ["N/A", "", None] and price_vnd in ["N/A", "", None]:
        return
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO Orders (product_name, price_jpy, price_vnd) VALUES (?, ?, ?)", 
                       (product_name, str(price_jpy), str(price_vnd)))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[HỆ THỐNG]: Lỗi lưu Order: {e}")

def get_today_orders():
    """Lấy danh sách các đơn hàng hôm nay để làm báo cáo."""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT order_date, product_name, price_jpy, price_vnd FROM Orders WHERE order_date = date('now', 'localtime')")
        rows = cursor.fetchall()
        conn.close()
        return rows
    except Exception as e:
        print(f"[HỆ THỐNG]: Lỗi đọc Order: {e}")
        return []

def save_missing_products(product_names, customer_message):
    """Lưu danh sách sản phẩm bị lỡ vào hàng đợi Queue để Manager kiểm tra (SQLite)."""
    if not product_names:
        return
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    for product in product_names:
        cursor.execute("INSERT INTO MissingProducts (product_name, customer_message) VALUES (?, ?)", 
                       (product, customer_message))
    conn.commit()
    conn.close()

def parse_llm_json(text):
    """Trích xuất JSON từ chuỗi kết quả của LLM (loại bỏ markdown dư thừa)."""
    text = text.strip()
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        text = match.group(0)
    return json.loads(text)

def search_product_japan(product_name):
    """
    Sử dụng Web Search thông qua Google Serper API
    Tìm kiếm thông tin sản phẩm và dùng Gemini tóm tắt lấy mức giá Nhật.
    """
    print(f"[HỆ THỐNG]: Món này lạ, Bot tự động đi tìm kiếm '{product_name}' trên web Nhật...")
    try:
        serper_api_key = os.getenv("SERPER_API_KEY")
        if not serper_api_key:
            return "Chưa tra cứu được giá vì thiếu API Key Serper", "N/A", "N/A"
            
        url = "https://google.serper.dev/search"
        payload = json.dumps({
          "q": f"{product_name} giá Nhật Bản kakaku amazon rakuten",
          "gl": "jp",
          "hl": "vi"
        })
        headers = {
          'X-API-KEY': serper_api_key,
          'Content-Type': 'application/json'
        }
        res = requests.request("POST", url, headers=headers, data=payload)
        res_json = res.json()
        
        results = res_json.get("organic", [])
        if not results:
            return "Chưa tra cứu được giá thị trường ngay lúc này", "N/A", "N/A"
            
        search_context = "\\n".join([f"- {r.get('title', '')}: {r.get('snippet', '')}" for r in results[:3]])
        
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        prompt = f"""Bạn là AI hỗ trợ thu thập dữ liệu giá cả từ web. Xem các kết quả sau khi tìm kiếm '{product_name}' tại Nhật:
{search_context}

CHỈ tóm tắt DUY NHẤT mức giá tham khảo (đổi qua VNĐ nếu có thể, ước lượng 1 JPY = 165 VNĐ) và tối đa 1 dòng mô tả ngắn. 
Tuyệt đối không giải thích dài dòng hay chào hỏi. Nếu không tìm thấy giá rõ ràng, hãy trả lời theo mẫu.

BẮT BUỘC TRẢ VỀ ĐÚNG MỘT KHỐI JSON DUY NHẤT NHƯ SAU, VÀ KHI TRẢ VỀ JSON TUYỆT ĐỐI KHÔNG CHÈN ICON HAY BIỂU TƯỢNG CẢM XÚC NÀO:
{{
  "reply": "Giá tham khảo bên Nhật khoảng ...",
  "price_jpy": "Số tiền JPY hoặc N/A",
  "price_vnd": "Số tiền VNĐ hoặc N/A"
}}"""
        response = client.models.generate_content(
            model='gemini-2.5-pro',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
            ),
        )
        data = parse_llm_json(response.text)
        
        return data.get("reply", "Chưa có thông tin giá rõ ràng"), data.get("price_jpy", "N/A"), data.get("price_vnd", "N/A")
    except Exception as e:
        print(f"[HỆ THỐNG]: Lỗi tìm kiếm web: {e}")
        return "Chưa có thông tin giá rõ ràng", "N/A", "N/A"

def add_product_to_local_db(product_name, temp_price_info):
    """
    CƠ CHẾ TỰ HỌC: Tự động ghi sản phẩm mới vào file JSON (DB).
    Lần sau khách hỏi, AI sẽ dùng luôn thông tin đã được học này.
    """
    print(f"[HỆ THỐNG]: Đang lưu '{product_name}' vào Database để 'tự học' (Auto-filling)...")
    try:
        if not os.path.exists(DB_JSON):
            kb = {"shop_info": {"name": "Cửa hàng của tôi", "style": "Thân thiện, dạ thưa, nhiệt tình chốt sale"}, "products": []}
        else:
            with open(DB_JSON, "r", encoding="utf-8") as f:
                kb = json.load(f)
                
        new_id = f"SP_AUTO_{int(time.time())}"
        new_product = {
            "id": new_id,
            "name": product_name,
            "price": temp_price_info,
            "status": "Cần liên hệ cung cấp (Hàng đợi)",
            "features": ["Thông tin thu thập tự động từ kết quả Web Search", "Đang chờ Admin cập nhật thêm"]
        }
        
        kb["products"].append(new_product)
        
        with open(DB_JSON, "w", encoding="utf-8") as f:
            json.dump(kb, f, ensure_ascii=False, indent=2)
            
        print("[HỆ THỐNG]: Đã lưu Database! Lần sau khách hỏi, Bot sẽ tự biết báo giá này mà không tốn Token Search.")
    except Exception as e:
        print(f"[HỆ THỐNG]: Lỗi ghi JSON: {e}")

def generate_reply(user_message):
    """Hàm lõi tương tác với khách dựa trên Data Local (JSON)."""
    try:
        with open(DB_JSON, "r", encoding="utf-8") as f:
            kb = json.load(f)
    except FileNotFoundError:
        kb = {"shop_info": {"name": "Cửa hàng của tôi", "style": "Thân thiện, dạ thưa, nhiệt tình chốt sale"}, "products": []}

    kb_str = json.dumps(kb, ensure_ascii=False, indent=2)

    system_prompt = f"""Bạn là Nhân viên Sale xuất sắc của cửa hàng Nhật Bản.
CƠ SỞ DỮ LIỆU SẢN PHẨM HIỆN CÓ:
{kb_str}

QUY TẮC PHẢN HỒI (RẤT QUAN TRỌNG):
1. Giao tiếp thân thiện: {kb.get('shop_info', {}).get('style', 'Dạ thưa, nhiệt tình chốt sale')}.
2. CÓ SẴN TRONG CSDL: HÃY BÁO GIÁ ĐÓ VÀ CHĂM SÓC KHÁCH.
3. KHÔNG CÓ TRONG CSDL (NGƯỜI DÙNG QUAN TÂM MÓN MỚI): 
   - Bắt buộc phải nhặt toàn bộ Tên Sản Phẩm mà khách vừa nhắc đến bỏ vào mảng "missing_products". Đây là lệnh tối cao. Bất kể đó là đồ điện tử, quần áo hay đồ gia dụng.
   - Phần `reply`, chỉ ghi ngắn gọn: "Dạ, món này hiện cửa hàng không có sẵn." (Để hệ thống tự động nối câu báo giá ở phía sau).
4. KHÔNG ĐƯỢC PHÉP CHÈN ICON/EMOJI NÀO VÀO CÂU KHI GIAO TIẾP VÀ TRẢ LỜI CHO KHÁCH HÀNG. ĐÂY LÀ QUY TẮC BẮT BUỘC.

BẮT BUỘC TRẢ VỀ JSON DUY NHẤT VỚI CẤU TRÚC:
{{
  "reply": "Câu trả lời của bạn, không chèn bất kì icon hoặc emoji nào",
  "missing_products": ["Tên món đồ lạ 1", "Tên món đồ lạ 2"] 
}}"""

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    response = client.models.generate_content(
        model='gemini-2.5-pro',
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.2,
        ),
    )
    
    try:
        data = parse_llm_json(response.text)
        return data["reply"], data.get("missing_products", [])
    except Exception as e:
        print("Lỗi parse JSON từ AI:", e)
        return response.text, []

def interactive_terminal_mode():
    """Chạy Terminal Console để test cơ chế tự học."""
    if not os.getenv("GEMINI_API_KEY") or "your_" in os.getenv("GEMINI_API_KEY"):
        print("LỖI NGHIÊM TRỌNG: Chưa tìm thấy GEMINI_API_KEY!")
        return

    init_db()
    print("=========================================================")
    print("CHẾ ĐỘ TEST BOT: AUTO-FILLING DATABASE & WEB SEARCH")
    print("Thử gọi tên một Sản phẩm chưa hề có trong file JSON nhé!")
    print("Gõ 'exit' hoặc 'quit' để thoát.")
    print("=========================================================\n")
    
    while True:
        user_input = input("Bạn (Khách hàng): ")
        if user_input.lower() in ['exit', 'quit']:
            print("Đã thoát.")
            break
            
        print("Bot đang kiểm tra DB Local...")
        reply, missing_products = generate_reply(user_input)
        
        final_reply = reply
        
        # LUỒNG XỬ LÝ SẢN PHẨM LẠ (CHƯA CÓ TRONG DATA)
        if missing_products:
            for product in missing_products:
                # 1. AI Search Nhật Bản
                temp_price_info, price_jpy, price_vnd = search_product_japan(product)
                
                # 2. Xây dựng Reply thông minh không để mất khách
                final_reply += (f"\n\n(Tự động bổ sung thông tin) Dạ, riêng món '{product}', "
                                f"hiện bên Nhật đang có giá khoảng: {temp_price_info}. "
                                f"Để chính xác nhất về phí vận chuyển và tình trạng hàng, "
                                f"em đã báo bên kho check với nhà cung cấp. Chút nữa em sẽ báo lại ngay cho anh/chị nhé!")
                
                # 3. Auto-filling: Ghi đè vào DB ngay lập tức
                add_product_to_local_db(product, temp_price_info)
                
                # 4. Ghi nhận thành một "Order/Report" để admin quản lý
                save_order(product, price_jpy, price_vnd)
                
            # Đưa thông tin vào hàng đợi SQLite để người quản lý sau đó báo giá nét
            save_missing_products(missing_products, user_input)
            print("[HẾT THỐNG]: Đã lưu yêu cầu vào Queue 'Chờ xác nhận'.\n")
            
        print(f"Bot (Nhân viên Sale): {final_reply}\n")

if __name__ == "__main__":
    interactive_terminal_mode()
