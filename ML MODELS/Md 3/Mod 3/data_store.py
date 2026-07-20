import json
import os
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from graph_db import graph_db
from vector_db import vector_db

# -------------------------------------------------------------
# Relational Database Storage Simulation (matching Section 2 schemas)
# -------------------------------------------------------------

ASSETS_TABLE: List[Dict[str, Any]] = [
    {
        "id": "Pump-14",
        "name": "Crude Charge Centrifugal Pump",
        "asset_class": "Pump",
        "location": "CDU-1",
        "criticality": "High",
        "oem_manual_ref": "MAN-P14",
        "parent_asset_id": None
    },
    {
        "id": "Motor-14",
        "name": "Crude Charge Pump Drive Motor",
        "asset_class": "Motor",
        "location": "CDU-1",
        "criticality": "High",
        "oem_manual_ref": "MAN-P14",
        "parent_asset_id": "Pump-14"
    },
    {
        "id": "Bearing-14",
        "name": "Pump Main Radial Bearing Housing",
        "asset_class": "Bearing",
        "location": "CDU-1",
        "criticality": "High",
        "oem_manual_ref": "MAN-P14",
        "parent_asset_id": "Pump-14"
    },
    {
        "id": "Generator-3",
        "name": "Emergency Diesel Generator 3",
        "asset_class": "Generator",
        "location": "Powerhouse-A",
        "criticality": "Critical",
        "oem_manual_ref": "MAN-G3",
        "parent_asset_id": None
    },
    {
        "id": "Stator-3",
        "name": "Generator Alternator Stator Winding",
        "asset_class": "Stator",
        "location": "Powerhouse-A",
        "criticality": "Critical",
        "oem_manual_ref": "MAN-G3",
        "parent_asset_id": "Generator-3"
    },
    {
        "id": "Compressor-8",
        "name": "Reciprocating Instrument Air Compressor",
        "asset_class": "Compressor",
        "location": "Utility-Line-2",
        "criticality": "Medium",
        "oem_manual_ref": "MAN-C8",
        "parent_asset_id": None
    }
]

WORK_ORDERS_TABLE: List[Dict[str, Any]] = [
    {
        "id": "WO-1002",
        "asset_id": "Pump-14",
        "type": "corrective",
        "opened_at": "2026-01-14 08:00:00",
        "closed_at": "2026-01-15 14:00:00",
        "failure_code": "FLOW_DEG",
        "cause_code": "IMPELLER_WEAR",
        "remedy_code": "REPLACE_IMP",
        "description": "Replaced worn impeller due to cavitation and flow degradation. Adjusted wearing rings.",
        "technician_id": "Alice Green",
        "status": "closed",
        "cost": 2500,
        "duration_hours": 6
    },
    {
        "id": "WO-2041",
        "asset_id": "Pump-14",
        "type": "preventive",
        "opened_at": "2026-03-10 09:00:00",
        "closed_at": "2026-03-10 11:00:00",
        "failure_code": None,
        "cause_code": None,
        "remedy_code": None,
        "description": "Performed quarterly lubrication check. Flushed housing and replaced bearing oil with synthetic ISO VG 46.",
        "technician_id": "Bob Miller",
        "status": "closed",
        "cost": 350,
        "duration_hours": 2
    },
    {
        "id": "WO-4019",
        "asset_id": "Pump-14",
        "type": "preventive",
        "opened_at": "2026-05-15 08:00:00",
        "closed_at": None,
        "failure_code": None,
        "cause_code": None,
        "remedy_code": None,
        "description": "Quarterly lubrication PM scheduled. Deferred by operations coordinator due to high plant feed demands.",
        "technician_id": "Bob Miller",
        "status": "deferred",
        "cost": 350,
        "duration_hours": 2
    },
    {
        "id": "WO-6012",
        "asset_id": "Pump-14",
        "type": "preventive",
        "opened_at": "2026-06-25 08:00:00",
        "closed_at": None,
        "failure_code": None,
        "cause_code": None,
        "remedy_code": None,
        "description": "Lubrication follow-up PM. Deferred again by operations. Technician note: Bearing housing running warm, needs attention.",
        "technician_id": "Charlie Davis",
        "status": "deferred",
        "cost": 350,
        "duration_hours": 2
    },
    {
        "id": "WO-9872",
        "asset_id": "Pump-14",
        "type": "corrective",
        "opened_at": "2026-07-10 12:00:00",
        "closed_at": "2026-07-11 18:00:00",
        "failure_code": "SEIZURE",
        "cause_code": "LUBE_FAIL",
        "remedy_code": "REPLACE_BEARING",
        "description": "Breakdown repair. Replaced seized bearing, mechanical seals, and shaft sleeve. Noticed dry bearing housing with visual heat discolouration.",
        "technician_id": "Bob Miller & Alice Green",
        "status": "closed",
        "cost": 4200,
        "duration_hours": 12
    },
    {
        "id": "WO-9910",
        "asset_id": "Pump-14",
        "type": "preventive",
        "opened_at": "2026-07-14 08:00:00",
        "closed_at": None,
        "failure_code": None,
        "cause_code": None,
        "remedy_code": None,
        "description": "Post-overhaul calibration. Align shaft coupling, verify seal flush line flow, and check bearing thermal trends.",
        "technician_id": "Charlie Davis",
        "status": "scheduled",
        "cost": 450,
        "duration_hours": 3
    },
    # Generator-3
    {
        "id": "WO-3022",
        "asset_id": "Generator-3",
        "type": "preventive",
        "opened_at": "2026-02-20 08:00:00",
        "closed_at": "2026-02-20 16:00:00",
        "failure_code": None,
        "cause_code": None,
        "remedy_code": None,
        "description": "Completed annual load bank testing and fuel quality analysis. Checked battery charging system.",
        "technician_id": "Dave Carter",
        "status": "closed",
        "cost": 1200,
        "duration_hours": 8
    },
    {
        "id": "WO-5011",
        "asset_id": "Generator-3",
        "type": "preventive",
        "opened_at": "2026-05-20 08:00:00",
        "closed_at": "2026-05-20 11:00:00",
        "failure_code": None,
        "cause_code": None,
        "remedy_code": None,
        "description": "Changed engine oil, oil filters, and coolant level check. Verified diesel fuel tank level.",
        "technician_id": "Dave Carter",
        "status": "closed",
        "cost": 450,
        "duration_hours": 3
    },
    {
        "id": "WO-8874",
        "asset_id": "Generator-3",
        "type": "corrective",
        "opened_at": "2026-07-14 08:00:00",
        "closed_at": None,
        "failure_code": "INSUL_LOW",
        "cause_code": "STATOR_WEAR",
        "remedy_code": "REPLACE_SLEEVES",
        "description": "Replace worn stator insulation sleeves identified during insulation resistance test (Megger test).",
        "technician_id": "Elena Rostova",
        "status": "scheduled",
        "cost": 1800,
        "duration_hours": 4
    }
]

