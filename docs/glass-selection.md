# Rivestimento vetroso della selezione

I controlli selezionabili nelle sezioni della dashboard usano lo stesso canvas e lo stesso shader delle card. `app/glass-selection.ts` gestisce una selezione temporanea per i controlli esclusivi e selezioni persistenti per i controlli multipli. I controlli comprendono periodi, viste, righe, celle, opzioni, menu, checkbox e radio. I pulsanti di azione (esportazione, salvataggio) e la navigazione laterale esterna al canvas mantengono il proprio comportamento.

### Multiselezione

Checkbox, tag e gruppi di pulsanti indipendenti marcati `data-glass-multiple`
restano rivestiti mentre il loro stato funzionale è attivo. Click fuori, Escape
e selezione di altri elementi non li rimuovono; la deselezione del singolo
controllo dissolve soltanto quel rivestimento. I valori già attivi vengono
rappresentati direttamente con il vetro, anche al ritorno in una sezione. Il
clic continua invece ad avviare stesura e crescita dal punto premuto.

L'osservazione degli stati ARIA, dei checkbox e del montaggio dei componenti
elimina i rivestimenti obsoleti quando cambia una revisione o un filtro. Ogni
selezione mantiene la propria luce interna; il pass esistente sui bordi vicini
usa la selezione attiva più recente. Le animazioni condividono un solo canvas
e un solo scheduler. `scripts/check-glass-multiselect.mjs` copre queste interazioni.

In **Oggi**, anche le righe delle posizioni aperte sono pulsanti nativi rivestibili, raggiungibili con Tab e selezionabili con Space/Invio. Prima erano blocchi `div` statici, mentre il periodo del grafico era già collegato. La selezione è soltanto visiva: non cambia dati o apre operazioni. Il negativo mantiene materiale e riflessi tinti di rosso. Il controllo specifico è `scripts/check-glass-selection-today.mjs` (stesse variabili della suite generale).

Nella **Edge Map** di Analisi tutte le celle sono registrate come superfici del
canvas condiviso. La base semantica resta visibile a riposo su uno strato
separato, ritagliato con un raggio di 24 px che segue la sagoma ottica a
saponetta. Quando una cella viene selezionata, scompare soltanto questa base e
resta il vetro animato. La potenza della luce confronta il valore assoluto con
il massimo della mappa corrente: zero spento, valori non nulli dal 25% e massimo
al 100%. Profitti e perdite equivalenti hanno la stessa potenza e conservano
rispettivamente tinta acqua e rossa.

### Luce sotto il vetro, tutte le sezioni

I controlli selezionati di tutte le sezioni ricevono una luce interna diffusa mentre il volume cresce. Due campi noise con una dimensione temporale indipendente fanno nascere, attenuare e spegnere completamente i punti luminosi sul posto: nessuna direzione di scorrimento fissa. Le normali e i riflessi esistenti rimangono invariati. Le parti soffuse conservano il colore del materiale; le creste più intense tendono gradualmente al bianco. Il contributo rimane entro la sagoma e sfuma prima del bordo, senza bloom, aloni esterni o cambi di opacità. La saturazione e la radiance della sola luce interna sono aumentate del 15%, mantenendo tinta, spegnimento locale e progressione dei picchi verso il bianco. Le card vicine possono ricevere soltanto sui bordi un contributo secondario della selezione luminosa, senza aloni nello spazio vuoto.

Per le posizioni di Oggi e Rischio e i trade di Operazioni e Diario, `positionUnderlight(result, balance)` usa `abs(result) / balance`: il tetto luminoso parte dal 25% del massimo fino allo 0,1% del saldo, cresce linearmente fino al massimo al 3%, poi rimane costante. Un risultato zero o un saldo non valido spengono il contributo. La stessa scala vale per profitti e perdite; il colore resta quello originale. Questa scala controlla il tetto, non il minimo temporale: ogni punto può sempre spegnersi. I picchi diventano più bianchi in funzione dell'intensità effettiva dopo la scala P&L. Gli altri controlli non finanziari mantengono il tetto standard.

