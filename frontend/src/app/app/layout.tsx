"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/context/AuthContext';
import { 
  Home, 
  Search, 
  Database, 
  Wrench, 
  ShieldAlert, 
  Bell, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  User,
  Zap,
  Plus
} from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentActiveRole, switchRole, roles, signOut, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  // If user is not authenticated, redirect to login
  React.useEffect(() => {
    const mockUser = localStorage.getItem('mock_user');
    if (!mockUser && !user) {
      router.push('/login');
    }
  }, [user, router]);

  const navItems = [
    { name: 'Home', href: '/app', icon: Home, roles: ['technician', 'engineer', 'compliance_officer', 'knowledge_admin', 'plant_admin'] },
    { name: 'Ask Copilot', href: '/app/copilot', icon: Search, roles: ['technician', 'engineer', 'compliance_officer', 'knowledge_admin', 'plant_admin'] },
    { name: 'Knowledge Graph', href: '/app/knowledge', icon: Database, roles: ['engineer', 'knowledge_admin', 'plant_admin'] },
    { name: 'MIRA Maintenance', href: '/app/maintenance', icon: Wrench, roles: ['technician', 'engineer', 'plant_admin'] },
    { name: 'QRCI Compliance', href: '/app/compliance', icon: ShieldAlert, roles: ['compliance_officer', 'plant_admin'] },
    { name: 'Alerts', href: '/app/notifications', icon: Bell, roles: ['technician', 'engineer', 'compliance_officer', 'knowledge_admin', 'plant_admin'] },
    { name: 'Settings', href: '/app/settings', icon: Settings, roles: ['plant_admin', 'engineer', 'compliance_officer', 'knowledge_admin', 'technician'] }
  ];

  // Filter nav items based on current active role
  const visibleNavItems = navItems.filter(item => item.roles.includes(currentActiveRole));

  const handleRoleChange = (role: UserRole) => {
    switchRole(role);
    setShowRoleSelector(false);
    router.push('/app'); // Refresh to role home
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f2f5f2] text-zinc-950 font-sans p-2 md:p-4 gap-4">
      
      {/* Sleek Dark Left Sidebar Rail (Matching Screenshot) */}
      <aside className="hidden md:flex md:flex-col md:w-20 bg-[#18181b] rounded-[2rem] flex-shrink-0 py-6 items-center justify-between shadow-2xl relative">
        
        {/* Top Section: Plus Badge */}
        <div className="flex flex-col items-center gap-6">
          <Link href="/app" className="w-11 h-11 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-2xl flex items-center justify-center text-white transition-all shadow-md group">
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-200" />
          </Link>

          {/* Navigation Items (Icons only) */}
          <nav className="flex flex-col items-center gap-3">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 relative group ${
                    isActive 
                      ? 'bg-zinc-800 text-lime-400 border border-zinc-700 shadow-md' 
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                  }`}
                  title={item.name}
                >
                  <Icon size={18} />
                  
                  {/* Hover Tooltip */}
                  <span className="absolute left-16 bg-zinc-900 border border-zinc-700 text-[10px] font-bold text-white px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Active Role swapper & Avatar */}
        <div className="flex flex-col items-center gap-4 relative">
          
          {/* Quick Swapper Trigger */}
          <button 
            onClick={() => setShowRoleSelector(!showRoleSelector)}
            className="w-10 h-10 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center text-lime-400 shadow-md transition"
            title="Swap Active Profile"
          >
            <Zap size={16} className="animate-pulse" />
          </button>

          {/* Role selector dropdown (positioned contextually) */}
          {showRoleSelector && (
            <div className="absolute bottom-16 left-4 mt-2 w-48 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 space-y-1 z-50">
              <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block px-2 py-1">Select Claim Profile</span>
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] capitalize transition ${currentActiveRole === r ? 'bg-lime-400/10 text-lime-400 font-bold border border-lime-400/20' : 'text-slate-300 hover:bg-zinc-800'}`}
                >
                  {r.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}

          {/* Custom Avatar matching screenshot bottom */}
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-lime-400 flex items-center justify-center bg-zinc-800 cursor-pointer" onClick={signOut} title="Sign Out">
            <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-700 via-zinc-900 to-black flex items-center justify-center font-black text-xs text-white">
              U
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 bg-transparent">
        
        {/* Mobile Header Bar */}
        <header className="h-14 bg-[#18181b] rounded-2xl flex items-center justify-between px-4 md:hidden mb-4 shadow-lg text-white">
          <Link href="/app" className="flex items-center gap-2">
            <Zap className="text-lime-400 animate-pulse" size={16} />
            <span className="font-bold text-xs tracking-wider text-white">ASSET BRAIN</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowRoleSelector(!showRoleSelector)}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-[10px] text-lime-400 font-bold capitalize"
            >
              {currentActiveRole.substring(0, 10)}..
            </button>
            
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-zinc-400 hover:text-white"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Mobile role switcher dropdown */}
        {showRoleSelector && (
          <div className="md:hidden p-3 bg-zinc-900 border border-zinc-700 rounded-xl mb-4 space-y-1 text-white">
            <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Swap Role Profile</span>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] capitalize transition ${currentActiveRole === r ? 'bg-lime-400 text-zinc-950 font-bold' : 'bg-zinc-800 text-slate-300 hover:bg-zinc-700'}`}
                >
                  {r.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile Menu Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-zinc-900 border border-zinc-700 rounded-2xl p-4 mb-4 space-y-3 text-white">
            <nav className="flex flex-col gap-2">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition ${pathname === item.href ? 'bg-lime-400 text-zinc-950 font-bold' : 'text-slate-300 hover:bg-zinc-800'}`}
                >
                  <item.icon size={16} />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
            <div className="border-t border-zinc-700 pt-3 flex justify-between items-center text-xs">
              <span className="text-[10px] text-zinc-400">{user?.email || 'sumitsill2605@gmail.com'}</span>
              <button onClick={signOut} className="text-red-400 hover:underline">Sign Out</button>
            </div>
          </div>
        )}

        {/* Page content injection */}
        <div className="flex-1 bg-white rounded-[2.5rem] border border-zinc-200/80 shadow-sm overflow-y-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
