/* GAME_URL=http://<LAN-IP>:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/network-launch-check.cjs */
const assert = require('node:assert/strict');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.GAME_URL;
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

(async () => {
  assert.ok(url?.startsWith('http://'), 'Set GAME_URL to the plain HTTP LAN address');
  for (const browserName of ['chromium', 'webkit']) {
    const browser = await playwright[browserName].launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      const button = name => page.getByRole('button', { name, exact: typeof name === 'string' });
      const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:session')));
      async function home() {
        await button('Pause game').click();
        await button('Save & return home').click();
        await button('Play Duel').waitFor();
      }
      async function launch(name) {
        await button(name).click();
        await page.locator('.game-board').waitFor();
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('porcelain:session'))?.gameId);
        assert.equal(await page.locator('.game-tile').count(), 80);
        const saved = await state();
        assert.match(saved.gameId, uuidV4);
        return saved;
      }
      await page.goto(url);
      assert.deepEqual(await page.evaluate(() => ({ secure: isSecureContext, uuid: typeof crypto.randomUUID, random: typeof crypto.getRandomValues })),
        { secure: false, uuid: 'undefined', random: 'function' }, 'Exercise real HTTP restrictions, without mocking crypto');
      const first = await launch('Play Duel');
      await home();
      await page.reload();
      const resumed = await launch(/^Continue duel/);
      assert.equal(resumed.gameId, first.gameId, 'Reload keeps collection receipt identity');
      assert.deepEqual(resumed.tiles, first.tiles);
      await home();
      await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem('porcelain:session'));
        delete saved.gameId;
        localStorage.setItem('porcelain:session', JSON.stringify(saved));
      });
      await page.reload();
      const migrated = await launch(/^Continue duel/);
      assert.notEqual(migrated.gameId, first.gameId, 'Legacy saves get a valid ID on HTTP');
      assert.deepEqual(migrated.tiles, first.tiles);
      await home();
      const fresh = await launch('Play Duel');
      assert.notEqual(fresh.gameId, migrated.gameId, 'New rounds have separate collection identities');
      assert.deepEqual(errors, []);
      console.log(`PASS ${browserName}: LAN HTTP new Duel, reload/resume, legacy save and unique round IDs`);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
