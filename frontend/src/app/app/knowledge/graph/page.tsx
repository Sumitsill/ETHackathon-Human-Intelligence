"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  Network, 
  Filter, 
  Search, 
  X, 
  Info, 
  ExternalLink, 
  Database, 
  Wrench, 
  ShieldCheck, 
  FileText, 
  Mail,
  Zap,
  SlidersHorizontal,
  Plus,
  Minus
} from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  type: 'equipment' | 'standard' | 'work_order' | 'email';
  x: number;
  y: number;
  color: string;
  metadata: {
    tag?: string;
    description: string;
    limit?: string;
    status?: string;
    sourceDoc?: string;
  };
}

export default function KnowledgeGraphPage() {
  const { currentActiveRole } = useAuth();
  
  // Left Sidebar Filters
  const [filterEquipment, setFilterEquipment] = useState(true);
  const [filterStandards, setFilterStandards] = useState(true);
  const [filterWorkOrders, setFilterWorkOrders] = useState(true);
  const [filterEmails, setFilterEmails] = useState(true);

  // Selected Node for Right Inspector Drawer
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>({
    id: 'n-1',
    label: 'P-204 Centrifugal Pump',
    type: 'equipment',
    x: 400,
    y: 220,
    color: '#10b981',
    metadata: {
      tag: 'P-204',
      description: 'Main crude feed pump located in Refinery Unit 2.',
      limit: 'Max Pressure 12 bar | Max Temp 115°C',
      status: 'Vibration Spike Alert (12.4 mm/s)',
      sourceDoc: 'sample_oem_manual.pdf'
    }
  });

  const nodes: GraphNode[] = [
    {
      id: 'n-1',
      label: 'P-204 Centrifugal Pump',
      type: 'equipment',
      x: 420,
      y: 220,
      color: 'bg-emerald-500 text-white',
      metadata: {
        tag: 'P-204',
        description: 'Main crude feed pump located in Refinery Unit 2.',
        limit: 'Max Pressure 12 bar | Max Temp 115°C',
        status: 'Vibration Spike Alert (12.4 mm/s)',
        sourceDoc: 'sample_oem_manual.pdf'
      }
    },
    {
      id: 'n-2',
      label: 'OISD-117 Safety Standard',
      type: 'standard',
      x: 220,
      y: 140,
      color: 'bg-amber-500 text-white',
      metadata: {
        tag: 'OISD-117',
        description: 'Safety guidelines for petroleum refinery pumps and high pressure piping.',
        limit: 'Mandatory Inspection: Every 6 Months',
        status: 'Compliant (Audit Verified)',
        sourceDoc: 'sample_compliance_requirements.json'
      }
    },
    {
      id: 'n-3',
      label: 'WO-8841 Seal Repair',
      type: 'work_order',
      x: 620,
      y: 160,
      color: 'bg-sky-500 text-white',
      metadata: {
        tag: 'WO-8841',
        description: 'Mechanical seal replacement & bearing lubrication routine.',
        limit: 'MTTR Target: 4.5 Hours',
        status: 'Completed by Maint Team B',
        sourceDoc: 'sample_work_orders.xlsx'
      }
    },
    {
      id: 'n-4',
      label: 'C-301 Compressor',
      type: 'equipment',
      x: 340,
      y: 380,
      color: 'bg-emerald-500 text-white',
      metadata: {
        tag: 'C-301',
        description: 'Reciprocating gas compressor for hydrocracker unit.',
        limit: 'Max Thermal Threshold: 140°C',
        status: 'Tripped at 09:30 AM',
        sourceDoc: 'sample_old_sop.pdf'
      }
    },
    {
      id: 'n-5',
      label: 'C-301 Trip Email Alert',
      type: 'email',
      x: 180,
      y: 390,
      color: 'bg-violet-500 text-white',
      metadata: {
        tag: 'MBOX-MSG-101',
        description: 'Email notification regarding C-301 discharge temperature trip.',
        limit: 'Sender: R.Sharma@plant.com',
        status: 'Ingested & Parsed',
        sourceDoc: 'sample_gmail_export.mbox'
      }
    },
  ];

  // Filtered nodes
  const visibleNodes = nodes.filter((n) => {
    if (n.type === 'equipment' && !filterEquipment) return false;
    if (n.type === 'standard' && !filterStandards) return false;
    if (n.type === 'work_order' && !filterWorkOrders) return false;
    if (n.type === 'email' && !filterEmails) return false;
    return true;
  });

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col md:flex-row gap-3 relative overflow-hidden">
      
      {/* Left Narrow Sidebar: Graph Filters */}
      <aside className="w-full md:w-64 bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between flex-shrink-0 space-y-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Filter size={16} className="text-zinc-700" />
            <h2 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider">
              Neo4j Graph Filters
            </h2>
          </div>

          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filterEquipment}
                onChange={(e) => setFilterEquipment(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-0" 
              />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Equipment Nodes (P-204, C-301)
            </label>

            <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filterStandards}
                onChange={(e) => setFilterStandards(e.target.checked)}
                className="rounded text-amber-600 focus:ring-0" 
              />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Regulatory Standards (OISD, PESO)
            </label>

            <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filterWorkOrders}
                onChange={(e) => setFilterWorkOrders(e.target.checked)}
                className="rounded text-sky-600 focus:ring-0" 
              />
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              Work Orders & Repairs
            </label>

            <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filterEmails}
                onChange={(e) => setFilterEmails(e.target.checked)}
                className="rounded text-violet-600 focus:ring-0" 
              />
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              Ingested Emails & Logs
            </label>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-[10px] font-semibold text-zinc-500 space-y-1">
          <span className="font-extrabold text-zinc-900 block uppercase">Graph Topology Info</span>
          <p>Showing {visibleNodes.length} active nodes connected across 8 relationship links in Neo4j database.</p>
        </div>
      </aside>

      {/* Center Main Canvas Pane: Force-Directed View */}
      <div className="flex-1 bg-zinc-950 rounded-2xl relative border border-zinc-800 shadow-2xl overflow-hidden flex flex-col justify-between p-4">
        
        {/* Canvas Top Bar */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-xl text-white text-xs font-extrabold">
            <Network size={15} className="text-lime-400" />
            Interactive Graph Visualizer
          </div>
          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-800">
            Click any node to inspect raw metadata & limits
          </span>
        </div>

        {/* SVG Network Graph Lines & Nodes */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
          <svg className="w-full h-full">
            {/* Edge Connections */}
            <line x1="420" y1="220" x2="220" y2="140" stroke="#4b5563" strokeWidth="2" strokeDasharray="4" />
            <line x1="420" y1="220" x2="620" y2="160" stroke="#4b5563" strokeWidth="2" />
            <line x1="420" y1="220" x2="340" y2="380" stroke="#10b981" strokeWidth="2.5" />
            <line x1="340" y1="380" x2="180" y2="390" stroke="#8b5cf6" strokeWidth="2" />

            {/* Relationship Labels */}
            <text x="310" y="170" fill="#9ca3af" fontSize="10" fontWeight="bold">GOVERNED_BY</text>
            <text x="510" y="180" fill="#9ca3af" fontSize="10" fontWeight="bold">MAINTAINED_IN</text>
            <text x="365" y="295" fill="#10b981" fontSize="10" fontWeight="bold">LINKED_TO</text>
          </svg>

          {/* Render Interactive Nodes */}
          {visibleNodes.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelectedNode(n)}
              style={{ left: `${n.x}px`, top: `${n.y}px` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 p-3 rounded-2xl ${n.color} font-extrabold text-xs shadow-2xl hover:scale-110 transition-all border-2 ${
                selectedNode?.id === n.id ? 'border-lime-400 ring-4 ring-lime-400/20' : 'border-zinc-800'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                {n.label}
              </div>
            </button>
          ))}
        </div>

        {/* Graph Controls */}
        <div className="flex items-center justify-between z-10">
          <div className="text-[10px] text-zinc-500 font-mono">
            Neo4j Engine Version: 6.2.0 | CYPHER Query active
          </div>
        </div>
      </div>

      {/* Right Slide-out Drawer: Node Inspector */}
      {selectedNode && (
        <aside className="w-full md:w-80 bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xl flex flex-col justify-between flex-shrink-0 space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-lime-700" />
                <h3 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider">
                  Node Inspector
                </h3>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="text-zinc-400 hover:text-zinc-950 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Selected Entity</span>
                <h4 className="text-sm font-extrabold text-zinc-950">{selectedNode.label}</h4>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 block uppercase">Description</span>
                  <p className="text-xs font-semibold text-zinc-800">{selectedNode.metadata.description}</p>
                </div>

                {selectedNode.metadata.limit && (
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 block uppercase">Associated Limits</span>
                    <p className="text-xs font-extrabold text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200">
                      {selectedNode.metadata.limit}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-bold text-zinc-500 block uppercase">Operating Status</span>
                  <p className="text-xs font-bold text-emerald-700">{selectedNode.metadata.status}</p>
                </div>
              </div>

              {selectedNode.metadata.sourceDoc && (
                <div className="p-3 rounded-xl bg-lime-50 border border-lime-200 space-y-1">
                  <span className="text-[10px] font-extrabold text-lime-900 block uppercase flex items-center gap-1">
                    <ExternalLink size={12} /> Source Document Link
                  </span>
                  <p className="text-xs font-bold text-zinc-900 font-mono">
                    {selectedNode.metadata.sourceDoc}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/app/copilot"
              className="w-full py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
            >
              Query Node in Copilot
            </Link>
          </div>
        </aside>
      )}

    </div>
  );
}
