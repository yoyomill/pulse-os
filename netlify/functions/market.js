const BINANCE_BASES = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://data-api.binance.vision'
];

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
const ALLOWED_INTERVALS = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);

const COINGECKO_IDS = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
  BNBUSDT: 'binancecoin',
  XRPUSDT: 'ripple'
};

const COINGECKO_SYMBOLS = {
  bitcoin: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  solana: 'SOLUSDT',
  binancecoin: 'BNBUSDT',
  ripple: 'XRPUSDT'
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=8, s-maxage=12',
      'Access-Control-Allow-Origin': '*'
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

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getJsonUrl(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'Pulse-OS/2.1' }
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 160)}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

async function getBinanceJson(path) {
  let lastError;
  for (const base of BINANCE_BASES) {
    try {
      return await getJsonUrl(`${base}${path}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`Unable to fetch Binance path: ${path}`);
}

async function getCoinGeckoJson(path) {
  return getJsonUrl(`${COINGECKO_BASE}${path}`, 10000);
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

function cgTicker(coin) {
  const symbol = COINGECKO_SYMBOLS[coin.id] || `${String(coin.symbol || '').toUpperCase()}USDT`;
  return {
    symbol,
    pair: symbol.replace('USDT', '/USDT'),
    lastPrice: toNumber(coin.current_price),
    priceChangePercent: toNumber(coin.price_change_percentage_24h),
    quoteVolume: toNumber(coin.total_volume),
    highPrice: toNumber(coin.high_24h, coin.current_price),
    lowPrice: toNumber(coin.low_24h, coin.current_price)
  };
}

function intervalMs(interval) {
  const map = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000
  };
  return map[interval] || 3_600_000;
}

function candlesFromSparkline(prices, interval) {
  const list = Array.isArray(prices) ? prices.filter(Number.isFinite) : [];
  const selected = list.length > 80 ? list.slice(-80) : list;
  const step = intervalMs(interval);
  const now = Date.now();
  return selected.map((price, index) => {
    const previous = index === 0 ? price : selected[index - 1];
    const high = Math.max(price, previous);
    const low = Math.min(price, previous);
    const openTime = now - (selected.length - index) * step;
    return {
      openTime,
      open: previous,
      high,
      low,
      close: price,
      volume: 0,
      closeTime: openTime + step
    };
  });
}

function derivedDepth(price) {
  const mid = toNumber(price, 1);
  const bids = [];
  const asks = [];
  for (let i = 0; i < 10; i += 1) {
    const spread = (i + 1) * 0.00035;
    const qty = Number((0.12 + (10 - i) * 0.041).toFixed(6));
    bids.push({ price: mid * (1 - spread), qty });
    asks.push({ price: mid * (1 + spread), qty: Number((qty * 0.91).toFixed(6)) });
  }
  return { lastUpdateId: Date.now(), bids, asks };
}

function derivedTrades(price) {
  const mid = toNumber(price, 1);
  return Array.from({ length: 15 }).map((_, i) => {
    const sign = i % 3 === 0 ? -1 : 1;
    return {
      id: Date.now() - i,
      price: mid * (1 + sign * i * 0.00009),
      qty: Number((0.025 + i * 0.017).toFixed(6)),
      time: Date.now() - i * 11_000,
      isBuyerMaker: sign < 0
    };
  });
}

async function binanceMarket(symbol, interval) {
  const watchSymbols = Array.from(new Set([symbol, ...DEFAULT_SYMBOLS]));

  const [ticker, klines, depth, trades, watchlistRaw, allTickers] = await Promise.all([
    getBinanceJson(`/api/v3/ticker/24hr?symbol=${symbol}`),
    getBinanceJson(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=80`),
    getBinanceJson(`/api/v3/depth?symbol=${symbol}&limit=10`),
    getBinanceJson(`/api/v3/trades?symbol=${symbol}&limit=15`),
    Promise.all(watchSymbols.map(s => getBinanceJson(`/api/v3/ticker/24hr?symbol=${s}`).catch(() => null))),
    getBinanceJson('/api/v3/ticker/24hr')
  ]);

  const movers = allTickers
    .filter(t => t.symbol && t.symbol.endsWith('USDT') && !/UPUSDT|DOWNUSDT|BULLUSDT|BEARUSDT/.test(t.symbol))
    .map(compactTicker)
    .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
    .slice(0, 12);

  return {
    ok: true,
    source: 'binance',
    symbol,
    interval,
    updatedAt: new Date().toISOString(),
    ticker: compactTicker(ticker),
    candles: klines.map(compactKline),
    depth: compactDepth(depth),
    trades: trades.map(compactTrade).reverse(),
    watchlist: watchlistRaw.filter(Boolean).map(compactTicker),
    movers
  };
}

async function coinGeckoMarket(symbol, interval, binanceError) {
  const ids = DEFAULT_SYMBOLS.map(s => COINGECKO_IDS[s]).join(',');
  const selectedId = COINGECKO_IDS[symbol] || 'bitcoin';

  const [watchCoins, moverCoins] = await Promise.all([
    getCoinGeckoJson(`/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=24h`),
    getCoinGeckoJson('/coins/markets?vs_currency=usd&order=volume_desc&per_page=80&page=1&sparkline=true&price_change_percentage=24h')
  ]);

  const selectedCoin = watchCoins.find(c => c.id === selectedId) || watchCoins[0];
  const ticker = cgTicker(selectedCoin);
  const candles = candlesFromSparkline(selectedCoin?.sparkline_in_7d?.price || [], interval);
  const movers = moverCoins
    .map(cgTicker)
    .filter(t => t.symbol.endsWith('USDT'))
    .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
    .slice(0, 12);

  return {
    ok: true,
    source: 'coingecko',
    note: 'Binance unavailable; watchlist and chart use CoinGecko live market data. Depth and trades are display estimates derived from the live price.',
    upstreamWarning: binanceError ? String(binanceError.message || binanceError).slice(0, 220) : undefined,
    symbol,
    interval,
    updatedAt: new Date().toISOString(),
    ticker,
    candles,
    depth: derivedDepth(ticker.lastPrice),
    trades: derivedTrades(ticker.lastPrice),
    watchlist: watchCoins.map(cgTicker),
    movers
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});

  const params = event.queryStringParameters || {};
  const symbol = normalizeSymbol(params.symbol);
  const interval = normalizeInterval(params.interval);

  try {
    const data = await binanceMarket(symbol, interval);
    return json(200, data);
  } catch (binanceError) {
    try {
      const data = await coinGeckoMarket(symbol, interval, binanceError);
      return json(200, data);
    } catch (coinGeckoError) {
      return json(502, {
        ok: false,
        error: 'LIVE_MARKET_DATA_UNAVAILABLE',
        message: coinGeckoError.message,
        binanceMessage: binanceError.message
      });
    }
  }
};
