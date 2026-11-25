"""Read account data from the local MetaTrader 5 terminal."""

import argparse
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from hmac import compare_digest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import tempfile
from threading import Event, Lock, Thread
from urllib.parse import urlsplit


HOST = "127.0.0.1"
PORT = 8765
SNAPSHOT_PATH = "/api/mt5/snapshot"
PREVIEW_ORIGIN = "https://emil2699-lab.github.io"
MAX_SNAPSHOT = 12 * 1024 * 1024


def utc(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def capture(mt5, args, pips, expected_account=None):
    connected = mt5.initialize(str(args.terminal.resolve()), timeout=10000) if args.terminal else mt5.initialize(timeout=10000)
    if not connected:
        raise RuntimeError(f"Could not connect to the terminal: {mt5.last_error()}")
    try:
        account = mt5.account_info()
        terminal = mt5.terminal_info()
        if account is None or not terminal or not terminal.connected:
            raise RuntimeError(f"Terminal disconnected or account unavailable: {mt5.last_error()}")
        account_id = sha256(f"{account.server.casefold()}\0{account.login}".encode()).hexdigest()
        if expected_account is not None and account_id != expected_account:
            raise RuntimeError("Terminal switched accounts. Restart the connector for the new account.")

        to = datetime.now(timezone.utc)
        since = to - timedelta(days=args.days)
        deals = mt5.history_deals_get(since, to)
        positions = mt5.positions_get()
        orders = mt5.orders_get()
        final_account = mt5.account_info()
        final_terminal = mt5.terminal_info()
        if deals is None or positions is None or orders is None or final_account is None or not final_terminal or not final_terminal.connected:
            raise RuntimeError(f"Incomplete snapshot: {mt5.last_error()}")
        if (account.login, account.server) != (final_account.login, final_account.server):
            raise RuntimeError("The terminal switched accounts while reading. Try again.")
        if len(deals) > 50000 or len(positions) > 10000 or len(orders) > 10000:
            raise RuntimeError("Snapshot exceeds dashboard limits. Reduce --days.")

        direction = {mt5.DEAL_TYPE_BUY: "buy", mt5.DEAL_TYPE_SELL: "sell"}
        entry = {mt5.DEAL_ENTRY_IN: "in", mt5.DEAL_ENTRY_OUT: "out", mt5.DEAL_ENTRY_OUT_BY: "out"}
        types = {
            mt5.ORDER_TYPE_BUY: "Acquisto", mt5.ORDER_TYPE_SELL: "Vendita",
            mt5.ORDER_TYPE_BUY_LIMIT: "Buy Limit", mt5.ORDER_TYPE_SELL_LIMIT: "Sell Limit",
            mt5.ORDER_TYPE_BUY_STOP: "Buy Stop", mt5.ORDER_TYPE_SELL_STOP: "Sell Stop",
            mt5.ORDER_TYPE_BUY_STOP_LIMIT: "Buy Stop Limit", mt5.ORDER_TYPE_SELL_STOP_LIMIT: "Sell Stop Limit",
        }
        mode = {mt5.ACCOUNT_TRADE_MODE_REAL: "real", mt5.ACCOUNT_TRADE_MODE_DEMO: "demo", mt5.ACCOUNT_TRADE_MODE_CONTEST: "contest"}
        captured_at = datetime.now(timezone.utc)
        return {
            "version": 2, "account": args.account, "accountId": account_id,
            "kind": mode.get(final_account.trade_mode, "unknown"), "currency": final_account.currency.upper(),
            "balance": final_account.balance, "equity": final_account.equity,
            "margin": final_account.margin, "freeMargin": final_account.margin_free,
            "capturedAt": utc(captured_at.timestamp()), "historyFrom": utc(since.timestamp()), "pipSizes": pips,
            "positions": [{
                "id": str(position.identifier), "symbol": position.symbol,
                "side": {mt5.POSITION_TYPE_BUY: "buy", mt5.POSITION_TYPE_SELL: "sell"}[position.type],
                "magic": str(position.magic), "volume": position.volume, "profit": position.profit,
            } for position in positions],
            "orders": [{
                "id": str(order.ticket), "symbol": order.symbol, "type": types.get(order.type, "Altro"),
                "time": utc(order.time_setup_msc / 1000), "magic": str(order.magic),
                "volume": order.volume_current, "price": order.price_open,
            } for order in orders],
            "deals": [{
                "id": str(deal.ticket), "position": str(deal.position_id),
                "symbol": deal.symbol, "time": utc(deal.time_msc / 1000), "magic": str(deal.magic),
                "entry": entry.get(deal.entry, "other"), "side": direction.get(deal.type, "other"),
                "price": deal.price, "volume": deal.volume, "profit": deal.profit,
                "commission": deal.commission, "swap": deal.swap, "fee": deal.fee,
            } for deal in deals],
        }
    finally:
        mt5.shutdown()


def encode(snapshot):
    data = json.dumps(snapshot, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()
    if len(data) > MAX_SNAPSHOT:
        raise RuntimeError("Snapshot exceeds 12 MB. Reduce --days.")
    return data


def write_snapshot(target, data):
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", dir=target.parent, delete=False) as temp:
            temp_name = temp.name
            temp.write(data)
        os.replace(temp_name, target)
    finally:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)


class LatestSnapshot:
    def __init__(self):
        self.lock = Lock()
        self.response = (503, b'{"error":"MT5 non disponibile."}', "")

    def poll(self, stop, mt5, args, pips):
        account = None
        previous_error = None
        while not stop.is_set():
            try:
                snapshot = capture(mt5, args, pips, account)
                data = encode(snapshot)
                account = snapshot["accountId"]
                result = (200, data, '"' + sha256(data).hexdigest() + '"')
                if previous_error:
                    print("MT5 reconnected.", flush=True)
                previous_error = None
            except (RuntimeError, OSError, ValueError) as error:
                if str(error) != previous_error:
                    print(f"MT5: {error}", flush=True)
                previous_error = str(error)
                result = (503, b'{"error":"MT5 non disponibile."}', "")
            with self.lock:
                self.response = result
            stop.wait(15)


def serve(mt5, args, pips):
    token = secrets.token_urlsafe(32)
    latest = LatestSnapshot()
    authority = f"{HOST}:{PORT}"
    local_origin = f"http://{authority}"
    origins = {local_origin, PREVIEW_ORIGIN}
    dashboard = args.dashboard.resolve() if args.dashboard else None

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *values):
            super().__init__(*values, directory=str(dashboard) if dashboard else None)

        def allowed_host(self):
            return self.headers.get("Host") == authority

        def send_snapshot(self, status, data=b"", etag=""):
            self.send_response(status)
            origin = self.headers.get("Origin")
            if origin in origins:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Access-Control-Expose-Headers", "ETag")
            self.send_header("Vary", "Origin")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Type", "application/json")
            self.send_header("X-Content-Type-Options", "nosniff")
            if etag:
                self.send_header("ETag", etag)
            if status != 304:
                self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            if data and self.command != "HEAD":
                self.wfile.write(data)

        def do_OPTIONS(self):
            origin = self.headers.get("Origin")
            if self.path != SNAPSHOT_PATH or not self.allowed_host() or origin not in origins:
                return self.send_snapshot(403)
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET")
            self.send_header("Access-Control-Allow-Headers", "Authorization, If-None-Match")
            if self.headers.get("Access-Control-Request-Private-Network") == "true":
                self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Max-Age", "600")
            self.send_header("Vary", "Origin")
            self.end_headers()

        def do_GET(self):
            if urlsplit(self.path).path == SNAPSHOT_PATH:
                auth = self.headers.get("Authorization", "")
                origin = self.headers.get("Origin")
                cross_site = self.headers.get("Sec-Fetch-Site") == "cross-site"
                if (self.path != SNAPSHOT_PATH or not self.allowed_host()
                        or (origin is not None and origin not in origins) or (cross_site and origin != PREVIEW_ORIGIN)):
                    return self.send_snapshot(403)
                if not auth.isascii() or not compare_digest(auth, f"Bearer {token}"):
                    return self.send_snapshot(401)
                with latest.lock:
                    status, data, etag = latest.response
                if etag and self.headers.get("If-None-Match") == etag:
                    return self.send_snapshot(304, etag=etag)
                return self.send_snapshot(status, data, etag)
            if not self.static_path_allowed():
                return self.send_error(404)
            super().do_GET()

        def do_HEAD(self):
            if not self.static_path_allowed():
                return self.send_error(404)
            super().do_HEAD()

        def static_path_allowed(self):
            if not dashboard or not self.allowed_host() or urlsplit(self.path).path == SNAPSHOT_PATH:
                return False
            path = Path(self.translate_path(self.path)).resolve()
            return path.is_relative_to(dashboard) and (
                path.is_file() or path.is_dir() and (path / "index.html").resolve() == path / "index.html"
                and (path / "index.html").is_file()
            )

        def log_request(self, code="-", size="-"):
            # Local access codes travel only in the Authorization header.
            pass

    with ThreadingHTTPServer((HOST, PORT), Handler) as server:
        stop = Event()
        worker = Thread(target=latest.poll, args=(stop, mt5, args, pips), daemon=True)
        worker.start()
        print(f"BlueSpherix read-only connector at {local_origin}\nAccess code: {token}", flush=True)
        if dashboard:
            print(f"Open {local_origin}/#mt5", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            stop.set()
            worker.join(timeout=11)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--account", required=True, help="Display name for this account")
    target = cli.add_mutually_exclusive_group(required=True)
    target.add_argument("--output", type=Path, help="Write one JSON snapshot")
    target.add_argument("--serve", action="store_true", help="Start the private local dashboard connector")
    cli.add_argument("--dashboard", type=Path, help="Serve the local Next.js out directory for same-origin browser access")
    cli.add_argument("--terminal", type=Path, help="Path to terminal64.exe, for computers with multiple installations")
    cli.add_argument("--days", type=int, default=90)
    cli.add_argument("--pip", action="append", default=[], metavar="SYMBOL=SIZE", help="Broker pip size, repeat per symbol")
    args = cli.parse_args()
    args.account = args.account.strip()
    if not args.account or len(args.account) > 100 or not 1 <= args.days <= 3650:
        cli.error("Use a non-empty account name up to 100 characters and between 1 and 3650 days.")
    if args.dashboard and (not args.serve or not (args.dashboard / "index.html").is_file()):
        cli.error("--dashboard requires --serve and a local static build directory containing index.html.")

    pips = {}
    for item in args.pip:
        try:
            symbol, size = item.split("=", 1)
            size = float(size)
            if not 0 < len(symbol) <= 100 or not 0 < size < float("inf"):
                raise ValueError()
            pips[symbol] = size
        except ValueError:
            cli.error("Each --pip argument must be SYMBOL=SIZE with a positive finite size.")

    try:
        import MetaTrader5 as mt5
    except ImportError:
        cli.error("Install MetaTrader5 in Python on the Windows computer running the terminal.")
    try:
        if args.serve:
            serve(mt5, args, pips)
        else:
            snapshot = capture(mt5, args, pips)
            write_snapshot(args.output.resolve(), encode(snapshot))
            print(f"Exported {len(snapshot['deals'])} deals and {len(snapshot['positions'])} open positions.")
    except (RuntimeError, OSError, ValueError) as error:
        cli.exit(1, f"MT5: {error}\n")


if __name__ == "__main__":
    main()
