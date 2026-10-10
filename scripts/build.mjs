import { access } from 'node:fs/promises';
for(const file of ['dist/index.html','dist/styles.css','dist/app.js','dist/automation.html','dist/automation.js','dist/slotcare-companion.zip'])await access(file);
console.log('Static output is ready in dist/. Vercel deploys the protected api/ functions separately.');
