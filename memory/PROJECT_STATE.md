# BlueSpherix — indice operativo compatto

Ultimo aggiornamento: 2026-11-04. Questo è l'unico file da leggere sempre. Aprire poi una sola mappa pertinente; non ricostruire la vecchia chat e non consultare la sua trascrizione completa.

## Stato autorevole

- Repository \`emil2699-lab/BlueSpherix\`, lavoro locale su \`work\`, pubblicazione con push di \`HEAD:first\`.
- Sito: \`https://emil2699-lab.github.io/BlueSpherix/\`.
- Versione locale e pubblica: \`bc525e9\` (\`fix: restore cursor optics and light active lab switches\`).
- Stack: Next.js 16.4.3, React 19.3.1, TypeScript, export statico GitHub Pages.
- Worktree pulito. Nessun lavoro sospeso. L'ultimo cambio proposto alla modalità iniziale del Lab è stato annullato su richiesta.
- Il Lab apre quindi **Uscita adattiva**. Asia/Londra/New York sono in **Lab → Session focus → Regola simulata**.

## Regole vincolanti

- Numeri negativi sempre rossi; positivi acqua; zero neutro. Le superfici negative aumentano il rosso con la gravità.
- Target principale macOS/Safari. Non dichiarare Safari verificato dal cloud.
- Animazioni con curve Apple condivise; controlli mobile 40–44 px; menu e calendari personalizzati.
- Preservare l'ottica Ice Glass approvata, senza sfondo dinamico. \`jumpcard\` resta disattivato finché l'utente non usa la parola chiave.
- Prima di modifiche indicate su screenshot, riassumere la richiesta e nominare la sezione interessata.
- Pubblicare ogni modifica completata dopo i controlli. Uno stop, annullamento o “non applicare” prevale e impedisce commit/push.
- Non committare \`AGENTS.md\` o \`bluespherix-preview.png\`.

## Percorso minimo per lavorare

1. Leggere questo file.
2. Aprire una sola mappa:
   - prodotto e file: \`memory/CODE_MAP.md\`;
   - estetica e interazioni: \`memory/DESIGN_MAP.md\`;
   - decisioni della chat: \`memory/CHAT_MAP.md\`;
   - test, Graphify e deploy: \`memory/WORKFLOW_MAP.md\`.
3. Per relazioni strutturali usare prima \`npm run graph:query -- "Simbolo"\`; per un dettaglio semplice usare \`rg\`.
4. Leggere solo i sorgenti coinvolti e la documentazione specifica.

## Verifica e pubblicazione

Base: lint, \`npx tsc --noEmit --incremental false\`, \`npm run data:check\`. Aggiungere build e test browser per cambi visivi o interattivi. Ripristinare \`next-env.d.ts\` se alterato. Dopo il push verificare che GitHub Pages abbia distribuito esattamente lo SHA pubblicato.

## Prossimo lavoro

Nessun obiettivo pendente. Partire dalla prossima richiesta dell'utente senza riaprire la cronologia completa.
