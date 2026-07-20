import sqlite3
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import config

def get_db_connection():
    """Establishes and returns a connection to the SQLite database."""
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def create_tables(conn):
    """Creates the SQLite relational database schemas."""
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # 1. Assets Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        asset_class TEXT NOT NULL,
        location TEXT NOT NULL,
        criticality TEXT NOT NULL,
        oem_manual_ref TEXT,
        parent_asset_id TEXT,
        FOREIGN KEY(parent_asset_id) REFERENCES assets(id) ON DELETE SET NULL
    );
    """)
    
    # 2. Work Orders Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS work_orders (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        type TEXT NOT NULL,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        failure_code TEXT,
        cause_code TEXT,
        remedy_code TEXT,
        description TEXT,
        technician_id TEXT,
        status TEXT NOT NULL,
        cost REAL,
        duration_hours REAL,
        permit_id TEXT,
        FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );
    """)
    
    # 3. Sensor Tags Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sensor_tags (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        unit TEXT NOT NULL,
        oem_tolerance_min REAL,
        oem_tolerance_max REAL,
        FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );
    """)
    
    # 4. Inspection Findings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inspection_findings (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        inspected_at TEXT NOT NULL,
        inspector_id TEXT,
        structured_fields TEXT, -- JSON string representation
        free_text_notes TEXT,
        FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );
    """)
    
    # 5. Regulations Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS regulations (
        id TEXT PRIMARY KEY,
        source_body TEXT NOT NULL, -- OISD/PESO/CPCB/Factories_Act/BIS
        title TEXT NOT NULL,
        document_ref TEXT,
        version TEXT NOT NULL,
        effective_date TEXT NOT NULL,
        superseded_by TEXT,
        status TEXT NOT NULL, -- active / superseded
        FOREIGN KEY(superseded_by) REFERENCES regulations(id) ON DELETE SET NULL
    );
    """)
    
    # 6. Requirements Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS requirements (
        id TEXT PRIMARY KEY,
        regulation_id TEXT NOT NULL,
        clause_id TEXT NOT NULL,
        obligation_text TEXT NOT NULL,
        numeric_threshold TEXT, -- JSON configuration: {parameter, operator, value, unit}
        applicability_rules TEXT, -- JSON applicability rules: {asset_class, hazard_class, facility_area}
        FOREIGN KEY(regulation_id) REFERENCES regulations(id) ON DELETE CASCADE
    );
    """)
    
    # 7. Gap Analyses Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gap_analyses (
        id TEXT PRIMARY KEY,
        requirement_id TEXT NOT NULL,
        asset_id TEXT,
        run_at TEXT NOT NULL,
        status TEXT NOT NULL, -- compliant/gap/partial/insufficient_evidence
        confidence TEXT NOT NULL, -- High/Medium/Low
        evidence_refs TEXT NOT NULL, -- JSON string array: [{source_type, source_id, excerpt}]
        reviewed_by TEXT,
        reviewed_at TEXT,
        review_status TEXT NOT NULL, -- draft / finalized
        FOREIGN KEY(requirement_id) REFERENCES requirements(id) ON DELETE CASCADE,
        FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE SET NULL
    );
    """)
    
    # 8. Evidence Packages Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evidence_packages (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL, -- JSON scope: {regulator, standard, date_range, facility_area}
        requested_by TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        status TEXT NOT NULL, -- draft/finalized
        contents TEXT NOT NULL, -- JSON string: array of {requirement_id, gap_analysis_id, evidence_record_refs}
        summary TEXT
    );
    """)
    
    # 9. Deviations Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS deviations (
        id TEXT PRIMARY KEY,
        requirement_id TEXT NOT NULL,
        source_record_type TEXT NOT NULL, -- inspection/sensor/work_order
        source_record_id TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        severity TEXT NOT NULL, -- critical/major/minor
        description TEXT NOT NULL,
        related_asset_id TEXT,
        FOREIGN KEY(requirement_id) REFERENCES requirements(id) ON DELETE CASCADE,
        FOREIGN KEY(related_asset_id) REFERENCES assets(id) ON DELETE SET NULL
    );
    """)
    
    # 10. Audit Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        payload TEXT NOT NULL -- JSON representation
    );
    """)
    
    conn.commit()

