/* Full browser economy flow with real UI actions and one complete duel.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/economy-flow-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const output = path.resolve('tmp/economy-qa');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const { getDailyQuestView } = await import(pathToFileURL(path.resolve('src/daily-quests.js')).href);
  const { createProgression } = await import(pathToFileURL(path.resolve('src/progression.js')).href);
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  // A fixed empty player seed makes quest selection repeatable; all rewards are earned through UI actions.
  await context.addInitScript(initial => {
    if (!localStorage.getItem('economy-check-seeded')) {
      localStorage.setItem('porcelain:gentle', 'true');
      localStorage.setItem('porcelain:sound', 'false');
      localStorage.setItem('porcelain:progression', JSON.stringify(initial));
      localStorage.setItem('economy-check-seeded', 'true');
    }
  }, createProgression({ seed: 25 }));
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  const time = new Date('2026-10-03T12:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(time);
  const advance = async (ms = 400) => { await page.clock.runFor(ms); await page.evaluate(() => document.body.childElementCount); };
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:progression')));
  const heading = name => page.getByRole('heading', { name, exact: true });
  const button = name => page.getByRole('button', { name, exact: true });
  const tap = async target => {
    const node = typeof target === 'string' ? button(target) : target;
    await node.waitFor(); await node.scrollIntoViewIfNeeded();
    const box = await node.boundingBox(); assert.ok(box, 'Control visible');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await advance();
  };
  async function tapTile(id) {
    const point = await page.locator(`[data-tile-id="${id}"]`).evaluate(node => {
      const r = node.getBoundingClientRect();
      for (const fy of [.5,.9,.1]) for (const fx of [.5,.9,.1]) {
        const x = r.x + r.width * fx, y = r.y + r.height * fy;
        if (document.elementFromPoint(x,y)?.closest('[data-tile-id]') === node) return { x,y };
      }
    });
    assert.ok(point, `Tile ${id} tappable`); await page.mouse.click(point.x,point.y);
  }
  try {
    await page.goto(origin);
    await heading('Daily Rewards').waitFor(); await advance();
    await tap('Claim rewards'); await heading('Daily Quests').waitFor();
    let state = await stored();
    assert.deepEqual(state.currencies, { coins: 0, gems: 0 });
    let view = getDailyQuestView(state, time.getTime());
    assert.equal(view.quests.length, 3);
    assert.ok(view.quests.some(q => q.difficulty === 'easy'));
    assert.ok(view.quests.some(q => q.difficulty === 'medium'));
    const replaced = view.quests[0];
    await tap(`Replace ${replaced.title}`); await tap('Keep quest');
    assert.equal((await stored()).quests.rerollsUsed, 0);
    await tap(`Replace ${replaced.title}`); await tap('Replace for free');
    state = await stored(); view = getDailyQuestView(state, time.getTime());
    assert.equal(view.rerollsLeft, 0);
    assert.notEqual(view.quests[0].difficulty, replaced.difficulty);
    assert.ok(!view.quests.some(q => q.id === replaced.id));
    await advance(3000); assert.equal(await heading('Daily Quests').count(), 1, 'Quests stay open');
    await page.screenshot({ path: path.join(output, `${browserName}-quests.jpg`), animations: 'disabled' });
    await tap('Back to main menu'); await advance();
    await heading('Your starter boosters').waitFor(); await tap('Got it');
    await page.reload(); await advance();
    await button('Play Duel').waitFor();
    assert.equal(await heading('Daily Quests').count(), 0, 'Daily auto presentation occurs once');
    assert.equal(getDailyQuestView(await stored(), time.getTime()).rerollsLeft, 0);
    await tap('Shop'); await heading('Shop').waitFor();
    assert.equal(await page.locator('[data-shop-product="hint-single"][data-shop-payment="primary"]').isDisabled(), true);
    await tap(page.locator('[data-shop-product="jade-chest"]')); await tap('Cancel');
    assert.deepEqual((await stored()).currencies, { coins: 0, gems: 0 });
    await tap(page.locator('[data-shop-product="jade-chest"]')); await tap('Test purchase');
    await heading('Shop').waitFor(); state = await stored();
    assert.deepEqual(state.currencies, { coins: 2000, gems: 90 });
    assert.equal(Object.keys(state.purchaseReceipts).length, 1);
    const beforeBoosters = state.wallet;
    await tap(page.locator('[data-shop-product="duel-kit"][data-shop-payment="primary"]')); await tap('Confirm purchase');
    state = await stored(); assert.deepEqual(state.currencies, { coins: 800, gems: 50 });
    for (const kind of ['hint','shuffle','freeze','eagle']) assert.equal(state.wallet[kind], beforeBoosters[kind] + 3);
    await page.screenshot({ path: path.join(output, `${browserName}-shop.jpg`), animations: 'disabled' });
    await tap('Back to main menu'); await page.reload(); await advance();
    assert.deepEqual((await stored()).currencies, { coins: 800, gems: 50 });
    await tap('Play Duel'); await heading('Choose a theme').waitFor(); await tap('Play Duel');
    await advance(4000); await advance(1500);
    await page.locator('.game-board').waitFor(); await advance(1500);
    for (let matched = 0; matched < 30; matched++) {
      let pair;
      for (let retry = 0; retry < 20 && !pair; retry++) {
        pair = await page.locator('.game-tile[data-free="true"][aria-disabled="false"]').evaluateAll(nodes => {
          for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
            if (nodes[i].querySelector('.tile-front img').src === nodes[j].querySelector('.tile-front img').src) return [nodes[i].dataset.tileId, nodes[j].dataset.tileId];
          }
          return null;
        });
        if (!pair) await advance(300);
      }
      assert.ok(pair, `Match ${matched + 1} available`);
      await tapTile(pair[0]); await tapTile(pair[1]);
      for (let retry = 0; retry < 20 && await page.locator('.game-tile').count() > 60 - 2 * (matched + 1); retry++) await advance(200);
      assert.equal(await page.locator('.game-tile').count(), 60 - 2 * (matched + 1));
      if (matched === 15) assert.equal((await stored()).currencies.coins, 800, 'No reward before full board cleared');
    }
    for (let retry = 0; retry < 30 && !await heading('Victory!').count(); retry++) await advance(1000);
    await heading('Victory!').waitFor();
    assert.match(await page.locator('.result-currency-reward').textContent(), /\+100 Coins/);
    assert.ok(await page.locator('.collection-progress-summary').isVisible());
    state = await stored(); assert.deepEqual(state.currencies, { coins: 900, gems: 50 });
    assert.equal(state.counters.completedDuels, 1);
    await tap('Continue'); await heading('Leaderboards').waitFor(); await advance(4000);
    await tap('Back to main menu'); await tap(page.locator('.quests-menu-control'));
    await heading('Daily Quests').waitFor();
    state = await stored(); view = getDailyQuestView(state, time.getTime());
    const completed = view.quests.filter(q => q.completed && !q.claimed);
    assert.ok(completed.length >= 1, 'Full win completes at least one quest');
    const expected = completed.reduce((sum,q) => ({ coins: sum.coins + q.reward.coins * (q === completed[0] ? 2 : 1), gems: sum.gems + q.reward.gems * (q === completed[0] ? 2 : 1) }), { coins: 900, gems: 50 });
    for (const q of completed) await tap(page.getByRole('article', { name: `${q.title}, ${q.difficulty[0].toUpperCase() + q.difficulty.slice(1)} quest`, exact: true }).getByRole('button', { name: q === completed[0] ? /Claim 2×/ : 'Claim', exact: q !== completed[0] }));
    assert.deepEqual((await stored()).currencies, expected);
    assert.equal(await heading('Daily Quests').count(), 1, 'Claims do not close quests');
    assert.equal(await button('Claim').count(), 0);
    await tap('Back to main menu'); await page.reload(); await advance(); await button('Play Duel').waitFor();
    assert.deepEqual((await stored()).currencies, expected, 'Reload does not duplicate any reward');
    await page.clock.fastForward(24 * 60 * 60 * 1000); await page.reload(); await advance();
    await heading('Daily Rewards').waitFor(); await tap('Close daily welcome'); await heading('Daily Quests').waitFor();
    view = getDailyQuestView(await stored(), time.getTime() + 86400000);
    assert.equal(view.dayId, '2026-10-04'); assert.equal(view.rerollsLeft, 1);
    assert.ok(view.quests.every(q => q.progress === 0 && !q.claimed));
    assert.deepEqual((await stored()).currencies, expected, 'Balances survive daily reset');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, `${browserName}-flow-report.json`), JSON.stringify({ browserName, quests: completed.map(q => q.id), currencies: expected, errors }, null, 2));
    console.log(`PASS ${browserName}: daily flow, reroll, simulated purchase, booster spending, 30-pair victory, quest claims, persistence and midnight reset`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${browserName}-failure.jpg`), animations: 'disabled' }).catch(() => {}); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