SENSOR_TAGS_TABLE: List[Dict[str, Any]] = [
    {"id": "TAG-P14-VIB", "asset_id": "Pump-14", "tag_name": "vibration_g", "unit": "G-s", "oem_tolerance_min": 0.0, "oem_tolerance_max": 2.5},
    {"id": "TAG-P14-TMP", "asset_id": "Pump-14", "tag_name": "temperature_c", "unit": "C", "oem_tolerance_min": 10.0, "oem_tolerance_max": 60.0},
    {"id": "TAG-G3-TMP", "asset_id": "Generator-3", "tag_name": "temperature_c", "unit": "C", "oem_tolerance_min": 15.0, "oem_tolerance_max": 95.0},
    {"id": "TAG-C8-CUR", "asset_id": "Compressor-8", "tag_name": "current_draw", "unit": "A", "oem_tolerance_min": 0.0, "oem_tolerance_max": 45.0}
]

INSPECTION_FINDINGS_TABLE: List[Dict[str, Any]] = [
    {
        "id": "INSP-101",
        "asset_id": "Pump-14",
        "inspected_at": "2026-06-10 10:00:00",
        "inspector_id": "Elena Rostova",
        "structured_fields": {"temperature": 45.2, "vibration": 1.25, "leaks": "None"},
        "free_text_notes": "Pump-14 running smoothly. Casing temperature and structural vibrations within acceptable limits."
    },
    {
        "id": "INSP-105",
        "asset_id": "Pump-14",
        "inspected_at": "2026-06-28 11:30:00",
        "inspector_id": "Elena Rostova",
        "structured_fields": {"temperature": 54.8, "vibration": 2.15, "leaks": "Slight grease residue"},
        "free_text_notes": "Slight high-pitch whistling heard near bearing housing. Vibration elevated but within operating bounds. Advised checking oil levels."
    },
    {
        "id": "INSP-109",
        "asset_id": "Pump-14",
        "inspected_at": "2026-07-05 14:15:00",
        "inspector_id": "Bob Miller",
        "structured_fields": {"temperature": 76.5, "vibration": 3.45, "leaks": "None"},
        "free_text_notes": "Urgent attention: Vibration is now highly audible, casing is hot to the touch (76.5 C). Structural vibration at 3.45 G-s exceeds warning alert limits. Lubrication PM must be completed immediately."
    },
    {
        "id": "INSP-112",
        "asset_id": "Pump-14",
        "inspected_at": "2026-07-13 09:00:00",
        "inspector_id": "Elena Rostova",
        "structured_fields": {"temperature": 42.1, "vibration": 1.05, "leaks": "None"},
        "free_text_notes": "Post-maintenance inspection. Pump running very quietly. Vibration and temperature restored to healthy baselines."
    },
    {
        "id": "INSP-201",
        "asset_id": "Generator-3",
        "inspected_at": "2026-07-02 10:00:00",
        "inspector_id": "Dave Carter",
        "structured_fields": {"temperature": 88.0, "vibration": 1.10, "leaks": "None"},
        "free_text_notes": "Weekly test run. Megger insulation resistance test shows stator windings are starting to degrade (resistance dropped to 12 Megaohms)."
    }
]

