# Module 4: Quality & Regulatory Compliance Intelligence (QRCI) Backend Service

This service provides an agentic compliance intelligence engine that maps regulatory standards against actual refinery maintenance states, equipment hierarchies, and operational telemetry. It automatically identifies compliance gaps, compiles audit-ready evidence packages, alerts quality deviations, and analyzes the operational impact of regulatory amendments.

---

## 🌟 Core Features & Architecture

### 1. Unified Knowledge Representation (Hybrid DB Engine)
The system connects three storage paradigms to construct a complete, audit-traceable compliance state:
- **Relational Layer (SQLite):** Stores structured database records for plant `assets`, `work_orders`, `inspection_findings`, `regulations`, `requirements` (clauses), compiled `evidence_packages`, active `deviations`, and `audit_logs`.
- **Semantic Layer (Qdrant Vector DB):** Segments regulatory manuals into semantic chunks, indexing them with embeddings to support retrieval-augmented generation (RAG) within the Copilot. Has a local keyword search fallback.
- **Graph Layer (Neo4j Graph DB):** Models the topology of plant assets (e.g. parent/child relationships like `Motor-14 PART_OF Pump-14`) and links requirement nodes to applicable assets (`Requirement APPLIES_TO Asset`) based on metadata applicability rules. Has a JSON-based local mock fallback.

### 2. Continuous Compliance Scans (Gap Analysis Subgraph)
- Iterates through all requirements and maps them to applicable equipment and historical maintenance records.
- **Deterministic Rules Engine:** Evaluations of numeric bounds (e.g. effluent pH limits between `5.5` and `9.0` or Stack emission SO2 limits `<= 50.0`) are handled by code logic, satisfying strict safety policies.
- **LLM-Assisted Reasoning:** Evaluates qualitative requirements (e.g. verifying machinery fencing safeguards, flameproof enclosure certifications, or hot work permits).
- Registers findings as draft reports awaiting compliance officer review and sign-off.

### 3. Real-Time Telemetry & Quality Deviations
- Ingests incoming sensor data or inspect reports.
- Automatically flags deviations and rates their severity (`critical`, `major`, `minor`).
- Integrates with asset failure history context (e.g. checking MIRA logs for previous machine seizures) to generate detailed operational risk reports and remedial actions.

### 4. Regulatory Amendment Impact Sandbox
- Diff-analyzes regulatory amendments.
- Traces graph relationships to locate affected equipment and provides LLM-generated operational guidelines detailing required sensor recalibrations or inspector verification frequencies.

### 5. Grounded Conversational Copilot
- Supports interactive safety Q&A grounded on regulations manuals.
- Enforces a strict citation validation contract, ensuring that every claim references a verifiable source type, document ID, and text excerpt.

### 6. Dynamic Ingestion System (Fully Dynamic Backend)
- Exposes endpoints to register new assets, regulations, or requirement clauses dynamically.
- Automatically updates relational tables, chunks and vectorizes new text, registers graph nodes, and maps requirement edges on the fly.

---

## 🛠️ Installation & Setup

1. **Python Dependencies:**
   Ensure you have the required packages installed:
   ```bash
   pip install fastapi uvicorn pydantic qdrant-client neo4j google-generativeai
   ```

2. **Configuration:**
   Configure your environment variables in [config.py](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/config.py):
   - `GEMINI_API_KEY`: Key for direct REST fallback or SDK.
   - `GROQ_API_KEY`: Key for LLM services.
   - `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD`: Credentials for the Graph store.

---

## 🚀 Running the Services

### 🖥️ 1. Start the API Server
Run the FastAPI web backend:
```bash
python main.py
```
*API docs will be available at: http://127.0.0.1:8000/docs*

### 📟 2. Run the Interactive CLI Console
Interact with the system directly through a guided command-line console:
```bash
python cli_agent.py
```

### 🧪 3. Run the Test Suite
Execute the comprehensive test suite verifying SQLite schemas, rules engine, scans, RAG grounding, and dynamic registration:
```bash
python test_agent.py
```

---

## 📊 Synthetic Dataset Ingestion & Training

Module 4 includes an automated seeding pipeline for training and populating the database with mock refinery data. The pipeline dynamically processes and syncs files inside [Datasets/OneDrive_1_7-16-2026](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/Datasets/OneDrive_1_7-16-2026):
1. **[equipment_master.json](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/Datasets/OneDrive_1_7-16-2026/equipment_master.json):** Registers 30 plant machines (Compressors, Reactors, Pumps, Valves, Cooling Towers, Turbines, Boilers) and automatically inserts them into the SQLite relational layer and Graph nodes.
2. **[compliance_requirements.json](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/Datasets/OneDrive_1_7-16-2026/compliance_requirements.json):** Loads safety and environmental clauses from Factories Act, PESO, OISD, and IBR standards, and dynamically maps them to matching asset classes in the Graph DB.
3. **[safety_procedures.json](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/Datasets/OneDrive_1_7-16-2026/safety_procedures.json):** Ingests Standard Operating Procedures (SOPs), packaging hazards and PPE checklists, and indexes them in the Vector DB for semantic query retrieval.
4. **[maintenance_work_orders.json](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/Datasets/OneDrive_1_7-16-2026/maintenance_work_orders.json):** Loads 120 historical maintenance logs serving as audit evidence.
5. **[inspection_reports.json](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/Datasets/OneDrive_1_7-16-2026/inspection_reports.json):** Seeds 60 thickness surveys, thermography findings, and statutory inspection findings.
6. **[incident_reports.json](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/Datasets/OneDrive_1_7-16-2026/incident_reports.json):** Seeds 25 safety near-misses and process deviations in the relational database.

Whenever `initialize_database()` is invoked (on startup, testing, or reset), this ingestion process runs automatically and dynamically maps the data.

---

## 📂 Code Structure Reference

- [main.py](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/main.py): FastAPI routing, schemas, and endpoint definitions.
- [cli_agent.py](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/cli_agent.py): Command-line dashboard and simulated console workflows.
- [agents.py](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/agents.py): Compliance scan, evidence compiler, deviation checker, impact analysis, and copilot subgraphs.
- [data_store.py](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/data_store.py): Relational SQLite tables, seeding data, and dynamic DB mapping triggers.
- [vector_db.py](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/vector_db.py): Embeddings generation and semantic regulations query interface.
- [graph_db.py](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/graph_db.py): Neo4j adapter and Mock JSON Graph logic.
- [gemini_client.py](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/gemini_client.py): Direct Google/Groq REST HTTP endpoint Wrapper.
- [test_agent.py](file:///c:/Users/GUNUS/OneDrive/Attachments/Desktop/ET%20Model/Mod%204/test_agent.py): System integration tests.

