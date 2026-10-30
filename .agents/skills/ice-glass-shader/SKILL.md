---
name: ice-glass-shader
description: Progetta, integra e calibra Interactive Ice Glass in WebGL 2.0/GLSL per dashboard React e Next.js. Usala per rifrazione, Fresnel, dispersione cromatica, bordi SDF, luce globale guidata dal cursore e ottimizzazione GPU su più card.
---

# Ice Glass Shader

Usa questa skill quando l'effetto richiede ottica e rendering GPU reali. Prima di scrivere codice, acquisisci gli screenshot di riferimento e definisci: area interessata, card illuminate, comportamento del cursore, browser target e budget prestazionale.

## Procedura

1. Leggi [optics.md](references/optics.md) e scegli un modello ottico minimo verificabile.
2. Leggi [react-next-integration.md](references/react-next-integration.md) prima di integrare il canvas nella dashboard.
3. Parti dagli shader compilabili in `assets/`; esegui `node .agents/skills/ice-glass-shader/scripts/verify-webgl.mjs` prima e dopo ogni modifica sostanziale.
4. Usa un solo canvas WebGL globale per tutte le card. Passa geometrie, raggi, colori e stato del cursore come uniform o texture dati; non creare un contesto WebGL per card.
5. Mantieni il cursore come unica sorgente luminosa globale. Aggiorna le coordinate direttamente dall'ultimo evento disponibile e renderizza al frame successivo, senza easing o interpolazione spaziale.
6. Applica rifrazione, Fresnel e dispersione soltanto dentro la geometria del vetro e sul suo bordo. Un alone esterno non è rifrazione.
7. Calibra nell'ordine indicato in [calibration.md](references/calibration.md), usando screenshot riproducibili e la skill `visual-glass-testing`.
8. Controlla il budget descritto in [performance.md](references/performance.md) prima di estendere l'effetto ad altre sezioni.

## Vincoli Ice Glowing

- Una sola luce globale coincide con il cursore.
- Più card reagiscono insieme con attenuazione continua rispetto alla distanza.
- Il colore esistente viene rifratto e schiarito senza trasformarsi in bianco.
- I bordi arrotondati hanno volume tramite SDF, normale locale e spessore ottico.
- Il riflesso resta agganciato al cursore; nessuna coda visiva.
- Supporta `prefers-reduced-motion`, perdita del contesto WebGL e fallback CSS discreto.
- Non introdurre dipendenze 3D se un fullscreen pass WebGL 2.0 è sufficiente.

## Criteri di completamento

- Vertex e fragment shader compilano e linkano in WebGL 2.0.
- Il canvas viene creato solo lato client e tutte le risorse GPU vengono eliminate nel cleanup.
- Resize, DPR, scroll e geometrie delle card restano sincronizzati.
- Il confronto visivo documenta geometria, colore, luminanza e risposta al cursore.
- Nessun errore console, perdita progressiva di memoria o regressione evidente del frame time.