RCA_SESSIONS_TABLE: List[Dict[str, Any]] = [
    {
        "id": "SESS-9872",
        "work_order_id": "WO-9872",
        "asset_id": "Pump-14",
        "status": "paused",
        "opened_by": "Elena Rostova",
        "opened_at": "2026-07-11 10:00:00",
        "closed_at": None,
        "langgraph_thread_id": "thread_SESS-9872"
    }
]

RCA_NODES_TABLE: List[Dict[str, Any]] = [
    {
        "id": "NODE-001",
        "session_id": "SESS-9872",
        "parent_node_id": None,
        "hypothesis_text": "Bearing bracket mechanical seizure",
        "status": "confirmed",
        "confidence": "High",
        "evidence_refs": [{"source_type": "work_order", "source_id": "WO-9872", "excerpt": "Noticed dry bearing housing with visual heat discolouration"}]
    },
    {
        "id": "NODE-002",
        "session_id": "SESS-9872",
        "parent_node_id": "NODE-001",
        "hypothesis_text": "Friction overheat due to oil starvation",
        "status": "confirmed",
        "confidence": "High",
        "evidence_refs": [
            {"source_type": "inspection", "source_id": "INSP-109", "excerpt": "Vibration is now highly audible, casing is hot to the touch (76.5 C)"},
            {"source_type": "work_order", "source_id": "WO-6012", "excerpt": "Bearing housing running warm, needs attention"}
        ]
    },
    {
        "id": "NODE-003",
        "session_id": "SESS-9872",
        "parent_node_id": "NODE-002",
        "hypothesis_text": "Preventive lubrication intervals skipped",
        "status": "proposed",
        "confidence": "High",
        "evidence_refs": [
            {"source_type": "work_order", "source_id": "WO-4019", "excerpt": "Quarterly lubrication PM scheduled. Deferred by operations coordinator"},
            {"source_type": "work_order", "source_id": "WO-6012", "excerpt": "Lubrication follow-up PM. Deferred again by operations"}
        ]
    }
]

RECOMMENDATIONS_TABLE: List[Dict[str, Any]] = []

AUDIT_LOG_TABLE: List[Dict[str, Any]] = []

# -------------------------------------------------------------
# Failures database representation (for backwards-compatibility / quick access)
# -------------------------------------------------------------
FAILURES = [
    {
        "failure_id": "FAIL-091",
        "asset_tag": "Pump-14",
        "date": "2026-07-10",
        "downtime_hours": 18.0,
        "cost": 45000,
        "failure_mode": "Bearing housing seizure",
        "reported_cause": "Lubrication failure",
        "root_cause": "Lubrication PM deferral (WO-4019 & WO-6012 skipped), causing oil depletion and thermal seizure.",
        "status": "Confirmed"
    },
    {
        "failure_id": "FAIL-042",
        "asset_tag": "Generator-3",
        "date": "2025-11-05",
        "downtime_hours": 4.5,
        "cost": 12000,
        "failure_mode": "Overheating shut down",
        "reported_cause": "Cooling fan belt snapped",
        "root_cause": "Belt fatigue due to delayed replacement cycle.",
        "status": "Confirmed"
    }
]

