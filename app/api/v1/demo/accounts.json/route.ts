import { DEMO_AS_OF, DEMO_OPENING_BALANCE } from "../../../../demo-ledger";
import { DEMO_ACCOUNTS } from "../../../../demo-data";

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    version: 1,
    source: "Notion closed-trade history",
    simulated: true,
    asOf: DEMO_AS_OF,
    timeBasis: "statement",
    simulatedOpeningBalance: DEMO_OPENING_BALANCE,
    accounts: DEMO_ACCOUNTS.map(({ id, name, strategy, type, equity, balance, drawdown, trades, returns }) => ({
      id, name, strategy, category: type, currency: "USD", equity, balance,
      maximumDrawdownPercent: drawdown, monthlyTrades: trades, monthlyReturnSeries: returns,
    })),
  });
}
