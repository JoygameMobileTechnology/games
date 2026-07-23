import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const m = html.match(/\/\* CORE-START \*\/([\s\S]*?)\/\* CORE-END \*\//);
if (!m) { console.error('CORE bloğu bulunamadı'); process.exit(1); }
let C;
try { C = new Function(m[1] + '\nreturn CORE;')(); }
catch (e) { console.error('CORE eval failed:', e.message); process.exit(1); }

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
// Deterministik rnd: verilen değerleri sırayla döndürür, sonra son değeri tekrarlar
const makeRnd = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
const settle = (w, steps = 720) => { const all = []; for (let i = 0; i < steps; i++) all.push(...C.stepWorld(w, 1 / 120).merges); return all; };

// === Fizik ===
test('radius: kademeyle monoton büyür', () => {
  for (let t = 1; t < C.TIERS; t++) assert.ok(C.radius(t) > C.radius(t - 1));
});
test('addFruit: x duvarlara kelepçelenir', () => {
  const w = C.newWorld();
  const f1 = C.addFruit(w, 2, -50), f2 = C.addFruit(w, 2, 500);
  assert.equal(f1.x, C.radius(2));
  assert.equal(f2.x, C.W - C.radius(2));
});
test('fizik: yerçekimiyle zemine oturur', () => {
  const w = C.newWorld();
  const f = C.addFruit(w, 0, 50);
  settle(w);
  assert.ok(Math.abs(f.y - (C.H - C.radius(0))) < 1.5, 'zeminde olmalı, y=' + f.y);
  assert.ok(Math.abs(f.vy) < 5, 'durmuş olmalı, vy=' + f.vy);
});
test('birleşme: aynı kademe temas → üst kademe, tek öğe kalır', () => {
  const w = C.newWorld();
  C.addFruit(w, 0, 48); C.addFruit(w, 0, 52);
  const merges = settle(w);
  assert.equal(merges.length, 1);
  assert.equal(merges[0].tier, 1);
  assert.equal(w.fruits.length, 1);
  assert.equal(w.fruits[0].tier, 1);
});
test('birleşme yok: farklı kademeler yan yana kalır', () => {
  const w = C.newWorld();
  C.addFruit(w, 0, 45); C.addFruit(w, 1, 55);
  const merges = settle(w);
  assert.equal(merges.length, 0);
  assert.equal(w.fruits.length, 2);
});
test('son kademe birleşmez', () => {
  const w = C.newWorld();
  C.addFruit(w, C.TIERS - 1, 30); C.addFruit(w, C.TIERS - 1, 70);
  const merges = settle(w);
  assert.equal(merges.length, 0);
  assert.equal(w.fruits.length, 2);
});
test('zincir: iki birleşme art arda (0+0→1, 1+1→2)', () => {
  const w = C.newWorld();
  C.addFruit(w, 1, 50);
  settle(w, 240);
  C.addFruit(w, 0, 46); C.addFruit(w, 0, 54);
  const merges = settle(w);
  assert.deepEqual(merges.map(x => x.tier).sort(), [1, 2]);
  assert.equal(w.fruits.length, 1);
  assert.equal(w.fruits[0].tier, 2);
});
test('duvarların dışına çıkmaz', () => {
  const w = C.newWorld();
  const f = C.addFruit(w, 3, 50);
  f.vx = 400;
  settle(w, 480);
  assert.ok(f.x >= C.radius(3) - 0.01 && f.x <= C.W - C.radius(3) + 0.01, 'x=' + f.x);
});
test('taşma algısı: çizgi üstünde duran öğe', () => {
  const w = C.newWorld();
  const f = C.addFruit(w, 2, 50);
  f.y = C.DANGER_Y - 2; f.vy = 0; f.vx = 0;
  assert.equal(C.overflowing(w), true);
  f.y = C.H - C.radius(2);
  assert.equal(C.overflowing(w), false);
});
test('randTier: ağırlıklı 0-4 aralığı', () => {
  assert.equal(C.randTier(makeRnd(0)), 0);
  assert.equal(C.randTier(makeRnd(0.999)), 4);
  for (let i = 0; i < 20; i++) {
    const t = C.randTier(makeRnd(i / 20));
    assert.ok(t >= 0 && t <= 4);
  }
});
test('EMIT_FOR_TIER: eşleme tablosu', () => {
  assert.equal(C.EMIT_FOR_TIER[3], undefined);
  assert.equal(C.EMIT_FOR_TIER[4], 'tohum_tozu');
  assert.equal(C.EMIT_FOR_TIER[5], 'cicek_ozu');
  assert.equal(C.EMIT_FOR_TIER[6], 'meyve');
  assert.equal(C.EMIT_FOR_TIER[7], 'nadir_tohum');
  assert.equal(C.EMIT_FOR_TIER[8], 'agac_fidani');
  assert.equal(C.EMIT_FOR_TIER[9], 'efsanevi');
  assert.equal(C.EMIT_FOR_TIER[10], 'efsanevi');
});

// === Bahçe motoru (bahce-2048'den taşınan sözleşmeler) ===
test('ZONES: slot sayıları (12/10/10/6)', () => {
  assert.deepEqual(C.ZONES.map(z => z.slots.length), [12, 10, 10, 6]);
});
test('tohum_tozu: aktif bölgede çiçek slotu doldurur', () => {
  const g = C.newGarden();
  const evs = C.applyResource(g, 'tohum_tozu', makeRnd(0));
  assert.equal(evs[0].kind, 'plant');
  assert.equal(C.ZONES[0].slots[evs[0].slot].type, 'cicek');
});
test('cicek_ozu: dolu çiçek yoksa bankaya; ekilince otomatik kullanılır', () => {
  const g = C.newGarden();
  C.applyResource(g, 'cicek_ozu', makeRnd(0));
  assert.equal(g.bank.cicek_ozu, 1);
  const evs = C.applyResource(g, 'tohum_tozu', makeRnd(0));
  assert.equal(g.bank.cicek_ozu, 0);
  assert.ok(evs.some(e => e.kind === 'variant'));
});
test('meyve: cali doldur → hayvan (3) → banka', () => {
  const g = C.newGarden();
  const caliCount = C.ZONES[0].slots.filter(s => s.type === 'cali').length;
  for (let i = 0; i < caliCount; i++) assert.equal(C.applyResource(g, 'meyve', makeRnd(0))[0].kind, 'plant');
  for (let i = 0; i < 3; i++) assert.equal(C.applyResource(g, 'meyve', makeRnd(0))[0].kind, 'animal');
  assert.equal(C.applyResource(g, 'meyve', makeRnd(0))[0].kind, 'bank');
});
test('nadir_tohum: bankadan kilit açılınca drenaj', () => {
  const g = C.newGarden();
  C.applyResource(g, 'nadir_tohum', makeRnd(0));
  let all = [];
  for (let i = 0; i < 9; i++) all.push(...C.applyResource(g, 'tohum_tozu', makeRnd(0)));
  for (let i = 0; i < 3; i++) all.push(...C.applyResource(g, 'meyve', makeRnd(0)));
  assert.ok(all.some(e => e.kind === 'unlock' && e.zone === 1));
  assert.equal(g.bank.nadir_tohum || 0, 0);
});
test('koruma invariantı: kaynak kaybolmaz, tüm bölgeler açılır', () => {
  const g = C.newGarden();
  const types = ['tohum_tozu', 'meyve', 'nadir_tohum', 'agac_fidani', 'efsanevi', 'cicek_ozu'];
  let planted = 0;
  const rnd = makeRnd(0);
  for (let i = 0; i < 200; i++)
    for (const e of C.applyResource(g, types[i % types.length], rnd))
      if (e.kind === 'plant') planted++;
  assert.equal(planted, 38);
  assert.equal(g.unlocked, 4);
});
test('idleGrowth: 4 saatte 1 evre, 2 evre tavanı', () => {
  const H = 3600 * 1000;
  const g = C.newGarden();
  C.applyResource(g, 'tohum_tozu', makeRnd(0));
  assert.deepEqual(C.idleGrowth(g, 3 * H), { steps: 0, grown: 0 });
  assert.deepEqual(C.idleGrowth(g, 5 * H), { steps: 1, grown: 1 });
  assert.deepEqual(C.idleGrowth(g, 100 * H), { steps: 2, grown: 1 });
});

// === Persistence ===
test('deserialize: bozuk girdi → temiz varsayılan', () => {
  for (const bad of [null, '', '{}', 'çöp{', '[1,2]']) {
    const st = C.deserialize(bad);
    assert.equal(st.score, 0);
    assert.equal(st.garden.unlocked, 1);
    assert.deepEqual(st.fruits, []);
  }
});
test('deserialize: bozuk fruits/queue temizlenir', () => {
  const st = C.deserialize(JSON.stringify({ garden: {}, fruits: [{ tier: 99, x: 1, y: 1 }, 'x'], queue: [9, 'a'] }));
  assert.deepEqual(st.fruits, []);
  assert.ok(st.queue.every(t => Number.isInteger(t) && t >= 0 && t <= 4));
});
test('serialize/deserialize roundtrip', () => {
  const st = C.defaultState();
  st.score = 44; st.best = 120; st.muted = true;
  st.fruits = [{ tier: 3, x: 40, y: 100 }];
  C.applyResource(st.garden, 'tohum_tozu', makeRnd(0));
  const back = C.deserialize(C.serialize(st));
  assert.equal(back.score, 44);
  assert.equal(back.muted, true);
  assert.deepEqual(back.fruits, [{ tier: 3, x: 40, y: 100 }]);
  assert.equal(Object.keys(back.garden.plots).length, 1);
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('PASS', name); }
  catch (e) { fail++; console.error('FAIL', name, '\n  ', e.stack); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
