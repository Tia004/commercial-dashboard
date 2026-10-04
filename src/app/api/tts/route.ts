import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';

function getGeminiApiKey(): string {
  const envKey = (process.env.GEMINI_API_KEY || '').trim();
  if (envKey) return envKey;
  // Local fallback from Jarvis configuration
  try {
    const jarvisPath = '/Users/tia/Jarvis/config/api_keys.json';
    if (fs.existsSync(jarvisPath)) {
      const data = JSON.parse(fs.readFileSync(jarvisPath, 'utf8'));
      if (data?.gemini_api_key) return String(data.gemini_api_key).trim();
    }
  } catch {}
  return '';
}

function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const dataLength = pcmBuffer.length;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY non configurata per la voce neurale Jarvis.', fallback: true }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    let textToSpeak = String(body.text || '').trim();
    const voice = String(body.voice || 'Charon').trim();

    // 1. If generateBriefing is requested, synthesize an energetic, motivational sales briefing via Gemini Flash
    if (body.generateBriefing || !textToSpeak) {
      const ctx = body.crmContext || {};
      const pipelineTotal = Number(ctx.pipelineTotal || 0).toLocaleString('it-IT');
      const openDealsCount = Number(ctx.openDealsCount || 0);
      const todayTasksCount = Number(ctx.todayTasksCount || 0);
      const brandsList = Array.isArray(ctx.brands) && ctx.brands.length ? ctx.brands.join(', ') : 'i tuoi brand';
      const urgentDeals = Array.isArray(ctx.urgentDeals) && ctx.urgentDeals.length ? ctx.urgentDeals.join('; ') : '';

      const prompt = `Sei il copilota commerciale intelligente di Hub Commerciale, un assistente esecutivo energico e brillante in stile Jarvis.
Genera un riepilogo audio esecutivo brevissimo, carico di energia e motivazione per la giornata di vendite.

Dati reali del workspace di oggi:
- Valore pipeline attiva: €${pipelineTotal}
- Trattative aperte in gestione: ${openDealsCount}
- Attività prioritarie oggi: ${todayTasksCount}
${urgentDeals ? `- Trattative calde: ${urgentDeals}` : ''}
- Brand attivi: ${brandsList}

Regole ferree:
1. Lunghezza: MASSIMO 45-55 parole (circa 20 secondi a voce).
2. Struttura:
   - Apertura fulminea con grinta e motivazione commerciale positiva.
   - Sintesi chiara dei numeri e dell'azione n.1 da chiudere oggi.
   - Chiusura carismatica ("Andiamo a chiudere!" o simile).
3. Stile: Naturale, colloquiale, da ascoltare a voce alta. Nessun asterisco, nessun elenco puntato, niente emoji, scrivi i numeri in parole o cifre semplici. Solo in lingua italiana.`;

      try {
        const textModelUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const textRes = await fetch(textModelUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 150 }
          })
        });

        if (textRes.ok) {
          const textData = await textRes.json();
          const candidateText = textData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            textToSpeak = candidateText.replace(/[*_#]/g, '').replace(/\s+/g, ' ').trim();
          }
        }
      } catch (err) {
        console.warn('Briefing text generation error:', err);
      }

      if (!textToSpeak) {
        textToSpeak = `Forza team! Oggi abbiamo una pipeline attiva di ${pipelineTotal} euro con ${openDealsCount} trattative e ${todayTasksCount} priorità da completare. Focus massimo sui clienti caldi e andiamo a chiudere!`;
      }
    }

    // 2. Synthesize with Gemini Neural Voice TTS (Charon, Puck, Kore, Fenrir, Aoede)
    const validVoices = ['Charon', 'Puck', 'Kore', 'Fenrir', 'Aoede'];
    const chosenVoice = validVoices.includes(voice) ? voice : 'Charon';

    const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
    const ttsRes = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: textToSpeak }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: chosenVoice
              }
            }
          }
        }
      })
    });

    if (!ttsRes.ok) {
      const errData = await ttsRes.json().catch(() => ({}));
      console.warn('Gemini TTS error:', errData);
      return NextResponse.json({
        error: 'Sintesi neurale non riuscita, passaggio alla voce di sistema.',
        fallback: true,
        text: textToSpeak
      }, { status: 200 });
    }

    const ttsData = await ttsRes.json();
    const candidate = ttsData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (!candidate?.inlineData?.data) {
      return NextResponse.json({
        error: 'Dati audio mancanti nella risposta.',
        fallback: true,
        text: textToSpeak
      }, { status: 200 });
    }

    const pcmBuffer = Buffer.from(candidate.inlineData.data, 'base64');
    const wavBuffer = pcmToWav(pcmBuffer, 24000);
    const base64Briefing = Buffer.from(textToSpeak, 'utf-8').toString('base64');

    return new NextResponse(new Uint8Array(wavBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(wavBuffer.length),
        'Cache-Control': 'no-store',
        'x-briefing-text': base64Briefing,
        'x-voice-name': chosenVoice
      }
    });
  } catch (err: any) {
    console.error('TTS endpoint error:', err);
    return NextResponse.json({ error: err?.message || 'Errore del server audio', fallback: true }, { status: 500 });
  }
}
