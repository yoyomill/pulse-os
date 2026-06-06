const {
  TRACKED_ASSETS,
  STYLE_PROFILES,
  CORS,
  json,
  fetchBinanceTickers,
  fetchBinanceKlines,
  fetchCoinGeckoMarkets,
  fetchCoinGeckoTrending,
  fetchSoDEXTickers,
  fetchSoSoValueOptional,
  buildDashboard,
} = require('./_core');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  try {
    const params = event.queryStringParameters || {};
    const requested = String(params.symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const asset = TRACKED_ASSETS.find(a => a.binance === requested || a.base === requested || a.sodex === requested) || TRACKED_ASSETS[0];
    const style = STYLE_PROFILES[params.style] ? params.style : 'intraday';
    const interval = ['15m', '1h', '4h', '1d'].includes(params.interval) ? params.interval : '1h';

    const [tickers, klines, cgResult, trendingResult, sodexResult, sosoResult] = await Promise.allSettled([
      fetchBinanceTickers(),
      fetchBinanceKlines(asset.binance, interval, 160),
      fetchCoinGeckoMarkets(),
      fetchCoinGeckoTrending(),
      fetchSoDEXTickers(),
      fetchSoSoValueOptional(),
    ]);

    if (tickers.status !== 'fulfilled') throw new Error(`Live Binance ticker failed: ${tickers.reason?.message || tickers.reason}`);
    if (klines.status !== 'fulfilled') throw new Error(`Live Binance kline failed: ${klines.reason?.message || klines.reason}`);

    const dashboard = buildDashboard({
      tickers: tickers.value,
      klines: klines.value,
      cgMarkets: cgResult.status === 'fulfilled' ? cgResult.value : [],
      trending: trendingResult.status === 'fulfilled' ? trendingResult.value : [],
      sodex: sodexResult.status === 'fulfilled' ? sodexResult.value : [],
      soso: sosoResult.status === 'fulfilled' ? sosoResult.value : { enabled: false, status: 'failed', news: [], macro: [], etf: [] },
      style,
      symbol: asset.binance,
    });

    dashboard.errors = {
      coingecko: cgResult.status === 'rejected' ? cgResult.reason.message : null,
      trending: trendingResult.status === 'rejected' ? trendingResult.reason.message : null,
      sodex: sodexResult.status === 'rejected' ? sodexResult.reason.message : null,
      sosovalue: sosoResult.status === 'rejected' ? sosoResult.reason.message : null,
    };
    return json(200, dashboard);
  } catch (err) {
    return json(502, {
      error: 'LIVE_DATA_UNAVAILABLE',
      message: err.message,
      noMockData: true,
      hint: 'This app intentionally does not fake data. Check Netlify function logs or API access from the deployment region.',
    }, { 'Cache-Control': 'no-store' });
  }
};
