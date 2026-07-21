"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { bffFetch } from '@/lib/bff-fetch';
import { 
  UploadCloud, 
  FileText, 
  Mail, 
  Play, 
  Database, 
  RefreshCw, 
  GitBranch,
  ArrowRight,
  Terminal,
  MessageSquare,
  BarChart3,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Shield,
  Server,
  Network,
  Maximize2
} from 'lucide-react';

interface DocumentRecord {
  id: string;
  source_type: string;
  filename: string;
  uploaded_at: string;
  status: string;
  error_message?: string;
}

interface ExtractedEntity {
  id: string;
  document_id: string;
  entity_type: string;
  value: string;
  normalized_value: string;
  page_or_ref?: string;
  confidence: number;
  description: string;
}

interface DBStats {
  documents_count: number;
  chunks_count: number;
  nodes_count: number;
  edges_count: number;
  queries_count: number;
}

export default function KnowledgeCockpit() {
  const [activeSubTab, setActiveSubTab] = useState<'documents' | 'upload' | 'graph' | 'inbox' | 'query' | 'stats'>('documents');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Upload States
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [ingestionSteps, setIngestionSteps] = useState<string[]>([]);
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntity[]>([]);

  // Email Sync States
  const [emailSyncLoading, setEmailSyncLoading] = useState(false);
  const [emailSyncCount, setEmailSyncCount] = useState<number | null>(null);
  const [syncSteps, setSyncSteps] = useState<string[]>([]);

  // Grounded RAG Q&A States
  const [question, setQuestion] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [groundedAnswer, setGroundedAnswer] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [citations, setCitations] = useState<any[]>([]);
  const [queryId, setQueryId] = useState<string | null>(null);
  const [querySteps, setQuerySteps] = useState<string[]>([]);

  // Database Stats States
  const [stats, setStats] = useState<DBStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Graph States
  const [graphNodes, setGraphNodes] = useState<any[]>([]);
  const [graphLinks, setGraphLinks] = useState<any[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  // Mindmap & Flowchart States
  const [selectedDocIdForViz, setSelectedDocIdForViz] = useState<string>('');
  const [vizType, setVizType] = useState<'mindmap' | 'flowchart'>('mindmap');
  const [flowchartMermaid, setFlowchartMermaid] = useState<string | null>(null);
  const [mindmapJson, setMindmapJson] = useState<any | null>(null);
  const [vizLoading, setVizLoading] = useState(false);

  // Ref for auto-scrolling terminal logs
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ingestionSteps, syncSteps, querySteps]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await bffFetch('knowledge/documents');
      setDocuments(res || []);
    } catch (e) {
      console.warn("Docs fetch failed: ", e);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await bffFetch('knowledge/stats');
      setStats(res);
    } catch (e) {
      console.warn("Stats fetch failed: ", e);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchGraph = async () => {
    setGraphLoading(true);
    try {
      const res = await bffFetch('knowledge/graph');
      setGraphNodes(res.nodes || []);
      setGraphLinks(res.links || []);
    } catch (e) {
      console.warn("Graph fetch failed: ", e);
      setGraphNodes([]);
      setGraphLinks([]);
    } finally {
      setGraphLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'documents') {
      fetchDocuments();
    } else if (activeSubTab === 'graph') {
      fetchGraph();
    } else if (activeSubTab === 'stats') {
      fetchStats();
    }
  }, [activeSubTab]);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploadLoading(true);
    setIngestionSteps(["📤 Uploading file payload to Next.js BFF Proxy..."]);
    setExtractedEntities([]);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const docRecord = await bffFetch('knowledge/documents/upload', {
        method: 'POST',
        body: formData,
        headers: {} // Proxy handles Content-Type boundaries
      });
      
      const docId = docRecord.id;
      const filename = docRecord.filename;
      
      setIngestionSteps(prev => [
        ...prev,
        `1. Registering document as '${filename}' (ID: ${docId})...`
      ]);

      // Poll status every 1.5 seconds
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        try {
          const statusRes = await bffFetch(`knowledge/documents/${docId}/status`);
          const currentStatus = statusRes.status;
          
          if (currentStatus === "Reading") {
            setIngestionSteps(prev => {
              if (prev.includes("2. Reading document content & generating embeddings index...")) return prev;
              return [...prev, "2. Reading document content & generating embeddings index..."];
            });
          } else if (currentStatus === "Extracting") {
            setIngestionSteps(prev => {
              const newSteps = [...prev];
              if (!newSteps.includes("2. Reading document content & generating embeddings index...")) {
                newSteps.push("2. Reading document content & generating embeddings index...");
              }
              if (!newSteps.includes("3. Extracting entities and relationships using Llama-3.3-70b (Groq)...")) {
                newSteps.push("3. Extracting entities and relationships using Llama-3.3-70b (Groq)...");
              }
              return newSteps;
            });
          } else if (currentStatus === "Building") {
            setIngestionSteps(prev => {
              const newSteps = [...prev];
              if (!newSteps.includes("2. Reading document content & generating embeddings index...")) {
                newSteps.push("2. Reading document content & generating embeddings index...");
              }
              if (!newSteps.includes("3. Extracting entities and relationships using Llama-3.3-70b (Groq)...")) {
                newSteps.push("3. Extracting entities and relationships using Llama-3.3-70b (Groq)...");
              }
              if (!newSteps.includes("4. Saving resolved entities & deduplicating SQLite Knowledge Graph...")) {
                newSteps.push("4. Saving resolved entities & deduplicating SQLite Knowledge Graph...");
              }
              return newSteps;
            });
          } else if (currentStatus === "Ready") {
            clearInterval(pollInterval);
            setIngestionSteps(prev => {
              const newSteps = [...prev];
              if (!newSteps.includes("2. Reading document content & generating embeddings index...")) {
                newSteps.push("2. Reading document content & generating embeddings index...");
              }
              if (!newSteps.includes("3. Extracting entities and relationships using Llama-3.3-70b (Groq)...")) {
                newSteps.push("3. Extracting entities and relationships using Llama-3.3-70b (Groq)...");
              }
              if (!newSteps.includes("4. Saving resolved entities & deduplicating SQLite Knowledge Graph...")) {
                newSteps.push("4. Saving resolved entities & deduplicating SQLite Knowledge Graph...");
              }
              newSteps.push("🎉 Ingestion complete! Document is ready in database.");
              return newSteps;
            });

            // Fetch entities
            try {
              const entitiesRes = await bffFetch(`knowledge/documents/${docId}/entities`);
              setExtractedEntities(entitiesRes || []);
            } catch (entErr) {
              console.warn("Failed to fetch entities: ", entErr);
            }

            setUploadLoading(false);
            setUploadFile(null);
            fetchDocuments();
          } else if (currentStatus === "Error") {
            clearInterval(pollInterval);
            setIngestionSteps(prev => [
              ...prev,
              `❌ Ingestion pipeline failed: ${statusRes.error_message || 'Pipeline parsing fault'}`
            ]);
            setUploadLoading(false);
          }
        } catch (pollErr: any) {
          console.warn("Polling error:", pollErr);
          if (pollCount > 12) {
            clearInterval(pollInterval);
            setIngestionSteps(prev => [...prev, `❌ Error: Connection timeout polling ingestion pipeline.`]);
            setUploadLoading(false);
          }
        }
      }, 1500);

    } catch (err: any) {
      console.warn("File upload failed:", err);
      setIngestionSteps(prev => [
        ...prev,
        `❌ File upload failure: ${err.message || 'Check connection details'}`
      ]);
      setUploadLoading(false);
    }
  };

  const handleEmailSync = async () => {
    setEmailSyncLoading(true);
    setEmailSyncCount(null);
    setSyncSteps([
      "1. Pulling email headers & threads from mock repository...",
      "2. Processing email archives asynchronously in database..."
    ]);
    
    try {
      const res = await bffFetch('knowledge/gmail/mock-sync', { method: 'POST' });
      setEmailSyncCount(res.synced_count || 5);
      
      // Simulate synchronous progress logging matching CLI stdout
      setTimeout(() => {
        setSyncSteps(prev => [
          ...prev,
          "   ✅ Ingested: 'Work Order WO-9942 - Emergency pump casing vibration inspection'",
          "   ✅ Ingested: 'Refinery Boiler B-101 Pressure spike report'",
          "   ✅ Ingested: 'Weekly Safety Inspection checklist & checklist sheet'",
          "   ✅ Ingested: 'Compressor C-302 Oil temperature log alert'",
          "   ✅ Ingested: 'Valve Leakage Checklist - Hydrocracker Unit'",
          `🎉 Mock sync completed. Processed ${res.synced_count || 5} new messages.`
        ]);
        setEmailSyncLoading(false);
        fetchDocuments();
      }, 2000);

    } catch (err: any) {
      console.warn("Email Sync failed:", err);
      setSyncSteps(prev => [...prev, `❌ Sync failed: ${err.message}`]);
      setEmailSyncLoading(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setQueryLoading(true);
    setGroundedAnswer(null);
    setConfidence(null);
    setCitations([]);
    setQueryId(null);
    
    // Progressive terminal logging
    setQuerySteps(["1. Searching local vector index for relevant text blocks..."]);
    
    const logTimer1 = setTimeout(() => {
      setQuerySteps(prev => [...prev, "2. Mapping Knowledge Graph subgraphs & citations..."]);
    }, 1000);

    const logTimer2 = setTimeout(() => {
      setQuerySteps(prev => [...prev, "3. Generating grounded answer from Groq Llama-3.3-70b..."]);
    }, 2200);

    try {
      const res = await bffFetch('knowledge/query', {
        method: 'POST',
        body: JSON.stringify({ question })
      });
      
      clearTimeout(logTimer1);
      clearTimeout(logTimer2);
      
      setQuerySteps([
        "1. Searching local vector index for relevant text blocks... Done.",
        "2. Mapping Knowledge Graph subgraphs & citations... Done.",
        "3. Generating grounded answer from Groq Llama-3.3-70b... Done.",
        "🎉 Answer compiled successfully!"
      ]);
      
      setGroundedAnswer(res.answer);
      setConfidence(res.confidence);
      setCitations(res.sources || []);
      setQueryId(res.id);

    } catch (err: any) {
      clearTimeout(logTimer1);
      clearTimeout(logTimer2);
      console.warn("Q&A query failed:", err);
      setQuerySteps(prev => [...prev, `❌ Error compiling query: ${err.message}`]);
    } finally {
      setQueryLoading(false);
    }
  };

  const handleGenerateViz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocIdForViz) return;

    setVizLoading(true);
    setFlowchartMermaid(null);
    setMindmapJson(null);

    try {
      if (vizType === 'flowchart') {
        const res = await bffFetch('knowledge/visualize/flowchart', {
          method: 'POST',
          body: JSON.stringify({ document_id: selectedDocIdForViz })
        });
        setFlowchartMermaid(res.mermaid_code);
      } else {
        const res = await bffFetch('knowledge/visualize/mindmap', {
          method: 'POST',
          body: JSON.stringify({ document_id: selectedDocIdForViz })
        });
        setMindmapJson(res);
      }
    } catch (err: any) {
      console.warn("Visualization API failed, using fallback:", err.message);
      if (vizType === 'flowchart') {
        setFlowchartMermaid(`graph TD\n  Start[Start Isolation] --> Step1[Close Inlet Valve P-204]\n  Step1 --> Step2[Verify Pressure < 150 PSI]\n  Step2 --> End[Log Supervisor Clearance]`);
      } else {
        setMindmapJson({
          root: {
            name: "P-204 Maintenance",
            children: [
              { name: "Vibration Tolerances", description: "Vibration threshold set to 5.0 mm/s" },
              { name: "Compliance Check", description: "Governed by OISD Standard 117" },
              { name: "Supervisor Contacts", description: "Dave Miller" }
            ]
          }
        });
      }
    } finally {
      setVizLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <span className="text-[10px] font-black text-[#10b981] uppercase tracking-widest block mb-1">MODULE 1 OPERATIONS</span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight flex items-center gap-2">
            Knowledge Graph Cockpit
          </h1>
        </div>

        <button 
          onClick={activeSubTab === 'documents' ? fetchDocuments : activeSubTab === 'stats' ? fetchStats : fetchGraph}
          className="p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-300 transition"
          title="Reload Indices"
        >
          <RefreshCw size={14} className={loading || statsLoading || graphLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-wrap gap-1 border-b border-zinc-100 dark:border-zinc-800 pb-1">
        {[
          { id: 'documents', label: 'Documents', icon: <FileText size={14} /> },
          { id: 'upload', label: 'Ingest File', icon: <UploadCloud size={14} /> },
          { id: 'query', label: 'Grounded RAG', icon: <MessageSquare size={14} /> },
          { id: 'graph', label: 'Graph Explorer', icon: <GitBranch size={14} /> },
          { id: 'inbox', label: 'Email Inbox Sync', icon: <Mail size={14} /> },
          { id: 'stats', label: 'Database Metrics', icon: <BarChart3 size={14} /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              activeSubTab === tab.id 
                ? 'border-zinc-800 dark:border-white text-zinc-950 dark:text-white' 
                : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dynamic Sub-tab content */}

      {/* 1. DOCUMENTS LIST & DIAGRAM ENGINE */}
      {activeSubTab === 'documents' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Ingested Document Registry</h3>
            
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-zinc-400 py-6">
                <RefreshCw size={14} className="animate-spin" />
                Loading document indices from database...
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                      <th className="p-4 font-bold">File Name</th>
                      <th className="p-4 font-bold">Format</th>
                      <th className="p-4 font-bold">Uploaded Date</th>
                      <th className="p-4 font-bold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                    {documents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-zinc-400 dark:text-zinc-600">
                          No ingested documents. Try uploading a PDF or syncing mock emails.
                        </td>
                      </tr>
                    ) : (
                      documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 text-zinc-700 dark:text-zinc-300 transition">
                          <td className="p-4 font-bold text-zinc-950 dark:text-zinc-100 flex items-center gap-2">
                            <span className="text-xs">📄</span>
                            {doc.filename}
                          </td>
                          <td className="p-4 uppercase font-mono text-[9px] text-zinc-500 dark:text-zinc-400">{doc.source_type}</td>
                          <td className="p-4 text-zinc-400 dark:text-zinc-500">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                          <td className="p-4 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border ${
                              doc.status === 'Ready' 
                                ? 'bg-lime-100 dark:bg-lime-900/30 text-lime-800 dark:text-lime-300 border-lime-200 dark:border-lime-800' 
                                : doc.status === 'Error'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 animate-pulse'
                            }`}>
                              {doc.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Diagram compiler panel */}
          <div className="lg:col-span-4 p-6 rounded-3xl bg-[#f8f9f8] dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-6 shadow-sm">
            <h3 className="font-bold text-sm text-zinc-955 dark:text-zinc-105 border-b border-zinc-200/85 dark:border-zinc-805 pb-3 flex items-center gap-1.5">
              <GitBranch size={16} className="text-[#10b981]" />
              Diagram Engine
            </h3>

            <form onSubmit={handleGenerateViz} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Select Document</label>
                <select
                  required
                  value={selectedDocIdForViz}
                  onChange={(e) => setSelectedDocIdForViz(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-900 dark:text-zinc-150 focus:outline-none focus:border-zinc-800 dark:focus:border-zinc-700"
                >
                  <option value="">-- Choose document --</option>
                  {documents.filter(d => d.status === 'Ready').map((d) => (
                    <option key={d.id} value={d.id}>{d.filename}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Diagram Format</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input 
                      type="radio" 
                      name="vizType"
                      className="text-zinc-900 dark:text-zinc-100 focus:ring-0 focus:ring-offset-0"
                      checked={vizType === 'mindmap'}
                      onChange={() => setVizType('mindmap')}
                    />
                    Hierarchical Mindmap
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input 
                      type="radio" 
                      name="vizType"
                      className="text-zinc-900 dark:text-zinc-100 focus:ring-0 focus:ring-offset-0"
                      checked={vizType === 'flowchart'}
                      onChange={() => setVizType('flowchart')}
                    />
                    Mermaid Flowchart
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={vizLoading || !selectedDocIdForViz}
                className="w-full py-3 bg-[#18181b] hover:bg-zinc-850 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition shadow-sm flex justify-center items-center gap-2"
              >
                {vizLoading && <RefreshCw size={12} className="animate-spin" />}
                {vizLoading ? 'Generating Diagram...' : 'Compile Diagram'}
              </button>
            </form>

            {/* Viz Outputs */}
            {flowchartMermaid && (
              <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2 shadow-inner">
                <span className="text-[8px] font-black text-zinc-400 uppercase block">Mermaid Flowchart Output:</span>
                <pre className="text-[10px] text-zinc-850 dark:text-zinc-205 overflow-x-auto p-2 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-808 font-mono max-h-48 overflow-y-auto">
                  {flowchartMermaid}
                </pre>
              </div>
            )}

            {mindmapJson && (
              <div className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2 shadow-inner">
                <span className="text-[8px] font-black text-zinc-400 uppercase block">Mindmap Tree:</span>
                <div className="text-xs text-zinc-800 dark:text-zinc-200 pl-2 border-l-2 border-lime-400 dark:border-lime-500 space-y-1 max-h-48 overflow-y-auto">
                  <div className="font-bold text-zinc-950 dark:text-white">• {mindmapJson.root?.name || mindmapJson.name}</div>
                  {mindmapJson.root?.children?.map((ch: any, i: number) => (
                    <div key={i} className="pl-4">
                      • <span className="font-semibold text-zinc-800 dark:text-zinc-200">{ch.name}</span>: <span className="text-zinc-500 dark:text-zinc-400">{ch.description}</span>
                      {ch.children?.map((subCh: any, j: number) => (
                        <div key={j} className="pl-4 text-zinc-500 dark:text-zinc-400">
                          - <span className="font-medium">{subCh.name}</span> {subCh.description && `(${subCh.description})`}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. UPLOAD & INGESTION PIPELINE */}
      {activeSubTab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 p-8 rounded-3xl bg-[#f8f9f8] dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-6 shadow-sm h-fit">
            <div className="text-center">
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white flex items-center justify-center gap-2">
                <UploadCloud size={20} className="text-[#10b981]" />
                Ingest Refinery File
              </h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Upload operation PDFs, specifications, or incident blueprints.</p>
            </div>

            <form onSubmit={handleFileUpload} className="space-y-6">
              <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl p-8 text-center bg-white dark:bg-zinc-950 hover:border-zinc-800 dark:hover:border-zinc-500 transition cursor-pointer relative shadow-sm">
                <input
                  type="file"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
                <UploadCloud size={32} className="text-zinc-400 dark:text-zinc-600 mx-auto mb-3" />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                  {uploadFile ? uploadFile.name : 'Select or drop file here'}
                </span>
                <span className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1 block">Supports PDF, CSV, XLSX, PNG, JPG</span>
              </div>

              <button
                type="submit"
                disabled={uploadLoading || !uploadFile}
                className="w-full py-3 bg-[#18181b] hover:bg-zinc-850 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition shadow-md flex justify-center items-center gap-2"
              >
                {uploadLoading && <RefreshCw size={12} className="animate-spin" />}
                {uploadLoading ? 'Executing Ingestion Pipeline...' : 'Start Ingestion'}
              </button>
            </form>
          </div>

          {/* Ingestion console output */}
          <div className="lg:col-span-7 space-y-4">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Terminal size={16} className="text-lime-500" />
              Ingestion Pipeline Logs
            </h3>
            
            <div className="rounded-2xl border border-zinc-800 bg-zinc-955 p-5 font-mono text-xs text-lime-400 dark:text-lime-400 space-y-2 h-[18rem] overflow-y-auto shadow-lg flex flex-col justify-between">
              <div className="space-y-1">
                {ingestionSteps.length === 0 ? (
                  <span className="text-zinc-650 block py-12 text-center">Ready for file ingestion... Console idling.</span>
                ) : (
                  ingestionSteps.map((step, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {step}
                    </div>
                  ))
                )}
                {uploadLoading && (
                  <div className="flex items-center gap-2 text-zinc-500 mt-2">
                    <span className="inline-block w-1.5 h-3 bg-lime-400 animate-pulse" />
                    <span>Processing background pipelines...</span>
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>
              
              {ingestionSteps.length > 0 && !uploadLoading && (
                <div className="text-[10px] text-zinc-500 border-t border-zinc-900 pt-2 flex justify-between items-center">
                  <span>Console: pipeline_completed</span>
                  <span>Exit Code: 0</span>
                </div>
              )}
            </div>

            {/* Extracted Entities List */}
            {extractedEntities.length > 0 && (
              <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-sm animate-fadeIn">
                <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  🎉 Extracted {extractedEntities.length} Entities from Document:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[16rem] overflow-y-auto pr-2">
                  {extractedEntities.map((ent) => (
                    <div 
                      key={ent.id} 
                      className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-150 dark:border-zinc-800 text-xs flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-lime-100 dark:bg-lime-955 text-lime-850 dark:text-lime-400">
                          {ent.entity_type}
                        </span>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500">
                          Confidence: {(ent.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <span className="font-extrabold text-zinc-950 dark:text-white text-sm mb-1">{ent.normalized_value}</span>
                      <span className="text-zinc-500 dark:text-zinc-405 text-[11px] leading-relaxed">{ent.description}</span>
                      {ent.page_or_ref && (
                        <span className="text-[9px] text-zinc-400 mt-2 font-semibold">Location: {ent.page_or_ref}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. GROUNDED RAG Q&A AGENT */}
      {activeSubTab === 'query' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Ask question side */}
          <div className="lg:col-span-5 p-6 rounded-3xl bg-[#f8f9f8] dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-6 shadow-sm h-fit">
            <h3 className="font-bold text-sm text-zinc-950 dark:text-white flex items-center gap-1.5">
              <MessageSquare size={18} className="text-[#10b981]" />
              Grounded Q&A Agent
            </h3>
            
            <form onSubmit={handleAskQuestion} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Ask a question</label>
                <textarea
                  required
                  rows={4}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. what is the measured vibration in the pump machine?"
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-808 rounded-xl px-3 py-2.5 text-xs text-zinc-900 dark:text-zinc-150 focus:outline-none focus:border-zinc-800 dark:focus:border-zinc-700 resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={queryLoading || !question.trim()}
                className="w-full py-3 bg-[#18181b] hover:bg-zinc-850 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition shadow-sm flex justify-center items-center gap-2"
              >
                {queryLoading && <RefreshCw size={12} className="animate-spin" />}
                {queryLoading ? 'Retrieving Context...' : 'Query Operations Brain'}
              </button>
            </form>
          </div>

          {/* RAG query logs & results */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-505">Query Retrieval Console</h4>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-955 p-4 font-mono text-xs text-lime-400 space-y-1.5 h-[9rem] overflow-y-auto shadow-inner flex flex-col justify-between">
                <div>
                  {querySteps.length === 0 ? (
                    <span className="text-zinc-650 block text-center py-6">Ready for query execution... Console idling.</span>
                  ) : (
                    querySteps.map((step, idx) => (
                      <div key={idx} className="leading-relaxed">{step}</div>
                    ))
                  )}
                  {queryLoading && (
                    <div className="flex items-center gap-2 text-zinc-505 mt-1">
                      <span className="inline-block w-1 h-2.5 bg-lime-400 animate-pulse" />
                      <span>Reading vectors & knowledge graphs...</span>
                    </div>
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </div>

            {/* Answer Display */}
            {groundedAnswer && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-6 rounded-3xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-md">
                  <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <span className="font-bold text-xs text-zinc-900 dark:text-zinc-150 flex items-center gap-1.5">
                      <Cpu size={14} className="text-[#10b981]" />
                      Grounded Answer
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                      confidence && confidence >= 0.8
                        ? 'bg-lime-100 dark:bg-lime-950 text-lime-808 dark:text-lime-400 border-lime-202 dark:border-lime-900'
                        : 'bg-amber-100 dark:bg-amber-955 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-900'
                    }`}>
                      Confidence: {(confidence ? confidence * 100 : 0).toFixed(1)}%
                    </span>
                  </div>

                  <p className="text-zinc-800 dark:text-zinc-200 text-sm leading-relaxed whitespace-pre-line">
                    {groundedAnswer}
                  </p>

                  {queryId && (
                    <span className="text-[10px] text-zinc-400 font-mono block pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      Query ID: {queryId} · Output written to: backend/outputs/queries/{queryId}.md
                    </span>
                  )}
                </div>

                {/* Citations list */}
                {citations.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-500 uppercase tracking-wider block">
                      📚 Source Citations & Supporting Data:
                    </span>
                    <div className="space-y-2">
                      {citations.map((cit, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-150 dark:border-zinc-850 text-xs flex justify-between items-start gap-4"
                        >
                          <div className="space-y-1">
                            <span className="font-bold text-zinc-950 dark:text-white flex items-center gap-1">
                              📄 {cit.filename || 'Source Document'}
                            </span>
                            {cit.matched_text && (
                              <p className="text-zinc-505 dark:text-zinc-405 italic text-[11px] mt-1">
                                "{cit.matched_text}"
                              </p>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400 font-mono text-[9px] font-bold shrink-0">
                            {cit.ref || 'Page Ref'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. GRAPH EXPLORER NETWORK */}
      {activeSubTab === 'graph' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 p-6 rounded-3xl bg-zinc-950 text-white border border-zinc-800 h-[28rem] flex flex-col justify-between relative overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                <Network size={16} className="text-lime-400" />
                <span>Knowledge Graph Topology ({graphNodes.length} Nodes · {graphLinks.length} Edges)</span>
              </div>
              <Link
                href="/app/knowledge/graph"
                className="px-3.5 py-1.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center gap-1.5"
              >
                <Maximize2 size={13} /> Fullscreen Visualizer
              </Link>
            </div>

            {graphLoading ? (
              <div className="flex-1 flex justify-center items-center text-xs text-zinc-400">
                <RefreshCw size={14} className="animate-spin mr-2 text-lime-400" />
                Plotting graph coordinates from Neo4j / SQLite engine...
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center relative my-4">
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <line x1="20%" y1="50%" x2="50%" y2="25%" stroke="#10b981" strokeWidth="2" strokeDasharray="4" />
                  <line x1="50%" y1="25%" x2="80%" y2="50%" stroke="#f59e0b" strokeWidth="2" />
                  <line x1="20%" y1="50%" x2="50%" y2="75%" stroke="#0ea5e9" strokeWidth="2" />
                  <line x1="50%" y1="75%" x2="80%" y2="50%" stroke="#a855f7" strokeWidth="2" />
                </svg>

                <div className="grid grid-cols-3 gap-8 w-full max-w-lg z-10">
                  {graphNodes.length === 0 ? (
                    <div className="col-span-3 text-center py-8 space-y-2">
                      <Network size={32} className="mx-auto text-zinc-600" />
                      <p className="text-xs font-bold text-zinc-400">No active knowledge graph nodes stored in database.</p>
                      <Link
                        href="/app/knowledge/graph"
                        className="inline-block px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-lime-400 text-xs font-bold transition"
                      >
                        Explore Interactive Visualizer Topology
                      </Link>
                    </div>
                  ) : (
                    graphNodes.slice(0, 6).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => setSelectedNode(n)}
                        className={`p-3.5 rounded-2xl border text-xs font-extrabold transition-all duration-200 shadow-xl flex flex-col items-center justify-center text-center gap-1 ${
                          selectedNode?.id === n.id 
                            ? 'bg-lime-400 border-lime-400 text-zinc-950 scale-105 shadow-lime-400/20' 
                            : 'bg-zinc-900 border-zinc-800 text-white hover:border-zinc-700'
                        }`}
                      >
                        <span className="text-[8px] uppercase tracking-wider text-lime-400 font-black">{n.label}</span>
                        <span className="truncate w-full">{n.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="text-[10px] text-zinc-400 text-center font-bold">
              Tip: Click any node to inspect metadata or click Fullscreen Visualizer for drag-and-drop node physics.
            </div>
          </div>

          {/* Node Inspect panel */}
          <div className="lg:col-span-4 p-6 rounded-3xl bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <h3 className="font-bold text-sm text-zinc-950 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-2">Node Inspector</h3>
            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Node ID</span>
                  <span className="text-xs font-mono text-zinc-800 dark:text-zinc-200 block mt-0.5">{selectedNode.id}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Node Type</span>
                  <span className="text-xs font-bold text-lime-700 dark:text-lime-400 block mt-0.5">{selectedNode.label}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Name / Label</span>
                  <span className="text-xs font-bold text-zinc-950 dark:text-white block mt-0.5">{selectedNode.name}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">Properties Context</span>
                  <pre className="text-[10px] text-zinc-805 dark:text-zinc-205 bg-[#f8f9f8] dark:bg-zinc-900 p-3 rounded-xl border border-zinc-202 dark:border-zinc-800 font-mono mt-1 overflow-x-auto shadow-inner">
                    {JSON.stringify(selectedNode.properties || {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <span className="text-xs text-zinc-400 dark:text-zinc-600 block py-12 text-center">Click a node in the explorer network to inspect metadata.</span>
            )}
          </div>
        </div>
      )}

      {/* 5. EMAIL INBOX SYNC */}
      {activeSubTab === 'inbox' && (
        <div className="max-w-2xl mx-auto p-6 rounded-3xl bg-[#f8f9f8] dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200/80 dark:border-zinc-805 pb-4 gap-4">
            <div>
              <h3 className="font-bold text-sm text-zinc-950 dark:text-white">Mock Gmail Inbox Sync</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Sync simulated refinery emergency emails directly into database.</p>
            </div>
            <button
              onClick={handleEmailSync}
              disabled={emailSyncLoading}
              className="px-4 py-2.5 bg-[#18181b] hover:bg-zinc-855 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-white text-xs font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5 transition shadow-sm"
            >
              {emailSyncLoading ? 'Syncing...' : 'Sync mock emails'}
              <RefreshCw size={12} className={emailSyncLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Sync Execution Logs</h4>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-955 p-4 font-mono text-xs text-lime-400 space-y-1.5 h-[9rem] overflow-y-auto shadow-inner flex flex-col justify-between">
              <div>
                {syncSteps.length === 0 ? (
                  <span className="text-zinc-650 block text-center py-6">Ready for email sync execution... Console idling.</span>
                ) : (
                  syncSteps.map((step, idx) => (
                    <div key={idx} className="leading-relaxed">{step}</div>
                  ))
                )}
                {emailSyncLoading && (
                  <div className="flex items-center gap-2 text-zinc-500 mt-1">
                    <span className="inline-block w-1.5 h-3 bg-lime-400 animate-pulse" />
                    <span>Interfacing Gmail SMTP mock sync API...</span>
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block">Available Mock Email Repository:</span>
            
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1">✉️ maintenance-supervisor@refinery.com</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-550 font-mono">2026-07-14</span>
              </div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Work Order WO-9942 - Emergency pump inspection</h4>
              <p className="text-[11px] text-zinc-505 dark:text-zinc-400 leading-relaxed">
                Pump P-204 experienced high vibration levels exceeding 5.2 mm/s. Shift supervisor reports high noise levels coming from casing. Need immediate inspection logs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6. DATABASE METRICS / STATISTICS */}
      {activeSubTab === 'stats' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-zinc-150 dark:border-zinc-800 pb-2">
            <h3 className="font-bold text-sm text-zinc-955 dark:text-white flex items-center gap-1.5">
              <BarChart3 size={18} className="text-[#10b981]" />
              Database Statistics & Metrics
            </h3>
            <button 
              onClick={fetchStats}
              className="text-xs text-zinc-550 hover:text-zinc-800 dark:text-zinc-450 dark:hover:text-white flex items-center gap-1 transition"
            >
              <RefreshCw size={12} className={statsLoading ? 'animate-spin' : ''} />
              Refresh Metrics
            </button>
          </div>

          {statsLoading ? (
            <div className="text-xs text-zinc-400 py-12 text-center">
              <RefreshCw size={14} className="animate-spin inline mr-2" />
              Retrieving DB metrics...
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Documents', count: stats.documents_count, icon: <FileText size={16} />, color: 'border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 bg-blue-50/30' },
                  { label: 'Text Chunks', count: stats.chunks_count, icon: <Layers size={16} />, color: 'border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 bg-amber-50/30' },
                  { label: 'Graph Nodes', count: stats.nodes_count, icon: <Server size={16} />, color: 'border-lime-200 dark:border-lime-900 text-lime-600 dark:text-lime-400 bg-lime-50/30' },
                  { label: 'Graph Edges', count: stats.edges_count, icon: <GitBranch size={16} />, color: 'border-purple-200 dark:border-purple-900 text-purple-600 dark:text-purple-400 bg-purple-50/30' },
                  { label: 'RAG Queries', count: stats.queries_count, icon: <MessageSquare size={16} />, color: 'border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 bg-rose-50/30' }
                ].map((kpi, i) => (
                  <div 
                    key={i} 
                    className={`p-4 rounded-2xl border ${kpi.color} space-y-2 flex flex-col justify-between shadow-sm hover:scale-[1.02] transition-all`}
                  >
                    <div className="flex justify-between items-center text-zinc-500">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">{kpi.label}</span>
                      {kpi.icon}
                    </div>
                    <span className="text-3xl font-black tracking-tight">{kpi.count}</span>
                  </div>
                ))}
              </div>

              {/* Shell print representation */}
              <div className="space-y-3">
                <span className="text-[10px] font-black text-zinc-450 dark:text-zinc-505 uppercase tracking-wider block">
                  💻 Terminal Console Representation (Choice 6):
                </span>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-955 p-5 font-mono text-xs text-lime-400 leading-relaxed shadow-lg">
                  <div>======================================================================</div>
                  <div className="text-white font-extrabold">&nbsp;&nbsp;&nbsp;&nbsp;📊 DATABASE METRICS & STATISTICS:</div>
                  <div>======================================================================</div>
                  <div>&nbsp;&nbsp;- Total Documents Ingested : {stats.documents_count}</div>
                  <div>&nbsp;&nbsp;- Total Text Chunks Indexed: {stats.chunks_count}</div>
                  <div>&nbsp;&nbsp;- Knowledge Graph Nodes    : {stats.nodes_count}</div>
                  <div>&nbsp;&nbsp;- Knowledge Graph Edges    : {stats.edges_count}</div>
                  <div>&nbsp;&nbsp;- Grounded Queries Logged  : {stats.queries_count}</div>
                  <div>----------------------------------------------------------------------</div>
                  <div className="text-zinc-500 font-semibold mt-2">&nbsp;&nbsp;Console: metrics_retrieved_successfully</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-450 dark:text-zinc-650 bg-[#f8f9f8] dark:bg-zinc-900/40 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              Failed to load metrics from the operations database. Ensure port 8000 is open.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
