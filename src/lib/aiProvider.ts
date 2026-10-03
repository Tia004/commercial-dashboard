'use client';

export type AIProviderType =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'nvidia'
  | 'groq'
  | 'custom';

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

export const DEFAULT_AI_CONFIGS: Record<AIProviderType, { name: string; defaultBaseUrl: string; defaultModel: string }> = {
  gemini: {
    name: 'Google Gemini (Flash Lite)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash-lite',
  },
  openai: {
    name: 'OpenAI (ChatGPT / GPT-4o)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    name: 'Anthropic (Claude 3.5 Sonnet / Haiku)',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-20241022',
  },
  openrouter: {
    name: 'OpenRouter (Multi-Model Unified)',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
  },
  nvidia: {
    name: 'NVIDIA NIM (Microservices AI)',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.3-70b-instruct',
  },
  groq: {
    name: 'Groq (Ultra-Low Latency LPU)',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  custom: {
    name: 'Custom OpenAI-Compatible (Ollama / LocalLLM / vLLM)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
  },
};

const LOCAL_STORAGE_KEY_AI_CONFIG = 'hubc_crm_ai_provider_config_v1';

export function getSavedAIConfig(): AIProviderConfig {
  if (typeof window === 'undefined') {
    return {
      provider: 'gemini',
      apiKey: '',
      baseUrl: DEFAULT_AI_CONFIGS.gemini.defaultBaseUrl,
      model: DEFAULT_AI_CONFIGS.gemini.defaultModel,
      temperature: 0.3,
    };
  }

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_AI_CONFIG);
    if (saved) return JSON.parse(saved);
  } catch (e) {}

  return {
    provider: 'gemini',
    apiKey: '',
    baseUrl: DEFAULT_AI_CONFIGS.gemini.defaultBaseUrl,
    model: DEFAULT_AI_CONFIGS.gemini.defaultModel,
    temperature: 0.3,
  };
}

export function saveAIConfig(config: AIProviderConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_AI_CONFIG, JSON.stringify(config));
  } catch (e) {}
}

export async function executeUniversalAI(
  prompt: string,
  config: AIProviderConfig,
  contextData: any
): Promise<{ success: boolean; reply: string; raw?: any }> {
  // If no API key configured, use built-in autonomous intelligence parser
  if (!config.apiKey && config.provider !== 'custom') {
    return {
      success: true,
      reply: 'Motore di fallback autonomo: per abilitare il modello generativo cloud inserisci la tua API Key nelle Impostazioni.',
    };
  }

  try {
    const systemPrompt = `Sei l'Agente AI Commerciale Direzionale di Hub Commerciale per i brand NoLimits, Webissimo e Sapori.
Analizza l'istruzione dell'utente e la pipeline commerciale. Rispondi in italiano in modo estremamente professionale ed esecutivo.
Dati correnti della pipeline: ${JSON.stringify(contextData || {})}`;

    // 1. Google Gemini Provider
    if (config.provider === 'gemini') {
      const url = `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nComando commerciale: ${prompt}` }],
            },
          ],
          generationConfig: {
            temperature: config.temperature,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `Gemini API HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Nessuna risposta generata';
      return { success: true, reply };
    }

    // 2. Anthropic Claude Provider
    if (config.provider === 'anthropic') {
      const url = `${config.baseUrl}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'dangerously-allow-browser': 'true',
        },
        body: JSON.stringify({
          model: config.model,
          system: systemPrompt,
          max_tokens: 1024,
          temperature: config.temperature,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || `Anthropic API HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data.content?.[0]?.text || 'Nessuna risposta da Claude';
      return { success: true, reply };
    }

    // 3. OpenAI / OpenRouter / NVIDIA NIM / Groq / Custom OpenAI-Compatible
    const url = `${config.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    };

    if (config.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://omnihub.commerciale.it';
      headers['X-Title'] = 'Hub Commerciale AI';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: config.temperature,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || `${config.provider} API HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'Nessuna risposta dal modello';
    return { success: true, reply };
  } catch (err: any) {
    return {
      success: false,
      reply: `Errore chiamata ${config.provider}: ${err.message}`,
    };
  }
}
