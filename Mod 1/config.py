import os
from pathlib import Path

# Base workspace path
BASE_DIR = Path(__file__).resolve().parent

# Gemini API Configurations
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash")

# Neo4j Graph Database Configurations
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

# Directory watcher settings
WATCHED_DIR = Path(os.getenv("WATCHED_DIR", str(BASE_DIR / "watched_folder")))
WATCHED_DIR.mkdir(parents=True, exist_ok=True)

# Qdrant local database settings
QDRANT_DIR = Path(os.getenv("QDRANT_DIR", str(BASE_DIR / "qdrant_db")))
QDRANT_DIR.mkdir(parents=True, exist_ok=True)

print(f"Configurations Loaded:")
print(f"  Gemini Model: {GEMINI_MODEL}")
print(f"  Watched Folder: {WATCHED_DIR}")
print(f"  Qdrant DB Path: {QDRANT_DIR}")
print(f"  Neo4j URI: {NEO4J_URI}")
