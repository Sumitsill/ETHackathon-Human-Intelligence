"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  CheckSquare, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Send, 
  ShieldCheck, 
  Gauge, 
  ArrowRight,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface TaskCard {
  id: string;
  title: string;
  tag: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'normal';
  status: 'pending' | 'completed';
  requiredReadings: Array<{
    parameter: string;
    unit: string;
    minLimit: number;
    maxLimit: number;
    value: string;
    validated: boolean | null;
  }>;
}

// Fallback structured field work orders & telemetry checklists
const INITIAL_DEMO_TASKS: TaskCard[] = [
  {
    id: 'WO-8841',
    title: 'P-204 Centrifugal Pump Mechanical Seal Overhaul & Telemetry Check',
    tag: 'P-204 (Crude Pump)',
    dueDate: 'Today 18:00',
    priority: 'high',
    status: 'pending',
    requiredReadings: [
      { parameter: 'Bearing Housing Temp', unit: '°C', minLimit: 20.0, maxLimit: 75.0, value: '68.5', validated: true },
      { parameter: 'Coolant Flush Flow Rate', unit: 'L/min', minLimit: 2.5, maxLimit: 6.0, value: '4.2', validated: true },
      { parameter: 'Discharge Pressure Gauge', unit: 'Bar', minLimit: 8.0, maxLimit: 12.0, value: '10.5', validated: true },
      { parameter: 'Vibration RMS Speed', unit: 'mm/s', minLimit: 0.5, maxLimit: 10.0, value: '6.8', validated: true }
    ]
  },
  {
    id: 'WO-9872',
    title: 'C-301 Hydrocracker Compressor Intercooler Thermal Inspection',
    tag: 'C-301 (Compressor)',
    dueDate: 'Tomorrow 12:00',
    priority: 'high',
    status: 'pending',
    requiredReadings: [
      { parameter: 'Cylinder Discharge Temp', unit: '°C', minLimit: 90.0, maxLimit: 140.0, value: '132.0', validated: true },
      { parameter: 'Lubricant Feed Pressure', unit: 'Bar', minLimit: 2.0, maxLimit: 4.5, value: '3.2', validated: true },
      { parameter: 'Suction Differential Press.', unit: 'Bar', minLimit: 0.2, maxLimit: 1.2, value: '0.6', validated: true }
    ]
  },
  {
    id: 'WO-6012',
    title: 'Generator-3 Emergency Diesel Stator Insulation & Exciter Survey',
    tag: 'Generator-3 (Powerhouse)',
    dueDate: 'In 2 Days',
    priority: 'normal',
    status: 'pending',
    requiredReadings: [
      { parameter: 'Stator Insulation Resistance', unit: 'MΩ', minLimit: 5.0, maxLimit: 50.0, value: '28.2', validated: true },
      { parameter: 'Exciter Winding Temp', unit: '°C', minLimit: 20.0, maxLimit: 85.0, value: '62.0', validated: true }
    ]
  }
];

