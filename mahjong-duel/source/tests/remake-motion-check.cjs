// Focused real-browser regression: the 900ms chip tail must not replay completed
// 340ms tiles when a match is paused. No timers or animation clocks are replaced.
// GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/remake-motion-check.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const root = path.resolve(__dirname, '..');

(async () => {
  const engine = await import(pathToFileURL(path.join(root, 'src/engine.js')));
  const deal = engine.createGame('western', 471, 'calm', 'ming-porcelain');
  const pair = engine.getAvailablePairs(deal.tiles)[0].map(tile => tile.id);
  const fixture = {
    version: 3, ...deal, theme: 'ming-porcelain', boardTheme: 'ming-porcelain',
    ruleset: 'western', mode: 'duel', duelVersion: 1, turn: 'you',
    score: 0, aiScore: 0, attempts: 0, aiAttempts: 0, aiMemory: {},
    elapsed: 15, hints: 0, shuffles: 0, flips: 0,
  };
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    for (const reduced of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
      await context.addInitScript(() => {
        window.__audioStarts = 0;
        for (const Type of [window.AudioBufferSourceNode, window.OscillatorNode]) {
          if (!Type) continue;
          const start = Type.prototype.start;
          Type.prototype.start = function (...args) { window.__audioStarts++; return start.apply(this, args); };
        }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin);
      await page.evaluate(value => {
        localStorage.setItem('porcelain:session', JSON.stringify(value));
        localStorage.setItem('porcelain:sound', 'false');
        localStorage.setItem('porcelain:gentle', 'false');
      }, fixture);
      await page.reload();
      await page.getByRole('button', { name: /Continue duel/ }).click();
      await page.waitForFunction(() => !document.querySelector('.door-transition'));
      await page.locator('.game-board').waitFor();
      for (const id of pair) await page.locator(`[data-tile-id="${id}"]`).click();
      await page.locator('.match-flight').waitFor();

      if (reduced) {
        assert.equal(await page.locator('.ceramic-chip').count(), 0, 'reduced motion omits ceramic debris');
        assert.equal(await page.locator('.flying-tile').count(), 2, 'reduced motion retains pair feedback');
        const transforms = await page.locator('.flying-tile').evaluateAll(nodes => nodes.map(node => node.getAnimations()[0].effect.getKeyframes().some(frame => Object.hasOwn(frame, 'transform'))));
        assert.deepEqual(transforms, [false, false], 'reduced motion only fades the pair');
      } else {
        assert.equal(await page.locator('.ceramic-chip').count(), 18);
        await page.waitForFunction(() => document.querySelector('.ceramic-chip')?.getAnimations()[0]?.currentTime > 520);
        await page.getByRole('button', { name: 'Pause game', exact: true }).click();
        const snapshot = () => page.evaluate(() => [...document.querySelectorAll('.flying-tile, .ceramic-chip')].slice(0, 3).map(node => {
          const animation = node.getAnimations()[0];
          return { opacity: Number(getComputedStyle(node).opacity), time: animation.currentTime, end: animation.effect.getComputedTiming().endTime, state: animation.playState };
        }));
        const paused = await snapshot();
        assert.equal(paused.length, 3);
        for (const tile of paused.slice(0, 2)) {
          assert.equal(tile.time, tile.end, 'tiles finished before pausing the longer chip tail');
          assert.equal(tile.opacity, 0);
        }
        assert.equal(paused[2].state, 'paused');
        await page.waitForTimeout(150);
        assert.deepEqual(await snapshot(), paused, 'all visual clocks freeze while paused');
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.waitForTimeout(35);
        const resumed = await snapshot();
        for (const tile of resumed.slice(0, 2)) {
          assert.equal(tile.time, tile.end, 'resume must not rewind a completed tile');
          assert.equal(tile.opacity, 0, 'removed tiles never reappear on resume');
          assert.equal(tile.state, 'finished');
        }
        assert.ok(resumed[2].time > paused[2].time, 'unfinished debris continues');
      }

      await page.waitForFunction(() => !document.querySelector('.match-flight'));
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:session')));
      assert.equal(saved.score, 100, 'the pair scores exactly once');
      assert.equal(saved.attempts, 1);
      assert.equal(engine.remainingCount(saved.tiles), 78);
      assert.equal(await page.evaluate(() => window.__audioStarts), 0, 'muted play creates no audible sources');
      console.log(`PASS ${reduced ? 'reduced motion: no debris, fading pair' : 'normal motion: 18 chips, late pause/resume without tile replay'}; one score; muted audio`);
      await context.close();
    }
    assert.deepEqual(errors, [], 'no browser runtime errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
