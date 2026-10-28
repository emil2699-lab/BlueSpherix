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

## Current scope

- Responsive macOS/Safari-first dashboard
- Equity and balance timeline with period controls
- Risk Weather, performance metrics, open positions, insights, and Equity Story
- Dark visual system and installable web-app metadata
- Demo data kept inside the UI until the MT5 bridge contract is defined

## Product direction

The first backend milestone will ingest account snapshots, positions, orders, and deal history from a read-only MT5 bridge. It will not expose trade execution or position-modification commands.
