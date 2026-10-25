import { createHash } from 'crypto';
import { getServerDb } from './serverDb';
import { CONTACT_TYPES, CONTACT_STATUSES, type Contact, type ContactInput } from '@/types/contacts';

const legacyId = (key: string) => 'legacy-' + createHash('sha256').update(key).digest('hex').slice(0, 32);
export function contactFromRow(row: Record<string, unknown>): Contact {
  return { ...JSON.parse(String(row.data)), id: String(row.id), revision: Number(row.revision), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
export function validateContact(input: Record<string, unknown>, partial = false): Partial<ContactInput> {
  const output: Record<string, unknown> = {};
  for (const key of ['company', 'person', 'email', 'phone', 'address', 'city', 'postalCode', 'province', 'zone', 'brand']) {
    if (key in input || !partial) {
      const value = String(input[key] || '').trim();
      if (value.length > (key === 'address' ? 500 : 200)) throw new Error('Campo troppo lungo: ' + key);
      output[key] = value;
    }
  }
  if ((!partial || 'company' in input) && !output.company) throw new Error('Il nome azienda è obbligatorio.');
  if (output.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(output.email))) throw new Error('Email non valida.');
  if ('type' in input || !partial) {
    if (!CONTACT_TYPES.includes(input.type as never)) throw new Error('Tipologia non valida.');
    output.type = input.type;
  }
  if ('statuses' in input || !partial) {
    if (!Array.isArray(input.statuses) || input.statuses.some((status) => !CONTACT_STATUSES.includes(status as never))) throw new Error('Situazione operativa non valida.');
    output.statuses = Array.from(new Set(input.statuses));
  }
  if ('archived' in input || !partial) output.archived = input.archived === true;
  for (const key of ['latitude','longitude']) if (key in input) {
    const value = input[key];
    if (value === null || value === '') output[key] = null;
    else if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > (key === 'latitude' ? 90 : 180)) throw new Error('Coordinate non valide.');
    else output[key] = value;
  }
  return output;
}

// Separate, repeatable data backfill. The original opportunities and history remain untouched.
export async function ensureWorkspaceContacts(workspaceId: string) {
  const db = await getServerDb();
  const existingBackfill = await db.execute({ sql: 'SELECT workspace_id FROM workspace_backfills WHERE workspace_id = ?', args: [workspaceId] });
  if (existingBackfill.rows.length) return;
  const tx = await db.transaction('write');
  try {
    const done = await tx.execute({ sql: 'SELECT workspace_id FROM workspace_backfills WHERE workspace_id = ?', args: [workspaceId] });
    if (done.rows.length) { await tx.commit(); return; }
    const legacy = await tx.execute({ sql: 'SELECT payload FROM crm_data WHERE user_id = ?', args: [workspaceId] });
    const payload = legacy.rows.length ? JSON.parse(String(legacy.rows[0].payload)) : {};
    const grouped = new Map<string, any[]>();
    for (const deal of payload.opportunities || []) {
      const company = String(deal.company || deal.name || '').trim();
      if (!company) continue;
      const key = company.toLocaleLowerCase('it-IT').replace(/\s+/g, ' ');
      grouped.set(key, [...(grouped.get(key) || []), deal]);
    }
    const now = new Date().toISOString();
    for (const [key, deals] of grouped) {
      const id = legacyId(workspaceId + ':' + key);
      const first = deals[0];
      const type = deals.some((d) => d.stage === 'Venduta') ? 'Cliente effettivo' : deals.some((d) => !['Nuovo lead', 'Persa'].includes(d.stage)) ? 'Notizia' : 'Contatto';
      const data = { company: first.company || first.name, person: first.name || '', email: first.email || '', phone: first.phone || '', address: '', city: '', postalCode: '', province: '', zone: '', brand: first.brand || '', type, statuses: [], archived: false, legacyDealIds: deals.map((d) => d.id) };
      await tx.execute({ sql: 'INSERT OR IGNORE INTO contacts(id,workspace_id,data,created_at,updated_at) VALUES (?,?,?,?,?)', args: [id, workspaceId, JSON.stringify(data), now, now] });
      for (const deal of deals) {
        const events = [...(deal.history || [])];
        if (deal.notes?.trim()) events.push({ id: 'notes', title: deal.notes, timestamp: deal.entryDate ? deal.entryDate + 'T12:00:00Z' : now, author: deal.salesRep });
        for (const event of events) {
          const text = [event.title, event.description].filter(Boolean).join('\n\n').trim();
          if (!text) continue;
          const stamp = event.timestamp && !Number.isNaN(Date.parse(event.timestamp)) ? new Date(event.timestamp).toISOString() : now;
          await tx.execute({ sql: 'INSERT OR IGNORE INTO contact_activities(id,contact_id,workspace_id,text,author_id,author_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', args: [legacyId(workspaceId + ':' + deal.id + ':' + event.id), id, workspaceId, text, 'legacy', String(event.author || deal.salesRep || 'Archivio precedente'), stamp, stamp] });
        }
      }
    }
    await tx.execute({ sql: 'INSERT INTO workspace_backfills(workspace_id,applied_at) VALUES (?,?)', args: [workspaceId, now] });
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
}
