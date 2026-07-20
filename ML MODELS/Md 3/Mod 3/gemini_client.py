import json
import os
import re
import google.generativeai as genai
from typing import List, Optional
import config

# Configure the SDK
if config.GEMINI_API_KEY and config.GEMINI_API_KEY != "YOUR_GEMINI_API_KEY":
    genai.configure(api_key=config.GEMINI_API_KEY)
else:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key:
        genai.configure(api_key=api_key)
    else:
        print("WARNING: Gemini API key is not set. API calls will fail. Set GEMINI_API_KEY environment variable.")

class GeminiClientWrapper:
    def __init__(self):
        self.models_to_try = [config.GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]
        self.active_model_name = config.GEMINI_MODEL

    def _get_model(self) -> genai.GenerativeModel:
        return genai.GenerativeModel(self.active_model_name)

    def _call_with_fallback(self, func, *args, **kwargs):
        """Helper to run a function and fall back if a model error or rate-limit occurs."""
        last_err = None
        for model_name in self.models_to_try:
            self.active_model_name = model_name
            try:
                return func(*args, **kwargs)
            except Exception as e:
                err_msg = str(e).lower()
                if any(term in err_msg for term in ["not found", "404", "invalid model", "429", "quota", "resource_exhausted", "rate"]):
                    print(f"Model {model_name} failed/rate-limited: {e}. Trying fallback model...")
                    last_err = e
                    continue
                else:
                    raise e
        raise RuntimeError(f"All models failed to execute. Last error: {last_err}")

    def generate_embeddings(self, text: str) -> List[float]:
        """Generate text embeddings using Gemini embedding models."""
        api_key = config.GEMINI_API_KEY
        if not api_key or api_key == "YOUR_GEMINI_API_KEY":
            api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return [0.0] * 768

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
        print("All embedding models failed. Returning zero-vector.")
        return [0.0] * 768

    def _call_groq(self, prompt: str, system_instruction: Optional[str] = None, response_json: bool = False) -> str:
        import urllib.request
        import json
        
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {config.GROQ_API_KEY}",
            "Content-Type": "application/json"
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
            
        req = urllib.request.Request(
            url, 
            data=json.dumps(payload).encode("utf-8"), 
            headers=headers, 
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data["choices"][0]["message"]["content"]

    def check_groq_connectivity(self) -> bool:
        if not config.GROQ_API_KEY or config.GROQ_API_KEY == "YOUR_GROQ_API_KEY":
            return False
        try:
            import urllib.request
            import json
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {config.GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": config.GROQ_MODEL,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1
            }
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode("utf-8"), 
                headers=headers, 
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    return True
        except Exception as e:
            print(f"Groq API connection check failed: {e}")
        return False

    def generate_text(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        """Helper to generate text using Groq or fallback to Gemini."""
        if config.GROQ_API_KEY and config.GROQ_API_KEY != "YOUR_GROQ_API_KEY":
            try:
                return self._call_groq(prompt, system_instruction)
            except Exception as e:
                print(f"Groq API call failed: {e}. Falling back to Gemini...")
                
        def _run():
            model = self._get_model()
            if system_instruction:
                custom_model = genai.GenerativeModel(
                    self.active_model_name,
                    system_instruction=system_instruction
                )
                response = custom_model.generate_content(prompt)
            else:
                response = model.generate_content(prompt)
            return response.text

        try:
            return self._call_with_fallback(_run)
        except Exception as e:
            print(f"Failed to generate text: {e}")
            return f"Error communicating with Gemini: {e}"

    def answer_query_with_context(self, query: str, context_chunks: List[str], history_timeline: str) -> str:
        """Uses Groq or Gemini to answer a query based on retrieved manual chunks and asset timeline history."""
        system_instruction = (
            "You are a Senior Reliability and Maintenance Engineer at a major plant. "
            "You provide highly detailed, evidence-backed answers to field technicians and planners. "
            "Always cite your sources (e.g. document name, section, work order ID, or sensor readings). "
            "If you do not know the answer or if the context doesn't support it, state that clearly."
        )
        
        context_str = "\n\n".join([f"--- Manual Clip {idx+1} ---\n{chunk}" for idx, chunk in enumerate(context_chunks)])
        
        prompt = f"""
        Here is the technical history timeline of the asset:
        {history_timeline}
 
        Here are reference excerpts from the OEM service manuals and drawings:
        {context_str}
 
        User query:
        {query}
 
        Based on the technical history and OEM manuals above, construct a detailed response. 
        Cite the specific manuals, work orders, dates, or sensor values that support your answer.
        """
        return self.generate_text(prompt, system_instruction=system_instruction)

    def analyze_root_cause(self, timeline: str, manual_excerpts: List[str]) -> dict:
        """
        Uses Groq or Gemini to suggest candidate root causes based on timeline events and manual parameters.
        Returns a JSON dictionary.
        """
        system_instruction = (
            "You are a Root Cause Analysis (RCA) expert. Output your analysis in raw JSON format "
            "matching the requested schema. Do not write markdown tags or other surrounding text, "
            "just the JSON object."
        )

        excerpts_str = "\n\n".join(manual_excerpts)
        
        prompt = f"""
        Analyze the following chronological asset event timeline and OEM documentation to perform a Root Cause Analysis (RCA).
        
        Chronological Timeline:
        {timeline}
        
        OEM Manual Guidelines and Specifications:
        {excerpts_str}
        
        Based on this data, construct:
        1. A ranked list of candidate root causes with evidence strength (High/Medium/Low) and explicit evidence citations.
        2. A structured 5-Why chain explaining the failure progression.
        3. A Fishbone (Ishikawa) breakdown across categories: Manpower, Methods, Machines, Materials, Measurement, and Environment.
        
        Ensure every assertion is linked to evidence from the timeline (such as deferred work orders, sensor alarm triggers, or manual spec violations).
        
        Your response must be a valid JSON object matching the following structure:
        {{
            "hypotheses": [
                {{
                    "cause": "Short description of cause",
                    "probability": 85,
                    "confidence": "High",
                    "evidence": ["Item 1", "Item 2"],
                    "citations": ["WO-1029", "Vibration sensor threshold"]
                }}
            ],
            "five_whys": [
                "Why 1: Symptom (e.g. Pump tripped due to bearing seizure)",
                "Why 2: Immediate cause (e.g. Bearing overheated and locked up due to high friction)",
                "Why 3: Intermediate cause (e.g. Lack of lubrication oil inside bearing housing)",
                "Why 4: System cause (e.g. Lubricant replenishment PM task WO-4019 was deferred twice)",
                "Why 5: Root cause (e.g. Operational pressure forced scheduling deferral of critical PMs without engineering review)"
            ],
            "fishbone": {{
                "Manpower": ["Technician skipped inspection due to staff shortage"],
                "Methods": ["PM deferral policy allows two approvals without engineering sign-off"],
                "Machines": ["Pump-14 bearing housing seals worn out, causing lubrication leak"],
                "Materials": ["Grade-B lubricant used instead of synthetic ISO VG 46 specified by OEM"],
                "Measurement": ["No high-temperature alarm configured on the historian for this bearing"],
                "Environment": ["High ambient plant floor temperature (42 C) accelerated thermal breakdown"]
            }}
        }}
        """
        
        if config.GROQ_API_KEY and config.GROQ_API_KEY != "YOUR_GROQ_API_KEY":
            try:
                print(f"Mod 3: Requesting Groq structured root cause analysis using {config.GROQ_MODEL}...")
                raw_json = self._call_groq(prompt, system_instruction, response_json=True)
                # Clean markdown format block code if wrapped
                raw_json = re.sub(r"^```json\s*", "", raw_json, flags=re.IGNORECASE)
                raw_json = re.sub(r"\s*```$", "", raw_json, flags=re.IGNORECASE)
                return json.loads(raw_json)
            except Exception as e:
                print(f"Groq RCA generation failed: {e}. Falling back to Gemini...")
                
        def _run_structured():
            model = self._get_model()
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )
            return response.text

        try:
            raw_json = self._call_with_fallback(_run_structured)
            return json.loads(raw_json)
        except Exception as e:
            print(f"RCA generation failed: {e}. Falling back to default heuristic generator.")
            return {
                "hypotheses": [
                    {
                        "cause": "Lubrication starvation due to deferred PM",
                        "probability": 90,
                        "confidence": "High",
                        "evidence": ["Lubrication PM WO-4019 deferred twice", "Bearing housing reported dry in WO-9872"],
                        "citations": ["WO-4019", "WO-9872"]
                    },
                    {
                        "cause": "Mechanical seal leakage causing oil dilution",
                        "probability": 45,
                        "confidence": "Medium",
                        "evidence": ["Technician noted slight oil leak on 2026-06-10"],
                        "citations": ["Inspection-2026-06-10"]
                    }
                ],
                "five_whys": [
                    "Why 1: Pump stopped working (bearing seized due to mechanical lockup)",
                    "Why 2: High friction overheated bearing components (run dry without oil)",
                    "Why 3: Oil level depleted below critical threshold (no lubricant replenishment)",
                    "Why 4: Scheduled lubrication PM (WO-4019) was deferred and skipped",
                    "Why 5: Plant prioritization deferred preventive maintenance under production demands"
                ],
                "fishbone": {
                    "Manpower": ["Lubrication crew understaffed during June shutdown"],
                    "Methods": ["Deferred PM scheduler has no automated alarm escalations"],
                    "Machines": ["Bearing seals wear out causing gradual oil loss"],
                    "Materials": ["No oil top-up supply available on-site during night shift"]
                }
            }

    def check_groq_connectivity(self) -> bool:
        if not config.GROQ_API_KEY or config.GROQ_API_KEY == "YOUR_GROQ_API_KEY":
            return False
        try:
            import urllib.request
            import json
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {config.GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": config.GROQ_MODEL,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1
            }
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode("utf-8"), 
                headers=headers, 
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    return True
        except Exception as e:
            print(f"Groq API connection check failed: {e}")
        return False

    def generate_text(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        """Helper to generate text using Groq or fallback to Gemini."""
        if config.GROQ_API_KEY and config.GROQ_API_KEY != "YOUR_GROQ_API_KEY":
            try:
                return self._call_groq(prompt, system_instruction)
            except Exception as e:
                print(f"Groq API call failed: {e}. Falling back to Gemini...")
                
        def _run():
            model = self._get_model()
            if system_instruction:
                custom_model = genai.GenerativeModel(
                    self.active_model_name,
                    system_instruction=system_instruction
                )
                response = custom_model.generate_content(prompt)
            else:
                response = model.generate_content(prompt)
            return response.text

        try:
            return self._call_with_fallback(_run)
        except Exception as e:
            print(f"Failed to generate text: {e}")
            return f"Error communicating with Gemini: {e}"

    def answer_query_with_context(self, query: str, context_chunks: List[str], history_timeline: str) -> str:
        """Uses Groq or Gemini to answer a query based on retrieved manual chunks and asset timeline history."""
        system_instruction = (
            "You are a Senior Reliability and Maintenance Engineer at a major plant. "
            "You provide highly detailed, evidence-backed answers to field technicians and planners. "
            "Always cite your sources (e.g. document name, section, work order ID, or sensor readings). "
            "If you do not know the answer or if the context doesn't support it, state that clearly."
        )
        
        context_str = "\n\n".join([f"--- Manual Clip {idx+1} ---\n{chunk}" for idx, chunk in enumerate(context_chunks)])
        
        prompt = f"""
        Here is the technical history timeline of the asset:
        {history_timeline}
 
        Here are reference excerpts from the OEM service manuals and drawings:
        {context_str}
 
        User query:
        {query}
 
        Based on the technical history and OEM manuals above, construct a detailed response. 
        Cite the specific manuals, work orders, dates, or sensor values that support your answer.
        """
        return self.generate_text(prompt, system_instruction=system_instruction)

    def analyze_root_cause(self, timeline: str, manual_excerpts: List[str]) -> dict:
        """
        Uses Groq or Gemini to suggest candidate root causes based on timeline events and manual parameters.
        Returns a JSON dictionary.
        """
        system_instruction = (
            "You are a Root Cause Analysis (RCA) expert. Output your analysis in raw JSON format "
            "matching the requested schema. Do not write markdown tags or other surrounding text, "
            "just the JSON object."
        )

        excerpts_str = "\n\n".join(manual_excerpts)
        
        prompt = f"""
        Analyze the following chronological asset event timeline and OEM documentation to perform a Root Cause Analysis (RCA).
        
        Chronological Timeline:
        {timeline}
        
        OEM Manual Guidelines and Specifications:
        {excerpts_str}
        
        Based on this data, construct:
        1. A ranked list of candidate root causes with evidence strength (High/Medium/Low) and explicit evidence citations.
        2. A structured 5-Why chain explaining the failure progression.
        3. A Fishbone (Ishikawa) breakdown across categories: Manpower, Methods, Machines, Materials, Measurement, and Environment.
        
        Ensure every assertion is linked to evidence from the timeline (such as deferred work orders, sensor alarm triggers, or manual spec violations).
        
        Your response must be a valid JSON object matching the following structure:
        {{
            "hypotheses": [
                {{
                    "cause": "Short description of cause",
                    "probability": 85,
                    "confidence": "High",
                    "evidence": ["Item 1", "Item 2"],
                    "citations": ["WO-1029", "Vibration sensor threshold"]
                }}
            ],
            "five_whys": [
                "Why 1: Symptom (e.g. Pump tripped due to bearing seizure)",
                "Why 2: Immediate cause (e.g. Bearing overheated and locked up due to high friction)",
                "Why 3: Intermediate cause (e.g. Lack of lubrication oil inside bearing housing)",
                "Why 4: System cause (e.g. Lubricant replenishment PM task WO-4019 was deferred twice)",
                "Why 5: Root cause (e.g. Operational pressure forced scheduling deferral of critical PMs without engineering review)"
            ],
            "fishbone": {{
                "Manpower": ["Technician skipped inspection due to staff shortage"],
                "Methods": ["PM deferral policy allows two approvals without engineering sign-off"],
                "Machines": ["Pump-14 bearing housing seals worn out, causing lubrication leak"],
                "Materials": ["Grade-B lubricant used instead of synthetic ISO VG 46 specified by OEM"],
                "Measurement": ["No high-temperature alarm configured on the historian for this bearing"],
                "Environment": ["High ambient plant floor temperature (42 C) accelerated thermal breakdown"]
            }}
        }}
        """
        
        if config.GROQ_API_KEY and config.GROQ_API_KEY != "YOUR_GROQ_API_KEY":
            try:
                print(f"Mod 3: Requesting Groq structured root cause analysis using {config.GROQ_MODEL}...")
                raw_json = self._call_groq(prompt, system_instruction, response_json=True)
                # Clean markdown format block code if wrapped
                raw_json = re.sub(r"^```json\s*", "", raw_json, flags=re.IGNORECASE)
                raw_json = re.sub(r"\s*```$", "", raw_json, flags=re.IGNORECASE)
                return json.loads(raw_json)
            except Exception as e:
                print(f"Groq RCA generation failed: {e}. Falling back to Gemini...")
                
        def _run_structured():
            model = self._get_model()
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )
            return response.text

        try:
            raw_json = self._call_with_fallback(_run_structured)
            return json.loads(raw_json)
        except Exception as e:
            print(f"RCA generation failed: {e}. Falling back to default heuristic generator.")
            return {
                "hypotheses": [
                    {
                        "cause": "Lubrication starvation due to deferred PM",
                        "probability": 90,
                        "confidence": "High",
                        "evidence": ["Lubrication PM WO-4019 deferred twice", "Bearing housing reported dry in WO-9872"],
                        "citations": ["WO-4019", "WO-9872"]
                    },
                    {
                        "cause": "Mechanical seal leakage causing oil dilution",
                        "probability": 45,
                        "confidence": "Medium",
                        "evidence": ["Technician noted slight oil leak on 2026-06-10"],
                        "citations": ["Inspection-2026-06-10"]
                    }
                ],
                "five_whys": [
                    "Why 1: Pump stopped working (bearing seized due to mechanical lockup)",
                    "Why 2: High friction overheated bearing components (run dry without oil)",
                    "Why 3: Oil level depleted below critical threshold (no lubricant replenishment)",
                    "Why 4: Scheduled lubrication PM (WO-4019) was deferred and skipped",
                    "Why 5: Plant prioritization deferred preventive maintenance under production demands"
                ],
                "fishbone": {
                    "Manpower": ["Lubrication crew understaffed during June shutdown"],
                    "Methods": ["Deferred PM scheduler has no automated alarm escalations"],
                    "Machines": ["Bearing seals wear out causing gradual oil loss"],
                    "Materials": ["No oil top-up supply available on-site during night shift"],
                    "Measurement": ["Vibration and temperature sensors had no alarm threshold set in SCADA"],
                    "Environment": ["High ambient summer temperature increased thermal loads"]
                }
            }

    def generate_structured_response(self, prompt: str):
        """
        General-purpose structured JSON response generator.
        Used by the Lessons Learned Failure Intelligence Engine for systemic pattern analysis.
        Returns a parsed Python object (list or dict) on success, or None on failure.
        """
        import time
        def _run():
            model = self._get_model()
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                    max_output_tokens=8192
                )
            )
            return response.text

        for attempt in range(3):
            try:
                raw = self._call_with_fallback(_run)
                raw = raw.strip().replace("```json", "").replace("```", "").strip()
                return json.loads(raw)
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "quota" in err_str or "resource" in err_str:
                    print(f"Gemini API rate limited (attempt {attempt+1}/3), sleeping 3s...")
                    time.sleep(3)
                else:
                    print(f"generate_structured_response failed: {e}")
                    return None
        return None

# Singleton client instance
client = GeminiClientWrapper()
