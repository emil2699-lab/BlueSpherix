# Implementazione web

## Stratificazione

Mantieni questo ordine di compositing:

1. ambiente e pattern della base;
2. proiezione d'ombra sul piano;
3. contenuto DOM immobile;
4. overlay ottico trasparente;
5. bordo, riflessi e spalla del vetro.

L'overlay riceve `translateZ(z)` dentro un contenitore con `perspective`. Il contenuto sottostante non riceve trasformazioni. In questo modo coordinate, selezione del testo e controlli rimangono reali.

## Rifrazione del backdrop

Per Chromium usa un filtro SVG referenziato da `backdrop-filter: url(#filter)`. La displacement map deriva dalle normali della superficie, non da rumore casuale. Tre pass con scale molto vicine possono ricomporre R, G e B per una dispersione discreta.

Genera la texture al mount e quando cambia la dimensione:

- canale R: offset X;
- canale G: offset Y;
- valore neutro: 128 corretto a 0.5 con `feComponentTransfer`;
- `color-interpolation-filters="sRGB"` sul filtro.

Aggiorna per frame soltanto `scale` e le variabili CSS derivate da `lift`. Non rigenerare la texture per un cambiamento di altezza.

`backdrop-filter` vede solo fino al backdrop root più vicino. Evita su antenati `filter`, `opacity < 1`, `mask`, `clip-path`, `mix-blend-mode` o un altro `backdrop-filter` quando devono restare fuori dalla radice di campionamento.

## Materiale del riferimento

Il riferimento chiaro richiede:

- corpo quasi trasparente con lieve tinta acqua;
- bordo esterno verde petrolio variabile, non bianco uniforme;
- una spalla interna larga e chiara che suggerisce spessore;
- riflessi curvi più ampi agli angoli alto-sinistro e basso-destro;
- lieve separazione ciano/blu ai bordi più curvi;
- ombra esterna morbida, spostata in basso a destra dalla luce alta a sinistra.

Costruisci bordo e riflessi con pseudo-elementi agganciati alla stessa rounded box. Le decorazioni devono seguire raggio e maschera; non usare glow circolari scollegati.

## Supporto e fallback

La sintassi `backdrop-filter: url(#filter)` è prevista dalla specifica, ma il supporto pratico dei filtri SVG sul backdrop varia. Verifica il frame nel browser: `CSS.supports()` da solo non dimostra che la rifrazione sia stata renderizzata.

Nel fallback:

- usa `backdrop-filter: blur(...) saturate(...)` quando disponibile;
- conserva bordo, spalla, trasparenza e ombra;
- disabilita la deformazione senza simulare falsi offset del contenuto;
- non far dipendere informazioni o azioni dalla rifrazione.

## Accessibilità e prestazioni

- Con `prefers-reduced-motion: reduce`, mantieni `lift = 0` e mostra il materiale statico.
- Limita il DPR e la risoluzione della mappa; 129–193 campioni sul lato maggiore sono sufficienti per una card.
- Usa un solo `requestAnimationFrame` per l'interazione e fermalo quando raggiunge il target.
- Conserva `pointer-events` sui contenuti reali; l'overlay puramente visivo usa `pointer-events: none`.

## Fonti

- MDN, [`backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter): filtri sul contenuto retrostante e backdrop root.
- MDN, [`perspective()`](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/perspective): relazione tra piano Z e dimensione apparente.
- MDN, [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion): fallback del movimento.
- Deepika Rao, [`liquid-glass`](https://github.com/deepika-builds/liquid-glass), MIT: riferimento esaminato per filtraggio SVG del backdrop e correzione sRGB; non è una dipendenza del progetto.
