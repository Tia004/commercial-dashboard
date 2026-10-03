'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Sidebar, ActiveTab } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { ExecutiveCockpit } from '@/components/ExecutiveCockpit';
import { PipelineKanban } from '@/components/PipelineKanban';
import { OpportunitiesList } from '@/components/OpportunitiesList';
import { CalendarView } from '@/components/CalendarView';
import { StandbyAlerts } from '@/components/StandbyAlerts';
import { AnalyticsView } from '@/components/AnalyticsView';
import { DealModal } from '@/components/DealModal';
import { NextStepModal } from '@/components/NextStepModal';
import { NewDealModal } from '@/components/NewDealModal';
import { SettingsMcpModal } from '@/components/SettingsMcpModal';
import { AuthScreen } from '@/components/AuthScreen';
import { SalesFocus } from '@/components/SalesFocus';
import { CommandPalette } from '@/components/CommandPalette';
import { useCRM } from '@/lib/store';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { dataReady, syncStatus } = useCRM();
  const [activeTab, setActiveTab] = useState<ActiveTab>('cockpit');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen((value) => !value); }
      if (event.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  if (isLoading) return <div className="app-loading" role="status">Caricamento workspace…</div>;

  // If not authenticated, show the Login/Registration Portal
  if (!isAuthenticated) {
    return <AuthScreen />;
  }
  if (!dataReady && syncStatus === 'error') return <div className="app-loading"><div className="load-error"><strong>Impossibile caricare i dati</strong><p>Controlla la connessione e la configurazione del database.</p><button onClick={() => window.location.reload()}>Riprova</button></div></div>;
  if (!dataReady) return <div className="app-loading" role="status">Caricamento dati commerciali…</div>;

  return (
    <div className="app-shell">
      {/* 1. Fixed Left Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* 2. Main Content Wrapper */}
      <div className="app-main-wrap">
        {/* Fixed Top Header */}
        <Header onMenu={() => setMobileOpen(true)} onOpenSearch={() => setPaletteOpen(true)} />

        {/* Dynamic Main Viewport */}
        <main className="app-main" id="main-content">
          {activeTab === 'cockpit' && (
            <ExecutiveCockpit onNavigateToTab={(t) => setActiveTab(t)} />
          )}

          {activeTab === 'kanban' && <PipelineKanban />}
          {activeTab === 'focus' && <SalesFocus />}

          {activeTab === 'opportunities' && <OpportunitiesList />}

          {activeTab === 'calendar' && <CalendarView />}

          {activeTab === 'standby' && <StandbyAlerts />}

          {activeTab === 'analytics' && <AnalyticsView />}
        </main>
      </div>

      {/* Modals & Drawers */}
      <DealModal />
      <NextStepModal />
      <NewDealModal />
      <SettingsMcpModal />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={setActiveTab} />
    </div>
  );
}
