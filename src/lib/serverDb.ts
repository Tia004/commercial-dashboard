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
    await client.execute('CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL)');
    await client.execute('CREATE TABLE IF NOT EXISTS crm_data (user_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)');
    await client.execute('CREATE TABLE IF NOT EXISTS login_attempts (email TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_started_at TEXT NOT NULL)');
    return client;
  })().catch((error) => { initialized = null; throw error; });
  return initialized;
}
