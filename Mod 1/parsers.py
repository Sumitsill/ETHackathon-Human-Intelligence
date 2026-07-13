import os
import email
from email import policy
import fitz  # PyMuPDF
import pandas as pd
from typing import Dict, Any, List, Tuple
from gemini_client import client, ExtractionResult

def parse_pdf(file_path: str) -> Tuple[str, List[Tuple[bytes, str]]]:
    """
    Parses a PDF file.
    Returns:
        - raw_text: Combined text from native PDF pages.
        - page_images: List of (image_bytes, mime_type) for visual processing if scanned.
    """
    raw_text = ""
    page_images = []
    
    try:
        doc = fitz.open(file_path)
        for i in range(len(doc)):
            page = doc[i]
            text = page.get_text()
            if text.strip():
                raw_text += f"--- Page {i+1} ---\n{text}\n"
            
            # Render page as PNG image bytes for vision fallback / P&ID / Scanned documents
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            page_images.append((img_bytes, "image/png"))
            
        doc.close()
    except Exception as e:
        print(f"Error parsing PDF {file_path}: {e}")
        
    return raw_text, page_images

def parse_image(file_path: str) -> Tuple[bytes, str]:
    """
    Reads an image file (PNG, JPG, JPEG) and returns its bytes and MIME type.
    """
    mime_type = "image/png"
    if file_path.lower().endswith(".jpg") or file_path.lower().endswith(".jpeg"):
        mime_type = "image/jpeg"
        
    with open(file_path, "rb") as f:
        img_bytes = f.read()
        
    return img_bytes, mime_type

def parse_spreadsheet(file_path: str) -> str:
    """
    Parses spreadsheets (CSV, XLSX, XLS) using pandas.
    Converts the content to a markdown-styled text string for LLM readability.
    """
    try:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".csv":
            df = pd.read_csv(file_path)
        elif ext in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported spreadsheet extension: {ext}")
            
        # Serialize the DataFrame to CSV text representation
        csv_str = df.to_csv(index=False)
        return csv_str
    except Exception as e:
        print(f"Error parsing spreadsheet {file_path}: {e}")
        return f"Spreadsheet Parse Failure: {e}"

def parse_email(file_path: str) -> Dict[str, Any]:
    """
    Parses EML/TXT email archives using Python standard email library.
    Extracts headers and the main text body.
    """
    result = {
        "headers": {},
        "body": ""
    }
    try:
        with open(file_path, "rb") as f:
            # parsing with policy.default to handle headers and structure cleanly
            msg = email.message_from_binary_file(f, policy=policy.default)
            
        # Extract headers
        for header_name in ["subject", "from", "to", "date"]:
            result["headers"][header_name] = msg.get(header_name, "N/A")
            
        # Extract body
        body_parts = []
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get_content_disposition())
                
                # We want plain text bodies
                if content_type == "text/plain" and "attachment" not in content_disposition:
                    try:
                        body_parts.append(part.get_content())
                    except Exception:
                        body_parts.append(part.get_payload(decode=True).decode(errors="replace"))
        else:
            try:
                body_parts.append(msg.get_content())
            except Exception:
                body_parts.append(msg.get_payload(decode=True).decode(errors="replace"))
                
        result["body"] = "\n".join(body_parts).strip()
        
    except Exception as e:
        print(f"Error parsing email {file_path}: {e}")
        # fallback simple parse
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                result["body"] = f.read()
        except Exception as inner_e:
            result["body"] = f"Email Parse Failure: {inner_e}"
            
    return result

