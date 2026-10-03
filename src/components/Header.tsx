'use client';
import React from 'react';
import { useCRM } from '@/lib/store';
import { useAuth } from '@/lib/auth';
interface Props { onMenu: () => void }
export const Header: React.FC<Props> = ({ onMenu }) => {
  const { brands, salesReps, selectedBrand, selectedRep, searchQuery, theme, syncStatus, setSelectedBrand, setSelectedRep, setSearchQuery, setTheme, setIsNewDealModalOpen, setIsSettingsModalOpen } = useCRM();
  const { user, setIsAuthModalOpen } = useAuth();
  return <header className="app-header">
    <div className="header-leading"><button className="menu-trigger" onClick={onMenu} aria-label="Apri menu"><span className="material-symbols-outlined">menu</span></button><span className="header-section">Workspace <span>/</span> Vendite</span></div>
    <div className="header-search"><span className="material-symbols-outlined">search</span><input aria-label="Cerca opportunità" placeholder="Cerca clienti, aziende, servizi…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />{searchQuery && <button aria-label="Cancella ricerca" onClick={() => setSearchQuery('')}><span className="material-symbols-outlined">close</span></button>}</div>
    <div className="header-actions">
      <label className="header-select"><span className="material-symbols-outlined">layers</span><select aria-label="Filtra per brand" value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}><option value="all">Tutti i brand</option>{brands.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
      <label className="header-select rep-select"><span className="material-symbols-outlined">person_outline</span><select aria-label="Filtra per commerciale" value={selectedRep} onChange={(e) => setSelectedRep(e.target.value)}><option value="all">Tutto il team</option>{salesReps.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}</select></label>
      <span className={`sync-indicator ${syncStatus}`} title={syncStatus === 'error' ? 'Salvataggio non riuscito: verifica la connessione' : syncStatus === 'saved' ? 'Dati salvati' : 'Sincronizzazione in corso'} aria-label={`Stato dati: ${syncStatus}`} />
      <button className="header-icon" onClick={() => setTheme(theme === 'light' ? 'slate' : theme === 'slate' ? 'oled' : 'light')} title={`Tema: ${theme}`} aria-label="Cambia tema"><span className="material-symbols-outlined">{theme === 'light' ? 'dark_mode' : theme === 'slate' ? 'contrast' : 'light_mode'}</span></button>
      <button className="header-icon settings-trigger" onClick={() => setIsSettingsModalOpen(true)} aria-label="Impostazioni"><span className="material-symbols-outlined">settings</span></button>
      <button className="header-new" onClick={() => setIsNewDealModalOpen(true)}><span className="material-symbols-outlined">add</span><span>Nuova opportunità</span></button>
      <button className="profile-trigger" onClick={() => setIsAuthModalOpen(true)} aria-label="Gestisci account" title={user?.name}>{user?.name?.slice(0, 2).toUpperCase() || 'HC'}</button>
    </div>
  </header>;
};
