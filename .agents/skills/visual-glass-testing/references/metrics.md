# Metriche visive e dinamiche

## Differenza pixel

Lo script usa ImageMagick e riporta RMSE normalizzato. Interpreta il valore come segnale di regressione, non come giudizio estetico assoluto.

- `0`: immagini identiche.
- Valore piccolo e concentrato sul bordo: probabile differenza di antialiasing o raggio.
- Diff diffuso dentro la card: trasmissione, assorbimento o opacità errati.
- Diff circolare fuori dalla card: alone o bloom indesiderato.

Confronta anche dimensioni e spazio colore. Non confrontare screenshot con viewport o DPR differenti.

## Colore e luminanza

Campiona punti fissi in aree positive, negative e neutre. Controlla separatamente RGB/HSL e luminanza relativa. Una luce corretta aumenta luminanza e contrasto locale senza convertire rosso, acqua o viola in bianco.

## Geometria

Usa il diff ad alto contrasto per osservare raggi, clipping e spessore del bordo. Se la differenza forma un contorno doppio, la geometria o l'allineamento è errato; non compensare cambiando opacità.

## Risposta al cursore

Confronta coordinate richieste e ultimo `pointermove` osservato. La distanza in pixel deve essere zero o spiegata dalla trasformazione del canvas. Valuta il frame immediatamente successivo al movimento; non aggiungere pause per nascondere ritardi.

## Fluidità

Il capture misura intervalli `requestAnimationFrame` per circa un secondo:

- p50 descrive il comportamento normale.
- p95 evidenzia scatti.
- frame oltre 25 ms sono segnalati come lenti.
- i long task oltre 50 ms indicano lavoro eccessivo sul main thread.

In headless i numeri non equivalgono al Mac reale, ma sono utili per confrontare due revisioni nello stesso ambiente.
