import os
from fastapi import FastAPI
from pydantic import BaseModel, Field
from .gap_prediction import GapInputs, score_gap

app = FastAPI(title="NIFTY AUTO AI V6 API", version="0.6.0")

class RiskSettings(BaseModel):
    capital: int = Field(25000, ge=0, le=1_000_000)
    risk_per_trade: int = Field(600, gt=0)
    daily_loss_limit: int = Field(2000, gt=0)
    max_trades_per_day: int = Field(3, ge=1, le=50)
    max_open_positions: int = Field(1, ge=1, le=1)
    min_signal_score: int = Field(75, ge=0, le=100)

@app.get("/health")
def health():
    return {"app":"NIFTY AUTO AI","version":"V6","status":"starter",
            "market_data":"not_connected","angel_one":"not_connected","live_trading":False}

@app.get("/config/defaults")
def defaults():
    return {"index":"NIFTY 50","timeframe":"5m","option_modes":["buying","hedged_defined_risk_selling"],
            "naked_selling":False,"settings":RiskSettings().model_dump()}

@app.post("/risk/validate")
def validate_risk(s: RiskSettings):
    if s.capital == 0:
        return {"valid":True,"new_entries_enabled":False,"settings":s.model_dump()}
    if s.risk_per_trade > s.capital or s.daily_loss_limit > s.capital:
        return {"valid":False,"reason":"Risk and daily loss cannot exceed capital"}
    return {"valid":True,"new_entries_enabled":True,"settings":s.model_dump()}

@app.post("/gap/score")
def gap_score(x: GapInputs):
    return score_gap(x)
