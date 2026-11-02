# Diario

La voce Diario apre `#journal`. Le revisioni dei trade condividono l'editor e l'archivio con il tab Diario di Operazioni, tramite ID del ledger. Il ledger demo non viene modificato dalle annotazioni personali.

## Funzioni

- Periodi 30G/90G/1A, ricerca in ID, strumenti, setup, note, tesi, lezioni e tag.
- Filtri per revisione, strumento, risultato, emozione e tag; paginazione di 12 trade.
- Tesi iniziale, osservazioni, lezione, stato emotivo, errore, valutazione 1–5, tag e checklist.
- Stato revisionato indipendente dal risultato economico; copertura, qualità media e errore più frequente calcolati sul periodo selezionato.
- Pagine giornaliere, anche senza trade, selezionabili dal calendario personalizzato. Il risultato della giornata somma il risultato corrente dei trade aperti in quella data; include il flottante.
- Screenshot PNG/JPEG reali, visualizzabili e rimovibili: massimo 3 da 750 KB per revisione.
- Esportazione JSON delle revisioni salvate dei trade filtrati oppure di tutte le pagine giornaliere, inclusi gli allegati. Le bozze non salvate non sono esportate.

## Stile condiviso

Periodo ed esportazione usano gli stessi controlli di Operazioni. Filtri, ricerca, tag e azione di salvataggio riutilizzano le classi condivise; nessun override generale del font dei pulsanti. I riepiloghi seguono misure, badge e gerarchia dei KPI delle altre sezioni. Trade/Giornate usa un indicatore scorrevole con le curve Apple comuni e rispetta reduced motion. Su mobile i controlli mantengono aree di interazione adeguate.

## Persistenza

`localStorage["bluespherix.journal.v1"]` conserva le revisioni esplicitamente salvate. Un errore di accesso, archivio corrotto o quota esaurita viene mostrato senza dichiarare un salvataggio riuscito. Gli aggiornamenti da altre schede vengono riletti attraverso l'evento `storage`; ogni scrittura rilegge l'archivio per non eliminare revisioni di altri trade.

Le bozze restano in memoria durante cambi di trade, filtri e sezione nella stessa sessione. Per conservarle dopo il reload usare **Salva revisione**. Non esiste sincronizzazione cloud o collegamento MT5 attivo.

## Verifica

Build, lint, TypeScript e `npm run data:check`. Test funzionali:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/check-journal.mjs
```

Il test richiede una preview su `http://127.0.0.1:3001/` (modificabile con `JOURNAL_URL`) e Chromium (`CHROMIUM_PATH`). Usa un contesto browser isolato e verifica persistenza, bozze, condivisione con Operazioni, screenshot, giornate, export, ricerca, paginazione, responsive e salvataggio negato. Gli screenshot interni vengono salvati in `/tmp/bluespherix-journal-check`, modificabile con `JOURNAL_ARTIFACTS`.
