# Prestazioni GPU

## Budget iniziale

- Desktop: frame time p95 sotto 16.7 ms a 60 Hz; obiettivo sotto 8.3 ms sui display a 120 Hz.
- Script del puntatore: sotto 1 ms per evento; nessuna lettura layout nel percorso caldo.
- Un solo contesto WebGL e un solo frame pendente.
- DPR limitato, inizialmente `min(devicePixelRatio, 2)`.

## Regole

- Cache delle geometrie; rileggile soltanto quando observer, resize o scroll le invalidano.
- Separa letture DOM e scritture.
- Non chiamare `getBoundingClientRect()` per ogni movimento del mouse.
- Evita `readPixels`, framebuffer multipli e texture ad alta precisione nel loop normale.
- Precalcola costanti e limita loop shader con massimi compile-time.
- Usa `mediump` dove la precisione non altera bordi o coordinate.
- Disabilita il loop quando la sezione è nascosta o la pagina non è visibile.
- Riduci qualità in modo progressivo: DPR, campioni di dispersione, pass secondari. Mantieni sempre posizione e geometria corrette.

## Diagnostica

Misura frame time durante movimento continuo del cursore con `visual-glass-testing`. Controlla long task, errori console e contesti persi. Quando disponibile, usa `EXT_disjoint_timer_query_webgl2` per separare costo GPU e CPU; usa SpectorJS soltanto durante diagnosi mirate, senza inserirlo nel bundle di produzione.
