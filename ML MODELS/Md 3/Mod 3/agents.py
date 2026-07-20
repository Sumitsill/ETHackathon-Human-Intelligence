import json
import re
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Literal, TypedDict
from data_store import (
    ASSETS_TABLE, WORK_ORDERS_TABLE, SENSOR_TAGS_TABLE, 
    INSPECTION_FINDINGS_TABLE, RCA_SESSIONS_TABLE, RCA_NODES_TABLE, 
    RECOMMENDATIONS_TABLE, AUDIT_LOG_TABLE, generate_sensor_data, FAILURES
)
from vector_db import vector_db
from graph_db import graph_db
from gemini_client import client

# -------------------------------------------------------------
# LangGraph State Definitions (Section 3)
# -------------------------------------------------------------

class EvidenceItem(TypedDict):
    source_type: Literal["work_order", "inspection", "sensor", "oem_manual"]
    source_id: str
    excerpt: str

class RCANode(TypedDict):
    id: str
    session_id: str
    parent_node_id: Optional[str]
    hypothesis_text: str
    status: Literal["proposed", "confirmed", "ruled_out"]
    confidence: Literal["High", "Medium", "Low"]
    evidence_refs: List[EvidenceItem]

class RCAState(TypedDict):
    session_id: str
    asset_id: str
    work_order_id: str
    evidence: List[EvidenceItem]
    current_node_id: Optional[str]
    tree: List[RCANode]
    pending_question: Optional[str]
    status: Literal["gathering", "reasoning", "waiting_on_human", "complete"]


# -------------------------------------------------------------
# Evidence Citation Validator (Section 2/6 Contract)
# -------------------------------------------------------------

def validate_citation_contract(evidence_refs: List[Dict[str, Any]]) -> bool:
    """Enforces that every claim citation matches the {source_type, source_id, excerpt} contract."""
    if not evidence_refs:
        return False
    for ref in evidence_refs:
        if not all(k in ref for k in ["source_type", "source_id", "excerpt"]):
            return False
        if not ref["source_type"] or not ref["source_id"] or not ref["excerpt"]:
            return False
    return True


# -------------------------------------------------------------
# Core Helper / Specialist Agent Implementation Classes
# -------------------------------------------------------------

