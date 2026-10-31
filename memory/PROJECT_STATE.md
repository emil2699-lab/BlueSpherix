# BlueSpherix — memoria operativa

Ultimo aggiornamento: 2026-10-30

## Obiettivo

Web app moderna per analisi di trading, ispirata alle funzioni di Myfxbook ma con interfaccia più chiara, grafici migliori e flussi più intuitivi. Target principale: macOS/Safari.

## Stato attuale

- Repository: `emil2699-lab/BlueSpherix`, branch `first`.
- Anteprima: `https://emil2699-lab.github.io/BlueSpherix/`.
- Stack: Next.js 16.4.3, React 19.3.1, TypeScript, export statico su GitHub Pages.
- Sezioni già sviluppate: Dashboard, Portfolio, Analytics, Operazioni, Rischio e Strategy Lab.
- La sezione Oggi usa ora lo stesso linguaggio visivo delle sezioni recenti: stato live, avviso demo, periodo integrato nel grafico, sfera dello stato del rischio con nodi dinamici per rischio aperto, margine e drawdown, e KPI strutturati. Ogni nodo segue una propria orbita concentrica con palette acqua/viola/blu; valori e soglie restano in una legenda interna. I tre KPI restano affiancati alle larghezze intermedie e, quando lo spazio si riduce, il mini-grafico scorre fisicamente dalla posizione laterale a quella centrale sotto il numero con curva fluida; su mobile i riquadri passano in colonna. Sugli schermi larghi i mini-grafici crescono progressivamente fino a 132×46 px.
- In Oggi è in prova Ice Glass WebGL 2: un canvas condiviso, luce globale del cursore senza interpolazione, superficie continua con SDF/Snell/Fresnel, dispersione e trasmissione. Trasporto secondario 2.5D con fino a due passaggi in `app/ice-glass-transport.ts`. Dispersione calibrata a 0,0765 (+70%) con sei bande spettrali localizzate. Config in `app/ice-glass-config.ts`; dettagli e limiti in `docs/ice-glass.md`. Rifrazione dell'ambiente procedurale, non dei pixel DOM. Backup precedenti invariati. 60 FPS su Safari/macOS e fedeltà 90% non confermati dal cloud software.
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

Consolidare il prossimo blocco principale dopo la revisione utente dello Strategy Lab; evitare nuove estensioni della sezione Rischio salvo richieste specifiche.

### Preferenza jumpcard
- Il micro-movimento 3D della singola card al passaggio del cursore è temporaneamente disattivato.
- Parola chiave per riattivarlo: `jumpcard`.
