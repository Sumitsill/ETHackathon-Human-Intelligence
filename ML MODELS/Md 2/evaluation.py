import os
import re
import json
import logging
import sqlite3
from typing import Dict, Any, List
import numpy as np
from rag_core import execute_rag_flow, retrieve_and_rerank, extract_query_entities, get_db_connection, embedder, corpus_cache

logger = logging.getLogger("evaluation")

BENCHMARK_PATH = "d:/OneDrive/Music/Desktop/ET-Hackathon-Models/Module 2/test-cases-pdf.md"
DOCVQA_PATH = "d:/OneDrive/Music/Desktop/ET-Hackathon-Models/Module 2/data/docvqa_slice.json"
FUNSD_PATH = "d:/OneDrive/Music/Desktop/ET-Hackathon-Models/Module 2/data/funsd_slice.json"
OSHA_PATH = "d:/OneDrive/Music/Desktop/ET-Hackathon-Models/Module 2/data/osha_narratives.json"

# Programmatic definition of the 10 benchmark questions for evaluation
BENCHMARK_CASES = [
    {
        "id": "Q1",
        "question": "What is the vibration limit for centrifugal pumps in continuous service under OISD-STD-118?",
        "expected_docs": ["REG-MEMO_OISD-STD-118_Reference_Note.pdf"],
        "eval_type": "retrieval_and_synthesis"
    },
    {
        "id": "Q2",
        "question": "Who should be notified once Valve V-102 isolation is verified?",
        "expected_docs": ["Verify_Test_Procedure.pdf"],
        "eval_type": "retrieval_and_synthesis"
    },
    {
        "id": "Q3",
        "question": "What is the safety regulation and vibration threshold for Pump P-204 based on the maintenance supervisor's email?",
        "expected_docs": ["Work Order WO-9942 - Emergency pump inspection", "gmail_mock_101", "REG-MEMO_OISD-STD-118_Reference_Note.pdf"], # covers filename substring
        "eval_type": "retrieval_and_synthesis"
    },
    {
        "id": "Q4",
        "question": "How often must critical rotating equipment be inspected according to OISD-STD-118?",
        "expected_docs": ["REG-MEMO_OISD-STD-118_Reference_Note.pdf"],
        "eval_type": "retrieval_and_synthesis"
    },
    {
        "id": "Q5",
        "question": "What is the inlet pressure limit to maintain for Valve V-102 isolation?",
        "expected_docs": ["Verify_Test_Procedure.pdf"],
        "eval_type": "retrieval_and_synthesis"
    },
    {
        "id": "Q6",
        "question": "Which standard governs pressure safety calibration for Pump P-204, and who is the safety officer?",
        "expected_docs": ["Regulatory compliance alert for P-204", "gmail_mock_102"],
        "eval_type": "retrieval_and_synthesis"
    },
    {
        "id": "Q7",
        "question": "What are the required permit-to-work and isolation procedures for seal or coupling work under OISD-STD-118?",
        "expected_docs": ["REG-MEMO_OISD-STD-118_Reference_Note.pdf"],
        "eval_type": "retrieval_and_synthesis"
    },
    {
        "id": "Q8",
        "question": "Compare the vibration limits mentioned in the OISD-STD-118 reference note and the emergency pump inspection email for P-204.",
        "expected_docs": ["REG-MEMO_OISD-STD-118_Reference_Note.pdf", "Work Order WO-9942 - Emergency pump inspection", "gmail_mock_101"],
        "eval_type": "cross_doc_synthesis"
    },
    {
        "id": "Q9",
        "question": "What is the capital of France?",
        "expected_docs": [],
        "eval_type": "grounding_refusal"
    },
    {
        "id": "Q10",
        "question": "Who is John Doe and what was his assignment regarding Pump P-204?",
        "expected_docs": ["Work Order WO-9942 - Emergency pump inspection", "gmail_mock_101"],
        "eval_type": "retrieval_and_synthesis"
    }
]