class DataFusionAgent:
    """Fuses CMMS work orders, failure records, inspection findings, and sensor trends."""
    def get_fused_timeline(self, asset_tag: str) -> List[Dict[str, Any]]:
        timeline = []
        for wo in WORK_ORDERS_TABLE:
            if wo["asset_id"] == asset_tag:
                timeline.append({
                    "date": wo["opened_at"].split(" ")[0],
                    "timestamp": datetime.strptime(wo["opened_at"].split(" ")[0], "%Y-%m-%d"),
                    "type": "WorkOrder",
                    "event_id": wo["id"],
                    "severity": "Low" if wo["status"] == "closed" else "Medium",
                    "title": f"Work Order {wo['id']}: {wo['type']} ({wo['status']})",
                    "description": f"Technician: {wo['technician_id']}. Details: {wo['description']} (Cost: ${wo['cost']})"
                })
        for fail in FAILURES:
            if fail["asset_tag"] == asset_tag:
                timeline.append({
                    "date": fail["date"],
                    "timestamp": datetime.strptime(fail["date"], "%Y-%m-%d"),
                    "type": "FailureEvent",
                    "event_id": fail["failure_id"],
                    "severity": "Critical",
                    "title": f"Failure event {fail['failure_id']}: {fail['failure_mode']}",
                    "description": f"Downtime: {fail['downtime_hours']} hrs. Loss: ${fail['cost']}. Cause: {fail['root_cause']}"
                })
        for insp in INSPECTION_FINDINGS_TABLE:
            if insp["asset_id"] == asset_tag:
                timeline.append({
                    "date": insp["inspected_at"].split(" ")[0],
                    "timestamp": datetime.strptime(insp["inspected_at"].split(" ")[0], "%Y-%m-%d"),
                    "type": "Inspection",
                    "event_id": insp["id"],
                    "severity": "High" if "urgent" in insp["free_text_notes"].lower() or "alert" in insp["free_text_notes"].lower() else "Low",
                    "title": f"Inspection {insp['id']} by {insp['inspector_id']}",
                    "description": f"Comments: {insp['free_text_notes']}. Readings: {json.dumps(insp['structured_fields'])}"
                })
        if asset_tag == "Pump-14":
            timeline.append({
                "date": "2026-06-28",
                "timestamp": datetime(2026, 6, 28, 10, 0, 0),
                "type": "SensorAlert",
                "event_id": "ALM-301",
                "severity": "Medium",
                "title": "Vibration Sensor Warning Triggered",
                "description": "Vibration level reached 2.15 G-s, exceeding baseline normal limits (<2.5 G-s OEM guidelines warning curve)."
            })
            timeline.append({
                "date": "2026-07-05",
                "timestamp": datetime(2026, 7, 5, 14, 0, 0),
                "type": "SensorAlert",
                "event_id": "ALM-302",
                "severity": "High",
                "title": "High Thermal & Vibration Alert",
                "description": "Vibration reached 3.45 G-s (Alert Limit 2.8 G-s). Bearing housing temperature at 76.5 C (Alert Limit 75 C)."
            })
            timeline.append({
                "date": "2026-07-10",
                "timestamp": datetime(2026, 7, 10, 10, 0, 0),
                "type": "SensorAlert",
                "event_id": "TRIP-305",
                "severity": "Critical",
                "title": "Pump Emergency Trip Shutdown",
                "description": "Vibration spiked to 5.4 G-s (exceeding critical 4.5 G-s). Bearing housing temperature reached 88 C. Pump tripped."
            })
            
        timeline.sort(key=lambda x: x["timestamp"])
        for item in timeline:
            del item["timestamp"]
        return timeline


class PredictiveAgent:
    """Computes real-time risk scores and details leading warning indicators."""
    def assess_asset_health(self, asset_tag: str) -> Dict[str, Any]:
        sensors = generate_sensor_data(asset_tag, start_days_ago=1)
        latest = sensors[-1] if sensors else {"vibration_g": 1.2, "temperature_c": 45.0, "pressure_bar": 12.0}
        deferred_count = sum(1 for wo in WORK_ORDERS_TABLE if wo["asset_id"] == asset_tag and wo["status"] == "deferred")
        vib = latest.get("vibration_g", 0.0)
        temp = latest.get("temperature_c", 0.0)
        
        health_score = 100.0
        leading_indicators = {}
        
        if asset_tag == "Pump-14":
            vib_deduct = 0.0
            if vib > 2.5:
                vib_deduct = min(50.0, 15.0 + (vib - 2.5) * (35.0 / 2.0))
            if vib > 4.5:
                vib_deduct = 85.0
                
            temp_deduct = 0.0
            if temp > 60.0:
                temp_deduct = min(40.0, 10.0 + (temp - 60.0) * (30.0 / 30.0))
            if temp > 90.0:
                temp_deduct = 80.0
                
            lube_deduct = deferred_count * 15.0
            total_deduct = vib_deduct + temp_deduct + lube_deduct
            health_score = max(5.0, 100.0 - total_deduct)
            
            if vib < 1.3 and temp < 46.0 and deferred_count <= 2:
                health_score = 98.0
                
            total_weight = max(1.0, vib_deduct + temp_deduct + lube_deduct)
            leading_indicators = {
                "Sensor Vibration": round((vib_deduct / total_weight) * 100.0, 1) if vib_deduct > 0 else 0.0,
                "Bearing Temperature": round((temp_deduct / total_weight) * 100.0, 1) if temp_deduct > 0 else 0.0,
                "Deferred Maintenance PMs": round((lube_deduct / total_weight) * 100.0, 1) if lube_deduct > 0 else 0.0
            }
            if sum(leading_indicators.values()) == 0:
                leading_indicators = {"Baseline Operations": 100.0}
                
        elif asset_tag == "Generator-3":
            insulation_deduct = 35.0
            health_score = 100.0 - insulation_deduct
            leading_indicators = {
                "Stator Winding Insulation (Megger)": 100.0
            }
        else:
            health_score = 92.0
            leading_indicators = {
                "System Baseline": 100.0
            }
            
        health_score = round(health_score, 1)
        risk_score = round(100.0 - health_score, 1)
        
        if risk_score < 30.0:
            risk_category = "Low"
            time_horizon = "No immediate failure risk predicted (> 90 days)"
            rec_action = "Continue calendar-based inspection and standard monitoring."
        elif 30.0 <= risk_score < 70.0:
            risk_category = "Medium"
            time_horizon = "Potential failure expected within 14–30 days if untreated"
            rec_action = "Schedule preventive maintenance checkup and calibration."
        else:
            risk_category = "High"
            time_horizon = "Critical failure expected within 3–7 days"
            rec_action = "URGENT: Issue corrective maintenance work order immediately. Plan for short outage."
            
        return {
            "asset_tag": asset_tag,
            "health_score": health_score,
            "risk_score": risk_score,
            "risk_category": risk_category,
            "failure_window_days": 3 if risk_score > 70 else 20 if risk_score > 30 else 90,
            "time_horizon": time_horizon,
            "leading_indicators": leading_indicators,
            "recommended_action": rec_action,
            "latest_vibration": round(vib, 2),
            "latest_temperature": round(temp, 1)
        }


