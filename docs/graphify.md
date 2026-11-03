# Graphify per BlueSpherix

Skill locale: `.agents/skills/graphify/SKILL.md`.
Versione controllata: 0.9.101, commit `8e6a6d2129d4aeffc7a0e9ed79b153f7f057f42b`.

## Comandi

Dal repository:

```sh
npm run graph:build
npm run graph:query -- "PortfolioChart"
npm run graph:status
```

La build aggiorna il grafo del codice, crea il rapporto e la visualizzazione in `graphify-out/`. Le build successive sfruttano cache e rilevamento delle modifiche. La cartella generata è esclusa da Git. Sono rispettate le esclusioni di Git e aggiunte esclusioni per skill, configurazione Codex, lockfile npm e file Next generati.

Le query chiedono un budget indicativo di 1.500 token a Graphify. Poiché il motore può superarlo per mantenere tutti gli archi, il wrapper limita anche l’anteprima a 6.000 caratteri, segnala il taglio e salva il risultato completo in `graphify-out/last-query.txt`. Il limite in caratteri non equivale a un conteggio esatto dei token.

Il wrapper disabilita backend LLM e aggiornamenti automatici. Documenti e immagini non ricevono analisi semantica in questa configurazione; CSS e shader incorporati possono avere copertura limitata rispetto ai simboli TypeScript. Le comunità mantengono etichette automatiche. Il rapporto mostra il costo dell’estrazione, non i token usati dall’assistente in chat.

Per le domande strutturali consulta il grafo prima di leggere interi file. Usa nomi di simboli presenti nel codice (per esempio PortfolioChart): il motore non traduce automaticamente la domanda italiana. Conferma le modifiche sui sorgenti originali e rigenera il grafo dopo un blocco di lavoro. Una ricerca semplice può essere più economica del grafo per un singolo dettaglio.

Il runtime cloud è `/workspace/bin/graphify`; su un altro ambiente il percorso può essere indicato con `GRAPHIFY_BIN`. Se manca, lo script termina senza scaricare pacchetti. Non sono attivati hook o processi permanenti. Per leggere i dettagli del controllo preliminare consulta `graphify-security-review.md`.
