# Ice Glass — renderer globale BlueSpherix

## Rendering

Un solo canvas WebGL 2 trasparente e una sola sorgente in coordinate viewport.
Il puntatore aggiorna un riferimento e richiede il prossimo frame; nessuno state
React, easing o interpolazione delle coordinate. Il renderer riposa a mouse fermo.
Le altre sezioni mantengono il proprio stile.

`app/ice-glass.tsx` gestisce lifecycle, geometrie, scissor, DPR e recupero del
contesto. `app/ice-glass-shader.ts` disegna ora l'intera card con una SDF
arrotondata: normali del bisello che diventano gradualmente frontali, Snell per
tre indici RGB, Fresnel Schlick, speculare GGX, assorbimento e caustiche
deformate da una curvatura stabile a bassa frequenza. La superficie interna
riceve trasmissione e riflessi più diffusi. Nessuna texture dello screenshot.
I parametri sono in `app/ice-glass-config.ts`.

Il renderer attivo disegna il materiale e la fascia cromatica, senza l'atlas di
fotoni del precedente esperimento di propagazione. Il feedback successivo ha
richiesto di eliminare i punti luminosi: il photon mapper e il relativo modello
numerico restano nei sorgenti per riferimento, ma non sono montati né eseguiti
nella dashboard. Non è presente un overlay di traiettorie o punti in produzione.

Il canvas è assoluto nel contenitore `.content`, con overscan limitato a due
altezze di viewport. Materiale e contenuto condividono quindi lo stesso livello
di scorrimento; non occorre attendere un frame JavaScript per mantenerli uniti.

L'ambiente ottico è procedurale. La rifrazione **non campiona il DOM**: testo,
icone, valori e grafici conservano il rendering HTML/SVG originale. Il modello
è un'approssimazione 2.5D, non un ray tracer di una lastra volumetrica.

ResizeObserver, scroll e cambi di visibilità invalidano le geometrie. Il canvas
non intercetta input; senza WebGL restano le card scure. Reduced motion mantiene
il materiale ambientale statico. Contesto, shader, programma, VAO, observer e
listener vengono gestiti e liberati nel lifecycle.

## Calibrazione visiva

Riferimento: le due immagini fornite nella conversazione, con priorità alla
versione senza annotazioni. Il layout originale resta invariato; le proporzioni
dei KPI sono quindi diverse dalle card ingrandite del riferimento.

| Iterazione | Differenza osservata | Correzione |
| --- | --- | --- |
| 1 | Bordo troppo sottile, energia attenuata dal compositing | Alpha premoltiplicato coerente, maggiore spessore e trasmissione |
| 2 | Discontinuità diagonale nel contributo interno | Orientamento ricavato dalla normale 3D del bisello |
| 3 | Perimetro opposto troppo acceso, rasterizzazione costosa | Riduzione del contributo non orientato, quattro fasce geometriche |
| 4 | Nucleo vicino troppo debole rispetto al riferimento | Fuoco bianco localizzato in funzione di sorgente e tangente al bordo |

La prima serie copre bordo sinistro, superiore, angolo, centro, spazio tra card,
distanza, scroll, resize, mobile e reduced motion in `/workspace/artifacts/ice-glass/`.
La correzione della superficie e del trasporto è documentata da un'altra serie
nelle medesime posizioni in `/workspace/artifacts/ice-glass-correction/`, con
`transmit.png`, `debug.png` e `results.json`.

Differenze residue: vetro ancora più levigato e regolare del riferimento;
microtexture e riflessioni interne soltanto approssimate; intensità dei colori
da confermare su un display macOS. Non è stata calcolata una percentuale affidabile di somiglianza:
le immagini di riferimento sono disponibili nel messaggio, non come file locale
allineato. Nessuna dichiarazione di fedeltà del 90%.

## Dispersione cromatica

La calibrazione successiva aumenta `chromaticDispersion` da 0,045 a 0,0765
(+70%). Sei fuochi spettrali separano rosso, arancione, giallo, ciano, blu e
viola lungo la normale ottica deformata; intensità e ampiezza restano legate
alla sorgente e al profilo del vetro. Lo stesso spettro alimenta le caustiche
che raggiungono una card successiva. Il nucleo bianco resta un contributo
separato. Screenshot nelle stesse posizioni in
`/workspace/artifacts/ice-glass-spectrum/`.

