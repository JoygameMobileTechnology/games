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

// === Testler ===

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

test('emissionFor: eşleme tablosu', () => {
  assert.equal(C.emissionFor(32), null);
  assert.equal(C.emissionFor(64), 'tohum_tozu');
  assert.equal(C.emissionFor(128), 'cicek_ozu');
  assert.equal(C.emissionFor(256), 'meyve');
  assert.equal(C.emissionFor(512), 'nadir_tohum');
  assert.equal(C.emissionFor(1024), 'agac_fidani');
  assert.equal(C.emissionFor(2048), 'efsanevi');
  assert.equal(C.emissionFor(4096), 'efsanevi');
});
test('move: 64 birleşmesi emisyon üretir, konumuyla', () => {
  const b = C.emptyBoard(); b[2][0] = 32; b[2][1] = 32;
  const r = C.move(b, 'left');
  assert.deepEqual(r.emissions, [{ type: 'tohum_tozu', y: 2, x: 0 }]);
});
test('move: 64 altı birleşme emisyon üretmez', () => {
  const b = C.emptyBoard(); b[0][0] = 2; b[0][1] = 2;
  assert.deepEqual(C.move(b, 'left').emissions, []);
});
test('move: aynı hamlede çoklu emisyon', () => {
  const b = C.emptyBoard();
  b[0][0] = 32; b[0][1] = 32; b[1][0] = 64; b[1][1] = 64;
  const r = C.move(b, 'left');
  assert.equal(r.emissions.length, 2);
  assert.deepEqual(r.emissions.map(e => e.type).sort(), ['cicek_ozu', 'tohum_tozu']);
});

