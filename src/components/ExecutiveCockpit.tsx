'use client';

import { italianDateKey } from '@/lib/date';

import React from 'react';
import { useCRM } from '@/lib/store';
import { playAiBriefing, stopAllAudio, getSavedVoice } from '@/lib/speechVoice';
import { CommercialTask, Opportunity } from '@/types/crm';
import { getBrandBadge } from '@/lib/brandBadges';

interface ExecutiveCockpitProps {
  onNavigateToTab: (tab: any) => void;
}

export const ExecutiveCockpit: React.FC<ExecutiveCockpitProps> = ({ onNavigateToTab }) => {
  const {
    kpis,
    tasks,
    opportunities,
    brands,
    addBrand,
    alerts,
    completeTask,
    setSelectedDeal,
    triggerNextStepPrompt,
    selectedBrand,
    selectedRep,
    syncStatus,
    setIsNewDealModalOpen,
  } = useCRM();

  const [briefingState, setBriefingState] = React.useState<'idle' | 'generating' | 'playing'>('idle');
  const [briefingText, setBriefingText] = React.useState<string | null>(null);
  const [activeVoice, setActiveVoice] = React.useState<string>('Aoede');

  React.useEffect(() => {
    setActiveVoice(getSavedVoice());
    return () => {
      stopAllAudio();
    };
  }, []);

  const handleStartBriefing = async () => {
    if (briefingState === 'playing') {
      stopAllAudio();
      setBriefingState('idle');
      return;
    }

    stopAllAudio();
    setBriefingState('generating');
    setBriefingText(null);
    const chosenVoice = getSavedVoice();
    setActiveVoice(chosenVoice);

    await playAiBriefing({
      voice: chosenVoice,
      crmContext: {
        pipelineTotal: kpis.pipelineTotal,
        openDealsCount: kpis.openDealsCount,
        todayTasksCount: todayTasks.length,
        brands: brands,
        urgentDeals: opportunities
          .filter((o) => o.stage !== 'Venduta' && o.stage !== 'Persa')
          .slice(0, 3)
          .map((o) => `${o.company} (€${o.value})`),
      },
      onGenerating: () => setBriefingState('generating'),
      onStart: () => setBriefingState('playing'),
      onText: (text) => setBriefingText(text),
      onEnd: () => setBriefingState('idle'),
      onError: (err) => {
        console.warn('Briefing error:', err);
        setBriefingState('idle');
      },
    });
  };

  const today = italianDateKey();

  // Activities for Today
  const todayTasks = tasks.filter(
    (t) =>
      t.date <= today &&
      t.status !== 'Completata' &&
      (selectedBrand === 'all' || t.brand.toLowerCase() === selectedBrand.toLowerCase()) &&
      (selectedRep === 'all' || t.assignedTo === selectedRep)
  );

  // Deals without next action that must be planned today
  const dealsWithoutAction = opportunities.filter(
    (d) =>
      d.stage !== 'Venduta' &&
      d.stage !== 'Persa' &&
      d.stage !== 'Stand-by' &&
      (!d.nextAction || !d.nextAction.what || d.nextAction.completed) &&
      (selectedBrand === 'all' || d.brand.toLowerCase() === selectedBrand.toLowerCase()) &&
      (selectedRep === 'all' || d.salesRep === selectedRep)
  );

  // Recent Won Sales
  const closedSales = opportunities
    .filter((d) => d.stage === 'Venduta')
    .slice(0, 4);
  const closedCount = opportunities.filter((d) => d.stage === 'Venduta' || d.stage === 'Persa').length;

  // Stand-by deals
  const standbyDeals = opportunities.filter(
    (d) =>
      d.stage === 'Stand-by' &&
      (selectedBrand === 'all' || d.brand.toLowerCase() === selectedBrand.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'chiamata':
        return 'call';
      case 'follow-up':
        return 'history';
      case 'appuntamento':
        return 'video_call';
      case 'preventivo':
        return 'request_quote';
      case 'whatsapp':
        return 'chat';
      case 'standby-wake':
        return 'alarm_on';
      default:
        return 'task_alt';
    }
  };

  return (
    <div className="flex flex-col gap-3.5 max-w-[1440px] mx-auto w-full">
      {/* 1. Header Console Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
              VENDITE / PANORAMICA
            </span>
          </div>
          <h1 className="font-headline font-bold text-xl md:text-2xl text-on-surface tracking-tight mt-0.5">
            Il tuo spazio commerciale
          </h1>
          <p className="text-xs text-on-surface-variant">
            Le priorità di oggi, i risultati e le opportunità da seguire.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* AI Voice Briefing Direct Button */}
          {briefingState === 'idle' && (
            <button
              onClick={handleStartBriefing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 text-zinc-900 dark:border-white/10 dark:bg-[#121316] dark:hover:bg-[#16171d] dark:hover:border-white/20 dark:text-white text-xs font-medium transition-all group shadow-xs cursor-pointer"
              title="Avvia la sintesi vocale del briefing commerciale di oggi"
            >
              <span className="material-symbols-outlined text-[16px] text-zinc-500 dark:text-zinc-300 group-hover:scale-105 transition-transform">
                volume_up
              </span>
              <span>Briefing del Giorno</span>
            </button>
          )}

          {briefingState === 'generating' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-white/16 dark:bg-white/[0.04] dark:text-white text-xs font-medium animate-pulse">
              <span className="material-symbols-outlined text-[15px] text-zinc-600 dark:text-zinc-300 animate-spin">progress_activity</span>
              <span>Generazione briefing AI…</span>
            </div>
          )}

          {briefingState === 'playing' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-900 dark:border-white/20 dark:bg-[#14151a] dark:text-white text-xs font-medium shadow-xs">
                <div className="flex items-end gap-0.5 h-3.5 w-4 mr-0.5">
                  <span className="w-1 bg-zinc-900 dark:bg-zinc-200 rounded-full animate-wave-1 h-2" />
                  <span className="w-1 bg-zinc-900 dark:bg-zinc-200 rounded-full animate-wave-2 h-3.5" />
                  <span className="w-1 bg-zinc-900 dark:bg-zinc-200 rounded-full animate-wave-3 h-1.5" />
                  <span className="w-1 bg-zinc-900 dark:bg-zinc-200 rounded-full animate-wave-4 h-3" />
                </div>
                <span className="text-zinc-900 dark:text-zinc-200 font-semibold text-xs">Briefing in riproduzione</span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">({activeVoice})</span>
              </div>
              <button
                onClick={() => {
                  stopAllAudio();
                  setBriefingState('idle');
                }}
                title="Interrompi riepilogo audio"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 text-xs font-medium transition-all cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[15px]">stop_circle</span>
                <span>Interrompi</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI Motivational Briefing Live Transcript Card */}
      {briefingText && briefingState !== 'idle' && (
        <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 text-xs shadow-sm dark:border-white/10 dark:bg-[#121316] dark:shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 dark:bg-white/[0.05] dark:border-white/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-zinc-700 dark:text-zinc-300 text-[16px]">format_quote</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-zinc-400">Riepilogo Esecutivo & Motivazione Commerciale</span>
                  <span className="text-[10px] text-zinc-400 tabular-nums">· Voce AI {activeVoice}</span>
                </div>
                <p className="text-on-surface leading-relaxed text-xs italic font-medium">
                  &ldquo;{briefingText}&rdquo;
                </p>
              </div>
            </div>
            <button
              onClick={() => setBriefingText(null)}
              className="text-on-surface-variant hover:text-on-surface p-1 rounded-md cursor-pointer"
              title="Nascondi trascrizione"
            >
              <span className="material-symbols-outlined text-[15px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* KPI 1: Venduto */}
        <div className="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between group hover:border-primary/40 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                Venduto
              </span>
              <div className="font-headline font-bold text-xl md:text-2xl text-on-surface tracking-tight mt-0.5">
                € {kpis.soldTotal.toLocaleString()}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-surface-container text-on-surface-variant flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">payments</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs">
            <span className="text-on-surface-variant font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
              {closedSales.length} trattative concluse
            </span>
            <span className="text-on-surface-variant tabular-nums">{closedSales.length} chiusure</span>
          </div>
        </div>

        {/* KPI 2: Pipeline Attiva */}
        <div className="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between group hover:border-primary/40 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                Valore Pipeline Attiva
              </span>
              <div className="font-headline font-bold text-xl md:text-2xl text-on-surface tracking-tight mt-0.5">
                € {kpis.pipelineTotal.toLocaleString()}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-surface-container text-on-surface-variant flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">account_tree</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs">
            <span className="text-on-surface-variant">Trattative in corso</span>
            <span className="font-semibold text-primary">{closedCount ? `${kpis.winRate}% tasso di chiusura` : 'Nessuna chiusura'}</span>
          </div>
        </div>

        {/* KPI 3: Trattative Aperte */}
        <div className="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between group hover:border-primary/40 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                Trattative Aperte
              </span>
              <div className="font-headline font-bold text-xl md:text-2xl text-on-surface tracking-tight mt-0.5">
                {kpis.openDealsCount}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-surface-container text-on-surface-variant flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">work_history</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs">
            <span className="text-on-surface-variant">In lavorazione</span>
            <button
              onClick={() => onNavigateToTab('opportunities')}
              className="text-primary hover:underline font-semibold"
            >
              Vedi tutte →
            </button>
          </div>
        </div>

        {/* KPI 4: Appuntamenti */}
        <div className="bg-surface-container-lowest p-3.5 rounded-xl shadow-sm border border-outline-variant/30 flex flex-col justify-between group hover:border-primary/40 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                Appuntamenti Programmati
              </span>
              <div className="font-headline font-bold text-xl md:text-2xl text-on-surface tracking-tight mt-0.5">
                {kpis.scheduledMeetingsCount}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-surface-container text-on-surface-variant flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">calendar_month</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs">
            <span className="text-on-surface-variant">Meeting & Call</span>
            <button
              onClick={() => onNavigateToTab('calendar')}
              className="text-primary hover:underline font-semibold"
            >
              Apri calendario →
            </button>
          </div>
        </div>
      </div>

      {/* 4. SECTION: Da fare oggi (CRITICAL SECTION) */}
      <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200/40 dark:border-indigo-400/20 flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[19px]">today</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline font-bold text-lg text-on-surface tracking-tight">
                  Da fare oggi
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-300 font-bold text-[11px] border border-zinc-200 dark:border-white/10">
                  {todayTasks.length + dealsWithoutAction.length} Attività
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Attività in scadenza e arretrate, ordinate per priorità.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateToTab('calendar')}
              className="text-xs font-semibold text-zinc-900 dark:text-primary hover:underline flex items-center gap-1"
            >
              <span>Vista Completa Calendario</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Warning if there are deals without a next step */}
        {dealsWithoutAction.length > 0 && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-rose-500 text-[20px]">error</span>
              <div>
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                  Regola Fondamentale Violata: {dealsWithoutAction.length} trattative aperte senza prossimo step!
                </span>
                <p className="text-[11px] text-on-surface-variant">
                  Nessuna trattativa può rimanere orfana di un&apos;azione commerciale. Pianifica subito cosa fare.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dealsWithoutAction.slice(0, 2).map((deal) => (
                <button
                  key={deal.id}
                  onClick={() => triggerNextStepPrompt(deal)}
                  className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[13px]">add_task</span>
                  <span>Imposta per {deal.company}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* List of today's tasks */}
        {opportunities.length === 0 ? (
          <div className="p-6 text-center bg-surface-container-low rounded-xl border border-dashed border-outline-variant/50 flex flex-col items-center justify-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-surface-container text-zinc-900 dark:text-primary flex items-center justify-center border border-zinc-200 dark:border-white/10 shadow-xs">
              <span className="material-symbols-outlined text-[24px]">rocket_launch</span>
            </div>
            <div>
              <span className="text-sm font-bold text-on-surface block">
                Benvenuto nel tuo Hub Commerciale!
              </span>
              <p className="text-xs text-on-surface-variant max-w-sm mt-0.5">
                {brands.length === 0
                  ? 'Il tuo workspace è pronto. Aggiungi il tuo primo brand aziendale per iniziare.'
                  : 'La dashboard è attiva con tutti i contatori a zero. Inizia inserendo la prima opportunità.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
              {brands.length === 0 && (
                <button
                  onClick={() => {
                    const name = window.prompt('Inserisci il nome del brand che gestisci:');
                    if (name && name.trim()) addBrand(name.trim());
                  }}
                  className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-bold text-xs uppercase tracking-wider border border-outline-variant hover:border-primary flex items-center gap-1.5 transition-all"
                >
                  <span className="material-symbols-outlined text-[15px]">add_business</span>
                  <span>Aggiungi Brand</span>
                </button>
              )}
              <button
                onClick={() => setIsNewDealModalOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:text-white font-bold text-xs uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span>Inserisci Prima Opportunità</span>
              </button>
            </div>
          </div>
        ) : todayTasks.length === 0 && dealsWithoutAction.length === 0 ? (
          <div className="p-6 text-center bg-surface-container-low rounded-xl border border-dashed border-outline-variant/50 flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-emerald-500 text-[30px]">task_alt</span>
            <span className="text-sm font-bold text-on-surface">
              Ottimo lavoro! Tutte le attività commerciali di oggi sono state completate.
            </span>
            <p className="text-xs text-on-surface-variant">
              La pipeline è aggiornata. Puoi generare nuovi lead o verificare i follow-up di domani.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {todayTasks.map((task) => (
              <div
                key={task.id}
                className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/30 flex flex-col justify-between gap-2.5 hover:border-primary/40 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-[17px]">
                        {getTypeIcon(task.type)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBrandBadge(task.brand)}`}>
                          {task.brand}
                        </span>
                        <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">
                          {task.client}
                        </span>
                        {task.time && (
                          <span className="text-[11px] tabular-nums text-on-surface-variant bg-surface-container px-1.5 py-0.2 rounded">
                            {task.time}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-on-surface mt-0.5">
                        {task.title}
                      </span>
                      {task.description && (
                        <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0 ${
                      task.priority === 'Alta'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 text-xs">
                  <span className="text-on-surface-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">person</span>
                    {task.assignedTo}
                  </span>

                  <div className="flex items-center gap-2">
                    {task.meetingLink && (
                      <a
                        href={task.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-[11px] transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[13px]">videocam</span>
                        <span>Meet</span>
                      </a>
                    )}
                    <button
                      onClick={() => completeTask(task.id)}
                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center gap-1 shadow-sm"
                      title="Completa e pianifica prossimo step"
                    >
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      <span>Fatto</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Alerts & Commercial Anomalies + Stand-by Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Column: Active Alerts */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[20px]">notifications_active</span>
              <h3 className="font-headline font-bold text-base text-on-surface">
                Avvisi da seguire
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface tabular-nums font-bold text-[11px]">
              {alerts.length} Totali
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {alerts.length === 0 ? (
              <div className="p-3 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-lg">
                Nessun avviso attivo.
              </div>
            ) : (
              alerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2.5 rounded-lg border flex items-start justify-between gap-2.5 text-xs transition-all ${
                    alert.severity === 'urgent'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                      : alert.severity === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">
                      {alert.severity === 'urgent'
                        ? 'warning'
                        : alert.severity === 'warning'
                        ? 'schedule'
                        : 'info'}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-bold text-on-surface">{alert.title}</span>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        {alert.description}
                      </p>
                    </div>
                  </div>

                  {alert.dealId && (
                    <button
                      onClick={() => {
                        const targetDeal = opportunities.find((d) => d.id === alert.dealId);
                        if (targetDeal) setSelectedDeal(targetDeal);
                      }}
                      className="px-2 py-1 rounded-md bg-surface-container-lowest text-on-surface hover:text-primary font-semibold text-[11px] border border-outline-variant/30 flex-shrink-0 shadow-sm"
                    >
                      Apri
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Stand-by & Snooze Status */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">snooze</span>
                <h3 className="font-headline font-bold text-base text-on-surface">
                  Trattative in Stand-by
                </h3>
              </div>
              <button
                onClick={() => onNavigateToTab('standby')}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Gestione →
              </button>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Account congelati con sveglia e data di riattivazione.
            </p>

            <div className="flex flex-col gap-2 mt-2.5">
              {standbyDeals.length === 0 ? (
                <div className="p-3 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-lg">
                  Nessuna trattativa in stand-by al momento.
                </div>
              ) : (
                standbyDeals.slice(0, 3).map((deal) => (
                  <div
                    key={deal.id}
                    onClick={() => setSelectedDeal(deal)}
                    className="p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/20 hover:border-primary/40 cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getBrandBadge(deal.brand)}`}>
                          {deal.brand}
                        </span>
                        <span className="text-xs font-bold text-on-surface">{deal.name}</span>
                      </div>
                      <span className="text-[11px] text-on-surface-variant mt-0.5">
                        {deal.company} • Sveglia: {deal.standbyReactivationDate || 'Da definire'}
                      </span>
                    </div>
                    <span className="tabular-nums text-xs font-bold text-primary">
                      € {deal.value.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-2.5 bg-surface-container rounded-lg flex items-center justify-between text-xs text-on-surface-variant">
            <span>Sveglia attiva:</span>
            <span className="font-bold text-on-surface">
              {standbyDeals.filter((d) => d.standbyReactivationDate && d.standbyReactivationDate <= today).length} da riattivare oggi
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
