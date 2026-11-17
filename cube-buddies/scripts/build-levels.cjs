const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'levels/catalog.json'), 'utf8'));
assert.equal(data.version, 1);
assert.equal(data.levels.length, 150);
assert.equal(data.palette.length, 22);
const packed = { version: data.version, palette: data.palette, progression: data.progression, levels: data.levels.map((l, i) => {
  assert.equal(l.id, i + 1);
  const { x, y, z } = l.gridSize;
  assert.equal(l.cells.length, x * y * z);
  const cubes = Array(data.palette.length).fill(0), loads = cubes.slice();
  for (const c of l.cells) { assert(Number.isInteger(c) && c >= -1 && c < cubes.length); if (c >= 0) cubes[c]++; }
  for (const col of l.columns) for (const b of col) { assert(Number.isInteger(b.count) && b.count > 0); assert(b.color >= 0 && b.color < loads.length); loads[b.color] += b.count; }
  assert.deepEqual(loads, cubes, `Level ${l.id} color totals`);
  // One byte per cell: zero means empty; palette values are offset by one.
  return { ...l, cells: Buffer.from(l.cells.map(c => c + 1)).toString('base64'), count: cubes.reduce((a, b) => a + b, 0) };
}) };
const file = path.join(root, 'index.html');
let html = fs.readFileSync(file, 'utf8');
const block = '<script id="level-data" type="application/json">' + JSON.stringify(packed).replace(/</g, '\\u003c') + '</script>';
const marker = /<script id="level-data" type="application\/json">[\s\S]*?<\/script>/;
if (marker.test(html)) html = html.replace(marker, () => block);
else html = html.replace('<script id="three-library">', block + '\n<script id="three-library">');
assert(html.includes(block), 'level-data insertion point');
fs.writeFileSync(file, html);
console.log(`${packed.levels.length} levels · ${packed.levels.reduce((n, l) => n + l.count, 0)} cubes · ${Buffer.byteLength(block)} bytes embedded`);