# -------------------------------------------------------------
# OEM Manuals Content (for vector seeding)
# -------------------------------------------------------------
OEM_MANUALS = [
    {
        "doc_id": "MAN-P14",
        "title": "Flowserve Centrifugal Pump Series CP-500 Service Manual",
        "text": """
        Flowserve Centrifugal Pump Series CP-500 Operating & Service Manual.
        Section 4.1: Technical Design Specifications and Limits
        
        1. Bolt Torque Specifications:
        - Casing mating bolts: Torque to 120 Nm (88.5 ft-lbs) using a calibrated torque wrench in a cross-pattern sequence.
        - Bearing bracket set screws: Torque to 25 Nm.
        
        2. Vibration Operational limits:
        - Normal baseline: < 2.5 G-s root mean square (RMS).
        - High Alert Level (Warning): 2.8 G-s RMS. Action required: schedule inspection within 5 days, check oil level.
        - Shutdown Limit (Critical): 4.5 G-s RMS. Action required: automatic trip / manual emergency shutdown of the pump to avoid bearing seizure or shaft bend.
        
        3. Operating Temperature Limits:
        - Bearing bracket temperature normal range: 40 C to 60 C.
        - Temperature Alert (Warning): 75 C. Action: inspect lubrication lines, top-up reservoir.
        - Shutdown Limit (Critical): 90 C. Action: trip pump immediately.
        
        4. Lubrication Maintenance Schedule:
        - Re-grease / Oil change interval: Replenish or replace bearing oil every 500 operating hours.
        - Recommended oil type: ISO VG 46 synthetic turbine and bearing oil (or equivalent synthetic Mobil DTE 746).
        - Danger: Skipped lubrication intervals will lead to bearing oil film depletion, rapid mechanical friction, high casing heat, and catastrophic seizure.
        """
    },
    {
        "doc_id": "MAN-G3",
        "title": "Cummins Diesel Generator Model DG-1500 Technical Specification",
        "text": """
        Cummins Diesel Generator Model DG-1500 Technical Manual.
        Section 9.3: Electrical Stator and Thermal Safety Parameters
        
        1. Windings Temperature Ratings:
        - Continuous stator operating temperature: normal limit < 95 C.
        - Alarm Warning limit: 110 C.
        - Emergency shutdown trip: 125 C.
        
        2. Winding Insulation resistance (Megger Test):
        - Minimum insulation resistance for safe startup: 20 Megaohms.
        - Critical action warning limit: < 15 Megaohms. Action: replace insulation sleeves or perform winding winding resistance adjustments.
        
        3. Cooling fan belt tension:
        - Belt deflection limit: 10 mm deflection under 50 N thumb pressure. Inspect belt every 6 months for cracking or micro-tearing.
        """
    },
    {
        "doc_id": "MAN-C8",
        "title": "Ingersoll Rand Reciprocating Compressor Model RC-90 Manual",
        "text": """
        Ingersoll Rand Reciprocating Compressor Model RC-90 Manual.
        Section 2.4: Mechanical Valve Clearances and Tolerances
        
        1. Suction valve clearance:
        - Cylinder A & B suction valve clearance must be set between 0.12 mm and 0.18 mm.
        - Discharge valve seating limit: Max allowable seal leakage gap is 0.05 mm.
        
        2. Current draw parameters:
        - Motor rated current: 45 Amps full load.
        - Alert threshold: Current draw > 49 Amps indicates high mechanical resistance (check piston rings, cylinder bore, or crankshaft alignment).
        """
    }
]

