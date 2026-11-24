
from math import exp
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

    # Heuristic scores converted into indicative percentages.
    # These are NOT statistically calibrated probabilities.
    up_logit = score * 2.5
    down_logit = -score * 2.5
    flat_logit = 0.0

    values = [up_logit, down_logit, flat_logit]
    max_value = max(values)

    weights = [exp(v - max_value) for v in values]
    total = sum(weights)

    probabilities = {
        "GAP_UP": round(weights[0] / total * 100, 1),
        "GAP_DOWN": round(weights[1] / total * 100, 1),
        "FLAT": round(weights[2] / total * 100, 1),
    }

    prediction = max(probabilities, key=probabilities.get)

    return {
        "prediction": prediction,
        "score": round(score, 3),
        "probabilities_percent": probabilities,
        "confidence_percent": max(probabilities.values()),
        "status": "demo_only",
        "live_data_connected": False,
        "warning": (
            "Indicative demo estimates only. "
            "Not calibrated or based on live market data. "
            "Do not use alone for trading decisions."
        )
    }
