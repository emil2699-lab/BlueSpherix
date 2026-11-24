"""Export a snapshot from the MetaTrader 5 terminal already open on this computer."""

import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import tempfile


def utc(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--account", required=True, help="Local display name to include in the exported file")
    cli.add_argument("--output", type=Path, required=True)
    cli.add_argument("--days", type=int, default=90)
    cli.add_argument("--pip", action="append", default=[], metavar="SYMBOL=SIZE", help="Broker pip size, repeat per symbol")
    args = cli.parse_args()
    if not args.account.strip() or len(args.account) > 100 or not 1 <= args.days <= 3650:
        cli.error("Use a non-empty account name up to 100 characters and between 1 and 3650 days.")
    pips = {}
    for item in args.pip:
        try:
            symbol, size = item.split("=", 1)
            size = float(size)
            if not symbol or not 0 < size < float("inf"):
                raise ValueError()
            pips[symbol] = size
        except ValueError:
            cli.error("Each --pip argument must be SYMBOL=SIZE with a positive finite size.")

    import MetaTrader5 as mt5

    if not mt5.initialize():
        raise SystemExit(f"Could not connect to the open terminal: {mt5.last_error()}")
    try:
        account = mt5.account_info()
        if account is None:
            raise SystemExit(f"Could not read account: {mt5.last_error()}")
        to = datetime.now(timezone.utc)
        since = to - timedelta(days=args.days)
        deals = mt5.history_deals_get(since, to)
        positions = mt5.positions_get()
        final_account = mt5.account_info()
        if deals is None or positions is None or final_account is None:
            raise SystemExit(f"Incomplete snapshot: {mt5.last_error()}")
        if (account.login, account.server) != (final_account.login, final_account.server):
            raise SystemExit("The terminal switched accounts while exporting. Run the export again.")

        def deal_row(deal):
            return {
                "id": str(deal.ticket), "position": str(deal.position_id),
                "symbol": deal.symbol, "time": utc(deal.time_msc / 1000), "magic": str(deal.magic),
                "entry": {mt5.DEAL_ENTRY_IN: "in", mt5.DEAL_ENTRY_OUT: "out"}.get(deal.entry, "other"),
                "side": {mt5.DEAL_TYPE_BUY: "buy", mt5.DEAL_TYPE_SELL: "sell"}.get(deal.type, "other"),
                "price": deal.price, "volume": deal.volume, "profit": deal.profit,
                "commission": deal.commission, "swap": deal.swap, "fee": deal.fee,
            }

        snapshot = {
            "version": 1, "account": args.account.strip(), "currency": final_account.currency.upper(),
            "balance": final_account.balance, "equity": final_account.equity,
            "capturedAt": utc(to.timestamp()), "historyFrom": utc(since.timestamp()), "pipSizes": pips,
            "positions": [{
                "id": str(position.identifier), "symbol": position.symbol,
                "side": {mt5.POSITION_TYPE_BUY: "buy", mt5.POSITION_TYPE_SELL: "sell"}[position.type],
                "magic": str(position.magic), "volume": position.volume, "profit": position.profit,
            } for position in positions],
            "deals": [deal_row(deal) for deal in deals],
        }
    finally:
        mt5.shutdown()

    target = args.output.resolve()
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent, delete=False) as temp:
            temp_name = temp.name
            json.dump(snapshot, temp, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        os.replace(temp_name, target)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)
    print(f"Exported {len(snapshot['deals'])} deals and {len(snapshot['positions'])} open positions.")


if __name__ == "__main__":
    main()
