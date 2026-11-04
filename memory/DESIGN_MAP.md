# Mappa design e interazioni

## Linguaggio visivo

- Interfaccia scura, borderless, coerente tra sezioni, con separatori discreti.
- Positivi acqua/turchese; negativi rosso corallo; zero neutro. Intensità delle superfici negative proporzionale alla gravità.
- Spaziature, raggi, hover e gerarchia coerenti. Evitare dati duplicati tra viste.
- Menu e calendari sono componenti personalizzati; niente tendine native nere e squadrate.
- Touch target mobile 40–44 px. I layout devono restare leggibili senza sovrapposizioni.

## Movimento

- Usare le curve condivise in \`app/globals.css\`: layout fluido, assestamento elastico, pressione rapida e dissolvenza.
- Switch e tab: lieve espansione alla pressione, scorrimento, assestamento e ritorno alla misura normale.
- Reduced motion deve produrre uno stato finale stabile.
- \`jumpcard\` è disattivato; riattivarlo solo se l'utente usa esplicitamente quella parola.

## Ice Glass approvato

- Un solo canvas WebGL sotto il DOM; contenuti DOM opachi e materiale trasparente.
- Geometria continua a saponetta, IOR 1,5, dispersione RGB 0,05, corpo 0,14.
- Cursore come sorgente diretta, senza inseguimento. Nessun alone o sfondo dinamico.
- Fascia spettrale rettilinea a riposo e deformata dalla rifrazione locale.
- Vicino alla sorgente i canali convergono in un riflesso bianco lucido; lontano si separano gradualmente.
- Preservare geometria e parametri quando la richiesta riguarda soltanto colore, layout o contenuto.

## Vetro sulle selezioni

- Stesura piatta radiale dal clic: 280 ms.
- Crescita del volume dopo la copertura: 360 ms.
- Uscita: 200 ms, congelando la fase corrente.
- Nessuna cornice o ombra CSS aggiuntiva. Focus da tastiera sempre visibile.
- Controlli esclusivi si spengono su altra scelta, click fuori o Escape. Checkbox e gruppi \`data-glass-multiple\` restano rivestiti finché il loro stato reale è attivo.
- Fallback senza WebGL: rivestimento CSS statico discreto.

## Luce interna

- Campo lento e continuo, senza direzione fissa. Le zone possono spegnersi del tutto e riaccendersi.
- Luce confinata nella sagoma, senza bloom. Zone deboli mantengono la tinta; picchi forti tendono al bianco.
- Per risultati finanziari: intensità da \`abs(result)/balance\`; 25% fino a 0,1%, crescita al 100% a 3%, poi limite; zero spento.
- Contributo alle card vicine ammesso solo sui bordi interni, non nello spazio vuoto.
- Strategy Lab: Regola simulata, Campione e Rischio per trade mantengono vetro e luce sull'opzione attiva. L'ottica del cursore usa il raggio originale.

## Casi approvati

- Edge Map: base colorata separata e ritagliata sulla sagoma; la base sparisce solo nella cella selezionata. Potenza dalla grandezza assoluta rispetto al massimo della mappa.
- Righe negative: rimangono rosse anche su hover e selezione.
- Portfolio: selettori a destra del grafico su desktop e sotto il grafico su mobile; punti del grafico aprono il dettaglio trade.
- KPI Oggi: affiancati finché c'è spazio; il mini grafico passa sotto il numero con animazione fluida quando necessario.
