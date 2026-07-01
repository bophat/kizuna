import os
import requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

url_list = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
r = requests.get(url_list)
models = []
if r.status_code == 200:
    for m in r.json().get('models', []):
        if 'generateContent' in m.get('supportedGenerationMethods', []):
            models.append(m['name'])

print("Đang test các model xem model nào thực sự có Quota (Limit > 0)...")
valid_models = []
for model_name in models:
    url_gen = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": "Hello"}]}]}
    res = requests.post(url_gen, json=payload)
    if res.status_code == 200:
        print(f"✅ {model_name} - HOẠT ĐỘNG TỐT!")
        valid_models.append(model_name)
    else:
        err = res.json()
        print(f"❌ {model_name} - LỖI: {res.status_code}")

print(f"\nTổng kết: Có {len(valid_models)} model sử dụng được.")
