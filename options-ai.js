
// NIFTY AUTO AI V8 PRO
// Options AI - Strategy Engine V1

(function () {
  "use strict";

  const CONFIG = Object.freeze({
    symbol: "NIFTY 50",
    timeframe: 5,
    minimumScore: 75,
    nakedSelling: false,
    realTrading: false,
    autoTrading: false
  });

  function ema(values, period) {
    if (values.length < period) return null;

    let result = values
      .slice(0, period)
      .reduce((a, b) => a + b, 0) / period;

    const k = 2 / (period + 1);

    for (let i = period; i < values.length; i++) {
      result = values[i] * k + result * (1 - k);
    }

    return result;
  }

  function rsi(values, period = 14) {
    if (values.length <= period) return null;

    let gain = 0;
    let loss = 0;

    for (let i = 1; i <= period; i++) {
      const change = values[i] - values[i - 1];
      gain += Math.max(change, 0);
      loss += Math.max(-change, 0);
    }

    gain /= period;
    loss /= period;

    for (let i = period + 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];

      gain = (gain * (period - 1) +
        Math.max(change, 0)) / period;

      loss = (loss * (period - 1) +
        Math.max(-change, 0)) / period;
    }

    if (gain === 0 && loss === 0) return 50;
    if (loss === 0) return 100;

    return 100 - 100 / (1 + gain / loss);
  }

  function atr(candles, period = 14) {
    if (candles.length <= period) return null;

    const ranges = [];

    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const prev = candles[i - 1];

      ranges.push(Math.max(
        c.high - c.low,
        Math.abs(c.high - prev.close),
        Math.abs(c.low - prev.close)
      ));
    }

    let result = ranges.slice(0, period)
      .reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < ranges.length; i++) {
      result = (result * (period - 1) +
        ranges[i]) / period;
    }

    return result;
  }

  function analyze(candles, risk = {}) {

    if (!Array.isArray(candles) ||
        candles.length < 200 ||
        candles.some(c =>
          !c ||
          !Number.isFinite(c.close) ||
          !Number.isFinite(c.high) ||
          !Number.isFinite(c.low) ||
          c.low <= 0 ||
          c.high < c.low ||
          c.close > c.high ||
          c.close < c.low
        )) {
      return {
        signal: "WAIT",
        score: null,
        reason: "Valid historical candles required"
      };
    }

    const close = candles.map(c => c.close);
    const price = close[close.length - 1];

    const e9 = ema(close, 9);
    const e20 = ema(close, 20);
    const e50 = ema(close, 50);
    const e200 = ema(close, 200);
    const strength = rsi(close);
    const volatility = atr(candles);

    let bullish = 0;
    let bearish = 0;

    if (e9 > e20) bullish += 25;
    if (e9 < e20) bearish += 25;

    if (e20 > e50) bullish += 20;
    if (e20 < e50) bearish += 20;

    if (e50 > e200) bullish += 20;
    if (e50 < e200) bearish += 20;

    if (strength >= 55 && strength <= 70)
      bullish += 20;

    if (strength <= 45 && strength >= 30)
      bearish += 20;

    if (price > e9) bullish += 15;
    if (price < e9) bearish += 15;

    const score = Math.max(bullish, bearish);

    const requestedScore = Number(
      risk.min_score ?? CONFIG.minimumScore
    );

    const minimumScore =
      Number.isFinite(requestedScore)
        ? Math.max(75, Math.min(100, requestedScore))
        : 100;

    let signal = "WAIT";

    if (score >= minimumScore) {
      if (bullish > bearish) signal = "BULLISH";
      if (bearish > bullish) signal = "BEARISH";
    }

    return {
      symbol: CONFIG.symbol,
      signal,
      score,
      bullish,
      bearish,
      price,
      ema9: e9,
      ema20: e20,
      ema50: e50,
      ema200: e200,
      rsi: strength,
      atr: volatility,
      mode: "RESEARCH_ONLY",
      realTrading: false
    };
  }

  function checkRisk(settings = {}, state = {}) {

    const capital = Number(settings.capital);
    const perTrade = Number(settings.risk_per_trade);
    const dailyLoss = Number(settings.daily_max_loss);
    const maxTrades = Number(settings.max_daily_trades);

    const trades = Number(state.trades);
    const loss = Number(state.loss);
    const positions = Number(state.positions);

    function blocked(reason) {
      return {
        allowed: false,
        reason
      };
    }

    if (![capital, perTrade, dailyLoss,
          maxTrades, trades, loss, positions]
          .every(Number.isFinite))
      return blocked("Risk data unavailable");

    if (capital <= 0 || capital > 1000000)
      return blocked("Invalid capital");

    if (perTrade <= 0 || dailyLoss <= 0 ||
        perTrade > dailyLoss ||
        dailyLoss > capital)
      return blocked("Invalid risk limits");

    if (!Number.isInteger(maxTrades) ||
        maxTrades < 1 || maxTrades > 3)
      return blocked("Invalid trade limit");

    if (!Number.isInteger(trades) ||
        !Number.isInteger(positions) ||
        trades < 0 || positions < 0 || loss < 0)
      return blocked("Invalid trading state");

    if (trades >= maxTrades)
      return blocked("Daily trade limit reached");

    if (loss + perTrade > dailyLoss)
      return blocked("Daily loss limit");

    if (positions >= 1)
      return blocked("Open position limit");

    if (settings.naked_selling !== false)
      return blocked("Naked selling prohibited");

    return {
      allowed: true,
      reason: "Preliminary risk checks passed",
      executionAllowed: false,
      mode: "RESEARCH_ONLY"
    };
  }

  window.NiftyOptionsAI = Object.freeze({
    config: CONFIG,
    ema,
    rsi,
    atr,
    analyze,
    checkRisk
  });

})();
