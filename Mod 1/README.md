# Module 1 — Universal Document Ingestion & Knowledge Graph Agent

An automated pipeline to ingest mixed-format industrial documents, extract structured engineering entities (equipment tags, process parameters, regulatory references, personnel, dates) using Gemini API, build a cross-document knowledge graph in Neo4j, and store embedded document text segments in a local Qdrant vector database.

---

## 🚀 Key Features

* **5-Format Router**: Custom pipelines for Native PDFs, Scanned Images (PNG/JPG), Blueprints (P&ID drawings), Spreadsheets (XLSX/CSV), and Emails (EML/TXT).
* **Gemini LLM Extraction & Embeddings**: High-fidelity structured JSON entity extraction with Gemini, dynamic visual OCR for drawings, and robust embedding configurations with automatic model fallbacks.
* **Auto-Update Folder Watcher**: Background directory watcher using `watchdog` that ingests new files within seconds and maintains processing idempotency via `processed_registry.json`.
* **Hybrid Database Integration**: 
  - **Neo4j Graph Database**: Maps cross-document connections using Cypher `MERGE` queries (with a local `mock_graph.json` database fallback if offline).
  - **Qdrant Vector Database**: Indexes chunked text semantically in local disk mode (runs in-process, no Docker required).
* **Premium Interactive UI Console**: Dark-mode dashboard featuring drag-and-drop file upload logs, connection badges, search interfaces, and a live, interactive SVG node-link graph mapping out relations.

---

## 🛠️ Installation

Ensure you have Python 3.10+ installed.

1. **Navigate to the Module 1 Workspace**:
   ```powershell
   cd "c:\Users\GUNUS\OneDrive\Attachments\Desktop\ET Model\Mod 1"
   ```

2. **Install Required Dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

---

## ⚙️ Configuration

Configurations are managed in `config.py` and can be overridden via environment variables:

| Parameter | Environment Variable | Default Value |
|---|---|---|
| **Gemini API Key** | `GEMINI_API_KEY` | `YOUR_GEMINI_API_KEY` |
| **Gemini model** | `GEMINI_MODEL` | `gemini-3.1-flash` *(falls back to `gemini-2.5-flash` / `gemini-2.0-flash`)* |
| **Neo4j URI** | `NEO4J_URI` | `bolt://localhost:7687` *(or Neo4j Aura URL)* |
| **Neo4j User** | `NEO4J_USER` | `neo4j` |
| **Neo4j Password** | `NEO4J_PASSWORD` | `password` |
| **Watched Folder** | `WATCHED_DIR` | `./watched_folder` |
| **Qdrant Folder** | `QDRANT_DIR` | `./qdrant_db` |

*If you do not have Neo4j running locally, the application automatically launches in **mock mode** and records/queries the graph states in `mock_graph.json` without failing.*

---

## 🎮 Running the Application

### 1. Start the API Server & Watcher
You can start the FastAPI backend server (which serves the frontend dashboard at the root `/` and `/ui` endpoints) by double-clicking **`run.bat`** or executing:
```powershell
python main.py
```
* Once started, open **`http://localhost:8000`** or **`http://localhost:8000/ui`** in your browser.

### 2. Run the Verification Tests
To test the pipeline end-to-end with programmatically generated sample documents (Native PDF, Scanned form, Excel spreadsheet, EML email, and P&ID drawing schematic), double-click **`run_tests.bat`** or run:
```powershell
python test_pipeline.py
```

---

## 📊 Dashboard Usage

1. **Top Bar Status Indicators**: Verify the connection status of the Gemini API, local Qdrant instance, and Neo4j DB (green = active/mock active, red = offline).
2. **Drag & Drop Ingestion**: Drag and drop any document onto the dash box. The backend immediately routes, parses, embeds, and loads the document.
3. **SVG Knowledge Graph**: The visual node-link diagram displays the nodes in color codes (Cyan: Documents, Green: Equipment Tags, Red: Regulations, Amber: Personnel, Orange: Incidents). Hover or click nodes to check properties and highlight their cross-document links.
4. **Semantic Query Search**: Type search phrases (e.g. *"safety limits on pump P-204"*) to query Qdrant and instantly retrieve scored text snippets along with their parent document and graph node links.
