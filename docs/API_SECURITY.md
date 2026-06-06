# API and secret security

## Server-side only keys

The browser never imports `process.env`, never reads `.env`, and never calls third-party APIs directly. It calls only:

```txt
/api/market
/api/health
```

Netlify routes these to:

```txt
/.netlify/functions/market
/.netlify/functions/health
```

Optional secrets are read only in Netlify Functions:

```txt
SOSOVALUE_API_KEY
COINGECKO_DEMO_API_KEY
COINGECKO_PRO_API_KEY
OPENAI_API_KEY / OPENROUTER_API_KEY / DEEPSEEK_API_KEY
```

Do **not** use public prefixes such as `NEXT_PUBLIC_`, `VITE_`, or `PUBLIC_` for secrets.

## No fake fallback

If Binance klines or tickers fail, the function returns:

```json
{
  "error": "LIVE_DATA_UNAVAILABLE",
  "noMockData": true
}
```

The UI will show the error instead of inventing data.

## Non-custodial wallet policy

The app can ask an injected wallet for the public address and chain ID. It does not ask for private keys, seed phrases, unlimited approvals, or signatures for live orders.

## Manual checks before submission

Run these before pushing:

```bash
grep -RIn "sk-\|private_key\|SOSO-\|x-cg-pro-api-key" . --exclude-dir=.git --exclude=README.md --exclude=.env.example
npm run build
```
