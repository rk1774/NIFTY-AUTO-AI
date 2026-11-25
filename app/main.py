
import os
import secrets
import json

from math import exp
from typing import Literal
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from fastapi import (
    FastAPI,
    HTTPException,
    Header,
    Depends,
    Query
)

from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .angel_market import angel_market


app = FastAPI(
    title="NIFTY AUTO AI",
    version="8.1.0",
    description="NIFTY AUTO AI Secure Market Backend"
)


# =================================
# APP CONFIGURATION
# =================================

SUPABASE_URL = (
    "https://lfgsdwyhdmgbzqyajygn.supabase.co"
)

SUPABASE_KEY = (
    "sb_publishable_xh_kMZivJLtggIw7jofxFA_ET3QzTx7"
)

APP_ORIGIN = "https://rk1774.github.io"


# =================================
# CORS SECURITY
# =================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[APP_ORIGIN],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "x-api-key"
    ],
    max_age=600
)


# =================================
# API SECURITY
# =================================

def verify_access(
    x_api_key: str = Header(default="")
):

    expected = os.getenv("MARKET_ACCESS_KEY")

    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Market access not configured"
        )

    if not secrets.compare_digest(
        x_api_key.encode(),
        expected.encode()
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized"
        )

    return True


# =================================
# SUPABASE USER VERIFICATION
# =================================

def verify_app_user(
    authorization: str = Header(default="")
):

    owner_id = os.getenv(
        "APP_OWNER_USER_ID", ""
    ).strip()

    if not owner_id:
        raise HTTPException(
            status_code=503,
            detail="App owner not configured"
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Login required"
        )

    token = authorization[7:].strip()

    if not token or len(token) > 16384:
        raise HTTPException(
            status_code=401,
            detail="Invalid session"
        )

    request = Request(
        SUPABASE_URL + "/auth/v1/user",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + token,
            "Accept": "application/json"
        },
        method="GET"
    )

    try:

        with urlopen(request, timeout=10) as response:
            user = json.loads(response.read())

    except HTTPError as error:

        if error.code in (400, 401, 403):
            raise HTTPException(
                status_code=401,
                detail="Session expired or invalid"
            )

        raise HTTPException(
            status_code=503,
            detail="Authentication unavailable"
        )

    except Exception:

        raise HTTPException(
            status_code=503,
            detail="Authentication unavailable"
        )

    if not isinstance(user, dict):
        raise HTTPException(
            status_code=401,
            detail="Invalid user"
        )

    user_id = user.get("id")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid user"
        )

    if user_id != owner_id:
        raise HTTPException(
            status_code=403,
            detail="Market access restricted"
        )

    return user_id


# =================================
# RISK SETTINGS
# =================================

class RiskSettings(BaseModel):

    capital: int = Field(
        default=25000, ge=0, le=1000000
    )

    risk_per_trade: int = Field(
        default=600, ge=0
    )

    daily_loss_limit: int = Field(
        default=2000, ge=0
    )

    max_trades_per_day: int = Field(
        default=3, ge=1, le=3
    )

    max_open_positions: int = Field(
        default=1, ge=1, le=1
    )

    min_signal_score: int = Field(
        default=75, ge=75, le=100
    )


class GapInputs(BaseModel):

    trend_score: float = Field(
        default=0, ge=-1, le=1
    )

    global_score: float = Field(
        default=0, ge=-1, le=1
    )

    gift_nifty_score: float = Field(
        default=0, ge=-1, le=1
    )

    volatility_score: float = Field(
        default=0, ge=-1, le=1
    )


# =================================
# HEALTH CHECK
# =================================

@app.get("/")
def home():

    return {
        "app": "NIFTY AUTO AI",
        "version": "V8.1 PRO",
        "mode": "READ_ONLY",
        "live_trading": False
    }


@app.get("/health")
def health():

    return {
        "app": "NIFTY AUTO AI",
        "version": "V8.1 PRO",
        "status": "running",
        "market_configured": angel_market.configured(),
        "app_owner_configured": bool(
            os.getenv("APP_OWNER_USER_ID")
        ),
        "market_data": "verification_required",
        "maximum_candle_days": 10,
        "live_trading": False,
        "naked_selling": False
    }


