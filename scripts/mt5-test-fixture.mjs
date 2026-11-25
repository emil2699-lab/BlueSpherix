// Browser fixtures are uploaded through the same import path as an MT5 export.
export async function importTestAccount(page, base, { account = "Conto verifica MT5", digit = "a", currency = "EUR" } = {}) {
  const capturedAt = new Date().toISOString();
  const date = minutes => new Date(Date.parse(capturedAt) - minutes * 60000).toISOString();
  const deals = Array.from({ length: 15 }, (_, index) => {
    const id = String(100 + index);
    const trade = { position: id, symbol: index < 7 ? "EURUSD" : "GBPUSD", magic: "12", volume: 0.5, fee: 0, swap: 0, commission: -1 };
    return [
      { ...trade, id: String(index * 2 + 1), entry: "in", side: "buy", price: 1.09, profit: 0, time: date(200 + index * 180) },
      { ...trade, id: String(index * 2 + 2), entry: "out", side: "sell", price: 1.091, profit: index < 9 ? 22 : -18, time: date(70 - index) },
    ];
  }).flat();
  const snapshot = {
    version: 2, accountId: digit.repeat(64), kind: "real", account, currency, balance: 10000, equity: 10020, margin: 250, freeMargin: 9770,
    capturedAt, historyFrom: date(30 * 1440), pipSizes: { EURUSD: .0001, GBPUSD: .0001 }, deals,
    positions: [
      { id: "7", symbol: "EURUSD", side: "buy", magic: "12", volume: .5, profit: 55 },
      { id: "8", symbol: "GBPUSD", side: "sell", magic: "12", volume: .3, profit: -35 },
      { id: "9", symbol: "USDCHF", side: "buy", magic: "0", volume: .1, profit: 0 },
    ],
    orders: [{ id: "10", symbol: "GBPUSD", type: "Buy Limit", magic: "12", volume: .1, price: 1.17, time: date(30) }],
  };
  await page.goto(`${base}#mt5`);
  await page.getByLabel("Snapshot JSON").setInputFiles({ name: "mt5-test.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(snapshot)) });
  await page.getByRole("row").filter({ hasText: account }).waitFor();
  return snapshot;
}
