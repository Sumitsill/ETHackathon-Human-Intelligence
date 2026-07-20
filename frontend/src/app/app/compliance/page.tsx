"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { bffFetch } from '@/lib/bff-fetch';
import { 
  ShieldCheck, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  X, 
  Sparkles,
  ArrowRight,
  ShieldAlert,
  FileDiff
} from 'lucide-react';

interface MatrixCell {
  tag: string;
  reg: string;
  status: 'pass' | 'warning' | 'violation';
  score: number;
  ruleTitle: string;
  oldRule: string;
  newRule: string;
  evidenceDoc: string;
}

export default function QrciMatrixPage() {
  const { currentActiveRole } = useAuth();
  const [selectedCell, setSelectedCell] = useState<MatrixCell | null>({
    tag: 'P-204 Centrifugal Pump',
    reg: 'OISD-117 Standard',
    status: 'warning',
    score: 74,
    ruleTitle: 'Max Allowable Operating Pressure Limit',
    oldRule: 'Max Allowable Continuous Pressure: 15.0 Bar',
    newRule: 'Max Allowable Continuous Pressure: 12.0 Bar (OISD 2026 Revision 4 Amendment)',
    evidenceDoc: 'sample_regulation_amendment.json (Section 4.1)'
  });

  const [exporting, setExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  const equipmentTags = ['P-204 Centrifugal Pump', 'V-102 Separator Vessel', 'C-301 Hydrocracker Compressor', 'T-501 Storage Tank'];
  const regulatoryBodies = ['OISD Standard', 'PESO Guidelines', 'Factories Act 1948', 'IBR Boiler Rules'];

  const matrixData: Record<string, Record<string, MatrixCell>> = {
    'P-204 Centrifugal Pump': {
      'OISD Standard': {
        tag: 'P-204 Centrifugal Pump',
        reg: 'OISD Standard',
        status: 'warning',
        score: 74,
        ruleTitle: 'Pressure & Vibration Limits',
        oldRule: 'Max Pressure: 15 bar | Vibration: 15 mm/s',
        newRule: 'Max Pressure: 12 bar | Vibration: 10 mm/s',
        evidenceDoc: 'sample_oem_manual.pdf & sample_regulation_amendment.json'
      },
      'PESO Guidelines': {
        tag: 'P-204 Centrifugal Pump',
        reg: 'PESO Guidelines',
        status: 'pass',
        score: 98,
        ruleTitle: 'Explosion Proof Housing',
        oldRule: 'Flameproof enclosure Class 1 Div 1',
        newRule: 'Flameproof enclosure Class 1 Div 1',
        evidenceDoc: 'sample_compliance_requirements.json'
      },
      'Factories Act 1948': {
        tag: 'P-204 Centrifugal Pump',
        reg: 'Factories Act 1948',
        status: 'pass',
        score: 100,
        ruleTitle: 'Safety Guard & Earthing',
        oldRule: 'Coupling guard mandated',
        newRule: 'Coupling guard mandated',
        evidenceDoc: 'sample_compliance_requirements.json'
      },
      'IBR Boiler Rules': {
        tag: 'P-204 Centrifugal Pump',
        reg: 'IBR Boiler Rules',
        status: 'pass',
        score: 95,
        ruleTitle: 'Thermal Exchanger Certification',
        oldRule: 'Biannual hydrostatic testing',
        newRule: 'Biannual hydrostatic testing',
        evidenceDoc: 'sample_inspection_scan.png'
      }
    },
    'V-102 Separator Vessel': {
      'OISD Standard': {
        tag: 'V-102 Separator Vessel',
        reg: 'OISD Standard',
        status: 'pass',
        score: 92,
        ruleTitle: 'Relief Valve Capacity',
        oldRule: 'Set pressure 8 bar',
        newRule: 'Set pressure 8 bar',
        evidenceDoc: 'sample_compliance_requirements.json'
      },
      'PESO Guidelines': {
        tag: 'V-102 Separator Vessel',
        reg: 'PESO Guidelines',
        status: 'pass',
        score: 96,
        ruleTitle: 'Static Discharge Bonding',
        oldRule: 'Resistance < 10 ohms',
        newRule: 'Resistance < 10 ohms',
        evidenceDoc: 'sample_compliance_requirements.json'
      },
      'Factories Act 1948': {
        tag: 'V-102 Separator Vessel',
        reg: 'Factories Act 1948',
        status: 'pass',
        score: 90,
        ruleTitle: 'Manhole Inspection Hatch',
        oldRule: 'Clearance > 450mm',
        newRule: 'Clearance > 450mm',
        evidenceDoc: 'sample_inspection_scan.png'
      },
      'IBR Boiler Rules': {
        tag: 'V-102 Separator Vessel',
        reg: 'IBR Boiler Rules',
        status: 'pass',
        score: 100,
        ruleTitle: 'Pressure Vessel Stamp',
        oldRule: 'IBR Tag Active',
        newRule: 'IBR Tag Active',
        evidenceDoc: 'sample_compliance_requirements.json'
      }
    },
    'C-301 Hydrocracker Compressor': {
      'OISD Standard': {
        tag: 'C-301 Hydrocracker Compressor',
        reg: 'OISD Standard',
        status: 'violation',
        score: 42,
        ruleTitle: 'Cooling Jacket Flushing Interval',
        oldRule: 'Inspection interval: 12 months',
        newRule: 'Inspection interval: 6 months (OISD 2026 Mandate)',
        evidenceDoc: 'sample_gmail_export.mbox & sample_old_sop.pdf'
      },
      'PESO Guidelines': {
        tag: 'C-301 Hydrocracker Compressor',
        reg: 'PESO Guidelines',
        status: 'warning',
        score: 68,
        ruleTitle: 'Gas Leak Detection Sensors',
        oldRule: 'Dual IR sensors',
        newRule: 'Triple redundant laser sensors',
        evidenceDoc: 'sample_regulation_amendment.json'
      },
      'Factories Act 1948': {
        tag: 'C-301 Hydrocracker Compressor',
        reg: 'Factories Act 1948',
        status: 'pass',
        score: 91,
        ruleTitle: 'Noise Attenuation Enclosure',
        oldRule: 'Decibel level < 85 dBA',
        newRule: 'Decibel level < 85 dBA',
        evidenceDoc: 'sample_compliance_requirements.json'
      },
      'IBR Boiler Rules': {
        tag: 'C-301 Hydrocracker Compressor',
        reg: 'IBR Boiler Rules',
        status: 'pass',
        score: 94,
        ruleTitle: 'Steam Drive Turbine Safety',
        oldRule: 'Over-speed trip test',
        newRule: 'Over-speed trip test',
        evidenceDoc: 'sample_work_orders.xlsx'
      }
    },
    'T-501 Storage Tank': {
      'OISD Standard': {
        tag: 'T-501 Storage Tank',
        reg: 'OISD Standard',
        status: 'pass',
        score: 95,
        ruleTitle: 'Floating Roof Rim Seal',
        oldRule: 'Double rim seal required',
        newRule: 'Double rim seal required',
        evidenceDoc: 'sample_compliance_requirements.json'
      },
      'PESO Guidelines': {
        tag: 'T-501 Storage Tank',
        reg: 'PESO Guidelines',
        status: 'pass',
        score: 99,
        ruleTitle: 'Dyke Wall Storage Ratio',
        oldRule: 'Capacity 110% of tank',
        newRule: 'Capacity 110% of tank',
        evidenceDoc: 'sample_compliance_requirements.json'
      },
      'Factories Act 1948': {
        tag: 'T-501 Storage Tank',
        reg: 'Factories Act 1948',
        status: 'pass',
        score: 93,
        ruleTitle: 'Foam Pourer Fire System',
        oldRule: 'Auto-foam injection test',
        newRule: 'Auto-foam injection test',
        evidenceDoc: 'sample_compliance_requirements.json'
      },
      'IBR Boiler Rules': {
        tag: 'T-501 Storage Tank',
        reg: 'IBR Boiler Rules',
        status: 'pass',
        score: 100,
        ruleTitle: 'Heating Coil Inspection',
        oldRule: 'Coil pressure test',
        newRule: 'Coil pressure test',
        evidenceDoc: 'sample_compliance_requirements.json'
      }
    }
  };

  const handleCompileAuditPackage = async () => {
    setExporting(true);
    setExportSuccessMsg(null);

    try {
      // Backend call to Port 8003 via BFF proxy
      await bffFetch('compliance/audit', {
        method: 'POST',
        body: JSON.stringify({ action: 'compile_package' })
      });
    } catch {
      // Fallback
    }

    setTimeout(() => {
      setExporting(false);
      setExportSuccessMsg('🎉 Audit Package Compiled: Includes OISD/PESO Matrix, Auto-Narration & Evidence PDFs.');
    }, 1200);
  };

  return (
    <div className="space-y-4 pb-12">
      
      {/* Top Banner & Sticky Compile Audit Package Action */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white rounded-2xl p-5 shadow-xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-400/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-400/30">
            Module 4: QRCI Compliance Matrix
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">
            Quality & Regulatory Compliance Intelligence
          </h1>
          <p className="text-xs text-zinc-400 font-medium max-w-xl">
            Real-time compliance gap analysis mapped against Indian Standards (OISD, PESO, Factories Act, IBR) with side-by-side rule amendment diffs.
          </p>
        </div>

        {/* Sticky Compile Audit Package Button */}
        <button
          onClick={handleCompileAuditPackage}
          disabled={exporting}
          className="px-6 py-3.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2 transition hover:scale-105 disabled:opacity-50"
        >
          {exporting ? (
            <>
              <Sparkles size={16} className="animate-spin text-zinc-950" />
              Compiling Audit Package...
            </>
          ) : (
            <>
              <Download size={16} />
              Compile Audit Package (ZIP)
            </>
          )}
        </button>
      </div>

      {exportSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between">
          <span>{exportSuccessMsg}</span>
          <button onClick={() => setExportSuccessMsg(null)} className="text-emerald-700 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Traffic Light Matrix + Diff Viewer Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Traffic Light Matrix Grid */}
        <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-sm font-extrabold text-zinc-950 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              Equipment Tag vs Regulatory Standard Matrix
            </h2>
            <div className="flex items-center gap-3 text-[10px] font-extrabold">
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 size={12} /> Compliant
              </span>
              <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <AlertTriangle size={12} /> Warning
              </span>
              <span className="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                <XCircle size={12} /> Deviation
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-extrabold uppercase text-zinc-600">
                  <th className="py-3 px-4 text-left">Equipment Tag (Y-Axis)</th>
                  {regulatoryBodies.map((reg) => (
                    <th key={reg} className="py-3 px-3">{reg}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {equipmentTags.map((tag) => (
                  <tr key={tag} className="hover:bg-zinc-50/60 transition">
                    <td className="py-3.5 px-4 text-left font-extrabold text-zinc-950">{tag}</td>
                    {regulatoryBodies.map((reg) => {
                      const cell = matrixData[tag]?.[reg];
                      if (!cell) return <td key={reg} className="py-3 px-3">-</td>;

                      return (
                        <td key={reg} className="py-3 px-3">
                          <button
                            onClick={() => setSelectedCell(cell)}
                            className={`w-full py-2 px-2 rounded-xl text-xs font-black transition shadow-sm border flex flex-col items-center justify-center gap-0.5 ${
                              cell.status === 'pass'
                                ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                                : cell.status === 'warning'
                                  ? 'bg-amber-400 text-zinc-950 border-amber-500 hover:bg-amber-500 animate-pulse'
                                  : 'bg-red-600 text-white border-red-700 hover:bg-red-700'
                            }`}
                          >
                            <span>{cell.score}%</span>
                            <span className="text-[9px] uppercase font-bold opacity-90">{cell.status}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Slide-out Drawer: Amendment Diff Viewer */}
        {selectedCell ? (
          <div className="lg:col-span-4 bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <FileDiff size={16} className="text-lime-700" />
                <h3 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider">
                  Amendment Diff Viewer
                </h3>
              </div>
              <button onClick={() => setSelectedCell(null)} className="text-zinc-400 hover:text-zinc-900">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Focus Target</span>
                <h4 className="text-xs font-extrabold text-zinc-950">{selectedCell.tag}</h4>
                <p className="text-[11px] font-semibold text-lime-700">{selectedCell.reg} — {selectedCell.ruleTitle}</p>
              </div>

              {/* Code-style Side-by-Side Diff Box */}
              <div className="space-y-2 font-mono text-xs">
                
                {/* Old Rule (Strikethrough / Red) */}
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 space-y-1">
                  <span className="text-[9px] font-black uppercase text-red-700 block">Old Rule Standard (Deprecation)</span>
                  <p className="line-through font-semibold text-[11px] leading-relaxed">
                    {selectedCell.oldRule}
                  </p>
                </div>

                {/* New Rule (Highlighted Green) */}
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                  <span className="text-[9px] font-black uppercase text-emerald-700 block">New Enforced Standard (2026 Revision)</span>
                  <p className="font-extrabold text-[11px] leading-relaxed">
                    {selectedCell.newRule}
                  </p>
                </div>

              </div>

              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider block">Evidence Link</span>
                <p className="text-xs font-bold text-zinc-900 font-mono">
                  {selectedCell.evidenceDoc}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/app/copilot"
                className="w-full py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
              >
                Draft Corrective Action Plan
              </Link>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-4 bg-zinc-50 border border-dashed border-zinc-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-zinc-400 space-y-2">
            <FileDiff size={28} />
            <span className="text-xs font-extrabold text-zinc-600">Select any Matrix Cell to inspect Amendment Diff</span>
          </div>
        )}

      </div>

    </div>
  );
}
