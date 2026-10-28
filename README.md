# BlueSpherix

BlueSpherix is a modern trading intelligence workspace designed around clear performance analysis, live risk awareness, and explainable insights. The current application is the first interactive dashboard slice and uses realistic demo data while the MT5 read-only data layer is being designed.

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

The demo ledger is deterministic and contains 314 operations. Regenerate its downloadable CSV with:

```bash
npm run data:csv
npm run data:check
```

The generated file is `public/data/demo-operations.csv`. Dashboard, Analytics, Operations, and the Alpha Momentum account in Portfolio calculate their totals from the same ledger: balance, equity, open P&L, win rate, profit factor, expectancy, average R, drawdown, sessions, instruments, heatmaps, and period curves are not maintained as independent display values.

## Current scope

- Responsive macOS/Safari-first dashboard
- Equity and balance timeline with period controls
- Risk Weather, performance metrics, open positions, insights, and Equity Story
- Dark visual system and installable web-app metadata
- Deterministic 314-operation demo ledger with a downloadable CSV
- Shared calculation layer used across all product sections

## Visual language

- Negative financial results tint their entire containing surface red. The tint grows with severity, while positive results use aqua.
- Risk measures stay neutral until a threshold is breached, so risk and realized loss are not confused.

## Product direction

The first backend milestone will ingest account snapshots, positions, orders, and deal history from a read-only MT5 bridge. It will not expose trade execution or position-modification commands.
