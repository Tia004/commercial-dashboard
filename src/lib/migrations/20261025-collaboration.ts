import type { Transaction } from '@libsql/client';

// Additive migration. Recovery keeps legacy crm_data intact; new tables can be ignored by an older release.
export async function migrateCollaboration(tx: Transaction) {
  await tx.execute('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = await tx.execute({ sql: 'SELECT id FROM schema_migrations WHERE id = ?', args: ['20261025-collaboration-schema'] });
  if (applied.rows.length) return;
  const sessionColumns = (await tx.execute('PRAGMA table_info(sessions)')).rows.map((row) => String(row.name));
  if (!sessionColumns.includes('workspace_id')) await tx.execute('ALTER TABLE sessions ADD COLUMN workspace_id TEXT');
  const statements = [
    'CREATE TABLE IF NOT EXISTS workspace_memberships (user_id TEXT NOT NULL, workspace_id TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id,workspace_id))',
    'CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)',
    'CREATE INDEX IF NOT EXISTS contacts_workspace ON contacts(workspace_id)',
    'CREATE TABLE IF NOT EXISTS contact_activities (id TEXT PRIMARY KEY, contact_id TEXT NOT NULL, workspace_id TEXT NOT NULL, text TEXT NOT NULL, author_id TEXT NOT NULL, author_name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1)',
    'CREATE INDEX IF NOT EXISTS activities_contact ON contact_activities(workspace_id,contact_id,created_at)',
    'CREATE TABLE IF NOT EXISTS activity_revisions (id TEXT PRIMARY KEY, activity_id TEXT NOT NULL, workspace_id TEXT NOT NULL, text TEXT NOT NULL, edited_at TEXT NOT NULL, edited_by TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS presence_connections (number INTEGER PRIMARY KEY AUTOINCREMENT, connection_key TEXT UNIQUE NOT NULL, session_hash TEXT NOT NULL, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, device TEXT NOT NULL, view TEXT NOT NULL, target_id TEXT NOT NULL, focus TEXT NOT NULL, updated_at TEXT NOT NULL)',
    'CREATE INDEX IF NOT EXISTS presence_workspace ON presence_connections(workspace_id,updated_at)',
    'CREATE TABLE IF NOT EXISTS user_preferences (user_id TEXT PRIMARY KEY, experience TEXT NOT NULL DEFAULT \'standard\')',
    'CREATE TABLE IF NOT EXISTS ai_threads (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS ai_messages (id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL)',
    'CREATE INDEX IF NOT EXISTS ai_messages_thread ON ai_messages(thread_id,created_at)',
    'CREATE TABLE IF NOT EXISTS workspace_backfills (workspace_id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  ];
  for (const sql of statements) await tx.execute(sql);
  await tx.execute({ sql: 'INSERT INTO schema_migrations(id,applied_at) VALUES (?,?)', args: ['20261025-collaboration-schema', new Date().toISOString()] });
}

export async function backfillMemberships(tx: Transaction) {
  const applied = await tx.execute({ sql: 'SELECT id FROM schema_migrations WHERE id = ?', args: ['20261025-memberships-data'] });
  if (applied.rows.length) return;
  await tx.execute("INSERT OR IGNORE INTO workspace_memberships(user_id,workspace_id,role,created_at) SELECT id,workspace_id,CASE WHEN role IN ('owner','admin','member') THEN role ELSE 'owner' END,created_at FROM users WHERE workspace_id IS NOT NULL");
  await tx.execute('UPDATE sessions SET workspace_id=(SELECT workspace_id FROM users WHERE users.id=sessions.user_id) WHERE workspace_id IS NULL');
  await tx.execute({ sql: 'INSERT INTO schema_migrations(id,applied_at) VALUES (?,?)', args: ['20261025-memberships-data',new Date().toISOString()] });
}