def seed_data(conn):
    """Seeds relational tables with mock plant assets, regulations, and telemetry evidence."""
    cursor = conn.cursor()
    
    # Clear existing rows to prevent constraint errors on re-run
    cursor.execute("DELETE FROM audit_logs;")
    cursor.execute("DELETE FROM deviations;")
    cursor.execute("DELETE FROM evidence_packages;")
    cursor.execute("DELETE FROM gap_analyses;")
    cursor.execute("DELETE FROM requirements;")
    cursor.execute("DELETE FROM regulations;")
    cursor.execute("DELETE FROM inspection_findings;")
    cursor.execute("DELETE FROM sensor_tags;")
    cursor.execute("DELETE FROM work_orders;")
    cursor.execute("DELETE FROM assets;")
    
    # 1. Seed Assets
    assets = [
        ("Pump-14", "Crude Charge Centrifugal Pump", "Pump", "CDU-1", "High", "MAN-P14", None),
        ("Motor-14", "Crude Charge Pump Drive Motor", "Motor", "CDU-1", "High", "MAN-P14", "Pump-14"),
        ("Bearing-14", "Pump Main Radial Bearing Housing", "Bearing", "CDU-1", "High", "MAN-P14", "Pump-14"),
        ("Generator-3", "Emergency Diesel Generator 3", "Generator", "Powerhouse-A", "Critical", "MAN-G3", None),
        ("Stator-3", "Generator Alternator Stator Winding", "Stator", "Powerhouse-A", "Critical", "MAN-G3", "Generator-3"),
        ("Compressor-8", "Reciprocating Instrument Air Compressor", "Compressor", "Utility-Line-2", "Medium", "MAN-C8", None),
        ("ETP-01", "Effluent Treatment Plant Discharge Point", "EffluentDischarge", "Offsite-Utilities", "High", None, None),
        ("Stack-01", "Crude Heater Flue Gas Stack", "EmissionStack", "CDU-1", "High", None, None),
        ("LPG-Storage", "LPG Mounded Storage Vessel 101", "PressureVessel", "LPG-Terminal", "Critical", None, None),
    ]
    cursor.executemany("INSERT INTO assets VALUES (?, ?, ?, ?, ?, ?, ?);", assets)
    
    # 2. Seed Work Orders
    work_orders = [
        ("WO-1002", "Pump-14", "corrective", "2026-01-14 08:00:00", "2026-01-15 14:00:00", "FLOW_DEG", "IMPELLER_WEAR", "REPLACE_IMP", "Replaced worn impeller due to cavitation and flow degradation.", "Alice Green", "closed", 2500.0, 6.0, "PERMIT-1002"),
        ("WO-2041", "Pump-14", "preventive", "2026-03-10 09:00:00", "2026-03-10 11:00:00", None, None, None, "Performed quarterly lubrication check. Replaced bearing oil with ISO VG 46.", "Bob Miller", "closed", 350.0, 2.0, "PERMIT-2041"),
        ("WO-4019", "Pump-14", "preventive", "2026-05-15 08:00:00", None, None, None, None, "Quarterly lubrication PM scheduled. Deferred due to high plant feed demands.", "Bob Miller", "deferred", 350.0, 2.0, None),
        ("WO-6012", "Pump-14", "preventive", "2026-06-25 08:00:00", None, None, None, None, "Lubrication PM. Deferred again by operations.", "Charlie Davis", "deferred", 350.0, 2.0, None),
        ("WO-9872", "Pump-14", "corrective", "2026-07-10 12:00:00", "2026-07-11 18:00:00", "SEIZURE", "LUBE_FAIL", "REPLACE_BEARING", "Replaced seized bearing. Noticed dry bearing housing.", "Bob Miller", "closed", 4200.0, 12.0, "PERMIT-9872"),
        ("WO-9910", "Pump-14", "preventive", "2026-07-14 08:00:00", None, None, None, None, "Post-overhaul calibration. Align shaft coupling, verify seal flush lines.", "Charlie Davis", "scheduled", 450.0, 3.0, None),
        ("WO-3022", "Generator-3", "preventive", "2026-02-20 08:00:00", "2026-02-20 16:00:00", None, None, None, "Completed annual load bank testing and fuel quality analysis.", "Dave Carter", "closed", 1200.0, 8.0, "PERMIT-3022"),
        ("WO-5011", "Generator-3", "preventive", "2026-05-20 08:00:00", "2026-05-20 11:00:00", None, None, None, "Changed engine oil and oil filters. Checked coolant levels.", "Dave Carter", "closed", 450.0, 3.0, "PERMIT-5011"),
        ("WO-8874", "Generator-3", "corrective", "2026-07-14 08:00:00", None, "INSUL_LOW", "STATOR_WEAR", "REPLACE_SLEEVES", "Scheduled stator winding insulation sleeves replacement.", "Elena Rostova", "scheduled", 1800.0, 4.0, None),
        ("WO-1102", "ETP-01", "corrective", "2026-07-13 10:00:00", "2026-07-13 15:00:00", "VALVE_LEAK", "SEAL_FAIL", "REPLACE_SEAL", "Replaced effluent discharge pipeline seal. Commenced hot welding without PTW.", "John Doe", "closed", 800.0, 5.0, None),
    ]
    cursor.executemany("INSERT INTO work_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);", work_orders)
    
    # 3. Seed Sensor Tags
    sensor_tags = [
        ("TAG-P14-VIB", "Pump-14", "vibration_g", "G-s", 0.0, 2.5),
        ("TAG-P14-TMP", "Pump-14", "temperature_c", "C", 10.0, 60.0),
        ("TAG-G3-TMP", "Generator-3", "temperature_c", "C", 15.0, 95.0),
        ("TAG-C8-CUR", "Compressor-8", "current_draw", "A", 0.0, 45.0),
        ("TAG-ETP-PH", "ETP-01", "ph", "pH", 5.5, 9.0),
        ("TAG-ETP-BOD", "ETP-01", "bod", "mg/l", 0.0, 30.0),
        ("TAG-ETP-COD", "ETP-01", "cod", "mg/l", 0.0, 250.0),
        ("TAG-STACK-SO2", "Stack-01", "so2", "mg/Nm3", 0.0, 50.0),
        ("TAG-STACK-NOX", "Stack-01", "nox", "mg/Nm3", 0.0, 300.0),
    ]
    cursor.executemany("INSERT INTO sensor_tags VALUES (?, ?, ?, ?, ?, ?);", sensor_tags)
    
    # 4. Seed Inspection Findings
    inspection_findings = [
        ("INSP-101", "Pump-14", "2026-06-10 10:00:00", "Elena Rostova", json.dumps({"temperature": 45.2, "vibration": 1.25, "leaks": "None"}), "Pump-14 running smoothly. Casing temperature and structural vibrations within acceptable limits."),
        ("INSP-105", "Pump-14", "2026-06-28 11:30:00", "Elena Rostova", json.dumps({"temperature": 54.8, "vibration": 2.15, "leaks": "Slight grease residue"}), "Slight high-pitch whistling heard near bearing housing. Vibration elevated but within operating bounds. Advised checking oil levels."),
        ("INSP-109", "Pump-14", "2026-07-05 14:15:00", "Bob Miller", json.dumps({"temperature": 76.5, "vibration": 3.45, "leaks": "None"}), "Urgent attention: Vibration is now highly audible, casing is hot to the touch (76.5 C). Structural vibration at 3.45 G-s exceeds warning alert limits. Lubrication PM must be completed immediately."),
        ("INSP-112", "Pump-14", "2026-07-13 09:00:00", "Elena Rostova", json.dumps({"temperature": 42.1, "vibration": 1.05, "leaks": "None"}), "Post-maintenance inspection. Pump running very quietly. Vibration and temperature restored to healthy baselines."),
        ("INSP-201", "Generator-3", "2026-07-02 10:00:00", "Dave Carter", json.dumps({"temperature": 88.0, "vibration": 1.10, "leaks": "None"}), "Weekly test run. Megger insulation resistance test shows stator windings are starting to degrade (resistance dropped to 12 Megaohms)."),
        ("INSP-ETP-001", "ETP-01", "2026-07-01 10:00:00", "Nitin Kumar", json.dumps({"ph": 7.2, "bod": 22.0, "cod": 180.0}), "Effluent parameters well within CPCB limits."),
        ("INSP-ETP-002", "ETP-01", "2026-07-15 14:30:00", "Nitin Kumar", json.dumps({"ph": 9.8, "bod": 42.0, "cod": 280.0}), "Off-spec discharge. pH high at 9.8, BOD and COD elevated above daily consent limits."),
        ("INSP-STACK-001", "Stack-01", "2026-07-02 11:00:00", "Elena Rostova", json.dumps({"so2": 42.5, "nox": 220.0}), "Stack emissions monitoring normal."),
        ("INSP-STACK-002", "Stack-01", "2026-07-16 09:15:00", "Elena Rostova", json.dumps({"so2": 62.0, "nox": 320.0}), "Alert: Stack analyzer shows SO2 at 62.0 mg/Nm3 and NOx at 320.0 mg/Nm3, exceeding CPCB standards."),
        ("INSP-LPG-VALVE", "LPG-Storage", "2026-07-03 08:30:00", "Dave Carter", json.dumps({"safety_valve_check": "FAILED"}), "Safety relief valve annual certificate expired on 2026-06-30. Deferral requested by operations, but no physical verification conducted."),
        ("INSP-P14-GUARD", "Pump-14", "2026-07-12 10:00:00", "Dave Carter", json.dumps({"coupling_guard": "MISSING"}), "Maintenance completed on Pump-14. However, the coupling guard was left uninstalled. Safety hazard."),
        ("INSP-M14-FLP", "Motor-14", "2026-07-14 11:00:00", "Bob Miller", json.dumps({"flp_casing": "COMPROMISED"}), "Junction box cover bolts are loose on Motor-14, compromising the flameproof enclosure integrity required for hazardous gas zones."),
    ]
    cursor.executemany("INSERT INTO inspection_findings VALUES (?, ?, ?, ?, ?, ?);", inspection_findings)
    
    # 5. Seed Regulations
    regulations = [
        ("REG-FAC-1948", "Factories_Act", "The Factories Act, 1948", "India Code Act No. 63 of 1948", "v1.0", "1948-09-23", None, "active"),
        ("REG-PESO-2002", "PESO", "The Petroleum Rules, 2002", "PESO Notification G.S.R 204(E)", "v1.0", "2002-03-13", None, "active"),
        ("REG-OISD-105", "OISD", "OISD-STD-105: Work Permit System", "OISD Standard 105", "v2.0", "2018-04-01", None, "active"),
        ("REG-CPCB-ENV", "CPCB", "CPCB General Effluent and Emission Standards", "Environment Protection Act Schedule VI", "v1.0", "2015-05-10", None, "active"),
        ("REG-BIS-IS2148", "BIS", "IS/IEC 60079-1: Flameproof Enclosures 'd' (BIS Standard)", "IS 2148: 2004", "v1.0", "2004-01-01", None, "active"),
    ]
    cursor.executemany("INSERT INTO regulations VALUES (?, ?, ?, ?, ?, ?, ?, ?);", regulations)
    
    # 6. Seed Requirements
    requirements = [
        # Factories Act
        ("REQ-FAC-21", "REG-FAC-1948", "Section 21", "Every moving part of dangerous machinery, including every shaft, wheel, or pinion, shall be securely fenced by safeguards of substantial construction.", None, json.dumps({"asset_class": "Pump"})),
        ("REQ-FAC-38", "REG-FAC-1948", "Section 38", "Precautions in case of fire. All factories shall be provided with effective means of escape and fire extinguishing equipment. Fire safety training must be verified.", None, json.dumps({"facility_area": "CDU-1"})),
        # PESO
        ("REQ-PESO-105", "REG-PESO-2002", "Rule 105", "No electrical wiring or apparatus shall be used in hazardous locations unless certified Flameproof (FLP) or Intrinsically Safe (IS) by PESO.", None, json.dumps({"asset_class": "Motor"})),
        ("REQ-PESO-122", "REG-PESO-2002", "Rule 122", "All pressure vessels in service shall be fitted with safety valves that must be tested and certified by a competent person at least once in a year.", None, json.dumps({"asset_class": "PressureVessel"})),
        # OISD
        ("REQ-OISD-105-WORK", "REG-OISD-105", "Section 4.1", "A written Permit to Work (PTW) must be issued before commencing any hot work, welding, cutting or cold work on hydrocarbon processing equipment.", None, json.dumps({"asset_class": "Pump", "hazard_class": "Hydrocarbon"})),
        # CPCB Effluent Limits
        ("REQ-CPCB-PH", "REG-CPCB-ENV", "Effluent pH", "Effluent discharge pH must be maintained strictly between 5.5 and 9.0.", json.dumps({"parameter": "ph", "operator": "between", "value": [5.5, 9.0], "unit": "pH"}), json.dumps({"asset_class": "EffluentDischarge"})),
        ("REQ-CPCB-BOD", "REG-CPCB-ENV", "Effluent BOD", "Effluent biochemical oxygen demand (BOD) must not exceed 30 mg/l.", json.dumps({"parameter": "bod", "operator": "<=", "value": 30.0, "unit": "mg/l"}), json.dumps({"asset_class": "EffluentDischarge"})),
        ("REQ-CPCB-COD", "REG-CPCB-ENV", "Effluent COD", "Effluent chemical oxygen demand (COD) must not exceed 250 mg/l.", json.dumps({"parameter": "cod", "operator": "<=", "value": 250.0, "unit": "mg/l"}), json.dumps({"asset_class": "EffluentDischarge"})),
        # CPCB Stack Emissions
        ("REQ-CPCB-SO2", "REG-CPCB-ENV", "Emission SO2", "Flue gas sulfur dioxide (SO2) emission from stacks must not exceed 50 mg/Nm3.", json.dumps({"parameter": "so2", "operator": "<=", "value": 50.0, "unit": "mg/Nm3"}), json.dumps({"asset_class": "EmissionStack"})),
        ("REQ-CPCB-NOX", "REG-CPCB-ENV", "Emission NOx", "Flue gas nitrogen oxides (NOx) emission from stacks must not exceed 300 mg/Nm3.", json.dumps({"parameter": "nox", "operator": "<=", "value": 300.0, "unit": "mg/Nm3"}), json.dumps({"asset_class": "EmissionStack"})),
    ]
    cursor.executemany("INSERT INTO requirements VALUES (?, ?, ?, ?, ?, ?);", requirements)
    
    conn.commit()

