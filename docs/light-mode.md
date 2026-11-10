# Light Mode Ice Glass

La modalità chiara riusa il renderer WebGL 2 globale di Ice Glass. Il tema è un
parametro del materiale: la modalità scura continua a usare la sorgente legata
al cursore e i valori precedenti; la modalità chiara usa una sorgente solare
direzionale sempre attiva, un ambiente più luminoso e una diversa calibrazione
di copertura, Fresnel e trasmissione.

## Profilo condiviso delle card

Tutte le `.glass-card`, `.demo-notice` e `.calendar-strip` riusano il profilo
della saponetta mostrata nell'avviso del calendario: spessore nominale di 12 px
e angoli di 28 px, limitati dalla dimensione della superficie. La sezione ottica
non cresce con l'altezza di grafici e tabelle: bordi e riflessi mantengono la
stessa scala sui pannelli grandi e sulle card compatte. Il raggio CSS viene
usato anche dalla SDF, mentre la CPU calcola l'altezza centrale con lo stesso
spessore del materiale. Layout, padding e dimensioni restano invariati.
Il labbro superiore lucidato viene disegnato nello stesso shader del volume,
con un riflesso asimmetrico sempre visibile. Avanza insieme al vetro, senza
lasciare un secondo contorno CSS sulla base. Questo accento non aggiunge ombre
esterne e non viene presentato come rifrazione o caustica.

La calibrazione riguarda solo le card in modalità chiara. Profilo scuro,
controlli selezionati e switch mantengono i parametri precedenti. Non vengono
aggiunti canvas, texture o dipendenze.

Verifica Chromium: 84 superfici in otto viste mantengono dimensioni e layout;
il confronto screenshot della modalità scura è identico. Controllati anche
1024×820 e 390×844 senza overflow. La regola per il movimento ridotto usa la
stessa specificità dell'hover, così sollevamento e filtro vengono disattivati.
Safari e prestazioni su GPU reale non sono stati verificati; SwiftShader è
un renderer software e non costituisce una misura della fluidità su hardware.

## Materiale e caustiche

Lo shader mantiene la stessa SDF arrotondata e lo stesso campo di altezza
convesso `soapSurface`. In Light Mode il quad di ogni card principale include
un piccolo overscan. I frammenti interni disegnano volume, rifrazione Snell,
Fresnel e dispersione; i frammenti esterni proiettano sul piano della dashboard
solo la caustica usando la stessa silhouette, la stessa direzione solare e la
stessa separazione RGB. Il contributo esterno non viene ritagliato dal DOM della
card e può quindi raggiungere lo spazio o una superficie vicina.
Le ombre proiettate sono rimosse sia dallo shader sia dal fallback CSS delle
card. Il compositing della caustica aggiunge luce in ogni canale, evitando
frange scure dovute alla copertura alfa dei canali meno intensi.

Il sollevamento è un valore continuo per card lungo l'asse Z, verso lo
spettatore: corsa di 48 px e distanza prospettica di 900 px. La proiezione
`900 / (900 - altezza)` espande solo il volume e il suo labbro attorno al centro
fisso della card, senza traslazioni X/Y, inclinazioni o trasformazioni del DOM.
In hover completo il vetro arriva al 105,63% della proiezione a riposo.
Testi, immagini, controlli e hit area rimangono sulla base. La stessa progressione
guida proiezione della luce e rifrazione; le caustiche restano sul piano
della dashboard. Con `prefers-reduced-motion` il valore resta a zero e il filtro
dinamico viene disattivato. Il ritorno usa la stessa proiezione inversa.

Verifica del movimento: otto viste in Chromium, rettangoli DOM di card, testi
e SVG invariati durante l'hover, avanzamento monotono e ritorno alla proiezione
iniziale. Le vecchie animazioni di sollevamento delle icone in Analisi e degli
avatar del Portafoglio sono disattivate solo nel tema chiaro. Confronto pixel
scuro identico a riposo e in hover; controllati anche movimento ridotto, fallback
senza WebGL, comandi del calendario e assenza di overflow a 1024 e 390 px.

