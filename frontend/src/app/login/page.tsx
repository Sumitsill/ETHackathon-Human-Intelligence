"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole, ROLE_DETAILS } from '@/context/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import CursorGrid from '@/components/CursorGrid';
import { 
  ChevronLeft, 
  Cpu,
  ArrowRight,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithMock } = useAuth();
  const [email, setEmail] = useState('admin.patel@plantbrain.net');
  const [password, setPassword] = useState('Manager2026');
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="flex-1 flex items-center justify-center p-3 sm:p-6 md:p-8 relative z-10">
        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 bg-white/90 backdrop-blur-md border border-zinc-200 p-4 sm:p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] shadow-2xl items-start">
          
          {/* Left Side: Visual Hero & Branding */}
          <div className="md:col-span-6 flex flex-col justify-between h-full space-y-6 border-b md:border-b-0 md:border-r border-zinc-200/80 pb-6 md:pb-0 md:pr-8 w-full">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 text-lime-400 text-[10px] font-black uppercase tracking-widest">
                <Cpu size={13} className="animate-pulse" />
                PLANT OPERATIONS INTELLIGENCE
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-zinc-950 tracking-tight leading-tight">
                Empowering Plant Reliability & Control
              </h2>
              <p className="text-xs text-zinc-600 font-medium leading-relaxed">
                Integrated operational copilot with multi-format knowledge graph ingestion, telemetry diagnostics, and real-time maintenance workflows.
              </p>
            </div>

            {/* Visual SVG Illustration with Light/Transparent Background */}
            <div className="relative w-full rounded-3xl bg-gradient-to-br from-emerald-50/60 via-lime-50/40 to-transparent p-4 border border-zinc-200/60 shadow-sm flex items-center justify-center group my-auto">
              <Image 
                src="/Login.svg" 
                alt="Plant Operations Graphic" 
                width={500} 
                height={300} 
                className="w-full h-auto max-h-[240px] object-contain relative z-10 transition-transform duration-500 group-hover:scale-105"
                priority
              />
            </div>
          </div>

          {/* Right Side: Form Submission */}
          <div className="md:col-span-6 space-y-5">
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-zinc-950 tracking-tight">
                Authentication Portal
              </h1>
              <p className="text-xs text-zinc-500 font-medium">
                Enter your registered operational credentials to launch your workspace.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Registered Username / Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-3 text-xs font-mono font-bold text-zinc-950 focus:outline-none focus:border-zinc-950 transition shadow-inner"
                  placeholder="admin.patel@plantbrain.net"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Security Passkey
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl pl-4 pr-11 py-3 text-xs font-mono font-bold text-zinc-950 focus:outline-none focus:border-zinc-950 transition shadow-inner"
                    placeholder="Manager2026"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-950 transition p-1 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Persona Claim Selection */}
              <div>
                <label className="block text-[11px] font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Assigned Operational Role</span>
                  <span className="text-[9px] text-lime-700 font-bold bg-lime-100 px-1.5 py-0.5 rounded">Active</span>
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
                <button 
                  type="button"
                  onClick={() => alert("To reset credentials, please contact the system administrator.")}
                  className="text-zinc-500 hover:text-zinc-900 transition font-semibold hover:underline bg-transparent border-0 cursor-pointer p-0"
                >
                  Reset credentials
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 group"
              >
                {loading ? (
                  <>
                    <Zap size={15} className="animate-spin text-lime-400" />
                    Authenticating Credentials...
                  </>
                ) : (
                  <>
                    Authenticate & Launch Workspace
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
