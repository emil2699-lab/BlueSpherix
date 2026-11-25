# Operazioni chiuse da Notion

L’archivio pubblico alimenta Oggi, Operazioni e Analisi quando il browser non ha un conto MT5 selezionato. Lo storico rimane accessibile da Portafoglio anche se sono presenti conti locali. Gli orari provengono dal rendiconto, che non specifica un fuso.

La pubblicazione contiene strumento, direzione, date e orari, volumi, prezzi medi di esecuzione, risultato e costi. Gli identificativi pubblici derivano dai soli campi pubblicati. Nome, numeri di conto, ticket, email, note e dati di saldo sono esclusi prima di scrivere il file pubblico.

## Attivazione del controllo feriale

1. Crea in Notion una connessione interna con il solo permesso di leggere contenuti. Nella pagina del database **Esecuzioni e movimenti**, aggiungila da **Connections**.
2. Aggiungi il token come secret **NOTION_TRADE_TOKEN** nelle [impostazioni Actions del repository](https://github.com/emil2699-lab/BlueSpherix/settings/secrets/actions).
3. Esegui **Deploy BlueSpherix preview → Run workflow** sul ramo `first` con **Read Notion before publishing** per verificare subito l’accesso.

GitHub Actions controlla dal lunedì al venerdì alle **17:00 Europe/Rome**. L’orario si adatta all’ora legale. Quando l’archivio cambia, lo stesso workflow salva il nuovo file e pubblica la preview. I normali commit continuano ad aggiornare la preview.

Il connettore è impostato per il primo archivio in USD sullo strumento XAUUSD. Una nuova valuta, un nuovo strumento o movimenti sovrapposti richiedono la verifica del formato prima di ampliare l’importazione. Un errore di riconciliazione lascia online l’ultimo archivio valido.
