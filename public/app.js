(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    symbol: localStorage.getItem('pulse.symbol') || 'BTCUSDT',
    interval: localStorage.getItem('pulse.interval') || '1h',
    marketFilter: 'USDT',
    screenFilter: 'all',
    movers: 'gainers',
    chartMode: 'line',
    showMA: true,
    tradeSide: 'Buy',
    favOnly: false,
    pausedTrades: false,
    data: null,
    favorites: JSON.parse(localStorage.getItem('pulse.favorites') || '["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT"]'),
    alerts: JSON.parse(localStorage.getItem('pulse.alerts') || '[]'),
    orders: JSON.parse(localStorage.getItem('pulse.orders') || '[]'),
    positions: JSON.parse(localStorage.getItem('pulse.positions') || '[]')
  };

  const els = {
    tickerTape: $('#tickerTape'),
    symbolSelect: $('#symbolSelect'),
    refreshBtn: $('#refreshBtn'),
    marketRows: $('#marketRows'),
    marketTabs: $('#marketTabs'),
    marketSearch: $('#marketSearch'),
    toggleFavOnly: $('#toggleFavOnly'),
    quickPair: $('#quickPair'),
    buyMode: $('#buyMode'),
    sellMode: $('#sellMode'),
    tradePrice: $('#tradePrice'),
    tradeAmount: $('#tradeAmount'),
    amountUnit: $('#amountUnit'),
    orderType: $('#orderType'),
    leverage: $('#leverage'),
    tradeSlider: $('#tradeSlider'),
    estFee: $('#estFee'),
    orderTotal: $('#orderTotal'),
    placeOrder: $('#placeOrder'),
    availableBalance: $('#availableBalance'),
    chartTitle: $('#chartTitle'),
    intervals: $('#intervals'),
    priceCanvas: $('#priceCanvas'),
    lastMetric: $('#lastMetric'),
    highMetric: $('#highMetric'),
    lowMetric: $('#lowMetric'),
    atrMetric: $('#atrMetric'),
    rsiMetric: $('#rsiMetric'),
    trendMetric: $('#trendMetric'),
    toggleMA: $('#toggleMA'),
    exportCsv: $('#exportCsv'),
    bookPair: $('#bookPair'),
    orderBook: $('#orderBook'),
    midPrice: $('#midPrice'),
    spreadText: $('#spreadText'),
    tradeRows: $('#tradeRows'),
    pauseTrades: $('#pauseTrades'),
    positionRows: $('#positionRows'),
    clearPortfolio: $('#clearPortfolio'),
    equityKpi: $('#equityKpi'),
    pnlKpi: $('#pnlKpi'),
    winRateKpi: $('#winRateKpi'),
    moverGrid: $('#moverGrid'),
    showGainers: $('#showGainers'),
    showLosers: $('#showLosers'),
    heatmap: $('#heatmap'),
    sortHeatmap: $('#sortHeatmap'),
    screenerRows: $('#screenerRows'),
    signalLabel: $('#signalLabel'),
    signalScore: $('#signalScore'),
    gaugeFill: $('#gaugeFill'),
    breadthMetric: $('#breadthMetric'),
    volMetric: $('#volMetric'),
    fundingMetric: $('#fundingMetric'),
    oiMetric: $('#oiMetric'),
    pulseComment: $('#pulseComment'),
    alertSide: $('#alertSide'),
    alertPrice: $('#alertPrice'),
    addAlert: $('#addAlert'),
    clearAlerts: $('#clearAlerts'),
    alertsList: $('#alertsList'),
    calcTabs: $('#calcTabs'),
    calculatorPanel: $('#calculatorPanel'),
    clearOrders: $('#clearOrders'),
    orderHistoryRows: $('#orderHistoryRows'),
    briefingList: $('#briefingList'),
    toast: $('#toast')
  };

  const fmt = {
    price(n) {
      n = Number(n);
      if (!Number.isFinite(n)) return '--';
      if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
      if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
      return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
    },
    compact(n) {
      n = Number(n);
      if (!Number.isFinite(n)) return '--';
      if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
      if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
      if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
      return n.toFixed(2);
    },
    pct(n) {
      n = Number(n);
      if (!Number.isFinite(n)) return '--';
      return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
    },
    time(ms) {
      const d = new Date(Number(ms) || Date.now());
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  };

  function save() {
    localStorage.setItem('pulse.symbol', state.symbol);
    localStorage.setItem('pulse.interval', state.interval);
    localStorage.setItem('pulse.favorites', JSON.stringify(state.favorites));
    localStorage.setItem('pulse.alerts', JSON.stringify(state.alerts));
    localStorage.setItem('pulse.orders', JSON.stringify(state.orders));
    localStorage.setItem('pulse.positions', JSON.stringify(state.positions));
  }

  async function loadMarket() {
    setLoading(true);
    try {
      const data = await fetchMarket(state.symbol, state.interval);
      if (!data.ok) throw new Error(data.message || 'Live feed unavailable');
      state.data = data;
      if (data.symbol && data.symbol !== state.symbol) state.symbol = data.symbol;
      hydrateSymbolSelect(data.tickers || []);
      renderAll();
      checkAlerts();
      setLoading(false);
    } catch (err) {
      setLoading(false);
      els.tickerTape.innerHTML = `<span class="red">${escapeHtml(err.message || 'Market data unavailable')}</span>`;
      toast('Live feed unavailable. Try Refresh.');
    }
  }

  async function fetchMarket(symbol, interval) {
    const routes = [
      `/api/market?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`,
      `/.netlify/functions/market?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`
    ];
    let last;
    for (const route of routes) {
      try {
        const res = await fetch(route, { cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.ok) return body;
        last = body;
      } catch (err) {
        last = err;
      }
    }
    throw new Error(last?.message || last?.error || 'Market route failed');
  }

  function setLoading(isLoading) {
    els.refreshBtn.disabled = isLoading;
    els.refreshBtn.textContent = isLoading ? 'Loading...' : 'Refresh';
  }

  function hydrateSymbolSelect(tickers) {
    const symbols = tickers.map(t => t.symbol);
    if (!symbols.includes(state.symbol)) symbols.unshift(state.symbol);
    els.symbolSelect.innerHTML = symbols.slice(0, 40).map(sym => `<option value="${sym}" ${sym === state.symbol ? 'selected' : ''}>${pair(sym)}</option>`).join('');
  }

  function renderAll() {
    const d = state.data;
    if (!d) return;
    renderTape(d);
    renderMarket(d);
    renderTradePanel(d);
    renderChart(d);
    renderOrderBook(d);
    renderRecentTrades(d);
    renderPortfolio(d);
    renderMovers(d);
    renderHeatmap(d);
    renderScreener(d);
    renderPulse(d);
    renderAlerts();
    renderCalculator(currentCalc());
    renderOrderHistory();
    renderBriefing(d);
  }

  function renderTape(d) {
    const top = (d.volumeLeaders || d.tickers || []).slice(0, 12);
    els.tickerTape.innerHTML = top.map(t => `<span class="ticker-item"><b>${pair(t.symbol)}</b><span>$${fmt.price(t.lastPrice)}</span><span class="${tone(t.priceChangePercent)}">${fmt.pct(t.priceChangePercent)}</span></span>`).join('');
  }

  function renderMarket(d) {
    let rows = [...(d.tickers || [])];
    const search = (els.marketSearch.value || '').trim().toUpperCase();
    if (state.marketFilter === 'GAINERS') rows.sort((a, b) => b.priceChangePercent - a.priceChangePercent);
    if (state.marketFilter === 'LOSERS') rows.sort((a, b) => a.priceChangePercent - b.priceChangePercent);
    if (state.marketFilter === 'VOLUME') rows.sort((a, b) => b.quoteVolume - a.quoteVolume);
    if (search) rows = rows.filter(t => t.symbol.includes(search) || t.pair.includes(search));
    if (state.favOnly) rows = rows.filter(t => state.favorites.includes(t.symbol));
    els.marketRows.innerHTML = rows.slice(0, 18).map(t => `
      <tr data-symbol="${t.symbol}">
        <td><div class="pair-cell"><span class="coin-icon">${t.asset?.slice(0, 1) || '?'}</span><span>${pair(t.symbol)}<span class="subtext">High ${fmt.price(t.highPrice)}</span></span></div></td>
        <td><b>${fmt.price(t.lastPrice)}</b><span class="subtext">Low ${fmt.price(t.lowPrice)}</span></td>
        <td class="${tone(t.priceChangePercent)}">${fmt.pct(t.priceChangePercent)}</td>
        <td>${fmt.compact(t.quoteVolume)}</td>
        <td><button class="fav ${state.favorites.includes(t.symbol) ? 'active' : ''}" data-fav="${t.symbol}">★</button></td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty">No matching pairs</td></tr>`;
  }

  function renderTradePanel(d) {
    const s = d.selected || {};
    const asset = (s.asset || state.symbol.replace('USDT', ''));
    els.quickPair.textContent = pair(s.symbol || state.symbol);
    els.amountUnit.textContent = asset;
    if (document.activeElement !== els.tradePrice) els.tradePrice.value = fmt.price(s.lastPrice || 0).replace(/,/g, '');
    els.placeOrder.textContent = `${state.tradeSide} ${asset}`;
    els.placeOrder.className = `btn full ${state.tradeSide === 'Buy' ? 'primary' : ''}`;
    if (state.tradeSide === 'Sell') els.placeOrder.style.background = 'linear-gradient(90deg, #d82435, #ff4d5e)';
    else els.placeOrder.style.background = '';
    updateOrderMath();
  }

  function updateOrderMath() {
    const price = num(els.tradePrice.value);
    const amount = num(els.tradeAmount.value);
    const lev = Number(String(els.leverage.value).replace('x', '')) || 1;
    const total = price * amount;
    const feeRate = els.orderType.value === 'Market' ? 0.001 : 0.0006;
    els.estFee.textContent = `${fmt.price(total * feeRate)} USDT`;
    els.orderTotal.textContent = `${fmt.price(total / lev)} USDT`;
  }

  function renderChart(d) {
    const s = d.selected || {};
    els.chartTitle.textContent = `${pair(s.symbol || state.symbol)} · ${state.interval.toUpperCase()}`;
    els.lastMetric.textContent = `$${fmt.price(s.lastPrice)}`;
    els.highMetric.textContent = `$${fmt.price(s.highPrice || d.derived?.high)}`;
    els.lowMetric.textContent = `$${fmt.price(s.lowPrice || d.derived?.low)}`;
    els.atrMetric.textContent = `$${fmt.price(d.metrics?.atr || 0)}`;
    els.rsiMetric.textContent = fmt.price(d.metrics?.rsi || 0);
    els.trendMetric.textContent = d.metrics?.trend || '--';
    els.trendMetric.className = d.metrics?.trend === 'Bullish' ? 'green' : d.metrics?.trend === 'Bearish' ? 'red' : '';
    drawChart(d.klines || [], d.derived || {});
  }

  function drawChart(klines, derived) {
    const canvas = els.priceCanvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(600, rect.width * dpr);
    canvas.height = Math.max(300, rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    grid(ctx, w, h);
    if (!klines.length) return;
    const pad = 28;
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const range = max - min || 1;
    const x = i => pad + (i / Math.max(1, klines.length - 1)) * (w - pad * 2);
    const y = v => pad + (max - v) / range * (h - pad * 2);

    if (state.chartMode === 'candles') drawCandles(ctx, klines, x, y, w, pad);
    else drawLine(ctx, klines.map(k => k.close), x, y, '#4aa3ff', true);

    if (state.showMA) {
      const closes = klines.map(k => k.close);
      drawLine(ctx, ema(closes, 12), x, y, '#ffd166', false);
      drawLine(ctx, ema(closes, 26), x, y, '#5ee7ff', false);
    }

    drawLevel(ctx, derived.support, y, w, 'Support', '#22d37e');
    drawLevel(ctx, derived.resistance, y, w, 'Resistance', '#ff4d5e');
    ctx.fillStyle = '#9aacbf';
    ctx.font = '11px system-ui';
    ctx.fillText(`High ${fmt.price(max)}`, 14, 18);
    ctx.fillText(`Low ${fmt.price(min)}`, 14, h - 12);
  }

  function grid(ctx, w, h) {
    ctx.strokeStyle = 'rgba(130,169,214,.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const y = 24 + i * ((h - 48) / 5);
      ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(w - 14, y); ctx.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = 24 + i * ((w - 48) / 8);
      ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x, h - 14); ctx.stroke();
    }
  }

  function drawLine(ctx, values, x, y, color, fill) {
    ctx.beginPath();
    values.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (fill) {
      const lastIndex = values.length - 1;
      ctx.lineTo(x(lastIndex), ctx.canvas.height);
      ctx.lineTo(x(0), ctx.canvas.height);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
      grad.addColorStop(0, 'rgba(74,163,255,.28)');
      grad.addColorStop(1, 'rgba(74,163,255,0)');
      ctx.fillStyle = grad; ctx.fill();
    }
  }

  function drawCandles(ctx, klines, x, y, w, pad) {
    const bodyW = Math.max(3, (w - pad * 2) / klines.length * .55);
    klines.forEach((k, i) => {
      const green = k.close >= k.open;
      ctx.strokeStyle = green ? '#22d37e' : '#ff4d5e';
      ctx.fillStyle = green ? 'rgba(34,211,126,.75)' : 'rgba(255,77,94,.75)';
      const cx = x(i);
      ctx.beginPath(); ctx.moveTo(cx, y(k.high)); ctx.lineTo(cx, y(k.low)); ctx.stroke();
      const top = Math.min(y(k.open), y(k.close));
      const height = Math.max(2, Math.abs(y(k.open) - y(k.close)));
      ctx.fillRect(cx - bodyW / 2, top, bodyW, height);
    });
  }

  function drawLevel(ctx, value, y, w, label, color) {
    if (!value) return;
    const yy = y(value);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = color;
    ctx.globalAlpha = .7;
    ctx.beginPath(); ctx.moveTo(26, yy); ctx.lineTo(w - 26, yy); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.fillStyle = color; ctx.font = '11px system-ui';
    ctx.fillText(`${label} ${fmt.price(value)}`, w - 150, yy - 6);
  }

  function renderOrderBook(d) {
    const s = d.selected || {};
    els.bookPair.textContent = pair(s.symbol || state.symbol);
    const bids = d.depth?.bids || [];
    const asks = d.depth?.asks || [];
    const maxTotal = Math.max(1, ...bids.map(x => x.total), ...asks.map(x => x.total));
    els.orderBook.innerHTML = Array.from({ length: Math.max(bids.length, asks.length, 12) }).slice(0, 14).map((_, i) => {
      const b = bids[i] || {};
      const a = asks[i] || {};
      return `<div class="book-row">
        <div class="bar-bid" style="width:${Math.min(100, (b.total || 0) / maxTotal * 100)}%"></div>
        <div class="bar-ask" style="width:${Math.min(100, (a.total || 0) / maxTotal * 100)}%"></div>
        <span class="green">${b.price ? fmt.price(b.price) : '--'}</span><span>${b.qty ? b.qty.toFixed(5) : '--'}</span>
        <span class="red">${a.price ? fmt.price(a.price) : '--'}</span><span>${a.qty ? a.qty.toFixed(5) : '--'}</span>
      </div>`;
    }).join('');
    const bid = bids[0]?.price || 0;
    const ask = asks[0]?.price || 0;
    const mid = bid && ask ? (bid + ask) / 2 : s.lastPrice;
    els.midPrice.textContent = `$${fmt.price(mid)}`;
    els.spreadText.textContent = `Spread ${fmt.price((ask || 0) - (bid || 0))} · ${(d.metrics?.spread || 0).toFixed(4)}%`;
  }

  function renderRecentTrades(d) {
    if (state.pausedTrades) return;
    els.tradeRows.innerHTML = (d.trades || []).slice(0, 18).map(t => `<tr><td>${fmt.time(t.time)}</td><td class="${t.side === 'buy' ? 'green' : 'red'}">${fmt.price(t.price)}</td><td>${Number(t.qty || 0).toFixed(5)}</td><td>${t.side}</td></tr>`).join('') || `<tr><td colspan="4" class="empty">No trades</td></tr>`;
  }

  function renderPortfolio(d) {
    const markMap = Object.fromEntries((d.tickers || []).map(t => [t.symbol, t.lastPrice]));
    const rows = state.positions.map(p => {
      const mark = markMap[p.symbol] || p.entry;
      const pnl = p.side === 'Buy' ? (mark - p.entry) * p.amount : (p.entry - mark) * p.amount;
      return { ...p, mark, pnl };
    });
    const totalPnl = rows.reduce((a, p) => a + p.pnl, 0);
    const wins = rows.filter(p => p.pnl > 0).length;
    els.equityKpi.textContent = `$${fmt.price(12456.78 + totalPnl)}`;
    els.pnlKpi.textContent = `${totalPnl >= 0 ? '+' : ''}${fmt.price(totalPnl)} USDT`;
    els.pnlKpi.className = totalPnl >= 0 ? 'green' : 'red';
    els.winRateKpi.textContent = rows.length ? `${Math.round((wins / rows.length) * 100)}%` : '--';
    els.positionRows.innerHTML = rows.slice(0, 10).map(p => `<tr><td>${pair(p.symbol)}</td><td class="${p.side === 'Buy' ? 'green' : 'red'}">${p.side === 'Buy' ? 'Long' : 'Short'}</td><td>${p.amount}</td><td>${fmt.price(p.entry)}</td><td>${fmt.price(p.mark)}</td><td class="${p.pnl >= 0 ? 'green' : 'red'}">${p.pnl >= 0 ? '+' : ''}${fmt.price(p.pnl)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">No practice positions yet</td></tr>`;
  }

  function renderMovers(d) {
    const rows = state.movers === 'gainers' ? (d.topGainers || []) : (d.topLosers || []);
    els.moverGrid.innerHTML = rows.slice(0, 8).map(t => `<div class="mover" data-symbol="${t.symbol}"><div class="mover-top"><div class="mover-pair"><span class="coin-icon">${t.asset?.[0] || '?'}</span><span>${pair(t.symbol)}<span class="subtext">$${fmt.price(t.lastPrice)}</span></span></div><b class="${tone(t.priceChangePercent)}">${fmt.pct(t.priceChangePercent)}</b></div><canvas class="spark" data-spark="${t.priceChangePercent}"></canvas></div>`).join('');
    $$('.spark').forEach(drawSpark);
  }

  function drawSpark(canvas) {
    const value = Number(canvas.dataset.spark || 0);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const color = value >= 0 ? '#22d37e' : '#ff4d5e';
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const x = i / 19 * w;
      const wave = Math.sin(i * .7) * 5 + (Math.random() - .5) * 8;
      const trend = value >= 0 ? h - (i / 19) * h * .65 : h * .35 + (i / 19) * h * .55;
      const y = Math.max(2, Math.min(h - 2, trend + wave));
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  function renderHeatmap(d) {
    let rows = [...(d.heatmap || [])];
    if (els.sortHeatmap.dataset.mode === 'volume') rows.sort((a, b) => b.quoteVolume - a.quoteVolume);
    els.heatmap.innerHTML = rows.slice(0, 24).map(t => {
      const pos = Number(t.priceChangePercent) >= 0;
      const opacity = Math.min(.55, Math.abs(t.priceChangePercent) / 18 + .12);
      return `<div class="heat-cell" data-symbol="${t.symbol}" style="background:${pos ? `rgba(34,211,126,${opacity})` : `rgba(255,77,94,${opacity})`}"><b>${pair(t.symbol)}</b><span>$${fmt.price(t.lastPrice)}</span><strong>${fmt.pct(t.priceChangePercent)}</strong><span>Vol ${fmt.compact(t.quoteVolume)}</span></div>`;
    }).join('');
  }

  function renderScreener(d) {
    let rows = [...(d.tickers || [])];
    if (state.screenFilter === 'bullish') rows = rows.filter(t => t.priceChangePercent >= 0).sort((a, b) => b.priceChangePercent - a.priceChangePercent);
    if (state.screenFilter === 'bearish') rows = rows.filter(t => t.priceChangePercent < 0).sort((a, b) => a.priceChangePercent - b.priceChangePercent);
    if (state.screenFilter === 'active') rows = rows.sort((a, b) => b.quoteVolume - a.quoteVolume);
    els.screenerRows.innerHTML = rows.slice(0, 16).map((t, i) => {
      const trend = t.priceChangePercent > 2 ? 'Strong Up' : t.priceChangePercent > 0 ? 'Up' : t.priceChangePercent < -2 ? 'Strong Down' : 'Down';
      const vol = Math.abs(t.priceChangePercent) > 6 ? 'High' : Math.abs(t.priceChangePercent) > 2 ? 'Medium' : 'Low';
      return `<tr><td>${pair(t.symbol)}</td><td>$${fmt.price(t.lastPrice)}</td><td class="${tone(t.priceChangePercent)}">${fmt.pct(t.priceChangePercent)}</td><td>#${i + 1}</td><td>${trend}</td><td>${vol}</td><td><button class="btn ghost small" data-open="${t.symbol}">Open</button></td></tr>`;
    }).join('');
  }

  function renderPulse(d) {
    const m = d.metrics || {};
    els.signalLabel.textContent = m.signalLabel || 'Neutral';
    els.signalLabel.className = m.signalLabel === 'Bullish' ? 'green' : m.signalLabel === 'Bearish' ? 'red' : 'yellow';
    els.signalScore.textContent = Math.round(m.signalScore || 0);
    els.gaugeFill.style.width = `${Math.max(0, Math.min(100, m.signalScore || 0))}%`;
    els.breadthMetric.textContent = `${m.bullish || 0}/${(m.bullish || 0) + (m.bearish || 0)} green`;
    els.volMetric.textContent = `${(m.volatility || 0).toFixed(2)}%`;
    els.fundingMetric.textContent = d.futures?.fundingRate ? `${(d.futures.fundingRate * 100).toFixed(4)}%` : '--';
    els.oiMetric.textContent = d.futures?.openInterest ? fmt.compact(d.futures.openInterest) : '--';
    els.pulseComment.textContent = `Market breadth is ${(m.breadth * 100 || 0).toFixed(0)}%, trend is ${m.trend || 'flat'}, and the selected pair spread is ${(m.spread || 0).toFixed(4)}%.`;
  }

  function renderAlerts() {
    els.alertsList.innerHTML = state.alerts.map((a, i) => `<div class="mini-item"><span>${pair(a.symbol)} ${a.side} $${fmt.price(a.price)}<span class="subtext">${a.triggered ? 'Triggered' : 'Watching'}</span></span><button class="btn ghost small" data-del-alert="${i}">×</button></div>`).join('') || '<div class="empty">No alerts yet</div>';
  }

  function checkAlerts() {
    const price = state.data?.selected?.lastPrice || 0;
    let changed = false;
    state.alerts.forEach(a => {
      if (a.symbol !== state.symbol || a.triggered) return;
      if ((a.side === 'above' && price >= a.price) || (a.side === 'below' && price <= a.price)) {
        a.triggered = true; changed = true; toast(`Alert triggered: ${pair(a.symbol)} ${a.side} ${fmt.price(a.price)}`);
      }
    });
    if (changed) save();
  }

  function currentCalc() {
    return $('#calcTabs button.active')?.dataset.calc || 'pnl';
  }

  function renderCalculator(type) {
    const price = state.data?.selected?.lastPrice || 0;
    const asset = state.symbol.replace('USDT', '');
    if (type === 'pnl') {
      els.calculatorPanel.innerHTML = `<div class="calc-grid"><label>Entry<input id="pnlEntry" class="control" value="${round(price * .98)}"></label><label>Exit<input id="pnlExit" class="control" value="${round(price)}"></label><label>Amount ${asset}<input id="pnlAmount" class="control" value="1"></label><label>Side<select id="pnlSide" class="control"><option>Long</option><option>Short</option></select></label></div><div class="calc-result" id="calcResult"></div>`;
    } else if (type === 'risk') {
      els.calculatorPanel.innerHTML = `<div class="calc-grid"><label>Entry<input id="riskEntry" class="control" value="${round(price)}"></label><label>Stop<input id="riskStop" class="control" value="${round(price * .97)}"></label><label>Target<input id="riskTarget" class="control" value="${round(price * 1.06)}"></label><label>Capital<input id="riskCapital" class="control" value="1000"></label></div><div class="calc-result" id="calcResult"></div>`;
    } else if (type === 'dca') {
      els.calculatorPanel.innerHTML = `<div class="calc-grid"><label>Current Price<input id="dcaPrice" class="control" value="${round(price)}"></label><label>Total Budget<input id="dcaBudget" class="control" value="1000"></label><label>Orders<input id="dcaOrders" class="control" value="5"></label><label>Step %<input id="dcaStep" class="control" value="2"></label></div><div class="calc-result" id="calcResult"></div>`;
    } else if (type === 'liq') {
      els.calculatorPanel.innerHTML = `<div class="calc-grid"><label>Entry<input id="liqEntry" class="control" value="${round(price)}"></label><label>Leverage<input id="liqLev" class="control" value="5"></label><label>Side<select id="liqSide" class="control"><option>Long</option><option>Short</option></select></label><label>Maintenance %<input id="liqMaint" class="control" value="0.5"></label></div><div class="calc-result" id="calcResult"></div>`;
    } else {
      els.calculatorPanel.innerHTML = `<div class="calc-grid"><label>Amount<input id="convAmount" class="control" value="1"></label><label>From<select id="convFrom" class="control"></select></label><label>To<select id="convTo" class="control"></select></label><label>Mode<select class="control"><option>Market</option></select></label></div><div class="calc-result" id="calcResult"></div>`;
      const opts = (state.data?.tickers || []).slice(0, 24).map(t => `<option value="${t.symbol}">${t.asset}</option>`).join('') + '<option value="USDT">USDT</option>';
      $('#convFrom').innerHTML = opts; $('#convTo').innerHTML = opts; $('#convFrom').value = state.symbol; $('#convTo').value = 'USDT';
    }
    bindCalcInputs();
    updateCalc(type);
  }

  function bindCalcInputs() {
    $$('#calculatorPanel input, #calculatorPanel select').forEach(el => el.addEventListener('input', () => updateCalc(currentCalc())));
  }

  function updateCalc(type) {
    const out = $('#calcResult');
    if (!out) return;
    if (type === 'pnl') {
      const entry = num($('#pnlEntry').value), exit = num($('#pnlExit').value), amount = num($('#pnlAmount').value), long = $('#pnlSide').value === 'Long';
      const pnl = long ? (exit - entry) * amount : (entry - exit) * amount;
      out.innerHTML = `<b class="${pnl >= 0 ? 'green' : 'red'}">PnL: ${pnl >= 0 ? '+' : ''}${fmt.price(pnl)} USDT</b><span class="subtext">Return ${fmt.pct(entry ? pnl / (entry * amount) * 100 : 0)}</span>`;
    } else if (type === 'risk') {
      const entry = num($('#riskEntry').value), stop = num($('#riskStop').value), target = num($('#riskTarget').value), capital = num($('#riskCapital').value);
      const risk = Math.abs(entry - stop), reward = Math.abs(target - entry);
      const size = risk ? (capital * .01) / risk : 0;
      out.innerHTML = `<b>R:R ${(reward / Math.max(risk, .000001)).toFixed(2)}x</b><span class="subtext">1% risk position size ≈ ${size.toFixed(5)} units</span>`;
    } else if (type === 'dca') {
      const price = num($('#dcaPrice').value), budget = num($('#dcaBudget').value), orders = Math.max(1, Math.floor(num($('#dcaOrders').value))), step = num($('#dcaStep').value) / 100;
      const per = budget / orders;
      const levels = Array.from({ length: orders }, (_, i) => price * (1 - step * i));
      const qty = levels.reduce((a, p) => a + per / p, 0);
      out.innerHTML = `<b>Avg Entry: ${fmt.price(budget / qty)}</b><span class="subtext">Levels: ${levels.map(fmt.price).join(' · ')}</span>`;
    } else if (type === 'liq') {
      const entry = num($('#liqEntry').value), lev = Math.max(1, num($('#liqLev').value)), maint = num($('#liqMaint').value) / 100, long = $('#liqSide').value === 'Long';
      const liq = long ? entry * (1 - 1 / lev + maint) : entry * (1 + 1 / lev - maint);
      out.innerHTML = `<b>Estimated liquidation: ${fmt.price(liq)}</b><span class="subtext">Simplified estimate for planning only.</span>`;
    } else {
      const amount = num($('#convAmount').value), from = $('#convFrom').value, to = $('#convTo').value;
      const priceOf = sym => sym === 'USDT' ? 1 : (state.data?.tickers || []).find(t => t.symbol === sym)?.lastPrice || 0;
      const result = amount * priceOf(from) / Math.max(priceOf(to), .00000001);
      out.innerHTML = `<b>${fmt.price(result)} ${to === 'USDT' ? 'USDT' : to.replace('USDT', '')}</b><span class="subtext">Converted at latest live price.</span>`;
    }
  }

  function renderOrderHistory() {
    els.orderHistoryRows.innerHTML = state.orders.slice().reverse().slice(0, 15).map(o => `<tr><td>${fmt.time(o.time)}</td><td>${pair(o.symbol)}</td><td class="${o.side === 'Buy' ? 'green' : 'red'}">${o.side}</td><td>${o.type}</td><td>${fmt.price(o.price)}</td><td>${o.amount}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">No practice orders yet</td></tr>`;
  }

  function renderBriefing(d) {
    const s = d.selected || {};
    const m = d.metrics || {};
    const gainers = (d.topGainers || []).slice(0, 3).map(t => pair(t.symbol)).join(', ');
    const losers = (d.topLosers || []).slice(0, 3).map(t => pair(t.symbol)).join(', ');
    const notes = [
      `${pair(s.symbol || state.symbol)} trades at $${fmt.price(s.lastPrice)} with a 24h move of ${fmt.pct(s.priceChangePercent)}.`,
      `Breadth: ${m.bullish || 0} gainers vs ${m.bearish || 0} decliners across tracked pairs.`,
      `Momentum leaders: ${gainers || '--'}. Weakest movers: ${losers || '--'}.`,
      `Current terminal reading: ${m.signalLabel || 'Neutral'} with ${Math.round(m.signalConfidence || 0)}% confidence.`
    ];
    els.briefingList.innerHTML = notes.map(n => `<div class="brief">${n}</div>`).join('');
  }

  function placePracticeOrder() {
    const price = num(els.tradePrice.value);
    const amount = num(els.tradeAmount.value);
    if (!price || !amount) return toast('Enter price and amount first.');
    const order = { time: Date.now(), symbol: state.symbol, side: state.tradeSide, type: els.orderType.value, price, amount };
    state.orders.push(order);
    state.positions.push({ time: order.time, symbol: order.symbol, side: order.side, entry: price, amount });
    save();
    renderPortfolio(state.data);
    renderOrderHistory();
    toast(`${state.tradeSide} practice order added.`);
  }

  function exportCsv() {
    const rows = state.data?.klines || [];
    if (!rows.length) return toast('No chart data to export.');
    const csv = ['time,open,high,low,close,volume', ...rows.map(k => `${new Date(k.time).toISOString()},${k.open},${k.high},${k.low},${k.close},${k.volume}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pulse-${state.symbol}-${state.interval}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function selectSymbol(symbol) {
    state.symbol = symbol;
    save();
    loadMarket();
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.remove('show'), 2600);
  }

  function pair(symbol) { return String(symbol || '').replace('USDT', '/USDT'); }
  function tone(n) { return Number(n) >= 0 ? 'green' : 'red'; }
  function num(v) { const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; }
  function round(n) { return Number(n || 0).toFixed(n > 100 ? 2 : n > 1 ? 4 : 8); }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function ema(values, period) {
    if (!values.length) return [];
    const k = 2 / (period + 1);
    const out = [values[0]];
    for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k));
    return out;
  }

  function bindEvents() {
    els.refreshBtn.addEventListener('click', loadMarket);
    els.symbolSelect.addEventListener('change', e => selectSymbol(e.target.value));
    els.marketSearch.addEventListener('input', () => renderMarket(state.data));
    els.toggleFavOnly.addEventListener('click', () => { state.favOnly = !state.favOnly; els.toggleFavOnly.classList.toggle('active', state.favOnly); renderMarket(state.data); });
    els.marketTabs.addEventListener('click', e => {
      const btn = e.target.closest('button[data-filter]'); if (!btn) return;
      state.marketFilter = btn.dataset.filter;
      $$('#marketTabs button').forEach(b => b.classList.toggle('active', b === btn));
      renderMarket(state.data);
    });
    els.marketRows.addEventListener('click', e => {
      const fav = e.target.closest('[data-fav]');
      if (fav) {
        const sym = fav.dataset.fav;
        state.favorites = state.favorites.includes(sym) ? state.favorites.filter(x => x !== sym) : [...state.favorites, sym];
        save(); renderMarket(state.data); return;
      }
      const tr = e.target.closest('tr[data-symbol]'); if (tr) selectSymbol(tr.dataset.symbol);
    });
    els.buyMode.addEventListener('click', () => setTradeSide('Buy'));
    els.sellMode.addEventListener('click', () => setTradeSide('Sell'));
    [els.tradePrice, els.tradeAmount, els.orderType, els.leverage, els.tradeSlider].forEach(el => el.addEventListener('input', updateOrderMath));
    els.tradeSlider.addEventListener('input', () => {
      const bal = 12456.78;
      const price = num(els.tradePrice.value) || 1;
      els.tradeAmount.value = ((bal * (num(els.tradeSlider.value) / 100)) / price).toFixed(5);
      updateOrderMath();
    });
    els.placeOrder.addEventListener('click', placePracticeOrder);
    els.intervals.addEventListener('click', e => {
      const btn = e.target.closest('button[data-i]'); if (!btn) return;
      state.interval = btn.dataset.i; save();
      $$('#intervals button').forEach(b => b.classList.toggle('active', b === btn));
      loadMarket();
    });
    $$('.chart-tools .chip[data-chart]').forEach(btn => btn.addEventListener('click', () => {
      state.chartMode = btn.dataset.chart;
      $$('.chart-tools .chip[data-chart]').forEach(b => b.classList.toggle('active', b === btn));
      renderChart(state.data);
    }));
    els.toggleMA.addEventListener('click', () => { state.showMA = !state.showMA; els.toggleMA.classList.toggle('active', state.showMA); renderChart(state.data); });
    els.exportCsv.addEventListener('click', exportCsv);
    els.pauseTrades.addEventListener('click', () => { state.pausedTrades = !state.pausedTrades; els.pauseTrades.textContent = state.pausedTrades ? 'Resume' : 'Pause'; });
    els.clearPortfolio.addEventListener('click', () => { state.positions = []; save(); renderPortfolio(state.data); });
    els.showGainers.addEventListener('click', () => { state.movers = 'gainers'; els.showGainers.classList.add('active'); els.showLosers.classList.remove('active'); renderMovers(state.data); });
    els.showLosers.addEventListener('click', () => { state.movers = 'losers'; els.showLosers.classList.add('active'); els.showGainers.classList.remove('active'); renderMovers(state.data); });
    els.moverGrid.addEventListener('click', e => { const card = e.target.closest('[data-symbol]'); if (card) selectSymbol(card.dataset.symbol); });
    els.sortHeatmap.addEventListener('click', () => { els.sortHeatmap.dataset.mode = els.sortHeatmap.dataset.mode === 'volume' ? '' : 'volume'; els.sortHeatmap.textContent = els.sortHeatmap.dataset.mode === 'volume' ? 'Default order' : 'Sort by volume'; renderHeatmap(state.data); });
    els.heatmap.addEventListener('click', e => { const cell = e.target.closest('[data-symbol]'); if (cell) selectSymbol(cell.dataset.symbol); });
    $('.screener-card .tabs').addEventListener('click', e => {
      const btn = e.target.closest('button[data-screen]'); if (!btn) return;
      state.screenFilter = btn.dataset.screen;
      $$('.screener-card .tabs button').forEach(b => b.classList.toggle('active', b === btn));
      renderScreener(state.data);
    });
    els.screenerRows.addEventListener('click', e => { const btn = e.target.closest('[data-open]'); if (btn) selectSymbol(btn.dataset.open); });
    els.addAlert.addEventListener('click', () => {
      const price = num(els.alertPrice.value);
      if (!price) return toast('Enter alert price first.');
      state.alerts.push({ symbol: state.symbol, side: els.alertSide.value, price, triggered: false, time: Date.now() });
      save(); renderAlerts(); toast('Alert added.');
    });
    els.clearAlerts.addEventListener('click', () => { state.alerts = []; save(); renderAlerts(); });
    els.alertsList.addEventListener('click', e => {
      const btn = e.target.closest('[data-del-alert]'); if (!btn) return;
      state.alerts.splice(Number(btn.dataset.delAlert), 1); save(); renderAlerts();
    });
    els.calcTabs.addEventListener('click', e => {
      const btn = e.target.closest('button[data-calc]'); if (!btn) return;
      $$('#calcTabs button').forEach(b => b.classList.toggle('active', b === btn));
      renderCalculator(btn.dataset.calc);
    });
    els.clearOrders.addEventListener('click', () => { state.orders = []; save(); renderOrderHistory(); });
    window.addEventListener('resize', () => state.data && renderChart(state.data));
  }

  function setTradeSide(side) {
    state.tradeSide = side;
    els.buyMode.classList.toggle('active', side === 'Buy');
    els.sellMode.classList.toggle('active', side === 'Sell');
    renderTradePanel(state.data || { selected: { symbol: state.symbol } });
  }

  function boot() {
    bindEvents();
    $$('#intervals button').forEach(b => b.classList.toggle('active', b.dataset.i === state.interval));
    renderAlerts();
    renderOrderHistory();
    loadMarket();
    setInterval(loadMarket, 30000);
  }

  boot();
})();