def generate_sensor_data(asset_tag: str, start_days_ago: int = 30, resolution_minutes: int = 60) -> List[Dict[str, Any]]:
    data_points = []
    current_time = datetime.now()
    start_date = current_time - timedelta(days=start_days_ago)
    total_steps = int((start_days_ago * 24 * 60) / resolution_minutes)
    
    failure_target_date = datetime(2026, 7, 10, 10, 0, 0)
    repair_completed_date = datetime(2026, 7, 11, 12, 0, 0)
    
    for step in range(total_steps):
        time_stamp = start_date + timedelta(minutes=step * resolution_minutes)
        if time_stamp > current_time:
            break
            
        point = {
            "timestamp": time_stamp.strftime("%Y-%m-%d %H:%M:%S"),
            "speed_rpm": 1480.0,
            "vibration_g": 1.2,
            "temperature_c": 45.0,
            "pressure_bar": 12.0
        }
        
        if asset_tag == "Pump-14":
            if time_stamp < failure_target_date:
                days_before = (failure_target_date - time_stamp).total_seconds() / (24 * 3600)
                if days_before > 9.0:
                    point["vibration_g"] = 1.1 + 0.1 * math.sin(step / 10.0) + (step % 3) * 0.05
                    point["temperature_c"] = 44.0 + 1.0 * math.cos(step / 20.0) + (step % 5) * 0.2
                    point["pressure_bar"] = 12.2 - (step % 2) * 0.1
                else:
                    fraction = (9.0 - days_before) / 9.0
                    point["vibration_g"] = 1.2 + 2.8 * (fraction ** 2.5) + (step % 3) * 0.1
                    point["temperature_c"] = 45.0 + 35.0 * (fraction ** 2.0) + (step % 5) * 0.3
                    point["pressure_bar"] = 12.0 - 1.5 * fraction
            elif failure_target_date <= time_stamp < repair_completed_date:
                point["speed_rpm"] = 0.0
                point["vibration_g"] = 0.05 + (step % 2) * 0.01
                point["temperature_c"] = max(35.0, 80.0 - 2.0 * ((time_stamp - failure_target_date).total_seconds() / 3600.0))
                point["pressure_bar"] = 0.0
            else:
                days_after = (time_stamp - repair_completed_date).total_seconds() / (24 * 3600)
                point["vibration_g"] = 0.9 + 0.05 * math.sin(step / 5.0) + (days_after * 0.02)
                point["temperature_c"] = 41.0 + 0.5 * math.cos(step / 10.0) + (days_after * 0.1)
                point["pressure_bar"] = 12.5 - (days_after * 0.05)
                
        elif asset_tag == "Generator-3":
            is_running = time_stamp.weekday() == 6 and (10 <= time_stamp.hour <= 11)
            if is_running:
                point["speed_rpm"] = 1500.0
                point["pressure_bar"] = 5.2
                days_from_start = (time_stamp - start_date).total_seconds() / (24 * 3600)
                point["temperature_c"] = 72.0 + (days_from_start * 0.8)
                point["vibration_g"] = 1.05 + (days_from_start * 0.01)
            else:
                point["speed_rpm"] = 0.0
                point["vibration_g"] = 0.01
                point["temperature_c"] = 28.0
                point["pressure_bar"] = 0.0
                
        else:
            is_active = 8 <= time_stamp.hour < 20
            if is_active:
                point["speed_rpm"] = 980.0
                point["pressure_bar"] = 7.2 + 0.8 * math.sin(step / 4.0)
                point["vibration_g"] = 1.8 + 0.3 * math.cos(step / 8.0)
                point["temperature_c"] = 58.0 + 3.0 * math.sin(step / 12.0)
            else:
                point["speed_rpm"] = 0.0
                point["pressure_bar"] = 6.0
                point["vibration_g"] = 0.05
                point["temperature_c"] = 30.0
                
        data_points.append(point)
    return data_points

def initialize_all_databases():
    print("Mod 3: Seeding relational structure & indexing libraries...")
    
    # Reset tables
    RECOMMENDATIONS_TABLE.clear()
    AUDIT_LOG_TABLE.clear()
    
    # 1. Ingest OEM manuals
    for manual in OEM_MANUALS:
        try:
            vector_db.store_manual_chunks(
                doc_id=manual["doc_id"],
                title=manual["title"],
                text=manual["text"]
            )
        except Exception as e:
            print(f"Mod 3: Failed vector indexing manual {manual['doc_id']}: {e}")
            
    # 2. Ingest Assets into Graph
    for asset in ASSETS_TABLE:
        try:
            graph_db.upsert_node(
                label="Asset",
                key_prop="tag",
                key_val=asset["id"],
                properties={
                    "name": asset["name"],
                    "asset_class": asset["asset_class"],
                    "location": asset["location"],
                    "criticality": asset["criticality"],
                    "oem_manual_ref": asset["oem_manual_ref"]
                }
            )
            # Link to parent if nested
            if asset["parent_asset_id"]:
                graph_db.upsert_relationship(
                    from_label="Asset", from_key="tag", from_val=asset["id"],
                    rel_type="PART_OF",
                    to_label="Asset", to_key="tag", to_val=asset["parent_asset_id"]
                )
        except Exception as e:
            print(f"Mod 3: Failed loading asset {asset['id']} to graph: {e}")
            
    # 3. Ingest Work Orders into Graph
    for wo in WORK_ORDERS_TABLE:
        try:
            graph_db.upsert_node(
                label="WorkOrder",
                key_prop="id",
                key_val=wo["id"],
                properties={
                    "type": wo["type"],
                    "opened_at": wo["opened_at"],
                    "closed_at": wo["closed_at"] or "N/A",
                    "status": wo["status"],
                    "technician_id": wo["technician_id"],
                    "description": wo["description"],
                    "cost": wo["cost"]
                }
            )
            graph_db.upsert_relationship(
                from_label="WorkOrder", from_key="id", from_val=wo["id"],
                rel_type="SERVICED",
                to_label="Asset", to_key="tag", to_val=wo["asset_id"]
            )
        except Exception as e:
            print(f"Mod 3: Failed loading work order {wo['id']} to graph: {e}")

    print("Mod 3: Seeding process completed successfully.")
