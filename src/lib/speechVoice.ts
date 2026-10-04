'use client';

export interface JarvisVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  tone: string;
  description: string;
  isDefault?: boolean;
}

export const JARVIS_VOICES: JarvisVoice[] = [
  {
    id: 'Charon',
    name: 'Charon (Jarvis Originale)',
    gender: 'male',
    tone: 'Calda, naturale e carismatica',
    description: 'La voce predefinita di Jarvis. Timbro caldo, autorevole e rassicurante.',
    isDefault: true,
  },
  {
    id: 'Puck',
    name: 'Puck (Energica)',
    gender: 'male',
    tone: 'Brillante e dinamica',
    description: 'Tono vivace ed energico, ideale per dare la carica alla squadra commerciale.',
  },
  {
    id: 'Kore',
    name: 'Kore (Esecutiva)',
    gender: 'female',
    tone: 'Limpida e professionale',
    description: 'Voce femminile chiara ed elegante, eccellente per report esecutivi e sintesi.',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir (Profonda)',
    gender: 'male',
    tone: 'Bassa e determinata',
    description: 'Timbro basso, fermo e risoluto per decisioni strategiche importanti.',
  },
  {
    id: 'Aoede',
    name: 'Aoede (Armoniosa)',
    gender: 'female',
    tone: 'Fluida ed espressiva',
    description: 'Voce femminile melodica, empatica e piacevole per ascolti prolungati.',
  },
];

export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  gender: 'female' | 'male' | 'unknown';
  isNatural: boolean;
  provider: 'browser' | 'jarvis-hd';
  description: string;
}

const LOCAL_STORAGE_JARVIS_VOICE_KEY = 'hubc_crm_jarvis_voice_v1';
const LOCAL_STORAGE_VOICE_KEY = 'hubc_crm_preferred_voice_v1';
const LOCAL_STORAGE_VOICE_SPEED_KEY = 'hubc_crm_voice_speed_v1';

// Global audio element reference for cloud/Jarvis playback
let currentAudioElement: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let isAudioActive = false;

export function getSavedJarvisVoice(): string {
  if (typeof window === 'undefined') return 'Charon';
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_JARVIS_VOICE_KEY);
    if (saved && JARVIS_VOICES.some((v) => v.id === saved)) return saved;
  } catch {}
  return 'Charon';
}

export function saveJarvisVoice(voiceId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_JARVIS_VOICE_KEY, voiceId);
  } catch {}
}

export function isSpeechPlaying(): boolean {
  return isAudioActive;
}

/**
 * Stop any ongoing audio playback immediately (both Jarvis cloud audio and browser speech synthesis)
 */
