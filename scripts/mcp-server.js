#!/usr/bin/env node

/**
 * Hub Commerciale - Official Model Context Protocol (MCP) Server
 * Compatible with Claude Desktop, Cowork, Codex, Cursor, ChatGPT, Goose, Windsurf
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { createClient } = require('@libsql/client');
const path = require('path');
const { randomUUID } = require('crypto');
const owner = process.env.MCP_OWNER_USER_ID;
if (!owner) { console.error('Configura MCP_OWNER_USER_ID con l’ID dell’account autorizzato.'); process.exit(1); }
const dbClient = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, '..', 'data', 'commercial.sqlite')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
async function loadDB() {
  await dbClient.execute('CREATE TABLE IF NOT EXISTS crm_data (user_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)');
  const columns = (await dbClient.execute('PRAGMA table_info(crm_data)')).rows.map((row) => String(row.name));
  if (!columns.includes('revision')) await dbClient.execute('ALTER TABLE crm_data ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
  const result = await dbClient.execute({ sql: 'SELECT payload,revision FROM crm_data WHERE user_id = ?', args: [owner] });
  const data = result.rows.length ? JSON.parse(String(result.rows[0].payload)) : { opportunities: [], tasks: [], brands: ['NoLimits', 'Webissimo', 'Sapori'], salesReps: [] };
  Object.defineProperty(data, '_revision', { value: result.rows.length ? Number(result.rows[0].revision) : 0 });
  return data;
}
async function saveDB(data) {
  const revision = data._revision;
  const payload = JSON.stringify(data);
  const updated = await dbClient.execute({ sql: 'UPDATE crm_data SET payload = ?, updated_at = ?, revision = revision + 1 WHERE user_id = ? AND revision = ?', args: [payload, new Date().toISOString(), owner, revision] });
  if (!updated.rowsAffected && revision === 0) {
    const inserted = await dbClient.execute({ sql: 'INSERT OR IGNORE INTO crm_data(user_id,payload,updated_at,revision) VALUES (?,?,?,1)', args: [owner, payload, new Date().toISOString()] });
    if (inserted.rowsAffected) return;
  }
  if (!updated.rowsAffected) throw new Error('Archivio modificato da un’altra sessione. Riprova la richiesta.');
}

const server = new Server(
  {
    name: 'hub-commerciale-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_commercial_kpis',
        description: 'Recupera i KPI principali della dashboard commerciale: Venduto, Pipeline attiva, Trattative aperte, Appuntamenti e Win-rate per i brand NoLimits, Webissimo e Sapori.',
        inputSchema: {
          type: 'object',
          properties: {
            brand: {
              type: 'string',
              description: 'Opzionale: filtrare per brand (NoLimits, Webissimo, Sapori o all)',
            },
          },
        },
      },
      {
        name: 'list_opportunities',
        description: 'Elenca tutte le opportunità commerciali aperte o chiuse con contatti, valore, brand, responsabile e prossima azione.',
        inputSchema: {
          type: 'object',
          properties: {
            brand: { type: 'string', description: 'Filtra per brand (NoLimits, Webissimo, Sapori)' },
            stage: { type: 'string', description: 'Filtra per fase (Nuovo lead, Conoscenza, Appuntamento, Trattativa, Chiusura, Venduta, Stand-by, Persa)' },
            salesRep: { type: 'string', description: 'Filtra per commerciale' },
          },
        },
      },
      {
        name: 'create_opportunity',
        description: 'Crea una nuova opportunità commerciale nel CRM. Applica la REGOLA FONDAMENTALE: richiede sempre una prossima azione.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nome e cognome referente' },
            company: { type: 'string', description: 'Nome azienda' },
            brand: { type: 'string', description: 'Brand (NoLimits, Webissimo, Sapori)' },
            service: { type: 'string', description: 'Servizio interessato' },
            value: { type: 'number', description: 'Valore economico potenziale (€)' },
            valueType: { type: 'string', enum: ['One Shot', 'Mensile', 'Annuale'], description: 'Tipo di valore' },
            salesRep: { type: 'string', description: 'Responsabile commerciale' },
            leadSource: { type: 'string', description: 'Fonte del lead' },
            phone: { type: 'string', description: 'Telefono' },
            whatsapp: { type: 'string', description: 'Numero WhatsApp' },
            email: { type: 'string', description: 'Email' },
            nextActionWhat: { type: 'string', description: 'Prossima azione commerciale obbligatoria (cosa fare)' },
            nextActionWhen: { type: 'string', description: 'Data della prossima azione (YYYY-MM-DD)' },
            nextActionType: { type: 'string', description: 'Tipo: chiamata, appuntamento, follow-up, preventivo, whatsapp' },
            notes: { type: 'string', description: 'Note descrittive' },
          },
          required: ['name', 'company', 'brand', 'service', 'value', 'nextActionWhat', 'nextActionWhen'],
        },
      },
      {
        name: 'update_opportunity_stage',
        description: 'Sposta un\'opportunità nella pipeline tra le varie fasi (Nuovo lead, Conoscenza, Appuntamento, Trattativa, Chiusura, Venduta, Stand-by, Persa).',
        inputSchema: {
          type: 'object',
          properties: {
            dealId: { type: 'string', description: 'ID dell\'opportunità (es. NL-8429)' },
            newStage: { type: 'string', description: 'Nuova fase' },
          },
          required: ['dealId', 'newStage'],
        },
      },
      {
        name: 'set_next_action',
        description: 'Imposta o aggiorna la prossima azione obbligatoria per una trattativa per evitare che venga dimenticata.',
        inputSchema: {
          type: 'object',
          properties: {
            dealId: { type: 'string', description: 'ID dell\'opportunità' },
            what: { type: 'string', description: 'Cosa bisogna fare' },
            who: { type: 'string', description: 'Chi deve farlo' },
            when: { type: 'string', description: 'Data (YYYY-MM-DD)' },
            time: { type: 'string', description: 'Ora (HH:mm)' },
            type: { type: 'string', description: 'Tipologia attività' },
            priority: { type: 'string', enum: ['Alta', 'Media', 'Bassa'] },
          },
          required: ['dealId', 'what', 'when'],
        },
      },
      {
        name: 'get_today_activities',
        description: 'Recupera tutte le attività commerciali da svolgere oggi: chiamate, appuntamenti, follow-up, preventivi e stand-by riattivati.',
        inputSchema: {
          type: 'object',
          properties: {
            salesRep: { type: 'string', description: 'Opzionale: filtra per responsabile' },
          },
        },
      },
      {
        name: 'snooze_opportunity',
        description: 'Mette una trattativa in Stand-by specificando motivo e data di riattivazione automatica.',
        inputSchema: {
          type: 'object',
          properties: {
            dealId: { type: 'string', description: 'ID opportunità' },
            reason: { type: 'string', description: 'Motivo dello stand-by' },
            reactivationDate: { type: 'string', description: 'Data riattivazione automatica (YYYY-MM-DD)' },
          },
          required: ['dealId', 'reason', 'reactivationDate'],
        },
      },
      {
        name: 'complete_activity',
        description: 'Segna un\'attività commerciale come completata e registra il log nella timeline della trattativa.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'ID dell\'attività' },
            nextActionWhat: { type: 'string', description: 'Nuova azione obbligatoria per trattative ancora aperte' },
            nextActionWhen: { type: 'string', description: 'Data della nuova azione (YYYY-MM-DD)' },
          },
          required: ['taskId'],
        },
      },
    ],
  };
});

// Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const db = await loadDB();
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  switch (name) {
    case 'get_commercial_kpis': {
      const deals = db.opportunities || [];
      const filtered = args?.brand && args.brand !== 'all'
        ? deals.filter((d) => d.brand.toLowerCase() === args.brand.toLowerCase())
        : deals;

      const sold = filtered
        .filter((d) => d.stage === 'Venduta')
        .reduce((sum, d) => sum + (d.valueType === 'Mensile' ? d.value * 12 : d.value), 0);

      const openDeals = filtered.filter((d) => !['Venduta', 'Persa', 'Stand-by'].includes(d.stage));
      const pipeline = openDeals.reduce((sum, d) => sum + (d.valueType === 'Mensile' ? d.value * 12 : d.value), 0);
      const meetings = (db.tasks || []).filter((t) => t.type === 'appuntamento' && t.status !== 'Completata').length;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                vendutoConcluso: `€ ${sold.toLocaleString()}`,
                pipelineAttiva: `€ ${pipeline.toLocaleString()}`,
                trattativeAperte: openDeals.length,
                appuntamentiProgrammati: meetings,
                winRate: (() => { const closed = filtered.filter((d) => ['Venduta', 'Persa'].includes(d.stage)); return closed.length ? Math.round(closed.filter((d) => d.stage === 'Venduta').length / closed.length * 100) + '%' : '—'; })(),
                brandMonitorati: db.brands,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case 'list_opportunities': {
      let deals = db.opportunities || [];
      if (args?.brand) deals = deals.filter((d) => d.brand.toLowerCase() === args.brand.toLowerCase());
      if (args?.stage) deals = deals.filter((d) => d.stage.toLowerCase() === args.stage.toLowerCase());
      if (args?.salesRep) deals = deals.filter((d) => d.salesRep.toLowerCase().includes(args.salesRep.toLowerCase()));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(deals, null, 2),
          },
        ],
      };
    }

    case 'create_opportunity': {
      if (!args?.name?.trim() || !args?.company?.trim() || !args?.nextActionWhat?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(args.nextActionWhen || '')) || !Number.isFinite(args.value) || args.value < 0) return { isError: true, content: [{ type: 'text', text: 'Dati cliente, valore e prossima azione validi sono obbligatori.' }] };
      const brandPrefix = (args.brand || 'NL').substring(0, 2).toUpperCase();
      const id = `${brandPrefix}-${randomUUID().slice(0, 8).toUpperCase()}`;

      const newDeal = {
        id,
        name: args.name,
        company: args.company,
        brand: args.brand,
        service: args.service,
        value: args.value,
        valueType: args.valueType || 'One Shot',
        leadSource: args.leadSource || 'AI Inbound MCP',
        salesRep: args.salesRep || 'Commerciale Responsabile',
        phone: args.phone || '',
        whatsapp: args.whatsapp || args.phone || '',
        email: args.email || '',
        entryDate: today,
        stage: 'Nuovo lead',
        notes: args.notes || 'Creata tramite MCP Server',
        nextAction: {
          what: args.nextActionWhat,
          who: args.salesRep || 'Commerciale Responsabile',
          when: args.nextActionWhen,
          time: '11:00',
          type: args.nextActionType || 'chiamata',
          priority: 'Alta',
          completed: false,
        },
        history: [
          {
            id: `h-${Date.now()}`,
            date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
            title: 'Creazione Opportunità tramite MCP Server',
            type: 'task',
            author: 'MCP AI Client',
          },
        ],
      };

      db.opportunities.unshift(newDeal);

      // Auto-schedule task
      const newTask = {
        id: `tsk-${randomUUID()}`,
        dealId: newDeal.id,
        title: args.nextActionWhat,
        client: newDeal.name,
        brand: newDeal.brand,
        assignedTo: newDeal.salesRep,
        type: args.nextActionType || 'chiamata',
        priority: 'Alta',
        date: args.nextActionWhen,
        time: '11:00',
        status: 'Da fare',
      };
      db.tasks.unshift(newTask);

      await saveDB(db);

      return {
        content: [
          {
            type: 'text',
            text: `Opportunità creata con successo! ID: ${newDeal.id} - ${newDeal.name} (${newDeal.company}), Valore: €${newDeal.value}, Prossima azione pianificata per il ${args.nextActionWhen}.`,
          },
        ],
      };
    }

    case 'update_opportunity_stage': {
      const deal = (db.opportunities || []).find((d) => d.id === args.dealId);
      if (!deal) {
        return { isError: true, content: [{ type: 'text', text: `Trattativa ${args.dealId} non trovata.` }] };
      }

      if (!['Nuovo lead', 'Conoscenza', 'Appuntamento', 'Trattativa', 'Chiusura', 'Venduta', 'Persa'].includes(args.newStage)) return { isError: true, content: [{ type: 'text', text: 'Fase non valida. Per lo stand-by usa snooze_opportunity con motivo e data.' }] };
      if (!['Venduta', 'Persa'].includes(args.newStage) && (!deal.nextAction?.what || deal.nextAction.completed)) return { isError: true, content: [{ type: 'text', text: 'Imposta prima una prossima azione valida.' }] };
      deal.stage = args.newStage;
      deal.history.unshift({
        id: `h-${Date.now()}`,
        date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        title: `Fase avanzata a ${args.newStage} (via MCP)`,
        type: 'task',
        author: 'MCP AI Client',
      });

      await saveDB(db);
      return {
        content: [
          {
            type: 'text',
            text: `Trattativa ${deal.id} (${deal.company}) aggiornata alla fase "${args.newStage}".`,
          },
        ],
      };
    }

    case 'set_next_action': {
      const deal = (db.opportunities || []).find((d) => d.id === args.dealId);
      if (!deal) {
        return { isError: true, content: [{ type: 'text', text: `Trattativa ${args.dealId} non trovata.` }] };
      }
      if (!String(args.what || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(args.when || ''))) return { isError: true, content: [{ type: 'text', text: 'Descrizione e data della prossima azione sono obbligatorie.' }] };

      deal.nextAction = {
        what: args.what,
        who: args.who || deal.salesRep,
        when: args.when,
        time: args.time || '10:00',
        type: args.type || 'chiamata',
        priority: args.priority || 'Alta',
        completed: false,
      };

      deal.history.unshift({
        id: `h-${Date.now()}`,
        date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        title: `Nuovo prossimo step: ${args.what}`,
        type: args.type || 'task',
        author: 'MCP AI Client',
      });

      db.tasks = db.tasks || [];
      db.tasks.unshift({ id: `tsk-${randomUUID()}`, dealId: deal.id, title: args.what, client: deal.name, brand: deal.brand, assignedTo: args.who || deal.salesRep, type: args.type || 'chiamata', priority: args.priority || 'Alta', date: args.when, time: args.time || '10:00', status: 'Da fare' });

      await saveDB(db);
      return {
        content: [
          {
            type: 'text',
            text: `Prossima azione impostata per ${deal.name}: "${args.what}" prevista per il ${args.when}.`,
          },
        ],
      };
    }

    case 'get_today_activities': {
      const allTasks = db.tasks || [];
      const todayTasks = allTasks.filter((t) => t.date === today && t.status !== 'Completata');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(todayTasks, null, 2),
          },
        ],
      };
    }

    case 'snooze_opportunity': {
      const deal = (db.opportunities || []).find((d) => d.id === args.dealId);
      if (!deal) {
        return { isError: true, content: [{ type: 'text', text: `Trattativa ${args.dealId} non trovata.` }] };
      }

      if (!String(args.reason || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(args.reactivationDate || ''))) return { isError: true, content: [{ type: 'text', text: 'Motivo e data di riattivazione validi sono obbligatori.' }] };
      deal.stage = 'Stand-by';
      deal.nextAction = { what: `Riattivare trattativa: ${args.reason}`, who: deal.salesRep, when: args.reactivationDate, time: '09:30', type: 'standby-wake', priority: 'Alta', completed: false };
      deal.standbyReason = args.reason;
      deal.standbyReactivationDate = args.reactivationDate;
      deal.history.unshift({
        id: `h-${Date.now()}`,
        date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        title: `Trattativa messa in Stand-by fino al ${args.reactivationDate}`,
        description: args.reason,
        type: 'task',
        author: 'MCP AI Client',
      });

      db.tasks = db.tasks || [];
      db.tasks.unshift({ id: `tsk-${randomUUID()}`, dealId: deal.id, title: deal.nextAction.what, client: deal.name, brand: deal.brand, assignedTo: deal.salesRep, type: 'standby-wake', priority: 'Alta', date: args.reactivationDate, time: '09:30', status: 'Da fare' });

      await saveDB(db);
      return {
        content: [
          {
            type: 'text',
            text: `Trattativa ${deal.id} messa in Stand-by fino al ${args.reactivationDate}. Motivo: ${args.reason}.`,
          },
        ],
      };
    }

    case 'complete_activity': {
      const task = (db.tasks || []).find((t) => t.id === args.taskId);
      if (!task) {
        return { isError: true, content: [{ type: 'text', text: `Task ${args.taskId} non trovato.` }] };
      }

      const linkedDeal = (db.opportunities || []).find((d) => d.id === task.dealId);
      if (linkedDeal && !['Venduta', 'Persa'].includes(linkedDeal.stage)) {
        if (!String(args.nextActionWhat || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(args.nextActionWhen || ''))) return { isError: true, content: [{ type: 'text', text: 'La trattativa richiede una nuova azione con data prima di completare l’attività.' }] };
        linkedDeal.nextAction = { what: args.nextActionWhat, who: linkedDeal.salesRep, when: args.nextActionWhen, type: 'follow-up', priority: 'Alta', completed: false };
        db.tasks.unshift({ id: `tsk-${Date.now()}`, dealId: linkedDeal.id, title: args.nextActionWhat, client: linkedDeal.name, brand: linkedDeal.brand, assignedTo: linkedDeal.salesRep, type: 'follow-up', priority: 'Alta', date: args.nextActionWhen, time: '10:00', status: 'Da fare' });
      }
      task.status = 'Completata';
      await saveDB(db);
      return {
        content: [
          {
            type: 'text',
            text: `Attività "${task.title}" completata con successo.`,
          },
        ],
      };
    }

    default:
      return {
        isError: true,
        content: [{ type: 'text', text: `Strumento MCP sconosciuto: ${name}` }],
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Hub Commerciale MCP Server in ascolto su STDIO');
}

main().catch((err) => {
  console.error('Errore avvio MCP Server:', err);
  process.exit(1);
});
