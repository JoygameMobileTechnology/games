/* Live pointer actions prove that newly earned achievements reach the top banner
 * once, preserve their queue through pause, and do not replay after a reload.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/achievement-flow-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';

(async () => {
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('achievement-flow-started')) {
      localStorage.clear();
      localStorage.setItem('porcelain:gentle', 'true');
      localStorage.setItem('porcelain:sound', 'false');
      sessionStorage.setItem('achievement-flow-started', 'true');
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [], output = path.resolve('tmp/achievement-flow-qa');
  fs.mkdirSync(output, { recursive: true });
  page.on('pageerror', error => errors.push(error.message));
  const button = name => page.getByRole('button', { name, exact: true });
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:progression')));
  const capture = name => page.screenshot({ path: path.join(output, `${browserName}-${name}.png`) });
  async function matchPair(remaining) {
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll('.game-tile[data-free="true"][aria-disabled="false"]')];
      return tiles.some((a, index) => tiles.slice(index + 1).some(b => a.querySelector('.tile-front img').src === b.querySelector('.tile-front img').src));
    });
    const pair = await page.locator('.game-tile[data-free="true"][aria-disabled="false"]').evaluateAll(tiles => {
      for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
        if (tiles[i].querySelector('.tile-front img').src === tiles[j].querySelector('.tile-front img').src) return [tiles[i].dataset.tileId, tiles[j].dataset.tileId];
      }
    });
    for (const id of pair) {
      const point = await page.locator(`[data-tile-id="${id}"]`).evaluate(node => {
        const r = node.getBoundingClientRect();
        for (const fy of [.5, .9, .1]) for (const fx of [.5, .9, .1]) {
          const x = r.x + r.width * fx, y = r.y + r.height * fy;
          if (document.elementFromPoint(x, y)?.closest('[data-tile-id]') === node) return { x, y };
        }
      });
      assert.ok(point, 'Celebrations leave legal tiles clickable');
      await page.mouse.click(point.x, point.y);
    }
    await page.waitForFunction(count => document.querySelectorAll('.game-tile').length === count, remaining);
  }
  try {
    await page.goto(origin);
    await button('Back to main menu').click();
    await button('Play Duel').click();
    await page.locator('.game-tile').first().waitFor();
    const before = await page.locator('.game-board').boundingBox();
    await matchPair(58);
    await page.locator('.achievement-toast-stage').waitFor();
    const firstId = await page.locator('.achievement-toast-stage').getAttribute('data-achievement-batch');
    assert.ok(firstId.split(':').includes('A062'), 'First discovery is actually earned and announced');
    assert.ok((await stored()).unlocked.A062);
    await matchPair(56);
    await page.locator('[data-streak-id="chain_02"]').waitFor();
    const after = await page.locator('.game-board').boundingBox();
    assert.ok(Math.abs(before.width - after.width) < 1 && Math.abs(before.height - after.height) < 1, 'Large streak keeps the board size');
    const notification = await page.locator('.achievement-toast').boundingBox();
    const streak = await page.locator('.streak-feedback').boundingBox();
    assert.ok(notification.y >= 0 && notification.y < 50 && notification.height <= 72, 'Achievement is a compact top banner');
    assert.ok(notification.y + notification.height <= streak.y + 2, 'Achievement and streak occupy separate areas');
    assert.equal(await page.locator('.achievement-toast-stage').evaluate(node => getComputedStyle(node).pointerEvents), 'none');
    await capture('unlock-and-streak');
    await button('Pause game').click();
    await page.waitForTimeout(4700);
    assert.equal(await page.locator('.achievement-toast-stage').getAttribute('data-achievement-batch'), firstId, 'Pause does not consume or skip a queued unlock');
    assert.equal(await page.locator('.achievement-toast-stage').isVisible(), false);
    await button('Continue').click();
    await page.locator('.achievement-toast-stage').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.achievement-toast-stage')?.dataset.achievementBatch.split(':').includes('M013'));
    await capture('queued-chain-achievement');
    const saved = await stored();
    assert.ok(saved.unlocked.M013);
    await page.reload();
    await button('Play Duel').waitFor();
    assert.equal(await page.locator('.achievement-toast-stage').count(), 0, 'Stored achievements never replay on reload');
    assert.deepEqual((await stored()).unlocked, saved.unlocked);
    assert.deepEqual(errors, []);
    console.log(`PASS ${browserName}: real unlocks, large streak, untouched board, pause-aware queue and no reload replay`);
  } catch (error) {
    await capture('failure').catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
