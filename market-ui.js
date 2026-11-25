
/* NIFTY AUTO AI V8.2 PRO
   COMPLETE MARKET UI
   AUTOMATIC NIFTY 50 SCANNER
   READ ONLY MODE
*/

(function () {
  "use strict";

  const API = "https://nifty-auto-ai.onrender.com";

  const INTERVALS = {
    "1": "ONE_MINUTE",
    "3": "THREE_MINUTE",
    "5": "FIVE_MINUTE",
    "15": "FIFTEEN_MINUTE",
    "30": "THIRTY_MINUTE",
    "60": "ONE_HOUR",
    "D": "ONE_DAY"
  };

  const SCANNER_PAGES = [
    "Stock Scanner",
    "Live Ranking",
    "Bullish Stocks",
    "Bearish Stocks"
  ];

  const PAGES = [
    "Options AI",
    ...SCANNER_PAGES
  ];

  const state = {
    symbols: [],
    quotes: [],
    chain: [],
    candles: {},
    updated: null,
    candleStatus: "",
    scannerStatus: "",
    candleColor: "#e7bd69",
    owner: null
  };

  let selectedSymbol = "NSE:NIFTY";
  let selectedInterval = "5";

  let candleBusy = false;
  let scannerBusy = false;
  let generation = 0;

  const el = (tag, text) => {
    const node = document.createElement(tag);

    if (text !== undefined) {
      node.textContent = text;
    }

    return node;
  };

  const fmt = value =>
    value == null ||
    !Number.isFinite(Number(value))
      ? "--"
      : Number(value).toLocaleString(
          "en-IN",
          { maximumFractionDigits: 2 }
        );

  function formatDate(value) {
    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return "--";
    }

    return date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata"
    });
  }

  function page() {
    return document
      .getElementById("heading")
      ?.textContent.trim() || "";
  }

  function visible() {
    const detail =
      document.getElementById("detail");

    return Boolean(
      detail &&
      !detail.hidden &&
      !document.hidden &&
      PAGES.includes(page())
    );
  }

  function addStyles() {
    if (
      document.getElementById(
        "nifty-market-v82-style"
      )
    ) return;

    const style = el("style");

    style.id = "nifty-market-v82-style";

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

      .market-status{
        padding:12px;
        border-radius:10px;
        background:#14243a;
        font-weight:bold;
        font-size:12px;
        overflow-wrap:anywhere;
      }

      .market-summary{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
        margin:12px 0;
      }

      .market-summary-item{
        background:#14243a;
        border:1px solid #34445b;
        border-radius:10px;
        padding:12px;
        text-align:center;
      }

      .market-summary-item strong{
        display:block;
        font-size:20px;
        color:#e7bd69;
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

    headers.forEach(h =>
      tr.append(el("th", h))
    );

    head.append(tr);
    t.append(head);

    const body = el("tbody");

    rows.forEach(row => {
      const r = el("tr");

      row.forEach(value => {
        r.append(
          el("td", String(value ?? "--"))
        );
      });

      body.append(r);
    });

    t.append(body);
    wrap.append(t);

    return wrap;
  }

  function statusNode(text, color) {
    const node = el("p", text);

    node.className = "market-status";
    node.style.color = color || "#e7bd69";

    return node;
  }

  function ema(values, period) {
    const result =
      Array(values.length).fill(null);

    if (values.length < period) {
      return result;
    }

    let previous =
      values.slice(0, period)
        .reduce((a, b) => a + b, 0) /
      period;

    result[period - 1] = previous;

    const k = 2 / (period + 1);

    for (
      let i = period;
      i < values.length;
      i++
    ) {
      previous =
        values[i] * k +
        previous * (1 - k);

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
            close: row[4],
            volume: row[5]
          }
        : row;

      if (
        [
          r.time,
          r.open,
          r.high,
          r.low,
          r.close
        ].some(v => v == null || v === "")
      ) continue;

      const time =
        typeof r.time === "number"
          ? (
              r.time < 1e12
                ? r.time * 1000
                : r.time
            )
          : Date.parse(r.time);

      const c = {
        time,
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume || 0)
      };

      if (
        !Object.values(c)
          .every(Number.isFinite)
      ) continue;

      if (
        c.low <= 0 ||
        c.high < Math.max(c.open, c.close) ||
        c.low > Math.min(c.open, c.close) ||
        c.volume < 0 ||
        c.time > Date.now()
      ) continue;

      map.set(time, c);
    }

    return [...map.values()]
      .sort((a, b) => a.time - b.time);
  }

  function drawChart(canvas, rows) {
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

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

    const candles = rows.slice(-70);

    const offset =
      rows.length - candles.length;

    const prices = candles.flatMap(
      r => [r.high, r.low]
    );

    for (const indicator of indicators) {
      for (
        const value of
        indicator.values.slice(offset)
      ) {
        if (value !== null) {
          prices.push(value);
        }
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
      (right - left) / candles.length;

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

    candles.forEach((c, i) => {
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

      const width =
        Math.max(2, step * 0.65);

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

      candles.forEach((c, i) => {
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

    const dateFormat =
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });

    ctx.fillStyle = "#aebed1";
    ctx.font = "14px sans-serif";

    ctx.textAlign = "left";

    ctx.fillText(
      dateFormat.format(candles[0].time),
      left,
      H - 20
    );

    ctx.textAlign = "right";

    ctx.fillText(
      dateFormat.format(
        candles[candles.length - 1].time
      ),
      right,
      H - 20
    );
  }

  function chartPanel() {
    const box =
      panel("NIFTY ADVANCED CHART");

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

    if (!symbols.includes(selectedSymbol)) {
      selectedSymbol = "NSE:NIFTY";
    }

    symbol.value = selectedSymbol;

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
      const key =
        selectedSymbol +
        "|" +
        selectedInterval;

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
          formatDate(last.time);
      } else {
        status.textContent =
          "Authorized candle data not available.";
      }
    }

    symbol.onchange = () => {
      selectedSymbol = symbol.value;
      hideOptionsAI();
      loadChart();
      refreshCandles();
    };

    interval.onchange = () => {
      selectedInterval = interval.value;
      hideOptionsAI();
      loadChart();
      refreshCandles();
    };

    const full = el(
      "button",
      "Open TradingView Chart"
    );

    full.onclick = () => {
      const url =
        "https://www.tradingview.com/chart/?symbol=" +
        encodeURIComponent(selectedSymbol) +
        "&interval=" +
        encodeURIComponent(selectedInterval);

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    };

    const refresh = el(
      "button",
      "Refresh NIFTY Chart"
    );

    refresh.onclick = refreshCandles;

    box.append(
      statusNode(
        state.candleStatus ||
        "Waiting for Angel One candle data",
        state.candleColor
      ),
      el("label", "Select Index / Share"),
      symbol,
      el("label", "Timeframe"),
      interval,
      status,
      canvas,
      legend,
      el(
        "p",
        "Historical candles. Live freshness requires verification."
      ),
      refresh,
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
      (b.score ?? -1) -
      (a.score ?? -1) ||
      (b.change ?? -Infinity) -
      (a.change ?? -Infinity)
    );

    box.append(
      statusNode(
        state.scannerStatus ||
        "Waiting for Automatic NIFTY 50 Scanner"
      )
    );

    const summary = el("div");
    summary.className = "market-summary";

    const items = [
      ["NIFTY Universe", "50"],
      ["Quotes Received", state.quotes.length],
      [
        "Price Gainers",
        state.quotes.filter(
          q => q.change != null &&
               q.change > 0
        ).length
      ],
      [
        "Price Losers",
        state.quotes.filter(
          q => q.change != null &&
               q.change < 0
        ).length
      ]
    ];

    items.forEach(([label, value]) => {
      const item = el("div");

      item.className = "market-summary-item";

      item.append(
        el("strong", String(value)),
        el("span", label)
      );

      summary.append(item);
    });

    box.append(summary);

    box.append(
      el("p", "Universe: NIFTY 50"),
      el(
        "p",
        state.updated
          ? "Last response received: " +
            state.updated
          : "Market data pending."
      ),
      el(
        "p",
        "Price ranking only. AI trend not verified."
      )
    );

    const refresh = el(
      "button",
      "Refresh All 50 Stocks"
    );

    refresh.onclick = refreshScanner;

    box.append(refresh);

    box.append(
      table(
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
      )
    );

    if (!rows.length) {
      box.append(
        el(
          "p",
          "Waiting for verified market data. No AI signals available."
        )
      );
    }

    box.append(chartPanel());

    return box;
  }

  function chainPanel() {
    const box = panel("NIFTY OPTIONS CHAIN");

    box.append(
      el(
        "p",
        state.chain.length
          ? "Options data received. Verify freshness."
          : "Authorized options chain connection pending."
      )
    );

    box.append(
      table(
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
      )
    );

    [
      "PCR",
      "Delta",
      "Gamma",
      "Theta",
      "Vega"
    ].forEach(name => {
      box.append(el("p", name + ": --"));
    });

    return box;
  }

  function hideOptionsAI() {
    const node =
      document.getElementById(
        "options-ai-panel"
      );

    if (node) node.hidden = true;
  }

  function render() {
    const content =
      document.getElementById("content");

    if (!content) return;

    content.querySelector(
      "#market-ui-panel"
    )?.remove();

    const name = page();

    if (!PAGES.includes(name)) return;

    const root = el("div");

    root.id = "market-ui-panel";

    if (name === "Options AI") {
      root.append(
        chartPanel(),
        chainPanel()
      );
    } else {
      root.append(scannerPanel(name));
    }

    content.append(root);
  }

  function candleStatus(message, color) {
    state.candleStatus = message;
    state.candleColor = color || "#e7bd69";

    render();
  }

  function scannerStatus(message) {
    state.scannerStatus = message;

    render();
  }

  function clearMarket() {
    generation++;

    state.symbols = [];
    state.quotes = [];
    state.chain = [];
    state.candles = {};
    state.updated = null;
    state.owner = null;
    state.candleStatus = "";
    state.scannerStatus = "";

    hideOptionsAI();
    render();
  }

  function sameUser(uid, run) {
    return (
      generation === run &&
      typeof currentUser !== "undefined" &&
      currentUser?.id === uid
    );
  }

  async function session() {
    if (
      typeof db === "undefined" ||
      !db ||
      typeof currentUser === "undefined" ||
      !currentUser
    ) {
      throw new Error("Login required");
    }

    const uid = currentUser.id;

    if (state.owner !== uid) {
      clearMarket();
      state.owner = uid;
    }

    const run = generation;

    const { data, error } =
      await db.auth.getSession();

    if (
      error ||
      !data.session ||
      !data.session.access_token ||
      data.session.user.id !== uid ||
      !sameUser(uid, run)
    ) {
      throw new Error("Invalid session");
    }

    return {
      uid,
      run,
      token: data.session.access_token
    };
  }

  async function request(path, token, body) {
    const controller =
      new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      150000
    );

    try {
      const response = await fetch(
        API + path,
        {
          method: body ? "POST" : "GET",
          headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: body
            ? JSON.stringify(body)
            : undefined,
          cache: "no-store",
          signal: controller.signal
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Login again");
        }

        if (response.status === 403) {
          throw new Error("Owner access required");
        }

        if (response.status === 429) {
          throw new Error("Please wait before refreshing");
        }

        throw new Error(
          "API error " + response.status
        );
      }

      return await response.json();

    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshCandles() {
    if (candleBusy || !visible()) return;

    candleBusy = true;

    let auth = null;

    const symbol = selectedSymbol;
    const interval = selectedInterval;

    const key = symbol + "|" + interval;

    hideOptionsAI();

    try {
      auth = await session();

      if (symbol !== "NSE:NIFTY") {
        candleStatus(
          "Individual stock chart connection pending"
        );

        return;
      }

      candleStatus(
        "Connecting to Angel One..."
      );

      const result = await request(
        "/app/market/candles?interval=" +
        encodeURIComponent(
          INTERVALS[interval] || "FIVE_MINUTE"
        ) +
        "&days=10",
        auth.token
      );

      if (
        !sameUser(auth.uid, auth.run) ||
        !visible() ||
        selectedSymbol !== symbol ||
        selectedInterval !== interval
      ) return;

      const rows = normalizeCandles(
        result.candles
      );

      if (!rows.length) {
        throw new Error("No valid candle data");
      }

      state.candles[key] = rows;

      const last = rows[rows.length - 1];

      candleStatus(
        "ANGEL ONE | " +
        rows.length +
        " historical candles | Last candle: " +
        formatDate(last.time),
        "#4ade80"
      );

      if (
        interval === "5" &&
        page() === "Options AI"
      ) {
        const closed = rows.filter(
          c => c.time + 300000 <= Date.now()
        );

        const lastClosed =
          closed[closed.length - 1];

        const age = lastClosed
          ? Date.now() -
            (lastClosed.time + 300000)
          : Infinity;

        if (
          closed.length >= 200 &&
          age >= 0 &&
          age <= 600000 &&
          window.NiftyOptionsUI?.analyze
        ) {
          window.NiftyOptionsUI.analyze(closed);

          const node =
            document.getElementById(
              "options-ai-panel"
            );

          if (node) node.hidden = false;

        } else {
          hideOptionsAI();

          candleStatus(
            "ANGEL ONE | " +
            rows.length +
            " historical candles | AI WAIT: Fresh closed candles required"
          );
        }
      }

    } catch (error) {
      if (
        visible() &&
        (
          !auth ||
          sameUser(auth.uid, auth.run)
        )
      ) {
        state.candles[key] = [];

        hideOptionsAI();

        candleStatus(
          "Market connection: " +
          (error.message || "Unavailable"),
          "#f87171"
        );
      }

    } finally {
      candleBusy = false;
    }
  }

  async function refreshScanner() {
    if (
      scannerBusy ||
      !visible() ||
      !SCANNER_PAGES.includes(page())
    ) return;

    scannerBusy = true;

    let auth = null;

    try {
      auth = await session();

      scannerStatus(
        "Loading Automatic NIFTY 50 Universe..."
      );

      const universe = await request(
        "/app/market/universe",
        auth.token
      );

      if (
        !sameUser(auth.uid, auth.run) ||
        !visible() ||
        !SCANNER_PAGES.includes(page())
      ) return;

      if (
        universe.status !== "success" ||
        universe.count !== 50 ||
        !Array.isArray(universe.tokens) ||
        universe.tokens.length !== 50 ||
        !universe.tokens.every(
          t =>
            typeof t === "string" &&
            /^[0-9]{1,15}$/.test(t)
        ) ||
        new Set(universe.tokens).size !== 50
      ) {
        throw new Error(
          "NIFTY 50 Universe incomplete"
        );
      }

      const stockMap = new Map();

      if (Array.isArray(universe.stocks)) {
        universe.stocks.forEach(stock => {
          if (stock && stock.token) {
            stockMap.set(
              String(stock.token),
              stock
            );
          }
        });
      }

      scannerStatus(
        "NIFTY 50 list received. Fetching 50 stock quotes..."
      );

      const result = await request(
        "/app/market/scanner",
        auth.token,
        { tokens: universe.tokens }
      );

      if (
        !sameUser(auth.uid, auth.run) ||
        !visible() ||
        !SCANNER_PAGES.includes(page())
      ) return;

      if (
        result.status !== "success" ||
        !Array.isArray(result.quotes)
      ) {
        throw new Error(
          "Invalid scanner response"
        );
      }

      const allowed =
        new Set(universe.tokens);

      const unique = new Map();

      for (const q of result.quotes) {
        if (!q) continue;

        const stockToken = String(
          q.symbolToken || ""
        );

        const price = Number(q.ltp);
        const close = Number(q.close);

        if (
          !allowed.has(stockToken) ||
          !Number.isFinite(price) ||
          price <= 0
        ) continue;

        const stock =
          stockMap.get(stockToken);

        unique.set(stockToken, {
          symbol: String(
            stock?.trading_symbol ||
            q.tradingSymbol ||
            stockToken
          ),
          price,
          change:
            Number.isFinite(close) &&
            close > 0
              ? (price - close) /
                close * 100
              : null,
          score: null,
          trend: "UNVERIFIED"
        });
      }

      state.quotes =
        [...unique.values()];

      state.quotes.sort(
        (a, b) =>
          (b.change ?? -Infinity) -
          (a.change ?? -Infinity)
      );

      state.updated = result.received_at
        ? formatDate(result.received_at)
        : null;

      scannerStatus(
        "V8.2 AUTOMATIC SCANNER | " +
        state.quotes.length +
        "/50 quotes received | Freshness not verified | AI signals disabled"
      );

    } catch (error) {
      if (
        visible() &&
        SCANNER_PAGES.includes(page()) &&
        (
          !auth ||
          sameUser(auth.uid, auth.run)
        )
      ) {
        state.quotes = [];
        state.updated = null;

        scannerStatus(
          "Scanner: " +
          (error.message || "Unavailable")
        );
      }

    } finally {
      scannerBusy = false;
    }
  }

  window.NiftyMarketUI = {
    update(data) {
      if (!data || typeof data !== "object") {
        return;
      }

      if (Array.isArray(data.symbols)) {
        state.symbols = data.symbols.filter(
          s =>
            typeof s === "string" &&
            /^NSE:[A-Z0-9&_-]+$/.test(s)
        );
      }

      if (Array.isArray(data.quotes)) {
        state.quotes = data.quotes.filter(
          r =>
            r &&
            typeof r.symbol === "string"
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
        for (
          const [key, rows] of
          Object.entries(data.candles)
        ) {
          if (
            /^NSE:[A-Z0-9&_-]+\|(1|3|5|15|30|60|D)$/
              .test(key) &&
            Array.isArray(rows)
          ) {
            state.candles[key] =
              normalizeCandles(rows);
          }
        }
      }

      if (data.updated !== undefined) {
        state.updated = data.updated;
      }

      render();
    },

    refresh() {
      refreshAll();
    }
  };

  function refreshAll() {
    if (!visible()) return;

    refreshCandles();

    if (SCANNER_PAGES.includes(page())) {
      refreshScanner();
    }
  }

  function init() {
    addStyles();

    const heading =
      document.getElementById("heading");

    const detail =
      document.getElementById("detail");

    if (!heading || !detail) return;

    new MutationObserver(() => {
      hideOptionsAI();
      render();

      setTimeout(refreshAll, 500);

    }).observe(heading, {
      childList: true,
      subtree: true,
      characterData: true
    });

    new MutationObserver(() => {
      if (visible()) {
        render();
        setTimeout(refreshAll, 500);
      } else {
        hideOptionsAI();
      }

    }).observe(detail, {
      attributes: true,
      attributeFilter: ["hidden"]
    });

    if (
      typeof db !== "undefined" &&
      db
    ) {
      db.auth.onAuthStateChange(
        (event, sessionData) => {
          if (
            event === "SIGNED_OUT" ||
            sessionData?.user?.id !==
              state.owner
          ) {
            setTimeout(() => {
              clearMarket();

              if (sessionData?.user?.id) {
                state.owner =
                  sessionData.user.id;

                refreshAll();
              }
            }, 0);
          }
        }
      );
    }

    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          hideOptionsAI();
        } else {
          refreshAll();
        }
      }
    );

    setInterval(refreshAll, 60000);

    render();
    refreshAll();
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