Confrontando `edge.png` con la versione precedente, la differenza media
normalizzata è 0,0267 nella fascia illuminata di 28×132 px e 0,0000038
nel centro di 120×40 px. A cursore lontano, l'RMSE globale è 0,00167.
Le differenze indicano una modifica localizzata della dispersione, non un
aumento uniforme della luce.

### Calibrazione organica successiva

La versione con sei colori prefissati è stata sostituita da tre canali rifratti,
come nella dispersione precedente. `chromaticDispersion` torna a 0,045; il
profilo delle frange passa da 0,12 a circa 0,15–0,168 unità di profondità
(+25–40% secondo la curvatura locale), senza aumentare la saturazione.
Una perturbazione spaziale stabile della normale e del cammino ottico incurva
gli highlights secondo incidenza e geometria; il fuoco bianco resta separato.
La trasmissione tra card continua a usare il raggio secondario attenuato.

Confronto visivo A/B/C: `ice-glass-correction/edge.png` (precedente),
`ice-glass-spectrum/edge.png` (sei bande) e
`ice-glass-organic/edge.png` (nuova versione); i ritagli sono in
`ice-glass-organic/comparison-abc.png`. La nuova acquisizione include angolo,
bordo, spazio tra card, distanza intermedia e cursore lontano. Il confronto
in immagine resta qualitativo perché la pagina di sviluppo introduce una
testata verticale di 393 px assente nelle due acquisizioni precedenti.

### Continuità delle caustiche

Il salto cromatico sul bordo superiore derivava dal cambio di segno di
`spread` a un valore fisso dell'incidenza. Ora lo spostamento dei canali
è una funzione continua dell'angolo. La normale della card usa un gradiente
SDF filtrato, così gli angoli non cambiano direzione bruscamente; anche la
partenza del raggio trasmesso sfuma in una larghezza di raggio. La dispersione
RGB rimane attiva. La sequenza di nove posizioni del cursore e il contatto
visivo sono in `/workspace/artifacts/ice-glass-continuity/`.

La calibrazione corrente porta `chromaticDispersion` a 0,050 (+11%): le frange
sono leggermente più separate, senza aumentare la luminosità generale.

### Continuità sulle diagonali interne

Il campo di distanza di un rettangolo arrotondato sceglie il bordo più vicino e
crea assi mediani diagonali invisibili nella geometria, ma visibili quando
orientano una luce molto concentrata. La prima correzione aveva sfumato la
normale, lasciando però la stessa scelta netta nella profondità ottica. Ora sia
normale sia profondità combinano le facce adiacenti con pesi continui prima di
raggiungere quelle diagonali. La silhouette rimane esatta, mentre highlight,
dispersione e caustiche ruotano progressivamente tra lato superiore e laterale.
Anche le normali del trasporto tra card usano la stessa transizione, evitando un
secondo salto quando il raggio attraversa un angolo. I percorsi che sfiorano un
angolo o arrivano quasi tangenti perdono energia con una curva morbida prima che
il lato di ingresso cambi; un nuovo percorso riappare quindi gradualmente e non
illumina di colpo il lato opposto.

### Sincronizzazione con lo zoom di Safari

Canvas, card, cursore e regioni di scissor condividono ora il sistema di
coordinate misurato direttamente sul canvas. Il DPR viene riletto a ogni frame e
gli eventi `visualViewport` invalidano le geometrie durante zoom e pan. In questo
modo il materiale WebGL resta sovrapposto alle card anche mentre Safari cambia
separatamente viewport, layout e scala del backing store.

### Copertura dell'applicazione

Il renderer globale è montato una sola volta sul contenitore principale e
rileva le superfici della sezione attiva. Il cambio di sezione aggiorna
automaticamente geometrie e osservatori senza ricreare il contesto WebGL; la
sincronizzazione con zoom, DPR, scroll e `visualViewport` vale quindi per Oggi,
Portafoglio, Analisi, Operazioni, Rischio e Lab.

## Verifica

