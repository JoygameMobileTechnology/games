/* Run against Vite or a hosted build:
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/remake-check.cjs [--webkit]
 * Fixtures retain the current catalogue's complete 80-tile inventory. Only
 * public save data is seeded; clicks, timers and profile edits use the real UI.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const profile = { version: 1, name: 'Test Player', avatarId: 'avatar-3', countryCode: 'TR' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const engine = await import(pathToFileURL(path.join(root, 'src/engine.js')));
  const { createDuelState } = await import(pathToFileURL(path.join(root, 'src/duel.js')));
  const { playGhostTurn, GHOST_MEMORY_VERSION, GHOST_MEMORY_TURNS } = await import(pathToFileURL(path.join(root, 'src/ghost.js')));
  assert.equal(GHOST_MEMORY_VERSION, 3);
  assert.equal(GHOST_MEMORY_TURNS, 2);
  const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await playwright[browserName].launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' });
  const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:session')));
  const remaining = game => engine.remainingCount(game.tiles);
  const stone = id => page.locator(`.game-board [data-tile-id="${id}"]`);

  function deal(ruleset = 'eastern', seed = 90421) { return engine.createGame(ruleset, seed, 'calm', 'ming-porcelain'); }
  function openPairs(number = 4) {
    const game = deal();
    const groups = new Map();
    for (const tile of game.tiles) { if (!groups.has(tile.matchKey)) groups.set(tile.matchKey, []); groups.get(tile.matchKey).push(tile); }
    const pairs = [...groups.values()].slice(0, number).map(group => group.slice(0, 2).map(tile => tile.id));
    const positions = Object.fromEntries(pairs.flatMap((pair, row) => pair.map((id, column) => [id, { x: column * 5, y: row, z: 0 }])));
    return { ...game, pairs, tiles: game.tiles.map(tile => ({ ...tile, removed: !positions[tile.id], ...positions[tile.id] })) };
  }
  function savedGame(game, extra = {}) {
    const cleared = (80 - remaining(game)) / 2;
    return { version: 3, ...game, mode: 'duel', ...createDuelState(), elapsed: 12, hints: 0, shuffles: 0, flips: 0,
      score: Math.floor(cleared / 2) * 100, aiScore: Math.ceil(cleared / 2) * 100,
      aiMemory: {}, ghostMemoryVersion: GHOST_MEMORY_VERSION, duelView: { revealed: [], pending: null }, ...extra };
  }
  async function waitState(predicate, label, timeout = 12000) {
    const deadline = Date.now() + timeout;
    let value;
    while (Date.now() < deadline) {
      value = await session();
      if (value && predicate(value)) return value;
      await sleep(30);
    }
    throw new Error(`Timed out: ${label}; state=${JSON.stringify(value && { turn: value.turn, score: value.score, aiScore: value.aiScore, attempts: value.attempts, aiAttempts: value.aiAttempts, pending: value.duelView?.pending?.kind, remaining: remaining(value) })}`);
  }
  async function reset(withProfile = true) {
    await page.goto(origin);
    await page.evaluate(({ profile, withProfile }) => {
      localStorage.clear(); localStorage.setItem('porcelain:language', '"en"');
      if (withProfile) localStorage.setItem('porcelain:profile', JSON.stringify(profile));
      localStorage.setItem('porcelain:sound', 'false');
      localStorage.setItem('porcelain:gentle', 'true');
    }, { profile, withProfile });
    await page.reload(); await button('Play').waitFor();
  }
  async function fixture(game, extra = {}, start = true) {
    const value = savedGame(game, extra);
    assert.ok(engine.isCurrentCatalogueDeal(value), 'fixture uses the active four-copy catalogue');
    await page.goto(origin);
    await page.evaluate(({ value, profile }) => {
      localStorage.setItem('porcelain:session', JSON.stringify(value));
      localStorage.setItem('porcelain:profile', JSON.stringify(profile));
      localStorage.setItem('porcelain:sound', 'false'); localStorage.setItem('porcelain:gentle', 'true');
    }, { value, profile });
    await page.reload(); await button('Play').waitFor();
    if (start) {
      await button(remaining(value) ? /^Continue duel/ : /^View results/).click();
      if (remaining(value)) await page.locator('.game-board').waitFor();
    }
    return value;
  }
  async function clickStone(id) {
    const point = await stone(id).evaluate(node => {
      const rect = node.getBoundingClientRect();
      for (const fy of [.5, .95, .05]) for (const fx of [.5, .95, .05]) {
        const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
        if (document.elementFromPoint(x, y)?.closest('[data-tile-id]') === node) return { x, y };
      }
      return null;
    });
    assert.ok(point, `tile ${id} has a real exposed pointer target`);
    await page.mouse.click(point.x, point.y);
  }
  async function match(ids, expectedRemaining) {
    await clickStone(ids[0]); await clickStone(ids[1]);
    if (!expectedRemaining) await page.getByRole('dialog', { name: 'Game results' }).waitFor();
    else {
      await waitState(value => remaining(value) === expectedRemaining && !value.duelView?.pending, 'matched pair settles');
      await page.waitForFunction(() => !document.querySelector('.match-flight'));
    }
  }
  const knowledge = (game, ids, turn) => Object.fromEntries(ids.map(id => [id, { key: game.tiles.find(tile => tile.id === id).matchKey, turn }]));
  async function pause() { await button('Pause game').click(); await page.getByRole('dialog', { name: 'Paused' }).waitFor(); await sleep(80); }
  const progress = game => ({ tiles: game.tiles, turn: game.turn, score: game.score, aiScore: game.aiScore, attempts: game.attempts, aiAttempts: game.aiAttempts, elapsed: game.elapsed });
  async function winner(outcome, you, ghost) {
    const dialog = page.getByRole('dialog', { name: 'Game results' }); await dialog.waitFor();
    assert.equal(await dialog.locator('h2').innerText(), { win: 'Victory!', tie: 'A perfect tie!', lose: 'Well played!' }[outcome]);
    const scores = await dialog.locator('.result-stats strong').allTextContents();
    assert.equal(Number(scores[0].replaceAll(',', '')), you); assert.equal(Number(scores[1].replaceAll(',', '')), ghost);
    assert.equal(await session(), null, 'finished results clear the resumable save');
  }

  try {
    await reset(false);
    assert.equal(await button('Solo').count(), 0);
    assert.equal(await page.getByRole('group', { name: /difficulty/i }).count(), 0);
    await page.waitForFunction(() => localStorage.getItem('porcelain:profile'));
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:profile'))),
      { version: 1, name: 'Player', avatarId: 'avatar-1', countryCode: '' });
    assert.match(await button('Edit profile').innerText(), /Player/);
    assert.equal(await page.evaluate(() => localStorage.getItem('porcelain:profileCreated')), null);
    await button('Play').click(); await page.locator('.game-board').waitFor();
    assert.equal(await page.getByRole('form', { name: 'Player profile' }).count(), 0, 'a fresh player can start without profile setup');
    let state = await waitState(value => value.mode === 'duel', 'default profile starts a duel directly');
    assert.equal(state.difficulty, 'calm'); assert.equal(state.turn, 'you'); assert.equal(remaining(state), 80);
    assert.equal(state.ghostMemoryVersion, GHOST_MEMORY_VERSION);
    assert.equal(await page.locator('.game-tile[data-face-up="true"]').count(), 0);
    assert.match(await page.locator('.opponent').innerText(), /Player’s Ghost/);
    assert.deepEqual(await page.locator('.scoreboard .player-avatar').evaluateAll(nodes => nodes.map(node => node.dataset.avatarId)), ['avatar-1', 'avatar-1']);
    await pause(); await button('Save & return home').click(); await button('Edit profile').click();
    await page.getByRole('dialog', { name: 'Profile', exact: true }).waitFor();
    const editor = page.getByRole('form', { name: 'Player profile' }); await editor.waitFor();
    await editor.locator('input[name="playerName"]').fill(''); await button('Save profile').click();
    assert.match(await page.getByRole('alert').innerText(), /Enter a player name/);
    await editor.locator('input[name="playerName"]').fill('Ada');
    await button(/^Avatar 5:/).click(); await editor.locator('select[name="countryCode"]').selectOption('JP');
    await button('Save profile').click(); await button('Play').waitFor();
    assert.equal(await page.locator('.game-board').count(), 0, 'saving an optional profile returns to the menu');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:profile'))),
      { version: 1, name: 'Ada', avatarId: 'avatar-5', countryCode: 'JP' });
    await page.reload();
    assert.match(await button('Edit profile').innerText(), /Ada/);
    await button('Edit profile').click();
    assert.equal(await page.locator('input[name="playerName"]').inputValue(), 'Ada');
    assert.equal(await page.locator('select[name="countryCode"]').inputValue(), 'JP');
    assert.equal(await button(/^Avatar 5:/).getAttribute('aria-pressed'), 'true'); await button('Close dialog').click();
    await button('Play').click(); await page.locator('.game-board').waitFor();
    assert.match(await page.locator('.opponent').innerText(), /Ada’s Ghost/);
    assert.deepEqual(await page.locator('.scoreboard .player-avatar').evaluateAll(nodes => nodes.map(node => node.dataset.avatarId)), ['avatar-5', 'avatar-5']);
    console.log('PASS immediate default-profile play, optional profile validation/persistence, updated own-profile ghost and fixed calm Duel');

    await reset(); await button('How to play').click();
    assert.match(await page.getByRole('dialog').innerText(), /simulated opponent with imperfect memory/);
    assert.match(await page.getByRole('dialog').innerText(), /1\.8 seconds/);
    assert.doesNotMatch(await page.getByRole('dialog').innerText(), /season wildcard|flower wildcard/); await button('Got it').click();
    await button('Choose tile theme').click(); assert.equal(await page.locator('.collection-row').count(), 9);
    await page.locator('.collection-row').filter({ has: page.locator('strong', { hasText: 'Neon Shrine' }) }).click();
    await page.getByRole('tab', { name: 'Background', exact: true }).click(); assert.equal(await page.locator('.background-swatch').count(), 9);
    await page.locator('.background-swatch').filter({ hasText: 'Guo Xi' }).click(); await button('Confirm').click();
    await button('Western').click(); await button('Play').click(); await page.locator('.game-board').waitFor();
    state = await waitState(value => value.ruleset === 'western', 'Western selection applies');
    assert.equal(state.theme, 'neon-shrine'); assert.equal(state.boardTheme, 'guo-xi'); assert.equal(state.difficulty, 'calm');
    assert.equal(Object.hasOwn(state, 'aiTiles'), false); assert.equal(await page.locator('.game-board').count(), 1);
    console.log('PASS rules copy, all nine themes, independent board choice and Western exact-picture round');

    let game = openPairs(4), initial = await fixture(game);
    await clickStone(game.pairs[0][0]);
    state = await waitState(value => value.duelView.revealed.length === 1, 'human first flip appears');
    assert.deepEqual(state.aiMemory, knowledge(game, [game.pairs[0][0]], 0), 'human first face is learned immediately');
    assert.equal(Object.hasOwn(state.aiMemory, game.pairs[0][1]), false, 'hidden partner is not learned early');
    await pause(); await button('Save & return home').click(); await page.reload();
    await button(/^Continue duel/).click(); await page.locator('.game-board').waitFor();
    assert.deepEqual((await session()).aiMemory, knowledge(game, [game.pairs[0][0]], 0), 'visible observation survives pause and reload');
    await clickStone(game.pairs[0][1]);
    state = await waitState(value => value.duelView?.pending?.kind === 'pair', 'human second face appears');
    assert.deepEqual(state.aiMemory, knowledge(game, game.pairs[0], 0), 'human second face is learned when revealed');
    await waitState(value => remaining(value) === 6 && !value.duelView?.pending, 'human match settles');
    await page.waitForFunction(() => !document.querySelector('.match-flight'));
    assert.deepEqual((await session()).aiMemory, {}, 'removed faces are pruned from memory');
    await match(game.pairs[1], 4);
    state = await session(); assert.equal(state.score, initial.score + 200); assert.equal(state.aiScore, initial.aiScore);
    assert.equal(state.turn, 'you'); assert.equal(state.attempts, 2);
    console.log('PASS human first/second reveals teach only visible faces, survive reload, and matching streaks retain turn at100 points');

    game = openPairs(4);
    const knownPair = game.pairs[3];
    const known = knowledge(game, knownPair, 0);
    let seed = 1;
    initial = await fixture(game, { seed, aiMemory: known });
    const humanMiss = [game.pairs[0][0], game.pairs[1][0]];
    await clickStone(humanMiss[0]); await clickStone(humanMiss[1]);
    state = await waitState(value => value.duelView?.pending?.actor === 'you', 'human mismatch stays visible');
    assert.deepEqual(state.aiMemory, { ...known, ...knowledge(game, humanMiss, 0) }, 'both faces of a human mismatch are learned');
    await waitState(value => value.turn === 'ai', 'mismatch passes turn');
    const guardBefore = await session(); await clickStone(game.pairs[2][0]);
    assert.equal((await session()).attempts, guardBefore.attempts, 'human input is ignored during ghost turn');
    state = await waitState(value => value.duelView?.pending?.kind === 'ai-reveal', 'first ghost tile is visible');
    assert.deepEqual([...state.duelView.pending.ids].sort(), [...knownPair].sort(), 'ghost always chooses the learned legal pair');
    for (const id of state.duelView.pending.ids) assert.ok(engine.isFree(state.tiles.find(tile => tile.id === id), state.tiles));
    assert.equal(state.duelView.revealed.length, 1);
    const observedFirst = state.duelView.revealed[0];
    assert.equal(state.aiMemory[observedFirst].turn, 1, 'ghost refreshes its first observation at the current attempt index');
    await pause(); const paused = progress(await session()), pausedMemory = (await session()).aiMemory;
    await sleep(1300); assert.deepEqual(progress(await session()), paused); assert.deepEqual((await session()).aiMemory, pausedMemory);
    await button('Save & return home').click(); const snapshot = await session(); assert.equal(snapshot.turn, 'ai');
    await page.reload(); await button(/^Continue duel/).click(); await page.locator('.game-board').waitFor();
    state = await waitState(value => value.aiScore === initial.aiScore + 100, 'saved ghost pair resumes once');
    await pause(); assert.equal(state.turn, 'ai'); assert.equal(state.score, initial.score); assert.equal(remaining(state), 6);
    assert.equal(state.aiAttempts, 1); assert.equal(state.attempts, 1);
    assert.deepEqual(state.aiMemory, knowledge(game, humanMiss, 0), 'two-attempt-old human observations remain after the ghost match');
    console.log('PASS human mismatch learning, learned-pair priority, legal visible ghost selection, input guard and timestamped pause/reload');

    game = openPairs(4); seed = 1;
    while (playGhostTurn(game.tiles, {}, seed, 0).matched) seed += 1;
    initial = await fixture(game, { turn: 'ai', seed, aiMemory: {} });
    state = await waitState(value => value.duelView?.pending?.kind === 'ai-reveal', 'blind ghost first reveal');
    const blindIds = state.duelView.pending.ids;
    assert.deepEqual(state.aiMemory, knowledge(game, [blindIds[0]], 0), 'only the already visible first face enters memory');
    assert.equal(Object.hasOwn(state.aiMemory, blindIds[1]), false, 'the unrevealed second face is not learned early');
    assert.equal(Object.hasOwn(state.duelView.pending, 'ghostMemory'), false, 'pending saves do not carry future observations');
    state = await waitState(value => value.duelView?.pending?.kind === 'pair', 'blind ghost second reveal');
    assert.deepEqual(state.aiMemory, knowledge(game, blindIds, 0));
    state = await waitState(value => value.turn === 'you' && value.aiAttempts === 1 && !value.duelView.pending, 'ghost mismatch returns control');
    assert.equal(state.score, initial.score); assert.equal(state.aiScore, initial.aiScore); assert.equal(remaining(state), 8);
    assert.deepEqual(state.aiMemory, knowledge(game, blindIds, 0));
    assert.equal(await page.locator('.game-tile[data-face-up="true"]').count(), 0);
    await match(game.pairs[0], 6); assert.equal((await session()).score, initial.score + 100);
    console.log('PASS ghost learns each own face only when visible; a miss returns a playable human turn without points');

    game = openPairs(6); initial = await fixture(game);
    await button(/Peek/).click();
    state = await waitState(value => value.hints === 1 && value.duelView?.pending?.kind === 'peek', 'Peek teaches the full exposed set');
    const peekedIds = game.tiles.filter(tile => !tile.removed).map(tile => tile.id);
    assert.deepEqual(state.aiMemory, knowledge(game, peekedIds, 0), 'Peek has no four-face cap');
    await waitState(value => !value.duelView.pending, 'Peek finishes before matching streak');
    await match(game.pairs[0], 10);
    state = await session();
    assert.deepEqual(state.aiMemory, knowledge(game, peekedIds.filter(id => !game.pairs[0].includes(id)), 0));
    await match(game.pairs[1], 8);
    state = await session();
    assert.equal(state.attempts + state.aiAttempts, 2);
    assert.deepEqual(state.aiMemory, knowledge(game, peekedIds.filter(id => !game.pairs.slice(0, 2).flat().includes(id)), 0), 'turn0 stays in the two-completed-attempt window');
    await match(game.pairs[2], 6);
    state = await session(); assert.equal(state.turn, 'you'); assert.equal(state.attempts, 3);
    assert.deepEqual(state.aiMemory, {}, 'turn0 expires when the current attempt index becomes3, even without actor handoff');
    assert.equal(state.score, initial.score + 300);
    console.log('PASS Peek remembers more than four faces; two completed attempts remain, and the third retained-turn match expires old faces');

    game = openPairs(4);
    const refreshed = game.pairs[0][0], stale = game.pairs[2][0], other = game.pairs[1][0];
    initial = await fixture(game, { attempts: 2, aiMemory: knowledge(game, [refreshed, stale], 0) });
    await clickStone(refreshed);
    state = await waitState(value => value.duelView.revealed.length === 1, 'old face is observed again');
    assert.deepEqual(state.aiMemory[refreshed], knowledge(game, [refreshed], 2)[refreshed]);
    assert.equal(state.aiMemory[stale].turn, 0, 'unseen old face is not refreshed');
    await clickStone(other);
    state = await waitState(value => value.turn === 'ai' && value.attempts === 3, 'refreshed human mismatch settles');
    await pause();
    assert.deepEqual(state.aiMemory, knowledge(game, [refreshed, other], 2), 'new observations survive while untouched turn0 expires');
    assert.equal(state.score, initial.score); assert.equal(state.aiScore, initial.aiScore);
    console.log('PASS repeated human reveals refresh timestamps; untouched older faces expire on mismatch resolution');

    game = openPairs(6);
    const windowIds = game.pairs.map(pair => pair[0]);
    const timestamped = Object.fromEntries(windowIds.map((id, index) => [id, { key: game.tiles.find(tile => tile.id === id).matchKey, turn: [1, 2, 3, 4, 5, -1][index] }]));
    const inWindow = { ...knowledge(game, [windowIds[1]], 2), ...knowledge(game, [windowIds[2]], 3), ...knowledge(game, [windowIds[3]], 4) };
    await fixture(game, { attempts: 3, aiAttempts: 1, aiMemory: timestamped });
    state = await waitState(value => Object.keys(value.aiMemory).length === 3, 'resume filters expired, future and invalid timestamps');
    assert.deepEqual(state.aiMemory, inWindow);
    await pause(); await button('Save & return home').click(); await page.reload();
    await button(/^Continue duel/).click(); await page.locator('.game-board').waitFor();
    assert.deepEqual((await session()).aiMemory, inWindow, 'pause/reload preserves retained timestamps instead of refreshing hidden tiles');
    console.log('PASS reload validates timestamp window and preserves only the two completed attempts plus current observations');

    game = openPairs(4);
    const legacyIds = [game.pairs[0][0], game.pairs[1][0]];
    const legacyKnowledge = Object.fromEntries(game.tiles.filter(tile => !tile.removed).map(tile => [tile.id, tile.matchKey]));
    initial = await fixture(game, { turn: 'ai', attempts: 7, aiAttempts: 6, ghostMemoryVersion: undefined,
      aiMemory: legacyKnowledge, duelView: { revealed: [legacyIds[0]], pending: {
        key: 999, kind: 'ai-reveal', ids: legacyIds, actor: 'ai', duration: 900, ghostMemory: legacyKnowledge,
      } } });
    state = await waitState(value => value.ghostMemoryVersion === GHOST_MEMORY_VERSION, 'legacy ghost memory migrates');
    assert.deepEqual(state.aiMemory, knowledge(game, [legacyIds[0]], 13), 'legacy unbounded knowledge is cleared, but the currently visible face is relearned');
    assert.equal(Object.hasOwn(state.duelView.pending, 'ghostMemory'), false);
    assert.deepEqual(state.duelView.pending.ids, legacyIds, 'legacy committed move is not rerolled');
    assert.deepEqual(state.tiles, initial.tiles); assert.equal(state.turn, initial.turn);
    assert.equal(state.score, initial.score); assert.equal(state.aiScore, initial.aiScore);
    assert.equal(state.attempts, initial.attempts); assert.equal(state.aiAttempts, initial.aiAttempts);
    state = await waitState(value => value.duelView?.pending?.kind === 'pair', 'legacy committed second tile reveals');
    assert.deepEqual(state.duelView.revealed, legacyIds);
    assert.deepEqual(state.aiMemory, knowledge(game, legacyIds, 13), 'only actually visible legacy faces are relearned');
    state = await waitState(value => value.turn === 'you' && !value.duelView.pending, 'legacy committed miss completes once');
    assert.equal(state.score, initial.score); assert.equal(state.aiScore, initial.aiScore);
    assert.equal(state.attempts, initial.attempts); assert.equal(state.aiAttempts, initial.aiAttempts + 1);
    assert.equal(remaining(state), 8);
    console.log('PASS legacy memory migration relearns visible faces while preserving board, scores and the committed ghost turn');

    game = deal('eastern', 123); const ids = game.solution[0];
    await fixture(game, { flips: 2, duelView: { revealed: ids, pending: { key: 123, kind: 'pair', ids, matched: true, actor: 'you', duration: 50 } } });
    state = await waitState(value => remaining(value) === 78 && value.score === 100 && !value.duelView?.pending, '50ms saved pair waits for mounted board');
    assert.equal(state.turn, 'you');
    console.log('PASS short saved match resumes after the returning board mounts');

    await fixture(deal());
    for (let use = 1; use <= 3; use += 1) {
      await button(/Peek/).click(); state = await waitState(value => value.hints === use, 'Peek count advances');
      assert.equal(state.duelView.revealed.length, state.tiles.filter(tile => engine.isFree(tile, state.tiles)).length);
      assert.equal(state.attempts, 0); assert.equal(state.score, 0);
      const exposed = state.tiles.filter(tile => engine.isFree(tile, state.tiles)).map(tile => tile.id);
      assert.ok(exposed.length > 4);
      assert.deepEqual(state.aiMemory, knowledge(state, exposed, 0), 'Peek learns every exposed face and no covered identity');
      state = await waitState(value => !value.duelView.pending && !value.duelView.revealed.length, 'Peek conceals tiles again');
      assert.deepEqual(state.aiMemory, knowledge(state, exposed, 0), 'Peek knowledge survives concealment without advancing the attempt index');
    }
    assert.equal(await button(/Peek/).isDisabled(), true);
    await button('Shuffle').click(); state = await waitState(value => value.shuffles === 1, 'manual shuffle');
    assert.deepEqual(state.aiMemory, {}); assert.equal(state.hints, 3); assert.equal(state.turn, 'you');
    console.log('PASS three Peeks, no score/turn cost, exhausted control and shuffle clearing ghost memory');

    for (const [outcome, extra, you, ghost] of [
      ['win', { score: 2000, aiScore: 1900 }, 2100, 1900],
      ['tie', { score: 1900, aiScore: 2000 }, 2000, 2000],
      ['lose', { score: 1900, aiScore: 2000, turn: 'ai' }, 1900, 2100],
    ]) {
      game = openPairs(1); await fixture(game, extra);
      if (extra.turn !== 'ai') await match(game.pairs[0], 0);
      await winner(outcome, you, ghost);
    }
    game = deal(); game.tiles = game.tiles.map(tile => ({ ...tile, removed: true }));
    await fixture(game, { score: 2000, aiScore: 2000 }); await winner('tie', 2000, 2000);
    console.log('PASS final win, tie, ghost win and completed saved results');

    await fixture(deal(), { mode: 'solo' }, false);
    assert.equal(await button(/^Continue duel/).count(), 0, 'old solo saves cannot enter the Duel-only remake');
    await page.evaluate(() => {
      localStorage.setItem('porcelain:difficulty', JSON.stringify('intricate'));
      localStorage.setItem('porcelain:gentle', 'false');
    }); await page.reload();
    await button('Play').click(); state = await waitState(value => value.mode === 'duel', 'new Duel replaces incompatible solo save');
    assert.equal(state.difficulty, 'calm'); assert.equal(remaining(state), 80);
    await page.waitForFunction(() => document.querySelector('.game-screen') && !document.querySelector('.game-screen').inert && !document.querySelector('.door-transition'));
    const first = state.tiles.filter(tile => engine.isFree(tile, state.tiles)).sort((a, b) => b.z - a.z)[0];
    await clickStone(first.id);
    await page.waitForFunction(id => document.querySelector(`[data-tile-id="${id}"]`)?.dataset.faceUp === 'true', first.id);
    assert.deepEqual(errors, []);
    console.log(`PASS old Solo rejection, fixed calm, normal doors finish and unlock play; no browser errors (${browserName})`);
  } catch (error) {
    const directory = path.join(root, 'tmp', 'remake-check'); fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, `${browserName}-failure.png`), fullPage: true }).catch(() => {});
    console.error('Browser errors:', errors); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
