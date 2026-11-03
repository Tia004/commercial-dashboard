import type { Transaction } from '@libsql/client';

// Additive and idempotent. Rollback keeps this table so uploaded documents are retained.
export async function migrateContactFiles(tx: Transaction) {
  const id = '20261103-contact-files';
  if ((await tx.execute({ sql: 'SELECT id FROM schema_migrations WHERE id=?', args: [id] })).rows.length) return;
  await tx.execute('CREATE TABLE IF NOT EXISTS contact_files (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,contact_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,content BLOB NOT NULL,author_id TEXT NOT NULL,author_name TEXT NOT NULL,created_at TEXT NOT NULL)');
  await tx.execute('CREATE INDEX IF NOT EXISTS contact_files_contact ON contact_files(workspace_id,contact_id,created_at)');
  await tx.execute({ sql: 'INSERT INTO schema_migrations(id,applied_at) VALUES (?,?)', args: [id,new Date().toISOString()] });
}
