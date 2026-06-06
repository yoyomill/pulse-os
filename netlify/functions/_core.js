const TRACKED_ASSETS = [
  { base: 'BTC', name: 'Bitcoin', binance: 'BTCUSDT', cg: 'bitcoin', sodex: 'vBTC_vUSDC' },
  { base: 'ETH', name: 'Ethereum', binance: 'ETHUSDT', cg: 'ethereum', sodex: 'vETH_vUSDC' },
  { base: 'SOL', name: 'Solana', binance: 'SOLUSDT', cg: 'solana', sodex: 'vSOL_vUSDC' },
  { base: 'BNB', name: 'BNB', binance: 'BNBUSDT', cg: 'binancecoin', sodex: null },
  { base: 'XRP', name: 'XRP', binance: 'XRPUSDT', cg: 'ripple', sodex: null },
  { base: 'ADA', name: 'Cardano', binance: 'ADAUSDT', cg: 'cardano', sodex: null },
  { base: 'DOGE', name: 'Dogecoin', binance: 'DOGEUSDT', cg: 'dogecoin', sodex: null },
  { base: 'AVAX', name: 'Avalanche', binance: 'AVAXUSDT', cg: 'avalanche-2', sodex: 'vAVAX_vUSDC' },
  { base: 'LINK', name: 'Chainlink', binance: 'LINKUSDT', cg: 'chainlink', sodex: 'vLINK_vUSDC' },
  { base: 'SUI', name: 'Sui', binance: 'SUIUSDT', cg: 'sui', sodex: null },
];

const STYLE_PROFILES = {
  scalping: { label: 'Scalper', weights: { trend: 10, momentum: 40, volatility: 25, volume: 20, structure: 5 }, threshold: 60, leverageCap: 20, atrStop: 1.0, atrTarget: 1.7 },
  intraday: { label: 'Intraday', weights: { trend: 25, momentum: 30, volatility: 20, volume: 15, structure: 10 }, threshold: 65, leverageCap: 10, atrStop: 1.4, atrTarget: 2.4 },
  swing: { label: 'Swing', weights: { trend: 35, momentum: 20, volatility: 10, volume: 10, structure: 25 }, threshold: 70, leverageCap: 5, atrStop: 1.9, atrTarget: 3.2 },
  position: { label: 'Position', weights: { trend: 45, momentum: 10, volatility: 5, volume: 10, structure: 30 }, threshold: 75, leverageCap: 3, atrStop: 2.5, atrTarget: 4.0 },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=20, s-maxage=30',
  'Content-Type': 'application/json; charset=utf-8',
};

