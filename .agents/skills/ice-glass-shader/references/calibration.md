# Calibrazione rispetto agli screenshot

Usa viewport, DPR, font e dati identici tra riferimento e implementazione. Cattura almeno tre posizioni del cursore: dentro una card, tra due card e lontano dalla card principale.

## Ordine di regolazione

1. Geometria: raggi, spessore del bordo, clipping e posizione delle card.
2. Tonalità di base e trasparenza del vetro.
3. Rifrazione e spostamento apparente dello sfondo.
4. Fresnel e volume del bordo.
5. Highlight legato al cursore e attenuazione tra card.
6. Dispersione cromatica.
7. Assorbimento, contrasto locale e micro-dettagli.

Modifica una famiglia di parametri alla volta. Conserva per ogni iterazione screenshot, parametri e metriche; non affidarti alla memoria visiva.

## Registro delle differenze

Annota per ogni confronto:

| Area | Riferimento | Render | Correzione |
| --- | --- | --- | --- |
| Bordo | spessore e intensità | valore osservato | parametro da cambiare |
| Centro | trasmissione e tinta | valore osservato | assorbimento/opacità |
| Luce | posizione e forma | valore osservato | normale/roughness |
| Card vicine | attenuazione | valore osservato | reach/falloff |

## Regole visive

- Una zona rossa resta rossa quando viene illuminata: varia luminanza e contrasto, non sostituire la tinta con bianco.
- La dispersione deve essere visibile soprattutto sul bordo e nei cambi di curvatura.
- Il riflesso deve coincidere con la posizione corrente del cursore nell'immagine acquisita.
- Evita gradienti radiali esterni, bloom e ombre colorate usate per simulare la rifrazione.
