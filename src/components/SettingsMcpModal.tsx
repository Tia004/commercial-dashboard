'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import {
  AIProviderType,
  AIProviderConfig,
  DEFAULT_AI_CONFIGS,
  getSavedAIConfig,
  saveAIConfig,
  executeUniversalAI,
} from '@/lib/aiProvider';
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
    'account' | 'ai' | 'turso' | 'mcp' | 'brands' | 'integrations' | 'preferences'
  >('account');

  // AI State
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({
    provider: 'gemini',
    apiKey: '',
    baseUrl: DEFAULT_AI_CONFIGS.gemini.defaultBaseUrl,
    model: DEFAULT_AI_CONFIGS.gemini.defaultModel,
    temperature: 0.3,
  });
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [isAiTesting, setIsAiTesting] = useState(false);

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

  useEffect(() => {
    setAiConfig(getSavedAIConfig());
    try {
      const savedTursoUrl = localStorage.getItem('hubc_crm_turso_url_v1') || '';
      const savedTursoToken = localStorage.getItem('hubc_crm_turso_token_v1') || '';
      setTursoUrl(savedTursoUrl);
      setTursoToken(savedTursoToken);
    } catch (e) {}
  }, []);

  if (!isSettingsModalOpen) return null;

  const handleProviderChange = (provider: AIProviderType) => {
    const preset = DEFAULT_AI_CONFIGS[provider];
    const updated: AIProviderConfig = {
      ...aiConfig,
      provider,
      baseUrl: preset.defaultBaseUrl,
      model: preset.defaultModel,
    };
    setAiConfig(updated);
    saveAIConfig(updated);
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
                Gestione Account, Passkey Biometriche, Motori AI Custom, Database Turso Edge e Server MCP
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
            { id: 'account', label: 'Account & Passkey', icon: 'fingerprint' },
            { id: 'ai', label: 'Modelli AI & Chiavi Custom', icon: 'psychology' },
            { id: 'turso', label: 'Database Turso (10GB)', icon: 'database' },
            { id: 'mcp', label: 'Server MCP & Agenti AI', icon: 'terminal' },
            { id: 'brands', label: 'Brand & Listini', icon: 'corporate_fare' },
            { id: 'integrations', label: 'Integrazioni Cloud', icon: 'hub' },
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
              {/* Account summary */}
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary font-bold text-base flex items-center justify-center shadow-sm">
                    {user?.name.substring(0, 2).toUpperCase() || 'AR'}
                  </div>
                  <div>
                    <span className="font-headline font-bold text-base text-on-surface block">
                      {user?.name || 'Utente Non Connesso'}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      {user?.email || 'Nessuna email'} • <strong className="text-primary">{user?.role}</strong>
                    </span>
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

              {/* Passkeys Management */}
              <div className="p-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">fingerprint</span>
                    <h3 className="font-headline font-bold text-base text-on-surface">
                      Passkey Biometriche (Touch ID su macOS & Windows Hello)
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    FIDO2 / WebAuthn Standard
                  </span>
                </div>

                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Le Passkey ti permettono di accedere all&apos;Hub Commerciale in 1 secondo utilizzando l&apos;impronta digitale o il riconoscimento facciale del tuo Mac o PC Windows, senza dover digitare alcuna password.
                </p>

                {/* Create Passkey Box */}
                <div className="p-4 bg-surface-container-low rounded-xl border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 w-full">
                    <label className="font-bold text-on-surface block mb-1">
                      Etichetta Dispositivo (opzionale)
                    </label>
                    <input
                      type="text"
                      placeholder="Es: MacBook Pro di Alessandro / PC Ufficio Windows Hello"
                      value={passkeyLabel}
                      onChange={(e) => setPasskeyLabel(e.target.value)}
                      className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                    />
                  </div>

                  <button
                    onClick={handleCreatePasskey}
                    className="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold shadow-md hover:opacity-90 transition-all flex items-center gap-2 flex-shrink-0 self-end sm:self-auto"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_moderator</span>
                    <span>Crea Passkey Ora</span>
                  </button>
                </div>

                {/* Passkey Feedback Message */}
                {passkeyFeedback && (
                  <div className="p-3 bg-surface-container rounded-xl text-xs font-semibold text-on-surface flex items-center justify-between">
                    <span>{passkeyFeedback}</span>
                    <button onClick={() => setPasskeyFeedback(null)} className="text-outline hover:text-on-surface">✕</button>
                  </div>
                )}

                {/* Registered Passkeys List */}
                <div className="flex flex-col gap-2 pt-2">
                  <span className="font-bold text-on-surface-variant uppercase text-[10px] tracking-wider">
                    Passkey Registrate ({user?.passkeys?.length || 0})
                  </span>

                  {user?.passkeys && user.passkeys.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {user.passkeys.map((pk) => (
                        <div
                          key={pk.id}
                          className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-[20px]">
                              fingerprint
                            </span>
                            <div>
                              <span className="font-bold text-on-surface block">{pk.name}</span>
                              <span className="text-[10px] text-on-surface-variant font-mono">
                                Creata il {pk.createdAt}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleTestPasskey}
                              className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface hover:text-primary font-semibold text-[11px] border border-outline-variant/30 transition-colors"
                            >
                              Testa Biometria
                            </button>
                            <button
                              onClick={() => removePasskey(pk.id)}
                              className="p-1.5 rounded-lg text-outline hover:text-rose-500 transition-colors"
                              title="Rimuovi passkey"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center bg-surface-container-low rounded-xl text-on-surface-variant text-xs">
                      Nessuna passkey ancora registrata. Crea la prima passkey per abilitare il login con Touch ID / Windows Hello.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI MODELS & CUSTOM KEYS */}
          {activeTab === 'ai' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">psychology</span>
                  <h3 className="font-headline font-bold text-base text-on-surface">
                    Supporto Universale Multi-Provider AI
                  </h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Configura il modello che preferisci: puoi usare la chiave gratuita di <strong>Google Gemini Flash Lite</strong>, oppure collegare direttamente la tua chiave personale di <strong>ChatGPT (OpenAI)</strong>, <strong>Claude (Anthropic)</strong>, <strong>NVIDIA NIM</strong>, <strong>OpenRouter</strong>, <strong>Groq</strong> o un endpoint locale (Ollama / LM Studio).
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
                      Modello Selezionato
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
                      Base Endpoint URL (OpenAI-compatible)
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
                      Temperatura Generativa: {aiConfig.temperature}
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

          {/* TAB 3: TURSO DATABASE (10GB EDGE SQLITE) */}
          {activeTab === 'turso' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">database</span>
                    <h3 className="font-headline font-bold text-base text-on-surface">
                      Database Turso Edge Cloud (10GB Dedicati Gratuiti)
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    libSQL Edge Engine
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Ogni account aziendale può collegare il proprio database Turso gratuito con 10GB di spazio ad altissima velocità su edge SQLite (fino a 500 database per account e latenza &lt; 20ms).
                </p>
              </div>

              <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-3">
                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">
                    Turso Database URL (es. libsql://nome-db-org.turso.io)
                  </label>
                  <input
                    type="text"
                    placeholder="libsql://tuo-database-turso.turso.io"
                    value={tursoUrl}
                    onChange={(e) => setTursoUrl(e.target.value)}
                    className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-on-surface-variant block mb-1">
                    Turso Auth Token
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJFZERTQ..."
                    value={tursoToken}
                    onChange={(e) => setTursoToken(e.target.value)}
                    className="w-full bg-surface-container p-2.5 rounded-xl border border-outline-variant/30 text-on-surface font-mono outline-none"
                  />
                  <span className="text-[10px] text-on-surface-variant mt-1 block">
                    Puoi ottenere il token con il comando CLI: <code className="font-mono text-primary font-bold">turso db tokens create nome-db</code>
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestTurso}
                      disabled={isTursoTesting}
                      className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold shadow-sm hover:opacity-90 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">bolt</span>
                      <span>{isTursoTesting ? 'Ping in corso...' : 'Verifica Connessione Turso'}</span>
                    </button>
                  </div>

                  {tursoTestResult && (
                    <div
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${
                        tursoTestResult.success
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {tursoTestResult.success ? 'check_circle' : 'cancel'}
                      </span>
                      <span>
                        {tursoTestResult.success
                          ? `Connesso con successo! Latenza: ${tursoTestResult.latencyMs}ms`
                          : `Errore: ${tursoTestResult.error}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MCP SERVER & AUTO-CONNECT */}
          {activeTab === 'mcp' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">terminal</span>
                  <h3 className="font-headline font-bold text-base text-on-surface">
                    Integrazione MCP Universale (Model Context Protocol)
                  </h3>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Collega qualsiasi assistente AI (Claude Desktop, Cowork, Codex, Cursor, Windsurf, Roo Code, Goose, ChatGPT) premendo il tasto per copiare la configurazione esatta.
                </p>
              </div>

              {/* 1-Click Copy Configurations */}
              <div className="flex flex-col gap-3">
                <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-on-surface">
                      Configurazione STDIO per Claude Desktop, Cowork & Codex
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(
                            {
                              mcpServers: {
                                'hub-commerciale': {
                                  command: 'node',
                                  args: [
                                    '/Users/tia/Downloads/Siti/commercial-dashboard/scripts/mcp-server.js',
                                  ],
                                },
                              },
                            },
                            null,
                            2
                          ),
                          'stdio'
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:opacity-90 shadow-sm"
                    >
                      {copiedKey === 'stdio' ? 'Copiato!' : 'Copia Configurazione JSON'}
                    </button>
                  </div>
                  <pre className="p-3 bg-surface-container rounded-xl font-mono text-[11px] text-on-surface overflow-x-auto">
{`{
  "mcpServers": {
    "hub-commerciale": {
      "command": "node",
      "args": ["/Users/tia/Downloads/Siti/commercial-dashboard/scripts/mcp-server.js"]
    }
  }
}`}
                  </pre>
                </div>

                <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-on-surface">
                      Configurazione Custom per Windsurf, Goose, Roo Code o Agenti Web
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard('http://localhost:3000/api/mcp', 'http')
                      }
                      className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs border border-outline-variant/30"
                    >
                      {copiedKey === 'http' ? 'Copiato URL!' : 'Copia Endpoint HTTP'}
                    </button>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Per agenti remoti o serverless puoi utilizzare l&apos;endpoint REST/SSE su: <code className="font-mono text-primary font-bold">http://localhost:3000/api/mcp</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BRANDS & TEAM */}
          {activeTab === 'brands' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-3">
                <h4 className="font-headline font-bold text-sm text-on-surface">
                  Brand Commerciali Gestiti ({brands.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {brands.map((b) => (
                    <span
                      key={b}
                      className="px-3 py-1.5 rounded-xl bg-surface-container text-on-surface font-bold text-xs border border-outline-variant/30 flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span>{b}</span>
                    </span>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newBrandName.trim()) {
                      addBrand(newBrandName.trim());
                      setNewBrandName('');
                    }
                  }}
                  className="flex gap-2 mt-2"
                >
                  <input
                    type="text"
                    placeholder="Nome nuovo brand aziendale..."
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    className="bg-surface-container px-3 py-2 rounded-xl border border-outline-variant/30 text-on-surface outline-none flex-1"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-on-primary font-bold rounded-xl shadow-sm hover:opacity-90"
                  >
                    Aggiungi Brand
                  </button>
                </form>
              </div>

              <div className="p-4 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col gap-3">
                <h4 className="font-headline font-bold text-sm text-on-surface">
                  Team Vendite (Commerciali Assegnatari)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {salesReps.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/20 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center">
                          {r.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-on-surface block text-xs">{r.name}</span>
                          <span className="text-[10px] text-on-surface-variant">{r.role}</span>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Attivo" />
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newRepName.trim()) {
                      addSalesRep(newRepName.trim(), newRepRole);
                      setNewRepName('');
                    }
                  }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2"
                >
                  <input
                    type="text"
                    placeholder="Nome commerciale..."
                    value={newRepName}
                    onChange={(e) => setNewRepName(e.target.value)}
                    className="bg-surface-container px-3 py-2 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Ruolo (es: Key Account)..."
                    value={newRepRole}
                    onChange={(e) => setNewRepRole(e.target.value)}
                    className="bg-surface-container px-3 py-2 rounded-xl border border-outline-variant/30 text-on-surface outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-on-primary font-bold rounded-xl shadow-sm hover:opacity-90"
                  >
                    Aggiungi Rep
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 6: INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <div className="flex flex-col gap-3">
              <span className="font-bold text-on-surface">Connessioni Cloud & Webhook Attivi</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { name: 'WhatsApp Cloud API', desc: 'Click-to-chat e template automatici di promemoria', icon: 'chat', status: 'Attivo' },
                  { name: 'Google Calendar & Meet', desc: 'Generazione automatica meeting link per ogni video call', icon: 'videocam', status: 'Attivo' },
                  { name: 'Stripe & Fatturazione', desc: 'Generazione acconto o saldo alla fase "Venduta"', icon: 'payments', status: 'Pronto' },
                  { name: 'DocuSign / SignWell', desc: 'Tracking firma digitale contratto di vendita', icon: 'draw', status: 'Pronto' },
                  { name: 'VoIP / Aircall', desc: 'Chiamata in 1 click e registrazione automatica durata', icon: 'phone_in_talk', status: 'Attivo' },
                  { name: 'Telegram Bot Alert', desc: 'Notifica push istantanea sul canale vendite aziendale', icon: 'send', status: 'Configurato' },
                ].map((s, idx) => (
                  <div key={idx} className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">
                      {s.icon}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-on-surface text-xs">{s.name}</span>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                          {s.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
