"""
Standalone Data Purge & Cache Reset Utility Script.
Clears all SQLite database records, uploaded files, generated mindmaps/flowcharts,
vector store caches, and Next.js build cache.
"""

import os
import shutil
import sqlite3
import sys

# Ensure UTF-8 output encoding for Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def clear_all_data():
    project_root = os.path.dirname(os.path.abspath(__file__))
    print("=== Starting System Data Purge ===")
    print(f"Target Directory: {project_root}\n")

    # 1. Reset SQLite Database (ML MODELS/Md 1/backend/knowledge_graph.db)
    db_path = os.path.join(project_root, 'ML MODELS', 'Md 1', 'backend', 'knowledge_graph.db')
    if os.path.exists(db_path):
        print(f"[1/4] Resetting SQLite Database: {db_path}")
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            tables = [
                'node_documents', 'edge_documents', 'extracted_entities', 
                'edges', 'nodes', 'chunks', 'documents', 'queries', 'visualizations'
            ]
            for table in tables:
                cursor.execute(f"DELETE FROM {table};")
            conn.commit()
            conn.close()
            print("  [OK] All database tables successfully emptied.")
        except Exception as e:
            print(f"  [ERROR] Database reset failed: {e}")
    else:
        print(f"[1/4] SQLite Database not found at: {db_path}")

    # 2. Clear Uploads and Output Directories
    print("\n[2/4] Clearing Uploads & Generated Output Files...")
    backend_dir = os.path.join(project_root, 'ML MODELS', 'Md 1', 'backend')
    target_dirs = [
        os.path.join(backend_dir, 'uploads'),
        os.path.join(backend_dir, 'outputs', 'mindmaps'),
        os.path.join(backend_dir, 'outputs', 'flowcharts'),
        os.path.join(backend_dir, 'outputs', 'queries'),
    ]

    for t_dir in target_dirs:
        if os.path.exists(t_dir):
            cleared_count = 0
            for item in os.listdir(t_dir):
                item_path = os.path.join(t_dir, item)
                try:
                    if os.path.isfile(item_path):
                        os.remove(item_path)
                        cleared_count += 1
                    elif os.path.isdir(item_path):
                        shutil.rmtree(item_path)
                        cleared_count += 1
                except Exception as e:
                    print(f"  [ERROR] Failed to delete {item_path}: {e}")
            print(f"  [OK] Cleared {cleared_count} item(s) from {os.path.relpath(t_dir, project_root)}")

    # 3. Clear Vector Store and JSON Caches
    print("\n[3/4] Searching for vector store caches...")
    cache_count = 0
    for root, dirs, files in os.walk(project_root):
        if '.venv' in root or 'node_modules' in root:
            continue
        for file in files:
            if file.endswith('_vector_store.json') or file.endswith('_cache.json'):
                fp = os.path.join(root, file)
                try:
                    os.remove(fp)
                    cache_count += 1
                except Exception as e:
                    print(f"  [ERROR] Failed to remove {fp}: {e}")
    print(f"  [OK] Cleared {cache_count} vector/JSON cache file(s).")

    # 4. Clear Frontend Next.js Build Cache (.next)
    print("\n[4/4] Removing Frontend Build Cache (.next)...")
    next_dir = os.path.join(project_root, 'frontend', '.next')
    if os.path.exists(next_dir):
        try:
            shutil.rmtree(next_dir)
            print("  [OK] Frontend .next build cache successfully removed.")
        except Exception as e:
            print(f"  [WARN] Could not remove .next directory (may be locked by active dev server): {e}")
    else:
        print("  [OK] Frontend build cache is already clean.")

    print("\n==========================================")
    print(" [OK] PURGE COMPLETE: System reset to zero data state!")
    print("==========================================")

if __name__ == '__main__':
    clear_all_data()

    
