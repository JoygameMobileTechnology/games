import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const m = html.match(/\/\* CORE-START \*\/([\s\S]*?)\/\* CORE-END \*\//);
if (!m) { console.error('CORE bloğu bulunamadı'); process.exit(1); }
let C;
try {
  C = new Function(m[1] + '\nreturn CORE;')();
} catch (e) {
  console.error('CORE eval failed:', e.message);
  process.exit(1);
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
// Deterministik rnd: verilen değerleri sırayla döndürür, sonra son değeri tekrarlar
const makeRnd = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

// === Testler buraya eklenecek (Task 2+) ===

test('slideRow: basit birleşme', () => {
  const r = C.slideRow([2, 2, 0, 0]);
  assert.deepEqual(r.row, [4, 0, 0, 0]);
  assert.equal(r.gained, 4);
  assert.deepEqual(r.merges, [{ value: 4, idx: 0 }]);
});
test('slideRow: çifte birleşme yok', () => {
  const r = C.slideRow([2, 2, 2, 2]);
  assert.deepEqual(r.row, [4, 4, 0, 0]);
  assert.deepEqual(r.merges.map(m => m.idx), [0, 1]);
});
test('slideRow: [4,2,2,0] -> [4,4,0,0]', () => {
  const r = C.slideRow([4, 2, 2, 0]);
  assert.deepEqual(r.row, [4, 4, 0, 0]);
  assert.deepEqual(r.merges, [{ value: 4, idx: 1 }]);
});
test('slideRow: [2,2,2] tek birleşme soldan', () => {
  const r = C.slideRow([2, 2, 2, 0]);
  assert.deepEqual(r.row, [4, 2, 0, 0]);
});
test('move right: koordinat eşlemesi', () => {
  const b = C.emptyBoard(); b[0][0] = 2; b[0][3] = 2;
  const r = C.move(b, 'right');
  assert.deepEqual(r.board[0], [0, 0, 0, 4]);
  assert.equal(r.moved, true);
  assert.deepEqual(r.merges, [{ value: 4, y: 0, x: 3 }]);
});
test('move down: sütun birleşmesi', () => {
  const b = C.emptyBoard(); b[0][1] = 4; b[2][1] = 4;
  const r = C.move(b, 'down');
  assert.equal(r.board[3][1], 8);
  assert.deepEqual(r.merges, [{ value: 8, y: 3, x: 1 }]);
});
test('move up: sütun birleşmesi', () => {
  const b = C.emptyBoard(); b[1][2] = 2; b[3][2] = 2;
  const r = C.move(b, 'up');
  assert.equal(r.board[0][2], 4);
  assert.deepEqual(r.merges, [{ value: 4, y: 0, x: 2 }]);
});
test('move: girdi tahtasını değiştirmez', () => {
  const b = C.emptyBoard(); b[0][0] = 2; b[0][1] = 2;
  C.move(b, 'left');
  assert.deepEqual(b[0], [2, 2, 0, 0]);
});
test('move: hareket yoksa moved=false', () => {
  const b = C.emptyBoard(); b[0][0] = 2;
  const r = C.move(b, 'left');
  assert.equal(r.moved, false);
});
test('spawn: deterministik rnd ile', () => {
  const b = C.emptyBoard(); b[0][0] = 2;
  const nb = C.spawn(b, makeRnd(0, 0.95));   // ilk boş hücre, 0.95 -> 4
  assert.equal(nb[0][1], 4);
  assert.equal(b[0][1], 0);                   // orijinal değişmedi
});
test('canMove: dolu ama birleşebilir', () => {
  const b = [[2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,4]];
  assert.equal(C.canMove(b), true);
});
test('canMove: tamamen kilitli', () => {
  const b = [[2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,2]];
  assert.equal(C.canMove(b), false);
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('PASS', name); }
  catch (e) { fail++; console.error('FAIL', name, '\n  ', e.stack); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
