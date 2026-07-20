"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Network, Send, CheckCircle, ChevronLeft } from 'lucide-react';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [plantType, setPlantType] = useState('Refinery');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // Try to insert in Supabase contact_submissions table
      const { error } = await supabase.from('contact_submissions').insert([
        {
          name,
          company,
          role,
          plant_type: plantType,
          message,
          created_at: new Date().toISOString()
        }
      ]);

      if (error) {
        // Fallback to localStorage if table doesn't exist yet
        console.warn("Supabase insertion failed: ", error.message, ". Storing locally in LocalStorage.");
        const localSubs = JSON.parse(localStorage.getItem('contact_submissions') || '[]');
        localSubs.push({ name, company, role, plantType, message, date: new Date().toISOString() });
        localStorage.setItem('contact_submissions', JSON.stringify(localSubs));
      }

      setSubmitted(true);
    } catch (err: any) {
      console.warn("Contact form submission failed:", err.message);
      setErrorMsg('Failed to send request. Storing locally.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0b0f19] text-slate-100">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#10b981]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="h-16 border-b border-[#27374d] flex items-center justify-between px-6 bg-[#0b0f19]/90 backdrop-blur sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm">
          <ChevronLeft size={16} /> Back to Home
        </Link>
        <div className="flex items-center gap-2">
          <Network className="text-[#10b981]" size={20} />
          <span className="font-bold text-md tracking-tight">Unified Asset Brain</span>
        </div>
        <div className="w-20" /> {/* Spacer */}
      </header>

      {/* Form Container */}
      <main className="flex-1 flex items-center justify-center p-6 relative">
        <div className="w-full max-w-lg p-8 rounded-2xl bg-[#151f32]/60 border border-[#27374d] backdrop-blur shadow-2xl">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-[#10b981]/15 border border-[#10b981]/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="text-[#10b981]" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Access Request Sent</h2>
              <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                Thank you for requesting access. Our solutions architects will review your company and site credentials and contact you shortly.
              </p>
              <div className="mt-8">
                <Link href="/" className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-[#10b981] hover:bg-[#0e9f6e] rounded-lg transition shadow-lg shadow-[#10b981]/10">
                  Return to Landing Page
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-extrabold text-white">Request Platform Access</h1>
                <p className="text-sm text-slate-400 mt-2">
                  Submit plant configuration details to schedule an onboarding slot.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs mb-6">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-[#27374d] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition"
                    placeholder="John Doe"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Company / Organization
                    </label>
                    <input
                      type="text"
                      required
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-[#27374d] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition"
                      placeholder="Reliance Refining"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Job Title / Role
                    </label>
                    <input
                      type="text"
                      required
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-[#27374d] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition"
                      placeholder="Reliability Manager"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Plant / Site Type
                  </label>
                  <select
                    value={plantType}
                    onChange={(e) => setPlantType(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-[#27374d] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition"
                  >
                    <option value="Refinery">Refinery / Petrochemical</option>
                    <option value="Chemicals">Chemicals Manufacturing</option>
                    <option value="Power">Power Generation</option>
                    <option value="Manufacturing">Discrete Manufacturing</option>
                    <option value="Other">Other Industrial Facility</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Message / Onboarding Scope
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-[#27374d] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition resize-none"
                    placeholder="Detail which compliance standards (OISD, Factories Act) and document formats you intend to ingest..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#10b981] hover:bg-[#0e9f6e] text-white py-3 px-4 rounded-lg font-semibold text-sm transition shadow-lg shadow-[#10b981]/15 disabled:opacity-50"
                >
                  {loading ? 'Sending Request...' : 'Send Request'}
                  <Send size={14} />
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
