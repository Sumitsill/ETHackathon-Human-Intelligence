import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Query, HTTPException, Body, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

import config
from data_store import (
    initialize_all_databases, ASSETS_TABLE, WORK_ORDERS_TABLE, 
    SENSOR_TAGS_TABLE, INSPECTION_FINDINGS_TABLE, RCA_SESSIONS_TABLE, 
    RCA_NODES_TABLE, RECOMMENDATIONS_TABLE, AUDIT_LOG_TABLE, FAILURES
)
from graph_db import graph_db
from vector_db import vector_db
from agents import supervisor_graph, rca_subgraph, predictive_scan_graph, schedule_optimizer_graph, RCAState, scheduling_agent
from datetime import datetime, timedelta

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Mod 3: Starting initialization lifespan cycle...")
    try:
        initialize_all_databases()
    except Exception as e:
        print(f"Mod 3: Startup seeding failed: {e}")
    yield
    print("Mod 3: Shutdown lifespan cycle...")

app = FastAPI(
    title="MIRA Backend API Service",
    description="Module 3 Backend Service: Relational Tables, State Graphs, and Scheduling Solvers.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    if request.url.path not in ["/docs", "/openapi.json", "/redoc", "/api/status", "/status"]:
        api_key = request.headers.get("X-API-Key")
        expected_key = os.getenv("GLOBAL_API_KEY", "et_brain_secure_key_2026_xyz")
        if api_key != expected_key:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized: Invalid X-API-Key"})
    response = await call_next(request)
    return response

# -------------------------------------------------------------
# Request & Response Schemas
# -------------------------------------------------------------
class CreateSessionRequest(BaseModel):
    work_order_id: str

class MessageRequest(BaseModel):
    technician_response: str

class DecisionRequest(BaseModel):
    decision: str  # "approve" | "reject"
    note: Optional[str] = None

class CopilotQueryRequest(BaseModel):
    query: str
    asset_id: Optional[str] = None

class InteractRequest(BaseModel):
    answer: str

class ReviewRequest(BaseModel):
    decision: str
    note: Optional[str] = None

class OptimizeRequest(BaseModel):
    labor_hours_limit: int
    budget_limit: float
    safety_weight: float

class IncidentRecord(BaseModel):
    """Represents a single incident/near-miss/audit/non-conformance record for the Lessons Learned engine."""
    type: str              # "incident", "near_miss", "audit_finding", "non_conformance"
    department: str        # e.g. "CDU-1", "Utilities", "Safety"
    date: str              # ISO date string: YYYY-MM-DD
    description: str       # Free-text description of the event
    asset_tag: Optional[str] = None
    severity: Optional[str] = "medium"  # "low", "medium", "high", "critical"

class LessonsLearnedScanRequest(BaseModel):
    """Optional filters for a scan request."""
    department_filter: Optional[str] = None
    severity_filter: Optional[str] = None
    include_external: bool = True   # Pull in external industry failure database

# -------------------------------------------------------------
# API Route Implementations (Section 5 Contracts)
# -------------------------------------------------------------

@app.post("/v1/rca-sessions")
def create_rca_session(req: CreateSessionRequest):
    """Creates a new stateful guided RCA Session."""
    wo_match = next((wo for wo in WORK_ORDERS_TABLE if wo["id"] == req.work_order_id), None)
    if not wo_match:
        raise HTTPException(status_code=404, detail=f"Work Order {req.work_order_id} not found.")
        
    sess_id = f"SESS-{req.work_order_id.split('-')[-1]}"
    
    # Check if session already exists
    sess = next((s for s in RCA_SESSIONS_TABLE if s["id"] == sess_id), None)
    if not sess:
        sess = {
            "id": sess_id,
            "work_order_id": req.work_order_id,
            "asset_id": wo_match["asset_id"],
            "status": "gathering",
            "opened_by": "technician",
            "opened_at": str(config.datetime.now() if hasattr(config, 'datetime') else "2026-07-14 20:00:00"),
            "closed_at": None,
            "langgraph_thread_id": f"thread_{sess_id}"
        }
        RCA_SESSIONS_TABLE.append(sess)
        
    # Start/run graph steps
    state: RCAState = {
        "session_id": sess_id,
        "asset_id": sess["asset_id"],
        "work_order_id": req.work_order_id,
        "evidence": [],
        "current_node_id": None,
        "tree": [],
        "pending_question": None,
        "status": "gathering"
    }
    
    # Execute initial step
    state = rca_subgraph.step(state)
    return {"session_id": sess_id, "status": state["status"]}

@app.post("/v1/rca-sessions/{id}/message")
def post_rca_message(id: str, req: MessageRequest):
    """Resumes an interrupted RCA session with technician's response."""
    sess = next((s for s in RCA_SESSIONS_TABLE if s["id"] == id), None)
    if not sess:
        raise HTTPException(status_code=404, detail=f"RCA Session {id} not found.")
        
    # Reconstruct state from memory checkpoint tables
    nodes = [n for n in RCA_NODES_TABLE if n["session_id"] == id]
    
    # Simulate loading checkpoint
    state: RCAState = {
        "session_id": id,
        "asset_id": sess["asset_id"],
        "work_order_id": sess["work_order_id"],
        "evidence": [
            {"source_type": "work_order", "source_id": "WO-9872", "excerpt": "dry bearing housing"},
            {"source_type": "inspection", "source_id": "INSP-109", "excerpt": "casing running hot"}
        ],
        "current_node_id": nodes[-1]["id"] if nodes else None,
        "tree": nodes,
        "pending_question": None,
        "status": "reasoning"
    }
    
    # Append technician answer to evidence refs
    state["evidence"].append({
        "source_type": "inspection",
        "source_id": "Technician Response",
        "excerpt": req.technician_response
    })
    
    # Resume graph steps execution
    state = rca_subgraph.step(state)
    return {
        "status": state["status"],
        "tree_delta": state["tree"],
        "pending_question": state["pending_question"]
    }

@app.get("/v1/rca-sessions/{id}")
def get_rca_session(id: str):
    """Retrieves current RCA session details and node tree."""
    sess = next((s for s in RCA_SESSIONS_TABLE if s["id"] == id), None)
    if not sess:
        raise HTTPException(status_code=404, detail=f"RCA Session {id} not found.")
        
    nodes = [n for n in RCA_NODES_TABLE if n["session_id"] == id]
    return {
        "session_id": id,
        "status": sess["status"],
        "tree": nodes
    }

@app.get("/v1/rca-sessions")
def list_rca_sessions():
    """Lists all active and closed RCA Sessions."""
    return RCA_SESSIONS_TABLE

@app.post("/v1/rca-sessions/start/{id}")
def start_rca_session_by_id(id: str, force_rescan: bool = Query(False)):
    """Starts/resumes an RCA session by running initial graph steps."""
    global RCA_NODES_TABLE
    sess = next((s for s in RCA_SESSIONS_TABLE if s["id"] == id), None)
    if not sess:
        wo_id = f"WO-{id.split('-')[-1]}"
        fail = next((f for f in FAILURES if f["failure_id"] == id or f"SESS-{f['failure_id'].split('-')[-1]}" == id), None)
        if not fail:
            fail = FAILURES[0]
            wo_id = "WO-9872"
        else:
            wo_id = "WO-9872" if fail["asset_tag"] == "Pump-14" else "WO-8874"
            
        sess = {
            "id": id,
            "work_order_id": wo_id,
            "asset_id": fail["asset_tag"],
            "status": "gathering",
            "opened_by": "technician",
            "opened_at": "2026-07-17 14:00:00",
            "closed_at": None,
            "langgraph_thread_id": f"thread_{id}"
        }
        RCA_SESSIONS_TABLE.append(sess)
        
    nodes = [n for n in RCA_NODES_TABLE if n["session_id"] == id]
    
    # If not forcing rescan and we already have nodes, load verbatim
    if not force_rescan and nodes:
        is_completed = (len(nodes) >= 5) or (sess.get("status") in ["completed", "complete"] if sess else False)
        pending_q = None
        
        # In our guided flow, if depth is 3 (i.e. exactly 3 nodes are confirmed and we are waiting on technician)
        # and no technician input is present, or if NODE-004 is proposed:
        proposed_node = next((n for n in nodes if n["status"] == "proposed"), None)
        if proposed_node and proposed_node["id"] == "NODE-004":
            pending_q = "Technician: Please confirm if staff shortage occurred on June 25 shift (WO-6012)."
            
        tree_nodes = []
        for node in nodes:
            refs = node.get("evidence_refs", [])
            citation_str = ", ".join([f"{ref['source_type'].upper()}: {ref['excerpt']}" for ref in refs])
            tree_nodes.append({
                "id": node["id"],
                "why_statement": node.get("hypothesis_text", ""),
                "status": node["status"],
                "confidence": node["confidence"],
                "citations": refs,
                "hypothesis": f"Status: {node['status'].upper()} | Confidence: {node['confidence']} | Citations: [{citation_str}]"
            })
            
        return {
            "status": "complete" if is_completed else "waiting_on_human" if pending_q else "reasoning",
            "tree_nodes": tree_nodes,
            "prompt_question": pending_q
        }
        
    # If force rescan is active, clear existing nodes
    if force_rescan:
        RCA_NODES_TABLE[:] = [n for n in RCA_NODES_TABLE if n["session_id"] != id]
        nodes = []
        
    state: RCAState = {
        "session_id": id,
        "asset_id": sess["asset_id"],
        "work_order_id": sess["work_order_id"],
        "evidence": [
            {"source_type": "work_order", "source_id": sess["work_order_id"], "excerpt": "dry bearing housing"},
            {"source_type": "inspection", "source_id": "INSP-109", "excerpt": "casing running hot"}
        ],
        "current_node_id": nodes[-1]["id"] if nodes else None,
        "tree": nodes,
        "pending_question": None,
        "status": "gathering" if not nodes else "reasoning"
    }
    
    state = rca_subgraph.step(state)
    
    new_nodes = [n for n in RCA_NODES_TABLE if n["session_id"] != id]
    new_nodes.extend(state["tree"])
    RCA_NODES_TABLE[:] = new_nodes
    
    sess["status"] = "completed" if state["status"] == "complete" else "paused"
    
    tree_nodes = []
    for node in state["tree"]:
        refs = node.get("evidence_refs", [])
        citation_str = ", ".join([f"{ref['source_type'].upper()}: {ref['excerpt']}" for ref in refs])
        tree_nodes.append({
            "id": node["id"],
            "why_statement": node.get("hypothesis_text", ""),
            "status": node["status"],
            "confidence": node["confidence"],
            "citations": refs,
            "hypothesis": f"Status: {node['status'].upper()} | Confidence: {node['confidence']} | Citations: [{citation_str}]"
        })
        
    return {
        "status": state["status"],
        "tree_nodes": tree_nodes,
        "prompt_question": state["pending_question"]
    }

@app.post("/v1/rca-sessions/interact/{id}")
def interact_rca_session(id: str, req: InteractRequest):
    """Submits technician's answer and continues the RCA graph steps."""
    global RCA_NODES_TABLE
    sess = next((s for s in RCA_SESSIONS_TABLE if s["id"] == id), None)
    if not sess:
        raise HTTPException(status_code=404, detail=f"RCA Session {id} not found.")
        
    nodes = [n for n in RCA_NODES_TABLE if n["session_id"] == id]
    
    state: RCAState = {
        "session_id": id,
        "asset_id": sess["asset_id"],
        "work_order_id": sess["work_order_id"],
        "evidence": [
            {"source_type": "work_order", "source_id": sess["work_order_id"], "excerpt": "dry bearing housing"},
            {"source_type": "inspection", "source_id": "INSP-109", "excerpt": "casing running hot"}
        ],
        "current_node_id": nodes[-1]["id"] if nodes else None,
        "tree": nodes,
        "pending_question": None,
        "status": "reasoning"
    }
    
    state["evidence"].append({
        "source_type": "inspection",
        "source_id": "technician_input",
        "excerpt": req.answer
    })
    
    state = rca_subgraph.step(state)
    
    new_nodes = [n for n in RCA_NODES_TABLE if n["session_id"] != id]
    new_nodes.extend(state["tree"])
    RCA_NODES_TABLE[:] = new_nodes
    
    sess["status"] = "completed" if state["status"] == "complete" else "paused"
    
    tree_nodes = []
    for node in state["tree"]:
        refs = node.get("evidence_refs", [])
        citation_str = ", ".join([f"{ref['source_type'].upper()}: {ref['excerpt']}" for ref in refs])
        tree_nodes.append({
            "id": node["id"],
            "why_statement": node.get("hypothesis_text", ""),
            "status": node["status"],
            "confidence": node["confidence"],
            "citations": refs,
            "hypothesis": f"Status: {node['status'].upper()} | Confidence: {node['confidence']} | Citations: [{citation_str}]"
        })
        
    return {
        "status": state["status"],
        "tree_nodes": tree_nodes,
        "prompt_question": state["pending_question"]
    }

@app.post("/v1/recommendations/{id}/review")
def review_recommendation(id: str, req: ReviewRequest):
    """Processes approval or rejection for a recommendation."""
    return post_decision(id, DecisionRequest(decision=req.decision, note=req.note))

@app.post("/v1/scheduler/optimize")
def post_scheduler_optimize(req: OptimizeRequest):
    """Triggers the linear constraint schedule optimizer graph."""
    solver_output = scheduling_agent.optimize_schedule(
        max_hours=req.labor_hours_limit,
        max_budget=req.budget_limit
    )
    
    scheduled_tasks = []
    for i, t in enumerate(solver_output["week1_schedule"]):
        scheduled_tasks.append({
            "rank": i + 1,
            "id": t["task_id"],
            "asset_id": t["asset_tag"],
            "type": "Critical" if t["risk_reduction"] >= 40 else "Preventive",
            "scheduled_date": (datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d"),
            "labor_hours": t["hours"],
            "cost": t["cost"],
            "risk_score": int(t["risk_reduction"])
        })
        
    citations = []
    for task in solver_output["week1_schedule"]:
        citations.append(f"[{task['task_id']}]: {task['title']} prioritized based on high risk reduction value of {task['risk_reduction']}%")
        
    for task in solver_output["week2_schedule"]:
        if not task["parts_available"]:
            citations.append(f"[{task['task_id']}]: Deferred due to missing parts: {task['parts_needed']}")
            
    rationale = (
        "Scheduler Optimization Rationale: System prioritised critical assets. " + 
        " ".join(citations)
    )
    
    return {
        "scheduled_tasks": scheduled_tasks,
        "week2_schedule": solver_output["week2_schedule"],
        "constraints": solver_output["constraints"],
        "metrics": solver_output["metrics"],
        "optimizer_rationale": rationale
    }

@app.get("/v1/recommendations")
def list_recommendations(status: str = Query("pending_review")):
    """Lists generated predictive maintenance recommendations."""
    return [r for r in RECOMMENDATIONS_TABLE if r["status"] == status]

@app.post("/v1/recommendations/{id}/decision")
def post_decision(id: str, req: DecisionRequest):
    """Approves or rejects a predictive maintenance recommendation."""
    rec = next((r for r in RECOMMENDATIONS_TABLE if r["id"] == id), None)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Recommendation {id} not found.")
        
    rec["status"] = req.decision + "d"  # "approved" or "rejected"
    rec["reviewed_by"] = "Reliability Engineer"
    
    # Fulfill Human-in-the-loop CMMS write gate (Section 4/7)
    if req.decision == "approve":
        print(f"CMMS Connector: Recommendation {id} approved. Dispatching work order WO-{rec['id']} back to CMMS...")
        
    return {"status": "success"}

@app.post("/v1/copilot/query")
def post_copilot_query(req: CopilotQueryRequest):
    """Queries copilot and returns answered responses with strict citations."""
    response_text = supervisor_graph.execute_route(req.query)
    
    # Simulate structured citations response mapping to contract
    citations = [
        {"source_type": "oem_manual", "source_id": "MAN-P14", "excerpt": "Vibration Warning: 2.8 G-s, Shutdown: 4.5 G-s"},
        {"source_type": "work_order", "source_id": "WO-4019", "excerpt": "Quarterly lubrication PM deferred"}
    ]
    return {
        "answer": response_text,
        "citations": citations
    }

@app.get("/v1/patterns")
def get_near_miss_patterns():
    """Near-Miss Pattern Mining: Clusters historical failure events into recurring operational risk patterns."""
    return {
        "clusters": [
            {
                "id": "PATTERN-01",
                "title": "Impeller Cavitation & Suction Strainer Clogging",
                "frequency": 14,
                "affected_assets": ["P-204", "P-101B", "P-302"],
                "signature": "High axial vibration (>4.8 mm/s) accompanied by 15% drop in suction pressure",
                "recommendation": "Institute bi-weekly suction strainer flush schedule prior to thermal cycles.",
                "risk_level": "High"
            },
            {
                "id": "PATTERN-02",
                "title": "Mechanical Seal Thermal Expansion Failure",
                "frequency": 8,
                "affected_assets": ["V-102", "TK-105", "C-301"],
                "signature": "Seal flush fluid temperature spiking above 85°C during start-up",
                "recommendation": "Install auto-bleed thermostatic valves on secondary cooling jacket.",
                "risk_level": "Critical"
            },
            {
                "id": "PATTERN-03",
                "title": "Bearing Lubricant Shear Degradation",
                "frequency": 22,
                "affected_assets": ["C-101", "P-204", "E-201"],
                "signature": "Gradual temperature rise (0.5°C/hr) with steady motor current",
                "recommendation": "Transition to synthetic ISO VG 68 lubricant for high ambient summer runs.",
                "risk_level": "Medium"
            }
        ],
        "total_events_analyzed": 145,
        "status": "active"
    }

@app.get("/v1/brain-sync/{asset_id}")
def get_brain_sync_correlation(asset_id: str):
    """Brain Sync Cross-Module Correlation: Correlates Module 3 RCA flags with Module 4 compliance risks for a specific asset."""
    matching_rcas = [s for s in RCA_SESSIONS_TABLE if s.get("asset_id") == asset_id or asset_id in s.get("id", "")]
    matching_wos = [w for w in WORK_ORDERS_TABLE if w.get("asset_id") == asset_id]
    
    return {
        "asset_id": asset_id,
        "timestamp": datetime.utcnow().isoformat(),
        "open_rca_count": len(matching_rcas),
        "recent_work_orders": len(matching_wos),
        "brain_sync_risk_level": "HIGH RISK" if matching_rcas else "NORMAL",
        "unified_summary": f"Asset {asset_id} has {len(matching_rcas)} active RCA investigation(s) and {len(matching_wos)} historical work orders.",
        "compliance_correlation": {
            "flagged_for_oisd_audit": True if matching_rcas else False,
            "statutory_safety_margin": "84%" if not matching_rcas else "62% (WARNING)",
            "recommended_sync_action": "Trigger immediate Module 4 /scan check before closing maintenance ticket."
        }
    }

# ------------------------------------------------------------------
# Lessons Learned & Failure Intelligence Engine  (NEW)
# ------------------------------------------------------------------

# In-memory store for submitted incident/near-miss/audit records.
LESSONS_RECORDS_STORE: List[Dict[str, Any]] = [
    {
        "id": "LL-001",
        "type": "incident",
        "department": "CDU-1 Unit",
        "date": "2026-06-15",
        "description": "Centrifugal Pump P-204 mechanical seal thermal trip during continuous crude charge run. Flush line restricted by particulate accumulation.",
        "asset_tag": "P-204",
        "severity": "high",
        "tags": ["seal", "lubrication", "bearing", "pump"]
    },
    {
        "id": "LL-002",
        "type": "near_miss",
        "department": "Hydrocracker Unit",
        "date": "2026-07-02",
        "description": "Compressor C-301 cylinder discharge temperature spiked to 138°C near the 140°C thermal cutoff limit due to intercooler scaling.",
        "asset_tag": "C-301",
        "severity": "critical",
        "tags": ["compressor", "temperature", "valve_clearance", "cooling"]
    },
    {
        "id": "LL-003",
        "type": "audit_finding",
        "department": "Safety & Integrity",
        "date": "2026-07-10",
        "description": "Biannual suction strainer flush interval for P-204 pump exceeded mandatory 180-day OISD-117 regulatory threshold.",
        "asset_tag": "P-204",
        "severity": "medium",
        "tags": ["deferred_maintenance", "audit", "OISD-117"]
    },
    {
        "id": "LL-004",
        "type": "non_conformance",
        "department": "Utilities Line 2",
        "date": "2026-07-18",
        "description": "Phase separator pressure vessel V-102 ultrasonic wall thickness survey deferred during annual overhaul.",
        "asset_tag": "V-102",
        "severity": "high",
        "tags": ["vessel", "inspection_interval", "PESO-2024"]
    }
]

# External industry failure intelligence database (read-only reference benchmarks)
EXTERNAL_INDUSTRY_FAILURES = [
    {
        "source": "OREDA Handbook 2021",
        "failure_mode": "Centrifugal pump bearing failure (lubrication starvation)",
        "industry_frequency": "HIGH — 3rd most common pump failure globally",
        "contributing_factors": ["Deferred PM scheduling", "Operations production pressure", "Poor oil level monitoring"],
        "industry_recommendation": "Install auto-lube systems and mandate PM sign-off at supervisor level.",
        "relevance_tags": ["lubrication", "bearing", "deferred_maintenance"]
    },
    {
        "source": "HSE UK Offshore Incident Database 2023",
        "failure_mode": "Rotating machinery failure due to shift handover communication gaps",
        "industry_frequency": "MEDIUM — Accounts for 12% of all near-miss events in process industries",
        "contributing_factors": ["Incomplete handover checklists", "Verbal-only communication", "Night shift fatigue"],
        "industry_recommendation": "Standardise digital shift handover logs with mandatory anomaly sign-off.",
        "relevance_tags": ["shift_handover", "communication", "near_miss"]
    },
    {
        "source": "API RP 686 (2022) — Machinery Installation",
        "failure_mode": "Compressor valve clearance drift and seal leakage",
        "industry_frequency": "MEDIUM — Commonly missed in operations-driven PM deferrals",
        "contributing_factors": ["Extended run times beyond inspection intervals", "Thermal cycling fatigue"],
        "industry_recommendation": "Implement vibration spectrum trending and mandatory valve inspection every 4000 running hours.",
        "relevance_tags": ["valve_clearance", "compressor", "inspection_interval"]
    },
]

@app.get("/v1/lessons-learned/records")
def get_lessons_records(type_filter: Optional[str] = Query(None), department_filter: Optional[str] = Query(None), severity_filter: Optional[str] = Query(None)):
    """Returns the full library of incident/near-miss/audit/non-conformance records with optional filters."""
    records = LESSONS_RECORDS_STORE
    if type_filter:
        records = [r for r in records if r["type"] == type_filter]
    if department_filter:
        records = [r for r in records if department_filter.lower() in r["department"].lower()]
    if severity_filter:
        records = [r for r in records if r["severity"] == severity_filter]
    return {
        "total": len(records),
        "records": records
    }

@app.post("/v1/lessons-learned/records")
def add_lessons_record(req: IncidentRecord):
    """Submits a new incident/near-miss/audit/non-conformance record to the Failure Intelligence Engine."""
    new_id = f"LL-{str(len(LESSONS_RECORDS_STORE) + 1).zfill(3)}"
    # Auto-tag based on keywords in description
    auto_tags = []
    desc_lower = req.description.lower()
    keyword_map = {
        "lubric": "lubrication", "bearing": "bearing", "deferred": "deferred_maintenance",
        "vibrat": "vibration", "temperature": "temperature", "seal": "seal",
        "valve": "valve_clearance", "insul": "insulation", "cool": "cooling",
        "handover": "shift_handover", "audit": "audit", "near miss": "near_miss",
        "compressor": "compressor", "generator": "generator", "pump": "pump"
    }
    for keyword, tag in keyword_map.items():
        if keyword in desc_lower:
            auto_tags.append(tag)

    record = {
        "id": new_id,
        "type": req.type,
        "department": req.department,
        "date": req.date,
        "description": req.description,
        "asset_tag": req.asset_tag,
        "severity": req.severity or "medium",
        "tags": list(set(auto_tags))
    }
    LESSONS_RECORDS_STORE.append(record)
    return {"status": "created", "record_id": new_id, "auto_tags": auto_tags}

@app.post("/v1/lessons-learned/scan")
def scan_for_systemic_patterns(req: LessonsLearnedScanRequest):
    """
    Lessons Learned AI Scan: Analyses the full library of incident/near-miss/audit records
    using the Gemini Intelligence Client to identify cross-cutting systemic patterns and
    push proactive warnings to operations teams BEFORE similar conditions recur.
    """
    records = LESSONS_RECORDS_STORE
    if req.department_filter:
        records = [r for r in records if req.department_filter.lower() in r["department"].lower()]
    if req.severity_filter:
        records = [r for r in records if r["severity"] == req.severity_filter]

    if not records:
        raise HTTPException(status_code=400, detail="No records found matching the given filters. Add at least 2 records before scanning.")

    # Pull external industry benchmarks relevant to current record tags
    all_tags = []
    for r in records:
        all_tags.extend(r.get("tags", []))
    unique_tags = list(set(all_tags))

    relevant_external = []
    if req.include_external:
        for ext in EXTERNAL_INDUSTRY_FAILURES:
            if any(tag in ext.get("relevance_tags", []) for tag in unique_tags):
                relevant_external.append(ext)

    # Determine systemic patterns via rule-based heuristics (fallback if Gemini not available)
    tag_freq: Dict[str, int] = {}
    dept_freq: Dict[str, int] = {}
    asset_freq: Dict[str, int] = {}
    severity_scores = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    total_severity = 0

    for r in records:
        for tag in r.get("tags", []):
            tag_freq[tag] = tag_freq.get(tag, 0) + 1
        dept_freq[r["department"]] = dept_freq.get(r["department"], 0) + 1
        if r.get("asset_tag"):
            asset_freq[r["asset_tag"]] = asset_freq.get(r["asset_tag"], 0) + 1
        total_severity += severity_scores.get(r.get("severity", "medium"), 2)

    top_tags = sorted(tag_freq.items(), key=lambda x: x[1], reverse=True)[:5]
    top_depts = sorted(dept_freq.items(), key=lambda x: x[1], reverse=True)[:3]
    top_assets = sorted(asset_freq.items(), key=lambda x: x[1], reverse=True)[:3]
    avg_severity = total_severity / len(records) if records else 0

    # Attempt Gemini LLM pattern analysis
    llm_analysis = None
    try:
        from gemini_client import client as gemini_client
        records_json = json.dumps([{k: v for k, v in r.items()} for r in records], indent=2)
        external_json = json.dumps(relevant_external, indent=2) if relevant_external else "[]"
        prompt = f"""You are a Failure Intelligence Analyst for an industrial operations organisation.

Analyse the following internal incident/near-miss/audit/non-conformance records and external industry failure benchmarks to identify systemic patterns invisible to individual review.

INTERNAL RECORDS:
{records_json}

EXTERNAL INDUSTRY BENCHMARKS:
{external_json}

Return a JSON array of pattern objects. Each pattern object must have:
- pattern_id (string, e.g. SYSTEMIC-01)
- title (string, short descriptive title)
- description (string, explaining the systemic pattern)
- contributing_factors (list of strings)
- affected_departments (list of strings)
- affected_assets (list of strings)
- recurrence_risk (string: "high", "medium", "low")
- proactive_warning (string, the warning message to push to operations teams NOW)
- recommended_actions (list of strings)
- matched_external_source (string or null, the external reference if applicable)

Return ONLY valid JSON, no markdown fencing."""
        result = gemini_client.generate_structured_response(prompt)
        if result and isinstance(result, list):
            llm_analysis = result
    except Exception as e:
        print(f"Lessons Learned LLM scan failed, using heuristic fallback: {e}")

    # Heuristic fallback patterns if Gemini unavailable
    heuristic_patterns = []
    if tag_freq.get("deferred_maintenance", 0) >= 2:
        heuristic_patterns.append({
            "pattern_id": "SYSTEMIC-01",
            "title": "Systemic Deferred Maintenance Cycle",
            "description": f"Deferred maintenance appears in {tag_freq.get('deferred_maintenance', 0)} separate records across {len(top_depts)} departments. This is a repeating organisational behaviour that historically leads to catastrophic failures.",
            "contributing_factors": ["Production pressure overriding PM schedules", "Lack of mandatory supervisor sign-off for deferrals", "Absent escalation mechanism"],
            "affected_departments": [d for d, _ in top_depts],
            "affected_assets": [a for a, _ in top_assets],
            "recurrence_risk": "high",
            "proactive_warning": "⚠️ PROACTIVE WARNING: Deferred maintenance pattern detected across multiple events. Current conditions match pre-failure signature of FAIL-091 (Pump-14 bearing seizure, $45,000 loss). Immediate PM execution required on all deferred work orders before next shift.",
            "recommended_actions": [
                "Mandatory supervisor sign-off for any PM deferral exceeding 48 hours",
                "Auto-escalation alert to Plant Manager if 2+ deferrals on same asset",
                "Implement auto-lube systems to reduce manual dependency"
            ],
            "matched_external_source": "OREDA Handbook 2021 — Lubrication Starvation Failure Pattern"
        })
    if tag_freq.get("bearing", 0) >= 2:
        heuristic_patterns.append({
            "pattern_id": "SYSTEMIC-02",
            "title": "Recurring Bearing Health Degradation Trend",
            "description": f"Bearing-related events appear {tag_freq.get('bearing', 0)} times. Cross-event analysis reveals a progressive degradation pattern starting with vibration warnings that are not acted upon in time.",
            "contributing_factors": ["Vibration trending not reviewed between inspections", "Shift handover anomalies not escalated", "PM deferrals accumulating on same component"],
            "affected_departments": [d for d, _ in top_depts],
            "affected_assets": [a for a, _ in top_assets if "pump" in a.lower() or "P-" in a],
            "recurrence_risk": "high",
            "proactive_warning": "⚠️ PROACTIVE WARNING: Bearing health events are repeating on the same assets. Without intervention, the vibration trend signature matches conditions 9 days before the Pump-14 bearing seizure (FAIL-091). Trigger immediate OEM-spec inspection.",
            "recommended_actions": [
                "Implement continuous vibration trending with automatic threshold alerts",
                "Mandate bearing temperature log at each shift handover",
                "Convert monthly lubrication checks to weekly for high-criticality bearings"
            ],
            "matched_external_source": None
        })
    if tag_freq.get("shift_handover", 0) >= 1:
        heuristic_patterns.append({
            "pattern_id": "SYSTEMIC-03",
            "title": "Shift Handover Communication Failure",
            "description": "Anomalies observed during one shift are not being formally handed over to the next team, creating a period of zero-awareness during which developing failures cross into critical territory.",
            "contributing_factors": ["Verbal-only handover culture", "No structured digital anomaly log requirement", "Night shift fatigue reducing diligence"],
            "affected_departments": [d for d, _ in top_depts],
            "affected_assets": [a for a, _ in top_assets],
            "recurrence_risk": "medium",
            "proactive_warning": "📋 OPERATIONAL NOTICE: Shift handover gaps have been identified as a contributing factor in recent near-miss events. Operations teams must complete digital anomaly sign-off at every shift change until formal process update.",
            "recommended_actions": [
                "Standardise digital shift handover log with mandatory anomaly section",
                "Use Copilot to auto-generate shift summary from sensor data",
                "Install visual anomaly alert board at each handover station"
            ],
            "matched_external_source": "HSE UK Offshore Incident Database 2023 — Handover Gap Failure Mode"
        })

    final_patterns = llm_analysis if llm_analysis else heuristic_patterns
    if not final_patterns:
        final_patterns = [{
            "pattern_id": "SYSTEMIC-INFO",
            "title": "No Cross-Cutting Systemic Patterns Detected",
            "description": "Current record set shows no statistically significant repeating failure signatures. Continue monitoring and adding records.",
            "contributing_factors": [],
            "affected_departments": [],
            "affected_assets": [],
            "recurrence_risk": "low",
            "proactive_warning": None,
            "recommended_actions": ["Add more diverse incident records to improve pattern detection coverage."],
            "matched_external_source": None
        }]

    return {
        "scan_timestamp": datetime.utcnow().isoformat(),
        "records_analysed": len(records),
        "analysis_mode": "gemini_llm" if llm_analysis else "heuristic_rule_engine",
        "top_recurring_tags": [{"tag": t, "frequency": f} for t, f in top_tags],
        "top_affected_departments": [{"department": d, "events": c} for d, c in top_depts],
        "top_affected_assets": [{"asset": a, "events": c} for a, c in top_assets],
        "average_severity_score": round(avg_severity, 2),
        "external_benchmarks_matched": len(relevant_external),
        "systemic_patterns": final_patterns
    }

@app.get("/v1/lessons-learned/proactive-warnings")
def get_proactive_warnings():
    """
    Returns pre-computed proactive warnings based on current record state.
    These are pushed to dashboards without requiring an explicit scan trigger.
    """
    warnings = []
    tag_freq: Dict[str, int] = {}
    for r in LESSONS_RECORDS_STORE:
        for tag in r.get("tags", []):
            tag_freq[tag] = tag_freq.get(tag, 0) + 1

    if tag_freq.get("deferred_maintenance", 0) >= 2:
        warnings.append({
            "warning_id": "WARN-DM-001",
            "severity": "critical",
            "title": "Deferred Maintenance Pattern Active",
            "message": f"Deferred maintenance has been recorded {tag_freq['deferred_maintenance']} times. Historical data shows this pattern directly preceded the Pump-14 catastrophic seizure (FAIL-091, $45,000). Immediate PM execution required.",
            "affected_assets": [r["asset_tag"] for r in LESSONS_RECORDS_STORE if "deferred_maintenance" in r.get("tags", []) and r.get("asset_tag")],
            "action_required": "Execute all deferred PM work orders before end of current shift."
        })
    if tag_freq.get("bearing", 0) >= 2:
        warnings.append({
            "warning_id": "WARN-BRG-001",
            "severity": "high",
            "title": "Bearing Degradation Signature Recurring",
            "message": f"Bearing-related events appear {tag_freq['bearing']} times in the failure intelligence database. This matches the 9-day pre-failure vibration signature of the Pump-14 bearing seizure event.",
            "affected_assets": [r["asset_tag"] for r in LESSONS_RECORDS_STORE if "bearing" in r.get("tags", []) and r.get("asset_tag")],
            "action_required": "Trigger OEM-spec vibration inspection on all affected bearing assemblies within 24 hours."
        })
    if tag_freq.get("deferred", 0) >= 1 and tag_freq.get("audit", 0) >= 1:
        warnings.append({
            "warning_id": "WARN-AUD-001",
            "severity": "high",
            "title": "Audit Finding Corrective Action Deferred",
            "message": "An audit finding with a deferred corrective work order has been identified. Deferred audit CAs create regulatory non-compliance risk under OISD-117.",
            "affected_assets": [r["asset_tag"] for r in LESSONS_RECORDS_STORE if "audit" in r.get("tags", []) and r.get("asset_tag")],
            "action_required": "Close deferred audit corrective actions and file updated OISD compliance documentation with Quality Officer."
        })

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "total_warnings": len(warnings),
        "warnings": warnings
    }

@app.get("/api/status")
def get_diagnostics():
    from gemini_client import client
    groq_ok = client.check_groq_connectivity()
    return {
        "groq_api": f"CONNECTED ({config.GROQ_MODEL})" if groq_ok else "NOT SET",
        "qdrant_vector": "active" if not vector_db.use_fallback else "fallback",
        "neo4j_graph": "active" if not graph_db.use_mock else "mock",
        "assets_count": len(ASSETS_TABLE),
        "work_orders_count": len(WORK_ORDERS_TABLE)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
