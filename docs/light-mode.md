# Light Mode Ice Glass

La modalità chiara riusa il renderer WebGL 2 globale di Ice Glass. Il tema è un
parametro del materiale: la modalità scura continua a usare la sorgente legata
al cursore e i valori precedenti; la modalità chiara usa una sorgente solare
direzionale sempre attiva, un ambiente più luminoso e una diversa calibrazione
di copertura, Fresnel e trasmissione.

## Materiale e caustiche

Lo shader mantiene la stessa SDF arrotondata e lo stesso campo di altezza
convesso `soapSurface`. In Light Mode il quad di ogni card principale include
un piccolo overscan. I frammenti interni disegnano volume, rifrazione Snell,
Fresnel e dispersione; i frammenti esterni proiettano sul piano della dashboard
la caustica usando la stessa silhouette, la stessa direzione solare e la stessa
separazione RGB. Non viene aggiunta un'ombra diffusa sotto le card. Il contributo
esterno non viene ritagliato dal DOM della card e può quindi raggiungere lo
spazio o una superficie vicina.

Il sollevamento è un valore continuo per card. Modifica insieme distanza della
proiezione, fuoco della caustica e normale ottica. Il contenitore DOM resta
immobile: testo, immagini e controlli appartengono alla base, mentre il vetro
comunica l'altezza attraverso il sistema ottico. Con `prefers-reduced-motion` il
valore resta a zero e il filtro dinamico viene disattivato.

## Rifrazione del contenuto DOM

Il browser non espone il contenuto DOM come texture al contesto WebGL senza
duplicarlo in un secondo renderer. Testi, controlli e immagini restano quindi
DOM reali. Durante l'hover un filtro SVG `feDisplacementMap` sposta i pixel
renderizzati usando `public/ice-glass-normal-map.png`, un campo di normali
derivato da una calotta convessa continua. La scala segue il sollevamento e la
posizione del cursore, senza traslare il contenuto della card.

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
