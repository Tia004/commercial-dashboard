import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin');
    const trusted = [req.nextUrl.origin, process.env.APP_ORIGIN, process.env.NEXT_PUBLIC_APP_URL].filter(Boolean).map((value) => { try { return new URL(String(value).trim().replace(/^["']|["']$/g, '')).origin; } catch { return ''; } });
    if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && !trusted.includes(origin))) return NextResponse.json({ error: 'Origine della richiesta non consentita.' }, { status: 403 });
    if (Number(req.headers.get('content-length') || 0) > 3500000) return NextResponse.json({ error: 'Richiesta troppo grande.' }, { status: 413 });
  }
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const config = { matcher: ['/api/:path*'] };
