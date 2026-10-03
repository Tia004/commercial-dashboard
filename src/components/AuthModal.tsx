'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    authMode,
    setAuthMode,
    loginWithPassword,
    registerUser,
    loginWithPasskey,
    isPasskeySupported,
    user,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    if (authMode === 'login') {
      const res = await loginWithPassword(email, password);
      if (!res.success) setErrorMsg(res.error || 'Accesso non riuscito');
    } else {
      const res = await registerUser(name, email, password);
      if (!res.success) setErrorMsg(res.error || 'Registrazione non riuscita');
    }
    setIsLoading(false);
  };

  const handlePasskeyAuth = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await loginWithPasskey();
    if (!res.success) setErrorMsg(res.error || 'Autenticazione biometrica non riuscita');
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest max-w-md w-full rounded-3xl p-6 shadow-2xl border border-outline-variant/40 flex flex-col gap-5 animate-scale-up">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[24px]">lock</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Autenticazione Sicura
              </span>
              <h3 className="font-headline font-bold text-xl text-on-surface">
                {authMode === 'login' ? 'Accedi a Hub Commerciale' : 'Registra Account Commerciale'}
              </h3>
            </div>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher: Login / Register */}
        <div className="grid grid-cols-2 p-1 bg-surface-container rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              authMode === 'login'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Accedi
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              authMode === 'register'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Registrati
          </button>
        </div>

        {/* Passkey Biometric Fast Login Button */}
        {authMode === 'login' && isPasskeySupported && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handlePasskeyAuth}
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-xs border border-primary/40 flex items-center justify-center gap-2.5 transition-all shadow-sm hover:border-primary group"
            >
              <span className="material-symbols-outlined text-primary text-[22px] group-hover:scale-110 transition-transform">
                fingerprint
              </span>
              <span>Accedi con Passkey (Touch ID / Windows Hello)</span>
            </button>
            <div className="flex items-center gap-2 text-[10px] text-outline uppercase tracking-wider justify-center">
              <span className="w-12 h-px bg-outline-variant/40" />
              <span>oppure con email</span>
              <span className="w-12 h-px bg-outline-variant/40" />
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
          {authMode === 'register' && (
            <div>
              <label className="font-bold text-on-surface-variant block mb-1">
                Nome e Cognome *
              </label>
              <input
                type="text"
                required
                placeholder="Marco Ferri"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
              />
            </div>
          )}

          <div>
            <label className="font-bold text-on-surface-variant block mb-1">
              Indirizzo Email *
            </label>
            <input
              type="email"
              required
              placeholder="commerciale@omnihub.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-on-surface-variant block mb-1">
              Password *
            </label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none font-mono"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-emerald-500">verified</span>
              Sessione crittografata
            </span>
            <span className="text-primary hover:underline cursor-pointer">
              Password dimenticata?
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-xs uppercase tracking-wider shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-1.5 mt-2 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">
                  {authMode === 'login' ? 'login' : 'person_add'}
                </span>
                <span>{authMode === 'login' ? 'Accedi al CRM' : 'Crea Account'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
