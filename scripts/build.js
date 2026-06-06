const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'public');
const out = path.join(root, 'dist');

if (!fs.existsSync(src)) throw new Error('Missing public directory');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(src, out, { recursive: true });
console.log('Build complete: public -> dist');
