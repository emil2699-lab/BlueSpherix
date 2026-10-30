# Workflow di test visivo

## Matrice minima

| Caso | Viewport | Cursore | Scopo |
| --- | --- | --- | --- |
| Desktop principale | 1440×1000 | dentro card KPI | bordo, colore, rifrazione |
| Desktop globale | 1440×1000 | tra due card | risposta simultanea |
| Desktop distanza | 1440×1000 | area vuota | attenuazione |
| Compatto | 1024×820 | card centrale | resize e sovrapposizioni |
| Mobile | 390×844 | touch/coarse pointer | fallback e leggibilità |

Usa `deviceScaleFactor: 1` per confronti deterministici in CI. Aggiungi una sessione al DPR reale del Mac per la verifica finale.

## Acquisizione

Attendi font e primo layout stabile. Imposta la route prima dello screenshot. Muovi il puntatore su coordinate normalizzate rispetto al viewport, verifica le coordinate ricevute dalla pagina e acquisisci senza transizioni artificiali.

Conserva un manifest JSON contenente URL, browser, viewport, data, coordinate, errori console e metriche. Gli screenshot di confronto devono avere esattamente la stessa geometria.

## Confronto

Valuta separatamente:

1. Geometria: bordi, raggi, clipping, allineamento.
2. Colore: tinta, saturazione e conservazione dei colori semantici.
3. Luminanza: highlight, ombre e attenuazione.
4. Dinamica: posizione della risposta rispetto al cursore.
5. Prestazioni: p50/p95 del frame time e long task.

Un RMSE globale basso può nascondere un errore importante sul bordo. Ispeziona anche il diff e, quando serve, ritaglia la card interessata con ImageMagick.

## Browser

Chromium headless serve per regressioni rapide e riproducibili. Poiché BlueSpherix è destinato a macOS, conferma l'effetto in Safari per backdrop, compositing, gamma e antialiasing prima di considerarlo concluso.
