# Deploy to Netlify.app

## Recommended: GitHub connected deploy

1. Create a new GitHub repo, for example `solofi-wave2-os`.
2. Copy all files from this folder into the repo.
3. Push to GitHub.
4. Go to Netlify → Add new site → Import an existing project.
5. Select the repo.
6. Use these settings:

```txt
Build command: npm run build
Publish directory: dist
Functions directory: netlify/functions
```

7. Deploy.
8. Open the generated `*.netlify.app` URL.
9. Test:

```txt
/api/health
/api/market?symbol=BTCUSDT&style=intraday
```

## Optional environment variables

In Netlify → Site configuration → Environment variables:

```txt
SOSOVALUE_API_KEY=your_key_here
COINGECKO_DEMO_API_KEY=your_key_here
COINGECKO_PRO_API_KEY=your_key_here
```

No key is needed for the default Binance public market path.

## Netlify CLI deploy

Only use this if you have Netlify CLI and a logged-in account:

```bash
npm install -g netlify-cli
netlify login
npm run build
netlify deploy --prod --dir=dist --functions=netlify/functions
```

## Important

A plain drag-and-drop deploy of `dist/` is not enough because the app uses Netlify Functions. Use GitHub connected deploy or Netlify CLI so `/api/market` works.
