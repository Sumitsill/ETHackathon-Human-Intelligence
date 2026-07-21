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

interface UserAccount {
  name: string;
  email: string;
  pass: string;
  role: UserRole;
  title: string;
}

const REGISTERED_USER_ACCOUNTS: UserAccount[] = [
  // Plant Manager (All Features)
  { name: 'Vikram Patel', email: 'admin.patel@plantbrain.net', pass: 'Manager2026!', role: 'plant_admin', title: 'Plant Operations Director' },
  { name: 'Rajesh Sharma', email: 'admin.sharma@plantbrain.net', pass: 'Manager2026!', role: 'plant_admin', title: 'General Manager - CDU Unit' },

  // Reliability Maintenance Engineer
  { name: 'Ananya Gupta', email: 'engineer.gupta@plantbrain.net', pass: 'Reliability2026!', role: 'engineer', title: 'Lead Reliability Engineer' },
  { name: 'Suresh Singh', email: 'engineer.singh@plantbrain.net', pass: 'Reliability2026!', role: 'engineer', title: 'Senior Predictive Maintenance Eng.' },

  // Quality Compliance Officer
  { name: 'Meera Verma', email: 'compliance.verma@plantbrain.net', pass: 'Auditor2026!', role: 'compliance_officer', title: 'Chief Quality & Statutory Auditor' },
  { name: 'Karthik Reddy', email: 'compliance.reddy@plantbrain.net', pass: 'Auditor2026!', role: 'compliance_officer', title: 'QRCI Compliance Officer' },

  // Knowledge Engineer
  { name: 'Debashish Roy', email: 'knowledge.roy@plantbrain.net', pass: 'Ingest2026!', role: 'knowledge_admin', title: 'Lead Knowledge & Graph Architect' },
  { name: 'Priya Das', email: 'knowledge.das@plantbrain.net', pass: 'Ingest2026!', role: 'knowledge_admin', title: 'Document Ingestion Specialist' },

  // Field Operator / Technician
  { name: 'Ramesh Sharma', email: 'tech.sharma@plantbrain.net', pass: 'Field2026!', role: 'technician', title: 'Senior Field Maintenance Operator' },
  { name: 'David Moraes', email: 'tech.moraes@plantbrain.net', pass: 'Field2026!', role: 'technician', title: 'Field Machinery Specialist' },
  { name: 'Amit Kumar', email: 'tech.kumar@plantbrain.net', pass: 'Field2026!', role: 'technician', title: 'Telemetry Inspection Operator' }
];

export default function LoginPage() {
  const router = useRouter();
  const { signInWithMock } = useAuth();
  const [email, setEmail] = useState(REGISTERED_USER_ACCOUNTS[0].email);
  const [password, setPassword] = useState(REGISTERED_USER_ACCOUNTS[0].pass);
  const [loading, setLoading] = useState(false);
  const [mockRole, setMockRole] = useState<UserRole>('plant_admin');
  const [rememberMe, setRememberMe] = useState(true);

  const handleSelectAccount = (acc: UserAccount) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setMockRole(acc.role);
  };

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
        <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 bg-white/90 backdrop-blur-md border border-zinc-200 p-6 md:p-8 rounded-[2.5rem] shadow-2xl items-start">
          
          {/* Left Side: Persona Credentials Quick Selector */}
          <div className="md:col-span-6 flex flex-col justify-between h-full space-y-5 border-b md:border-b-0 md:border-r border-zinc-200/80 pb-6 md:pb-0 md:pr-8">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 text-lime-400 text-[10px] font-black uppercase tracking-widest">
                <Cpu size={13} className="animate-pulse" />
                REGISTERED PLANT ACCOUNTS
              </div>
              <h2 className="text-xl md:text-2xl font-extrabold text-zinc-950 tracking-tight leading-tight">
                Select Persona User Account
              </h2>
              <p className="text-xs text-zinc-600 font-medium leading-relaxed">
                Click any registered user below to auto-fill authentic credentials for testing role permissions.
              </p>
            </div>

            {/* Quick Account Selector Grid */}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {REGISTERED_USER_ACCOUNTS.map((acc, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectAccount(acc)}
                  className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                    email === acc.email
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-md'
                      : 'bg-zinc-50 hover:bg-white text-zinc-900 border-zinc-200'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black truncate">{acc.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        email === acc.email ? 'bg-lime-400 text-zinc-950' : 'bg-zinc-200 text-zinc-800'
                      }`}>
                        {acc.role.toUpperCase().replace('_', ' ')}
                      </span>
                    </div>
                    <p className={`text-[10px] font-mono truncate ${email === acc.email ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {acc.email} · Pass: <span className="font-bold">{acc.pass}</span>
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold shrink-0 ${email === acc.email ? 'text-lime-400' : 'text-zinc-400'}`}>
                    {email === acc.email ? '✓ Selected' : 'Use'}
                  </span>
                </div>
              ))}
            </div>

            {/* Active Persona Access Target */}
            <div className="p-3.5 rounded-xl bg-lime-50/70 border border-lime-200/80 space-y-1">
              <span className="text-[10px] font-bold text-lime-900 uppercase tracking-wider flex items-center gap-1">
                <Zap size={12} className="text-lime-700" />
                Selected Role Destination: {ROLE_DETAILS[mockRole]?.defaultRoute}
              </span>
              <p className="text-[11px] text-zinc-600 font-medium">
                {ROLE_DETAILS[mockRole]?.description}
              </p>
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
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-3 text-xs font-mono font-bold text-zinc-950 focus:outline-none focus:border-zinc-950 transition shadow-inner"
                  placeholder="Manager2026!"
                />
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
