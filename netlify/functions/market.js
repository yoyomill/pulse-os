const BASE = 'https://api.binance.com';
const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
const ALLOWED_INTERVALS = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=10, s-maxage=15'
    },
    body: JSON.stringify(payload)
  };
}

function normalizeSymbol(input) {
  const symbol = String(input || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return symbol.endsWith('USDT') ? symbol : 'BTCUSDT';
}

function normalizeInterval(input) {
  const interval = String(input || '1h');
  return ALLOWED_INTERVALS.has(interval) ? interval : '1h';
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`Upstream ${res.status}: ${path}`);
  return res.json();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function compactTicker(t) {
  return {
    symbol: t.symbol,
    pair: t.symbol.replace('USDT', '/USDT'),
    lastPrice: toNumber(t.lastPrice),
    priceChangePercent: toNumber(t.priceChangePercent),
    quoteVolume: toNumber(t.quoteVolume),
    highPrice: toNumber(t.highPrice),
    lowPrice: toNumber(t.lowPrice)
  };
}

function compactKline(row) {
  return {
    openTime: row[0],
    open: toNumber(row[1]),
    high: toNumber(row[2]),
    low: toNumber(row[3]),
    close: toNumber(row[4]),
    volume: toNumber(row[5]),
    closeTime: row[6]
  };
}

function compactDepth(depth) {
  return {
    lastUpdateId: depth.lastUpdateId,
    bids: (depth.bids || []).slice(0, 10).map(([price, qty]) => ({ price: toNumber(price), qty: toNumber(qty) })),
    asks: (depth.asks || []).slice(0, 10).map(([price, qty]) => ({ price: toNumber(price), qty: toNumber(qty) }))
  };
}

function compactTrade(t) {
  return {
    id: t.id,
    price: toNumber(t.price),
    qty: toNumber(t.qty),
    time: t.time,
    isBuyerMaker: Boolean(t.isBuyerMaker)
  };
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const symbol = normalizeSymbol(params.symbol);
  const interval = normalizeInterval(params.interval);

  try {
    const watchSymbols = Array.from(new Set([symbol, ...DEFAULT_SYMBOLS]));

    const [ticker, klines, depth, trades, watchlistRaw, allTickers] = await Promise.all([
      getJson(`/api/v3/ticker/24hr?symbol=${symbol}`),
      getJson(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=80`),
      getJson(`/api/v3/depth?symbol=${symbol}&limit=10`),
      getJson(`/api/v3/trades?symbol=${symbol}&limit=15`),
      Promise.all(watchSymbols.map(s => getJson(`/api/v3/ticker/24hr?symbol=${s}`).catch(() => null))),
      getJson('/api/v3/ticker/24hr')
    ]);

    const movers = allTickers
      .filter(t => t.symbol && t.symbol.endsWith('USDT') && !/UPUSDT|DOWNUSDT|BULLUSDT|BEARUSDT/.test(t.symbol))
      .map(compactTicker)
      .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
      .slice(0, 12);

    return json(200, {
      ok: true,
      symbol,
      interval,
      updatedAt: new Date().toISOString(),
      ticker: compactTicker(ticker),
      candles: klines.map(compactKline),
      depth: compactDepth(depth),
      trades: trades.map(compactTrade).reverse(),
      watchlist: watchlistRaw.filter(Boolean).map(compactTicker),
      movers
    });
  } catch (error) {
    return json(502, {
      ok: false,
      error: 'LIVE_MARKET_DATA_UNAVAILABLE',
      message: error.message
    });
  }
};