# =================================
# MARKET STATUS
# =================================

@app.get(
    "/market/status",
    dependencies=[Depends(verify_access)]
)
def market_status():

    return angel_market.status()


# =================================
# ANGEL ONE CONNECTION
# =================================

@app.post(
    "/market/connect",
    dependencies=[Depends(verify_access)]
)
def market_connect():

    try:

        angel_market.connect()

        return {
            "status": "session_initialized",
            "broker": "Angel One",
            "mode": "READ_ONLY",
            "live_trading": False
        }

    except Exception:

        raise HTTPException(
            status_code=503,
            detail="Angel One connection failed"
        )


# =================================
# MARKET PRICE
# =================================

@app.get(
    "/market/ltp",
    dependencies=[Depends(verify_access)]
)
def market_ltp(

    exchange: Literal["NSE", "NFO"] = "NSE",

    symbol: str = Query(
        min_length=1,
        max_length=60
    ),

    token: str = Query(
        pattern=r"^[0-9]{1,15}$"
    )

):

    try:

        return angel_market.get_ltp(
            exchange,
            symbol,
            token
        )

    except Exception:

        raise HTTPException(
            status_code=503,
            detail="Market price unavailable"
        )


# =================================
# CANDLE DATA
# =================================

def fetch_candles(
    exchange,
    token,
    interval,
    days
):

    try:

        candles = angel_market.get_candles(
            exchange,
            token,
            interval,
            days
        )

        return {
            "exchange": exchange,
            "token": token,
            "interval": interval,
            "days": days,
            "count": len(candles),
            "minimum_required": 200,
            "minimum_candle_count_met": (
                len(candles) >= 200
            ),
            "candles": candles,
            "source": "Angel One",
            "live_trading": False
        }

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail="Invalid candle parameters"
        )

    except Exception:

        raise HTTPException(
            status_code=503,
            detail="Candle data unavailable"
        )


@app.get(
    "/market/candles",
    dependencies=[Depends(verify_access)]
)
def market_candles(

    exchange: Literal["NSE", "NFO"] = "NSE",

    token: str = Query(
        pattern=r"^[0-9]{1,15}$"
    ),

    interval: str = "FIVE_MINUTE",

    days: int = Query(
        default=10,
        ge=1,
        le=10
    )

):

    return fetch_candles(
        exchange,
        token,
        interval,
        days
    )


# =================================
# SECURE MOBILE APP STATUS
# =================================

@app.get(
    "/app/market/status",
    dependencies=[Depends(verify_app_user)]
)
def app_market_status():

    return angel_market.status()


# =================================
# SECURE MOBILE APP NIFTY PRICE
# =================================

@app.get(
    "/app/market/ltp",
    dependencies=[Depends(verify_app_user)]
)
def app_market_ltp():

    try:

        return angel_market.get_ltp(
            "NSE",
            "NIFTY",
            "99926000"
        )

    except Exception:

        raise HTTPException(
            status_code=503,
            detail="NIFTY price unavailable"
        )


# =================================
# SECURE MOBILE APP CANDLES
# =================================

@app.get(
    "/app/market/candles",
    dependencies=[Depends(verify_app_user)]
)
def app_market_candles(

    interval: Literal[
        "ONE_MINUTE",
        "THREE_MINUTE",
        "FIVE_MINUTE",
        "FIFTEEN_MINUTE",
        "THIRTY_MINUTE",
        "ONE_HOUR",
        "ONE_DAY"
    ] = "FIVE_MINUTE",

    days: int = Query(
        default=10,
        ge=1,
        le=10
    )

):

    return fetch_candles(
        "NSE",
        "99926000",
        interval,
        days
    )


# =================================
# BROKER DISCONNECT
# =================================

@app.post(
    "/market/disconnect",
    dependencies=[Depends(verify_access)]
)
def market_disconnect():

    try:

        angel_market.disconnect()

        return {
            "status": "disconnected",
            "live_trading": False
        }

    except Exception:

        raise HTTPException(
            status_code=503,
            detail="Broker logout not confirmed"
        )


