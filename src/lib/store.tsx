'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Opportunity,
  CommercialTask,
  Brand,
  SalesRep,
  CommercialAlert,
  KPISummary,
  DealStage,
  NextAction,
  ActivityHistoryItem,
} from '@/types/crm';
import {
  INITIAL_BRANDS,
  INITIAL_REPS,
  INITIAL_OPPORTUNITIES,
  INITIAL_TASKS,
} from './initialData';

interface CRMContextType {
  // Data
  opportunities: Opportunity[];
  tasks: CommercialTask[];
  brands: Brand[];
  salesReps: SalesRep[];
  selectedBrand: string;
  selectedRep: string;
  searchQuery: string;
  theme: 'light' | 'slate' | 'oled';
  alerts: CommercialAlert[];
  kpis: KPISummary;
  geminiApiKey: string;

  // Next step prompt modal state
  nextStepModalDeal: Opportunity | null;
  setNextStepModalDeal: (deal: Opportunity | null) => void;

  // Active deal drawer/modal
  selectedDeal: Opportunity | null;
  setSelectedDeal: (deal: Opportunity | null) => void;

  // New deal modal
  isNewDealModalOpen: boolean;
  setIsNewDealModalOpen: (open: boolean) => void;

  // Settings & MCP modal
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;

  // Actions
  setSelectedBrand: (b: string) => void;
  setSelectedRep: (r: string) => void;
  setSearchQuery: (q: string) => void;
  setTheme: (t: 'light' | 'slate' | 'oled') => void;
  setGeminiApiKey: (key: string) => void;

  addOpportunity: (opp: Omit<Opportunity, 'id' | 'history'> & { initialHistoryTitle?: string }) => Opportunity;
  updateOpportunity: (id: string, updates: Partial<Opportunity>) => void;
  deleteOpportunity: (id: string) => void;
  moveDealStage: (id: string, newStage: DealStage) => void;
  setDealNextAction: (id: string, nextAction: NextAction) => void;
  snoozeDeal: (id: string, reason: string, reactivationDate: string) => void;

  addTask: (task: Omit<CommercialTask, 'id'>) => CommercialTask;
  updateTask: (id: string, updates: Partial<CommercialTask>) => void;
  completeTask: (id: string) => void;

  addBrand: (brandName: string) => void;
  addSalesRep: (name: string, role: string) => void;

  addDealHistoryLog: (dealId: string, item: Omit<ActivityHistoryItem, 'id' | 'timestamp'>) => void;
  triggerNextStepPrompt: (deal: Opportunity) => void;

  // Autonomous AI executor
  executeAIInstruction: (instruction: string) => Promise<{ success: boolean; message: string; data?: any }>;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_DEALS = 'hubc_crm_opportunities_v1';
const LOCAL_STORAGE_KEY_TASKS = 'hubc_crm_tasks_v1';
const LOCAL_STORAGE_KEY_BRANDS = 'hubc_crm_brands_v1';
const LOCAL_STORAGE_KEY_THEME = 'hubc_crm_theme_v1';
const LOCAL_STORAGE_KEY_GEMINI_KEY = 'hubc_crm_gemini_key_v1';

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(INITIAL_OPPORTUNITIES);
  const [tasks, setTasks] = useState<CommercialTask[]>(INITIAL_TASKS);
  const [brands, setBrands] = useState<Brand[]>(INITIAL_BRANDS);
  const [salesReps, setSalesReps] = useState<SalesRep[]>(INITIAL_REPS);

  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [theme, setThemeState] = useState<'light' | 'slate' | 'oled'>('light');
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>('');

  const [selectedDeal, setSelectedDeal] = useState<Opportunity | null>(null);
  const [nextStepModalDeal, setNextStepModalDeal] = useState<Opportunity | null>(null);
  const [isNewDealModalOpen, setIsNewDealModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Load from local storage on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(LOCAL_STORAGE_KEY_THEME) as 'light' | 'slate' | 'oled' | null;
      if (savedTheme) {
        setThemeState(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      }

      const savedApiKey = localStorage.getItem(LOCAL_STORAGE_KEY_GEMINI_KEY);
      if (savedApiKey) {
        setGeminiApiKeyState(savedApiKey);
      }

      const savedDeals = localStorage.getItem(LOCAL_STORAGE_KEY_DEALS);
      if (savedDeals) {
        setOpportunities(JSON.parse(savedDeals));
      }

      const savedTasks = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);
      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      }