def route_and_extract(file_path: str) -> Dict[str, Any]:
    """
    Routes file to correct parser, extracts raw text & document properties.
    Determines if document needs vision-based Gemini processing.
    """
    filename = os.path.basename(file_path)
    ext = os.path.splitext(file_path)[1].lower()
    
    # Structure of output
    doc_data = {
        "filename": filename,
        "source_path": os.path.abspath(file_path),
        "type": "unknown",
        "text_content": "",
        "entities": None
    }
    
    print(f"Routing file: {filename} ({ext})")
    
    if ext == ".pdf":
        raw_text, page_images = parse_pdf(file_path)
        
        # Decide if it is scanned (very little text extracted compared to page count)
        # Let's say if text has less than 40 characters per page, it's scanned or a P&ID drawing.
        is_scanned = len(raw_text.strip()) < (40 * len(page_images))
        
        # Check if the filename hints that it is a P&ID blueprint
        is_pid = "p&id" in filename.lower() or "pid" in filename.lower() or "drawing" in filename.lower()
        
        if is_pid:
            doc_data["type"] = "p&id"
        elif is_scanned:
            doc_data["type"] = "scanned_form"
        else:
            doc_data["type"] = "manual"  # Native pdf manual or procedure
            
        if is_pid or is_scanned:
            print(f"PDF identified as visually-driven ({doc_data['type']}). Invoking Gemini Vision extraction...")
            # We process page images with Vision. For simplicity, we process the first 3 pages if multiple.
            combined_entities = ExtractionResult(document_id=filename)
            vision_texts = []
            
            for idx, (img_bytes, mime) in enumerate(page_images[:3]):
                page_id = f"{filename}_page_{idx+1}"
                res = client.extract_entities_from_image(img_bytes, mime, filename)
                
                # Merge entities
                combined_entities.equipment_tags.extend(res.equipment_tags)
                combined_entities.process_parameters.extend(res.process_parameters)
                combined_entities.regulatory_references.extend(res.regulatory_references)
                combined_entities.personnel.extend(res.personnel)
                combined_entities.dates.extend(res.dates)
                
                # Generate mock representation text for vector chunking
                vision_texts.append(f"Visual Text Page {idx+1} representation: Equipment tags: {', '.join([e.tag for e in res.equipment_tags])}")
                
            doc_data["text_content"] = "\n".join(vision_texts) + f"\n[Visual extraction completed for {filename}]"
            doc_data["entities"] = combined_entities
        else:
            print(f"PDF identified as text-rich. Extracting entities via Gemini Text API...")
            doc_data["text_content"] = raw_text
            doc_data["entities"] = client.extract_entities_from_text(raw_text[:30000], filename) # limit token window for text
            
    elif ext in [".png", ".jpg", ".jpeg"]:
        img_bytes, mime = parse_image(file_path)
        is_pid = "p&id" in filename.lower() or "pid" in filename.lower() or "drawing" in filename.lower()
        doc_data["type"] = "p&id" if is_pid else "scanned_form"
        
        print(f"Processing image {filename} as {doc_data['type']} using Gemini Vision...")
        res = client.extract_entities_from_image(img_bytes, mime, filename)
        doc_data["entities"] = res
        doc_data["text_content"] = f"Image OCR extraction of {filename}. Equipment tags: {', '.join([e.tag for e in res.equipment_tags])}"
        
    elif ext in [".xlsx", ".xls", ".csv"]:
        doc_data["type"] = "spreadsheet"
        sheet_text = parse_spreadsheet(file_path)
        doc_data["text_content"] = sheet_text
        print(f"Processing spreadsheet {filename} via Gemini Text API...")
        # Since Excel content is now in text format, extract entities
        doc_data["entities"] = client.extract_entities_from_text(sheet_text[:30000], filename)
        
    elif ext in [".eml", ".txt"]:
        doc_data["type"] = "email" if ext == ".eml" else "text"
        email_data = parse_email(file_path)
        
        header_context = "\n".join([f"{k.capitalize()}: {v}" for k, v in email_data["headers"].items()])
        full_text = f"Headers:\n{header_context}\n\nBody:\n{email_data['body']}"
        doc_data["text_content"] = full_text
        
        print(f"Processing email/text {filename} via Gemini Text API...")
        doc_data["entities"] = client.extract_entities_from_text(full_text[:30000], filename)
        
    else:
        # Fallback simple text reader
        doc_data["type"] = "unknown"
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                raw_text = f.read()
            doc_data["text_content"] = raw_text
            doc_data["entities"] = client.extract_entities_from_text(raw_text[:30000], filename)
        except Exception as e:
            print(f"Skipping unsupported file {filename}: {e}")
            
    return doc_data

if __name__ == "__main__":
    # Test routing logic if run directly
    print("Parsers implementation loaded.")
