// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃ ██████ ██████ ██████       █      █      █      █      █ █▄  ▀███ █       ┃
// ┃ ▄▄▄▄▄█ █▄▄▄▄▄ ▄▄▄▄▄█  ▀▀▀▀▀█▀▀▀▀▀ █ ▀▀▀▀▀█ ████████▌▐███ ███▄  ▀█ █ ▀▀▀▀▀ ┃
// ┃ █▀▀▀▀▀ █▀▀▀▀▀ █▀██▀▀ ▄▄▄▄▄ █ ▄▄▄▄▄█ ▄▄▄▄▄█ ████████▌▐███ █████▄   █ ▄▄▄▄▄ ┃
// ┃ █      ██████ █  ▀█▄       █ ██████      █      ███▌▐███ ███████▄ █       ┃
// ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
// ┃ Copyright (c) 2017, the Perspective Authors.                              ┃
// ┃ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ ┃
// ┃ This file is part of the Perspective library, distributed under the terms ┃
// ┃ of the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

import perspective from "@perspective-dev/client";
import perspective_viewer from "@perspective-dev/viewer";
import "@perspective-dev/viewer-datagrid";
import "@perspective-dev/viewer-d3fc";
import "@perspective-dev/viewer-webgl";

import "@perspective-dev/viewer/dist/css/pro-dark.css";
import "./index.css";

import SERVER_WASM from "@perspective-dev/server/dist/wasm/perspective-server.wasm";
import CLIENT_WASM from "@perspective-dev/viewer/dist/wasm/perspective-viewer.wasm";

import arrow from "superstore-arrow/superstore.lz4.arrow";

// --- Ticker universe by sector (S&P 500-ish) ---
const SECTORS = {
    Technology: [
        "AAPL",
        "MSFT",
        "GOOGL",
        "AMZN",
        "META",
        "NVDA",
        "AVGO",
        "ORCL",
        "CRM",
        "ADBE",
        "AMD",
        "INTC",
        "QCOM",
        "TXN",
        "IBM",
        "NOW",
        "INTU",
        "AMAT",
        "MU",
        "LRCX",
        "ADI",
        "KLAC",
        "SNPS",
        "CDNS",
        "MRVL",
        "FTNT",
        "PANW",
        "CRWD",
    ],
    Healthcare: [
        "UNH",
        "JNJ",
        "LLY",
        "PFE",
        "ABBV",
        "MRK",
        "TMO",
        "ABT",
        "DHR",
        "BMY",
        "AMGN",
        "MDT",
        "GILD",
        "ISRG",
        "VRTX",
        "SYK",
        "BSX",
        "REGN",
        "ZTS",
        "BDX",
        "EW",
        "HCA",
        "IDXX",
        "IQV",
        "DXCM",
        "BIIB",
        "MRNA",
        "ALGN",
    ],
    Financials: [
        "JPM",
        "V",
        "MA",
        "BAC",
        "WFC",
        "GS",
        "MS",
        "SCHW",
        "BLK",
        "SPGI",
        "AXP",
        "CB",
        "MMC",
        "PGR",
        "ICE",
        "CME",
        "AON",
        "MCO",
        "MET",
        "AIG",
        "TRV",
        "AFL",
        "PRU",
        "ALL",
        "MSCI",
        "FIS",
        "FISV",
        "COF",
    ],
    "Consumer Disc.": [
        "TSLA",
        "HD",
        "MCD",
        "NKE",
        "SBUX",
        "LOW",
        "TJX",
        "BKNG",
        "CMG",
        "MAR",
        "ORLY",
        "AZO",
        "ROST",
        "DHI",
        "LEN",
        "GM",
        "F",
        "YUM",
        "DG",
        "DLTR",
        "EBAY",
        "ETSY",
        "BBY",
        "POOL",
        "ULTA",
        "GRMN",
        "DRI",
        "MGM",
    ],
    Industrials: [
        "CAT",
        "UNP",
        "HON",
        "UPS",
        "BA",
        "RTX",
        "DE",
        "LMT",
        "GE",
        "MMM",
        "FDX",
        "EMR",
        "ITW",
        "ETN",
        "WM",
        "RSG",
        "CSX",
        "NSC",
        "PCAR",
        "GD",
        "NOC",
        "TT",
        "ROK",
        "FAST",
        "ODFL",
        "VRSK",
        "IR",
        "CTAS",
    ],
    Energy: [
        "XOM",
        "CVX",
        "COP",
        "SLB",
        "EOG",
        "MPC",
        "PSX",
        "VLO",
        "OXY",
        "DVN",
        "HES",
        "WMB",
        "KMI",
        "OKE",
        "HAL",
        "BKR",
        "TRGP",
        "CTRA",
    ],
    "Consumer Staples": [
        "PG",
        "KO",
        "PEP",
        "COST",
        "WMT",
        "PM",
        "MO",
        "CL",
        "MDLZ",
        "EL",
        "GIS",
        "KMB",
        "SYY",
        "HSY",
        "KHC",
        "TSN",
        "MKC",
        "CLX",
    ],
    Utilities: [
        "NEE",
        "DUK",
        "SO",
        "AEP",
        "SRE",
        "EXC",
        "XEL",
        "ED",
        "WEC",
        "ES",
        "AWK",
        "DTE",
        "PPL",
        "FE",
        "AEE",
        "CMS",
        "EVRG",
        "LNT",
    ],
    "Real Estate": [
        "PLD",
        "AMT",
        "CCI",
        "EQIX",
        "PSA",
        "SPG",
        "DLR",
        "WELL",
        "AVB",
        "EQR",
        "VTR",
        "ARE",
        "MAA",
        "UDR",
        "HST",
        "KIM",
        "REG",
        "CPT",
    ],
    Materials: [
        "LIN",
        "APD",
        "SHW",
        "FCX",
        "NEM",
        "ECL",
        "DD",
        "NUE",
        "VMC",
        "MLM",
        "PPG",
        "DOW",
        "CTVA",
        "ALB",
        "FMC",
        "CF",
        "MOS",
        "EMN",
    ],
    Communication: [
        "DIS",
        "CMCSA",
        "NFLX",
        "VZ",
        "TMUS",
        "CHTR",
        "EA",
        "TTWO",
        "OMC",
        "IPG",
        "MTCH",
        "LYV",
        "RBLX",
        "PINS",
        "SNAP",
        "ROKU",
        "ZM",
        "SPOT",
    ],
};