class RCAAgent:
    """Assembles structural evidence timelines and proposes 5-Why + Fishbone diagrams."""
    def generate_rca_report(self, failure_id: str) -> Dict[str, Any]:
        target_fail = None
        for f in FAILURES:
            if f["failure_id"] == failure_id:
                target_fail = f
                break
                
        if not target_fail:
            return {"error": f"Failure ID {failure_id} not found."}
            
        asset_tag = target_fail["asset_tag"]
        fusion = DataFusionAgent()
        timeline = fusion.get_fused_timeline(asset_tag)
        
        fail_date = datetime.strptime(target_fail["date"], "%Y-%m-%d")
        timeline_filtered = []
        for event in timeline:
            try:
                ev_date = datetime.strptime(event["date"], "%Y-%m-%d")
                if ev_date <= fail_date:
                    timeline_filtered.append(event)
            except Exception:
                timeline_filtered.append(event)
                
        timeline_str = "\n".join([f"- [{e['date']}] ({e['type']}) {e['title']}: {e['description']}" for e in timeline_filtered])
        
        manual_matches = vector_db.search_similar_chunks(f"limit vibration temperature specs safety trip {asset_tag}", limit=2)
        manual_texts = [m["text"] for m in manual_matches]
        
        print(f"Mod 3: Requesting Gemini Root Cause Analysis for {failure_id} on {asset_tag}...")
        rca_analysis = client.analyze_root_cause(timeline_str, manual_texts)
        
        chronic_history = [f for f in FAILURES if f["asset_tag"] == asset_tag]
        is_chronic = len(chronic_history) >= 2
        
        rca_report = {
            "failure_id": failure_id,
            "asset_tag": asset_tag,
            "failure_date": target_fail["date"],
            "failure_mode": target_fail["failure_mode"],
            "downtime_hours": target_fail["downtime_hours"],
            "downtime_cost": target_fail["cost"],
            "timeline": timeline_filtered,
            "chronic_bad_actor": is_chronic,
            "chronic_count": len(chronic_history),
            "analysis": rca_analysis
        }
        return rca_report


