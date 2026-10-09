/* Requires Playwright, optionally supplied through PLAYWRIGHT_MODULE. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const engine = await import(pathToFileURL(path.resolve(__dirname, '../src/engine.js')));
  const { createDuelState } = await import(pathToFileURL(path.resolve(__dirname, '../src/duel.js')));
  for (const browserName of (process.env.POLISH_BROWSER ? [process.env.POLISH_BROWSER] : ['chromium', 'webkit'])) {
    const browser = await playwright[browserName].launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
    await context.addInitScript(() => {
      window.__polish = { sounds: [], nudges: [], changes: [], pointerTypes: [], animationStarts: [], sessionWrites: [] };
      const originalStore = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        const result = originalStore.call(this, key, value);
        if (key === 'porcelain:session') {
          const game = JSON.parse(value);
          if (game) window.__polish.sessionWrites.push({ at: performance.now(), score: game.score, remaining: game.tiles.filter(tile => !tile.removed).length });
        }
        return result;
      };
      const originalStart = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        const value = originalStart.apply(this, args);
        window.__polish.sounds.push({ at: performance.now(), contextTime: this.context.currentTime, duration: this.buffer?.duration });
        return value;
      };
      const originalAnimate = Element.prototype.animate;
      Element.prototype.animate = function (frames, options) {
        const animation = originalAnimate.call(this, frames, options);
        if (options?.id === 'tile-nudge') window.__polish.nudges.push({ at: performance.now(), tile: this.dataset.heroIndex });
        if (this.classList.contains('flying-tile')) window.__polish.animationStarts.push({ at: performance.now(), frames });
        return animation;
      };
      document.addEventListener('pointermove', event => window.__polish.pointerTypes.push(event.pointerType), { passive: true });
      let previous = '';
      function track() {
        // Playwright also installs this observer in the initial opaque about:blank.
        if (location.origin === 'null') { requestAnimationFrame(track); return; }
        const game = JSON.parse(localStorage.getItem('porcelain:session') || 'null');
        if (document.querySelector('.game-board') && game) {
          const value = { up: document.querySelectorAll('.game-tile[data-face-up="true"]').length, flight: document.querySelectorAll('.flying-tile').length, remaining: game.tiles.filter(tile => !tile.removed).length, score: game.score };
          const signature = JSON.stringify(value);
          if (signature !== previous) { window.__polish.changes.push({ at: performance.now(), ...value }); previous = signature; }
        }
        requestAnimationFrame(track);
      }
      requestAnimationFrame(track);
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const probe = () => page.evaluate(() => window.__polish);
    const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:session')));
    const tile = id => page.locator(`[data-tile-id="${id}"]`);
    async function points() {
      return page.locator('[data-hero-index]').evaluateAll(nodes => {
        const boxes = nodes.map(node => node.getBoundingClientRect());
        const left = Math.min(...boxes.map(box => box.left)), right = Math.max(...boxes.map(box => box.right));
        const top = Math.min(...boxes.map(box => box.top)), bottom = Math.max(...boxes.map(box => box.bottom));
        let best = null;
        for (let y = top + 10; y < bottom - 10; y += 3) {
          const hits = new Map();
          for (let x = left; x < right; x += 2) {
            const node = document.elementFromPoint(x, y)?.closest('[data-hero-index]');
            if (!node) continue;
            const index = Number(node.dataset.heroIndex);
            if (!hits.has(index)) hits.set(index, []);
            hits.get(index).push(x);
          }
          if (hits.size !== 5) continue;
          const width = Math.min(...[...hits.values()].map(xs => xs.length));
          if (!best || width > best.width) best = { width, points: [...hits].sort(([a], [b]) => a - b).map(([index, xs]) => ({ index, x: xs[Math.floor(xs.length / 2)], y })) };
        }
        return best?.points;
      });
    }
    async function reset() {
      await page.goto(origin);
      await page.evaluate(() => { localStorage.clear(); localStorage.setItem('porcelain:language', '"en"'); localStorage.setItem('porcelain:sound', 'true'); localStorage.setItem('porcelain:gentle', 'false'); });
      await page.reload(); await page.locator('[data-hero-index="4"]').waitFor(); await sleep(750);
    }
    async function fixture(reduced = false, mode = 'solo') {
      const game = engine.createGame('eastern', 8041);
      const value = { version: 3, ...game, mode, aiMemory: {}, elapsed: 10, score: 0, flips: 0, attempts: 0, hints: 0, shuffles: 0, ...(mode === 'duel' ? createDuelState() : {}) };
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await page.evaluate(saved => localStorage.setItem('porcelain:session', JSON.stringify(saved)), value);
      await page.reload(); await page.getByRole('button', { name: /^Continue your/ }).click();
      await page.locator('.game-board').waitFor(); await sleep(400);
      return game;
    }
    async function backToMenu() {
      await page.getByRole('button', { name: 'Pause game', exact: true }).click();
      await page.getByRole('button', { name: 'Save & return to menu' }).click();
      await page.getByRole('button', { name: 'Solo', exact: true }).waitFor();
    }
    try {
      await reset();
      await page.locator('h1').click(); // Real gesture unlocks audio without scheduling a sound.
      const mousePoints = await points(); assert.equal(mousePoints?.length, 5, 'all five cards expose a horizontal sweep path');
      let before = await probe();
      for (const point of mousePoints) { await page.mouse.move(point.x, point.y); await sleep(70); }
      let after = await probe();
      assert.equal(after.sounds.length - before.sounds.length, 5, 'mouse crossing plays one contact per tile');
      assert.equal(new Set(after.nudges.slice(before.nudges.length).map(event => event.tile)).size, 5);
      const end = mousePoints.at(-1), soundCount = after.sounds.length, nudgeCount = after.nudges.length;
      for (let i = 0; i < 12; i += 1) await page.mouse.move(end.x + (i % 2) * 0.5, end.y);
      assert.equal((await probe()).sounds.length, soundCount, 'same-tile movement does not spam sounds');
      assert.equal((await probe()).nudges.length, nudgeCount);
      await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
      before = await probe();
      for (const point of mousePoints) { await page.mouse.move(point.x, point.y); await sleep(50); }
      assert.equal((await probe()).sounds.length, before.sounds.length, 'muted sweeps are silent');
      await page.getByRole('button', { name: 'Enable sound', exact: true }).click(); await sleep(200);
      console.log(`PASS ${browserName}: five-card mouse sweep, distinct nudges, same-tile suppression, mute`);

      if (browserName === 'chromium') {
        await page.mouse.move(15, 15); await sleep(400);
        const touchPoints = await points(); const cdp = await context.newCDPSession(page); before = await probe();
        for (let i = 0; i < touchPoints.length; i += 1) {
          await cdp.send('Input.dispatchTouchEvent', { type: i === 0 ? 'touchStart' : 'touchMove', touchPoints: [{ x: touchPoints[i].x, y: touchPoints[i].y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
          await sleep(70);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        after = await probe();
        assert.equal(after.sounds.length - before.sounds.length, 5, 'native touch sweep hits five contacts');
        assert.ok(after.pointerTypes.slice(before.pointerTypes.length).includes('touch'));
        console.log('PASS chromium: native touch sweep across five cards');
      }

      await page.getByRole('button', { name: 'Duel', exact: true }).click(); await page.locator('.game-board').waitFor();
      assert.equal((await session()).mode, 'duel'); await backToMenu();
      await page.getByRole('button', { name: 'Solo', exact: true }).click(); await page.locator('.game-board').waitFor();
      assert.equal((await session()).mode, 'solo'); console.log(`PASS ${browserName}: direct Duel and Solo start buttons`);

      let game = await fixture(); const pair = engine.getAvailablePairs(game.tiles)[0].map(t => t.id);
      const third = game.tiles.find(t => engine.isFree(t, game.tiles) && !pair.includes(t.id));
      const thirdBox = await tile(third.id).boundingBox();
      const pauseBox = await page.getByRole('button', { name: 'Pause game', exact: true }).boundingBox();
      await tile(pair[0]).click(); await tile(pair[1]).click();
      await page.waitForFunction(() => document.querySelectorAll('.game-tile[data-face-up="true"]').length === 2);
      assert.equal((await session()).score, 0); assert.equal(engine.remainingCount((await session()).tiles), 80);
      await page.waitForFunction(() => document.querySelectorAll('.flying-tile').length === 2);
      assert.equal(engine.remainingCount((await session()).tiles), 80, `tiles persist during approach: ${JSON.stringify((await probe()).changes)}`);
      await page.mouse.click(thirdBox.x + thirdBox.width / 2, thirdBox.y + thirdBox.height / 2);
      await page.mouse.click(pauseBox.x + pauseBox.width / 2, pauseBox.y + pauseBox.height / 2);
      assert.equal((await session()).flips, 2, 'third input stays locked in flight');
      await page.waitForFunction(() => [...document.querySelectorAll('.flying-tile')].every(node => node.getAnimations().every(animation => animation.playState === 'paused')));
      const pausedAnimations = await page.locator('.flying-tile').evaluateAll(nodes => nodes.map(node => ({ transform: getComputedStyle(node).transform, time: node.getAnimations()[0].currentTime })));
      const pausedGame = await session(), pausedSoundCount = (await probe()).sounds.length;
      await sleep(450);
      const stillAnimations = await page.locator('.flying-tile').evaluateAll(nodes => nodes.map(node => ({ transform: getComputedStyle(node).transform, time: node.getAnimations()[0].currentTime })));
      assert.deepEqual(stillAnimations, pausedAnimations, 'flight animation freezes while paused');
      assert.equal((await session()).elapsed, pausedGame.elapsed); assert.equal((await session()).score, 0);
      assert.equal((await probe()).sounds.length, pausedSoundCount, 'no contact sound while paused before impact');
      await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('porcelain:session')).score === 100);
      assert.equal(engine.remainingCount((await session()).tiles), 78);
      assert.equal((await probe()).sounds.length, pausedSoundCount + 1, 'exactly one contact sound on resumed collision');
      await page.waitForFunction(() => !document.querySelector('.match-flight')); await sleep(500);
      assert.equal((await session()).score, 100, 'collision awards once');
      console.log(`PASS ${browserName}: matching flight, input lock, paused animation/timer/contact, single resumed award`);

      game = await fixture();
      const timedPair = engine.getAvailablePairs(game.tiles)[0].map(t => t.id);
      await tile(timedPair[0]).click(); await tile(timedPair[1]).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('porcelain:session')).score === 100);
      const changes = (await probe()).changes;
      const reveal = changes.find(change => change.up === 2 && change.flight === 0);
      const flight = changes.find(change => change.flight === 2);
      const removed = changes.find(change => change.remaining === 78);
      assert.ok(reveal && flight && removed);
      assert.ok(flight.at - reveal.at >= 390 && flight.at - reveal.at < 650, `450ms reveal observed: ${flight.at - reveal.at}`);
      assert.ok(removed.at - flight.at >= 180 && removed.at - flight.at < 340, `220ms approach observed: ${removed.at - flight.at}`);
      const collisionSounds = (await probe()).sounds.filter(sound => sound.at >= flight.at - 10);
      const flightStart = (await probe()).animationStarts[0].at;
      const removalWrite = (await probe()).sessionWrites.find(write => write.remaining === 78);
      assert.equal(collisionSounds.length, 1);
      const audioContactDelay = collisionSounds[0].at - flightStart;
      console.log(`TIMING ${browserName}: reveal ${Math.round(flight.at - reveal.at)}ms, flight/frame-removal ${Math.round(removed.at - flight.at)}ms, flight/audio ${Math.round(audioContactDelay)}ms, audio/state-write ${Math.round(removalWrite.at - collisionSounds[0].at)}ms`);
      assert.ok(Math.abs(audioContactDelay - 220) < 90, `sound follows 220ms tile-contact animation: ${audioContactDelay}`);
      assert.ok(Math.abs(collisionSounds[0].at - removalWrite.at) < 90, `removal state commits with collision sound: ${removalWrite.at - collisionSounds[0].at}`);
      console.log(`PASS ${browserName}: reveal/contact timing and synchronized sound/state`);

      game = await fixture(true); const reducedPair = engine.getAvailablePairs(game.tiles)[0].map(t => t.id);
      await tile(reducedPair[0]).click(); await tile(reducedPair[1]).click();
      await page.waitForFunction(() => document.querySelectorAll('.flying-tile').length === 2);
      await page.waitForFunction(() => window.__polish.animationStarts.length === 2);
      const reducedFrames = (await probe()).animationStarts;
      assert.equal(reducedFrames.length, 2);
      assert.ok(reducedFrames.every(event => event.frames.every(frame => !Object.hasOwn(frame, 'transform'))), 'reduced motion uses fading without travel');
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('porcelain:session')).score === 100);
      await backToMenu(); await sleep(600); await page.locator('h1').click();
      const reducedPoints = await points(); before = await probe();
      for (const point of reducedPoints) { await page.mouse.move(point.x, point.y); await sleep(60); }
      assert.equal((await probe()).nudges.length, before.nudges.length, 'reduced motion disables card nudges');
      game = await fixture(false, 'duel');
      const mutePair = engine.getAvailablePairs(game.tiles)[0].map(t => t.id);
      const muteBox = await page.getByRole('button', { name: 'Sound on', exact: true }).boundingBox();
      await tile(mutePair[0]).click(); await tile(mutePair[1]).click();
      await page.waitForFunction(() => document.querySelectorAll('.flying-tile').length === 2);
      const soundsBeforeMute = (await probe()).sounds.length;
      await page.mouse.click(muteBox.x + muteBox.width / 2, muteBox.y + muteBox.height / 2);
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('porcelain:session')).score === 100);
      assert.equal((await probe()).sounds.length, soundsBeforeMute, 'muting during flight silences pending collision');
      assert.deepEqual(errors, []);
      console.log(`PASS ${browserName}: reduced-motion collision/fan, mid-flight mute, no runtime errors`);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
