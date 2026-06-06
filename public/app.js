const $ = (id) => document.getElementById(id);
const tpl = () => $('loadingTpl').innerHTML;
const state = {
  data: null,
  wallet: null,
  paper: JSON.parse(localStorage.getItem('solofi_paper') || '[]'),
  timer: null,
};

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}
function fmtUsd(n, max = 2) {
  if (!Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: max }).format(Number(n));
}
function fmtNum(n, max = 2) {
  if (!Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: max }).format(Number(n));
}
function fmtPct(n) {
  if (!Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}
function tagClass(value) {
  if (typeof value === 'number') return value > 0 ? 'tag-green' : value < 0 ? 'tag-red' : 'tag';
  const s = String(value || '').toUpperCase();
  if (s.includes('LONG') || s.includes('BULL') || s.includes('LIVE') || s.includes('CLEAR') || s.includes('ROUTE')) return 'tag-green';
  if (s.includes('SHORT') || s.includes('BEAR') || s.includes('HOLD_OR') || s.includes('FAILED') || s.includes('UNAVAILABLE')) return 'tag-red';
  if (s.includes('HOLD') || s.includes('NEUTRAL') || s.includes('PARTIAL') || s.includes('NO_KEY')) return 'tag-amber';
  return 'tag-cyan';
}
function safe(s) { return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[c])); }
function coinIcon(base) {
  const map = { BTC: '₿', ETH: '◆', SOL: 'S', BNB: 'B', XRP: 'X', ADA: 'A', DOGE: 'D', AVAX: 'A', LINK: 'L', SUI: 'S' };
  return map[String(base || '').toUpperCase()] || String(base || '?').slice(0, 1);
}

async function load() {
  ['kpis', 'signalCard', 'chartCard', 'narrativeCard', 'sentinelCard', 'moversCard', 'paperCard', 'chainCard', 'tweetCard', 'sourceCard'].forEach(id => $(id).innerHTML = tpl());
  $('heroTicker').innerHTML = `<div class="ticker-head"><div><span class="pulse-dot"></span><strong>Live Board</strong><small>fetching server-side APIs…</small></div><span class="tag-cyan">server-side</span></div><div class="ticker-window"><div class="ticker-track skeleton-line"></div></div>`;
  $('status').innerHTML = '<span class="status-pill"><strong>Live engine</strong> fetching server-side APIs…</span>';
  const symbol = $('symbol').value;
  const style = $('style').value;
  const interval = $('interval').value;
  try {
    const res = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}&style=${encodeURIComponent(style)}&interval=${encodeURIComponent(interval)}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Live API error');
    state.data = data;
    render(data);
  } catch (err) {
    renderError(err);
  }
}

function renderError(err) {
  $('heroTicker').innerHTML = `<div class="ticker-head"><div><span class="pulse-dot"></span><strong>Live Board</strong><small>market tape unavailable</small></div><span class="tag-red">error</span></div><p class="muted" style="padding:.9rem">${safe(err.message)}</p>`;
  $('status').innerHTML = `<span class="status-pill"><strong>LIVE DATA ERROR</strong> ${safe(err.message)}</span>`;
  $('signalCard').innerHTML = `<h3>Không dùng dữ liệu giả</h3><p class="muted">${safe(err.message)}</p><p class="muted">Khi deploy lên Netlify, mở Function logs để kiểm tra quyền truy cập Binance/CoinGecko từ region deploy.</p>`;
  ['kpis', 'chartCard', 'narrativeCard', 'sentinelCard', 'moversCard', 'paperCard', 'chainCard', 'tweetCard', 'sourceCard'].forEach(id => $(id).innerHTML = '');
}

function render(data) {
  renderTickerBoard(data);
  renderStatus(data);
  renderKpis(data);
  renderSignal(data);
  renderChart(data);
  renderNarrative(data);
  renderSentinel(data);
  renderMovers(data);
  renderPaper(data);
  renderChain(data);
  renderTweets(data);
  renderSources(data);
}


