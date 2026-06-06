# Reset and copy guide

If your Git terminal is stuck in a rebase/conflict, run:

```bash
git rebase --abort
```

Then update your local repo first:

```bash
git pull origin main
```

Copy all files from this package into your repo root and overwrite existing files.

Then run:

```bash
npm install
npm run check
git add .
git commit -m "Recreate clean exchange dashboard"
git push origin main
```

If Git says there is nothing to commit, just run:

```bash
git push origin main
```
