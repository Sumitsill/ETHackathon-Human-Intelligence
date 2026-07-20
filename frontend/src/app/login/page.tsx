"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/context/AuthContext';
import Link from 'next/link';
import CursorGrid from '@/components/CursorGrid';
import { 
  ChevronLeft, 
  ShieldCheck,
  Cpu
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithMock } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mockRole, setMockRole] = useState<UserRole>('plant_admin');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate role mapping based on selected demo role
    let selectedRoles: UserRole[] = [mockRole];
    
    if (mockRole === 'plant_admin') {
      selectedRoles = ['plant_admin', 'engineer', 'technician'];
    } else if (mockRole === 'knowledge_admin') {
      selectedRoles = ['knowledge_admin', 'technician'];
    } else if (mockRole === 'compliance_officer') {
      selectedRoles = ['compliance_officer', 'technician'];
    }
    
    signInWithMock(email || `${mockRole}@plantbrain.net`, selectedRoles);
    
    setTimeout(() => {
      setLoading(false);
      router.push('/app');
    }, 600);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f2f5f2] text-zinc-950 overflow-hidden relative">
      
      {/* Light-themed CursorGrid Background */}
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

      {/* Background glow matching the home sage theme */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-lime-300/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="h-16 border-b border-zinc-200/80 flex items-center justify-between px-6 bg-white/80 backdrop-blur sticky top-0 z-10 shadow-sm">
        <Link href="/" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-950 transition text-xs font-bold">
          <ChevronLeft size={16} /> Back to Home
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-zinc-950 rounded-lg flex items-center justify-center font-black text-xs text-white">
            IK
          </div>
          <span className="font-extrabold text-sm tracking-tight">UnifiedBrain</span>
        </div>
        <div className="w-20" />
      </header>

      {/* Centered Login Card */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="max-w-md w-full space-y-6 bg-white border border-zinc-200 p-8 rounded-[2.5rem] shadow-xl">
          
          <div className="space-y-2">
            <span className="text-[10px] font-black text-[#10b981] uppercase tracking-widest flex items-center gap-1">
              <Cpu size={12} className="animate-pulse" />
              SECURITY ACCESSPORT
            </span>
            <h1 className="text-3xl font-extrabold text-zinc-950 tracking-tight leading-none">
              Welcome Back
            </h1>
            <p className="text-xs text-zinc-400 font-semibold leading-relaxed">
              Login to access your plant operator command deck.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-xs text-zinc-950 focus:outline-none focus:border-zinc-800 transition shadow-inner"
                placeholder="operator@refinery.com"
              />
            </div>

            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-xs text-zinc-950 focus:outline-none focus:border-zinc-800 transition shadow-inner"
                placeholder="•••••••••••••"
              />
            </div>

            {/* Remember & Forgot */}
            <div className="flex justify-between items-center text-xs">
              <label className="flex items-center gap-2 text-zinc-500 cursor-pointer font-semibold">
                <input 
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-zinc-300 text-zinc-950 focus:ring-0" 
                />
                Remember me
              </label>
              <Link href="/contact" className="text-zinc-500 hover:text-zinc-900 transition font-semibold hover:underline">
                Forgot Password?
              </Link>
            </div>

            {/* Demonstration Persona Select matching the dashboard registry panels */}
            <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-2.5 shadow-sm">
              <span className="text-[9px] font-black text-zinc-500 flex items-center gap-1.5 uppercase tracking-widest">
                <ShieldCheck size={14} className="text-lime-600" />
                Demonstration Claims Profile
              </span>
              <div>
                <select
                  value={mockRole}
                  onChange={(e) => setMockRole(e.target.value as UserRole)}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-800 focus:outline-none focus:border-zinc-800 shadow-sm"
                >
                  <option value="plant_admin">Plant Manager (All features)</option>
                  <option value="engineer">Reliability Maintenance Engineer</option>
                  <option value="compliance_officer">Quality Compliance Officer</option>
                  <option value="knowledge_admin">Knowledge Engineer</option>
                  <option value="technician">Field Operator / Technician</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md disabled:opacity-50"
            >
              {loading ? 'Entering Plant Workspace...' : 'Sign In'}
            </button>
          </form>

          <div className="text-xs text-zinc-400 text-center font-semibold">
            Don't have an account? <Link href="/signup" className="text-zinc-900 hover:underline font-bold">Sign Up</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
