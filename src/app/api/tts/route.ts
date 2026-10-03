import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = 'nova', apiKey } = body;

    const token = apiKey || process.env.OPENAI_API_KEY;
    if (!token) {
      return NextResponse.json(
        { error: 'Nessuna OpenAI API Key fornita per la generazione vocale HD' },
        { status: 400 }
      );
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Testo non specificato' }, { status: 400 });
    }

    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: voice || 'nova', // 'nova' is a warm, pleasant feminine human voice
        input: text.substring(0, 4096),
        speed: 1.0,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json(
        { error: err.error?.message || 'Errore nella sintesi vocale cloud' },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Errore interno sintesi vocale' },
      { status: 500 }
    );
  }
}
