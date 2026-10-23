#!/usr/bin/env node
// Analytics-only reference installer. Does NOT run or change the site generator/copy.
// Re-run after an unrelated generator rebuild; then review the diff.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const refs = '  <script src="assets/js/analytics-config.js" defer></script>\n  <script src="assets/js/analytics.js" defer></script>\n';
let included=0, excluded=0;
for (const name of fs.readdirSync(root).filter(n=>n.endsWith('.html'))) {
  const file=path.join(root,name), original=fs.readFileSync(file,'utf8');
  const stripped=original.replace(/^[ \t]*<script src="assets\/js\/analytics(?:-config)?\.js" defer><\/script>\n/gm,'');
  const skip=['404.html','ad-creative-gallery.html'].includes(name) || /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(stripped);
  let result=stripped;
  if(skip) excluded++;
  else { if(!stripped.includes('</body>')) throw Error('Missing body: '+name); result=stripped.replace('</body>',refs+'</body>'); included++; }
  if(result!==original) fs.writeFileSync(file,result);
}
console.log(`Analytics references: ${included} public pages; ${excluded} noindex/internal/error pages excluded.`);
