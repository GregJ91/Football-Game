// Inline the single-mode build's JS and CSS into one HTML file.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-single';
let html = readFileSync(join(dir, 'index.html'), 'utf8');

html = html.replace(/<script type="module" crossorigin src="\/?([^"]+)"><\/script>/g, (_, src) => {
  const js = readFileSync(join(dir, src), 'utf8').replace(/<\/script/g, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\/?([^"]+)">/g, (_, href) => {
  return `<style>${readFileSync(join(dir, href), 'utf8')}</style>`;
});
const icon = readFileSync('public/icon.svg', 'utf8');
const iconUri = `data:image/svg+xml,${encodeURIComponent(icon)}`;
html = html
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${iconUri}" type="image/svg+xml" />`)
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/, '');

writeFileSync(join(dir, 'pyramid-fc.html'), html);
console.log(`Wrote ${dir}/pyramid-fc.html (${(html.length / 1024).toFixed(0)} KB)`);