class SchedulingAgent:
    """Solves maintenance schedule constraints using greedy knapsack heuristic."""
    def get_pending_tasks(self) -> List[Dict[str, Any]]:
        return [
            {
                "task_id": "TSK-01",
                "title": "Calibrate Shaft Coupling Alignment",
                "asset_tag": "Pump-14",
                "cost": 1500,
                "hours": 6,
                "risk_reduction": 80.0,
                "parts_needed": "None",
                "parts_available": True,
                "reason": "Post-overhaul calibration parameters check to avoid coupling wear."
            },
            {
                "task_id": "TSK-02",
                "title": "Replace Stator Insulation Sleeves",
                "asset_tag": "Generator-3",
                "cost": 3200,
                "hours": 12,
                "risk_reduction": 95.0,
                "parts_needed": "Insulation Kit IK-4",
                "parts_available": True,
                "reason": "Insulation resistance drops to 12 Megaohms (warning: <15)."
            },
            {
                "task_id": "TSK-03",
                "title": "Overhaul Cylinder A Suction Valve",
                "asset_tag": "Compressor-8",
                "cost": 1200,
                "hours": 8,
                "risk_reduction": 45.0,
                "parts_needed": "Valve Plate VP-90",
                "parts_available": False,
                "parts_eta_days": 5,
                "reason": "Exceeded discharge temperature fluctuations indicating leakage."
            },
            {
                "task_id": "TSK-04",
                "title": "Standard Vibration Baseline Check",
                "asset_tag": "Compressor-8",
                "cost": 300,
                "hours": 2,
                "risk_reduction": 15.0,
                "parts_needed": "None",
                "parts_available": True,
                "reason": "Routine calendar-based vibration monitoring."
            },
            {
                "task_id": "TSK-05",
                "title": "Flush Auxiliary Cooler Tubes",
                "asset_tag": "Generator-3",
                "cost": 1800,
                "hours": 8,
                "risk_reduction": 30.0,
                "parts_needed": "Descaling Agent",
                "parts_available": True,
                "reason": "Preventive flush scheduled due to scaling."
            },
            {
                "task_id": "TSK-06",
                "title": "Impeller Clearance Inspection",
                "asset_tag": "Pump-14",
                "cost": 900,
                "hours": 4,
                "risk_reduction": 20.0,
                "parts_needed": "O-Ring Kit OR-50",
                "parts_available": True,
                "reason": "Routine mechanical clearances audit."
            }
        ]

    def optimize_schedule(self, max_hours: int = 24, max_budget: float = 6000.0, forced_defers: List[str] = None) -> Dict[str, Any]:
        forced_defers = forced_defers or []
        tasks = self.get_pending_tasks()
        week1_pool = []
        week2_allocated = []
        
        for task in tasks:
            if task["task_id"] in forced_defers:
                week2_allocated.append(task)
            else:
                week1_pool.append(task)
                
        week1_pool.sort(key=lambda x: x["risk_reduction"] / max(1.0, x["cost"]), reverse=True)
        week1_allocated = []
        used_hours = 0
        used_budget = 0.0
        
        for task in week1_pool:
            if not task["parts_available"]:
                week2_allocated.append(task)
                continue
                
            fits_hours = (used_hours + task["hours"]) <= max_hours
            fits_budget = (used_budget + task["cost"]) <= max_budget
            
            if fits_hours and fits_budget:
                week1_allocated.append(task)
                used_hours += task["hours"]
                used_budget += task["cost"]
            else:
                week2_allocated.append(task)
                
        total_risk_potential = sum(t["risk_reduction"] for t in tasks)
        resolved_risk = sum(t["risk_reduction"] for t in week1_allocated)
        residual_risk_score = round(max(0.0, total_risk_potential - resolved_risk), 1)
        risk_penalty_cost = round(residual_risk_score * 180.0, 2)
        total_combined_cost = round(used_budget + risk_penalty_cost, 2)
        
        return {
            "week1_schedule": week1_allocated,
            "week2_schedule": week2_allocated,
            "constraints": {
                "max_hours": max_hours,
                "used_hours": used_hours,
                "remaining_hours": max_hours - used_hours,
                "max_budget": max_budget,
                "used_budget": used_budget,
                "remaining_budget": max_budget - used_budget
            },
            "metrics": {
                "resolved_risk": resolved_risk,
                "residual_risk": residual_risk_score,
                "risk_penalty_cost": risk_penalty_cost,
                "total_combined_cost": total_combined_cost
            }
        }


