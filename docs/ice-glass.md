# Ice Glass — prova nella sezione Oggi

## Rendering

Un solo canvas WebGL 2 trasparente e una sola sorgente in coordinate viewport.
Il puntatore aggiorna un riferimento e richiede il prossimo frame; nessuno state
React, easing o interpolazione delle coordinate. Il renderer riposa a mouse fermo.
Le altre sezioni mantengono il proprio stile.

`app/ice-glass.tsx` gestisce lifecycle, geometrie, scissor, DPR e recupero del
contesto. `app/ice-glass-shader.ts` disegna ora l'intera card con una SDF
arrotondata: normali del bisello che diventano gradualmente frontali, Snell per
tre indici RGB, Fresnel Schlick, speculare GGX, assorbimento e caustiche
deformate da una curvatura stabile a bassa frequenza. La superficie interna
riceve trasmissione e riflessi più diffusi. Nessuna texture dello screenshot.
I parametri sono in `app/ice-glass-config.ts`.

`app/ice-glass-transport.ts` proietta raggi nel piano delle card: intersezione
con una prima superficie, rifrazione all'ingresso e all'uscita, attenuazione
del percorso e fino a due passaggi prima della card ricevente. La card
successiva riceve una caustica centrata sulla direzione del raggio emergente.
È un'approssimazione 2.5D dello scambio luminoso tra card quasi complanari,
non un path tracer 3D. Per vedere i raggi, le normali e la larghezza dei fasci
in sviluppo, aprire `?iceGlassDebug=1#overview`; il livello di debug non viene
creato nella build di produzione.

L'ambiente ottico è procedurale. La rifrazione **non campiona il DOM**: testo,
icone, valori e grafici conservano il rendering HTML/SVG originale. Il modello
è un'approssimazione 2.5D, non un ray tracer di una lastra volumetrica.

ResizeObserver, scroll e cambi di visibilità invalidano le geometrie. Il canvas
non intercetta input; senza WebGL restano le card scure. Reduced motion mantiene
il materiale ambientale statico. Contesto, shader, programma, VAO, observer e
listener vengono gestiti e liberati nel lifecycle.

## Calibrazione visiva

Riferimento: le due immagini fornite nella conversazione, con priorità alla
versione senza annotazioni. Il layout originale resta invariato; le proporzioni
dei KPI sono quindi diverse dalle card ingrandite del riferimento.

| Iterazione | Differenza osservata | Correzione |
| --- | --- | --- |
| 1 | Bordo troppo sottile, energia attenuata dal compositing | Alpha premoltiplicato coerente, maggiore spessore e trasmissione |
| 2 | Discontinuità diagonale nel contributo interno | Orientamento ricavato dalla normale 3D del bisello |
| 3 | Perimetro opposto troppo acceso, rasterizzazione costosa | Riduzione del contributo non orientato, quattro fasce geometriche |
| 4 | Nucleo vicino troppo debole rispetto al riferimento | Fuoco bianco localizzato in funzione di sorgente e tangente al bordo |

La prima serie copre bordo sinistro, superiore, angolo, centro, spazio tra card,
distanza, scroll, resize, mobile e reduced motion in `/workspace/artifacts/ice-glass/`.
La correzione della superficie e del trasporto è documentata da un'altra serie
nelle medesime posizioni in `/workspace/artifacts/ice-glass-correction/`, con
`transmit.png`, `debug.png` e `results.json`.

Differenze residue: vetro ancora più levigato e regolare del riferimento;
microtexture e riflessioni interne soltanto approssimate; intensità dei colori
da confermare su un display macOS. Non è stata calcolata una percentuale affidabile di somiglianza:
le immagini di riferimento sono disponibili nel messaggio, non come file locale
allineato. Nessuna dichiarazione di fedeltà del 90%.

## Dispersione cromatica

La calibrazione successiva aumenta `chromaticDispersion` da 0,045 a 0,0765
(+70%). Sei fuochi spettrali separano rosso, arancione, giallo, ciano, blu e
viola lungo la normale ottica deformata; intensità e ampiezza restano legate
alla sorgente e al profilo del vetro. Lo stesso spettro alimenta le caustiche
che raggiungono una card successiva. Il nucleo bianco resta un contributo
separato. Screenshot nelle stesse posizioni in
`/workspace/artifacts/ice-glass-spectrum/`.

Confrontando `edge.png` con la versione precedente, la differenza media
normalizzata è 0,0267 nella fascia illuminata di 28×132 px e 0,0000038
nel centro di 120×40 px. A cursore lontano, l'RMSE globale è 0,00167.
Le differenze indicano una modifica localizzata della dispersione, non un
aumento uniforme della luce.

### Calibrazione organica successiva

La versione con sei colori prefissati è stata sostituita da tre canali rifratti,
come nella dispersione precedente. `chromaticDispersion` torna a 0,045; il
profilo delle frange passa da 0,12 a circa 0,15–0,168 unità di profondità
(+25–40% secondo la curvatura locale), senza aumentare la saturazione.
Una perturbazione spaziale stabile della normale e del cammino ottico incurva
gli highlights secondo incidenza e geometria; il fuoco bianco resta separato.
La trasmissione tra card continua a usare il raggio secondario attenuato.

Confronto visivo A/B/C: `ice-glass-correction/edge.png` (precedente),
`ice-glass-spectrum/edge.png` (sei bande) e
`ice-glass-organic/edge.png` (nuova versione); i ritagli sono in
`ice-glass-organic/comparison-abc.png`. La nuova acquisizione include angolo,
bordo, spazio tra card, distanza intermedia e cursore lontano. Il confronto
in immagine resta qualitativo perché la pagina di sviluppo introduce una
testata verticale di 393 px assente nelle due acquisizioni precedenti.

## Verifica

- Shader applicativo compilato/linkato in Chromium WebGL 2, errore GL 0.
- Nessun errore console; coordinate richieste e renderer coincidenti.
- Ripristino del contesto WebGL riuscito; fallback senza WebGL funzionante.
- Periodo del grafico e navigazione funzionanti; canvas nascosto nelle altre viste.
- Nessun overflow orizzontale a 390 px; acquisizione anche a 1024 px.
- TypeScript e build statico verificati; lint senza errori (warning preesistente
  nell'import `basename` del validatore delle skill).

Prestazioni: il test usa Chromium headless con ANGLE SwiftShader, quindi una GPU
simulata dalla CPU. La superficie continua e il trasporto secondario richiedono
circa 283 ms al p95 in questo ambiente; la precedente versione a sole fasce
richiedeva circa 217 ms. Il costo è aumentato perché viene disegnata tutta la
card. I dati esatti sono nel manifest `results.json`.
Queste misure **non dimostrano 60 FPS**: il test Safari/macOS con GPU reale resta
necessario per confermare fluidità, Retina e gestione del colore. I dati esatti
dell'ultima esecuzione sono nel manifest `results.json`.
