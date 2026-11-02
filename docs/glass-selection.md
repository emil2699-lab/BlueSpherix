# Rivestimento vetroso della selezione

I controlli selezionabili nelle sezioni della dashboard usano lo stesso canvas e lo stesso shader delle card. `app/glass-selection.ts` gestisce una sola selezione visiva, indipendente dai valori funzionali di filtri, tab, note e tag. Non applica vetro ai pulsanti di azione come esportazione o salvataggio, né alla navigazione laterale esterna al canvas.

- Click: il materiale si stende da sinistra verso destra in 420 ms, con un fronte morbido.
- Il passaggio cromatico usa la dispersione RGB già presente nello shader e dipende dalla sorgente luminosa; la separazione viene accentuata soltanto durante l'ingresso del rivestimento.
- Altro controllo o click fuori: dissolvenza in 200 ms; il precedente controllo torna al suo stile ordinario. Escape rimuove il rivestimento; Space/Invio funzionano con i pulsanti nativi.
- I valori dei controlli rimangono impostati quando si spegne il rivestimento. Un tag disattivato non rimane rivestito.
- Nei menu personalizzati il rivestimento rimane sul trigger dopo la scelta di un'opzione.
- Il materiale non trasforma il DOM, non cambia il layout e non modifica l'opacità dei contenuti. Le righe negative conservano i colori semantici e la scocca rossa.
- Un solo contesto WebGL. Le geometrie vengono riutilizzate durante la transizione; nessun loop perpetuo per la selezione stabile. Observer, timer e attributi vengono puliti allo smontaggio e durante la navigazione.
- Reduced motion applica il materiale immediatamente. Senza WebGL viene usato un rivestimento CSS discreto.

Lo shader riceve `uCoating = (reveal, isControl, opacity)`. Per le card esistenti il valore è `(1, 0, 1)`: geometria, luce e dispersione restano quelle precedenti. Il confronto in framebuffer float con cinque posizioni della sorgente ha restituito differenza massima 0 prima/dopo.

## Verifica

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/check-glass-selection.mjs
```

Preview predefinita `http://127.0.0.1:3001/`, modificabile con `GLASS_SELECTION_URL`; `CHROMIUM_PATH` e `GLASS_SELECTION_ARTIFACTS` sono opzionali. Il test verifica rivestimento, trasferimento, click fuori, righe negative, toggle, tastiera, menu, navigazione, mobile, contesto unico, reduced motion e fallback senza WebGL. Screenshot e misure p50/p95 sono archiviati nella directory degli artefatti. Le misure SwiftShader servono al confronto locale, non rappresentano le prestazioni della GPU di Safari/macOS.
