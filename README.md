# Hub Commerciale

CRM aziendale con archivio Contatti, diario libero, collaborazione tra dispositivi e Copilota. Le viste Pipeline, Opportunità e Risultati restano disponibili per le trattative economiche.

## Avvio

```bash
npm ci
npm run dev
```

Node.js 22 o successivo. In sviluppo viene creato `data/commercial.sqlite`. Senza provider email lo sviluppo simula l’invio; per prove automatiche impostare `MAIL_PREVIEW_FILE` su un percorso locale escluso da Git. Questa modalità non è disponibile in produzione.

## Variabili Vercel

| Variabile | Uso |
| --- | --- |
| `TURSO_DATABASE_URL` | URL del database persistente, obbligatorio in produzione |
| `TURSO_AUTH_TOKEN` | Token del database Turso |
| `APP_ORIGIN` | URL HTTPS pubblico e stabile, senza slash finale. È supportata anche `NEXT_PUBLIC_APP_URL` già presente nei vecchi deploy |
| `RESEND_API_KEY`, `RESEND_FROM` | In alternativa a SMTP: chiave Resend e mittente con dominio verificato |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | In alternativa a Resend: relay e mittente autorizzato. Anche `SMTP_PASS` è supportata |
| `BREVO_API_KEY`, `SMTP_FROM` | Opzione Brevo REST; richiede una chiave REST, diversa da una chiave SMTP |
| `GEMINI_API_KEY` | Facoltativa: abilita i modelli generativi selezionabili in chat |
| `AI_ALLOWED_MODELS` | Facoltativa: lista separata da virgole. Predefinita `gemini-2.5-flash,gemini-2.5-flash-lite` |
| `NEXT_PUBLIC_MAP_TILE_URL` | Facoltativa: URL tile compatibile Leaflet. Predefinito OpenStreetMap, con attribuzione |
| `MCP_API_TOKEN`, `MCP_OWNER_USER_ID` | Facoltative: abilitano l’integrazione HTTP per il workspace indicato |

Non servono nuove chiavi per contatti, diario, inviti, presenza, assistente locale o sintesi vocale. Configurare almeno un provider email. Resend → Brevo → SMTP sono tentati in ordine quando configurati; nessun mittente personale viene aggiunto automaticamente. Il provider deve confermare l’accettazione prima che l’app segnali l’invio. SPF/DKIM, limiti del piano, spam e consegna finale dipendono dal provider e dal dominio.

L’assistente locale funziona senza API e cerca/riepiloga il CRM. Gemini compare solo se la chiave e il modello sono effettivamente disponibili. Per evitare addebiti usare un progetto Google con fatturazione disattivata o lasciare vuota la chiave; il server non può verificare il piano di fatturazione della chiave. Il contesto CRM viene inviato a Gemini solo quando l’utente seleziona la casella dedicata. Le chat sono private per utente e workspace; i dispositivi dello stesso account condividono lo storico.

## Uso del CRM

- Tre tipologie: **Contatto**, **Notizia**, **Cliente effettivo**.
- Cinque situazioni indipendenti e attivabili senza moduli. **Gestisci** è riservata ai clienti effettivi.
- Attività con un solo testo libero, data/ora server e storico dalla più recente. La modifica di una nota conserva le altre e registra internamente la revisione precedente.
- Ricerca e filtri per tipologia, situazione, brand, città, provincia e zona. Archivio reversibile e CSV dei risultati filtrati.
- La mappa mostra i contatti posizionati manualmente dalla scheda. Nessun geocoding automatico di indirizzi privati su servizi pubblici; link all’indirizzo e filtri funzionano anche senza coordinate.
- Contatti e diario si aggiornano tra sessioni visibili ogni 5 secondi e al ritorno alla finestra. Le modifiche alla stessa anagrafica/nota vengono segnalate prima di sovrascrivere; note nuove e situazioni sono operazioni distinte.
- La barra presenze indica sessione/dispositivo, numero, colore, pagina e ultimo campo focalizzato. Non legge il contenuto dei campi, non espone i cookie e non rileva una posizione geografica. Le sessioni inattive spariscono entro 60 secondi.
- Il proprietario invita amministratori e commerciali nelle impostazioni. Anche chi ha già un account può accettare, mantenendo il workspace precedente. L’azienda attiva si sceglie in Account e sicurezza per la sessione corrente; viene ricordata come scelta iniziale per i nuovi accessi. Gli altri dispositivi mantengono il proprio workspace attivo.
- All’ingresso si sceglie **Copilota** o **Workspace**. La preferenza è salvata sull’account; la scelta viene riproposta a ogni nuovo accesso alla pagina.

