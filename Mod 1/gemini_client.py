import json
import io
import time
from typing import List, Optional, Tuple
import google.generativeai as genai
from pydantic import BaseModel, Field
from PIL import Image
import config

# Configure the SDK
genai.configure(api_key=config.GEMINI_API_KEY)

# Define schemas for structured LLM extraction.
# We do not use default or default_factory values to avoid the "Unknown field for Schema: default" error.
class EquipmentTag(BaseModel):
    tag: str = Field(description="Normalized tag code of the equipment, e.g. P-204, XV-101")
    name: str = Field(description="Name or description of the equipment, e.g. Feed Pump. Empty string if unknown.")
    context: str = Field(description="Direct text context where the equipment is mentioned. Empty string if unknown.")

class ProcessParameter(BaseModel):
    parameter: str = Field(description="Name of the parameter, e.g. discharge pressure, flow rate, temperature")
    value: str = Field(description="Value of the parameter with unit, e.g. 12 bar, 150 C, 50 m3/h")
    equipment_tag: str = Field(description="Associated equipment tag. Empty string if unknown or none.")

class RegulatoryReference(BaseModel):
    ref_code: str = Field(description="Standard code or reference clause, e.g. OISD-STD-118, OSHA 1910")
    context: str = Field(description="Direct text context where the regulation is mentioned. Empty string if unknown.")

class PersonnelEntity(BaseModel):
    name: str = Field(description="Name of the person")
    role: str = Field(description="Role or designation of the person, e.g. Inspector, Operator. Empty string if unknown.")

class DateEntity(BaseModel):
    date: str = Field(description="Date in YYYY-MM-DD format if possible, otherwise raw text date")
    context: str = Field(description="Context around the date. Empty string if unknown.")

class ExtractionResult(BaseModel):
    document_id: str = Field(description="The unique identifier or filename of the source document")
    equipment_tags: List[EquipmentTag] = Field(description="List of equipment tags mentioned")
    process_parameters: List[ProcessParameter] = Field(description="List of process parameters mentioned")
    regulatory_references: List[RegulatoryReference] = Field(description="List of regulatory references mentioned")
    personnel: List[PersonnelEntity] = Field(description="List of personnel mentioned")
    dates: List[DateEntity] = Field(description="List of dates mentioned")

class GeminiClientWrapper:
    def __init__(self):
        self.models_to_try = [config.GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        self.active_model_name = config.GEMINI_MODEL

    def _get_model(self, is_vision: bool = False) -> genai.GenerativeModel:
        return genai.GenerativeModel(self.active_model_name)

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

    def extract_entities_from_text(self, text: str, document_id: str) -> ExtractionResult:
        """Extract structured JSON entities from plain text content."""
        prompt = f"""
        Extract industrial and engineering entities from the following text according to the requested schema.
        Ensure equipment tags are normalized (e.g., lowercase/uppercase resolved, whitespaces removed if they refer to the same tag).
        If an entity category is not mentioned, return an empty list for that field. Do not include null values.
        
        Document ID: {document_id}
        
        Text to process:
        {text}
        """

        def run_extraction():
            model = self._get_model()
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=ExtractionResult,
                    temperature=0.1
                )
            )
            return response.text

        try:
            response_text = self._call_with_fallback(run_extraction)
            data = json.loads(response_text)
            data["document_id"] = document_id
            return ExtractionResult(**data)
        except Exception as e:
            print(f"Structured extraction failed: {e}. Returning empty extraction schema.")
            return ExtractionResult(
                document_id=document_id,
                equipment_tags=[],
                process_parameters=[],
                regulatory_references=[],
                personnel=[],
                dates=[]
            )

    def extract_entities_from_image(self, image_bytes: bytes, mime_type: str, document_id: str) -> ExtractionResult:
        """Vision LLM call to extract structured entities directly from scanned documents or drawings."""
        try:
            img = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            print(f"Failed to open image bytes: {e}")
            return self._empty_result(document_id)

        prompt = f"""
        You are an industrial engineer inspecting a P&ID blueprint, a scanned report, or a form.
        Analyze this image. Perform OCR to read all labels, titles, handwritten markings, and structures.
        Extract the following structured entities from the image according to the schema:
        - Equipment tags (like P-204, XV-101, etc.) along with their name and visible surrounding context.
        - Process parameters (pressures, flows, temperatures, settings).
        - Regulatory references or compliance clauses (OISD, PESO, OSHA, ISO, ASME).
        - Personnel names and roles mentioned in signatures or logs.
        - Dates.

        If a category is not mentioned, return an empty list for that field. Do not include null values.
        Document ID: {document_id}
        """

        def run_vision_extraction():
            model = self._get_model(is_vision=True)
            response = model.generate_content(
                [prompt, img],
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=ExtractionResult,
                    temperature=0.1
                )
            )
            return response.text

        try:
            response_text = self._call_with_fallback(run_vision_extraction)
            data = json.loads(response_text)
            data["document_id"] = document_id
            return ExtractionResult(**data)
        except Exception as e:
            print(f"Vision structured extraction failed: {e}. Returning empty extraction schema.")
            return self._empty_result(document_id)

    def generate_embeddings(self, text: str) -> List[float]:
        """Generate text embeddings using Gemini embedding models."""
        for model_name in ["models/gemini-embedding-2", "models/gemini-embedding-001"]:
            try:
                # Conditionally configure dimensionality for embedding-2 model
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

    def _empty_result(self, document_id: str) -> ExtractionResult:
        return ExtractionResult(
            document_id=document_id,
            equipment_tags=[],
            process_parameters=[],
            regulatory_references=[],
            personnel=[],
            dates=[]
        )

# Singleton client instance
client = GeminiClientWrapper()

if __name__ == "__main__":
    test_text = "Feed pump P-204 operates at a discharge pressure of 12 bar. Checked by Inspector Alice on 2026-07-13."
    res = client.extract_entities_from_text(test_text, "test_doc_01")
    print("Self Test Extraction Result:")
    print(res.model_dump_json(indent=2))
