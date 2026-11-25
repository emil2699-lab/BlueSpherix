# Collegare MetaTrader 5 a BlueSpherix

## Sincronizzazione locale

Sul PC Windows che esegue MT5, apri il terminale e accedi al conto da monitorare.
Usa Python 3.11 o successivo a 64 bit e scarica [l’esportatore BlueSpherix](https://raw.githubusercontent.com/emil2699-lab/BlueSpherix/first/scripts/export-mt5-snapshot.py).

```powershell
py -m pip install MetaTrader5
py export-mt5-snapshot.py --account "Il mio conto" --serve
```

Apri [Conti MT5](https://emil2699-lab.github.io/BlueSpherix/#mt5) nello stesso PC, inserisci il codice stampato nel terminale e scegli **Collega connettore**. Se il browser chiede di consentire l’accesso alla rete locale, concedilo a questa pagina per raggiungere il connettore.

Il connettore interroga il terminale ogni 15 secondi. La pagina legge l’ultimo risultato mentre è visibile. In caso di interruzione conserva l’ultima rilevazione con la sua ora. Il codice vale fino alla chiusura del connettore e va reinserito se ricarichi la pagina. Per cambiare il conto collegato, arresta il connettore, cambia conto in MT5 e riavvialo. I conti già importati restano disponibili in Portafoglio.

Puoi specificare `--terminal "C:\Program Files\MetaTrader 5\terminal64.exe"` se hai più installazioni e `--days 90` per scegliere la finestra di storico. Per calcolare i pip aggiungi, per esempio, `--pip EURUSD=0.0001` usando i simboli e il valore pip del broker.

## Apertura locale della dashboard

Se il browser blocca il collegamento della preview a `127.0.0.1`, puoi aprire la dashboard sullo stesso indirizzo del connettore. Dalla copia del repository sul PC Windows, con Node.js 24 installato, esegui questi comandi. Usa l’output di una build locale, senza la variabile `GITHUB_ACTIONS`, così la dashboard viene servita alla radice.

```powershell
npm ci
npm run build
py scripts/export-mt5-snapshot.py --account "Il mio conto" --serve --dashboard out
```

Apri [la dashboard locale](http://127.0.0.1:8765/#mt5) e inserisci il codice. La preview e la dashboard locale hanno archivi separati nel browser.

Da un Mac puoi usare lo stesso indirizzo se hai già accesso SSH al PC Windows. Avvia lì il connettore con `--dashboard out`, quindi apri un tunnel dal Mac con `ssh -N -L 127.0.0.1:8765:127.0.0.1:8765 utente@pc-windows` e lascia la sessione aperta. Puoi anche importare il JSON manualmente da un altro dispositivo.

## Importazione e dati disponibili

Per esportare un file singolo usa questo comando sul PC con MT5, poi carica il JSON tramite **Conti MT5** su qualsiasi browser supportato. La funzione **Segui file locale** è disponibile nei browser che offrono il selettore di file persistente.

```powershell
py export-mt5-snapshot.py --account "Il mio conto" --output mt5.json
```

- **Portafoglio** conserva più conti, distingue reale, demo e contest quando il terminale lo indica e raggruppa saldo ed equity per valuta.
- **Oggi**, **Operazioni**, **Analisi** e **Rischio** usano il conto selezionato. Le inversioni e i cicli di posizione incompleti restano nel registro movimenti e sono esclusi dalle statistiche sulle posizioni chiuse.
- I vecchi file v1 rimangono leggibili. La classificazione del conto, il margine e gli ordini sono disponibili nei file v2.
- Il connettore ascolta soltanto su `127.0.0.1:8765`. Le letture richiedono il codice, trasmesso nell’intestazione della richiesta. L’app conserva gli snapshot in IndexedDB su quel browser. Usa **Rimuovi conto** per cancellare lo snapshot locale.
- Le credenziali e l’esecuzione degli ordini restano in MetaTrader. Il collegamento è locale, con un terminale attivo per connettore e senza un servizio cloud che aggiorni i conti a PC spento.