function renderTickerBoard(data) {
  const assets = (data.assets || []).slice(0, 10);
  const selected = assets.find(a => a.symbol === data.meta.symbol) || assets[0];
  const tapeItems = [...assets, ...assets].map(a => `
    <span class="ticker-item">
      <span class="coin-icon">${safe(coinIcon(a.base))}</span>
      <strong>${safe(a.base || a.symbol)}</strong>
      <span class="ticker-price">${fmtUsd(a.price, a.price < 1 ? 5 : 2)}</span>
      <span class="muted">24h</span>
      <span class="${tagClass(a.changePct)}">${fmtPct(a.changePct)}</span>
    </span>
  `).join('');
  const tableRows = assets.slice(0, 6).map(a => `
    <div class="ticker-row">
      <div><strong>${safe(a.base || a.symbol)}</strong><br><small>${safe(a.name || a.source || 'Live market')}</small></div>
      <div style="text-align:right"><span>${fmtUsd(a.price, a.price < 1 ? 5 : 2)}</span><br><span class="${tagClass(a.changePct)}">${fmtPct(a.changePct)}</span></div>
    </div>
  `).join('');
  $('heroTicker').innerHTML = `
    <div class="ticker-head">
      <div><span class="pulse-dot"></span><strong>Live Board</strong><small>${safe(data.meta.symbol)} selected · ${assets.length} assets streaming</small></div>
      <span class="${tagClass(selected?.changePct)}">${selected ? fmtPct(selected.changePct) : 'LIVE'}</span>
    </div>
    <div class="ticker-window"><div class="ticker-track">${tapeItems}</div></div>
    <div class="ticker-table">${tableRows}</div>
  `;
}

function renderStatus(data) {
  const when = new Date(data.meta.generatedAt).toLocaleString();
  $('status').innerHTML = `
    <span class="status-pill"><strong>No mock:</strong> ${data.meta.noMockData ? 'ON' : 'OFF'}</span>
    <span class="status-pill"><strong>Generated:</strong> ${when}</span>
    <span class="status-pill"><strong>Secret policy:</strong> server-side only</span>
    <span class="status-pill"><strong>Wallet:</strong> ${state.wallet ? safe(shortAddr(state.wallet.address)) : 'not connected'}</span>
  `;
}

function renderKpis(data) {
  const p = data.pulse;
  const s = data.signal;
  $('kpis').innerHTML = `
    <article class="card kpi"><p class="eyebrow">Market Pulse</p><div class="value">${safe(p.sentiment)}</div><p class="muted">${p.advancers} advancers · ${p.decliners} decliners</p></article>
    <article class="card kpi"><p class="eyebrow">Avg 24h Change</p><div class="value">${fmtPct(p.avgChange)}</div><p class="muted">Basket breadth from live Binance tickers</p></article>
    <article class="card kpi"><p class="eyebrow">Decision Score</p><div class="value">${s.confidence}%</div><p class="muted">${safe(s.action)} · ${safe(s.regime)}</p></article>
    <article class="card kpi"><p class="eyebrow">Sentinel Verdict</p><div class="value" style="font-size:1.75rem">${safe(data.sentinel.verdict)}</div><p class="muted">FUD proxy ${fmtNum(data.sentinel.fudVolumeProxy,0)} / ${data.sentinel.threshold}</p></article>
  `;
}

