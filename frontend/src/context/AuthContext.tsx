"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export type UserRole = 'technician' | 'engineer' | 'compliance_officer' | 'knowledge_admin' | 'plant_admin';

export const ROLE_DETAILS: Record<UserRole, { label: string; defaultRoute: string; description: string }> = {
  plant_admin: {
    label: 'Plant Manager (All features)',
    defaultRoute: '/app',
    description: 'Macro visibility, Brain Sync alerts, and full cross-module access.',
  },
  engineer: {
    label: 'Reliability Maintenance Engineer',
    defaultRoute: '/app/maintenance',
    description: 'Deep analytical troubleshooting, 5-Why RCA workbench, and telemetry graphs.',
  },
  compliance_officer: {
    label: 'Quality Compliance Officer',
    defaultRoute: '/app/compliance',
    description: 'Rule scans, Traffic Light compliance grid, and audit package compilation.',
  },
  knowledge_admin: {
    label: 'Knowledge Engineer',
    defaultRoute: '/app/knowledge/ingest',
    description: 'Multi-format document ingestion, Vision OCR tuning, and Knowledge Graph management.',
  },
  technician: {
    label: 'Field Operator / Technician',
    defaultRoute: '/app/tasks',
    description: 'Glove-friendly, voice-guided task execution and low-bandwidth Copilot.',
  },
};

interface AuthContextType {
  user: User | null;
  loading: boolean;
  roles: UserRole[];
  currentActiveRole: UserRole;
  switchRole: (role: UserRole) => void;
  signOut: () => Promise<void>;
  signInWithMock: (email: string, roles: UserRole[]) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<UserRole[]>(['technician']);
  const [currentActiveRole, setCurrentActiveRole] = useState<UserRole>('technician');

  useEffect(() => {
    // Check local storage for mock session first
    const mockUser = localStorage.getItem('mock_user');
    const mockRoles = localStorage.getItem('mock_roles');
    const mockActiveRole = localStorage.getItem('mock_active_role');

    if (mockUser && mockRoles && mockActiveRole) {
      setUser(JSON.parse(mockUser));
      setRoles(JSON.parse(mockRoles));
      setCurrentActiveRole(mockActiveRole as UserRole);
      setLoading(false);
      return;
    }

    // Otherwise, check real Supabase session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        // Map metadata roles or defaults
        const userRoles = (session.user.user_metadata?.roles as UserRole[]) || ['technician'];
        setRoles(userRoles);
        setCurrentActiveRole(userRoles[0] || 'technician');
      }
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        const userRoles = (session.user.user_metadata?.roles as UserRole[]) || ['technician'];
        setRoles(userRoles);
        setCurrentActiveRole(userRoles[0] || 'technician');
      } else {
        setUser(null);
        setRoles(['technician']);
        setCurrentActiveRole('technician');
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const switchRole = (role: UserRole) => {
    setCurrentActiveRole(role);
    localStorage.setItem('mock_active_role', role);
  };

  const signInWithMock = (email: string, selectRoles: UserRole[]) => {
    const dummyUser: any = {
      id: 'mock-user-id-12345',
      email: email,
      user_metadata: { roles: selectRoles },
      aud: 'authenticated',
      created_at: new Date().toISOString()
    };
    setUser(dummyUser);
    setRoles(selectRoles);
    setCurrentActiveRole(selectRoles[0]);
    localStorage.setItem('mock_user', JSON.stringify(dummyUser));
    localStorage.setItem('mock_roles', JSON.stringify(selectRoles));
    localStorage.setItem('mock_active_role', selectRoles[0]);
  };

  const signOut = async () => {
    localStorage.removeItem('mock_user');
    localStorage.removeItem('mock_roles');
    localStorage.removeItem('mock_active_role');
    setUser(null);
    setRoles(['technician']);
    setCurrentActiveRole('technician');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      roles,
      currentActiveRole,
      switchRole,
      signOut,
      signInWithMock
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      loading: false,
      roles: ['plant_admin' as UserRole],
      currentActiveRole: 'plant_admin' as UserRole,
      switchRole: () => {},
      signOut: async () => {},
      signInWithMock: (email: string, selectRoles: UserRole[]) => {
        if (typeof window !== 'undefined') {
          const dummyUser: any = { id: 'mock-user-123', email, user_metadata: { roles: selectRoles } };
          localStorage.setItem('mock_user', JSON.stringify(dummyUser));
          localStorage.setItem('mock_roles', JSON.stringify(selectRoles));
          localStorage.setItem('mock_active_role', selectRoles[0]);
        }
      }
    };
  }
  return context;
};