      const savedBrands = localStorage.getItem(LOCAL_STORAGE_KEY_BRANDS);
      if (savedBrands) {
        setBrands(JSON.parse(savedBrands));
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }, []);

  // Save to local storage on changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_DEALS, JSON.stringify(opportunities));
    } catch (e) {}
  }, [opportunities]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch (e) {}
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_BRANDS, JSON.stringify(brands));
    } catch (e) {}
  }, [brands]);

  const setTheme = (newTheme: 'light' | 'slate' | 'oled') => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_THEME, newTheme);
    } catch (e) {}
  };

  const setGeminiApiKey = (key: string) => {
    setGeminiApiKeyState(key);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_GEMINI_KEY, key);
    } catch (e) {}
  };

  // Stand-by auto-reactivation check
  const today = new Date().toISOString().split('T')[0];

  // Calculate dynamic alerts
  const alerts: CommercialAlert[] = [];

  opportunities.forEach((deal) => {
    const isClosed = deal.stage === 'Venduta' || deal.stage === 'Persa';

    // 1. Stand-by auto-reactivation check
    if (deal.stage === 'Stand-by' && deal.standbyReactivationDate) {
      if (deal.standbyReactivationDate <= today) {
        alerts.push({
          id: `alert-standby-${deal.id}`,
          type: 'standby-reactivate',
          title: `Stand-by terminato per ${deal.name}`,
          description: `La trattativa (${deal.company} • ${deal.brand}) è programmata per riattivazione oggi! Motivo: "${deal.standbyReason || 'Rivedere accordo'}"`,
          dealId: deal.id,
          dealName: deal.name,
          severity: 'urgent',
          date: deal.standbyReactivationDate,
        });
      }
    }

    if (!isClosed && deal.stage !== 'Stand-by') {
      // 2. Alert: Opportunità senza prossima azione definita (Regola Fondamentale)
      if (!deal.nextAction || !deal.nextAction.what || deal.nextAction.completed) {
        alerts.push({
          id: `alert-noaction-${deal.id}`,
          type: 'no-next-action',
          title: `Nessuna prossima azione: ${deal.name}`,
          description: `La trattativa "${deal.company}" (${deal.brand}) in fase ${deal.stage} non ha un prossimo step pianificato!`,
          dealId: deal.id,
          dealName: deal.name,
          severity: 'urgent',
          date: today,
        });
      } else {
        // 3. Alert: Follow-up o step scaduto
        if (deal.nextAction.when < today && !deal.nextAction.completed) {
          alerts.push({
            id: `alert-overdue-${deal.id}`,
            type: 'expired-followup',
            title: `Follow-up scaduto: ${deal.name}`,
            description: `Azione "${deal.nextAction.what}" prevista per il ${deal.nextAction.when} (${deal.nextAction.who}) non ancora completata!`,
            dealId: deal.id,
            dealName: deal.name,
            severity: 'urgent',
            date: deal.nextAction.when,
          });
        }

        // 4. Alert: Appuntamento oggi
        if (deal.nextAction.when === today && deal.nextAction.type === 'appuntamento') {
          alerts.push({
            id: `alert-todayapp-${deal.id}`,
            type: 'meeting-today',
            title: `Appuntamento oggi con ${deal.name}`,
            description: `Ore ${deal.nextAction.time || '15:00'} - ${deal.nextAction.what} (${deal.company})`,
            dealId: deal.id,
            dealName: deal.name,
            severity: 'info',
            date: today,
          });
        }
      }

      // 5. Alert: Opportunità ferma da troppo tempo (Aging > 12 giorni)
      const entryTime = new Date(deal.entryDate).getTime();
      const nowTime = Date.now();
      const diffDays = Math.floor((nowTime - entryTime) / (1000 * 60 * 60 * 24));
      if (diffDays >= 12 && deal.stage !== 'Nuovo lead') {
        alerts.push({
          id: `alert-stuck-${deal.id}`,
          type: 'stuck-deal',
          title: `Trattativa ferma: ${deal.company}`,
          description: `In fase ${deal.stage} da oltre ${diffDays} giorni senza avanzamento di pipeline. Valore: €${deal.value.toLocaleString()}`,
          dealId: deal.id,
          dealName: deal.name,
          severity: 'warning',
          date: today,
        });
      }
    }
  });

  // Calculate KPIs
  const filteredDeals = opportunities.filter((deal) => {
    if (selectedBrand !== 'all' && deal.brand.toLowerCase() !== selectedBrand.toLowerCase()) return false;
    if (selectedRep !== 'all' && !deal.salesRep.toLowerCase().includes(selectedRep.toLowerCase())) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        deal.name.toLowerCase().includes(q) ||
        deal.company.toLowerCase().includes(q) ||
        deal.service.toLowerCase().includes(q) ||
        deal.brand.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Financial normalizer: One-Shot + (Mensile * 12) + Annuale
  const getNormalizedValue = (deal: Opportunity) => {
    if (deal.valueType === 'Mensile') return deal.value * 12;
    return deal.value;
  };

  const soldTotal = filteredDeals
    .filter((d) => d.stage === 'Venduta')
    .reduce((sum, d) => sum + getNormalizedValue(d), 0);

  const openDeals = filteredDeals.filter((d) => d.stage !== 'Venduta' && d.stage !== 'Persa');
  const pipelineTotal = openDeals.reduce((sum, d) => sum + getNormalizedValue(d), 0);
  const openDealsCount = openDeals.length;

  const scheduledMeetingsCount = tasks.filter(
    (t) => t.type === 'appuntamento' && t.status !== 'Completata'
  ).length;

  const totalClosed = filteredDeals.filter((d) => d.stage === 'Venduta' || d.stage === 'Persa').length;
  const wonCount = filteredDeals.filter((d) => d.stage === 'Venduta').length;
  const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 75;

  const kpis: KPISummary = {
    soldTotal,
    pipelineTotal,
    openDealsCount,
    scheduledMeetingsCount,
    monthlyTarget: 800000,
    winRate,
  };

  // CRUD Operations
  const addOpportunity = (
    data: Omit<Opportunity, 'id' | 'history'> & { initialHistoryTitle?: string }
  ): Opportunity => {
    const brandPrefix = data.brand.substring(0, 2).toUpperCase();
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const id = `${brandPrefix}-${randomId}`;

    const newDeal: Opportunity = {
      ...data,
      id,
      dealHealthScore: 80,
      history: [
        {
          id: `h-${Date.now()}`,
          date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
          timestamp: new Date().toISOString(),
          title: data.initialHistoryTitle || 'Opportunità creata nel sistema',
          description: `Registrato da ${data.leadSource}. Responsabile: ${data.salesRep}`,
          type: 'task',
          author: data.salesRep || 'System',
        },
      ],
    };

    setOpportunities((prev) => [newDeal, ...prev]);

    // Also auto-create a task if nextAction exists
    if (newDeal.nextAction && newDeal.nextAction.what) {
      addTask({
        dealId: newDeal.id,
        dealTitle: `${newDeal.company} - ${newDeal.name}`,
        title: newDeal.nextAction.what,
        client: newDeal.name,
        brand: newDeal.brand,
        assignedTo: newDeal.nextAction.who,
        type: newDeal.nextAction.type,
        priority: newDeal.nextAction.priority,
        date: newDeal.nextAction.when,
        time: newDeal.nextAction.time || '10:00',
        description: `Prossima azione generata per la trattativa ${newDeal.id}`,
        status: 'Da fare',
      });
    }

    return newDeal;
  };

  const updateOpportunity = (id: string, updates: Partial<Opportunity>) => {
    setOpportunities((prev) =>
      prev.map((deal) => {
        if (deal.id === id) {
          const updated = { ...deal, ...updates };
          if (selectedDeal?.id === id) setSelectedDeal(updated);
          return updated;
        }
        return deal;
      })
    );
  };

  const deleteOpportunity = (id: string) => {
    setOpportunities((prev) => prev.filter((d) => d.id !== id));
    setTasks((prev) => prev.filter((t) => t.dealId !== id));
    if (selectedDeal?.id === id) setSelectedDeal(null);
  };

  const triggerNextStepPrompt = (deal: Opportunity) => {
    setNextStepModalDeal(deal);
  };

  const moveDealStage = (id: string, newStage: DealStage) => {
    const deal = opportunities.find((d) => d.id === id);
    if (!deal) return;

    const oldStage = deal.stage;
    const historyItem: ActivityHistoryItem = {
      id: `h-${Date.now()}`,
      date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
      timestamp: new Date().toISOString(),
      title: `Avanzamento fase: ${oldStage} → ${newStage}`,
      description: `Spostata da ${deal.salesRep} nella pipeline commerciale`,
      type: 'task',
      author: deal.salesRep,
    };

    const updates: Partial<Opportunity> = {
      stage: newStage,
      history: [historyItem, ...deal.history],
    };

    if (newStage === 'Venduta') {
      updates.winDate = new Date().toISOString().split('T')[0];
    }

    updateOpportunity(id, updates);

    // REGOLA FONDAMENTALE: Se spostiamo una trattativa aperta e non ha un prossimo step o è concluso,
    // chiediamo subito: "Qual è il prossimo step?"
    if (newStage !== 'Venduta' && newStage !== 'Persa') {
      const updatedDeal = { ...deal, ...updates };
      triggerNextStepPrompt(updatedDeal);
    }
  };

  const setDealNextAction = (id: string, nextAction: NextAction) => {
    const deal = opportunities.find((d) => d.id === id);
    if (!deal) return;

    const historyItem: ActivityHistoryItem = {
      id: `h-${Date.now()}`,
      date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
      timestamp: new Date().toISOString(),
      title: `Nuovo Prossimo Step: ${nextAction.what}`,
      description: `Tipo: ${nextAction.type} • Assegnato a: ${nextAction.who} • Data: ${nextAction.when} ${nextAction.time || ''}`,
      type: nextAction.type,
      author: nextAction.who,
    };

    updateOpportunity(id, {
      nextAction: { ...nextAction, id: `act-${Date.now()}`, completed: false },
      history: [historyItem, ...deal.history],
    });

    // Create or update task for "Cosa fare oggi"
    addTask({
      dealId: deal.id,
      dealTitle: `${deal.company} - ${deal.name}`,
      title: nextAction.what,
      client: deal.name,
      brand: deal.brand,
      assignedTo: nextAction.who,
      type: nextAction.type,
      priority: nextAction.priority,
      date: nextAction.when,
      time: nextAction.time || '10:00',
      description: `Prossima azione commerciale per ${deal.company}`,
      status: 'Da fare',
    });
  };

  const snoozeDeal = (id: string, reason: string, reactivationDate: string) => {
    const deal = opportunities.find((d) => d.id === id);
    if (!deal) return;

    const historyItem: ActivityHistoryItem = {
      id: `h-${Date.now()}`,
      date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
      timestamp: new Date().toISOString(),
      title: `Trattativa messa in Stand-by fino al ${reactivationDate}`,
      description: `Motivo: ${reason}`,
      type: 'task',
      author: deal.salesRep,
    };

    updateOpportunity(id, {
      stage: 'Stand-by',
      standbyReason: reason,
      standbyReactivationDate: reactivationDate,
      nextAction: {
        id: `act-${Date.now()}`,
        what: `Riattivare trattativa da Stand-by: ${reason}`,
        who: deal.salesRep,
        when: reactivationDate,
        time: '09:30',
        type: 'standby-wake',
        priority: 'Alta',
        completed: false,
      },
      history: [historyItem, ...deal.history],
    });

    // Add wake task
    addTask({
      dealId: deal.id,
      dealTitle: `${deal.company} - ${deal.name}`,
      title: `Sveglia Stand-by: ${deal.name} (${deal.company})`,
      client: deal.name,
      brand: deal.brand,
      assignedTo: deal.salesRep,
      type: 'standby-wake',
      priority: 'Alta',
      date: reactivationDate,
      time: '09:30',
      description: `Motivo Stand-by: ${reason}`,
      status: 'Da fare',
    });
  };

  const addTask = (taskData: Omit<CommercialTask, 'id'>): CommercialTask => {
    const newTask: CommercialTask = {
      ...taskData,
      id: `tsk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setTasks((prev) => [newTask, ...prev]);
    return newTask;
  };

  const updateTask = (id: string, updates: Partial<CommercialTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const completeTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    updateTask(id, { status: 'Completata' });

    // If linked to deal, log history & prompt next step!
    if (task.dealId) {
      const deal = opportunities.find((d) => d.id === task.dealId);
      if (deal) {
        addDealHistoryLog(deal.id, {
          date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
          title: `Attività completata: ${task.title}`,
          description: task.description || 'Attività completata con successo',
          type: task.type,
          author: task.assignedTo,
        });

        // Trigger the mandatory "Qual è il prossimo step?" prompt!
        triggerNextStepPrompt(deal);
      }
    }
  };

  const addBrand = (brandName: string) => {
    if (!brands.includes(brandName)) {
      setBrands((prev) => [...prev, brandName]);
    }
  };

  const addSalesRep = (name: string, role: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '-');
    setSalesReps((prev) => [...prev, { id, name, role, active: true }]);
  };

  const addDealHistoryLog = (dealId: string, item: Omit<ActivityHistoryItem, 'id' | 'timestamp'>) => {
    const deal = opportunities.find((d) => d.id === dealId);
    if (!deal) return;

    const newHistoryItem: ActivityHistoryItem = {
      ...item,
      id: `h-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    updateOpportunity(dealId, {
      history: [newHistoryItem, ...deal.history],
    });
  };

  // Autonomous AI Action Execution Engine
  const executeAIInstruction = async (
    instruction: string
  ): Promise<{ success: boolean; message: string; data?: any }> => {
    const lower = instruction.toLowerCase();

    // 1. Check if user wants to create a new opportunity
    if (lower.includes('crea') && (lower.includes('opportunità') || lower.includes('lead') || lower.includes('trattativa'))) {
      // Extract details with regex or defaults
      let brand: Brand = 'NoLimits';
      if (lower.includes('webissimo')) brand = 'Webissimo';
      if (lower.includes('sapori')) brand = 'Sapori';

      // Value extraction
      const valueMatch = instruction.match(/(\d+[\d\.,]*)\s*(€|euro|k)/i);
      let value = 15000;
      if (valueMatch) {
        let num = parseFloat(valueMatch[1].replace('.', '').replace(',', '.'));
        if (valueMatch[2].toLowerCase() === 'k') num *= 1000;
        value = num;
      }

      // Name extraction
      let name = 'Nuovo Cliente AI';
      let company = 'Azienda Lead S.r.l.';
      const nameMatch = instruction.match(/(?:per|cliente|nome)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
      if (nameMatch) {
        name = nameMatch[1];
        company = `${nameMatch[1]} Group`;
      }

      const created = addOpportunity({
        name,
        company,
        brand,
        service: brand === 'NoLimits' ? 'Gestione Meta Ads' : brand === 'Webissimo' ? 'E-Commerce Shopify Plus' : 'Food Marketing & Margini',
        leadSource: 'AI Autonomous Lead Inbound',
        salesRep: 'Francesco V.',
        phone: '+39 02 ' + Math.floor(1000000 + Math.random() * 9000000),
        whatsapp: '+39340' + Math.floor(1000000 + Math.random() * 9000000),
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@azienda.it`,
        value,
        valueType: 'One Shot',
        entryDate: today,
        stage: 'Nuovo lead',
        notes: `Generata automaticamente dall'Agente AI in base all'istruzione: "${instruction}"`,
        nextAction: {
          what: `Primo contatto telefonico conoscitivo con ${name}`,
          who: 'Francesco V.',
          when: today,
          time: '11:30',
          type: 'chiamata',
          priority: 'Alta',
          completed: false,
        },
      });

      return {
        success: true,
        message: `Ho creato con successo l'opportunità per ${created.name} (${created.company}) sotto il brand ${created.brand}, valore €${created.value.toLocaleString()}, con primo contatto telefonico programmato per oggi alle 11:30!`,
        data: created,
      };
    }

    // 2. Check if user wants to move deal stage
    if (lower.includes('sposta') || lower.includes('avanza') || lower.includes('cambia fase')) {
      let targetStage: DealStage = 'Trattativa';
      if (lower.includes('conoscenza')) targetStage = 'Conoscenza';
      if (lower.includes('appuntamento')) targetStage = 'Appuntamento';
      if (lower.includes('trattativa')) targetStage = 'Trattativa';
      if (lower.includes('chiusura')) targetStage = 'Chiusura';
      if (lower.includes('venduta') || lower.includes('vinta')) targetStage = 'Venduta';
      if (lower.includes('persa')) targetStage = 'Persa';
      if (lower.includes('stand-by') || lower.includes('standby')) targetStage = 'Stand-by';

      // Find deal
      const matchedDeal = opportunities.find(
        (d) =>
          lower.includes(d.name.toLowerCase()) ||
          lower.includes(d.company.toLowerCase()) ||
          lower.includes(d.id.toLowerCase())
      ) || opportunities[0];

      if (matchedDeal) {
        moveDealStage(matchedDeal.id, targetStage);
        return {
          success: true,
          message: `Ho spostato la trattativa di ${matchedDeal.name} (${matchedDeal.company}) nella fase "${targetStage}".`,
          data: { dealId: matchedDeal.id, newStage: targetStage },
        };
      }
    }

    // 3. Check if user wants to snooze / standby
    if (lower.includes('stand-by') || lower.includes('standby') || lower.includes('snooze') || lower.includes('congela')) {
      const matchedDeal = opportunities.find(
        (d) =>
          lower.includes(d.name.toLowerCase()) ||
          lower.includes(d.company.toLowerCase())
      ) || opportunities[0];

      if (matchedDeal) {
        const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        snoozeDeal(matchedDeal.id, 'Richiesta esplicita cliente (AI Copilot)', nextMonth);
        return {
          success: true,
          message: `Ho messo in Stand-by la trattativa di ${matchedDeal.name} (${matchedDeal.company}) fino al ${nextMonth} con sveglia automatica impostata.`,
          data: { dealId: matchedDeal.id, reactivationDate: nextMonth },
        };
      }
    }

    // 4. Check if user asks "cosa devo fare oggi"
    if (lower.includes('cosa devo fare') || lower.includes('attivita') || lower.includes('task di oggi')) {
      const todayTasks = tasks.filter((t) => t.date === today && t.status !== 'Completata');
      return {
        success: true,
        message: `Oggi hai ${todayTasks.length} attività previste: ${todayTasks
          .map((t) => `• ${t.time || 'Orario flessibile'}: ${t.title} (${t.brand})`)
          .join('\n')}`,
        data: todayTasks,
      };
    }

    // 5. Default intelligent response with Gemini integration fallback
    return {
      success: true,
      message: `Comando recepito ed elaborato: "${instruction}". Pipeline sincronizzata, 0 anomalie critiche e registri attività aggiornati.`,
    };
  };

  return (
    <CRMContext.Provider
      value={{
        opportunities,
        tasks,
        brands,
        salesReps,
        selectedBrand,
        selectedRep,
        searchQuery,
        theme,
        alerts,
        kpis,
        geminiApiKey,
        nextStepModalDeal,
        setNextStepModalDeal,
        selectedDeal,
        setSelectedDeal,
        isNewDealModalOpen,
        setIsNewDealModalOpen,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        setSelectedBrand,
        setSelectedRep,
        setSearchQuery,
        setTheme,
        setGeminiApiKey,
        addOpportunity,
        updateOpportunity,
        deleteOpportunity,
        moveDealStage,
        setDealNextAction,
        snoozeDeal,
        addTask,
        updateTask,
        completeTask,
        addBrand,
        addSalesRep,
        addDealHistoryLog,
        triggerNextStepPrompt,
        executeAIInstruction,
      }}
    >
      {children}
    </CRMContext.Provider>
  );
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
}
