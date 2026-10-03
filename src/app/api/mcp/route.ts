import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getServerDb } from '@/lib/serverDb';
import { italianDateKey } from '@/lib/date';

async function getDB() {
  const owner = process.env.MCP_OWNER_USER_ID;
  if (!owner) throw new Error('MCP_OWNER_USER_ID non configurato.');
  const db = await getServerDb();
  const result = await db.execute({ sql: 'SELECT payload FROM crm_data WHERE user_id = ?', args: [owner] });
  return result.rows.length ? JSON.parse(String(result.rows[0].payload)) : { opportunities: [], tasks: [], brands: ['NoLimits', 'Webissimo', 'Sapori'], salesReps: [] };
}

async function saveDB(data: any) {
  const db = await getServerDb();
  await db.execute({ sql: 'INSERT INTO crm_data(user_id,payload,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at', args: [process.env.MCP_OWNER_USER_ID!, JSON.stringify(data), new Date().toISOString()] });
}

export async function GET() {
  // Returns server manifest and tools list
  return NextResponse.json({
    name: 'hub-commerciale-mcp-http',
    version: '1.0.0',
    status: process.env.MCP_API_TOKEN && process.env.MCP_OWNER_USER_ID ? 'configured' : 'not_configured',
    tools: [
      'get_commercial_kpis',
      'list_opportunities',
      'create_opportunity',
    ],
  });
}

export async function POST(req: Request) {
  try {
    const configuredToken = process.env.MCP_API_TOKEN;
    if (!configuredToken || !process.env.MCP_OWNER_USER_ID) return NextResponse.json({ success: false, error: 'MCP HTTP non configurato.' }, { status: 503 });
    const suppliedToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const expected = Buffer.from(configuredToken);
    const actual = Buffer.from(suppliedToken);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return NextResponse.json({ success: false, error: 'Non autorizzato.' }, { status: 401 });
    const body = await req.json();
    const { action, params } = body;
    const db = await getDB();
    const today = italianDateKey();

    switch (action) {
      case 'get_commercial_kpis': {
        const deals = db.opportunities || [];
        const sold = deals
          .filter((d: any) => d.stage === 'Venduta')
          .reduce((sum: number, d: any) => sum + (d.valueType === 'Mensile' ? d.value * 12 : d.value), 0);
        const openDeals = deals.filter((d: any) => !['Venduta', 'Persa', 'Stand-by'].includes(d.stage));
        const pipeline = openDeals.reduce((sum: number, d: any) => sum + (d.valueType === 'Mensile' ? d.value * 12 : d.value), 0);

        return NextResponse.json({
          success: true,
          data: {
            venduto: sold,
            pipeline,
            trattativeAperte: openDeals.length,
            appuntamenti: (db.tasks || []).filter((t: any) => t.type === 'appuntamento').length,
          },
        });
      }

      case 'list_opportunities': {
        return NextResponse.json({
          success: true,
          data: db.opportunities || [],
        });
      }

      case 'create_opportunity': {
        if (!params || !String(params.name || '').trim() || !String(params.company || '').trim() || !String(params.salesRep || '').trim() || !String(params.nextActionWhat || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(params.nextActionWhen || '')) || !Number.isFinite(Number(params.value)) || Number(params.value) < 0) return NextResponse.json({ success: false, error: 'Nome, azienda, responsabile, valore e prossima azione sono obbligatori.' }, { status: 400 });
        const id = `${String(params.brand || 'NoLimits').slice(0, 2).toUpperCase()}-${crypto.randomUUID().slice(0, 8)}`;
        const newDeal = {
          id,
          name: String(params.name).trim(),
          company: String(params.company).trim(),
          brand: params.brand || 'NoLimits',
          service: params.service || 'Consulenza',
          value: Number(params.value),
          valueType: params.valueType || 'One Shot',
          salesRep: String(params.salesRep).trim(),
          leadSource: 'MCP HTTP Inbound',
          entryDate: today,
          stage: 'Nuovo lead',
          nextAction: {
            what: String(params.nextActionWhat).trim(),
            who: String(params.salesRep).trim(),
            when: params.nextActionWhen,
            type: 'chiamata',
            priority: 'Alta',
            completed: false,
          },
          history: [],
        };
        db.opportunities.unshift(newDeal);
        db.tasks ||= [];
        db.tasks.unshift({ id: `tsk-${crypto.randomUUID()}`, dealId: id, dealTitle: `${newDeal.company} - ${newDeal.name}`, title: newDeal.nextAction.what, client: newDeal.name, brand: newDeal.brand, assignedTo: newDeal.salesRep, type: 'chiamata', priority: 'Alta', date: newDeal.nextAction.when, time: '10:00', status: 'Da fare' });
        await saveDB(db);
        return NextResponse.json({ success: true, deal: newDeal });
      }

      default:
        return NextResponse.json({ success: false, error: `Azione ${action} non supportata.` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
