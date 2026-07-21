"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface PwaContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  installPwa: () => Promise<void>;
  showInstallModal: boolean;
  setShowInstallModal: (show: boolean) => void;
  installProgress: number;
  isPwaModeActive: boolean;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

export const PwaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isPwaModeActive, setIsPwaModeActive] = useState(false);
  
  // Install Modal & Progress
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already running in standalone mode (installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
    
    setIsInstalled(isStandalone);
    if (isStandalone) {
      setIsPwaModeActive(true);
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered with scope:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    }

    // Listen for the PWA install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('beforeinstallprompt event fired and captured');
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      console.log('PWA was installed successfully');
      setIsInstalled(true);
      setIsPwaModeActive(true);
      setDeferredPrompt(null);
      setIsInstallable(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Retrieve simulated PWA state from localStorage (for offline/simulated testing)
    const localPwaMode = localStorage.getItem('simulated_pwa_mode') === 'true';
    if (localPwaMode) {
      setIsPwaModeActive(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installPwa = async () => {
    setShowInstallModal(true);
    setInstallProgress(5);

    // Function to simulate progress increments
    const runProgressSimulation = (finalProgress: number, duration: number) => {
      return new Promise<void>((resolve) => {
        let current = 5;
        const interval = setInterval(() => {
          current += Math.floor(Math.random() * 15) + 5;
          if (current >= finalProgress) {
            current = finalProgress;
            clearInterval(interval);
            resolve();
          }
          setInstallProgress(current);
        }, duration / 8);
      });
    };

    if (deferredPrompt) {
      try {
        // Trigger native prompt
        await runProgressSimulation(60, 800);
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User choice outcome: ${outcome}`);
        
        if (outcome === 'accepted') {
          await runProgressSimulation(100, 400);
          setIsInstalled(true);
          setIsPwaModeActive(true);
          localStorage.setItem('simulated_pwa_mode', 'true');
        } else {
          // Reset if canceled
          setShowInstallModal(false);
          setInstallProgress(0);
        }
      } catch (err) {
        console.error('Error during PWA prompt:', err);
        // Fallback to simulated download
        await runProgressSimulation(100, 1500);
        setIsPwaModeActive(true);
        localStorage.setItem('simulated_pwa_mode', 'true');
      }
      setDeferredPrompt(null);
      setIsInstallable(false);
    } else {
      // Browser doesn't support or prompt isn't available (e.g. Safari, iOS, or already installed)
      // Provide a beautiful simulated install + active PWA state
      await runProgressSimulation(100, 2000);
      setIsPwaModeActive(true);
      localStorage.setItem('simulated_pwa_mode', 'true');
    }
  };

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isInstalled,
        installPwa,
        showInstallModal,
        setShowInstallModal,
        installProgress,
        isPwaModeActive
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = () => {
  const context = useContext(PwaContext);
  if (context === undefined) {
    throw new Error('usePwa must be used within a PwaProvider');
  }
  return context;
};
