import os
import time
import json
import threading
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import config
from parsers import route_and_extract
from graph_db import graph_db, normalize_tag
from vector_db import vector_db

REGISTRY_FILE = config.BASE_DIR / "processed_registry.json"

def read_registry() -> dict:
    if REGISTRY_FILE.exists():
        try:
            with open(REGISTRY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def write_registry(registry: dict):
    try:
        with open(REGISTRY_FILE, "w", encoding="utf-8") as f:
            json.dump(registry, f, indent=2)
    except Exception as e:
        print(f"Failed to write processed registry: {e}")

def get_file_signature(file_path: str) -> dict:
    """Returns path, size, and modification time of file to check for updates."""
    stat = os.stat(file_path)
    return {
        "size": stat.st_size,
        "mtime": stat.st_mtime
    }

def process_file(file_path: str) -> bool:
    """Main pipeline execution for a single file."""
    try:
        file_path = os.path.abspath(file_path)
        filename = os.path.basename(file_path)
        
        # Skip hidden/temporary files (like windows .~ or temporary files)
        if filename.startswith("~") or filename.startswith("."):
            return False
            
        # Verify file size is not zero (wait for system copy)
        time.sleep(1.0)
        signature = get_file_signature(file_path)
        
        # Check against processed registry
        registry = read_registry()
        if file_path in registry:
            old_sig = registry[file_path]
            if old_sig["size"] == signature["size"] and old_sig["mtime"] == signature["mtime"]:
                print(f"File {filename} has already been ingested and not changed. Skipping.")
                return True
                
        print(f"\n======================================")
        print(f"Ingesting file: {file_path}")
        print(f"======================================")
        
        # 1. Parse and call Gemini
        doc_data = route_and_extract(file_path)
        if not doc_data or not doc_data["text_content"]:
            print(f"Extraction failed or empty for file: {filename}")
            return False
            
        doc_id = filename  # Use filename as unique identifier
        doc_type = doc_data["type"]
        text_content = doc_data["text_content"]
        entities = doc_data["entities"]
        
        # 2. Store document metadata and entities in Graph DB
        print("Upserting Document and entities into Knowledge Graph...")
        graph_db.upsert_document(
            doc_id=doc_id,
            filename=filename,
            doc_type=doc_type,
            source_path=file_path
        )
        
        related_node_ids = []
        if entities:
            # Upsert detailed entities
            graph_db.upsert_entities(doc_id, entities, doc_type)
            
            # Aggregate node IDs for Vector index references
            for eq in entities.equipment_tags:
                norm = normalize_tag(eq.tag)
                if norm and norm not in related_node_ids:
                    related_node_ids.append(norm)
            for reg in entities.regulatory_references:
                if reg.ref_code and reg.ref_code not in related_node_ids:
                    related_node_ids.append(reg.ref_code.strip().upper())
                    
        # 3. Store chunks and embeddings in Vector DB
        print("Chunking and upserting into Vector Database...")
        vector_db.store_document_chunks(
            doc_id=doc_id,
            text=text_content,
            related_node_ids=related_node_ids
        )
        
        # 4. Save to registry
        registry[file_path] = signature
        write_registry(registry)
        
        print(f"Finished ingesting {filename} successfully!")
        return True
        
    except Exception as e:
        print(f"Error processing file {file_path}: {e}")
        import traceback
        traceback.print_exc()
        return False

class IngestionHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory:
            print(f"Folder watcher detected file creation: {event.src_path}")
            process_file(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            print(f"Folder watcher detected file modification: {event.src_path}")
            process_file(event.src_path)

class DirectoryWatcher:
    def __init__(self):
        self.watch_dir = str(config.WATCHED_DIR)
        self.event_handler = IngestionHandler()
        self.observer = Observer()
        self.is_running = False

    def start(self):
        if self.is_running:
            return
        print(f"Starting directory watcher on folder: {self.watch_dir}")
        self.observer.schedule(self.event_handler, path=self.watch_dir, recursive=False)
        self.observer.start()
        self.is_running = True
        
        # Run an initial scan of any files already in the folder
        threading.Thread(target=self.run_initial_scan, daemon=True).start()

    def run_initial_scan(self):
        print("Running initial directory scan for new/changed documents...")
        try:
            for root, _, files in os.walk(self.watch_dir):
                for filename in files:
                    file_path = os.path.join(root, filename)
                    ext = os.path.splitext(filename)[1].lower()
                    if ext in [".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".xls", ".csv", ".eml", ".txt"]:
                        process_file(file_path)
        except Exception as e:
            print(f"Error during initial directory scan: {e}")

    def stop(self):
        if not self.is_running:
            return
        print("Stopping directory watcher...")
        self.observer.stop()
        self.observer.join()
        self.is_running = False

# Global instance of watcher
watcher = DirectoryWatcher()

if __name__ == "__main__":
    watcher.start()
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        watcher.stop()
