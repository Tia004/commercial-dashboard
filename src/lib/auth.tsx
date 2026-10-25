'use client';
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';

export interface UserPasskey { id: string; name: string; createdAt: string; rawId: string; type: string }
export interface AuthUser { id: string; name: string; email: string; company?: string; role: string; workspaceId: string; emailVerified: boolean; hasPasskey: boolean; passkeys: UserPasskey[] }
type Result = { success: boolean; error?: string; message?: string; pendingVerification?: boolean };
interface AuthContextType {
  user: AuthUser | null; isAuthenticated: boolean; isLoading: boolean; authError: string; refreshSession: () => Promise<void>;
  loginWithPassword: (email: string, pass: string) => Promise<Result>;
  registerUser: (name: string, email: string, pass: string, company?: string, role?: string, inviteToken?: string, hpCode?: string) => Promise<Result>;
  logout: () => void;
  isPasskeySupported: boolean;
  registerPasskey: (name?: string) => Promise<Result & { passkey?: UserPasskey }>;
  loginWithPasskey: (email?: string) => Promise<Result>;
  removePasskey: (id: string) => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [authError, setAuthError] = useState('');
  const authVersion = useRef(0);
  const refreshSession = useCallback(async () => {
    const version = ++authVersion.current;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch('/api/auth', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('session');
        const data = await response.json();
        if (version !== authVersion.current) return;
        setUser(data.user || null); setAuthError(''); setIsLoading(false); return;
      } catch { if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 300 * (attempt + 1))); }
    }
    if (version !== authVersion.current) return;
    setAuthError('Il servizio di accesso non risponde. La sessione salvata non è stata cancellata.'); setIsLoading(false);
  }, []);
  useEffect(() => {
    setPasskeySupported(browserSupportsWebAuthn());
    void refreshSession();
    const onFocus = () => void refreshSession();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshSession]);
  const submit = async (body: Record<string, string>): Promise<Result> => {
    authVersion.current++;
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.error || 'Operazione non riuscita.' };
      if (data.pendingVerification) return { success: true, pendingVerification: true, message: data.message };
      setUser(data.user); setAuthError(''); return { success: true };
    } catch { return { success: false, error: 'Connessione non disponibile. Riprova.' }; }
  };
  const logout = async () => {
    authVersion.current++;
    try { const response = await fetch('/api/auth', { method: 'DELETE' }); if (!response.ok) throw Error(); setUser(null); }
    catch { setAuthError('Disconnessione non riuscita. Controlla la connessione e riprova.'); }
  };
  const registerPasskey = async (name?: string): Promise<Result & { passkey?: UserPasskey }> => {
    try {
      const initial = await fetch('/api/auth/passkey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'register-options' }) });
      const options = await initial.json();
      if (!initial.ok) return { success: false, error: options.error };
      const response = await startRegistration({ optionsJSON: options.options });
      const verified = await fetch('/api/auth/passkey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'register-verify', response, ceremonyId: options.ceremonyId, name: name || 'Passkey' }) });
      const data = await verified.json();
      if (!verified.ok) return { success: false, error: data.error };
      setUser(data.user);
      return { success: true, passkey: data.user.passkeys[0] };
    } catch { return { success: false, error: 'La creazione della passkey è stata annullata o non è supportata.' }; }
  };
  const loginWithPasskey = async (email?: string): Promise<Result> => {
    if (!email?.trim()) return { success: false, error: 'Inserisci prima la tua email.' };
    try {
      const initial = await fetch('/api/auth/passkey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login-options', email }) });
      const options = await initial.json();
      if (!initial.ok) return { success: false, error: options.error };
      const response = await startAuthentication({ optionsJSON: options.options });
      const verified = await fetch('/api/auth/passkey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login-verify', email, response, ceremonyId: options.ceremonyId }) });
      const data = await verified.json();
      if (!verified.ok) return { success: false, error: data.error };
      setUser(data.user);
      return { success: true };
    } catch { return { success: false, error: 'Accesso con passkey annullato o non riuscito.' }; }
  };
  const removePasskey = (id: string) => {
    void fetch('/api/auth/passkey', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      .then((r) => r.ok ? r.json() : null).then((data) => { if (data?.user) setUser(data.user); });
  };
  return <AuthContext.Provider value={{
    user, isAuthenticated: !!user, isLoading, authError, refreshSession,
    loginWithPassword: (email, password) => submit({ action: 'login', email, password }),
    registerUser: (name, email, password, company, _role, inviteToken, hpCode) => submit({ action: 'register', name, email, password, company: company || '', inviteToken: inviteToken || '', hp_code: hpCode || '' }),
    logout, isPasskeySupported: passkeySupported, registerPasskey, loginWithPasskey, removePasskey,
  }}>{children}</AuthContext.Provider>;
};
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('AuthProvider mancante'); return context; }
