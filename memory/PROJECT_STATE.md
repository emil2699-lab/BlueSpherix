# BlueSpherix — memoria operativa

Ultimo aggiornamento: 2026-11-02

## Obiettivo

Web app moderna per analisi di trading, ispirata alle funzioni di Myfxbook ma con interfaccia più chiara, grafici migliori e flussi più intuitivi. Target principale: macOS/Safari.

## Stato attuale

- Repository: `emil2699-lab/BlueSpherix`, branch `first`.
- Anteprima: `https://emil2699-lab.github.io/BlueSpherix/`.
- Stack: Next.js 16.4.3, React 19.3.1, TypeScript, export statico su GitHub Pages.
- Sezioni già sviluppate: Dashboard, Portfolio, Analytics, Operazioni, Rischio, Strategy Lab e Diario.
- La sezione Oggi usa ora lo stesso linguaggio visivo delle sezioni recenti: stato live, avviso demo, periodo integrato nel grafico, sfera dello stato del rischio con nodi dinamici per rischio aperto, margine e drawdown, e KPI strutturati. Ogni nodo segue una propria orbita concentrica con palette acqua/viola/blu; valori e soglie restano in una legenda interna. I tre KPI restano affiancati alle larghezze intermedie e, quando lo spazio si riduce, il mini-grafico scorre fisicamente dalla posizione laterale a quella centrale sotto il numero con curva fluida; su mobile i riquadri passano in colonna. Sugli schermi larghi i mini-grafici crescono progressivamente fino a 132×46 px.
- Ice Glass WebGL 2 è applicato a tutte le viste: canvas condiviso, luce globale senza interpolazione, SDF/Snell/Fresnel, dispersione RGB 0,05 e fascia cromatica dritta di base, deformata dalle differenze dei percorsi Snell locali. Il trasporto a fotoni sperimentale è disattivato dopo il feedback sui punti luminosi. Base ripristinata a `7f42d25` tramite `5fdc748`; esperimenti successivi conservati in `/workspace/Desktop/bluespherix layout backup/vetro_rgb`. La superficie ora è trasparente: canvas sotto il DOM e nessun riempimento CSS aggiuntivo; contenuti opachi. Risposta diretta del materiale e parametri ottici preservati. Non è stato aggiunto alcuno sfondo dinamico. Safari/macOS non verificabile dal cloud.
- La sezione Rischio è completa: budget di rischio, stress test, simulatore pre-trade, correlazioni, drawdown, protezioni, Monte Carlo e guardrail.
- Strategy Lab include tre ipotesi interattive con parametri specifici, confronto Digital Twin, costi reali, rischio variabile, validazione walk-forward, Out-of-Sample Gate 70/30, Execution Friction Test, Parameter Space con risultati reali e archivio dei benchmark salvati nella sessione.

- Diario ora ha una vista dedicata `#journal`: revisioni trade e giornate, ricerca/filtri, checklist, emozioni, tag, qualità, screenshot reali ed export JSON. Editor e archivio persistente locale condivisi con Operazioni; salvataggio esplicito, bozze conservate in memoria durante la navigazione, errori di quota visibili. Stile uniformato alle altre sezioni: controlli condivisi per periodo/export/filtri/ricerca/tag, badge KPI e selettore Trade/Giornate scorrevole; eliminato l’override del font che ingrandiva i pulsanti. Dettagli e test in `docs/journal.md`. Nessun backend o collegamento MT5 introdotto.

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

