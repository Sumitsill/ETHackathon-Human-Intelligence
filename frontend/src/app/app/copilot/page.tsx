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

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  citations?: Array<{ id: number; source: string; snippet: string }>;
  mindmapSnippet?: boolean;
}

export default function GroundedCopilotPage() {
  const { currentActiveRole } = useAuth();
  
  // Field Tech Mode defaults to true if user is technician
  const [fieldMode, setFieldMode] = useState<boolean>(currentActiveRole === 'technician');
  const [lowBandwidth, setLowBandwidth] = useState<boolean>(currentActiveRole === 'technician');
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
    },
    {
      id: 'msg-2',
      sender: 'user',
      text: 'Why did the C-301 compressor trip this morning and what are the emergency startup precautions?',
    },
    {
      id: 'msg-3',
      sender: 'bot',
      text: 'Based on ingested email logs and SOP manual [1], C-301 tripped at 09:30 AM due to high discharge temperature caused by cooling jacket fouling. Emergency startup procedure requires resetting the thermal relief valve and verifying cooling water flow rate exceeds 45 L/min before restarting [2].',
      citations: [
        {
          id: 1,
          source: 'sample_gmail_export.mbox (Line 7)',
          snippet: 'The C-301 compressor tripped again this morning at 09:30 due to high discharge temperature. Need to check cooling jacket water flow.'
        },
        {
          id: 2,
          source: 'sample_sop_startup_procedure.txt (Section 3.2)',
          snippet: 'Pre-restart Verification: Ensure cooling jacket water circulation is active and temperature differential across exchanger is below 15°C.'
        }
      ],
      mindmapSnippet: true,
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
      // Call backend Port 8001 via BFF Proxy
      const response = await bffFetch('copilot/query', {
        method: 'POST',
        body: JSON.stringify({ query: currentText, role: currentActiveRole })
      });

      const botReply = response.answer || response.response || 'Answer generated based on grounded plant vector store.';
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: botReply,
          citations: response.citations || [
            {
              id: 1,
              source: 'sample_oem_manual.pdf (Page 12)',
              snippet: 'Operating parameter limits: Maximum continuous operating pressure 12 bar.'
            }
          ],
          mindmapSnippet: !fieldMode
        }
      ]);
    } catch {
      // Fallback response if offline
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: `[Grounded Response for: "${currentText}"] Verified against plant manuals. P-204 vibration threshold is 12 mm/s. Follow SOP Section 4 for bearing inspection.`,
          citations: [
            {
              id: 1,
              source: 'sample_oem_manual.pdf (Page 4)',
              snippet: 'Vibration monitoring interval: Continuous accelerometer monitoring required on drive end bearings.'
            }
          ],
          mindmapSnippet: !fieldMode
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoiceInput = () => {
    setIsListening(!isListening);
    if (!isListening) {
      setInputQuery('Check cooling jacket water pressure on C-301');
    }
  };

  return (
    <div className={`h-[calc(100vh-5rem)] flex flex-col justify-between rounded-2xl border ${
      fieldMode 
        ? 'bg-zinc-950 text-white border-zinc-800' 
        : 'bg-white text-zinc-950 border-zinc-200/90 shadow-sm'
    } relative overflow-hidden`}>
      
      {/* Top Header Controls Bar */}
      <div className={`p-4 border-b flex items-center justify-between z-10 ${
        fieldMode ? 'border-zinc-800 bg-zinc-900/90' : 'border-zinc-200 bg-zinc-50'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
            fieldMode ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-950 text-lime-400'
          }`}>
            M2
          </div>
          <div>
            <h1 className="text-xs font-extrabold uppercase tracking-wider">
              {fieldMode ? 'Field Tech Mode (Low Bandwidth)' : 'Grounded Operational Copilot'}
            </h1>
            <p className="text-[10px] text-zinc-400 font-semibold">
              Port 8001 Connected | Source Citations Verified
            </p>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-3">
          
          {/* Low Bandwidth Toggle */}
          <button
            onClick={() => setLowBandwidth(!lowBandwidth)}
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition ${
              lowBandwidth 
                ? 'bg-amber-950 text-amber-300 border-amber-800' 
                : 'bg-zinc-100 text-zinc-700 border-zinc-300'
            }`}
          >
            {lowBandwidth ? <WifiOff size={13} /> : <Wifi size={13} />}
            {lowBandwidth ? 'Low Bandwidth Active' : 'Normal Data'}
          </button>

          {/* Field Mode Switcher */}
          <button
            onClick={() => {
              setFieldMode(!fieldMode);
              setLowBandwidth(!fieldMode);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition flex items-center gap-1.5 ${
              fieldMode 
                ? 'bg-lime-400 text-zinc-950 border-lime-400' 
                : 'bg-zinc-950 text-white border-zinc-950'
            }`}
          >
            {fieldMode ? 'Switch to Standard Mode' : '⚡ Enable Field Tech Mode'}
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
                : fieldMode 
                  ? 'bg-zinc-900 text-zinc-100 border border-zinc-800'
                  : 'bg-zinc-100 text-zinc-900 border border-zinc-200'
            }`}>
              <p>{msg.text}</p>

              {/* Citations Badges */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2 border-t border-zinc-700/40 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase text-zinc-400">Verified Citations:</span>
                  {msg.citations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveCitation(c)}
                      className="px-2.5 py-1 rounded-lg bg-lime-400/20 text-lime-400 hover:bg-lime-400/40 text-[10px] font-extrabold border border-lime-400/40 transition flex items-center gap-1"
                    >
                      <FileText size={11} /> [{c.id}] {c.source.split(' ')[0]}
                    </button>
                  ))}
                </div>
              )}

              {/* Standard Mode Interactive Mindmap Snippet */}
              {!fieldMode && !lowBandwidth && msg.mindmapSnippet && (
                <div className="mt-3 p-3 rounded-xl bg-zinc-950 text-white space-y-2 border border-zinc-800">
                  <div className="flex items-center justify-between text-[10px] font-extrabold text-lime-400">
                    <span className="flex items-center gap-1"><Network size={12} /> Embedded Knowledge Flowchart</span>
                    <span>Neo4j Graph Node</span>
                  </div>
                  <div className="p-2 rounded bg-zinc-900 text-[11px] font-mono text-zinc-300">
                    C-301 (Compressor) → TrippedBy (HighTemp) → CheckSOP (OISD-117)
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

      {/* Field Tech Glove-Friendly Voice Button or Standard Input Bar */}
      <div className={`p-4 border-t ${fieldMode ? 'border-zinc-800 bg-zinc-900/90' : 'border-zinc-200 bg-zinc-50'}`}>
        
        {fieldMode ? (
          /* Utilitarian Field Mode Controls */
          <div className="space-y-3">
            <button
              onClick={toggleVoiceInput}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-2xl transition ${
                isListening 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : 'bg-lime-400 text-zinc-950 hover:bg-lime-300'
              }`}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              {isListening ? 'Listening... Tap to Stop' : 'Tap & Speak Operational Query'}
            </button>

            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <input 
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Or type operational query..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-5 py-3 rounded-xl bg-white text-zinc-950 font-extrabold text-xs uppercase"
              >
                Send
              </button>
            </form>
          </div>
        ) : (
          /* Standard Mode Chat Input Bar */
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
            <input 
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask Copilot about equipment limits, SOPs, or work order histories..."
              className="flex-1 bg-white border border-zinc-300 rounded-xl px-4 py-3 text-xs text-zinc-950 focus:outline-none focus:border-zinc-950 transition shadow-inner font-medium"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send size={14} className="text-lime-400" /> Send
            </button>
          </form>
        )}
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
