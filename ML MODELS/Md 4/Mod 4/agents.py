import json
import uuid
import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import data_store
from vector_db import vector_db
from graph_db import graph_db
from gemini_client import client

# -------------------------------------------------------------
# Citation Validator (Section 2/6 / FR-9 Contract)
# -------------------------------------------------------------

def validate_citation_contract(evidence_refs: List[Dict[str, Any]]) -> bool:
    """Enforces that every claim citation matches the {source_type, source_id, excerpt} contract."""
    if not evidence_refs:
        return False
    for ref in evidence_refs:
        if not isinstance(ref, dict):
            return False
        if not all(k in ref for k in ["source_type", "source_id", "excerpt"]):
            return False
        if not ref["source_type"] or not ref["source_id"] or not ref["excerpt"]:
            return False
    return True

# -------------------------------------------------------------
# UC-1: Continuous Compliance Gap Analysis Subgraph
# -------------------------------------------------------------

class ComplianceGapAnalysisSubgraph:
    """Orchestrates continuous scans mapping requirements to assets and evaluating gaps."""
    
    def evaluate_numeric_threshold(self, value: float, threshold: Dict[str, Any]) -> Tuple[str, str]:
        """Runs a deterministic rules engine comparison. Never delegated to LLM (Section 10/12)."""
        operator = threshold.get("operator", "")
        limit_val = threshold.get("value")
        unit = threshold.get("unit", "")
        param = threshold.get("parameter", "")
        
        status = "compliant"
        explanation = f"Value {value} {unit} is within normal parameters."
        
        if operator == "<=":
            if value > limit_val:
                status = "gap"
                explanation = f"Value {value} {unit} exceeds maximum limit of {limit_val} {unit} (over limit)."
            else:
                explanation = f"Value {value} {unit} satisfies limit of <= {limit_val} {unit}."
        elif operator == ">=":
            if value < limit_val:
                status = "gap"
                explanation = f"Value {value} {unit} is below minimum requirement of {limit_val} {unit}."
            else:
                explanation = f"Value {value} {unit} satisfies limit of >= {limit_val} {unit}."
        elif operator == "between":
            if not isinstance(limit_val, list) or len(limit_val) < 2:
                status = "insufficient_evidence"
                explanation = "Invalid threshold range configuration."
            else:
                low, high = limit_val[0], limit_val[1]
                if value < low or value > high:
                    status = "gap"
                    explanation = f"Value {value} {unit} falls outside allowed range [{low}, {high}] {unit}."
                else:
                    explanation = f"Value {value} {unit} is within allowed range [{low}, {high}] {unit}."
                    
        return status, explanation

    def run_compliance_scan(self, actor: str = "system") -> List[Dict[str, Any]]:
        """Scans all requirements, gathers evidence, performs checks, and registers gap reports."""
        print("Mod 4: Running continuous compliance scan...")
        requirements = data_store.get_requirements()
        assets = data_store.get_all_assets()
        gap_results = []
        
        for req in requirements:
            app_rules = req["applicability_rules"] or {}
            target_asset_class = app_rules.get("asset_class")
            target_area = app_rules.get("facility_area")
            
            # Identify matched assets
            matched_assets = []
            for asset in assets:
                if target_asset_class and asset["asset_class"] == target_asset_class:
                    matched_assets.append(asset)
                elif target_area and asset["location"] == target_area:
                    matched_assets.append(asset)
                    
            # If no specific applicability filters, it applies generally (or to CDU-1 as general area)
            if not target_asset_class and not target_area:
                matched_assets = [None] # Plant-level general requirement
                
            for asset in matched_assets:
                asset_id = asset["id"] if asset else None
                asset_class = asset["asset_class"] if asset else "General Plant"
                
                # Gather evidence
                findings = data_store.get_inspection_findings(asset_id)
                wos = data_store.get_work_orders(asset_id)
                
                evidence_refs = []
                status = "insufficient_evidence"
                confidence = "Low"
                narrative = "No evidence found to support compliance."
                
                numeric_thresh = req["numeric_threshold"]
                
                # Case A: Numeric threshold check
                if numeric_thresh:
                    # Find latest inspection with telemetry data
                    latest_finding = None
                    param_name = numeric_thresh.get("parameter", "")
                    
                    for f in sorted(findings, key=lambda x: x["inspected_at"], reverse=True):
                        try:
                            fields = json.loads(f["structured_fields"]) if f["structured_fields"] else {}
                            if param_name in fields:
                                latest_finding = f
                                break
                        except Exception:
                            continue
                            
                    if latest_finding:
                        fields = json.loads(latest_finding["structured_fields"])
                        param_value = float(fields[param_name])
                        
                        # Deterministic Check
                        status, det_explanation = self.evaluate_numeric_threshold(param_value, numeric_thresh)
                        confidence = "High"
                        
                        evidence_refs = [{
                            "source_type": "inspection",
                            "source_id": latest_finding["id"],
                            "excerpt": f"Parameter '{param_name}' reading recorded as {param_value} in inspection notes: '{latest_finding['free_text_notes']}'"
                        }]
                        
                        # LLM narrates the check result
                        prompt = f"""
                        Requirement: {req['obligation_text']}
                        Threshold rule: {json.dumps(numeric_thresh)}
                        Actual Value: {param_value} on asset {asset_id or 'Plant'}
                        Deterministic Check Outcome: {det_explanation} (Status: {status})
                        
                        Narrate this compliance finding in 2-3 sentences. Cite the inspection report ID {latest_finding['id']}.
                        State whether it is compliant or a compliance gap based on the check outcome.
                        """
                        narrative = client.generate_text(prompt, system_instruction="You are a compliance narrator. Explain the findings clearly.")
                    else:
                        status = "insufficient_evidence"
                        confidence = "Low"
                        narrative = f"No recent telemetry found for parameter '{param_name}' to evaluate compliance threshold."
                        evidence_refs = []
                
                # Case B: Qualitative check (LLM-evaluated)
                else:
                    # Compile evidence logs
                    evidence_texts = []
                    
                    # Gather inspection findings
                    for f in findings[:3]: # last 3 findings
                        evidence_texts.append(f"[INSPECTION ID: {f['id']}] Date: {f['inspected_at']}. Notes: {f['free_text_notes']}")
                        evidence_refs.append({
                            "source_type": "inspection",
                            "source_id": f["id"],
                            "excerpt": f["free_text_notes"][:150]
                        })
                        
                    # Gather work orders
                    for wo in wos[:3]: # last 3 work orders
                        evidence_texts.append(f"[WORK ORDER ID: {wo['id']}] Status: {wo['status']}. Details: {wo['description']}. Permit ID: {wo['permit_id'] or 'None'}")
                        evidence_refs.append({
                            "source_type": "work_order",
                            "source_id": wo["id"],
                            "excerpt": f"Status: {wo['status']}, Description: {wo['description']}, Permit: {wo['permit_id']}"[:150]
                        })
                        
                    evidence_payload = "\n".join(evidence_texts)
                    
                    prompt = f"""
                    You are assessing compliance for:
                    Requirement Clause: {req['clause_id']}
                    Obligation Text: {req['obligation_text']}
                    Asset Class: {asset_class} (ID: {asset_id or 'Plant-level'})
                    
                    Here are recent plant maintenance records and inspection findings for this asset:
                    {evidence_payload}
                    
                    Based on the evidence payload:
                    1. Determine if the obligation text is satisfied.
                       - 'compliant' if all safeguards are active.
                       - 'gap' if there is an active safety violation or safeguards are missing (e.g. loose flameproof casing bolts on a motor, missing coupling guard on a pump, or missing Work Permit for hot welding).
                       - 'partial' if partially satisfied.
                       - 'insufficient_evidence' if no relevant checks were recorded.
                    2. Provide a 2-3 sentence defensible, cited explanation of why.
                    3. Output your reasoning in raw JSON format matching this schema:
                    {{
                        "status": "compliant" | "gap" | "partial" | "insufficient_evidence",
                        "confidence": "High" | "Medium" | "Low",
                        "explanation": "Detailed explanation citing specific inspection IDs or work order IDs"
                    }}
                    Do not add markdown formatting wrappers or other text, just the raw JSON.
                    """
                    
                    sys_instruction = "You are a Quality and Safety compliance auditor. Ground all claims in specific IDs. Output raw JSON."
                    try:
                        raw_response = client.generate_text(prompt, system_instruction=sys_instruction, response_json=True)
                        # Ensure response starts like JSON
                        if not raw_response.strip().startswith("{") and not raw_response.strip().startswith("["):
                            raise Exception(raw_response)
                        # Clean code block wrapping
                        raw_response = re.sub(r"^```json\s*", "", raw_response, flags=re.IGNORECASE)
                        raw_response = re.sub(r"\s*```$", "", raw_response, flags=re.IGNORECASE)
                        res = json.loads(raw_response)
                        
                        status = res.get("status", "insufficient_evidence")
                        confidence = res.get("confidence", "Medium")
                        narrative = res.get("explanation", "Evaluated by LLM.")
                    except Exception as e:
                        print(f"Qualitative LLM audit failed for {req['id']}: {e}")
                        status = "insufficient_evidence"
                        confidence = "Low"
                        narrative = f"Compliance evaluation failed: {e}"
                
                # Make sure evidence refs meet the contract
                if not evidence_refs:
                    evidence_refs = [{
                        "source_type": "regulation",
                        "source_id": req["regulation_id"],
                        "excerpt": f"Evaluation of clause: {req['obligation_text'][:50]}"
                    }]
                elif not validate_citation_contract(evidence_refs):
                    # sanitize to ensure valid format
                    evidence_refs = [
                        {
                            "source_type": ref.get("source_type", "inspection"),
                            "source_id": ref.get("source_id", "Unknown"),
                            "excerpt": ref.get("excerpt", "Details of findings") or "N/A"
                        }
                        for ref in evidence_refs if ref.get("source_id")
                    ]
                    if not evidence_refs:
                        evidence_refs = [{
                            "source_type": "regulation",
                            "source_id": req["regulation_id"],
                            "excerpt": req["obligation_text"]
                        }]

                gap_id = f"GAP-{uuid.uuid4().hex[:6].upper()}"
                data_store.insert_gap_analysis(
                    gap_id=gap_id,
                    requirement_id=req["id"],
                    asset_id=asset_id,
                    run_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    status=status,
                    confidence=confidence,
                    evidence_refs=evidence_refs,
                    review_status="draft"
                )
                
                gap_results.append({
                    "id": gap_id,
                    "requirement_id": req["id"],
                    "clause_id": req["clause_id"],
                    "asset_id": asset_id,
                    "status": status,
                    "confidence": confidence,
                    "evidence_refs": evidence_refs,
                    "explanation": narrative
                })
                
        # Log to audit trail
        data_store.log_audit(
            action="continuous_compliance_scan",
            actor=actor,
            payload={"requirements_scanned": len(requirements), "gaps_flagged": sum(1 for g in gap_results if g["status"] == "gap")}
        )
        return gap_results