def seed_synthetic_datasets():
    print("Mod 4 Relational Layer: Seeding synthetic datasets dynamically...")
    DATASETS_DIR = config.BASE_DIR / "Datasets" / "OneDrive_1_7-16-2026"
    if not DATASETS_DIR.exists():
        print(f"Mod 4 Seeding: Synthetic datasets directory not found at {DATASETS_DIR}")
        return

    # 1. Ingest equipment_master.json
    try:
        equipment_file = DATASETS_DIR / "equipment_master.json"
        if equipment_file.exists():
            with open(equipment_file, "r", encoding="utf-8") as f:
                equipment_data = json.load(f)
            for eq in equipment_data:
                insert_asset(
                    asset_id=eq["equipment_tag"],
                    name=f"{eq['manufacturer']} {eq['equipment_type']}",
                    asset_class=eq["equipment_type"],
                    location=eq["plant_area"],
                    criticality=eq["criticality"],
                    oem_manual_ref=None,
                    parent_asset_id=None
                )
            print(f"Mod 4 Seeding: Loaded {len(equipment_data)} assets from equipment_master.json")
    except Exception as e:
        print(f"Mod 4 Seeding: Error loading equipment_master.json: {e}")

    # 2. Ingest compliance_requirements.json
    try:
        compliance_file = DATASETS_DIR / "compliance_requirements.json"
        if compliance_file.exists():
            with open(compliance_file, "r", encoding="utf-8") as f:
                compliance_data = json.load(f)
            for req in compliance_data:
                standard_id = req["standard"]
                reg_id = f"REG-{standard_id.replace(' ', '_').upper()}"
                
                # Check/insert regulation
                conn = get_db_connection()
                cursor = conn.cursor()
                cursor.execute("SELECT id FROM regulations WHERE id = ?;", (reg_id,))
                exists = cursor.fetchone()
                conn.close()
                
                if not exists:
                    body = "OTHER"
                    for b in ["OISD", "PESO", "Factories Act", "Factories_Act", "IBR", "Indian Boiler Regulations"]:
                        if b.lower() in standard_id.lower():
                            body = "Factories_Act" if "factories" in b.lower() else ("IBR" if "boiler" in b.lower() else b)
                            break
                    
                    insert_regulation(
                        reg_id=reg_id,
                        source_body=body,
                        title=f"{standard_id} Standard",
                        document_ref=None,
                        version="v1.0",
                        effective_date="2026-07-16",
                        superseded_by=None,
                        status="active"
                    )
                
                insert_requirement(
                    req_id=req["requirement_id"],
                    reg_id=reg_id,
                    clause_id=req["requirement_id"],
                    obligation_text=req["requirement"],
                    numeric_threshold=None,
                    applicability_rules={"asset_class": req["applicable_equipment_type"]}
                )
            print(f"Mod 4 Seeding: Loaded {len(compliance_data)} compliance requirements.")
    except Exception as e:
        print(f"Mod 4 Seeding: Error loading compliance_requirements.json: {e}")

    # 3. Ingest safety_procedures.json
    try:
        safety_file = DATASETS_DIR / "safety_procedures.json"
        if safety_file.exists():
            with open(safety_file, "r", encoding="utf-8") as f:
                safety_data = json.load(f)
            from vector_db import vector_db
            for sop in safety_data:
                sop_id = sop["sop_id"]
                title = sop["title"]
                applicable_type = sop["applicable_equipment_type"]
                applicable_tags = sop["applicable_equipment_tags"]
                revision = sop["revision"]
                last_reviewed = sop["last_reviewed"]
                hazards = sop["key_hazards"]
                ppe = sop["mandatory_ppe"]
                
                text = (
                    f"Standard Operating Procedure Document: {sop_id}\n"
                    f"Title: {title}\n"
                    f"Applicable Equipment Type: {applicable_type}\n"
                    f"Applicable Equipment Tags: {', '.join(applicable_tags) if applicable_tags else 'All of type'}\n"
                    f"Revision: {revision} (Last Reviewed: {last_reviewed})\n"
                    f"Key Hazards: {', '.join(hazards)}\n"
                    f"Mandatory PPE: {', '.join(ppe)}"
                )
                vector_db.store_regulation_chunks(sop_id, title, text)
            print(f"Mod 4 Seeding: Loaded {len(safety_data)} safety procedures into Vector DB.")
    except Exception as e:
        print(f"Mod 4 Seeding: Error loading safety_procedures.json: {e}")

    # 4. Ingest maintenance_work_orders.json
    try:
        maintenance_file = DATASETS_DIR / "maintenance_work_orders.json"
        if maintenance_file.exists():
            with open(maintenance_file, "r", encoding="utf-8") as f:
                maintenance_data = json.load(f)
            for wo in maintenance_data:
                wo_type = wo["priority"].lower()
                status = wo["status"].lower()
                closed_at = wo["reported_date"] if status == "closed" else None
                
                insert_work_order(
                    wo_id=wo["work_order_id"],
                    asset_id=wo["equipment_tag"],
                    wo_type=wo_type,
                    opened_at=wo["reported_date"],
                    closed_at=closed_at,
                    failure_code=wo["failure_mode"],
                    cause_code=None,
                    remedy_code=None,
                    description=wo["action_taken"],
                    technician_id=wo["technician"],
                    status=status,
                    cost=0.0,
                    duration_hours=float(wo["downtime_hours"]) if wo["downtime_hours"] is not None else 0.0,
                    permit_id=None
                )
            print(f"Mod 4 Seeding: Loaded {len(maintenance_data)} maintenance work orders.")
    except Exception as e:
        print(f"Mod 4 Seeding: Error loading maintenance_work_orders.json: {e}")

    # 5. Ingest inspection_reports.json
    try:
        inspection_file = DATASETS_DIR / "inspection_reports.json"
        if inspection_file.exists():
            with open(inspection_file, "r", encoding="utf-8") as f:
                inspection_data = json.load(f)
            for insp in inspection_data:
                structured_fields = {
                    "inspection_type": insp["inspection_type"],
                    "next_due_date": insp["next_due_date"]
                }
                add_inspection_finding(
                    finding_id=insp["inspection_id"],
                    asset_id=insp["equipment_tag"],
                    inspected_at=insp["inspection_date"],
                    inspector_id=insp["inspector"],
                    structured_fields=structured_fields,
                    free_text_notes=insp["finding"]
                )
            print(f"Mod 4 Seeding: Loaded {len(inspection_data)} inspection findings.")
    except Exception as e:
        print(f"Mod 4 Seeding: Error loading inspection_reports.json: {e}")

    # 6. Ingest incident_reports.json
    try:
        incident_file = DATASETS_DIR / "incident_reports.json"
        if incident_file.exists():
            with open(incident_file, "r", encoding="utf-8") as f:
                incident_data = json.load(f)
            for inc in incident_data:
                req_id = "REQ-FAC-38" # default fire precaution requirement
                desc = f"Incident Description: {inc['description']}. Root cause: {inc['root_cause']}. Corrective Action: {inc['corrective_action']}."
                insert_deviation(
                    dev_id=inc["incident_id"],
                    requirement_id=req_id,
                    source_record_type="incident",
                    source_record_id=inc["incident_id"],
                    detected_at=inc["date"],
                    severity=inc["severity"].lower(),
                    description=desc,
                    related_asset_id=inc["equipment_tag"]
                )
            print(f"Mod 4 Seeding: Loaded {len(incident_data)} incident reports as deviations.")
    except Exception as e:
        print(f"Mod 4 Seeding: Error loading incident_reports.json: {e}")

