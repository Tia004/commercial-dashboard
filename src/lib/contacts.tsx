'use client';
import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './auth';
import type { Contact, ContactInput } from '@/types/contacts';
type ContactResult = { contact?: Contact; error?: string; existingId?: string };
interface ContactsContextType {
  contacts: Contact[]; loading: boolean; error: string; selectedId: string | null;
  setSelectedId: (id: string | null) => void; refresh: () => Promise<void>;
  createContact: (data: ContactInput, id: string) => Promise<ContactResult>;
  updateContact: (id: string, patch: Record<string, unknown>) => Promise<ContactResult>;
}
const Context = createContext<ContactsContextType | null>(null);
export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshSession } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const archiveKey = user ? user.id + ':' + user.workspaceId : '';
  const currentKey = useRef(archiveKey); currentKey.current = archiveKey;
  const refresh = useCallback(async () => {
    if (!archiveKey) return;
    try {
      const response = await fetch('/api/contacts', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Caricamento non riuscito. Riprova.');
      const data = await response.json();
      if (currentKey.current !== archiveKey) return;
      if (data.workspaceId !== archiveKey.slice(archiveKey.indexOf(':')+1)) { void refreshSession(); return; }
      setContacts((current) => data.contacts.map((remote: Contact) => { const local = current.find((item) => item.id === remote.id); return local && local.revision > remote.revision ? local : remote; })); setError('');
    } catch (err) { if (currentKey.current === archiveKey) setError((err as Error).message); } finally { if (currentKey.current === archiveKey) setLoading(false); }
  }, [archiveKey, refreshSession]);
  useEffect(() => {
    setContacts([]); setSelectedId(null); setLoading(!!archiveKey); setError('');
    if (!archiveKey) return;
    void refresh();
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(poll); window.removeEventListener('focus', onFocus); };
  }, [archiveKey, refresh]);
  const write = async (url: string, method: string, body: object): Promise<ContactResult> => {
    try {
      const response = await fetch(url, { method, signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, workspaceId: user?.workspaceId }) });
      const result = await response.json();
      if (!response.ok) { if (result.code === 'workspace_changed') void refreshSession(); return result; }
      if (currentKey.current !== archiveKey) return { error: 'Workspace cambiato. Aggiorna la pagina.' };
      setContacts((current) => [result.contact, ...current.filter((contact) => contact.id !== result.contact.id)]);
      return result;
    } catch { return { error: 'Connessione non disponibile. Riprova: i dati del modulo sono conservati.' }; }
  };
  return <Context.Provider value={{ contacts, loading, error, selectedId, setSelectedId, refresh, createContact: (data, id) => write('/api/contacts', 'POST', { ...data, id }), updateContact: (id, patch) => write('/api/contacts/' + id, 'PATCH', patch) }}>{children}</Context.Provider>;
}
export function useContacts() { const context = useContext(Context); if (!context) throw new Error('ContactsProvider mancante'); return context; }
