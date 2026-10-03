'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/store';
import { DealStage, Opportunity } from '@/types/crm';

export const OpportunitiesList: React.FC = () => {
  const {
    opportunities,
    setSelectedDeal,
    selectedBrand,
    selectedRep,
    searchQuery,
    setIsNewDealModalOpen,
    moveDealStage,
  } = useCRM();

  const [stageFilter, setStageFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'value' | 'date' | 'name'>('date');

  const filteredDeals = opportunities
    .filter((deal) => {
      if (selectedBrand !== 'all' && deal.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
      if (selectedRep !== 'all' && !deal.salesRep.toLowerCase().includes(selectedRep.toLowerCase())) return false;
      if (stageFilter !== 'all' && deal.stage !== stageFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          deal.name.toLowerCase().includes(q) ||
          deal.company.toLowerCase().includes(q) ||
          deal.service.toLowerCase().includes(q) ||
          deal.leadSource.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'value') return b.value - a.value;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime();
    });

  const getBrandBadge = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'nolimits':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
      case 'webissimo':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'sapori':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      default:
        return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
    }
  };

  const getStageBadge = (stage: DealStage) => {
    switch (stage) {
      case 'Venduta':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'Persa':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'Stand-by':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
      case 'Chiusura':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
      default:
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Cliente', 'Azienda', 'Brand', 'Servizio', 'Valore', 'Tipo', 'Fonte', 'Responsabile', 'Stato', 'Data Ingresso'];
    const rows = filteredDeals.map((d) => [
      d.id,
      `"${d.name}"`,
      `"${d.company}"`,
      d.brand,
      `"${d.service}"`,
      d.value,
      d.valueType,
      `"${d.leadSource}"`,
      `"${d.salesRep}"`,
      d.stage,
      d.entryDate,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hub_commerciale_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/30 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline font-bold text-xl md:text-2xl text-on-surface tracking-tight">
              Registro Opportunità Commerciali
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container font-mono text-xs font-semibold text-primary">
              {filteredDeals.length} Risultati
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Database completo di tutti i lead e clienti con contatti diretti, stato, storico e prossimi step
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-highest hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-outline-variant/30 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Esporta CSV</span>
          </button>

          <button
            onClick={() => setIsNewDealModalOpen(true)}
            className="flex items-center gap-1.5 bg-primary text-on-primary px-3.5 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Nuova Opportunità</span>
          </button>
        </div>
      </div>

      {/* Filter and sorting pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/30 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-outline">
            Filtra Stato:
          </span>
          {['all', 'Nuovo lead', 'Conoscenza', 'Appuntamento', 'Trattativa', 'Chiusura', 'Venduta', 'Stand-by', 'Persa'].map((st) => (
            <button
              key={st}
              onClick={() => setStageFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                stageFilter === st
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {st === 'all' ? 'Tutti gli stati' : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-outline">
            Ordina per:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-surface-container text-on-surface text-xs px-2.5 py-1 rounded-lg font-medium outline-none cursor-pointer border border-outline-variant/30"
          >
            <option value="date">Data Ingresso (Più recente)</option>
            <option value="value">Valore Economico (€)</option>
            <option value="name">Nome Cliente (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Table view */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low border-b border-outline-variant/30 text-on-surface-variant uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Cliente & Azienda</th>
                <th className="py-3 px-3">Brand</th>
                <th className="py-3 px-3">Servizio</th>
                <th className="py-3 px-3">Valore</th>
                <th className="py-3 px-3">Fonte Lead</th>
                <th className="py-3 px-3">Responsabile</th>
                <th className="py-3 px-3">Stato</th>
                <th className="py-3 px-4">Prossima Azione</th>
                <th className="py-3 px-4 text-right">Azioni Rapide</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-on-surface-variant text-xs">
                    Nessuna opportunità trovata con i filtri selezionati.
                  </td>
                </tr>
              ) : (
                filteredDeals.map((deal) => (
                  <tr
                    key={deal.id}
                    className="hover:bg-surface-container-low/60 transition-colors group cursor-pointer"
                    onClick={() => setSelectedDeal(deal)}
                  >
                    {/* Cliente & Azienda */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-on-surface text-xs group-hover:text-primary transition-colors">
                          {deal.name}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          {deal.company}
                        </span>
                      </div>
                    </td>

                    {/* Brand */}
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${getBrandBadge(deal.brand)}`}>
                        {deal.brand}
                      </span>
                    </td>

                    {/* Servizio */}
                    <td className="py-3 px-3 text-on-surface font-medium">
                      {deal.service}
                    </td>

                    {/* Valore */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col font-mono">
                        <span className="font-bold text-primary">
                          € {deal.value.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-on-surface-variant">
                          {deal.valueType}
                        </span>
                      </div>
                    </td>

                    {/* Fonte */}
                    <td className="py-3 px-3 text-on-surface-variant">
                      {deal.leadSource}
                    </td>

                    {/* Responsabile */}
                    <td className="py-3 px-3">
                      <span className="text-on-surface font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-outline">person</span>
                        {deal.salesRep}
                      </span>
                    </td>

                    {/* Stato trattativa */}
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${getStageBadge(deal.stage)}`}>
                        {deal.stage}
                      </span>
                    </td>

                    {/* Prossima Azione */}
                    <td className="py-3 px-4 max-w-[240px]">
                      {deal.nextAction && deal.nextAction.what && !deal.nextAction.completed ? (
                        <div className="flex flex-col">
                          <span className="text-on-surface font-medium line-clamp-1">
                            {deal.nextAction.what}
                          </span>
                          <span className="text-[10px] font-mono text-on-surface-variant">
                            {deal.nextAction.when} {deal.nextAction.time || ''} • {deal.nextAction.who}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded">
                          Da impostare!
                        </span>
                      )}
                    </td>

                    {/* Quick Contact & Action Buttons */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {deal.whatsapp && (
                          <a
                            href={`https://wa.me/${deal.whatsapp.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                            title="Chat WhatsApp"
                          >
                            <span className="material-symbols-outlined text-[16px]">chat</span>
                          </a>
                        )}
                        {deal.phone && (
                          <a
                            href={`tel:${deal.phone}`}
                            className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors"
                            title="Chiama"
                          >
                            <span className="material-symbols-outlined text-[16px]">call</span>
                          </a>
                        )}
                        <button
                          onClick={() => setSelectedDeal(deal)}
                          className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface hover:bg-primary hover:text-on-primary font-semibold text-[11px] transition-colors"
                        >
                          Dettagli
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