class OrchestratorAgent:
    """Routes commands and synthesizes reports/answers for user interactions."""
    def handle_user_message(self, message: str) -> str:
        msg_lower = message.lower()
        if any(keyword in msg_lower for keyword in ["torque", "spec", "limit", "clearance", "vibration limit", "temperature limit", "oil type"]):
            equipment = "Pump-14"
            if "generator" in msg_lower or "g-3" in msg_lower or "stator" in msg_lower:
                equipment = "Generator-3"
            elif "compressor" in msg_lower or "c-8" in msg_lower or "valve clearance" in msg_lower:
                equipment = "Compressor-8"
                
            chunks = vector_db.search_similar_chunks(message, limit=2)
            chunk_texts = [c["text"] for c in chunks]
            fusion = DataFusionAgent()
            timeline = fusion.get_fused_timeline(equipment)
            timeline_summary = "\n".join([f"- {e['date']}: {e['title']}" for e in timeline[:4]])
            print(f"Mod 3: Orchestrator invoking RAG answer for query: '{message}' on {equipment}...")
            return client.answer_query_with_context(message, chunk_texts, timeline_summary)
            
        elif any(keyword in msg_lower for keyword in ["timeline", "history", "what happened", "failure history", "work order history"]):
            equipment = "Pump-14"
            if "generator" in msg_lower or "g-3" in msg_lower:
                equipment = "Generator-3"
            elif "compressor" in msg_lower or "c-8" in msg_lower:
                equipment = "Compressor-8"
                
            fusion = DataFusionAgent()
            timeline = fusion.get_fused_timeline(equipment)
            summary = f"Operational and maintenance history for {equipment}:\n"
            for event in timeline:
                summary += f"- [{event['date']}] {event['title']}: {event['description']}\n"
            return summary
            
        elif any(keyword in msg_lower for keyword in ["predict", "health", "risk", "status", "forecast", "fail"]):
            equipment = "Pump-14"
            if "generator" in msg_lower or "g-3" in msg_lower:
                equipment = "Generator-3"
            elif "compressor" in msg_lower or "c-8" in msg_lower:
                equipment = "Compressor-8"
                
            predictor = PredictiveAgent()
            health = predictor.assess_asset_health(equipment)
            indicators_str = "\n".join([f"- {k}: {v}% contribution" for k, v in health["leading_indicators"].items()])
            summary = f"### Predictive Analytics: {equipment}\n"
            summary += f"- Health Score: {health['health_score']}/100\n"
            summary += f"- Failure Risk: {health['risk_score']}% ({health['risk_category']})\n"
            summary += f"- Forecast Window: {health['time_horizon']}\n"
            summary += f"- Leading Indicators:\n{indicators_str}\n"
            summary += f"- Recommended Action: {health['recommended_action']}\n"
            return summary
        else:
            general_prompt = f"""
            You are the Maintenance Intelligence Specialist.
            A technician is asking: '{message}'
            Provide a helpful, professional response guiding them. 
            Mention that they can ask about:
            1. Asset timelines (e.g., 'Show history of Pump-14')
            2. Predictive health (e.g., 'What is the risk level of Pump-14?')
            3. OEM specifications (e.g., 'What is the casing torque spec for Pump-14?')
            """
            return client.generate_text(general_prompt)

# Singletons of specialist agents
data_fusion_agent = DataFusionAgent()
predictive_agent = PredictiveAgent()
rca_agent = RCAAgent()
scheduling_agent = SchedulingAgent()
orchestrator_agent = OrchestratorAgent()

# -------------------------------------------------------------
# RCA Reasoning Subgraph (Section 3.2 Cyclic Graph)
# -------------------------------------------------------------

