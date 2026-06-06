const BINANCE_HOSTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision'
];

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'TONUSDT', 'TRXUSDT', 'DOTUSDT',
  'LTCUSDT', 'BCHUSDT', 'OPUSDT', 'ARBUSDT', 'NEARUSDT', 'INJUSDT',
  'APTUSDT', 'SUIUSDT', 'SEIUSDT', 'TIAUSDT', 'ORDIUSDT', 'WIFUSDT'
];

const COINGECKO_IDS = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
  BNBUSDT: 'binancecoin',
  XRPUSDT: 'ripple',
  DOGEUSDT: 'dogecoin',
  ADAUSDT: 'cardano',
  AVAXUSDT: 'avalanche-2',
  LINKUSDT: 'chainlink',
  TONUSDT: 'the-open-network',
  TRXUSDT: 'tron',
  DOTUSDT: 'polkadot',
  LTCUSDT: 'litecoin',
  BCHUSDT: 'bitcoin-cash',
  OPUSDT: 'optimism',
  ARBUSDT: 'arbitrum',
  NEARUSDT: 'near',
  INJUSDT: 'injective-protocol',
  APTUSDT: 'aptos',
  SUIUSDT: 'sui',
  SEIUSDT: 'sei-network',
  TIAUSDT: 'celestia',
  ORDIUSDT: 'ordinals',
  WIFUSDT: 'dogwifcoin'
};

const VALID_INTERVALS = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d']);

exports.handler = async function handler(event) {
  const qs = event.queryStringParameters || {};
  const symbol = sanitizeSymbol(qs.symbol || 'BTCUSDT');
  const interval = VALID_INTERVALS.has(qs.interval) ? qs.interval : '1h';

  try {
    const data = await loadBinance(symbol, interval);
    return json({ ok: true, mode: 'live', source: data.source, fetchedAt: new Date().toISOString(), ...data });
  } catch (primaryError) {
    try {
      const fallback = await loadCoinGecko(symbol, interval);
      return json({
        ok: true,
        mode: 'live_partial',
        source: fallback.source,
        warning: 'Some exchange-depth modules are reduced because the primary feed is unavailable.',
        fetchedAt: new Date().toISOString(),
        ...fallback
      });
    } catch (fallbackError) {
      return json({
        ok: false,
        error: 'MARKET_DATA_UNAVAILABLE',
        message: 'Live market data is temporarily unavailable. Try refreshing in a moment.',
        detail: safeError(primaryError),
        fallbackDetail: safeError(fallbackError),
        fetchedAt: new Date().toISOString()
      }, 502);
    }
  }
};

async function loadBinance(symbol, interval) {
  const host = await firstWorkingHost();
  const [tickersRaw, klinesRaw, depthRaw, tradesRaw, premiumRaw, oiRaw] = await Promise.all([
    getJson(`${host}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(SYMBOLS))}`),
    getJson(`${host}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=140`),
    getJson(`${host}/api/v3/depth?symbol=${symbol}&limit=20`),
    getJson(`${host}/api/v3/trades?symbol=${symbol}&limit=40`),
    maybeJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`),
    maybeJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`)
  ]);

  const tickers = tickersRaw
    .map(normalizeTicker)
    .filter(Boolean)
    .sort((a, b) => b.quoteVolume - a.quoteVolume);
  const selectedTicker = tickers.find(t => t.symbol === symbol) || tickers[0];
  const klines = klinesRaw.map(normalizeKline).filter(Boolean);
  const depth = normalizeDepth(depthRaw);
  const trades = tradesRaw.map(normalizeTrade).filter(Boolean).reverse();

  return enrich({
    source: 'market-feed',
    symbol: selectedTicker?.symbol || symbol,
    interval,
    selected: selectedTicker,
    tickers,
    klines,
    depth,
    trades,
    futures: normalizeFutures(premiumRaw, oiRaw)
  });
}

async function firstWorkingHost() {
  let last;
  for (const host of BINANCE_HOSTS) {
    try {
      await getJson(`${host}/api/v3/time`, 6000);
      return host;
    } catch (err) {
      last = err;
    }
  }
  throw last || new Error('No market host reachable');
}

