const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const required = [
  'public/index.html',
  'public/styles.css',
  'public/app.js',
  'netlify/functions/market.js',
  'netlify/functions/health.js',
  'netlify.toml',
  'package.json'
];

for (const file of required) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) throw new Error(`Missing ${file}`);
}

for (const js of ['public/app.js', 'netlify/functions/market.js', 'netlify/functions/health.js', 'scripts/build.js']) {
  const p = path.join(root, js);
  new Function(fs.readFileSync(p, 'utf8'));
}

const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
if (!html.includes('app.js')) throw new Error('index.html does not load app.js');
if (!html.includes('styles.css')) throw new Error('index.html does not load styles.css');

const frontend = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const blockedUiWords = ['SOSOVALUE_API_KEY', 'server-side API routing', 'API key', 'hidden key', 'FUD proxy', 'flow proxy'];
for (const w of blockedUiWords) {
  if (frontend.toLowerCase().includes(w.toLowerCase())) {
    throw new Error(`Frontend leaks internal wording: ${w}`);
  }
}

console.log('Check complete: deploy structure and syntax OK');
