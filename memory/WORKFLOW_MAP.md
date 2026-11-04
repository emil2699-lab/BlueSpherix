# Mappa di lavoro, test e pubblicazione

## Repository

- Percorso: \`/workspace/BlueSpherix\`.
- Remoto: \`emil2699-lab/BlueSpherix\`.
- Branch pubblico: \`first\`; branch locale corrente: \`work\`.
- URL pubblico: \`https://emil2699-lab.github.io/BlueSpherix/\`.
- GitHub Pages costruisce l'export statico con base path \`/BlueSpherix\` in CI.

## Prima di modificare

1. Leggere \`memory/PROJECT_STATE.md\` e una sola mappa pertinente.
2. Controllare \`git status --short\` e le istruzioni \`AGENTS.md\` applicabili.
3. Per Next.js leggere la documentazione locale rilevante in \`node_modules/next/dist/docs\`.
4. Usare Graphify per relazioni tra simboli; usare \`rg\` per ricerche puntuali.

## Controlli

\`\`\`sh
npm run lint
npx tsc --noEmit --incremental false
npm run data:check
npm run build
\`\`\`

- Lint, TypeScript e dati sono la base.
- Build per pubblicazione e cambi che possono influire sull'export.
- Test Playwright mirato per cambi visivi/interattivi, desktop e mobile; controllare errori pagina, overflow, un solo canvas e reduced motion.
- Shader: usare le verifiche WebGL esistenti quando cambiano shader, geometria o parametri ottici.
- Safari/macOS non è disponibile nel cloud: descrivere soltanto ciò che è verificato in Chromium/WebGL.
- \`next dev\` può cambiare \`next-env.d.ts\`; ripristinarlo prima del commit se non fa parte del lavoro.

## Pubblicazione autorizzata

Per ogni blocco completato e verificato: commit mirato, push di \`HEAD:first\`, monitoraggio del run GitHub Pages per quello SHA e controllo del bundle pubblico. Non pubblicare lavoro fermato, annullato o scartato.

## Graphify locale

- Skill: \`.agents/skills/graphify/SKILL.md\`; note locali in \`INSTALLATION.md\`.
- Comandi: \`npm run graph:status\`, \`npm run graph:query -- "Simbolo"\`, \`npm run graph:build\`.
- Runtime \`/workspace/bin/graphify\`; aggiornamenti automatici e backend LLM disabilitati.
- Output \`graphify-out/\` ignorato da Git. Il grafo aiuta a scegliere i file, ma non comprime i token della chat e non sostituisce la verifica dei sorgenti.
- Stato al 2026-11-04: 477 nodi, 880 archi, modalità \`local code only\`.

## Test e documenti per area

- Vetro generale: \`docs/ice-glass.md\` e script \`check-glass-*\`.
- Selezioni/underlight: \`docs/glass-selection.md\`.
- Portfolio: \`scripts/check-portfolio-chart.mjs\` più artefatti sotto \`/workspace/artifacts/portfolio-*\`.
- Diario: \`docs/journal.md\` e \`scripts/check-journal.mjs\`.
- Pattern e segni: \`docs/ui-patterns.md\`.

## Backup e recupero

- Esperimenti vetro storici: \`/workspace/Desktop/bluespherix layout backup/\` se presente nell'ambiente.
- Varianti note: \`vetro_rgb\`, riflessi bianchi/RGB e release candidate 2.0.
- La storia Git conserva tutte le versioni e i revert. Non ripristinare un vecchio commit intero quando basta recuperare un file o un frammento mirato.

## Igiene del contesto

- Non leggere la trascrizione completa della chat.
- Non caricare tutte le mappe insieme.
- Un blocco di lavoro, un ciclo di test e una pubblicazione.
- Aggiornare soltanto la mappa interessata quando cambia una decisione stabile.
- Risposte brevi: risultato, sezione, verifica e pubblicazione.