const CORS_PROXY = "https://corsproxy.io/?url=";

const ALL_TICKERS = Object.entries(SECTORS).flatMap(([sector, tickers]) =>
    tickers.map((t) => ({ ticker: t, sector })),
);

// Fetch 1 year of daily OHLCV from Yahoo Finance via CORS proxy
async function fetchTicker({ ticker, sector }) {
    const period2 = Math.floor(Date.now() / 1000);
    const period1 = period2 - 365 * 24 * 60 * 60;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;
    try {
        const resp = await fetch(CORS_PROXY + encodeURIComponent(url));
        if (!resp.ok) return [];
        const json = await resp.json();
        const result = json.chart?.result?.[0];
        if (!result) return [];
        const timestamps = result.timestamp;
        const q = result.indicators.quote[0];
        const rows = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (q.close[i] == null) continue;
            rows.push({
                Date: new Date(timestamps[i] * 1000),
                Ticker: ticker,
                Sector: sector,
                Open: q.open[i],
                High: q.high[i],
                Low: q.low[i],
                Close: q.close[i],
                Volume: q.volume[i],
            });
        }
        return rows;
    } catch {
        return [];
    }
}

// Fetch in batches to avoid overwhelming the proxy
async function fetchAllTickers(tickers, batchSize = 20) {
    const allRows = [];
    for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(fetchTicker));
        for (const rows of results) allRows.push(...rows);
        console.log(
            `Fetched ${Math.min(i + batchSize, tickers.length)}/${tickers.length} tickers (${allRows.length} rows)`,
        );
    }
    return allRows;
}

// --- Init and load ---
await Promise.all([
    perspective.init_server(fetch(SERVER_WASM)),
    perspective_viewer.init_client(fetch(CLIENT_WASM)),
]);

const viewer = document.createElement("perspective-viewer");
document.body.append(viewer);
const worker = await perspective.worker();

// Configure plugin based on URL params
const params = new URLSearchParams(window.location.search);
const view = params.get("v");
if (view === "treemap") {
    console.log(`Fetching ${ALL_TICKERS.length} tickers from Yahoo Finance...`);
    const data = await fetchAllTickers(ALL_TICKERS);
    console.log(`Loaded ${data.length} total rows`);

    const table = worker.table(data);
    viewer.load(table);
    viewer.restore({
        plugin: "GPU Treemap",
        group_by: ["Sector", "Ticker"],
        columns: ["Volume", null, null],
    });
} else if (view === "treemap2") {
    const req = fetch(arrow);
    const resp = await req;
    const buffer = await resp.arrayBuffer();
    const table = worker.table(buffer);
    viewer.load(table);
    viewer.restore({
        plugin: "GPU Treemap",
        group_by: ["Region", "State", "Product Name"],
        columns: ["Sales", "Profit", null],
    });
} else if (view === "stonks") {
    console.log(`Fetching ${ALL_TICKERS.length} tickers from Yahoo Finance...`);
    const data = await fetchAllTickers(ALL_TICKERS);
    console.log(`Loaded ${data.length} total rows`);

    const table = worker.table(data);
    viewer.load(table);
    viewer.restore({
        version: "4.3.0",
        plugin: "GPU Treemap",
        settings: true,
        theme: "Pro Dark",
        group_by: ["Sector", "Ticker"],
        split_by: [],
        sort: [["Close", "desc"]],
        columns: ["Close", null, null],
        aggregates: {
            Close: "last minus first",
        },
    });
} else if (view === "line") {
    console.log(`Fetching ${ALL_TICKERS.length} tickers from Yahoo Finance...`);
    const data = await fetchAllTickers(ALL_TICKERS);
    console.log(`Loaded ${data.length} total rows`);

    const table = worker.table(data);
    viewer.load(table);
    viewer.restore({
        plugin: "GPU Line",
        filter: [["Ticker", "in", ["AAPL", "MSFT", "GOOGL", "AMZN", "META"]]],
        split_by: ["Ticker"],
        sort: [["Date", "asc"]],
        columns: ["Date", "Close"],
    });
} else {
    viewer.restore({
        plugin: "GPU Scatter",
        columns: ["Date", "Close", "Volume", "Sector", "Ticker"],
    });
}
