# Confronto funzionale con Myfxbook

Il confronto copre la documentazione pubblica delle funzioni standard e le offerte a pagamento. [Funzioni](https://www.myfxbook.com/features) · [Calcolatori](https://www.myfxbook.com/forex-calculators) · [API](https://www.myfxbook.com/api) · [Sentiment Data](https://www.myfxbook.com/outlook-indicator) · [Ad-Free](https://www.myfxbook.com/ad-free-subscription)

| Funzione | Cosa si può usare in BlueSpherix | Dipendenza ancora aperta |
| --- | --- | --- |
| Report e statistiche | In Analisi, Edge Map e report mensile da posizioni MT5 chiuse riconciliate. Il report raggruppa per direzione, frequenza, durata, volume e tag del Diario, con CSV, HTML e Stampa/PDF. | Disponibilità e copertura dipendono dallo storico MT5 importato. |
| Risultato realizzato e periodo del conto | In Oggi il P&L cumulato del periodo usa le posizioni chiuse riconciliate, per data di chiusura UTC e al netto dei costi rilevati. Saldo ed equity sono quelli dell’ultima rilevazione. | Una curva storica dell’equity richiede una serie di rilevazioni. |
| Watchlist, gruppi e ricerca | Portafoglio permette di cercare i conti MT5 salvati, aggiungerli alla watchlist e raccoglierli in gruppi locali. | Conti verificati e ricerca sulla directory di altri utenti richiedono un servizio con identità e verifica. |
| Widget, profili e API | I dati dei conti sono privati nel browser. | Condivisione dei conti, link privati revocabili, accesso autenticato e quote API richiedono un backend. |
| Backtest | Il Lab importa e confronta report HTML di Strategy Tester salvati nel browser. Supporta le etichette inglesi e quelle italiane riconosciute. | La valuta è indicata quando presente nel file. Compatibilità con altre lingue e formati da convalidare con report del terminale. |
| Calcolatori Forex | Size, pip, margine, leva minima, P&L, cambio manuale, interesse composto, drawdown, rischio di rovina, consistenza, pivot, Fibonacci, rebate e rollover. | I valori di margine, conversione e costi dipendono dai parametri inseriti e dal broker. |
| Calendario e avvisi | Vista ufficiale USA dal calendario BEA, scelta del fuso, ricerca e download ICS con promemoria per le pubblicazioni future. Il calendario editoriale demo rimane selezionabile. | Copertura internazionale, consenso e valori effettivi richiedono un feed macro autorizzato. La consegna email e push in background richiede un servizio di invio. |
| Conto MT5 | Connettore locale in sola lettura con aggiornamento ogni 15 secondi, archivio privato nel browser e conti separati per valuta. Portafoglio, Oggi, Analisi, Operazioni e Rischio leggono il conto selezionato. Include saldo, equity, margine, ordini, posizioni, movimenti, Magic Number e statistiche delle posizioni riconciliate. | Restano la verifica indipendente, gli aggiornamenti cloud a terminale locale spento, la condivisione autenticata e i connettori per altre piattaforme. Le inversioni e i cicli incompleti si consultano come movimenti. |
| Mercati | Sessioni nei fusi dei centri finanziari e variazioni, cambi incrociati e correlazioni da tassi di riferimento giornalieri BCE via Frankfurter. Quotazioni bid/ask e spread sono disponibili da un feed broker fornito dall’utente. | I tassi BCE sono giornalieri. Quote di mercato in tempo reale, bid/ask e spread di più broker richiedono un feed di quotazioni. |
| Sentiment Data | Import e collegamento a feed HTTPS. Serie fino a 10.000 punti per strumento e intervallo, incluse risoluzioni settimanali e mensili. Quota, posizioni e lotti, storico esportabile e polling con pausa quando la pagina è nascosta. | Disporre dei dati Myfxbook, dell’Outlook Indicator in MT4/MT5 e della quota API premium richiede un abbonamento o un fornitore autorizzato e l’integrazione nel terminale. |
| Community e abbonamento Ad-Free | La preview è già priva di annunci. | La community richiede identità, persistenza e moderazione. Il piano web a pagamento non ha un equivalente necessario nella preview. |

## Collegamento MT5

Usa la [guida al connettore locale e all’importazione JSON](mt5-connection.md). [Integrazione Python di MetaTrader 5](https://www.mql5.com/en/docs/python_metatrader5)

## Contratto del feed di mercato

Il file JSON e l’endpoint HTTPS accettano lo stesso formato. L’endpoint deve consentire le richieste CORS dall’origine di BlueSpherix e può fornire solo una delle due serie lasciando vuoto l’altro array. Gli orari sono UTC. I conteggi sono interi e i lotti possono essere `null` quando assenti. Gli intervalli disponibili sono `15s`, `1m`, `1h`, `1d`, `1w` e `1mo`. Questo esempio illustra la struttura del file.

```json
{
  "version": 1,
  "source": "Nome del fornitore",
  "sentiment": [
    {
      "symbol": "EURUSD",
      "interval": "1d",
      "points": [
        { "time": "2026-10-28T12:00:00Z", "long": 60, "short": 40, "longLots": 8.5, "shortLots": 6 }
      ]
    }
  ],
  "quotes": [
    { "broker": "Broker", "symbol": "EURUSD", "time": "2026-10-28T12:00:00Z", "bid": 1.08, "ask": 1.0801, "pip": 0.0001 }
  ]
}
```

La preview usa l’export statico di Next.js su GitHub Pages. I servizi che gestiscono credenziali, permessi o consegna di notifiche richiedono un runtime separato. [Guida Next.js all’export statico](https://nextjs.org/docs/app/guides/static-exports)
