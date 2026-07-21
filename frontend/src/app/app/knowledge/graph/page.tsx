"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { bffFetch } from '@/lib/bff-fetch';
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
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Activity,
  Layers,
  ArrowRight,
  Sparkles,
  ChevronDown,
  User,
  CheckCircle2,
  Lock,
  Unlock
} from 'lucide-react';

interface NodeMetadata {
  tag?: string;
  category?: string;
  description?: string;
  limit?: string;
  status?: string;
  sourceDoc?: string;
  confidence?: number;
  original_value?: string;
  [key: string]: any;
}

interface GraphNode {
  id: string;
  label: string;
  name: string;
  type: 'equipment' | 'parameter' | 'standard' | 'fact' | 'person' | 'work_order' | 'email' | 'telemetry';
  col?: number;
  x: number;
  y: number;
  metadata: NodeMetadata;
}

interface GraphLink {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
}

interface DocumentOption {
  id: string;
  filename: string;
  source_type?: string;
}

// Fallback comprehensive industrial plant knowledge graph topology
const INITIAL_DEMO_NODES: GraphNode[] = [
  {
    id: 'equipment:P-204',
    label: 'P-204 Centrifugal Pump',
    name: 'P-204',
    type: 'equipment',
    x: 450,
    y: 120,
    metadata: {
      tag: 'P-204',
      category: 'Crude Charge Pump',
      description: 'Primary centrifugal feed pump operating in CDU Unit 2.',
      limit: 'Max Pressure: 12.0 Bar | Max Temp: 75°C',
      status: 'Active (Continuous Monitoring)',
      sourceDoc: 'sample_oem_manual.pdf'
    }
  },
  {
    id: 'equipment:FLOWMASTER-5000X',
    label: 'FlowMaster 5000X Pump Model',
    name: 'FLOWMASTER-5000X',
    type: 'equipment',
    x: 450,
    y: 240,
    metadata: {
      tag: 'FM-5000X',
      category: 'Pump Model Series',
      description: 'Heavy duty refinery centrifugal pump model assembly.',
      status: 'Active Design Spec',
      sourceDoc: 'sample_oem_manual.pdf'
    }
  },
  {
    id: 'equipment:C-301',
    label: 'C-301 Hydrocracker Compressor',
    name: 'C-301',
    type: 'equipment',
    x: 450,
    y: 360,
    metadata: {
      tag: 'C-301',
      category: 'Reciprocating Compressor',
      description: 'High pressure gas recirculation compressor for Hydrocracker unit.',
      limit: 'Max Thermal Threshold: 140°C',
      status: 'Monitored Unit',
      sourceDoc: 'sample_old_sop.pdf'
    }
  },
  {
    id: 'equipment:Generator-3',
    label: 'Generator-3 Emergency Diesel',
    name: 'Generator-3',
    type: 'equipment',
    x: 450,
    y: 480,
    metadata: {
      tag: 'Generator-3',
      category: 'Emergency Diesel Generator',
      description: 'Emergency diesel generator unit in Powerhouse area.',
      status: 'In Inspection Cycle',
      sourceDoc: 'sample_work_orders.xlsx'
    }
  },
  {
    id: 'parameter:12 BAR',
    label: '12.0 Bar Max Pressure',
    name: '12 BAR',
    type: 'parameter',
    x: 740,
    y: 120,
    metadata: {
      tag: 'PARAM-PRESS',
      category: 'Operating Pressure Limit',
      description: 'Maximum allowable operating pressure threshold.',
      limit: '12.0 Bar Gauge',
      status: 'Normal Limit Verified',
      sourceDoc: 'sample_oem_manual.pdf'
    }
  },
  {
    id: 'parameter:75°C',
    label: '75°C Operating Temperature',
    name: '75°C',
    type: 'parameter',
    x: 740,
    y: 240,
    metadata: {
      tag: 'PARAM-TEMP',
      category: 'Operating Temp Limit',
      description: 'Normal operating temperature limit for P-204 cooling jacket.',
      limit: '75°C Target',
      status: 'Monitored Parameter',
      sourceDoc: 'sample_oem_manual.pdf'
    }
  },
  {
    id: 'regulation:6 MONTHS',
    label: '6-Month Inspection Interval',
    name: '6 MONTHS',
    type: 'standard',
    x: 160,
    y: 120,
    metadata: {
      tag: 'OISD-117-CLAUSE-4',
      category: 'Regulatory Interval',
      description: 'Mandatory biannual mechanical seal inspection requirement.',
      limit: 'Strict Compliance 180 Days',
      status: 'Mandatory Active Rule',
      sourceDoc: 'sample_compliance_requirements.json'
    }
  },
  {
    id: 'fact:STANDARD VISUAL INSPECTION',
    label: 'Standard Visual Seal Inspection',
    name: 'VISUAL INSPECTION',
    type: 'fact',
    x: 160,
    y: 240,
    metadata: {
      tag: 'SOP-INSPECT-01',
      category: 'Maintenance Procedure',
      description: 'Standard visual inspection of mechanical seals and bearing lubrication.',
      status: 'Active SOP Instruction',
      sourceDoc: 'sample_oem_manual.pdf'
    }
  },
  {
    id: 'person:R. Sharma',
    label: 'Engineer R. Sharma',
    name: 'R. Sharma',
    type: 'person',
    x: 1030,
    y: 120,
    metadata: {
      tag: 'EMP-9042',
      category: 'Senior Maintenance Engineer',
      description: 'Primary assigned technician for P-204 mechanical seal overhauls.',
      status: 'Certified Inspector',
      sourceDoc: 'sample_work_orders.xlsx'
    }
  },
  {
    id: 'person:A. Gupta',
    label: 'Engineer A. Gupta',
    name: 'A. Gupta',
    type: 'person',
    x: 1030,
    y: 240,
    metadata: {
      tag: 'EMP-7718',
      category: 'Plant Operations Specialist',
      description: 'Supervisor for pressure vessel safety inspections.',
      status: 'Active Operator',
      sourceDoc: 'sample_work_orders.xlsx'
    }
  },
  {
    id: 'wo-8841',
    label: 'WO-8841: Seal Overhaul',
    name: 'WO-8841',
    type: 'work_order',
    x: 1030,
    y: 360,
    metadata: {
      tag: 'WO-8841',
      category: 'Corrective Maintenance',
      description: 'Drive end mechanical seal replacement and bearing flushing.',
      status: 'Completed (Validated)',
      sourceDoc: 'sample_work_orders.xlsx'
    }
  }
];

