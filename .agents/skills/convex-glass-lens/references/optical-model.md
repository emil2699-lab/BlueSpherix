# Modello ottico minimo

## Superficie

Modella la card come una rounded box con due calotte convesse continue. Il profilo deve fornire almeno altezza `h(x,y)` e gradiente `(dh/dx, dh/dy)`. La normale superiore è:

`N = normalize(-dh/dx, -dh/dy, 1)`

Per BlueSpherix riusa `soapSample()` in `app/ice-glass-volume.ts`: la mappa DOM e il materiale WebGL devono condividere la stessa superficie, altrimenti bordo e rifrazione sembrano scollegati.

## Rifrazione

Usa Snell a entrambe le interfacce aria-vetro e vetro-aria. Un punto iniziale credibile per vetro chiaro è `IOR = 1.49`. La direzione trasmessa dipende dalla normale; l'offset sul piano sottostante cresce con la distanza tra lente e base.

La mappa di spostamento deve codificare l'offset inverso di campionamento. Con SVG, `feDisplacementMap` usa:

`P'(x,y) = P(x + scale * (X(x,y) - 0.5), y + scale * (Y(x,y) - 0.5))`

Codifica zero come `0.5` esatto e imposta `color-interpolation-filters="sRGB"`; il valore neutro interpretato in linear RGB produce una deriva costante.

## Avanzamento e lente

Usa una sola altezza:

`z = lift * zMax`

La proiezione prospettica del guscio è:

`projection = perspective / (perspective - z)`

La lente convessa con oggetto entro la focale produce un'immagine virtuale diritta. La magnifica di controllo è:

`magnification = focalLength / (focalLength - z)`

Questa formula serve come limite di calibrazione. La deformazione reale deve continuare a provenire dalle normali e dalla rifrazione; non applicare `magnification` al contenuto DOM.

Se la discretizzazione della superficie rende la magnifica troppo debole, aggiungi alla mappa inversa un termine paraxiale limitato, `offset = (1 / magnification - 1) * position`, e sommalo all'offset prodotto dalle normali. Il DOM resta invariato e la derivata della mappa deve rimanere positiva per evitare pieghe.

## Fresnel e bordo

Per un dielettrico:

`F0 = ((1 - IOR) / (1 + IOR))²`

e con Schlick:

`F = F0 + (1 - F0) * (1 - dot(N,V))⁵`

Il bordo radente riflette più del centro. Usa questa crescita per la spalla ottica e i riflessi, mantenendo il centro trasmissivo.

## Ombra dalla stessa altezza

Con luce puntiforme o area light in `(Lx, Ly, H)` e centro del vetro `(Cx, Cy, z)`, lo spostamento della proiezione sul piano è:

`shadowOffset = z / (H - z) * (C - L)`

Per una sorgente con raggio `R`, una stima della penombra aggiuntiva è:

`penumbra = R * z / (H - z)`

Un piccolo contributo di contatto può restare a `z = 0`; con l'aumento di `z` la proiezione si allontana, si allarga e perde densità. Tutti questi valori devono usare lo stesso `lift` della lente.

## Fonti

- MDN, [`feDisplacementMap`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap): formula di campionamento e spazio colore.
- Khronos, [`refract`](https://registry.khronos.org/OpenGL-Refpages/gl4/html/refract.xhtml): definizione GLSL della rifrazione.
- PBRT v4, [Specular Reflection and Transmission](https://pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission): Fresnel e trasmissione dielettrica.
- OpenStax, [Thin Lenses](https://openstax.org/books/university-physics-volume-3/pages/2-4-thin-lenses): relazione tra distanza, focale e magnifica.
