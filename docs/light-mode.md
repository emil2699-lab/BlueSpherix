# Light Mode Ice Glass

La modalità chiara usa lo stesso canvas WebGL 2 della modalità scura. La luce
naturale è ambientale e direzionale; il puntatore cambia l'altezza del vetro.
Il DOM, compresi testi, immagini e controlli, rimane sul piano della dashboard.
Non ci sono traslazioni, `scale()` del contenuto, ombre diffuse o glow esterni.

## Riferimenti consultati

Ricerca tecnica effettuata il 10 novembre 2026, prima di sostituire il rendering:

- [PBRT v4 — scattering.h](https://github.com/mmp/pbrt-v4/blob/master/src/pbrt/util/scattering.h):
  legge di Snell, orientamento delle normali, Fresnel e riflessione interna totale.
- [PBRT v4 — RealisticCamera](https://github.com/mmp/pbrt-v4/blob/master/src/pbrt/cameras.cpp):
  attraversamento delle interfacce di una lente spessa, curvatura, fuoco e distanza.
- [Evan Wallace — WebGL Water, renderer.js](https://github.com/evanw/webgl-water/blob/master/renderer.js):
  proiezione dei raggi su una superficie ricevente e rapporto tra area incidente e
  area proiettata per calcolare la concentrazione luminosa delle caustiche.
- [MDN — feDisplacementMap](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap),
  consultato attraverso il [sorgente ufficiale](https://github.com/mdn/content/blob/main/files/en-us/web/svg/reference/element/fedisplacementmap/index.md):
  convenzione del campionamento inverso e spazio colore del filtro SVG.

Il capitolo sul sito pbr-book.org non era accessibile dalla rete dell'ambiente;
sono stati letti i sorgenti ufficiali PBRT su GitHub. Le formule sono state
implementate nel progetto senza installare librerie o copiare i renderer esterni.

## Un modello condiviso di saponetta

`soapSurface` e il suo equivalente CPU `soapSample` descrivono il profilo convesso
continuo e le normali analitiche. La metà inferiore è il riflesso di quella superiore:
la saponetta ha due facce curve. `DAYLIGHT` definisce indice 1.5, spessore, distanza
dalla base e sollevamento massimo di 28 pixel CSS. La forma tiene conto delle
dimensioni effettive e del raggio di ogni card; la modalità scura conserva i propri
parametri e il suo shading precedente.

La riflessione dell'ambiente usa Fresnel e una finestra ampia e morbida. Il bordo
in trasmissione rimane dentro il materiale. Sono state eliminate le precedenti
bande esterne basate su una silhouette traslata e una modulazione cosinusoidale.

## Caustiche sul piano ricevente

Un reticolo di raggi attraversa la faccia superiore, incontra con una ricerca
limitata la faccia inferiore e viene nuovamente rifratto verso la base. Tre indici
vicini generano una dispersione RGB delicata; due direzioni solari vicine limitano
le singolarità del fuoco. Le perdite Fresnel sono applicate alle due interfacce.
I percorsi che non emergono verso la base non generano caustiche.

Il determinante del Jacobiano tra area incidente e area ricevente determina la
concentrazione. Dove i raggi convergono, aumenta la luce; dove divergono, il
contributo aggiuntivo si spegne. L'esposizione è calibrata per il compositing di
un'interfaccia chiara: non è una misura radiometrica assoluta.

Le proiezioni interne ed esterne appartengono allo stesso reticolo e allo stesso
piano. Un'unica texture condivisa riceve tutti i contributi, senza ritagliarli ai
rettangoli DOM delle singole card. Sollevando il vetro cambia il tratto finale del
raggio e quindi la posizione e il fuoco della proiezione. Non è simulata la
trasmissione attraverso una seconda card né un path tracing dell'intera stanza.

## Effetto lente sul contenuto

Il browser non fornisce il DOM come texture WebGL. I contenuti restano DOM reali;
un filtro SVG ne ricampiona la rappresentazione raster. Le mappe sono calcolate
per ogni geometria con raggi di vista che attraversano entrambe le facce curve.
Una mappa rappresenta il cammino nel vetro, l'altra il tratto d'aria aggiunto dal
sollevamento. La loro combinazione cambia durante l'interazione, senza catturare
il DOM, creare immagini del testo o rigenerare le mappe a ogni frame.

Nel campo centrale i raggi convergono verso l'asse: la posizione campionata sulla
base si avvicina al centro quando aumenta la distanza, ingrandendo il contenuto
osservato. L'ingrandimento dipende dalla curvatura e dalle proporzioni; una card
larga e poco curva ha meno potere ottico centrale di una piccola. Non è uno zoom
uniforme. Per leggibilità, i raggi radenti sono limitati dolcemente; a riposo il
filtro viene disattivato e durante il sollevamento entra progressivamente. Queste
sono approssimazioni dichiarate rispetto a una lente ottica completa. Il filtro
DOM non aggiunge dispersione cromatica al testo.

## Risorse, fallback e accessibilità

I percorsi della luce vengono precalcolati sulla GPU mediante transform feedback
una volta per geometria e conservati in una cache limitata a 24 forme. I frame
d'interazione aggiornano altezza e proiezione. Sono condivisi contesto, programmi,
framebuffer, texture delle caustiche e scheduler; nessun loop separato per card.
La texture delle caustiche usa il 65% della risoluzione del canvas; il canvas chiaro
usa l'82% del DPR nominale. Le lunghezze ottiche rimangono in pixel CSS.

Il renderer si ferma quando non ci sono variazioni, gestisce scroll, resize,
perdita e ripristino del contesto e libera le risorse al cleanup. Le mappe SVG
sono generate solo quando una card viene sollevata e poi riutilizzate. Il fallback
senza WebGL mantiene le superfici CSS; un errore di allocazione delle caustiche
mantiene il materiale di base. `prefers-reduced-motion` disattiva il sollevamento
e il filtro, mantenendo l'illuminazione naturale permanente. Testi e controlli
conservano semantica, selezione, layout e coordinate di interazione originali.

La preferenza tema è applicata prima dell'idratazione e memorizzata in localStorage.
Non sono state aggiunte dipendenze né skill. Restano da verificare Safari/macOS e
le prestazioni su GPU fisiche; Chromium headless usa SwiftShader.

## Verifica numerica

`node --no-warnings --experimental-strip-types scripts/check-daylight-optics.mjs`
controlla Snell, reversibilità, riflessione interna totale, asse ottico, simmetria
e aumento dell'ingrandimento al crescere della distanza, su due geometrie diverse.

## Risultati della verifica

- Lint e build di produzione superati; TypeScript senza errori. Il lint conserva
  un solo warning preesistente in `.agents/skills/validate-skills.mjs`.
- Shader WebGL compilati e linkati; nessun errore WebGL o runtime nei controlli
  desktop, mobile, calendario, cambio tema e ripristino del contesto.
- Il confronto diretto tra shader scuro precedente e attuale su una scena fissa
  restituisce zero differenze su 230.400 componenti RGBA.
- Bounding box della card e del testo identiche prima e dopo l'hover. Un'immagine
  di controllo 20×20 viene osservata come 20×22, conservando il proprio DOM 20×20.
- Confrontando riposo e sollevamento nella zona esterna alla card di controllo,
  634 pixel cambiano oltre la soglia di 2 livelli RGB: la proiezione varia anche
  sulla base circostante, senza applicare ombre.
- Verificati `prefers-reduced-motion` e fallback senza WebGL.
- Nel benchmark Chromium/SwiftShader a 1024×820, con movimenti continui simulati,
  p50 circa 367 ms, p95 circa 733 ms e un long task iniziale di 80 ms. Questo
  renderer software è lento: la fluidità richiesta su GPU fisiche resta da
  verificare e questi risultati non attestano 60 fps. Safari/macOS non è stato
  disponibile per la prova.

## Correzioni del debug del ciclo di rendering

Il controllo successivo ha riprodotto un filtro rimasto attivo dopo il passaggio
in tempo reale a `prefers-reduced-motion` e dieci disegni aggiuntivi delle caustiche
per un movimento del cursore a scena immobile. Ora il filtro viene azzerato anche
uscendo dalla card e perdendo il focus della finestra. L'animazione parte dal
momento dell'interazione e segue il tempo trascorso, senza salti dopo l'inattività
né rallentamenti artificiali sui frame lunghi.

La texture delle caustiche viene riutilizzata finché geometria, altezza, posizione,
dimensioni del buffer e DPR rimangono invariati. Il puntatore continua ad aggiornare
i riflessi. I cambiamenti di `--glass-lens` non innescano più un ciclo di misurazioni
layout. Le mappe RGBA8 usano un neutro rappresentabile esattamente per evitare uno
spostamento uniforme del contenuto. Le allocazioni WebGL mancanti e l'assenza di
Canvas 2D attivano il fallback; il cleanup delle risorse è idempotente.

`node scripts/check-daylight-runtime.mjs` verifica cache, invalidazione, sette
fallimenti di allocazione, asse neutro e fallback Canvas 2D. Impostando
`DAYLIGHT_URL` alla preview locale verifica anche cambio della preferenza di
movimento, perdita del focus, contenuto immobile e assenza di errori runtime.
Il test sulla dashboard ora conta zero disegni delle caustiche aggiuntivi nel
caso immobile riprodotto. Il benchmark SwiftShader riportato sopra precede queste
correzioni e non costituisce una misura della nuova cache o di una GPU fisica.

Il controllo visivo mobile ha inoltre individuato ripetizioni di lettere vicino
ai bordi: il campionamento poteva ripiegarsi, con un determinante locale minimo
negativo (-2,37 nella geometria di controllo). Le variazioni delle mappe DOM
sono ora regolarizzate tra campioni adiacenti; il minimo verificato è positivo
(0,59), anche controllando forme alte e strette o molto basse e larghe. Questo
limite serve alla leggibilità del contenuto raster, preserva l'asse ottico e non
modifica il calcolo dei raggi delle caustiche. È un'approssimazione dichiarata
rispetto alla rifrazione completa ai bordi critici.

Nella verifica finale dell'ingrandimento, l'immagine di controllo 20×20 viene
osservata come 20×24 durante il sollevamento; il suo elemento DOM e la card
conservano le coordinate e le dimensioni originali.
