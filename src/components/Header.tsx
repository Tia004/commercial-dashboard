'use client';
import React from 'react';
import { useCRM } from '@/lib/store';
import { useAuth } from '@/lib/auth';
interface Props { onMenu: () => void; onOpenSearch: () => void }
export const Header: React.FC<Props> = ({ onMenu, onOpenSearch }) => {
  const { brands, salesReps, selectedBrand, selectedRep, syncStatus, retrySave, setSelectedBrand, setSelectedRep, setIsNewDealModalOpen, setIsSettingsModalOpen } = useCRM();
  const { user } = useAuth();
  return <header className="app-header">
    <div className="header-leading"><button className="menu-trigger" onClick={onMenu} aria-label="Apri menu"><span className="material-symbols-outlined">menu</span></button><span className="header-section">Workspace <span>/</span> Vendite</span></div>
    <button className="header-search" onClick={onOpenSearch} aria-label="Apri ricerca globale"><span className="material-symbols-outlined">search</span><span>Cerca nel workspace</span><kbd>⌘ K</kbd></button>
    <div className="header-actions">
      <label className="header-select"><span className="material-symbols-outlined">layers</span><select aria-label="Filtra per brand" value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}><option value="all">Tutti i brand</option>{brands.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
      <label className="header-select rep-select"><span className="material-symbols-outlined">person_outline</span><select aria-label="Filtra per commerciale" value={selectedRep} onChange={(e) => setSelectedRep(e.target.value)}><option value="all">Tutto il team</option>{salesReps.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}</select></label>
      {syncStatus === 'conflict' ? <button className="sync-action" onClick={() => window.location.reload()}>Dati aggiornati altrove · Ricarica</button> : syncStatus === 'error' ? <button className="sync-action" onClick={retrySave}>Salvataggio non riuscito · Riprova</button> : <span className={`sync-indicator ${syncStatus}`} title={syncStatus === 'saved' ? 'Dati salvati' : 'Sincronizzazione in corso'} aria-label={`Stato dati: ${syncStatus}`} />}
      <button className="header-icon settings-trigger" onClick={() => setIsSettingsModalOpen(true)} aria-label="Impostazioni"><span className="material-symbols-outlined">settings</span></button>
      <button className="header-new" onClick={() => setIsNewDealModalOpen(true)}><span className="material-symbols-outlined">add</span><span>Nuova opportunità</span></button>
      <button className="profile-trigger" onClick={() => setIsSettingsModalOpen(true)} aria-label="Gestisci account" title={user?.name}><span className="material-symbols-outlined">person_outline</span></button>
    </div>
  </header>;
};
