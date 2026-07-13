import os
import shutil
import time
import fitz  # PyMuPDF
import pandas as pd
from PIL import Image, ImageDraw
import config

# Attempt to import httpx for server testing
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

TEST_FILES_DIR = config.BASE_DIR / "test_sources"
TEST_FILES_DIR.mkdir(exist_ok=True)
API_URL = "http://127.0.0.1:8000"

def check_server_running() -> bool:
    if not HTTPX_AVAILABLE:
        return False
    try:
        response = httpx.get(f"{API_URL}/", timeout=1.0)
        return response.status_code == 200
    except Exception:
        return False

def create_test_pdf():
    pdf_path = TEST_FILES_DIR / "work_order_P204.pdf"
    doc = fitz.open()
    page = doc.new_page()
    text = """
    WORK ORDER: WO-9912
    Date: 2026-07-13
    Plant Operator: John Doe
    Equipment Tag: P-204 (Primary Feed Pump)
    Procedure: Annual Servicing and Calibration
    Status: Completed
    Findings: The discharge pressure of feed pump P-204 was recorded at 15 bar, which is higher than the recommended limit. Regulatory standard OISD-STD-118 was referenced for safety distance verification.
    Technician Signature: Alice Smith
    """
    page.insert_text((50, 50), text, fontsize=11)
    doc.save(str(pdf_path))
    doc.close()
    print(f"Created test PDF: {pdf_path}")
    return str(pdf_path)

