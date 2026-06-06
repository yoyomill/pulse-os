# Wave2 submission draft

## Project name

Pulse — Build Your One-Person On-Chain Finance Business

## One-liner

A live command center that lets one person run a crypto research, signal, risk, content, and paper-execution desk from a single Netlify app.

## Problem

Solo builders and micro-funds cannot manually monitor tickers, narratives, volatility, risk, execution readiness, and content output at the same time. Most AI trading tools either show generic scores or fake dashboards.

## Solution

Pulse automates the workflow:

```txt
Live market APIs → market pulse → 5-factor signal → Sentinel risk gate → execution plan → paper validation → X thread
```

## Data/API integration

- Binance public market data: 24h tickers and klines.
- CoinGecko public markets/trending.
- Optional SoDEX public spot data.
- Optional SoSoValue server-side OpenAPI if a key is configured.
- ValueChain wallet readiness with chain ID 286623.

## Why it is not a fake demo

The app has no mock prices. If live Binance data fails, it returns a `LIVE_DATA_UNAVAILABLE` error instead of inventing numbers.

## Judge-visible features

- Live data status panel.
- Signal with transparent factor scores.
- Risk-gated TP/SL execution plan.
- Paper trade desk stored locally.
- Copy-ready X thread.
- Wallet connect and ValueChain switch.
- Secret-safe Netlify Functions.

## X post idea

I built Pulse for @SoSoValueHQ Wave2: a one-person on-chain finance desk that turns live Binance/CoinGecko/SoDEX data into market pulse, 5-factor signal, Sentinel risk gate, paper execution plan, and copy-ready X thread. No fake prices. No exposed keys. #SoSoValue #WaveHack
