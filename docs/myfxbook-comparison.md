# Confronto funzionale con Myfxbook

Fonti pubbliche consultate: [Features](https://www.myfxbook.com/features), [Forex Calculators](https://www.myfxbook.com/forex-calculators), [API](https://www.myfxbook.com/api). Il confronto riguarda funzionalità osservabili e documentate.

| Funzione | Stato in BlueSpherix | Dipendenza per il passo successivo |
| --- | --- | --- |
| Panoramica dei conti e confronto strategie | Portafoglio, curve e confronto già disponibili con dati demo | Bridge MT5 in sola lettura, conto e storico verificabili |
| Report mensile, statistiche direzionali, durata media | In Analisi. Solo trade chiusi, filtri per data, strumento, direzione e dettaglio per mese | Dati reali dal bridge |
| Esportazione conto | Il report filtrato si scarica in CSV e HTML o si salva via Stampa/PDF. Operazioni esporta già il registro | La preview usa il registro demo |
| Statistiche orarie, per strumento e sessione | Edge Map e riepiloghi già presenti | Magic number e rendimento in pip richiedono campi e specifiche strumenti nel ledger |
| Calcolatori Forex | Size, pip, margine, P&L, cambio manuale, interesse composto, drawdown, consistenza, pivot e Fibonacci | Quotazioni live e specifiche broker per tassi automatici, swap e costi reali |
| Calendario e avvisi | Calendario demo con filtri e fusi. Export ICS; gli eventi contrassegnati come programmati includono un promemoria a 15 minuti | Feed autorizzato per eventi live; consegna email o push richiede servizi e preferenze utente |
| Diario | Diario e note sui trade già disponibili nel browser | Account e storage per sincronizzazione e condivisione |
| Backtest | Lab simula scenari sul ledger; manca l’archivio dei report di Strategy Tester | Definire formati di importazione e persistenza |
| Watchlist, sistemi pubblici, verifica, widget e API | Mancanti come servizi pubblici | Backend, identità, permessi di condivisione e dati verificabili |
| Quotazioni, sentiment, spread broker e community | Mancanti | Sorgenti dati con licenza, account e moderazione per le parti sociali |

La piattaforma resta una preview statica alimentata da dati dimostrativi. I calcolatori funzionano localmente e usano i parametri inseriti. I report usano il risultato netto delle operazioni chiuse del registro Alpha Momentum, per data di chiusura UTC.