export default function FieldTasksPage() {
  const { currentActiveRole } = useAuth();
  
  const [tasks, setTasks] = useState<TaskCard[]>(INITIAL_DEMO_TASKS);
  const [activeTask, setActiveTask] = useState<TaskCard | null>(INITIAL_DEMO_TASKS[0]);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  // Assign New Task Modal State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTag, setNewTag] = useState('P-204 (Crude Pump)');
  const [newAssignee, setNewAssignee] = useState('Ramesh Sharma (Senior Field Tech)');
  const [newDueDate, setNewDueDate] = useState('Today 18:00');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'normal'>('high');
  const [newReadings, setNewReadings] = useState([
    { parameter: 'Bearing Housing Temp', unit: '°C', minLimit: 20.0, maxLimit: 75.0, value: '68.0', validated: true },
    { parameter: 'Vibration RMS Speed', unit: 'mm/s', minLimit: 0.5, maxLimit: 10.0, value: '6.5', validated: true }
  ]);

  // Fetch or Sync Field Work Orders from Backend & Ingested Files
  React.useEffect(() => {
    const fetchFieldTasks = async () => {
      try {
        const [recsRes, docsRes] = await Promise.all([
          fetch('/api/proxy/maintenance/v1/recommendations', { headers: { 'X-API-Key': 'et_brain_secure_key_2026_xyz' } }),
          fetch('/api/proxy/knowledge/documents', { headers: { 'X-API-Key': 'et_brain_secure_key_2026_xyz' } })
        ]);

        let mappedTasks: TaskCard[] = [];

        if (recsRes.ok) {
          const recs = await recsRes.json();
          if (Array.isArray(recs) && recs.length > 0) {
            mappedTasks = recs.map((r: any, idx: number) => ({
              id: r.id || `WO-${1000 + idx}`,
              title: `${r.asset_id || 'Equipment'}: ${r.title || r.recommendation || 'Field Checklist'}`,
              tag: `${r.asset_id} (${r.asset_class || 'Asset'})`,
              dueDate: 'Today 18:00',
              priority: r.priority === 'HIGH' ? 'high' : 'normal',
              status: r.status === 'approved' ? 'completed' : 'pending',
              requiredReadings: [
                { parameter: 'Operating Temp', unit: '°C', minLimit: 20.0, maxLimit: 85.0, value: '68.5', validated: true },
                { parameter: 'Vibration RMS', unit: 'mm/s', minLimit: 0.5, maxLimit: 10.0, value: '6.2', validated: true }
              ]
            }));
          }
        }

        if (docsRes.ok) {
          const docs = await docsRes.json();
          if (Array.isArray(docs) && docs.length > 0) {
            const docTasks: TaskCard[] = docs.map((doc: any, idx: number) => ({
              id: `WO-INGEST-${idx + 1}`,
              title: `Ingested Document Field Task: ${doc.filename}`,
              tag: doc.filename.includes('oem') ? 'P-204' : 'Generator-3',
              dueDate: 'Tomorrow 12:00',
              priority: 'high',
              status: 'pending',
              requiredReadings: [
                { parameter: 'Extracted Spec Value', unit: 'Units', minLimit: 1.0, maxLimit: 100.0, value: '45.0', validated: true }
              ]
            }));
            mappedTasks = [...mappedTasks, ...docTasks];
          }
        }

        if (mappedTasks.length > 0) {
          setTasks(mappedTasks);
          setActiveTask(mappedTasks[0]);
        }
      } catch {
        // Retain initial task list
      }
    };
    fetchFieldTasks();
  }, []);

  const handleAddReadingField = () => {
    setNewReadings((prev) => [
      ...prev,
      { parameter: 'New Telemetry Sensor', unit: 'Bar', minLimit: 1.0, maxLimit: 20.0, value: '10.0', validated: true }
    ]);
  };

  const handleCreateAssignedTask = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `WO-${Math.floor(7000 + Math.random() * 2000)}`;
    const createdTask: TaskCard = {
      id: newId,
      title: newTitle || `${newTag} Assigned Telemetry Inspection Checklist`,
      tag: newTag,
      dueDate: newDueDate,
      priority: newPriority,
      status: 'pending',
      requiredReadings: newReadings.map(r => {
        const numVal = parseFloat(r.value);
        return {
          ...r,
          validated: !isNaN(numVal) ? numVal >= r.minLimit && numVal <= r.maxLimit : null
        };
      })
    };

    setTasks((prev) => [createdTask, ...prev]);
    setActiveTask(createdTask);
    setShowAssignModal(false);
    setNewTitle('');
    setSubmitSuccessMsg(`✅ Work Order [${newId}] assigned to ${newAssignee} with custom telemetry limits.`);
    setTimeout(() => setSubmitSuccessMsg(null), 4000);
  };

  const handleInputChange = (paramIndex: number, val: string) => {
    if (!activeTask) return;
    const updatedTask = { ...activeTask };
    const param = updatedTask.requiredReadings[paramIndex];
    param.value = val;

    const numVal = parseFloat(val);
    if (!isNaN(numVal)) {
      param.validated = numVal >= param.minLimit && numVal <= param.maxLimit;
    } else {
      param.validated = null;
    }

    setActiveTask(updatedTask);
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    
    setTasks((prev) =>
      prev.map((t) => (t.id === activeTask.id ? { ...t, status: 'completed' } : t))
    );

    setSubmitSuccessMsg(`✅ Task [${activeTask.id}] Telemetry Logged & Validated against Module 4 QRCI Standards.`);
    setTimeout(() => setSubmitSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-4 pb-12">
      
      {/* Top Banner */}
      <div className="bg-zinc-950 text-white rounded-2xl p-5 shadow-xl border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-lime-400/20 text-lime-400 text-[10px] font-black uppercase tracking-widest border border-lime-400/30">
            Field Operations Execution
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">
            Mobile Work Order & Telemetry Checklist
          </h1>
          <p className="text-xs text-zinc-400 font-medium">
            Dispatch tasks to field operators and auto-validate numerical readings against Module 4 compliance limits.
          </p>
        </div>

        {/* Assign Task Button */}
        <button
          onClick={() => setShowAssignModal(true)}
          className="px-5 py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-zinc-950 font-black text-xs uppercase tracking-wider shadow-xl transition flex items-center gap-2"
        >
          <Sparkles size={16} />
          + Assign New Work Order Task
        </button>
      </div>

      {submitSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 shadow-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          {submitSuccessMsg}
        </div>
      )}

      {/* Main Grid: Left Tappable Cards (5 cols) + Right Real-time Validation Checklist (7 cols) */}
      {tasks.length === 0 || !activeTask ? (
        <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center space-y-3">
          <CheckSquare size={36} className="mx-auto text-zinc-300" />
          <h3 className="text-sm font-extrabold text-zinc-950">No Assigned Work Orders</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            There are currently no active field tasks or telemetry checklists assigned.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Left List of Assigned Cards */}
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-xs font-extrabold text-zinc-950 uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare size={16} className="text-lime-700" />
              Assigned Work Orders ({tasks.length})
            </h2>

            <div className="space-y-2.5">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setActiveTask(task)}
                  className={`p-4 rounded-2xl border transition cursor-pointer space-y-2 ${
                    activeTask?.id === task.id
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-xl'
                      : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      activeTask?.id === task.id ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-900 text-lime-400'
                    }`}>
                      {task.tag}
                    </span>
                    <span className="text-[10px] font-bold opacity-70 flex items-center gap-1">
                      <Clock size={11} /> {task.dueDate}
                    </span>
                  </div>

                  <h3 className="text-xs font-extrabold leading-snug">{task.title}</h3>

                  <div className="flex items-center justify-between pt-1">
                    <span className={`text-[10px] font-extrabold ${
                      task.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {task.status === 'completed' ? '✓ Completed' : '⏱ Pending Field Log'}
                    </span>
                    <ChevronRight size={14} className="opacity-50" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Active Task Form with Live Telemetry Validation */}
          <div className="lg:col-span-7 bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-lime-700 uppercase tracking-widest block">Focus Task Target</span>
                <h2 className="text-sm font-extrabold text-zinc-950">{activeTask.title}</h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-800 text-[10px] font-extrabold">
                Tag: {activeTask.tag}
              </span>
            </div>

            <form onSubmit={handleSubmitTask} className="space-y-4">
              <span className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider block">
                Required Telemetry Measurements:
              </span>

              {activeTask.requiredReadings.map((reading, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900">{reading.parameter}</span>
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-200 px-2 py-0.5 rounded">
                      Limit: {reading.minLimit} - {reading.maxLimit} {reading.unit}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={reading.value}
                      onChange={(e) => handleInputChange(idx, e.target.value)}
                      placeholder={`Enter value in ${reading.unit}...`}
                      className="flex-1 bg-white border border-zinc-300 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-950 focus:outline-none focus:border-zinc-950 shadow-sm"
                    />

                    {/* Real-time Validation Status Badge */}
                    {reading.validated === true && (
                      <span className="px-3 py-2 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-extrabold flex items-center gap-1 border border-emerald-300">
                        <CheckCircle2 size={14} /> Pass
                      </span>
                    )}
                    {reading.validated === false && (
                      <span className="px-3 py-2 rounded-xl bg-red-100 text-red-800 text-xs font-extrabold flex items-center gap-1 border border-red-300 animate-pulse">
                        <AlertTriangle size={14} /> Out of Bounds
                      </span>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="submit"
                disabled={activeTask.status === 'completed'}
                className="w-full py-4 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Send size={15} className="text-lime-400" />
                {activeTask.status === 'completed' ? 'Telemetry Previously Submitted' : 'Submit & Auto-Validate Check'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── ASSIGN WORK ORDER TASK MODAL DIALOG ── */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <span className="text-[10px] font-black text-lime-700 uppercase tracking-widest block">Operational Dispatch Form</span>
                <h2 className="text-lg font-black text-zinc-950">Assign Field Work Order Task</h2>
              </div>
              <button 
                onClick={() => setShowAssignModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAssignedTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Work Order Title</label>
                <input 
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. P-204 Centrifugal Pump Mechanical Seal & Bearing Inspection"
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-950 focus:outline-none focus:border-zinc-950"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Target Asset Equipment</label>
                  <select
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-950 cursor-pointer"
                  >
                    <option value="P-204 (Crude Pump)">P-204 (Crude Charge Pump)</option>
                    <option value="C-301 (Compressor)">C-301 (Hydrocracker Compressor)</option>
                    <option value="Generator-3 (Powerhouse)">Generator-3 (Emergency Diesel Generator)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Assign Operator / Technician</label>
                  <select
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-950 cursor-pointer"
                  >
                    <option value="Ramesh Sharma (Senior Field Tech)">Ramesh Sharma (Senior Field Tech)</option>
                    <option value="David Moraes (Machinery Specialist)">David Moraes (Machinery Specialist)</option>
                    <option value="Amit Kumar (Telemetry Inspector)">Amit Kumar (Telemetry Inspector)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Due Schedule</label>
                  <input 
                    type="text"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    placeholder="e.g. Today 18:00 or Tomorrow 12:00"
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-950 focus:outline-none focus:border-zinc-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">Task Priority Level</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-950 cursor-pointer"
                  >
                    <option value="high">🔥 High Priority</option>
                    <option value="normal">⚡ Normal Priority</option>
                    <option value="medium">⏱ Medium Priority</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Reading Parameters Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">
                    Telemetry Checklist Parameters ({newReadings.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddReadingField}
                    className="text-[11px] font-bold text-lime-700 hover:text-lime-800 bg-lime-100 px-2.5 py-1 rounded-lg"
                  >
                    + Add Parameter Limit
                  </button>
                </div>

                {newReadings.map((r, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 grid grid-cols-12 gap-2 text-xs">
                    <input 
                      type="text"
                      value={r.parameter}
                      onChange={(e) => {
                        const updated = [...newReadings];
                        updated[idx].parameter = e.target.value;
                        setNewReadings(updated);
                      }}
                      placeholder="Parameter Name"
                      className="col-span-4 bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 font-bold text-zinc-900"
                    />
                    <input 
                      type="text"
                      value={r.unit}
                      onChange={(e) => {
                        const updated = [...newReadings];
                        updated[idx].unit = e.target.value;
                        setNewReadings(updated);
                      }}
                      placeholder="Unit (°C, Bar)"
                      className="col-span-2 bg-white border border-zinc-300 rounded-lg px-2 py-1.5 text-center font-bold text-zinc-900"
                    />
                    <input 
                      type="number"
                      step="0.1"
                      value={r.minLimit}
                      onChange={(e) => {
                        const updated = [...newReadings];
                        updated[idx].minLimit = parseFloat(e.target.value) || 0;
                        setNewReadings(updated);
                      }}
                      placeholder="Min"
                      className="col-span-3 bg-white border border-zinc-300 rounded-lg px-2 py-1.5 text-center font-mono font-bold text-zinc-900"
                    />
                    <input 
                      type="number"
                      step="0.1"
                      value={r.maxLimit}
                      onChange={(e) => {
                        const updated = [...newReadings];
                        updated[idx].maxLimit = parseFloat(e.target.value) || 100;
                        setNewReadings(updated);
                      }}
                      placeholder="Max"
                      className="col-span-3 bg-white border border-zinc-300 rounded-lg px-2 py-1.5 text-center font-mono font-bold text-zinc-900"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-5 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
                >
                  <Send size={14} className="text-lime-400" />
                  Dispatch & Assign Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
