import re

with open("chatbot.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace Imports
content = content.replace(
    "from langchain_google_genai import ChatGoogleGenerativeAI\nfrom langchain.schema import HumanMessage, SystemMessage\nfrom duckduckgo_search import DDGS",
    "import requests\nfrom google import genai\nfrom google.genai import types"
)

# Search Product
old_search = """def search_product_japan(product_name):
    \"\"\"
    Sử dụng Web Search (DuckDuckGo - miễn phí, nhanh, không cần setup API)
    Tìm kiếm thông tin sản phẩm và dùng Gemini tóm tắt lấy mức giá Nhật.
    \"\"\"
    print(f"🔍 [HỆ THỐNG]: Món này lạ, Bot tự động đi tìm kiếm '{product_name}' trên web Nhật...")
    try:
        query = f"{product_name} giá Nhật Bản kakaku amazon rakuten"
        results = DDGS().text(query, max_results=3)
        if not results:
            return "Chưa tra cứu được giá thị trường ngay lúc này", "N/A", "N/A"
            
        search_context = "\\n".join([f"- {res['title']}: {res['body']}" for res in results])
        
        # Sử dụng LLM tóm tắt ngắn thông tin giá từ kết quả tìm kiếm
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-pro",  
            temperature=0.1, 
            api_key=os.getenv("GEMINI_API_KEY")
        )
        prompt = f\"\"\"
Bạn là AI hỗ trợ thu thập dữ liệu giá cả từ web. Xem các kết quả sau khi tìm kiếm '{product_name}' tại Nhật:
{search_context}

CHỈ tóm tắt DUY NHẤT mức giá tham khảo (đổi qua VNĐ nếu có thể, ước lượng 1 JPY = 165 VNĐ) và tối đa 1 dòng mô tả ngắn. 
Tuyệt đối không giải thích dài dòng hay chào hỏi. Nếu không tìm thấy giá rõ ràng, hãy trả lời theo mẫu.

BẮT BUỘC TRẢ VỀ ĐÚNG MỘT KHỐI JSON DUY NHẤT NHƯ SAU:
{{
  "reply": "Giá tham khảo bên Nhật khoảng ...",
  "price_jpy": "Số tiền JPY hoặc N/A",
  "price_vnd": "Số tiền VNĐ hoặc N/A"
}}
\"\"\"
        response = llm.invoke([HumanMessage(content=prompt)])
        data = parse_llm_json(response.content)
        
        return data.get("reply", "Chưa có thông tin giá rõ ràng"), data.get("price_jpy", "N/A"), data.get("price_vnd", "N/A")
    except Exception as e:
        print(f"❌ [HỆ THỐNG]: Lỗi tìm kiếm web: {e}")
        return "Chưa có thông tin giá rõ ràng", "N/A", "N/A"
"""

new_search = """def search_product_japan(product_name):
    \"\"\"
    Sử dụng Web Search (Google Serper API)
    Tìm kiếm thông tin sản phẩm và dùng Gemini tóm tắt lấy mức giá Nhật.
    \"\"\"
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
        
        # Sử dụng LLM tóm tắt ngắn thông tin giá từ kết quả tìm kiếm
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        prompt = f\"\"\"
Bạn là AI hỗ trợ thu thập dữ liệu giá cả từ web. Xem các kết quả sau khi tìm kiếm '{product_name}' tại Nhật:
{search_context}

CHỈ tóm tắt DUY NHẤT mức giá tham khảo (đổi qua VNĐ nếu có thể, ước lượng 1 JPY = 165 VNĐ) và tối đa 1 dòng mô tả ngắn. 
Tuyệt đối không giải thích dài dòng hay chào hỏi. Nếu không tìm thấy giá rõ ràng, hãy trả lời theo mẫu.

BẮT BUỘC TRẢ VỀ ĐÚNG MỘT KHỐI JSON DUY NHẤT NHƯ SAU. TUYỆT ĐỐI KHÔNG DÙNG ICON/EMOJI NÀO:
{{
  "reply": "Giá tham khảo bên Nhật khoảng ...",
  "price_jpy": "Số tiền JPY hoặc N/A",
  "price_vnd": "Số tiền VNĐ hoặc N/A"
}}
\"\"\"
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
"""

content = content.replace(old_search, new_search)

# Generate Reply
old_gen = """        kb_str = json.dumps(kb, ensure_ascii=False, indent=2)

    system_prompt = f\"\"\"
Bạn là Nhân viên Sale xuất sắc của cửa hàng Nhật Bản.
CƠ SỞ DỮ LIỆU SẢN PHẨM HIỆN CÓ:
{kb_str}

QUY TẮC PHẢN HỒI (RẤT QUAN TRỌNG):
1. Giao tiếp thân thiện: {kb.get('shop_info', {}).get('style', 'Dạ thưa, nhiệt tình chốt sale')}.
2. CÓ SẴN TRONG CSDL: HÃY BÁO GIÁ ĐÓ VÀ CHĂM SÓC KHÁCH.
3. KHÔNG CÓ TRONG CSDL (NGƯỜI DÙNG QUAN TÂM MÓN MỚI): 
   - Bắt buộc phải nhặt toàn bộ Tên Sản Phẩm mà khách vừa nhắc đến bỏ vào mảng "missing_products". Đây là lệnh tối cao. Bất kể đó là đồ điện tử, quần áo hay đồ gia dụng.
   - Phần `reply`, chỉ ghi ngắn gọn: "Dạ, món này hiện cửa hàng không có sẵn." (Để hệ thống tự động nối câu báo giá ở phía sau).

BẮT BUỘC TRẢ VỀ JSON DUY NHẤT VỚI CẤU TRÚC:
{{
  "reply": "Câu trả lời của bạn",
  "missing_products": ["Tên món đồ lạ 1", "Tên món đồ lạ 2"] 
}}
\"\"\"

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-pro",  
        temperature=0.2, 
        api_key=os.getenv("GEMINI_API_KEY")
    )
    
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message)
    ]
    
    response = llm.invoke(messages)
    
    try:
        data = parse_llm_json(response.content)
        return data["reply"], data.get("missing_products", [])
    except Exception as e:
        print("Lỗi parse JSON từ AI:", e)
        return response.content, []"""

new_gen = """        kb_str = json.dumps(kb, ensure_ascii=False, indent=2)

    system_prompt = f\"\"\"
Bạn là Nhân viên Sale xuất sắc của cửa hàng Nhật Bản.
CƠ SỞ DỮ LIỆU SẢN PHẨM HIỆN CÓ:
{kb_str}

QUY TẮC PHẢN HỒI (RẤT QUAN TRỌNG):
1. Giao tiếp thân thiện: {kb.get('shop_info', {}).get('style', 'Dạ thưa, nhiệt tình chốt sale')}.
2. CÓ SẴN TRONG CSDL: HÃY BÁO GIÁ ĐÓ VÀ CHĂM SÓC KHÁCH.
3. KHÔNG CÓ TRONG CSDL (NGƯỜI DÙNG QUAN TÂM MÓN MỚI): 
   - Bắt buộc phải nhặt toàn bộ Tên Sản Phẩm mà khách vừa nhắc đến bỏ vào mảng "missing_products". Đây là lệnh tối cao. Bất kể đó là đồ điện tử, quần áo hay đồ gia dụng.
   - Phần `reply`, chỉ ghi ngắn gọn: "Dạ, món này hiện cửa hàng không có sẵn." (Để hệ thống tự động nối câu báo giá ở phía sau).
4. LỆNH CẤM (TUYỆT ĐỐI): Không được dùng bất kì emoji / icon nào trong câu chữ trả lời. Cấm sử dụng icon.

BẮT BUỘC TRẢ VỀ JSON DUY NHẤT VỚI CẤU TRÚC:
{{
  "reply": "Câu trả lời của bạn (TUYỆT ĐỐI KHÔNG CÓ ICON/EMOJI)",
  "missing_products": ["Tên món đồ lạ 1", "Tên món đồ lạ 2"] 
}}
\"\"\"

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
        return response.text, []"""

content = content.replace(old_gen, new_gen)

# Remove any remaining emojis
icons = ["❌ ", "🔍 ", "📝 ", "✅ ", "🚀 ", "👋 ", "⏳ ", "🧑 ", "🤖 ", "🔔 "]
for icon in icons:
    content = content.replace(icon, "")

with open("chatbot.py", "w", encoding="utf-8") as f:
    f.write(content)
