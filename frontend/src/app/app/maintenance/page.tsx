"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  Wrench, 
  AlertTriangle, 
  Activity, 
  FileSpreadsheet, 
  ChevronRight, 
  GitBranch, 
  Layers, 
  CheckCircle2, 
  Sparkles,
  Search,
  Clock
} from 'lucide-react';

interface RcaNode {
  id: string;
  label: string;
  category: string;
  expanded?: boolean;
  children?: RcaNode[];
  detail: string;
}

export default function MiraWorkbenchPage() {
  const { currentActiveRole } = useAuth();
  const [selectedAsset, setSelectedAsset] = useState('P-204');

  // Interactive 5-Why Tree State
  const [rcaTree, setRcaTree] = useState<RcaNode>({
    id: 'why-1',
    label: '1. Why did P-204 Centrifugal Pump trip?',
    category: 'Symptom',
    expanded: true,
    detail: 'Vibration monitoring sensor flagged peak amplitude at 12.4 mm/s exceeding threshold (10 mm/s).',
    children: [
      {
        id: 'why-2',
        label: '2. Why was there a high vibration amplitude on drive end?',
        category: 'Mechanical',
        expanded: true,
        detail: 'Mechanical seal housing misaligned due to worn ball bearings.',
        children: [
          {
            id: 'why-3',
            label: '3. Why did the drive end bearings wear out prematurely?',
            category: 'Lubrication',
            expanded: true,
            detail: 'Lubricant oil breakdown caused by overheating in bearing housing.',
            children: [
              {
                id: 'why-4',
                label: '4. Why did the bearing housing overheat?',
                category: 'Operational',
                expanded: false,
                detail: 'Cooling jacket recirculation line was clogged with scale buildup.',
                children: [
                  {
                    id: 'why-5',
                    label: '5. Root Cause: Inspection & flushing interval lapsed (>6 months).',
                    category: 'Root Cause',
                    expanded: false,
                    detail: 'Non-compliance with OISD-117 biannual flushing requirement.'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  });

  const [activeWhyNode, setActiveWhyNode] = useState<RcaNode>(rcaTree);

  // Historical Work Orders for Right Bottom Pane
  const workOrders = [
    { wo: 'WO-8841', date: '12-Jul-2026', component: 'Mechanical Seal', tech: 'M. Verma', status: 'Completed' },
    { wo: 'WO-8102', date: '04-Jan-2026', component: 'Bearing Flush', tech: 'A. Gupta', status: 'Completed' },
    { wo: 'WO-7930', date: '18-Aug-2025', component: 'Vibration Calibration', tech: 'R. Sharma', status: 'Completed' },
  ];

  const toggleExpandNode = (nodeId: string) => {
    const toggleInTree = (n: RcaNode): RcaNode => {
      if (n.id === nodeId) {
        return { ...n, expanded: !n.expanded };
      }
      if (n.children) {
        return { ...n, children: n.children.map(toggleInTree) };
      }
      return n;
    };
    setRcaTree(toggleInTree(rcaTree));
  };

  const renderRcaNodes = (nodes: RcaNode[]) => {
    return (
      <div className="space-y-2 pl-4 border-l-2 border-zinc-200">
        {nodes.map((n) => (
          <div key={n.id} className="space-y-2">
            <div 
              onClick={() => {
                setActiveWhyNode(n);
                if (n.children) toggleExpandNode(n.id);
              }}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                activeWhyNode.id === n.id
                  ? 'bg-zinc-950 text-white border-zinc-950 shadow-md'
                  : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <GitBranch size={15} className={activeWhyNode.id === n.id ? 'text-lime-400' : 'text-zinc-500'} />
                <span className="text-xs font-bold">{n.label}</span>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                n.category === 'Root Cause' 
                  ? 'bg-red-100 text-red-800' 
                  : 'bg-zinc-100 text-zinc-700'
              }`}>
                {n.category}
              </span>
            </div>

            {n.children && n.expanded && renderRcaNodes(n.children)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-12">
      
      {/* Top Banner: Pattern Mining Alert Box */}
      <div className="bg-amber-500/15 border border-amber-300 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center font-black">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h2 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <span>MIRA Pattern Mining Engine Flag</span>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            </h2>
            <p className="text-xs font-bold text-amber-900">
              Pattern Match Detected: This failure signature matches 3 previous near-misses on P-108 and P-311 units.
            </p>
          </div>
        </div>
        <Link 
          href="/app/copilot"
          className="px-3.5 py-2 rounded-xl bg-amber-950 text-amber-200 font-extrabold text-xs uppercase hover:bg-zinc-950 transition"
        >
          Investigate Pattern
        </Link>
      </div>

      {/* Split Pane Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Pane: Interactive 5-Why RCA Tree (50% - 6 cols) */}
        <div className="lg:col-span-6 bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-lime-700" />
              <h3 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider">
                Interactive 5-Why Root Cause Tree ({selectedAsset})
              </h3>
            </div>
            <span className="text-[10px] font-bold text-zinc-400">Click node to expand</span>
          </div>

          <div className="space-y-2">
            <div 
              onClick={() => setActiveWhyNode(rcaTree)}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                activeWhyNode.id === rcaTree.id
                  ? 'bg-zinc-950 text-white border-zinc-950 shadow-md'
                  : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <GitBranch size={15} className={activeWhyNode.id === rcaTree.id ? 'text-lime-400' : 'text-zinc-500'} />
                <span className="text-xs font-bold">{rcaTree.label}</span>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                {rcaTree.category}
              </span>
            </div>

            {rcaTree.children && renderRcaNodes(rcaTree.children)}
          </div>

          {/* Active Node Detail Footer */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
            <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block">
              Active Why Focus Detail
            </span>
            <p className="text-xs font-extrabold text-zinc-900">
              {activeWhyNode.detail}
            </p>
          </div>
        </div>

        {/* Right Pane (50% - 6 cols): Top Telemetry + Bottom Work Orders */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Top Right: Telemetry & Anomaly Graph (25% Height) */}
          <div className="bg-zinc-950 text-white rounded-2xl p-5 shadow-xl space-y-3 border border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-lime-400 animate-pulse" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Real-time Telemetry (Vibration Spike)
                </h3>
              </div>
              <span className="text-[10px] font-extrabold text-red-400 bg-red-950 px-2 py-0.5 rounded border border-red-800">
                Threshold Exceeded (10mm/s Limit)
              </span>
            </div>

            {/* Time Series Graph Visual Mock */}
            <div className="h-36 bg-zinc-900 rounded-xl p-3 relative flex items-end justify-between border border-zinc-800 overflow-hidden">
              
              {/* Threshold Red Line */}
              <div className="absolute top-10 inset-x-0 border-t-2 border-dashed border-red-500 z-10 flex justify-end pr-2">
                <span className="text-[9px] font-black text-red-400 bg-red-950 px-1 rounded">Red Limit: 10 mm/s</span>
              </div>

              {/* Sparkline Columns */}
              {[4, 5, 4.8, 5.2, 6.1, 7.8, 12.4, 11.2, 9.8, 8.4].map((v, i) => (
                <div key={i} className="flex flex-col items-center gap-1 z-20 flex-1">
                  <div 
                    style={{ height: `${v * 8}px` }} 
                    className={`w-4 rounded-t ${v >= 10 ? 'bg-red-500 animate-pulse' : 'bg-lime-400'}`}
                  />
                  <span className="text-[8px] font-mono text-zinc-500">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Right: Work Order Cross-Reference (25% Height) */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h3 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-zinc-600" />
                Historical Work Order Cross-Reference
              </h3>
              <span className="text-[11px] font-bold text-zinc-500">Equipment: P-204</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-extrabold uppercase text-zinc-500">
                    <th className="py-2 px-3">WO ID</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Component</th>
                    <th className="py-2 px-3">Technician</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs font-semibold text-zinc-800">
                  {workOrders.map((wo) => (
                    <tr key={wo.wo} className="hover:bg-zinc-50">
                      <td className="py-2.5 px-3 font-bold text-lime-700">{wo.wo}</td>
                      <td className="py-2.5 px-3 text-zinc-500">{wo.date}</td>
                      <td className="py-2.5 px-3">{wo.component}</td>
                      <td className="py-2.5 px-3">{wo.tech}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {wo.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
