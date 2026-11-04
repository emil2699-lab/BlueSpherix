# Mappa del codice BlueSpherix

Mappa ricavata dai sorgenti e dal grafo locale Graphify (477 nodi, 880 archi). Usarla come router; confermare sempre sui file originali prima di modificare.

## Entrata e navigazione

- \`app/page.tsx\`: shell principale, navigazione hash, Dashboard Oggi, grafico equity, KPI e sfera del rischio. Monta il renderer condiviso \`IceGlass\`.
- \`app/globals.css\`: sistema visivo globale, layout responsive, curve di movimento e stili condivisi.
- \`app/demo-data.ts\`: dati economici demo e serie temporali.
- \`app/demo-ledger.ts\`: trade demo condivisi tra viste.

## Sezioni

| Sezione | Componente principale | Responsabilità |
| --- | --- | --- |
| Oggi | \`app/page.tsx\` | stato live, P&L, rischio, KPI, posizioni |
| Portafoglio | \`app/portfolio.tsx\` | confronto conti, capitale, grafico e trade |
| Analisi | \`app/analytics.tsx\` | performance, distribuzioni, Edge Map |
| Operazioni | \`app/operations.tsx\` | stream, posizioni, storico, dettagli e filtri |
| Rischio | \`app/risk.tsx\` | budget, stress, correlazioni, Monte Carlo |
| Lab | \`app/lab.tsx\` | esperimenti e validazione strategie |
| Diario | \`app/journal.tsx\` | revisioni trade/giornate e persistenza locale |

Componenti collegati importanti: \`portfolio-chart.tsx\`, \`portfolio-trades.ts\`, \`portfolio-trade-dialog.tsx\`, \`journal-store.ts\`, \`journal-editor.tsx\`.

## Vetro condiviso

- \`app/ice-glass.tsx\`: unico canvas WebGL, raccolta geometrie DOM, puntatore, lifecycle e render loop.
- \`app/ice-glass-shader.ts\`: vertex/fragment shader, SDF, normali, Snell, Fresnel, dispersione e luce interna.
- \`app/ice-glass-config.ts\`: calibrazione ottica autorevole.
- \`app/ice-glass-volume.ts\`: volume convesso e intersezioni geometriche.
- \`app/ice-glass-transport.ts\`: trasporto sperimentale conservato nei sorgenti; non assumere che sia visivamente attivo.
- \`app/glass-selection.ts\`: selezioni temporanee/persistenti, origine del clic, fasi 280/360/200 ms e tinta.
- \`app/glass-underlight.ts\`: intensità della luce finanziaria da risultato e saldo.

Relazione essenziale:

\`page.tsx → IceGlass → glass-selection + geometrie DOM → shader/config\`

Tutte le sezioni espongono superfici al medesimo renderer. Non montare un secondo canvas.

## Colori e dati

- \`app/value-sign.ts\`: unica funzione applicativa per segno positivo, negativo e neutro.
- \`[data-sign]\` in CSS applica il colore semantico globale.
- Le tinte del vetro non devono trasformare un valore negativo in acqua/verde.
- Data demo di riferimento: 2026-10-28.

## Documentazione mirata

- Ottica: \`docs/ice-glass.md\`.
- Selezioni e underlight: \`docs/glass-selection.md\`.
- Pattern UI e segni: \`docs/ui-patterns.md\`.
- Diario: \`docs/journal.md\`.
- Graphify: \`docs/graphify.md\` e \`docs/graphify-security-review.md\`.

## Uso minimo di Graphify

- Domanda strutturale: \`npm run graph:query -- "NomeSimbolo"\`.
- Stato: \`npm run graph:status\`.
- Rigenerare dopo un blocco di codice: \`npm run graph:build\`.
- Per testo, CSS, shader incorporati o una singola occorrenza usare \`rg\`: il grafo ha copertura limitata in questi casi.
