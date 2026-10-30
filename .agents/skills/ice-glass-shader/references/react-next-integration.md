# Integrazione React e Next.js

## Architettura

Usa un componente client dedicato a un solo canvas globale, posizionato sopra o sotto il contenuto secondo il compositing richiesto. Il DOM resta responsabile di testo, controlli e accessibilità; WebGL disegna soltanto il materiale ottico.

Struttura consigliata:

```text
IceGlassLayer (client)
  canvas WebGL2 globale
  registro delle card osservate
  cache di DOMRect e raggi
  stato cursore in ref
  renderer e risorse GPU
```

## Lifecycle

1. Crea il contesto in `useEffect` dopo il mount.
2. Compila e linka gli shader una sola volta.
3. Conserva contesto, programma, buffer, texture e uniform location in ref, fuori dallo state React.
4. Usa `ResizeObserver` per il canvas e le card; invalida le geometrie su resize e scroll.
5. Aggiorna coordinate del cursore con `pointerrawupdate` quando disponibile, altrimenti `pointermove`; usa listener passivi.
6. Pianifica al massimo un `requestAnimationFrame`. Il frame legge l'ultimo stato, aggiorna uniform e disegna.
7. Nel cleanup cancella frame, listener e observer e chiama `deleteProgram`, `deleteShader`, `deleteBuffer`, `deleteVertexArray`, `deleteTexture` e `deleteFramebuffer` per ogni risorsa creata.

## Coordinate

Converti `clientX/clientY` in coordinate del canvas tenendo conto di viewport, scroll e DPR. Invia al fragment shader sia coordinate CSS sia risoluzione fisica. Se il canvas copre il viewport:

```ts
const x = pointer.clientX * dpr;
const y = (window.innerHeight - pointer.clientY) * dpr;
```

Per ogni card invia `left`, `bottom`, `width`, `height`, `radius` e tono cromatico. Con poche card usa array uniform con dimensione massima fissa; oltre 16–32 card preferisci una texture dati o un buffer compatto.

## Rendering condiviso

Disegna un fullscreen triangle e valuta tutte le card nello shader, oppure usa instancing con un quad per card. Per questa dashboard preferisci instancing quando le card sono molte o si sovrappongono poco: riduce il lavoro del fragment shader fuori dalle superfici utili.

## Next.js

- Il modulo che usa `window`, canvas o WebGL deve iniziare con `"use client"`.
- Non inizializzare WebGL durante SSR.
- Carica dinamicamente il layer solo se il bundle e il tempo di bootstrap lo richiedono.
- Segui la documentazione della versione Next.js presente in `node_modules/next/dist/docs/` prima di modificare convenzioni o lifecycle.

## Context loss e fallback

Gestisci `webglcontextlost` con `preventDefault()` e sospendi il loop. A `webglcontextrestored`, ricrea tutte le risorse. Se WebGL 2.0 non è disponibile, mantieni card borderless con un riflesso CSS statico e nessun errore utente.