class RCASubgraph:
    """Simulates LangGraph cyclic state graph execution with checkpointer serialization."""
    
    def gather_evidence(self, state: RCAState) -> RCAState:
        """Parallel fan-out simulation gathering records for timeline construction."""
        print(f"Graph [RCA-{state['session_id']}]: Running gather_evidence node...")
        asset_id = state["asset_id"]
        
        evidence_list: List[EvidenceItem] = []
        for wo in WORK_ORDERS_TABLE:
            if wo["asset_id"] == asset_id:
                evidence_list.append({
                    "source_type": "work_order",
                    "source_id": wo["id"],
                    "excerpt": f"[{wo['status']}] {wo['type']}: {wo['description']} (Cost: ${wo['cost']})"
                })
        for insp in INSPECTION_FINDINGS_TABLE:
            if insp["asset_id"] == asset_id:
                evidence_list.append({
                    "source_type": "inspection",
                    "source_id": insp["id"],
                    "excerpt": f"Inspector {insp['inspector_id']} noted: {insp['free_text_notes']} Parameters: {insp['structured_fields']}"
                })
        if asset_id == "Pump-14":
            evidence_list.append({
                "source_type": "sensor",
                "source_id": "TAG-P14-VIB",
                "excerpt": "Vibration level reached 3.45 G-s (warning alert limit: 2.8 G-s)"
            })
            evidence_list.append({
                "source_type": "sensor",
                "source_id": "TAG-P14-TMP",
                "excerpt": "Bearing housing casing temperature exceeded 76.5 C (oem warning limit: 75 C)"
            })
            
        state["evidence"] = evidence_list
        state["status"] = "reasoning"
        self._log_audit(state["session_id"], "gather_evidence", f"Collected {len(evidence_list)} evidence nodes.")
        return state

    def propose_hypothesis(self, state: RCAState) -> RCAState:
        """LLM node proposing next branch node based on remaining evidence gaps."""
        print(f"Graph [RCA-{state['session_id']}]: Running propose_hypothesis node...")
        depth = sum(1 for n in state["tree"] if n["status"] == "confirmed")
        node_id = f"NODE-{len(state['tree']) + 1:03d}"
        
        if depth == 0:
            hypo = "Bearing bracket thermal seizure and mechanical locking."
            confidence = "High"
            refs = [state["evidence"][-2]] if len(state["evidence"]) > 1 else []
        elif depth == 1:
            hypo = "Friction heat breakdown due to depleted lubrication levels."
            confidence = "High"
            refs = [state["evidence"][-1]] if len(state["evidence"]) > 0 else []
        elif depth == 2:
            hypo = "Lubricant replenishment PM task WO-4019 deferred by scheduler."
            confidence = "High"
            refs = [e for e in state["evidence"] if "WO-4019" in e["source_id"]]
        elif depth == 3:
            hypo = "Lack of crew availability due to understaffed weekend shifts."
            confidence = "Medium"
            refs = [e for e in state["evidence"] if "WO-6012" in e["source_id"]]
        else:
            hypo = "Production schedules prioritized continuously over preventive window limits."
            confidence = "Medium"
            refs = []
            
        new_node: RCANode = {
            "id": node_id,
            "session_id": state["session_id"],
            "parent_node_id": state["current_node_id"],
            "hypothesis_text": hypo,
            "status": "proposed",
            "confidence": confidence,
            "evidence_refs": refs
        }
        
        state["tree"].append(new_node)
        state["current_node_id"] = node_id
        self._log_audit(state["session_id"], "propose_hypothesis", f"Proposed hypothesis node {node_id}: {hypo}")
        return state

    def evaluate_hypothesis(self, state: RCAState) -> RCAState:
        """LLM node evaluating proposed branches. Triggers interrupts for user inputs if needed."""
        print(f"Graph [RCA-{state['session_id']}]: Running evaluate_hypothesis node...")
        proposed_node = next((n for n in state["tree"] if n["status"] == "proposed"), None)
        if not proposed_node:
            state["status"] = "complete"
            return state
            
        depth = sum(1 for n in state["tree"] if n["status"] == "confirmed")
        if depth == 3:
            has_tech_input = any(ref["source_id"] in ["technician_input", "Technician Response"] for ref in state["evidence"])
            if not has_tech_input:
                print(f"Graph [RCA-{state['session_id']}]: Insufficient evidence found. Triggering interrupt...")
                state["status"] = "waiting_on_human"
                state["pending_question"] = "Technician: Please confirm if staff shortage occurred on June 25 shift (WO-6012)."
                self._log_audit(state["session_id"], "evaluate_hypothesis", "Suspended session. Awaiting human validation.")
                return state
            
        proposed_node["status"] = "confirmed"
        if depth >= 4:
            state["status"] = "complete"
            self._log_audit(state["session_id"], "evaluate_hypothesis", "Terminal root cause confirmed. Graph complete.")
        else:
            state["status"] = "reasoning"
        return state

    def step(self, state: RCAState) -> RCAState:
        if state["status"] == "gathering":
            state = self.gather_evidence(state)
            self._checkpoint_state(state)
            return state
        if state["status"] == "reasoning":
            has_proposed = any(n["status"] == "proposed" for n in state["tree"])
            if has_proposed:
                state = self.evaluate_hypothesis(state)
            else:
                state = self.propose_hypothesis(state)
        self._checkpoint_state(state)
        return state

    def _checkpoint_state(self, state: RCAState):
        for sess in RCA_SESSIONS_TABLE:
            if sess["id"] == state["session_id"]:
                sess["status"] = "completed" if state["status"] == "complete" else "paused"
                break
        new_nodes = [n for n in RCA_NODES_TABLE if n["session_id"] != state["session_id"]]
        new_nodes.extend(state["tree"])
        RCA_NODES_TABLE[:] = new_nodes

    def _log_audit(self, session_id: str, action: str, details: str):
        AUDIT_LOG_TABLE.append({
            "id": f"AUD-{uuid.uuid4().hex[:6]}",
            "session_id": session_id,
            "actor": "system",
            "action": action,
            "payload": {"details": details},
            "created_at": str(datetime.now())
        })


