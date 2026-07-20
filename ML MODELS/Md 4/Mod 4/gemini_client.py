import json
import os
import re
import urllib.request
from typing import Any, List, Optional
import config

SDK_AVAILABLE = False
genai = None

try:
    import google.generativeai as genai
    SDK_AVAILABLE = True
except Exception as e:
    print(f"WARNING: google.generativeai SDK not available due to DLL import error: {e}. Bypassing using REST direct API fallback.")
    SDK_AVAILABLE = False

if SDK_AVAILABLE and config.GEMINI_API_KEY and config.GEMINI_API_KEY != "YOUR_GEMINI_API_KEY":
    try:
        genai.configure(api_key=config.GEMINI_API_KEY)
    except Exception as e:
        print(f"Failed to configure Gemini SDK: {e}. Bypassing using REST direct API fallback.")
        SDK_AVAILABLE = False

class GeminiClientWrapper:
    def __init__(self):
        self.models_to_try = [config.GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        self.active_model_name = config.GEMINI_MODEL

    def _get_model(self) -> Optional[Any]:
        if SDK_AVAILABLE and genai:
            return genai.GenerativeModel(self.active_model_name)
        return None

    def _call_with_fallback(self, func, *args, **kwargs):
        """Helper to run a function and fall back if a model-not-found error occurs."""
        last_err = None
        for model_name in self.models_to_try:
            self.active_model_name = model_name
            try:
                return func(*args, **kwargs)
            except Exception as e:
                err_msg = str(e).lower()
                if "not found" in err_msg or "404" in err_msg or "invalid model" in err_msg:
                    print(f"Model {model_name} failed with error: {e}. Trying fallback...")
                    last_err = e
                    continue
                else:
                    raise e
        raise RuntimeError(f"All models failed to execute. Last error: {last_err}")

    def _generate_embeddings_rest(self, text: str) -> List[float]:
        """Fall back to direct HTTP call for embeddings if SDK is blocked."""
        model = "text-embedding-004"
        if not config.GEMINI_API_KEY or config.GEMINI_API_KEY == "YOUR_GEMINI_API_KEY":
            # Check environment variables
            api_key = os.environ.get("GEMINI_API_KEY", "")
        else:
            api_key = config.GEMINI_API_KEY

        if not api_key:
            return [0.0] * 768

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "model": f"models/{model}",
            "content": {
                "parts": [{"text": text}]
            }
        }
        
        try:
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode("utf-8"), 
                headers=headers, 
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                return res_data["embedding"]["values"]
        except Exception as e:
            print(f"Gemini REST Embedding failed: {e}. Returning zero vector.")
            return [0.0] * 768

    def generate_embeddings(self, text: str) -> List[float]:
        """Generate text embeddings using Gemini embedding models (SDK or REST)."""
        api_key = config.GEMINI_API_KEY
        if not api_key or api_key == "YOUR_GEMINI_API_KEY":
            api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return [0.0] * 768

        if not SDK_AVAILABLE or not genai:
            return self._generate_embeddings_rest(text)
            
        for model_name in ["models/gemini-embedding-2", "models/gemini-embedding-001"]:
            try:
                kwargs = {
                    "model": model_name,
                    "content": text,
                    "task_type": "retrieval_document"
                }
                if "embedding-2" in model_name:
                    kwargs["output_dimensionality"] = 768
                    
                result = genai.embed_content(**kwargs)
                return result["embedding"]
            except Exception as e:
                print(f"Embedding model {model_name} failed: {e}. Trying fallback...")
        
        return self._generate_embeddings_rest(text)

    def _call_groq(self, prompt: str, system_instruction: Optional[str] = None, response_json: bool = False) -> str:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {config.GROQ_API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": config.GROQ_MODEL,
            "messages": messages,
            "temperature": 0.1
        }
        if response_json:
            payload["response_format"] = {"type": "json_object"}
            
        import time
        last_err = None
        for attempt in range(3):
            try:
                req = urllib.request.Request(
                    url, 
                    data=json.dumps(payload).encode("utf-8"), 
                    headers=headers, 
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=15) as response:
                    res_data = json.loads(response.read().decode("utf-8"))
                    return res_data["choices"][0]["message"]["content"]
            except Exception as e:
                last_err = e
                # Check for rate limit or server error to back off
                if "429" in str(e) or "503" in str(e) or "500" in str(e):
                    sleep_time = (attempt + 1) * 3
                    print(f"Groq API call attempt {attempt+1} failed: {e}. Retrying in {sleep_time}s...")
                    time.sleep(sleep_time)
                else:
                    raise e
        raise last_err

    def _call_gemini_rest(self, prompt: str, system_instruction: Optional[str] = None, response_json: bool = False) -> str:
        """Call Gemini API via REST API direct call."""
        model = self.active_model_name
        if model.startswith("models/"):
            model = model[7:]
            
        if not config.GEMINI_API_KEY or config.GEMINI_API_KEY == "YOUR_GEMINI_API_KEY":
            api_key = os.environ.get("GEMINI_API_KEY", "")
        else:
            api_key = config.GEMINI_API_KEY
 
        if not api_key:
            return "Error: Gemini API Key is not set. Cannot run REST fallback."
 
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        
        contents = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        
        if system_instruction:
            contents["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }
            
        generation_config = {}
        if response_json:
            generation_config["responseMimeType"] = "application/json"
            
        if generation_config:
            contents["generationConfig"] = generation_config
            
        import time
        last_err = None
        for attempt in range(3):
            try:
                req = urllib.request.Request(
                    url, 
                    data=json.dumps(contents).encode("utf-8"), 
                    headers=headers, 
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=30) as response:
                    res_data = json.loads(response.read().decode("utf-8"))
                    return res_data["candidates"][0]["content"]["parts"][0]["text"]
            except Exception as e:
                last_err = e
                if "429" in str(e) or "503" in str(e) or "500" in str(e):
                    sleep_time = (attempt + 1) * 3
                    print(f"Gemini API direct REST attempt {attempt+1} failed: {e}. Retrying in {sleep_time}s...")
                    time.sleep(sleep_time)
                else:
                    break
        return f"Gemini direct REST call failed: {last_err}"

    def generate_text(self, prompt: str, system_instruction: Optional[str] = None, response_json: bool = False) -> str:
        """Helper to generate text using Groq with automatic fallback to direct Gemini REST if it fails."""
        if config.GROQ_API_KEY and config.GROQ_API_KEY != "YOUR_GROQ_API_KEY":
            try:
                return self._call_groq(prompt, system_instruction, response_json=response_json)
            except Exception as e:
                print(f"WARNING: Groq API call failed: {e}. Falling back to Gemini REST.")
        return self._call_gemini_rest(prompt, system_instruction, response_json=response_json)

    def analyze_compliance_text(self, prompt: str, system_instruction: str, response_json: bool = False) -> str:
        """Helper to query text generation for regulatory analysis."""
        return self.generate_text(prompt, system_instruction=system_instruction, response_json=response_json)

# Singleton client instance
client = GeminiClientWrapper()
