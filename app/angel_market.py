import os
import threading
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pyotp
from SmartApi import SmartConnect


IST = ZoneInfo("Asia/Kolkata")


class AngelMarket:

    def __init__(self):
        self.client = None
        self.lock = threading.RLock()
        self.connected_at = None

    def configured(self):
        return all(
            os.getenv(key)
            for key in (
                "ANGEL_API_KEY",
                "ANGEL_CLIENT_ID",
                "ANGEL_PIN",
                "ANGEL_TOTP_SECRET"
            )
        )

    def connect(self):

        with self.lock:

            if self.client is not None:
                return self.client

            if not self.configured():
                raise RuntimeError(
                    "Angel One credentials not configured"
                )

            try:
                client = SmartConnect(
                    api_key=os.environ["ANGEL_API_KEY"]
                )

                otp = pyotp.TOTP(
                    os.environ["ANGEL_TOTP_SECRET"]
                ).now()

                session = client.generateSession(
                    os.environ["ANGEL_CLIENT_ID"],
                    os.environ["ANGEL_PIN"],
                    otp
                )

                if not session or not session.get("status"):
                    raise RuntimeError("Login failed")

                self.client = client
                self.connected_at = datetime.now(IST)

                return self.client

            except Exception:
                self.client = None
                self.connected_at = None

                raise RuntimeError(
                    "Angel One connection failed"
                ) from None

    def status(self):

        return {
            "configured": self.configured(),
            "session_initialized": self.client is not None,
            "mode": "READ_ONLY",
            "live_trading": False,
            "naked_selling": False
        }

    def get_ltp(self, exchange, symbol, token):

        with self.lock:

            client = self.connect()

            response = client.ltpData(
                exchange,
                symbol,
                str(token)
            )

            if not response or not response.get("status"):
                raise RuntimeError(
                    "Market quote unavailable"
                )

            data = response.get("data") or {}

            if data.get("ltp") is None:
                raise RuntimeError(
                    "Invalid market quote"
                )

            return {
                "exchange": exchange,
                "symbol": symbol,
                "token": str(token),
                "price": data["ltp"],
                "received_at": datetime.now(IST).isoformat()
            }

    def get_candles(
        self,
        exchange,
        token,
        interval="FIVE_MINUTE",
        days=10
    ):

        allowed = {
            "ONE_MINUTE",
            "THREE_MINUTE",
            "FIVE_MINUTE",
            "FIFTEEN_MINUTE",
            "THIRTY_MINUTE",
            "ONE_HOUR",
            "ONE_DAY"
        }

        if interval not in allowed:
            raise ValueError(
                "Invalid timeframe"
            )

        if not 1 <= days <= 10:
            raise ValueError(
                "Invalid date range"
            )

        now = datetime.now(IST)
        start = now - timedelta(days=days)

        params = {
            "exchange": exchange,
            "symboltoken": str(token),
            "interval": interval,
            "fromdate": start.strftime(
                "%Y-%m-%d %H:%M"
            ),
            "todate": now.strftime(
                "%Y-%m-%d %H:%M"
            )
        }

        with self.lock:

            client = self.connect()

            response = client.getCandleData(
                params
            )

            if not response or not response.get("status"):
                raise RuntimeError(
                    "Historical candle data unavailable"
                )

            candles = []

            for row in response.get("data") or []:

                if len(row) < 6:
                    continue

                candles.append({
                    "time": row[0],
                    "open": row[1],
                    "high": row[2],
                    "low": row[3],
                    "close": row[4],
                    "volume": row[5]
                })

            return candles

    def disconnect(self):

        with self.lock:

            try:
                if self.client is not None:

                    response = self.client.terminateSession(
                        os.environ["ANGEL_CLIENT_ID"]
                    )

                    if not response or not response.get("status"):
                        raise RuntimeError(
                            "Broker logout not confirmed"
                        )

            finally:
                self.client = None
                self.connected_at = None


angel_market = AngelMarket()

def get_bulk_quotes(tokens):

    if not isinstance(tokens, list):
        raise ValueError("Invalid tokens")

    tokens = list(dict.fromkeys(
        str(t) for t in tokens
    ))

    if not 1 <= len(tokens) <= 50:
        raise ValueError("Maximum 50 tokens")

    if not all(
        t.isascii() and t.isdigit()
        and len(t) <= 15
        for t in tokens
    ):
        raise ValueError("Invalid token")

    with angel_market.lock:

        client = angel_market.connect()

        response = client.getMarketData(
            "FULL",
            {"NSE": tokens}
        )

        if not response or not response.get("status"):
            raise RuntimeError(
                "Stock quotes unavailable"
            )

        data = response.get("data") or {}

        return {
            "quotes": data.get("fetched") or [],
            "unfetched": data.get("unfetched") or [],
            "received_at": datetime.now(IST).isoformat(),
            "source": "Angel One",
            "live_trading": False
        }
