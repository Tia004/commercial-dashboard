'use client';

import React from 'react';
import { useCRM } from '@/lib/store';

export type ActiveTab =
  | 'cockpit'
  | 'kanban'
  | 'opportunities'
  | 'calendar'
  | 'standby'
  | 'analytics';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { alerts, kpis, setIsNewDealModalOpen, setIsSettingsModalOpen } = useCRM();

  const urgentAlertsCount = alerts.filter((a) => a.severity === 'urgent').length;

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-low z-40 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-outline-variant/30">
      <div className="flex flex-col">
        {/* Brand Logo Header */}
        <div className="h-16 px-space-md flex items-center justify-between border-b border-outline-variant/20 bg-surface-container-low">
          <div className="flex items-center gap-space-sm cursor-pointer" onClick={() => setActiveTab('cockpit')}>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary font-headline font-bold text-lg tracking-tight shadow-sm">
              HC
            </div>
            <div className="flex flex-col">
              <span className="font-headline font-bold text-base tracking-tight text-on-surface leading-tight">
                Hub Commerciale
              </span>
              <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                Multi-Brand Executive
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-outline text-[18px]" title="Enterprise Certified Hub">
            verified
          </span>
        </div>

        {/* Section title */}
        <div className="px-space-md pt-4 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-outline px-2">
            Operatività Commerciale
          </span>
        </div>

        {/* Navigation items */}
        <nav className="flex flex-col gap-1 px-3">
          <button
            onClick={() => setActiveTab('cockpit')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
              activeTab === 'cockpit'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">grid_view</span>
            <span>Panoramica & Cockpit</span>
          </button>

          <button
            onClick={() => setActiveTab('kanban')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
              activeTab === 'kanban'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">view_kanban</span>
            <span>Pipeline Kanban</span>
          </button>

          <button
            onClick={() => setActiveTab('opportunities')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
              activeTab === 'opportunities'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">inventory_2</span>
            <span>Opportunità & Lead</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
              activeTab === 'calendar'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
            <span>Attività & Calendario</span>
          </button>

          <button
            onClick={() => setActiveTab('standby')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
              activeTab === 'standby'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              <span>Stand-by & Alert</span>
            </div>
            {urgentAlertsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-error text-white font-bold text-[11px] animate-pulse">
                {urgentAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
              activeTab === 'analytics'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">query_stats</span>
            <span>Analytics & Performance</span>
          </button>
        </nav>

        {/* Quick Add Button */}
        <div className="px-4 mt-4">
          <button
            onClick={() => setIsNewDealModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-surface-container-highest hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors border border-outline-variant/40"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Crea Opportunità</span>
          </button>
        </div>
      </div>

      {/* Footer Pipeline summary widget */}
      <div className="p-4 flex flex-col gap-3 bg-surface-container border-t border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-outline">
            Pipeline Ponderata
          </span>
          <span className="text-xs font-semibold text-on-surface">
            {kpis.winRate}% Win-rate
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-headline font-bold text-lg text-on-surface tracking-tight">
            € {kpis.pipelineTotal.toLocaleString()}
          </span>
          <span className="font-mono text-xs text-on-surface-variant">
            Target: €800k
          </span>
        </div>
        <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round((kpis.pipelineTotal / 800000) * 100))}%` }}
          />
        </div>

        {/* MCP & Settings link */}
        <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between">
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">extension</span>
            <span className="font-medium">MCP Server & AI Setup</span>
          </button>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" title="MCP Server Ready" />
        </div>
      </div>
    </aside>
  );
};
