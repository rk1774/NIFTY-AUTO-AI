
(function () {
  "use strict";

  const state = {
    symbols: [],
    quotes: [],
    chain: [],
    candles: {},
    updated: null
  };

  let selectedSymbol = "NSE:NIFTY";
  let selectedInterval = "5";

  const el = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const fmt = value =>
    value == null || !Number.isFinite(Number(value))
      ? "--"
      : Number(value).toLocaleString("en-IN", {
          maximumFractionDigits: 2
        });

  function addStyles() {
    const style = el("style");

    style.textContent = `
      .market-panel{
        width:100%;
        min-width:0;
        box-sizing:border-box;
        padding:12px;
        margin:14px 0;
        background:#0c1828;
        border:1px solid #34445b;
        border-radius:14px;
        color:#eef3fa;
      }
      .market-panel h3{
        color:#e7bd69;
        margin:10px 0;
      }
      .market-scroll{
        width:100%;
        overflow-x:auto;
      }
      .market-table{
        width:100%;
        border-collapse:collapse;
        font-size:13px;
        white-space:nowrap;
      }
      .market-table th,
      .market-table td{
        padding:12px 8px;
        border-bottom:1px solid #34445b;
        text-align:left;
      }
      .market-table th{
        color:#e7bd69;
      }
      .market-panel button,
      .market-panel select{
        width:100%;
        margin:5px 0;
      }
      .market-canvas{
        width:100%;
        height:auto;
        display:block;
        background:#08111f;
        border-radius:10px;
      }
      .market-legend{
        font-size:12px;
        line-height:1.8;
        overflow-wrap:anywhere;
      }
    `;

    document.head.append(style);
  }

  function panel(title) {
    const box = el("div");
    box.className = "market-panel";
    box.append(el("h3", title));
    return box;
  }

  function table(headers, rows) {
    const wrap = el("div");
    wrap.className = "market-scroll";

    const t = el("table");
    t.className = "market-table";

    const head = el("thead");
    const tr = el("tr");

    headers.forEach(h => tr.append(el("th", h)));

    head.append(tr);
    t.append(head);

    const body = el("tbody");

    rows.forEach(row => {
      const r = el("tr");

      row.forEach(value => {
        r.append(el("td", String(value ?? "--")));
      });

      body.append(r);
    });

    t.append(body);
    wrap.append(t);

    return wrap;
  }

  function ema(values, period) {
    const result = Array(values.length).fill(null);

    if (values.length < period) return result;

    let previous =
      values.slice(0, period)
        .reduce((a, b) => a + b, 0) / period;

    result[period - 1] = previous;

    const k = 2 / (period + 1);

    for (let i = period; i < values.length; i++) {
      previous = values[i] * k + previous * (1 - k);
      result[i] = previous;
    }

    return result;
  }

  function normalizeCandles(rows) {
    if (!Array.isArray(rows)) return [];

    const map = new Map();

    for (const row of rows) {
      if (!row) continue;

      const r = Array.isArray(row)
        ? {
            time: row[0],
            open: row[1],
            high: row[2],
            low: row[3],
            close: row[4]
          }
        : row;

      if ([r.time, r.open, r.high, r.low, r.close]
        .some(v => v == null || v === "")) continue;

      let time;

      if (typeof r.time === "number") {
        time = r.time < 1e12
          ? r.time * 1000
          : r.time;
      } else {
        time = Date.parse(r.time);
      }

      const c = {
        time,
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close)
      };

      if (!Object.values(c).every(Number.isFinite)) continue;

      if (
        c.low <= 0 ||
        c.high < Math.max(c.open, c.close) ||
        c.low > Math.min(c.open, c.close)
      ) continue;

      map.set(time, c);
    }

    return [...map.values()]
      .sort((a, b) => a.time - b.time);
  }

  function drawChart(canvas, rows) {
    const ctx = canvas.getContext("2d");

    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = "#08111f";
    ctx.fillRect(0, 0, W, H);

    if (!rows.length) {
      ctx.fillStyle = "#aebed1";
      ctx.font = "22px sans-serif";
      ctx.textAlign = "center";

      ctx.fillText(
        "Waiting for market data",
        W / 2,
        H / 2
      );

      return;
    }

    const closes = rows.map(r => r.close);

    const indicators = [
      [9, "#facc15"],
      [20, "#38bdf8"],
      [50, "#c084fc"],
      [200, "#fb923c"]
    ].map(([period, color]) => ({
      color,
      values: ema(closes, period)
    }));

    const visible = rows.slice(-70);
    const offset = rows.length - visible.length;

    const prices = visible.flatMap(r => [r.high, r.low]);

    for (const indicator of indicators) {
      for (const value of indicator.values.slice(offset)) {
        if (value !== null) prices.push(value);
      }
    }

    const max = Math.max(...prices);
    const min = Math.min(...prices);

    const padding = Math.max(
      (max - min) * 0.08,
      max * 0.0001
    );

    const top = max + padding;
    const bottom = min - padding;
    const range = top - bottom;

    const left = 20;
    const right = W - 100;
    const chartTop = 30;
    const chartBottom = H - 55;

    const step =
      (right - left) / visible.length;

    const y = price =>
      chartTop +
      (top - price) / range *
      (chartBottom - chartTop);

    ctx.font = "15px sans-serif";
    ctx.textAlign = "left";

    for (let i = 0; i <= 5; i++) {
      const price = top - range * i / 5;
      const py = y(price);

      ctx.strokeStyle = "#25364c";
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(left, py);
      ctx.lineTo(right, py);
      ctx.stroke();

      ctx.fillStyle = "#aebed1";

      ctx.fillText(
        price.toFixed(2),
        right + 6,
        py + 5
      );
    }

    visible.forEach((c, i) => {
      const x = left + step * (i + 0.5);

      const color =
        c.close >= c.open
          ? "#22c55e"
          : "#ef4444";

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(x, y(c.high));
      ctx.lineTo(x, y(c.low));
      ctx.stroke();

      const width = Math.max(2, step * 0.65);

      ctx.fillRect(
        x - width / 2,
        Math.min(y(c.open), y(c.close)),
        width,
        Math.max(
          2,
          Math.abs(y(c.open) - y(c.close))
        )
      );
    });

    for (const indicator of indicators) {
      ctx.strokeStyle = indicator.color;
      ctx.lineWidth = 2;

      ctx.beginPath();

      let started = false;

      visible.forEach((c, i) => {
        const value =
          indicator.values[offset + i];

        if (value === null) return;

        const x = left + step * (i + 0.5);

        if (!started) {
          ctx.moveTo(x, y(value));
          started = true;
        } else {
          ctx.lineTo(x, y(value));
        }
      });

      ctx.stroke();
    }

    const dateFormat = new Intl.DateTimeFormat(
      "en-IN",
      {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }
    );

    ctx.fillStyle = "#aebed1";
    ctx.font = "14px sans-serif";

    const last = visible[visible.length - 1];

    ctx.textAlign = "left";
    ctx.fillText(
      dateFormat.format(visible[0].time),
      left,
      H - 20
    );

    ctx.textAlign = "right";
    ctx.fillText(
      dateFormat.format(last.time),
      right,
      H - 20
    );
  }

  function chartPanel() {
    const box = panel("NIFTY ADVANCED CHART");

    const symbol = el("select");
    const interval = el("select");

    const symbols = [
      "NSE:NIFTY",
      ...state.symbols
    ];

    [...new Set(symbols)].forEach(s => {
      const option = el("option", s);
      option.value = s;
      symbol.append(option);
    });

    if (symbols.includes(selectedSymbol)) {
      symbol.value = selectedSymbol;
    } else {
      selectedSymbol = "NSE:NIFTY";
    }

    [
      ["1", "1 Minute"],
      ["3", "3 Minute"],
      ["5", "5 Minute"],
      ["15", "15 Minute"],
      ["30", "30 Minute"],
      ["60", "1 Hour"],
      ["D", "Daily"]
    ].forEach(([value, label]) => {
      const option = el("option", label);
      option.value = value;
      interval.append(option);
    });

    interval.value = selectedInterval;

    const status = el("p");
    const canvas = el("canvas");

    canvas.width = 900;
    canvas.height = 650;
    canvas.className = "market-canvas";

    const legend = el("div");
    legend.className = "market-legend";

    [
      ["EMA 9", "#facc15"],
      ["EMA 20", "#38bdf8"],
      ["EMA 50", "#c084fc"],
      ["EMA 200", "#fb923c"]
    ].forEach(([name, color]) => {
      const span = el("span", name + "   ");
      span.style.color = color;
      legend.append(span);
    });

    function loadChart() {
      selectedSymbol = symbol.value;
      selectedInterval = interval.value;

      const key =
        selectedSymbol + "|" + selectedInterval;

      const rows = normalizeCandles(
        state.candles[key]
      );

      drawChart(canvas, rows);

      if (rows.length) {
        const last = rows[rows.length - 1];

        status.textContent =
          selectedSymbol +
          " | Last candle close: " +
          fmt(last.close) +
          " | " +
          new Date(last.time).toLocaleString(
            "en-IN",
            {timeZone: "Asia/Kolkata"}
          );
      } else {
        status.textContent =
          "Authorized candle data not connected.";
      }
    }

    symbol.onchange = loadChart;
    interval.onchange = loadChart;

    const full = el(
      "button",
      "Open TradingView Chart"
    );

    full.onclick = () => {
      const url =
        "https://www.tradingview.com/chart/?symbol=" +
        encodeURIComponent(symbol.value) +
        "&interval=" +
        encodeURIComponent(interval.value);

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    };

    box.append(
      el("label", "Select Index / Share"),
      symbol,
      el("label", "Timeframe"),
      interval,
      status,
      canvas,
      legend,
      el("p",
        "EMA lines require sufficient historical candles. " +
        "Live feed connection pending."
      ),
      full
    );

    loadChart();

    return box;
  }

  function scannerPanel(mode) {
    const box = panel(mode.toUpperCase());

    let rows = state.quotes.slice();

    if (mode === "Bullish Stocks") {
      rows = rows.filter(
        r => r.trend === "BULLISH"
      );
    }

    if (mode === "Bearish Stocks") {
      rows = rows.filter(
        r => r.trend === "BEARISH"
      );
    }

    rows.sort((a, b) =>
      (b.score ?? -1) - (a.score ?? -1)
    );

    box.append(el("p", "Universe: NIFTY 50"));

    box.append(el("p",
      state.updated
        ? "Last data update: " + state.updated
        : "Authorized market feed not connected."
    ));

    box.append(table(
      [
        "Rank",
        "Share",
        "Price",
        "Change %",
        "Score",
        "Trend"
      ],
      rows.map((r, i) => [
        i + 1,
        r.symbol,
        fmt(r.price),
        fmt(r.change),
        fmt(r.score),
        r.trend
      ])
    ));

    if (!rows.length) {
      box.append(el("p",
        "Waiting for verified market data. " +
        "No signals available."
      ));
    }

    box.append(chartPanel());

    return box;
  }

  function chainPanel() {
    const box = panel("NIFTY OPTIONS CHAIN");

    box.append(el("p",
      state.chain.length
        ? "Received options data. Verify freshness."
        : "Authorized options data connection pending."
    ));

    box.append(table(
      [
        "CE OI",
        "CE IV",
        "CE LTP",
        "Strike",
        "PE LTP",
        "PE IV",
        "PE OI"
      ],
      state.chain.map(r => [
        fmt(r.ceOi),
        fmt(r.ceIv),
        fmt(r.ceLtp),
        fmt(r.strike),
        fmt(r.peLtp),
        fmt(r.peIv),
        fmt(r.peOi)
      ])
    ));

    box.append(el("p", "PCR: --"));
    box.append(el("p", "Delta: --"));
    box.append(el("p", "Gamma: --"));
    box.append(el("p", "Theta: --"));
    box.append(el("p", "Vega: --"));

    return box;
  }

  function render() {
    const heading =
      document.getElementById("heading");

    const content =
      document.getElementById("content");

    if (!heading || !content) return;

    const old =
      content.querySelector("#market-ui-panel");

    if (old) old.remove();

    const name = heading.textContent.trim();
    const root = el("div");

    root.id = "market-ui-panel";

    if (name === "Options AI") {
      root.append(chartPanel());
      root.append(chainPanel());
    } else if (
      [
        "Stock Scanner",
        "Live Ranking",
        "Bullish Stocks",
        "Bearish Stocks"
      ].includes(name)
    ) {
      root.append(scannerPanel(name));
    } else {
      return;
    }

    content.append(root);
  }

  window.NiftyMarketUI = {
    update(data) {
      if (!data || typeof data !== "object") return;

      if (Array.isArray(data.symbols)) {
        state.symbols = data.symbols.filter(
          s => typeof s === "string" &&
          /^NSE:[A-Z0-9&_-]+$/.test(s)
        );
      }

      if (Array.isArray(data.quotes)) {
        state.quotes = data.quotes.filter(
          r => r && typeof r.symbol === "string"
        );
      }

      if (Array.isArray(data.chain)) {
        state.chain = data.chain.filter(
          r => r && typeof r === "object"
        );
      }

      if (
        data.candles &&
        typeof data.candles === "object"
      ) {
        for (const [key, rows] of
          Object.entries(data.candles)) {
          if (
            /^NSE:[A-Z0-9&_-]+\|(1|3|5|15|30|60|D)$/
              .test(key) &&
            Array.isArray(rows)
          ) {
            state.candles[key] = rows;
          }
        }
      }

      if (data.updated !== undefined) {
        state.updated = data.updated;
      }

      render();
    }
  };

  function init() {
    addStyles();

    const heading =
      document.getElementById("heading");

    if (!heading) return;

    new MutationObserver(render).observe(
      heading,
      {
        childList: true,
        subtree: true,
        characterData: true
      }
    );

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();
