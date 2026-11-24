from pydantic import BaseModel, Field


class GapInputs(BaseModel):
    trend_score: float = Field(0, ge=-1, le=1)
    global_score: float = Field(0, ge=-1, le=1)
    gift_nifty_score: float = Field(0, ge=-1, le=1)
    volatility_score: float = Field(0, ge=-1, le=1)


def score_gap(x: GapInputs):
    score = (
        x.trend_score * 0.35
        + x.global_score * 0.25
        + x.gift_nifty_score * 0.30
        + x.volatility_score * 0.10
    )

    if score > 0.15:
        prediction = "GAP_UP"
    elif score < -0.15:
        prediction = "GAP_DOWN"
    else:
        prediction = "FLAT"

    return {
        "prediction": prediction,
        "score": round(score, 3),
        "status": "demo_only",
        "live_data_connected": False
    }
