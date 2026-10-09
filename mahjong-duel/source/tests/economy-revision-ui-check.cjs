/* Revision 2 payment/claim layouts. Run with PLAYWRIGHT_MODULE set to Playwright. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const load = file => import(pathToFileURL(path.resolve(file)).href);
(async () => {
  const { createProgression, reduceProgression } = await load('src/progression.js');
  const { getDailyQuestView } = await load('src/daily-quests.js');
  const { themeTileSets } = await load('src/tile-data.js');
  const { rarityForTile } = await load('src/rarity.js');
  const now = Date.parse('2026-10-03T12:00:00Z'), dayId = '2026-10-03';
  let fixture = reduceProgression(createProgression({ seed: 25 }), { type: 'login', now });
  for (const type of ['daily-presented', 'quests-presented']) fixture = reduceProgression(fixture, { type, now, dayId });
  fixture.currencies = { coins: 30000, gems: 100 };
  const quests = getDailyQuestView(fixture, now).quests;
  fixture.quests.entries = fixture.quests.entries.map(entry => ({ ...entry, progress: quests.find(q => q.id === entry.id).target }));
  const marble = themeTileSets['ming-porcelain'].eastern.find(tile => rarityForTile('ming-porcelain', 'eastern', tile.id).id === 'marble');
  fixture.collection.counts[marble.matchKey] = 2;
  const output = path.resolve('tmp/economy-revision-ui'); fs.mkdirSync(output, { recursive: true });
  for (const browserName of ['chromium', 'webkit']) {
    const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch();
    try {
      for (const [width, height] of [[320,568], [390,844], [768,1024], [1024,768]]) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
        await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date(now) });
        await page.clock.pauseAt(new Date(now));
        await context.addInitScript(state => {
          if (localStorage.getItem('revision-fixture')) return;
          localStorage.setItem('porcelain:progression', JSON.stringify(state));
          localStorage.setItem('porcelain:gentle', 'true');
          localStorage.setItem('porcelain:sound', 'false');
          localStorage.setItem('revision-fixture', 'true');
        }, fixture);
        const tick = () => page.clock.runFor(500);
        const button = name => page.getByRole('button', { name, exact: true });
        const tap = async node => { await node.click({ force: true }); await tick(); };
        const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:progression')));
        const check = async name => {
          const overflow = await page.evaluate(() => {
            const root = document.querySelector('.progression-page');
            const nodes = [...document.querySelectorAll('.shop-payment-options button,.daily-quest-claim-options button')];
            return { width: innerWidth, pageWidth: root?.scrollWidth || document.documentElement.scrollWidth,
              bad: nodes.filter(n => { const r = n.getBoundingClientRect(); return r.width < 43 || r.height < 43 || r.left < -1 || r.right > innerWidth + 1; }).map(n => n.textContent) };
          });
          assert.ok(overflow.pageWidth <= width + 1, `${name}: horizontal overflow ${JSON.stringify(overflow)}`);
          assert.deepEqual(overflow.bad, [], `${name}: payment touch targets`);
          await page.screenshot({ path: path.join(output, `${browserName}-${width}-${name}.png`), animations: 'disabled' });
        };
        await page.goto(process.env.GAME_URL || 'http://localhost:5173'); await tick();
        await page.getByRole('heading', { name: 'Your starter boosters' }).waitFor();
        await check('starter'); await tap(button('Got it'));
        await tap(button('Shop')); await check('shop');
        const coins = page.locator('[data-shop-product="eagle-single"][data-shop-payment="coins"]');
        await coins.scrollIntoViewIfNeeded(); await check('payments'); await tap(coins);
        assert.match(await page.locator('.shop-confirmation-price').innerText(), /800/);
        await tap(button('Confirm purchase'));
        assert.deepEqual((await state()).currencies, { coins: 29200, gems: 100 });
        await tap(button('Back to main menu')); await tap(page.locator('.quests-menu-control'));
        await check('quests');
        await tap(page.locator('.daily-quest-claim-options').first().getByRole('button', { name: /Claim 2×/ }));
        const first = quests[0];
        assert.deepEqual((await state()).currencies, { coins: 29200 + 2 * first.reward.coins, gems: 100 + 2 * first.reward.gems });
        assert.equal(await page.locator('.daily-quest-card').first().getByRole('button').count(), 0);
        await tap(button('Back to main menu')); await tap(button('Collection'));
        await check('collection');
        assert.match(await page.locator('.collection-unlock-goal').innerText(), /14.*Marble.*7.*Sapphire/s);
        assert.equal(await page.locator(`[data-match-key="${marble.matchKey}"] .collection-copy-goal`).innerText(), '2 / 3 for unlock');
        await tap(button('Back to main menu')); await page.reload(); await tick();
        assert.equal(await page.getByRole('heading', { name: 'Your starter boosters' }).count(), 0);
        assert.deepEqual(errors, []);
        await context.close();
        console.log(`PASS ${browserName} ${width}×${height}: starter, both prices, Coin purchase, quest2×, Collection progress, reload`);
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
