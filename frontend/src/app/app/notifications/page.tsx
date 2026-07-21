"use client";

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Clock
} from 'lucide-react';

interface Notification {
  id: string;
  type: string; // critical, major, minor, healthy
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export default function NotificationsFeed() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    setTimeout(() => {
      setNotifications([]);
      setLoading(false);
    }, 100);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4 gap-4">
        <div>
          <span className="text-[10px] font-black text-[#10b981] uppercase tracking-widest block mb-1">PLANT WARNINGS</span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-950 tracking-tight flex items-center gap-2">
            <Bell size={24} className="text-zinc-950" />
            Realtime Notifications Feed
          </h1>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={markAllRead}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 transition shadow-sm"
          >
            Mark all read
          </button>
          <button 
            onClick={fetchNotifications}
            className="p-2.5 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-xl text-zinc-700 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Feed list */}
      <div className="space-y-4 max-w-4xl">
        {loading ? (
          <span className="text-xs text-zinc-400">Loading alerts queue...</span>
        ) : (
          notifications.map((n) => (
            <div 
              key={n.id} 
              className={`p-4 rounded-3xl border flex gap-4 transition-all duration-200 ${
                n.read 
                  ? 'bg-zinc-50/50 border-zinc-200 opacity-75' 
                  : 'bg-white border-zinc-300 shadow-md'
              }`}
            >
              {/* Type indicator */}
              <div className="mt-0.5 flex-shrink-0">
                {n.type === 'critical' && <AlertTriangle className="text-red-500" size={18} />}
                {n.type === 'major' && <AlertTriangle className="text-amber-500" size={18} />}
                {n.type === 'minor' && <Clock className="text-yellow-500" size={18} />}
                {n.type === 'healthy' && <CheckCircle className="text-emerald-500" size={18} />}
              </div>

              {/* Text */}
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start gap-4">
                  <h4 className="text-xs font-black text-zinc-950 leading-snug">{n.title}</h4>
                  <span className="text-[9px] text-zinc-400 font-mono whitespace-nowrap">{n.timestamp}</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{n.message}</p>
              </div>

              {/* Unread dot */}
              {!n.read && (
                <div className="w-2.5 h-2.5 rounded-full bg-lime-400 border border-lime-500 self-center flex-shrink-0 animate-pulse" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
