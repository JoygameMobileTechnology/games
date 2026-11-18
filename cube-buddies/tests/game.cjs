const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const url = pathToFileURL(path.join(root, 'index.html')).href + '?practice=1';
const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const state = page => page.evaluate(() => cubeBuddies.getState());
// The queue buttons bob forever, so Playwright's "wait until stable" check would never pass.
const tap = (page, col) => page.locator(`[data-col="${col}"]`).click({ force: true });

async function main() {
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
  const errors = [];
  try {
    // Real WebGL, real time, offline, on the unmodified deliverable.
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.context().setOffline(true);
    await page.goto(url);
    await page.waitForFunction(() => window.cubeBuddies?.getState().frame > 4);
    const initial = await state(page);
    assert.equal(initial.total, 158);
    assert(initial.drawCalls > 0, 'WebGL must draw the scene');
    assert.equal(initial.queue.flat().reduce((n, p) => n + p.count, 0), initial.total, 'crates add up to the structure');
    await tap(page, 0); await tap(page, 1);
    await page.waitForFunction(() => cubeBuddies.getState().workers.some(w => w.state === 'toCube'));
    assert.equal((await state(page)).slots.filter(Boolean).length, 2);
    await page.locator('#pause').click();
    const frozen = (await state(page)).workers;
    await page.waitForTimeout(250);
    assert.deepEqual((await state(page)).workers, frozen, 'pause freezes the crew');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'modalPrimary', 'dialog traps focus');
    await page.keyboard.press('Escape');
    assert.equal((await state(page)).paused, false);
    for (const [width, height] of [[390, 844], [320, 640], [768, 1024], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      const box = await page.evaluate(() => {
        const r = el => { const b = (typeof el === 'string' ? document.querySelector(el) : el).getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
        return { scroll: document.documentElement.scrollWidth, level: r('.level'), tools: r('.tools'), progress: r('#progress'), picks: [...document.querySelectorAll('[data-col]')].map(r), counts: [...document.querySelectorAll('.num')].map(el => ({ ...r(el), size: parseFloat(getComputedStyle(el).fontSize), text: el.textContent })), tags: [...document.querySelectorAll('.tag')].map(r) };
      });
      assert.equal(box.scroll, width, `no horizontal overflow at ${width}px`);
      assert(box.level.right <= box.tools.left, `level pill clears the buttons at ${width}px`);
      // The waiting trucks: every head truck is a whole, finger-sized button under the HUD; every shown truck has a readable count.
      assert.equal(box.picks.length, 3, 'one button per column');
      for (const b of box.picks) assert(b.left >= 0 && b.right <= width && b.bottom <= height && b.top >= box.progress.bottom && b.right - b.left >= 44 && b.bottom - b.top >= 44, `waiting trucks fit at ${width}px: ${JSON.stringify(b)}`);
      assert(box.counts.length >= 3 && box.counts.every(c => c.size >= 14 && /^\d+$/.test(c.text) && c.left >= 0 && c.right <= width && c.bottom <= height), `truck counts are readable at ${width}px: ${JSON.stringify(box.counts)}`);
      for (const t of box.tags) assert(t.left >= 0 && t.right <= width && t.top >= box.progress.bottom && t.bottom <= height, `parked truck counters fit at ${width}px`);
      for (let i = 1; i < box.tags.length; i++) assert(box.tags[i].left >= box.tags[i - 1].right - 1, `parked truck counters do not run into each other at ${width}px`);
      assert(await page.locator('[data-col]').first().isVisible());
      const view = (await state(page)).view;
      assert(view.fog[0] > view.dist + 10, `fog must start behind the structure at ${width}px: ${JSON.stringify(view)}`);
    }
    // The simulation runs at 1.7 seconds per second normally; the fast button says 2× and makes it 2.3.
    const pace = async () => { const t0 = (await state(page)).time, w0 = Date.now(); await page.waitForTimeout(1000); return ((await state(page)).time - t0) / ((Date.now() - w0) / 1000); };
    const normal = await pace();
    assert(normal > 1.45 && normal < 1.95, `1× should run at about 1.7 (${normal.toFixed(2)}s per second)`);
    await page.locator('#speed').click();
    assert.equal(await page.locator('#speed').textContent(), '2×');
    const rate = await pace();
    assert(rate > 2.0 && rate < 2.6, `2× should run at about 2.3 (${rate.toFixed(2)}s per second)`);
    await page.locator('#speed').click();
    assert.equal((await state(page)).speed, 1, 'the button toggles back to 1×; there is no 3×');
    await page.close();

    // Whole levels on autoplay. hold() stops the real-time loop and advance() steps the same simulation without
    // drawing, so three levels take a second instead of minutes.
    const sim = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    sim.on('pageerror', e => errors.push(e.message));
    await sim.goto(url);
    await sim.waitForFunction(() => window.cubeBuddies?.getState().frame > 2);
    await sim.evaluate(() => cubeBuddies.hold(true));
    await sim.locator('#auto').click();
    let s;
    for (let level = 0; level < 3; level++) {
      s = await state(sim);
      assert.equal(s.level, level);
      for (let batch = 0; batch < 150 && !s.won; batch++) {
        s = await sim.evaluate(() => { cubeBuddies.advance(4); return cubeBuddies.getState(); });
        assert.equal(s.remaining + s.carried + s.collected, s.total, 'every cube stays accounted for');
        const owed = s.queue.flat().reduce((n, p) => n + p.count, 0) + s.slots.reduce((n, c) => n + (c ? c.remaining : 0), 0);
        assert.equal(owed, s.total - s.collected, 'crate counters match the cubes still to deliver');
        assert(s.slots.every(c => !c || (c.inFlight >= 0 && c.inFlight <= c.remaining)), 'no cube is promised twice');
      }
      assert(s.won, `level ${level + 1} must complete`);
      assert.equal(s.collected, s.total);
      assert.equal(s.remaining, 0);
      console.log(`PASS level ${level + 1}: ${s.total}/${s.total} cubes delivered`);
      await sim.evaluate(() => cubeBuddies.advance(3));
      await sim.locator('#modalPrimary').click();
    }
    // The point of the game: the crew gets around with parkour, not by walking.
    for (const move of ['wallrun', 'pullUp', 'catLeap', 'bigLeap', 'jumpGrab', 'frontflip', 'backflip', 'cartwheel', 'springOff', 'stroll', 'gaze', 'ready'])
      assert(s.moves[move] > 0, `expected at least one ${move}`);
    // Cubes come off from a foothold beside them when there is one, otherwise from on top; never from under
    // another cube and never by jumping up at them from below.
    assert(s.moves.pull > 0 && s.moves.pluck > 0 && s.moves.topPluck > 0, 'all three ways of taking a cube are used');
    assert(s.moves.pull + s.moves.pluck > 3 * s.moves.topPluck, 'standing on the cube being taken is the exception');
    for (const move of ['coveredTake', 'superJump', 'wallBackflip']) assert(!s.moves[move], `unexpected ${move}`);
    // Long pieces: two of the crew lift each bar together, carry it in step and throw it onto the truck together.
    assert(s.moves.barJoin > 0 && s.moves.barShot > 0, 'bars are carried by two');
    assert(s.moves.barShot <= s.moves.barClaim, 'every bar thrown was claimed first');
    // Nobody stands around: every moment without a move in progress counts against this share of crew time.
    assert(s.still < .1, `crew stood still ${Math.round(s.still * 100)}% of the time`);
    console.log('PASS parkour: ' + Object.entries(s.moves).map(([k, v]) => `${k} ${v}`).join(', '));

    // Trucks share one lane between the bays and the waiting columns: send them as fast as bays free up for a whole
    // level and check, frame by frame, that no two truck footprints ever overlap — waiting, manoeuvring, parked or leaving.
    const lanes = await sim.evaluate(() => {
      const { halfWidth, tail, nose } = cubeBuddies.getLayout().truck;
      const box = ([x, z, th, k]) => { const f = [Math.sin(th), Math.cos(th)], n = [f[1], -f[0]], c = []; for (const a of [-tail * k, nose * k]) for (const b of [-halfWidth * k, halfWidth * k]) c.push([x + f[0] * a + n[0] * b, z + f[1] * a + n[1] * b]); return { c, ax: [f, n] }; };
      const gap = (A, B) => { let best = -Infinity; for (const ax of [...A.ax, ...B.ax]) { const a = A.c.map(c => c[0] * ax[0] + c[1] * ax[1]), b = B.c.map(c => c[0] * ax[0] + c[1] * ax[1]); best = Math.max(best, Math.min(...b) - Math.max(...a), Math.min(...a) - Math.max(...b)); } return best; };
      let min = Infinity, col = 0, s;
      for (let i = 0; i < 60 * 300; i++) {
        cubeBuddies.advance(1 / 60, 1 / 60); s = cubeBuddies.getState(); if (s.won) break;
        if (s.slots.includes(null)) for (let k = 0; k < 3; k++) { const el = document.querySelector(`[data-col="${(col + k) % 3}"]`); if (el) { el.click(); col += k + 1; break; } }
        const bs = s.trucks.map(box); for (let a = 0; a < bs.length; a++) for (let b = a + 1; b < bs.length; b++) min = Math.min(min, gap(bs[a], bs[b]));
      }
      return { won: s.won, min };
    });
    assert(lanes.won, 'level completes with trucks sent as fast as possible');
    assert(lanes.min > 0, `trucks overlapped by ${(-lanes.min).toFixed(2)}`);
    console.log(`PASS trucks never overlap (closest ${lanes.min.toFixed(2)} apart)`);
    await sim.evaluate(() => cubeBuddies.advance(3));
    await sim.locator('#modalPrimary').click();

    // A crew whose cubes are buried under a colour with no truck on the road checks its watch for that truck.
    // Fresh page, level 1, no autoplay, blue truck only: the uncovered blue cubes run out and the rest sit under yellow.
    const lone = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    lone.on('pageerror', e => errors.push(e.message));
    await lone.goto(url);
    await lone.waitForFunction(() => window.cubeBuddies?.getState().frame > 2);
    await lone.evaluate(() => cubeBuddies.hold(true));
    await tap(lone, 1);
    const stuck = await lone.evaluate(() => { let s; for (let i = 0; i < 30 * 60; i++) { cubeBuddies.advance(1 / 30, 1 / 30); s = cubeBuddies.getState(); if (s.moves.watch > 0) break; } return { watch: s.moves.watch || 0, trucks: s.slots.filter(Boolean).length, left: s.slots.find(Boolean).remaining }; });
    assert.equal(stuck.trucks, 1);
    assert(stuck.left > 0 && stuck.watch > 0, 'a blocked crew looks at its watch');
    console.log('PASS blocked crew checks its watch');
    await lone.close();

    await tap(sim, 0);
    await sim.evaluate(() => cubeBuddies.advance(3));
    await sim.locator('#restart').click();
    await sim.locator('#modalPrimary').click();
    const reset = await state(sim);
    assert.equal(reset.collected, 0);
    assert.equal(reset.remaining, reset.total);
    assert(reset.slots.every(c => c === null));
    assert.equal(reset.workers.length, 0);
    assert.deepEqual(errors, []);
    console.log('PASS offline WebGL, pause, dialog focus, 320/390/768/1440px layouts, cube conservation, restart, zero runtime errors');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