# Helper to temporarily inject and clean up a document for evaluation
def inject_temporary_document(doc_id: str, filename: str, content: str, source_type: str) -> List[str]:
    conn = get_db_connection()
    # Register document
    conn.execute(
        "INSERT OR REPLACE INTO documents (id, source_type, filename, uploaded_at, status) VALUES (?, ?, ?, datetime('now'), 'Ready')",
        (doc_id, source_type, filename)
    )
    
    # Simple chunking
    from rag_core import chunk_document_by_type
    chunks = chunk_document_by_type(content, doc_id, filename, source_type, "Page 1")
    
    chunk_ids = []
    for c in chunks:
        # Dummy zero vector to satisfy SQLite BLOB column
        dummy_emb = np.zeros(384, dtype=np.float32).tobytes()
        conn.execute(
            "INSERT OR REPLACE INTO chunks (id, document_id, content, embedding, page_or_ref) VALUES (?, ?, ?, ?, ?)",
            (c["id"], doc_id, c["content"], dummy_emb, c["page_or_ref"])
        )
        chunk_ids.append(c["id"])
        
        # Inject into local embedder cache
        corpus_cache.cache[c["id"]] = embedder.embed(c["content"])
        
    conn.commit()
    conn.close()
    return chunk_ids

def cleanup_temporary_document(doc_id: str, chunk_ids: List[str]):
    conn = get_db_connection()
    conn.execute("DELETE FROM chunks WHERE document_id = ?", (doc_id,))
    conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()
    for cid in chunk_ids:
        if cid in corpus_cache.cache:
            del corpus_cache.cache[cid]


def seed_evaluation_data():
    """Seeds the SQLite database with the standard corpus if not already populated."""
    conn = get_db_connection()
    doc_ids = [r['id'] for r in conn.execute("SELECT id FROM documents").fetchall()]
    
    # 1. Seed doc_verify_test_001 if missing
    if "doc_verify_test_001" not in doc_ids:
        logger.info("Seeding doc_verify_test_001...")
        from main import run_groq_ingestion_pipeline
        run_groq_ingestion_pipeline(
            "doc_verify_test_001",
            "PROCEDURE: Valve V-102 Isolation and Maintenance.\nDate: 2026-07-14. Author: John Engineer.\n1. Turn Valve V-102 clockwise to isolate the downstream piping.\n2. Keep the inlet pressure below 150 PSI to avoid pressure shocks.\n3. This procedure complies with standard ASME B31.3 piping regulations.\n4. Notify Supervisor Dave Miller once isolation is verified.",
            "Verify_Test_Procedure.pdf",
            "pdf",
            "Page 1"
        )
        
    # 2. Seed gmail_mock_101 if missing
    if "gmail_mock_101" not in doc_ids:
        logger.info("Seeding gmail_mock_101...")
        from main import run_groq_ingestion_pipeline
        run_groq_ingestion_pipeline(
            "gmail_mock_101",
            "Subject: Work Order WO-9942 - Emergency pump inspection\nSender: maintenance-supervisor@refinery.com\nDate: 2026-07-10T14:30:00Z\n\nBody:\nHi Team,\n\nWe need to execute an emergency safety inspection on Pump P-204 due to high vibration alarms. The vibration levels hit 8.5 mm/s, exceeding our operating limit of 5.0 mm/s. Please assign Engineer John Doe to perform the vibration analysis and report back as per standard API-610 regulations.\n\nThanks,\nDave Miller\nMaintenance Supervisor",
            "Email: Work Order WO-9942 - Emergency pump inspection",
            "gmail",
            "Email Body"
        )
        
    # 3. Seed gmail_mock_102 if missing
    if "gmail_mock_102" not in doc_ids:
        logger.info("Seeding gmail_mock_102...")
        from main import run_groq_ingestion_pipeline
        run_groq_ingestion_pipeline(
            "gmail_mock_102",
            "Subject: Regulatory compliance alert for P-204\nSender: safety-officer@refinery.com\nDate: 2026-07-12T09:15:00Z\n\nBody:\nHello,\n\nThis is a reminder that Pump P-204 is overdue for its annual pressure safety calibration. Under standard OSHA-1910.119 process safety management rules, all core equipment must be calibrated and logged. Let's make sure we log this under the equipment tags correctly.\n\nRegards,\nSarah Connor\nLead Safety Officer",
            "Email: Regulatory compliance alert for P-204",
            "gmail",
            "Email Body"
        )
        
    # 4. Seed regulatory memo if missing
    has_oisd = False
    for did in doc_ids:
        doc = conn.execute("SELECT filename FROM documents WHERE id = ?", (did,)).fetchone()
        if doc and "OISD-STD-118" in doc["filename"]:
            has_oisd = True
            break
            
    if not has_oisd:
        pdf_path = "d:/OneDrive/Music/Desktop/ET-Hackathon-Models/Module 1/backend/uploads/REG-MEMO_OISD-STD-118_Reference_Note.pdf"
        if os.path.exists(pdf_path):
            logger.info("Seeding OISD-STD-118 pdf reference memo...")
            import pypdf
            reader = pypdf.PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
                
            from main import run_groq_ingestion_pipeline
            run_groq_ingestion_pipeline(
                "doc_regulatory_memo",
                text,
                "REG-MEMO_OISD-STD-118_Reference_Note.pdf",
                "pdf",
                "Page 1"
            )
    conn.close()