# -------------------------------------------------------------
# UC-2: Audit Evidence Package Generation Subgraph
# -------------------------------------------------------------

class EvidencePackageSubgraph:
    """Assembles evidence records, links, and LLM narratives into a structured PDF/JSON package."""
    
    def generate_package(self, scope: Dict[str, Any], requested_by: str) -> Dict[str, Any]:
        print(f"Mod 4: Generating evidence package for scope: {scope} requested by {requested_by}...")
        
        regulator = scope.get("regulator")
        standard_id = scope.get("standard")
        facility_area = scope.get("facility_area")
        
        # Get all gap analyses
        gaps = data_store.get_gap_analyses()
        requirements = data_store.get_requirements()
        regulations = data_store.get_regulations()
        
        req_map = {r["id"]: r for r in requirements}
        reg_map = {reg["id"]: reg for reg in regulations}
        
        package_contents = []
        
        for g in gaps:
            req_id = g["requirement_id"]
            req = req_map.get(req_id)
            if not req:
                continue
                
            reg = reg_map.get(req["regulation_id"])
            if not reg:
                continue
                
            # Apply scope filters
            if regulator and reg["source_body"].lower() != regulator.lower():
                continue
            if standard_id and req["regulation_id"].lower() != standard_id.lower():
                continue
            if facility_area:
                # Resolve asset location
                asset = data_store.get_asset_by_id(g["asset_id"]) if g["asset_id"] else None
                if asset and asset["location"].lower() != facility_area.lower():
                    continue
                elif not asset and facility_area.lower() not in ["cdu-1", "general", "all"]:
                    # general requirements only match cdu-1/general
                    continue
            
            package_contents.append({
                "requirement_id": req_id,
                "gap_analysis_id": g["id"],
                "clause_id": req["clause_id"],
                "obligation_text": req["obligation_text"],
                "status": g["status"],
                "evidence_record_refs": g["evidence_refs"]
            })
            
        # Run LLM to compose a professional narrative summary
        content_summaries = []
        for c in package_contents:
            evidence_str = ", ".join([f"{ref['source_type']}:{ref['source_id']}" for ref in c["evidence_record_refs"]])
            content_summaries.append(
                f"- Clause {c['clause_id']} [{c['status'].upper()}]: {c['obligation_text'][:60]}... Evidence: [{evidence_str}]"
            )
        
        summary_payload = "\n".join(content_summaries)
        
        prompt = f"""
        Compose an executive summary for a regulatory compliance audit evidence package.
        Requested Scope: {json.dumps(scope)}
        
        Summary of audited requirements and evidence:
        {summary_payload}
        
        Write a 3-4 sentence professional executive summary addressed to inspectors/compliance officers.
        Summarize the current compliance levels (noting any gaps or missing safeguards) and state that all cited evidence logs are attached and traceable.
        Include a warning disclaimer: "This report is a compiled draft for human review. SPCB variations are not pre-loaded; local environmental limits must be manually validated."
        """
        
        summary_narrative = client.generate_text(prompt, system_instruction="You are a Senior regulatory affairs advisor.")
        
        pkg_id = f"PKG-{uuid.uuid4().hex[:6].upper()}"
        data_store.insert_evidence_package(
            pkg_id=pkg_id,
            scope=scope,
            requested_by=requested_by,
            generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            status="draft",
            contents=package_contents,
            summary=summary_narrative
        )
        
        # Log to audit trail
        data_store.log_audit(
            action="generate_evidence_package",
            actor=requested_by,
            payload={"package_id": pkg_id, "scope": scope, "items_count": len(package_contents)}
        )
        
        return {
            "id": pkg_id,
            "scope": scope,
            "status": "draft",
            "summary": summary_narrative,
            "contents": package_contents
        }

