# Hub Commerciale

CRM multi-brand per NoLimits, Webissimo e Sapori. La dashboard gestisce opportunità, attività, prossimi passi, stand-by, analisi e dieci code Focus per il lavoro quotidiano.

## Avvio locale

```bash
npm install
npm run dev
```

In sviluppo il database viene creato in `data/commercial.sqlite` (ignorato da Git). Registra un account dall'interfaccia. I dati sono separati per ID account e salvati sul server. Se avevi dati nella versione precedente, usa **Impostazioni → Archivio dati → Importa dati locali precedenti** con un account ancora vuoto.

## Deploy Vercel

Prima del deploy imposta **entrambe** le variabili d'ambiente del database:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Senza database persistente il login in produzione risponde con un errore esplicito. Le password sono elaborate sul server con scrypt e sale casuale; le sessioni usano cookie HttpOnly, SameSite=Lax e Secure in produzione. Il login limita a 10 tentativi falliti per email ogni 15 minuti. L'accesso con passkey è disattivato fino alla verifica WebAuthn sul server. Per una distribuzione a clienti esterni servono ancora verifica email, recupero password e una policy di accesso del team.

## Integrazioni MCP

Lo script STDIO usa lo stesso database e richiede `MCP_OWNER_USER_ID`, corrispondente all'ID visibile in Impostazioni → Account. Avvio: `npm run mcp`. Configura anche le variabili Turso nel processo MCP se il database non è locale.

L'endpoint `/api/mcp` è un'API JSON per integrazioni, **non** un trasporto MCP HTTP/SSE standard. In produzione richiede `MCP_API_TOKEN` nell'header `Authorization: Bearer …` e `MCP_OWNER_USER_ID`. Espone `get_commercial_kpis`, `list_opportunities` e `create_opportunity`. Se le variabili non sono configurate, rifiuta le richieste. Non inserire token Turso o MCP nel browser.

## Voce

Il riepilogo vocale usa la sintesi del browser e le voci italiane installate sul dispositivo, senza API a pagamento. La qualità dipende dal sistema operativo e dalle voci disponibili. Il TTS cloud a pagamento è disattivato.

## Risorse grafiche

I font Inter e Plus Jakarta Sans sono distribuiti con licenza SIL OFL; Material Symbols è distribuito con licenza Apache 2.0. I testi delle licenze sono in `public/fonts/`.

## Verifica

```bash
npm run build
```

Prima di offrire il prodotto a una realtà esterna, completare i punti di sicurezza e onboarding sopra indicati, configurare il database persistente e verificare il deployment con account reali di test.

## Invio email di autenticazione

Le richieste attendono la conferma di accettazione del provider prima di indicare l'invio riuscito. Le API Resend e Brevo hanno un timeout di 5 secondi e usano SMTP come fallback se configurato. La consegna nella casella del destinatario dipende dal provider e dal server ricevente: non è possibile garantirla istantaneamente.

Per Resend configurare `RESEND_API_KEY` e `RESEND_FROM` con un dominio verificato. Il mittente `onboarding@resend.dev` è riservato ai test e non viene selezionato automaticamente. Per Brevo REST configurare `BREVO_API_KEY` e `SMTP_FROM` con un mittente autorizzato; una chiave SMTP non è una chiave REST. Con le sole credenziali SMTP viene usato direttamente il relay configurato.

Ogni richiesta di reinvio consentita dal limite antispam crea un nuovo link e invia subito l'email. I link precedenti restano validi fino alla scadenza o alla verifica dell'account, che li invalida tutti. Un invio fallito elimina soltanto il nuovo link. Gli account in attesa di verifica non vengono cancellati automaticamente dopo 24 ore.

Test del flusso email: `node --test tests/account-email.test.cjs`.
