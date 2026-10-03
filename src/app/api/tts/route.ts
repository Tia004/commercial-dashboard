import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Il TTS cloud è disattivato. Usa la sintesi vocale gratuita del browser.' }, { status: 410 });
}
