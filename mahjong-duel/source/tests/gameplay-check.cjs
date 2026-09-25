/* Run with installed Playwright, or set PLAYWRIGHT_MODULE to its module path. */
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const load = name => import(pathToFileURL(path.resolve(__dirname, `../src/${name}`)));
  const [engine, { themes }] = await Promise.all([load('engine.js'), load('themes.js')]);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:session')));
  const count = game => engine.remainingCount(game.tiles);
  const stone = id => page.locator(`[data-tile-id="${id}"]`);
  const up = () => page.locator('.game-tile[data-face-up="true"]').evaluateAll(nodes => nodes.map(node => node.dataset.tileId));
  const waitUp = n => page.waitForFunction(value => document.querySelectorAll('.game-tile[data-face-up="true"]').length === value, n);
  const waitCount = n => page.waitForFunction(value => {
    const game = JSON.parse(localStorage.getItem('porcelain:session'));
    return game && game.tiles.filter(tile => !tile.removed).length === value;
  }, n);
  const imagesLoaded = selector => page.waitForFunction(value => {
    const images = [...document.querySelectorAll(value)];
    return images.length > 0 && images.every(img => img.complete && img.naturalWidth > 0);
  }, selector);

  async function hidden() {
    await page.locator('.game-board').waitFor();
    await waitUp(0);
    const leaks = await page.locator('.game-tile').evaluateAll(nodes => nodes.flatMap(node => {
      const issues = [], label = node.getAttribute('aria-label');
      if (!label.startsWith('Hidden stone')) issues.push(label);
      if (/Hidden stone \d/.test(label)) issues.push('face-group serial ID leaked');
      if (node.querySelector('.tile-front').getAttribute('aria-hidden') !== 'true') issues.push('accessible hidden front');
      if (node.hasAttribute('data-match-key')) issues.push('matching-key metadata');
      return issues;
    }));
    assert.deepEqual(leaks, []);
  }
  async function reset() {
    await page.goto(origin);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('porcelain:sound', 'false'); localStorage.setItem('porcelain:gentle', 'true'); });
    await page.reload();
  }
  async function fixture(game, extras = {}) {
    const saved = { version: 3, ...game, mode: 'solo', aiTiles: game.tiles.map(tile => ({ ...tile })), aiNext: 5, aiMemory: {}, aiFlips: 0, elapsed: 15, score: 0, hints: 0, shuffles: 0, flips: 0, attempts: 0, ...extras };
    await page.evaluate(value => localStorage.setItem('porcelain:session', JSON.stringify(value)), saved);
    await page.reload();
    await page.getByRole('button', { name: /^Continue your/ }).click();
    await page.locator('.game-board').waitFor();
    await sleep(350);
  }
  async function pair(ids, remaining) {
    await stone(ids[0]).click(); await waitUp(1);
    await stone(ids[1]).click(); await waitUp(2);
    if (remaining === 0) await page.getByText('A beautiful finish.', { exact: true }).waitFor();
    else await waitCount(remaining);
    await waitUp(0); await sleep(260);
  }
  async function modal() {
    const dialog = page.getByRole('dialog', { name: 'Game results' });
    await dialog.waitFor();
    assert.equal(await dialog.getAttribute('aria-modal'), 'true');
    assert.equal(await page.locator('.game-screen').evaluate(node => node.inert), true);
    await page.waitForFunction(() => document.activeElement === document.querySelector('.result-card .primary-button'));
    const focused = () => page.evaluate(() => document.activeElement.textContent.trim());
    for (let i = 0; i < 2; i += 1) {
      await page.keyboard.press('Tab'); assert.equal(await focused(), 'Back to the collection');
      await page.keyboard.press('Tab'); assert.equal(await focused(), 'One more moment');
      await page.keyboard.press('Shift+Tab'); assert.equal(await focused(), 'Back to the collection');
      await page.keyboard.press('Shift+Tab'); assert.equal(await focused(), 'One more moment');
    }
  }
  async function pause() { await page.getByRole('button', { name: 'Pause game', exact: true }).click(); await page.getByRole('dialog').waitFor(); }
  async function menu() { await pause(); await page.getByRole('button', { name: 'Save & return to menu' }).click(); await page.locator('.menu-screen').waitFor(); }
  async function coveredPoint() {
    return page.locator('.game-tile.blocked').evaluateAll(nodes => {
      for (const node of nodes) {
        const r = node.getBoundingClientRect();
        for (const dx of [.97, .8, .5, .2, .03]) for (const dy of [.97, .8, .5, .2, .03]) {
          const x = r.x + r.width * dx, y = r.y + r.height * dy;
          if (document.elementFromPoint(x, y)?.closest('[data-tile-id]') === node) return { x, y };
        }
      }
      return null;
    });
  }

  try {
    if (process.argv.includes('--focus-only')) {
      await reset(); const game = engine.createGame('eastern', 8801); let tiles = game.tiles;
      for (const ids of game.solution.slice(0, -1)) tiles = engine.removePair(tiles, ...ids);
      await fixture({ ...game, tiles }); await pair(game.solution.at(-1), 0); await modal();
      assert.deepEqual(errors, []); console.log('PASS memory victory modal focus and inert regression'); return;
    }
    if (!process.argv.includes('--themes-only')) {
    for (const ruleset of ['eastern', 'western']) {
      await reset();
      await page.getByRole('button', { name: ruleset === 'eastern' ? 'Eastern' : 'Western', exact: true }).click();
      const difficulty = page.getByRole('group', { name: 'Tile difficulty' });
      assert.equal(await difficulty.getByRole('button', { name: 'Normal', exact: true }).getAttribute('aria-pressed'), 'true');
      for (const [label, value] of [['Easy', 'calm'], ['Normal', 'balanced'], ['Hard', 'intricate']]) {
        await difficulty.getByRole('button', { name: label, exact: true }).click();
        assert.equal(await difficulty.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed'), 'true');
        await page.getByRole('button', { name: 'Solo', exact: true }).click();
        await waitCount(80); await hidden();
        const game = await session();
        assert.equal(game.difficulty, value); assert.equal(game.ruleset, ruleset); assert.equal(game.mode, 'solo');
        await menu(); await page.reload();
        assert.equal(await difficulty.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed'), 'true', 'difficulty persists after returning to the menu');
      }
      console.log(`PASS ${ruleset}: Easy/Normal/Hard selection, matching saved difficulty and persistent menu choice`);
    }
    if (process.argv.includes('--difficulty-only')) {
      assert.deepEqual(errors, [], 'difficulty selection does not cause browser errors');
      return;
    }
    for (const ruleset of ['eastern', 'western']) {
      await reset();
      await page.getByRole('button', { name: ruleset === 'eastern' ? 'Eastern' : 'Western', exact: true }).click();
      await page.getByRole('button', { name: 'Solo', exact: true }).click();
      await waitCount(80); await sleep(700); await hidden(); await imagesLoaded('.game-board img');
      let game = await session(); assert.equal(game.ruleset, ruleset); assert.equal(game.version, 3);
      const covered = await coveredPoint(); assert.ok(covered, 'a covered edge permits a real pointer test');
      await page.mouse.click(covered.x, covered.y);
      assert.deepEqual(await up(), []); assert.equal((await session()).flips, 0);
      const middle = game.tiles.find(t => engine.isFree(t, game.tiles) &&
        game.tiles.some(o => o.z === t.z && o.y === t.y && o.x === t.x - 1) &&
        game.tiles.some(o => o.z === t.z && o.y === t.y && o.x === t.x + 1));
      assert.ok(middle); await stone(middle.id).click(); await waitUp(1);
      assert.equal((await session()).flips, 1);
      assert.ok((await stone(middle.id).getAttribute('aria-label')).includes(middle.name));
      await stone(middle.id).click(); assert.equal((await session()).flips, 1);
      const wrong = game.tiles.find(t => engine.isFree(t, game.tiles) && t.matchKey !== middle.matchKey);
      await stone(wrong.id).click(); await waitUp(2);
      const third = game.tiles.find(t => engine.isFree(t, game.tiles) && t.id !== wrong.id && t.id !== middle.id);
      await stone(third.id).click();
      assert.deepEqual(new Set(await up()), new Set([middle.id, wrong.id]), 'third flip stays hidden');
      assert.equal((await session()).attempts, 1);
      await pause(); const paused = await session(); await sleep(1500);
      assert.equal((await session()).elapsed, paused.elapsed);
      assert.deepEqual(new Set(await up()), new Set([middle.id, wrong.id]), 'paused mismatch stays visible');
      await page.getByRole('button', { name: 'Keep playing' }).click(); await hidden();
      assert.equal(count(await session()), 80); assert.equal((await session()).score, 0);
      console.log(`PASS ${ruleset}: hidden/covered/side-surrounded flips, mismatch, third-flip lock, paused mismatch/timer`);

      game = await session(); const match = engine.getAvailablePairs(game.tiles)[0].map(t => t.id);
      await stone(match[0]).click(); await stone(match[1]).click(); await waitUp(2);
      assert.equal(count(await session()), 80, 'matching faces remain during reveal interval');
      await pause(); const matchPause = await session(); await sleep(850);
      assert.equal(count(await session()), 80); assert.equal((await session()).elapsed, matchPause.elapsed);
      await page.getByRole('button', { name: 'Keep playing' }).click(); await waitCount(78); await hidden();
      assert.equal((await session()).score, 100);
      await page.getByRole('button', { name: 'Undo', exact: true }).click(); await waitCount(80); await hidden();
      assert.equal((await session()).score, 0);
      game = await session(); await stone(game.tiles.find(t => engine.isFree(t, game.tiles)).id).click(); await waitUp(1);
      const beforeShuffle = await session();
      assert.equal(await page.getByRole('button', { name: 'Shuffle', exact: true }).isEnabled(), true);
      await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('porcelain:session')).shuffles === 1); await hidden();
      game = await session();
      assert.deepEqual(game.tiles.map(t => [t.id, t.faceId, t.removed]), beforeShuffle.tiles.map(t => [t.id, t.faceId, t.removed]));
      assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled(), true);
      console.log(`PASS ${ruleset}: delayed/paused match, score, hidden undo, first-flip shuffle reset`);

      for (let peek = 1; peek <= 3; peek += 1) {
        game = await session(); const free = game.tiles.filter(t => engine.isFree(t, game.tiles));
        await page.getByRole('button', { name: /^Peek/ }).click(); await waitUp(free.length);
        assert.equal((await session()).hints, peek);
        assert.deepEqual(new Set(await up()), new Set(free.map(t => t.id)));
        await stone(free[0].id).click(); assert.equal((await session()).flips, game.flips);
        await hidden();
      }
      assert.equal(await page.getByRole('button', { name: /^Peek/ }).isDisabled(), true);
      game = await session(); await stone(game.tiles.find(t => engine.isFree(t, game.tiles)).id).click(); await waitUp(1);
      const saved = await session(); await menu(); await page.reload();
      await page.getByRole('button', { name: /^Continue your solo game/ }).click(); await waitCount(80); await hidden();
      assert.equal((await session()).flips, saved.flips); assert.equal((await session()).hints, 3); assert.equal((await session()).theme, saved.theme);
      console.log(`PASS ${ruleset}: three timed peeks/limit/input lock, face-down persistent resume`);

      const win = engine.createGame(ruleset, 4001, 'intricate'); let tiles = win.tiles;
      for (const ids of win.solution.slice(0, -4)) tiles = engine.removePair(tiles, ...ids);
      await fixture({ ...win, tiles });
      for (let i = 36; i < 40; i += 1) await pair(win.solution[i], (39 - i) * 2);
      await page.waitForFunction(() => document.querySelectorAll('.game-tile').length === 0);
      assert.equal(await session(), null); assert.equal(await page.locator('.result-stats > div').nth(1).locator('strong').textContent(), '40');
      await modal(); console.log(`PASS ${ruleset}: final four memory pairs, board completion, result/modal, save cleanup`);
    }

    // Shared-board Duel scenarios live in duel-check.cjs; this suite retains Solo and theme regression coverage.

    }
    await reset();
    for (const theme of themes) {
      await page.getByRole('button', { name: 'Choose tile theme' }).click();
      assert.equal(await page.locator('.theme-card').count(), 9); await imagesLoaded('.theme-grid img');
      await page.locator('.theme-card').filter({ has: page.getByText(theme.name, { exact: true }) }).click();
      assert.equal(await page.locator('.world').getAttribute('data-theme'), theme.id); await imagesLoaded('.tile-showcase img');
      await page.getByRole('button', { name: 'Solo', exact: true }).click(); await waitCount(80); await hidden(); await imagesLoaded('.game-board img');
      assert.equal((await session()).theme, theme.id);
      const backs = await page.locator('.game-board .tile-back img').evaluateAll(imgs => [...new Set(imgs.map(img => img.getAttribute('src')))]);
      assert.deepEqual(backs, [theme.back]); await menu();
      console.log(`PASS theme ${theme.id}: menu choice, shared back, all tile assets load`);
    }
    assert.deepEqual(errors, [], 'no browser errors or failed local requests');
    console.log('PASS complete memory browser regression');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
