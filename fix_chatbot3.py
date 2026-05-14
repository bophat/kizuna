with open("chatbot.py", "r", encoding="utf-8") as f:
    code = f.read()

# Add imports if missing
if "from google import genai" not in code:
    code = code.replace("import os", "import os\nfrom google import genai\nfrom google.genai import types\nimport requests")

with open("chatbot.py", "w", encoding="utf-8") as f:
    f.write(code)
