# Pulse OS — Pro Exchange Dashboard

A live crypto exchange-style dashboard for Netlify. The UI is designed to look like a modern trading terminal, not a developer/debug panel.

## What is included

Core market modules:

1. Live ticker tape
2. Pair selector
3. Market Watch table
4. Favorite pairs
5. Pair search
6. Gainers filter
7. Losers filter
8. Volume filter
9. Quick Trade practice panel
10. Buy/Sell mode
11. Limit/Market/Stop/OCO selector
12. Leverage selector
13. Percentage allocation slider
14. Fee estimate
15. Total estimate
16. Live chart
17. Multi-interval chart: 1m, 5m, 15m, 1h, 4h, 1d
18. Line chart mode
19. Candle chart mode
20. EMA overlay
21. Support/resistance overlay
22. CSV export
23. Order book depth
24. Recent trades feed
25. Practice order history
26. Practice portfolio
27. Open positions
28. Unrealized PnL
29. Equity estimate
30. Win-rate estimate
31. Top gainers
32. Top losers
33. Market heatmap
34. Screener board
35. Bullish/Bearish filter
36. High-volume filter
37. Market Pulse score
38. Breadth meter
39. Volatility meter
40. Funding / OI fields when available
41. Price alerts
42. PnL calculator
43. Risk/reward calculator
44. DCA planner
45. Liquidation estimator
46. Converter
47. Auto market briefing
48. Local storage for alerts/favorites/orders
49. Responsive layout
50. Netlify Functions backend

## Live data

The frontend calls only local routes:

```txt
/api/market
/.netlify/functions/market
```

Market data is normalized in Netlify Functions before reaching the browser. No secret key is required for the default feeds.

## Deploy settings

```txt
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
Node version: 20
```

## Local setup

```bash
npm install
npm run check
npx netlify dev
```

Open:

```txt
http://localhost:8888
```

## Git push

```bash
git add .
git commit -m "Upgrade Pulse OS pro exchange dashboard"
git push origin main
```

## Test after Netlify deploy

```txt
https://your-site.netlify.app/api/health
https://your-site.netlify.app/api/market?symbol=BTCUSDT&interval=1h
```

If the market route returns `{ "ok": true }`, the dashboard will render live data.

## Safety note

Quick Trade, portfolio, alerts, and order history are practice tools stored locally in the browser. They do not connect to a real exchange account and do not move funds.