async function loadCoinGecko(symbol, interval) {
  const ids = Object.values(COINGECKO_IDS).join(',');
  const selectedId = COINGECKO_IDS[symbol] || 'bitcoin';
  const [markets, chartRaw] = await Promise.all([
    getJson(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=80&page=1&sparkline=false&price_change_percentage=24h`),
    getJson(`https://api.coingecko.com/api/v3/coins/${selectedId}/market_chart?vs_currency=usd&days=${interval === '1d' ? 30 : 2}`)
  ]);

  const tickers = markets.map(coin => {
    const sym = Object.entries(COINGECKO_IDS).find(([, id]) => id === coin.id)?.[0] || `${String(coin.symbol || '').toUpperCase()}USDT`;
    return {
      symbol: sym,
      asset: sym.replace('USDT', ''),
      pair: `${sym.replace('USDT', '')}/USDT`,
      lastPrice: num(coin.current_price),
      price: num(coin.current_price),
      priceText: formatPrice(num(coin.current_price)),
      priceChangePercent: num(coin.price_change_percentage_24h),
      change: num(coin.price_change_24h),
      highPrice: num(coin.high_24h),
      lowPrice: num(coin.low_24h),
      volume: num(coin.total_volume),
      quoteVolume: num(coin.total_volume),
      count: 0,
      marketCap: num(coin.market_cap),
      image: coin.image || ''
    };
  });

  const selected = tickers.find(t => t.symbol === symbol) || tickers[0];
  const prices = Array.isArray(chartRaw.prices) ? chartRaw.prices : [];
  const volumes = Array.isArray(chartRaw.total_volumes) ? chartRaw.total_volumes : [];
  const klines = prices.slice(-140).map((p, i, arr) => {
    const close = num(p[1]);
    const prev = i ? num(arr[i - 1][1]) : close;
    const v = volumes[i] ? num(volumes[i][1]) : 0;
    const high = Math.max(close, prev) * 1.0015;
    const low = Math.min(close, prev) * 0.9985;
    return { time: p[0], open: prev, high, low, close, volume: v };
  });

  return enrich({
    source: 'market-feed-alt',
    symbol: selected?.symbol || symbol,
    interval,
    selected,
    tickers,
    klines,
    depth: makeReducedDepth(selected?.lastPrice || 0),
    trades: makeReducedTrades(selected?.lastPrice || 0),
    futures: {}
  });
}

function enrich(base) {
  const tickers = Array.isArray(base.tickers) ? base.tickers : [];
  const selected = base.selected || tickers[0] || {};
  const gainers = [...tickers].sort((a, b) => b.priceChangePercent - a.priceChangePercent).slice(0, 8);
  const losers = [...tickers].sort((a, b) => a.priceChangePercent - b.priceChangePercent).slice(0, 8);
  const volumeLeaders = [...tickers].sort((a, b) => b.quoteVolume - a.quoteVolume).slice(0, 10);
  const avgChange = average(tickers.map(t => t.priceChangePercent));
  const bullish = tickers.filter(t => t.priceChangePercent >= 0).length;
  const bearish = Math.max(0, tickers.length - bullish);
  const breadth = tickers.length ? bullish / tickers.length : 0;
  const k = base.klines || [];
  const closes = k.map(x => x.close).filter(Number.isFinite);
  const atr = averageTrueRange(k);
  const vol = volatility(closes);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const rsi14 = rsi(closes, 14);
  const trend = last(ema12) > last(ema26) ? 'Bullish' : last(ema12) < last(ema26) ? 'Bearish' : 'Flat';
  const spread = spreadPct(base.depth);
  const score = scoreSignal({ breadth, trend, rsi: rsi14, change: selected.priceChangePercent, volatility: vol, spread });

  return {
    ...base,
    selected,
    topGainers: gainers,
    topLosers: losers,
    volumeLeaders,
    heatmap: tickers.slice(0, 24),
    metrics: {
      avgChange,
      bullish,
      bearish,
      breadth,
      totalQuoteVolume: sum(tickers.map(t => t.quoteVolume)),
      volatility: vol,
      atr,
      atrPct: selected.lastPrice ? (atr / selected.lastPrice) * 100 : 0,
      rsi: rsi14,
      trend,
      spread,
      signalScore: score.value,
      signalLabel: score.label,
      signalConfidence: score.confidence
    },
    derived: {
      ema12: last(ema12),
      ema26: last(ema26),
      high: Math.max(...closes),
      low: Math.min(...closes),
      support: support(k),
      resistance: resistance(k)
    }
  };
}

function normalizeTicker(t) {
  if (!t || !t.symbol) return null;
  const asset = t.symbol.replace('USDT', '');
  const price = num(t.lastPrice);
  return {
    symbol: t.symbol,
    asset,
    pair: `${asset}/USDT`,
    lastPrice: price,
    price,
    priceText: formatPrice(price),
    priceChangePercent: num(t.priceChangePercent),
    change: num(t.priceChange),
    highPrice: num(t.highPrice),
    lowPrice: num(t.lowPrice),
    volume: num(t.volume),
    quoteVolume: num(t.quoteVolume),
    count: Number(t.count || 0),
    weightedAvgPrice: num(t.weightedAvgPrice)
  };
}

function normalizeKline(k) {
  if (!Array.isArray(k)) return null;
  return { time: Number(k[0]), open: num(k[1]), high: num(k[2]), low: num(k[3]), close: num(k[4]), volume: num(k[5]) };
}

function normalizeDepth(d) {
  const bids = (d?.bids || []).map(([p, q]) => ({ price: num(p), qty: num(q), total: num(p) * num(q) }));
  const asks = (d?.asks || []).map(([p, q]) => ({ price: num(p), qty: num(q), total: num(p) * num(q) }));
  return { bids, asks };
}

function normalizeTrade(t) {
  return {
    id: t.id,
    time: Number(t.time || Date.now()),
    price: num(t.price),
    qty: num(t.qty),
    quoteQty: num(t.quoteQty),
    side: t.isBuyerMaker ? 'sell' : 'buy'
  };
}

function normalizeFutures(premium, oi) {
  return {
    markPrice: num(premium?.markPrice),
    indexPrice: num(premium?.indexPrice),
    fundingRate: num(premium?.lastFundingRate),
    nextFundingTime: Number(premium?.nextFundingTime || 0),
    openInterest: num(oi?.openInterest)
  };
}

function makeReducedDepth(price) {
  if (!price) return { bids: [], asks: [] };
  const bids = Array.from({ length: 12 }, (_, i) => {
    const p = price * (1 - (i + 1) * 0.0006);
    const q = 0;
    return { price: p, qty: q, total: 0 };
  });
  const asks = Array.from({ length: 12 }, (_, i) => {
    const p = price * (1 + (i + 1) * 0.0006);
    const q = 0;
    return { price: p, qty: q, total: 0 };
  });
  return { bids, asks };
}

function makeReducedTrades(price) {
  if (!price) return [];
  return Array.from({ length: 20 }, (_, i) => ({
    id: i,
    time: Date.now() - i * 12000,
    price,
    qty: 0,
    quoteQty: 0,
    side: i % 2 ? 'sell' : 'buy'
  }));
}

async function getJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function maybeJson(url) {
  try {
    return await getJson(url, 5000);
  } catch (_) {
    return null;
  }
}

function sanitizeSymbol(value) {
  const clean = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return SYMBOLS.includes(clean) ? clean : 'BTCUSDT';
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatPrice(n) {
  if (!Number.isFinite(n)) return '--';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': statusCode === 200 ? 'public, max-age=10, s-maxage=10' : 'no-store',
      'access-control-allow-origin': '*'
    },
    body: JSON.stringify(body)
  };
}