def initialize_database():
    """Triggers table creation and data seeding."""
    print("Mod 4 Relational Layer: Initializing database...")
    db_dir = Path(config.DB_PATH).parent
    db_dir.mkdir(parents=True, exist_ok=True)
    
    conn = get_db_connection()
    try:
        create_tables(conn)
        seed_data(conn)
        print("Mod 4 Relational Layer: SQLite Database initialized and seeded successfully.")
    except Exception as e:
        print(f"Mod 4 Relational Layer Error: {e}")
        raise e
    finally:
        conn.close()
        
    try:
        seed_synthetic_datasets()
    except Exception as e:
        print(f"Mod 4 DB Seeding: Synthetic datasets seeding failed: {e}")
    
    try:
        seed_vector_and_graph_db()
    except Exception as e:
        print(f"Mod 4 DB Seeding: Vector and Graph DB seeding failed/warning: {e}")

def seed_vector_and_graph_db():
    print("Mod 4: Seeding Graph and Vector Databases...")
    from vector_db import vector_db
    from graph_db import graph_db
    
    # 1. Seed Regulations text into Vector DB
    regulation_texts = {
        "REG-FAC-1948": """
        The Factories Act, 1948.
        Section 11: Cleanliness of Workrooms and Passages.
        Every factory shall be kept clean and free from effluvia arising from any drain, privy or other nuisance. 
        Accumulation of dirt and refuse shall be removed daily by sweeping or by any other effective method from the floors 
        and passages of workrooms and from staircases and seats.
        
        Section 21: Fencing of dangerous moving parts of machinery.
        In every factory, dangerous moving parts of machinery, including centrifugal pumps, drive motor shafts, coupling systems, 
        gearboxes, belts, and compressors, shall be securely fenced by safeguards of substantial construction. 
        These safeguards shall be constantly maintained and kept in position while the parts of machinery they are fencing are in motion or in use. 
        Failure to reinstall safeguards or coupling guards after maintenance constitutes a serious safety hazard and violation.
        
        Section 38: Fire safety equipment, escapes, and training.
        All factories shall be provided with effective means of escape and fire extinguishing equipment. 
        Fire safety equipment and fire pumps must have active periodic validation. Weekly testing of fire pumps and extinguishers 
        must be recorded in the safety register. Mock drills must be conducted at least once in every six months.
        """,
        "REG-PESO-2002": """
        The Petroleum Rules, 2002 (PESO).
        Rule 105: Electrical installations and flameproof enclosures in hazardous zones.
        No electrical wiring, motor, junction box, terminal, switchgear, lighting, or other apparatus shall be installed, used, 
        or operated in a hazardous location (Zone 1 or Zone 2 explosive gas atmospheres, such as crude charge pump bays) 
        unless it is certified Flameproof (FLP) or Intrinsically Safe (IS) in accordance with the Indian Standard IS/IEC 60079-1 
        and approved by the Chief Controller of Explosives (PESO).
        All junction box cover bolts must be tightly fastened to maintain the integrity of the flameproof enclosure. 
        Loose bolts or missing fasteners compromise structural safety, voiding the flameproof certification.
        
        Rule 122: Calibration and testing of safety relief valves on pressure vessels.
        All safety relief valves fitted to pressure vessels (such as LPG mounded storage vessels or separators) must be tested, 
        calibrated, and certified by a competent person recognized by PESO at least once in every twelve months. 
        Certification records must be maintained. Deferrals are not permitted without explicit written safety clearance from PESO.
        """,
        "REG-OISD-105": """
        OISD-STD-105: Work Permit System (PTW).
        Section 4.1: General Work Permit Requirements.
        No maintenance, repair, inspection, hot work, or cold work shall be carried out on any hydrocarbon processing facility, 
        pump station, storage area, or piping without a valid written Permit to Work (PTW) signed by the authorized issuer.
        
        Section 4.2: Hot Work Permit Procedures.
        Hot work permits (including welding, cutting, grinding) shall be issued only after verifying that the area is completely free 
        of flammable gas (gas test concentration must be 0.0% LEL). Safety safeguards such as fire watch, pressurized fire hoses, 
        and flame-retardant tarpaulins must be deployed. Welding on hydrocarbon pumps (e.g., Pump-14) strictly requires a Hot Work Permit.
        """,
        "REG-CPCB-ENV": """
        CPCB General Effluent and Emission Standards (Environment Protection Act Schedule VI).
        Industrial Effluent Discharge limits into inland surface waters:
        - pH value must be maintained strictly between 5.5 and 9.0.
        - Biochemical Oxygen Demand (BOD) must not exceed 30 mg/l.
        - Chemical Oxygen Demand (COD) must not exceed 250 mg/l.
        - Total Suspended Solids (TSS) must not exceed 100 mg/l.
        Daily online monitoring (OCEMS) and monthly manual lab validation are mandatory.
        
        Stack Combustion Emissions limits:
        - Sulfur Dioxide (SO2) emission from stacks must not exceed 50 mg/Nm3.
        - Nitrogen Oxides (NOx) emission from stacks must not exceed 300 mg/Nm3.
        - Particulate Matter (PM) emission must not exceed 50 mg/Nm3.
        Upload of telemetry data to the SPCB/CPCB portal is required.
        """,
        "REG-BIS-IS2148": """
        IS/IEC 60079-1: Flameproof Enclosures 'd' (BIS Standard).
        Specifies construction and testing requirements for electrical enclosures designed for explosive gas atmospheres. 
        To prevent transmission of an internal explosion to the surrounding atmosphere, all flamepaths must meet strict tolerance gaps. 
        All cover bolts must be tightened to the specified torque. Missing, loose, or corroded bolts invalidates the enclosure safety category.
        """
    }
    
    for reg_id, text in regulation_texts.items():
        title = ""
        if reg_id == "REG-FAC-1948":
            title = "The Factories Act, 1948"
        elif reg_id == "REG-PESO-2002":
            title = "The Petroleum Rules, 2002"
        elif reg_id == "REG-OISD-105":
            title = "OISD-STD-105: Work Permit System"
        elif reg_id == "REG-CPCB-ENV":
            title = "CPCB General Effluent and Emission Standards"
        elif reg_id == "REG-BIS-IS2148":
            title = "IS/IEC 60079-1: Flameproof Enclosures 'd' (BIS Standard)"
        
        try:
            vector_db.store_regulation_chunks(reg_id, title, text)
        except Exception as e:
            print(f"Mod 4: Failed to index vector chunks for {reg_id}: {e}")
            
    # 2. Seed Graph DB Nodes and Relationships
    if graph_db.use_mock:
        graph_db._save_mock_graph({"nodes": [], "relationships": []})
        
    # Upsert Assets
    assets_data = get_all_assets()
    for a in assets_data:
        graph_db.upsert_node(
            label="Asset",
            key_prop="tag",
            key_val=a["id"],
            properties={
                "name": a["name"],
                "asset_class": a["asset_class"],
                "location": a["location"],
                "criticality": a["criticality"],
                "oem_manual_ref": a["oem_manual_ref"] or "N/A"
            }
        )
        if a["parent_asset_id"]:
            graph_db.upsert_relationship(
                from_label="Asset", from_key="tag", from_val=a["id"],
                rel_type="PART_OF",
                to_label="Asset", to_key="tag", to_val=a["parent_asset_id"]
            )
            
    # Upsert Regulations
    regs_data = get_regulations()
    for r in regs_data:
        graph_db.upsert_node(
            label="Regulation",
            key_prop="id",
            key_val=r["id"],
            properties={
                "source_body": r["source_body"],
                "title": r["title"],
                "version": r["version"],
                "status": r["status"]
            }
        )
        
    # Upsert Requirements and link to Regulations & Assets
    reqs_data = get_requirements()
    for req in reqs_data:
        graph_db.upsert_node(
            label="Requirement",
            key_prop="id",
            key_val=req["id"],
            properties={
                "clause_id": req["clause_id"],
                "obligation_text": req["obligation_text"],
                "numeric_threshold": json.dumps(req["numeric_threshold"]) if req["numeric_threshold"] else "N/A"
            }
        )
        
        # Link Requirement -> Regulation
        graph_db.upsert_relationship(
            from_label="Requirement", from_key="id", from_val=req["id"],
            rel_type="UNDER_REGULATION",
            to_label="Regulation", to_key="id", to_val=req["regulation_id"]
        )
        
        # Link Requirement -> Asset class based on applicability rules
        app_rules = req["applicability_rules"]
        if app_rules:
            asset_class = app_rules.get("asset_class")
            facility_area = app_rules.get("facility_area")
            for a in assets_data:
                if (asset_class and a["asset_class"] == asset_class) or (facility_area and a["location"] == facility_area):
                    graph_db.upsert_relationship(
                        from_label="Requirement", from_key="id", from_val=req["id"],
                        rel_type="APPLIES_TO",
                        to_label="Asset", to_key="tag", to_val=a["id"]
                    )
                    
    # Link PESO certified requirements to BIS flameproof standard
    graph_db.upsert_relationship(
        from_label="Requirement", from_key="id", from_val="REQ-PESO-105",
        rel_type="REFERENCES_STANDARDS",
        to_label="Regulation", to_key="id", to_val="REG-BIS-IS2148"
    )

    print("Mod 4: Seeding Graph and Vector Databases complete.")

