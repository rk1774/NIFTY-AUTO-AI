from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(
    title="NIFTY AUTO AI",
    version="6.0.0"
)


class RiskSettings(BaseModel):
    capital: int = Field(25000, ge=0, le=1000000)
    risk_per_trade: int = Field(600, ge=0)
    daily_loss_limit: int = Field(2000, ge=0)
    max_trades_per_day: int = Field(3, ge=1, le=50)
    max_open_positions: int = Field(1, ge=1, le=1)
    min_signal_score: int = Field(75, ge=0, le=100)


class GapInputs(BaseModel):
    trend_score: float = Field(0, ge=-1, le=1)
    global_score: float = Field(0, ge=-1, le=1)
    gift_nifty_score: float = Field(0, ge=-1, le=1)
    volatility_score: float = Field(0, ge=-1, le=1)


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


@app.post("/risk/validate")
def validate_risk(s: RiskSettings):
    if s.capital == 0:
        return {
            "valid": True,
            "new_entries_enabled": False
        }

    if s.risk_per_trade > s.capital:
        return {
            "valid": False,
            "reason": "Risk per trade exceeds capital"
        }

    if s.daily_loss_limit > s.capital:
        return {
            "valid": False,
            "reason": "Daily loss exceeds capital"
        }

    return {
        "valid": True,
        "new_entries_enabled": True,
        "settings": s.model_dump()
    }


@app.post("/gap/score")
def gap_score(x: GapInputs):
    score = (
        x.trend_score * 0.35
        + x.global_score * 0.25
        + x.gift_nifty_score * 0.30
        + x.volatility_score * 0.10
    )

    return {
        "status": "demo_only",
        "gap_score": round(score, 3),
        "prediction": (
            "GAP_UP" if score > 0.15
            else "GAP_DOWN" if score < -0.15
            else "FLAT"
        ),
        "live_data_connected": False,
        "warning": "Demo score only. Not a live market prediction."
    }