test('ZONES: spec slot sayıları (12/10/10/6)', () => {
  assert.deepEqual(C.ZONES.map(z => z.slots.length), [12, 10, 10, 6]);
});
test('tohum_tozu: aktif bölgede çiçek slotu doldurur', () => {
  const g = C.newGarden();
  const evs = C.applyResource(g, 'tohum_tozu', makeRnd(0));
  assert.equal(evs[0].kind, 'plant');
  assert.equal(evs[0].zone, 0);
  assert.equal(C.ZONES[0].slots[evs[0].slot].type, 'cicek');
  assert.deepEqual(g.plots['0:' + evs[0].slot], { stage: 1 });
});
test('cicek_ozu: dolu çiçek yoksa bankaya', () => {
  const g = C.newGarden();
  const evs = C.applyResource(g, 'cicek_ozu', makeRnd(0));
  assert.deepEqual(evs, [{ kind: 'bank', type: 'cicek_ozu' }]);
  assert.equal(g.bank.cicek_ozu, 1);
});
test('cicek_ozu: dolu çiçeği zenginleştirir', () => {
  const g = C.newGarden();
  C.applyResource(g, 'tohum_tozu', makeRnd(0));
  const evs = C.applyResource(g, 'cicek_ozu', makeRnd(0));
  assert.equal(evs[0].kind, 'variant');
  assert.equal(g.variants[evs[0].key], 1);
});
test('meyve: cali slotu doldurur; slotlar dolunca hayvan; 3 hayvandan sonra banka', () => {
  const g = C.newGarden();
  const caliCount = C.ZONES[0].slots.filter(s => s.type === 'cali').length;
  for (let i = 0; i < caliCount; i++) {
    assert.equal(C.applyResource(g, 'meyve', makeRnd(0))[0].kind, 'plant');
  }
  for (let i = 0; i < 3; i++) {
    assert.equal(C.applyResource(g, 'meyve', makeRnd(0))[0].kind, 'animal');
  }
  assert.equal(C.applyResource(g, 'meyve', makeRnd(0))[0].kind, 'bank');
  assert.equal(g.animals[0], 3);
});
test('nadir_tohum: çayırda slot yok -> banka; çayır dolunca koruya otomatik ekilir', () => {
  const g = C.newGarden();
  assert.equal(C.applyResource(g, 'nadir_tohum', makeRnd(0))[0].kind, 'bank');
  // Çayırı tamamen doldur (9 cicek + 3 cali)
  let all = [];
  for (let i = 0; i < 9; i++) all.push(...C.applyResource(g, 'tohum_tozu', makeRnd(0)));
  for (let i = 0; i < 3; i++) all.push(...C.applyResource(g, 'meyve', makeRnd(0)));
  assert.ok(all.some(e => e.kind === 'unlock' && e.zone === 1), 'koru kilidi açılmalı');
  assert.equal(g.unlocked, 2);
  // Bankadaki nadir_tohum koruya (zone 1) drenajla ekilmiş olmalı
  assert.equal(g.bank.nadir_tohum || 0, 0);
  const planted = all.find(e => e.kind === 'plant' && e.zone === 1);
  assert.ok(planted, 'bankadan koruya ekim olmalı');
  assert.equal(C.ZONES[1].slots[planted.slot].type, 'nadir');
});
test('activeZone: kilit açılınca ilerler', () => {
  const g = C.newGarden();
  assert.equal(C.activeZone(g), 0);
  for (let i = 0; i < 9; i++) C.applyResource(g, 'tohum_tozu', makeRnd(0));
  for (let i = 0; i < 3; i++) C.applyResource(g, 'meyve', makeRnd(0));
  assert.equal(C.activeZone(g), 1);
});
test('idleGrowth: 4 saatte 1 evre, 2 evre tavanı, MAX_STAGE tavanı', () => {
  const H = 3600 * 1000;
  const g = C.newGarden();
  C.applyResource(g, 'tohum_tozu', makeRnd(0));         // stage 1
  const key = Object.keys(g.plots)[0];
  assert.deepEqual(C.idleGrowth(g, 3 * H), { steps: 0, grown: 0 });
  assert.deepEqual(C.idleGrowth(g, 5 * H), { steps: 1, grown: 1 });
  assert.equal(g.plots[key].stage, 2);
  assert.deepEqual(C.idleGrowth(g, 100 * H), { steps: 2, grown: 1 });  // 2 -> 3 (tavan)
  assert.equal(g.plots[key].stage, 3);
  assert.deepEqual(C.idleGrowth(g, 100 * H), { steps: 2, grown: 0 });  // zaten olgun
});
test('koruma invariantı: hiçbir kaynak kaybolmaz, tüm bölgeler açılır', () => {
  const g = C.newGarden();
  const types = ['tohum_tozu', 'meyve', 'nadir_tohum', 'agac_fidani', 'efsanevi', 'cicek_ozu'];
  let planted = 0, banked = 0, animals = 0, variants = 0;
  const rnd = makeRnd(0);
  for (let i = 0; i < 200; i++) {
    for (const e of C.applyResource(g, types[i % types.length], rnd)) {
      if (e.kind === 'plant') planted++;
      else if (e.kind === 'animal') animals++;
      else if (e.kind === 'variant') variants++;
      else if (e.kind === 'bank') banked++;
    }
  }
  const stillBanked = Object.values(g.bank).reduce((a, b) => a + b, 0);
  // Ekilen + hayvan + varyant + halen bankada = beslenen toplam (drenaj sırasında bankadan çıkanlar
  // plant/animal/variant olarak sayılır; banked sayacı geçici bankalamaları da içerdiğinden >= stillBanked)
  assert.equal(planted, 38);                       // 12+10+10+6 = tüm slotlar
  assert.equal(g.unlocked, 4);
  assert.equal(planted + animals + variants + stillBanked <= 200, true);
  assert.equal(planted + animals + variants >= 200 - stillBanked - banked, true);
});
test('deserialize: bozuk/boş girdi -> temiz varsayılan', () => {
  for (const bad of [null, '', '{}', 'çöp{', '[1,2]']) {
    const st = C.deserialize(bad);
    assert.equal(st.score, 0);
    assert.equal(st.garden.unlocked, 1);
    assert.equal(st.muted, false);
  }
});
test('serialize/deserialize roundtrip', () => {
  const st = C.defaultState();
  st.score = 120; st.best = 500; st.muted = true;
  C.applyResource(st.garden, 'tohum_tozu', makeRnd(0));
  const back = C.deserialize(C.serialize(st));
  assert.equal(back.score, 120);
  assert.equal(back.best, 500);
  assert.equal(back.muted, true);
  assert.equal(Object.keys(back.garden.plots).length, 1);
});
test('cicek_ozu: bankadayken çiçek ekilince otomatik kullanılır', () => {
  const g = C.newGarden();
  C.applyResource(g, 'cicek_ozu', makeRnd(0));            // banka: 1
  assert.equal(g.bank.cicek_ozu, 1);
  const evs = C.applyResource(g, 'tohum_tozu', makeRnd(0)); // çiçek ekilir
  assert.equal(g.bank.cicek_ozu, 0);
  assert.ok(evs.some(e => e.kind === 'variant'), 'ekim sonrası banka özü varyanta dönüşmeli');
});
test('move: motions kimlik takibi için kaynak→hedef verir', () => {
  const b = C.emptyBoard(); b[0][0] = 2; b[0][2] = 2; b[3][1] = 4;
  const r = C.move(b, 'left');
  const m00 = r.motions.find(m => m.fromY === 0 && m.fromX === 0);
  const m02 = r.motions.find(m => m.fromY === 0 && m.fromX === 2);
  assert.deepEqual([m00.toY, m00.toX, m00.merged, m00.survivor], [0, 0, true, true]);
  assert.deepEqual([m02.toY, m02.toX, m02.merged, m02.survivor], [0, 0, true, false]);
  const m31 = r.motions.find(m => m.fromY === 3 && m.fromX === 1);
  assert.deepEqual([m31.toY, m31.toX, m31.merged, m31.survivor], [3, 0, false, true]);
});
test('move down: motions sütun koordinatları doğru', () => {
  const b = C.emptyBoard(); b[0][2] = 4; b[2][2] = 4;
  const r = C.move(b, 'down');
  const src = r.motions.find(m => m.fromY === 0 && m.fromX === 2);
  const dst = r.motions.find(m => m.fromY === 2 && m.fromX === 2);
  assert.deepEqual([src.toY, src.toX, src.survivor], [3, 2, false]);
  assert.deepEqual([dst.toY, dst.toX, dst.survivor], [3, 2, true]);
});
test('deserialize: bozuk bahçe içi alanlar temizlenir', () => {
  const bad = JSON.stringify({ garden: { unlocked: 99, plots: 'x', variants: null, animals: 'y', bank: null } });
  const st = C.deserialize(bad);
  assert.equal(typeof st.garden.plots, 'object');
  assert.equal(typeof st.garden.bank, 'object');
  assert.ok(Array.isArray(st.garden.animals));
  assert.ok(st.garden.unlocked >= 1 && st.garden.unlocked <= C.ZONES.length);
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('PASS', name); }
  catch (e) { fail++; console.error('FAIL', name, '\n  ', e.stack); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
