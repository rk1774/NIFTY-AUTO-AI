(function () {
  "use strict";

  const state = {
    symbols: [],
    quotes: [],
    chain: [],
    updated: null
  };

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
      .market-panel iframe{
        width:100%;
        height:480px;
        border:0;
        border-radius:10px;
      }
      .market-panel button{
        margin:5px 0;
        width:100%;
      }
      .market-panel select{
        width:100%;
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

  function chartPanel() {
    const box = panel("ADVANCED CHART");

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

    interval.value = "5";

    const frame = el("iframe");
    frame.title = "TradingView Market Chart";
    frame.loading = "lazy";

    function loadChart() {
      const params = new URLSearchParams({
        symbol: symbol.value,
        interval: interval.value,
        theme: "dark",
        style: "1",
        locale: "en",
        timezone: "Asia/Kolkata",
        allow_symbol_change: "1"
      });

      frame.src =
        "https://s.tradingview.com/widgetembed/?" +
        params.toString();
    }

    symbol.onchange = loadChart;
    interval.onchange = loadChart;

    box.append(
      el("label", "Select Index / Share"),
      symbol,
      el("label", "Timeframe"),
      interval,
      frame,
      el("p",
        "Chart data supplied by TradingView. " +
        "Exchange delays may apply."
      )
    );

    const full = el("button", "Open Advanced Chart");

    full.onclick = () => {
      const url =
        "https://www.tradingview.com/chart/?symbol=" +
        encodeURIComponent(symbol.value);

      window.open(url, "_blank", "noopener,noreferrer");
    };

    box.append(full);

    loadChart();

    return box;
  }

  function scannerPanel(mode) {
    const box = panel(mode.toUpperCase());

    let rows = state.quotes.slice();

    if (mode === "Bullish Stocks") {
      rows = rows.filter(r => r.trend === "BULLISH");
    }

    if (mode === "Bearish Stocks") {
      rows = rows.filter(r => r.trend === "BEARISH");
    }

    rows.sort((a, b) =>
      (b.score ?? -1) - (a.score ?? -1)
    );

    box.append(el("p",
      "Universe: NIFTY 50"
    ));

    box.append(el("p",
      state.updated
        ? "Last data update: " + state.updated
        : "Authorized market feed not connected."
    ));

    box.append(table(
      ["Rank", "Share", "Price", "Change %", "Score", "Trend"],
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
        "Waiting for verified market data. No signals available."
      ));
    }

    box.append(chartPanel());

    return box;
  }

  function chainPanel() {
    const box = panel("NIFTY OPTIONS CHAIN");

    box.append(el("p",
      "Authorized options data connection pending."
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

      state.updated = data.updated || null;

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