const INITIAL_DEMO_LINKS: GraphLink[] = [
  { id: 'l1', source: 'equipment:P-204', target: 'parameter:12 BAR', type: 'PARAMETER_BELONGS_TO', label: 'PARAMETER_BELONGS_TO' },
  { id: 'l2', source: 'equipment:P-204', target: 'parameter:75°C', type: 'PARAMETER_BELONGS_TO', label: 'PARAMETER_BELONGS_TO' },
  { id: 'l3', source: 'equipment:P-204', target: 'regulation:6 MONTHS', type: 'REGULATION_APPLIES_TO', label: 'REGULATION_APPLIES_TO' },
  { id: 'l4', source: 'equipment:P-204', target: 'fact:STANDARD VISUAL INSPECTION', type: 'FACT_APPLIES_TO', label: 'FACT_APPLIES_TO' },
  { id: 'l5', source: 'person:R. Sharma', target: 'equipment:P-204', type: 'PERFORMED_ON', label: 'PERFORMED_ON' },
  { id: 'l6', source: 'person:A. Gupta', target: 'equipment:Generator-3', type: 'PERFORMED_ON', label: 'PERFORMED_ON' },
  { id: 'l7', source: 'equipment:P-204', target: 'wo-8841', type: 'MAINTAINED_IN', label: 'MAINTAINED_IN' },
  { id: 'l8', source: 'equipment:FLOWMASTER-5000X', target: 'equipment:P-204', type: 'MODEL_FOR', label: 'MODEL_FOR' }
];

