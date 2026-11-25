import { DEMO_AS_OF } from "../../../../demo-ledger";
import { DEMO_ACCOUNTS } from "../../../../demo-data";

export const dynamic = "force-static";

export function GET() {
  return Response.json({
    version: 1,
    source: "BlueSpherix demo ledger",
    simulated: true,
    asOf: DEMO_AS_OF,
    accounts: DEMO_ACCOUNTS.map(({ id, name, strategy, type, equity, balance, drawdown, trades, returns }) => ({
      id, name, strategy, category: type, currency: "USD", equity, balance,
      maximumDrawdownPercent: drawdown, monthlyTrades: trades, monthlyReturnSeries: returns,
    })),
  });
}
