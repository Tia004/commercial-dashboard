'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import {
  AIProviderType,
  AIProviderConfig,
  DEFAULT_AI_CONFIGS,
  PROVIDER_MODELS,
  AIModelDefinition,
  getSavedAIConfig,
  saveAIConfig,
  executeUniversalAI,
} from '@/lib/aiProvider';
import {
  getItalianVoices,
  speakHumanVoice,
  stopHumanVoice,
  getSavedVoiceName,
  savePreferredVoice,
  getSavedVoiceSpeed,
  savePreferredVoiceSpeed,
  getSavedVoiceMode,
  savePreferredVoiceMode,
  VoiceOption,
} from '@/lib/speechVoice';
import { testTursoConnection } from '@/lib/turso';

export const SettingsMcpModal: React.FC = () => {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    brands,
    addBrand,
    salesReps,
    addSalesRep,
    opportunities,
    loadDemoData,
    resetAllData,
    importLegacyData,
  } = useCRM();

  const {
    user,
    isAuthenticated,
    isPasskeySupported,
    registerPasskey,
    loginWithPasskey,
    removePasskey,
    setIsAuthModalOpen,
    logout,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'account' | 'ai' | 'voice' | 'turso' | 'mcp' | 'brands' | 'integrations'
  >('account');

  // AI State
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({
    provider: 'gemini',
    apiKey: '',
    baseUrl: DEFAULT_AI_CONFIGS.gemini.defaultBaseUrl,
    model: 'gemini-3.5-flash-lite',
    temperature: 0.3,
    isBillingActive: false,
  });
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [isAiTesting, setIsAiTesting] = useState(false);
  const [modelLockedWarning, setModelLockedWarning] = useState<string | null>(null);

  // Voice State
  const [voicesList, setVoicesList] = useState<VoiceOption[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [voiceSpeed, setVoiceSpeed] = useState<number>(0.98);
  const [voiceMode, setVoiceMode] = useState<'browser' | 'cloud_hd'>('browser');
  const [isVoiceTesting, setIsVoiceTesting] = useState(false);

  // Turso State
  const [tursoUrl, setTursoUrl] = useState('');
  const [tursoToken, setTursoToken] = useState('');
  const [tursoTestResult, setTursoTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);
  const [isTursoTesting, setIsTursoTesting] = useState(false);

  // Passkey State
  const [passkeyLabel, setPasskeyLabel] = useState('');
  const [passkeyFeedback, setPasskeyFeedback] = useState<string | null>(null);

  // Brand & Rep Form
  const [newBrandName, setNewBrandName] = useState('');
  const [newRepName, setNewRepName] = useState('');
  const [newRepRole, setNewRepRole] = useState('Senior Closer');

  // Copied alert
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  useEffect(() => {
    setAiConfig(getSavedAIConfig());

    // Load voices
    const loadVoices = () => {
      const v = getItalianVoices();
      setVoicesList(v);
      const savedV = getSavedVoiceName();
      if (savedV) {
        setSelectedVoiceName(savedV);
      } else if (v.length > 0) {
        setSelectedVoiceName(v[0].name);
      }
    };
    loadVoices();
    setVoiceSpeed(getSavedVoiceSpeed());
    setVoiceMode(getSavedVoiceMode());

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    try {
      const savedTursoUrl = localStorage.getItem('hubc_crm_turso_url_v1') || '';
      localStorage.removeItem('hubc_crm_turso_token_v1');
      setTursoUrl(savedTursoUrl);
    } catch (e) {}
  }, []);

  if (!isSettingsModalOpen) return null;

  const handleProviderChange = (provider: AIProviderType) => {
    const preset = DEFAULT_AI_CONFIGS[provider];
    const defaultModel = PROVIDER_MODELS[provider]?.[0]?.id || preset.defaultModel;
    const updated: AIProviderConfig = {
      ...aiConfig,
      provider,
      baseUrl: preset.defaultBaseUrl,
      model: defaultModel,
    };
    setAiConfig(updated);
    saveAIConfig(updated);
    setModelLockedWarning(null);
  };

  const handleModelSelect = (m: AIModelDefinition) => {
    if (m.requiresBilling && !aiConfig.isBillingActive) {
      setModelLockedWarning(
        `Il modello "${m.name}" richiede che sulla tua chiave sia attiva la fatturazione (Pay-As-You-Go). Attiva l'interruttore "Fatturazione Attiva sulla Chiave" per sbloccarlo, oppure seleziona un modello contrassegnato con "Free".`
      );
      return;
    }
    setModelLockedWarning(null);
    const updated: AIProviderConfig = {
      ...aiConfig,
      model: m.id,
    };
    setAiConfig(updated);
    saveAIConfig(updated);
  };

  const toggleBilling = (active: boolean) => {
    const updated: AIProviderConfig = {
      ...aiConfig,
      isBillingActive: active,
    };
    setAiConfig(updated);
    saveAIConfig(updated);
    setModelLockedWarning(null);
  };

  const handleSaveAi = (e: React.FormEvent) => {
    e.preventDefault();
    saveAIConfig(aiConfig);
    setAiTestResult('Configurazione AI salvata con successo!');
  };

  const handleTestAi = async () => {
    setIsAiTesting(true);
    setAiTestResult(null);
    const res = await executeUniversalAI(
      'Fai un brevissimo checkup di 1 frase della pipeline commerciale di oggi.',
      aiConfig,
      { totalDeals: opportunities.length }
    );
    setAiTestResult(res.reply);
    setIsAiTesting(false);
  };

  const handleTestVoiceSample = () => {
    setIsVoiceTesting(true);
    const sample = `Buongiorno ${user?.name ? user.name.split(' ')[0] : 'Direttore'}. Ti confermo che la sintesi vocale è calibrata e pronta per conversare fluidamente durante l'operatività commerciale.`;
    speakHumanVoice(
      sample,
      {
        onStart: () => setIsVoiceTesting(true),
        onEnd: () => setIsVoiceTesting(false),
        onError: () => setIsVoiceTesting(false),
      },
      selectedVoiceName
    );
  };

  const handleVoiceChange = (vName: string) => {
    setSelectedVoiceName(vName);
    savePreferredVoice(vName);
  };

  const handleSpeedChange = (spd: number) => {
    setVoiceSpeed(spd);
    savePreferredVoiceSpeed(spd);
  };

  const handleVoiceModeChange = (mode: 'browser' | 'cloud_hd') => {
    setVoiceMode(mode);
    savePreferredVoiceMode(mode);
  };

  const handleTestTurso = async () => {
    if (!tursoUrl) {
      setTursoTestResult({ success: false, error: 'Inserisci prima la Turso Database URL' });
      return;
    }
    setIsTursoTesting(true);
    setTursoTestResult(null);
    const res = await testTursoConnection(tursoUrl, tursoToken);
    setTursoTestResult(res);
    setIsTursoTesting(false);
    if (res.success) {
      try {
        localStorage.setItem('hubc_crm_turso_url_v1', tursoUrl);
        localStorage.setItem('hubc_crm_turso_token_v1', tursoToken);
      } catch (e) {}
    }
  };

  const handleCreatePasskey = async () => {
    setPasskeyFeedback('Avvio registrazione biometrica con Touch ID / Windows Hello...');
    const res = await registerPasskey(passkeyLabel);
    if (res.success) {
      setPasskeyFeedback('Passkey creata con successo! Ora puoi accedere con Touch ID / Windows Hello.');
      setPasskeyLabel('');
    } else {
      setPasskeyFeedback(`Errore: ${res.error}`);
    }
  };

  const handleTestPasskey = async () => {
    setPasskeyFeedback('Verifica biometrica in corso...');
    const res = await loginWithPasskey();
    if (res.success) {
      setPasskeyFeedback('Verifica biometrica completata con successo!');
    } else {
      setPasskeyFeedback(`Verifica fallita: ${res.error}`);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentModels = PROVIDER_MODELS[aiConfig.provider] || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-surface-container-lowest max-w-4xl w-full rounded-3xl p-6 shadow-2xl border border-outline-variant/40 flex flex-col gap-5 max-h-[92vh] overflow-y-auto animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[24px]">settings</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline font-bold text-xl text-on-surface">
                  Pannello Impostazioni & Controllo Sistema
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-bold text-[10px] uppercase tracking-wider border border-outline-variant/30">
                  Suite v4.5
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Gestione account, modelli AI, sintesi vocale e archivio dati
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsModalOpen(false)}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher Grid */}
        <div className="flex items-center gap-2 border-b border-outline-variant/20 pb-2 overflow-x-auto text-xs font-bold">
          {[
            { id: 'account', label: 'Account', icon: 'fingerprint' },
            { id: 'voice', label: 'Voce Assistente AI', icon: 'record_voice_over' },
            { id: 'turso', label: 'Archivio dati', icon: 'database' },
            { id: 'mcp', label: 'Server MCP & Agenti AI', icon: 'terminal' },
            { id: 'brands', label: 'Brand & Listini', icon: 'corporate_fare' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-primary text-on-primary shadow-sm font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="flex flex-col gap-4 text-xs">
          {/* TAB 1: ACCOUNT & PASSKEYS */}
          {activeTab === 'account' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary font-bold text-base flex items-center justify-center shadow-sm">
                    {user ? (
                      user.name.substring(0, 2).toUpperCase()
                    ) : (
                      <span className="material-symbols-outlined text-[24px]">person</span>
                    )}
                  </div>
                  <div>
                    <span className="font-headline font-bold text-base text-on-surface block">
                      {user?.name || 'Utente Non Connesso'}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {user?.email || 'Nessuna email'} • <strong className="text-primary">{user?.role || 'Ospite'}</strong>
                    </span>
                    {user && <span className="text-[10px] text-on-surface-variant block break-all">ID account per MCP: {user.id}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isAuthenticated ? (
                    <button
                      onClick={logout}
                      className="px-3 py-1.5 rounded-xl bg-surface-container text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-500/10 transition-colors border border-outline-variant/30"
                    >
                      Disconnetti
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-bold hover:opacity-90 transition-all shadow-sm"
                    >
                      Accedi / Registrati
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 text-xs text-on-surface-variant leading-relaxed">
                L’accesso è protetto da password e sessione sul server. Le passkey saranno disponibili dopo l’integrazione della verifica WebAuthn sul server.
              </div>
            </div>
          )}

          {/* TAB 2: AI MODELS, BILLING LOCK & CUSTOM KEYS */}
          {activeTab === 'ai' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">psychology</span>
                    <h3 className="font-headline font-bold text-base text-on-surface">
                      Modelli AI & Controllo Fatturazione (Free vs Billed)
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Modello Free Predefinito: Gemini 3.5 Flash Lite
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  I modelli contrassegnati come <strong>Free</strong> sono gratuiti e non richiedono fatturazione. I modelli <strong>Billed</strong> sono modelli a pagamento (Pay-As-You-Go): se la fatturazione sulla tua chiave non è attiva, sono protetti da un lucchetto per prevenire errori ed addebiti imprevisti.
                </p>
              </div>

              {/* Provider Selector Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    'gemini',
                    'openai',
                    'anthropic',
                    'openrouter',
                    'nvidia',
                    'groq',
                    'custom',
                  ] as AIProviderType[]
                ).map((prov) => {
                  const info = DEFAULT_AI_CONFIGS[prov];
                  const isSelected = aiConfig.provider === prov;
                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => handleProviderChange(prov)}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        isSelected
                          ? 'bg-primary text-on-primary border-primary shadow-sm'
                          : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:border-primary/40'
                      }`}
                    >
                      <span className="font-bold text-xs truncate">{info.name.split(' ')[0]}</span>
                      <span className="text-[10px] opacity-80 truncate">{info.defaultModel}</span>
                    </button>
                  );
                })}
              </div>

              {/* Billing Switch Card */}
              <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    aiConfig.isBillingActive
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    <span className="material-symbols-outlined text-[22px]">
                      {aiConfig.isBillingActive ? 'lock_open' : 'lock'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-xs text-on-surface block">
                      Stato Fatturazione Chiave API: {aiConfig.isBillingActive ? 'ATTIVA (Tutti i modelli sbloccati)' : 'NON ATTIVA (Solo modelli Free sbloccati)'}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {aiConfig.isBillingActive
                        ? 'Puoi utilizzare sia i modelli gratuiti che quelli ad alto ragionamento a pagamento.'
                        : 'I modelli Billed sono bloccati per proteggerti da errori 429 / addebiti.'}
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[11px] font-bold text-on-surface">Fatturazione Attiva</span>
                  <input
                    type="checkbox"
                    checked={!!aiConfig.isBillingActive}
                    onChange={(e) => toggleBilling(e.target.checked)}
                    className="w-5 h-5 accent-primary rounded cursor-pointer"
                  />
                </label>
              </div>

              {/* Warning if clicked locked model */}
              {modelLockedWarning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-500 flex-shrink-0">
                      lock
                    </span>
                    <span>{modelLockedWarning}</span>
                  </div>
                  <button onClick={() => setModelLockedWarning(null)} className="text-outline hover:text-on-surface">✕</button>
                </div>
              )}

              {/* Model Catalog Selection Grid */}
              <div className="flex flex-col gap-2">
                <span className="font-bold text-on-surface-variant uppercase text-[10px] tracking-wider">
                  Modelli Disponibili per {DEFAULT_AI_CONFIGS[aiConfig.provider].name}
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {currentModels.map((m) => {
                    const isSelected = aiConfig.model === m.id;
                    const isLocked = m.requiresBilling && !aiConfig.isBillingActive;

                    return (
                      <div
                        key={m.id}
                        onClick={() => handleModelSelect(m)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary'
                            : isLocked
                            ? 'bg-surface-container-low/60 border-outline-variant/20 opacity-80 hover:opacity-100 hover:border-amber-500/40'
                            : 'bg-surface-container-lowest border-outline-variant/30 hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-on-surface">
                              {m.name}
                            </span>
                            {/* Free / Billed Badge */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                m.badge === 'Free'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                              }`}
                            >
                              {m.badge}
                            </span>
                          </div>

                          {/* Lock icon or Selected Check */}
                          {isLocked ? (
                            <span
                              className="material-symbols-outlined text-[18px] text-amber-500 flex-shrink-0"
                              title="Bloccato: attiva fatturazione sulla chiave per sbloccarlo"
                            >
                              lock
                            </span>
                          ) : isSelected ? (
                            <span className="material-symbols-outlined text-[18px] text-primary flex-shrink-0">
                              check_circle
                            </span>
                          ) : null}
                        </div>

                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                          {m.description}
                        </p>

                        <div className="flex items-center gap-2 pt-1 border-t border-outline-variant/20 text-[10px] text-outline font-mono">
                          {m.contextWindow && <span>Contesto: {m.contextWindow}</span>}
                          {m.latency && <span>• Latenza: {m.latency}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Config */}
              <form onSubmit={handleSaveAi} className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">
                      API Key ({DEFAULT_AI_CONFIGS[aiConfig.provider].name})
                    </label>
                    <input
                      type="password"
                      placeholder="sk-... / AIzaSy... / nvapi-..."
                      value={aiConfig.apiKey}
                      onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                      className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">
                      ID Modello Selezionato
                    </label>
                    <input
                      type="text"
                      value={aiConfig.model}
                      onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                      className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">
                      Base Endpoint URL
                    </label>
                    <input
                      type="text"
                      value={aiConfig.baseUrl}
                      onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                      className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-on-surface-variant block mb-1">
                      Temperatura: {aiConfig.temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={aiConfig.temperature}
                      onChange={(e) => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })}
                      className="w-full mt-2 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={handleTestAi}
                    disabled={isAiTesting}
                    className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold border border-outline-variant/30 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">play_circle</span>
                    <span>{isAiTesting ? 'Verifica in corso...' : 'Testa Prompt AI'}</span>
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold shadow-sm hover:opacity-90 transition-all"
                  >
                    Salva Configurazione AI
                  </button>
                </div>
              </form>

              {/* Test Output Box */}
              {aiTestResult && (
                <div className="p-3 bg-surface-container rounded-xl border border-primary/30 text-xs text-on-surface whitespace-pre-wrap">
                  <span className="font-bold text-primary block mb-1">Risposta Test Modello:</span>
                  {aiTestResult}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VOICE & NATURAL SPEECH */}
          {activeTab === 'voice' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">record_voice_over</span>
                  <h3 className="font-headline font-bold text-base text-on-surface">
                    Sintesi Vocale Umana & Conversazione Empatica
                  </h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  La lettura vocale usa le voci disponibili gratuitamente sul tuo dispositivo. Qualità e scelta delle voci dipendono dal browser e dal sistema operativo.
                </p>
              </div>

              <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-4">
                {/* Voice Selection */}
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-xs text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">female</span>
                    <span>Voce selezionata</span>
                  </label>
                  <select
                    value={selectedVoiceName}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    className="w-full bg-surface-container p-3 rounded-xl border border-outline-variant/30 text-on-surface text-xs font-semibold outline-none cursor-pointer"
                  >
                    {voicesList.length > 0 ? (
                      voicesList.map((v) => (
                        <option key={v.id} value={v.name}>
                          {v.name} ({v.lang}{v.isNatural ? ' · voce avanzata' : ''})
                        </option>
                      ))
                    ) : (
                      <option value="">Voce italiana predefinita</option>
                    )}
                  </select>
                  <span className="text-[11px] text-on-surface-variant">
                    La qualità delle voci disponibili dipende dal dispositivo e dal browser. Scegli quella che preferisci e ascolta la prova.
                  </span>
                </div>

                {/* Cadence / Speed */}
                <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-xs text-on-surface">
                      Cadenza & Velocità di Parlato:
                    </label>
                    <span className="font-mono text-primary font-bold text-xs">{voiceSpeed}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.3"
                    step="0.05"
                    value={voiceSpeed}
                    onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-outline">
                    <span>0.8x (Molto Calma)</span>
                    <span>0.98x (Naturale Conversazione)</span>
                    <span>1.3x (Veloce)</span>
                  </div>
                </div>

                {/* Audio Engine Mode */}
                <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
                  <label className="font-bold text-xs text-on-surface">
                    Motore di Sintesi Audio
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleVoiceModeChange('browser')}
                      className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                        voiceMode === 'browser'
                          ? 'bg-primary/5 border-primary shadow-sm'
                          : 'bg-surface-container border-outline-variant/30 text-on-surface hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-on-surface">Naturale Browser (Consigliato)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 uppercase">
                          Gratis
                        </span>
                      </div>
                      <span className="text-[11px] text-on-surface-variant">
                        Usa una voce italiana disponibile sul tuo dispositivo. Nessun costo API.
                      </span>
                    </button>


                  </div>
                </div>

                {/* Test Voice Button */}
                <div className="pt-2 flex items-center justify-between border-t border-outline-variant/20">
                  <span className="text-[11px] text-on-surface-variant">
                    Clicca per ascoltare una frase di esempio con la voce selezionata
                  </span>
                  <button
                    type="button"
                    onClick={handleTestVoiceSample}
                    disabled={isVoiceTesting}
                    className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isVoiceTesting ? 'stop_circle' : 'play_arrow'}
                    </span>
                    <span>{isVoiceTesting ? 'In Riproduzione...' : 'Ascolta Prova Voce'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'turso' && (
            <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-3">
              <h3 className="font-headline font-bold text-base text-on-surface">Archivio dei dati commerciali</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">Le trattative, le attività e i brand sono salvati sul server e separati per account. Per il deploy configura TURSO_DATABASE_URL e TURSO_AUTH_TOKEN nelle variabili d’ambiente di Vercel. I token del database non vanno inseriti nel browser.</p>
              <p className="text-xs text-on-surface-variant">ID account per le integrazioni MCP: <code className="font-mono break-all">{user?.id || 'Accedi per visualizzarlo'}</code></p>
              <div className="pt-3 border-t border-outline-variant/30 flex flex-col gap-2">
                <strong className="text-xs text-on-surface">Hai usato la versione precedente?</strong>
                <p className="text-xs text-on-surface-variant">Puoi trasferire i dati salvati in questo browser solo se l’archivio dell’account è vuoto.</p>
                <button type="button" onClick={() => { if (window.confirm('Importare i dati locali precedenti in questo account?')) setImportFeedback(importLegacyData().message); }} className="self-start px-3 py-2 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface hover:border-primary">Importa dati locali precedenti</button>
                {importFeedback && <p role="status" className="text-xs text-on-surface-variant">{importFeedback}</p>}
              </div>
            </div>
          )}

          {/* TAB 5: MCP SERVER & AI AGENTS */}
          {activeTab === 'mcp' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">terminal</span>
                    <h3 className="font-headline font-bold text-base text-on-surface">
                      Server Model Context Protocol (MCP) Integrato
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    MCP Protocol v1.0
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Il server MCP STDIO legge lo stesso archivio della dashboard quando è configurato per un account. L’API HTTP usa un token dedicato per le integrazioni. Le modifiche diventano visibili nella dashboard al successivo caricamento.
                </p>
              </div>

              {/* MCP Tool List */}
              <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-3">
                <span className="font-bold text-xs text-on-surface">
                  Strumenti Esposti dal Server MCP:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { name: 'get_commercial_kpis', desc: 'Recupera venduto, pipeline attiva, win rate e attività di oggi' },
                    { name: 'list_opportunities', desc: 'Elenco filtrabile per brand (NoLimits, Webissimo, Sapori) e stage' },
                    { name: 'create_opportunity', desc: 'Crea una trattativa con prossima azione obbligatoria' },
                    { name: 'update_opportunity_stage', desc: 'Avanza trattativa (Contatto -> Appuntamento -> Trattativa -> Chiusura)' },
                    { name: 'set_next_action', desc: 'Assegna o aggiorna lo step futuro vincolante' },
                    { name: 'snooze_opportunity', desc: 'Mette in stand-by con motivo e data di risveglio automatico' },
                  ].map((t) => (
                    <div key={t.name} className="p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/20 flex flex-col">
                      <span className="font-mono font-bold text-primary text-[11px]">{t.name}</span>
                      <span className="text-[11px] text-on-surface-variant">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 text-xs text-on-surface-variant leading-relaxed">
                Per STDIO usa <code className="font-mono">npm run mcp</code> con TURSO_DATABASE_URL, TURSO_AUTH_TOKEN e MCP_OWNER_USER_ID nell’ambiente del processo. L’API HTTP richiede anche MCP_API_TOKEN ed espone le operazioni documentate nel README.
              </div>
            </div>
          )}

          {/* TAB 6: BRANDS & RESET DATA */}
          {activeTab === 'brands' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
                <h3 className="font-headline font-bold text-base text-on-surface">
                  Brand Commerciali & Gestione Database
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  I 3 brand primari attivi sono <strong>NoLimits</strong>, <strong>Webissimo</strong> e <strong>Sapori</strong>. Puoi aggiungere ulteriori brand o commerciali al team.
                </p>
              </div>

              {/* Data Reset & Demo Actions */}
              <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-3">
                <span className="font-bold text-xs text-on-surface">
                  Azzeramento Dati & Dati Demo Opzionali
                </span>
                <p className="text-xs text-on-surface-variant">
                  Attualmente tutti i dati partono puliti da zero. Se desideri testare la dashboard con 5 opportunità e attività di esempio, puoi caricarli e successivamente azzerarli in qualsiasi momento.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => {
                      if (confirm('Vuoi caricare i dati demo di esempio?')) loadDemoData();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold border border-primary/30 flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">science</span>
                    <span>Carica Dati Demo</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('Sei sicuro di voler resettare tutta la dashboard e impostare tutti i contatori a zero?')) resetAllData();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/30 flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                    <span>Ripristina Tutto a Zero (Clean Slate)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: CLOUD INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
                <h3 className="font-headline font-bold text-base text-on-surface">
                  Integrazioni Cloud, Webhooks & Vercel
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Per distribuire su Vercel in alta affidabilità, configura le variabili di ambiente nel pannello Vercel Project Settings.
                </p>
              </div>

              <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-3">
                <span className="font-bold text-xs text-on-surface">Variabili Obbligatorie su Vercel:</span>
                <div className="flex flex-col gap-2 font-mono text-[11px]">
                  <div className="p-2.5 bg-surface-container rounded-xl flex items-center justify-between">
                    <div>
                      <strong className="text-primary">TURSO_DATABASE_URL</strong>
                      <span className="text-on-surface-variant block text-[10px]">URL del cluster Turso Edge SQLite</span>
                    </div>
                    <span className="text-[10px] text-emerald-500 font-bold">10 GB Free</span>
                  </div>
                  <div className="p-2.5 bg-surface-container rounded-xl flex items-center justify-between">
                    <div>
                      <strong className="text-primary">TURSO_AUTH_TOKEN</strong>
                      <span className="text-on-surface-variant block text-[10px]">Token segreto di autenticazione Turso</span>
                    </div>
                    <span className="text-[10px] text-emerald-500 font-bold">Segreto</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