La luce secondaria usa un'approssimazione di area luminosa in 2.5D: ogni frammento ricevente campiona lo stesso campo emittente della selezione, nel punto più vicino della sua superficie interna. Nessun noise indipendente sulle card riceventi. Il contributo si attiva gradualmente sopra il 35% dell'intensità massima, è filtrato dalla tinta della sorgente e si attenua come `1 / (1 + (d / 90px)^2)`, con un massimo di radiance 0,0805 (0,07 × 1,15). Resta nei primi 26 px interni del bordo ricevente. La card contenente il controllo non riceve luce secondaria da se stessa. Non è un ray tracer con occlusione o rimbalzi multipli: non sostituisce l'ottica dei riflessi e non modifica alpha o geometria. Una sola selezione emette; durante l'uscita il contributo si dissolve insieme al rivestimento.

Il renderer condiviso aggiorna il moto a circa 30 fps a riposo, senza ritardare gli eventi del puntatore. La deselezione dissolve anche la luce e arresta il loop; pagina nascosta, perdita del contesto e smontaggio cancellano il timer. Reduced motion mantiene la luce ferma. Lo sfondo non viene animato. Verifica: `scripts/check-glass-underlight.mjs`, con catture temporali, copertura delle sette sezioni, reset durante la navigazione, scala P&L tra le viste, arresto del loop e mobile/reduced motion. `node --experimental-strip-types scripts/check-underlight-scale.mjs` verifica soglie, limite e simmetria dei segni. `scripts/check-underlight-optics.mjs` esegue il GLSL di produzione in framebuffer float: spegnimento e riaccensione dello stesso punto, continuità, colore, decadimento sulla card lontana, clipping ai bordi e alpha invariato.

### Trasporto interno sulla spalla curva

La luce della selezione raggiunge anche la propria spalla convessa. Il frammento traccia il cammino inverso dall'osservatore ortografico: rifrazione aria-vetro, intersezione con il volume chiuso `±soapSurface`, rifrazione vetro-aria e campionamento della sorgente diffusa sotto il materiale. Il piano emittente si trova a `z = -1,6 × spessore` e usa lo stesso campo luminoso, colore, tempo e tetto P&L della superficie centrale. Il campionamento rifratto può comprimere, allargare o spostare le zone luminose sul raccordo.

Ogni interfaccia usa Snell e Fresnel non polarizzato, compreso l'angolo critico. L'energia riflessa prosegue fino a due riflessioni interne; l'energia trasmessa contribuisce solo se raggiunge il piano emittente entro la sagoma. Beer-Lambert attenua ogni segmento in funzione della lunghezza effettiva nel vetro. Il risolutore combina Newton con un intervallo di bisezione e usa le normali analitiche del medesimo volume convesso. Il volume cresce con la fase di lievitazione della selezione.

La transizione dal contributo diffuso centrale al trasporto ottico segue l'inclinazione locale della superficie. Non somma due volte la stessa luce e non amplifica la radiance con un moltiplicatore di curvatura: alcune parti della spalla diventano più luminose, altre più scure. Le zone soggette a riflessione interna totale possono rimanere scure; non è previsto un contorno uniformemente acceso. Il limite della sorgente resta quello approvato (+15%). Alpha, sagoma, riflesso RGB del cursore e contributo alle card vicine rimangono invariati.

È un modello di ottica geometrica in 2.5D, con un numero limitato di cammini speculari; non include diffusione volumetrica o una simulazione ondulatoria. `scripts/check-underlight-rim.mjs` verifica in GPU le intersezioni durante la crescita, Fresnel al 4% a incidenza normale per IOR 1,5, riflessione interna totale, conservazione della radiance, redistribuzione e continuità temporale, clipping, alpha e identità del materiale senza luce interna. La suite browser verifica anche che luce e bordo restino agganciati alla selezione durante lo scroll.

## Materiale e sequenza