export function stopAllAudio(): void {
  isAudioActive = false;

  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    } catch {}
    currentAudioElement = null;
  }

  if (currentAudioUrl) {
    try {
      URL.revokeObjectURL(currentAudioUrl);
    } catch {}
    currentAudioUrl = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

// Backward compatibility alias
export const stopHumanVoice = stopAllAudio;

/**
 * Play an AI-generated briefing or custom text via Jarvis neural voices
 */
export async function playAiBriefing(params: {
  crmContext?: {
    pipelineTotal?: number;
    openDealsCount?: number;
    todayTasksCount?: number;
    brands?: string[];
    urgentDeals?: string[];
  };
  text?: string;
  voice?: string;
  onGenerating?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
  onText?: (text: string) => void;
}): Promise<void> {
  stopAllAudio();

  const chosenVoice = params.voice || getSavedJarvisVoice();
  params.onGenerating?.();

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generateBriefing: !params.text,
        text: params.text || '',
        voice: chosenVoice,
        crmContext: params.crmContext || {},
      }),
    });

    // Check for briefing text returned in headers or fallback json
    const headerText = res.headers.get('x-briefing-text');
    if (headerText) {
      try {
        let decoded = '';
        if (headerText.startsWith('%') || headerText.includes(' ')) {
          decoded = decodeURIComponent(headerText);
        } else {
          try {
            const binStr = atob(headerText);
            const bytes = Uint8Array.from(binStr, (c) => c.charCodeAt(0));
            decoded = new TextDecoder('utf-8').decode(bytes);
          } catch {
            decoded = decodeURIComponent(headerText);
          }
        }
        if (decoded) params.onText?.(decoded);
      } catch {}
    }

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('audio/wav') && res.ok) {
      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      currentAudioUrl = audioUrl;

      const audio = new Audio(audioUrl);
      currentAudioElement = audio;
      isAudioActive = true;

      audio.onplay = () => {
        params.onStart?.();
      };

      audio.onended = () => {
        isAudioActive = false;
        if (currentAudioUrl) {
          URL.revokeObjectURL(currentAudioUrl);
          currentAudioUrl = null;
        }
        currentAudioElement = null;
        params.onEnd?.();
      };

      audio.onerror = (e) => {
        console.warn('Audio playback error:', e);
        isAudioActive = false;
        params.onError?.(new Error('Errore durante la riproduzione audio'));
      };

      await audio.play();
      return;
    }

    // Fallback JSON scenario
    const data = await res.json().catch(() => ({}));
    if (data?.text) {
      params.onText?.(data.text);
      speakHumanVoice(
        data.text,
        {
          onStart: params.onStart,
          onEnd: params.onEnd,
          onError: params.onError,
        }
      );
      return;
    }

    throw new Error(data?.error || 'Sintesi vocale non riuscita');
  } catch (err: any) {
    console.warn('playAiBriefing error:', err);
    isAudioActive = false;
    params.onError?.(err instanceof Error ? err : new Error(String(err)));
    params.onEnd?.();
  }
}

/**
 * Play a short test sample for a specific Jarvis voice
 */
export async function playVoiceSample(
  voiceId: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: Error) => void;
  }
): Promise<void> {
  const sampleText = `Ciao! Sono la voce ${voiceId} di Jarvis. Ho sincronizzato le tue opportunità commerciali e siamo pronti a chiudere nuovi accordi.`;
  await playAiBriefing({
    text: sampleText,
    voice: voiceId,
    onStart: callbacks?.onStart,
    onEnd: callbacks?.onEnd,
    onError: callbacks?.onError,
  });
}

// Helper to check if a voice name represents an Italian female voice
function isItalianFemaleVoice(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('elsa') ||
    lower.includes('isabella') ||
    lower.includes('alice') ||
    lower.includes('federica') ||
    lower.includes('chiara') ||
    lower.includes('paola') ||
    lower.includes('aurora') ||
    lower.includes('siri') ||
    lower.includes('female') ||
    lower.includes('donna') ||
    lower.includes('google italiano') ||
    lower.includes('natural')
  );
}

// Get the list of all Italian natural voices sorted by highest conversational quality
export function getItalianVoices(): VoiceOption[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }

  const allVoices = window.speechSynthesis.getVoices();
  const italianVoices = allVoices.filter(
    (v) => v.lang.startsWith('it') || v.lang.toLowerCase().includes('ita')
  );

  const formatted: VoiceOption[] = italianVoices.map((v) => {
    const isFemale = isItalianFemaleVoice(v.name);
    const isNatural =
      v.name.toLowerCase().includes('natural') ||
      v.name.toLowerCase().includes('online') ||
      v.name.toLowerCase().includes('enhanced') ||
      v.name.toLowerCase().includes('premium') ||
      v.name.toLowerCase().includes('google');

    let desc = 'Voce sintetica di sistema';
    if (v.name.toLowerCase().includes('elsa')) desc = 'Voce naturale Microsoft Elsa (Alta definizione)';
    else if (v.name.toLowerCase().includes('isabella')) desc = 'Voce naturale Microsoft Isabella (Calda ed empatica)';
    else if (v.name.toLowerCase().includes('alice')) desc = 'Voce Apple Alice (Assistente Direzionale)';
    else if (v.name.toLowerCase().includes('federica')) desc = 'Voce Apple Federica (Fluida e chiara)';
    else if (v.name.toLowerCase().includes('google')) desc = 'Google Voice Italiano HD';
    else if (isFemale) desc = 'Voce femminile italiana';

    return {
      id: v.name,
      name: v.name,
      lang: v.lang,
      gender: isFemale ? 'female' : 'male',
      isNatural,
      provider: 'browser',
      description: desc,
    };
  });

  formatted.sort((a, b) => {
    const scoreA = (a.isNatural ? 10 : 0) + (a.gender === 'female' ? 5 : 0);
    const scoreB = (b.isNatural ? 10 : 0) + (b.gender === 'female' ? 5 : 0);
    return scoreB - scoreA;
  });

  return formatted;
}

