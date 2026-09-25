// Real browser pacing checks. Observe browser clocks without replacing timers.
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/pacing-check.cjs [--webkit]
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const root = path.resolve(__dirname, '..');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';

(async () => {
  const engine = await import(pathToFileURL(path.join(root, 'src/engine.js')));
  const { GHOST_MEMORY_VERSION } = await import(pathToFileURL(path.join(root, 'src/ghost.js')));
  const deal = engine.createGame('western', 90421, 'calm', 'ming-porcelain', { formationId: 'crown' });
  const groups = new Map();
  for (const tile of deal.tiles) {
    if (!groups.has(tile.matchKey)) groups.set(tile.matchKey, []);
    groups.get(tile.matchKey).push(tile);
  }
  const pairs = [...groups.values()].slice(0, 4).map(group => group.slice(0, 2).map(tile => tile.id));
  const positions = Object.fromEntries(pairs.flatMap((pair, row) => pair.map((id, column) => [id, { x: column * 4, y: row, z: 0 }])));
  const fixture = {
    version: 3, ...deal, mode: 'duel', gameId: `pacing-${browserName}`, boardTheme: deal.theme,
    tiles: deal.tiles.map(tile => ({ ...tile, removed: !positions[tile.id], ...positions[tile.id] })),
    duelVersion: 1, turn: 'you', score: 1800, aiScore: 1800, attempts: 0, aiAttempts: 0,
    aiMemory: {}, ghostMemoryVersion: GHOST_MEMORY_VERSION, elapsed: 15, hints: 0, shuffles: 0, flips: 0,
    boosters: { shuffle: 3, hint: 3, freeze: 3, eagle: 3 }, freezeReady: false, hintEffect: null, eagleMs: 0,
    duelView: { revealed: [], pending: null },
  };
  assert.ok(engine.isCurrentCatalogueDeal(fixture));
  const browser = await playwright[browserName].launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [], timings = {};
  await context.addInitScript(() => {
    window.__pacing = { states: [], clicks: [], sounds: [], boardMounted: null };
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      const result = original.call(this, key, value);
      if (key === 'porcelain:session' && value !== 'null') {
        const game = JSON.parse(value);
        window.__pacing.states.push({ at: performance.now(), turn: game.turn, score: game.score,
          aiScore: game.aiScore, attempts: game.attempts, aiAttempts: game.aiAttempts,
          pending: game.duelView?.pending, revealed: game.duelView?.revealed || [] });
      }
      return result;
    };
    document.addEventListener('click', event => {
      const tile = event.target.closest?.('[data-tile-id]');
      if (tile) window.__pacing.clicks.push({ id: tile.dataset.tileId, at: performance.now() });
    }, true);
    if (window.AudioBufferSourceNode) {
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        const tile = document.querySelector('.flying-tile');
        window.__pacing.sounds.push({ at: performance.now(), duration: this.buffer?.duration,
          flightTime: tile?.getAnimations()[0]?.currentTime });
        return start.apply(this, args);
      };
    }
    new MutationObserver(() => {
      if (window.__pacing.boardMounted === null && document.querySelector('.game-board')) {
        window.__pacing.boardMounted = performance.now();
      }
    }).observe(document, { subtree: true, childList: true });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' });
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:session')));
  const trace = () => page.evaluate(() => window.__pacing);
  const wait = predicate => page.waitForFunction(predicate);
  function between(value, lower, upper, label) {
    assert.ok(value >= lower && value <= upper, `${label}: ${value.toFixed(1)} ms, expected ${lower}–${upper} ms`);
  }
  async function load(extra = {}, gentle = false) {
    await page.goto(origin);
    await page.evaluate(({ value, gentle }) => {
      localStorage.clear();
      localStorage.setItem('porcelain:session', JSON.stringify(value));
      localStorage.setItem('porcelain:sound', 'true');
      localStorage.setItem('porcelain:gentle', JSON.stringify(gentle));
    }, { value: { ...fixture, ...extra }, gentle });
    await page.reload();
    await button(/^Continue duel/).click();
    await page.locator('.game-board').waitFor();
    await wait(() => !document.querySelector('.door-transition'));
  }
  async function tap(id) {
    const point = await page.locator(`[data-tile-id="${id}"]`).evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    await page.mouse.click(point.x, point.y);
  }
  try {
    await load();
    await tap(pairs[0][0]); await tap(pairs[0][1]);
    await wait(() => window.__pacing.states.some(state => state.attempts === 1 && !state.pending));
    let evidence = await trace();
    const secondTap = evidence.clicks.find(click => click.id === pairs[0][1]);
    const firstDone = evidence.states.find(state => state.attempts === 1 && !state.pending);
    timings.humanMatch = firstDone.at - secondTap.at;
    between(timings.humanMatch, 340, 600, 'human match accepts the next move quickly');
    const flight = evidence.states.find(state => state.pending?.kind === 'collision');
    const impact = evidence.sounds.find(sound => sound.at >= flight.at && sound.at <= firstDone.at && sound.duration < .2);
    assert.ok(impact, 'the ceramic impact is played at collision');
    between(impact.flightTime, 105, 205, 'sound stays aligned with the 160 ms visual impact');
    // Deliberately play the next pair while the previous ceramic debris is alive.
    assert.ok(await page.locator('.ceramic-chip').count(), 'particle tail is still visible when input returns');
    await tap(pairs[1][0]); await tap(pairs[1][1]);
    await wait(() => window.__pacing.states.some(state => state.attempts === 2 && !state.pending));
    const game = await stored();
    assert.equal(game.score, 2000); assert.equal(engine.remainingCount(game.tiles), 4); assert.equal(game.turn, 'you');
    console.log(`PASS ${browserName}: match resolves in ${timings.humanMatch.toFixed(0)} ms; sound aligned; immediate next pair scores once`);

    const known = Object.fromEntries(pairs[0].map(id => [id, { key: fixture.tiles.find(tile => tile.id === id).matchKey, turn: 0 }]));
    await load({ aiMemory: known }, true);
    await tap(pairs[1][0]); await tap(pairs[2][0]);
    await wait(() => window.__pacing.states.some(state => state.aiAttempts === 1));
    evidence = await trace();
    const missTap = evidence.clicks.find(click => click.id === pairs[2][0]);
    const handoff = evidence.states.find(state => state.attempts === 1 && state.turn === 'ai' && !state.pending);
    const firstFlip = evidence.states.find(state => state.attempts === 1 && state.pending?.kind === 'ai-reveal');
    const secondFlip = evidence.states.find(state => state.attempts === 1 && state.pending?.kind === 'pair' && state.pending.actor === 'ai');
    assert.ok(handoff && firstFlip && secondFlip, 'both ghost reveals and the handoff were observed');
    timings.mismatch = handoff.at - missTap.at;
    timings.ghostStart = firstFlip.at - handoff.at;
    timings.ghostFlipGap = secondFlip.at - firstFlip.at;
    between(timings.mismatch, 800, 1150, 'mismatch viewing interval');
    between(timings.ghostStart, 220, 500, 'ghost starts after a short handoff');
    between(timings.ghostFlipGap, 210, 450, 'ghost reveals its second tile promptly');
    assert.equal((await stored()).aiScore, 1900);
    console.log(`PASS ${browserName}: mismatch ${timings.mismatch.toFixed(0)} ms; ghost starts ${timings.ghostStart.toFixed(0)} ms later; flip gap ${timings.ghostFlipGap.toFixed(0)} ms`);

    await load();
    // Pause as soon as the real flight mounts, before the shortened impact timer.
    await page.evaluate(() => {
      const observer = new MutationObserver(() => {
        if (!document.querySelector('.match-flight')) return;
        observer.disconnect();
        document.querySelector('[aria-label="Pause game"]').click();
      });
      observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    });
    await tap(pairs[0][0]); await tap(pairs[0][1]);
    await page.getByRole('dialog', { name: 'Paused', exact: true }).waitFor();
    const paused = await stored();
    assert.equal(paused.duelView.pending.kind, 'collision');
    assert.equal(paused.score, 1800); assert.equal(paused.attempts, 0);
    await page.waitForTimeout(450);
    assert.equal((await stored()).score, 1800, 'collision never resolves while paused');
    await button('Continue').click();
    await wait(() => window.__pacing.states.some(state => state.attempts === 1 && !state.pending));
    await page.waitForTimeout(1050);
    const resumed = await stored();
    assert.equal(resumed.score, 1900); assert.equal(resumed.attempts, 1);
    assert.equal(engine.remainingCount(resumed.tiles), 6);
    assert.equal(await page.locator('.match-flight').count(), 0);
    console.log(`PASS ${browserName}: pausing before impact freezes resolution; resume scores exactly once`);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ browser: browserName, timings, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