# -------------------------------------------------------------
# 1. 10-Question Benchmark Evaluator
# -------------------------------------------------------------

def evaluate_synthetic_benchmark() -> Dict[str, Any]:
    """Runs evaluation on the 10 benchmark questions and reports metrics."""
    seed_evaluation_data() # Ensure DB is seeded
    corpus_cache.refresh() # Make sure cached vectors are updated
    
    total_questions = len(BENCHMARK_CASES)
    retrieval_hits = 0
    citation_valid_count = 0
    refusals_correct = 0
    synthesis_succeeded = 0
    
    results = []
    
    for case in BENCHMARK_CASES:
        qid = case["id"]
        question = case["question"]
        expected_docs = case["expected_docs"]
        eval_type = case["eval_type"]
        
        logger.info(f"Evaluating {qid}: {question}")
        
        # Run Retrieval
        retrieved_chunks = retrieve_and_rerank(question, top_n=5)
        retrieved_files = [ch["filename"] for ch in retrieved_chunks]
        
        # Check Retrieval@k (was the expected document in the top-5 merged results)
        ret_hit = False
        if not expected_docs:
            # Q9 (off-topic) should have no expected docs, so it's a retrieval hit by default
            ret_hit = True
        else:
            for exp in expected_docs:
                if any(exp.lower() in rf.lower() for rf in retrieved_files):
                    ret_hit = True
                    
        if ret_hit:
            retrieval_hits += 1
            
        # Run Complete RAG flow
        rag_res = execute_rag_flow(question)
        answer = rag_res["answer"]
        confidence = rag_res["confidence"]
        sources = rag_res["sources"]
        
        # Check Citation validity
        citations_valid = True
        if expected_docs:
            citations_in_text = re.findall(r'\[(?:Source\s*ID:\s*)?([a-zA-Z0-9_\-\:\s]+)\]', answer, re.IGNORECASE)
            # Filter out numeric only
            citations_in_text = [c.strip() for c in citations_in_text if not re.match(r'^\d+$', c.strip())]
            if not citations_in_text:
                citations_valid = False
            else:
                for cit in citations_in_text:
                    # Verify each citation maps to a source file containing the expected substring
                    conn = get_db_connection()
                    row = conn.execute("""
                        SELECT d.filename FROM chunks c 
                        JOIN documents d ON c.document_id = d.id 
                        WHERE c.id = ?
                    """, (cit,)).fetchone()
                    conn.close()
                    if not row:
                        citations_valid = False
                    else:
                        filename = row["filename"]
                        # Citation must belong to one of our retrieved files
                        if not any(exp.lower() in filename.lower() for exp in expected_docs):
                            citations_valid = False
        else:
            # For Q9, there should be no citations
            citations_valid = len(sources) == 0
            
        if citations_valid:
            citation_valid_count += 1
            
        # Check Refusal
        is_refused = "not found in the documents" in answer.lower() or "unable to find" in answer.lower() or "not found" in answer.lower()
        if eval_type == "grounding_refusal":
            refusal_correct = is_refused
            if refusal_correct:
                refusals_correct += 1
        else:
            refusal_correct = None
            
        # Check Synthesis success (Q3 and Q8)
        synthesis_pass = True
        if eval_type == "cross_doc_synthesis" or qid == "Q3":
            # For Q3 and Q8, verify that key facts from both/all docs are synthesized
            if qid == "Q3":
                synthesis_pass = "8.5" in answer and "5.0" in answer
            elif qid == "Q8":
                synthesis_pass = "4.5" in answer and "5.0" in answer or "8.5" in answer
                
            if synthesis_pass:
                synthesis_succeeded += 1
        else:
            synthesis_pass = None
            
        results.append({
            "id": qid,
            "question": question,
            "retrieval_hit": ret_hit,
            "citations_valid": citations_valid,
            "refusal_correct": refusal_correct,
            "synthesis_pass": synthesis_pass,
            "confidence": confidence,
            "answer": answer
        })
        
    metrics = {
        "retrieval_at_5": (retrieval_hits / total_questions) * 100,
        "citation_validity_rate": (citation_valid_count / total_questions) * 100,
        "grounding_refusal_rate": refusals_correct * 100 if refusals_correct is not None else 100.0,
        "synthesis_success_rate": (synthesis_succeeded / 2) * 100 # Q3 and Q8
    }
    
    return {"metrics": metrics, "details": results}


