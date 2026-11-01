# BlueSpherix — memoria operativa

Ultimo aggiornamento: 2026-11-01

## Obiettivo

Web app moderna per analisi di trading, ispirata alle funzioni di Myfxbook ma con interfaccia più chiara, grafici migliori e flussi più intuitivi. Target principale: macOS/Safari.

## Stato attuale

- Repository: `emil2699-lab/BlueSpherix`, branch `first`.
- Anteprima: `https://emil2699-lab.github.io/BlueSpherix/`.
- Stack: Next.js 16.4.3, React 19.3.1, TypeScript, export statico su GitHub Pages.
- Sezioni già sviluppate: Dashboard, Portfolio, Analytics, Operazioni, Rischio e Strategy Lab.
- La sezione Oggi usa ora lo stesso linguaggio visivo delle sezioni recenti: stato live, avviso demo, periodo integrato nel grafico, sfera dello stato del rischio con nodi dinamici per rischio aperto, margine e drawdown, e KPI strutturati. Ogni nodo segue una propria orbita concentrica con palette acqua/viola/blu; valori e soglie restano in una legenda interna. I tre KPI restano affiancati alle larghezze intermedie e, quando lo spazio si riduce, il mini-grafico scorre fisicamente dalla posizione laterale a quella centrale sotto il numero con curva fluida; su mobile i riquadri passano in colonna. Sugli schermi larghi i mini-grafici crescono progressivamente fino a 132×46 px.
- Ice Glass WebGL 2 è applicato a tutte le viste. Prova attuale richiesta dall'utente: materiale e configurazione della lastra `7f42d25`, con sola fusione RGB per prossimità e inarcamento dinamico della fascia delle versioni recenti. Ripristinato il trasporto secondario originale in `ice-glass-slab-transport.ts`; fotoni e geometria a saponetta inattivi, nessuna cresta bianca aggiuntiva. Canvas condiviso agganciato allo scroll, cursore senza interpolazione, contenuti opachi e layout preservati. Nessuno sfondo dinamico. Safari/macOS non verificabile dal cloud.
- La sezione Rischio è completa: budget di rischio, stress test, simulatore pre-trade, correlazioni, drawdown, protezioni, Monte Carlo e guardrail.
- Strategy Lab include tre ipotesi interattive con parametri specifici, confronto Digital Twin, costi reali, rischio variabile, validazione walk-forward, Out-of-Sample Gate 70/30, Execution Friction Test, Parameter Space con risultati reali e archivio dei benchmark salvati nella sessione.

## Preferenze UI vincolanti

- Qualsiasi valore numerico negativo deve essere rosso; mai verde/acqua.
- I risultati negativi usano superfici rosse proporzionali alla gravità.
- I valori positivi usano acqua/turchese; lo zero resta neutro.
- Animazioni morbide e coerenti; gli switch seguono il comportamento iOS: lieve espansione, scorrimento, assestamento.
- Tutti i nuovi movimenti devono usare le curve condivise in stile Apple definite in `app/globals.css`: layout fluido, assestamento elastico, pressione rapida e dissolvenza. Selettori segmentati, tab, preset e switch fisici devono animare pressione e cambio di stato.
- Controlli mobile alti almeno 40–44 px.
- Menu e calendari devono essere personalizzati e coerenti, senza tendine native nere e squadrate.
- Evitare informazioni duplicate tra viste; ogni dato compare dove serve davvero.
- Mantenere coerenza tra riquadri, spaziature, raggi, hover e transizioni.

## Regole tecniche

- Sistema semantico dei segni: `app/value-sign.ts` e selettori CSS `[data-sign]`.
- Dati demo: `app/demo-data.ts` e `app/demo-ledger.ts`, data di riferimento 2026-10-28.
- Non committare `AGENTS.md` o `bluespherix-preview.png`.
- `next dev` può modificare `next-env.d.ts`: ripristinarlo prima del commit.
- TypeScript: usare `npx tsc --noEmit --incremental false`.
- Verifiche standard per un blocco: lint, TypeScript e controllo dati; browser test solo per modifiche visive/interattive rilevanti.

## Metodo per ridurre il consumo di contesto

1. Lavorare per blocchi completi, evitando una modifica, un test e un push per ogni dettaglio.
2. Dare pochi aggiornamenti intermedi e una risposta finale breve.
3. Eseguire una sola fase di verifica e una sola pubblicazione per blocco.
4. Aggiornare questo file soltanto quando cambiano stato, decisioni permanenti o prossimo obiettivo.
5. Nei nuovi turni rileggere questo file e i soli sorgenti coinvolti, senza ricostruire tutta la cronologia.

## Prossimo passo consigliato

Attendere il feedback sulla prova con base `7f42d25`, fusione RGB e inarcamento attuali. Sono ripristinati il materiale, le normali, lo spessore, il riflesso bianco, l'opacità originale e il trasporto secondario della lastra; la fusione RGB e l'inarcamento usano il modello recente adattato alla lastra. Nessuna cresta bianca aggiuntiva o volume a saponetta. Cursore diretto, scroll e correzione della sovrapposizione operazioni preservati. Test in `/workspace/artifacts/glass-base7f-rgb/`. Non creare sfondi o altri effetti non richiesti. Safari su Mac non verificabile dal cloud.

### Preferenza jumpcard
- Il micro-movimento 3D della singola card al passaggio del cursore è temporaneamente disattivato.
- Parola chiave per riattivarlo: `jumpcard`.

### Riflesso bianco lucido
- La variante `a6400e2` è salvata in `/workspace/Desktop/bluespherix layout backup/riflessi bianco rgb dinamici_a6400e2`.
- La cresta bianca aggiuntiva di `6e722db` rimane nella cronologia Git, con verifiche in `/workspace/artifacts/glass-polished-core/`. Non è attiva nella prova successiva basata su `7f42d25`.