# =================================
# DEFAULT CONFIGURATION
# =================================

@app.get("/config/defaults")
def defaults():

    return {
        "index": "NIFTY 50",
        "timeframe": "5m",
        "broker": "Angel One",
        "option_modes": [
            "buying",
            "hedged_defined_risk_selling"
        ],
        "naked_selling": False,
        "live_trading": False,
        "auto_trading": False,
        "settings": RiskSettings().model_dump()
    }


# =================================
# RISK VALIDATION
# =================================

@app.post("/risk/validate")
def validate_risk(settings: RiskSettings):

    if (
        settings.capital == 0
        or settings.risk_per_trade == 0
        or settings.daily_loss_limit == 0
    ):

        return {
            "valid": True,
            "new_entries_enabled": False,
            "live_trading": False
        }

    if settings.risk_per_trade > settings.capital:

        return {
            "valid": False,
            "reason": "Trade risk exceeds capital"
        }

    if settings.daily_loss_limit > settings.capital:

        return {
            "valid": False,
            "reason": "Daily loss exceeds capital"
        }

    if (
        settings.risk_per_trade
        > settings.daily_loss_limit
    ):

        return {
            "valid": False,
            "reason": "Trade risk exceeds daily loss limit"
        }

    return {
        "valid": True,
        "new_entries_enabled": False,
        "risk_settings_valid": True,
        "live_trading": False,
        "settings": settings.model_dump()
    }


# =================================
# GAP AI DEMO
# =================================

def score_gap(inputs: GapInputs):

    score = (
        inputs.trend_score * 0.35
        + inputs.global_score * 0.25
        + inputs.gift_nifty_score * 0.30
        + inputs.volatility_score * 0.10
    )

    values = [
        score * 2.5,
        -score * 2.5,
        0.0
    ]

    max_value = max(values)

    weights = [
        exp(value - max_value)
        for value in values
    ]

    total = sum(weights)

    probabilities = {

        "GAP_UP": round(
            weights[0] / total * 100, 1
        ),

        "GAP_DOWN": round(
            weights[1] / total * 100, 1
        ),

        "FLAT": round(
            weights[2] / total * 100, 1
        )
    }

    prediction = (
        "UNDETERMINED"
        if abs(score) < 0.000001
        else max(
            probabilities,
            key=probabilities.get
        )
    )

    return {
        "prediction": prediction,
        "score": round(score, 3),
        "probabilities_percent": probabilities,
        "confidence_percent": max(
            probabilities.values()
        ),
        "status": "demo_only",
        "live_data_connected": False,
        "warning": (
            "Demo scores only. "
            "Not statistically calibrated. "
            "Not for live trading decisions."
        )
    }


@app.post("/gap/score")
def gap_score(inputs: GapInputs):

    return score_gap(inputs)

# =================================
# SECURE STOCK SCANNER API
# =================================

from .angel_market import get_bulk_quotes

import time

scanner_lock = __import__("threading").Lock()
scanner_last_request = 0.0


class ScannerRequest(BaseModel):

    tokens: list[str] = Field(
        min_length=1,
        max_length=50
    )


@app.post(
    "/app/market/scanner",
    dependencies=[Depends(verify_app_user)]
)
def app_market_scanner(
    request: ScannerRequest
):

    global scanner_last_request

    with scanner_lock:

        now = time.monotonic()

        if now - scanner_last_request < 2:

            raise HTTPException(
                status_code=429,
                detail="Please wait before refreshing"
            )

        scanner_last_request = now

        try:

            result = get_bulk_quotes(
                request.tokens
            )

            return {
                "status": "success",
                "mode": "READ_ONLY",
                "source": "Angel One",
                "count": len(result["quotes"]),
                "quotes": result["quotes"],
                "unfetched": result["unfetched"],
                "received_at": result["received_at"],
                "live_trading": False,
                "naked_selling": False
            }

        except ValueError:

            raise HTTPException(
                status_code=400,
                detail="Invalid stock tokens"
            )

        except Exception:

            raise HTTPException(
                status_code=503,
                detail="Stock scanner data unavailable"
            )
            
