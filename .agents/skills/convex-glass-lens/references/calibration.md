# Calibrazione e verifica

## Ordine

1. Sagoma e raggio: confronta silhouette, proporzioni e continuità degli angoli.
2. Spessore: calibra bordo esterno e spalla interna prima dell'opacità centrale.
3. Trasmissione: il pattern e il testo dietro devono restare riconoscibili.
4. Rifrazione: verifica centro calmo, crescita sulle curve e assenza di pieghe dell'immagine.
5. Avanzamento: aumenta `zMax` finché il vetro si avvicina chiaramente senza occupare la scena.
6. Ombra: deriva offset e blur dalla stessa altezza, poi regola soltanto l'intensità artistica.
7. Dispersione e riflessi: aggiungili per ultimi e mantienili subordinati alla geometria.

## Acquisizioni minime

- riposo, cursore lontano;
- metà avanzamento;
- hover stabilizzato;
- uscita dal vetro;
- viewport desktop e 390 px;
- `prefers-reduced-motion`;
- percorso senza filtro SVG sul backdrop.

Per ogni frame registra rettangolo del contenuto e rettangolo dell'overlay. Il primo deve restare invariato; il secondo deve espandersi simmetricamente attorno al centro.

## Soglie iniziali

- IOR: `1.46–1.52`;
- proiezione massima del guscio: `1.05–1.11`;
- magnifica apparente totale: `1.08–1.22`;
- separazione cromatica: `0.5–1.8 px` alla scala nominale;
- opacità del corpo: sotto `0.18` su sfondo chiaro;
- p95 del frame time: sotto `16.7 ms` nel browser di test.

## Segnali di errore

- Contorno bianco continuo: Fresnel e spessore sono stati sostituiti da un border decorativo.
- Testo che si sposta come box: è stato trasformato il DOM invece di campionare il backdrop.
- Immagine duplicata o scia: coordinate della mappa, spazio colore o backdrop root errati.
- Ombra immobile durante l'hover: altezza e proiezione non condividono lo stesso stato.
- Centro lattiginoso: tint o blur eccessivi stanno coprendo la trasmissione.
- Arcobaleno largo: dispersione usata come decorazione invece che come effetto di bordo.
