/* Browser regression for formations, boosters and the local tile binder.
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/progression-check.cjs [--webkit]
 * Only supported local save data is seeded. All actions use real buttons/tile hit targets.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const engine = await import(pathToFileURL(path.join(root, 'src/engine.js')));
  const { createDuelState } = await import(pathToFileURL(path.join(root, 'src/duel.js')));
  const { GHOST_MEMORY_VERSION } = await import(pathToFileURL(path.join(root, 'src/ghost.js')));
  const { themes } = await import(pathToFileURL(path.join(root, 'src/themes.js')));
  const { RARITIES } = await import(pathToFileURL(path.join(root, 'src/rarity.js')));
  const { FORMATION_IDS } = await import(pathToFileURL(path.join(root, 'src/formations.js')));
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await playwright[browserName].launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' });
  const booster = name => button(new RegExp(`^${name}, \\d uses left$`));
  const stone = id => page.locator(`.game-board [data-tile-id="${id}"]`);
  const stored = key => page.evaluate(key => JSON.parse(localStorage.getItem(`porcelain:${key}`)), key);
  const session = () => stored('session');
  const remaining = game => engine.remainingCount(game.tiles);
  const report = label => { checks.push(label); console.log(`PASS ${browserName}: ${label}`); };

  function smallDeal(ruleset = 'eastern', number = 4) {
    const game = engine.createGame(ruleset, 90421, 'calm', 'ming-porcelain', { formationId: 'crown' });
    const groups = new Map();
    for (const tile of game.tiles) {
      if (!groups.has(tile.matchKey)) groups.set(tile.matchKey, []);
      groups.get(tile.matchKey).push(tile);
    }
    const pairs = [...groups.values()].slice(0, number).map(group => group.slice(0, 2).map(tile => tile.id));
    const positions = Object.fromEntries(pairs.flatMap((pair, row) => pair.map((id, column) => [id, { x: column * 5, y: row, z: 0 }])));
    return { ...game, pairs, tiles: game.tiles.map(tile => ({ ...tile, removed: !positions[tile.id], ...positions[tile.id] })) };
  }
  function save(game, extra = {}) {
    const cleared = (80 - remaining(game)) / 2;
    return { version: 3, ...game, mode: 'duel', gameId: `progression-${browserName}-${game.ruleset}`,
      ...createDuelState(), elapsed: 12, hints: 0, shuffles: 0, flips: 0,
      score: Math.floor(cleared / 2) * 100, aiScore: Math.ceil(cleared / 2) * 100,
      aiMemory: {}, ghostMemoryVersion: GHOST_MEMORY_VERSION, duelView: { revealed: [], pending: null },
      boosters: { shuffle: 3, hint: 3, freeze: 3, eagle: 3 }, freezeReady: false, hintEffect: null, eagleMs: 0, ...extra };
  }
  async function waitState(predicate, label, timeout = 12000) {
    const deadline = Date.now() + timeout;
    let value;
    while (Date.now() < deadline) {
      value = await session();
      if (value && predicate(value)) return value;
      await sleep(30);
    }
    throw new Error(`Timed out: ${label}; ${JSON.stringify(value && { turn: value.turn, score: value.score, aiScore: value.aiScore, remaining: remaining(value), attempts: value.attempts, aiAttempts: value.aiAttempts, pending: value.duelView?.pending, boosters: value.boosters })}`);
  }
  async function reset() {
    await page.goto(origin);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('porcelain:sound', 'false'); localStorage.setItem('porcelain:gentle', 'true'); });
    await page.reload(); await button('Play Duel').waitFor();
  }
  async function fixture(game, extra = {}, beforeContinue) {
    const value = save(game, extra);
    assert.ok(engine.isCurrentCatalogueDeal(value), 'fixture preserves the full current four-copy catalogue');
    await page.goto(origin);
    await page.evaluate(value => {
      localStorage.setItem('porcelain:session', JSON.stringify(value));
      localStorage.setItem('porcelain:sound', 'false'); localStorage.setItem('porcelain:gentle', 'true');
    }, value);
    await page.reload();
    if (beforeContinue) await beforeContinue();
    await button(/^Continue duel/).click(); await page.locator('.game-board').waitFor();
    return value;
  }
  async function tap(id) {
    const point = await stone(id).evaluate(node => {
      const rect = node.getBoundingClientRect();
      for (const fy of [.5, .92, .08]) for (const fx of [.5, .92, .08]) {
        const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
        if (document.elementFromPoint(x, y)?.closest('[data-tile-id]') === node) return { x, y };
      }
      return null;
    });
    assert.ok(point, `stone ${id} has an exposed pointer target`);
    await page.mouse.click(point.x, point.y);
  }
  async function attempt(ids, number) {
    await tap(ids[0]); await tap(ids[1]);
    return waitState(value => value.attempts === number && !value.duelView?.pending, 'human attempt completes');
  }
  async function pause() { await button('Pause game').click(); await page.getByRole('dialog', { name: 'Paused', exact: true }).waitFor(); await sleep(100); }
  async function home() { await pause(); await button('Save & return home').click(); await button('Play Duel').waitFor(); }
  const totalCollection = collection => Object.values(collection?.counts || {}).reduce((sum, count) => sum + count, 0);

  try {
    await reset(); await button('Play Duel').click(); await page.locator('.game-board').waitFor();
    let state = await waitState(value => value.boosters, 'fresh duel');
    assert.equal(remaining(state), 80); assert.ok(state.gameId);
    assert.equal(await page.locator('.game-tile').count(), 80);
    assert.equal(await page.locator('.game-tile[data-face-up="true"]').count(), 0);
    assert.equal(await page.locator('.game-header button').count(), 1);
    assert.equal(await page.locator('.game-clock').count(), 0);
    assert.equal(await button('Rules').count(), 0);
    assert.equal(await page.locator('.game-tools button').count(), 4);
    assert.deepEqual(state.boosters, { shuffle: 3, hint: 3, freeze: 3, eagle: 3 });
    for (const name of ['Shuffle', 'Hint', 'Freeze', 'Eagle Eye']) assert.equal(await booster(name).isEnabled(), true);
    report('fresh 80-tile face-down duel, one pause control and four three-use boosters');

    const beforeMemory = state.aiMemory;
    await booster('Hint').click();
    state = await waitState(value => value.hintEffect, 'hint starts');
    assert.equal(state.boosters.hint, 2);
    const hinted = state.hintEffect.ids;
    assert.equal(hinted.length, 2);
    assert.ok(engine.canMatch(...hinted.map(id => state.tiles.find(tile => tile.id === id))));
    assert.ok(hinted.every(id => engine.isFree(state.tiles.find(tile => tile.id === id), state.tiles)));
    assert.equal(await page.locator('.game-tile.hinted').count(), 2);
    assert.equal(await page.locator('.game-tile[data-face-up="true"]').count(), 0);
    assert.deepEqual(state.aiMemory, beforeMemory);
    await sleep(900); assert.equal(await page.locator('.game-tile.hinted').count(), 2, 'hint lasts beyond the first instant');
    await waitState(value => !value.hintEffect, 'hint expires', 2200);
    assert.equal(await page.locator('.game-tile.hinted').count(), 0);
    assert.deepEqual((await session()).aiMemory, beforeMemory, 'a hint does not teach the ghost');
    report('Hint marks a legal pair for 1.5 seconds without revealing or teaching it');

    await booster('Eagle Eye').click();
    state = await waitState(value => value.eagleMs > 0, 'Eagle Eye starts');
    assert.equal(state.boosters.eagle, 2);
    assert.equal(await page.locator('.game-tile.eagle-lit[data-face-up="false"]').count(), 80, 'covered stones also get rarity glow');
    assert.equal(await page.locator('.game-tile[data-rarity-visible="true"]').count(), 80);
    assert.deepEqual(state.aiMemory, beforeMemory);
    await sleep(550); await pause();
    const pausedEagle = (await session()).eagleMs;
    await sleep(650); assert.equal((await session()).eagleMs, pausedEagle);
    await button('Save & return home').click(); await page.reload();
    assert.equal((await session()).eagleMs, pausedEagle, 'the paused effect is unchanged while on the home screen');
    const resumedAt = Date.now();
    await button(/^Continue duel/).click(); await page.locator('.game-board').waitFor();
    state = await waitState(value => value.eagleMs < pausedEagle, 'saved Eagle Eye resumes');
    assert.ok(state.eagleMs >= pausedEagle - (Date.now() - resumedAt) - 300, 'only active wall time reduces the resumed effect');
    assert.equal(await page.locator('.game-tile.eagle-lit').count(), 80);
    await waitState(value => value.eagleMs === 0, 'Eagle Eye expires after ten active seconds', 11000);
    assert.equal(await page.locator('.game-tile.eagle-lit').count(), 0);
    assert.equal(await page.locator('.game-tile[data-face-up="true"]').count(), 0);
    report('Eagle Eye covers every hidden tile, pauses, survives reload and expires after active play');

    const shortDeal = smallDeal();
    const shortStart = await fixture(shortDeal, {
      eagleMs: 200, hintEffect: { ids: shortDeal.pairs[0], remainingMs: 200 },
      boosters: { shuffle: 3, hint: 2, freeze: 3, eagle: 2 },
    }, () => page.evaluate(() => {
      // Capture the actual mount, before browser-protocol polling can consume a
      // 200 ms effect. The old ungated clock expires during the menu exit here.
      window.__shortBoosterMount = null;
      const observer = new MutationObserver(() => {
        if (!document.querySelector('.game-board')) return;
        const value = JSON.parse(localStorage.getItem('porcelain:session'));
        window.__shortBoosterMount = { eagleMs: value.eagleMs, hintMs: value.hintEffect?.remainingMs,
          eagleTiles: document.querySelectorAll('.game-tile.eagle-lit').length,
          hintedTiles: document.querySelectorAll('.game-tile.hinted').length,
          revealedTiles: document.querySelectorAll('.game-tile[data-face-up="true"]').length };
        observer.disconnect();
      });
      observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    }));
    const mountedEffects = await page.evaluate(() => window.__shortBoosterMount);
    assert.ok(mountedEffects, 'the initial board mount was observed');
    assert.ok(mountedEffects.eagleMs > 0 && mountedEffects.eagleMs <= 200, 'short Eagle Eye waits for the board to mount');
    assert.ok(mountedEffects.hintMs > 0 && mountedEffects.hintMs <= 200, 'short Hint waits for the board to mount');
    assert.equal(mountedEffects.eagleTiles, remaining(shortStart));
    assert.equal(mountedEffects.hintedTiles, 2);
    assert.equal(mountedEffects.revealedTiles, 0);
    state = await waitState(value => value.eagleMs === 0 && !value.hintEffect, 'both short saved effects expire after mounting', 2000);
    assert.equal(await page.locator('.game-tile.eagle-lit, .game-tile.hinted').count(), 0);
    assert.deepEqual(state.boosters, shortStart.boosters, 'resuming and expiring effects never spends another charge');
    assert.equal(state.attempts, 0); assert.equal(state.aiAttempts, 0); assert.equal(state.turn, 'you');
    assert.equal(state.score, shortStart.score); assert.equal(state.aiScore, shortStart.aiScore);
    assert.equal(remaining(state), remaining(shortStart)); assert.deepEqual(state.aiMemory, {});
    await sleep(250);
    state = await session(); assert.equal(state.eagleMs, 0); assert.equal(state.hintEffect, null);
    report('200ms saved Hint and Eagle Eye remain visible at board mount and expire once without extra charges');

    const game = smallDeal();
    await fixture(game);
    await booster('Freeze').click(); state = await waitState(value => value.freezeReady, 'Freeze queued');
    assert.equal(state.boosters.freeze, 2); assert.equal(await booster('Freeze').isDisabled(), true);
    state = await attempt(game.pairs[0], 1);
    assert.equal(state.turn, 'you'); assert.equal(state.freezeReady, true); assert.equal(state.boosters.freeze, 2);
    state = await attempt([game.pairs[1][0], game.pairs[2][0]], 2);
    assert.equal(state.turn, 'you'); assert.equal(state.freezeReady, false); assert.equal(state.boosters.freeze, 2);
    assert.equal(await booster('Freeze').isEnabled(), true);
    state = await attempt([game.pairs[1][0], game.pairs[2][0]], 3);
    assert.equal(state.turn, 'ai');
    for (const name of ['Shuffle', 'Hint', 'Freeze', 'Eagle Eye']) assert.equal(await booster(name).isDisabled(), true);
    await pause();
    report('Freeze cannot stack, survives a match, skips one ghost turn and then allows normal handoff');

    const known = Object.fromEntries(game.pairs[0].map(id => [id, { key: game.tiles.find(tile => tile.id === id).matchKey, turn: 0 }]));
    const collectionBeforeAI = totalCollection(await stored('collection'));
    const aiStart = await fixture(game, { gameId: 'ghost-collection-check', turn: 'ai', aiMemory: known, boosters: { shuffle: 2, hint: 2, freeze: 2, eagle: 2 } });
    for (const name of ['Shuffle', 'Hint', 'Freeze', 'Eagle Eye']) assert.equal(await booster(name).isDisabled(), true);
    state = await waitState(value => value.aiAttempts === 1, 'ghost matches a remembered pair');
    assert.equal(state.aiScore, aiStart.aiScore + 100); assert.equal(remaining(state), 6);
    assert.deepEqual(state.boosters, aiStart.boosters);
    assert.equal(totalCollection(await stored('collection')), collectionBeforeAI);
    await pause();
    report('the ghost uses no boosters and earns no collection credit');

    const shuffleStart = await fixture(game, { aiMemory: known, score: 2000, aiScore: 1600 });
    await booster('Shuffle').click();
    state = await waitState(value => value.shuffles === 1, 'shuffle finishes');
    assert.equal(remaining(state), remaining(shuffleStart));
    assert.equal(state.score, shuffleStart.score); assert.equal(state.aiScore, shuffleStart.aiScore);
    assert.equal(state.boosters.shuffle, 2); assert.deepEqual(state.aiMemory, {});
    assert.deepEqual(state.tiles.map(tile => [tile.id, tile.matchKey, tile.removed]), shuffleStart.tiles.map(tile => [tile.id, tile.matchKey, tile.removed]));
    report('Shuffle spends one charge while preserving inventory and scores and clearing ghost memory');

    await page.evaluate(() => localStorage.removeItem('porcelain:collection'));
    const collectionSave = await fixture(game, { gameId: 'stable-collection-receipt', score: 2000, aiScore: 1600 });
    state = await attempt(game.pairs[0], 1);
    assert.equal(state.score, 2100); assert.equal(remaining(state), 6);
    assert.match(await page.locator('.duel-progress-labels').innerText(), /You secured the win/);
    assert.equal(await page.getByRole('dialog', { name: 'Game results' }).count(), 0, '21 pairs secures but does not end the duel');
    const firstKey = game.tiles.find(tile => tile.id === game.pairs[0][0]).matchKey;
    let collection = await stored('collection');
    assert.equal(collection.counts[firstKey], 1); assert.equal(totalCollection(collection), 1);
    await fixture(game, collectionSave);
    await attempt(game.pairs[0], 1);
    collection = await stored('collection');
    assert.equal(collection.counts[firstKey], 1, 'replaying the same physical pair after reload is idempotent');
    await home(); await button('Tile binder').click();
    await page.getByRole('dialog', { name: 'Tile binder', exact: true }).waitFor();
    assert.equal(await page.locator('.binder-match-total strong').innerText(), '1');
    assert.equal(await page.locator(`.binder-card[data-match-key="${firstKey}"]`).getAttribute('data-collected'), 'true');
    for (const theme of themes) {
      await page.getByLabel('Collection theme', { exact: true }).selectOption(theme.id);
      for (const ruleset of ['Eastern', 'Western']) {
        await page.getByRole('group', { name: 'Collection ruleset' }).getByRole('button', { name: new RegExp(`^${ruleset}`) }).click();
        await page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: 'All', exact: true }).click();
        assert.equal(await page.locator('.binder-card').count(), 40);
        for (const rarity of RARITIES) {
          await page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: rarity.label, exact: true }).click();
          assert.equal(await page.locator('.binder-card').count(), { common: 22, rare: 10, epic: 6, legendary: 2 }[rarity.id]);
          assert.equal(await page.locator(`.binder-card:not([data-rarity="${rarity.id}"])`).count(), 0);
        }
      }
    }
    const lastTheme = await page.getByLabel('Collection theme', { exact: true }).inputValue();
    await button('Next collection theme').click();
    assert.notEqual(await page.getByLabel('Collection theme', { exact: true }).inputValue(), lastTheme);
    await button('Previous collection theme').click();
    assert.equal(await page.getByLabel('Collection theme', { exact: true }).inputValue(), lastTheme);
    report('human matches award once across reload; binder filters all nine themes and both editions');

    for (const ruleset of ['eastern', 'western']) {
      const finalGame = smallDeal(ruleset, 2);
      await fixture(finalGame, { gameId: `final-${ruleset}`, score: 2100, aiScore: 1700 });
      await attempt(finalGame.pairs[0], 1);
      assert.equal(await page.getByRole('dialog', { name: 'Game results' }).count(), 0);
      await tap(finalGame.pairs[1][0]); await tap(finalGame.pairs[1][1]);
      const dialog = page.getByRole('dialog', { name: 'Game results' }); await dialog.waitFor();
      assert.equal(await dialog.locator('h2').innerText(), 'Victory!');
      assert.equal(await session(), null);
    }
    report('both editions continue beyond 21 pairs and finish only when the last pair clears');

    await reset(); let previous;
    for (let index = 0; index < 5; index += 1) {
      await button('Play Duel').click(); await page.locator('.game-board').waitFor();
      state = await waitState(value => value.formationId, 'new formation starts');
      assert.ok(FORMATION_IDS.includes(state.formationId));
      assert.notEqual(state.formationId, previous, 'new games never repeat the immediately preceding formation');
      assert.equal(await stored('lastFormation'), state.formationId);
      previous = state.formationId;
      await home(); await page.reload(); await button('Play Duel').waitFor();
      assert.equal(await stored('lastFormation'), previous, 'formation history persists through reload');
    }
    report('successive new games avoid the last formation across saves and reloads');
    assert.deepEqual(errors, [], 'no browser errors or missing local assets');
    console.log(JSON.stringify({ browser: browserName, passed: checks.length, errors }, null, 2));
  } catch (error) {
    const directory = path.join(root, 'tmp', 'progression-qa'); fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, `${browserName}-failure.png`), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(directory, `${browserName}-failure.json`), JSON.stringify({ checks, errors, error: error.stack, session: await session().catch(() => null) }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
