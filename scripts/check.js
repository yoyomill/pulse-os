const fs = require('fs');
const path = require('path');

const required = [
  'dist/index.html',
  'dist/styles.css',
  'dist/app.js',
  'netlify.toml',
  'netlify/functions/health.js',
  'netlify/functions/market.js'
];

let ok = true;
for (const file of required) {
  const p = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(p)) {
    console.error('Missing:', file);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('Deploy check passed');
