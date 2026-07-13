# Universal Ingestion & Knowledge Graph Pipeline (Terminal Console)

A standalone, terminal-based AI pipeline that processes PDFs, blueprints/images, spreadsheets, and emails. It extracts structural entities (equipment tags, process parameters, regulatory references, personnel, and dates) using **Groq (Llama-3.3-70b-versatile)**, generates page-level vector embeddings with **Gemini (`text-embedding-004`)**, resolves duplicates into a unified SQLite knowledge graph, and outputs structured documentation.

---

## 🚀 Setup & Installation

### 1. Configure API Keys
Verify or update the API keys in your environmental configuration file located at:
👉 `Module 1/backend/.env`

Ensure it contains both keys:
```text
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

---

## 🖥️ Running the Operations Console

To start the interactive command-line dashboard, open your terminal and run:
```powershell
cd "Module 1/backend"
python cli.py
```

### Main Menu Options:
* **`[1] Ingest Local File`**: Provide the path to any local PDF, spreadsheet (Excel/CSV), or drawing/image. The pipeline runs reading, OCR, vector embedding, entity extraction, and graph linking synchronously.
* **`[2] Sync Simulated Emails (Mock Inbox)`**: Pulls mock email records into the processing queue to populate threads.
* **`[3] Ask Grounded RAG Question`**: Ask questions about your documents (e.g. *"What is the vibration limit on Pump P-204?"*). Returns the synthesized grounded answer, citation pages, and saves a copy as markdown.
* **`[4] Generate Mindmap Hierarchy Outline`**: Prints a clean indented tree structure mapping categories (Equipment, Parameters, Personnel, etc.) for any topic node directly to the console.
* **`[5] Generate Procedural Flowchart Code (Mermaid)`**: Generates standard Mermaid.js GraphTD flowchart configurations from procedural documents.
* **`[6] Database Statistics & Metrics`**: Displays counts of active database documents, chunks, nodes, and relationships.
* **`[7] Exit Console`**

---

## 🧹 Clearing Pipeline Data (Reset)

To empty the SQLite database records and delete all uploaded documents and output logs, run:
```powershell
cd "Module 1/backend"
python reset_data.py
```
This utility deletes files safely and handles active database locks automatically.

---

## 📂 Output Files Directory Structure

All generated outputs are written to the disk in real-time under the `outputs/` folder:
* **Grounded Answers**: `outputs/queries/q_{query_id}.md` (Format: Markdown text with citations)
* **Mindmap Trees**: 
  * JSON tree structure: `outputs/mindmaps/node_{topic}.json`
  * Text bulleted outlines: `outputs/mindmaps/node_{topic}.md`
* **Flowcharts**: `outputs/flowcharts/doc_{document_id}.mmd` (Mermaid code blocks)
