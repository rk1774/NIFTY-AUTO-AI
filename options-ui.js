(function () {
  "use strict";

  function init() {
    const panel = document.createElement("section");

    panel.id = "options-ai-panel";

    panel.style.cssText = `
      background:#ffffff;
      color:#172554;
      padding:20px;
      margin:16px 0;
      border-radius:18px;
      border:1px solid #dbeafe;
      box-shadow:0 4px 18px #00000012;
    `;

    panel.innerHTML = `
      <h2>OPTIONS AI PRO</h2>
      <p>NIFTY 50 | 5 Minute</p>
      <p>Mode: RESEARCH ONLY</p>
      <hr>
      <p>AI Signal: <b id="optSignal">WAIT</b></p>
      <p>Signal Score: <b id="optScore">--</b></p>
      <p>Market Price: <b id="optPrice">--</b></p>
      <p>EMA 9: <span id="optEma9">--</span></p>
      <p>EMA 20: <span id="optEma20">--</span></p>
      <p>EMA 50: <span id="optEma50">--</span></p>
      <p>EMA 200: <span id="optEma200">--</span></p>
      <p>RSI: <span id="optRsi">--</span></p>
      <p>ATR: <span id="optAtr">--</span></p>
      <hr>
      <p>Capital: ₹25,000</p>
      <p>Risk Per Trade: ₹600</p>
      <p>Daily Loss Limit: ₹2,000</p>
      <p>Maximum Trades: 3</p>
      <p>Open Positions: 1</p>
      <p>Minimum Score: 75</p>
      <p>Naked Selling: OFF</p>
      <p>Real Trading: LOCKED</p>
      <p id="optStatus">Waiting for market data</p>
    `;

    const dashboard =
      document.getElementById("dashboard");

    if (dashboard) {
      dashboard.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }
  }

  function update(id, value) {
    const el = document.getElementById(id);
    if (!el) return;

    el.textContent =
      typeof value === "number"
        ? value.toFixed(2)
        : value ?? "--";
  }

  window.NiftyOptionsUI = {
    analyze: function (candles) {
      if (!window.NiftyOptionsAI) {
        update("optStatus", "AI engine not loaded");
        return null;
      }

      try {
        const r = window.NiftyOptionsAI.analyze(candles);

        update("optSignal", r.signal);
        update("optScore", r.score);
        update("optPrice", r.price);
        update("optEma9", r.ema9);
        update("optEma20", r.ema20);
        update("optEma50", r.ema50);
        update("optEma200", r.ema200);
        update("optRsi", r.rsi);
        update("optAtr", r.atr);

        update(
          "optStatus",
          r.reason || "Research analysis complete"
        );

        return r;
      } catch (error) {
        update("optSignal", "WAIT");
        update("optStatus", "Analysis unavailable");
        return null;
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