- Il punto del clic viene memorizzato nelle coordinate locali del controllo. Tastiera e scelte da popup rimossi usano il centro del trigger rimasto visibile.
- **Stesura, 280 ms:** il vetro lucido piatto si espande circolarmente dal clic. Il raggio è calcolato in pixel CSS fino all'angolo più lontano; non viene deformato dal rapporto larghezza/altezza del controllo.
- **Volume, 360 ms:** solo dopo la copertura completa crescono altezza e gradiente del campo `soapSurface`, fino al volume a saponetta. Normali, Snell e Fresnel seguono la superficie crescente. Il DOM non viene scalato, spostato o reso trasparente.
- La tinta deriva dallo stile originale del controllo dopo il commit React, leggendo il colore di destinazione delle transizioni CSS. Un piccolo parser 2D legge anche colori CSS `color(srgb ...)`, una volta per selezione. Tinta del materiale e riflessi vengono filtrati rispettivamente in modo più evidente e più leggero, mantenendo la dispersione RGB.
- Non vengono aggiunti contorni o ombre di selezione. Le cornici di selezione CSS precedenti sono rimosse; gli indicatori piatti dei tab vengono nascosti quando quel gruppo è rivestito. Gli outline di focus da tastiera rimangono disponibili.
- I trade negativi conservano la tinta rossa anche nello stile piatto selezionato, senza ereditare il riempimento acqua delle righe positive.
- Per i controlli esclusivi, altro controllo o click fuori avviano una dissolvenza in 200 ms, congelando copertura e volume correnti anche se l'ingresso non è ancora terminato. Escape rimuove quel rivestimento; le multiselezioni restano attive. Space/Invio funzionano con i pulsanti nativi.
- I valori rimangono impostati dopo la deselezione visiva. Toggle, tag o checkbox disattivati non rimangono rivestiti.
- Nei menu personalizzati e nei calendari il rivestimento rimane sul trigger dopo la scelta.
- Un solo contesto WebGL; un canvas 2D non montato serve soltanto a leggere i colori. Geometrie riutilizzate durante l'animazione; l'ingresso si ferma a volume completo, mentre la luce interna mantiene il proprio ritmo lento se il movimento è consentito. Observer, timer e attributi vengono puliti allo smontaggio e durante la navigazione.
- Reduced motion applica direttamente il volume finale. Senza WebGL viene usato un rivestimento CSS statico discreto nella stessa tinta, senza ritagliare o animare il contenuto.

Lo shader riceve `uCoating = (coverage, isControl, opacity, volume)` e `uCoatingOrigin = (localX, localY)`. Le card esistenti usano `(1, 0, 1, 1)`: nessuna modifica ai loro parametri ottici. Il confronto in framebuffer float con cinque posizioni della sorgente ha restituito una differenza massima di 7.46e-9 (precisione numerica).

I selettori segmentati compatti e gli switch fisici ricevono anche `uControlLight = (620, .25)`: la distanza ottica segue il cursore fino a 372 px, poi si assesta gradualmente a 620 px. Oltre questo limite l'attenuazione resta al 25% e l'angolo d'incidenza mantiene un'altezza finita, conservando riflessi e spalla 3D. Anche la concentrazione tangenziale della fascia riflessa mantiene un minimo graduale del 35%, così una sorgente lontana in diagonale non spegne tutti i bordi dei controlli piccoli. La direzione continua a seguire il cursore; sia il raggio locale sia quello di riferimento Snell usano lo stesso limite. Le altre superfici ricevono `(0, 0)` e conservano l'attenuazione originale. Uscita del puntatore e reduced motion mantengono il comportamento esistente.

## Verifica

Le celle di correlazione trasferiscono allo shader anche la tinta del proprio
pseudo-elemento di superficie. Durante il rivestimento quel livello piatto viene
nascosto: il raggio più stretto della sua sagoma non può più sporgere dagli angoli
del vetro. Alla deselezione ricompare lo stile originale.

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/check-glass-selection.mjs
```

Preview predefinita `http://127.0.0.1:3001/`, modificabile con `GLASS_SELECTION_URL`; `CHROMIUM_PATH` e `GLASS_SELECTION_ARTIFACTS` sono opzionali. Il test verifica rivestimento, trasferimento, click fuori, righe negative, toggle, tastiera, menu, navigazione, mobile, contesto unico, reduced motion e fallback senza WebGL. Le fasi controllate verificano punto del clic, stesura con volume zero, copertura completa prima della crescita, tinta originale, assenza di cornici e checkbox. Gli artefatti includono screenshot e misure p50/p95. I frame time SwiftShader servono al confronto locale e non rappresentano la GPU di Safari/macOS; Safari non è disponibile nell'ambiente cloud.
