'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import { Brand, ValueType, DealStage, ActivityType, Priority } from '@/types/crm';
import { INITIAL_SERVICES } from '@/lib/initialData';

export const NewDealModal: React.FC = () => {
  const { isNewDealModalOpen, setIsNewDealModalOpen, addOpportunity, brands, salesReps } = useCRM();
  const { user } = useAuth();

  const defaultRep = user?.name || salesReps[0]?.name || 'Commerciale';

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [brand, setBrand] = useState<Brand>(brands[0] || 'NoLimits');
  const [service, setService] = useState('Gestione Meta Ads');
  const [leadSource, setLeadSource] = useState('Webinar B2B');
  const [salesRep, setSalesRep] = useState(defaultRep);
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [value, setValue] = useState<number>(15000);
  const [valueType, setValueType] = useState<ValueType>('One Shot');
  const [stage, setStage] = useState<DealStage>('Nuovo lead');
  const [notes, setNotes] = useState('');

  // Mandatory Next Action fields
  const [actionWhat, setActionWhat] = useState('Primo contatto conoscitivo di qualifica');
  const [actionWho, setActionWho] = useState(defaultRep);
  const [actionWhen, setActionWhen] = useState(new Date().toISOString().split('T')[0]);
  const [actionTime, setActionTime] = useState('11:30');
  const [actionType, setActionType] = useState<ActivityType>('chiamata');
  const [actionPriority, setActionPriority] = useState<Priority>('Alta');

  if (!isNewDealModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !company || !actionWhat) return;

    addOpportunity({
      name,
      company,
      brand,
      service,
      leadSource,
      salesRep,
      phone: phone || '+39 02 ' + Math.floor(1000000 + Math.random() * 9000000),
      whatsapp: whatsapp || phone || '+39340' + Math.floor(1000000 + Math.random() * 9000000),
      email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@${company.toLowerCase().replace(/[^a-z]/g, '')}.it`,
      value,
      valueType,
      entryDate: new Date().toISOString().split('T')[0],
      stage,
      notes,
      nextAction: {
        what: actionWhat,
        who: actionWho || salesRep,
        when: actionWhen,
        time: actionTime,
        type: actionType,
        priority: actionPriority,
        completed: false,
      },
    });

    setIsNewDealModalOpen(false);
    // Reset form
    setName('');
    setCompany('');
    setNotes('');
  };

  const servicesList = INITIAL_SERVICES[brand] || [
    'Consulenza Strategica',
    'Sviluppo Tecnico',
    'Campagne Digital ROI',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-surface-container-lowest max-w-3xl w-full rounded-3xl p-6 shadow-2xl border border-outline-variant/40 flex flex-col gap-5 max-h-[90vh] overflow-y-auto animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div>
            <h2 className="font-headline font-bold text-xl text-on-surface">
              Nuova Opportunità Commerciale
            </h2>
            <p className="text-xs text-on-surface-variant">
              Inserisci i dati del lead. In base alla regola fondamentale, devi includere subito una prossima azione.
            </p>
          </div>
          <button
            onClick={() => setIsNewDealModalOpen(false)}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-xs">
          {/* Section 1: Customer Details */}
          <div className="flex flex-col gap-3">
            <span className="font-bold text-xs uppercase tracking-wider text-outline">
              1. Dati Anagrafici & Contatto
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-on-surface-variant block mb-1">
                  Nome e Cognome Referente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es: Dott. Mario Rossi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">
                  Ragione Sociale Azienda *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es: TechSpa S.r.l."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Telefono</label>
                <input
                  type="text"
                  placeholder="+39 02 8934521"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">WhatsApp</label>
                <input
                  type="text"
                  placeholder="+39 340 1234567"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Email</label>
                <input
                  type="email"
                  placeholder="m.rossi@azienda.it"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Commercial Scope */}
          <div className="flex flex-col gap-3 pt-3 border-t border-outline-variant/20">
            <span className="font-bold text-xs uppercase tracking-wider text-outline">
              2. Assegnazione & Valore Commerciale
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Brand di Riferimento *</label>
                <select
                  value={brand}
                  onChange={(e) => {
                    setBrand(e.target.value);
                    const defaultSrv = INITIAL_SERVICES[e.target.value]?.[0] || 'Consulenza';
                    setService(defaultSrv);
                  }}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none cursor-pointer"
                >
                  {brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Servizio Interessato *</label>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none cursor-pointer"
                >
                  {servicesList.map((srv) => (
                    <option key={srv} value={srv}>{srv}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Fonte del Lead</label>
                <select
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none cursor-pointer"
                >
                  <option value="Webinar B2B">Webinar B2B</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="Referral">Referral / Passaparola</option>
                  <option value="Inbound">Inbound Sito Web</option>
                  <option value="Outbound">Outbound LinkedIn</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Responsabile Commerciale *</label>
                <select
                  value={salesRep}
                  onChange={(e) => setSalesRep(e.target.value)}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none cursor-pointer"
                >
                  {salesReps.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Valore Economico (€) *</label>
                <input
                  type="number"
                  required
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Tipologia Valore</label>
                <select
                  value={valueType}
                  onChange={(e) => setValueType(e.target.value as any)}
                  className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none cursor-pointer"
                >
                  <option value="One Shot">One Shot (Una Tantum)</option>
                  <option value="Mensile">Mensile (Ricorrente MRR)</option>
                  <option value="Annuale">Annuale (Accordo Annuale)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: REGOLA FONDAMENTALE (PROSSIMA AZIONE) */}
          <div className="flex flex-col gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/30">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
              <span className="font-headline font-bold text-xs uppercase tracking-wider text-primary">
                3. Regola Fondamentale: Prossima Azione Obbligatoria
              </span>
            </div>

            <div>
              <label className="font-bold text-on-surface-variant block mb-1">
                Cosa bisogna fare? *
              </label>
              <input
                type="text"
                required
                value={actionWhat}
                onChange={(e) => setActionWhat(e.target.value)}
                placeholder="Es: Telefonata conoscitiva e invio brochure"
                className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Chi deve farlo?</label>
                <select
                  value={actionWho}
                  onChange={(e) => setActionWho(e.target.value)}
                  className="w-full bg-surface-container p-2 rounded-xl border border-outline-variant/30 text-on-surface outline-none cursor-pointer"
                >
                  {salesReps.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Tipologia</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  className="w-full bg-surface-container p-2 rounded-xl border border-outline-variant/30 text-on-surface outline-none cursor-pointer"
                >
                  <option value="chiamata">Chiamata</option>
                  <option value="appuntamento">Video Call</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="preventivo">Preventivo</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Quando (Data) *</label>
                <input
                  type="date"
                  required
                  value={actionWhen}
                  onChange={(e) => setActionWhen(e.target.value)}
                  className="w-full bg-surface-container p-2 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-on-surface-variant block mb-1">Priorità</label>
                <select
                  value={actionPriority}
                  onChange={(e) => setActionPriority(e.target.value as any)}
                  className="w-full bg-surface-container p-2 rounded-xl border border-outline-variant/30 text-on-surface outline-none cursor-pointer"
                >
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Bassa">Bassa</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="font-bold text-on-surface-variant block mb-1">Note Iniziali</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Esigenze espresse dal cliente, note della trattativa..."
              className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => setIsNewDealModalOpen(false)}
              className="px-4 py-2 rounded-xl text-on-surface-variant hover:text-on-surface font-semibold"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold shadow-md hover:opacity-90 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Crea Trattativa nel CRM</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
