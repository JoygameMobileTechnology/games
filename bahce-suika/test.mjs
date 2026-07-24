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
const settle = (w, steps = 720) => { const all = []; for (let i = 0; i < steps; i++) all.push(...C.stepWorld(w, 1 / 120).merges); return all; };
const makeRnd = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

// === Fizik (değişmedi) ===
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
});
test('birleşme yok: farklı kademeler yan yana kalır', () => {
  const w = C.newWorld();
  C.addFruit(w, 0, 45); C.addFruit(w, 1, 55);
  assert.equal(settle(w).length, 0);
  assert.equal(w.fruits.length, 2);
});
test('son kademe birleşmez', () => {
  const w = C.newWorld();
  C.addFruit(w, C.TIERS - 1, 30); C.addFruit(w, C.TIERS - 1, 70);
  assert.equal(settle(w).length, 0);
});
test('zincir: iki birleşme art arda (0+0→1, 1+1→2)', () => {
  const w = C.newWorld();
  C.addFruit(w, 1, 50);
  settle(w, 240);
  C.addFruit(w, 0, 46); C.addFruit(w, 0, 54);
  const merges = settle(w);
  assert.deepEqual(merges.map(x => x.tier).sort(), [1, 2]);
  assert.equal(w.fruits.length, 1);
});
test('duvarların dışına çıkmaz', () => {
  const w = C.newWorld();
  const f = C.addFruit(w, 3, 50);
  f.vx = 400;
  settle(w, 480);
  assert.ok(f.x >= C.radius(3) - 0.01 && f.x <= C.W - C.radius(3) + 0.01);
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
});

// === Dünya Ağacı: enerji ekonomisi ===
test('energyFor: kademe → 2^(t-1)', () => {
  assert.equal(C.energyFor(1), 1);
  assert.equal(C.energyFor(2), 2);
  assert.equal(C.energyFor(4), 8);
  assert.equal(C.energyFor(10), 512);
});
test('levelCost: monoton artar, sv0 = 10', () => {
  assert.equal(C.levelCost(0), 10);
  for (let l = 1; l <= C.MAX_LEVEL; l++) assert.ok(C.levelCost(l) > C.levelCost(l - 1));
});
test('addEnergy: eşik altı birikir, olay yok', () => {
  const t = C.newTree(42);
  assert.deepEqual(C.addEnergy(t, 9), []);
  assert.equal(t.energy, 9);
  assert.equal(t.level, 0);
});
test('addEnergy: tek levelup + artan taşınır', () => {
  const t = C.newTree(42);
  const evs = C.addEnergy(t, 13);   // maliyet sv0 = 10
  assert.deepEqual(evs, [{ kind: 'levelup', level: 1 }]);
  assert.equal(t.level, 1);
  assert.equal(t.energy, 3);
});
test('addEnergy: büyük patlama çok seviye atlatır', () => {
  const t = C.newTree(42);
  const evs = C.addEnergy(t, 100);  // 10 + 15 + 23 = 48 → sv3, kalan 52 > 34? 34 → sv4
  assert.ok(evs.length >= 3);
  assert.equal(evs[0].level, 1);
  assert.equal(evs[evs.length - 1].level, t.level);
  assert.ok(t.energy < C.levelCost(t.level));
});
test('addEnergy: MAX sonrası legend birikir', () => {
  const t = C.newTree(42);
  t.level = C.MAX_LEVEL;
  C.addEnergy(t, 77);
  assert.equal(t.level, C.MAX_LEVEL);
  assert.equal(t.energy, 0);
  assert.equal(t.legend, 77);
});
test('idleEnergy: saatte 6, tavan 60, negatif güvenli', () => {
  const H = 3600 * 1000;
  assert.equal(C.idleEnergy(0.5 * H), 0);
  assert.equal(C.idleEnergy(2 * H), 12);
  assert.equal(C.idleEnergy(100 * H), 60);
  assert.equal(C.idleEnergy(-5 * H), 0);
});

// === Ağaç topolojisi ===
test('treeTopology: aynı tohum aynı ağaç, farklı tohum farklı', () => {
  const a = C.treeTopology(1234), b = C.treeTopology(1234), c = C.treeTopology(999);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.length > 20, 'yeterli dal üretmeli: ' + a.length);
});
test('treeTopology: kök depth 0, derinlik artar, MAX görünür derinliğe yeter', () => {
  const topo = C.treeTopology(42);
  assert.equal(topo[0].depth, 0);
  const maxD = Math.max(...topo.map(b => b.depth));
  assert.ok(maxD >= C.visibleDepth(C.MAX_LEVEL), `maxD=${maxD}`);
});
test('visibleDepth: seviyeyle monoton', () => {
  for (let l = 1; l <= C.MAX_LEVEL; l++) assert.ok(C.visibleDepth(l) >= C.visibleDepth(l - 1));
  assert.equal(C.visibleDepth(0), 1);
});

// === Persistence ===
test('deserialize: bozuk girdi → temiz varsayılan', () => {
  for (const bad of [null, '', '{}', 'çöp{', '[1,2]']) {
    const st = C.deserialize(bad);
    assert.equal(st.score, 0);
    assert.equal(st.tree.level, 0);
    assert.deepEqual(st.fruits, []);
  }
});
test('deserialize: bozuk tree alanları temizlenir', () => {
  const st = C.deserialize(JSON.stringify({ tree: { level: 99, energy: -5, seed: 'x', legend: null }, fruits: 3 }));
  assert.equal(st.tree.level, 0);
  assert.equal(st.tree.energy, 0);
  assert.equal(st.tree.legend, 0);
  assert.ok(Number.isInteger(st.tree.seed));
  assert.deepEqual(st.fruits, []);
});
test('serialize/deserialize roundtrip', () => {
  const st = C.defaultState();
  st.score = 44; st.muted = true;
  st.tree.level = 5; st.tree.energy = 17; st.tree.seed = 777;
  st.fruits = [{ tier: 3, x: 40, y: 100 }];
  const back = C.deserialize(C.serialize(st));
  assert.equal(back.tree.level, 5);
  assert.equal(back.tree.energy, 17);
  assert.equal(back.tree.seed, 777);
  assert.deepEqual(back.fruits, [{ tier: 3, x: 40, y: 100 }]);
});

let fail = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('PASS', name); }
  catch (e) { fail++; console.error('FAIL', name, '\n  ', e.stack); }
}
console.log(`${tests.length - fail}/${tests.length} passed`);
process.exit(fail ? 1 : 0);