function renderSignal(data) {
  const s = data.signal;
  const actionClass = tagClass(s.action);
  const factorRows = Object.entries(s.factors).map(([k, v]) => {
    const w = s.weights[k];
    const width = Math.min(100, Math.max(0, (v + 100) / 2));
    return `<div class="factor"><div class="factor-head"><span>${safe(k)} · weight ${w}%</span><strong>${v}</strong></div><div class="bar" style="--w:${width}%"><span></span></div></div>`;
  }).join('');
  const plan = s.executionPlan;
  $('signalCard').innerHTML = `
    <div class="signal-title">
      <div><p class="eyebrow">SignalFlow V2 + NarrativeOS merge</p><h3>${safe(data.meta.symbol)} · ${safe(s.profile)}</h3></div>
      <span class="${actionClass}">${safe(s.action)}</span>
    </div>
    <div class="action">${s.confidence}%</div>
    <div class="price">${fmtUsd(s.price, s.price < 1 ? 6 : 2)}</div>
    <p class="muted">Composite ${s.composite} · Regime ${safe(s.regime)} · Direction ${safe(s.direction)}</p>
    ${factorRows}
    <div class="plan-grid">
      <div class="plan-item"><span>Entry</span><strong>${fmtUsd(plan.entry, 4)}</strong></div>
      <div class="plan-item"><span>Stop</span><strong>${fmtUsd(plan.stopLoss, 4)}</strong></div>
      <div class="plan-item"><span>Target</span><strong>${fmtUsd(plan.takeProfit, 4)}</strong></div>
      <div class="plan-item"><span>R:R</span><strong>${fmtNum(plan.riskReward, 2)}</strong></div>
    </div>
    <ul class="reason-list">${s.reasons.map(r => `<li>${safe(r)}</li>`).join('')}</ul>
  `;
}

