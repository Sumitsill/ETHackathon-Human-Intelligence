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

export default function FieldTasksPage() {
  const { currentActiveRole } = useAuth();
  
  const [tasks, setTasks] = useState<TaskCard[]>([
    {
      id: 'task-101',
      title: 'Biannual Thermal & Vibration Check on P-204',
      tag: 'P-204',
      dueDate: 'Today (20-Jul-2026)',
      priority: 'high',
      status: 'pending',
      requiredReadings: [
        { parameter: 'Discharge Operating Pressure', unit: 'Bar', minLimit: 2.0, maxLimit: 12.0, value: '', validated: null },
        { parameter: 'Bearing Housing Temperature', unit: '°C', minLimit: 30.0, maxLimit: 115.0, value: '', validated: null },
      ]
    },
    {
      id: 'task-102',
      title: 'Visual Seal Inspection & Water Jacket Recirculation',
      tag: 'C-301',
      dueDate: 'Today (20-Jul-2026)',
      priority: 'high',
      status: 'pending',
      requiredReadings: [
        { parameter: 'Cooling Water Flow Rate', unit: 'L/min', minLimit: 45.0, maxLimit: 100.0, value: '', validated: null },
      ]
    },
    {
      id: 'task-103',
      title: 'Static Grounding Resistance Audit',
      tag: 'V-102',
      dueDate: 'Tomorrow',
      priority: 'normal',
      status: 'pending',
      requiredReadings: [
        { parameter: 'Earth Bonding Resistance', unit: 'Ohms', minLimit: 0.1, maxLimit: 10.0, value: '', validated: null },
      ]
    }
  ]);

  const [activeTask, setActiveTask] = useState<TaskCard>(tasks[0]);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  const handleInputChange = (paramIndex: number, val: string) => {
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
            Readings entered by operators auto-validate against Module 4 compliance thresholds in real time.
          </p>
        </div>
      </div>

      {submitSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 shadow-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          {submitSuccessMsg}
        </div>
      )}

      {/* Main Grid: Left Tappable Cards (5 cols) + Right Real-time Validation Checklist (7 cols) */}
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
                  activeTask.id === task.id
                    ? 'bg-zinc-950 text-white border-zinc-950 shadow-xl'
                    : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    activeTask.id === task.id ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-900 text-lime-400'
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

    </div>
  );
}
