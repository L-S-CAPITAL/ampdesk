/* AmpDesk single-file build — inlines CSS + JS into dist/ampdesk.html. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8');

const html = read('./index.html');
const parts = {
  'styles.css': read('./src/styles.css'),
  'logic.js': read('./src/logic.js'),
  'data.js': read('./src/data.js'),
  'app.js': read('./src/app.js')
};

let out = html;
for (const [name, content] of Object.entries(parts)) {
  const marker = `/*INLINE:${name}*/`;
  if (!out.includes(marker)) throw new Error(`Missing inline marker for ${name} in index.html`);
  if (content.trim().length < 10) throw new Error(`${name} appears empty`);
  out = out.replace(marker, () => content);
}
if (/\/\*INLINE:/.test(out)) throw new Error('Unreplaced inline markers remain in output');

mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
const target = new URL('./dist/ampdesk.html', import.meta.url);
writeFileSync(target, out);
console.log(`Built dist/ampdesk.html (${out.length.toLocaleString('en-AU')} bytes)`);

// GitHub Pages artifact — deploy from branch: main, folder: /docs
mkdirSync(new URL('./docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('./docs/index.html', import.meta.url), out);
console.log('Built docs/index.html for GitHub Pages');
