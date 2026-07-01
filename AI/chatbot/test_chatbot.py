import os
import requests
import google.generativeai as genai

# Load Gemini API Key
GEMINI_API_KEY = "AIzaSyD6-qZSrx2LvSVA0ZOD2m5vD5txkaF7Ki4"
genai.configure(api_key=GEMINI_API_KEY)

# Initialize Gemini Model
system_instruction = "You are Kenji, an expert Japanese artisan concierge for 'KIZUNA'. You are sophisticated, polite, and deeply knowledgeable about Japanese traditional crafts like Kintsugi, Hinoki woodwork, Ceramics, and Textiles. You specialize in bespoke requests. Keep your tone serene and premium. Note: We are a shop, you can verify requests and tell the customer you will forward it to our human artisans."

model = genai.GenerativeModel(
    model_name="gemini-2.5-flash",
    system_instruction=system_instruction
)

chat = model.start_chat(history=[])

print("==================================================")
print("🤖 BẮT ĐẦU TEST CHATBOT TRÊN TERMINAL")
print("==================================================")
print("Kenji: Chào bạn! Mình là Kizuna AI, chuyên viên tư vấn trực tuyến của shop. Cảm ơn bạn đã ghé thăm. Bạn đang quan tâm hoặc muốn tìm kiếm mặt hàng cụ thể nào, xin vui lòng để lại thông tin để mình có thể hỗ trợ và tư vấn nhanh nhất cho bạn ạ.")

session_id = "terminal_test_session"

while True:
    try:
        user_input = input("\nBạn: ")
        if user_input.lower() in ['exit', 'quit']:
            print("Đã thoát chat.")
            break
        if not user_input.strip():
            continue
            
        # Send user message to Admin (Flask Backend)
        try:
            requests.post('http://localhost:8080/api/concierge/message', json={
                "message": user_input,
                "session_id": session_id,
                "sender": "user"
            }, timeout=2)
        except requests.exceptions.RequestException:
            pass # Ignore if backend is not running

        # Get AI Response
        response = chat.send_message(user_input)
        ai_response = response.text
        
        print(f"\nKenji (AI): {ai_response}")
        
        # Send AI message to Admin
        try:
            requests.post('http://localhost:8080/api/concierge/message', json={
                "message": ai_response,
                "session_id": session_id,
                "sender": "ai"
            }, timeout=2)
        except requests.exceptions.RequestException:
            pass

    except KeyboardInterrupt:
        print("\nĐã thoát chat.")
        break
    except Exception as e:
        print(f"\nLỗi: {e}")
