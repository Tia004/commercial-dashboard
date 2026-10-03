# Hub Commerciale - Executive Multi-Brand CRM & AI Copilot (v1.0.0-beta.1)

Dashboard commerciale direzionale creata per centralizzare, orchestrare e chiudere le vendite dei diversi brand aziendali: **NoLimits**, **Webissimo** e **Sapori**.

Costruita in **Next.js 14**, **Tailwind CSS**, **libSQL / Turso** e dotata di **Agente AI autonomo (Gemini / Claude / OpenAI / NVIDIA / OpenRouter)** e **Server Model Context Protocol (MCP)** per Claude Desktop, Cowork e Codex.

---

## ⚡ Caratteristiche Principali

1. **Dashboard Direzionale & Cockpit Esecutivo**:
   - Indicatori immediati: *Venduto*, *Pipeline attiva*, *Trattative in lavorazione*, *Appuntamenti*.
   - Sezione prioritaria **"COSA DEVO FARE OGGI?"** con recupero automatico di chiamate, follow-up, appuntamenti, preventivi e scadenze.
2. **Regola Fondamentale del CRM**:
   - *Nessuna trattativa aperta può rimanere senza un prossimo step.*
   - All'aggiunta, avanzamento o completamento di un'attività il sistema richiede obbligatoriamente: *"Qual è il prossimo step?"*.
3. **Pipeline Kanban Interattiva**:
   - Fasi dinamiche: *Nuovo lead → Conoscenza → Appuntamento → Trattativa → Chiusura*, più *Venduta*, *Persa* e *Stand-by*.
   - Drag-and-drop con calcolo del volume finanziario per colonna.
4. **Scheda Cliente 360 con Cronologia Reale**:
   - Timeline degli eventi (es. *02/10 Lead → 03/10 Chiamata → 04/10 Video call → 04/10 Preventivo → 09/10 Vendita*).
   - Generatore preventivi integrato e contatto istantaneo con WhatsApp, Telefono ed Email.
5. **Autenticazione con Passkey (Touch ID su macOS & Windows Hello)**:
   - Accesso biometrico senza password in 1 click tramite lo standard WebAuthn/FIDO2.
6. **Agente AI Copilot & Voice Briefing**:
   - Sintesi vocale briefing commerciale mattutino e dettatura microfonica con visualizzatore audio ad onda.
   - Esecuzione autonoma di comandi (es: *"Crea lead Mario Rossi NoLimits €18.5k"*, *"Sposta TechSpa a Chiusura"*).
   - Supporto universale: **Google Gemini 2.5 Flash Lite**, **OpenAI ChatGPT**, **Anthropic Claude**, **OpenRouter**, **NVIDIA NIM**, **Groq** o **Ollama/LM Studio**.
7. **Database Turso Edge Cloud (10GB Gratuiti)**:
   - Supporto nativo per connettere il database SQLite Edge su Turso con latenza < 20ms e 10GB di storage dedicati per ogni azienda.
8. **Server MCP Universale Integrato**:
   - Server MCP STDIO (`scripts/mcp-server.js`) ed endpoint HTTP/SSE (`/api/mcp`) per permettere ad agenti esterni (Claude Desktop, Cowork, Codex, Cursor, Goose, Windsurf) di interagire direttamente con la pipeline commerciale.
9. **Triplo Tema Visivo**:
   - **Light (Porcellana)**, **Slate (Dark Ardesia)** e **OLED (Nero Assoluto #000000)**.

---

## 🚀 Avvio Locale

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo su http://localhost:3000
npm run dev

# Avvia il server MCP per Claude Desktop o Cowork
npm run mcp
```

---

## 🌐 Deploy su Vercel & Variabili d'Ambiente

Per pubblicare la dashboard su Vercel:

1. Collega il repository GitHub su [Vercel](https://vercel.com).
2. Nella sezione **Environment Variables**, configura le seguenti chiavi:

### 1. Database Turso (Consigliato per persistenza cloud 10GB)
- `TURSO_DATABASE_URL`: L'URL del tuo database Turso (es. `libsql://tuo-db-org.turso.io`).
- `TURSO_AUTH_TOKEN`: Il token di autenticazione generato da Turso.

*(Se non configurate, la dashboard funziona ugualmente salvando i dati localmente nel browser).*

### 2. Motore AI (Opzionale: puoi impostarle su Vercel o direttamente dalle Impostazioni della dashboard)
- `GEMINI_API_KEY`: Chiave gratuita di Google AI Studio per Gemini 2.5 Flash Lite.
- `OPENAI_API_KEY`: Per GPT-4o / GPT-4o-mini.
- `ANTHROPIC_API_KEY`: Per Claude 3.5 Sonnet / Haiku.
- `OPENROUTER_API_KEY`: Per accedere a oltre 200 modelli LLM con una sola chiave.
- `NVIDIA_API_KEY`: Per i microservizi NVIDIA NIM.

### 3. URL Applicazione
- `NEXT_PUBLIC_APP_URL`: Il dominio Vercel generato (es. `https://commercial-dashboard.vercel.app`).

---

## 🔌 Configurazione Claude Desktop / Cowork / Codex (MCP)

Aggiungi il server nel tuo file di configurazione MCP (es. `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hub-commerciale": {
      "command": "node",
      "args": [
        "/percorso/assoluto/commercial-dashboard/scripts/mcp-server.js"
      ]
    }
  }
}
```

---

## 📦 Versionamento
- **v1.0.0-beta.1**: Release beta iniziale completa con suite multi-brand, passkey, multi-LLM, Turso DB e server MCP.
