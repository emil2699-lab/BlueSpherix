# Ice Glass — prova nella sezione Oggi

## Rendering

Un solo canvas WebGL 2 trasparente e una sola sorgente in coordinate viewport.
Il puntatore aggiorna un riferimento e richiede il prossimo frame; nessuno state
React, easing o interpolazione delle coordinate. Il renderer riposa a mouse fermo.
Le altre sezioni mantengono il proprio stile.

`app/ice-glass.tsx` gestisce lifecycle, geometrie, scissor, DPR e recupero del
contesto. `app/ice-glass-shader.ts` ricostruisce il bordo con una SDF arrotondata:
normali del bisello, Snell per tre indici RGB, Fresnel Schlick, speculare GGX,
assorbimento e una caustica focalizzata dalla sorgente. Quattro fasce per card
evitano di rasterizzare il centro. Nessun alone esterno, nessuna texture dello
screenshot. I parametri sono in `app/ice-glass-config.ts`.

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

Le acquisizioni coprono bordo sinistro, superiore, angolo, centro, spazio tra
card, distanza, scroll, resize, mobile e reduced motion. Sono salvate fuori dal
repository in `/workspace/artifacts/ice-glass/`, con `final.png` e `results.json`.

Differenze residue: vetro più levigato e regolare del riferimento; meno
microtexture e riflessioni interne; intensità dei colori da confermare su un
display macOS. Non è stata calcolata una percentuale affidabile di somiglianza:
le immagini di riferimento sono disponibili nel messaggio, non come file locale
allineato. Nessuna dichiarazione di fedeltà del 90%.

## Verifica

- Shader applicativo compilato/linkato in Chromium WebGL 2, errore GL 0.
- Nessun errore console; coordinate richieste e renderer coincidenti.
- Ripristino del contesto WebGL riuscito; fallback senza WebGL funzionante.
- Periodo del grafico e navigazione funzionanti; canvas nascosto nelle altre viste.
- Nessun overflow orizzontale a 390 px; acquisizione anche a 1024 px.
- TypeScript e build statico verificati; lint senza errori (warning preesistente
  nell'import `basename` del validatore delle skill).

Prestazioni: il test usa Chromium headless con ANGLE SwiftShader, quindi una GPU
simulata dalla CPU. Dopo l'ottimizzazione il p95 è circa 217 ms contro 483 ms nella
prima acquisizione; il gestore del puntatore richiede circa 0,3 ms al p95.
Queste misure **non dimostrano 60 FPS**: il test Safari/macOS con GPU reale resta
necessario per confermare fluidità, Retina e gestione del colore. I dati esatti
dell'ultima esecuzione sono nel manifest `results.json`.
