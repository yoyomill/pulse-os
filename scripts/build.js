const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'public');
const out = path.join(root, 'dist');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const item of fs.readdirSync(from, { withFileTypes: true })) {
    const srcPath = path.join(from, item.name);
    const outPath = path.join(to, item.name);
    if (item.isDirectory()) copyDir(srcPath, outPath);
    else fs.copyFileSync(srcPath, outPath);
  }
}

fs.rmSync(out, { recursive: true, force: true });
copyDir(src, out);
console.log('Build complete: public -> dist');