# -------------------------------------------------------------
# UC-3: Quality Deviation Detection Subgraph
# -------------------------------------------------------------

class DeviationDetectionSubgraph:
    """Monitors incoming telemetry and inspection inputs, detects tolerances off-spec, and routes contextual alerts."""
    
    def check_and_alert_deviation(self, source_type: str, record_id: str, asset_id: str, parameter: str, value: Any) -> Optional[Dict[str, Any]]:
        """Checks a single parameter value against active regulations and logs deviations."""
        print(f"Mod 4: Check quality deviation: {asset_id} -> {parameter} = {value}")
        
        requirements = data_store.get_requirements()
        matched_req = None
        
        # Identify requirement matching the parameter
        for req in requirements:
            thresh = req["numeric_threshold"]
            if thresh and thresh.get("parameter", "").lower() == parameter.lower():
                matched_req = req
                break
                
        if not matched_req:
            # Check qualitative requirements if parameters match (e.g. coupling_guard, safety_valve_check, flp_casing)
            if parameter in ["coupling_guard", "safety_valve_check", "flp_casing"]:
                for req in requirements:
                    if parameter == "coupling_guard" and "fenced" in req["obligation_text"].lower():
                        matched_req = req
                        break
                    elif parameter == "safety_valve_check" and "safety valves" in req["obligation_text"].lower():
                        matched_req = req
                        break
                    elif parameter == "flp_casing" and "flameproof" in req["obligation_text"].lower():
                        matched_req = req
                        break
                        
        if not matched_req:
            return None
            
        is_deviation = False
        description = ""
        
        # Numeric threshold evaluation
        thresh = matched_req["numeric_threshold"]
        if thresh:
            operator = thresh.get("operator", "")
            limit_val = thresh.get("value")
            unit = thresh.get("unit", "")
            
            try:
                val_float = float(value)
                if operator == "<=" and val_float > limit_val:
                    is_deviation = True
                    description = f"Telemetry parameter '{parameter}' reached {val_float} {unit}, exceeding CPCB threshold of {limit_val} {unit}."
                elif operator == ">=" and val_float < limit_val:
                    is_deviation = True
                    description = f"Telemetry parameter '{parameter}' fell to {val_float} {unit}, violating requirement of >= {limit_val} {unit}."
                elif operator == "between" and isinstance(limit_val, list):
                    low, high = limit_val[0], limit_val[1]
                    if val_float < low or val_float > high:
                        is_deviation = True
                        description = f"Telemetry parameter '{parameter}' is {val_float} {unit}, which falls outside CPCB range limit [{low}, {high}] {unit}."
            except Exception as e:
                print(f"Error parsing numeric telemetry check: {e}")
                return None
        else:
            # Qualitative evaluation
            if parameter == "coupling_guard" and value == "MISSING":
                is_deviation = True
                description = "Coupling guard not installed on crude charge pump, violating machinery fencing safeguards (Factories Act Sec 21)."
            elif parameter == "safety_valve_check" and value == "FAILED":
                is_deviation = True
                description = "Safety valve certification for pressure vessel is expired/overdue, violating annual testing rules (PESO Rule 122)."
            elif parameter == "flp_casing" and value == "COMPROMISED":
                is_deviation = True
                description = "Loose junction box bolts compromise flameproof enclosure integrity in hazardous gas bay (PESO Rule 105)."
                
        if not is_deviation:
            return None
            
        # Trigger LLM-assisted severity and description generation
        # Integrate with MIRA failure/maintenance history
        mira_context = ""
        past_wos = data_store.get_work_orders(asset_id)
        past_seizures = [wo for wo in past_wos if wo.get("failure_code") == "SEIZURE" or "seized" in wo.get("description", "").lower()]
        
        if past_seizures:
            mira_context = f"Asset {asset_id} has a history of catastrophic seizure (MIRA WO Ref: {past_seizures[0]['id']} - Cause: LUBE_FAIL)."
            
        prompt = f"""
        You are a Quality and Process Safety Manager at a hydrocarbon refinery.
        A deviation has been detected:
        Asset ID: {asset_id}
        Parameter: {parameter}
        Value: {value}
        Standard Violated: Clause '{matched_req['clause_id']}' - {matched_req['obligation_text']}
        Description: {description}
        MIRA History Context: {mira_context}
        
        Assess the severity class ('critical', 'major', or 'minor') and describe the operational hazard and mitigation action in 2 sentences.
        - 'critical': immediate environmental release over daily legal limit (e.g. CPCB pH/BOD/COD discharge) or severe fire/explosive risk (expired safety valve on LPG, loose flameproof casing).
        - 'major': safety guards missing (missing coupling guard), or warning alarms exceeded.
        - 'minor': minor record keeping delays.
        
        Response must be in raw JSON matching the following schema:
        {{
            "severity": "critical" | "major" | "minor",
            "hazard_analysis": "Operational hazard statement citing regulations",
            "remedial_action": "Action to fix deviation"
        }}
        Do not add markdown formatting wrappers or other text, just the raw JSON.
        """
        
        severity = "major"
        hazard_desc = description
        
        try:
            raw_response = client.generate_text(prompt, system_instruction="You are a safety assessor. Output raw JSON.", response_json=True)
            # Ensure response starts like JSON
            if not raw_response.strip().startswith("{") and not raw_response.strip().startswith("["):
                raise Exception(raw_response)
            raw_response = re.sub(r"^```json\s*", "", raw_response, flags=re.IGNORECASE)
            raw_response = re.sub(r"\s*```$", "", raw_response, flags=re.IGNORECASE)
            res = json.loads(raw_response)
            severity = res.get("severity", "major")
            hazard_desc = f"{res.get('hazard_analysis')} Remedial Action: {res.get('remedial_action')}"
        except Exception as e:
            print(f"LLM severity assessment failed: {e}. Using rule heuristics.")
            if parameter in ["ph", "bod", "cod", "safety_valve_check", "flp_casing"]:
                severity = "critical"
            else:
                severity = "major"
                
        dev_id = f"DEV-{uuid.uuid4().hex[:6].upper()}"
        data_store.insert_deviation(
            dev_id=dev_id,
            requirement_id=matched_req["id"],
            source_record_type=source_type,
            source_record_id=record_id,
            detected_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            severity=severity,
            description=hazard_desc,
            related_asset_id=asset_id
        )
        
        # Log to audit trail
        data_store.log_audit(
            action="detect_quality_deviation",
            actor="system",
            payload={"deviation_id": dev_id, "asset_id": asset_id, "parameter": parameter, "severity": severity}
        )
        
        return {
            "id": dev_id,
            "requirement_id": matched_req["id"],
            "severity": severity,
            "description": hazard_desc,
            "asset_id": asset_id
        }

