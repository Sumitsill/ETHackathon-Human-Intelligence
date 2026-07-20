"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { bffFetch } from '@/lib/bff-fetch';
import { 
  Activity, 
  ShieldAlert, 
  FileText, 
  Cpu, 
  Zap, 
  ArrowUpRight, 
  Server, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  MessageSquare,
  RefreshCw,
  Search,
  Database,
  Wrench,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface AlertItem {
  id: string;
  time: string;
  sourceModule: string;
  targetModule: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export default function CommandCenterDashboard() {
  const { currentActiveRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState({
    activeAnomalies: 2,
    complianceGaps: 1,
    knowledgeDecay: 14,
    ingestedDocs: 84,
  });

  const [recentFiles, setRecentFiles] = useState([
    { name: 'sample_oem_manual.pdf', type: 'PDF', size: '2.4 MB', status: 'Indexed' },
    { name: 'sample_telemetry_vibration.csv', type: 'CSV', size: '1.1 MB', status: 'Anomaly Scanned' },
    { name: 'sample_inspection_scan.png', type: 'PNG', size: '3.8 MB', status: 'OCR Processed' },
    { name: 'sample_gmail_export.mbox', type: 'MBOX', size: '612 B', status: 'Parsed' },
  ]);

  const [syncAlerts, setSyncAlerts] = useState<AlertItem[]>([
    {
      id: 'alt-1',
      time: '10:42 AM',
      sourceModule: 'Module 3 (MIRA)',
      targetModule: 'Module 4 (QRCI)',
      title: 'P-204 Vibration Spike Detected',
      description: 'High amplitude vibration threshold exceeded (>12mm/s). Auto-triggering OISD-117 Safety & Compliance verification scan.',
      severity: 'high'
    },
    {
      id: 'alt-2',
      time: '09:15 AM',
      sourceModule: 'Module 1 (Ingestion)',
      targetModule: 'Module 2 (Copilot)',
      title: 'New SOP Amendment Ingested',
      description: 'OISD-117 Revision 4 parsed. Copilot knowledge base updated with revised max allowable working pressure (12 bar).',
      severity: 'medium'
    },
    {
      id: 'alt-3',
      time: '08:30 AM',
      sourceModule: 'Module 4 (QRCI)',
      targetModule: 'Module 3 (MIRA)',
      title: 'Non-Compliance Flagged on C-301 Compressor',
      description: 'Cooling jacket inspection interval lapsed (>6 months). Recommended work order generated for Reliability Lead.',
      severity: 'high'
    },
  ]);

  return (
    <div className="space-y-4 pb-12">
      
      {/* Top KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Active Anomalies</span>
            <div className="text-2xl md:text-3xl font-black text-amber-600 flex items-center gap-1.5">
              {metrics.activeAnomalies}
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">MIRA</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Compliance Gaps</span>
            <div className="text-2xl md:text-3xl font-black text-red-600 flex items-center gap-1.5">
              {metrics.complianceGaps}
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">QRCI</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <ShieldAlert size={20} />
          </div>
        </div>

        <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Knowledge Decay</span>
            <div className="text-2xl md:text-3xl font-black text-sky-600 flex items-center gap-1.5">
              {metrics.knowledgeDecay}
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">SOPs</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
            <FileText size={20} />
          </div>
        </div>

        <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block">Knowledge Base</span>
            <div className="text-2xl md:text-3xl font-black text-emerald-600 flex items-center gap-1.5">
              {metrics.ingestedDocs}
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Files</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Database size={20} />
          </div>
        </div>
      </div>

      {/* Main Grid: 60% Arena Feed + 40% Right Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Arena (60% width on desktop) */}
        <div className="lg:col-span-7 bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-lime-500 animate-ping" />
              <h2 className="text-sm font-extrabold text-zinc-950 uppercase tracking-wider">
                Brain Sync Event Feed
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-zinc-500 flex items-center gap-1">
              <Clock size={12} /> Live Cross-Module Telemetry
            </span>
          </div>

          <div className="space-y-3">
            {syncAlerts.map((alert) => (
              <div 
                key={alert.id}
                className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 hover:bg-white hover:shadow-md transition space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider">
                    <span className="px-2 py-0.5 rounded bg-zinc-950 text-white">{alert.sourceModule}</span>
                    <span className="text-zinc-400">→</span>
                    <span className="px-2 py-0.5 rounded bg-lime-100 text-lime-900 border border-lime-200">{alert.targetModule}</span>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400">{alert.time}</span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xs font-extrabold text-zinc-900 flex items-center gap-1.5 group-hover:text-lime-700 transition">
                    {alert.severity === 'high' ? (
                      <AlertTriangle size={14} className="text-amber-500" />
                    ) : (
                      <Activity size={14} className="text-sky-500" />
                    )}
                    {alert.title}
                  </h3>
                  <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
                    {alert.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <Link 
              href="/app/copilot"
              className="text-xs font-extrabold text-zinc-900 hover:text-lime-700 transition flex items-center gap-1"
            >
              Analyze in Grounded Copilot <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {/* Right Drawer (40% width on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Microservices System Health Box */}
          <div className="bg-zinc-950 text-white rounded-2xl p-5 shadow-xl space-y-4 border border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Server size={16} className="text-lime-400 animate-pulse" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Orchestrator Backend Status
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">
                4/4 Ports Online
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { name: 'Module 1 (Ingestion)', port: '8000', label: 'PDF, OCR & Graph' },
                { name: 'Module 2 (Copilot)', port: '8001', label: 'RAG & Citations' },
                { name: 'Module 3 (MIRA)', port: '8002', label: '5-Why & Telemetry' },
                { name: 'Module 4 (QRCI)', port: '8003', label: 'OISD & PESO Matrix' },
              ].map((m) => (
                <div key={m.port} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-lime-400">Port {m.port}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <div className="text-xs font-bold text-zinc-100">{m.name}</div>
                  <div className="text-[9px] text-zinc-500 font-medium">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Ingestion Activity Panel */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h3 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={15} className="text-zinc-600" />
                Recent File Ingestions
              </h3>
              <Link href="/app/knowledge/ingest" className="text-[11px] font-bold text-lime-700 hover:underline">
                Upload New
              </Link>
            </div>

            <div className="space-y-2">
              {recentFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/60 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-zinc-200 text-zinc-800">{file.type}</span>
                    <span className="font-semibold text-zinc-900 truncate max-w-[140px]">{file.name}</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {file.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Floating Action Button (FAB) for Quick Copilot Launch */}
      <Link
        href="/app/copilot"
        className="fixed bottom-6 right-6 z-40 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs px-5 py-3.5 rounded-2xl shadow-2xl border border-zinc-700 flex items-center gap-2.5 transition-all hover:scale-105 group"
      >
        <MessageSquare size={18} className="text-lime-400 group-hover:scale-110 transition-transform" />
        <span>Ask Operational Copilot</span>
      </Link>
    </div>
  );
}
