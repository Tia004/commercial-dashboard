'use client';
import dynamic from 'next/dynamic';
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useCRM } from '@/lib/store';
import { useContacts } from '@/lib/contacts';
import { CONTACT_TYPES, CONTACT_STATUSES, type Contact, type ContactInput, type ContactActivity } from '@/types/contacts';

const ContactsMap = dynamic(() => import('./ContactsMap'), { ssr: false, loading: () => <div className="contact-empty">Caricamento mappa…</div> });
const emptyContact = (): ContactInput => ({ company: '', person: '', email: '', phone: '', address: '', city: '', postalCode: '', province: '', zone: '', brand: '', type: 'Contatto', statuses: [], archived: false });
const fields: { key: keyof ContactInput; label: string; type?: string }[] = [
  { key: 'company', label: 'Azienda' }, { key: 'person', label: 'Referente' }, { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Telefono', type: 'tel' }, { key: 'address', label: 'Indirizzo' }, { key: 'city', label: 'Città' },
  { key: 'postalCode', label: 'CAP' }, { key: 'province', label: 'Provincia' }, { key: 'zone', label: 'Zona commerciale' }, { key: 'brand', label: 'Brand' },
];
const dateTime = (date: string) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
export function ContactWorkspace({ overview = false }: { overview?: boolean }) {
  const { contacts, loading, error, refresh, selectedId, setSelectedId, createContact } = useContacts();
  const { selectedBrand } = useCRM();
  const brandContacts = contacts.filter((contact) => selectedBrand === 'all' || contact.brand.toLowerCase() === selectedBrand.toLowerCase());
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [zone, setZone] = useState('');
  const [mapView,setMapView]=useState(false);
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ContactInput>(emptyContact());
  const [creationId, setCreationId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (selectedId === '__new__') { setForm({ ...emptyContact(), brand: selectedBrand === 'all' ? '' : selectedBrand }); setCreationId(crypto.randomUUID());setCreating(true);setFeedback('');setSelectedId(null); } }, [selectedId, setSelectedId, selectedBrand]);
  const active = brandContacts.filter((contact) => !contact.archived);
  const filtered = brandContacts.filter((contact) => contact.archived === archived && (!type || contact.type === type) && (!status || contact.statuses.includes(status as never)) && (!city || contact.city === city) && (!province || contact.province === province) && (!zone || contact.zone === zone) && [contact.company, contact.person, contact.city, contact.email, contact.phone].some((value) => value.toLowerCase().includes(query.toLowerCase())));
  const options = (key: 'city' | 'province' | 'zone') => Array.from(new Set(active.map((contact) => contact[key]).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'it'));
  const exportCsv = () => {
    const rows = [['Azienda','Referente','Tipologia','Situazione','Email','Telefono','Indirizzo','Città','CAP','Provincia','Zona'], ...filtered.map((contact) => [contact.company,contact.person,contact.type,contact.statuses.join(', '),contact.email,contact.phone,contact.address,contact.city,contact.postalCode,contact.province,contact.zone])];
    const text = '\ufeff' + rows.map((row) => row.map((value) => '"' + (/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'contatti.csv'; link.click(); URL.revokeObjectURL(url);
  };
  return <div className="contacts-page">
    <div className="contacts-heading"><div><span className="section-eyebrow">WORKSPACE / {overview ? 'PANORAMICA' : 'CONTATTI'}</span><h1>{overview ? 'Le relazioni, prima di tutto.' : 'Contatti'}</h1><p>{overview ? 'Una vista chiara su aziende, persone e prossime conversazioni.' : 'Tutte le aziende, dal primo contatto alla collaborazione.'}</p></div><button className="primary-button" onClick={() => { setForm({ ...emptyContact(), brand: selectedBrand === 'all' ? '' : selectedBrand }); setCreationId(crypto.randomUUID()); setCreating(true); setFeedback(''); }}><span className="material-symbols-outlined">add</span> Nuovo contatto</button></div>
    {overview && <div className="contact-metrics">{[
      ...CONTACT_TYPES.map((value) => ({ label: value === 'Contatto' ? 'Contatti da lavorare' : value === 'Notizia' ? 'Notizie da sviluppare' : 'Clienti effettivi', count: active.filter((contact) => contact.type === value).length, action: () => { setType(value); setStatus('');setArchived(false);setQuery('');setCity('');setProvince('');setZone(''); } })),
      ...CONTACT_STATUSES.map((value) => ({ label: value === 'Gestisci' ? 'Clienti da gestire' : value, count: active.filter((contact) => contact.statuses.includes(value)).length, action: () => { setStatus(value); setType('');setArchived(false);setQuery('');setCity('');setProvince('');setZone(''); } })),
    ].map((metric) => <button key={metric.label} onClick={metric.action}><span>{metric.label}</span><strong>{metric.count}</strong><span className="material-symbols-outlined">north_east</span></button>)}</div>}
    <div className="contacts-toolbar"><div className="contact-type-tabs" aria-label="Tipologie contatto"><button className={!type ? 'active' : ''} onClick={() => setType('')}>Tutti <small>{brandContacts.filter((contact) => contact.archived === archived).length}</small></button>{CONTACT_TYPES.map((value) => <button key={value} className={type === value ? 'active' : ''} onClick={() => setType(type === value ? '' : value)}>{value}</button>)}</div><div className="contacts-tools"><button className="quiet-button" onClick={() => setMapView(!mapView)}><span className="material-symbols-outlined">map</span>{mapView ? 'Nascondi mappa' : 'Mappa'}</button><button onClick={exportCsv} className="quiet-button"><span className="material-symbols-outlined">download</span> Esporta</button><button className={'quiet-button ' + (archived ? 'active' : '')} onClick={() => setArchived(!archived)}>{archived ? 'Torna agli attivi' : 'Archiviati'}</button></div></div>
    <div className="contacts-filters"><label className="contact-search"><span className="material-symbols-outlined">search</span><input aria-label="Cerca contatti" placeholder="Cerca azienda, persona, email…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Situazione operativa" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tutte le situazioni</option>{CONTACT_STATUSES.map((value) => <option key={value}>{value}</option>)}</select>{([['city','Città',city,setCity],['province','Provincia',province,setProvince],['zone','Zona',zone,setZone]] as const).map(([key,label,value,setter]) => <select key={key} aria-label={label} value={value} onChange={(event) => setter(event.target.value)}><option value="">{label}</option>{options(key).map((item) => <option key={item}>{item}</option>)}</select>)}{(type || status || city || province || zone || query) && <button className="quiet-button" onClick={() => { setType('');setStatus('');setCity('');setProvince('');setZone('');setQuery(''); }}>Azzera filtri</button>}</div>
    {error && <div className="inline-error" role="alert">{error}<button onClick={() => void refresh()}>Riprova</button></div>}
    {mapView && <div className="contacts-map-panel"><ContactsMap contacts={filtered} onSelect={setSelectedId} /><p>{filtered.filter((contact)=>Number.isFinite(contact.latitude)).length} aziende posizionate su {filtered.length}. Puoi segnare il punto dalla scheda di ogni azienda.</p></div>}
    {loading ? <div className="contact-empty" role="status">Caricamento contatti…</div> : filtered.length ? <div className="contacts-table-wrap"><table className="contacts-table"><thead><tr><th>Azienda / referente</th><th>Tipologia</th><th>Situazione</th><th>Località</th><th>Contatti</th><th><span className="sr-only">Apri</span></th></tr></thead><tbody>{filtered.map((contact) => <tr key={contact.id}><td><button className="contact-company-link" onClick={() => setSelectedId(contact.id)}><strong>{contact.company}</strong><small>{contact.person || 'Referente da indicare'}</small></button></td><td><span className={'contact-type type-' + CONTACT_TYPES.indexOf(contact.type)}>{contact.type}</span></td><td><div className="contact-status-list">{contact.statuses.length ? contact.statuses.map((item) => <span key={item}>{item}</span>) : <small>—</small>}</div></td><td><span>{contact.city || '—'}</span><small>{[contact.province, contact.zone].filter(Boolean).join(' · ')}</small></td><td><span>{contact.phone || '—'}</span><small>{contact.email}</small></td><td><button className="row-open" aria-label={'Apri ' + contact.company} onClick={() => setSelectedId(contact.id)}><span className="material-symbols-outlined">arrow_forward</span></button></td></tr>)}</tbody></table><div className="contacts-count">{filtered.length} aziende</div></div> : <div className="contact-empty"><span className="material-symbols-outlined">contacts</span><h2>{contacts.length ? 'Nessun risultato' : 'Il tuo archivio comincia qui'}</h2><p>{contacts.length ? 'Prova a modificare i filtri.' : 'Aggiungi un’azienda e annota liberamente le conversazioni.'}</p></div>}
    {creating && <div className="contact-overlay"><section className="contact-create" role="dialog" aria-modal="true" aria-labelledby="create-contact-title"><div className="contact-dialog-head"><div><span className="section-eyebrow">ANAGRAFICA</span><h2 id="create-contact-title">Nuovo contatto</h2></div><button aria-label="Chiudi nuovo contatto" onClick={() => setCreating(false)}><span className="material-symbols-outlined">close</span></button></div><form onSubmit={async (event) => { event.preventDefault(); setBusy(true); const result = await createContact(form, creationId); setBusy(false); if (result.error) { setFeedback(result.error); if (result.existingId) { setCreating(false); setSelectedId(result.existingId); } } else if (result.contact) { setCreating(false); setSelectedId(result.contact.id); } }}><div className="contact-form-grid">{fields.map((field) => <label key={field.key}>{field.label}{field.key === 'company' ? ' *' : ''}<input type={field.type || 'text'} required={field.key === 'company'} maxLength={field.key === 'address' ? 500 : 200} value={String(form[field.key] || '')} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} /></label>)}<label>Tipologia<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Contact['type'] })}>{CONTACT_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label></div>{feedback && <p className="inline-error" role="alert">{feedback}</p>}<div className="contact-form-footer"><small>Solo il nome azienda è obbligatorio.</small><button className="primary-button" disabled={busy}>{busy ? 'Salvataggio…' : 'Crea contatto'}</button></div></form></section></div>}
  </div>;
}

