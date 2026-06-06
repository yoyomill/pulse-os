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
http://localhost:8888
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
