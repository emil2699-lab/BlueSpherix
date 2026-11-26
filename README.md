# BlueSpherix

BlueSpherix is a modern trading intelligence workspace designed around clear performance analysis, live risk awareness, and explainable insights. The dashboard includes an interactive demo and a separate workspace for MetaTrader 5 accounts.

Public preview: `https://emil2699-lab.github.io/BlueSpherix/`

## Development

Requirements: Node.js 24 and npm 11 or compatible versions.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Production validation:

```bash
npm run lint
npm run build
npm run start
```

The demo uses a single account with de-identified closed trades from Notion. Regenerate its downloadable CSV with:

```bash
npm run data:csv
npm run data:check
```

The generated file is `public/data/demo-operations.csv`. Dashboard, Analytics, Operations, and Portfolio use the same trade history. Timestamps retain the original statement time. Balance, equity, and percentage returns use a USD 100,000 demo opening balance. The public dataset includes only trade fields and excludes account numbers, broker tickets, and notes.

## Current scope

- Responsive macOS/Safari-first dashboard
- Equity and balance timeline with period controls
- Risk Weather, performance metrics, open positions, insights, and Equity Story
- Dark visual system and installable web-app metadata
- Notion closed-trade demo history with a downloadable CSV
- Shared calculation layer used across all product sections
- Monthly performance reports with date, symbol, and direction filters, plus CSV, HTML, and print/PDF export
- Ten local trading calculators and demo calendar event export (ICS)

See the [Myfxbook feature comparison](docs/myfxbook-comparison.md) for implemented workflows and dependencies for live features.

## Visual language

- Negative financial results tint their entire containing surface red. The tint grows with severity, while positive results use aqua.
- Risk measures stay neutral until a threshold is breached, so risk and realized loss are not confused.

## MetaTrader 5

The local read-only connector syncs balances, equity, margin, open positions, pending orders and deal history. See the [Windows setup and browser instructions](docs/mt5-connection.md).
