# Pulse OS

Clean crypto-market dashboard for Netlify.

## Features

- Live market watchlist
- Live chart
- Order book
- Recent trades
- Top movers
- Practice position panel
- Netlify Functions route market data through `/api/market`
- No internal/debug text shown on the interface

## Local run

```bash
npm install
npm run build
npx netlify dev
```

Open:

```txt
<<<<<<< HEAD
http://localhost:8888
=======
pulse-os/
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
>>>>>>> 0f7eb9c3402af62bcb41d8bf5b42ddef57f77ced
```

## Netlify deploy settings

```txt
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

## Test after deploy

```txt
https://your-site.netlify.app/api/health
https://your-site.netlify.app/api/market?symbol=BTCUSDT&interval=1h
```
