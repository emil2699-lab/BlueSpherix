# BlueSpherix

BlueSpherix is a modern trading intelligence workspace designed around clear performance analysis, live risk awareness, and explainable insights. The dashboard reads trading activity from imported or synchronized MetaTrader 5 accounts.

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

Run the trading data, report, and calculator checks with `npm run data:check`.

## Current scope

- Responsive macOS/Safari-first dashboard
- Current equity, balance and margin, plus cumulative realized P&L by period
- Open positions, pending orders, deal history and portfolio totals per currency
- Dark visual system and installable web-app metadata
- Monthly performance reports with date, symbol, and direction filters, plus CSV, HTML, and print/PDF export
- Trade journal, Strategy Tester archive, trading calculators and calendar event export (ICS)

See the [Myfxbook feature comparison](docs/myfxbook-comparison.md) for implemented workflows and dependencies for live features.

## Visual language

- Negative financial results tint their entire containing surface red. The tint grows with severity, while positive results use aqua.
- Risk measures stay neutral until a threshold is breached, so risk and realized loss are not confused.

## MetaTrader 5

The local read-only connector syncs balances, equity, margin, open positions, pending orders and deal history. See the [Windows setup and browser instructions](docs/mt5-connection.md).
