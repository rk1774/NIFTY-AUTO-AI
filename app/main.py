import os
import secrets
from math import exp
from typing import Literal

from fastapi import FastAPI, HTTPException, Header, Depends, Query
from pydantic import BaseModel, Field

from .angel_market import angel_market


app = FastAPI(
    title="NIFTY AUTO AI",
    version="8.0.0",
    description="NIFTY AUTO AI Market Data Backend"
)


# ---------------------------------
# API SECURITY
# ---------------------------------

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


# ---------------------------------
# DEFAULT RISK SETTINGS
# ---------------------------------

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
        default=3, ge=1, le=50
    )
    max_open_positions: int = Field(
        default=1, ge=1, le=1
    )
    min_signal_score: int = Field(
        default=75, ge=0, le=100
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


# ---------------------------------
# HEALTH CHECK
# ---------------------------------

@app.get("/")
def home():
    return {
        "app": "NIFTY AUTO AI",
        "version": "V8 PRO",
        "mode": "READ_ONLY",
        "live_trading": False
    }


@app.get("/health")
def health():

    return {
        "app": "NIFTY AUTO AI",
        "version": "V8 PRO",
        "status": "running",
        "market_data": "verification_required",
        "live_trading": False,
        "naked_selling": False
    }


# ---------------------------------
# ANGEL ONE STATUS
# ---------------------------------

@app.get(
    "/market/status",
    dependencies=[Depends(verify_access)]
)
def market_status():
    return angel_market.status()


# ---------------------------------
# ANGEL ONE CONNECTION
# ---------------------------------

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


# ---------------------------------
# MARKET PRICE
# ---------------------------------

@app.get(
    "/market/ltp",
    dependencies=[Depends(verify_access)]
)
def market_ltp(
    exchange: Literal["NSE", "NFO"] = "NSE",
    symbol: str = Query(
        min_length=1, max_length=60
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


# ---------------------------------
# HISTORICAL CANDLE DATA
# ---------------------------------

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
    days: int = Query(default=5, ge=1, le=5)
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
            "count": len(candles),
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


# ---------------------------------
# DISCONNECT BROKER
# ---------------------------------

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


# ---------------------------------
# DEFAULT CONFIGURATION
# ---------------------------------

@app.get("/config/defaults")
def defaults():

    return {
        "index": "NIFTY 50",
        "timeframe": "5m",
        "option_modes": [
            "buying",
            "hedged_defined_risk_selling"
        ],
        "naked_selling": False,
        "live_trading": False,
        "settings": RiskSettings().model_dump()
    }


# ---------------------------------
# RISK VALIDATION
# ---------------------------------

@app.post("/risk/validate")
def validate_risk(settings: RiskSettings):

    if (
        settings.capital == 0
        or settings.risk_per_trade == 0
        or settings.daily_loss_limit == 0
    ):
        return {
            "valid": True,
            "new_entries_enabled": False
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

    if settings.risk_per_trade > settings.daily_loss_limit:
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


# ---------------------------------
# GAP PREDICTION DEMO
# ---------------------------------

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

