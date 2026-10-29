# BlueSpherix UI patterns

## Adaptive Result Flow

Pattern approvato per visualizzare un risultato economico insieme alla sua sequenza temporale. L'implementazione di riferimento si trova in `HybridOverview` (`app/operations.tsx`) e negli stili `.hybrid-flow-*` (`app/globals.css`).

### Aspetto

- Barre verticali arrotondate, centrate sull'asse verticale e prive di linea di base visibile.
- Barre positive con gradiente aqua luminoso verso l'alto e più scuro verso il basso.
- Barre negative con gradiente corallo/rosso luminoso verso l'alto e più scuro verso il basso.
- Altezza proporzionale al valore assoluto del blocco; colore determinato dal segno.
- Ombra interna leggera e ombra inferiore morbida per dare profondità senza effetto 3D marcato.

### Layout adattivo

- Il valore principale occupa solo la larghezza necessaria; il grafico usa tutto lo spazio rimanente a destra.
- Il grafico si restringe senza sovrapporsi al valore.
- L'area del grafico resta abbastanza alta da distinguere facilmente i 12 blocchi e mostra i riferimenti "Inizio periodo" e "Più recente".
- Se il valore assoluto supera `99.998,00`, il valore viene centrato nella parte alta del riquadro e il grafico passa sotto.
- Su schermi fino a `560px` viene sempre usata la disposizione verticale.
- Il numero di barre di riferimento è 12, una per ciascun blocco del periodo selezionato.

Questo formato va mantenuto coerente quando viene riutilizzato in Dashboard, Analisi o altre viste finanziarie.

## Colore semantico dei numeri

- Ogni valore numerico dinamico che può cambiare segno espone `data-sign={valueSign(value)}`.
- `valueSign` in `app/value-sign.ts` è l'unica regola applicativa per distinguere valori negativi, positivi e neutri.
- Un valore negativo usa sempre il rosso corallo `--red`. La regola globale ha priorità sui colori locali del componente, compresi aqua, colore del conto e colore del grafico.
- Un valore positivo usa aqua; lo zero eredita il colore neutro del contesto.
- Colori direzionali come Long/Short e indicatori di rischio restano separati dal segno matematico del numero.
