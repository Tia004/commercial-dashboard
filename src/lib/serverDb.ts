import { createClient, type Client } from '@libsql/client';

let client: Client | null = null;
let initialized: Promise<Client> | null = null;

export function getServerDb(): Promise<Client> {
  if (initialized) return initialized;
  initialized = (async () => {
    const url = process.env.TURSO_DATABASE_URL || (process.env.NODE_ENV === 'development' ? 'file:data/commercial.sqlite' : '');
    if (!url) throw new Error('Database non configurato: imposta TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.');
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    await client.execute('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, company TEXT, role TEXT, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)');
    const userColumns = (await client.execute('PRAGMA table_info(users)')).rows.map((row) => String(row.name));
    if (!userColumns.includes('workspace_id')) await client.execute('ALTER TABLE users ADD COLUMN workspace_id TEXT');
    if (!userColumns.includes('email_verified')) await client.execute('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1');
    await client.execute('CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL)');
    const legacyUsers = await client.execute('SELECT id, company, name FROM users WHERE workspace_id IS NULL');
    for (const user of legacyUsers.rows) {
      await client.execute({ sql: 'INSERT OR IGNORE INTO workspaces(id,name,created_at) VALUES (?,?,?)', args: [String(user.id), String(user.company || user.name || 'Workspace'), new Date().toISOString()] });
      await client.execute({ sql: 'UPDATE users SET workspace_id = ?, role = ? WHERE id = ?', args: [String(user.id), 'owner', String(user.id)] });
    }
    await client.execute('CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)');
    await client.execute('CREATE TABLE IF NOT EXISTS crm_data (user_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)');
    const crmColumns = (await client.execute('PRAGMA table_info(crm_data)')).rows.map((row) => String(row.name));
    if (!crmColumns.includes('revision')) await client.execute('ALTER TABLE crm_data ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
    await client.execute('CREATE TABLE IF NOT EXISTS login_attempts (email TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_started_at TEXT NOT NULL)');
    await client.execute('CREATE TABLE IF NOT EXISTS auth_tokens (token_hash TEXT PRIMARY KEY, purpose TEXT NOT NULL, email TEXT NOT NULL, user_id TEXT, workspace_id TEXT, role TEXT, expires_at TEXT NOT NULL, used_at TEXT)');
    await client.execute('CREATE TABLE IF NOT EXISTS passkeys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, public_key TEXT NOT NULL, counter INTEGER NOT NULL, transports TEXT NOT NULL, device_type TEXT NOT NULL, backed_up INTEGER NOT NULL, created_at TEXT NOT NULL)');
    await client.execute('CREATE TABLE IF NOT EXISTS webauthn_challenges (key TEXT PRIMARY KEY, challenge TEXT NOT NULL, expires_at TEXT NOT NULL)');
    return client;
  })().catch((error) => { initialized = null; throw error; });
  return initialized;
}
