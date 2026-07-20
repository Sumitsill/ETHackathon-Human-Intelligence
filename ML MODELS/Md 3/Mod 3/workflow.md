# Workflow — Maintenance Intelligence & RCA Agent (MIRA)

Companion to `PRD.md`, `architecture.md`, `design.md`. Describes end-to-end operational workflows.

## Workflow 1 — Predictive Recommendation (system-initiated)

```mermaid
sequenceDiagram
    participant Historian
    participant Ingest as Streaming Ingest
    participant TS as Time-series DB
    participant Sup as Supervisor Graph
    participant Sens as Sensor Anomaly Agent
    participant RAG as OEM RAG Agent
    participant Ret as Work Order Retriever
    participant DB as Postgres
    participant Eng as Reliability Engineer
    participant CMMS

    Historian->>Ingest: continuous sensor stream
    Ingest->>TS: write readings
    loop nightly / threshold trigger
        Sup->>Sens: score all monitored assets
        Sens->>TS: get_sensor_window()
        Sens->>Sens: run_anomaly_detection() + run_rul_model()
        Sens-->>Sup: risk_score, predicted_failure_mode per asset
        Sup->>Sup: filter risk_score > threshold
        Sup->>RAG: search_oem_manual(flagged assets)
        Sup->>Ret: query_work_orders(flagged assets)
        Sup->>Sup: compose_recommendation (LLM, cites evidence)
        Sup->>DB: insert recommendation (status=pending_review)
    end
    Eng->>DB: GET /recommendations?status=pending_review
    Eng->>Sup: POST decision (approve/reject)
    alt approved
        Sup->>CMMS: push_work_order()
    end
```

**Trigger:** nightly batch scan, or a sensor anomaly crossing a hard threshold mid-day (real-time exception path).
**Human touchpoint:** Reliability Engineer reviews and approves/rejects before anything reaches the CMMS.
**Failure mode handling:** if `run_anomaly_detection`/`run_rul_model` returns low confidence, the recommendation is still surfaced but flagged `low_confidence` rather than suppressed — avoids silently hiding a marginal signal.

## Workflow 2 — RCA Session (technician-initiated)

```mermaid
sequenceDiagram
    participant Tech as Technician
    participant UI
    participant API
    participant Sup as Supervisor Graph
    participant RCA as RCA Reasoning Subgraph
    participant Ret as Retriever Agent
    participant RAG as RAG Agent
    participant KG as Knowledge Graph Agent
    participant CP as Checkpointer (Postgres)

    Tech->>UI: open RCA session on failed work order
    UI->>API: POST /rca-sessions {work_order_id}
    API->>Sup: init session
    Sup->>RCA: start subgraph (session_id, asset_id)
    par evidence gathering
        RCA->>Ret: query_work_orders(asset_id)
        RCA->>RAG: search_oem_manual(failure symptoms)
        RCA->>KG: query similar past root causes
    end
    RCA->>RCA: propose_hypothesis (grounded on evidence)
    RCA->>RCA: evaluate_hypothesis
    alt insufficient evidence
        RCA->>CP: checkpoint state (status=waiting_on_human)
        RCA-->>UI: pending_question
        Tech->>UI: answers question
        UI->>API: POST /rca-sessions/{id}/message
        API->>RCA: resume from checkpoint
    else refuted
        RCA->>RCA: backtrack to sibling hypothesis
    else supported, not terminal
        RCA->>RCA: propose_hypothesis (deeper why)
    else supported, terminal
        RCA->>KG: write confirmed root cause
        RCA->>API: session complete, return tree
    end
    UI-->>Tech: root-cause tree with citations
```

**Trigger:** technician or engineer opens an RCA session against a failure event.
**Resumability:** because state is checkpointed after every node, a technician can close the browser mid-session and resume hours later without losing reasoning progress.
**Output feedback loop:** confirmed root causes are written back to the knowledge graph, so the *next* RCA on a similar asset starts with richer evidence — this is the compounding-value mechanism of the whole system.

## Workflow 3 — Schedule Optimization (planner-initiated, periodic)

```mermaid
sequenceDiagram
    participant Planner
    participant API
    participant Sched as Schedule Optimizer Agent
    participant DB as Postgres
    participant Solver as OR-Tools Service

    Planner->>API: trigger weekly schedule run (or automatic weekly cron)
    API->>Sched: start subgraph
    Sched->>DB: pull open recommendations + PM due dates + constraints
    Sched->>Solver: solve_schedule(recommendations, constraints)
    Solver-->>Sched: proposed schedule
    Sched->>Sched: explain_schedule (LLM narrates rationale, cites risk scores)
    Sched-->>API: proposed schedule + rationale
    Planner->>API: review, adjust, publish
    API->>DB: write published schedule
```

**Conflict flagging:** if the solver cannot satisfy all constraints (e.g., two high-risk assets need the same specialist crew the same week), it returns the best feasible schedule plus a list of unresolved conflicts, which the LLM narration surfaces explicitly rather than silently dropping one asset.

## Workflow 4 — Copilot Query (conversational, any time)

```mermaid
sequenceDiagram
    participant User
    participant API
    participant Sup as Supervisor Graph
    participant Ret as Retriever Agent
    participant RAG as RAG Agent
    participant KG as KG Agent

    User->>API: POST /copilot/query {query, asset_id?}
    API->>Sup: classify_intent → copilot
    par
        Sup->>Ret: relevant work orders
        Sup->>RAG: relevant manual sections
        Sup->>KG: related past RCAs
    end
    Sup->>Sup: compose answer (must populate citations)
    Sup-->>API: answer + citations
    API-->>User: rendered answer with evidence panel
```

**Design intent:** this is the lowest-risk, fastest-to-trust surface (Phase 1 in the PRD rollout plan) — it's read-only, always cited, and builds user confidence in the system before RCA/predictive/scheduling automation is introduced.

## Cross-Workflow Invariants

- No workflow writes to the CMMS without an explicit human approval step (Workflow 1) or an explicit publish action (Workflow 3).
- Every LLM-generated user-facing claim carries `evidence_refs`; the UI has no code path that renders a claim without a citation panel.
- Every agent session (RCA, predictive scan, schedule run) is checkpointed and logged to `audit_log` for compliance replay.
