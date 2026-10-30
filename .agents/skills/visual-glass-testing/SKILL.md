---
name: visual-glass-testing
description: Verifica effetti glass e shader in dashboard web con Playwright, screenshot riproducibili, movimenti del cursore, confronto pixel e misure di fluidità. Usala per QA visiva di rifrazione, bordi, colore, geometria e risposta dinamica.
---

# Visual Glass Testing

Usa questa skill per validare una webapp renderizzata quando il risultato dipende da cursore, shader, trasparenze o fedeltà a uno screenshot.

## Procedura

1. Definisci il flusso: route, viewport, DPR, stato dati e risultato atteso.
2. Avvia l'app con lo script del repository e attendi che l'URL locale risponda.
3. Acquisisci una serie riproducibile:

```bash
node .agents/skills/visual-glass-testing/scripts/capture.mjs \
  --url http://127.0.0.1:3000/#overview \
  --out /tmp/bluespherix-glass
```

4. Confronta un'immagine con il riferimento:

```bash
node .agents/skills/visual-glass-testing/scripts/compare.mjs \
  --reference /percorso/reference.png \
  --actual /tmp/bluespherix-glass/cursor-02.png \
  --diff /tmp/bluespherix-glass/diff.png
```

5. Leggi [workflow.md](references/workflow.md) per la matrice minima e [metrics.md](references/metrics.md) per interpretare differenze e frame time.
6. Correggi una famiglia di parametri alla volta e ripeti la stessa acquisizione.

## Requisiti

- Usa Playwright già disponibile nel progetto o nel runtime Codex; la libreria e questa skill sono componenti distinti.
- Mantieni costanti browser, viewport, DPR, font, dati e posizione del cursore.
- Cattura almeno: cursore dentro una card, tra card vicine e lontano dalle card principali.
- Registra errori console, coordinate osservate, frame time p50/p95 e screenshot.
- Salva screenshot e script temporanei fuori dal repository, salvo richiesta esplicita.
- Per shader WebGL usa Chromium con ANGLE/SwiftShader in ambiente headless e ripeti su Safari/macOS prima del rilascio.

## Criteri di completamento

- La pagina non è vuota e non mostra overlay del framework.
- Le coordinate osservate coincidono con l'ultima posizione Playwright.
- Le card vicine reagiscono in modo coerente con la distanza.
- Le aree colorate conservano la tinta originale mentre cambia la luminanza.
- Nessun errore console rilevante; frame time e long task sono riportati.
- Il diff visivo è archiviato con una breve lista delle differenze residue.
