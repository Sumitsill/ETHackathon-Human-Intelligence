import os
import pandas as pd
import fitz  # PyMuPDF
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def parse_pdf(file_path: str) -> List[Dict[str, Any]]:
    """
    Extracts text page-by-page from a PDF.
    If the extracted text is extremely short (e.g., scanned PDF),
    it flags that multimodal OCR fallback is required.
    """
    pages_data = []
    total_length = 0
    
    try:
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()
            pages_data.append({
                "page": page_num + 1,
                "text": text.strip(),
                "ocr_required": False
            })
            total_length += len(text.strip())
            
        doc.close()
        
        # If average characters per page is very low, consider it a scanned PDF
        is_scanned = len(pages_data) > 0 and (total_length / len(pages_data)) < 100
        if is_scanned:
            logger.info(f"PDF {file_path} appears to be scanned (low text density). Vision fallback enabled.")
            for p in pages_data:
                p["ocr_required"] = True
                
    except Exception as e:
        logger.error(f"Error parsing PDF file {file_path}: {e}")
        raise e
        
    return pages_data

def parse_excel(file_path: str) -> Dict[str, Any]:
    """
    Parses Excel/CSV spreadsheets using pandas.
    Converts tables to Markdown formatting for ingestion by Gemini,
    limiting to sample rows if the dataset is large.
    """
    result = {}
    ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if ext == '.csv':
            df = pd.read_csv(file_path)
            result["Sheet1"] = process_dataframe(df)
        else:
            # Excel file
            xls = pd.ExcelFile(file_path)
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(xls, sheet_name=sheet_name)
                result[sheet_name] = process_dataframe(df)
    except Exception as e:
        logger.error(f"Error parsing spreadsheet {file_path}: {e}")
        raise e
        
    return result

def process_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    """Helper to convert a pandas DataFrame into structured representation."""
    # Remove entirely empty rows/columns
    df = df.dropna(how='all').dropna(axis=1, how='all')
    
    row_count = len(df)
    col_count = len(df.columns)
    columns = list(df.columns)
    
    # If the sheet is small, send the full content. Otherwise, send schema and sample
    if row_count < 100:
        markdown_table = df.to_markdown(index=False)
        full_data_sent = True
    else:
        # Send schema, summary description, and top 10 rows
        sample_df = df.head(10)
        markdown_table = (
            f"**Spreadsheet summary**: contains {row_count} rows and {col_count} columns.\n"
            f"**Columns**: {', '.join(str(c) for c in columns)}\n\n"
            f"**First 10 sample rows**:\n"
            f"{sample_df.to_markdown(index=False)}"
        )
        full_data_sent = False
        
    return {
        "columns": columns,
        "row_count": row_count,
        "markdown_content": markdown_table,
        "full_data_sent": full_data_sent,
        "raw_json": df.head(50).to_dict(orient="records") # store subset as JSON metadata
    }

def render_pdf_page_to_image(file_path: str, page_number: int) -> bytes:
    """
    Renders a specific page of a PDF as a PNG image in bytes.
    Useful for feeding scanned PDF pages to Gemini's multimodal vision API.
    """
    doc = fitz.open(file_path)
    page = doc.load_page(page_number - 1)
    
    # Render with 150 DPI for good balance of legibility and speed
    pix = page.get_pixmap(dpi=150)
    img_data = pix.tobytes("png")
    doc.close()
    return img_data
