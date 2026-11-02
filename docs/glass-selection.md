# Rivestimento vetroso della selezione

I controlli selezionabili nelle sezioni della dashboard usano lo stesso canvas e lo stesso shader delle card. `app/glass-selection.ts` gestisce una sola selezione visiva, indipendente dai valori funzionali di filtri, tab, note e tag. I controlli comprendono periodi, viste, righe, celle, opzioni, menu, checkbox e radio. I pulsanti di azione (esportazione, salvataggio) e la navigazione laterale esterna al canvas mantengono il proprio comportamento.

In **Oggi**, anche le righe delle posizioni aperte sono pulsanti nativi rivestibili, raggiungibili con Tab e selezionabili con Space/Invio. Prima erano blocchi `div` statici, mentre il periodo del grafico era già collegato. La selezione è soltanto visiva: non cambia dati o apre operazioni. Il negativo mantiene materiale e riflessi tinti di rosso. Il controllo specifico è `scripts/check-glass-selection-today.mjs` (stesse variabili della suite generale).

### Prova luce sotto il vetro, solo Oggi

I controlli selezionati di Oggi ricevono una luce interna diffusa mentre il volume cresce. Due campi noise continui e un'onda lenta redistribuiscono le zone luminose senza muovere le normali o i riflessi esistenti. Le parti soffuse conservano il colore del materiale; le creste più intense tendono gradualmente al bianco. Il contributo rimane entro la sagoma e sfuma prima del bordo, senza bloom, aloni esterni o cambi di opacità. Le card ordinarie e le altre sezioni ricevono contributo zero.

Il renderer condiviso aggiorna il moto a circa 30 fps a riposo, senza ritardare gli eventi del puntatore. La deselezione dissolve anche la luce e arresta il loop; pagina nascosta, perdita del contesto e smontaggio cancellano il timer. Reduced motion mantiene la luce ferma. Lo sfondo non viene animato. Verifica: `scripts/check-glass-underlight.mjs`, con catture temporali, isolamento a Oggi, arresto del loop e mobile/reduced motion.

## Materiale e sequenza

- Il punto del clic viene memorizzato nelle coordinate locali del controllo. Tastiera e scelte da popup rimossi usano il centro del trigger rimasto visibile.
- **Stesura, 280 ms:** il vetro lucido piatto si espande circolarmente dal clic. Il raggio è calcolato in pixel CSS fino all'angolo più lontano; non viene deformato dal rapporto larghezza/altezza del controllo.
- **Volume, 360 ms:** solo dopo la copertura completa crescono altezza e gradiente del campo `soapSurface`, fino al volume a saponetta. Normali, Snell e Fresnel seguono la superficie crescente. Il DOM non viene scalato, spostato o reso trasparente.
- La tinta deriva dallo stile originale del controllo dopo il commit React, leggendo il colore di destinazione delle transizioni CSS. Un piccolo parser 2D legge anche colori CSS `color(srgb ...)`, una volta per selezione. Tinta del materiale e riflessi vengono filtrati rispettivamente in modo più evidente e più leggero, mantenendo la dispersione RGB.
- Non vengono aggiunti contorni o ombre di selezione. Le cornici di selezione CSS precedenti sono rimosse; gli indicatori piatti dei tab vengono nascosti quando quel gruppo è rivestito. Gli outline di focus da tastiera rimangono disponibili.
- I trade negativi conservano la tinta rossa anche nello stile piatto selezionato, senza ereditare il riempimento acqua delle righe positive.
- Altro controllo o click fuori: dissolvenza in 200 ms, congelando copertura e volume correnti anche se l'ingresso non è ancora terminato. Escape rimuove il rivestimento; Space/Invio funzionano con i pulsanti nativi.
- I valori rimangono impostati dopo la deselezione visiva. Toggle, tag o checkbox disattivati non rimangono rivestiti.
- Nei menu personalizzati e nei calendari il rivestimento rimane sul trigger dopo la scelta.
- Un solo contesto WebGL; un canvas 2D non montato serve soltanto a leggere i colori. Geometrie riutilizzate durante l'animazione; nessun loop perpetuo per la selezione stabile. Observer, timer e attributi vengono puliti allo smontaggio e durante la navigazione.
- Reduced motion applica direttamente il volume finale. Senza WebGL viene usato un rivestimento CSS statico discreto nella stessa tinta, senza ritagliare o animare il contenuto.

Lo shader riceve `uCoating = (coverage, isControl, opacity, volume)` e `uCoatingOrigin = (localX, localY)`. Le card esistenti usano `(1, 0, 1, 1)`: nessuna modifica ai loro parametri ottici. Il confronto in framebuffer float con cinque posizioni della sorgente ha restituito una differenza massima di 7.46e-9 (precisione numerica).

## Verifica

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/check-glass-selection.mjs
```

Preview predefinita `http://127.0.0.1:3001/`, modificabile con `GLASS_SELECTION_URL`; `CHROMIUM_PATH` e `GLASS_SELECTION_ARTIFACTS` sono opzionali. Il test verifica rivestimento, trasferimento, click fuori, righe negative, toggle, tastiera, menu, navigazione, mobile, contesto unico, reduced motion e fallback senza WebGL. Le fasi controllate verificano punto del clic, stesura con volume zero, copertura completa prima della crescita, tinta originale, assenza di cornici e checkbox. Gli artefatti includono screenshot e misure p50/p95. I frame time SwiftShader servono al confronto locale e non rappresentano la GPU di Safari/macOS; Safari non è disponibile nell'ambiente cloud.
