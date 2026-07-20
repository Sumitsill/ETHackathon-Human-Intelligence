"use client";

import React from 'react';
import { useNetwork } from '@/context/NetworkContext';
import { WifiOff } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const { isOnline } = useNetwork();

  if (isOnline) return null;

  return (
    <div className="bg-red-600 text-white py-2 px-4 text-center text-sm font-semibold flex items-center justify-center gap-2 animate-pulse sticky top-0 z-50 shadow-md">
      <WifiOff size={16} />
      <span>You are currently offline. Actions are queued and will sync when connection is restored.</span>
    </div>
  );
};
