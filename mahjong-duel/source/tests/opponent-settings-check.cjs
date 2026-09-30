/* Exercise opponent settings and actual duel turns without production test hooks.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/opponent-settings-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const output = path.resolve('tmp/original-ai');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch();
  const reports = [];
  try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 1024 }]) {
      const label = `${browserName}-${viewport.width}x${viewport.height}`;
      const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      await context.addInitScript(() => {
        // Only presentation preferences are seeded; opponent choice and duel state use the UI.
        localStorage.setItem('porcelain:gentle', 'true');
        localStorage.setItem('porcelain:sound', 'false');
      });
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
      const time = new Date('2026-09-29T12:00:00Z');
      await page.clock.install({ time });
      await page.clock.pauseAt(time);
      const advance = async (ms = 200) => { await page.clock.runFor(ms); await page.evaluate(() => document.body.childElementCount); };
      const button = name => page.getByRole('button', { name, exact: true });
      async function tap(name) {
        const control = button(name);
        await control.waitFor();
        await control.scrollIntoViewIfNeeded();
        const rect = await control.boundingBox();
        assert.ok(rect, `${label}: ${name} is visible`);
        await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
        await advance(400);
      }
      async function checkSettings(selected, current) {
        await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
        for (const name of ['Modern AI', 'Original AI']) {
          assert.equal(await button(name).getAttribute('aria-pressed'), String(name === selected));
          const rect = await button(name).boundingBox();
          assert.ok(rect.width >= 44 && rect.height >= 44, `${label}: ${name} has a 44px touch target (${rect.width}×${rect.height})`);
        }
        const overflow = await page.evaluate(() => {
          // The dialog's decorative tassel intentionally extends beyond its panel.
          const nodes = [document.documentElement, document.querySelector('.parchment-body'), document.querySelector('.settings-content')];
          return nodes.filter(Boolean).map(node => ({ className: node.className, excess: node.scrollWidth - node.clientWidth }));
        });
        assert.ok(overflow.every(node => node.excess <= 1), `${label}: settings has no horizontal overflow: ${JSON.stringify(overflow)}`);
        if (current) assert.match(await page.locator('.settings-content').textContent(), new RegExp(`Applies to your next duel\\. Playing now: ${current}\\.`));
      }
      async function tapTile(id) {
        const point = await page.locator(`[data-tile-id="${id}"]`).evaluate(node => {
          const rect = node.getBoundingClientRect();
          for (const fy of [.5, .9, .1]) for (const fx of [.5, .9, .1]) {
            const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
            if (document.elementFromPoint(x, y)?.closest('[data-tile-id]') === node) return { x, y };
          }
        });
        assert.ok(point, `${label}: tile ${id} is physically tappable`);
        await page.mouse.click(point.x, point.y);
      }
      const snapshot = () => page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.game-tile')];
        return {
          turn: document.querySelector('.duel-scoreboard')?.dataset.turn,
          free: nodes.filter(node => node.dataset.free === 'true' && node.getAttribute('aria-disabled') === 'false').map(node => ({ id: node.dataset.tileId, face: node.querySelector('.tile-front img').src })),
          shown: nodes.filter(node => node.dataset.faceUp === 'true').map(node => node.dataset.tileId),
        };
      });
      async function playAttempts(mode) {
        let playerAttempts = 0, ghostRevealed = false, settled = false;
        for (let tick = 0; tick < 500; tick++) {
          const view = await snapshot();
          if (view.turn === 'ai' && view.shown.length) ghostRevealed = true;
          if (view.turn === 'you' && view.free.length >= 2 && !view.shown.length) {
            if (playerAttempts >= 3 && ghostRevealed) { settled = true; break; }
            // Deliberately miss via ordinary clicks so each real opponent gets control.
            const first = view.free[0], second = view.free.find(tile => tile.face !== first.face);
            assert.ok(second, `${label}: a legal mismatch is available`);
            await tapTile(first.id); await tapTile(second.id); playerAttempts++;
          }
          await advance();
        }
        assert.ok(settled, `${label}: ${mode} returns control after actual reveals`);
        return { mode, playerAttempts, ghostRevealed };
      }
      try {
        await page.goto(origin);
        await page.getByRole('heading', { name: 'Daily Rewards', exact: true }).waitFor();
        await advance(400); await tap('Claim rewards');
        await page.getByRole('heading', { name: 'Daily Quests', exact: true }).waitFor();
        await tap('Back to main menu');
        await tap('Settings'); await checkSettings('Modern AI');
        await tap('Original AI'); await checkSettings('Original AI');
        await page.screenshot({ path: path.join(output, `${label}-settings.png`), animations: 'disabled' });
        await tap('Done');
        await page.reload(); await advance(400);
        await tap('Settings'); await checkSettings('Original AI');
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:aiMode'))), 'original');
        await tap('Done'); await tap('Play Duel');
        await page.getByRole('heading', { name: 'Choose a theme', exact: true }).waitFor();
        await tap('Play Duel');
        await advance(4000); await advance(1500);
        await page.locator('.game-board').waitFor(); await advance(1000);
        const moves = [await playAttempts('Original AI')];
        await tap('Pause game'); await tap('Settings');
        await checkSettings('Original AI', 'Original AI');
        await tap('Modern AI'); await checkSettings('Modern AI', 'Original AI');
        await tap('Rules');
        const originalRules = await page.locator('.rules-content').textContent();
        assert.match(originalRules, /Original AI/); assert.match(originalRules, /40%/); assert.match(originalRules, /35%/); assert.match(originalRules, /25%/);
        assert.doesNotMatch(originalRules, /Modern AI/);
        await tap('Got it'); await checkSettings('Modern AI', 'Original AI');
        await tap('Done'); await tap('New duel'); await tap('Choose a theme');
        await page.getByRole('heading', { name: 'Choose a theme', exact: true }).waitFor();
        await tap('Play Duel');
        await advance(4000); await advance(1500);
        await page.locator('.game-board').waitFor(); await advance(1000);
        moves.push(await playAttempts('Modern AI'));
        await tap('Pause game'); await tap('Settings');
        await checkSettings('Modern AI', 'Modern AI');
        await tap('Rules');
        assert.match(await page.locator('.rules-content').textContent(), /Modern AI.*last two completed pair attempts/s);
        assert.doesNotMatch(await page.locator('.rules-content').textContent(), /Original AI/);
        assert.deepEqual(errors, []);
        reports.push({ label, moves, errors });
        console.log(`PASS ${label}: settings, persistence, next-duel isolation, Rules, both opponents play`);
      } catch (error) {
        await page.screenshot({ path: path.join(output, `${label}-failure.png`), animations: 'disabled' }).catch(() => {});
        throw error;
      } finally { await context.close(); }
    }
    fs.writeFileSync(path.join(output, `${browserName}-report.json`), JSON.stringify(reports, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
