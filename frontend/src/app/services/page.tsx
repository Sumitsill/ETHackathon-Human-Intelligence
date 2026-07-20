"use client";

import React from 'react';
import Link from 'next/link';
import { Network, Database, Bot, Wrench, ShieldAlert, ArrowRight, ChevronLeft } from 'lucide-react';

const MODULES = [
  {
    slug: 'ingestion',
    title: 'Knowledge Graph Cockpit',
    subtitle: 'Module 1: Ingestion & KG',
    problem: 'Plant operations are buried in scanned documents, Excel sheets, and email updates. Manually sorting them is error-prone and takes hours.',
    steps: [
      { num: '01', title: 'Ingest local data', desc: 'Drag-and-drop PDFs, images, or spreadsheet files.' },
      { num: '02', title: 'Automated extraction', desc: 'Llama-3.3-70b/Gemini OCR parses headers, specs, and entities.' },
      { num: '03', title: 'Deduplicate graph', desc: 'Nodes and edges are dynamically updated and merged in SQLite.' }
    ],
    personas: ['Knowledge Engineer', 'Plant Manager']
  },
  {
    slug: 'copilot',
    title: 'Grounded Expert Copilot',
    subtitle: 'Module 2: RAG Q&A',
    problem: 'Field technicians need instant, reliable specification details on the plant floor. Hallucinated answers can compromise safety.',
    steps: [
      { num: '01', title: 'Ask a question', desc: 'Type or voice-input questions about machinery specs.' },
      { num: '02', title: 'Grounded query search', desc: 'Extract vector similarity and KG subgraphs locally.' },
      { num: '03', title: 'Validated answer', desc: 'Check citations deterministic validation before showing output.' }
    ],
    personas: ['Field Technician', 'Maintenance Engineer']
  },
  {
    slug: 'mira',
    title: 'MIRA — Maintenance & RCA',
    subtitle: 'Module 3: Maintenance Intelligence',
    problem: 'Reliability engineers face complex equipment failures with limited time to analyze historical records and schedule labor constraints.',
    steps: [
      { num: '01', title: 'Detect recommendations', desc: 'Identify predictive maintenance alerts and failure rates.' },
      { num: '02', title: 'Guided RCA workbench', desc: 'Run 5-Why root cause loops with AI hypotheses.' },
      { num: '03', title: 'Optimize scheduling', desc: 'Solve labor hours and budget limits to dispatch work orders.' }
    ],
    personas: ['Maintenance Engineer', 'Field Technician']
  },
  {
    slug: 'qrci',
    title: 'QRCI — Quality & Compliance',
    subtitle: 'Module 4: Quality & Regulation',
    problem: 'Refineries are subject to strict regulations (PESO, OISD, Factories Act). Audit prep and gap tracking require weeks of manual paperwork.',
    steps: [
      { num: '01', title: 'Run compliance scan', desc: 'Scan requirement clauses against actual operational states.' },
      { num: '02', title: 'Track deviations', desc: 'Identify gaps and flag telemetry deviations by severity.' },
      { num: '03', title: 'Evidence packaging', desc: 'Compile work logs and specs into signed, audit-ready packages.' }
    ],
    personas: ['Quality / Compliance Officer', 'Plant Manager']
  }
];

export default function ServicesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0b0f19] text-slate-100">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#10b981]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="h-16 border-b border-[#27374d] flex items-center justify-between px-6 bg-[#0b0f19]/90 backdrop-blur sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm">
          <ChevronLeft size={16} /> Back to Home
        </Link>
        <div className="flex items-center gap-2">
          <Network className="text-[#10b981]" size={20} />
          <span className="font-bold text-md tracking-tight">Unified Asset Brain</span>
        </div>
        <div className="w-20" />
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16 flex-1">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-3xl md:text-5xl font-extrabold text-white">Platform Capabilities</h1>
          <p className="text-slate-400 mt-4 leading-relaxed">
            Detailed workflow break-downs of the four operational backend services.
          </p>
        </div>

        <div className="space-y-12">
          {MODULES.map((m) => (
            <div key={m.slug} className="p-8 rounded-2xl bg-[#151f32]/50 border border-[#27374d] hover:border-[#10b981]/30 transition-all duration-300">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                <div>
                  <span className="text-xs font-semibold text-[#10b981] uppercase tracking-wider block mb-1">
                    {m.subtitle}
                  </span>
                  <h2 className="text-2xl font-bold text-white">{m.title}</h2>
                  <p className="text-sm text-slate-400 mt-4 max-w-3xl leading-relaxed">
                    <span className="font-semibold text-slate-300 block mb-1">Core Challenge:</span>
                    {m.problem}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {m.personas.map((p) => (
                    <span key={p} className="px-3 py-1 rounded-full text-xs font-medium bg-[#0b0f19] border border-[#27374d] text-slate-300">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* Steps */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {m.steps.map((st) => (
                  <div key={st.num} className="p-4 rounded-xl bg-[#0b0f19]/40 border border-[#27374d]/50">
                    <span className="text-xl font-black text-[#10b981]/40 block mb-2">{st.num}</span>
                    <h4 className="font-semibold text-white text-sm">{st.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{st.desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Link 
                  href={`/services/${m.slug}`} 
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#10b981] hover:bg-[#0e9f6e] transition shadow-md hover:shadow-[#10b981]/15"
                >
                  View System Screenshots & Details <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
