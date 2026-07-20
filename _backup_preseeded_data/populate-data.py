import os
import sys
import json
import csv
from fpdf import FPDF
from openpyxl import Workbook
from PIL import Image, ImageDraw, ImageFont

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Define the output directory
OUTPUT_DIR = "test_data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def create_text_file(filename, content):
    with open(os.path.join(OUTPUT_DIR, filename), 'w', encoding='utf-8') as f:
        f.write(content.strip())
    print(f"✅ Created: {filename}")

def create_json_file(filename, data):
    with open(os.path.join(OUTPUT_DIR, filename), 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f"✅ Created: {filename}")

def create_csv_file(filename, headers, rows):
    with open(os.path.join(OUTPUT_DIR, filename), 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    print(f"✅ Created: {filename}")

def create_pdf_file(filename, title, content):
    try:
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("Helvetica", 'B', 14)
        pdf.cell(200, 10, text=title, new_x="LMARGIN", new_y="NEXT", align='L')
        pdf.set_font("Helvetica", size=12)
        pdf.ln(5)
        pdf.multi_cell(0, 8, text=content)
        pdf.output(os.path.join(OUTPUT_DIR, filename))
        print(f"✅ Created: {filename}")
    except Exception as e:
        print(f"❌ Failed to create {filename}: {e}")

def create_excel_file(filename, headers, rows):
    try:
        wb = Workbook()
        ws = wb.active
        ws.append(headers)
        for row in rows:
            ws.append(row)
        wb.save(os.path.join(OUTPUT_DIR, filename))
        print(f"✅ Created: {filename}")
    except Exception as e:
        print(f"❌ Failed to create {filename}: {e}")

def create_image_file(filename, text):
    try:
        # Create a white canvas
        img = Image.new('RGB', (600, 100), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        # Draw basic text (default PIL font)
        draw.text((20, 40), text, fill=(0, 0, 0))
        img.save(os.path.join(OUTPUT_DIR, filename))
        print(f"✅ Created: {filename}")
    except Exception as e:
        print(f"❌ Failed to create {filename}: {e}")

def main():
    print("Generating ET Unified Operations Brain Test Fixtures...\n")

    # 1. sample_oem_manual.pdf
    create_pdf_file(
        "sample_oem_manual.pdf",
        "Centrifugal Pump Operation Manual",
        "Equipment Tag: P-204\n"
        "Model: FlowMaster 5000X\n\n"
        "Specifications:\n"
        "- Maximum operating pressure: 12 bar\n"
        "- Normal operating temperature: 75°C\n\n"
        "Maintenance Schedule:\n"
        "Inspection interval: 6 months. Standard visual inspection of seals and bearing lubrication required."
    )

    # 2. sample_inspection_scan.png
    create_image_file("sample_inspection_scan.png", "V-102 leak detected 14/07/2026, minor, tech: R. Sharma")

    # 3. sample_work_orders.xlsx
    excel_headers = ["Equipment Tag", "Date", "Description", "Technician", "Status"]
    excel_rows = [
        ["P-204", "2026-06-01", "Annual bearing replacement", "R. Sharma", "Completed"],
        ["V-102", "2026-06-15", "Valve seal check", "A. Gupta", "Pending"],
        ["C-301", "2026-07-02", "Compressor trip reset", "S. Singh", "Completed"],
        ["P-108", "2025-11-20", "Vibration analysis", "R. Sharma", "Completed"],
        ["P-311", "2025-12-05", "Lubrication failure check", "A. Gupta", "Completed"]
    ]
    create_excel_file("sample_work_orders.xlsx", excel_headers, excel_rows)

    # 4. sample_gmail_export.mbox
    mbox_content = """From R.Sharma@plant.com Mon Jul 20 10:00:00 2026
From: R. Sharma <R.Sharma@plant.com>
To: Maintenance <maint@plant.com>
Date: Mon, 20 Jul 2026 10:00:00 +0530
Subject: C-301 Trip

The C-301 compressor tripped again this morning at 09:30 due to high discharge temperature. I've initiated a reset but we need to check the cooling jacket.

From A.Gupta@plant.com Mon Jul 20 11:15:00 2026
From: A. Gupta <A.Gupta@plant.com>
To: R. Sharma <R.Sharma@plant.com>
Date: Mon, 20 Jul 2026 11:15:00 +0530
Subject: Re: C-301 Trip

Acknowledged. I'll pull the historical data on C-301 trips over the last quarter.
"""
    create_text_file("sample_gmail_export.mbox", mbox_content)

    # 5. sample_sop_startup_procedure.txt
    sop_content = """1. Verify power supply is ON at the main breaker.
2. Open suction valve fully.
3. Ensure discharge valve is at 25% open position.
4. Start the motor and observe for unusual noise.
5. Gradually open discharge valve to 100%.
6. Monitor vibration and temperature for 15 minutes before leaving area."""
    create_text_file("sample_sop_startup_procedure.txt", sop_content)

    # 6. sample_old_sop.pdf
    create_pdf_file(
        "sample_old_sop.pdf",
        "Standard Operating Procedure - Fire Water Pump",
        "Last Verified: 2024-01-01\n"
        "Equipment: FW-001\n\n"
        "Procedure: Run auxiliary diesel engine for 15 minutes weekly."
    )

    # 7. sample_failure_event.json
    create_json_file("sample_failure_event.json", {
        "event_id": "EVT-88492",
        "equipment_tag": "P-204",
        "event_time": "2026-07-20T08:15:00Z",
        "symptom": "Sudden rotor seizure and motor trip",
        "telemetry_context": {
            "vibration_mm_s": 18.5,
            "temperature_c": 95
        }
    })

    # 8. sample_telemetry_vibration.csv
    create_csv_file("sample_telemetry_vibration.csv", 
        ["timestamp", "equipment_tag", "vibration_mm_s"], [
        ["2026-07-20T08:10:00Z", "P-204", 4.2],
        ["2026-07-20T08:11:00Z", "P-204", 4.5],
        ["2026-07-20T08:12:00Z", "P-204", 15.8],
        ["2026-07-20T08:13:00Z", "P-204", 18.5]
    ])

    # 9. sample_telemetry_normal.csv
    create_csv_file("sample_telemetry_normal.csv", 
        ["timestamp", "equipment_tag", "vibration_mm_s"], [
        ["2026-07-20T08:10:00Z", "P-204", 4.2],
        ["2026-07-20T08:11:00Z", "P-204", 4.3],
        ["2026-07-20T08:12:00Z", "P-204", 4.1],
        ["2026-07-20T08:13:00Z", "P-204", 4.4]
    ])

    # 10. sample_incident_history.json
    create_json_file("sample_incident_history.json", [
        {"equipment_tag": "P-204", "failure_mode": "bearing lubrication failure", "date": "2026-07-20"},
        {"equipment_tag": "P-108", "failure_mode": "bearing lubrication failure", "date": "2025-11-20"},
        {"equipment_tag": "P-311", "failure_mode": "bearing lubrication failure", "date": "2025-12-05"}
    ])

    # 11. sample_compliance_requirements.json
    create_json_file("sample_compliance_requirements.json", [
        {
            "regulation_id": "OISD-117",
            "equipment_type": "Centrifugal Pump",
            "parameter": "max_pressure_bar",
            "limit_value": 15,
            "operator": "<="
        },
        {
            "regulation_id": "Factory Act Sec 37",
            "equipment_type": "Pressure Vessel",
            "parameter": "inspection_interval_months",
            "limit_value": 12,
            "operator": "<="
        }
    ])

    # 12. sample_equipment_readings.json
    create_json_file("sample_equipment_readings.json", [
        {"equipment_tag": "P-204", "type": "Centrifugal Pump", "current_pressure_bar": 16.5, "severity": "critical"},
        {"equipment_tag": "V-102", "type": "Pressure Vessel", "last_inspection_months_ago": 14, "severity": "major"},
        {"equipment_tag": "P-108", "type": "Centrifugal Pump", "current_pressure_bar": 15.2, "severity": "minor"}
    ])

    # 13. sample_regulation_amendment.json
    create_json_file("sample_regulation_amendment.json", {
        "regulation_id": "OISD-117",
        "amendment_date": "2026-07-01",
        "changes": [
            {
                "parameter": "max_pressure_bar",
                "new_limit_value": 10,
                "operator": "<=",
                "change_rationale": "Updated safety margins for aging assets."
            }
        ]
    })

    print("\n🎉 All fixture files generated successfully in the 'test_data' folder.")

if __name__ == "__main__":
    main()