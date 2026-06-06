# Copy guide

Replace your current project files with this structure:

```txt
pulse-os/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── netlify/
│   └── functions/
│       ├── health.js
│       └── market.js
├── scripts/
│   ├── build.js
│   └── check.js
├── netlify.toml
├── package.json
├── .nvmrc
└── README.md
```

Then push to GitHub and redeploy on Netlify.
