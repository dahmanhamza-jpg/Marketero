# Marketero 2.0

PWA mobile-first per gestione clienti, calendario lavoro/personale, idee, script, workflow, pagamenti e strategia. Il core funziona **local-first** senza API a pagamento.

## Avvio locale

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

La cartella `dist/` può essere pubblicata su qualunque hosting statico compatibile con SPA/PWA.

## Modalità zero-config

Se pubblichi soltanto il frontend, Marketero funziona subito in modalità locale usando IndexedDB nel browser: clienti, idee, script, task, calendario e strategia deterministica non richiedono backend.

## Sync iPhone ↔ desktop con Cloudflare D1

La sincronizzazione remota richiede **una configurazione iniziale una tantum**: Cloudflare D1 non può esistere senza creare e collegare il database al progetto. Cloudflare documenta che il database D1 deve essere creato e poi associato a un binding del Worker/Pages Function.

1. Crea il database:

```bash
npx wrangler d1 create marketero-db
```

2. Copia il `database_id` ottenuto dentro `wrangler.jsonc`.

3. Applica la migrazione:

```bash
npx wrangler d1 execute marketero-db --remote --file=./migrations/0001_init.sql
```

4. Collega il repository GitHub a Cloudflare Pages e usa:
   - Build command: `npm run build`
   - Output: `dist`

5. Verifica che il binding D1 si chiami `DB`.

6. Pubblica di nuovo il progetto.

L'app genera internamente un token casuale di workspace a 256 bit. Il token non è un PIN e non viene indovinato con 4 cifre. Per usare lo stesso workspace su un secondo dispositivo, usa il backup/restore completo che include le impostazioni del workspace.

## PIN e recovery

Al primo avvio scegli un PIN di 4 cifre. Il codice `0000`, richiesto per questo progetto, serve **solo ad avviare il reset del PIN locale**. Non è usato come chiave crittografica e non deve essere considerato un meccanismo forte di sicurezza. Per un'app esposta pubblicamente è consigliabile sostituirlo con un recovery code casuale.

## Workflow contenuti

`Idea → Script → Registrazione → Montaggio → Programmazione → Pubblicato`

Ogni Script supporta Hook, testo, CTA, note registrazione, etichette predefinite, URL Reel/TikTok di riferimento, copia ed export `.txt`.

## Note architetturali

- React + TypeScript + Vite
- PWA via `vite-plugin-pwa`
- IndexedDB via Dexie
- Cloudflare Pages Functions + D1 opzionali per sync
- nessuna API AI obbligatoria
- Strategy Builder deterministico e sempre disponibile
