import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'crm-store.json');

function getDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error(e);
  }
  return { opportunities: [], tasks: [], brands: ['NoLimits', 'Webissimo', 'Sapori'] };
}

function saveDB(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(e);
  }
}

export async function GET() {
  // Returns server manifest and tools list
  return NextResponse.json({
    name: 'hub-commerciale-mcp-http',
    version: '1.0.0',
    status: 'online',
    tools: [
      'get_commercial_kpis',
      'list_opportunities',
      'create_opportunity',
      'update_opportunity_stage',
      'set_next_action',
      'get_today_activities',
      'snooze_opportunity',
      'complete_activity',
    ],
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, params } = body;
    const db = getDB();
    const today = new Date().toISOString().split('T')[0];

    switch (action) {
      case 'get_commercial_kpis': {
        const deals = db.opportunities || [];
        const sold = deals
          .filter((d: any) => d.stage === 'Venduta')
          .reduce((sum: number, d: any) => sum + (d.valueType === 'Mensile' ? d.value * 12 : d.value), 0);
        const openDeals = deals.filter((d: any) => d.stage !== 'Venduta' && d.stage !== 'Persa');
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
        const id = `NL-${Math.floor(1000 + Math.random() * 9000)}`;
        const newDeal = {
          id,
          name: params.name,
          company: params.company,
          brand: params.brand || 'NoLimits',
          service: params.service || 'Consulenza',
          value: params.value || 10000,
          valueType: params.valueType || 'One Shot',
          salesRep: params.salesRep || 'Francesco V.',
          leadSource: 'MCP HTTP Inbound',
          entryDate: today,
          stage: 'Nuovo lead',
          nextAction: {
            what: params.nextActionWhat || 'Primo contatto conoscitivo',
            who: params.salesRep || 'Francesco V.',
            when: params.nextActionWhen || today,
            type: 'chiamata',
            priority: 'Alta',
            completed: false,
          },
          history: [],
        };
        db.opportunities.unshift(newDeal);
        saveDB(db);
        return NextResponse.json({ success: true, deal: newDeal });
      }

      default:
        return NextResponse.json({ success: false, error: `Azione ${action} non supportata.` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