# -------------------------------------------------------------
# 2. DocVQA Slice Evaluator (Generalization Check)
# -------------------------------------------------------------

def evaluate_docvqa_slice() -> Dict[str, Any]:
    """Evaluates RAG on the DocVQA industrial slice and computes accuracy."""
    if not os.path.exists(DOCVQA_PATH):
        return {"error": "DocVQA slice data file not found."}
        
    with open(DOCVQA_PATH, "r", encoding="utf-8") as f:
        docvqa_data = json.load(f)
        
    total = len(docvqa_data)
    exact_match = 0
    contains_match = 0
    results = []
    
    for idx, item in enumerate(docvqa_data):
        question = item["question"]
        doc_text = item["document"]
        gold_answers = item["answers"]
        
        # Inject Doc temporarily
        temp_doc_id = f"docvqa_eval_temp_{idx}"
        chunk_ids = inject_temporary_document(temp_doc_id, f"DocVQA_Ref_{idx}.txt", doc_text, "pdf")
        
        # Run Q&A
        rag_res = execute_rag_flow(question)
        answer = rag_res["answer"]
        
        # Cleanup Doc
        cleanup_temporary_document(temp_doc_id, chunk_ids)
        
        # Check matches (lenient match)
        is_em = any(ans.lower() == answer.strip().lower() for ans in gold_answers)
        is_contains = any(ans.lower() in answer.lower() for ans in gold_answers)
        
        if is_em:
            exact_match += 1
        if is_contains:
            contains_match += 1
            
        results.append({
            "question": question,
            "answer": answer,
            "gold_answers": gold_answers,
            "is_exact_match": is_em,
            "is_contains": is_contains
        })
        
    accuracy_em = (exact_match / total) * 100 if total > 0 else 0
    accuracy_contains = (contains_match / total) * 100 if total > 0 else 0
    
    return {
        "accuracy_em": accuracy_em,
        "accuracy_contains": accuracy_contains,
        "details": results
    }


# -------------------------------------------------------------
# 3. FUNSD Slice Evaluator (Extraction Quality)
# -------------------------------------------------------------