export default function KnowledgeGraphPage() {
  const { currentActiveRole } = useAuth();

  // PERMISSION CHECKBOX: Control whether Inspector form opens on node click/rearrange
  const [allowAutoInspector, setAllowAutoInspector] = useState<boolean>(false);

  // Document Target Selector ("Choose Whose Graph to View")
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('all');

  // Entity Category Filters
  const [filterEquipment, setFilterEquipment] = useState(true);
  const [filterParameters, setFilterParameters] = useState(true);
  const [filterStandards, setFilterStandards] = useState(true);
  const [filterFacts, setFilterFacts] = useState(true);
  const [filterPersonnel, setFilterPersonnel] = useState(true);
  const [filterWorkOrders, setFilterWorkOrders] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Graph Data State
  const [nodes, setNodes] = useState<GraphNode[]>(INITIAL_DEMO_NODES);
  const [links, setLinks] = useState<GraphLink[]>(INITIAL_DEMO_LINKS);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Viewport Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Custom User-Dragged Position Memory (Prevents nodes moving here and there!)
  const customPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Smooth Dragging Node State
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  // GLOBAL MOUSEUP LISTENER: Guarantees node dropoff is 100% synchronized with mouse release!
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      setDragNodeId(null);
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Fetch available documents for dropdown selector
  const fetchDocumentOptions = async () => {
    try {
      const res = await bffFetch('knowledge/documents');
      if (Array.isArray(res) && res.length > 0) {
        setDocuments(res.map((d: any) => ({
          id: d.id,
          filename: d.filename,
          source_type: d.source_type
        })));
      } else {
        setDocuments([]);
      }
    } catch {
      setDocuments([]);
    }
  };

  // Helper to categorize entity into multi-column grid tiers (Preserving custom user dragged coordinates)
  const distributeNodesInGrid = (rawNodes: GraphNode[]): GraphNode[] => {
    const col1: GraphNode[] = []; // Standards & SOP Facts (x = 160)
    const col2: GraphNode[] = []; // Core Equipment & Assets (x = 450)
    const col3: GraphNode[] = []; // Operating Parameters & Limits (x = 740)
    const col4: GraphNode[] = []; // Personnel, Work Orders, Alerts (x = 1030)

    rawNodes.forEach((n) => {
      if (n.type === 'standard' || n.type === 'fact') col1.push(n);
      else if (n.type === 'equipment') col2.push(n);
      else if (n.type === 'parameter') col3.push(n);
      else col4.push(n);
    });

    const processColumn = (colNodes: GraphNode[], targetX: number) => {
      const startY = 120;
      const spacingY = 120;
      return colNodes.map((n, idx) => {
        // If user already moved/dragged this node, strictly preserve custom position!
        if (customPositionsRef.current.has(n.id)) {
          const custom = customPositionsRef.current.get(n.id)!;
          return { ...n, x: custom.x, y: custom.y };
        }
        return {
          ...n,
          x: targetX,
          y: startY + idx * spacingY
        };
      });
    };

    return [
      ...processColumn(col1, 160),
      ...processColumn(col2, 450),
      ...processColumn(col3, 740),
      ...processColumn(col4, 1030)
    ];
  };

  // Check if a node label is a standalone unlinked date string (e.g., "2026-07-21" or "2024")
  const isStandaloneDateNode = (name: string, label: string, connectedEdgesCount: number): boolean => {
    const text = (name || label || '').trim();
    const isDatePattern = /^\d{4}(-\d{2}-\d{2})?$/i.test(text) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/i.test(text);
    return isDatePattern && connectedEdgesCount === 0;
  };

  // Fetch backend graph with full node & connection resolution
  const fetchGraphData = async () => {
    setLoading(true);
    try {
      let endpoint = 'knowledge/graph';
      if (selectedDocId !== 'all') {
        endpoint = `knowledge/graph/document/${selectedDocId}`;
      }

      const res = await bffFetch(endpoint);
      if (res && res.nodes && res.nodes.length > 0) {
        // Build edge count per node ID to detect isolated date nodes
        const edgeCounts = new Map<string, number>();
        (res.links || res.edges || []).forEach((e: any) => {
          const s = e.source_id || e.source;
          const t = e.target_id || e.target;
          edgeCounts.set(s, (edgeCounts.get(s) || 0) + 1);
          edgeCounts.set(t, (edgeCounts.get(t) || 0) + 1);
        });

        const rawMapped: GraphNode[] = [];

        res.nodes.forEach((n: any, idx: number) => {
          const rawLabel = (n.label || n.type || '').toLowerCase();
          const rawName = (n.name || n.id || '').toLowerCase();
          const count = edgeCounts.get(n.id) || 0;

          // Filter out standalone unlinked date nodes
          if (isStandaloneDateNode(n.name, n.label, count)) {
            return;
          }

          let nodeType: GraphNode['type'] = 'equipment';
          if (rawLabel.includes('parameter') || rawName.includes('bar') || rawName.includes('°c') || rawName.includes('temp') || rawName.includes('pressure')) {
            nodeType = 'parameter';
          } else if (rawLabel.includes('standard') || rawLabel.includes('regulatory') || rawName.includes('oisd') || rawName.includes('factories') || rawName.includes('month')) {
            nodeType = 'standard';
          } else if (rawLabel.includes('fact') || rawLabel.includes('sop') || rawLabel.includes('procedure')) {
            nodeType = 'fact';
          } else if (rawLabel.includes('person') || rawName.includes('sharma') || rawName.includes('gupta') || rawName.includes('singh')) {
            nodeType = 'person';
          } else if (rawLabel.includes('work') || rawLabel.includes('order') || rawName.includes('wo-')) {
            nodeType = 'work_order';
          } else if (rawLabel.includes('email') || rawName.includes('mbox')) {
            nodeType = 'email';
          } else if (rawLabel.includes('telemetry') || rawName.includes('vib') || rawName.includes('sensor')) {
            nodeType = 'telemetry';
          }

          const props = n.properties || {};

          rawMapped.push({
            id: n.id || `node-${idx}`,
            label: n.name || n.id || `Entity ${idx + 1}`,
            name: n.name || n.id,
            type: nodeType,
            x: 0,
            y: 0,
            metadata: {
              tag: props.tag || props.original_value || n.name,
              category: props.category || n.label,
              description: props.description || props.value || `Extracted entity node from plant knowledge graph.`,
              limit: props.limit || props.clause,
              status: props.status || 'Active Graph Entity',
              sourceDoc: props.sourceDoc || props.filename || selectedDocId,
              confidence: props.confidence || 0.95
            }
          });
        });

        const mappedLinks: GraphLink[] = (res.links || res.edges || []).map((e: any, idx: number) => ({
          id: e.id || `link-${idx}`,
          source: e.source_id || e.source,
          target: e.target_id || e.target,
          type: e.type || 'LINKED_TO',
          label: (e.type || 'LINKED_TO').replace(/_/g, ' ')
        }));

        setNodes(distributeNodesInGrid(rawMapped));
        setLinks(mappedLinks);
      } else {
        // Strict Grounding: Show empty graph if no document data ingested
        setNodes([]);
        setLinks([]);
      }
    } catch (e) {
      console.warn("Backend graph fetch error.", e);
      setNodes([]);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentOptions();
  }, []);

  useEffect(() => {
    fetchGraphData();
  }, [selectedDocId]);

  // Filtered nodes based on checkboxes and search query
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (n.type === 'equipment' && !filterEquipment) return false;
      if (n.type === 'parameter' && !filterParameters) return false;
      if (n.type === 'standard' && !filterStandards) return false;
      if (n.type === 'fact' && !filterFacts) return false;
      if (n.type === 'person' && !filterPersonnel) return false;
      if (n.type === 'work_order' && !filterWorkOrders) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = n.label.toLowerCase().includes(q);
        const matchesTag = n.metadata.tag?.toLowerCase().includes(q);
        const matchesDesc = n.metadata.description?.toLowerCase().includes(q);
        return matchesName || matchesTag || matchesDesc;
      }
      return true;
    });
  }, [nodes, filterEquipment, filterParameters, filterStandards, filterFacts, filterPersonnel, filterWorkOrders, searchQuery]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  // Filtered links where both endpoints exist
  const visibleLinks = useMemo(() => {
    return links.filter((l) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target));
  }, [links, visibleNodeIds]);

  // Helper map for node positioning
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // PARALLEL / OVERLAPPING EDGE CURVATURE MAP
  const pairLinkCounts = useMemo(() => {
    const counts = new Map<string, { total: number; index: number }>();
    const pairTrack = new Map<string, number>();

    visibleLinks.forEach((l) => {
      const pairKey = [l.source, l.target].sort().join(':::');
      pairTrack.set(pairKey, (pairTrack.get(pairKey) || 0) + 1);
    });

    const pairIndex = new Map<string, number>();
    visibleLinks.forEach((l) => {
      const pairKey = [l.source, l.target].sort().join(':::');
      const idx = pairIndex.get(pairKey) || 0;
      pairIndex.set(pairKey, idx + 1);
      counts.set(l.id, { total: pairTrack.get(pairKey) || 1, index: idx });
    });

    return counts;
  }, [visibleLinks]);

  // Fast Mouse Handlers for 60fps Buttery Smooth Node Dragging
  const handleMouseDownSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'graph-bg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMoveSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    } else if (dragNodeId && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;

      // Save custom dragged coordinate in memory so node never resets/jumps!
      customPositionsRef.current.set(dragNodeId, { x: mouseX, y: mouseY });

      // Update position immediately
      setNodes((prev) =>
        prev.map((n) => (n.id === dragNodeId ? { ...n, x: mouseX, y: mouseY } : n))
      );
    }
  };

  const handleMouseUpSvg = () => {
    setIsPanning(false);
    setDragNodeId(null);
  };

  const handleWheelSvg = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((prev) => Math.min(Math.max(0.4, prev * zoomFactor), 2.5));
  };

  // Rich Entity Type Theme Styling
  const getNodeTheme = (type: GraphNode['type']) => {
    switch (type) {
      case 'equipment':
        return {
          bg: 'bg-emerald-950/90',
          border: 'border-emerald-500',
          glow: 'shadow-[0_0_20px_rgba(16,185,129,0.3)]',
          accent: '#10b981',
          icon: <Database size={14} className="text-emerald-400" />
        };
      case 'parameter':
        return {
          bg: 'bg-cyan-950/90',
          border: 'border-cyan-400',
          glow: 'shadow-[0_0_20px_rgba(6,182,212,0.3)]',
          accent: '#06b6d4',
          icon: <SlidersHorizontal size={14} className="text-cyan-300" />
        };
      case 'standard':
        return {
          bg: 'bg-amber-950/90',
          border: 'border-amber-500',
          glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]',
          accent: '#f59e0b',
          icon: <ShieldCheck size={14} className="text-amber-400" />
        };
      case 'fact':
        return {
          bg: 'bg-lime-950/90',
          border: 'border-lime-500',
          glow: 'shadow-[0_0_20px_rgba(132,204,22,0.3)]',
          accent: '#84cc16',
          icon: <FileText size={14} className="text-lime-400" />
        };
      case 'person':
        return {
          bg: 'bg-rose-950/90',
          border: 'border-rose-400',
          glow: 'shadow-[0_0_20px_rgba(244,63,94,0.3)]',
          accent: '#f43f5e',
          icon: <User size={14} className="text-rose-300" />
        };
      case 'work_order':
      default:
        return {
          bg: 'bg-sky-950/90',
          border: 'border-sky-500',
          glow: 'shadow-[0_0_20px_rgba(14,165,233,0.3)]',
          accent: '#0ea5e9',
          icon: <Wrench size={14} className="text-sky-400" />
        };
    }
  };

  // Selected document display label
  const activeDocLabel = useMemo(() => {
    if (selectedDocId === 'all') return 'All Ingested Documents (Full Knowledge Graph)';
    const match = documents.find(d => d.id === selectedDocId);
    return match ? match.filename : selectedDocId;
  }, [selectedDocId, documents]);

  return (
    <div className="h-[calc(100vh-5.5rem)] flex flex-col md:flex-row gap-3 relative overflow-hidden">
      
      {/* Left Sidebar: Controls, Document Selector & Inspector Permissions */}
      <aside className="w-full md:w-80 bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between flex-shrink-0 space-y-4">
        <div className="space-y-4">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Network size={16} className="text-lime-700" />
              <h2 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider">
                Knowledge Graph Engine
              </h2>
            </div>
            <button 
              onClick={fetchGraphData}
              title="Refresh Graph"
              className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* DOCUMENT SELECTOR ("Choose Whose Graph to View") */}
          <div className="space-y-1.5 bg-lime-50/70 p-3 rounded-2xl border border-lime-200 shadow-inner">
            <label className="text-[10px] font-black uppercase text-lime-900 tracking-wider flex items-center gap-1.5">
              <FileText size={13} className="text-lime-700" />
              Choose Document Target
            </label>
            <div className="relative">
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full bg-white border border-lime-300 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-zinc-950 focus:outline-none focus:border-zinc-950 cursor-pointer appearance-none shadow-sm"
              >
                <option value="all">🌐 All Ingested Documents (Full Graph)</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    📄 {doc.filename} ({doc.source_type?.toUpperCase() || 'FILE'})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3 text-zinc-500 pointer-events-none" />
            </div>
            <p className="text-[10px] text-lime-800 font-medium leading-relaxed">
              Filters extracted entities & relationships specific to the chosen document.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entities, tags, or specs..."
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-950"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-900"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Entity Category Checkboxes */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Entity Classes</span>

            <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-50 transition">
              <input 
                type="checkbox" 
                checked={filterEquipment}
                onChange={(e) => setFilterEquipment(e.target.checked)}
                className="rounded text-emerald-600 focus:ring-0" 
              />
              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
              <span>Equipment Assets</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-50 transition">
              <input 
                type="checkbox" 
                checked={filterParameters}
                onChange={(e) => setFilterParameters(e.target.checked)}
                className="rounded text-cyan-500 focus:ring-0" 
              />
              <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm" />
              <span>Operating Parameters</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-50 transition">
              <input 
                type="checkbox" 
                checked={filterStandards}
                onChange={(e) => setFilterStandards(e.target.checked)}
                className="rounded text-amber-600 focus:ring-0" 
              />
              <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
              <span>Regulatory Standards</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-50 transition">
              <input 
                type="checkbox" 
                checked={filterFacts}
                onChange={(e) => setFilterFacts(e.target.checked)}
                className="rounded text-lime-600 focus:ring-0" 
              />
              <span className="w-3 h-3 rounded-full bg-lime-500 shadow-sm" />
              <span>Document Specs & SOPs</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-50 transition">
              <input 
                type="checkbox" 
                checked={filterPersonnel}
                onChange={(e) => setFilterPersonnel(e.target.checked)}
                className="rounded text-rose-600 focus:ring-0" 
              />
              <span className="w-3 h-3 rounded-full bg-rose-400 shadow-sm" />
              <span>Technicians & Staff</span>
            </label>

            <label className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 cursor-pointer p-1.5 rounded-lg hover:bg-zinc-50 transition">
              <input 
                type="checkbox" 
                checked={filterWorkOrders}
                onChange={(e) => setFilterWorkOrders(e.target.checked)}
                className="rounded text-sky-600 focus:ring-0" 
              />
              <span className="w-3 h-3 rounded-full bg-sky-500 shadow-sm" />
              <span>Work Orders & PM Logs</span>
            </label>
          </div>
        </div>

        {/* Legend Footer */}
        <div className="p-3.5 rounded-xl bg-zinc-950 text-white space-y-2 border border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-lime-400 uppercase tracking-widest">Active Topology</span>
            <span className="text-[10px] font-extrabold text-zinc-400">{visibleNodes.length} Nodes | {visibleLinks.length} Edges</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-snug">
            Global mouseup sync active. User-dragged positions strictly preserved.
          </p>
        </div>
      </aside>

      {/* Main Canvas Container (Fixed 100% Width Layout) */}
      <div className="flex-1 bg-zinc-950 rounded-2xl relative border border-zinc-800 shadow-2xl overflow-hidden flex flex-col justify-between p-4 select-none">
        
        {/* Canvas Top Header Controls & Active Selection Banner */}
        <div className="flex items-center justify-between z-20 pointer-events-none">
          <div className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur border border-zinc-800 px-3.5 py-2 rounded-xl text-white text-xs font-extrabold shadow-lg pointer-events-auto">
            <Network size={16} className="text-lime-400 animate-pulse" />
            <span className="text-lime-300">Target Document:</span>
            <span className="text-zinc-200 font-mono text-[11px] truncate max-w-md">{activeDocLabel}</span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur border border-zinc-800 p-1.5 rounded-xl shadow-lg pointer-events-auto">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z * 1.15))}
              title="Zoom In"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z * 0.85))}
              title="Zoom Out"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              title="Reset View"
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition text-[10px] font-bold px-2"
            >
              Reset View
            </button>
          </div>
        </div>

        {/* Empty State Overlay */}
        {visibleNodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-20 pointer-events-auto bg-zinc-950/80 backdrop-blur-sm">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 text-zinc-500 shadow-xl">
              <Network size={28} className="text-zinc-600" />
            </div>
            <h3 className="text-sm font-extrabold text-white">No Graph Nodes for Selected Filter</h3>
            <p className="text-xs text-zinc-400 max-w-sm mt-1 font-medium leading-relaxed">
              No active nodes match your target document or category filters. Select "All Ingested Documents" or upload files in the Knowledge Ingestion Portal.
            </p>
            <Link
              href="/app/knowledge/ingest"
              className="mt-4 px-4 py-2.5 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-lg transition"
            >
              Open Ingestion Portal
            </Link>
          </div>
        )}

        {/* SVG Network Graph Canvas */}
        <svg
          id="graph-bg"
          ref={svgRef}
          onMouseDown={handleMouseDownSvg}
          onMouseMove={handleMouseMoveSvg}
          onMouseUp={handleMouseUpSvg}
          onWheel={handleWheelSvg}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-10"
        >
          {/* Arrowhead Definitions */}
          <defs>
            <marker
              id="arrow-emerald"
              viewBox="0 0 10 10"
              refX="38"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
            </marker>

            <marker
              id="arrow-cyan"
              viewBox="0 0 10 10"
              refX="38"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
            </marker>

            <marker
              id="arrow-amber"
              viewBox="0 0 10 10"
              refX="38"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>

            <marker
              id="arrow-rose"
              viewBox="0 0 10 10"
              refX="38"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
            </marker>
          </defs>

          {/* Transformed Group containing Links & Nodes */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            
            {/* 1. Render Curved Bezier Connections with Dynamic Arc Curvatures to Prevent Line Overlap */}
            {visibleLinks.map((link) => {
              const srcNode = nodeMap.get(link.source);
              const tgtNode = nodeMap.get(link.target);

              if (!srcNode || !tgtNode) return null;

              const pairMeta = pairLinkCounts.get(link.id) || { total: 1, index: 0 };
              const arcOffset = (pairMeta.index - (pairMeta.total - 1) / 2) * 35;

              // Compute smooth cubic Bezier curve with perpendicular offset
              const dx = tgtNode.x - srcNode.x;
              const dy = tgtNode.y - srcNode.y;
              const dist = Math.hypot(dx, dy) || 1;
              const nx = -dy / dist;
              const ny = dx / dist;

              const cx1 = srcNode.x + dx * 0.4 + nx * arcOffset;
              const cy1 = srcNode.y + dy * 0.1 + ny * arcOffset;
              const cx2 = srcNode.x + dx * 0.6 + nx * arcOffset;
              const cy2 = tgtNode.y - dy * 0.1 + ny * arcOffset;

              const pathData = `M ${srcNode.x} ${srcNode.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tgtNode.x} ${tgtNode.y}`;

              // Midpoint calculation for label placement along arc
              const midX = srcNode.x + dx * 0.5 + nx * (arcOffset * 0.75);
              const midY = (srcNode.y + tgtNode.y) / 2 - 12 + ny * (arcOffset * 0.75);

              // Marker theme based on link type
              let markerId = "arrow-emerald";
              let strokeColor = "#10b981";
              if (link.type.includes("PARAM") || link.type.includes("BELONGS")) {
                markerId = "arrow-cyan";
                strokeColor = "#06b6d4";
              } else if (link.type.includes("REG") || link.type.includes("GOVERN")) {
                markerId = "arrow-amber";
                strokeColor = "#f59e0b";
              } else if (link.type.includes("PERFORMED") || link.type.includes("WORK")) {
                markerId = "arrow-rose";
                strokeColor = "#f43f5e";
              }

              return (
                <g key={link.id}>
                  {/* Outer Glow Path */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="3.5"
                    strokeOpacity="0.2"
                  />
                  {/* Main Directional Vector Path */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2"
                    strokeDasharray={link.type.includes('REG') ? '5,5' : 'none'}
                    markerEnd={`url(#${markerId})`}
                  />

                  {/* Non-Overlapping Midpoint Pill Badge */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-48"
                      y="-10"
                      width="96"
                      height="20"
                      rx="10"
                      fill="#09090b"
                      stroke={strokeColor}
                      strokeWidth="1.2"
                      className="shadow-2xl"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="8.5"
                      fontWeight="900"
                      letterSpacing="0.5"
                    >
                      {link.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 2. Render Node Cards with Synchronized Dropoff and Stationary Position Memory */}
            {visibleNodes.map((n) => {
              const theme = getNodeTheme(n.type);
              const isSelected = selectedNode?.id === n.id;
              const isBeingDragged = dragNodeId === n.id;

              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragNodeId(n.id);
                    dragStartPos.current = { x: e.clientX, y: e.clientY };
                  }}
                  onMouseUp={(e) => {
                    const distMoved = Math.hypot(e.clientX - dragStartPos.current.x, e.clientY - dragStartPos.current.y);
                    setDragNodeId(null);
                    // ONLY open inspector form if user clicked without dragging AND permission checkbox is checked
                    if (distMoved < 5 && allowAutoInspector) {
                      setSelectedNode(n);
                    }
                  }}
                  className={`cursor-grab active:cursor-grabbing ${isBeingDragged ? 'scale-105 select-none' : 'hover:scale-105'}`}
                >
                  {/* Selection Ring */}
                  {isSelected && (
                    <circle
                      r="48"
                      fill="none"
                      stroke="#a3e635"
                      strokeWidth="2.5"
                      strokeDasharray="4,4"
                      className="animate-spin"
                    />
                  )}

                  {/* Node Background Halo */}
                  <circle
                    r="34"
                    fill={theme.accent}
                    fillOpacity="0.12"
                  />

                  {/* Node Card Container */}
                  <foreignObject x="-85" y="-30" width="170" height="60" className="overflow-visible">
                    <div
                      className={`w-[170px] p-2 rounded-2xl ${theme.bg} border ${
                        isSelected ? 'border-lime-400 ring-2 ring-lime-400/40 shadow-[0_0_25px_rgba(163,230,53,0.4)]' : theme.border
                      } ${theme.glow} text-white shadow-2xl flex items-center justify-between`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0 shadow-inner">
                          {theme.icon}
                        </div>

                        <div className="overflow-hidden space-y-0.5">
                          <span className="text-[8px] font-black uppercase text-zinc-400 tracking-wider block truncate">
                            {n.type}
                          </span>
                          <h4 className="text-[11px] font-extrabold text-white leading-tight truncate">
                            {n.label}
                          </h4>
                        </div>
                      </div>

                      {/* Manual Inspect Trigger Icon */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(n);
                        }}
                        title="Inspect Entity Details"
                        className="p-1 rounded-lg bg-zinc-800 hover:bg-lime-400 hover:text-zinc-950 text-zinc-300 transition flex-shrink-0"
                      >
                        <Info size={12} />
                      </button>
                    </div>
                  </foreignObject>
                </g>
              );
            })}

          </g>
        </svg>

        {/* Canvas Bottom Diagnostics Bar */}
        <div className="flex items-center justify-between z-20 pointer-events-none">
          <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-xl shadow-lg pointer-events-auto">
            <span className="flex items-center gap-1 text-lime-400 font-bold">
              <Sparkles size={12} /> Synchronized Dropoff & Position Memory: Active
            </span>
            <span>| Zoom: {Math.round(zoom * 100)}%</span>
            <span>| Position: ({Math.round(pan.x)}, {Math.round(pan.y)})</span>
          </div>
        </div>

        {/* FLOATING OVERLAY INSPECTOR DRAWER (Does NOT shift canvas or move nodes when opened) */}
        {selectedNode && (
          <aside className="absolute top-4 right-4 bottom-4 w-80 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-2xl p-5 shadow-2xl flex flex-col justify-between flex-shrink-0 space-y-4 animate-in slide-in-from-right-4 duration-200 z-30 pointer-events-auto">
            <div className="space-y-4 overflow-y-auto pr-1">
              
              {/* Inspector Header */}
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-lime-700" />
                  <h3 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider">
                    Knowledge Entity Inspector
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedNode(null)}
                  className="text-zinc-400 hover:text-zinc-950 p-1 rounded-lg hover:bg-zinc-100 transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Entity Summary */}
              <div className="space-y-3">
                <div>
                  <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest block mb-0.5">
                    Entity Label ({selectedNode.type.toUpperCase()})
                  </span>
                  <h4 className="text-base font-black text-zinc-950 leading-snug">{selectedNode.label}</h4>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
                  {selectedNode.metadata.tag && (
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 block uppercase">Asset Tag / ID</span>
                      <span className="px-2 py-0.5 rounded bg-zinc-200 text-zinc-900 text-xs font-extrabold font-mono inline-block">
                        {selectedNode.metadata.tag}
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 block uppercase">Description & Context</span>
                    <p className="text-xs font-semibold text-zinc-800 leading-relaxed">
                      {selectedNode.metadata.description}
                    </p>
                  </div>

                  {selectedNode.metadata.limit && (
                    <div>
                      <span className="text-[10px] font-bold text-amber-700 block uppercase">Operational Limits & Specs</span>
                      <p className="text-xs font-extrabold text-amber-900 bg-amber-50 p-2 rounded-xl border border-amber-200 leading-normal">
                        {selectedNode.metadata.limit}
                      </p>
                    </div>
                  )}

                  {selectedNode.metadata.status && (
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 block uppercase">Current Status</span>
                      <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1.5 pt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {selectedNode.metadata.status}
                      </span>
                    </div>
                  )}
                </div>

                {selectedNode.metadata.sourceDoc && (
                  <div className="p-3 rounded-2xl bg-lime-50 border border-lime-200 space-y-1">
                    <span className="text-[10px] font-extrabold text-lime-900 uppercase tracking-wider block flex items-center gap-1">
                      <ExternalLink size={12} /> Citation Source Reference
                    </span>
                    <p className="text-xs font-bold text-zinc-900 font-mono">
                      {selectedNode.metadata.sourceDoc}
                    </p>
                  </div>
                )}
              </div>

            </div>

            {/* Direct Action Button */}
            <div className="pt-2 border-t border-zinc-100">
              <Link
                href="/app/copilot"
                className="w-full py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition hover:scale-[1.02]"
              >
                <Zap size={14} className="text-lime-400" />
                Query Entity in Copilot
              </Link>
            </div>
          </aside>
        )}

      </div>

    </div>
  );
}