function json(statusCode, body, extraHeaders = {}) {
  return { statusCode, headers: { ...CORS, ...extraHeaders }, body: JSON.stringify(body) };
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function pct(v, d = 2) { return `${num(v).toFixed(d)}%`; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchJson(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Pulse-Wave2-OS/1.0',
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    let payload;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${res.statusText}`);
      err.payload = payload;
      err.url = url;
      throw err;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function withFallback(label, calls) {
  const errors = [];
  for (const fn of calls) {
    try { return await fn(); }
    catch (err) { errors.push(`${label}: ${err.message}`); await sleep(120); }
  }
  const error = new Error(errors.join(' | '));
  error.errors = errors;
  throw error;
}

async function fetchBinanceTickers(symbols = TRACKED_ASSETS.map(a => a.binance)) {
  const encoded = encodeURIComponent(JSON.stringify(symbols));
  const base1 = process.env.BINANCE_REST_BASE || 'https://api.binance.com';
  const base2 = process.env.BINANCE_REST_FALLBACK || 'https://data-api.binance.vision';
  const url = (base) => `${base}/api/v3/ticker/24hr?symbols=${encoded}`;
  const raw = await withFallback('binance-tickers', [() => fetchJson(url(base1)), () => fetchJson(url(base2))]);
  return raw.map((r) => {
    const meta = TRACKED_ASSETS.find(a => a.binance === r.symbol) || { base: r.symbol.replace('USDT', ''), name: r.symbol };
    return {
      symbol: r.symbol,
      base: meta.base,
      name: meta.name,
      price: num(r.lastPrice),
      changePct: num(r.priceChangePercent),
      quoteVolume: num(r.quoteVolume),
      high: num(r.highPrice),
      low: num(r.lowPrice),
      source: 'Binance Spot 24h',
    };
  });
}

async function fetchBinanceKlines(symbol = 'BTCUSDT', interval = '1h', limit = 160) {
  const base1 = process.env.BINANCE_REST_BASE || 'https://api.binance.com';
  const base2 = process.env.BINANCE_REST_FALLBACK || 'https://data-api.binance.vision';
  const url = (base) => `${base}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const raw = await withFallback('binance-klines', [() => fetchJson(url(base1)), () => fetchJson(url(base2))]);
  return raw.map((k) => ({
    time: Number(k[0]),
    open: num(k[1]),
    high: num(k[2]),
    low: num(k[3]),
    close: num(k[4]),
    volume: num(k[5]),
  }));
}

async function fetchCoinGeckoMarkets() {
  const ids = TRACKED_ASSETS.map(a => a.cg).join(',');
  const hasPro = Boolean(process.env.COINGECKO_PRO_API_KEY);
  const base = hasPro
    ? (process.env.COINGECKO_PRO_BASE || 'https://pro-api.coingecko.com/api/v3')
    : (process.env.COINGECKO_PUBLIC_BASE || 'https://api.coingecko.com/api/v3');
  const headers = {};
  if (hasPro) headers['x-cg-pro-api-key'] = process.env.COINGECKO_PRO_API_KEY;
  else if (process.env.COINGECKO_DEMO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_DEMO_API_KEY;
  const url = `${base}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h,7d`;
  const raw = await fetchJson(url, { headers });
  return raw.map((r) => ({
    id: r.id,
    symbol: String(r.symbol || '').toUpperCase(),
    name: r.name,
    price: num(r.current_price),
    marketCap: num(r.market_cap),
    rank: r.market_cap_rank,
    volume24h: num(r.total_volume),
    change24h: num(r.price_change_percentage_24h),
    change7d: num(r.price_change_percentage_7d_in_currency),
    source: hasPro ? 'CoinGecko Pro' : 'CoinGecko Public',
  }));
}

async function fetchCoinGeckoTrending() {
  const hasPro = Boolean(process.env.COINGECKO_PRO_API_KEY);
  const base = hasPro
    ? (process.env.COINGECKO_PRO_BASE || 'https://pro-api.coingecko.com/api/v3')
    : (process.env.COINGECKO_PUBLIC_BASE || 'https://api.coingecko.com/api/v3');
  const headers = {};
  if (hasPro) headers['x-cg-pro-api-key'] = process.env.COINGECKO_PRO_API_KEY;
  else if (process.env.COINGECKO_DEMO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_DEMO_API_KEY;
  const raw = await fetchJson(`${base}/search/trending`, { headers });
  return (raw.coins || []).slice(0, 8).map((x) => ({
    symbol: String(x.item?.symbol || '').toUpperCase(),
    name: x.item?.name,
    rank: x.item?.market_cap_rank,
    score: x.item?.score,
  }));
}

async function fetchSoDEXTickers() {
  const base = (process.env.SODEX_SPOT_BASE || 'https://testnet-gw.sodex.dev/api/v1/spot').replace(/\/$/, '');
  const raw = await fetchJson(`${base}/markets/tickers`);
  const rows = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([symbol, v]) => ({ symbol, ...v }));
  return rows.slice(0, 20).map((r) => ({
    symbol: r.symbol || r.market || r.s || 'UNKNOWN',
    price: num(r.lastPrice ?? r.last ?? r.price),
    changePct: num(r.priceChangePercent ?? r.changePercent ?? r.change),
    volume: num(r.quoteVolume ?? r.volume),
    source: 'SoDEX public spot',
  }));
}

async function fetchSoSoValueOptional() {
  const key = process.env.SOSOVALUE_API_KEY;
  if (!key) return { enabled: false, news: [], macro: [], etf: [], status: 'no_key' };
  const base = 'https://openapi.sosovalue.com/openapi/v1';
  const headers = { 'x-soso-api-key': key };
  const out = { enabled: true, news: [], macro: [], etf: [], status: 'partial' };
  try { out.news = await fetchJson(`${base}/news/hot`, { headers }); } catch (e) { out.newsError = e.message; }
  try { out.macro = await fetchJson(`${base}/macro/events`, { headers }); } catch (e) { out.macroError = e.message; }
  try { out.etf = await fetchJson(`${base}/etfs/summary-history`, { headers }); } catch (e) { out.etfError = e.message; }
  out.status = (out.news?.length || out.macro?.length || out.etf?.length) ? 'live' : 'failed';
  return out;
}

function arrLast(arr) {
  for (let i = arr.length - 1; i >= 0; i--) if (Number.isFinite(arr[i])) return arr[i];
  return NaN;
}
function sma(values, period) {
  return values.map((_, i) => {
    if (i < period - 1) return NaN;
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += values[j];
    return s / period;
  });
}
function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(NaN); continue; }
    if (i === period - 1) {
      let s = 0;
      for (let j = 0; j < period; j++) s += values[j];
      prev = s / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}
function rsi(closes, period = 14) {
  const out = [NaN];
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (i <= period) {
      gains += Math.max(diff, 0);
      losses += Math.max(-diff, 0);
      out.push(i === period ? 100 - 100 / (1 + (gains / period) / Math.max(losses / period, 1e-9)) : NaN);
    } else {
      gains = (gains * (period - 1) + Math.max(diff, 0)) / period;
      losses = (losses * (period - 1) + Math.max(-diff, 0)) / period;
      out.push(100 - 100 / (1 + gains / Math.max(losses, 1e-9)));
    }
  }
  return out;
}
function macd(closes) {
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const line = closes.map((_, i) => Number.isFinite(fast[i]) && Number.isFinite(slow[i]) ? fast[i] - slow[i] : NaN);
  const valid = line.filter(Number.isFinite);
  const sigValid = ema(valid, 9);
  const signal = [];
  let vi = 0;
  for (const v of line) {
    if (!Number.isFinite(v)) signal.push(NaN);
    else signal.push(sigValid[vi++] ?? NaN);
  }
  const hist = line.map((v, i) => Number.isFinite(v) && Number.isFinite(signal[i]) ? v - signal[i] : NaN);
  return { line, signal, hist };
}
function atr(highs, lows, closes, period = 14) {
  const tr = [];
  for (let i = 0; i < closes.length; i++) {
    tr.push(i === 0 ? highs[i] - lows[i] : Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  }
  return sma(tr, period);
}
function bollinger(closes, period = 20, mult = 2) {
  const mid = sma(closes, period);
  return closes.map((close, i) => {
    if (!Number.isFinite(mid[i])) return { upper: NaN, lower: NaN, middle: NaN, widthPct: NaN, percentB: NaN };
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += (closes[j] - mid[i]) ** 2;
    const sd = Math.sqrt(sq / period);
    const upper = mid[i] + sd * mult;
    const lower = mid[i] - sd * mult;
    return { upper, lower, middle: mid[i], widthPct: ((upper - lower) / mid[i]) * 100, percentB: (close - lower) / Math.max(upper - lower, 1e-9) };
  });
}
function supportResistance(closes, lookback = 60) {
  const slice = closes.slice(-lookback);
  return { support: Math.min(...slice), resistance: Math.max(...slice) };
}

function scoreMarket(klines, style = 'intraday') {
  if (!Array.isArray(klines) || klines.length < 40) throw new Error('Need at least 40 klines for signal engine');
  const profile = STYLE_PROFILES[style] || STYLE_PROFILES.intraday;
  const closes = klines.map(k => k.close);
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);
  const volumes = klines.map(k => k.volume);
  const price = closes[closes.length - 1];

  const ema12 = arrLast(ema(closes, 12));
  const ema26 = arrLast(ema(closes, 26));
  const ema50 = arrLast(ema(closes, 50));
  const rsi14 = arrLast(rsi(closes, 14));
  const macdData = macd(closes);
  const macdHist = arrLast(macdData.hist);
  const atr14 = arrLast(atr(highs, lows, closes, 14));
  const atrPct = (atr14 / price) * 100;
  const bb = bollinger(closes, 20, 2).at(-1);
  const volSma20 = arrLast(sma(volumes, 20));
  const volRatio = volumes.at(-1) / Math.max(volSma20, 1e-9);
  const sr = supportResistance(closes, Math.min(80, closes.length));

  const trendScore = clamp(((ema12 - ema26) / price) * 2400 + (price > ema50 ? 16 : -16), -100, 100);
  const momentumScore = clamp((rsi14 - 50) * 2.0 + (macdHist / price) * 3200, -100, 100);
  const volatilityScore = clamp(55 - Math.abs(atrPct - 2.4) * 18 + ((bb.percentB > 0.15 && bb.percentB < 0.85) ? 10 : -10), -100, 100);
  const volumeScore = clamp((volRatio - 1) * 45, -100, 100);
  const distSupport = ((price - sr.support) / price) * 100;
  const distResistance = ((sr.resistance - price) / price) * 100;
  const structureScore = clamp(distSupport > distResistance ? 20 - distResistance * 4 : -20 + distSupport * 4, -100, 100);

  const factors = {
    trend: Math.round(trendScore),
    momentum: Math.round(momentumScore),
    volatility: Math.round(volatilityScore),
    volume: Math.round(volumeScore),
    structure: Math.round(structureScore),
  };
  const weights = profile.weights;
  const composite = Object.entries(factors).reduce((sum, [k, v]) => sum + v * weights[k] / 100, 0);
  const abs = Math.abs(composite);
  const confidence = clamp(Math.round(abs * 0.72 + 22 + Math.min(volRatio, 2) * 4), 0, 99);
  let action = 'HOLD';
  if (composite >= 58) action = 'STRONG_LONG';
  else if (composite >= 26) action = 'LONG';
  else if (composite >= 12) action = 'WEAK_LONG';
  else if (composite <= -58) action = 'STRONG_SHORT';
  else if (composite <= -26) action = 'SHORT';
  else if (composite <= -12) action = 'WEAK_SHORT';

  const directional = action.includes('LONG') ? 'long' : action.includes('SHORT') ? 'short' : 'flat';
  const regime = Math.abs(trendScore) > 45 && atrPct < 4 ? (trendScore > 0 ? 'TRENDING_UP' : 'TRENDING_DOWN') : atrPct >= 4.5 ? 'VOLATILE' : Math.abs(structureScore) > 45 ? 'BREAKOUT' : 'RANGING';
  const stopDistance = Math.max(atr14 * profile.atrStop, price * 0.005);
  const targetDistance = Math.max(atr14 * profile.atrTarget, price * 0.01);
  const entry = price;
  const stopLoss = directional === 'short' ? entry + stopDistance : directional === 'long' ? entry - stopDistance : entry - stopDistance;
  const takeProfit = directional === 'short' ? entry - targetDistance : directional === 'long' ? entry + targetDistance : entry + targetDistance;
  const riskUsd = 100; // default one-person desk risk budget, editable in UI
  const positionSize = riskUsd / Math.abs(entry - stopLoss);
  const notional = positionSize * entry;

  const reasons = [
    `Trend ${factors.trend}: EMA12 ${ema12 > ema26 ? 'above' : 'below'} EMA26; price ${price > ema50 ? 'above' : 'below'} EMA50.`,
    `Momentum ${factors.momentum}: RSI ${rsi14.toFixed(1)}, MACD histogram ${macdHist.toFixed(5)}.`,
    `Volatility ${factors.volatility}: ATR ${atrPct.toFixed(2)}%, BB %B ${Number.isFinite(bb.percentB) ? bb.percentB.toFixed(2) : 'n/a'}.`,
    `Volume ${factors.volume}: latest volume is ${volRatio.toFixed(2)}x its 20-period average.`,
    `Structure ${factors.structure}: support ${sr.support.toFixed(4)}, resistance ${sr.resistance.toFixed(4)}.`,
  ];

  return {
    profile: profile.label,
    style,
    action,
    direction: directional,
    confidence,
    composite: Math.round(composite),
    regime,
    price,
    indicators: { ema12, ema26, ema50, rsi14, macdHist, atr14, atrPct, volumeRatio: volRatio, support: sr.support, resistance: sr.resistance },
    factors,
    weights,
    reasons,
    executionPlan: {
      entry,
      stopLoss,
      takeProfit,
      riskReward: Math.abs((takeProfit - entry) / Math.max(Math.abs(entry - stopLoss), 1e-9)),
      defaultRiskUsd: riskUsd,
      estimatedPositionSize: positionSize,
      estimatedNotional: notional,
      maxLeverage: profile.leverageCap,
      confirmationGate: confidence >= profile.threshold && directional !== 'flat',
      note: 'Non-custodial plan only. No order is sent. Use paper desk or manual execution after review.',
    },
  };
}

function marketPulse(tickers) {
  const rows = tickers || [];
  let advancers = 0, decliners = 0, flat = 0;
  const changes = [];
  for (const t of rows) {
    const c = num(t.changePct);
    changes.push(c);
    if (c > 0.05) advancers++;
    else if (c < -0.05) decliners++;
    else flat++;
  }
  const avgChange = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
  const avgAbsChange = changes.length ? changes.reduce((a, b) => a + Math.abs(b), 0) / changes.length : 0;
  const ratio = (advancers + decliners) ? advancers / (advancers + decliners) : 0.5;
  const sentiment = ratio >= 0.62 ? 'BULLISH' : ratio <= 0.38 ? 'BEARISH' : 'NEUTRAL';
  return { advancers, decliners, flat, avgChange, avgAbsChange, bullRatio: ratio, sentiment };
}

function buildSentinel(pulse, signal, cgMarkets = []) {
  const btc = cgMarkets.find(m => m.symbol === 'BTC');
  const etfFlowProxy = btc ? (btc.change7d || 0) * (btc.volume24h || 0) / 100 : 0;
  const fudVolumeProxy = Math.round((pulse.avgAbsChange * 100) + (pulse.decliners * 85) + (signal.indicators.atrPct * 120));
  const threshold = 2200;
  let verdict = 'CLEAR_TO_REVIEW';
  let router = 'Paper route only; manual confirmation required.';
  if (fudVolumeProxy > threshold || signal.indicators.atrPct > 7) {
    verdict = 'HOLD_OR_DELEVERAGE';
    router = 'Execution router locked by Sentinel: volatility/social-panic proxy above threshold.';
  } else if (signal.executionPlan.confirmationGate) {
    verdict = 'ROUTE_TO_PAPER_DESK';
    router = 'Signal passed confidence gate; paper-trade route enabled, live execution disabled.';
  }
  return {
    threshold,
    fudVolumeProxy,
    macroSentimentIndex: clamp((pulse.bullRatio * 0.55) + ((signal.composite + 100) / 200) * 0.45, 0, 1),
    institutionalFlowProxyUsd: Math.round(etfFlowProxy),
    verdict,
    router,
    pillars: [
      'Intelligence layer: CoinGecko market context + Binance candles + optional SoSoValue feeds.',
      'FUD volatility filter: no random values, derived from breadth, decliners, ATR, and volatility.',
      'Signal translation: 5-factor confluence converted into LONG / SHORT / HOLD.',
      'Execution router: non-custodial paper route; live trading is safety-gated.',
    ],
  };
}

function buildNarrative({ pulse, movers, signal, trending = [], soso = {} }) {
  const top = movers.gainers[0];
  const weak = movers.losers[0];
  const trendNames = trending.map(t => t.symbol).filter(Boolean).slice(0, 4).join(', ');
  const baseTone = pulse.sentiment === 'BULLISH'
    ? 'risk-on rotation is active'
    : pulse.sentiment === 'BEARISH'
      ? 'market breadth is defensive'
      : 'market is selective and range-sensitive';
  const sosoLine = soso.enabled
    ? `SoSoValue private server feed status: ${soso.status}.`
    : 'SoSoValue key not configured; public CoinGecko/Binance/SoDEX data used.';
  return {
    headline: `${signal.regime.replace('_', ' ')} / ${pulse.sentiment}: ${baseTone}`,
    summary: `The tracked basket shows ${pulse.advancers} advancers versus ${pulse.decliners} decliners, with average 24h change of ${pulse.avgChange.toFixed(2)}%. ${top ? `${top.base || top.symbol} leads at ${top.changePct.toFixed(2)}%, while ${weak ? `${weak.base || weak.symbol} lags at ${weak.changePct.toFixed(2)}%` : 'no clear laggard'}.'` : ''} The selected asset signal is ${signal.action} at ${signal.confidence}% confidence under the ${signal.profile} profile. ${trendNames ? `CoinGecko trending watchlist: ${trendNames}.` : ''} ${sosoLine}`,
    businessAngle: 'One-person desk workflow: ingest live data, translate to a risk-gated plan, publish commentary, then validate with paper execution before touching capital.',
  };
}

function buildTweetThread(narrative, signal, symbol) {
  const side = signal.direction === 'flat' ? 'watch-only' : signal.direction;
  return [
    `1/ Live ${symbol} desk check: ${narrative.headline}. Signal: ${signal.action} (${signal.confidence}% confidence).`,
    `2/ Thesis: ${signal.reasons[0]} ${signal.reasons[1]}`,
    `3/ Risk: ATR is ${signal.indicators.atrPct.toFixed(2)}%. Sentinel route = ${signal.executionPlan.confirmationGate ? 'reviewable plan' : 'wait / no trade'}.`,
    `4/ Plan: ${side}; entry ${signal.executionPlan.entry.toFixed(4)}, stop ${signal.executionPlan.stopLoss.toFixed(4)}, target ${signal.executionPlan.takeProfit.toFixed(4)}. Not financial advice.`,
  ];
}

function buildMovers(tickers) {
  const sorted = [...tickers].sort((a, b) => b.changePct - a.changePct);
  return { gainers: sorted.slice(0, 5), losers: sorted.slice(-5).reverse() };
}

function buildDashboard({ tickers, klines, cgMarkets, trending, sodex, soso, style, symbol }) {
  const signal = scoreMarket(klines, style);
  const pulse = marketPulse(tickers);
  const movers = buildMovers(tickers);
  const sentinel = buildSentinel(pulse, signal, cgMarkets);
  const narrative = buildNarrative({ pulse, movers, signal, trending, soso });
  const tweets = buildTweetThread(narrative, signal, symbol);
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      symbol,
      style,
      noMockData: true,
      secretPolicy: 'All optional keys are read only inside Netlify Functions. The browser receives normalized output only.',
    },
    assets: tickers,
    coingecko: cgMarkets,
    trending,
    sodex,
    soso: { enabled: Boolean(soso.enabled), status: soso.status, counts: { news: soso.news?.length || 0, macro: soso.macro?.length || 0, etf: soso.etf?.length || 0 } },
    klines: klines.slice(-96),
    pulse,
    movers,
    signal,
    sentinel,
    narrative,
    tweets,
    sourceStatus: {
      binance: 'live_required',
      coingecko: cgMarkets.length ? 'live' : 'unavailable',
      sodex: Array.isArray(sodex) && sodex.length ? 'live' : 'optional_unavailable',
      sosovalue: soso.enabled ? soso.status : 'optional_no_key',
    },
  };
}

module.exports = {
  TRACKED_ASSETS,
  STYLE_PROFILES,
  CORS,
  json,
  num,
  fetchBinanceTickers,
  fetchBinanceKlines,
  fetchCoinGeckoMarkets,
  fetchCoinGeckoTrending,
  fetchSoDEXTickers,
  fetchSoSoValueOptional,
  buildDashboard,
};