# =================================
# V8.2 AUTOMATIC NIFTY 50 UNIVERSE
# =================================

import csv
import io
import threading
import gzip

universe_lock = threading.Lock()
universe_cache = None
universe_expiry = 0

NIFTY_LIST_URL = (
    "https://www.niftyindices.com/"
    "IndexConstituent/ind_nifty50list.csv"
)

ANGEL_MASTER_URL = (
    "https://margincalculator.angelone.in/"
    "OpenAPI_File/files/OpenAPIScripMaster.json"
)


def download_source(url, limit):

    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*"
        }
    )

    with urlopen(request, timeout=45) as response:

        raw = response.read(limit + 1)

        if len(raw) > limit:
            raise ValueError("Source too large")

        if raw.startswith(b"\x1f\x8b"):

            with gzip.GzipFile(
                fileobj=io.BytesIO(raw)
            ) as stream:

                raw = stream.read(limit + 1)

        if len(raw) > limit:
            raise ValueError("Source too large")

        return raw.decode("utf-8-sig")


def load_nifty50_universe():

    global universe_cache
    global universe_expiry

    with universe_lock:

        now = time.monotonic()

        if (
            universe_cache is not None
            and now < universe_expiry
        ):
            return universe_cache

        csv_text = download_source(
            NIFTY_LIST_URL,
            2000000
        )

        constituents = list(
            csv.DictReader(
                io.StringIO(csv_text)
            )
        )

        symbols = {}

        for row in constituents:

            symbol = str(
                row.get("Symbol") or ""
            ).strip().upper()

            company = str(
                row.get("Company Name") or ""
            ).strip()

            series = str(
                row.get("Series") or ""
            ).strip().upper()

            if symbol and series == "EQ":
                symbols[symbol] = company

        if len(symbols) != 50:
            raise ValueError(
                "NIFTY 50 list incomplete"
            )

        master_text = download_source(
            ANGEL_MASTER_URL,
            100000000
        )

        instruments = json.loads(master_text)

        if not isinstance(instruments, list):
            raise ValueError(
                "Invalid instrument master"
            )

        matched = {}

        for item in instruments:

            exchange = str(
                item.get("exch_seg") or ""
            ).upper()

            trading_symbol = str(
                item.get("symbol") or ""
            ).upper()

            token = str(
                item.get("token") or ""
            )

            if exchange not in (
                "NSE", "NSE_CM"
            ):
                continue

            if not trading_symbol.endswith("-EQ"):
                continue

            symbol = trading_symbol[:-3]

            if symbol not in symbols:
                continue

            if (
                not token.isascii()
                or not token.isdigit()
                or len(token) > 15
            ):
                continue

            if (
                symbol in matched
                and matched[symbol]["token"] != token
            ):
                raise ValueError(
                    "Duplicate instrument mapping"
                )

            matched[symbol] = {
                "symbol": symbol,
                "company": symbols[symbol],
                "trading_symbol": trading_symbol,
                "token": token,
                "exchange": "NSE"
            }

        missing = sorted(
            set(symbols) - set(matched)
        )

        if missing:
            raise ValueError(
                "Instrument mapping incomplete"
            )

        stocks = [
            matched[symbol]
            for symbol in sorted(matched)
        ]

        if len({
            stock["token"] for stock in stocks
        }) != 50:
            raise ValueError(
                "Duplicate stock tokens"
            )

        result = {
            "status": "success",
            "universe": "NIFTY 50",
            "count": len(stocks),
            "stocks": stocks,
            "tokens": [
                stock["token"]
                for stock in stocks
            ],
            "source": (
                "Nifty Indices + Angel One"
            ),
            "mode": "READ_ONLY",
            "live_trading": False,
            "naked_selling": False
        }

        universe_cache = result
        universe_expiry = (
            time.monotonic() + 21600
        )

        return result


@app.get(
    "/app/market/universe",
    dependencies=[Depends(verify_app_user)]
)
def app_market_universe():

    try:
        return load_nifty50_universe()

    except Exception:
        raise HTTPException(
            status_code=503,
            detail=(
                "Verified NIFTY 50 universe "
                "currently unavailable"
            )
        )
