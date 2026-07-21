"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { bffFetch } from '@/lib/bff-fetch';
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
  Clock,
  Gauge,
  Sliders,
  Radio,
  TrendingUp,
  Cpu,
  RefreshCw
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
  const [selectedAsset, setSelectedAsset] = useState<string>('P-204');

  // Real-time Telemetry Waveform State
  const [telemetryData, setTelemetryData] = useState<number[]>([
    4.2, 4.5, 4.8, 5.1, 5.4, 6.0, 7.5, 9.2, 12.4, 11.8, 8.9, 7.2, 6.5, 5.8, 6.2, 8.4, 10.9, 13.1, 11.2, 8.7
  ]);
  const [vibrationThreshold, setVibrationThreshold] = useState<number>(10.0);
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [selectedSensor, setSelectedSensor] = useState<string>('VIB-ACCEL-01');

  // Computed Sensor Metrics
  const currentReading = telemetryData[telemetryData.length - 1] || 6.5;
  const peakReading = Math.max(...telemetryData);
  const avgReading = (telemetryData.reduce((a, b) => a + b, 0) / telemetryData.length).toFixed(1);
  const isThresholdExceeded = currentReading >= vibrationThreshold || peakReading >= vibrationThreshold;

  // Live 1-Second Sensor Ticker
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      setTelemetryData((prev) => {
        const last = prev[prev.length - 1] || 6.5;
        // Generate realistic industrial vibration fluctuation
        const isSpike = Math.random() < 0.2;
        const delta = isSpike ? (Math.random() * 3.5) : ((Math.random() - 0.48) * 1.8);
        const newReading = parseFloat(Math.min(16.0, Math.max(2.0, last + delta)).toFixed(1));
        return [...prev.slice(1), newReading];
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  // Default 5-Why RCA Trees by Asset
  const sampleRcaTrees: Record<string, RcaNode> = {
    'P-204': {
      id: 'node-root-p204',
      label: 'P-204 Centrifugal Pump High Vibration & Seal Overheat Trip',
      category: 'Observed Symptom',
      detail: 'Pump P-204 experienced discharge pressure fluctuation and bearing thermal alert at 75°C.',
      expanded: true,
      children: [
        {
          id: 'node-why1-p204',
          label: 'Why 1: Mechanical seal face temperature exceeded 75°C limit',
          category: 'Direct Physical Cause',
          detail: 'Cooling jacket flush temperature spiked due to reduced coolant circulation rate.',
          expanded: true,
          children: [
            {
              id: 'node-why2-p204',
              label: 'Why 2: Cooling jacket flush fluid flow dropped below 2.5 L/min',
              category: 'Sub-System Cause',
              detail: 'Flow rate restriction detected at suction strainer inlet port.',
              expanded: true,
              children: [
                {
                  id: 'node-why3-p204',
                  label: 'Why 3: Suction strainer mesh clogged with particulate debris',
                  category: 'Root Cause',
                  detail: 'Heavy particulate accumulation restricted flush fluid throughput.',
                  expanded: true,
                  children: [
                    {
                      id: 'node-why4-p204',
                      label: 'Why 4: Biannual strainer maintenance interval exceeded standard (OISD-117)',
                      category: 'Root Administrative Cause',
                      detail: 'Preventive maintenance schedule deferred past 180-day mandatory threshold.',
                      expanded: true
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    'C-301': {
      id: 'node-root-c301',
      label: 'C-301 Hydrocracker Compressor Thermal Overload',
      category: 'Observed Symptom',
      detail: 'High pressure gas recirculation compressor thermal trip at 140°C.',
      expanded: true,
      children: [
        {
          id: 'node-why1-c301',
          label: 'Why 1: Cylinder discharge gas temperature exceeded 140°C limit',
          category: 'Direct Physical Cause',
          detail: 'Interstage gas cooling efficiency degraded under peak load.',
          expanded: true,
          children: [
            {
              id: 'node-why2-c301',
              label: 'Why 2: Intercooler heat exchanger tube fouling',
              category: 'Root Cause',
              detail: 'Scaling deposit buildup reduced heat transfer coefficient.',
              expanded: true
            }
          ]
        }
      ]
    },
    'Generator-3': {
      id: 'node-root-gen3',
      label: 'Generator-3 Diesel Engine Exciter Winding Temperature Alert',
      category: 'Observed Symptom',
      detail: 'Stator temperature sensor trigger on Emergency Diesel Generator 3.',
      expanded: true,
      children: [
        {
          id: 'node-why1-gen3',
          label: 'Why 1: Alternator stator winding insulation resistance drift',
          category: 'Direct Physical Cause',
          detail: 'Cooling fan duct dust buildup reduced alternator ventilation.',
          expanded: true
        }
      ]
    }
  };

  // Sample Historical Work Orders
  const sampleWorkOrders: Record<string, { wo: string; date: string; component: string; tech: string; status: string }[]> = {
    'P-204': [
      { wo: 'WO-8841', date: '2026-06-15', component: 'Mechanical Seal Assembly', tech: 'R. Sharma', status: 'Completed' },
      { wo: 'WO-9872', date: '2026-07-02', component: 'Suction Strainer Flush', tech: 'A. Gupta', status: 'Validated' },
      { wo: 'WO-6012', date: '2026-07-10', component: 'Vibration Accelerometer Calibration', tech: 'S. Singh', status: 'Completed' },
      { wo: 'WO-3104', date: '2026-07-18', component: 'Bearing Oil Flush & Replacement', tech: 'R. Sharma', status: 'In Progress' }
    ],
    'C-301': [
      { wo: 'WO-7712', date: '2026-05-20', component: 'Reciprocating Valve Plate', tech: 'M. Patel', status: 'Completed' },
      { wo: 'WO-8910', date: '2026-06-28', component: 'Intercooler Heat Exchanger Cleaning', tech: 'A. Gupta', status: 'Validated' }
    ],
    'Generator-3': [
      { wo: 'WO-5541', date: '2026-04-12', component: 'Stator Insulation Resistance Survey', tech: 'S. Singh', status: 'Completed' },
      { wo: 'WO-6630', date: '2026-06-01', component: 'Cooling Duct Cleanout & Filter Swap', tech: 'R. Sharma', status: 'Completed' }
    ]
  };

  // Interactive 5-Why Tree State
  const [rcaTree, setRcaTree] = useState<RcaNode | null>(sampleRcaTrees['P-204']);
  const [activeWhyNode, setActiveWhyNode] = useState<RcaNode | null>(sampleRcaTrees['P-204'].children![0]);

  // Historical Work Orders for Right Bottom Pane
  const [workOrders, setWorkOrders] = useState<{ wo: string; date: string; component: string; tech: string; status: string }[]>(sampleWorkOrders['P-204']);

  // Fetch or Load Initial Data on Mount or Asset Selection Change
  useEffect(() => {
    const assetKey = selectedAsset || 'P-204';
    const tree = sampleRcaTrees[assetKey] || sampleRcaTrees['P-204'];
    setRcaTree(tree);
    setActiveWhyNode(tree.children ? tree.children[0] : tree);
    setWorkOrders(sampleWorkOrders[assetKey] || sampleWorkOrders['P-204']);

    // Attempt live API fetch from Module 3 (Port 8002)
    const loadFromBackend = async () => {
      try {
        const res = await bffFetch('maintenance/v1/rca-sessions/start/SESS-9872');
        if (res && res.tree_nodes && res.tree_nodes.length > 0) {
          // Backend session loaded
        }
      } catch {
        // Fallback initialized with rich structured data
      }
    };
    loadFromBackend();
  }, [selectedAsset]);

  const toggleExpandNode = (nodeId: string) => {
    if (!rcaTree) return;
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
                activeWhyNode?.id === n.id
                  ? 'bg-zinc-950 text-white border-zinc-950 shadow-md'
                  : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <GitBranch size={15} className={activeWhyNode?.id === n.id ? 'text-lime-400' : 'text-zinc-500'} />
                <span className="text-xs font-bold">{n.label}</span>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                n.category.includes('Root') 
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

  // SVG Waveform Path & Area Gradient Calculation (Responsive height & padding)
  const svgWaveformPath = useMemo(() => {
    const width = 600;
    const height = 160;
    const step = width / (telemetryData.length - 1);
    const maxVal = 16.0;

    const points = telemetryData.map((val, idx) => {
      const x = idx * step;
      const y = height - (val / maxVal) * (height - 40) - 20;
      return { x, y };
    });

    const pathD = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

    const thresholdY = height - (vibrationThreshold / maxVal) * (height - 40) - 20;

    return { pathD, areaD, thresholdY, points, width, height };
  }, [telemetryData, vibrationThreshold]);

  return (
    <div className="space-y-4 pb-12">
      
      {/* Top Banner: Pattern Mining Alert Box & Asset Target Selector */}
      <div className="bg-amber-500/15 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center font-black flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h2 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
              <span>MIRA Pattern Mining & RCA Workbench</span>
            </h2>
            <p className="text-xs font-bold text-amber-900">
              Pattern Monitoring Active: Real-time telemetry streams, 5-Why root cause trees, and work order cross-reference.
            </p>
          </div>
        </div>

        {/* Asset Selection Dropdown */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-black text-amber-950 uppercase tracking-wider">Target Asset:</span>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="bg-white border border-amber-400 rounded-xl px-3 py-1.5 text-xs font-extrabold text-zinc-950 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-sm"
          >
            <option value="P-204">⚙️ P-204 Centrifugal Pump</option>
            <option value="C-301">🌪️ C-301 Compressor Unit</option>
            <option value="Generator-3">⚡ Generator-3 Emergency Diesel</option>
          </select>
          <Link 
            href="/app/copilot"
            className="px-3.5 py-2 rounded-xl bg-amber-950 text-amber-200 font-extrabold text-xs uppercase hover:bg-zinc-950 transition"
          >
            Open Copilot
          </Link>
        </div>
      </div>

      {/* Split Pane Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Pane: Interactive 5-Why RCA Tree (50% - 6 cols) */}
        <div className="lg:col-span-6 bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-lime-700" />
              <h3 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider">
                Interactive 5-Why Root Cause Tree {selectedAsset ? `(${selectedAsset})` : ''}
              </h3>
            </div>
            <span className="text-[10px] font-bold text-zinc-400">Click node to expand</span>
          </div>

          {!rcaTree || !activeWhyNode ? (
            <div className="p-8 text-center text-zinc-400 text-xs font-bold space-y-2">
              <GitBranch size={28} className="mx-auto text-zinc-300" />
              <p>No active RCA incident session loaded.</p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Right Pane (50% - 6 cols): Top Telemetry Stream + Bottom Work Orders */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Top Right: HIGH-PRECISION REAL-TIME TELEMETRY WAVEFORM STREAM GRAPH */}
          <div className="bg-zinc-950 text-white rounded-2xl p-5 shadow-2xl space-y-4 border border-zinc-800">
            
            {/* Header Controls */}
            <div className="flex flex-wrap items-center justify-between border-b border-zinc-800 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <Activity size={18} className={`text-lime-400 ${isLiveStreaming ? 'animate-pulse' : ''}`} />
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                    <span>Real-time Telemetry Waveform Stream</span>
                    <span className="text-[9px] font-mono font-normal text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                      {selectedAsset} ({selectedSensor})
                    </span>
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-mono">1000ms Live Telemetry Frequency • Vibration Accelerometer (mm/s)</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsLiveStreaming(!isLiveStreaming)}
                  className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase transition border flex items-center gap-1.5 ${
                    isLiveStreaming ? 'bg-lime-400 text-zinc-950 border-lime-400 shadow-[0_0_15px_rgba(163,230,53,0.4)]' : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                  }`}
                >
                  <Radio size={12} className={isLiveStreaming ? "animate-pulse" : ""} />
                  {isLiveStreaming ? '● Live Feed ON' : 'Feed Paused'}
                </button>
                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
                  isThresholdExceeded ? 'text-red-400 bg-red-950/90 border-red-800 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.4)]' : 'text-emerald-400 bg-emerald-950/90 border-emerald-800'
                }`}>
                  <Gauge size={12} />
                  {isThresholdExceeded ? `ALARM: Threshold Exceeded (${vibrationThreshold}mm/s)` : 'Normal (Within Specs)'}
                </span>
              </div>
            </div>

            {/* Sensor Metrics Summary Bar */}
            <div className="grid grid-cols-4 gap-2 text-center bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800 font-mono">
              <div className="border-r border-zinc-800 pr-1">
                <span className="text-[9px] font-bold text-zinc-400 block uppercase">Current RMS</span>
                <span className={`text-xs font-black ${currentReading >= vibrationThreshold ? 'text-red-400' : 'text-lime-400'}`}>
                  {currentReading} mm/s
                </span>
              </div>

              <div className="border-r border-zinc-800 pr-1">
                <span className="text-[9px] font-bold text-zinc-400 block uppercase">Peak Vibration</span>
                <span className={`text-xs font-black ${peakReading >= vibrationThreshold ? 'text-red-400' : 'text-amber-400'}`}>
                  {peakReading} mm/s
                </span>
              </div>

              <div className="border-r border-zinc-800 pr-1">
                <span className="text-[9px] font-bold text-zinc-400 block uppercase">Avg Session</span>
                <span className="text-xs font-black text-cyan-400">{avgReading} mm/s</span>
              </div>

              <div>
                <span className="text-[9px] font-bold text-zinc-400 block uppercase">Red Limit</span>
                <span className="text-xs font-black text-red-400">{vibrationThreshold}.0 mm/s</span>
              </div>
            </div>

            {/* REAL-TIME SVG WAVEFORM GRAPH WITH AREA GRADIENT & INTERACTIVE THRESHOLD LINE */}
            <div className="min-h-[290px] bg-zinc-900/90 rounded-xl p-4 relative border border-zinc-800 flex flex-col justify-between space-y-3">
              
              <div className="w-full h-48 relative">
                <svg 
                  viewBox={`0 0 ${svgWaveformPath.width} ${svgWaveformPath.height}`} 
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    {/* Waveform Fill Gradient */}
                    <linearGradient id="telemetryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isThresholdExceeded ? "#f43f5e" : "#a3e635"} stopOpacity="0.45" />
                      <stop offset="100%" stopColor={isThresholdExceeded ? "#f43f5e" : "#a3e635"} stopOpacity="0.0" />
                    </linearGradient>

                    {/* Red Alert Line Glow */}
                    <filter id="redGlow">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Background Grid Lines */}
                  <line x1="0" y1="30" x2="600" y2="30" stroke="#27272a" strokeDasharray="3,3" strokeWidth="1" />
                  <line x1="0" y1="80" x2="600" y2="80" stroke="#27272a" strokeDasharray="3,3" strokeWidth="1" />
                  <line x1="0" y1="130" x2="600" y2="130" stroke="#27272a" strokeDasharray="3,3" strokeWidth="1" />

                  {/* Semi-Transparent Waveform Area Under Curve */}
                  <path d={svgWaveformPath.areaD} fill="url(#telemetryGradient)" />

                  {/* Main Smooth SVG Line Path */}
                  <path 
                    d={svgWaveformPath.pathD} 
                    fill="none" 
                    stroke={isThresholdExceeded ? "#f43f5e" : "#a3e635"} 
                    strokeWidth="2.5" 
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Red Limit Threshold Line */}
                  <line 
                    x1="0" 
                    y1={svgWaveformPath.thresholdY} 
                    x2="600" 
                    y2={svgWaveformPath.thresholdY} 
                    stroke="#ef4444" 
                    strokeDasharray="5,4" 
                    strokeWidth="2"
                    filter="url(#redGlow)"
                  />

                  {/* Dynamic Data Point Pulsing Circles */}
                  {svgWaveformPath.points.map((pt, idx) => {
                    const val = telemetryData[idx];
                    const isOver = val >= vibrationThreshold;
                    return (
                      <circle
                        key={idx}
                        cx={pt.x}
                        cy={pt.y}
                        r={idx === telemetryData.length - 1 ? 4.5 : 2.5}
                        fill={isOver ? '#f43f5e' : '#a3e635'}
                        className={idx === telemetryData.length - 1 ? 'animate-ping' : ''}
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Threshold Adjuster Slider & Real-time Indicator Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-zinc-400 pt-3 border-t border-zinc-800/80 z-10">
                <div className="flex items-center gap-2">
                  <Sliders size={13} className="text-lime-400" />
                  <span className="text-zinc-200 font-bold">Alarm Threshold:</span>
                  <input 
                    type="range"
                    min="5"
                    max="15"
                    step="0.5"
                    value={vibrationThreshold}
                    onChange={(e) => setVibrationThreshold(parseFloat(e.target.value))}
                    className="w-28 accent-lime-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                  />
                  <span className="text-red-400 font-black">{vibrationThreshold}.0 mm/s</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-300 font-bold">FFT Spectrum: 148.5 Hz (1X RPM)</span>
                </div>
              </div>

            </div>

          </div>

          {/* Bottom Right: Work Order Cross-Reference (25% Height) */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h3 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-zinc-600" />
                Historical Work Order Cross-Reference ({selectedAsset})
              </h3>
              <span className="text-[11px] font-bold text-zinc-500">Asset Tag: {selectedAsset}</span>
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
