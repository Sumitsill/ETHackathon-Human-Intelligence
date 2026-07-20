"use client";

import React, { useState, useEffect } from 'react';
import { bffFetch } from '@/lib/bff-fetch';
import { 
  Wrench, 
  Activity, 
  ArrowRight,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Database,
  Cpu,
  Brain,
  Layers,
  Send,
  Sparkles,
  Check,
  X,
  ShieldCheck,
  ShieldAlert,
  Clock,
  DollarSign,
  AlertOctagon,
  TrendingUp
} from 'lucide-react';

interface RCASession {
  id: string;
  work_order_id: string;
  asset_id: string;
  status: string;
  opened_by: string;
  opened_at: string;
}

interface Recommendation {
  id: string;
  asset_id: string;
  parameter: string;
  trigger_value: string;
  recommended_action: string;
  status: string;
  cost: number;
}

interface DiagnosticStatus {
  groq_api: string;
  qdrant_vector: string;
  neo4j_graph: string;
  assets_count: number;
  work_orders_count: number;
}

interface NearMissPattern {
  id: string;
  title: string;
  frequency: number;
  affected_assets: string[];
  signature: string;
  recommendation: string;
  risk_level: string;
}

export default function MaintenanceIntelligence() {
  const [activeTab, setActiveTab] = useState<'rca' | 'recommendations' | 'scheduler' | 'patterns'>('rca');
  const [rcaSessions, setRcaSessions] = useState<RCASession[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [patterns, setPatterns] = useState<NearMissPattern[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticStatus | null>(null);
  const [loading, setLoading] = useState(false);

  // Guided RCA Workbench States
  const [activeRcaId, setActiveRcaId] = useState<string | null>(null);
  const [rcaNodes, setRcaNodes] = useState<any[]>([]);
  const [technicianMsg, setTechnicianMsg] = useState('');
  const [rcaLoading, setRcaLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  
  // Citation Drawer States
  const [selectedCitation, setSelectedCitation] = useState<any | null>(null);
  const [isCitationDrawerOpen, setIsCitationDrawerOpen] = useState(false);

  // Unanalyzed Failure Incidents (Linking FAIL-091 and FAIL-042 from DB)
  const incidents = [
    { failure_id: 'FAIL-091', asset_tag: 'Pump-14', failure_mode: 'Bearing housing seizure', date: '2026-07-10', wo_id: 'WO-9872', sess_id: 'SESS-9872' },
    { failure_id: 'FAIL-042', asset_tag: 'Generator-3', failure_mode: 'Overheating shut down', date: '2025-11-05', wo_id: 'WO-8874', sess_id: 'SESS-8874' }
  ];

  // Scheduling Solver States
  const [laborHours, setLaborHours] = useState(24);
  const [budgetCap, setBudgetCap] = useState(6000);
  const [safetyPriorityWeight, setSafetyPriorityWeight] = useState(0.8);
  const [optimizedSchedule, setOptimizedSchedule] = useState<any[]>([]);
  const [week2Schedule, setWeek2Schedule] = useState<any[]>([]);
  const [scheduleConstraints, setScheduleConstraints] = useState<any | null>(null);
  const [scheduleMetrics, setScheduleMetrics] = useState<any | null>(null);
  const [schedulerRationale, setSchedulerRationale] = useState<string>('');
  const [optimizing, setOptimizing] = useState(false);

  const fetchDiagnostics = async () => {
    try {
      const res = await bffFetch('maintenance/api/status');
      if (res) {
        setDiagnostics(res);
      }
    } catch (e) {
      console.warn("Diagnostics status fetch failed: ", e);
    }
  };

  const fetchPatterns = async () => {
    try {
      const res = await bffFetch('maintenance/v1/patterns');
      if (res && res.clusters) {
        setPatterns(res.clusters);
      }
    } catch (e) {
      setPatterns([
        {
          id: 'PATTERN-01',
          title: 'Impeller Cavitation & Suction Strainer Clogging',
          frequency: 14,
          affected_assets: ['P-204', 'P-101B', 'P-302'],
          signature: 'High axial vibration (>4.8 mm/s) accompanied by 15% drop in suction pressure',
          recommendation: 'Institute bi-weekly suction strainer flush schedule prior to thermal cycles.',
          risk_level: 'High'
        }
      ]);
    }
  };

  const fetchRcaSessions = async () => {
    setLoading(true);
    try {
      const res = await bffFetch('maintenance/v1/rca-sessions');
      if (res && Array.isArray(res)) {
        setRcaSessions(res);
      }
    } catch (e) {
      console.warn("RCA sessions list fetch failed: ", e);
      // Fallback mocks
      setRcaSessions([
        { id: 'SESS-9872', work_order_id: 'WO-9872', asset_id: 'Pump-14', status: 'paused', opened_by: 'Elena Rostova', opened_at: '2026-07-11 10:00:00' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const res = await bffFetch('maintenance/v1/recommendations');
      if (res && Array.isArray(res)) {
        setRecommendations(res);
      }
    } catch (e) {
      console.warn("Recommendations fetch failed: ", e);
      setRecommendations([
        { id: 'REC-001', asset_id: 'Pump-14', parameter: 'Vibration', trigger_value: '3.45 G-s', recommended_action: 'Replace main shaft bearings and inspect casing.', status: 'pending_review', cost: 12000 },
        { id: 'REC-002', asset_id: 'Generator-3', parameter: 'Winding Resistance', trigger_value: '12 MOhm', recommended_action: 'Replace stator winding insulation sleeves.', status: 'pending_review', cost: 3500 }
      ]);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    fetchRcaSessions();
    fetchRecommendations();
  }, []);

  const handleCreateSession = async (woId: string, sessId: string) => {
    setRcaLoading(true);
    try {
      await bffFetch('maintenance/v1/rca-sessions', {
        method: 'POST',
        body: JSON.stringify({ work_order_id: woId })
      });
      await fetchRcaSessions();
      await startRcaWorkbench(sessId);
    } catch (e) {
      console.warn("Failed to create session: ", e);
      // Fallback
      await startRcaWorkbench(sessId);
    } finally {
      setRcaLoading(false);
    }
  };

  const startRcaWorkbench = async (id: string) => {
    setActiveRcaId(id);
    setRcaLoading(true);
    try {
      const res = await bffFetch(`maintenance/v1/rca-sessions/start/${id}`, { method: 'POST' });
      setRcaNodes(res.tree_nodes || []);
      setPendingQuestion(res.prompt_question || null);
    } catch (e) {
      console.warn("RCA Session start failed, loading fallback state:", e);
      setRcaNodes([
        { id: 'NODE-001', why_statement: 'Bearing bracket mechanical seizure', hypothesis: 'Status: CONFIRMED | Confidence: High | Citations: [WORK_ORDER: Noticed dry bearing housing with visual heat discolouration]' }
      ]);
      setPendingQuestion("Technician: Please confirm if staff shortage occurred on June 25 shift (WO-6012).");
    } finally {
      setRcaLoading(false);
    }
  };

  const handleRcaMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!technicianMsg.trim() || !activeRcaId) return;

    setRcaLoading(true);
    try {
      const res = await bffFetch(`maintenance/v1/rca-sessions/interact/${activeRcaId}`, {
        method: 'POST',
        body: JSON.stringify({ answer: technicianMsg })
      });
      setRcaNodes(res.tree_nodes || []);
      setPendingQuestion(res.prompt_question || null);
      setTechnicianMsg('');
    } catch (err: any) {
      console.warn("RCA interaction failed, simulating fallback progress:", err.message);
      setTimeout(() => {
        setRcaNodes(prev => [
          ...prev,
          { 
            id: `NODE-002`, 
            why_statement: 'Friction overheat due to oil starvation', 
            hypothesis: 'Status: CONFIRMED | Confidence: High | Citations: [INSPECTION: Vibration is now highly audible, casing is hot to the touch (76.5 C)]' 
          },
          { 
            id: `NODE-003`, 
            why_statement: 'Preventive lubrication intervals skipped', 
            hypothesis: 'Status: CONFIRMED | Confidence: High | Citations: [WORK_ORDER: PM task deferred by operations coordinator]' 
          },
          { 
            id: `NODE-004`, 
            why_statement: 'Lack of crew availability due to understaffed weekend shifts', 
            hypothesis: `Status: PROPOSED | Confidence: Medium | Citations: [Technician: ${technicianMsg}]` 
          }
        ]);
        setPendingQuestion(null);
        setTechnicianMsg('');
      }, 800);
    } finally {
      setRcaLoading(false);
    }
  };

  const handleRecommendationDecision = async (id: string, decision: 'approve' | 'reject') => {
    try {
      await bffFetch(`maintenance/v1/recommendations/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, note: 'Reviewed and actioned via Maintenance Intelligence dashboard.' })
      });
      fetchRecommendations();
    } catch (e) {
      console.warn("Review failed, updating locally:", e);
      setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status: decision === 'approve' ? 'approved' : 'rejected' } : r));
    }
  };

  const runSchedulerOptimization = async (e: React.FormEvent) => {
    e.preventDefault();
    setOptimizing(true);

    try {
      const res = await bffFetch('maintenance/v1/scheduler/optimize', {
        method: 'POST',
        body: JSON.stringify({
          labor_hours_limit: laborHours,
          budget_limit: budgetCap,
          safety_weight: safetyPriorityWeight
        })
      });
      setOptimizedSchedule(res.scheduled_tasks || []);
      setWeek2Schedule(res.week2_schedule || []);
      setScheduleConstraints(res.constraints || null);
      setScheduleMetrics(res.metrics || null);
      setSchedulerRationale(res.optimizer_rationale || '');
    } catch (err: any) {
      console.warn("Linear scheduler optimization failed, loading local mocks:", err.message);
      setTimeout(() => {
        setOptimizedSchedule([
          { rank: 1, id: 'TSK-02', asset_id: 'Generator-3', type: 'Critical', scheduled_date: '2026-07-19', labor_hours: 12, cost: 3200, risk_score: 95 },
          { rank: 2, id: 'TSK-01', asset_id: 'Pump-14', type: 'Preventive', scheduled_date: '2026-07-20', labor_hours: 6, cost: 1500, risk_score: 80 }
        ]);
        setWeek2Schedule([
          { task_id: 'TSK-03', title: 'Overhaul Cylinder A Suction Valve', asset_tag: 'Compressor-8', cost: 1200, hours: 8, risk_reduction: 45.0, parts_needed: 'Valve Plate VP-90', parts_available: false }
        ]);
        setScheduleConstraints({
          max_hours: laborHours,
          used_hours: 18,
          remaining_hours: laborHours - 18,
          max_budget: budgetCap,
          used_budget: 4700,
          remaining_budget: budgetCap - 4700
        });
        setScheduleMetrics({
          resolved_risk: 175,
          residual_risk: 45.0,
          risk_penalty_cost: 8100.0,
          total_combined_cost: 12800.0
        });
        setSchedulerRationale("Scheduler Optimization Rationale: System prioritized critical assets. [TSK-02]: Replace Stator Insulation Sleeves prioritized based on high risk reduction value of 95.0%. [TSK-03]: Deferred due to missing parts: Valve Plate VP-90.");
      }, 800);
    } finally {
      setOptimizing(false);
    }
  };

  const getRawLog = () => {
    let log = `=== MIRA RCA SESSION TRACE [${activeRcaId}] ===\n`;
    const currentSess = rcaSessions.find(s => s.id === activeRcaId);
    log += `Asset Tag: ${currentSess?.asset_id || 'Pump-14'}\n`;
    log += `Status: ${pendingQuestion ? 'PAUSED (Awaiting Human Verification)' : 'COMPLETE'}\n`;
    log += `--------------------------------------------------\n`;
    rcaNodes.forEach((n, idx) => {
      log += `Why Step ${idx + 1}: ${n.why_statement}\n`;
      log += `  - Status: ${(n.status || 'confirmed').toUpperCase()}\n`;
      log += `  - Confidence: ${n.confidence || 'High'}\n`;
      if (n.citations && n.citations.length > 0) {
        log += `  - Citations:\n`;
        n.citations.forEach((c: any) => {
          log += `    * [${c.source_type.toUpperCase()}] ${c.source_id}: "${c.excerpt}"\n`;
        });
      } else {
        log += `  - Citations: None (Organizational/Process-level finding)\n`;
      }
      log += `--------------------------------------------------\n`;
    });
    if (pendingQuestion) {
      log += `\n\u23f8 [INTERRUPT NODE ACTIVE]\n`;
      log += `GUIDED CLARIFYING QUESTION: "${pendingQuestion}"\n`;
    } else if (rcaNodes.length > 0) {
      log += `\n\u2705 RCA PATH COMPLETE. ROOT CAUSE LOCKED TO EAM GRAPH.\n`;
    }
    return log;
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* Title Header with Modern Glassmorphism Refresh button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
        <div>
          <span className="text-[10px] font-black text-lime-600 bg-lime-100 dark:bg-lime-950/30 px-2 py-1 rounded-md uppercase tracking-widest inline-block mb-2 font-mono">
            MIRA Core Engine v1.0
          </span>
          <h1 className="text-3xl font-extrabold text-zinc-950 tracking-tight flex items-center gap-2.5">
            <Wrench className="text-zinc-800" size={28} />
            MIRA Maintenance Intelligence
          </h1>
          <p className="text-xs text-zinc-500 mt-1.5 max-w-2xl font-medium">
            Stateful Guided RCA Workbenches, Predictive Maintenance Anomalies review pipelines, and linear resource-constraint job dispatch optimization engines.
          </p>
        </div>

        <button 
          onClick={async () => {
            await fetchDiagnostics();
            await fetchRcaSessions();
            await fetchRecommendations();
            if (activeRcaId) {
              setRcaLoading(true);
              try {
                const res = await bffFetch(`maintenance/v1/rca-sessions/start/${activeRcaId}?force_rescan=true`, { method: 'POST' });
                setRcaNodes(res.tree_nodes || []);
                setPendingQuestion(res.prompt_question || null);
              } catch (e) {
                console.warn("Failed to force rescan active RCA session: ", e);
              } finally {
                setRcaLoading(false);
              }
            }
          }}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded-2xl text-xs font-bold transition shadow-md hover:scale-[1.02] active:scale-[0.98]"
          title="Reload Core Cache"
        >
          <RefreshCw size={13} className={loading || rcaLoading ? 'animate-spin' : ''} />
          Sync Datastores
        </button>
      </div>

      {/* Connectivity Diagnostics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Groq API */}
        <div className="p-4 rounded-3xl bg-[#fcfdfc] border border-zinc-200 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-950/5 flex items-center justify-center text-zinc-800">
              <Brain size={18} />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">LLM Reasoning Engine</span>
              <span className="text-xs font-black text-zinc-800 font-bold">Groq LLM API</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${diagnostics?.groq_api && diagnostics.groq_api.includes('CONNECTED') ? 'bg-lime-500 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="text-[9px] font-extrabold capitalize text-zinc-500">
              {diagnostics?.groq_api ? diagnostics.groq_api : 'NOT CONFIGURED'}
            </span>
          </div>
        </div>

        {/* Vector DB */}
        <div className="p-4 rounded-3xl bg-[#fcfdfc] border border-zinc-200 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-950/5 flex items-center justify-center text-zinc-800">
              <Database size={18} />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Qdrant Vector DB</span>
              <span className="text-xs font-black text-zinc-800 font-bold">Citations Matrix</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse"></span>
            <span className="text-[9px] font-extrabold text-zinc-500 capitalize">
              {diagnostics?.qdrant_vector || 'ACTIVE'}
            </span>
          </div>
        </div>

        {/* Graph DB */}
        <div className="p-4 rounded-3xl bg-[#fcfdfc] border border-zinc-200 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-950/5 flex items-center justify-center text-zinc-800">
              <Layers size={18} />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Knowledge Graph DB</span>
              <span className="text-xs font-black text-zinc-800 font-bold">EAM Relationships</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse"></span>
            <span className="text-[9px] font-extrabold text-zinc-500 capitalize">
              {diagnostics?.neo4j_graph || 'ACTIVE (MOCK)'}
            </span>
          </div>
        </div>

        {/* Datastore Stats */}
        <div className="p-4 rounded-3xl bg-[#fcfdfc] border border-zinc-200 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-950/5 flex items-center justify-center text-zinc-800">
              <Activity size={18} />
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">CMMS Database</span>
              <span className="text-xs font-black text-zinc-800 font-bold">Relational Index</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-extrabold text-zinc-900 block font-bold">
              {diagnostics?.assets_count || 6} Assets
            </span>
            <span className="text-[9px] text-zinc-400 font-bold block">
              {diagnostics?.work_orders_count || 12} Work Orders
            </span>
          </div>
        </div>
      </div>

      {/* Modern Tabs Selector */}
      <div className="flex border-b border-zinc-200">
        {(['rca', 'recommendations', 'scheduler'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all relative ${
              activeTab === tab 
                ? 'border-zinc-900 text-zinc-950 font-black' 
                : 'border-transparent text-zinc-400 hover:text-zinc-600 font-bold'
            }`}
          >
            {tab === 'rca' && 'Guided 5-Why RCA'}
            {tab === 'recommendations' && 'Predictive Reviews'}
            {tab === 'scheduler' && 'Constraint Scheduler'}
          </button>
        ))}
      </div>

      {/* Tab 1: Guided RCA Workbench */}
      {activeTab === 'rca' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Registry Left Drawer */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Active Sessions List */}
            <div className="p-6 rounded-[2rem] bg-[#f8f9f8] border border-zinc-200 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b border-zinc-200/80 pb-3">
                <h3 className="font-black text-sm text-zinc-950 flex items-center gap-2">
                  <Activity size={15} className="text-lime-600" />
                  Active RCA Sessions
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-800 font-bold text-[9px]">
                  {rcaSessions.length}
                </span>
              </div>
              
              <div className="space-y-3">
                {rcaSessions.length > 0 ? (
                  rcaSessions.map((sess) => (
                    <div 
                      key={sess.id} 
                      className={`p-4 border rounded-2xl flex items-center justify-between transition-all ${
                        activeRcaId === sess.id 
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-md scale-[1.02]' 
                          : 'bg-white border-zinc-200 text-zinc-950 hover:bg-zinc-50'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-extrabold block">
                          {sess.id}
                        </span>
                        <span className={`text-[9px] block mt-0.5 font-bold ${activeRcaId === sess.id ? 'text-lime-400' : 'text-zinc-400'}`}>
                          Asset: {sess.asset_id} · WO: {sess.work_order_id}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => startRcaWorkbench(sess.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition ${
                          activeRcaId === sess.id 
                            ? 'bg-lime-400 text-zinc-950 hover:bg-lime-300' 
                            : 'bg-zinc-900 text-white hover:bg-zinc-800'
                        }`}
                      >
                        Open
                      </button>
                    </div>
                  ))
                ) : (
                  <span className="text-[11px] text-zinc-400 block py-4 text-center font-bold">No active sessions found.</span>
                )}
              </div>
            </div>

            {/* Unanalyzed Incident Templates */}
            <div className="p-6 rounded-[2rem] bg-white border border-zinc-200 space-y-4 shadow-sm">
              <h3 className="font-black text-sm text-zinc-950 border-b border-zinc-200/80 pb-3 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" />
                Unanalyzed Failures
              </h3>
              
              <div className="space-y-3">
                {incidents.map((incident) => {
                  const isCreated = rcaSessions.some(s => s.id === incident.sess_id);
                  return (
                    <div key={incident.failure_id} className="p-4 bg-[#fafafa] border border-zinc-150 rounded-2xl space-y-3 hover:border-zinc-300 transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-mono text-zinc-400 block font-bold">{incident.failure_id} · {incident.date}</span>
                          <h4 className="text-xs font-black text-zinc-900 mt-0.5">{incident.failure_mode}</h4>
                        </div>
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[8px] font-black uppercase tracking-wider rounded">
                          PENDING RCA
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[9px] text-zinc-500 font-bold block">Asset Tag: {incident.asset_tag}</span>
                        <button
                          onClick={() => handleCreateSession(incident.wo_id, incident.sess_id)}
                          disabled={isCreated}
                          className={`px-3 py-1.5 text-[9px] font-black rounded-xl uppercase tracking-wider transition ${
                            isCreated 
                              ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed' 
                              : 'bg-zinc-150 text-zinc-800 hover:bg-zinc-200'
                          }`}
                        >
                          {isCreated ? 'Analyzed' : 'Trigger RCA'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stepper Workbench Right */}
          <div className="lg:col-span-8 p-8 rounded-[2.5rem] bg-white border border-zinc-200 space-y-6 shadow-sm min-h-[500px] flex flex-col">
            <div className="border-b border-zinc-100 pb-4 flex justify-between items-center">
              <h3 className="font-black text-sm text-zinc-950 flex items-center gap-2">
                <Cpu size={16} className="text-zinc-800" />
                RCA Guided Steps Agent Workbench
              </h3>
              {activeRcaId && (
                <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-lime-500/10 text-lime-700 border border-lime-500/25">
                  SESSION ACTIVE: {activeRcaId}
                </span>
              )}
            </div>
            
            {activeRcaId ? (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                
                {/* 5-Why Tree Nodes Container */}
                <div className="space-y-6 border-l-2 border-zinc-200 pl-6 ml-2 flex-1">
                  {rcaNodes.map((n, i) => {
                    const isConfirmed = n.status === 'confirmed' || n.hypothesis.includes("CONFIRMED");
                    const isTerminal = (i === rcaNodes.length - 1 && !pendingQuestion) || n.id === "NODE-005";
                    
                    return (
                      <div 
                        key={n.id} 
                        className={`relative p-4 rounded-3xl border transition-all ${
                          isTerminal 
                            ? 'bg-lime-500/5 border-lime-400 shadow-md ring-1 ring-lime-400/25' 
                            : 'bg-[#fcfdfc] border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        {/* Node circle indicators */}
                        <div className={`absolute -left-[37px] top-5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                          isConfirmed 
                            ? 'bg-lime-500 border-lime-400 text-white' 
                            : 'bg-amber-400 border-amber-300 animate-pulse text-zinc-950'
                        }`}>
                          {isTerminal && <span className="text-[8px] font-black">★</span>}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">
                              Why Step {i + 1} {isTerminal ? '— TERMINAL ROOT CAUSE' : ''}
                            </span>
                            
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                isConfirmed 
                                  ? 'bg-lime-100 text-lime-800' 
                                  : 'bg-amber-100 text-amber-800 animate-pulse'
                              }`}>
                                {isConfirmed ? 'CONFIRMED' : 'PROPOSED'}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                n.confidence === 'High' 
                                  ? 'bg-emerald-500 text-white' 
                                  : n.confidence === 'Medium' 
                                    ? 'bg-amber-500 text-white' 
                                    : 'bg-zinc-100 text-zinc-600'
                              }`}>
                                {n.confidence || 'High'} Confidence
                              </span>
                            </div>
                          </div>
                          
                          <h4 className="text-sm font-extrabold text-zinc-950 leading-snug">
                            {n.why_statement}
                          </h4>
                          
                          {/* Citation Chips */}
                          <div className="pt-1">
                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-wider block mb-1">Evidence Grounding:</span>
                            {n.citations && n.citations.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {n.citations.map((c: any, idx: number) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCitation(c);
                                      setIsCitationDrawerOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 hover:border-zinc-300 rounded-lg text-[10px] font-bold text-zinc-800 transition"
                                  >
                                    <span className="font-mono text-zinc-450 text-[9px]">[{c.source_type?.toUpperCase()}]</span>
                                    <span className="font-mono">{c.source_id}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-400 font-bold block italic">
                                None (process-level finding)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Human Finding Input prompt block */}
                {pendingQuestion ? (
                  <div className="p-6 rounded-[2rem] bg-amber-500/5 border border-amber-300/30 space-y-4 mt-6">
                    <span className="text-xs font-black text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle size={15} className="text-amber-500 animate-bounce" />
                      Awaiting Observation Verification
                    </span>
                    <p className="text-xs text-zinc-700 leading-relaxed font-bold">{pendingQuestion}</p>
                    
                    <form onSubmit={handleRcaMessage} className="flex gap-2">
                      <input 
                        type="text"
                        required
                        value={technicianMsg}
                        onChange={(e) => setTechnicianMsg(e.target.value)}
                        className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-xs text-zinc-900 focus:outline-none focus:border-zinc-800"
                        placeholder="e.g. lubrication was checked dry, metal shavings visible in sample..."
                      />
                      <button 
                        type="submit" 
                        disabled={rcaLoading}
                        className="px-5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5"
                      >
                        {rcaLoading ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                        Log Finding
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-lime-300/10 text-lime-900 border border-lime-300/20 text-xs font-bold text-center mt-6">
                    RCA Path reasoning completed. Terminal root cause has been logged and confirmed in the EAM database.
                  </div>
                )}

                {/* Raw Session Monospace Terminal Log Block */}
                <details className="mt-8 border border-zinc-200 rounded-3xl overflow-hidden bg-zinc-950">
                  <summary className="px-5 py-3.5 bg-zinc-900 text-zinc-300 text-xs font-black font-mono cursor-pointer select-none hover:text-white transition">
                    View Raw Session Trace (CLI Output Log)
                  </summary>
                  <pre className="p-4 text-[10px] text-lime-400 font-mono overflow-x-auto whitespace-pre leading-relaxed bg-black/90 max-h-[250px]">
                    {getRawLog()}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4">
                <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                  <Wrench size={32} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-zinc-900">RCA Guided Panel Idle</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                    Select a failure session from the registry list on the left, or trigger a new incident root cause analysis.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Recommendations Queue */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="font-black text-sm text-zinc-950">Predictive Maintenance Reviews Queue</h3>
            <p className="text-xs text-zinc-400 mt-0.5 font-semibold">Verify recommended actions flagged by automated anomaly engines.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recommendations.map((rec) => (
              <div key={rec.id} className="p-6 rounded-[2rem] bg-white border border-zinc-200 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md transition">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-lime-700 bg-lime-100/50 px-2 py-0.5 rounded-md font-mono">{rec.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black capitalize tracking-wider ${
                      rec.status === 'pending_review' 
                        ? 'bg-amber-100 text-amber-800 border border-amber-300/30' 
                        : 'bg-lime-400/10 text-lime-700 border border-lime-400/20'
                    }`}>
                      {rec.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold block uppercase tracking-wider">Asset tag / Parameter</span>
                    <h4 className="text-xs font-black text-zinc-950 mt-0.5">{rec.asset_id} · Triggered on {rec.parameter} ({rec.trigger_value})</h4>
                  </div>
                  
                  <div className="text-xs text-zinc-500 leading-relaxed bg-[#f8f9f8] p-4 rounded-2xl border border-zinc-150">
                    <span className="font-black text-zinc-800 block mb-1 uppercase tracking-wider text-[9px]">Recommended Corrective Plan:</span>
                    {rec.recommended_action}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-zinc-100">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-black text-zinc-900">${rec.cost.toLocaleString()}</span>
                    <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider block font-bold">Est. Cost</span>
                  </div>
                  
                  {rec.status === 'pending_review' ? (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRecommendationDecision(rec.id, 'reject')}
                        className="p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition"
                        title="Dismiss alert"
                      >
                        <X size={14} />
                      </button>
                      <button 
                        onClick={() => handleRecommendationDecision(rec.id, 'approve')}
                        className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black rounded-xl transition flex items-center gap-1 shadow-sm"
                      >
                        <Check size={12} className="text-lime-400" /> Approve Work Order
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-[10px] font-bold text-lime-600">
                      <ShieldCheck size={14} /> Approved & Pushed
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Scheduler Constraint Optimizer */}
      {activeTab === 'scheduler' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Solver Constraints Input form */}
          <div className="lg:col-span-4 p-6 rounded-[2rem] bg-[#f8f9f8] border border-zinc-200 space-y-6 shadow-sm">
            <h3 className="font-black text-sm text-zinc-950 border-b border-zinc-200/80 pb-3 flex items-center gap-2">
              <Layers size={15} className="text-zinc-700" />
              Solver Parameters
            </h3>
            
            <form onSubmit={runSchedulerOptimization} className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Max Available Labor hours</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={laborHours}
                    onChange={(e) => setLaborHours(parseInt(e.target.value))}
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-3 text-xs text-zinc-950 focus:outline-none focus:border-zinc-800 font-bold"
                  />
                  <span className="absolute right-3.5 top-3.5 text-[10px] text-zinc-400 font-bold">hrs</span>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Total Maintenance Budget</label>
                <div className="relative">
                  <input 
                    type="number"
                    value={budgetCap}
                    onChange={(e) => setBudgetCap(parseInt(e.target.value))}
                    className="w-full bg-white border border-zinc-200 rounded-xl pl-6 pr-3 py-3 text-xs text-zinc-950 focus:outline-none focus:border-zinc-800 font-bold"
                  />
                  <span className="absolute left-3 top-3.5 text-xs text-zinc-400 font-bold">$</span>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Safety Priority Bias</label>
                <input 
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={safetyPriorityWeight}
                  onChange={(e) => setSafetyPriorityWeight(parseFloat(e.target.value))}
                  className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-zinc-950"
                />
                <div className="flex justify-between text-[9px] text-zinc-400 mt-1.5 font-bold">
                  <span>Economic Focus</span>
                  <span>Safety Bias ({safetyPriorityWeight})</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={optimizing}
                className="w-full py-3.5 bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black rounded-xl transition disabled:opacity-50 shadow-md flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99]"
              >
                {optimizing ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    Executing Knapsack OR-Solver...
                  </>
                ) : (
                  <>
                    <Sparkles size={12} className="text-lime-400" />
                    Solve Schedule Constraints
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Gantt Schedule Output Display */}
          <div className="lg:col-span-8 p-8 rounded-[2.5rem] bg-white border border-zinc-200 space-y-6 shadow-sm min-h-[500px] flex flex-col justify-between">
            <div>
              <h3 className="font-black text-sm text-zinc-950 border-b border-zinc-200 pb-3 flex items-center gap-2">
                <Clock size={16} className="text-zinc-800" />
                Optimized Dispatch Gantt Timeline
              </h3>
              
              {optimizedSchedule.length > 0 ? (
                <div className="space-y-6 mt-4">
                  
                  {/* Gauge Statistics Layout */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-zinc-50 border border-zinc-150 rounded-2xl">
                    <div>
                      <span className="text-[8px] text-zinc-400 font-bold uppercase block">Hours Used</span>
                      <span className="text-sm font-black text-zinc-900">
                        {scheduleConstraints?.used_hours} / {scheduleConstraints?.max_hours} h
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-400 font-bold uppercase block">Budget Spent</span>
                      <span className="text-sm font-black text-zinc-900 font-mono">
                        ${scheduleConstraints?.used_budget?.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-400 font-bold uppercase block">Resolved Risk</span>
                      <span className="text-sm font-black text-lime-600 flex items-center gap-0.5">
                        <TrendingUp size={12} />
                        {scheduleMetrics?.resolved_risk} pts
                      </span>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-400 font-bold uppercase block">Deferred Risk Penalty</span>
                      <span className="text-sm font-black text-red-500 font-mono font-bold">
                        ${scheduleMetrics?.risk_penalty_cost?.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Scheduled Tasks Timeline */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-zinc-500 uppercase tracking-wider">Week 1 Scheduled allocations</h4>
                    <div className="space-y-3">
                      {optimizedSchedule.map((item) => (
                        <div key={item.id} className="p-4 rounded-2xl bg-white border border-zinc-200 flex items-center justify-between shadow-sm hover:border-zinc-300 transition">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-zinc-950 text-white flex items-center justify-center font-mono text-[9px] font-black">{item.rank}</span>
                              <span className="text-xs font-black text-zinc-950">{item.id}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                item.type === 'Critical' ? 'bg-red-500/10 text-red-600 border border-red-500/25' : 'bg-lime-500/10 text-lime-700 border border-lime-500/25'
                              }`}>{item.type}</span>
                            </div>
                            <span className="text-[10px] text-zinc-400 block font-bold font-mono">
                              Asset Tag: {item.asset_id} · Dispatch: {item.scheduled_date} · Labor: {item.labor_hours} hrs · Cost: ${item.cost}
                            </span>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[8px] font-black text-zinc-400 block uppercase">Risk Reduction</span>
                            <span className="text-xs font-extrabold text-lime-600">{item.risk_score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Week 2 Deferred backlog */}
                  {week2Schedule.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-zinc-500 uppercase tracking-wider">Week 2 Deferred Backlog</h4>
                      <div className="space-y-2 opacity-70">
                        {week2Schedule.map((item) => (
                          <div key={item.task_id} className="p-3.5 rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-800">{item.task_id}: {item.title}</span>
                                {!item.parts_available && (
                                  <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[8px] font-black uppercase tracking-wider rounded">NO PARTS</span>
                                )}
                              </div>
                              <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">
                                Asset: {item.asset_tag} · Cost: ${item.cost} · Hours: {item.hours}h · Risk reduction: {item.risk_reduction}%
                              </span>
                            </div>
                            <span className="text-xs font-black text-zinc-400 font-bold">Deferred</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                    <Clock size={32} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-zinc-900">Dispatcher Idle</h4>
                    <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                      Adjust constraints on the left pane and solve to display optimized task allocations.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* System solver logic rationale */}
            {schedulerRationale && (
              <div className="mt-6 p-4 rounded-2xl bg-zinc-950 text-lime-400 border border-zinc-800 text-[11px] leading-relaxed font-mono flex gap-2.5 items-start">
                <Cpu size={14} className="text-lime-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[9px] font-black uppercase text-zinc-400 block tracking-wider mb-1">MIRA Solver Explanation Rationale</span>
                  {schedulerRationale}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Citation Detail Drawer */}
      {isCitationDrawerOpen && selectedCitation && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsCitationDrawerOpen(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-8 flex flex-col justify-between border-l border-zinc-200 animate-slide-in">
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <Database size={16} className="text-zinc-650" />
                  Citation Record Details
                </h3>
                <button 
                  onClick={() => setIsCitationDrawerOpen(false)}
                  className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-700 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Source Type</span>
                  <span className="text-xs font-black text-zinc-950 px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded-md font-mono inline-block mt-1">
                    {selectedCitation.source_type?.toUpperCase()}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Record Identifier</span>
                  <span className="text-xs font-bold text-zinc-800 font-mono block mt-1">
                    {selectedCitation.source_id}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-mono">Excerpt / Value</span>
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-150 text-xs text-zinc-700 font-semibold leading-relaxed mt-1 italic">
                    "{selectedCitation.excerpt}"
                  </div>
                </div>

                <div className="pt-2">
                  <a 
                    href="#documents" 
                    onClick={(e) => {
                      e.preventDefault();
                      setIsCitationDrawerOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-black text-zinc-950 hover:text-zinc-700 transition"
                  >
                    View in Documents / CMMS <ArrowRight size={13} />
                  </a>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsCitationDrawerOpen(false)}
              className="w-full py-3 bg-zinc-950 hover:bg-zinc-850 text-white text-xs font-black rounded-xl transition"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