- Shader applicativo compilato/linkato in Chromium WebGL 2, errore GL 0.
- Nessun errore console; coordinate richieste e renderer coincidenti.
- Ripristino del contesto WebGL riuscito; fallback senza WebGL funzionante.
- Periodo del grafico e navigazione funzionanti; un solo canvas condiviso tra le viste.
- Nessun overflow orizzontale a 390 px; acquisizione anche a 1024 px.
- TypeScript e build statico verificati; lint senza errori (warning preesistente
  nell'import `basename` del validatore delle skill).

Prestazioni: il test usa Chromium headless con ANGLE SwiftShader, quindi una GPU
simulata dalla CPU. La superficie continua e il trasporto secondario richiedono
circa 283 ms al p95 in questo ambiente; la precedente versione a sole fasce
richiedeva circa 217 ms. Il costo è aumentato perché viene disegnata tutta la
card. I dati esatti sono nel manifest `results.json`.
Queste misure **non dimostrano 60 FPS**: il test Safari/macOS con GPU reale resta
necessario per confermare fluidità, Retina e gestione del colore. I dati esatti
dell'ultima esecuzione sono nel manifest `results.json`.

## Trasparenza della superficie (2026-11-01)

Il canvas vive dietro al contenuto DOM, nello stacking context isolato di
`.content`. Le superfici gestite da WebGL hanno background CSS trasparente:
la tinta e la copertura della lastra provengono solo dallo shader esistente,
senza un secondo riempimento scuro. Testi, numeri, icone e grafici sono
composti sopra il materiale; nessuna opacity viene applicata ai contenitori.
Il fallback senza WebGL usa una tinta scura con alpha 0,26.

Shader, parametri ottici e trasporto secondario restano invariati. Non è stato
aggiunto uno sfondo dinamico. Verifiche e confronti locali sono archiviati in
`/workspace/artifacts/glass-transparency/`; Safari/macOS non è disponibile nel
runtime di verifica. Il prossimo punto richiede la revisione dell'utente.

## Geometria a saponetta (2026-11-01, punto 2)

Il materiale usa un campo di altezza continuo in pixel CSS: raccordo arrotondato
fra lato e faccia, con una bombatura centrale pari al 20% dello spessore nominale.
La silhouette SDF e i raggi misurati dal DOM restano invariati. Nell'interno,
un minimo morbido delle quattro distanze sostituisce la scelta del lato più
vicino, raccordandosi prima degli assi mediani diagonali. Le normali sono il
gradiente analitico dello stesso campo di altezza, calcolato una sola volta per
frammento. La microstruttura spaziale preesistente resta sul materiale.

La quota della superficie entra nel vettore verso la sorgente; l'ambiente
preesistente viene riflesso dalla normale del volume. Snell, Fresnel, GGX e
dispersione ricevono la nuova normale senza modifiche ai loro parametri o alle
formule delle caustiche. Il trasporto fra card resta invariato. Non sono stati
aggiunti CSS di rilievo, luci, bloom, sfondi o trasformazioni dei contenuti.
Il modello rimane un volume ottico 2.5D, senza deformazione del DOM.

Confronti e screenshot: `/workspace/artifacts/glass-soap/`, inclusi bordo,
angolo, faccia, spazio fra card e cursore lontano. `geometry.json` misura
altezza e normali direttamente con gli shader GLSL, anche su una superficie
bassa: nessun valore non finito, normali unitarie e nessun salto interno.
`dashboard.json` registra layout invariato, contenuti opachi, trasparenza in
tutte le sezioni e assenza di overflow a 1024 e 390 px. Compilazione e rendering
verificati in Chromium/SwiftShader; Safari/macOS resta da verificare. Nel test
headless il tempo di risposta al frame è 212 ms p50 e 289 ms p95, misurato con
GPU software: non rappresenta la fluidità di Safari con GPU reale.
Il lavoro si ferma al punto 2 in attesa della revisione della geometria.

### Correzione della leggibilità del volume

Il primo confronto mostrava una differenza troppo tenue: spessore di 14 px,
raccordo stretto e silhouette originale conservavano l'aspetto della lastra.
La calibrazione successiva porta lo spessore geometrico a 2,1 volte quello
nominale (limitato alla metà della semidimensione minore), il raggio ottico a
1,75 volte quello DOM e la bombatura al 30%. Il raccordo occupa 2,2 volte lo
spessore. Cambia il contorno arrotondato dentro lo stesso rettangolo; posizione,
dimensioni e contenuti DOM restano identici. I parametri di luce, colore,
dispersione e il trasporto secondario non cambiano.

Il confronto precedente/corretto è in
`/workspace/artifacts/glass-soap-visible/comparison-top.png`. La trasmissione
misurata nell'area interna resta al 68,75%; 1917 pixel di testo bianco pieno
restano identici cambiando lo sfondo diagnostico. Verificati anche normali,
layout, sezioni e formati compatti senza errori console. Il p95 headless con
GPU software è 315 ms; la fluidità su Safari/macOS resta da confermare.


## Propagazione fra volumi (2026-11-01, punto 3)

Le due facce del volume sono il campo `soapSurface` esistente e la sua immagine
speculare posteriore. La superficie visibile, i raggi, la bombatura e le normali
del materiale non sono stati ricalibrati. Il trasporto interseca una mesh di
40 campioni di contorno e sei anelli per faccia; le normali alle interfacce
vengono rivalutate analiticamente con lo stesso GLSL della superficie visibile.
È una discretizzazione del volume ottico, non una nuova geometria della UI.

I campioni di superficie rappresentano angoli solidi della singola sorgente
isotropa globale. La visibilità seleziona soltanto la prima interfaccia raggiunta,
inclusa l'auto-occlusione. Ogni campione RGB mantiene posizione, direzione,
flusso, mezzo attraversato e numero di card raggiunte. Snell e Fresnel dielettrico
sono valutati a ingresso e uscita, con gli stessi indici `1,5 ± 0,05` già in uso.
L'assorbimento Beer–Lambert usa i coefficienti RGB preesistenti per la lunghezza
realmente percorsa. La diluizione geometrica deriva dall'angolo solido e dalla
superficie ricevente: non si moltiplica nuovamente per un decadimento arbitrario
ad ogni attraversamento dello spazio vuoto.

La densità del flusso nei punti raggiunti produce concentrazione o divergenza.
Una piccola frazione di scattering superficiale, determinata dalla roughness
esistente, alimenta un atlas RGBA16F con ricostruzione normalizzata di 7×7 texel.
Questa energia viene sottratta al flusso uscente. L'atlas viene composto soltanto
all'interno delle superfici originali; nessun raggio è disegnato nello spazio.
La luce può continuare verso altre due card, con sei iterazioni GPU successive
all'ingresso iniziale. Geometria e BVH vengono caricate solo quando cambiano;
nessuna lettura GPU, integrazione temporale o interpolazione del cursore nel
rendering ordinario.

Il solver segue il cammino trasmesso dominante e le riflessioni interne totali.
Le altre diramazioni speculari sono escluse dal budget trasmesso, non duplicate
né convertite in energia aggiuntiva. È un'approssimazione forward con profondità
limitata, non un path tracer completo con tutte le diramazioni. La rifrazione
dello sfondo DOM resta fuori da questo punto; nessuno sfondo nuovo è stato creato.
Senza `EXT_color_buffer_float` rimane il materiale esistente senza il nuovo
contributo di propagazione.

Il contributo diretto del materiale è identico pixel per pixel in cinque
posizioni della luce con atlas nullo: geometria, riflessi, colore e dispersione
precedenti preservati. Anche con atlas illuminato l'alpha rimane identico:
la nuova irradianza modifica il colore emesso, non la trasparenza.

Verifiche numeriche riproducibili:
`node --no-warnings --experimental-strip-types scripts/check-glass-transport.mjs`.
Coprono Snell nelle due direzioni, riflessione interna totale, derivate della
superficie, propagazione secondaria, assorbimento, diluizione con distanza e
integrale del flusso ricostruito. Errore relativo del bilancio energetico sotto
`1e-10`; nessun passaggio GPU aumenta il flusso del singolo campione.

Le acquisizioni prima/dopo alle stesse coordinate, il readback diagnostico dei
passaggi GPU, le impronte dei raggi, il confronto del materiale e le verifiche
Playwright sono in `/workspace/artifacts/glass-propagation/`. Nel caso di tre
card allineate la GPU registra 41 arrivi sulla seconda card e 15 sulla terza,
con 11 campioni che raggiungono la terza dopo tre interazioni con card distinte.
La deviazione massima dalla direzione Snell del riferimento è inferiore a
`4e-5`; le impronte rifratte possono sia allargarsi sia concentrarsi e cambiano
con la sorgente. Layout, opacità dei contenuti, navigazione e viewport mobile
verificati; un solo canvas, errore GL zero.

Il p95 di 12 aggiornamenti del cursore è circa 357 ms su SwiftShader (GPU
simulata dalla CPU), rispetto ai circa 315 ms del precedente controllo: non è
una misura delle prestazioni Safari su GPU reale e non dimostra 60 FPS. Safari
macOS, Retina e fluidità effettiva rimangono da confermare sul dispositivo.
Fermarsi alla revisione del punto 3: nessun intervento sulla curvatura dinamica
dei riflessi, sugli altri punti o sullo sfondo.


## Correzione scroll, punti e fascia cromatica (2026-11-01)

Il feedback successivo al punto 3 modifica la priorità: eliminare i punti
luminosi e rendere dritta la forma di base della fascia arcobaleno, lasciandola
curvare in risposta al cursore.

- Il canvas passa da fixed ad absolute nel contenitore del contenuto. Una fascia
  di overscan alta al massimo due viewport segue lo scroll nel compositor e si
  riposiziona per coprire le sezioni lunghe. Le mutazioni di stile del canvas
  stesso vengono ignorate dagli osservatori per evitare cicli di invalidazione.
- Rimossi dal renderer attivo il photon atlas, i passaggi di transform feedback
  e la composizione dei campioni puntiformi. Il modello sperimentale resta nei
  file dedicati, inattivo, senza costo per ogni movimento del cursore.
- I picchi GGX sono confinati al bordo esterno; il nucleo bianco è una fascia
  più estesa lungo il bordo, senza glint isolati sulla faccia o sulla spalla.
- La profondità base della fascia usa la distanza dal contorno, rettilinea sui
  lati rettilinei. Rimossi la curva UV e il termine sinusoidale fisso dal percorso
  della frangia. La differenza fra i raggi Snell locali e un riferimento parallelo
  alla direzione centrale della sorgente genera la deformazione. Il campo si
  annulla nel limite di sorgente lontana; non usa un'animazione temporale o una
  funzione che imposta direttamente una curvatura in base alla distanza.
- I canali RGB seguono differenze di percorso separate. Il parametro di
  dispersione rimane 0,05; IOR, colori, guadagni luminosi e geometria a saponetta
  sono preservati. La quota centrale viene calcolata una volta alla misura della
  card, non nuovamente per ogni frammento. La microstruttura del materiale usa
  coordinate locali della card, così non cambia fase durante scroll e rebase.

Verifiche in `/workspace/artifacts/glass-scroll-band/`. Con rendering fermo e
scroll di 268 px, il vecchio canvas fixed rimaneva disallineato di 268 px; il nuovo
canvas absolute rimane allineato con errore zero prima di qualsiasi ridisegno.
Il test GLSL isolato su un tratto rettilineo misura una variazione di profondità
della fascia verde di 7,44 px nella versione precedente anche con luce lontana;
ora è 0,008 px. Con sorgente a distanza intermedia diventa 0,57 px, a 50 px dal
bordo 2,96 px; posizione laterale e distanza cambiano il percorso continuamente.
La misura riguarda la geometria della fascia a intensità isolata, non il glow.

Layout e contenuti non sono modificati; nessuno sfondo nuovo e jumpcard ancora
disabilitato. I test headless non sostituiscono la verifica di Safari sul Mac.

Il controllo finale copre 21 posizioni di scroll in Oggi, Rischio e Operazioni:
errore di allineamento zero anche dopo il rebase della fascia canvas, nessun
passaggio GL_POINTS e nessun errore WebGL. Navigazione delle sei viste, contenuti
opachi, layout invariato e viewport 1024/390 px verificati. Su SwiftShader il p95
di 12 aggiornamenti del cursore è circa 268 ms, rispetto ai circa 357 ms del
precedente esperimento: questa misura su GPU simulata non dimostra 60 FPS su Mac.


## Sola riduzione dell'opacità (2026-11-01)

Dopo l'approvazione di effetto, scroll e fascia cromatica, è stata modificata
soltanto la copertura del corpo del materiale. `glassBodyOpacity` è 0,14, con
raccordo progressivo alla copertura preesistente sul bordo. La radiance
premoltiplicata dei riflessi resta separata: abbassare l'opacità non attenua
l'arcobaleno né cambia la sua forma. Nessuna modifica a roughness, geometria,
dispersione, luce, layout, contenuti o comportamento del cursore.

Nel test GLSL su cinque posizioni della sorgente, la trasmissione centrale del
fondale passa dal 64–68% a circa l'86%; il contributo dei riflessi è numericamente
identico (errore massimo zero). Screenshot prima/dopo e readback in
`/workspace/artifacts/glass-clarity/`. Contenuti opachi e geometrie DOM identiche,
build e lint verificati, nessun errore WebGL/browser.
