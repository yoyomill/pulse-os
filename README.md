# Pulse OS

**One-person on-chain finance business tool** built for the SoSoValue WaveHack / Buildathon Wave 2 prompt.

Pulse merges the core features of the 4 uploaded tools into one deployable Netlify app:

1. **NarrativeOS** → live market ingest, narrative summary, signal rationale, copy-ready X thread.
2. **SignalFlow Agent** → trading type profiles, 5-factor confluence engine, regime detection, execution plan, paper desk.
3. **Legendery-Happiness** → 4-pillar Sentinel risk gate, volatility/FUD filter, non-custodial execution router.
4. **SSI Protocol** → ValueChain readiness, wallet connection, chain ID 286623, asset-controller/staking/governance-ready architecture.

The app is intentionally **not a fake demo**. It does not ship fallback prices. If live APIs are unavailable, the UI shows an error instead of making up numbers.

The first screen has been rebuilt as a **Pulse live ticker board**: short name, running electronic market tape, compact price table, and server-side API status instead of the old long headline.

---

## What runs live

- `/.netlify/functions/market` fetches:
  - Binance Spot 24h tickers and klines.
  - CoinGecko markets and trending coins.
  - Optional SoDEX public spot endpoint.
  - Optional SoSoValue OpenAPI endpoints if `SOSOVALUE_API_KEY` is configured.
- The browser calls only `/api/market` and receives normalized output.
- API keys stay inside Netlify environment variables and are **not exposed in frontend JavaScript**.

---

## Local structure

```txt
pulse-wave2-os/
├─ public/
│  ├─ index.html       # static UI
│  ├─ app.js           # frontend logic, no API secrets
│  └─ styles.css       # command-center UI + running ticker board
├─ netlify/functions/
│  ├─ market.js        # live data pipeline
│  ├─ health.js        # deployment health check
│  └─ _core.js         # APIs + signal engine + Sentinel + narrative generator
├─ docs/
│  ├─ DEPLOY_NETLIFY.md
│  ├─ MERGE_MAP.md
│  ├─ API_SECURITY.md
│  ├─ SUBMISSION_WAVE2.md
│  ├─ PULSE_UI_CONCEPT.png
│  └─ UI_PREVIEW.png
└─ netlify.toml
```

---

## Quick deploy to Netlify

The recommended route is GitHub → Netlify because this project uses Netlify Functions. Drag-and-drop static deploy will not run the functions.

```bash
npm run build
```

Then connect the repo in Netlify:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

Optional environment variables:

```bash
SOSOVALUE_API_KEY=...
COINGECKO_DEMO_API_KEY=...
COINGECKO_PRO_API_KEY=...
```

No key is required for the default Binance + public CoinGecko path, but a CoinGecko demo/pro key can improve rate limits.

---

## Why this matches Wave 2 judging criteria

- **User value & practical impact:** a solo operator can monitor market, generate thesis, stage risk-managed plans, publish X content, and validate via paper desk.
- **Functionality & working demo:** Netlify Functions fetch live data; UI refuses to fake numbers when APIs fail.
- **Logic/workflow/product design:** clear pipeline: live data → confluence signal → Sentinel gate → paper execution → content output.
- **Data/API integration:** Binance, CoinGecko, optional SoDEX, optional SoSoValue.
- **UX & clarity:** polished command center, transparent source status, clear non-custodial disclaimers.

---

## Disclaimer

Pulse is analytics software, not financial advice. It never asks for a private key, never holds funds, and never submits live orders.