## Accesso e sicurezza

Password con scrypt e sale casuale; sessioni indipendenti di 14 giorni con cookie HttpOnly, SameSite=Lax, Secure in produzione. Limiti ai tentativi per IP/account. Gli errori temporanei non cancellano la sessione e il logout attende la revoca del cookie. La verifica email richiede un clic esplicito nell’app: gli scanner della posta non consumano il link. Il recupero password invalida i vecchi accessi e consuma il link una volta in transazione.

L’autorizzazione viene controllata sul server tramite appartenenza al workspace. I commerciali possono aggiornare contatti, diario e trattative, ma non amministrare team, brand, eliminazioni delle trattative o backup completi. Le passkey già presenti nel progetto usano verifica WebAuthn server, challenge monouso, verifica utente e dominio atteso.

Il vecchio endpoint diagnostico `/api/admin/purge-user` è stato rimosso. Non ripristinare versioni che lo contengono; applicare la protezione del percorso anche ai vecchi URL di deployment.

## Backup, migrazione e recupero

**Impostazioni workspace → Dati → Scarica backup** esporta contatti, diario, revisioni e archivio commerciale in JSON. Il CSV dei contatti è invece un export dei soli dati tabellari filtrati. I backup possono contenere informazioni riservate e vanno conservati nell’archivio aziendale autorizzato.

La migrazione `20261025-collaboration-schema` aggiunge tabelle e indici senza cancellare `crm_data`. `20261025-memberships-data` assegna gli accessi esistenti e mantiene il workspace delle sessioni già aperte. Il primo caricamento Contatti importa in transazione le aziende delle opportunità precedenti e i relativi appunti/storici. Gli ID deterministici e il registro `workspace_backfills` impediscono duplicazioni. Le nuove opportunità create successivamente restano nelle viste commerciali: il nuovo archivio Contatti ha una gestione indipendente.

Prima di una migrazione su un database esistente creare uno snapshot Turso. Per un incidente: conservare lo snapshot dello stato corrente, ripubblicare una versione sicura compatibile e ripristinare lo snapshot Turso in un database separato; verificare accesso, appartenenze, contatti e diario prima di cambiare le variabili del deployment. Non eliminare le nuove tabelle per fare rollback: contengono dati nuovi assenti nel vecchio archivio. Il JSON è disponibile anche per recuperi mirati da parte dell’amministratore del database; non esiste un import automatico del backup dall’interfaccia.

## Voce

La chat vocale usa il riconoscimento del browser, quando supportato e con autorizzazione al microfono. Le risposte utilizzano voce e velocità scelte nelle impostazioni. Il riepilogo dei numeri viene composto localmente, senza chiamate generative automatiche. Sintesi Edge neurale senza chiavi, con ripiego sulla sintesi del dispositivo se il servizio non risponde. È una dipendenza esterna senza garanzia di disponibilità; la qualità e il riconoscimento dipendono anche dal dispositivo. Il testo da leggere viene inviato al servizio di sintesi; la chat resta utilizzabile a tastiera.

## MCP

`npm run mcp` avvia il server STDIO. `/api/mcp` è un’API JSON protetta da Bearer token, non un trasporto MCP HTTP/SSE standard. Espone KPI e opportunità delle viste commerciali. Senza entrambe le variabili MCP la scrittura HTTP rimane chiusa. Non inserire token nel browser.

## Verifica

```bash
npm test
npm run test:e2e
npm run lint
npm run build
npm audit
```

I test E2E usano un database temporaneo e una casella email simulata, disattivano le credenziali esterne e non modificano dati/clienti reali. Chrome locale e Chrome già presente nel runner Ubuntu 24.04 in CI, senza download del browser a ogni verifica. Tracce e immagini sono in `artifacts/qa/`, escluse da Git. Il rapporto della consegna è in `docs/audit-2026-10-25.md`.

## Licenze

Inter/Plus Jakarta Sans: SIL OFL. Material Symbols: Apache 2.0, licenze in `public/fonts/`. BorderGlow e DotGrid provengono da React Bits; licenza e attribuzione in `src/components/reactbits/LICENSE.md`. Leaflet e OpenStreetMap mantengono le attribuzioni previste.
