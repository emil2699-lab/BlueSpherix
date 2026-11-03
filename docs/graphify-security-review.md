# Graphify — controllo prima dell’installazione

Data: 2026-11-03.
Sorgente: https://github.com/Graphify-Labs/graphify
Commit controllato: `8e6a6d2129d4aeffc7a0e9ed79b153f7f057f42b` (branch `v8`).
Versione: `graphifyy 0.9.101`.

## Esito e ambito

Installata la skill Codex in `.agents/skills/graphify/`, con otto riferimenti upstream e licenza Apache-2.0. Runtime isolato in `/workspace/tools/uv/graphifyy/`; CLI `/workspace/bin/graphify`.

Controllati istruzioni della skill, riferimenti, manifest delle dipendenze, installatore e punti di esecuzione/rete. Scansione automatica dei 1.146 file UTF-8 del checkout per caratteri invisibili, controlli Unicode/bidirezionali, selettori di variazione, sequenze codificate, commenti HTML, stili che nascondono testo e alcune formule di sostituzione delle istruzioni. Questo è un controllo statico con verifica funzionale limitata, non una certificazione dell’intero progetto o dei binari delle dipendenze.

## Testo nascosto

Nessuna segnalazione nel corpo della skill Codex o negli otto riferimenti. Nel runtime `graphify/llm.py:638` compare un vero U+200B (ZERO WIDTH SPACE), esplicitamente documentato: viene inserito nei delimitatori ostili per neutralizzare prompt injection. Non contiene una frase nascosta. Le altre segnalazioni riguardano traduzione persiana, test di encoding/sicurezza, commenti HTML e CSS del visualizzatore; alcuni pattern CSS sono falsi positivi su dimensioni frazionarie. Nessuna istruzione malevola nascosta identificata nei file esaminati.

## Analisi statica del runtime

Bandit: 73.064 righe di codice, 134 segnalazioni (4 HIGH, 8 MEDIUM, 122 LOW), con due soppressioni upstream. Le quattro HIGH sono SHA-1 per MinHash/identificatori, non autenticazione o firme. Le MEDIUM riguardano parsing XML (cinque) e configurazione esplicita del listener HTTP (tre). Diversi parser XML bloccano DOCTYPE/ENTITY e limitano le dimensioni; il parser Maven in `manifest_ingest.py` usa ElementTree con limite del manifest di 2 MB, senza lo stesso filtro esplicito. Rimane un punto da considerare quando si analizzano manifest ostili. Il listener HTTP è opzionale; nessun listener è stato avviato.

La skill include istruzioni visibili per installare/aggiornare automaticamente `graphifyy`, e l’installatore può aggiungere hook e istruzioni permanenti. Per questa installazione sono stati copiati solo i file della skill: nessun hook, watcher, listener MCP o modifica globale degli assistenti. Una breve sezione locale in SKILL.md rimanda a INSTALLATION.md per usare il runtime controllato, evitare aggiornamenti automatici e richiedere una scelta esplicita dell’utente prima di inviare contenuti a backend semantici esterni. Gli otto riferimenti sono copie esatte upstream.

## Dipendenze e verifica

`pip-audit` sul runtime installato: 31 pacchetti controllati, nessuna vulnerabilità nota riportata dal servizio al momento del controllo. L’esito riguarda le versioni installate; non garantisce l’assenza di vulnerabilità sconosciute. Gli extra opzionali non sono stati installati.

Passati `graphify --version`, `graphify --help`, validatore locale delle tre skill e prova su un piccolo file TypeScript temporaneo: estrazione AST, costruzione grafo e clustering con 3 nodi, 3 archi e 1 comunità. Nessuna indicizzazione di BlueSpherix è stata avviata durante l’installazione.

Artefatti riproducibili in `/workspace/artifacts/graphify-security/`: scansione Unicode con hash dei file, script dello scanner, report Bandit, audit delle dipendenze e manifest SHA-256 dei file installati.