function safeError(err) {
  return err && err.message ? String(err.message).slice(0, 120) : 'unknown';
}

function sum(arr) { return arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0); }
function average(arr) { const v = arr.filter(Number.isFinite); return v.length ? sum(v) / v.length : 0; }
function last(arr) { return arr && arr.length ? arr[arr.length - 1] : 0; }

function ema(values, period) {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i += 1) out.push(values[i] * k + out[i - 1] * (1 - k));
  return out;
}

function rsi(values, period = 14) {
  if (values.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (!losses) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function volatility(values) {
  if (values.length < 3) return 0;
  const returns = [];
  for (let i = 1; i < values.length; i += 1) {
    if (values[i - 1]) returns.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  const mean = average(returns);
  const variance = average(returns.map(x => (x - mean) ** 2));
  return Math.sqrt(variance) * 100;
}

function averageTrueRange(k, period = 14) {
  if (!k.length) return 0;
  const trs = [];
  for (let i = 1; i < k.length; i += 1) {
    const current = k[i];
    const prev = k[i - 1];
    trs.push(Math.max(current.high - current.low, Math.abs(current.high - prev.close), Math.abs(current.low - prev.close)));
  }
  return average(trs.slice(-period));
}

function support(k) {
  const lows = (k || []).slice(-40).map(x => x.low).filter(Boolean);
  return lows.length ? Math.min(...lows) : 0;
}

function resistance(k) {
  const highs = (k || []).slice(-40).map(x => x.high).filter(Boolean);
  return highs.length ? Math.max(...highs) : 0;
}

function spreadPct(depth) {
  const bid = depth?.bids?.[0]?.price || 0;
  const ask = depth?.asks?.[0]?.price || 0;
  if (!bid || !ask) return 0;
  return ((ask - bid) / ((ask + bid) / 2)) * 100;
}

function scoreSignal({ breadth, trend, rsi, change, volatility: vol, spread }) {
  let score = 50;
  score += (breadth - 0.5) * 28;
  score += trend === 'Bullish' ? 12 : trend === 'Bearish' ? -12 : 0;
  score += change > 0 ? Math.min(10, change) : Math.max(-10, change);
  if (rsi < 35) score += 8;
  if (rsi > 70) score -= 8;
  if (vol > 3) score -= 6;
  if (spread > 0.2) score -= 5;
  score = Math.max(0, Math.min(100, score));
  return {
    value: score,
    label: score >= 62 ? 'Bullish' : score <= 38 ? 'Bearish' : 'Neutral',
    confidence: Math.abs(score - 50) * 2
  };
}
