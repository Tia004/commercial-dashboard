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
import { ContactWorkspace, ContactDetail } from '@/components/ContactWorkspace';
import { ChatWorkspace } from '@/components/ChatWorkspace';
import { ExperienceChooser, WorkspaceInviteGate } from '@/components/ExperienceChooser';
import { PresenceBar } from '@/components/PresenceBar';
import { ModalFocusManager } from '@/components/ModalFocusManager';

export default function HomePage() {
  const { isAuthenticated, isLoading, authError, refreshSession } = useAuth();
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

  if (authError && !isAuthenticated) return <div className="app-loading"><div className="load-error"><strong>Connessione al workspace non disponibile</strong><p>{authError}</p><button onClick={() => void refreshSession()}>Riprova accesso</button></div></div>;

  // If not authenticated, show the Login/Registration Portal
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="app-shell">
      <ModalFocusManager />
      {/* 1. Fixed Left Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* 2. Main Content Wrapper */}
      <div className="app-main-wrap">
        {/* Fixed Top Header */}
        <Header showBrandFilter={activeTab !== 'chat'} showRepFilter={!['cockpit','contacts','chat'].includes(activeTab)} onMenu={() => setMobileOpen(true)} onOpenSearch={() => setPaletteOpen(true)} onCreateContact={() => setActiveTab('contacts')} />
        <PresenceBar view={activeTab} />

        {/* Dynamic Main Viewport */}
        <main className="app-main" id="main-content">
          {activeTab === 'cockpit' && <ContactWorkspace overview />}
          {activeTab === 'contacts' && <ContactWorkspace />}
          {activeTab === 'chat' && <ChatWorkspace />}
          {!['cockpit','contacts','chat'].includes(activeTab) && !dataReady && <div className="contact-empty"><p>{syncStatus === 'error' ? 'Dati commerciali temporaneamente non disponibili.' : 'Caricamento dati…'}</p><button className="quiet-button" onClick={() => window.location.reload()}>Riprova</button></div>}
          {activeTab === 'sales' && dataReady && (
            <ExecutiveCockpit onNavigateToTab={(t) => setActiveTab(t)} />
          )}

          {activeTab === 'kanban' && dataReady && <PipelineKanban />}
          {activeTab === 'focus' && dataReady && <SalesFocus />}

          {activeTab === 'opportunities' && dataReady && <OpportunitiesList />}

          {activeTab === 'calendar' && dataReady && <CalendarView />}

          {activeTab === 'standby' && dataReady && <StandbyAlerts />}

          {activeTab === 'analytics' && dataReady && <AnalyticsView />}
        </main>
      </div>

      {/* Modals & Drawers */}
      <ContactDetail />
      <ExperienceChooser onChoose={(mode) => setActiveTab(mode === 'ai' ? 'chat' : 'cockpit')} />
      <WorkspaceInviteGate />
      <DealModal />
      <NextStepModal />
      <NewDealModal />
      <SettingsMcpModal />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={setActiveTab} />
    </div>
  );
}
