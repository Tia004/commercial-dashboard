'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/lib/store';
import { useAuth } from '@/lib/auth';
import {
  speakHumanVoice,
  stopHumanVoice,
  getItalianVoices,
  getSavedVoiceName,
  savePreferredVoice,
  getSavedVoiceSpeed,
  savePreferredVoiceSpeed,
  getSavedVoiceMode,
  savePreferredVoiceMode,
  VoiceOption,
} from '@/lib/speechVoice';

export const AiCopilotBar: React.FC = () => {
  const { executeAIInstruction, alerts, kpis } = useCRM();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Voice Customization State
  const [isVoiceMenuOpen, setIsVoiceMenuOpen] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [voiceSpeed, setVoiceSpeed] = useState<number>(0.98);
  const [voiceMode, setVoiceMode] = useState<'browser' | 'cloud_hd'>('browser');

  // Load available system and browser voices
  useEffect(() => {
    const loadVoices = () => {
      const v = getItalianVoices();
      setAvailableVoices(v);
      const saved = getSavedVoiceName();
      if (saved) {
        setSelectedVoiceName(saved);
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
  }, []);

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

  // Preview / Test Voice
  const handleTestVoice = () => {
    const testSample = `Buongiorno ${user?.name ? user.name.split(' ')[0] : 'Direttore'}, sono la tua assistente commerciale esecutiva. La mia voce è calibrata per conversare in modo caldo, naturale e professionale.`;
    speakHumanVoice(
      testSample,
      {
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      },
      selectedVoiceName
    );
  };

  // Text to Speech Briefing
  const speakBriefing = () => {
    if (isSpeaking) {
      stopHumanVoice();
      setIsSpeaking(false);
      return;
    }

    const userName = user?.name ? user.name.split(' ')[0] : 'Direttore';
    let textToSpeak = `Buongiorno ${userName}. `;
    if (kpis.openDealsCount === 0) {
      textToSpeak += `La dashboard commerciale è attiva e inizializzata con tutti i contatori a zero. Puoi inserire la tua prima opportunità con il pulsante dedicato.`;
    } else {
      textToSpeak += `Ecco il punto commerciale di oggi: il valore della pipeline attiva è di ${kpis.pipelineTotal.toLocaleString()} euro, con ${kpis.openDealsCount} trattative in corso e ${alerts.length} anomalie da verificare. Ci sono ${kpis.scheduledMeetingsCount} appuntamenti programmati per i brand aziendali.`;
    }

    speakHumanVoice(
      textToSpeak,
      {
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      },
      selectedVoiceName
    );
  };

  // Speech to Text (Microphone dictation)
  const toggleListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Riconoscimento vocale non supportato nel browser. Puoi digitare il comando nella casella.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'it-IT';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setPrompt(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const handleRunCommand = async (customPrompt?: string) => {
    const textToRun = customPrompt || prompt;
    if (!textToRun.trim()) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const res = await executeAIInstruction(textToRun);
      setExecutionResult(res);
      setPrompt('');

      // If success, speak confirmation with pleasant human voice
      if (res.success) {
        speakHumanVoice(
          res.message.substring(0, 140),
          {
            onStart: () => setIsSpeaking(true),
            onEnd: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
          },
          selectedVoiceName
        );
      }
    } catch (e: any) {
      setExecutionResult({
        success: false,
        message: e?.message || "Errore durante l'esecuzione del comando AI",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/30 flex flex-col gap-4 relative overflow-hidden">
      {/* Background neurology icon */}
      <div className="absolute right-0 top-0 w-80 h-full opacity-[0.03] pointer-events-none flex items-center justify-end pr-6">
        <span className="material-symbols-outlined text-[200px]">neurology</span>
      </div>

      {/* Top row: Title, status, actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm flex-shrink-0">
            <span className="material-symbols-outlined text-[26px]">smart_toy</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-headline font-bold text-base text-on-surface tracking-tight">
                Assistente operativo
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-bold text-[10px] uppercase tracking-wider border border-outline-variant/30">
                Comandi rapidi
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Cerca le attività, apri il modulo per un nuovo lead o ascolta il riepilogo.
            </p>
          </div>
        </div>

        {/* TTS & Voice Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Voice Config Trigger */}
          <button
            onClick={() => setIsVoiceMenuOpen(!isVoiceMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant/30 transition-all shadow-sm"
            title="Scegli la voce femminile e regola la cadenza naturale"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">record_voice_over</span>
            <span>Voce AI</span>
            <span className="material-symbols-outlined text-[14px] text-outline">
              {isVoiceMenuOpen ? 'expand_less' : 'tune'}
            </span>
          </button>

          {/* Speak / Stop Briefing Button */}
          <button
            onClick={speakBriefing}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${
              isSpeaking
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-primary text-on-primary hover:opacity-90'
            }`}
            title="Ascolta sintesi vocale briefing con voce naturale"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isSpeaking ? 'stop_circle' : 'volume_up'}
            </span>
            <span>{isSpeaking ? 'Interrompi Voce' : 'Ascolta riepilogo'}</span>
          </button>
        </div>
      </div>

      {/* Voice Configuration Panel (Drawer) */}
      {isVoiceMenuOpen && (
        <div className="p-4 bg-surface-container-low rounded-2xl border border-primary/20 flex flex-col gap-3.5 animate-fade-in z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">graphic_eq</span>
              <span className="font-headline font-bold text-xs text-on-surface">
                Voce italiana del dispositivo
              </span>
            </div>
            <button
              onClick={() => setIsVoiceMenuOpen(false)}
              className="text-outline hover:text-on-surface text-xs"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Voice Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
                <span>Voce selezionata</span>
                <span className="material-symbols-outlined text-[13px] text-emerald-500">female</span>
              </label>
              <select
                value={selectedVoiceName}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="bg-surface-container p-2 rounded-xl border border-outline-variant/30 text-on-surface text-xs outline-none cursor-pointer"
              >
                {availableVoices.length > 0 ? (
                  availableVoices.map((v) => (
                    <option key={v.id} value={v.name}>
                      {v.name} ({v.gender === 'female' ? 'Femminile' : 'Maschile'}{v.isNatural ? ' • avanzata' : ''})
                    </option>
                  ))
                ) : (
                  <option value="">Voce di sistema predefinita</option>
                )}
              </select>
            </div>

            {/* Cadence / Speed */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-on-surface-variant flex items-center justify-between">
                <span>Cadenza Conversazionale</span>
                <span className="font-mono text-primary font-bold">{voiceSpeed}x</span>
              </label>
              <div className="flex items-center gap-2 bg-surface-container p-2 rounded-xl border border-outline-variant/30">
                <input
                  type="range"
                  min="0.8"
                  max="1.3"
                  step="0.05"
                  value={voiceSpeed}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
            </div>

            {/* Mode & Test Action */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-on-surface-variant">
                Modalità Audio
              </label>
              <div className="flex items-center gap-2">
                <span className="flex-1 p-2 rounded-xl text-xs font-semibold border bg-surface-container text-on-surface border-outline-variant/30 flex items-center justify-center gap-1.5"><span className="material-symbols-outlined text-[15px]">devices</span>Voce del dispositivo · gratuita</span>

                <button
                  type="button"
                  onClick={handleTestVoice}
                  disabled={isSpeaking}
                  className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs border border-primary/30 flex items-center gap-1 transition-all"
                  title="Ascolta una frase di prova per valutare la naturalezza della voce"
                >
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                  <span>Prova</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio Waveform Bar (active during speech or listening) */}
      {(isSpeaking || isListening) && (
        <div className="bg-surface-container-low rounded-xl p-3 flex items-center justify-between gap-4 border border-primary/30 animate-fade-in z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] animate-pulse">
                {isListening ? 'mic' : 'graphic_eq'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-on-surface">
                {isListening
                  ? 'In ascolto del microfono... Dì il tuo comando adesso'
                  : 'Assistente AI: Riproduzione con voce naturale e cadenza fluida...'}
              </span>
              <span className="text-[11px] text-on-surface-variant">
                Modello vocale: {selectedVoiceName || 'Sintesi neurale italiana'}
              </span>
            </div>
          </div>
          {/* Animated wave bars */}
          <div className="flex items-center gap-1 h-8 px-3 py-1 bg-surface-container rounded-lg">
            <div className="w-1 rounded-full bg-primary animate-wave-1 h-3" />
            <div className="w-1 rounded-full bg-primary-container animate-wave-2 h-6" />
            <div className="w-1 rounded-full bg-primary animate-wave-3 h-8" />
            <div className="w-1 rounded-full bg-primary-container animate-wave-4 h-5" />
            <div className="w-1 rounded-full bg-primary animate-wave-5 h-7" />
          </div>
        </div>
      )}

      {/* Main Command Input Box */}
      <div className="flex items-center bg-surface-container-low border border-outline-variant/40 rounded-xl p-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all z-10">
        <button
          onClick={toggleListening}
          className={`p-2 rounded-lg transition-colors ${
            isListening
              ? 'bg-rose-500 text-white animate-pulse'
              : 'text-outline hover:text-primary hover:bg-surface-container'
          }`}
          title="Attiva microfono per dettare"
        >
          <span className="material-symbols-outlined text-[20px]">mic</span>
        </button>

        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRunCommand();
          }}
          placeholder='Es: "Crea nuova opportunità per Mario Rossi NoLimits valore 18500€" oppure "Cosa devo fare oggi?"'
          className="bg-transparent w-full text-on-surface placeholder:text-on-surface-variant/60 text-xs md:text-sm outline-none px-3 font-medium"
        />

        <button
          onClick={() => handleRunCommand()}
          disabled={isExecuting || !prompt.trim()}
          className="bg-primary text-on-primary font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 flex-shrink-0"
        >
          {isExecuting ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Esecuzione...</span>
            </>
          ) : (
            <>
              <span>Esegui</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </>
          )}
        </button>
      </div>

      {/* Quick Suggestion Chips */}
      <div className="flex flex-wrap items-center gap-1.5 z-10">
        <span className="text-[11px] font-bold text-outline uppercase tracking-wider mr-1">
          Comandi Rapidi:
        </span>
        {[
          'Cosa devo fare oggi?',
        ].map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleRunCommand(chip)}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-medium transition-colors border border-outline-variant/30 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[12px] text-primary">bolt</span>
            <span>{chip}</span>
          </button>
        ))}
      </div>

      {/* Execution feedback banner */}
      {executionResult && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-start justify-between gap-3 animate-fade-in z-10 ${
            executionResult.success
              ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/30'
          }`}
        >
          <div className="flex items-start gap-2 whitespace-pre-line">
            <span className="material-symbols-outlined text-[18px]">
              {executionResult.success ? 'check_circle' : 'error'}
            </span>
            <span>{executionResult.message}</span>
          </div>
          <button
            onClick={() => setExecutionResult(null)}
            className="text-outline hover:text-on-surface"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
