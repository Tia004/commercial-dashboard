// Disable native ws binary bindings that break in Next.js bundler
process.env.WS_NO_BUFFER_UTIL = '1';
process.env.WS_NO_UTF_8_VALIDATE = '1';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/serverAuth';
import { getServerDb, checkRateLimit } from '@/lib/serverDb';
export const maxDuration = 60;
import { Communicate } from 'edge-tts-universal';

// Mapping of neural voices to Microsoft Edge HD Italian voices
const NEURAL_VOICE_MAP: Record<string, string> = {
  Fenrir: 'it-IT-GiuseppeNeural', // Maschile profondo, autorevole e carismatico
  Charon: 'it-IT-GiuseppeNeural', // Maschile caldo, deciso
  Puck: 'it-IT-DiegoNeural',      // Maschile energico, brillante, dinamico
  Kore: 'it-IT-ElsaNeural',       // Femminile limpida, esecutiva e professionale
  Aoede: 'it-IT-IsabellaNeural',  // Femminile calda, armoniosa ed empatica
  Giuseppe: 'it-IT-GiuseppeNeural',
  Diego: 'it-IT-DiegoNeural',
  Elsa: 'it-IT-ElsaNeural',
  Isabella: 'it-IT-IsabellaNeural',
};

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const db = await getServerDb();
    if (!await checkRateLimit(db,user.id,'tts',15,1)) return NextResponse.json({ error: 'Attendi un minuto prima di generare altro audio.' }, { status: 429 });
    const body = await req.json().catch(() => ({}));
    let textToSpeak = String(body.text || '').trim();
    if (textToSpeak.length > 8000) {
      textToSpeak = textToSpeak.slice(0, 8000);
    }
    const voice = String(body.voice || 'Aoede').trim();
    const rawRate = String(body.rate || '+0%').trim();
    const rawPitch = String(body.pitch || '+0Hz').trim();
    const rate = /^[+-]\d{1,3}%$/.test(rawRate) ? rawRate : '+0%';
    const pitch = /^[+-]\d{1,3}Hz$/.test(rawPitch) ? rawPitch : '+0Hz';

    // 1. If generateBriefing is requested or no text provided, generate an energetic sales briefing
    if (body.generateBriefing || !textToSpeak) {
      const ctx = body.crmContext || {};
      const pipelineTotal = Number(ctx.pipelineTotal || 0).toLocaleString('it-IT');
      const openDealsCount = Number(ctx.openDealsCount || 0);
      const todayTasksCount = Number(ctx.todayTasksCount || 0);
      const brandsList = Array.isArray(ctx.brands) && ctx.brands.length ? ctx.brands.join(', ') : 'i tuoi brand';
      const urgentDeals = Array.isArray(ctx.urgentDeals) && ctx.urgentDeals.length ? ctx.urgentDeals.join('; ') : '';

      if (!textToSpeak) {
        textToSpeak = `Forza team! Oggi abbiamo una pipeline attiva di ${pipelineTotal} euro con ${openDealsCount} trattative aperte e ${todayTasksCount} priorità da completare. Focus massimo sui clienti caldi e andiamo a chiudere!`;
      }
    }

    // 2. Synthesize High-Definition Neural Speech with Microsoft Edge Neural Voices
    const edgeVoice = NEURAL_VOICE_MAP[voice] || 'it-IT-IsabellaNeural';
    const comm = new Communicate(textToSpeak, {
      voice: edgeVoice,
      connectionTimeout: 8000,
      rate: rate.startsWith('+') || rate.startsWith('-') ? rate : '+0%',
      pitch: pitch.startsWith('+') || pitch.startsWith('-') ? pitch : '+0Hz',
    });

    const chunks: Buffer[] = [];
    for await (const chunk of comm.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        chunks.push(Buffer.from(chunk.data));
      }
    }

    if (!chunks.length) {
      throw new Error('Nessun flusso audio generato dalla sintesi neurale.');
    }

    const audioBuffer = Buffer.concat(chunks);
    const base64Briefing = Buffer.from(textToSpeak, 'utf-8').toString('base64');

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audioBuffer.length),
        'Cache-Control': 'no-store',
        'x-briefing-text': base64Briefing,
        'x-voice-name': voice,
      },
    });
  } catch (err: any) {
    console.error('TTS endpoint error:', err);
    return NextResponse.json(
      { error: 'Audio temporaneamente non disponibile. Usa la voce del dispositivo.' },
      { status: 500 }
    );
  }
}