# -------------------------------------------------------------
# UC-4: Regulatory Change Impact Analysis Subgraph
# -------------------------------------------------------------

class RegulatoryChangeImpactAnalysisSubgraph:
    """Performs structured diffs of regulations and computes asset operational deltas."""
    
    def analyze_amendment_impact(self, requirement_id: str, new_obligation: str, new_threshold: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        print(f"Mod 4: Running impact analysis for amendment on requirement {requirement_id}...")
        
        requirements = data_store.get_requirements()
        old_req = next((r for r in requirements if r["id"] == requirement_id), None)
        if not old_req:
            return {"error": f"Requirement {requirement_id} not found."}
            
        # Get affected assets from KG
        assets = data_store.get_all_assets()
        affected_assets = []
        app_rules = old_req["applicability_rules"] or {}
        asset_class = app_rules.get("asset_class")
        facility_area = app_rules.get("facility_area")
        
        for a in assets:
            if (asset_class and a["asset_class"] == asset_class) or (facility_area and a["location"] == facility_area):
                affected_assets.append(a)
                
        # Structured Diff computation
        diff = {
            "old_obligation": old_req["obligation_text"],
            "new_obligation": new_obligation,
            "threshold_change": None
        }
        
        if old_req["numeric_threshold"] or new_threshold:
            diff["threshold_change"] = {
                "old_limit": old_req["numeric_threshold"],
                "new_limit": new_threshold
            }
            
        # LLM analyzes practical operational impact
        affected_asset_tags = [a["id"] for a in affected_assets]
        
        prompt = f"""
        You are a Plant General Manager and Regulatory Change Specialist.
        A regulation requirement has been amended:
        Requirement ID: {requirement_id}
        Clause: {old_req['clause_id']}
        
        Old Obligation: {old_req['obligation_text']}
        New Obligation: {new_obligation}
        
        Old Threshold: {json.dumps(old_req['numeric_threshold'])}
        New Threshold: {json.dumps(new_threshold)}
        
        Affected Equipment in our plant: {", ".join(affected_asset_tags)}
        
        Explain the practical operational impact of this change on the refinery maintenance or monitoring setup in 2-3 sentences.
        Specify what modifications are required (e.g. recalibrating stack sensors, increasing inspections frequency, or acquiring new certifications).
        """
        
        narrative = client.generate_text(prompt, system_instruction="You are a plant engineering advisor.")
        
        # Log to audit trail
        data_store.log_audit(
            action="regulatory_change_impact",
            actor="compliance_officer",
            payload={"requirement_id": requirement_id, "affected_assets_count": len(affected_assets)}
        )
        
        return {
            "requirement_id": requirement_id,
            "clause_id": old_req["clause_id"],
            "diff": diff,
            "affected_assets": affected_asset_tags,
            "operational_impact": narrative
        }

# -------------------------------------------------------------
# Compliance Copilot (Conversational RAG Q&A)
# -------------------------------------------------------------

class ComplianceCopilot:
    """Directs Q&A queries over regulatory sources with citations."""
    
    def answer_question(self, query: str) -> Dict[str, Any]:
        print(f"Mod 4 Copilot: Answering regulatory query: '{query}'...")
        
        # 1. Search vector DB for regulations
        chunks = vector_db.search_similar_chunks(query, limit=3)
        context_chunks = [c["text"] for c in chunks]
        context_str = "\n\n".join(context_chunks)
        
        # 2. Get assets and gaps info for grounding
        assets = data_store.get_all_assets()
        gaps = data_store.get_gap_analyses()
        deviations = data_store.get_deviations()
        
        asset_summary = "\n".join([f"- Asset {a['id']} ({a['name']}): Class {a['asset_class']} at {a['location']}" for a in assets[:5]])
        gap_summary = "\n".join([f"- Gap Analysis {g['id']} for requirement {g['requirement_id']} on asset {g['asset_id'] or 'Plant'}: Status: {g['status'].upper()} (Citations: {json.dumps(g['evidence_refs'])})" for g in gaps[:5]])
        dev_summary = "\n".join([f"- Active Deviation {d['id']} on asset {d['related_asset_id']}: Severity: {d['severity'].upper()} - Description: {d['description']}" for d in deviations[:5]])
        
        system_instruction = (
            "You are a Senior Regulatory Affairs Copilot. Answer the user's questions about factory safety, CPCB limits, OISD work permits, and PESO rules. "
            "You must back your answer with the provided regulations excerpts and active plant compliance records. "
            "You MUST cite specific regulations reference bodies (Factories Act, PESO, OISD, CPCB) and active record IDs. "
            "If the information is not supported by the context, state that clearly."
        )
        
        prompt = f"""
        User Query: {query}
        
        Reference Regulations Manual Excerpts (RAG):
        {context_str}
        
        Current Plant Asset Status Summary:
        {asset_summary}
        
        Active Gap Analyses Records:
        {gap_summary}
        
        Active Quality Deviations Log:
        {dev_summary}
        
        Based on the technical manual and database states above, construct a detailed compliance response.
        Cite specific clauses, rules, inspection IDs, or work order IDs to support your answer.
        """
        
        answer = client.generate_text(prompt, system_instruction=system_instruction)
        
        # Build citations mapping
        citations = []
        for c in chunks:
            citations.append({
                "source_type": "regulation",
                "source_id": c["document_id"],
                "excerpt": c["text"][:150]
            })
        for g in gaps[:2]:
            citations.append({
                "source_type": "inspection" if g["evidence_refs"] and g["evidence_refs"][0]["source_type"] == "inspection" else "work_order",
                "source_id": g["evidence_refs"][0]["source_id"] if g["evidence_refs"] else "Unknown",
                "excerpt": g["evidence_refs"][0]["excerpt"] if g["evidence_refs"] else "Database record"
            })
            
        # Ensure citations meet citation contract format
        citations = [c for c in citations if c.get("source_id")]
        
        return {
            "answer": answer,
            "citations": citations
        }

# Global instances of specialist subgraphs
gap_analysis_graph = ComplianceGapAnalysisSubgraph()
evidence_package_graph = EvidencePackageSubgraph()
deviation_detection_graph = DeviationDetectionSubgraph()
impact_analysis_graph = RegulatoryChangeImpactAnalysisSubgraph()
copilot_agent = ComplianceCopilot()
