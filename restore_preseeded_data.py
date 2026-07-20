import os
import shutil
import sqlite3
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(ROOT_DIR, "_backup_preseeded_data")
MANIFEST_PATH = os.path.join(BACKUP_DIR, "backup_manifest.json")

def restore_sqlite(src_path, dest_path):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    try:
        src_conn = sqlite3.connect(src_path)
        dest_conn = sqlite3.connect(dest_path)
        src_conn.backup(dest_conn)
        dest_conn.close()
        src_conn.close()
        print(f"[Restore] Restored SQLite DB via backup API: {dest_path}")
    except Exception as e:
        print(f"[Restore Warning] SQLite backup API failed: {e}. Falling back to file copy.")
        try:
            shutil.copy2(src_path, dest_path)
        except Exception as err:
            print(f"[Restore Error] Could not copy SQLite DB file: {err}")

def copytree_ignore_locks(src, dst):
    def _ignore(folder, files):
        return [f for f in files if f.endswith('.lock') or f == '.lock']
    if os.path.exists(dst):
        shutil.rmtree(dst, ignore_errors=True)
    shutil.copytree(src, dst, ignore=_ignore, dirs_exist_ok=True)

def main():
    print("=" * 75)
    print("        RESTORING PRE-SEEDED AND PRE-EXISTING DATA FROM BACKUP")
    print("=" * 75)
    
    if not os.path.exists(BACKUP_DIR) or not os.path.exists(MANIFEST_PATH):
        print(f"Error: Backup directory or manifest not found at {BACKUP_DIR}")
        sys.exit(1)
        
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    for item in manifest:
        rel_path = item["rel_path"]
        item_type = item["type"]
        
        src_abs = os.path.join(BACKUP_DIR, rel_path)
        dest_abs = os.path.join(ROOT_DIR, rel_path)
        
        if not os.path.exists(src_abs):
            print(f"[Skip] Backup item {rel_path} missing in backup directory.")
            continue
            
        print(f"Restoring: {rel_path} ({item_type})")
        
        if item_type == "file":
            os.makedirs(os.path.dirname(dest_abs), exist_ok=True)
            shutil.copy2(src_abs, dest_abs)
        elif item_type == "dir":
            copytree_ignore_locks(src_abs, dest_abs)
        elif item_type == "sqlite":
            restore_sqlite(src_abs, dest_abs)

    print("=" * 75)
    print("All pre-seeded data has been restored to its original state.")
    print("=" * 75)

if __name__ == "__main__":
    main()