def create_test_scan_image():
    image_path = TEST_FILES_DIR / "inspection_report_XV101.png"
    img = Image.new("RGB", (600, 400), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    lines = [
        "SAFETY INSPECTION LOG",
        "Date: 2026-07-12",
        "Inspector: Bob Johnson",
        "Equipment: XV-101 (Safety Control Valve)",
        "Condition: Operational - Pass",
        "Parameters: Max temp limit 120 C",
        "Comments: Valve XV-101 opens correctly on signal.",
        "PESO reference code: PESO-VALVE-REG"
    ]
    y = 30
    for line in lines:
        draw.text((30, y), line, fill=(0, 0, 0))
        y += 35
    img.save(str(image_path))
    print(f"Created test scan image: {image_path}")
    return str(image_path)

def create_test_pid_image():
    image_path = TEST_FILES_DIR / "pid_drawing_01.png"
    img = Image.new("RGB", (800, 600), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.line([(100, 300), (700, 300)], fill=(0, 0, 255), width=3)
    draw.line([(400, 300), (400, 500)], fill=(0, 0, 255), width=3)
    draw.rectangle([(250, 280), (300, 320)], outline=(255, 0, 0), width=2)
    draw.ellipse([(550, 270), (610, 330)], outline=(0, 128, 0), width=2)
    draw.text((120, 270), "PIPELINE FROM STORAGE", fill=(0, 0, 0))
    draw.text((255, 330), "VALVE XV-101", fill=(0, 0, 0))
    draw.text((560, 340), "PUMP P-204", fill=(0, 0, 0))
    draw.text((350, 520), "DRAIN OUTLET", fill=(0, 0, 0))
    draw.text((50, 50), "P&ID SCHEMATIC: FEED SYSTEM 01", fill=(0, 0, 0))
    draw.text((50, 75), "Standard: OISD-STD-118", fill=(0, 0, 0))
    img.save(str(image_path))
    print(f"Created test P&ID image: {image_path}")
    return str(image_path)

def create_test_spreadsheet():
    sheet_path = TEST_FILES_DIR / "equipment_parameters.xlsx"
    data = {
        "equipment_tag": ["P-204", "XV-101", "HE-301"],
        "name": ["Feed Pump", "Control Valve", "Heat Exchanger"],
        "parameter": ["discharge pressure", "inlet temperature", "heat duty"],
        "value": ["12 bar", "85 C", "450 kW"],
        "last_calibrated": ["2026-06-01", "2026-05-15", "2026-07-01"]
    }
    df = pd.DataFrame(data)
    df.to_excel(str(sheet_path), index=False)
    print(f"Created test spreadsheet: {sheet_path}")
    return str(sheet_path)

def create_test_email():
    email_path = TEST_FILES_DIR / "pump_update_email.eml"
    content = """From: bob.johnson@plant.com
To: john.doe@plant.com
Subject: Operational issue with Feed Pump P-204
Date: Mon, 13 Jul 2026 14:30:00 +0530

Hi John,

During the morning shift, we ran tests on Feed Pump P-204.
The discharge pressure spiked to 14.5 bar temporarily, which needs checking against safety procedure OISD-STD-118 guidelines.
Let's schedule a maintenance check with Technician Alice Smith.

Thanks,
Bob
"""
    with open(email_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Created test email: {email_path}")
    return str(email_path)

def run_tests():
    print("\n--- Generating Test Documents ---")
    files = [
        create_test_pdf(),
        create_test_scan_image(),
        create_test_pid_image(),
        create_test_spreadsheet(),
        create_test_email()
    ]
    
    server_online = check_server_running()
    
    if server_online:
        print("\n[INFO] FASTAPI SERVER DETECTED ONLINE. Running tests via HTTP REST Client...")
        client_session = httpx.Client()
        
        print("\n--- Uploading & Ingesting Files via REST API ---")
        for f in files:
            filename = os.path.basename(f)
            with open(f, "rb") as file_bytes:
                files_payload = {"file": (filename, file_bytes, "application/octet-stream")}
                response = client_session.post(f"{API_URL}/upload", files=files_payload, timeout=60.0)
                if response.status_code == 201:
                    print(f"PASS: REST upload ingestion succeeded for {filename}")
                else:
                    print(f"FAIL: REST upload ingestion failed for {filename}: {response.text}")
                    
        print("\n--- Verifying Knowledge Graph via API ---")
        graph_response = client_session.get(f"{API_URL}/graph")
        if graph_response.status_code == 200:
            graph_data = graph_response.json()["data"]
            print(f"Extracted Nodes count: {len(graph_data['nodes'])}")
            print(f"Extracted Relationships count: {len(graph_data['relationships'])}")
            print("\nList of Relationships:")
            for r in graph_data["relationships"]:
                print(f"  {r['from']['type']}({r['from']['val']}) -[:{r['type']}]-> {r['to']['type']}({r['to']['val']})")
        else:
            print("Failed to query graph endpoint.")

        print("\n--- Verifying Vector Store Search via API ---")
        search_q = "safety standard for pump P-204"
        print(f"Querying Vector DB endpoint for: '{search_q}'")
        search_response = client_session.get(f"{API_URL}/search", params={"query": search_q, "limit": 3})
        if search_response.status_code == 200:
            results = search_response.json()["results"]
            for idx, r in enumerate(results):
                print(f"  Result {idx+1} [Score: {r['score']:.4f}]:")
                print(f"    Source: {r['document_id']}")
                print(f"    Snippet: {r['text'][:150]}...")
                print(f"    Linked Nodes: {r['related_node_ids']}")
        else:
            print("Failed to query search endpoint.")
            
    else:
        print("\n[INFO] FASTAPI SERVER OFFLINE. Running in local in-process fallback mode...")
        # Local Imports
        from watcher import process_file
        from graph_db import graph_db, normalize_tag
        from vector_db import vector_db
        
        print("\n--- Checking Ingest Registry Reset ---")
        if (config.BASE_DIR / "processed_registry.json").exists():
            os.remove(config.BASE_DIR / "processed_registry.json")
        if os.path.exists(graph_db.mock_file_path):
            os.remove(graph_db.mock_file_path)
        graph_db._save_mock_graph({"nodes": [], "relationships": []})

        print("\n--- Copying Files to Watched Folder ---")
        for f in files:
            target = config.WATCHED_DIR / os.path.basename(f)
            shutil.copy(f, target)
            print(f"Copied {os.path.basename(f)} to watched folder")
            
        print("\n--- Processing Files in Local Context ---")
        for f in files:
            target_path = config.WATCHED_DIR / os.path.basename(f)
            success = process_file(str(target_path))
            if success:
                print(f"PASS: Ingestion succeeded for {os.path.basename(f)}")
            else:
                print(f"FAIL: Ingestion failed for {os.path.basename(f)}")
                
        print("\n--- Verifying Knowledge Graph Extracted Nodes ---")
        mock_data = graph_db.get_all_mock_data()
        print(f"Extracted Nodes count: {len(mock_data['nodes'])}")
        print(f"Extracted Relationships count: {len(mock_data['relationships'])}")
        
        print("\nList of Relationships:")
        for r in mock_data["relationships"]:
            print(f"  {r['from']['type']}({r['from']['val']}) -[:{r['type']}]-> {r['to']['type']}({r['to']['val']})")

        print("\n--- Verifying Vector Store Search ---")
        search_q = "safety standard for pump P-204"
        print(f"Querying Qdrant Vector DB for: '{search_q}'")
        search_results = vector_db.search_similar_chunks(search_q, limit=3)
        for idx, r in enumerate(search_results):
            print(f"  Result {idx+1} [Score: {r['score']:.4f}]:")
            print(f"    Source: {r['document_id']}")
            print(f"    Snippet: {r['text'][:150]}...")
            print(f"    Linked Nodes: {r['related_node_ids']}")

if __name__ == "__main__":
    start_time = time.time()
    run_tests()
    print(f"\nIntegration tests completed in {time.time() - start_time:.2f} seconds.")
