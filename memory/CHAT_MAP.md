# Mappa compatta della chat BlueSpherix

Fonte: markdown fornito dall'utente, 45.348 righe, 2,65 MB e 169 richieste estratte. Il collegamento alla vecchia chat è intenzionalmente escluso da questa memoria. Questa mappa sostituisce la rilettura della trascrizione.

## Intento del prodotto

BlueSpherix nasce da zero come cockpit di analisi e controllo per trader MT5, installabile come web app e ottimizzato per macOS/Safari. Deve coprire il nucleo di Myfxbook con una struttura più chiara, grafici migliori e lettura del rischio più immediata. L'integrazione MT5 prevista è in sola lettura; la demo attuale non contiene un backend MT5.

Le aree costruite sono: Oggi, Portafoglio, Analisi, Operazioni, Rischio, Lab e Diario. Il prodotto usa dati demo coerenti e un ledger condiviso.

## Evoluzione utile

1. **Fondamenta e dashboard.** Creazione Next.js, anteprima pubblica e prime sezioni. L'utente ha stabilito che perdite e numeri negativi devono essere rossi in ogni punto dell'interfaccia.
2. **Operazioni.** Diverse varianti sono state provate e annullate. La versione finale consolida posizioni aperte, ordini, storico, risultato netto, dettaglio trade, filtri data e calendari personalizzati. La tabella completa è stata rimossa.
3. **Rischio e Lab.** Aggiunti simulatore pre-trade, correlazioni, drawdown, protezioni, Monte Carlo e Strategy Lab con esperimenti, costi, walk-forward e test di esecuzione.
4. **Oggi e movimento.** Stato del rischio con orbite significative, KPI responsivi e grafici che cambiano posizione senza sovrapporsi. Tutte le animazioni usano curve condivise in stile Apple.
5. **Ice Glass.** Molti esperimenti CSS e WebGL sono stati provati, confrontati e spesso annullati. La direzione approvata usa un canvas WebGL condiviso, risposta diretta al cursore, volume convesso a saponetta, rifrazione Snell/Fresnel, dispersione RGB e riflesso bianco vicino alla sorgente. Nessun alone, ritardo del cursore o sfondo dinamico.
6. **Diario e controlli.** Diario persistente locale, pagine trade/giornata, filtri, checklist, emozioni, screenshot ed export. Tutti i controlli selezionabili possono ricevere lo stesso vetro delle card con stesura dal clic, crescita del volume e luce interna dinamica.
7. **Portafoglio e Analisi.** Grafico di confronto compatto con selettori laterali, scala esplorabile e trade cliccabili. Edge Map con base semantica ritagliata e vetro animato solo sulla cella scelta.
8. **Lab recente.** Il tentativo di estendere il raggio luminoso dei pulsanti è stato pubblicato e poi ripristinato. La versione attuale conserva l'ottica originale e mantiene la luce interna sull'opzione attiva di Regola simulata, Campione e Rischio per trade.

## Decisioni attive

- Il micro movimento 3D della singola card è disattivato. Parola di riattivazione: \`jumpcard\`.
- La superficie delle card è trasparente, i contenuti restano opachi e leggibili.
- Il trasporto a fotoni sperimentale e i molti punti speculari sono inattivi.
- La fascia spettrale è rettilinea alla base e si deforma tramite i percorsi rifratti.
- La dispersione è 0,05; il corpo del vetro è 0,14; la risposta del cursore non usa inseguimento.
- Le selezioni persistenti seguono lo stato reale di checkbox e attributi ARIA.
- La luce sotto il vetro può spegnersi localmente e varia con \`abs(P&L)/saldo\` per i dati finanziari.
- Il Lab continua ad aprirsi su Uscita adattiva. Non cambiare il default senza una nuova richiesta.

## Richieste annullate o superate

- Bolla agganciata alla linea di perdita: ripristinata la forma originale.
- Prime varianti della sezione Operazioni e vari esperimenti di illuminazione CSS: annullati.
- Ricostruzione volumetrica con molti punti luminosi: salvata come esperimento, poi ritorno alla base \`7f42d25\` prima delle evoluzioni attuali.
- Fusione temporanea della base \`7f42d25\` con una variante RGB: annullata.
- Raggio esteso e luminosità minima dei pulsanti lontani: ripristinati.
- Cambio automatico del Lab da Uscita adattiva a Session focus: fermato e scartato.

## Come collaborare con l'utente

- Per richieste su screenshot: dire prima in quale sezione avverrà la modifica e riassumere in poche righe cosa si è capito.
- L'utente preferisce vedere il risultato pubblicato dopo ogni blocco completato.
- Se corregge la posizione o il significato di un elemento, fermare l'interpretazione precedente e verificare il componente preciso.
- Evitare modifiche collaterali: preservare esplicitamente ottica, layout, dati e colori non nominati.
- Risposte e aggiornamenti brevi. Un solo ciclo di test e una sola pubblicazione per blocco.