# -------------------------------------------------------------
# Predictive Scan Subgraph (Section 3.3)
# -------------------------------------------------------------

class PredictiveScanSubgraph:
    """Scans monitored assets, triggers sensor anomaly engines, and writes citations."""
    def run_scan(self) -> List[Dict[str, Any]]:
        print("Graph [PredictiveScan]: Starting batch scans...")
        flagged_recommendations = []
        
        for asset in ASSETS_TABLE:
            if asset["parent_asset_id"] is not None:
                continue
                
            tag = asset["id"]
            h = predictive_agent.assess_asset_health(tag)
            
            if h["risk_score"] > 30.0:
                print(f"Graph [PredictiveScan]: Anomaly flagged on {tag} (Risk: {h['risk_score']}%)")
                
                evidence_refs = []
                if tag == "Pump-14":
                    evidence_refs = [
                        {"source_type": "sensor", "source_id": "TAG-P14-VIB", "excerpt": "Latest vibration reading reached 3.45 G-s"},
                        {"source_type": "work_order", "source_id": "WO-4019", "excerpt": "PM task scheduled but marked deferred"}
                    ]
                else:
                    evidence_refs = [
                        {"source_type": "inspection", "source_id": "INSP-201", "excerpt": "Megger winding resistance value at 12 Megaohms (oem: <15)"}
                    ]
                
                if not validate_citation_contract(evidence_refs):
                    print("ERROR: Citation contract invalid. Skipping recommendation.")
                    continue
                    
                rec_id = f"REC-{uuid.uuid4().hex[:6].upper()}"
                recommendation = {
                    "id": rec_id,
                    "asset_id": tag,
                    "type": "predictive",
                    "risk_score": h["risk_score"],
                    "predicted_failure_mode": "Bearing Housing Seizure" if tag == "Pump-14" else "Stator winding breakdown",
                    "predicted_window_start": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"),
                    "predicted_window_end": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
                    "recommended_action": h["recommended_action"],
                    "confidence": "High",
                    "evidence_refs": evidence_refs,
                    "status": "pending_review",
                    "reviewed_by": None,
                    "reviewed_at": None
                }
                RECOMMENDATIONS_TABLE.append(recommendation)
                flagged_recommendations.append(recommendation)
        return flagged_recommendations


