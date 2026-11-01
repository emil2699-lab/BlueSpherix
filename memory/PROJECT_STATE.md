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
- Ice Glass WebGL 2 è applicato a tutte le viste: canvas condiviso, luce globale senza interpolazione, SDF/Snell/Fresnel, dispersione RGB 0,05 e trasporto secondario 2.5D fino a due passaggi. Base ripristinata a `7f42d25` tramite `5fdc748`; esperimenti successivi conservati in `/workspace/Desktop/bluespherix layout backup/vetro_rgb`. La superficie ora è trasparente: canvas sotto il DOM e nessun riempimento CSS aggiuntivo; contenuti opachi. Shader e parametri ottici invariati. Non è stato aggiunto alcuno sfondo dinamico. Safari/macOS non verificabile dal cloud.
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

Punto 2 applicato: superficie ottica a saponetta, con campo di altezza e normali analitiche continue; la quota entra nel vettore luce e nella riflessione dell'ambiente esistente. Dopo il feedback «non vedo differenze» il volume è stato reso più leggibile: spessore geometrico 2,1×, raggio ottico 1,75×, raccordo più ampio e bombatura 30%. Rettangoli DOM, trasparenza e contenuti preservati; nessuna modifica ai parametri di luce/colore o al trasporto. Confronti in `/workspace/artifacts/glass-soap-visible/`. Attendere la verifica utente della geometria nella preview. Non avviare altri punti né creare lo sfondo dinamico senza le specifiche dell’utente.

### Preferenza jumpcard
- Il micro-movimento 3D della singola card al passaggio del cursore è temporaneamente disattivato.
- Parola chiave per riattivarlo: `jumpcard`.
