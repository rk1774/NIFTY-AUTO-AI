
from math import exp

from fastapi import FastAPI
from pydantic import BaseModel, Field


app = FastAPI(
    title="NIFTY AUTO AI",
    version="6.0.0",
    description="NIFTY 50 risk settings and next-day gap prediction demo API"
)


# ---------------------------------
# DEFAULT RISK SETTINGS
# ---------------------------------

class RiskSettings(BaseModel):
    capital: int = Field(default=25000, ge=0, le=1000000)
    risk_per_trade: int = Field(default=600, ge=0)
    daily_loss_limit: int = Field(default=2000, ge=0)
    max_trades_per_day: int = Field(default=3, ge=1, le=50)
    max_open_positions: int = Field(default=1, ge=1, le=1)
    min_signal_score: int = Field(default=75, ge=0, le=100)


# ---------------------------------
# GAP PREDICTION INPUTS
# ---------------------------------

class GapInputs(BaseModel):
    trend_score: float = Field(default=0, ge=-1, le=1)
    global_score: float = Field(default=0, ge=-1, le=1)
    gift_nifty_score: float = Field(default=0, ge=-1, le=1)
    volatility_score: float = Field(default=0, ge=-1, le=1)


# ---------------------------------
# HEALTH CHECK
# ---------------------------------

@app.get("/health")
def health():
    return {
        "app": "NIFTY AUTO AI",
        "version": "V6",
        "status": "starter",
        "market_data": "not_connected",
        "angel_one": "not_connected",
        "live_trading": False
    }


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
        "settings": RiskSettings().model_dump()
    }


# ---------------------------------
# RISK VALIDATION
# ---------------------------------

@app.post("/risk/validate")
def validate_risk(settings: RiskSettings):

    if settings.capital == 0:
        return {
            "valid": True,
            "new_entries_enabled": False,
            "message": "Capital is zero. New entries are disabled."
        }

    if settings.risk_per_trade > settings.capital:
        return {
            "valid": False,
            "reason": "Risk per trade cannot exceed capital."
        }

    if settings.daily_loss_limit > settings.capital:
        return {
            "valid": False,
            "reason": "Daily loss limit cannot exceed capital."
        }

    return {
        "valid": True,
        "new_entries_enabled": True,
        "settings": settings.model_dump()
    }


# ---------------------------------
# NEXT DAY GAP PREDICTION
# ---------------------------------

def score_gap(inputs: GapInputs):

    score = (
        inputs.trend_score * 0.35
        + inputs.global_score * 0.25
        + inputs.gift_nifty_score * 0.30
        + inputs.volatility_score * 0.10
    )

    # Convert demo scores into indicative percentages.
    # These are NOT statistically calibrated probabilities.

    up_logit = score * 2.5
    down_logit = -score * 2.5
    flat_logit = 0.0

    values = [up_logit, down_logit, flat_logit]
    max_value = max(values)

    weights = [
        exp(value - max_value)
        for value in values
    ]

    total = sum(weights)

    probabilities = {
        "GAP_UP": round(weights[0] / total * 100, 1),
        "GAP_DOWN": round(weights[1] / total * 100, 1),
        "FLAT": round(weights[2] / total * 100, 1)
    }

    prediction = max(
        probabilities,
        key=probabilities.get
    )

    return {
        "prediction": prediction,
        "score": round(score, 3),
        "probabilities_percent": probabilities,
        "confidence_percent": max(probabilities.values()),
        "status": "demo_only",
        "live_data_connected": False,
        "warning": (
            "Demo estimates only. "
            "Not calibrated or based on live market data. "
            "Do not use alone for trading decisions."
        )
    }


@app.post("/gap/score")
def gap_score(inputs: GapInputs):
    return score_gap(inputs)
