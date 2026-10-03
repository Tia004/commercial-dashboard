'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface UserPasskey { id: string; name: string; createdAt: string; rawId: string; type: string }
export interface AuthUser { id: string; name: string; email: string; company?: string; role: string; hasPasskey: boolean; passkeys: UserPasskey[] }
type Result = { success: boolean; error?: string };
interface AuthContextType {
  user: AuthUser | null; isAuthenticated: boolean; isLoading: boolean;
  isAuthModalOpen: boolean; setIsAuthModalOpen: (open: boolean) => void;
  authMode: 'login' | 'register'; setAuthMode: (mode: 'login' | 'register') => void;
  loginWithPassword: (email: string, pass: string) => Promise<Result>;
  registerUser: (name: string, email: string, pass: string, company?: string, role?: string) => Promise<Result>;
  logout: () => void;
  isPasskeySupported: boolean;
  registerPasskey: (name?: string) => Promise<Result & { passkey?: UserPasskey }>;
  loginWithPasskey: () => Promise<Result>;
  removePasskey: (id: string) => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  useEffect(() => {
    fetch('/api/auth', { cache: 'no-store' }).then((r) => r.json()).then((data) => setUser(data.user || null))
      .catch(() => setUser(null)).finally(() => setIsLoading(false));
  }, []);
  const submit = async (body: Record<string, string>): Promise<Result> => {
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.error || 'Operazione non riuscita.' };
      setUser(data.user); setIsAuthModalOpen(false); return { success: true };
    } catch { return { success: false, error: 'Connessione non disponibile. Riprova.' }; }
  };
  const logout = () => { setUser(null); void fetch('/api/auth', { method: 'DELETE' }); };
  const unsupported = async () => ({ success: false, error: 'Le passkey richiedono verifica sul server e non sono ancora disponibili.' });
  return <AuthContext.Provider value={{
    user, isAuthenticated: !!user, isLoading, isAuthModalOpen, setIsAuthModalOpen, authMode, setAuthMode,
    loginWithPassword: (email, password) => submit({ action: 'login', email, password }),
    registerUser: (name, email, password, company) => submit({ action: 'register', name, email, password, company: company || '' }),
    logout, isPasskeySupported: false, registerPasskey: unsupported, loginWithPasskey: unsupported, removePasskey: () => {},
  }}>{children}</AuthContext.Provider>;
};
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('AuthProvider mancante'); return context; }
