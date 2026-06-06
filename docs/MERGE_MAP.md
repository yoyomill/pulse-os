# Merge Map: 4 uploaded tools → one Wave2 product

## 1. NarrativeOS

Source concepts found in the uploaded code:

- Ingest live tickers/klines.
- Compute market pulse: advancers, decliners, average change, sentiment.
- Generate narrative summary.
- Generate signal and X/Twitter thread.
- Optional SoSoValue news/macro/ETF feed.

Implemented in this build:

- `fetchBinanceTickers()` and `fetchBinanceKlines()` in `netlify/functions/_core.js`.
- `marketPulse()`, `buildNarrative()`, and `buildTweetThread()` in `_core.js`.
- UI cards: NarrativeOS card, X thread card, market pulse KPIs.

## 2. SignalFlow Agent

Source concepts found in the uploaded code:

- Trading styles: scalper, intraday, swing, position.
- 5-factor confluence: trend, momentum, volatility, volume, structure.
- Regime detection.
- Confidence thresholds and TP/SL plans.
- Paper trading and wallet connection.

Implemented in this build:

- `STYLE_PROFILES` and `scoreMarket()` in `_core.js`.
- Indicators: EMA, RSI, MACD, ATR, Bollinger, support/resistance.
- Execution plan: entry, stop, target, R:R, max leverage cap.
- Local paper desk in `public/app.js` using localStorage.
- ValueChain wallet connection with chain ID `286623`.

## 3. Legendery-Happiness

Source concepts found in the uploaded code:

- 4-pillar Sentinel architecture.
- Intelligence layer.
- FUD volatility filter.
- Signal translation engine.
- Execution router.

Implemented in this build:

- `buildSentinel()` in `_core.js`.
- No random data: FUD proxy is derived from breadth, decliners, ATR, and volatility.
- Router locks execution when risk proxy exceeds threshold.
- UI card: Legendary Sentinel / 4-pillar risk gate.

## 4. SSI Protocol

Source concepts found in the uploaded code:

- Asset token/controller/factory.
- Staking and rewarded voting.
- Swap/rebalance/fee modules.
- Upgrade/deploy scripts for contracts.

Implemented in this build:

- On-chain readiness card, not contract deployment.
- ValueChain chain ID `286623`, native token `SOSO`, RPC `https://mainnet.valuechain.xyz`.
- Wallet connect / switch network.
- Non-custodial execution architecture and ownership-check explanation.

## Why not copy everything directly?

The uploaded projects use mixed stacks: Python/FastAPI, Next.js/Prisma, Solidity/Foundry, and standalone Python. For Netlify deployment and quick judging, this build uses a zero-dependency static frontend plus Netlify Functions. That keeps the product deployable, auditable, and easier to run without exposing keys.
