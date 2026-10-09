/* Real-browser 30-pair balance checks, with public collection fixtures and real tile clicks.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/game-balance-check.cjs [--webkit] [--outcomes-only]
 * A deterministic crypto draw chooses each deal; scores, AI turns and rewards are never injected.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const outcomesOnly = process.argv.includes('--outcomes-only');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const output = path.resolve(__dirname, '../tmp/game-balance-qa');
const expectedTiles = { marble: 32, sapphire: 16, amethyst: 8, gold: 4 };
const expectedFaces = { marble: 8, sapphire: 4, amethyst: 2, gold: 1 };
const time = new Date('2026-10-01T12:00:00Z');
const sizes = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 844, height: 390 }];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const load = file => import(pathToFileURL(path.resolve(__dirname, '../src', file)).href);
  const [{ themes, rulesetForTheme }, { themeTileSets }, { createCollection }, { rarityForTile }, formations, engine, duel, opponent] = await Promise.all([
    load('themes.js'), load('tile-data.js'), load('collection.js'), load('rarity.js'), load('formations.js'), load('engine.js'), load('duel.js'), load('opponent-ai.js'),
  ]);
  const collection = createCollection();
  for (const theme of themes) {
    const edition = rulesetForTheme(theme.id);
    assert.equal(themeTileSets[theme.id][edition].length, 40, 'each theme has 40 active faces');
    for (const tile of themeTileSets[theme.id][edition]) collection.counts[tile.matchKey] = 3;
  }
  const seedFor = (id, after = 0) => {
    for (let seed = after; seed < after + 10000; seed++) if (formations.chooseFormationId(seed) === id) return seed;
    throw Error(`No deterministic seed found for ${id}`);
  };

  // Find a reproducible input sequence for a real 15–15 match. The model chooses
  // the fixture only; the browser must independently execute every move/reward.
  function tieFixture() {
    for (let seed = 0; seed < 100; seed++) {
      let game = { ...engine.createGame('eastern', seed, 'calm', themes[0].id), ...duel.createDuelState(), mode: 'duel', aiMode: 'modern', aiMemory: {}, shuffles: 0 };
      const actions = [];
      for (let attempt = 0; attempt < 1500 && engine.remainingCount(game.tiles); attempt++) {
        if (!engine.getAvailablePairs(game.tiles).length) {
          game = { ...game, tiles: engine.shuffleBoard(game.tiles, game.seed + game.shuffles + 1, { formationId: game.formationId }).tiles, aiMemory: {}, shuffles: game.shuffles + 1 };
        }
        let ids;
        if (game.turn === 'ai') ids = opponent.playOpponentTurn(game).flippedIds;
        else {
          const free = game.tiles.filter(tile => engine.isFree(tile, game.tiles));
          const matching = game.score < 1500, choices = [];
          const helps = tile => free.some(other => other.id !== tile.id && other.matchKey === tile.matchKey && game.aiMemory[other.id]?.key === other.matchKey);
          for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
            if ((free[i].matchKey === free[j].matchKey) === matching) choices.push({ ids: [free[i].id, free[j].id], priority: Number(helps(free[i])) + Number(helps(free[j])) });
          }
          choices.sort((a, b) => b.priority - a.priority);
          ids = choices[0]?.ids;
          if (!ids) break;
          actions.push(ids);
        }
        if (!ids?.length) break;
        game = { ...game, aiMemory: opponent.rememberOpponentFaces(game, ids) };
        const next = duel.resolveDuelAttempt(game, ids);
        game = { ...next, aiMemory: opponent.advanceOpponentMemory(next) };
      }
      if (!engine.remainingCount(game.tiles) && game.score === 1500 && game.aiScore === 1500) return { seed, actions, formation: game.formationId };
    }
    throw Error('No bounded real-AI15–15 fixture found');
  }
  const tie = tieFixture();
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch({ headless: true });
  const reports = [];
  async function run(label, fixture, scenario) {
    const { themeId = themes[0].id, seed, viewport = sizes[1] } = fixture;
    const edition = rulesetForTheme(themeId);
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
    await context.addInitScript(({ collection, edition, seed }) => {
      localStorage.setItem('porcelain:collection', JSON.stringify(collection));
      // An obsolete preference must not override the selected theme's tile set.
      localStorage.setItem('porcelain:ruleset', JSON.stringify(edition === 'eastern' ? 'western' : 'eastern'));
      // The deterministic tie replay intentionally exercises the unchanged Modern AI.
      localStorage.setItem('porcelain:aiMode', JSON.stringify('modern'));
      localStorage.setItem('porcelain:aiModeVersion', '1');
      localStorage.setItem('porcelain:gentle', 'true'); localStorage.setItem('porcelain:sound', 'false');
      const draw = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 1 ? (values[0] = seed, values) : draw(values);
      Math.random = () => 0;
    }, { collection, edition, seed });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
    await page.clock.install({ time }); await page.clock.pauseAt(time);
    const advance = async (ms = 250) => { await page.clock.runFor(ms); await page.evaluate(() => document.body.childElementCount); };
    const button = name => page.getByRole('button', { name, exact: true });
    async function tap(target) {
      const node = typeof target === 'string' ? button(target) : target;
      await node.waitFor(); await node.scrollIntoViewIfNeeded();
      const rect = await node.boundingBox(); assert.ok(rect, `${label}: control visible`);
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2); await advance();
    }
    async function tapTile(id) {
      let point;
      // Let a previous match's flight/feedback finish before requiring a hit target.
      for (let retry = 0; retry < 10 && !point; retry++) {
        point = await page.locator(`[data-tile-id="${id}"]`).evaluate(node => {
          const rect = node.getBoundingClientRect();
          for (const fy of [.5, .9, .1]) for (const fx of [.5, .9, .1]) {
            const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
            if (document.elementFromPoint(x, y)?.closest('[data-tile-id]') === node) return { x, y };
          }
        });
        if (!point) await advance(200);
      }
      assert.ok(point, `${label}: tile ${id} has a reachable pointer target`);
      await page.mouse.click(point.x, point.y);
    }
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:progression')));
    const snapshot = () => page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.game-tile')];
      return { remaining: nodes.length, turn: document.querySelector('.duel-scoreboard')?.dataset.turn,
        you: Number(document.querySelector('.local-player strong')?.textContent.replaceAll(',', '') || 0) / 100,
        ai: Number(document.querySelector('.opponent strong')?.textContent.replaceAll(',', '') || 0) / 100,
        shown: nodes.filter(node => node.dataset.faceUp === 'true').length,
        free: nodes.filter(node => node.dataset.free === 'true' && node.getAttribute('aria-disabled') === 'false').map(node => ({ id: node.dataset.tileId, face: node.querySelector('.tile-front img').src })),
        result: Boolean(document.querySelector('.result-card')) };
    });
    async function inspectBoard() {
      const board = await page.evaluate(() => ({
        formation: JSON.parse(localStorage.getItem('porcelain:lastFormation')),
        label: document.querySelector('.game-board').getAttribute('aria-label'),
        progressMax: document.querySelector('.duel-progress-track').getAttribute('aria-valuemax'),
        progress: document.querySelector('.duel-progress-track').getAttribute('aria-valuenow'),
        goal: document.querySelector('.duel-progress-labels strong').textContent,
        theme: document.querySelector('.world').dataset.theme,
        tiles: [...document.querySelectorAll('.game-tile')].map(node => ({
          src: node.querySelector('.tile-front img').src, rarity: node.dataset.rarity, faceUp: node.dataset.faceUp,
          rect: node.getBoundingClientRect().toJSON(),
        })),
        overflow: document.documentElement.scrollWidth - innerWidth,
      }));
      assert.equal(board.theme, themeId); assert.equal(board.tiles.length, 60);
      assert.match(board.label, new RegExp(`^${edition} Mahjong board, 60 tiles left$`));
      assert.equal(board.progressMax, '30'); assert.equal(board.progress, '0'); assert.equal(board.goal, 'First to 16');
      assert.equal(board.formation, formations.chooseFormationId(seed));
      const lookup = new Map(themeTileSets[themeId][edition].map(face => [new URL(face.src, `${origin}/`).href, face]));
      const counts = {}, tiers = Object.fromEntries(Object.keys(expectedTiles).map(id => [id, 0]));
      for (const tile of board.tiles) {
        assert.equal(tile.faceUp, 'false'); assert.ok(lookup.has(tile.src), 'every picture belongs to this theme/edition');
        assert.equal(tile.rarity, rarityForTile(themeId, edition, lookup.get(tile.src).id).id);
        counts[tile.src] = (counts[tile.src] || 0) + 1; tiers[tile.rarity]++;
        assert.ok(tile.rect.left >= -1 && tile.rect.right <= viewport.width + 1 && tile.rect.top >= -1 && tile.rect.bottom <= viewport.height + 1, `${label}: every tile fits the viewport`);
      }
      assert.equal(Object.keys(counts).length, 15); assert.ok(Object.values(counts).every(count => count === 4));
      assert.deepEqual(tiers, expectedTiles);
      const uniqueTiers = Object.fromEntries(Object.keys(expectedTiles).map(id => [id, 0]));
      for (const src of Object.keys(counts)) uniqueTiers[rarityForTile(themeId, edition, lookup.get(src).id).id]++;
      assert.deepEqual(uniqueTiers, expectedFaces); assert.ok(board.overflow <= 1);
      await page.screenshot({ path: path.join(output, `${browserName}-${label}-${board.formation}.png`), animations: 'disabled' });
      return { formation: board.formation, tiles: board.tiles.length, rarityTiles: tiers, rarityFaces: uniqueTiers, art: Object.keys(counts).sort() };
    }
    async function checkRules() {
      await tap('Pause game'); await tap('Settings'); await tap('Rules');
      const text = await page.locator('.rules-content').innerText();
      assert.match(text, /all 30 pairs/i); assert.match(text, /First to 16/i);
      assert.doesNotMatch(text, /40 pairs|21 pairs/);
      await tap('Got it');
      if (await page.getByRole('heading', { name: 'Settings', exact: true }).count()) await tap('Done');
      if (await page.getByRole('dialog', { name: 'Paused', exact: true }).count()) await tap('Continue');
    }
    async function resultAndRank(outcome, baseline) {
      const title = outcome === 'win' ? 'Victory!' : 'A perfect tie!';
      for (let retry = 0; retry < 40 && !await page.getByRole('heading', { name: title, exact: true }).count(); retry++) await advance(400);
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      assert.match(await page.locator('.result-memory').innerText(), /30 pairs cleared/);
      const reward = outcome === 'win' ? 100 : 50;
      assert.match(await page.locator('.result-currency-reward').innerText(), new RegExp(`\\+${reward} Coins`));
      const progress = await stored();
      assert.equal(progress.currencies.coins, baseline.currencies.coins + reward);
      assert.equal(progress.counters.completedDuels, 1); assert.equal(progress.counters.completedWins, Number(outcome === 'win'));
      assert.equal(progress.ranking.position, outcome === 'win' ? 8500 : 10000);
      assert.equal(progress.pendingRankingPresentation.outcome, outcome);
      await advance(500); // Settle the result card's entrance before capturing it.
      await page.screenshot({ path: path.join(output, `${browserName}-${label}-result.png`), animations: 'disabled' });
      await tap('Continue'); await page.getByRole('heading', { name: 'Leaderboards', exact: true }).waitFor(); await advance(4000);
      assert.equal((await stored()).pendingRankingPresentation, null);
      assert.equal(await page.locator('.ranking-summary strong').first().innerText(), outcome === 'win' ? '#8,500' : '#10,000');
      await page.screenshot({ path: path.join(output, `${browserName}-${label}-ranking.png`), animations: 'disabled' });
      return { outcome, reward, rank: progress.ranking.position };
    }
    try {
      await page.goto(origin); await page.getByRole('heading', { name: 'Daily Rewards', exact: true }).waitFor(); await advance(400);
      await tap('Claim rewards'); await page.getByRole('heading', { name: 'Daily Quests', exact: true }).waitFor();
      await tap('Back to main menu'); await tap('Play');
      await page.getByRole('heading', { name: 'Choose a theme', exact: true }).waitFor();
      await tap(page.locator(`.theme-choice-card[data-theme="${themeId}"]`)); await tap('Play');
      await advance(4000); await advance(2500); await page.locator('.game-board').waitFor(); await advance(1000);
      const board = await inspectBoard();
      const details = scenario ? await scenario({ page, tap, tapTile, advance, stored, snapshot, checkRules, resultAndRank }) : {};
      assert.deepEqual(errors, []);
      reports.push({ label, viewport, themeId, edition, seed, ...board, ...details, errors });
      console.log(`PASS ${browserName}: ${label}`);
      return board;
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${browserName}-${label}-failure.png`), animations: 'disabled' }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  try {
    const representative = ['crown', 'turtle', 'moon-gate', 'twin-towers', 'diamond', 'bridge', 'serpent', 'lotus'];
    let firstBoard;
    for (const round of [0, 1]) for (const [index, theme] of themes.entries()) {
      const edition = rulesetForTheme(theme.id);
      const seed = seedFor(representative[round * themes.length + index]);
      const first = round === 0 && index === 0;
      if (outcomesOnly && !first) continue;
      const board = await run(`${theme.id}-${edition}-formation-${round + 1}`, { themeId: theme.id, seed, viewport: sizes[index] }, first ? async ui => {
        await ui.checkRules(); const baseline = await ui.stored();
        for (let matched = 0; matched < 30; matched++) {
          let pair;
          for (let retry = 0; retry < 20 && !pair; retry++) {
            const view = await ui.snapshot();
            for (let i = 0; i < view.free.length && !pair; i++) for (let j = i + 1; j < view.free.length; j++) if (view.free[i].face === view.free[j].face) { pair = [view.free[i].id, view.free[j].id]; break; }
            if (!pair) await ui.advance();
          }
          assert.ok(pair, `pair ${matched + 1} is available`); await ui.tapTile(pair[0]); await ui.tapTile(pair[1]);
          for (let retry = 0; retry < 30 && (await ui.snapshot()).remaining !== 60 - 2 * (matched + 1); retry++) await ui.advance();
          assert.equal((await ui.snapshot()).remaining, 60 - 2 * (matched + 1));
          if (matched === 14) assert.equal(await ui.page.locator('.duel-progress-labels strong').innerText(), 'First to 16', '15 pairs do not secure victory');
          if (matched === 15) {
            assert.equal(await ui.page.locator('.duel-progress-labels strong').innerText(), 'You secured the win');
            assert.equal((await ui.stored()).currencies.coins, baseline.currencies.coins, 'securing 16 pairs does not award coins before all 30 are cleared');
            assert.equal(await ui.page.locator('.result-card').count(), 0);
            await ui.page.screenshot({ path: path.join(output, `${browserName}-16-pairs-secured.png`), animations: 'disabled' });
          }
        }
        return ui.resultAndRank('win', baseline);
      } : undefined);
      if (first) firstBoard = { ...board, seed };
    }
    if (!outcomesOnly) {
      const alternate = await run('random-art-second-deal', { seed: seedFor('crown', firstBoard.seed + 1), viewport: sizes[1] });
      assert.notDeepEqual(alternate.art, firstBoard.art, 'different seeds draw different artwork within the same fixed rarity counts');
    }
    await run('fifteen-pair-tie', { seed: tie.seed, viewport: sizes[1] }, async ui => {
      const baseline = await ui.stored(); let actions = 0, final;
      for (let tick = 0; tick < 4000; tick++) {
        const view = await ui.snapshot();
        if (view.result) { final = view; break; }
        if (view.turn === 'you' && view.free.length >= 2 && !view.shown) {
          const ids = tie.actions[actions++]; assert.ok(ids, 'the browser follows the bounded tie input sequence');
          assert.ok(ids.every(id => view.free.some(tile => tile.id === id)), 'planned tie inputs are actually legal in the browser');
          await ui.tapTile(ids[0]); await ui.tapTile(ids[1]);
        }
        await ui.advance(200);
      }
      assert.ok(final, 'real opponent completes the tie within 800 virtual seconds');
      assert.equal(final.you, 15); assert.equal(final.ai, 15); assert.equal(final.remaining, 0);
      return { ...await ui.resultAndRank('tie', baseline), playerAttempts: actions, plannedAttempts: tie.actions.length };
    });
    fs.writeFileSync(path.join(output, `${browserName}${outcomesOnly ? '-outcomes' : ''}-report.json`), JSON.stringify(reports, null, 2));
    console.log(JSON.stringify({ browser: browserName, passed: reports.length, errors: [] }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
