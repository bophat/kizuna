import re

with open("chatbot.py", "r", encoding="utf-8") as f:
    code = f.read()

# Replace LLM in generate_reply
generate_reply_pattern = r'    llm = ChatGoogleGenerativeAI\([\s\S]*?response = llm\.invoke\(messages\)'
new_generate_reply = """    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    response = client.models.generate_content(
        model='gemini-2.5-pro',
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.2,
        ),
    )"""

code = re.sub(generate_reply_pattern, new_generate_reply, code)

# Replace LLM in search_product_japan
search_product_pattern = r'        llm = ChatGoogleGenerativeAI\([\s\S]*?response = llm\.invoke\(\[HumanMessage\(content=prompt\)\]\)'
new_search_product = """        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model='gemini-2.5-pro',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
            ),
        )"""

code = re.sub(search_product_pattern, new_search_product, code)

# fix parse_llm_json arguments
code = code.replace("parse_llm_json(response.content)", "parse_llm_json(response.text)")
code = code.replace("return response.content, []", "return response.text, []")

# update system prompt in generate_reply to forbid icons
code = code.replace("""   - Phần `reply`, chỉ ghi ngắn gọn: "Dạ, món này hiện cửa hàng không có sẵn." (Để hệ thống tự động nối câu báo giá ở phía sau).""", """   - Phần `reply`, chỉ ghi ngắn gọn: "Dạ, món này hiện cửa hàng không có sẵn." (Để hệ thống tự động nối câu báo giá ở phía sau).
4. LỆNH CẤM: TUYỆT ĐỐI KHÔNG DÙNG BẤT CỨ BIỂU TƯỢNG CẢM XÚC/ICON NÀO TRONG VĂN BẢN (KHÔNG CÓ ICON/EMOJI NÀO!).""")


with open("chatbot.py", "w", encoding="utf-8") as f:
    f.write(code)

