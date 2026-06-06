# Copy guide

Copy every file from this package into your existing repo folder:

```txt
C:\Users\Asus\Desktop\pulse-os
```

Then run:

```bash
npm install
npm run check
git add .
git commit -m "Upgrade Pulse OS pro exchange dashboard"
git push origin main
```

If Git says there is nothing to commit, run:

```bash
git push origin main
```

Netlify will redeploy automatically if the site is connected to GitHub.
