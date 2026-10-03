'use client';

import React, { useState } from 'react';
import { useCRM } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { CommercialTask, ActivityType } from '@/types/crm';

export const CalendarView: React.FC = () => {
  const { tasks, completeTask, setSelectedDeal, opportunities, addTask, brands, salesReps } = useCRM();
  const { user } = useAuth();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [filterType, setFilterType] = useState<string>('all');
  const [isNewTaskOpen, setIsNewTaskOpen] = useState<boolean>(false);

  // Form state for new task
  const [newTitle, setNewTitle] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newBrand, setNewBrand] = useState('NoLimits');
  const [newRep, setNewRep] = useState(user?.name || salesReps[0]?.name || 'Commerciale');
  const [newType, setNewType] = useState<ActivityType>('chiamata');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('10:00');
  const [newDesc, setNewDesc] = useState('');

  // Calendar month helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  // First day of month & days count
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Italian calendar starts on Monday (1)
  const startingDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    return true;
  });

  const getTasksForDay = (day: number) => {
    const formattedDay = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredTasks.filter((t) => t.date === formattedDay);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    addTask({
      title: newTitle,
      client: newClient || 'Lead Commerciale',
      brand: newBrand,
      assignedTo: newRep,
      type: newType,
      priority: 'Alta',
      date: newDate,
      time: newTime,
      description: newDesc,
      status: 'Da fare',
    });

    setIsNewTaskOpen(false);
    setNewTitle('');
    setNewDesc('');
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'appuntamento':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'chiamata':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'follow-up':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'preventivo':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'standby-wake':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      default:
        return 'bg-surface-container text-on-surface-variant border-outline-variant/30';
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/30 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline font-bold text-xl md:text-2xl text-on-surface tracking-tight">
              Calendario Attività & Appuntamenti
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container font-mono text-xs font-semibold text-primary">
              {filteredTasks.length} Attività nel mese
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Pianificazione delle video call, telefonate di qualifica, invio preventivi e risveglio lead
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Month navigator */}
          <div className="flex items-center gap-1 bg-surface-container px-3 py-1.5 rounded-xl border border-outline-variant/30">
            <button
              onClick={prevMonth}
              className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="font-headline font-bold text-xs md:text-sm text-on-surface px-2">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          <button
            onClick={() => setIsNewTaskOpen(true)}
            className="flex items-center gap-1.5 bg-primary text-on-primary px-3.5 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add_task</span>
            <span>Nuova Attività</span>
          </button>
        </div>
      </div>

      {/* Filter type chips */}
      <div className="flex items-center gap-2 flex-wrap bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant/30 shadow-sm">
        <span className="text-[11px] font-bold uppercase tracking-wider text-outline mr-1">
          Tipologia:
        </span>
        {[
          { key: 'all', label: 'Tutte le Attività' },
          { key: 'appuntamento', label: 'Appuntamenti / Meeting' },
          { key: 'chiamata', label: 'Chiamate' },
          { key: 'follow-up', label: 'Follow-up' },
          { key: 'preventivo', label: 'Preventivi da Inviare' },
          { key: 'standby-wake', label: 'Sveglia Stand-by' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setFilterType(t.key)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              filterType === t.key
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-sm overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-outline-variant/30 bg-surface-container-low text-center py-2.5 text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          <div>Lun</div>
          <div>Mar</div>
          <div>Mer</div>
          <div>Gio</div>
          <div>Ven</div>
          <div>Sab</div>
          <div>Dom</div>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-outline-variant/20 min-h-[600px]">
          {/* Empty cells before month start */}
          {Array.from({ length: startingDay }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-surface-container-low/40 p-2 min-h-[110px]" />
          ))}

          {/* Days of current month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNumber = i + 1;
            const dayTasks = getTasksForDay(dayNumber);
            const isToday =
              new Date().getFullYear() === year &&
              new Date().getMonth() === month &&
              new Date().getDate() === dayNumber;

            return (
              <div
                key={`day-${dayNumber}`}
                className={`p-2 flex flex-col justify-between gap-1 transition-colors min-h-[110px] ${
                  isToday
                    ? 'bg-primary/5 border border-primary/40'
                    : 'hover:bg-surface-container-low/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-primary text-on-primary font-mono'
                        : 'text-on-surface font-mono'
                    }`}
                  >
                    {dayNumber}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-[10px] font-mono text-on-surface-variant font-bold">
                      {dayTasks.length} task
                    </span>
                  )}
                </div>

                {/* Day tasks items */}
                <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-[100px]">
                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => {
                        if (task.dealId) {
                          const deal = opportunities.find((d) => d.id === task.dealId);
                          if (deal) setSelectedDeal(deal);
                        }
                      }}
                      className={`p-1.5 rounded-lg border text-[11px] cursor-pointer transition-all hover:scale-[1.02] flex items-center justify-between gap-1 ${getTypeColor(
                        task.type
                      )}`}
                    >
                      <div className="flex flex-col truncate">
                        <span className="font-bold truncate leading-tight">
                          {task.time ? `${task.time} ` : ''}{task.client}
                        </span>
                        <span className="text-[10px] truncate opacity-90">
                          {task.title}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          completeTask(task.id);
                        }}
                        className="text-on-surface hover:text-emerald-500 flex-shrink-0"
                        title="Segna come completata"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {task.status === 'Completata' ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Task Modal Form */}
      {isNewTaskOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl p-6 shadow-2xl border border-outline-variant/40 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg text-on-surface">
                Nuova Attività Commerciale
              </h3>
              <button
                onClick={() => setIsNewTaskOpen(false)}
                className="text-outline hover:text-on-surface"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-on-surface-variant block mb-1">
                  Titolo Attività *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es: Telefonata conferma offerta finale"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">
                    Cliente / Contatto
                  </label>
                  <input
                    type="text"
                    placeholder="Mario Rossi"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Brand</label>
                  <select
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                  >
                    {brands.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Tipologia</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                  >
                    <option value="chiamata">Chiamata</option>
                    <option value="appuntamento">Video Call / Incontro</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="preventivo">Invio Preventivo</option>
                    <option value="whatsapp">Messaggio WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Responsabile</label>
                  <select
                    value={newRep}
                    onChange={(e) => setNewRep(e.target.value)}
                    className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                  >
                    {salesReps.map((r) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">Ora</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Note / Descrizione</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Dettagli aggiuntivi o link meeting..."
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setIsNewTaskOpen(false)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:text-on-surface font-semibold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-semibold shadow-sm hover:opacity-90"
                >
                  Salva Attività
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
