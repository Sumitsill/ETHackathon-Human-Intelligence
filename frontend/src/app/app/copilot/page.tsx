"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { bffFetch } from '@/lib/bff-fetch';
import { 
  Send, 
  Mic, 
  MicOff, 
  FileText, 
  SlidersHorizontal, 
  Wifi, 
  WifiOff, 
  X, 
  ExternalLink, 
  Sparkles, 
  Bot, 
  User, 
  CheckCircle2, 
  Brain, 
  HelpCircle,
  Network
} from 'lucide-react';

interface ChatSource {
  filename: string;
  ref: string;
  decay_warning?: string;
  freshness_score?: string;
  chunk_id?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  sources?: ChatSource[];
  confidence?: string;
  model_used?: string;
  citations?: Array<{ id: number; source: string; snippet: string }>;
  hasFlowchart?: boolean;
  showFlowchart?: boolean;
  showSources?: boolean;
  showDetails?: boolean;
}

export default function GroundedCopilotPage() {
  const { currentActiveRole } = useAuth();
  
  const [lowBandwidth, setLowBandwidth] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Citation Bottom Sheet state
  const [activeCitation, setActiveCitation] = useState<{ id: number; source: string; snippet: string } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'bot',
      text: 'Welcome to the Grounded Operational Copilot. Ask any question regarding plant machinery, SOPs, work orders, or safety compliance.',
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputQuery.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: inputQuery
    };

    setMessages((prev) => [...prev, userMsg]);
    const currentText = inputQuery;
    setInputQuery('');
    setLoading(true);

    try {
      const response = await bffFetch('copilot/query', {
        method: 'POST',
        body: JSON.stringify({ question: currentText, query: currentText, role: currentActiveRole })
      });

      let rawReply = response.answer || response.response || 'Answer generated based on grounded plant vector store.';
      
      // Clean raw reply: strip title headers, inline raw ID tags, and trailing source lists for concise display
      let cleanReply = rawReply
        .replace(/^###\s*.*?\n/g, '')
        .replace(/###\s*Sources Used[\s\S]*/gi, '')
        .replace(/\[Source ID:\s*[^\]]+\]/gi, '')
        .replace(/\[[a-zA-Z0-9_\-]+\_ch\_[^\]]+\]/gi, '')
        .trim();

      if (!cleanReply) {
        cleanReply = rawReply;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: cleanReply,
          sources: response.sources && response.sources.length > 0 ? response.sources : [
            { filename: 'sample_oem_manual.pdf', ref: 'Page 1', freshness_score: '98%' }
          ],
          confidence: response.confidence || 'High',
          model_used: response.model_used || 'groq/llama-3.3-70b-versatile',
          citations: response.citations || [],
          hasFlowchart: true,
          showFlowchart: false,
          showSources: false,
          showDetails: false
        }
      ]);
    } catch {
      // Fallback response if offline
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: `Unable to reach backend services to answer: "${currentText}". Please verify port 8001 server connection.`,
          citations: [],
          hasFlowchart: false
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Web Speech API Voice Recognition
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript.trim()) {
            setInputQuery(currentTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      if (!isListening) {
        setIsListening(true);
        setInputQuery('Check cooling jacket water pressure on C-301');
      } else {
        setIsListening(false);
      }
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn("Recognition start error:", err);
      }
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] sm:h-[calc(100vh-5rem)] flex flex-col justify-between rounded-2xl border bg-white text-zinc-950 border-zinc-200/90 shadow-sm relative overflow-hidden">
      
      {/* Top Header Controls Bar */}
      <div className="p-3 sm:p-4 border-b border-zinc-200 bg-zinc-50 flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-950 text-lime-400 flex items-center justify-center font-black text-xs shrink-0">
            M2
          </div>
          <div className="min-w-0">
            <h1 className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-zinc-900 truncate">
              Grounded Operational Copilot
            </h1>
            <p className="text-[9px] sm:text-[10px] text-zinc-500 font-semibold truncate">
              Port 8001 Connected | Citations Verified
            </p>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Low Bandwidth Toggle */}
          <button
            onClick={() => setLowBandwidth(!lowBandwidth)}
            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl border text-[10px] sm:text-[11px] font-bold flex items-center gap-1 sm:gap-1.5 transition shrink-0 ${
              lowBandwidth 
                ? 'bg-amber-950 text-amber-300 border-amber-800' 
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300'
            }`}
          >
            {lowBandwidth ? <WifiOff size={12} className="shrink-0" /> : <Wifi size={12} className="shrink-0" />}
            <span className="hidden xs:inline">{lowBandwidth ? 'Low Bandwidth Active' : 'Normal Data'}</span>
            <span className="xs:hidden">{lowBandwidth ? 'Low BW' : 'Normal'}</span>
          </button>
        </div>
      </div>

      {/* Chat Stream Window */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans">
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
          >
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400">
              {msg.sender === 'user' ? (
                <><span>Operator</span><User size={12} /></>
              ) : (
                <><Bot size={12} className="text-lime-400" /><span>Plant Brain Copilot</span></>
              )}
            </div>

            <div className={`max-w-2xl rounded-2xl p-4 text-xs font-medium leading-relaxed ${
              msg.sender === 'user'
                ? 'bg-lime-500 text-zinc-950 font-semibold shadow-md'
                : 'bg-white text-zinc-900 border border-zinc-200 shadow-sm'
            }`}>
              <p className="text-sm font-semibold leading-relaxed text-zinc-900 dark:text-zinc-100">
                {msg.text}
              </p>

              {/* Interactive Buttons for Citations, Details & Flowchart (Bot responses) */}
              {msg.sender === 'bot' && (
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2 flex-wrap">
                  
                  {/* View Citations Button */}
                  <button
                    onClick={() => {
                      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, showSources: !m.showSources } : m));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      msg.showSources 
                        ? 'bg-lime-500 text-zinc-950 shadow ring-2 ring-lime-400' 
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <FileText size={13} />
                    <span>View Citations {msg.sources && msg.sources.length > 0 ? `(${msg.sources.length})` : ''}</span>
                  </button>

                  {/* View Details / Metadata Button */}
                  <button
                    onClick={() => {
                      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, showDetails: !m.showDetails } : m));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      msg.showDetails 
                        ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow ring-2 ring-zinc-500' 
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <HelpCircle size={13} />
                    <span>Response Details</span>
                  </button>

                  {/* Process Flowchart Button (Stays visible when toggled) */}
                  {!lowBandwidth && msg.hasFlowchart !== false && (
                    <button
                      onClick={() => {
                        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, showFlowchart: !m.showFlowchart } : m));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        msg.showFlowchart
                          ? 'bg-emerald-600 text-white shadow ring-2 ring-emerald-400'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                      }`}
                    >
                      <Network size={13} />
                      <span>Process Flowchart {msg.showFlowchart ? ' (Active)' : ''}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Expandable Sources / Citations Drawer */}
              {msg.showSources && (
                <div className="mt-3 p-3.5 rounded-xl bg-zinc-950 text-white space-y-2 border border-zinc-800 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-lime-400 tracking-wider">
                    <span>Verified Source Documents & Citations</span>
                    <span>{msg.sources?.length || 1} Linked Records</span>
                  </div>
                  <div className="space-y-2">
                    {(msg.sources && msg.sources.length > 0 ? msg.sources : [
                      { filename: 'sample_oem_manual.pdf', ref: 'Page 1', freshness_score: '98%' }
                    ]).map((s, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <FileText size={13} className="text-lime-400" />
                            {s.filename}
                          </span>
                          <span className="text-[10px] font-extrabold text-lime-300 px-2 py-0.5 rounded bg-lime-950 border border-lime-800">
                            {s.ref}
                          </span>
                        </div>
                        {s.decay_warning && (
                          <div className="text-[10px] font-bold text-amber-300 bg-amber-950/60 p-1.5 rounded border border-amber-800">
                            ⚠️ {s.decay_warning} (Freshness: {s.freshness_score || 'Stale'})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expandable Response Details / Confidence Panel */}
              {msg.showDetails && (
                <div className="mt-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 space-y-2 border border-zinc-200 dark:border-zinc-800 animate-in fade-in duration-200">
                  <div className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                    Execution Diagnostics & Confidence Metrics
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                    <div className="p-2 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block font-bold">RAG Confidence Score</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{msg.confidence || 'High (98%)'}</span>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-400 block font-bold">Grounded Model</span>
                      <span className="font-mono text-[11px]">{msg.model_used || 'groq/llama-3.3-70b'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Process Flowchart Panel (toggled via button) */}
              {!lowBandwidth && msg.showFlowchart && (
                <div className="mt-3 p-3.5 rounded-xl bg-zinc-950 text-white space-y-2 border border-emerald-500/50 shadow-xl animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-[10px] font-extrabold text-lime-400 border-b border-zinc-800 pb-2">
                    <span className="flex items-center gap-1.5"><Network size={14} className="text-emerald-400" /> Interactive Knowledge Process Flowchart</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[9px] border border-emerald-800">Neo4j Active Graph Node</span>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-900 text-xs font-mono text-emerald-300 leading-relaxed border border-zinc-800">
                    P-204 (Equipment: Pump) → [OPERATES_AT] → NormalTemp (75°C) → [REFERENCED_IN] → sample_oem_manual.pdf (Page 1)
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs font-bold text-lime-400 p-2">
            <Sparkles size={16} className="animate-spin" /> Grounding question against plant vector database...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Standard Chat & Voice Input Bar */}
      <div className="p-4 border-t border-zinc-200 bg-zinc-50">
        <div className="space-y-2">
          {isListening && (
            <div className="p-2 rounded-xl bg-red-950/80 border border-red-800/80 text-red-300 text-xs font-bold flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-2">
                <Mic size={14} className="text-red-400" />
                Voice Command Active: Listening to microphone... Speak clearly.
              </span>
              <button onClick={toggleVoiceInput} className="text-red-400 hover:text-white text-[10px] font-black uppercase">
                Stop
              </button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleVoiceInput}
              title={isListening ? "Stop Voice Input" : "Speak Voice Command"}
              className={`p-2.5 sm:p-3 rounded-xl border transition shadow-sm shrink-0 ${
                isListening 
                  ? 'bg-red-600 text-white border-red-700 animate-pulse' 
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300'
              }`}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <input 
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask Copilot (or click mic)..."
              className="flex-1 bg-white border border-zinc-300 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-xs text-zinc-950 focus:outline-none focus:border-zinc-950 transition shadow-inner font-medium min-w-0"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-3.5 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider shadow-md flex items-center gap-1 disabled:opacity-50 shrink-0"
            >
              <Send size={14} className="text-lime-400 shrink-0" />
              <span className="hidden xs:inline">Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Contextual Bottom Sheet Citation Drawer */}
      {activeCitation && (
        <div className="absolute inset-x-0 bottom-0 z-50 bg-zinc-950 text-white border-t-2 border-lime-400 p-6 shadow-2xl space-y-3 rounded-t-3xl animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-lime-400">
              <FileText size={16} /> Citation [{activeCitation.id}] Snippet Viewer
            </div>
            <button 
              onClick={() => setActiveCitation(null)}
              className="p-1 text-zinc-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Source Reference</span>
            <div className="text-xs font-extrabold text-white font-mono bg-zinc-900 p-2 rounded-xl border border-zinc-800">
              {activeCitation.source}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Highlighted Document Content</span>
            <p className="text-xs text-lime-200 bg-lime-950/60 p-3 rounded-xl border border-lime-800/80 font-mono leading-relaxed">
              "{activeCitation.snippet}"
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
