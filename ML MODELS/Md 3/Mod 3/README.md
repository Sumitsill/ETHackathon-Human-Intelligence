# MIRA (Maintenance Intelligence & RCA Agent) — Module 3

Module 3 implements the core agentic reasoning engine, relational data store, stateful multi-agent graphs, and CLI workbench console for MIRA.

---

## 🛠️ Tech Stack & Relational Models

- **State Graph Orchestration**: Stateful transition loops modeling LangGraph architectures (`RCAState`, supervisor routing, and human-in-the-loop interrupts).
- **Relational Data Store**: Structured database schemas tracking `assets`, `work_orders`, `sensor_tags`, `inspection_findings`, `rca_sessions`, `rca_nodes`, `recommendations`, and `audit_log`.
- **Optimization Solver**: Labor, budget, and safety constraints knapsack prioritizer.
- **RAG & Search Tools**: Swappable Qdrant Vector search, Neo4j Graph traversal fallbacks, and Gemini API integration.

---

## 💻 Commands to Run the Files

Below are the commands to execute the different components of Module 3:

### 1. Interactive CLI Agent Console
Launches the terminal dashboard, offering fleet health scans, guided multi-turn RCA workbenches, constraint solvers, and copilot RAG chat:
```powershell
python cli_agent.py
```
*Alternatively, you can run the pre-configured batch file:*
```powershell
.\run.bat
```

### 2. Programmatic Verification Test Suite
Executes the automated unit and integration tests (validating relational schemas, citation contract structures, and state transitions):
```powershell
python test_agent.py
```
*Alternatively, you can run the test batch file:*
```powershell
.\run_tests.bat
```

### 3. REST API Backend Service
Launches the FastAPI backend service providing JSON endpoints for external dashboard integrations:
```powershell
python main.py
```
*To run with auto-reload via Uvicorn:*
```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

---

## 📋 Relational Database Schemas

The database layer simulates the following schemas:
- `ASSETS_TABLE`: Tracks tags, locations, criticality indices, and parent relations.
- `WORK_ORDERS_TABLE`: Manages PM/Corrective states, durations, and costs.
- `SENSOR_TAGS_TABLE`: Configures normal/high warning envelopes for alarms.
- `INSPECTION_FINDINGS_TABLE`: Archives free-text field logs from plant inspections.
- `RCA_SESSIONS_TABLE`: Checkpoints session statuses and LangGraph thread states.
- `RCA_NODES_TABLE`: Logs generated 5-Why hypothesis steps and citation maps.
- `RECOMMENDATIONS_TABLE`: Pending predictive alerts awaiting human engineer review decisions.
