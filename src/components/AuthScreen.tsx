'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useCRM } from '@/lib/store';

export const AuthScreen: React.FC = () => {
  const {
    loginWithPassword,
    registerUser,
    loginWithPasskey,
    isPasskeySupported,
  } = useAuth();

  const { theme, setTheme } = useCRM();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('Direttore Commerciale');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    if (mode === 'login') {
      const res = await loginWithPassword(email, password);
      if (!res.success) setErrorMsg(res.error || 'Accesso non riuscito');
    } else {
      const res = await registerUser(name, email, password, company, role);
      if (!res.success) setErrorMsg(res.error || 'Registrazione non riuscita');
    }
    setIsLoading(false);
  };

  const handlePasskey = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await loginWithPasskey();
    if (!res.success) setErrorMsg(res.error || 'Autenticazione biometrica fallita');
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen w-full bg-surface flex flex-col justify-between p-4 md:p-8 antialiased">
      {/* Top Bar with Brand & Theme Switcher */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-on-primary font-headline font-bold text-base flex items-center justify-center shadow-sm">
            HC
          </div>
          <div className="flex flex-col">
            <span className="font-headline font-bold text-base tracking-tight text-on-surface leading-tight">
              Hub Commerciale
            </span>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              NoLimits • Webissimo • Sapori
            </span>
          </div>
        </div>

        {/* Theme switcher */}
        <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shadow-sm text-xs">
          <button
            onClick={() => setTheme('light')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
              theme === 'light' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">light_mode</span>
            <span>Light</span>
          </button>
          <button
            onClick={() => setTheme('slate')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
              theme === 'slate' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">dark_mode</span>
            <span>Dark</span>
          </button>
          <button
            onClick={() => setTheme('oled')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
              theme === 'oled' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">contrast</span>
            <span>OLED</span>
          </button>
        </div>
      </div>

      {/* Main Center Auth Card */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-xl border border-outline-variant/40 flex flex-col gap-5">
          {/* Card Title */}
          <div className="text-center flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-surface-container text-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[26px]">
                {mode === 'login' ? 'lock' : 'person_add'}
              </span>
            </div>
            <h1 className="font-headline font-bold text-2xl text-on-surface tracking-tight">
              {mode === 'login' ? 'Accedi al CRM Commerciale' : 'Registra Nuovo Account'}
            </h1>
            <p className="text-xs text-on-surface-variant max-w-xs">
              {mode === 'login'
                ? 'Inserisci le tue credenziali o autenticati con la tua Passkey biometrica.'
                : 'Crea il tuo profilo per gestire vendite, pipeline e compiti aziendali.'}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-surface-container rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Accedi
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
              }}
              className={`py-2 rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Registrati
            </button>
          </div>

          {/* Biometric Passkey Login if supported */}
          {mode === 'login' && isPasskeySupported && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handlePasskey}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-bold text-xs border border-primary/40 flex items-center justify-center gap-2.5 transition-all shadow-sm hover:border-primary group"
              >
                <span className="material-symbols-outlined text-primary text-[22px] group-hover:scale-110 transition-transform">
                  fingerprint
                </span>
                <span>Accedi con Touch ID / Windows Hello</span>
              </button>
              <div className="flex items-center gap-2 text-[10px] text-outline uppercase tracking-wider justify-center">
                <span className="w-12 h-px bg-outline-variant/40" />
                <span>oppure inserisci email</span>
                <span className="w-12 h-px bg-outline-variant/40" />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 text-xs">
            {mode === 'register' && (
              <>
                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">
                    Nome e Cognome *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Mario Rossi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">
                    Azienda di Riferimento
                  </label>
                  <input
                    type="text"
                    placeholder="Omnihub Group S.r.l."
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">
                    Ruolo Commerciale
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none cursor-pointer"
                  >
                    <option value="Direttore Commerciale">Direttore Commerciale (Admin)</option>
                    <option value="Senior Sales Closer">Senior Sales Closer</option>
                    <option value="Enterprise Key Account">Enterprise Key Account</option>
                    <option value="Sales Representative">Sales Representative</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="font-bold text-on-surface-variant block mb-1">
                Indirizzo Email *
              </label>
              <input
                type="email"
                required
                placeholder="tuo.nome@azienda.it"
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
                placeholder="Minimo 6 caratteri"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none font-mono"
              />
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
                    {mode === 'login' ? 'login' : 'check'}
                  </span>
                  <span>{mode === 'login' ? 'Accedi al CRM' : 'Crea Account & Inizia'}</span>
                </>
              )}
            </button>
          </form>

          {/* Clean Slate Guarantee note */}
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20 flex items-center gap-2 text-[11px] text-on-surface-variant">
            <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
            <span>
              La dashboard viene inizializzata pulita (tutti i valori impostati a zero: 0€ venduto, 0 trattative).
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl w-full mx-auto text-center text-xs text-on-surface-variant">
        <span>Hub Commerciale Multi-Brand • NoLimits, Webissimo, Sapori • Sicurezza WebAuthn FIDO2</span>
      </div>
    </div>
  );
};