# -------------------------------------------------------------
# Read and Write Helper Functions for SQLite Queries
# -------------------------------------------------------------

def get_all_assets() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM assets;")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def get_asset_by_id(asset_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM assets WHERE id = ?;", (asset_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_work_orders(asset_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if asset_id:
        cursor.execute("SELECT * FROM work_orders WHERE asset_id = ?;", (asset_id,))
    else:
        cursor.execute("SELECT * FROM work_orders;")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def get_inspection_findings(asset_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if asset_id:
        cursor.execute("SELECT * FROM inspection_findings WHERE asset_id = ?;", (asset_id,))
    else:
        cursor.execute("SELECT * FROM inspection_findings;")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def add_inspection_finding(finding_id: str, asset_id: str, inspected_at: str, inspector_id: str, structured_fields: Dict[str, Any], free_text_notes: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO inspection_findings VALUES (?, ?, ?, ?, ?, ?);",
        (finding_id, asset_id, inspected_at, inspector_id, json.dumps(structured_fields), free_text_notes)
    )
    conn.commit()
    conn.close()

def get_regulations() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM regulations;")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def get_requirements(regulation_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if regulation_id:
        cursor.execute("SELECT * FROM requirements WHERE regulation_id = ?;", (regulation_id,))
    else:
        cursor.execute("SELECT * FROM requirements;")
    rows = []
    for row in cursor.fetchall():
        d = dict(row)
        if d["numeric_threshold"]:
            d["numeric_threshold"] = json.loads(d["numeric_threshold"])
        if d["applicability_rules"]:
            d["applicability_rules"] = json.loads(d["applicability_rules"])
        rows.append(d)
    conn.close()
    return rows

def insert_requirement(req_id: str, reg_id: str, clause_id: str, obligation_text: str, numeric_threshold: Optional[Dict[str, Any]], applicability_rules: Optional[Dict[str, Any]]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO requirements VALUES (?, ?, ?, ?, ?, ?);",
        (req_id, reg_id, clause_id, obligation_text, 
         json.dumps(numeric_threshold) if numeric_threshold else None,
         json.dumps(applicability_rules) if applicability_rules else None)
    )
    conn.commit()
    conn.close()

    # Dynamic Graph DB Upsert
    try:
        from graph_db import graph_db
        graph_db.upsert_node(
            label="Requirement",
            key_prop="id",
            key_val=req_id,
            properties={
                "clause_id": clause_id,
                "obligation_text": obligation_text,
                "numeric_threshold": json.dumps(numeric_threshold) if numeric_threshold else "N/A"
            }
        )
        
        # Link Requirement -> Regulation
        graph_db.upsert_relationship(
            from_label="Requirement", from_key="id", from_val=req_id,
            rel_type="UNDER_REGULATION",
            to_label="Regulation", to_key="id", to_val=reg_id
        )
        
        # Link Requirement -> Asset class based on applicability rules
        if applicability_rules:
            asset_class = applicability_rules.get("asset_class")
            facility_area = applicability_rules.get("facility_area")
            assets = get_all_assets()
            for a in assets:
                if (asset_class and a["asset_class"] == asset_class) or (facility_area and a["location"] == facility_area):
                    graph_db.upsert_relationship(
                        from_label="Requirement", from_key="id", from_val=req_id,
                        rel_type="APPLIES_TO",
                        to_label="Asset", to_key="tag", to_val=a["id"]
                    )
    except Exception as e:
        print(f"Failed to upsert requirement {req_id} to Graph DB: {e}")

def insert_asset(asset_id: str, name: str, asset_class: str, location: str, criticality: str, oem_manual_ref: Optional[str] = None, parent_asset_id: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO assets (id, name, asset_class, location, criticality, oem_manual_ref, parent_asset_id) VALUES (?, ?, ?, ?, ?, ?, ?);",
        (asset_id, name, asset_class, location, criticality, oem_manual_ref, parent_asset_id)
    )
    conn.commit()
    conn.close()

    # Dynamic Graph DB Upsert
    try:
        from graph_db import graph_db
        graph_db.upsert_node(
            label="Asset",
            key_prop="tag",
            key_val=asset_id,
            properties={
                "name": name,
                "asset_class": asset_class,
                "location": location,
                "criticality": criticality,
                "oem_manual_ref": oem_manual_ref or "N/A"
            }
        )
        if parent_asset_id:
            graph_db.upsert_relationship(
                from_label="Asset", from_key="tag", from_val=asset_id,
                rel_type="PART_OF",
                to_label="Asset", to_key="tag", to_val=parent_asset_id
            )
        
        # Link to any matching existing requirements
        reqs = get_requirements()
        for r in reqs:
            app_rules = r.get("applicability_rules")
            if app_rules:
                target_asset_class = app_rules.get("asset_class")
                target_area = app_rules.get("facility_area")
                if (target_asset_class and asset_class == target_asset_class) or (target_area and location == target_area):
                    graph_db.upsert_relationship(
                        from_label="Requirement", from_key="id", from_val=r["id"],
                        rel_type="APPLIES_TO",
                        to_label="Asset", to_key="tag", to_val=asset_id
                    )
    except Exception as e:
        print(f"Failed to upsert asset {asset_id} to Graph DB: {e}")

def insert_regulation(reg_id: str, source_body: str, title: str, document_ref: Optional[str], version: str, effective_date: str, superseded_by: Optional[str], status: str, full_text: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO regulations (id, source_body, title, document_ref, version, effective_date, superseded_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
        (reg_id, source_body, title, document_ref, version, effective_date, superseded_by, status)
    )
    conn.commit()
    conn.close()

    # Dynamic Graph DB Upsert
    try:
        from graph_db import graph_db
        graph_db.upsert_node(
            label="Regulation",
            key_prop="id",
            key_val=reg_id,
            properties={
                "source_body": source_body,
                "title": title,
                "version": version,
                "status": status
            }
        )
        if superseded_by:
            graph_db.upsert_relationship(
                from_label="Regulation", from_key="id", from_val=reg_id,
                rel_type="SUPERSEDES",
                to_label="Regulation", to_key="id", to_val=superseded_by
            )
    except Exception as e:
        print(f"Failed to upsert regulation {reg_id} to Graph DB: {e}")

    # Dynamic Vector DB Chunking & Ingestion
    if full_text:
        try:
            from vector_db import vector_db
            vector_db.store_regulation_chunks(reg_id, title, full_text)
        except Exception as e:
            print(f"Failed to index regulation text for {reg_id} in Vector DB: {e}")

def insert_work_order(wo_id: str, asset_id: str, wo_type: str, opened_at: str, closed_at: Optional[str] = None, failure_code: Optional[str] = None, cause_code: Optional[str] = None, remedy_code: Optional[str] = None, description: Optional[str] = None, technician_id: Optional[str] = None, status: str = "scheduled", cost: float = 0.0, duration_hours: float = 0.0, permit_id: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO work_orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
        (wo_id, asset_id, wo_type, opened_at, closed_at, failure_code, cause_code, remedy_code, description, technician_id, status, cost, duration_hours, permit_id)
    )
    conn.commit()
    conn.close()

def delete_requirement(req_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM requirements WHERE id = ?;", (req_id,))
    conn.commit()
    conn.close()

def get_gap_analyses(review_status: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if review_status:
        cursor.execute("SELECT * FROM gap_analyses WHERE review_status = ?;", (review_status,))
    else:
        cursor.execute("SELECT * FROM gap_analyses;")
    rows = []
    for row in cursor.fetchall():
        d = dict(row)
        d["evidence_refs"] = json.loads(d["evidence_refs"])
        rows.append(d)
    conn.close()
    return rows

def insert_gap_analysis(gap_id: str, requirement_id: str, asset_id: Optional[str], run_at: str, status: str, confidence: str, evidence_refs: List[Dict[str, Any]], review_status: str = "draft"):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO gap_analyses (id, requirement_id, asset_id, run_at, status, confidence, evidence_refs, review_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
        (gap_id, requirement_id, asset_id, run_at, status, confidence, json.dumps(evidence_refs), review_status)
    )
    conn.commit()
    conn.close()

def update_gap_analysis_review(gap_id: str, reviewed_by: str, reviewed_at: str, review_status: str = "finalized"):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE gap_analyses SET reviewed_by = ?, reviewed_at = ?, review_status = ? WHERE id = ?;",
        (reviewed_by, reviewed_at, review_status, gap_id)
    )
    conn.commit()
    conn.close()

def get_deviations() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM deviations;")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def insert_deviation(dev_id: str, requirement_id: str, source_record_type: str, source_record_id: str, detected_at: str, severity: str, description: str, related_asset_id: Optional[str]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO deviations VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
        (dev_id, requirement_id, source_record_type, source_record_id, detected_at, severity, description, related_asset_id)
    )
    conn.commit()
    conn.close()

def get_evidence_packages() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM evidence_packages;")
    rows = []
    for row in cursor.fetchall():
        d = dict(row)
        d["scope"] = json.loads(d["scope"])
        d["contents"] = json.loads(d["contents"])
        rows.append(d)
    conn.close()
    return rows

def insert_evidence_package(pkg_id: str, scope: Dict[str, Any], requested_by: str, generated_at: str, status: str, contents: List[Dict[str, Any]], summary: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO evidence_packages VALUES (?, ?, ?, ?, ?, ?, ?);",
        (pkg_id, json.dumps(scope), requested_by, generated_at, status, json.dumps(contents), summary)
    )
    conn.commit()
    conn.close()

def update_evidence_package_status(pkg_id: str, status: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE evidence_packages SET status = ? WHERE id = ?;", (status, pkg_id))
    conn.commit()
    conn.close()

def log_audit(action: str, actor: str, payload: Dict[str, Any]):
    import uuid
    from datetime import datetime
    conn = get_db_connection()
    cursor = conn.cursor()
    log_id = f"AUD-{uuid.uuid4().hex[:6].upper()}"
    cursor.execute(
        "INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?);",
        (log_id, action, actor, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps(payload))
    )
    conn.commit()
    conn.close()

def get_audit_logs() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_logs ORDER BY timestamp DESC;")
    rows = []
    for row in cursor.fetchall():
        d = dict(row)
        d["payload"] = json.loads(d["payload"])
        rows.append(d)
    conn.close()
    return rows

if __name__ == "__main__":
    initialize_database()