function renderChart(data) {
  const closes = data.klines.map(k => k.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const points = closes.map((c, i) => {
    const x = (i / Math.max(closes.length - 1, 1)) * 1000;
    const y = 260 - ((c - min) / Math.max(max - min, 1e-9)) * 230;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  const last = closes.at(-1);
  const first = closes[0];
  const change = ((last - first) / first) * 100;
  $('chartCard').innerHTML = `
    <div class="signal-title"><div><p class="eyebrow">Live kline chart</p><h3>${safe(data.meta.symbol)} · ${data.klines.length} candles</h3></div><span class="${tagClass(change)}">${fmtPct(change)}</span></div>
    <div class="chart-wrap">
      <svg viewBox="0 0 1000 290" preserveAspectRatio="none" aria-label="price chart">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff6ea9"/><stop offset=".52" stop-color="#6ee7ff"/><stop offset="1" stop-color="#b8ff6a"/></linearGradient>
          <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ee7ff" stop-opacity=".26"/><stop offset="1" stop-color="#6ee7ff" stop-opacity="0"/></linearGradient>
        </defs>
        <path d="M0 275 L ${points} L1000 275 Z" fill="url(#fillGrad)" opacity=".75"></path>
        <polyline points="${points}" fill="none" stroke="url(#lineGrad)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>
        <line x1="0" y1="260" x2="1000" y2="260" stroke="rgba(255,255,255,.08)" />
        <line x1="0" y1="30" x2="1000" y2="30" stroke="rgba(255,255,255,.08)" />
      </svg>
    </div>
    <div class="axis"><span>Low ${fmtUsd(min, 4)}</span><span>Last ${fmtUsd(last, 4)}</span><span>High ${fmtUsd(max, 4)}</span></div>
  `;
}

function renderNarrative(data) {
  $('narrativeCard').innerHTML = `
    <p class="eyebrow">NarrativeOS</p>
    <h3>${safe(data.narrative.headline)}</h3>
    <p class="muted">${safe(data.narrative.summary)}</p>
    <hr />
    <p class="muted"><strong style="color:var(--text)">Business angle:</strong> ${safe(data.narrative.businessAngle)}</p>
  `;
}

function renderSentinel(data) {
  const se = data.sentinel;
  $('sentinelCard').innerHTML = `
    <div class="signal-title"><div><p class="eyebrow">Legendary Sentinel</p><h3>4-pillar risk gate</h3></div><span class="${tagClass(se.verdict)}">${safe(se.verdict)}</span></div>
    <div class="plan-grid">
      <div class="plan-item"><span>FUD proxy</span><strong>${fmtNum(se.fudVolumeProxy, 0)}</strong></div>
      <div class="plan-item"><span>Threshold</span><strong>${fmtNum(se.threshold, 0)}</strong></div>
      <div class="plan-item"><span>Macro index</span><strong>${fmtNum(se.macroSentimentIndex, 2)}</strong></div>
      <div class="plan-item"><span>Flow proxy</span><strong>${fmtUsd(se.institutionalFlowProxyUsd, 0)}</strong></div>
    </div>
    <p class="muted">${safe(se.router)}</p>
    <ul class="reason-list">${se.pillars.map(p => `<li>${safe(p)}</li>`).join('')}</ul>
  `;
}

function renderMovers(data) {
  const row = (m) => `<div class="row"><div><strong>${safe(m.base || m.symbol)}</strong><br><small class="muted">${safe(m.name || m.source)}</small></div><span class="${tagClass(m.changePct)}">${fmtPct(m.changePct)}</span></div>`;
  $('moversCard').innerHTML = `
    <p class="eyebrow">Top movers</p>
    <h3>Live basket rotation</h3>
    <p class="muted">Gainers</p>
    ${data.movers.gainers.map(row).join('')}
    <hr />
    <p class="muted">Losers</p>
    ${data.movers.losers.map(row).join('')}
  `;
}

function savePaper() { localStorage.setItem('solofi_paper', JSON.stringify(state.paper)); }
function addPaperTrade() {
  if (!state.data) return;
  const s = state.data.signal;
  if (s.direction === 'flat') { toast('Signal is HOLD/flat, paper trade not opened.'); return; }
  const t = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    symbol: state.data.meta.symbol,
    direction: s.direction,
    entry: s.executionPlan.entry,
    stop: s.executionPlan.stopLoss,
    target: s.executionPlan.takeProfit,
    size: s.executionPlan.estimatedPositionSize,
    openedAt: new Date().toISOString(),
  };
  state.paper.unshift(t);
  savePaper();
  renderPaper(state.data);
  toast('Paper trade saved locally.');
}
function closePaper(id) {
  state.paper = state.paper.filter(t => t.id !== id);
  savePaper();
  if (state.data) renderPaper(state.data);
}
function renderPaper(data) {
  const priceMap = Object.fromEntries(data.assets.map(a => [a.symbol, a.price]));
  const rows = state.paper.slice(0, 5).map(t => {
    const px = priceMap[t.symbol] || data.signal.price;
    const pnl = t.direction === 'long' ? (px - t.entry) * t.size : (t.entry - px) * t.size;
    return `<div class="row"><div><strong>${safe(t.symbol)} ${safe(t.direction)}</strong><br><small class="muted">Entry ${fmtUsd(t.entry,4)} · Now ${fmtUsd(px,4)}</small></div><div style="text-align:right"><span class="${tagClass(pnl)}">${fmtUsd(pnl,2)}</span><br><button class="ghost" onclick="closePaper('${safe(t.id)}')" style="padding:.35rem .55rem;margin-top:.4rem">close</button></div></div>`;
  }).join('') || '<p class="muted">No paper positions yet.</p>';
  $('paperCard').innerHTML = `
    <div class="signal-title"><div><p class="eyebrow">Execution router</p><h3>Paper desk</h3></div><span class="${data.signal.executionPlan.confirmationGate ? 'tag-green' : 'tag-amber'}">${data.signal.executionPlan.confirmationGate ? 'gate passed' : 'review only'}</span></div>
    <button class="primary" onclick="addPaperTrade()">Stage Paper Trade</button>
    <p class="muted">Uses localStorage only. It never sends an order and never asks for a private key.</p>
    ${rows}
  `;
}

function shortAddr(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ''; }
async function connectWallet() {
  if (!window.ethereum) { toast('No injected wallet found. Install MetaMask or open in wallet browser.'); return; }
  try {
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    const chainId = await ethereum.request({ method: 'eth_chainId' });
    state.wallet = { address: accounts[0], chainId };
    renderChain(state.data || {});
    renderStatus(state.data || { meta: { generatedAt: new Date().toISOString(), noMockData: true } });
    toast(`Connected ${shortAddr(accounts[0])}`);
  } catch (err) { toast(err.message); }
}
async function switchValueChain() {
  if (!window.ethereum) return toast('No wallet available');
  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x45f9f' }] });
    toast('Switched to ValueChain.');
    await connectWallet();
  } catch (err) {
    if (err.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x45f9f',
          chainName: 'ValueChain',
          nativeCurrency: { name: 'SOSO', symbol: 'SOSO', decimals: 18 },
          rpcUrls: ['https://mainnet.valuechain.xyz'],
        }],
      });
      await connectWallet();
    } else toast(err.message);
  }
}
function renderChain(data) {
  const wallet = state.wallet;
  const ok = wallet?.chainId?.toLowerCase() === '0x45f9f';
  $('chainCard').innerHTML = `
    <div class="signal-title"><div><p class="eyebrow">SSI Protocol + ValueChain</p><h3>On-chain readiness</h3></div><span class="${ok ? 'tag-green' : 'tag-amber'}">${ok ? 'ValueChain' : 'not on ValueChain'}</span></div>
    <div class="plan-grid">
      <div class="plan-item"><span>Chain ID</span><strong>286623</strong></div>
      <div class="plan-item"><span>Native</span><strong>SOSO</strong></div>
      <div class="plan-item"><span>Wallet</span><strong>${wallet ? safe(shortAddr(wallet.address)) : '—'}</strong></div>
      <div class="plan-item"><span>Mode</span><strong>Non-custodial</strong></div>
    </div>
    <p class="muted">Merged from SSI contracts as an on-chain module: asset controller, staking/rewarded voting concept, and execution ownership checks. This build does not deploy contracts or hold user funds.</p>
    <button class="ghost" onclick="switchValueChain()">Switch/Add ValueChain</button>
  `;
}

