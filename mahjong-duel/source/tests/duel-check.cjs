/*
 * Shared-board Duel browser regression checks for both editions.
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/duel-check.cjs [--webkit] [--visual-only]
 * Fixtures use the public local-save format and the edition's real engine.
 * The observer only records DOM changes; it does not alter timers or game state.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const memory = (process.env.GAME_EDITION || (fs.existsSync(path.join(root, 'src/memory-turn.js')) ? 'memory' : 'faceup')) === 'memory';
const version = memory ? 3 : 2;
const origin = process.env.GAME_URL || `http://127.0.0.1:${memory ? 5173 : 5174}`;
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const output = path.join(root, 'tmp', 'shared-duel-check', `${memory ? 'memory' : 'faceup'}-${browserName}`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const load = name => import(pathToFileURL(path.join(root, 'src', name)));

(async () => {
  const engine = await load('engine.js');
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await playwright[browserName].launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
  fs.mkdirSync(output, { recursive: true });
  await context.addInitScript(() => {
    window.__duelSelections = [];
    let previous = '';
    const observe = () => {
      const nodes = document.querySelectorAll('.game-board .game-tile[data-face-up="true"], .game-board .game-tile.tile-selected, .game-board .game-tile.duel-ai-selected, .game-board .game-tile[data-ai-selected="true"]');
      const ids = [...new Set([...nodes].map(node => node.dataset.tileId))].sort();
      const flying = document.querySelectorAll('.match-flight .flying-tile').length;
      const signature = `${ids.join(',')}:${flying}`;
      if (signature === previous) return;
      previous = signature;
      window.__duelSelections.push({ ids, flying, at: performance.now() });
    };
    new MutationObserver(observe).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-face-up', 'data-ai-selected'] });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [], visuals = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`);
  });
  const button = name => page.getByRole('button', { name, exact: true });
  const stone = id => page.locator(`.game-board [data-tile-id="${id}"]`);
  const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:session')));
  const count = game => engine.remainingCount(game.tiles);
  const selections = () => page.evaluate(() => window.__duelSelections);
  const clearSelections = () => page.evaluate(() => { window.__duelSelections.length = 0; });
  const waitState = async (predicate, label, timeout = 12000) => {
    const start = Date.now();
    let current;
    do {
      current = await session();
      if (current && predicate(current)) return current;
      await sleep(35);
    } while (Date.now() - start < timeout);
    throw new Error(`Timed out: ${label}; last state=${JSON.stringify(current && { turn: current.turn, score: current.score, aiScore: current.aiScore, attempts: current.attempts, aiAttempts: current.aiAttempts, remaining: count(current), duelView: current.duelView })}`);
  };

  function deal(ruleset = 'western', theme = 'ming-porcelain', seed = 90421) {
    return { ...engine.createGame(ruleset, seed, 'balanced', theme), theme };
  }
  function openPairs(number = 4, ruleset = 'western') {
    const game = deal(ruleset);
    const groups = new Map();
    for (const tile of game.tiles) {
      if (!groups.has(tile.matchKey)) groups.set(tile.matchKey, []);
      groups.get(tile.matchKey).push(tile);
    }
    const pairs = [...groups.values()].slice(0, number).map(group => group.slice(0, 2).map(tile => tile.id));
    const positions = Object.fromEntries(pairs.flatMap((pair, row) => pair.map((id, column) => [id, { x: column * 5, y: row, z: 0 }])));
    return { ...game, pairs, solution: pairs, tiles: game.tiles.map(tile => ({ ...tile, removed: !positions[tile.id], ...positions[tile.id] })) };
  }
  function save(game, extras = {}) {
    const removedPairs = (80 - count(game)) / 2;
    return {
      version, ...game, mode: 'duel', duelVersion: 1, turn: 'you', elapsed: 35,
      score: Math.floor(removedPairs / 2) * 100, aiScore: Math.ceil(removedPairs / 2) * 100,
      attempts: 0, aiAttempts: 0, hints: 0, shuffles: 0, flips: 0, aiFlips: 0,
      aiMemory: Object.fromEntries(game.tiles.filter(tile => !tile.removed).map(tile => [tile.id, tile.matchKey])),
      ...extras,
    };
  }
  async function reset() {
    await page.goto(origin);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('porcelain:language', '"en"'); localStorage.setItem('porcelain:sound', 'false'); localStorage.setItem('porcelain:gentle', 'true'); });
    await page.reload();
    await button('Duel').waitFor();
  }
  async function fixture(game, extras = {}, settle = 60) {
    const value = save(game, extras);
    assert.equal(Object.hasOwn(value, 'aiTiles'), false, 'new Duel fixtures must have exactly one board');
    await page.goto(origin);
    await page.evaluate(value => {
      localStorage.setItem('porcelain:session', JSON.stringify(value));
      localStorage.setItem('porcelain:theme', JSON.stringify(value.theme));
      localStorage.setItem('porcelain:sound', 'false');
      localStorage.setItem('porcelain:gentle', 'true');
    }, value);
    await page.reload();
    if (count(value) === 0) {
      assert.equal(await page.getByRole('button', { name: /^Continue your/ }).count(), 0, 'completed Duel offers results instead of continuation');
      await page.getByRole('button', { name: /^View duel results/ }).click();
    } else await page.getByRole('button', { name: /^Continue your/ }).click();
    await page.locator('.game-board').waitFor();
    if (settle) await sleep(settle);
    return value;
  }
  async function pointerClick(id) {
    const point = await stone(id).evaluate(node => {
      const rect = node.getBoundingClientRect();
      for (const fy of [.5, .98, .9, .1, .02]) for (const fx of [.5, .98, .9, .1, .02]) {
        const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
        if (document.elementFromPoint(x, y)?.closest('[data-tile-id]') === node) return { x, y };
      }
      return null;
    });
    assert.ok(point, `tile ${id} has an exposed pointer target`);
    await page.mouse.click(point.x, point.y);
  }
  async function pair(ids, remaining) {
    await pointerClick(ids[0]);
    await pointerClick(ids[1]);
    if (remaining === 0) await page.getByRole('dialog', { name: 'Game results' }).waitFor();
    else {
      await waitState(game => count(game) === remaining, `pair leaves ${remaining} tiles`);
      await page.waitForFunction(() => !document.querySelector('.match-flight'));
      await sleep(220);
    }
  }
  async function pause() {
    await button('Pause game').click();
    await page.getByRole('dialog').waitFor();
    await sleep(60);
  }
  function progress(game) {
    return { turn: game.turn, score: game.score, aiScore: game.aiScore, attempts: game.attempts, aiAttempts: game.aiAttempts, elapsed: game.elapsed, tiles: game.tiles };
  }
  async function assertWinner(expected, you, ai) {
    const dialog = page.getByRole('dialog', { name: 'Game results' });
    await dialog.waitFor();
    const headings = { win: 'A beautiful finish.', tie: 'In perfect harmony.', lose: 'Every game, a little wiser.' };
    assert.equal(await dialog.locator('h2').innerText(), headings[expected]);
    const numbers = await dialog.locator('.result-stats strong').allTextContents();
    assert.equal(Number(numbers[0].replaceAll(',', '')), you, 'result shows human points');
    assert.equal(Number(numbers[1].replaceAll(',', '')), ai, 'result shows Lin points');
    assert.equal(await session(), null, 'finished Duel is not resumable');
    assert.equal(await page.locator('.game-board .game-tile').count(), 0);
  }

  try {
    if (!process.argv.includes('--visual-only')) {
      for (const ruleset of ['eastern', 'western']) {
        await reset();
        await button(ruleset === 'eastern' ? 'Eastern' : 'Western').click();
        await button('Duel').click();
        const game = await waitState(value => value.mode === 'duel', 'fresh Duel');
        await page.locator('.game-board').waitFor();
        await page.waitForFunction(() => document.querySelectorAll('.game-board .game-tile').length === 80);
        assert.equal(game.version, version); assert.equal(game.duelVersion, 1);
        assert.equal(game.ruleset, ruleset); assert.equal(game.turn, 'you');
        assert.equal(game.score, 0); assert.equal(game.aiScore, 0);
        assert.equal(count(game), 80); assert.equal(Object.hasOwn(game, 'aiTiles'), false);
        assert.equal(await page.locator('.game-board').count(), 1);
        assert.equal(await page.locator('.game-board .game-tile').count(), 80);
        if (memory) assert.equal(await page.locator('.game-board [data-face-up="true"]').count(), 0);
        else assert.equal(await page.locator('.game-board .tile-back').count(), 0);
        await sleep(1100);
        assert.equal((await session()).aiAttempts, 0, 'Lin does not play during the human turn');
      }
      console.log('PASS fresh Eastern/Western Duels: one80-tile board, human starts, zero scores, edition visibility');

      if (memory) {
        const resumed = deal('eastern', 'ming-porcelain', 123);
        const ids = resumed.solution[0];
        await fixture(resumed, { elapsed: 12, flips: 2, aiMemory: {}, duelView: { revealed: ids, pending: { key: 123, kind: 'pair', ids, matched: true, actor: 'you', duration: 50 } } }, 0);
        await waitState(value => count(value) === 78 && value.score === 100 && !value.duelView?.pending, 'short saved pair resolves after board mounts');
        assert.equal((await session()).turn, 'you');
        assert.deepEqual(errors, []);
        console.log('PASS memory saved50ms match waits for the returning board before collision');
      }

      let game = openPairs(4);
      let initial = await fixture(game, {}, 300);
      await pair(game.pairs[0], 6);
      assert.equal((await session()).score, initial.score + 100);
      assert.equal((await session()).turn, 'you');
      await pair(game.pairs[1], 4);
      const retained = await session();
      assert.equal(retained.score, initial.score + 200, 'Duel has exactly100 points per pair, without a solo combo bonus');
      assert.equal(retained.aiScore, initial.aiScore); assert.equal(retained.turn, 'you');
      assert.equal(retained.attempts, 2);
      console.log('PASS consecutive human matches retain turn and award exactly100 points each');

      game = openPairs(4); initial = await fixture(game, {}, 300);
      await pointerClick(game.pairs[0][0]); await pointerClick(game.pairs[1][0]);
      await waitState(value => value.turn === 'ai', 'human mismatch passes turn to Lin');
      await clearSelections();
      const beforeGuard = await session();
      await pointerClick(game.pairs[2][0]);
      const afterGuard = await session();
      assert.equal(afterGuard.score, initial.score); assert.equal(afterGuard.attempts, beforeGuard.attempts, 'human cannot act during Lin turn');
      await page.waitForFunction(() => window.__duelSelections.some(event => event.ids.length === 1));
      await pause();
      const paused = progress(await session());
      await sleep(1400);
      assert.deepEqual(progress(await session()), paused, 'pause freezes AI picks, shared board, scores and clock');
      await button('Save & return to menu').click();
      const saved = await session();
      assert.equal(saved.turn, 'ai'); assert.equal(saved.duelVersion, 1); assert.equal(Object.hasOwn(saved, 'aiTiles'), false);
      await page.reload();
      await page.getByRole('button', { name: /^Continue your/ }).click();
      await page.locator('.game-board').waitFor();
      await waitState(value => value.aiScore > initial.aiScore, 'resumed visible AI match');
      await pause();
      const afterAI = await session();
      assert.equal(afterAI.score, initial.score); assert.equal(afterAI.attempts, 1);
      assert.equal(afterAI.aiScore, initial.aiScore + 100, 'one AI match awards exactly100 points');
      assert.equal(afterAI.turn, 'ai', 'AI match retains its turn');
      assert.equal(count(afterAI), 6, 'AI removes from the same board');
      assert.ok(afterAI.aiAttempts >= 1);
      assert.ok((await selections()).some(event => event.ids.length >= 2 || (!memory && event.flying === 2)), 'both AI choices are visible as selected faces or their collision copies');
      console.log('PASS mismatch handoff, AI input guard, visible AI pair, pause, save/resume and AI turn retention');

      game = openPairs(4);
      initial = await fixture(game, { seed: 1, turn: 'ai', aiMemory: {} }, 0);
      const missed = await waitState(value => value.turn === 'you' && value.aiAttempts === 1, 'AI mismatch returns turn to the human');
      assert.equal(count(missed), 8); assert.equal(missed.score, initial.score); assert.equal(missed.aiScore, initial.aiScore);
      await page.waitForFunction(() => document.querySelector('.duel-turn strong')?.textContent === 'Your turn');
      await pair(game.pairs[0], 6);
      assert.equal((await session()).score, initial.score + 100);
      console.log('PASS visible AI mismatch returns playable human turn without awarding points');

      game = openPairs(2); await fixture(game, { elapsed: 600 }, 300);
      await sleep(1300);
      assert.equal(await page.getByRole('dialog', { name: 'Game results' }).count(), 0);
      assert.ok((await session()).elapsed >= 601, 'Duel continues beyond the old180-second deadline');
      assert.equal(count(await session()), 4);
      console.log('PASS saved Duels after180 seconds continue without a deadline');

      game = openPairs(2);
      const [a, b] = game.pairs;
      const deadPositions = { [a[0]]: { x: 0, y: 0, z: 1 }, [a[1]]: { x: 5, y: 0, z: 0 }, [b[0]]: { x: 5, y: 0, z: 1 }, [b[1]]: { x: 0, y: 0, z: 0 } };
      game.tiles = game.tiles.map(tile => ({ ...tile, ...deadPositions[tile.id] }));
      assert.equal(engine.getAvailablePairs(game.tiles).length, 0);
      initial = await fixture(game, {}, 0);
      const rescued = await waitState(value => engine.getAvailablePairs(value.tiles).length > 0, 'automatic shared-board deadlock rescue');
      assert.equal(count(rescued), 4); assert.equal(rescued.score, initial.score); assert.equal(rescued.aiScore, initial.aiScore);
      assert.deepEqual(rescued.tiles.filter(tile => !tile.removed).map(tile => tile.id).sort(), game.tiles.filter(tile => !tile.removed).map(tile => tile.id).sort());
      console.log('PASS automatic deadlock shuffle preserves remaining identities and both scores');

      game = openPairs(3);
      const middle = game.pairs[0][0];
      const sidePositions = { [middle]: { x: 1, y: 0, z: 0 }, [game.pairs[1][0]]: { x: 0, y: 0, z: 0 }, [game.pairs[2][0]]: { x: 2, y: 0, z: 0 } };
      game.tiles = game.tiles.map(tile => ({ ...tile, ...sidePositions[tile.id] }));
      await fixture(game, {}, 300);
      assert.equal(engine.isFree(game.tiles.find(tile => tile.id === middle), game.tiles), memory);
      assert.equal(await stone(middle).getAttribute('data-free'), String(memory));
      await pointerClick(middle);
      if (memory) assert.equal(await stone(middle).getAttribute('data-face-up'), 'true');
      else assert.equal(await stone(middle).getAttribute('aria-pressed'), 'false', 'face-up edition preserves horizontal side blocking');
      game = openPairs(3);
      const covered = game.pairs[0][0], covering = game.pairs[1][0];
      game.tiles = game.tiles.map(tile => tile.id === covered ? { ...tile, x: 1, y: 1, z: 0 } : tile.id === covering ? { ...tile, x: 1.5, y: 1, z: 1 } : tile);
      initial = await fixture(game, {}, 300);
      assert.equal(await stone(covered).getAttribute('data-free'), 'false');
      await pointerClick(covered);
      assert.equal(await stone(covered).getAttribute(memory ? 'data-face-up' : 'aria-pressed'), 'false');
      assert.equal((await session()).attempts, initial.attempts);
      console.log('PASS edition-specific side blocking and shared covered-tile blocking');

      for (const outcome of ['win', 'tie', 'lose']) {
        game = openPairs(1);
        const extras = outcome === 'win' ? { score: 2000, aiScore: 1900 } : { score: 1900, aiScore: 2000, turn: outcome === 'lose' ? 'ai' : 'you' };
        await fixture(game, extras, 250);
        if (outcome !== 'lose') await pair(game.pairs[0], 0);
        await assertWinner(outcome, outcome === 'win' ? 2100 : outcome === 'tie' ? 2000 : 1900, outcome === 'lose' ? 2100 : outcome === 'tie' ? 2000 : 1900);
      }
      console.log('PASS final shared pair: human win, AI win and equal-points tie');

      game = deal(); game.tiles = game.tiles.map(tile => ({ ...tile, removed: true }));
      await fixture(game, { score: 2000, aiScore: 2000, attempts: 25, aiAttempts: 23 }, 0);
      await assertWinner('tie', 2000, 2000);
      console.log('PASS completed saved Duel opens View duel results with both scores and clears its save');

      await reset(); await button('Solo').click();
      game = await waitState(value => value.mode === 'solo', 'solo starts');
      await sleep(400);
      const soloPair = engine.getAvailablePairs(game.tiles)[0].map(tile => tile.id);
      await pair(soloPair, 78);
      assert.equal((await session()).score, 100);
      await button('Undo').click(); await waitState(value => count(value) === 80, 'solo undo');
      assert.equal((await session()).score, 0);
      console.log('PASS solo matching and undo remain available');
    }

    for (const viewport of [{ width: 390, height: 844 }, { width: 1180, height: 820 }]) {
      await page.setViewportSize(viewport);
      for (const theme of ['ming-porcelain', 'neon-shrine']) {
        let game = deal('eastern', theme);
        for (const ids of game.solution.slice(0, 7)) game.tiles = engine.removePair(game.tiles, ...ids);
        for (const turn of ['you', 'ai']) {
          await fixture(game, { turn, score: 400, aiScore: 300 }, turn === 'you' ? 500 : 20);
          if (turn === 'ai') await page.waitForFunction(() => window.__duelSelections.some(event => event.ids.length === 1));
          const prefix = `${viewport.width}x${viewport.height}-${theme}-${turn}`;
          await page.screenshot({ path: path.join(output, `${prefix}.png`), scale: 'css' });
          const layout = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth - innerWidth,
            scoreText: document.querySelector('.scoreboard')?.innerText,
            turnText: document.querySelector('.duel-turn strong')?.innerText,
            fields: [...document.querySelectorAll('.game-header,.scoreboard,.game-clock,.board-status,.game-tools')].map(el => ({ selector: el.className, text: el.innerText, rect: el.getBoundingClientRect().toJSON() })),
          }));
          assert.equal(layout.overflow, 0);
          assert.match(layout.scoreText, /400/); assert.match(layout.scoreText, /300/);
          assert.equal(layout.turnText, turn === 'you' ? 'Your turn' : 'Lin’s turn');
          assert.ok(layout.fields.every(field => field.rect.x >= -1 && field.rect.y >= -1 && field.rect.right <= viewport.width + 1 && field.rect.bottom <= viewport.height + 1), 'turn and score controls remain within viewport');
          visuals.push({ ...viewport, theme, turn, ...layout });
          await pause();
        }
      }
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'visual-check.json'), JSON.stringify(visuals, null, 2));
    console.log(`PASS ${visuals.length} light/dark phone/tablet turn-and-score captures; no overflow or browser errors`);
    console.log(`PASS shared-board Duel (${memory ? 'memory' : 'faceup'}, ${browserName})`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
