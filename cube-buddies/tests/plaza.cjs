// The plaza layout, on the picture level: a voxel picture with real height in the middle, open corridors beside it,
// five bays in front and real trucks waiting behind them. Everything here is checked on the running game.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const ready = page => page.waitForFunction(() => window.cubeBuddies?.getState().frame > 2);
const state = page => page.evaluate(() => cubeBuddies.getState());

(async () => {
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  const errors = [];
  const open = async (viewport, query = '') => { const page = await browser.newPage({ viewport }); page.on('pageerror', e => errors.push(e.message)); await page.goto(url + query); await ready(page); return page; };
  try {
    // ---- The square: a picture built from cubes, corridors either side, bays, waiting trucks; top to bottom on a phone.
    const page = await open({ width: 390, height: 844 });
    const first = await page.evaluate(() => ({ s: cubeBuddies.getState(), l: cubeBuddies.getLayout(), v: cubeBuddies.getVoxels() }));
    assert.equal(first.s.level, 0); assert.equal(first.s.total, first.v.length);
    const top = new Map(), cells = new Set(first.v.map(v => v.join(',')));
    for (const [x, y, z] of first.v) { top.set(`${x},${z}`, Math.max(top.get(`${x},${z}`) || 0, y + 1)); if (y > 0) assert(cells.has(`${x},${y - 1},${z}`), 'every cube rests on the ground or on another cube'); }
    const heights = [...top.values()], levels = new Set(heights), b = first.s.bounds, p = first.l.plaza;
    assert(top.size > 400 && first.v.length > top.size * 1.6, 'the picture is columns of cubes, not one flat layer');
    assert(levels.size >= 4 && Math.min(...heights) === 1 && Math.max(...heights) >= 4, `high and low parts to climb: ${[...levels].sort()}`);
    assert.equal(first.v.length, top.size + first.v.filter(([x, y, z]) => cells.has(`${x},${y + 1},${z}`)).length, 'no holes inside the columns');
    assert(b.x0 - p.x0 >= 3 && p.x1 - b.x1 >= 3, 'an open corridor at least three cells wide down each side');
    assert.equal(b.z1, first.l.front); assert(first.l.dock - b.z1 >= 4, 'room to walk between the picture and the trucks');
    assert.equal(first.l.bays.length, 5); assert.equal(first.s.slots.length, 5);
    assert.equal(first.s.queue.flat().reduce((n, t) => n + t.count, 0), first.s.total, 'the trucks add up to the picture');
    assert(Math.abs(first.s.view.yaw) < 1e-3 && first.s.view.pitch > .7 && first.s.view.pitch < 1.15, 'starts looking down the picture from above, at an angle');
    for (const [width, height] of [[390, 844], [320, 640], [414, 896], [768, 1024]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
      const v = await page.evaluate(() => { const r = el => { const q = el.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom]; }; return { hud: document.getElementById('progress').getBoundingClientRect().bottom, screen: cubeBuddies.getLayout().screen, picks: [...document.querySelectorAll('[data-col]')].map(r), nums: [...document.querySelectorAll('.num')].map(el => [...r(el), parseFloat(getComputedStyle(el).fontSize)]) }; });
      const { structure, bays, queue } = v.screen, inside = ([l, t, r, bottom]) => l >= -1 && r <= width + 1 && t >= v.hud && bottom <= height + 1;
      assert(inside(structure) && inside(bays) && inside(queue), `picture, bays and waiting trucks are whole and under the HUD at ${width}×${height}: ${JSON.stringify(v)}`);
      assert(structure[3] <= bays[1] + 2 && bays[3] <= queue[1] + 2, `picture above the bays above the waiting trucks at ${width}×${height}`);
      // On a phone the picture takes most of the width; a squarer screen is filled top to bottom instead.
      assert(structure[2] - structure[0] > width * (height / width > 1.6 ? .55 : .38), `the picture is the main thing on screen at ${width}×${height}: ${structure}`);
      assert.equal(v.picks.length, 4); assert.equal(v.nums.length, 8, 'two rows of waiting trucks are shown, each with its count');
      for (const [l, t, r, bottom] of v.picks) assert(r - l >= 44 && bottom - t >= 44 && l >= 0 && r <= width && bottom <= height, `waiting trucks are comfortable to tap at ${width}×${height}`);
      for (let i = 1; i < v.picks.length; i++) assert(v.picks[i][0] >= v.picks[i - 1][2] - 1, 'neighbouring trucks have separate tap areas');
      for (const n of v.nums) assert(n[4] >= 15 && n[0] >= 0 && n[2] <= width && n[3] <= height, `truck counts are readable at ${width}×${height}: ${n}`);
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
    console.log(`PASS picture of ${first.v.length} cubes in ${top.size} columns, heights ${[...levels].sort().join('/')}, corridors, five bays, phone layouts`);

    // ---- One truck, by hand: tap it, it parks in the first bay, its crew gets out, collects and loads.
    await page.evaluate(() => cubeBuddies.hold(true));
    const head = first.s.queue[0][0];
    const pick = await page.locator('[data-col="0"]').boundingBox();
    await page.mouse.click(pick.x + pick.width / 2, pick.y + pick.height / 2);   // a real tap on the truck itself
    let s = await state(page);
    assert.deepEqual([s.slots[0].color, s.slots[0].remaining, s.slots[0].state], [head.color, head.count, 'in']); assert.equal(s.queue[0].length, first.s.queue[0].length - 1);
    const one = await page.evaluate(() => {
      const L = cubeBuddies.getLayout(), out = { parkedAt: 0, crewAt: 0, bad: [], steps: 0 }; let s, last = 0;
      for (let i = 0; i < 30 * 60; i++) {
        cubeBuddies.advance(1 / 30, 1 / 30); s = cubeBuddies.getState(); const t = s.slots[0]; if (!t) break;
        if (!out.parkedAt && t.state === 'open') { out.parkedAt = s.time; const me = s.trucks.find(q => Math.abs(q[0] - L.bays[0][0]) < .01 && Math.abs(q[1] - L.bays[0][1]) < .01); if (!me || Math.abs(me[2]) > .01) out.bad.push('not parked square in bay 1'); }
        if (!out.parkedAt && s.workers.length) out.bad.push('crew got out before the truck was parked');
        if (!out.crewAt && s.workers.length) out.crewAt = s.time;
        // The counter, the cubes on the bed and the cubes still owed always agree.
        if (t.loaded !== t.want - t.remaining) out.bad.push(`bed shows ${t.loaded}, counter says ${t.want - t.remaining}`);
        const tag = document.querySelector('[data-slot="0"]'); if (tag && tag.textContent !== `${t.want - t.remaining}/${t.want}`) out.bad.push('tag text ' + tag.textContent);
        // It grows a cube at a time (a two-person bar is two cubes) and never shrinks.
        if (t.loaded < last || t.loaded > last + 2) out.bad.push(`load jumped from ${last} to ${t.loaded}`); if (t.loaded > last) out.steps++; last = t.loaded;
        if (s.workers.some(w => w.color !== t.color)) out.bad.push('wrong crew colour');
      }
      return { ...out, bad: out.bad.slice(0, 5), slot: s.slots[0], collected: s.collected, time: s.time };
    });
    assert.deepEqual(one.bad, []);
    assert(one.parkedAt > 0 && one.crewAt >= one.parkedAt, 'the truck parks, then its crew gets out');
    assert.equal(one.slot, null, 'a full truck leaves and frees its bay'); assert.equal(one.collected, head.count); assert(one.steps >= head.count / 2 && one.steps <= head.count, 'the load grows cube by cube as the crew delivers');
    console.log(`PASS one truck by hand: parked after ${one.parkedAt.toFixed(1)}s, ${head.count} cubes loaded in ${one.steps} deliveries, left after ${one.time.toFixed(0)}s`);

    // ---- All five bays taken: a sixth truck stays where it is. A bay that frees up is used again.
    const full = await page.evaluate(() => {
      const tap = c => document.querySelector(`[data-col="${c}"]`).click(), out = {};
      for (let i = 0; i < 5; i++) tap(i % 4);
      cubeBuddies.advance(.1); out.before = cubeBuddies.getState(); tap(1); tap(2); cubeBuddies.advance(.1); out.after = cubeBuddies.getState();
      let s; for (let i = 0; i < 30 * 90; i++) { cubeBuddies.advance(1 / 30, 1 / 30); s = cubeBuddies.getState(); if (s.slots.includes(null)) break; }
      out.freed = s.slots.indexOf(null); tap(3); cubeBuddies.advance(.1); out.reused = cubeBuddies.getState().slots[out.freed];
      return out;
    });
    assert(full.before.slots.every(Boolean)); assert.deepEqual(full.after.queue, full.before.queue, 'no truck leaves its column while the bays are full');
    assert.deepEqual(full.after.slots.map(t => t.color), full.before.slots.map(t => t.color));
    assert(full.freed >= 0 && full.reused && full.reused.state === 'in', 'the freed bay takes the next truck');
    console.log('PASS five bays fill up, a sixth truck is refused, a freed bay is used again');
    await page.close();

    // ---- The whole level on autoplay, every frame watched.
    const play = await open({ width: 390, height: 844 });
    const run = await play.evaluate(() => {
      cubeBuddies.hold(true); document.getElementById('auto').click();
      const L = cubeBuddies.getLayout(), b = cubeBuddies.getState().bounds, dt = 1 / 30;
      const { halfWidth, tail, nose } = L.truck;
      const box = ([x, z, th, k]) => { const f = [Math.sin(th), Math.cos(th)], n = [f[1], -f[0]], c = []; for (const a of [-tail * k, nose * k]) for (const q of [-halfWidth * k, halfWidth * k]) c.push([x + f[0] * a + n[0] * q, z + f[1] * a + n[1] * q]); return { c, ax: [f, n] }; };
      const gap = (A, B) => { let best = -Infinity; for (const ax of [...A.ax, ...B.ax]) { const a = A.c.map(c => c[0] * ax[0] + c[1] * ax[1]), q = B.c.map(c => c[0] * ax[0] + c[1] * ax[1]); best = Math.max(best, Math.min(...q) - Math.max(...a), Math.min(...a) - Math.max(...q)); } return best; };
      const zone = c => c.x < b.x0 ? 'left' : c.x > b.x1 ? 'right' : c.z > b.z1 ? 'front' : c.z < b.z0 ? 'back' : 'inside';
      const out = { bad: [], enter: { left: 0, right: 0, front: 0, back: 0, inside: 0 }, walk: { left: 0, right: 0, front: 0, back: 0, inside: 0 }, carry: { left: 0, right: 0, front: 0, back: 0, inside: 0 }, picks: 0, far: 0, step: 0, idle: 0, afloat: 0, trucks: Infinity, parked: 0, waiting: 0, buried: 0, shots: 0 };
      const note = text => { if (out.bad.length < 8) out.bad.push(text); };
      let s, solid = null, left = -1, prev = new Map(), still = new Map(), afloat = new Map(), voxels;
      for (let i = 0; i < 30 * 1500; i++) {
        cubeBuddies.advance(dt, dt); s = cubeBuddies.getState();
        let gone = [];
        if (s.remaining !== left) {
          const now = cubeBuddies.getVoxels(), next = new Set(now.map(v => v.join(',')));
          if (solid) gone = voxels.filter(v => !next.has(v.join(',')));
          else out.buried = now.filter(([x, y, z]) => next.has(`${x},${y + 1},${z}`)).length;
          voxels = now; solid = next; left = s.remaining;
        }
        if (s.remaining + s.carried + s.collected !== s.total) note('a cube went missing');
        if (s.queue.flat().reduce((n, t) => n + t.count, 0) + s.slots.reduce((n, t) => n + (t ? t.remaining : 0), 0) !== s.total - s.collected) note('truck counts do not add up');
        for (const t of s.slots) if (t) { if (t.inFlight < 0 || t.inFlight > t.remaining) note('a cube promised twice'); if (t.loaded !== t.want - t.remaining) note('bed and counter disagree'); if (t.waiting) out.waiting++; }
        out.parked = Math.max(out.parked, s.slots.filter(Boolean).length);
        const boxes = s.trucks.map(box); for (let a = 0; a < boxes.length; a++) for (let q = a + 1; q < boxes.length; q++) out.trucks = Math.min(out.trucks, gap(boxes[a], boxes[q]));
        for (const w of s.workers) {
          const p = prev.get(w.id), [x, y, z] = w.position;
          // Nobody stands or runs inside a cube: the middle of the body is always in free space.
          if (w.state !== 'spawn' && solid.has(`${Math.round(x)},${Math.floor(y + .9)},${Math.round(z)}`)) note(`worker ${w.id} (${w.act}) is inside the cube at ${Math.round(x)},${Math.floor(y + .9)},${Math.round(z)}`);
          // Nobody runs on a cube that is no longer there. (A stride that was already leaving a cube when it was
          // pulled away may finish: that is a fraction of a second.)
          const running = p && ['run', 'returnRun', 'stroll'].includes(w.act) && p.act === w.act && y > .2 && Math.abs(y - Math.round(y)) < .02 && Math.abs(p.position[1] - y) < 1e-3 && Math.hypot(x - p.position[0], z - p.position[2]) > .01;
          const float = running && !solid.has(`${Math.round(x)},${Math.round(y) - 1},${Math.round(z)}`) ? (afloat.get(w.id) || 0) + dt : 0; afloat.set(w.id, float); out.afloat = Math.max(out.afloat, float);
          if (float > .2) note(`worker ${w.id} runs on a cube that is not there`);
          if (p) {
            const d = Math.hypot(x - p.position[0], y - p.position[1], z - p.position[2]); out.step = Math.max(out.step, d);
            // No teleporting: the fastest thing a character does is a jump.
            if (d > .75 && w.state !== 'spawn' && p.state !== 'spawn') note(`worker ${w.id} moved ${d.toFixed(2)} in one frame (${p.act} → ${w.act})`);
            if (w.state === 'toCube' && !w.carry) {
              if (w.cell.y === 0) out.walk[zone(w.cell)]++;
              if (p.state === 'toCube' && p.cell.y === 0 && w.cell.y > 0) out.enter[zone(p.cell)]++;
            }
            if (w.carry && w.state === 'toCrate' && w.returnGround) out.carry[zone({ x: Math.round(x), z: Math.round(z) })]++;
            // No picking from a distance: whoever starts carrying is right at the cube that has just gone.
            if (w.carry && !p.carry) { out.picks++; const near = Math.min(...gone.map(v => Math.max(Math.abs(v[0] - x), Math.abs(v[2] - z), Math.abs(v[1] + .5 - (y + .5)) - .6))); out.far = Math.max(out.far, near); if (!(near < 1.75)) note(`worker ${w.id} took a cube from ${near.toFixed(2)} away`); }
            // Loading happens on the strip behind the truck's own tailgate (the second carrier of a bar stands a bar's length off).
            if (p.carry && !w.carry) { out.shots++; const bay = L.bays[w.bay], reach = p.act === 'barFollow' ? 3.4 : 2; if (!bay || z > L.dock + .6 || z < L.dock - reach || Math.abs(x - bay[0]) > reach) note(`worker ${w.id} threw from ${x.toFixed(1)},${z.toFixed(1)}, not from behind its truck`); }
            // Nobody gets stuck: with a job to do, a character keeps moving.
            // (Crouched at one end of a two-person bar, waiting for a partner, is the one deliberate wait.)
            const busy = (w.state === 'toCube' || w.state === 'toCrate') && w.act !== 'barWait', k = d < 1e-4 && busy ? (still.get(w.id) || 0) + dt : 0; still.set(w.id, k); out.idle = Math.max(out.idle, k);
          }
          prev.set(w.id, w);
        }
        for (const id of [...prev.keys()]) if (!s.workers.some(w => w.id === id)) { prev.delete(id); still.delete(id); }
        if (s.won) break;
      }
      return { ...out, won: s.won, collected: s.collected, total: s.total, time: s.time, moves: s.moves, still: s.still };
    });
    assert.deepEqual(run.bad, []);
    assert(run.won && run.collected === run.total, `the level completes: ${run.collected}/${run.total}`);
    for (const move of ['megajump', 'coveredTake', 'fall']) assert(!run.moves[move], `unexpected ${move}: ${run.moves[move]}`);
    assert.equal(run.parked, 5, 'all five bays get used at once'); assert(run.trucks > 0, `trucks overlapped by ${(-run.trucks).toFixed(2)}`);
    // The crew comes up the corridors and goes in from the sides; climbing in from the front strip is the exception.
    const sides = run.enter.left + run.enter.right;
    assert(run.enter.left > 40 && run.enter.right > 40, `both sides are climbed: ${JSON.stringify(run.enter)}`);
    assert(run.enter.front < sides * .1 && run.enter.back === 0, `the crew goes in from the sides: ${JSON.stringify(run.enter)}`);
    assert(run.walk.left > 2000 && run.walk.right > 2000, `both corridors are walked: ${JSON.stringify(run.walk)}`);
    assert(run.moves.sideExitLeft > 50 && run.moves.sideExitRight > 50 && run.carry.left > 1000 && run.carry.right > 1000, `cubes come back down both corridors: ${JSON.stringify(run.carry)}`);
    for (const move of ['hop', 'jumpGrab', 'pullUp', 'wallrun', 'bigLeap', 'sideLand']) assert(run.moves[move] > 0, `expected parkour move ${move}`);
    assert(run.buried > 300, 'colours cover each other'); assert(run.idle < 5, `a character with a job stood still for ${run.idle.toFixed(1)}s`);
    assert(run.still < .1, `crew stood still ${Math.round(run.still * 100)}% of the time`);
    console.log(`PASS whole picture on autoplay in ${Math.round(run.time)}s: ${run.picks} pickups (furthest ${run.far.toFixed(2)}), ${run.shots} loads from behind the trucks, entries ${JSON.stringify(run.enter)}, longest step ${run.step.toFixed(2)}, longest pause ${run.idle.toFixed(1)}s, trucks never closer than ${run.trucks.toFixed(2)}`);
    await play.close();

    // ---- A colour buried under another: its truck waits, can be sent back to the head of its column, and finishes
    // later. On the small practice level, where the blue cubes run out while the rest still sit under yellow.
    const lone = await open({ width: 390, height: 844 }, '?practice=1');
    const back = await lone.evaluate(() => {
      cubeBuddies.hold(true);
      const { halfWidth, tail, nose } = cubeBuddies.getLayout().truck, dt = 1 / 30, out = { min: Infinity };
      const box = ([x, z, th, k]) => { const f = [Math.sin(th), Math.cos(th)], n = [f[1], -f[0]], c = []; for (const a of [-tail * k, nose * k]) for (const q of [-halfWidth * k, halfWidth * k]) c.push([x + f[0] * a + n[0] * q, z + f[1] * a + n[1] * q]); return { c, ax: [f, n] }; };
      const gap = (A, B) => { let best = -Infinity; for (const ax of [...A.ax, ...B.ax]) { const a = A.c.map(c => c[0] * ax[0] + c[1] * ax[1]), q = B.c.map(c => c[0] * ax[0] + c[1] * ax[1]); best = Math.max(best, Math.min(...q) - Math.max(...a), Math.min(...a) - Math.max(...q)); } return best; };
      const step = until => { let s; for (let i = 0; i < 30 * 150; i++) { cubeBuddies.advance(dt, dt); s = cubeBuddies.getState(); const boxes = s.trucks.map(box); for (let a = 0; a < boxes.length; a++) for (let q = a + 1; q < boxes.length; q++) out.min = Math.min(out.min, gap(boxes[a], boxes[q])); if (until(s)) break; } return s; };
      out.start = cubeBuddies.getState(); document.querySelector('[data-col="1"]').click();
      out.stuck = step(s => s.slots[0] && s.slots[0].waiting);
      out.tag = document.querySelector('[data-slot="0"]').className; document.querySelector('[data-slot="0"]').click();
      out.called = step(() => true); out.home = step(s => !s.slots[0]);
      out.shown = cubeBuddies.getState().trucks.length; out.head = document.querySelector('[data-col="1"]').getAttribute('aria-label');
      document.querySelector('[data-col="0"]').click(); document.querySelector('[data-col="1"]').click();   // yellow first, then the blue one again
      out.again = step(() => true); document.getElementById('auto').click(); out.end = step(s => s.won);
      return out;
    });
    const truck = back.stuck.slots[0];
    assert(truck && truck.waiting && truck.remaining > 0 && truck.remaining < truck.want, 'the blue truck loads what is uncovered, then waits');
    assert(back.tag.includes('stuck'), 'the waiting truck is marked');
    assert(back.called.slots[0].recall && back.home.slots.every(t => !t), 'sent back, it leaves its bay');
    assert.deepEqual(back.home.queue[1][0], { color: truck.color, count: truck.remaining }, 'and is at the head of its own column again, wanting only what it still lacks');
    assert.equal(back.home.queue[1].length, back.start.queue[1].length); assert(back.head.includes(`${truck.remaining} küp`));
    assert.equal(back.home.collected, truck.want - truck.remaining); assert.equal(back.home.workers.length, 0, 'its crew went with it');
    assert.deepEqual(back.again.slots.slice(0, 2).map(t => t.color), [back.start.queue[0][0].color, truck.color], 'it can be sent again');
    assert(back.end.won && back.end.collected === back.end.total && !back.end.moves.coveredTake, 'and the level still completes');
    assert(back.min > 0, `trucks overlapped by ${(-back.min).toFixed(2)} on the way back`);
    console.log(`PASS buried colour: truck waits at ${truck.want - truck.remaining}/${truck.want}, goes back to the head of its column, returns and finishes (trucks never closer than ${back.min.toFixed(2)})`);
    await lone.close();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