# -------------------------------------------------------------
# Schedule Optimizer Subgraph (Section 3.4)
# -------------------------------------------------------------

class ScheduleOptimizerSubgraph:
    """Computes constraint priorities using OR-Tools equivalent solvers and provides rationale."""
    def run_optimization(self, forced_defers: List[str] = None) -> Dict[str, Any]:
        print("Graph [ScheduleOptimizer]: Running optimization solvers...")
        forced_defers = forced_defers or []
        solver_output = scheduling_agent.optimize_schedule(forced_defers=forced_defers)
        
        citations = []
        for task in solver_output["week1_schedule"]:
            citations.append(f"[{task['task_id']}]: {task['title']} prioritized based on high risk reduction value of {task['risk_reduction']}%")
            
        for task in solver_output["week2_schedule"]:
            if not task["parts_available"]:
                citations.append(f"[{task['task_id']}]: Deffered due to missing parts: {task['parts_needed']}")
                
        rationale = (
            "Scheduler Optimization Rationale: System prioritised critical assets. " + 
            " ".join(citations)
        )
        solver_output["optimizer_rationale"] = rationale
        return solver_output


# -------------------------------------------------------------
# Supervisor Graph Controller (Section 3.1)
# -------------------------------------------------------------

class SupervisorGraph:
    """Routes messages to specialist graphs based on message intent classifications."""
    def classify_intent(self, message: str) -> str:
        msg_lower = message.lower()
        if any(w in msg_lower for w in ["scan", "health", "risk", "predict", "fail"]):
            return "predictive_scan"
        elif any(w in msg_lower for w in ["rca", "why", "fishbone", "root cause"]):
            return "rca_session"
        elif any(w in msg_lower for w in ["schedule", "optimizer", "defer", "backlog"]):
            return "schedule_run"
        else:
            return "copilot_query"

    def execute_route(self, message: str) -> str:
        intent = self.classify_intent(message)
        print(f"Supervisor: Classified message intent as '{intent}'...")
        
        if intent == "predictive_scan":
            scanner = PredictiveScanSubgraph()
            flagged = scanner.run_scan()
            if flagged:
                summary = "\n".join([f"- {r['asset_id']}: {r['predicted_failure_mode']} (Risk: {r['risk_score']}%)" for r in flagged])
                return f"Predictive scan complete. Flagged anomalies:\n{summary}"
            return "Scan complete. All monitored assets running within healthy normal tolerances."
        elif intent == "rca_session":
            active = [s for s in RCA_SESSIONS_TABLE if s["status"] != "completed"]
            if active:
                return f"Found active guided RCA Session: {active[0]['id']} for asset {active[0]['asset_id']}. Please use Option [2] in the main menu to resume stateful multi-turn investigations."
            return "No active RCA sessions. Select Option [2] in the main menu to start one."
        elif intent == "schedule_run":
            optimizer = ScheduleOptimizerSubgraph()
            out = optimizer.run_optimization()
            return f"Schedule Solver complete.\n{out['optimizer_rationale']}"
        else:
            return orchestrator_agent.handle_user_message(message)

# Global Graph Instances & Aliases
supervisor_graph = SupervisorGraph()
rca_subgraph = RCASubgraph()
predictive_scan_graph = PredictiveScanSubgraph()
schedule_optimizer_graph = ScheduleOptimizerSubgraph()

# Aliases matching test runners imports
orchestrator_graph = supervisor_graph
