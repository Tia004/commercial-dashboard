'use client';

import React from 'react';
import { useCRM } from '@/lib/store';
import { useAuth } from '@/lib/auth';

export const Header: React.FC = () => {
  const {
    brands,
    salesReps,
    selectedBrand,
    selectedRep,
    searchQuery,
    theme,
    setSelectedBrand,
    setSelectedRep,
    setSearchQuery,
    setTheme,
    setIsNewDealModalOpen,
    setIsSettingsModalOpen,
  } = useCRM();

  const { user, isAuthenticated, setIsAuthModalOpen } = useAuth();

  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-30 flex items-center justify-between px-6 border-b border-outline-variant/30">
      {/* Left side filters: Brand, Sales Rep, Global Search */}
      <div className="flex items-center gap-3">
        {/* Brand Dropdown */}
        <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/30">
          <span className="material-symbols-outlined text-outline text-[18px]">corporate_fare</span>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="bg-transparent text-on-surface text-xs font-semibold outline-none cursor-pointer pr-1"
          >
            <option value="all">Tutti i Brand</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        {/* Rep Dropdown */}
        <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/30">
          <span className="material-symbols-outlined text-outline text-[18px]">badge</span>
          <select
            value={selectedRep}
            onChange={(e) => setSelectedRep(e.target.value)}
            className="bg-transparent text-on-surface text-xs font-semibold outline-none cursor-pointer pr-1"
          >
            <option value="all">Sales Rep: Tutti</option>
            {salesReps.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="hidden lg:flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/30 w-64 focus-within:w-80 transition-all">
          <span className="material-symbols-outlined text-outline text-[18px]">search</span>
          <input
            type="text"
            placeholder="Cerca cliente, azienda, servizio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-on-surface text-xs outline-none w-full placeholder:text-on-surface-variant/60"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-outline hover:text-on-surface text-xs">
              ✕
            </button>
          )}
        </div>

        {/* AI Engine Status Badge */}
        <div className="hidden xl:flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full border border-outline-variant/30">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider">
            AI Engine Attivo
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-primary font-mono font-semibold">
            Multi-LLM
          </span>
        </div>
      </div>

      {/* Right side: Themes, New Deal Action, Settings Gear & Profile */}
      <div className="flex items-center gap-3">
        {/* Triple Theme Switcher: Light, Slate Dark, OLED Pure Black */}
        <div className="inline-flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 shadow-sm">
          <button
            onClick={() => setTheme('light')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              theme === 'light'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="Tema Porcellana Chiaro"
          >
            <span className="material-symbols-outlined text-[15px]">light_mode</span>
            <span>Light</span>
          </button>

          <button
            onClick={() => setTheme('slate')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              theme === 'slate'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="Tema Grafite Ardesia Scuro"
          >
            <span className="material-symbols-outlined text-[15px]">dark_mode</span>
            <span>Dark</span>
          </button>

          <button
            onClick={() => setTheme('oled')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              theme === 'oled'
                ? 'bg-primary text-on-primary shadow-sm border border-outline'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="Tema Nero Assoluto OLED #000000"
          >
            <span className="material-symbols-outlined text-[15px]">contrast</span>
            <span>OLED</span>
          </button>
        </div>

        {/* Primary New Deal Button */}
        <button
          onClick={() => setIsNewDealModalOpen(true)}
          className="flex items-center gap-1.5 bg-primary text-on-primary px-3.5 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Nuova Opportunità</span>
        </button>

        {/* Settings Gear Button ("dietro il solito ingranaggio") */}
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="w-9 h-9 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center justify-center border border-outline-variant/30 transition-all shadow-sm hover:border-primary group"
          title="Impostazioni Dashboard, AI, Turso e Passkey"
        >
          <span className="material-symbols-outlined text-[20px] text-outline group-hover:text-primary transition-colors group-hover:rotate-45 transition-transform duration-300">
            settings
          </span>
        </button>

        {/* User Profile & Auth Trigger */}
        <div
          onClick={() => setIsAuthModalOpen(true)}
          className="flex items-center gap-2 pl-2 border-l border-outline-variant/30 cursor-pointer group"
          title="Clicca per gestire account o cambiare utente"
        >
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-on-surface leading-tight group-hover:text-primary transition-colors flex items-center gap-1 justify-end">
              {user?.name || 'Accedi'}
              {user?.hasPasskey && (
                <span className="material-symbols-outlined text-[14px] text-emerald-500" title="Passkey Attiva">
                  fingerprint
                </span>
              )}
            </span>
            <span className="text-[10px] text-on-surface-variant font-medium">
              {user?.role || 'Autenticazione'}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs shadow-sm group-hover:scale-105 transition-transform">
            {user ? user.name.substring(0, 2).toUpperCase() : 'AR'}
          </div>
        </div>
      </div>
    </header>
  );
};
