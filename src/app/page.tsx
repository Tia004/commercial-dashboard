'use client';

import React, { useState } from 'react';
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
import { AuthModal } from '@/components/AuthModal';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('cockpit');

  return (
    <div className="flex min-h-screen bg-surface text-on-surface antialiased">
      {/* 1. Fixed Left Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* 2. Main Content Wrapper */}
      <div className="pl-72 flex flex-col flex-1 min-h-screen w-full">
        {/* Fixed Top Header */}
        <Header />

        {/* Dynamic Main Viewport */}
        <main className="w-full pt-20 px-6 lg:px-8 flex-1">
          {activeTab === 'cockpit' && (
            <ExecutiveCockpit onNavigateToTab={(t) => setActiveTab(t)} />
          )}

          {activeTab === 'kanban' && <PipelineKanban />}

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
      <AuthModal />
    </div>
  );
}