## Rifrazione del contenuto DOM

Il browser non espone il contenuto DOM come texture al contesto WebGL senza
duplicarlo in un secondo renderer. Testi, controlli e immagini restano quindi
DOM reali. Il filtro SVG `feDisplacementMap` campiona questi pixel usando una
mappa inversa distinta per geometria, generata da `ice-glass-lens.ts`. I raggi
di osservazione quasi ortogonali attraversano entrambe le interfacce curve:
normali e spessore provengono dallo stesso `soapSample` dello shader, con indice
di rifrazione 1,5 e legge di Snell all'ingresso e all'uscita. L'intersezione con
la faccia inferiore è risolta con le derivate analitiche della superficie.

La deviazione aggiuntiva sulla base è la pendenza del raggio uscente moltiplicata
per la distanza del vetro: a distanza zero la mappa è identità. Nella zona
parassiale questo produce la relazione di ingrandimento `m = 1 / (1 - d / f)`;
la potenza locale dipende dalla curvatura, quindi le card larghe non si
comportano come lenti sferiche. L'ingrandimento e la deformazione crescono
insieme alla corsa di 48 px. La proiezione prospettica espande anche il campo
delle normali intorno allo stesso centro del volume, senza traslare il testo.

Per la leggibilità il modello è regolarizzato: spostamenti limitati a 18 px,
transizione verso l'identità sulla spalla radente e Jacobiano inverso limitato
prima della quantizzazione, per evitare inversioni o incroci dell'immagine.
La rifrazione propria dello spessore a riposo viene compensata per conservare
la leggibilità iniziale. Non è una simulazione completa della camera, della
riflessione totale interna o della dispersione RGB del testo: quest'ultima
resta nel materiale WebGL. È un campionamento raster non uniforme del DOM,
senza `scale()` del contenuto, duplicazioni o immagini statiche del testo.

La mappa viene generata una volta per geometria e conservata in una cache
limitata; nessun PNG viene rigenerato durante l'animazione. Il frame globale
aggiorna solo scala e proiezione del filtro quando cambiano. Ogni card mantiene
il proprio filtro anche durante il ritorno: spostare il cursore su una card
vicina non tronca la rifrazione precedente. Dimensioni, hit area, selezione e
controlli restano DOM reali; tema scuro, movimento ridotto e fallback non
applicano il filtro. Le risorse vengono eliminate al cambio vista, alla perdita
del contesto o allo smontaggio.

`npm run glass:check` verifica indice coincidente con l'aria, asse ottico,
potenza focale parassiale, simmetria, crescita dell'ingrandimento e assenza di
ripiegamenti anche dopo la quantizzazione della mappa.
Verifica raster in Chromium, su una card campione 400×134: a cinque distanze
crescenti i glifi reali passano da 14 a 16 px di altezza, un elemento HTML e
un'immagine da 38 a 42 px. I rettangoli DOM restano identici; verificati anche
selezione del testo, pulsante, disattivazione con movimento ridotto e ritorno
continuo all'identità. Questi valori dipendono dalla geometria del campione.

Riferimenti consultati: [formula del displacement SVG (MDN)](https://github.com/mdn/content/blob/main/files/en-us/web/svg/reference/element/fedisplacementmap/index.md),
[rifrazione dielettrica (PBRT)](https://github.com/mmp/pbrt-v4/blob/master/src/pbrt/util/scattering.h)
e [trasmissione volumetrica (Three.js)](https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js).

## Tema e fallback

Lo script `beforeInteractive` applica la preferenza salvata prima
dell'idratazione e in assenza di preferenza segue `prefers-color-scheme`. Il
toggle aggiorna `localStorage`, `color-scheme`, il colore del browser e il
renderer. Il fallback senza WebGL conserva superfici trasparenti chiare con
contrasto accessibile; layout e contenuto non vengono duplicati.

Il renderer mantiene un solo canvas e un solo frame pendente. In Light Mode il
backing store usa l'82% del DPR nominale per compensare i frammenti di overscan;
coordinate, geometria e lunghezze ottiche restano in pixel CSS.
