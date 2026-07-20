"use client";

import React, { useState } from 'react';
import { bffFetch } from '@/lib/bff-fetch';
import { 
  Bot, 
  Send, 
  User, 
  FileText, 
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface Citation {
  filename: string;
  ref: string;
  decay_warning?: string;
  freshness_score?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  confidence?: string;
  sources?: Citation[];
  modelUsed?: string;
  knowledge_decay_warning?: string;
}

interface Thread {
  id: string;
  title: string;
  date: string;
}

export default function CopilotPage() {
  const [fieldTechMode, setFieldTechMode] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([
    { id: 't-1', title: 'P-204 vibration checks', date: 'Today' },
    { id: 't-2', title: 'ASME compliance gaps', date: 'Yesterday' }
  ]);
  const [activeThreadId, setActiveThreadId] = useState('t-1');
  const [messages, setMessages] = useState<Record<string, Message[]>>({
    't-1': [
      {
        id: 'm-1',
        role: 'assistant',
        text: 'Hello! I am your grounded operational co-pilot. Ask me anything about valve specs, safety limits, or refinery procedures.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ],
    't-2': []
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePreviewDoc, setActivePreviewDoc] = useState<Citation | null>(null);

  const activeMessages = messages[activeThreadId] || [];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] || []), userMessage]
    }));
    
    setInput('');
    setLoading(true);

    try {
      // Query RAG BFF Proxy endpoint with optional Field Tech Mode header
      const headers: Record<string, string> = {};
      if (fieldTechMode) {
        headers['X-Field-Tech-Mode'] = 'true';
      }

      const res = await bffFetch('copilot/query', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ question: input, mode: fieldTechMode ? 'field_tech' : 'standard' })
      });

      const assistantMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: res.confidence || 'High',
        sources: res.sources || [],
        modelUsed: res.model_used || 'llama-3.3-70b-versatile',
        knowledge_decay_warning: res.knowledge_decay_warning
      };

      setMessages(prev => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] || []), assistantMessage]
      }));
    } catch (err: any) {
      console.warn("Copilot API call failed, using fallback:", err.message);
      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        text: `Error connecting to RAG service: ${err.message}. Showing fallback knowledge. Check if backend Module 2 is running on port 8001.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        confidence: 'Low',
        sources: [
          { filename: 'Fallback: SQLite Local Procedures', ref: 'Page 1' }
        ],
        modelUsed: 'local-regex-fallback'
      };
      
      setMessages(prev => ({
        ...prev,
        [activeThreadId]: [...(prev[activeThreadId] || []), errorMessage]
      }));
    } finally {
      setLoading(false);
    }
  };

  const startNewThread = () => {
    const newId = `t-${Date.now()}`;
    const newThread: Thread = {
      id: newId,
      title: 'New grounded thread',
      date: 'Just now'
    };
    setThreads(prev => [newThread, ...prev]);
    setMessages(prev => ({
      ...prev,
      [newId]: [
        {
          id: `m-${Date.now()}`,
          role: 'assistant',
          text: 'Hello! I am your grounded operational co-pilot. Ask me anything about valve specs, safety limits, or refinery procedures.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    }));
    setActiveThreadId(newId);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-[calc(100vh-8rem)] bg-white rounded-[2rem] overflow-hidden border border-zinc-200">
      
      {/* Sidebar Threads Drawer (Clean Light Grey) */}
      <aside className="w-full lg:w-64 border-r border-zinc-200 bg-zinc-50/50 flex flex-col flex-shrink-0 min-h-0">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Chat Threads</span>
          <button 
            onClick={startNewThread}
            className="px-3 py-1.5 bg-[#18181b] hover:bg-zinc-800 rounded-full text-[9px] text-white font-bold transition shadow-sm"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveThreadId(t.id)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                activeThreadId === t.id 
                  ? 'bg-white border-zinc-300 text-zinc-950 font-bold shadow-sm' 
                  : 'border-transparent hover:bg-zinc-100/60 text-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs truncate w-32 block">{t.title}</span>
                <span className="text-[8px] text-zinc-400 font-mono">{t.date}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Conversations Screen */}
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        
        {/* Top Header */}
        <div className="h-14 border-b border-zinc-100 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-lime-300 text-[10px]">🤖</span>
              Grounded AI Copilot Workspace
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFieldTechMode(!fieldTechMode)}
              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border ${
                fieldTechMode
                  ? 'bg-amber-400 text-zinc-950 border-amber-500 shadow-sm'
                  : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200'
              }`}
            >
              📱 {fieldTechMode ? 'Field Tech Mode: ON' : 'Field Tech Mode: OFF'}
            </button>
            <span className="text-[8px] font-bold bg-lime-400/10 text-lime-800 border border-lime-400/25 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Verified citations
            </span>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeMessages.map((m) => (
            <div 
              key={m.id}
              className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role !== 'user' && (
                <div className="w-8 h-8 rounded-full bg-lime-300 border border-lime-400 flex items-center justify-center text-zinc-900 text-xs font-bold shadow-sm">
                  🤖
                </div>
              )}

              <div className={`max-w-xl rounded-2xl p-4 border transition ${
                m.role === 'user' 
                  ? 'bg-[#18181b] border-zinc-700 text-white shadow-sm' 
                  : 'bg-zinc-50 border-zinc-200 text-zinc-800 shadow-sm'
              }`}>
                <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans">{m.text}</p>

                {/* Sources Strip */}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-4 border-t border-zinc-200/80 pt-3">
                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Sources Referenced:</span>
                    <div className="flex flex-wrap gap-2">
                      {m.sources.map((src, i) => (
                        <button
                          key={i}
                          onClick={() => setActivePreviewDoc(src)}
                          className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg text-[9px] text-zinc-700 flex items-center gap-1 transition shadow-sm"
                        >
                          <FileText size={10} className="text-[#10b981]" />
                          <span className="font-semibold">{src.filename.replace('Email: ', '')} ({src.ref})</span>
                          <ExternalLink size={8} className="text-zinc-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grounding and Model Badges */}
                {m.role !== 'user' && m.confidence && (
                  <div className="mt-3 flex items-center gap-4 text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      Confidence:{' '}
                      <span className={`font-bold ${m.confidence === 'High' ? 'text-emerald-600' : (m.confidence === 'Medium' ? 'text-amber-500' : 'text-red-500')}`}>
                        {m.confidence}
                      </span>
                    </span>
                    {m.modelUsed && (
                      <span className="font-mono text-[8px]">Engine: {m.modelUsed}</span>
                    )}
                  </div>
                )}
              </div>

              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-zinc-200 border border-zinc-300 flex items-center justify-center text-zinc-700 text-xs font-bold shadow-sm">
                  👤
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-lime-300 border border-lime-400 flex items-center justify-center text-zinc-900 text-xs font-bold animate-pulse">
                🤖
              </div>
              <div className="max-w-md rounded-2xl p-4 bg-zinc-50 border border-zinc-200">
                <span className="text-xs text-zinc-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
                  Verifying citations and routing query...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
          <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-2">
            <input
              type="text"
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-xs text-zinc-900 focus:outline-none focus:border-zinc-800 transition shadow-sm"
              placeholder="Query torque specs, vibration thresholds, or SOP clearances..."
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 bg-[#18181b] hover:bg-zinc-800 text-white rounded-xl flex items-center justify-center transition shadow-md disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>

      {/* Right Drawer Doc Preview (Highlighting traceable citations) */}
      {activePreviewDoc && (
        <aside className="w-full lg:w-72 border-l border-zinc-200 bg-zinc-50/80 flex flex-col flex-shrink-0 min-h-0">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={14} className="text-[#10b981]" />
              Source Citation
            </span>
            <button 
              onClick={() => setActivePreviewDoc(null)}
              className="text-xs text-zinc-400 hover:text-zinc-900 transition font-bold"
            >
              Close
            </button>
          </div>

          <div className="flex-1 p-5 space-y-4 overflow-y-auto">
            <div>
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Document Name</span>
              <h4 className="text-xs font-bold text-zinc-950 mt-1 leading-snug">
                {activePreviewDoc.filename}
              </h4>
            </div>
            
            <div>
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Location Reference</span>
              <span className="text-xs font-bold text-zinc-800 mt-1 block">
                {activePreviewDoc.ref}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-sm space-y-2">
              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Reference Snippet</span>
              <p className="text-[11px] text-zinc-600 italic leading-relaxed">
                "... verify the downstream piping pressure is below the maximum safety threshold before starting the isolation procedure on Valve V-102. Ensure supervisor notification is logged."
              </p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
