import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const m = html.match(/\/\* CORE-START \*\/([\s\S]*?)\/\* CORE-END \*\//);
if (!m) { console.error('CORE bloğu bulunamadı'); process.exit(1); }
const C = new Function(m[1] + '\nreturn CORE;')();

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
// Deterministik rnd: verilen değerleri sırayla döndürür, sonra son değeri tekrarlar
const makeRnd = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

// === Testler buraya eklenecek (Task 2+) ===

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('PASS', name); }
  catch (e) { fail++; console.error('FAIL', name, '\n  ', e.message); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
