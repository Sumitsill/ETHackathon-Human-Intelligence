import os
from pathlib import Path
from dotenv import load_dotenv

# Load env variables from a .env file
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "knowledge_graph.db"
UPLOAD_DIR = BASE_DIR / "uploads"

# Outputs folders
OUTPUTS_DIR = BASE_DIR / "outputs"
QUERIES_DIR = OUTPUTS_DIR / "queries"
MINDMAPS_DIR = OUTPUTS_DIR / "mindmaps"
FLOWCHARTS_DIR = OUTPUTS_DIR / "flowcharts"

# Ensure directories exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
for d in [OUTPUTS_DIR, QUERIES_DIR, MINDMAPS_DIR, FLOWCHARTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# API Keys and credentials
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GMAIL_CREDENTIALS_PATH = os.getenv("GMAIL_CREDENTIALS_PATH", str(BASE_DIR / "credentials.json"))
GMAIL_TOKEN_PATH = os.getenv("GMAIL_TOKEN_PATH", str(BASE_DIR / "token.json"))

# Setup genai configuration if key is available
if GEMINI_API_KEY:
    import google.generativeai as genai
    genai.configure(api_key=GEMINI_API_KEY)
