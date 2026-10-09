/* Real UI coverage of Realistic pacing, pause/resume and completed-duel learning.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/realistic-ai-check.cjs [--webkit] [--completion-only]
 * Tile identities choose test clicks only; opponent state and results are never injected.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const output = path.resolve('tmp/realistic-ai');

async function checkCompletedProfile(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
  await context.addInitScript(() => {
    localStorage.setItem('porcelain:gentle', 'true');
    localStorage.setItem('porcelain:sound', 'false');
  });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  const time = new Date('2026-09-29T12:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
  const advance = async (ms = 250) => { await page.clock.runFor(ms); await page.evaluate(() => document.body.childElementCount); };
  const button = name => page.getByRole('button', { name, exact: true });
  const profile = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:realisticSkill')));
  async function tap(name) {
    const control = typeof name === 'string' ? button(name) : name;
    await control.waitFor(); await control.scrollIntoViewIfNeeded();
    const rect = await control.boundingBox();
    assert.ok(rect, `${name} is visible`);
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2); await advance();
  }
  async function tapTile(id) {
    let point;
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
    assert.ok(point, `${id} has an exposed pointer target`);
    await page.mouse.click(point.x, point.y);
  }
  const snapshot = () => page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.game-tile')];
    return {
      remaining: nodes.length,
      free: nodes.filter(node => node.dataset.free === 'true' && node.getAttribute('aria-disabled') === 'false').map(node => ({ id: node.dataset.tileId, face: node.querySelector('.tile-front img').src })),
    };
  });
  async function launch() {
    await tap('Play');
    await page.getByRole('heading', { name: 'Choose a theme', exact: true }).waitFor();
    await tap('Play'); await advance(4000); await advance(1500);
    await page.locator('.game-board').waitFor(); await advance(1000);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:aiMode'))), 'realistic');
  }
  async function matchPair(matched, unchangedProfile) {
    let pair;
    for (let retry = 0; retry < 20 && !pair; retry++) {
      const view = await snapshot();
      for (let i = 0; i < view.free.length && !pair; i++) for (let j = i + 1; j < view.free.length; j++) {
        if (view.free[i].face === view.free[j].face) { pair = [view.free[i].id, view.free[j].id]; break; }
      }
      if (!pair) await advance();
    }
    assert.ok(pair, `matching pair ${matched + 1} is available`);
    await tapTile(pair[0]);
    assert.deepEqual(await profile(), unchangedProfile, 'revealing the first card never trains the persistent profile');
    await tapTile(pair[1]);
    assert.deepEqual(await profile(), unchangedProfile, 'profile waits for the complete pair resolution');
    for (let retry = 0; retry < 30 && (await snapshot()).remaining !== 60 - 2 * (matched + 1); retry++) await advance();
    assert.equal((await snapshot()).remaining, 60 - 2 * (matched + 1));
    if (matched < 29) assert.deepEqual(await profile(), unchangedProfile, 'an incomplete duel never trains the persistent profile');
  }
  try {
    await page.goto(origin);
    await page.getByRole('heading', { name: 'Daily Rewards', exact: true }).waitFor();
    await advance(400); await tap('Claim rewards');
    await page.getByRole('heading', { name: 'Daily Quests', exact: true }).waitFor();
    await tap('Back to main menu'); await launch();
    const baseline = await profile();
    assert.equal(baseline, null, 'a new player has no completed-duel training record');
    for (let matched = 0; matched < 30; matched++) await matchPair(matched, baseline);
    const learned = await profile();
    assert.equal(learned.version, 1);
    assert.ok(Math.abs(learned.level - .535) < 1e-12, '30 unassisted matches move skill from .5 to .535');
    assert.equal(learned.completedGames, 1);
    assert.ok(typeof learned.lastGameId === 'string' && learned.lastGameId.length > 0);
    await advance(4000);
    await page.getByRole('heading', { name: 'Victory!', exact: true }).waitFor();
    assert.deepEqual(await profile(), learned, 'result presentation does not train the same duel again');
    await page.screenshot({ path: path.join(output, `${browserName}-completion.png`), animations: 'disabled' });
    await page.reload(); await advance(400);
    assert.deepEqual(await profile(), learned, 'reload retains skill and does not train twice');
    await launch(); await matchPair(0, learned);
    // Duels deliberately have no saved session; reloading abandons this board.
    await page.reload(); await advance(400);
    await button('Play').waitFor();
    assert.deepEqual(await profile(), learned, 'abandoning a later duel preserves the learned profile');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, `${browserName}-completion-report.json`), JSON.stringify({ browserName, learned, matchedPairs: 30, abandonedNextDuel: true, errors }, null, 2));
    console.log(`PASS ${browserName}: 30 real matching pairs train once to .535; result/reload persist; abandoned next duel does not train`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${browserName}-completion-failure.png`), animations: 'disabled' }).catch(() => {});
    throw error;
  } finally { await context.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch();
  if (process.argv.includes('--completion-only')) {
    try { await checkCompletedProfile(browser); } finally { await browser.close(); }
    return;
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
  await context.addInitScript(() => {
    localStorage.setItem('porcelain:gentle', 'true');
    localStorage.setItem('porcelain:sound', 'false');
  });
  const page = await context.newPage(), errors = [], timings = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  const time = new Date('2026-09-29T12:00:00Z');
  await page.clock.install({ time }); await page.clock.pauseAt(time);
  const advance = async ms => { await page.clock.runFor(ms); await page.evaluate(() => document.body.childElementCount); };
  const button = name => page.getByRole('button', { name, exact: true });
  async function tap(name, settle = 0) {
    const control = button(name);
    await control.waitFor(); await control.scrollIntoViewIfNeeded();
    const rect = await control.boundingBox();
    assert.ok(rect, `${name} is visible`);
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await advance(settle);
  }
  const snapshot = () => page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.game-tile')];
    return {
      at: performance.now(), turn: document.querySelector('.duel-scoreboard')?.dataset.turn,
      free: nodes.filter(node => node.dataset.free === 'true' && node.getAttribute('aria-disabled') === 'false').map(node => ({ id: node.dataset.tileId, face: node.querySelector('.tile-front img').src })),
      shown: nodes.filter(node => node.dataset.faceUp === 'true').map(node => node.dataset.tileId),
      tiles: nodes.map(node => node.dataset.tileId),
      score: document.querySelector('.duel-scoreboard')?.textContent,
    };
  });
  async function until(predicate, label, max = 60000) {
    for (let elapsed = 0; elapsed <= max; elapsed += 25) {
      const view = await snapshot();
      if (predicate(view)) return view;
      await advance(25);
    }
    throw new Error(`Timed out waiting for ${label}`);
  }
  async function tapTile(id) {
    const point = await page.locator(`[data-tile-id="${id}"]`).evaluate(node => {
      const rect = node.getBoundingClientRect();
      for (const fy of [.5, .9, .1]) for (const fx of [.5, .9, .1]) {
        const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
        if (document.elementFromPoint(x, y)?.closest('[data-tile-id]') === node) return { x, y };
      }
    });
    assert.ok(point, `${id} has an exposed pointer target`);
    await page.mouse.click(point.x, point.y);
  }
  async function visibility(hidden) {
    await page.evaluate(hidden => {
      if (hidden) Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      else delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
    await advance(0);
  }
  const progress = view => ({ turn: view.turn, shown: view.shown, tiles: view.tiles, score: view.score });
  async function pauseFor(kind) {
    const before = await snapshot();
    if (kind === 'hidden') await visibility(true);
    else await tap('Pause game');
    await page.getByRole('heading', { name: 'Paused', exact: true }).waitFor();
    await advance(3000);
    assert.deepEqual(progress(await snapshot()), progress(before), `${kind}: pause freezes the current reveal, board and score`);
    if (kind === 'hidden') {
      // Bringing the page back must not play a card before explicit Continue.
      await visibility(false); await advance(1000);
      assert.deepEqual(progress(await snapshot()), progress(before), 'visible again stays paused until Continue');
    }
    await tap('Continue');
    return (await snapshot()).at - before.at;
  }
  async function revealAfterPauses(shownCount, kind, maxDuration) {
    // Every active slice is shorter than the minimum new delay. Progress through
    // these pauses therefore proves the remainder resumes instead of rerolling
    // or restarting the whole timer after every Continue.
    let activeMs = 0, pauses = 0;
    const slice = shownCount === 1 ? 100 : 75;
    while (activeMs <= maxDuration + 50) {
      await advance(slice); activeMs += slice;
      const view = await snapshot();
      if (view.shown.length === shownCount) return { activeMs, pauses, at: view.at };
      assert.equal(view.shown.length, shownCount - 1, `waiting for reveal ${shownCount}`);
      await pauseFor(kind); pauses++;
    }
    throw new Error(`Reveal ${shownCount} did not complete after ${activeMs} active milliseconds and ${pauses} ${kind} pauses`);
  }
  try {
    await page.goto(origin);
    await page.getByRole('heading', { name: 'Daily Rewards', exact: true }).waitFor();
    await advance(400); await tap('Claim rewards', 400);
    await page.getByRole('heading', { name: 'Daily Quests', exact: true }).waitFor();
    await tap('Back to main menu', 400); await tap('Play', 400);
    await page.getByRole('heading', { name: 'Choose a theme', exact: true }).waitFor();
    await tap('Play', 400); await advance(4000); await advance(1500);
    await page.locator('.game-board').waitFor(); await advance(1000);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:aiMode'))), 'realistic');

    for (let attempt = 0; attempt < 4; attempt++) {
      const human = await until(view => view.turn === 'you' && !view.shown.length && view.free.length >= 2, 'human turn');
      const first = human.free[0], second = human.free.find(tile => tile.face !== first.face);
      assert.ok(second, 'a legal mismatch exists to hand control to Realistic');
      await tapTile(first.id); await tapTile(second.id);
      const handoff = await until(view => view.turn === 'ai' && !view.shown.length, 'AI handoff');
      let firstTime, secondTime, pauses = 0;
      if (attempt < 2) {
        const firstKind = attempt === 0 ? 'menu' : 'hidden';
        const secondKind = attempt === 0 ? 'hidden' : 'menu';
        const firstReveal = await revealAfterPauses(1, firstKind, 2600);
        firstTime = firstReveal.activeMs; pauses += firstReveal.pauses;
        const secondReveal = await revealAfterPauses(2, secondKind, 1500);
        secondTime = secondReveal.activeMs; pauses += secondReveal.pauses;
        assert.ok(firstReveal.pauses > 0 && secondReveal.pauses > 0, 'both reveals survived repeated pauses');
      } else {
        const firstReveal = await until(view => view.shown.length === 1, 'first Realistic reveal', 2700);
        const secondReveal = await until(view => view.shown.length === 2, 'second Realistic reveal', 1600);
        firstTime = firstReveal.at - handoff.at;
        secondTime = secondReveal.at - firstReveal.at;
      }
      // Paused checks sample 100/75ms slices; the second timer may already have
      // used up to 100ms when its first-card observation arrives.
      assert.ok(firstTime >= 625 && firstTime <= 2700, `first reveal takes 650–2600ms of active time (observed ${firstTime}ms)`);
      assert.ok(secondTime >= (attempt < 2 ? 120 : 195) && secondTime <= 1575, `second reveal takes 220–1500ms of active time (observed ${secondTime}ms)`);
      timings.push({ attempt: attempt + 1, firstTime, secondTime, pauses });
    }
    assert.ok(new Set(timings.map(value => value.firstTime)).size > 1, 'first-card timing varies across attempts');
    assert.ok(new Set(timings.map(value => value.secondTime)).size > 1, 'second-card timing varies across attempts');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, `${browserName}-report.json`), JSON.stringify({ browserName, timings, errors }, null, 2));
    console.log(`PASS ${browserName}: variable first/second Realistic reveals; menu and hidden-tab pauses preserve both timers`);
    console.log(JSON.stringify(timings));
    await context.close();
    await checkCompletedProfile(browser);
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${browserName}-failure.png`), animations: 'disabled' }).catch(() => {});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
