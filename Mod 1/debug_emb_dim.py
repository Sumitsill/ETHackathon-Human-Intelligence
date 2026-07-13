import google.generativeai as genai
import config
genai.configure(api_key=config.GEMINI_API_KEY)

try:
    # Test gemini-embedding-2 with dimensionality parameter
    res = genai.embed_content(
        model="models/gemini-embedding-2",
        content="hello world",
        task_type="retrieval_document",
        output_dimensionality=768
    )
    vec = res["embedding"]
    print("Embedding size with output_dimensionality=768:", len(vec))
except Exception as e:
    print("Failed to embed with output_dimensionality:", e)
