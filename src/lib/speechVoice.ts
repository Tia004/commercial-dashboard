'use client';

export interface VoiceOption {
  id: string;
  name: string;
  lang: string;
  gender: 'female' | 'male' | 'unknown';
  isNatural: boolean;
  provider: 'browser' | 'cloud-hd';
  description: string;
}

const LOCAL_STORAGE_VOICE_KEY = 'hubc_crm_preferred_voice_v1';
const LOCAL_STORAGE_VOICE_SPEED_KEY = 'hubc_crm_voice_speed_v1';
const LOCAL_STORAGE_VOICE_MODE_KEY = 'hubc_crm_voice_mode_v1'; // 'browser' | 'cloud_hd'

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

  // Sort: Natural female voices first, then female voices, then others
  formatted.sort((a, b) => {
    const scoreA = (a.isNatural ? 10 : 0) + (a.gender === 'female' ? 5 : 0);
    const scoreB = (b.isNatural ? 10 : 0) + (b.gender === 'female' ? 5 : 0);
    return scoreB - scoreA;
  });

  return formatted;
}

// Returns the best default female Italian voice
export function getBestDefaultVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  const italian = voices.filter((v) => v.lang.startsWith('it'));

  if (italian.length === 0) return null;

  // 1. Check preferred saved voice
  try {
    const savedName = localStorage.getItem(LOCAL_STORAGE_VOICE_KEY);
    if (savedName) {
      const match = italian.find((v) => v.name === savedName);
      if (match) return match;
    }
  } catch (e) {}

  // 2. Look for known natural female Italian voices
  const naturalFemale = italian.find(
    (v) =>
      (v.name.toLowerCase().includes('natural') ||
        v.name.toLowerCase().includes('enhanced') ||
        v.name.toLowerCase().includes('google')) &&
      isItalianFemaleVoice(v.name)
  );
  if (naturalFemale) return naturalFemale;

  // 3. Look for Alice, Elsa, Federica, Chiara
  const specificFemale = italian.find(
    (v) =>
      v.name.toLowerCase().includes('elsa') ||
      v.name.toLowerCase().includes('alice') ||
      v.name.toLowerCase().includes('chiara') ||
      v.name.toLowerCase().includes('federica') ||
      v.name.toLowerCase().includes('isabella')
  );
  if (specificFemale) return specificFemale;

  // 4. Any female voice
  const anyFemale = italian.find((v) => isItalianFemaleVoice(v.name));
  if (anyFemale) return anyFemale;

  // 5. Fallback to first Italian voice
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

export function getSavedVoiceMode(): 'browser' | 'cloud_hd' {
  if (typeof window === 'undefined') return 'browser';
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_VOICE_MODE_KEY);
    return 'browser';
  } catch (e) {
    return 'browser';
  }
}

export function savePreferredVoiceMode(mode: 'browser' | 'cloud_hd') {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_VOICE_MODE_KEY, 'browser');
  } catch (e) {}
}

// Clean text for speech synthesis so it doesn't read markdown bullets or symbols
export function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold asterisks
    .replace(/\*(.*?)\*/g, '$1') // remove italics
    .replace(/#{1,6}\s?/g, '') // remove headings
    .replace(/`([^`]+)`/g, '$1') // remove backticks
    .replace(/[-*•]\s+/g, '') // remove bullet points
    .replace(/\n\s*\n/g, '. ') // double newline to sentence stop
    .replace(/\n/g, ', ') // newline to comma pause
    .replace(/\s{2,}/g, ' ') // normalize spaces
    .replace(/€\s?([0-9.]+)/g, '$1 euro') // pronounce currency naturally
    .replace(/([0-9.]+)€/g, '$1 euro')
    .trim();
}

// Global active audio instance for Cloud HD speech
let activeCloudAudio: HTMLAudioElement | null = null;

// Primary speech execution function
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

  // Stop any playing audio
  stopHumanVoice();

  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) {
    callbacks?.onEnd?.();
    return;
  }

  // Browser speech synthesis fallback
  fallbackBrowserSpeak(cleaned, callbacks, customVoiceName);
}

function fallbackBrowserSpeak(
  cleaned: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  },
  customVoiceName?: string
) {
  if (!('speechSynthesis' in window)) {
    callbacks?.onError?.(new Error('Sintesi vocale non supportata'));
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.lang = 'it-IT';
  utterance.rate = getSavedVoiceSpeed(); // 0.98 natural conversational cadence
  utterance.pitch = 1.04; // Slightly elevated warm feminine pitch

  // Pick voice
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

  utterance.onstart = () => callbacks?.onStart?.();
  utterance.onend = () => callbacks?.onEnd?.();
  utterance.onerror = (err) => {
    callbacks?.onError?.(err);
  };

  // Small timeout ensures Chrome/Safari speech synthesis initializes cleanly
  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 50);
}

export function stopHumanVoice(): void {
  if (typeof window === 'undefined') return;

  if (activeCloudAudio) {
    activeCloudAudio.pause();
    activeCloudAudio.currentTime = 0;
    activeCloudAudio = null;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
