---
name: convex-glass-lens
description: Progetta e verifica card di vetro convesso chiaro con bordo spesso, rifrazione del DOM, avanzamento verso lo spettatore e ombra otticamente coerente in React e Next.js.
---

# Convex Glass Lens

Usa questa skill quando un riferimento mostra una lastra trasparente spessa e arrotondata, simile a una saponetta o a una lente, e l'effetto deve restare credibile sia ferma sia mentre avanza verso lo spettatore.

## Procedura

1. Scomponi il riferimento in quattro famiglie misurabili: sagoma, bordo ottico, trasmissione interna e proiezione sulla base. Non calibrare il colore prima della geometria.
2. Leggi [optical-model.md](references/optical-model.md) e scegli un solo parametro normalizzato `lift` tra `0` e `1`. Da questo parametro devono derivare distanza, rifrazione, scala prospettica, riflessi e ombra.
3. Leggi [web-implementation.md](references/web-implementation.md). Mantieni contenuti, link e controlli nel DOM sulla base; crea un overlay ottico separato che campiona ciò che si trova dietro.
4. Riusa il profilo convesso e la mappa di normali già presenti nel progetto quando sono compatibili. Genera la displacement map soltanto al mount o al resize, non durante ogni frame.
5. Costruisci il bordo con più zone: profilo esterno colorato, spalla interna, Fresnel radente e riflessi curvi localizzati. Un contorno bianco uniforme non comunica spessore.
6. Mantieni la luce ambientale fissa. Il cursore controlla l'avanzamento della lente; non diventa una nuova lampada.
7. Calibra e verifica seguendo [calibration.md](references/calibration.md). Esegui `node .agents/skills/convex-glass-lens/scripts/verify-model.mjs` prima del test visivo.

## Architettura richiesta

- Base: sfondo e contenuto DOM immobili.
- Proiezione: ombra morbida sul piano della base, calcolata dalla stessa altezza del vetro.
- Ottica: overlay trasparente con `backdrop-filter` e `feDisplacementMap`, oppure un unico pass WebGL che campiona una texture della base.
- Materiale: bordo e riflessi agganciati alla stessa geometria dell'overlay.
- Fallback: blur e bordo traslucido senza falsa rifrazione nei browser che non applicano filtri SVG al backdrop.

## Vincoli

- Il vetro avanza lungo Z, senza traslazione diagonale della card.
- Testo e immagini non ricevono `transform`, `scale` o `translate` durante l'hover.
- La deformazione visiva nasce dal ricampionamento del backdrop; non chiamare rifrazione un semplice `scale()`.
- Limita dispersione cromatica e blur alla leggibilità del contenuto.
- Evita loop GPU o canvas separati per ogni card quando la tecnica passa alla dashboard.
- Supporta `prefers-reduced-motion`; il materiale resta leggibile anche senza animazione.
- Documenta i browser realmente verificati e il percorso di fallback.

## Criteri di completamento

- A riposo il vetro è visibile tramite spessore, tinta, Fresnel e riflessi, senza diventare opaco.
- Durante l'hover soltanto il vetro avanza; il contenuto DOM mantiene coordinate e hit target.
- La magnifica e la deformazione aumentano in modo continuo con la distanza dalla base.
- L'ombra si separa, si sposta e si ammorbidisce coerentemente con la stessa altezza.
- Il bordo non è una linea uniforme e le separazioni RGB restano sottili.
- Build, controllo numerico e acquisizione browser terminano senza errori runtime.
