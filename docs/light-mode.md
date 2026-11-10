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
spettatore: corsa di 16 px e distanza prospettica di 900 px. La proiezione
`900 / (900 - altezza)` espande solo il volume e il suo labbro attorno al centro
fisso della card, senza traslazioni X/Y, inclinazioni o trasformazioni del DOM.
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
DOM reali. Durante l'hover un filtro SVG `feDisplacementMap` sposta i pixel
renderizzati usando `public/ice-glass-normal-map.png`, un campo di normali
derivato da una calotta convessa continua. La scala e il piccolo offset del
campo seguono sollevamento e posizione del cursore.

Questa è una rifrazione raster del contenuto basata sulle normali simulate; non
è un campionamento WebGL del DOM né un path tracing del testo. La dispersione
RGB fisica resta nello shader del materiale, mentre il filtro del contenuto usa
un solo campione per contenere il costo e preservare la leggibilità.

## Tema e fallback

Lo script `beforeInteractive` applica la preferenza salvata prima
dell'idratazione e in assenza di preferenza segue `prefers-color-scheme`. Il
toggle aggiorna `localStorage`, `color-scheme`, il colore del browser e il
renderer. Il fallback senza WebGL conserva superfici trasparenti chiare con
contrasto accessibile; layout e contenuto non vengono duplicati.

Il renderer mantiene un solo canvas e un solo frame pendente. In Light Mode il
backing store usa l'82% del DPR nominale per compensare i frammenti di overscan;
coordinate, geometria e lunghezze ottiche restano in pixel CSS.
