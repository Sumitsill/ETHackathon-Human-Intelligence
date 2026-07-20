"use client";

import React, { use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { 
  Database, 
  Bot, 
  Wrench, 
  ShieldAlert, 
  ChevronLeft, 
  ArrowRight,
  Network
} from 'lucide-react';

const MODULES_DETAIL: Record<string, {
  title: string;
  subtitle: string;
  icon: any;
  problem: string;
  solution: string;
  details: string[];
  specs: Record<string, string>;
  ctaText: string;
  link: string;
}> = {
  ingestion: {
    title: 'Knowledge Graph Cockpit',
    subtitle: 'Universal Ingestion & KG Pipeline (Module 1)',
    icon: Database,
    problem: 'Plant operating procedures, equipment specifications, inspection logs, and emails are spread across multiple legacy systems. Finding relevant details in a crunch requires searching 7-12 different sources.',
    solution: 'Our universal ingestion pipeline processes PDFs, CSV/XLSX, images, and email threads, indexes them locally with semantic embeddings, and builds a unified, deduplicated SQLite Knowledge Graph.',
    details: [
      'Visual drag-and-drop file ingestion support.',
      'Auto-OCR scanned documents using Gemini vision fallback.',
      'Deduplicate node attributes using AI relationship resolution.',
      'Track citations back to exact pages, sheets, and headers.'
    ],
    specs: {
      'Port Mapping': '8000 (Default)',
      'Primary LLM': 'Llama-3.3-70b-versatile (Groq)',
      'Fallback Model': 'Gemini 2.5 Flash / Regex extraction',
      'Database Storage': 'SQLite (nodes, edges, chunks, cache)'
    },
    ctaText: 'Access Cockpit',
    link: '/app/knowledge'
  },
  copilot: {
    title: 'Grounded Expert Copilot',
    subtitle: 'RAG Q&A Engine (Module 2)',
    icon: Bot,
    problem: 'Operators on the floor need torque limits, pressure thresholds, and maintenance rules immediately. AI chat tools hallucinate details, posing critical safety risks.',
    solution: 'Our RAG engine combines local vector embedding searches with graph traversal maps to ground AI responses. Citation validation gates verify source mappings deterministically before outputting text.',
    details: [
      'Conversational query box supporting voice-to-text inputs.',
      'Strict verification gates preventing silent hallucinations.',
      'Embedded document preview sheets showing exact text matches.',
      'Confidence levels (High, Med, Low) dynamically displayed.'
    ],
    specs: {
      'Port Mapping': '8001 (Default)',
      'Text Embedding': 'all-MiniLM-L6-v2 / text-embedding-004',
      'Citation Gate': 'Deterministic regex matching',
      'Answer Models': 'Llama-3.3-70b (Complex) & Llama-3.1-8b (Simple)'
    },
    ctaText: 'Ask Copilot',
    link: '/app/copilot'
  },
  mira: {
    title: 'MIRA — Maintenance & RCA',
    subtitle: 'Maintenance Intelligence Subsystem (Module 3)',
    icon: Wrench,
    problem: 'Equipments encounter unplanned failures. Organizing root-cause analysis (RCA) meetings is slow, and scheduling work orders under labor/safety constraints is mathematically complex.',
    solution: 'MIRA drives stateful 5-Why analysis subgraphs, surfaces predictive recommendations, and uses a constraint solver engine to optimize maintenance schedules.',
    details: [
      'Guided 5-Why workbench with AI hypothesis seeding.',
      'Human-in-the-loop review overrides for RCA approvals.',
      'Predictive maintenance alerts with linked failure logs.',
      'Gantt-style optimized schedule lists.'
    ],
    specs: {
      'Port Mapping': '8000 / 8002',
      'Orchestrator': 'Stateful LangGraph agent',
      'Vector database': 'Qdrant / local memory',
      'Constraint solver': 'PuLP / local heuristic solver'
    },
    ctaText: 'Open MIRA Dashboard',
    link: '/app/maintenance'
  },
  qrci: {
    title: 'QRCI — Compliance Intelligence',
    subtitle: 'Quality & Regulatory Compliance (Module 4)',
    icon: ShieldAlert,
    problem: 'Compliance officers spend weeks compiling audit packages and tracking safety deviations from daily inspections.',
    solution: 'QRCI scans operational states against regulatory requirement clauses, flags threshold deviations, compiles PDF evidence packages, and sandboxes regulatory edits.',
    details: [
      'Compliance posture score trackers.',
      'Gap analysis logs mapping clauses against telemetry.',
      'One-click evidence package builders (inspections, logs).',
      'Regulatory sandbox comparing old vs new standard diffs.'
    ],
    specs: {
      'Port Mapping': '8000 / 8003',
      'Compliance engine': 'Qualitative & quantitative constraint checkers',
      'Evidence output': 'PDF audit compiles',
      'Standards supported': 'Factories Act, PESO, OISD, IBR'
    },
    ctaText: 'Access QRCI Desk',
    link: '/app/compliance'
  }
};

export default function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const data = MODULES_DETAIL[resolvedParams.slug];

  if (!data) {
    notFound();
  }

  const IconComponent = data.icon;

  return (
    <div className="flex flex-col min-h-screen bg-[#0b0f19] text-slate-100">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-[#10b981]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="h-16 border-b border-[#27374d] flex items-center justify-between px-6 bg-[#0b0f19]/90 backdrop-blur sticky top-0 z-10">
        <Link href="/services" className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm">
          <ChevronLeft size={16} /> All Capabilities
        </Link>
        <div className="flex items-center gap-2">
          <Network className="text-[#10b981]" size={20} />
          <span className="font-bold text-md tracking-tight">Unified Asset Brain</span>
        </div>
        <div className="w-20" />
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-16 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="p-4 bg-[#10b981]/15 border border-[#10b981]/30 rounded-2xl w-fit mb-6">
                <IconComponent className="text-[#10b981]" size={32} />
              </div>
              <span className="text-xs font-bold text-[#10b981] uppercase tracking-wider block mb-1">
                {data.subtitle}
              </span>
              <h1 className="text-3xl md:text-5xl font-black text-white">{data.title}</h1>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-[#27374d] pb-2">Operational Pain</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{data.problem}</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-[#27374d] pb-2">Solution</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{data.solution}</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white border-b border-[#27374d] pb-2">Key Workflows Supported</h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.details.map((d, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] mt-2 flex-shrink-0" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Specs Panel */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[#151f32]/60 border border-[#27374d] backdrop-blur space-y-6">
              <h3 className="text-lg font-bold text-white border-b border-[#27374d] pb-2">Technical Specs</h3>
              
              <div className="space-y-4">
                {Object.entries(data.specs).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{key}</span>
                    <span className="text-sm font-semibold text-slate-200 mt-1 block">{value}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link 
                  href={data.link}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#10b981] hover:bg-[#0e9f6e] text-white py-3 px-4 rounded-xl font-bold text-sm transition shadow-lg shadow-[#10b981]/15"
                >
                  {data.ctaText} <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-dashed border-[#27374d] text-center">
              <span className="text-xs text-slate-400">Offline PWA mode supports caching for recently accessed sheets and chat answers.</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