export function getBestDefaultVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  const italian = voices.filter((v) => v.lang.startsWith('it'));

  if (italian.length === 0) return null;

  try {
    const savedName = localStorage.getItem(LOCAL_STORAGE_VOICE_KEY);
    if (savedName) {
      const match = italian.find((v) => v.name === savedName);
      if (match) return match;
    }
  } catch (e) {}

  const naturalFemale = italian.find(
    (v) =>
      (v.name.toLowerCase().includes('natural') ||
        v.name.toLowerCase().includes('enhanced') ||
        v.name.toLowerCase().includes('google')) &&
      isItalianFemaleVoice(v.name)
  );
  if (naturalFemale) return naturalFemale;

  const specificFemale = italian.find(
    (v) =>
      v.name.toLowerCase().includes('elsa') ||
      v.name.toLowerCase().includes('alice') ||
      v.name.toLowerCase().includes('chiara') ||
      v.name.toLowerCase().includes('federica') ||
      v.name.toLowerCase().includes('isabella')
  );
  if (specificFemale) return specificFemale;

  const anyFemale = italian.find((v) => isItalianFemaleVoice(v.name));
  if (anyFemale) return anyFemale;

  return italian[0];
}

export function savePreferredVoice(voiceName: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_VOICE_KEY, voiceName);
  } catch (e) {}
}

export function getSavedVoiceName(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LOCAL_STORAGE_VOICE_KEY);
  } catch (e) {
    return null;
  }
}

export function getSavedVoiceSpeed(): number {
  if (typeof window === 'undefined') return 0.98;
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_VOICE_SPEED_KEY);
    return saved ? parseFloat(saved) : 0.98;
  } catch (e) {
    return 0.98;
  }
}

export function savePreferredVoiceSpeed(speed: number) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_VOICE_SPEED_KEY, speed.toString());
  } catch (e) {}
}

export function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s?/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[-*•]\s+/g, '')
    .replace(/\n\s*\n/g, '. ')
    .replace(/\n/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/€\s?([0-9.]+)/g, '$1 euro')
    .replace(/([0-9.]+)€/g, '$1 euro')
    .trim();
}

export function speakHumanVoice(
  text: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  },
  customVoiceName?: string
): void {
  if (typeof window === 'undefined') return;

  stopAllAudio();

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) {
    callbacks?.onEnd?.();
    return;
  }

  if (!('speechSynthesis' in window)) {
    callbacks?.onError?.(new Error('Sintesi vocale non supportata'));
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.lang = 'it-IT';
  utterance.rate = getSavedVoiceSpeed();
  utterance.pitch = 1.04;

  const allVoices = window.speechSynthesis.getVoices();
  let chosenVoice: SpeechSynthesisVoice | null = null;

  if (customVoiceName) {
    chosenVoice = allVoices.find((v) => v.name === customVoiceName) || null;
  }
  if (!chosenVoice) {
    chosenVoice = getBestDefaultVoice();
  }

  if (chosenVoice) {
    utterance.voice = chosenVoice;
  }

  isAudioActive = true;

  utterance.onstart = () => {
    callbacks?.onStart?.();
  };

  utterance.onend = () => {
    isAudioActive = false;
    callbacks?.onEnd?.();
  };

  utterance.onerror = (err) => {
    isAudioActive = false;
    callbacks?.onError?.(err);
  };

  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 50);
}