function renderTweets(data) {
  $('tweetCard').innerHTML = `
    <div class="signal-title"><div><p class="eyebrow">Content desk</p><h3>Copy-ready X thread</h3></div><button class="ghost" id="copyTweets">Copy</button></div>
    ${data.tweets.map(t => `<div class="tweet">${safe(t)}</div>`).join('')}
  `;
  $('copyTweets').onclick = async () => {
    await navigator.clipboard.writeText(data.tweets.join('\n\n'));
    toast('Copied thread.');
  };
}

function renderSources(data) {
  const src = data.sourceStatus || {};
  const errors = data.errors || {};
  const sourceBlock = (name, status, note) => `<div class="source"><strong>${safe(name)} <span class="${tagClass(status)}">${safe(status)}</span></strong><small>${safe(note || '')}</small></div>`;
  $('sourceCard').innerHTML = `
    <p class="eyebrow">Data/API integration</p>
    <h3>Server-side API routing</h3>
    <p class="muted">Optional keys stay in Netlify environment variables. Browser only sees normalized JSON, not headers or tokens.</p>
    <div class="source-grid">
      ${sourceBlock('Binance', src.binance, '24h tickers + klines')}
      ${sourceBlock('CoinGecko', src.coingecko, 'market context + trending')}
      ${sourceBlock('SoDEX', src.sodex, errors.sodex || 'public spot endpoint if reachable')}
      ${sourceBlock('SoSoValue', src.sosovalue, errors.sosovalue || 'enable with SOSOVALUE_API_KEY')}
    </div>
    <hr />
    <p class="muted"><code>/api/market</code> is a Netlify Function. No API key is hardcoded in <code>app.js</code>.</p>
  `;
}

$('refresh').addEventListener('click', load);
$('symbol').addEventListener('change', load);
$('style').addEventListener('change', load);
$('interval').addEventListener('change', load);
$('connectWallet').addEventListener('click', connectWallet);
window.addPaperTrade = addPaperTrade;
window.closePaper = closePaper;
window.switchValueChain = switchValueChain;

load();
state.timer = setInterval(load, 60_000);