export function ContactDetail() {
  const {user,refreshSession}=useAuth();
  const { selectedId, setSelectedId, contacts, updateContact, refresh } = useContacts();
  const contact = contacts.find((item) => item.id === selectedId);
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [draft, setDraft] = useState('');
  const [draftId, setDraftId] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({});
  const [editRevision, setEditRevision] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activityEdit, setActivityEdit] = useState<ContactActivity | null>(null);
  const [editText, setEditText] = useState('');
  const [placing,setPlacing]=useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const activeContact = useRef(selectedId); activeContact.current = selectedId;
  const loadActivities = async (id: string) => {
    try { const response = await fetch('/api/contacts/' + id + '/activities', { cache: 'no-store', signal: AbortSignal.timeout(15000) }); if (!response.ok) throw Error('Storico non disponibile.'); const data = await response.json(); if (activeContact.current === id) setActivities((current) => data.activities.map((remote: ContactActivity) => { const local = current.find((item) => item.id === remote.id); return local && local.revision > remote.revision ? local : remote; })); }
    catch { if (activeContact.current === id) setError('Impossibile aggiornare lo storico. Riprova.'); } finally { if (activeContact.current === id) setLoadingActivities(false); }
  };
  useEffect(() => {
    setActivities([]); setDraft(''); setDraftId(crypto.randomUUID()); setEditing(false); setPlacing(false); setActivityEdit(null); setError('');
    if (!selectedId) return;
    setLoadingActivities(true); void loadActivities(selectedId);
    const poll = window.setInterval(() => { if (document.visibilityState === 'visible') void loadActivities(selectedId); }, 5000);
    return () => window.clearInterval(poll);
  }, [selectedId]);
  useEffect(() => {
    if (!draft.trim() && !activityEdit && !editing) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect);
  }, [draft, activityEdit, editing]);
  if (!contact) return null;
  const close = () => { if ((draft.trim() || activityEdit || editing) && !window.confirm('Ci sono modifiche non salvate. Vuoi chiudere la scheda?')) return; setSelectedId(null); };
  const apply = async (patch: Record<string, unknown>) => { setError(''); const result = await updateContact(contact.id, patch); if (result.error) setError(result.error); return result; };
  const writeActivity = async (method: string, body: object) => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/contacts/' + contact.id + '/activities', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...body,workspaceId:user?.workspaceId}) });
      const result = await response.json(); if (result.code === 'workspace_changed') void refreshSession(); if (!response.ok) throw Error(result.error || 'Attività non salvata.');
      if (activeContact.current !== contact.id) return;
      setActivities((current) => [result.activity, ...current.filter((item) => item.id !== result.activity.id)].sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
      if (method === 'POST') { setDraft(''); setDraftId(crypto.randomUUID()); } else setActivityEdit(null);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const address = [contact.address,contact.postalCode,contact.city,contact.province].filter(Boolean).join(', ');
  return <div className="contact-overlay"><section className="contact-detail" role="dialog" aria-modal="true" aria-labelledby="contact-title">
    <div className="contact-dialog-head"><div><span className="section-eyebrow">SCHEDA AZIENDA</span><h2 id="contact-title">{contact.company}</h2><p>{contact.person || 'Referente da indicare'}</p></div><button aria-label="Chiudi scheda contatto" onClick={close}><span className="material-symbols-outlined">close</span></button></div>
    <div className="contact-detail-body"><aside className="contact-profile">
      <label className="contact-field">Tipologia<select value={contact.type} onChange={(event) => void apply({ type: event.target.value })}>{CONTACT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
      <div className="contact-quick-actions"><span className="section-eyebrow">SITUAZIONE OPERATIVA</span>{CONTACT_STATUSES.filter((status) => status !== 'Gestisci' || contact.type === 'Cliente effettivo').map((status) => <button key={status} aria-pressed={contact.statuses.includes(status)} className={contact.statuses.includes(status) ? 'active' : ''} onClick={() => void apply({ action: 'toggle-status', status })}><span className="material-symbols-outlined">{contact.statuses.includes(status) ? 'check_circle' : 'add_circle'}</span>{status}</button>)}</div>
      <div className="contact-profile-info"><div className="contact-section-label"><h3>Anagrafica</h3><button onClick={() => { setForm(contact);setEditRevision(contact.revision);setEditing(true); }}>Modifica</button></div>{contact.phone && <a href={'tel:' + contact.phone.replace(/[^\d+]/g,'')}><span className="material-symbols-outlined">call</span>{contact.phone}</a>}{contact.email && <a href={'mailto:' + contact.email}><span className="material-symbols-outlined">mail</span>{contact.email}</a>}{address && <a href={'https://www.openstreetmap.org/search?query=' + encodeURIComponent(address)} target="_blank" rel="noreferrer"><span className="material-symbols-outlined">location_on</span>{address}</a>}{contact.zone && <p>Zona · {contact.zone}</p>}{contact.brand && <p>Brand · {contact.brand}</p>}{!contact.phone && !contact.email && !address && <p>Aggiungi recapiti e indirizzo dall’anagrafica.</p>}</div>
      <button className="quiet-button" onClick={() => setPlacing(!placing)}><span className="material-symbols-outlined">pin_drop</span>{Number.isFinite(contact.latitude) ? 'Aggiorna punto mappa' : 'Posiziona sulla mappa'}</button>
      <button className="quiet-button contact-archive" onClick={() => void apply({ archived: !contact.archived })}><span className="material-symbols-outlined">{contact.archived ? 'unarchive' : 'archive'}</span>{contact.archived ? 'Ripristina contatto' : 'Archivia contatto'}</button>
    </aside><div className="contact-diary">
      {error && <div className="inline-error" role="alert">{error}<button onClick={() => { void loadActivities(contact.id); void refresh(); }}>Aggiorna</button></div>}
      {placing && <div className="contact-map-picker"><div className="contact-section-label"><h3>Clicca sulla posizione dell’azienda</h3><button onClick={() => setPlacing(false)}>Chiudi mappa</button></div><ContactsMap contacts={[contact]} onPlace={async (latitude,longitude) => { const result=await apply({latitude,longitude});if (!result.error) setPlacing(false); }} /><p>Usa zoom e trascinamento per trovare la zona. Il punto viene salvato nel workspace.</p></div>}
      {editing ? <form className="contact-edit-form" onSubmit={async (event) => { event.preventDefault(); const result = await apply({ ...Object.fromEntries(fields.map((field) => [field.key, form[field.key] || ''])), baseRevision: editRevision }); if (!result.error) setEditing(false); }}><div className="contact-section-label"><h3>Modifica anagrafica</h3><button type="button" onClick={() => setEditing(false)}>Annulla</button></div><div className="contact-form-grid">{fields.map((field) => <label key={field.key}>{field.label}<input type={field.type || 'text'} required={field.key === 'company'} value={String(form[field.key] || '')} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} /></label>)}</div><button className="primary-button">Salva anagrafica</button></form> : <>
      <div className="contact-section-label"><div><h3>Attività</h3><p>Scrivi liberamente. Data e ora vengono aggiunte automaticamente.</p></div><span className="contact-diary-count">{activities.length}</span></div>
      <form className="activity-composer" onSubmit={(event) => { event.preventDefault(); void writeActivity('POST', { id: draftId, text: draft }); }}><textarea aria-label="Nuova attività" placeholder="Cosa è successo con questa azienda?" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={20000} rows={4} data-presence-focus="Nuova attività" /><div><span>Diario condiviso con il team</span><button className="primary-button" disabled={busy || !draft.trim()}>{busy ? 'Salvataggio…' : 'Aggiungi attività'}</button></div></form>
      {loadingActivities ? <p role="status">Caricamento storico…</p> : !activities.length ? <div className="diary-empty"><span className="material-symbols-outlined">notes</span><h4>La prima conversazione comincia qui</h4><p>Ogni nota resterà nello storico dell’azienda.</p></div> : <div className="activity-history">{activities.map((activity) => <article key={activity.id}><div className="activity-meta"><span><time dateTime={activity.createdAt}>{dateTime(activity.createdAt)}</time><small>{activity.authorName}{activity.revision > 1 ? ' · modificata' : ''}</small></span><button onClick={() => { setActivityEdit(activity);setEditText(activity.text); }} aria-label={'Modifica attività del ' + dateTime(activity.createdAt)}><span className="material-symbols-outlined">edit</span></button></div>{activityEdit?.id === activity.id ? <form onSubmit={(event) => { event.preventDefault(); void writeActivity('PATCH', { activityId: activity.id, text: editText, baseRevision: activityEdit.revision }); }}><textarea aria-label="Modifica testo attività" value={editText} onChange={(event) => setEditText(event.target.value)} rows={4} maxLength={20000} /><div className="activity-edit-actions"><button type="button" className="quiet-button" onClick={() => setActivityEdit(null)}>Annulla</button><button className="primary-button" disabled={busy || !editText.trim()}>Salva modifica</button></div></form> : <p className="activity-text">{activity.text}</p>}</article>)}</div>}
      </>}
    </div></div>
  </section></div>;
}
