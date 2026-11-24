# Confronto funzionale con Myfxbook

Il confronto copre la documentazione pubblica delle funzioni standard e le offerte a pagamento. [Funzioni](https://www.myfxbook.com/features) · [Calcolatori](https://www.myfxbook.com/forex-calculators) · [API](https://www.myfxbook.com/api) · [Sentiment Data](https://www.myfxbook.com/outlook-indicator) · [Ad-Free](https://www.myfxbook.com/ad-free-subscription)

| Funzione | Cosa si può usare in BlueSpherix | Dipendenza ancora aperta |
| --- | --- | --- |
| Report e statistiche | In Analisi, report mensile, direzione, frequenza, durata e volume per fascia, riepilogo e filtro per tag del Diario, CSV, HTML e Stampa/PDF. Le fasce usano la durata tra apertura e chiusura. I trade con più tag contribuiscono a ciascun tag. | Le viste generali usano il ledger demo. |
| Risultato realizzato e periodo del conto | In Oggi il P&L cumulato del periodo usa i trade chiusi per data di chiusura UTC, al netto dei costi. La data iniziale di Alpha Momentum è salvata in Analisi e applicata a KPI di periodo, grafico e report. Trade DNA rimane una misura dichiarata dell’intero storico. | Le curve degli altri conti demo usano serie mensili aggregate. |
| Watchlist, gruppi e ricerca | In Portafoglio si possono cercare i conti demo, aggiungerli alla watchlist e salvare i conti confrontati in gruppi locali. | Conti verificati e ricerca sulla directory di altri utenti richiedono un servizio con identità e verifica. |
| Widget, profili e API | Profili pubblici e codice widget per i conti demo. L’endpoint statico `api/v1/demo/accounts.json` restituisce solo il dataset demo versionato. | Condivisione di conti reali, link privati revocabili, accesso autenticato e quote API richiedono un backend. |
| Backtest | Il Lab salva i benchmark nel browser e importa report HTML di Strategy Tester con metriche confrontabili. Supporto per etichette inglesi e per le etichette italiane riconosciute. | La valuta è indicata quando presente nel file. Compatibilità con altre lingue e formati da convalidare con report del terminale. |
| Calcolatori Forex | Size, pip, margine, leva minima, P&L, cambio manuale, interesse composto, drawdown, rischio di rovina, consistenza, pivot, Fibonacci, rebate e rollover. | I valori di margine, conversione e costi dipendono dai parametri inseriti e dal broker. |
| Calendario e avvisi | Vista ufficiale USA dal calendario BEA, scelta del fuso, ricerca e download ICS con promemoria per le pubblicazioni future. Il calendario editoriale demo rimane selezionabile. | Copertura internazionale, consenso e valori effettivi richiedono un feed macro autorizzato. La consegna email e push in background richiede un servizio di invio. |
| Conto MT5 | L’esportatore locale in sola lettura alimenta la vista Dati MT5. Posizioni aperte, movimenti, Magic Number, data iniziale per conto, calcolo dei pip per posizioni semplici con dimensione pip specificata. I file aggiornati si possono seguire nei browser compatibili, con avviso in caso di errore e indicazione di dati obsoleti. | La verifica indipendente del conto e la sincronizzazione continua con il broker richiedono accesso a un conto e a un terminale. Esecuzioni parziali o inversioni restano consultabili come movimenti. |
| Mercati | Sessioni nei fusi dei centri finanziari e variazioni, cambi incrociati e correlazioni da tassi di riferimento giornalieri BCE via Frankfurter. Quotazioni bid/ask e spread sono disponibili da un feed broker fornito dall’utente. | I tassi BCE sono giornalieri. Quote di mercato in tempo reale, bid/ask e spread di più broker richiedono un feed di quotazioni. |
| Sentiment Data | Import e collegamento a feed HTTPS. Serie fino a 10.000 punti per strumento e intervallo, incluse risoluzioni settimanali e mensili. Quota, posizioni e lotti, storico esportabile e polling con pausa quando la pagina è nascosta. | Disporre dei dati Myfxbook, dell’Outlook Indicator in MT4/MT5 e della quota API premium richiede un abbonamento o un fornitore autorizzato e l’integrazione nel terminale. |
| Community e abbonamento Ad-Free | La preview è già priva di annunci. | La community richiede identità, persistenza e moderazione. Il piano web a pagamento non ha un equivalente necessario nella preview. |

## Esportazione MT5

`scripts/export-mt5-snapshot.py` si esegue sul computer compatibile con il pacchetto Python MetaTrader5, con il terminale già connesso. Usa esclusivamente API di lettura. Il nome passato a `--account` è l’etichetta locale. `--days` sceglie la profondità dello storico e `--pip` permette di specificare la dimensione effettiva del broker per ogni strumento. [Integrazione Python di MetaTrader 5](https://www.mql5.com/en/docs/python_metatrader5)

```sh
python scripts/export-mt5-snapshot.py --account "Conto MT5" --output conto.json --days 90 --pip EURUSD=0.0001
```

Il file è importabile in Dati MT5. Nei browser che supportano l’accesso ai file locali, “Segui file locale” controlla il file ogni 15 secondi mentre la pagina è visibile. L’esportatore va rieseguito sul computer del terminale per produrre un nuovo snapshot. Le credenziali rimangono nel terminale.

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
