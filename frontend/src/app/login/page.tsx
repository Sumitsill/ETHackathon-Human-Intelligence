"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole, ROLE_DETAILS } from '@/context/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import CursorGrid from '@/components/CursorGrid';
import { 
  ChevronLeft, 
  ShieldCheck,
  Cpu,
  ArrowRight,
  Zap
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithMock } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mockRole, setMockRole] = useState<UserRole>('plant_admin');
  const [rememberMe, setRememberMe] = useState(true);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    let selectedRoles: UserRole[] = [mockRole];
    
    if (mockRole === 'plant_admin') {
      selectedRoles = ['plant_admin', 'engineer', 'compliance_officer', 'knowledge_admin', 'technician'];
    } else if (mockRole === 'engineer') {
      selectedRoles = ['engineer', 'technician'];
    } else if (mockRole === 'knowledge_admin') {
      selectedRoles = ['knowledge_admin', 'technician'];
    } else if (mockRole === 'compliance_officer') {
      selectedRoles = ['compliance_officer', 'technician'];
    } else {
      selectedRoles = ['technician'];
    }
    
    signInWithMock(email || `${mockRole}@plantbrain.net`, selectedRoles);
    
    setTimeout(() => {
      setLoading(false);
      const targetRoute = ROLE_DETAILS[mockRole]?.defaultRoute || '/app';
      router.push(targetRoute);
    }, 500);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f2f5f2] text-zinc-950 overflow-hidden relative">
      
      {/* Background Cursor Grid */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <CursorGrid
          cellSize={60}
          color="#9ca3af"
          radius={160}
          lineWidth={0.8}
          maxOpacity={0.25}
          gridOpacity={0.08}
          clickPulse
        />
      </div>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-lime-300/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="h-16 border-b border-zinc-200/80 flex items-center justify-between px-6 bg-white/80 backdrop-blur sticky top-0 z-20 shadow-sm">
        <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-950 transition text-xs font-bold">
          <ChevronLeft size={16} /> Back to Home
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-zinc-950 rounded-xl flex items-center justify-center font-black text-xs text-lime-400 shadow-md">
            ET
          </div>
          <span className="font-extrabold text-sm tracking-tight text-zinc-900">
            ET<span className="font-light text-zinc-500">·Operations Brain</span>
          </span>
        </div>
        <div className="w-24 flex justify-end">
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-[10px] font-extrabold text-emerald-800 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            System Live
          </span>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative z-10">
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 bg-white/90 backdrop-blur-md border border-zinc-200 p-6 md:p-8 rounded-[2.5rem] shadow-2xl items-center">
          
          {/* Left Side: SVG Illustration & Persona Briefing */}
          <div className="md:col-span-6 flex flex-col justify-between h-full space-y-6 border-b md:border-b-0 md:border-r border-zinc-200/80 pb-6 md:pb-0 md:pr-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 text-lime-400 text-[10px] font-black uppercase tracking-widest">
                <Cpu size={13} className="animate-pulse" />
                INDUSTRIAL INTELLIGENCE SUITE
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-zinc-950 tracking-tight leading-tight">
                Role-Based Autonomous Operations
              </h2>
              <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                Bridge the gap between raw plant data, compliance standards, and real-time field operations with persona-driven AI context.
              </p>
            </div>

            {/* Login SVG Vector Illustration */}
            <div className="relative w-full h-56 md:h-64 flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100/60 rounded-2xl border border-zinc-200/80 overflow-hidden group shadow-inner">
              <Image 
                src="/Login.svg" 
                alt="ET Unified Operations Login Illustration" 
                fill 
                className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                priority
              />
            </div>

            {/* Selected Persona Helper Card */}
            <div className="p-3.5 rounded-xl bg-lime-50/70 border border-lime-200/80 space-y-1">
              <span className="text-[10px] font-bold text-lime-900 uppercase tracking-wider flex items-center gap-1">
                <Zap size={12} className="text-lime-700" />
                Active Persona Access Target
              </span>
              <p className="text-xs font-semibold text-zinc-800">
                {ROLE_DETAILS[mockRole]?.label}
              </p>
              <p className="text-[11px] text-zinc-600 font-medium">
                {ROLE_DETAILS[mockRole]?.description}
              </p>
            </div>
          </div>

          {/* Right Side: Login Form & Role Selector */}
          <div className="md:col-span-6 space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-extrabold text-zinc-950 tracking-tight">
                Access Portal
              </h1>
              <p className="text-xs text-zinc-500 font-medium">
                Select your operational role below to enter your workspace deck.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Operator / User Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-3 text-xs font-medium text-zinc-950 focus:outline-none focus:border-zinc-950 transition shadow-inner"
                  placeholder="operator@refinery-plant.com"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Security Passkey
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-3 text-xs font-medium text-zinc-950 focus:outline-none focus:border-zinc-950 transition shadow-inner"
                  placeholder="••••••••••••••••"
                />
              </div>

              {/* Persona Claim Selection */}
              <div>
                <label className="block text-[11px] font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Demonstration Persona Role</span>
                  <span className="text-[9px] text-lime-700 font-bold bg-lime-100 px-1.5 py-0.5 rounded">Required</span>
                </label>
                <div className="relative">
                  <select
                    value={mockRole}
                    onChange={(e) => setMockRole(e.target.value as UserRole)}
                    className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-950 transition shadow-sm appearance-none cursor-pointer"
                  >
                    <option value="plant_admin">Plant Manager (All features)</option>
                    <option value="engineer">Reliability Maintenance Engineer</option>
                    <option value="compliance_officer">Quality Compliance Officer</option>
                    <option value="knowledge_admin">Knowledge Engineer</option>
                    <option value="technician">Field Operator / Technician</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                    <ChevronLeft size={16} className="-rotate-90" />
                  </div>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex justify-between items-center text-xs pt-1">
                <label className="flex items-center gap-2 text-zinc-600 cursor-pointer font-semibold">
                  <input 
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-950 focus:ring-0" 
                  />
                  Remember session
                </label>
                <Link href="/contact" className="text-zinc-500 hover:text-zinc-900 transition font-semibold hover:underline">
                  Reset credentials
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 group"
              >
                {loading ? (
                  <>
                    <Zap size={15} className="animate-spin text-lime-400" />
                    Connecting Persona Session...
                  </>
                ) : (
                  <>
                    Enter Persona Workspace
                    <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform text-lime-400" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
