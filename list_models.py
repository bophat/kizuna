import os
import requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key or "your_" in api_key:
    print("NO VALID API KEY")
    exit(1)

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
r = requests.get(url)

if r.status_code == 200:
    data = r.json()
    print("CÁC MODEL HỖ TRỢ TRÊN TÀI KHOẢN CỦA BẠN:")
    for m in data.get('models', []):
        if 'generateContent' in m.get('supportedGenerationMethods', []):
            print(f"- {m['name'].replace('models/', '')}")
else:
    print("LỖI KHI GỌI API:")
    print(r.status_code, r.text)
