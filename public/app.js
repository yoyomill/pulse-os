const state = {
  symbol: 'BTCUSDT',
  interval: '1h',
  side: 'buy',
  market: null,
  positions: JSON.parse(localStorage.getItem('pulse_positions') || '[]')
};

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function pair(symbol = state.symbol) {
  return symbol.replace('USDT', '/USDT');
}

function base(symbol = state.symbol) {
  return symbol.replace('USDT', '');
}

function compactVolume(value) {
  const n = Number(value || 0);
  if (n >= 1e9) return `${money.format(n / 1e9)}B`;
  if (n >= 1e6) return `${money.format(n / 1e6)}M`;
  if (n >= 1e3) return `${money.format(n / 1e3)}K`;
  return money.format(n);
}

function pctClass(value) {
  return Number(value) >= 0 ? 'up' : 'down';
}

function coinLabel(symbol) {
  const b = base(symbol);
  const map = { BTC: '₿', ETH: 'Ξ', SOL: 'S', BNB: 'B', XRP: 'X' };
  return map[b] || b.slice(0, 2);
}

function timeOnly(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function savePositions() {
  localStorage.setItem('pulse_positions', JSON.stringify(state.positions));
}

async function loadMarket() {
  try {
    toast('Refreshing live market...');
    const res = await fetch(`/api/market?symbol=${state.symbol}&interval=${state.interval}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message || data.error || 'Market unavailable');
    state.market = data;
    renderAll();
    toast('Live market updated');
  } catch (error) {
    console.error(error);
    toast('Live market unavailable. Try again later.');
  }
}

function renderAll() {
  renderHeader();
  renderWatchlist();
  renderTradePanel();
  renderChart();
  renderOrderBook();
  renderTrades();
  renderPositions();
  renderMovers();
}

function renderHeader() {
  const data = state.market;
  if (!data) return;
  $('tradePairTitle').textContent = pair();
  $('chartTitle').textContent = `${pair()} · ${state.interval.toUpperCase()}`;
  $('bookTitle').textContent = pair();

  $('tickerBoard').innerHTML = data.watchlist.map(t => `
    <span class="ticker-item">
      <span class="coin">${t.pair}</span>
      <span>$${fmt.format(t.lastPrice)}</span>
      <span class="${pctClass(t.priceChangePercent)}">${Number(t.priceChangePercent).toFixed(2)}%</span>
    </span>
  `).join('');
}

function renderWatchlist() {
  const rows = $('watchlistRows');
  const data = state.market?.watchlist || [];
  rows.innerHTML = data.map(t => `
    <div class="table-row row-card" data-symbol="${t.symbol}">
      <span class="pair-cell"><span class="coin-badge">${coinLabel(t.symbol)}</span>${t.pair}</span>
      <span>$${fmt.format(t.lastPrice)}<small class="sub">High $${fmt.format(t.highPrice)}</small></span>
      <span class="${pctClass(t.priceChangePercent)}">${Number(t.priceChangePercent).toFixed(2)}%</span>
      <span>${compactVolume(t.quoteVolume)}</span>
    </div>
  `).join('');

  rows.querySelectorAll('[data-symbol]').forEach(row => {
    row.addEventListener('click', () => {
      state.symbol = row.dataset.symbol;
      $('symbolSelect').value = state.symbol;
      loadMarket();
    });
  });
}

function renderTradePanel() {
  const t = state.market?.ticker;
  if (!t) return;
  $('orderPrice').value = Number(t.lastPrice).toFixed(t.lastPrice > 100 ? 2 : 4);
  $('baseAsset').textContent = base();
  $('placeOrderBtn').textContent = `${state.side === 'buy' ? 'Buy' : 'Sell'} ${base()}`;
  $('placeOrderBtn').className = `primary-btn ${state.side === 'buy' ? 'buy' : 'sell'}`;
  updateFeePreview();
}

function updateFeePreview() {
  const price = Number($('orderPrice').value || 0);
  const amount = Number($('orderAmount').value || 0);
  const fee = price * amount * 0.001;
  $('feePreview').textContent = `${money.format(fee)} USDT`;
}

function drawLine(ctx, points, width, height) {
  if (!points.length) return;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = 10;
  const scaleY = (v) => height - pad - ((v - min) / Math.max(max - min, 0.00000001)) * (height - pad * 2);
  const scaleX = (i) => pad + (i / Math.max(points.length - 1, 1)) * (width - pad * 2);

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(86, 168, 255, 0.26)');
  gradient.addColorStop(1, 'rgba(86, 168, 255, 0)');

  ctx.beginPath();
  points.forEach((p, i) => {
    const x = scaleX(i), y = scaleY(p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(width - pad, height - pad);
  ctx.lineTo(pad, height - pad);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => {
    const x = scaleX(i), y = scaleY(p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#56a8ff';
  ctx.stroke();

  ctx.fillStyle = 'rgba(199, 211, 228, 0.7)';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(`High ${fmt.format(max)}`, 14, 20);
  ctx.fillText(`Low ${fmt.format(min)}`, 14, height - 12);
}

function renderChart() {
  const canvas = $('priceChart');
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = rect.width * scale;
  canvas.height = rect.height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const closes = (state.market?.candles || []).map(c => Number(c.close));
  drawLine(ctx, closes, rect.width, rect.height);
}

function renderOrderBook() {
  const depth = state.market?.depth;
  const el = $('bookRows');
  if (!depth) return;
  const maxBid = Math.max(...depth.bids.map(x => x.qty), 1);
  const maxAsk = Math.max(...depth.asks.map(x => x.qty), 1);
  el.innerHTML = Array.from({ length: 10 }).map((_, i) => {
    const bid = depth.bids[i] || { price: 0, qty: 0 };
    const ask = depth.asks[i] || { price: 0, qty: 0 };
    return `
      <div class="book-grid book-row">
        <i class="depth-bar depth-bid" style="width:${(bid.qty / maxBid) * 46}%"></i>
        <i class="depth-bar depth-ask" style="width:${(ask.qty / maxAsk) * 46}%"></i>
        <span class="up">${fmt.format(bid.price)}</span>
        <span>${fmt.format(bid.qty)}</span>
        <span class="down">${fmt.format(ask.price)}</span>
        <span>${fmt.format(ask.qty)}</span>
      </div>
    `;
  }).join('');
  $('midPrice').textContent = `$${fmt.format(state.market.ticker.lastPrice)} ↑`;
}

function renderTrades() {
  const rows = $('tradeRows');
  const trades = state.market?.trades || [];
  rows.innerHTML = trades.slice(-10).reverse().map(t => `
    <div class="table-row">
      <span>${timeOnly(t.time)}</span>
      <span class="${t.isBuyerMaker ? 'down' : 'up'}">${fmt.format(t.price)}</span>
      <span>${fmt.format(t.qty)}</span>
    </div>
  `).join('');
}

function markPriceFor(symbol) {
  if (symbol === state.symbol && state.market?.ticker) return state.market.ticker.lastPrice;
  const t = state.market?.watchlist?.find(x => x.symbol === symbol);
  return t?.lastPrice || 0;
}

function renderPositions() {
  const rows = $('positionRows');
  if (!state.positions.length) {
    rows.innerHTML = '<div class="empty">No open positions yet. Create a practice order from Quick Trade.</div>';
    return;
  }

  rows.innerHTML = state.positions.map(p => {
    const mark = markPriceFor(p.symbol) || p.entry;
    const pnl = p.side === 'Long' ? (mark - p.entry) * p.size : (p.entry - mark) * p.size;
    return `
      <div class="table-row row-card">
        <span>${pair(p.symbol)}</span>
        <span class="${p.side === 'Long' ? 'up' : 'down'}">${p.side}</span>
        <span>${fmt.format(p.size)}</span>
        <span>${fmt.format(p.entry)}</span>
        <span>${fmt.format(mark)}</span>
        <span class="${pnl >= 0 ? 'up' : 'down'}">${pnl >= 0 ? '+' : ''}${money.format(pnl)}</span>
      </div>
    `;
  }).join('');
}

function renderMovers() {
  const box = $('moverChips');
  const movers = state.market?.movers || [];
  box.innerHTML = movers.slice(0, 12).map(m => `
    <div class="mover-card">
      <strong>${m.pair}</strong>
      <span>$${fmt.format(m.lastPrice)}</span>
      <span class="${pctClass(m.priceChangePercent)} sub">${Number(m.priceChangePercent).toFixed(2)}%</span>
      <svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="0,24 15,18 30,20 45,12 60,15 75,9 100,${Number(m.priceChangePercent) >= 0 ? 5 : 26}" fill="none" stroke="${Number(m.priceChangePercent) >= 0 ? '#20d67b' : '#ff4d57'}" stroke-width="3" />
      </svg>
    </div>
  `).join('');
}

function placePracticeOrder() {
  const entry = Number($('orderPrice').value || 0);
  const size = Number($('orderAmount').value || 0);
  if (!entry || !size) {
    toast('Enter price and amount first.');
    return;
  }
  state.positions.unshift({
    symbol: state.symbol,
    side: state.side === 'buy' ? 'Long' : 'Short',
    size,
    entry,
    createdAt: Date.now()
  });
  state.positions = state.positions.slice(0, 12);
  savePositions();
  renderPositions();
  toast(`${state.side === 'buy' ? 'Long' : 'Short'} position added.`);
}

function bindEvents() {
  $('symbolSelect').addEventListener('change', (e) => {
    state.symbol = e.target.value;
    loadMarket();
  });
  $('intervalSelect').addEventListener('change', (e) => {
    state.interval = e.target.value;
    loadMarket();
  });
  $('refreshBtn').addEventListener('click', loadMarket);
  $('buyMode').addEventListener('click', () => {
    state.side = 'buy';
    $('buyMode').classList.add('active');
    $('sellMode').classList.remove('active');
    renderTradePanel();
  });
  $('sellMode').addEventListener('click', () => {
    state.side = 'sell';
    $('sellMode').classList.add('active');
    $('buyMode').classList.remove('active');
    renderTradePanel();
  });
  $('orderPrice').addEventListener('input', updateFeePreview);
  $('orderAmount').addEventListener('input', updateFeePreview);
  $('placeOrderBtn').addEventListener('click', placePracticeOrder);
  $('clearPositions').addEventListener('click', () => {
    state.positions = [];
    savePositions();
    renderPositions();
  });
  window.addEventListener('resize', () => state.market && renderChart());
}

bindEvents();
renderPositions();
loadMarket();
setInterval(loadMarket, 30000);
