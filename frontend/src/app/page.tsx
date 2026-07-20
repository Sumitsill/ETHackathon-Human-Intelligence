"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  ChevronDown,
  Menu,
  X,
  Database,
  Wrench,
  ShieldCheck,
  MessageSquare,
  Zap,
  BarChart3,
  FileText,
  CheckCircle,
  AlertTriangle,
  Plus,
  Settings,
  ArrowUpRight,
  Brain,
  Activity,
} from 'lucide-react';

/* ─── Animated counter hook ─── */
function useCounter(target: number, duration = 1400) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

/* ─── Subtle cursor-follower grid background ─── */
function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener('mousemove', onMove);

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const gap = 40;
      for (let x = 0; x < canvas.width; x += gap) {
        for (let y = 0; y < canvas.height; y += gap) {
          const dx = x - mouse.current.x;
          const dy = y - mouse.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const r = Math.max(0, 1 - dist / 160);
          ctx.beginPath();
          ctx.arc(x, y, 1.5 + r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(24,24,27,${0.06 + r * 0.22})`;
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); canvas.removeEventListener('mousemove', onMove); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ pointerEvents: 'none' }} />;
}

/* ─── Stat counter card ─── */
function StatCard({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  const c = useCounter(value);
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-4xl md:text-5xl font-black text-zinc-950 tracking-tight tabular-nums">
        {c.toLocaleString()}{suffix}
      </span>
      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const modules = [
    {
      icon: <Database size={22} />,
      label: 'Knowledge Graph Cockpit',
      tag: 'M1',
      tagColor: 'bg-sky-100 text-sky-700 border-sky-200',
      description: 'Ingest P&IDs, SOPs, work orders and emails into a unified live knowledge graph.',
      accent: 'bg-sky-50 border-sky-100',
      href: '/app',
    },
    {
      icon: <MessageSquare size={22} />,
      label: 'Expert Copilot',
      tag: 'M2',
      tagColor: 'bg-violet-100 text-violet-700 border-violet-200',
      description: 'Ask any operational question. Get a confidence-scored, source-cited answer instantly.',
      accent: 'bg-violet-50 border-violet-100',
      href: '/app/copilot',
    },
    {
      icon: <Wrench size={22} />,
      label: 'MIRA Maintenance',
      tag: 'M3',
      tagColor: 'bg-amber-100 text-amber-700 border-amber-200',
      description: 'AI-guided 5-Why RCA workbench with predictive asset telemetry and fault scoring.',
      accent: 'bg-amber-50 border-amber-100',
      href: '/app/maintenance',
    },
    {
      icon: <ShieldCheck size={22} />,
      label: 'QRCI Compliance',
      tag: 'M4',
      tagColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      description: 'Automated gap analysis mapped to OISD, PESO, Factories Act and IBR standards.',
      accent: 'bg-emerald-50 border-emerald-100',
      href: '/app/compliance',
    },
  ];

  const features = [
    { icon: <Brain size={18} />, title: 'Grounded AI Answers', desc: 'Every answer is cited to a source document, drawing, or work order — no hallucinations.' },
    { icon: <Activity size={18} />, title: 'Live Telemetry Analysis', desc: 'Real-time asset sensor streams fed into fault scoring and anomaly detection pipelines.' },
    { icon: <BarChart3 size={18} />, title: 'Compliance Dashboards', desc: 'Continuous gap-assessment against Indian industrial regulations with audit-ready exports.' },
    { icon: <Zap size={18} />, title: 'Root Cause in Minutes', desc: 'Structured 5-Why trees guided by LLM context, reducing MTTR by over 60%.' },
    { icon: <FileText size={18} />, title: 'Multi-format Ingestion', desc: 'PDF, XLSX, image, email — all normalised into one semantic knowledge graph.' },
    { icon: <CheckCircle size={18} />, title: 'Role-Based Workspaces', desc: 'Distinct views for field engineers, maintenance leads, compliance officers and plant heads.' },
  ];

  return (
    <div
      className="flex flex-col min-h-screen overflow-x-hidden"
      style={{ background: 'linear-gradient(160deg, #f6f8f6 0%, #f2f5f2 40%, #eef2ee 100%)' }}
    >

      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200/70 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#18181b] rounded-xl flex items-center justify-center font-black text-[10px] text-white tracking-tight">
              ET
            </div>
            <span className="font-extrabold text-base text-zinc-900 tracking-tight">
              ET<span className="font-light text-zinc-500">·Brain</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 relative">
            <div className="relative">
              <button
                onClick={() => setServicesOpen(!servicesOpen)}
                className="text-zinc-600 hover:text-zinc-900 text-sm font-semibold flex items-center gap-1 transition"
              >
                Modules
                <ChevronDown size={13} className={`transition-transform duration-200 ${servicesOpen ? 'rotate-180' : ''}`} />
              </button>
              {servicesOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-white border border-zinc-200 shadow-xl p-2 space-y-0.5 z-50">
                  {modules.map(m => (
                    <Link
                      key={m.tag}
                      href={m.href}
                      onClick={() => setServicesOpen(false)}
                      className="flex items-center gap-3 p-2.5 rounded-xl text-sm text-zinc-700 hover:bg-zinc-50 transition"
                    >
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${m.tagColor}`}>{m.tag}</span>
                      {m.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link href="/contact" className="text-zinc-600 hover:text-zinc-900 text-sm font-semibold transition">
              Contact Us
            </Link>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link
                href="/app"
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[#18181b] hover:bg-zinc-700 text-white rounded-full font-bold text-xs uppercase tracking-wider transition shadow"
              >
                <Plus size={13} /> Go to Workspace
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2.5 border border-zinc-300 hover:border-zinc-500 text-zinc-700 hover:text-zinc-900 text-sm font-semibold rounded-full transition"
                >
                  Login
                </Link>
                <Link
                  href="/contact"
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-[#18181b] hover:bg-zinc-700 text-white rounded-full font-bold text-xs uppercase tracking-wider transition shadow"
                >
                  Request Access <ArrowRight size={12} />
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-zinc-600 hover:text-zinc-900"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white z-40 p-6 space-y-5 border-t border-zinc-100">
          <nav className="flex flex-col gap-3 text-base font-semibold text-zinc-700">
            {modules.map(m => (
              <Link key={m.tag} href={m.href} onClick={() => setMobileMenuOpen(false)} className="hover:text-zinc-900">
                {m.tag} · {m.label}
              </Link>
            ))}
            <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="hover:text-zinc-900">Contact Us</Link>
            {user ? (
              <Link href="/app" onClick={() => setMobileMenuOpen(false)} className="text-zinc-900 font-black">Go to Workspace</Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="text-zinc-900 font-black">Request Access</Link>
              </>
            )}
          </nav>
        </div>
      )}

      {/* ── Hero Section ── */}
      <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 overflow-hidden">
        <DotGrid />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* Left: Hero copy */}
          <div className="lg:col-span-7 space-y-7">

            {/* Pill badge */}
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-black bg-lime-300 text-zinc-900 border border-lime-400 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 animate-pulse" />
              One Brain for the Whole Plant
            </span>

            {/* Heading */}
            <h1 className="text-4xl md:text-[3.6rem] font-black text-zinc-950 tracking-tight leading-[1.08] max-w-2xl">
              Every drawing, work order, and SOP —{' '}
              <span className="relative inline-block">
                <span className="relative z-10">one grounded</span>
                <span
                  className="absolute bottom-1 left-0 w-full h-3 rounded-sm"
                  style={{ background: 'rgba(163,230,53,0.45)', zIndex: 0 }}
                />
              </span>{' '}
              answer.
            </h1>

            {/* Sub-copy */}
            <p className="text-zinc-500 text-base leading-relaxed max-w-xl">
              Stop searching seven disconnected systems. Ask once. Get a cited, confidence-scored answer — in the field on your phone, or at the desk.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/contact"
                className="flex items-center gap-2 px-7 py-3.5 bg-[#18181b] hover:bg-zinc-700 text-white rounded-full font-bold text-sm tracking-wide transition shadow-lg hover:shadow-zinc-400/20"
              >
                Request Access <ArrowRight size={14} />
              </Link>
              <Link
                href="/app"
                className="flex items-center gap-1.5 text-sm font-semibold text-zinc-600 hover:text-zinc-900 transition group"
              >
                See the dashboard <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </Link>
            </div>

            {/* Regulatory standards strip */}
            <div className="flex flex-wrap items-center gap-2 pt-4">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mr-1">Mapped Against</span>
              {['OISD', 'PESO', 'Factories Act', 'IBR', 'CPCB'].map(s => (
                <span
                  key={s}
                  className="px-2.5 py-1 bg-white border border-zinc-200 rounded-lg text-[11px] font-bold text-zinc-600 shadow-sm"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Right: iPhone 15 Pro Style Mockup */}
          <div className="lg:col-span-5 flex justify-center items-center py-8">
            <div className="relative select-none">

              {/* ── Ambient glow ── */}
              <div
                className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-56 h-14 rounded-full blur-3xl opacity-50 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse, #84cc16 0%, transparent 70%)' }}
              />

              {/* ── Mute / Silent switch (top-left) ── */}
              <div
                className="absolute z-30"
                style={{ left: '-5px', top: '88px', width: '3px', height: '32px', borderRadius: '2px 0 0 2px', background: 'linear-gradient(to right,#3f3f46,#52525b)', boxShadow: '-2px 0 4px rgba(0,0,0,0.6)' }}
              />
              {/* ── Volume Up ── */}
              <div
                className="absolute z-30"
                style={{ left: '-5px', top: '140px', width: '3px', height: '42px', borderRadius: '2px 0 0 2px', background: 'linear-gradient(to right,#3f3f46,#52525b)', boxShadow: '-2px 0 4px rgba(0,0,0,0.6)' }}
              />
              {/* ── Volume Down ── */}
              <div
                className="absolute z-30"
                style={{ left: '-5px', top: '196px', width: '3px', height: '42px', borderRadius: '2px 0 0 2px', background: 'linear-gradient(to right,#3f3f46,#52525b)', boxShadow: '-2px 0 4px rgba(0,0,0,0.6)' }}
              />
              {/* ── Power button (right) ── */}
              <div
                className="absolute z-30"
                style={{ right: '-5px', top: '158px', width: '3px', height: '62px', borderRadius: '0 2px 2px 0', background: 'linear-gradient(to left,#3f3f46,#52525b)', boxShadow: '2px 0 4px rgba(0,0,0,0.6)' }}
              />

              {/* ══ Phone outer body ══ */}
              <div
                className="relative overflow-hidden"
                style={{
                  width: '285px',
                  height: '590px',
                  borderRadius: '52px',
                  background: 'linear-gradient(160deg,#2d2d2f 0%,#1c1c1e 35%,#0a0a0a 100%)',
                  boxShadow: [
                    /* inner edge highlight */
                    'inset 0 0 0 1px rgba(255,255,255,0.13)',
                    /* titanium-look frame */
                    '0 0 0 2px #2a2a2c',
                    '0 0 0 3px rgba(255,255,255,0.07)',
                    /* depth shadows */
                    '0 40px 80px rgba(0,0,0,0.65)',
                    '0 12px 30px rgba(0,0,0,0.5)',
                    /* subtle top highlight */
                    'inset 0 2px 0 rgba(255,255,255,0.1)',
                  ].join(','),
                }}
              >
                {/* ── Screen area (inset from bezel) ── */}
                <div
                  className="absolute inset-[3px] overflow-hidden"
                  style={{ borderRadius: '49px', background: '#111' }}
                >

                  {/* ── Dark background with app context ── */}
                  <div
                    className="relative w-full h-full flex flex-col"
                    style={{
                      background: 'linear-gradient(175deg,#1a1f16 0%,#111410 55%,#0d0d0d 100%)',
                    }}
                  >

                    {/* Status bar */}
                    <div className="flex items-center justify-between px-7 pt-4 pb-1 flex-shrink-0">
                      <span className="text-[11px] font-semibold text-white/90 tabular-nums tracking-tight">9:41</span>
                      <div className="flex items-center gap-[5px]">
                        {/* Cellular */}
                        <div className="flex items-end gap-[2px]">
                          {[4,6,8,10].map((h,i) => (
                            <div key={i} className="w-[3px] rounded-[1px]" style={{ height: `${h}px`, background: i < 3 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }} />
                          ))}
                        </div>
                        {/* WiFi */}
                        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
                          <circle cx="7.5" cy="9.5" r="1.2" fill="rgba(255,255,255,0.9)"/>
                          <path d="M4.5 7C5.6 5.9 6.5 5.4 7.5 5.4s1.9.5 3 1.6" stroke="rgba(255,255,255,0.9)" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                          <path d="M1.8 4.5C3.4 2.9 5.3 2 7.5 2s4.1.9 5.7 2.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                        </svg>
                        {/* Battery */}
                        <div className="flex items-center gap-0.5">
                          <div className="relative w-[22px] h-[11px] rounded-[3px] border border-white/45">
                            <div className="absolute top-[1.5px] left-[1.5px] bottom-[1.5px] rounded-[2px] bg-lime-400" style={{ width: '75%' }} />
                          </div>
                          <div className="w-[2px] h-[5px] rounded-r-[1px] bg-white/30" />
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Island */}
                    <div className="flex justify-center mt-1 mb-2 flex-shrink-0">
                      <div
                        className="flex items-center gap-2 h-[30px] px-[14px]"
                        style={{
                          background: '#000',
                          borderRadius: '20px',
                          boxShadow: '0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 1px rgba(255,255,255,0.05)',
                        }}
                      >
                        {/* Live indicator dot */}
                        <span className="w-[7px] h-[7px] rounded-full bg-lime-400 animate-pulse flex-shrink-0" />
                        <span className="text-[9.5px] font-black text-white/95 tracking-widest uppercase">ET · Brain</span>
                        {/* Camera dot */}
                        <div className="w-[11px] h-[11px] rounded-full flex-shrink-0" style={{ background: 'radial-gradient(circle at 35% 35%,#2a2a2a,#000)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06), inset 0 0 4px rgba(0,150,255,0.15)' }} />
                      </div>
                    </div>

                    {/* ── Hero copy on dark screen ── */}
                    <div className="px-6 pt-3 pb-2 flex-shrink-0">
                      <button
                        className="flex items-center justify-center w-8 h-8 rounded-full mb-4 transition-all hover:bg-white/10 active:scale-90"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                      >
                        <ArrowRight size={14} className="text-white/70 rotate-180" />
                      </button>
                      <h2 className="text-[22px] font-black text-white leading-[1.18] tracking-tight">
                        Connect your plant to one intelligent brain
                      </h2>
                      <p className="text-[11px] text-white/45 mt-2 leading-relaxed">
                        Sign in to access all four AI modules — live from anywhere.
                      </p>
                    </div>

                    {/* ── White bottom sheet ── */}
                    <div
                      className="flex-1 mx-[6px] mb-[6px] flex flex-col overflow-hidden"
                      style={{
                        borderRadius: '40px',
                        background: '#fff',
                        boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
                      }}
                    >
                      {/* Sheet drag handle */}
                      <div className="flex justify-center pt-3 pb-1">
                        <div className="w-9 h-[4px] rounded-full bg-zinc-200" />
                      </div>

                      {/* Login / Register tab toggle */}
                      <div className="mx-4 mt-1 mb-3 flex bg-zinc-100 rounded-2xl p-1">
                        <button className="flex-1 py-2 rounded-xl text-[11px] font-black text-white bg-[#18181b] shadow-sm tracking-wide transition-all">
                          Sign In
                        </button>
                        <button className="flex-1 py-2 rounded-xl text-[11px] font-semibold text-zinc-500 tracking-wide transition-all hover:text-zinc-700">
                          Register
                        </button>
                      </div>

                      {/* Module status rows */}
                      <div className="px-4 space-y-2 flex-1">
                        {[
                          { tag: 'M1', label: 'Knowledge Graph', status: 'Online', statusColor: 'text-emerald-600', dot: 'bg-emerald-500', icon: <Database size={11} /> },
                          { tag: 'M2', label: 'Expert Copilot', status: 'Online', statusColor: 'text-emerald-600', dot: 'bg-emerald-500', icon: <MessageSquare size={11} /> },
                          { tag: 'M3', label: 'MIRA Maintenance', status: '3 Active', statusColor: 'text-amber-600', dot: 'bg-amber-400', icon: <Wrench size={11} /> },
                          { tag: 'M4', label: 'QRCI Compliance', status: '7 Gaps', statusColor: 'text-red-500', dot: 'bg-red-400', icon: <ShieldCheck size={11} /> },
                        ].map(m => (
                          <div
                            key={m.tag}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-zinc-50 border border-zinc-100 hover:bg-white hover:border-zinc-200 hover:shadow-sm transition-all duration-200 cursor-pointer group"
                          >
                            <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center flex-shrink-0 text-white group-hover:scale-105 transition-transform">
                              {m.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-zinc-900 leading-tight">{m.label}</p>
                              <p className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">{m.tag}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                              <span className={`text-[9px] font-black ${m.statusColor}`}>{m.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* CTA Button */}
                      <div className="px-4 pb-4 pt-3">
                        <button className="w-full py-3.5 rounded-[18px] font-black text-[12px] tracking-wide text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                          style={{ background: 'linear-gradient(to right, #4d7c0f, #65a30d)' }}
                        >
                          Open Workspace
                        </button>
                        <p className="text-center text-[9px] text-zinc-400 mt-2 font-medium">
                          Or continue with{' '}
                          <span className="text-zinc-700 font-bold">SSO</span>
                        </p>
                      </div>

                      {/* Home indicator */}
                      <div className="flex justify-center pb-2">
                        <div className="w-24 h-[4px] rounded-full bg-zinc-200" />
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* Speaker grille dots below phone */}
              <div className="flex justify-center mt-4 gap-1.5 opacity-30">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                ))}
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="w-full border-y border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-zinc-100">
          {mounted && (
            <>
              <StatCard value={12000} label="Graph Nodes Indexed" suffix="+" />
              <StatCard value={4} label="Integrated Modules" />
              <StatCard value={60} label="Faster MTTR" suffix="%" />
              <StatCard value={5} label="Regulatory Frameworks" />
            </>
          )}
        </div>
      </section>

      {/* ── Module cards section ── */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Platform Modules</span>
            <h2 className="text-3xl md:text-4xl font-black text-zinc-950 tracking-tight mt-1">
              Four specialised AI engines,<br />one unified workspace.
            </h2>
          </div>
          <Link
            href="/app"
            className="self-start md:self-auto flex items-center gap-1.5 px-5 py-3 bg-[#18181b] hover:bg-zinc-700 text-white rounded-full font-bold text-xs uppercase tracking-wider transition shadow"
          >
            <Plus size={13} /> Launch Workspace
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {modules.map((m, i) => (
            <Link
              key={m.tag}
              href={m.href}
              className={`group relative flex flex-col gap-4 p-6 rounded-[2rem] bg-white border border-zinc-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden`}
            >
              {/* Subtle accent blob */}
              <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-60 ${m.accent}`} />

              <div className="relative z-10 flex items-start justify-between">
                <div className={`p-2.5 rounded-2xl border ${m.accent}`}>
                  <span className={m.tagColor.split(' ')[1]}>{m.icon}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${m.tagColor}`}>{m.tag}</span>
              </div>

              <div className="relative z-10 flex-1">
                <h3 className="text-base font-extrabold text-zinc-900 leading-tight">{m.label}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed mt-1.5">{m.description}</p>
              </div>

              <div className="relative z-10 flex items-center gap-1 text-xs font-bold text-zinc-400 group-hover:text-zinc-900 transition">
                Open module <ArrowRight size={12} className="group-hover:translate-x-1 transition" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section className="w-full bg-white border-y border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="mb-10">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Why ET·Brain</span>
            <h2 className="text-3xl md:text-4xl font-black text-zinc-950 tracking-tight mt-1 max-w-xl">
              Built for India's heavy industry. Works anywhere.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className="group flex gap-4 p-6 rounded-[1.75rem] bg-[#f8f9f8] border border-zinc-100 cursor-pointer hover:bg-white hover:border-lime-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-9 h-9 rounded-xl bg-lime-300 border border-lime-400 flex items-center justify-center flex-shrink-0 text-zinc-900 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  {f.icon}
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-zinc-900 group-hover:text-zinc-950 transition">{f.title}</h4>
                  <p className="text-xs text-zinc-500 leading-relaxed mt-1 group-hover:text-zinc-600 transition">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works / pipeline ── */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="mb-10">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Data Pipeline</span>
          <h2 className="text-3xl md:text-4xl font-black text-zinc-950 tracking-tight mt-1">
            From raw document to cited answer<br />in seconds.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: '01', title: 'Ingest', desc: 'Upload P&IDs, SOPs, work orders, emails or sensor streams.', icon: <FileText size={18} />, color: 'hover:border-sky-200 hover:shadow-sky-100/60' },
            { step: '02', title: 'Index', desc: 'Knowledge Graph + vector DB built automatically across all asset types.', icon: <Database size={18} />, color: 'hover:border-violet-200 hover:shadow-violet-100/60' },
            { step: '03', title: 'Reason', desc: 'LLM + retrieval pipeline produces grounded multi-source reasoning chains.', icon: <Brain size={18} />, color: 'hover:border-amber-200 hover:shadow-amber-100/60' },
            { step: '04', title: 'Decide', desc: 'Engineer receives a cited, confidence-scored answer with source links.', icon: <CheckCircle size={18} />, color: 'hover:border-lime-200 hover:shadow-lime-100/60' },
          ].map((s, i) => (
            <div key={i} className={`group relative flex flex-col gap-4 p-7 rounded-[2rem] bg-white border border-zinc-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${s.color}`}>
              {/* Step number badge */}
              <span className="absolute top-4 right-4 text-[10px] font-black text-zinc-300 tabular-nums">{s.step}</span>
              <div className="w-10 h-10 rounded-2xl bg-[#18181b] group-hover:bg-zinc-700 flex items-center justify-center text-white transition-colors duration-300 shadow-md">
                {s.icon}
              </div>
              <div>
                <h4 className="text-base font-extrabold text-zinc-950">{s.title}</h4>
                <p className="text-xs text-zinc-500 leading-relaxed mt-1">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div
          className="relative rounded-[2.5rem] overflow-hidden bg-[#18181b] px-8 md:px-14 py-14 flex flex-col md:flex-row items-center justify-between gap-8"
        >
          {/* Lime accent blob */}
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-lime-400 opacity-10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-lime-400 opacity-10 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-lg">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-lime-300 text-zinc-900 border border-lime-400 uppercase tracking-wider mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 animate-pulse" />
              Ready in minutes
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              Your plant's operational brain is waiting.
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed mt-3">
              No lengthy setup. No disconnected tools. One deployment — four AI engines online, API key secured, all modules live.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row gap-3">
            <Link
              href="/contact"
              className="flex items-center justify-center gap-2 px-7 py-4 bg-lime-300 hover:bg-lime-400 text-zinc-900 rounded-2xl font-black text-sm tracking-wide transition shadow-lg"
            >
              Request Access <ArrowRight size={14} />
            </Link>
            <Link
              href="/app"
              className="flex items-center justify-center gap-2 px-7 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl font-bold text-sm transition"
            >
              Open Workspace
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="w-full border-t border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#18181b] rounded-lg flex items-center justify-center font-black text-[8px] text-white">ET</div>
            <span className="text-sm font-bold text-zinc-700">ET<span className="font-light text-zinc-400">·Brain</span></span>
            <span className="text-zinc-300 text-xs ml-2">© 2026 ET Hackathon</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-semibold text-zinc-400">
            <Link href="/contact" className="hover:text-zinc-700 transition">Contact</Link>
            <Link href="/app" className="hover:text-zinc-700 transition">Workspace</Link>
            <Link href="/login" className="hover:text-zinc-700 transition">Login</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
