"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, UserRole, ROLE_DETAILS } from '@/context/AuthContext';
import { 
  LayoutDashboard, 
  Search, 
  FileUp,
  Network,
  Wrench, 
  ShieldCheck, 
  CheckSquare,
  Bell, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Zap,
  Activity,
  Server,
  User,
  ChevronDown,
  Lightbulb
} from 'lucide-react';

interface MicroserviceStatus {
  module1: boolean;
  module2: boolean;
  module3: boolean;
  module4: boolean;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentActiveRole, switchRole, roles, signOut, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [serverHealth, setServerHealth] = useState<MicroserviceStatus>({
    module1: true,
    module2: true,
    module3: true,
    module4: true,
  });

  // Authentication Guard
  useEffect(() => {
    const mockUser = localStorage.getItem('mock_user');
    if (!mockUser && !user) {
      router.push('/login');
    }
  }, [user, router]);

  // Live Microservice Health Check (Ports 8000 - 8003)
  useEffect(() => {
    const checkPortHealth = async () => {
      const checkPort = async (module: string) => {
        try {
          const res = await fetch(`/api/proxy/${module}/docs`, { method: 'HEAD' });
          return res.ok || res.status === 404 || res.status === 200;
        } catch {
          return false;
        }
      };

      const [m1, m2, m3, m4] = await Promise.all([
        checkPort('knowledge'),
        checkPort('copilot'),
        checkPort('maintenance'),
        checkPort('compliance'),
      ]);

      setServerHealth({
        module1: m1,
        module2: m2,
        module3: m3,
        module4: m4,
      });
    };

    checkPortHealth();
    const interval = setInterval(checkPortHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Navigation Items per Specification
  const navItems = [
    { 
      name: 'Command Center', 
      href: '/app', 
      aliasHref: '/dashboard',
      icon: LayoutDashboard, 
      roles: ['plant_admin', 'engineer', 'compliance_officer'] 
    },
    { 
      name: 'Doc Ingestion', 
      href: '/app/knowledge/ingest', 
      aliasHref: '/knowledge/ingest',
      icon: FileUp, 
      roles: ['plant_admin', 'knowledge_admin'] 
    },
    { 
      name: 'Knowledge Graph', 
      href: '/app/knowledge/graph', 
      aliasHref: '/knowledge/graph',
      icon: Network, 
      roles: ['plant_admin', 'engineer', 'knowledge_admin'] 
    },
    { 
      name: 'Grounded Copilot', 
      href: '/app/copilot', 
      aliasHref: '/copilot',
      icon: Search, 
      roles: ['plant_admin', 'engineer', 'compliance_officer', 'knowledge_admin', 'technician'] 
    },
    { 
      name: 'MIRA Maintenance', 
      href: '/app/maintenance', 
      aliasHref: '/mira/workbench',
      icon: Wrench, 
      roles: ['plant_admin', 'engineer'] 
    },
    { 
      name: 'Failure Intelligence', 
      href: '/app/failure-intelligence', 
      aliasHref: '/failure-intelligence',
      icon: Lightbulb, 
      roles: ['plant_admin', 'engineer', 'compliance_officer'] 
    },
    { 
      name: 'QRCI Compliance', 
      href: '/app/compliance', 
      aliasHref: '/qrci/matrix',
      icon: ShieldCheck, 
      roles: ['plant_admin', 'compliance_officer'] 
    },
    { 
      name: 'Field Operations', 
      href: '/app/tasks', 
      aliasHref: '/tasks',
      icon: CheckSquare, 
      roles: ['plant_admin', 'technician'] 
    },
  ];

  // Filter navigation items dynamically based on current logged in persona
  const visibleNavItems = navItems.filter(item => item.roles.includes(currentActiveRole));

  const handleRoleChange = (role: UserRole) => {
    switchRole(role);
    setShowRoleSelector(false);
    const defaultTarget = ROLE_DETAILS[role]?.defaultRoute || '/app';
    router.push(defaultTarget);
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f2f5f2] text-zinc-950 font-sans p-2 md:p-3 gap-3">
      
      {/* Persistent Left Sidebar Rail */}
      <aside className="hidden md:flex md:flex-col md:w-20 bg-[#18181b] rounded-[2rem] flex-shrink-0 py-5 items-center justify-between shadow-2xl relative border border-zinc-800">
        
        {/* Top Logo & Navigation Icons */}
        <div className="flex flex-col items-center gap-5 w-full">
          
          {/* Logo Badge */}
          <Link href="/app" className="w-11 h-11 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 rounded-2xl flex items-center justify-center text-lime-400 font-black text-xs transition-all shadow-md group">
            ET
          </Link>

          <div className="w-8 h-px bg-zinc-800" />

          {/* Navigation Rail */}
          <nav className="flex flex-col items-center gap-2.5 w-full px-2">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href) || pathname === item.aliasHref;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 relative group ${
                    isActive 
                      ? 'bg-zinc-800 text-lime-400 border border-zinc-700 shadow-md scale-105' 
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                  }`}
                  title={item.name}
                >
                  <Icon size={19} />
                  
                  {/* Tooltip */}
                  <div className="absolute left-16 bg-zinc-900 border border-zinc-700 text-[10px] font-bold text-white px-2.5 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 shadow-xl flex items-center gap-1.5">
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Active Role Swapper & Logout */}
        <div className="flex flex-col items-center gap-3.5 relative w-full px-2">
          
          {/* Role Swapper Button */}
          <button 
            onClick={() => setShowRoleSelector(!showRoleSelector)}
            className="w-11 h-11 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lime-400 shadow-md transition group relative"
            title="Switch Operational Persona"
          >
            <Zap size={18} className="animate-pulse" />
            <div className="absolute left-16 bg-zinc-900 border border-zinc-700 text-[10px] font-bold text-lime-400 px-2.5 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 shadow-xl">
              Persona: {ROLE_DETAILS[currentActiveRole]?.label.split(' ')[0]}
            </div>
          </button>

          {/* Role Selector Popup */}
          {showRoleSelector && (
            <div className="absolute bottom-16 left-16 w-64 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-2 space-y-1.5 z-50">
              <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block px-2.5 py-1 border-b border-zinc-800">
                Switch Operational Persona
              </span>
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition flex flex-col ${
                    currentActiveRole === r 
                      ? 'bg-lime-400/10 text-lime-400 border border-lime-400/20' 
                      : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span>{ROLE_DETAILS[r]?.label}</span>
                  <span className="text-[10px] text-zinc-500 font-normal">{ROLE_DETAILS[r]?.description.substring(0, 45)}...</span>
                </button>
              ))}
            </div>
          )}

          {/* Logout Button */}
          <button 
            onClick={handleLogout}
            className="w-11 h-11 rounded-2xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 flex items-center justify-center text-red-400 shadow-md transition group relative"
            title="Sign Out of Workspace"
          >
            <LogOut size={17} />
            <div className="absolute left-16 bg-red-950 border border-red-800 text-[10px] font-bold text-red-300 px-2.5 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 shadow-xl">
              Sign Out
            </div>
          </button>
        </div>
      </aside>

      {/* Main Container Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-transparent">
        
        {/* Top Operational Header Bar */}
        <header className="h-14 bg-white/90 backdrop-blur border border-zinc-200/90 rounded-2xl px-4 flex items-center justify-between shadow-sm mb-3">
          
          {/* Left: Active Persona Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-zinc-950 text-white text-xs font-extrabold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping" />
              {ROLE_DETAILS[currentActiveRole]?.label || currentActiveRole}
            </div>

            {/* Quick Microservices Status Bar */}
            <div className="hidden lg:flex items-center gap-3 border-l border-zinc-200 pl-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500">
                <Server size={13} /> Ports:
              </div>
              <div className="flex items-center gap-2">
                {[
                  { name: 'M1 (8000)', status: serverHealth.module1 },
                  { name: 'M2 (8001)', status: serverHealth.module2 },
                  { name: 'M3 (8002)', status: serverHealth.module3 },
                  { name: 'M4 (8003)', status: serverHealth.module4 },
                ].map((s) => (
                  <span 
                    key={s.name}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border flex items-center gap-1 ${
                      s.status 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.status ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Header Actions: User Profile & Explicit Logout */}
          <div className="flex items-center gap-3">
            
            <button 
              onClick={() => setShowRoleSelector(!showRoleSelector)}
              className="md:hidden px-3 py-1 rounded-xl bg-zinc-900 text-lime-400 text-xs font-bold flex items-center gap-1"
            >
              Switch Role <ChevronDown size={12} />
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-700">
              <User size={14} className="text-zinc-400" />
              <span>{user?.email || 'operator@plant.com'}</span>
            </div>

            <button
              onClick={handleLogout}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Sign Out"
            >
              <LogOut size={13} className="text-red-400" />
              <span className="hidden sm:inline">Logout</span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-zinc-100 text-zinc-800"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-zinc-900 text-white rounded-2xl p-4 mb-3 space-y-2 border border-zinc-800 shadow-xl">
            <span className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest block pb-1 border-b border-zinc-800">
              Navigation Menu
            </span>
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition"
                >
                  <Icon size={16} className="text-lime-400" />
                  {item.name}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-semibold">{user?.email || 'operator@plant.com'}</span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl bg-red-950 text-red-300 border border-red-800 text-xs font-bold flex items-center gap-1"
              >
                <LogOut size={13} /> Logout
              </button>
            </div>
          </div>
        )}

        {/* Page Dynamic Content View */}
        <main className="flex-1 min-h-0 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
