import os
import shutil
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "knowledge_graph.db"
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUTS_DIR = BASE_DIR / "outputs"

print("CLEARING ALL PIPELINE DATA & DATABASE RECORDS...")

# 1. Clear Database Tables via SQL (safe for Windows sharing locks)
if DB_PATH.exists():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get all table names in the database
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        
        for t in tables:
            try:
                cursor.execute(f"DELETE FROM {t};")
                print(f"  [DB] Cleared SQLite table: {t}")
            except Exception as e:
                print(f"  [DB] Warning: Could not clear table {t}: {e}")
                
        cursor.execute("VACUUM;")
        conn.commit()
        conn.close()
        print("  [DB] SQLite database vacuumed and compacted.")
    except Exception as e:
        print(f"  [DB] Database connection error: {e}")

# 2. Clear Uploaded Documents
if UPLOAD_DIR.exists():
    for f in UPLOAD_DIR.iterdir():
        if f.is_file():
            try:
                f.unlink()
                print(f"  [File] Deleted upload file: {f.name}")
            except Exception as e:
                print(f"  [File] Failed to delete upload {f.name}: {e}")

# 3. Clear Outputs Logs
for sub in ["queries", "mindmaps", "flowcharts"]:
    sub_dir = OUTPUTS_DIR / sub
    if sub_dir.exists():
        for f in sub_dir.iterdir():
            if f.is_file():
                try:
                    f.unlink()
                    print(f"  [File] Deleted output log: outputs/{sub}/{f.name}")
                except Exception as e:
                    print(f"  [File] Failed to delete output {sub}/{f.name}: {e}")

print("RESET COMPLETE! ALL DATA CLEARED SUCCESSFULLY.")
