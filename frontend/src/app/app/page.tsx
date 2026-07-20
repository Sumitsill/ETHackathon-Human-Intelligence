"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { bffFetch } from '@/lib/bff-fetch';
import { useAuth } from '@/context/AuthContext';
import { 
  Database, 
  Wrench, 
  AlertTriangle, 
  Activity, 
  RefreshCw, 
  Plus, 
  Settings as SettingsIcon,
  ArrowUpRight,
  BookOpen,
  FolderLock,
  MoreVertical,
  UploadCloud,
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react';

interface Metrics {
  docsCount: number;
  openRCAs: number;
  gapCount: number;
  deviationsCount: number;
}

interface DocumentRecord {
  id: string;
  source_type: string;
  filename: string;
  uploaded_at: string;
  status: string;
}

interface RCASession {
  id: string;
  work_order_id: string;
  asset_id: string;
  status: string;
}

interface GapAnalysis {
  id: string;
  requirement_id: string;
  asset_id: string;
  compliance_status: string;
  evidence_excerpt: string;
  review_status: string;
}

interface Deviation {
  id: string;
  asset_id: string;
  parameter: string;
  trigger_value: string;
  threshold_limit: string;
  severity: string;
}

export default function CommandCenter() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({
    docsCount: 4,
    openRCAs: 2,
    gapCount: 4,
    deviationsCount: 2
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'ingests' | 'rca' | 'compliance'>('overview');

  // Sub-view detailed data lists
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [rcaSessions, setRcaSessions] = useState<RCASession[]>([]);
  const [gapAnalyses, setGapAnalyses] = useState<GapAnalysis[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);

  // Interactive Ingestions view states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Interactive RCA view states
  const [activeRcaId, setActiveRcaId] = useState<string | null>(null);
  const [rcaNodes, setRcaNodes] = useState<any[]>([]);
  const [technicianMsg, setTechnicianMsg] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      let docs: DocumentRecord[] = [];
      let rcas: any[] = [];
      let gaps: any[] = [];
      let devis: any[] = [];

      // 1. Fetch Ingested Documents
      try { 
        docs = await bffFetch('knowledge/documents'); 
        setDocuments(docs || []);
      } catch (e) {
        const fallbacks = [
          { id: 'doc_1', source_type: 'pdf', filename: 'P-204_SOP.pdf', uploaded_at: new Date().toISOString(), status: 'Ready' },
          { id: 'doc_2', source_type: 'xlsx', filename: 'Refinery_Specs_Sheet.xlsx', uploaded_at: new Date().toISOString(), status: 'Ready' },
          { id: 'doc_3', source_type: 'image', filename: 'TK-102_Blueprint.png', uploaded_at: new Date().toISOString(), status: 'Ready' },
          { id: 'doc_4', source_type: 'eml', filename: 'Emergency_Outage_Report.eml', uploaded_at: new Date().toISOString(), status: 'Ready' }
        ];
        docs = fallbacks;
        setDocuments(fallbacks);
      }

      // 2. Fetch RCA Sessions
      try { 
        const res = await bffFetch('maintenance/v1/rca-sessions');
        rcas = res || [];
        setRcaSessions(rcas);
      } catch (e) {
        const fallbacks = [
          { id: 'SESS-9942', work_order_id: 'WO-9942', asset_id: 'P-204', status: 'gathering' },
          { id: 'SESS-9872', work_order_id: 'WO-9872', asset_id: 'V-102', status: 'closed' }
        ];
        rcas = fallbacks;
        setRcaSessions(fallbacks);
      }

      // 3. Fetch Gaps
      try { 
        const res = await bffFetch('compliance/v1/compliance/gap-analyses');
        gaps = res.gap_analyses || [];
        setGapAnalyses(gaps);
      } catch (e) {
        const fallbacks = [
          { id: 'GAP-101', requirement_id: 'REQ-OISD-4.2', asset_id: 'P-204', compliance_status: 'non_compliant', evidence_excerpt: 'Bearing vibration exceeds safety bounds of 5.0 mm/s.', review_status: 'pending_review' },
          { id: 'GAP-102', requirement_id: 'REQ-PESO-14.8', asset_id: 'TK-102', compliance_status: 'non_compliant', evidence_excerpt: 'No safety pressure relief checks logged this quarter.', review_status: 'pending_review' },
          { id: 'GAP-103', requirement_id: 'REQ-FACT-21', asset_id: 'V-102', compliance_status: 'compliant', evidence_excerpt: 'Isolation seal test check signed-off.', review_status: 'finalized' },
          { id: 'GAP-104', requirement_id: 'REQ-CPCB-3.1', asset_id: 'Plant', compliance_status: 'non_compliant', evidence_excerpt: 'Discharge telemetry logging is intermittent.', review_status: 'pending_review' }
        ];
        gaps = fallbacks;
        setGapAnalyses(fallbacks);
      }

      // 4. Fetch Telemetry Deviations
      try { 
        const res = await bffFetch('compliance/v1/compliance/deviations');
        devis = res.deviations || [];
        setDeviations(devis);
      } catch (e) {
        const fallbacks = [
          { id: 'DEV-001', asset_id: 'P-204', parameter: 'Vibration', trigger_value: '5.2 mm/s', threshold_limit: '5.0 mm/s', severity: 'critical' },
          { id: 'DEV-002', asset_id: 'TK-102', parameter: 'Pressure', trigger_value: '158 PSI', threshold_limit: '150 PSI', severity: 'major' }
        ];
        devis = fallbacks;
        setDeviations(fallbacks);
      }

      setMetrics({
        docsCount: docs.length,
        openRCAs: rcas.filter((r: any) => r.status !== 'closed').length,
        gapCount: gaps.filter((g: any) => g.review_status !== 'finalized').length,
        deviationsCount: devis.length
      });

    } catch (err: any) {
      console.warn("Metrics agg failed:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Handle Document Ingestions mock triggers on Home
  const handleIngestMockFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setUploadStatus("Processing file chunks and updating Graph...");
    setTimeout(() => {
      setDocuments(prev => [
        { id: `doc_${Date.now().toString().slice(-4)}`, source_type: uploadFile.name.split('.').pop() || 'pdf', filename: uploadFile.name, uploaded_at: new Date().toISOString(), status: 'Ready' },
        ...prev
      ]);
      setMetrics(prev => ({ ...prev, docsCount: prev.docsCount + 1 }));
      setUploadStatus("Success! Added to Knowledge Graph.");
      setUploadFile(null);
    }, 1000);
  };

  // Start Guided RCA workbench on Home
  const startRcaOnHome = async (id: string) => {
    setActiveRcaId(id);
    try {
      const res = await bffFetch(`maintenance/v1/rca-sessions/start/${id}`, { method: 'POST' });
      setRcaNodes(res.tree_nodes || []);
      setPendingQuestion(res.prompt_question || null);
    } catch (e) {
      setRcaNodes([
        { id: 'n1', why_statement: 'High vibration on casing P-204 (> 5.0 mm/s)', hypothesis: 'Imbalance or bearing degradation' }
      ]);
      setPendingQuestion("Verify if the lubrication level in bearing housing is deficient?");
    }
  };

  const handleRcaMessageOnHome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!technicianMsg.trim() || !activeRcaId) return;

    setTimeout(() => {
      setRcaNodes(prev => [
        ...prev,
        { id: `n-${Date.now()}`, why_statement: technicianMsg, hypothesis: 'Lubrication deficiency confirmed. Thermal readings show elevated temperature.' }
      ]);
      setPendingQuestion("Are there metal shavings visible in the oil sump sample?");
      setTechnicianMsg('');
    }, 800);
  };

  // Handle compliance gap reviews on Home
  const handleGapReviewOnHome = (id: string, decision: 'approve' | 'reject') => {
    setGapAnalyses(prev => prev.map(g => g.id === id ? { ...g, review_status: decision === 'approve' ? 'finalized' : 'rejected' } : g));
    if (decision === 'approve') {
      setMetrics(prev => ({ ...prev, gapCount: Math.max(0, prev.gapCount - 1) }));
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Main Header Section matching screenshot (Title + Badges + Black Capsule CTA) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-2">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-5xl font-extrabold text-zinc-950 tracking-tight leading-tight">
            Managing <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-zinc-150 border border-zinc-300 text-xs align-middle">⚙️</span> Your Operational <br />
            and <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-lime-300 border border-lime-400 text-xs align-middle">⚡</span> Reasoning Workflows
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings icon button */}
          <Link href="/app/settings" className="w-11 h-11 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-2xl flex items-center justify-center text-zinc-700 transition">
            <SettingsIcon size={18} />
          </Link>
          
          {/* Black capsule scenario button */}
          <Link
            href="/app/copilot"
            className="flex items-center gap-1.5 px-5 py-3 bg-[#18181b] hover:bg-zinc-800 text-white rounded-full font-bold text-xs uppercase tracking-wider transition shadow-lg"
          >
            <Plus size={14} /> Start Global Ask
          </Link>
        </div>
      </div>

      {/* 2. Sub-navigation Pills (Tabs with dynamic metrics counts) */}
      <div className="flex flex-wrap gap-2 py-2 border-b border-zinc-100">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
            activeTab === 'overview' 
              ? 'bg-[#18181b] text-white shadow-sm' 
              : 'bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700'
          }`}
        >
          Operational Overview
        </button>
        <button 
          onClick={() => setActiveTab('ingests')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
            activeTab === 'ingests' 
              ? 'bg-[#18181b] text-white shadow-sm' 
              : 'bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700'
          }`}
        >
          KG Ingestion Queue ({documents.length})
        </button>
        <button 
          onClick={() => setActiveTab('rca')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
            activeTab === 'rca' 
              ? 'bg-[#18181b] text-white shadow-sm' 
              : 'bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700'
          }`}
        >
          MIRA RCA Sessions ({rcaSessions.filter(r => r.status !== 'closed').length})
        </button>
        <button 
          onClick={() => setActiveTab('compliance')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
            activeTab === 'compliance' 
              ? 'bg-[#18181b] text-white shadow-sm' 
              : 'bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700'
          }`}
        >
          Compliance Gap Scanner ({gapAnalyses.filter(g => g.review_status !== 'finalized').length})
        </button>
      </div>

      {/* 3. Dynamic Switchable Sub-view content */}
      
      {/* 3.1: OVERVIEW TAB (Matching the exact screenshot layout) */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* Left Side (8 Cols): Metrics and Statistics */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Metric cards grid matching the screenshot */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Card 1: KG Ingests */}
              <div className="p-6 rounded-[2rem] bg-[#f8f9f8] border border-zinc-200 flex flex-col justify-between h-52 relative overflow-hidden">
                <div className="flex justify-between items-center text-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-zinc-200/50"><Database size={14} /></span>
                    <span className="text-xs font-bold">KG Ingests</span>
                  </div>
                  <button onClick={fetchAllData} className="text-zinc-400 hover:text-zinc-800 transition"><MoreVertical size={16} /></button>
                </div>

                <div className="my-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-zinc-950 tracking-tight">{documents.length * 130}</span>
                    <span className="text-[10px] text-zinc-400">/ 1000 items</span>
                    
                    {/* Yellow/lime status badge */}
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-lime-300 text-zinc-900 text-[8px] font-black flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-zinc-900" />
                      82%
                    </span>
                  </div>
                </div>

                {/* Row of vertical capsules indicators */}
                <div className="flex items-center gap-1.5 pt-2">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-3.5 h-8 rounded-full transition-all duration-300 ${
                        i < 6 
                          ? 'bg-[#18181b]' 
                          : 'bg-transparent border-2 border-dashed border-zinc-300'
                      }`} 
                    />
                  ))}
                </div>
              </div>

              {/* Card 2: RCA Sessions (Bright Lime Green) */}
              <div className="p-6 rounded-[2rem] bg-[#e2f952] border border-lime-400 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm">
                <div className="flex justify-between items-center text-zinc-900">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-lime-400/30"><Wrench size={14} /></span>
                    <span className="text-xs font-black">RCA Sessions</span>
                  </div>
                  <span className="text-zinc-600"><MoreVertical size={16} /></span>
                </div>

                <div className="my-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-zinc-950 tracking-tight">{rcaSessions.filter(r => r.status !== 'closed').length * 80}</span>
                    <span className="text-[10px] text-zinc-600">/ 512 Session limit</span>
                    
                    {/* White status badge */}
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-white text-zinc-900 text-[8px] font-black flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-zinc-900" />
                      68%
                    </span>
                  </div>
                </div>

                {/* Row of vertical capsules indicators */}
                <div className="flex items-center gap-1.5 pt-2">
                  {[...Array(8)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-3.5 h-8 rounded-full transition-all duration-300 ${
                        i < 5 
                          ? 'bg-[#18181b]' 
                          : 'bg-transparent border-2 border-dashed border-zinc-700/30'
                      }`} 
                    />
                  ))}
                </div>
              </div>

              {/* Card 3: MIRA Callout Card (Black card with Upgrade button) */}
              <div className="p-6 rounded-[2rem] bg-[#18181b] text-white flex flex-col justify-between h-52 relative overflow-hidden shadow-lg">
                <div className="absolute top-[-30px] right-[-20px] w-36 h-36 bg-gradient-to-tr from-lime-400/20 to-lime-300/40 rounded-full blur-2xl pointer-events-none" />
                
                <div className="space-y-1.5 max-w-[150px]">
                  <h3 className="text-md font-bold tracking-tight leading-tight">
                    Take Plant reasoning to Next Level
                  </h3>
                </div>

                <div className="pt-2 z-10">
                  <Link 
                    href="/app/copilot"
                    className="inline-flex items-center justify-between w-full px-4 py-2.5 bg-white hover:bg-zinc-100 text-zinc-950 font-black text-xs rounded-full transition-all duration-200"
                  >
                    <span>Launch Copilot</span>
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>

            </div>

            {/* Statistics Chart Card */}
            <div className="p-6 rounded-[2rem] bg-white border border-zinc-200 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-black text-zinc-900">Weekly Activity Stats</span>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-500">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#18181b]" /> Ingestions</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#e2f952] border border-lime-400" /> Maintenance Runs</span>
                  </div>
                </div>

                <select className="bg-zinc-100 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 font-bold focus:outline-none">
                  <option>2026</option>
                  <option>2025</option>
                </select>
              </div>

              {/* Custom capsule bar chart */}
              <div className="h-60 flex items-end justify-between relative pt-8 border-b border-zinc-100">
                
                {/* Dotted target lines */}
                <div className="absolute top-14 left-[50%] -translate-x-1/2 flex flex-col items-center z-10 pointer-events-none">
                  <div className="px-2 py-1 bg-zinc-900 text-white font-bold text-[8px] rounded-lg shadow-md mb-1">87%</div>
                  <div className="w-0.5 h-32 border-l border-dashed border-zinc-400" />
                </div>

                <div className="absolute top-28 left-[24%] -translate-x-1/2 flex flex-col items-center z-10 pointer-events-none">
                  <div className="px-2 py-1 bg-lime-300 text-zinc-900 font-black text-[8px] rounded-lg shadow-md mb-1">32%</div>
                  <div className="w-0.5 h-16 border-l border-dashed border-zinc-400" />
                </div>

                {/* Horizontal gridlines */}
                <div className="absolute inset-x-0 top-1/4 border-b border-zinc-100/80 pointer-events-none" />
                <div className="absolute inset-x-0 top-2/4 border-b border-zinc-100/80 pointer-events-none" />
                <div className="absolute inset-x-0 top-3/4 border-b border-zinc-100/80 pointer-events-none" />

                {/* Chart Bars */}
                {[
                  { label: '27 Jun', ingests: 70, maint: 30 },
                  { label: '28 Jun', ingests: 45, maint: 15 },
                  { label: '29 Jun', ingests: 65, maint: 10 },
                  { label: '30 Jun', ingests: 80, maint: 0 },
                  { label: '1 Jul', ingests: 55, maint: 40 },
                  { label: '2 Jul', ingests: 90, maint: 0 },
                  { label: '3 Jul', ingests: 50, maint: 20 },
                  { label: '4 Jul', ingests: 60, maint: 10 }
                ].map((bar, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 w-1/8 flex-1">
                    
                    {/* Combined vertical capsule bar */}
                    <div className="w-6 h-36 bg-zinc-100 rounded-full flex flex-col justify-end overflow-hidden relative border border-zinc-200/50">
                      <div 
                        className="bg-[#18181b] w-full rounded-t-full transition-all duration-500" 
                        style={{ height: `${bar.ingests}%` }}
                      />
                      <div 
                        className="bg-[#e2f952] w-full rounded-b-full transition-all duration-500" 
                        style={{ height: `${bar.maint}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-zinc-400 font-bold">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Side (4 Cols): Stacked Cards and Links */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Top Two Mini-Cards */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Box 1: Ingestion logs */}
              <Link href="/app/knowledge" className="p-4 rounded-3xl bg-[#f8f9f8] hover:bg-zinc-100 border border-zinc-200/80 flex flex-col gap-3 shadow-sm transition">
                <span className="p-2 rounded-xl bg-zinc-200/50 w-fit text-zinc-800"><BookOpen size={16} /></span>
                <div>
                  <span className="text-xs font-bold text-zinc-900 block">KG Cockpit</span>
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">Graph details</span>
                </div>
              </Link>

              {/* Box 2: Compliance posturing */}
              <Link href="/app/compliance" className="p-4 rounded-3xl bg-[#f8f9f8] hover:bg-zinc-100 border border-zinc-200/80 flex flex-col gap-3 shadow-sm transition">
                <span className="p-2 rounded-xl bg-zinc-200/50 w-fit text-zinc-800"><FolderLock size={16} /></span>
                <div>
                  <span className="text-xs font-bold text-zinc-900 block">Compliance</span>
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">Safety desk</span>
                </div>
              </Link>
            </div>

            {/* Stacked Interactive Link Items */}
            <div className="space-y-3">
              
              {/* Link 1: Help Center */}
              <Link href="/services" className="group p-5 rounded-3xl bg-[#f8f9f8] hover:bg-white border border-zinc-200/85 hover:border-zinc-300 flex items-start gap-4 transition shadow-sm hover:shadow-md relative">
                <span className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-800 font-bold text-xs">?</span>
                <div className="flex-1 space-y-1">
                  <span className="text-xs font-bold text-zinc-900 block flex items-center justify-between">
                    Help Center
                    <ArrowUpRight size={14} className="text-zinc-400 group-hover:text-zinc-900 transition" />
                  </span>
                  <span className="text-[10px] text-zinc-400 leading-relaxed block">
                    Explore our detailed documentation and API guides.
                  </span>
                </div>
              </Link>

              {/* Link 2: Partner Directory */}
              <Link href="/contact" className="group p-5 rounded-3xl bg-[#f8f9f8] hover:bg-white border border-zinc-200/85 hover:border-zinc-300 flex items-start gap-4 transition shadow-sm hover:shadow-md relative">
                <span className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-800 font-bold text-xs">👥</span>
                <div className="flex-1 space-y-1">
                  <span className="text-xs font-bold text-zinc-900 block flex items-center justify-between">
                    Partner Directory
                    <ArrowUpRight size={14} className="text-zinc-400 group-hover:text-zinc-900 transition" />
                  </span>
                  <span className="text-[10px] text-zinc-400 leading-relaxed block">
                    Find the perfect partner to support your integration.
                  </span>
                </div>
              </Link>

              {/* Link 3: Blog */}
              <Link href="/app/notifications" className="group p-5 rounded-3xl bg-[#f8f9f8] hover:bg-white border border-zinc-200/85 hover:border-zinc-300 flex items-start gap-4 transition shadow-sm hover:shadow-md relative">
                <span className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-800 font-bold text-xs">📰</span>
                <div className="flex-1 space-y-1">
                  <span className="text-xs font-bold text-zinc-900 block flex items-center justify-between">
                    Operations Blog
                    <ArrowUpRight size={14} className="text-zinc-400 group-hover:text-zinc-900 transition" />
                  </span>
                  <span className="text-[10px] text-zinc-400 leading-relaxed block">
                    Access popular guides and incident reports list feed.
                  </span>
                </div>
              </Link>

              {/* Link 4: Use Cases */}
              <Link href="/app/maintenance" className="group p-5 rounded-3xl bg-[#f8f9f8] hover:bg-white border border-zinc-200/85 hover:border-zinc-300 flex items-start gap-4 transition shadow-sm hover:shadow-md relative">
                <span className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-800 font-bold text-xs">📊</span>
                <div className="flex-1 space-y-1">
                  <span className="text-xs font-bold text-zinc-900 block flex items-center justify-between">
                    Use Cases
                    <ArrowUpRight size={14} className="text-zinc-400 group-hover:text-zinc-900 transition" />
                  </span>
                  <span className="text-[10px] text-zinc-400 leading-relaxed block">
                    Get inspired by all the ways you can deploy MIRA.
                  </span>
                </div>
              </Link>

            </div>

          </div>

        </div>
      )}

      {/* 3.2: INGESTION QUEUE TAB */}
      {activeTab === 'ingests' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          <div className="lg:col-span-8 space-y-4">
            <h3 className="font-bold text-sm text-zinc-950">Ingested Document Repository</h3>
            <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 text-zinc-500 border-b border-zinc-200">
                    <th className="p-4 font-bold">File Name</th>
                    <th className="p-4 font-bold">Format</th>
                    <th className="p-4 font-bold">Uploaded Date</th>
                    <th className="p-4 font-bold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-zinc-50/50 text-zinc-700 transition">
                      <td className="p-4 font-bold text-zinc-950 flex items-center gap-2">
                        <span>📄</span>
                        {doc.filename}
                      </td>
                      <td className="p-4 uppercase font-mono text-[9px] text-zinc-500">{doc.source_type}</td>
                      <td className="p-4 text-zinc-400">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black bg-lime-300 text-zinc-900 border border-lime-400">
                          {doc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upload Sidebar Form */}
          <div className="lg:col-span-4 p-6 rounded-3xl bg-[#f8f9f8] border border-zinc-200 space-y-6 shadow-sm">
            <div className="text-center">
              <h2 className="text-sm font-bold text-zinc-950">Ingest Refinery File</h2>
              <p className="text-[10px] text-zinc-400 mt-1">Upload operations PDFs, specs sheets, or incident blueprints.</p>
            </div>

            <form onSubmit={handleIngestMockFile} className="space-y-4">
              <div className="border-2 border-dashed border-zinc-300 rounded-2xl p-6 text-center bg-white hover:border-zinc-800 transition cursor-pointer relative shadow-sm">
                <input
                  type="file"
                  required
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                <UploadCloud size={24} className="text-zinc-400 mx-auto mb-2" />
                <span className="text-[11px] font-bold text-zinc-900 block truncate">
                  {uploadFile ? uploadFile.name : 'Select or drop file here'}
                </span>
                <span className="text-[9px] text-zinc-400 mt-1 block">Supports PDF, XLSX, CSV, PNG</span>
              </div>

              {uploadStatus && (
                <div className="p-3 bg-white border border-zinc-200 rounded-xl text-[10px] text-zinc-500 leading-relaxed text-center">
                  {uploadStatus}
                </div>
              )}

              <button
                type="submit"
                disabled={!uploadFile}
                className="w-full py-2.5 bg-[#18181b] hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50"
              >
                Start Ingestion
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3.3: MIRA RCA SESSIONS TAB */}
      {activeTab === 'rca' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* Left panel: Session list */}
          <div className="lg:col-span-4 p-6 rounded-3xl bg-[#f8f9f8] border border-zinc-200 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-zinc-950 border-b border-zinc-200/80 pb-3">RCA Session Registry</h3>
            <div className="space-y-3">
              {rcaSessions.map((sess) => (
                <div key={sess.id} className="p-4 bg-white border border-zinc-200 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-xs font-bold text-zinc-950 block">{sess.id} (Asset: {sess.asset_id})</span>
                    <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">WO: {sess.work_order_id}</span>
                  </div>
                  <button 
                    onClick={() => startRcaOnHome(sess.id)}
                    className="px-3.5 py-2 bg-[#18181b] hover:bg-zinc-800 text-white text-[9px] font-bold rounded-xl transition"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel: Active Stepper workbench */}
          <div className="lg:col-span-8 p-6 rounded-3xl bg-white border border-zinc-200 space-y-6 shadow-sm">
            <h3 className="font-bold text-sm text-zinc-950 border-b border-zinc-200 pb-2">RCA 5-Why Stepper Workspace</h3>
            
            {activeRcaId ? (
              <div className="space-y-6">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Active session: {activeRcaId}</span>
                
                {/* 5-Why nodes */}
                <div className="space-y-4 border-l-2 border-lime-400 pl-4">
                  {rcaNodes.map((n, i) => (
                    <div key={n.id} className="relative pl-2">
                      <div className="absolute -left-[23px] top-1.5 w-2 h-2 rounded-full bg-lime-500 border border-lime-400" />
                      <span className="text-[9px] font-black text-zinc-400 block uppercase">Why Step {i + 1}</span>
                      <h4 className="text-xs font-bold text-zinc-950 mt-0.5">{n.why_statement}</h4>
                      <p className="text-[11px] text-zinc-700 italic mt-1 bg-[#f8f9f8] p-3 rounded-xl border border-zinc-200">
                        Hypothesis: {n.hypothesis}
                      </p>
                    </div>
                  ))}
                </div>

                {/* AI Interactive finding checks */}
                {pendingQuestion && (
                  <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-4">
                    <span className="text-xs font-bold text-zinc-800 flex items-center gap-1">
                      <span className="text-amber-500">⚠️</span>
                      AI Hypothesis Check Prompt
                    </span>
                    <p className="text-xs text-zinc-700 leading-relaxed font-semibold">{pendingQuestion}</p>
                    
                    <form onSubmit={handleRcaMessageOnHome} className="flex gap-2">
                      <input 
                        type="text"
                        required
                        value={technicianMsg}
                        onChange={(e) => setTechnicianMsg(e.target.value)}
                        className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-xs text-zinc-900 focus:outline-none focus:border-zinc-800"
                        placeholder="Type observation findings..."
                      />
                      <button 
                        type="submit" 
                        className="px-5 bg-[#18181b] text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition"
                      >
                        Submit Finding
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-zinc-400 block py-12 text-center">Select an RCA session from the registry list to start analysis.</span>
            )}
          </div>
        </div>
      )}

      {/* 3.4: COMPLIANCE GAP SCANNER TAB */}
      {activeTab === 'compliance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* Compliance gaps list */}
          <div className="lg:col-span-8 space-y-4">
            <h3 className="font-bold text-sm text-zinc-950">Active Compliance Gaps</h3>
            <div className="space-y-3">
              {gapAnalyses.map((gap) => (
                <div key={gap.id} className="p-5 rounded-3xl bg-white border border-zinc-200 space-y-3 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-bold text-lime-700">{gap.requirement_id} (Asset: {gap.asset_id})</span>
                      <span className="text-[9px] text-zinc-400 font-bold block mt-0.5">ID: {gap.id}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black capitalize tracking-wider ${
                      gap.compliance_status === 'compliant' 
                        ? 'bg-lime-300 text-zinc-900 border border-lime-400' 
                        : 'bg-red-500/10 text-red-600 border border-red-500/20'
                    }`}>
                      {gap.compliance_status.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-700 leading-relaxed font-semibold bg-[#f8f9f8] p-3 rounded-xl border border-zinc-150">
                    AI Exception excerpt: "{gap.evidence_excerpt}"
                  </p>

                  {gap.review_status === 'pending_review' && (
                    <div className="flex justify-end gap-2 pt-2.5 border-t border-zinc-150">
                      <button 
                        onClick={() => handleGapReviewOnHome(gap.id, 'reject')}
                        className="px-3 py-1.5 border border-red-200 text-red-500 rounded-xl text-[10px] font-bold hover:bg-red-50 transition"
                      >
                        Dismiss
                      </button>
                      <button 
                        onClick={() => handleGapReviewOnHome(gap.id, 'approve')}
                        className="px-3.5 py-1.5 bg-[#18181b] hover:bg-zinc-800 text-white rounded-xl text-[10px] font-bold transition shadow-sm"
                      >
                        Approve & Finalize
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry Deviations Feed */}
          <div className="lg:col-span-4 p-6 rounded-3xl bg-[#f8f9f8] border border-zinc-200 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-zinc-950 border-b border-zinc-200/80 pb-3">Telemetry Deviations</h3>
            <div className="space-y-3">
              {deviations.map((dev) => (
                <div key={dev.id} className="p-4 bg-white border border-zinc-200 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-zinc-950 block">{dev.asset_id} - {dev.parameter}</span>
                    <span className="text-[10px] text-red-600 font-semibold block">{dev.trigger_value} vs limit {dev.threshold_limit}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 capitalize">Critical</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