Dopo il feedback sul punto 3: eliminati dall'interfaccia il photon atlas e i punti speculari interni; il modello sperimentale rimane nei sorgenti ma è inattivo. Canvas absolute nello stesso contenitore delle card, con overscan di due viewport, per evitare distacco durante lo scroll asincrono. Fascia arcobaleno rettilinea di base: si deforma secondo differenze fra percorsi Snell locali e sorgente parallela di riferimento, senza curva UV o onde prefissate. Geometria a saponetta, dispersione 0,05, trasparenza, layout e contenuti preservati. Test e screenshot in `/workspace/artifacts/glass-scroll-band/`. Corpo del vetro regolato a 0,14 dopo l'approvazione dell'effetto. L'ultima richiesta fonde un riflesso bianco lucido vicino al cursore con l'arcobaleno esistente: gli stessi canali RGB si sovrappongono da vicino e si separano progressivamente allontanando la sorgente; oltre 192 px dal frammento torna esattamente il risultato precedente. Nessun alone, modifica alla curva centrale, opacità o ritardo aggiunto. Verifiche in `/workspace/artifacts/glass-gloss-spectrum/`. Preservare tutto il resto dell'effetto approvato. Non creare uno sfondo dinamico o altri effetti non richiesti. Safari su Mac non verificabile dal cloud.

### Vetro sui controlli selezionati
- Prova luce interna limitata ai controlli selezionati di Oggi: campi noise spaziali/temporali continui, senza direzione fissa, con spegnimenti completi e riaccensioni locali. Intensità massima delle posizioni da abs(P&L)/saldo: minimo 25% fino a 0,1%, crescita lineare fino al massimo al 3%, poi stabile; P&L zero spento. Tinta nelle zone soffuse e creste più forti tendenti al bianco secondo intensità effettiva. I picchi oltre il 35% possono illuminare i bordi delle altre card di Oggi, campionando lo stesso campo emittente con attenuazione quadratica; approssimazione area light 2.5D, senza ray tracing/occlusione o rimbalzi. Solo radiance aggiunta dentro la sagoma, alpha e riflessi invariati; nessun bloom o sfondo dinamico. Circa 30 fps a riposo, stop alla deselezione/navigazione/visibilità, reduced motion fermo. Test `scripts/check-glass-underlight.mjs`; artefatti aggiornati `/workspace/artifacts/glass-underlight-lifecycle/`. Test aggiuntivi `scripts/check-underlight-scale.mjs`, `scripts/check-underlight-optics.mjs`.
- Anche le righe delle posizioni di Oggi sono ora pulsanti nativi collegati al rivestimento condiviso; prima erano `div` statici esclusi dal gestore. Il periodo del grafico era già coperto. Nessuna variazione al layout o ai dati. Verifica dedicata: `scripts/check-glass-selection-today.mjs`, artefatti `/workspace/artifacts/glass-selection-today/`.
- I controlli selezionabili di tutte le sezioni condividono il renderer delle card, comprese righe, celle, checkbox e menu. La stesura radiale parte dal clic (280 ms) come lastra lucida piatta; poi cresce il campo di altezza e delle normali a saponetta (360 ms). Tinta originale del controllo e riflessi leggermente colorati, nessuna cornice/ombra CSS di selezione. Uscita 200 ms su altro controllo/click fuori/Escape, con volume e copertura congelati se interrotti. Valori funzionali e opacità dei contenuti preservati. I toggle spenti perdono il vetro. Un solo renderer WebGL, fallback CSS statico nella tinta e reduced motion immediato. Ottica delle card invariata entro precisione float (max 7.46e-9). Dettagli e test in `docs/glass-selection.md`; artefatti `/workspace/artifacts/glass-selection-two-step/`.

### Preferenza jumpcard
- Il micro-movimento 3D della singola card al passaggio del cursore è temporaneamente disattivato.
- Parola chiave per riattivarlo: `jumpcard`.

### Riflesso bianco lucido
- La variante `a6400e2` è salvata in `/workspace/Desktop/bluespherix layout backup/riflessi bianco rgb dinamici_a6400e2`.
- Dopo il backup, l'utente ha chiesto un bianco più netto mantenendo tutto l'effetto precedente. Aggiunta una cresta neutra sul prodotto continuo dei profili RGB sovrapposti: circa metà larghezza del riflesso morbido, che rimane presente. La cresta svanisce verso la dispersione lontana. Nessuna modifica a RGB, materiale, geometria o movimento del cursore. Verifiche in `/workspace/artifacts/glass-polished-core/`.
