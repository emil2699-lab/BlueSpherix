"""Publish a whitelisted archive of closed trades from the Notion execution ledger."""

import argparse
from datetime import datetime
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
import os
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


SOURCE_TITLE = "Esecuzioni e movimenti"
CURRENCY = "USD"
SYMBOLS = {"XAUUSD"}
FIELDS = {
    "Ticket", "Ordine", "Conto", "Simbolo", "Lato", "Entrata", "Ora originale",
    "Lotti", "Prezzo", "Profitto", "Commissione", "Swap", "Fee", "Netto",
}
AMOUNTS = {"Profitto": "profit", "Commissione": "commission", "Swap": "swap", "Fee": "fee"}
DESTINATION = Path(__file__).resolve().parents[1] / "app/data/published-trades.json"


def notion_post(token, path, payload):
    req = Request(
        f"https://api.notion.com/v1/{path}",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": "2025-09-03",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=30) as response:
            return json.load(response, parse_float=Decimal)
    except HTTPError as error:
        raise ValueError(f"Notion API: HTTP {error.code}. Check the integration and its access.") from None
    except (URLError, TimeoutError):
        raise ValueError("Notion API unavailable.") from None


def notion_pages(token, path, query):
    cursor = None
    while True:
        result = notion_post(token, path, {**query, **({"start_cursor": cursor} if cursor else {}), "page_size": 100})
        yield from result["results"]
        if not result["has_more"]:
            return
        next_cursor = result.get("next_cursor")
        if not next_cursor or next_cursor == cursor:
            raise ValueError("Incomplete Notion response.")
        cursor = next_cursor


def plain_text(parts):
    return "".join(part.get("plain_text", "") for part in parts)


def property_value(item):
    kind = item["type"]
    value = item[kind]
    if kind in {"title", "rich_text"}:
        return plain_text(value)
    if kind in {"select", "status"}:
        return (value or {}).get("name")
    if kind == "number":
        return value
    raise ValueError("Unexpected property type in the Notion execution ledger.")


def notion_rows(token):
    sources = [
        source for source in notion_pages(token, "search", {"query": SOURCE_TITLE, "filter": {"property": "object", "value": "data_source"}})
        if plain_text(source.get("title", [])) == SOURCE_TITLE
    ]
    if len(sources) != 1 or not re.fullmatch(r"[0-9a-f-]{36}", sources[0]["id"]):
        raise ValueError("Expected one accessible Notion data source named Esecuzioni e movimenti.")
    for row in notion_pages(token, f'data_sources/{sources[0]["id"]}/query', {}):
        if row.get("archived") or row.get("in_trash"):
            continue
        props = row["properties"]
        if not FIELDS <= props.keys():
            raise ValueError("Missing columns in the Notion execution ledger.")
        yield {key: property_value(props[key]) for key in FIELDS}


def decimal(value):
    if isinstance(value, bool) or not isinstance(value, (int, Decimal)):
        raise ValueError("A trading movement is missing a numeric amount.")
    result = Decimal(value)
    if not result.is_finite() or abs(result) > 1_000_000_000_000:
        raise ValueError("A numeric amount falls outside the supported range.")
    return result


def executions(rows):
    seen = {}
    accounts = set()
    for row in rows:
        entry = row["Entrata"]
        if entry == "saldo":
            continue
        symbol, side, ticket, order, account = (row[key] for key in ("Simbolo", "Lato", "Ticket", "Ordine", "Conto"))
        if entry not in {"in", "out", "out_by"} or side not in {"buy", "sell"}:
            raise ValueError("Unrecognized trading movement.")
        if symbol not in SYMBOLS or not account or not isinstance(ticket, str) or not ticket.isascii() or not ticket.isdecimal():
            raise ValueError("Unrecognized instrument, account or execution ticket.")
        if not isinstance(order, str) or not order.isascii() or not order.isdecimal():
            raise ValueError("An execution is missing its order ticket.")
        try:
            time = datetime.strptime(row["Ora originale"], "%Y.%m.%d %H:%M:%S").isoformat()
        except (ValueError, TypeError):
            raise ValueError("An execution is missing its original statement time.") from None
        volume, price = (decimal(row[key]) for key in ("Lotti", "Prezzo"))
        amounts = {key: decimal(row[source]) for source, key in AMOUNTS.items()}
        if volume <= 0 or price <= 0 or abs(sum(amounts.values()) - decimal(row["Netto"])) >= Decimal("0.01"):
            raise ValueError("An execution has inconsistent volume, price or net amounts.")
        record = (time, int(ticket), symbol, side, entry, order, volume, price, amounts)
        if ticket in seen and seen[ticket] != record:
            raise ValueError("Conflicting records for the same execution.")
        accounts.add(account)
        seen[ticket] = record
    if len(accounts) > 1:
        raise ValueError("Multiple accounts in the ledger. An explicit account and currency mapping is required.")
    return sorted(seen.values(), key=lambda row: (row[0], row[1]))


def published_trades(rows):
    pending = {}
    completed = {}
    for time, _ticket, symbol, side, entry, order, volume, price, amounts in executions(rows):
        opening_side = side if entry == "in" else {"buy": "sell", "sell": "buy"}[side]
        key = (symbol, opening_side)
        trade = pending.get(key)
        if entry == "in":
            if trade is None:
                trade = {
                    "openedAt": time, "order": order, "opened": Decimal(0), "remaining": Decimal(0),
                    "openValue": Decimal(0), "closeValue": Decimal(0),
                    **dict.fromkeys(AMOUNTS.values(), Decimal(0)),
                }
                pending[key] = trade
            elif trade["order"] != order or trade["remaining"] != trade["opened"]:
                raise ValueError("Overlapping openings require an explicit position identifier.")
            trade["opened"] += volume
            trade["remaining"] += volume
            trade["openValue"] += volume * price
        else:
            if not trade or trade["remaining"] < volume:
                raise ValueError("An exit cannot be matched to an opening.")
            trade["remaining"] -= volume
            trade["closeValue"] += volume * price
        for amount, value in amounts.items():
            trade[amount] += value
        if trade["remaining"] != 0:
            continue

        del pending[key]
        direction = "Long" if opening_side == "buy" else "Short"
        # Only already-public fields participate in this identifier.
        public_id = sha256(f'{symbol}|{direction}|{trade["openedAt"]}|{time}'.encode()).hexdigest()[:24]
        if public_id in completed:
            raise ValueError("Two distinct positions have the same public timestamps and direction.")
        completed[public_id] = {
            "id": public_id, "symbol": symbol, "side": direction,
            "openedAt": trade["openedAt"], "closedAt": time, "volume": float(trade["opened"]),
            "openPrice": float(trade["openValue"] / trade["opened"]),
            "closePrice": float(trade["closeValue"] / trade["opened"]),
            **{amount: float(trade[amount]) for amount in AMOUNTS.values()},
            "net": float(sum(trade[amount] for amount in AMOUNTS.values())),
        }
    return sorted(completed.values(), key=lambda trade: (trade["closedAt"], trade["id"]), reverse=True)


def write_archive(target, trades):
    if not trades:
        raise ValueError("No closed trades could be verified.")
    data = json.dumps({"currency": CURRENCY, "trades": trades}, indent=2, allow_nan=False) + "\n"
    if target.is_file() and target.read_text() == data:
        return False
    temp_path = None
    try:
        with NamedTemporaryFile("w", encoding="utf-8", dir=target.parent, delete=False) as temp:
            temp_path = Path(temp.name)
            temp.write(data)
        temp_path.replace(target)
    finally:
        if temp_path:
            temp_path.unlink(missing_ok=True)
    return True


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--input", type=Path, help="Private JSON list of Notion ledger rows for local import")
    cli.add_argument("--output", type=Path, default=DESTINATION)
    args = cli.parse_args()
    try:
        if args.input:
            rows = json.loads(args.input.read_text(), parse_float=Decimal)
        else:
            token = os.environ.get("NOTION_TRADE_TOKEN")
            if not token:
                raise ValueError("Set NOTION_TRADE_TOKEN to the read-only Notion integration token.")
            rows = notion_rows(token)
        trades = published_trades(rows)
        changed = write_archive(args.output, trades)
        print(f"{len(trades)} verified closed trades. {'Archive updated.' if changed else 'Archive up to date.'}")
    except (InvalidOperation, ValueError, TypeError, KeyError, OSError) as error:
        # Never log paths, raw property values, page identifiers or provider response bodies.
        detail = str(error) if type(error) is ValueError else "Invalid or incomplete source data."
        cli.exit(1, f"Closed-trade sync: {detail}\n")


if __name__ == "__main__":
    main()
