import type { Transaction } from '@libsql/client';
import type { Contact } from '@/types/contacts';
import type { Opportunity } from '@/types/crm';
import { italianDateKey } from './date';
import { getServerDb } from './serverDb';
import { contactFromRow } from './contactRepository';

type PipelineSnapshot = { data: { opportunities: Opportunity[]; [key:string]:unknown }; changed: boolean };
const emptyPipeline = () => ({ opportunities: [], tasks: [], brands: [], salesReps: [] });
async function savePipeline(tx:Transaction,workspaceId:string,data:PipelineSnapshot['data']) {
  await tx.execute({ sql: 'INSERT INTO crm_data(user_id,payload,updated_at,revision) VALUES (?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at,revision=crm_data.revision+1', args: [workspaceId,JSON.stringify(data),new Date().toISOString()] });
}

// Contact writes and their pipeline link share the same transaction/revision.
export async function syncContactPipeline(tx: Transaction, workspaceId: string, contact: Contact, author: string, snapshot?: PipelineSnapshot): Promise<string[]> {
  const ids = contact.legacyDealIds || [];
  if (contact.type !== 'Notizia' && !ids.length) return ids;
  const saved = snapshot ? null : await tx.execute({ sql: 'SELECT payload,revision FROM crm_data WHERE user_id=?', args: [workspaceId] });
  const data = snapshot?.data || (saved?.rows.length ? JSON.parse(String(saved.rows[0].payload)) : emptyPipeline());
  const opportunities: Opportunity[] = data.opportunities || [];
  let linked = opportunities.filter(deal => deal.contactId === contact.id || ids.includes(deal.id));
  if (!linked.length && !ids.length && contact.type==='Notizia') linked=opportunities.filter(deal=>!deal.contactId && deal.company.trim().toLocaleLowerCase('it-IT')===contact.company.trim().toLocaleLowerCase('it-IT') && (!contact.brand || !deal.brand || deal.brand===contact.brand));
  if (!linked.length && (contact.type !== 'Notizia' || contact.archived || ids.length)) return ids;
  const now = new Date().toISOString();
  let changed = false;
  if (!linked.length) {
    const deal: Opportunity = {
      id: 'contact-' + contact.id, contactId: contact.id, company: contact.company,
      name: contact.person || contact.company, email: contact.email, phone: contact.phone, whatsapp: '',
      brand: contact.brand, service: 'Da definire', leadSource: 'Archivio contatti', salesRep: author,
      value: 0, valueType: 'One Shot', entryDate: italianDateKey(), stage: 'Nuovo lead', notes: '',
      history: [{ id: crypto.randomUUID(), date: italianDateKey(), timestamp: now, title: 'Notizia collegata alla pipeline', type: 'task', author }],
    };
    opportunities.unshift(deal); linked.push(deal); changed = true;
  }
  for (const deal of linked) {
    const profile = { contactId: contact.id, company: contact.company, name: contact.person || contact.company, email: contact.email, phone: contact.phone, brand: contact.brand };
    for (const key of Object.keys(profile) as (keyof typeof profile)[]) {
      if (deal[key] !== profile[key]) { deal[key] = profile[key]; changed = true; }
    }
  }
  if (changed) {
    data.opportunities = opportunities;
    if(snapshot) snapshot.changed=true; else await savePipeline(tx,workspaceId,data);
  }
  return linked.map(deal => deal.id);
}

// One-time backfill also links Notizie entered before this release, without duplicating existing opportunities.
export async function ensureContactPipeline(workspaceId: string, author: string) {
  const db = await getServerDb(); const marker = '20261103-contact-pipeline:' + workspaceId;
  if ((await db.execute({ sql: 'SELECT id FROM schema_migrations WHERE id=?', args: [marker] })).rows.length) return;
  const tx = await db.transaction('write');
  try {
    if (!(await tx.execute({ sql: 'SELECT id FROM schema_migrations WHERE id=?', args: [marker] })).rows.length) {
      const rows = await tx.execute({ sql: "SELECT * FROM contacts WHERE workspace_id=? AND (json_extract(data,'$.type')='Notizia' OR json_array_length(json_extract(data,'$.legacyDealIds'))>0)", args: [workspaceId] });
      const saved=await tx.execute({sql:'SELECT payload FROM crm_data WHERE user_id=?',args:[workspaceId]});
      const snapshot:PipelineSnapshot={data:saved.rows.length?JSON.parse(String(saved.rows[0].payload)):emptyPipeline(),changed:false};
      for (const row of rows.rows) {
        const contact = contactFromRow(row); const ids = await syncContactPipeline(tx, workspaceId, contact, author, snapshot);
        if (JSON.stringify(ids) !== JSON.stringify(contact.legacyDealIds || [])) {
          const data = JSON.parse(String(row.data)); data.legacyDealIds = ids;
          await tx.execute({ sql: 'UPDATE contacts SET data=?,revision=revision+1 WHERE id=? AND workspace_id=?', args: [JSON.stringify(data), contact.id, workspaceId] });
        }
      }
      if(snapshot.changed)await savePipeline(tx,workspaceId,snapshot.data);
      await tx.execute({ sql: 'INSERT INTO schema_migrations(id,applied_at) VALUES (?,?)', args: [marker, new Date().toISOString()] });
    }
    await tx.commit();
  } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
}
