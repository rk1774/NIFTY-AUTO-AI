"""Gap prediction contract. Deliberately refuses to guess without validated live inputs."""
from pydantic import BaseModel, Field
from typing import Optional

class GapInputs(BaseModel):
    nifty_change_pct: float
    ema_alignment_score: float = Field(ge=-1, le=1)
    rsi14: float = Field(ge=0, le=100)
    vix_change_pct: float
    gift_nifty_change_pct: float
    fii_net_cr: Optional[float] = None
    market_breadth: Optional[float] = Field(default=None, ge=0, le=1)
    data_timestamp_ist: str

def score_gap(x: GapInputs):
    # Transparent baseline score only; must be calibrated/backtested before any use.
    score = (0.25*x.nifty_change_pct + 0.20*x.ema_alignment_score*2 +
             0.10*((x.rsi14-50)/50) + 0.15*x.gift_nifty_change_pct -
             0.10*x.vix_change_pct)
    if x.fii_net_cr is not None:
        score += max(-1, min(1, x.fii_net_cr/5000))*0.10
    if x.market_breadth is not None:
        score += (x.market_breadth-0.5)*0.20
    # Softmax-like three-way mapping, intentionally conservative.
    up = max(0.05, min(0.90, 0.33 + score*0.22))
    down = max(0.05, min(0.90, 0.33 - score*0.22))
    flat = max(0.05, 1-up-down)
    total = up+down+flat
    return {
        "status":"research_only_not_calibrated",
        "gap_up_probability":round(up/total,3),
        "gap_down_probability":round(down/total,3),
        "flat_probability":round(flat/total,3),
        "confidence":"unvalidated",
        "note":"Illustrative baseline only. Do not trade from this output; calibrate on historical data and include costs/regime tests."
    }