def evaluate_funsd_slice() -> Dict[str, Any]:
    """Evaluates Entity Extraction precision/recall against FUNSD gold annotations."""
    if not os.path.exists(FUNSD_PATH):
        return {"error": "FUNSD slice data file not found."}
        
    with open(FUNSD_PATH, "r", encoding="utf-8") as f:
        funsd_data = json.load(f)
        
    from rag_core import groq_client
    
    results = []
    total_gold_entities = 0
    total_extracted_entities = 0
    true_positives = 0
    
    for idx, item in enumerate(funsd_data):
        text = item["text"]
        gold_annotations = item["annotations"] # dict of Field -> Value
        
        # Prompt Groq to extract fields
        prompt = (
            "Analyze the form text below and extract all field keys and their corresponding values in a JSON dictionary.\n"
            "Format: { \"Key\": \"Value\" }\n"
            "Do not output markdown code blocks.\n\n"
            f"Form Text:\n{text}"
        )
        
        extracted = {}
        if groq_client:
            try:
                response = groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.0
                )
                extracted = json.loads(response.choices[0].message.content)
            except Exception as e:
                logger.error(f"Groq FUNSD extraction failed: {e}")
                
        # Calculate matching metrics
        gold_count = len(gold_annotations)
        ext_count = len(extracted)
        
        tp = 0
        for k, v in gold_annotations.items():
            # Check if key is extracted and value matches (fuzzy match)
            match_found = False
            for ek, ev in extracted.items():
                if k.lower() in ek.lower() or ek.lower() in k.lower():
                    if v.lower() in ev.lower() or ev.lower() in v.lower():
                        match_found = True
                        break
            if match_found:
                tp += 1
                
        total_gold_entities += gold_count
        total_extracted_entities += ext_count
        true_positives += tp
        
        results.append({
            "text_snippet": text[:50] + "...",
            "gold": gold_annotations,
            "extracted": extracted,
            "tp": tp,
            "gold_count": gold_count,
            "ext_count": ext_count
        })
        
    precision = (true_positives / total_extracted_entities) * 100 if total_extracted_entities > 0 else 0
    recall = (true_positives / total_gold_entities) * 100 if total_gold_entities > 0 else 0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    return {
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "details": results
    }


# -------------------------------------------------------------
# 4. OSHA Incident Safety Evaluator
# -------------------------------------------------------------

def evaluate_osha_slice() -> Dict[str, Any]:
    """Evaluates RAG's capacity to synthesize and reason about real safety incidents."""
    if not os.path.exists(OSHA_PATH):
        return {"error": "OSHA narratives file not found."}
        
    with open(OSHA_PATH, "r", encoding="utf-8") as f:
        osha_data = json.load(f)
        
    total = len(osha_data)
    reasoning_succeeded = 0
    results = []
    
    for idx, item in enumerate(osha_data):
        incident_id = item["id"]
        text = item["text"]
        expected_cause = item["cause"]
        
        # Inject OSHA document
        temp_doc_id = f"osha_eval_temp_{idx}"
        chunk_ids = inject_temporary_document(temp_doc_id, f"OSHA_Report_{incident_id}.txt", text, "pdf")
        
        # Run Q&A asking for root cause
        question = "What was the cause of the incident described in report?"
        rag_res = execute_rag_flow(question)
        answer = rag_res["answer"]
        
        # Cleanup
        cleanup_temporary_document(temp_doc_id, chunk_ids)
        
        # Check if the generated answer captures the key causes/equipment
        # We search for sub-words or phrases from expected cause in the answer
        keywords = [w.lower() for w in re.findall(r'\w+', expected_cause) if len(w) > 4]
        match_count = sum(1 for kw in keywords if kw in answer.lower())
        
        is_success = match_count >= (len(keywords) // 2) if keywords else True
        if is_success:
            reasoning_succeeded += 1
            
        results.append({
            "incident_id": incident_id,
            "answer": answer,
            "expected_cause": expected_cause,
            "keyword_match_rate": (match_count / len(keywords)) * 100 if keywords else 100.0,
            "is_success": is_success
        })
        
    success_rate = (reasoning_succeeded / total) * 100 if total > 0 else 0
    return {
        "success_rate": success_rate,
        "details": results
    }
