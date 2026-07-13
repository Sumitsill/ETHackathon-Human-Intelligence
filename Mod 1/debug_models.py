import google.generativeai as genai
import config
genai.configure(api_key=config.GEMINI_API_KEY)

try:
    print("Available models:")
    for m in genai.list_models():
        if "embedContent" in m.supported_generation_methods:
            print(f"  Embedding model: {m.name}")
        elif "generateContent" in m.supported_generation_methods:
            print(f"  Generation model: {m.name}")
except Exception as e:
    print("Error listing models:", e)
