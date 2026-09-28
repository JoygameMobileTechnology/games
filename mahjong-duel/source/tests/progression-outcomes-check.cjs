/* Complete actual loss/draw boards through ordinary pointer actions and the real ghost.
 * No duel saves, production hooks, score injection or reducer replacement.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/progression-outcomes-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const output = path.resolve('tmp/progression-qa');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch();
  const reports = [];
  try {
    for (const outcome of ['lose', 'tie']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      // Preferences only. Every progress counter, deal, attempt and result is earned in the UI.
      await context.addInitScript(() => {
        if (!sessionStorage.getItem('outcome-preferences')) {
          localStorage.clear();
          localStorage.setItem('porcelain:gentle', 'true');
          localStorage.setItem('porcelain:sound', 'false');
          sessionStorage.setItem('outcome-preferences', 'true');
        }
      });
      const page = await context.newPage(), errors = [];
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
      const baseTime = new Date('2026-09-28T12:00:00Z');
      await page.clock.install({ time: baseTime });
      await page.clock.pauseAt(baseTime);
      // runFor advances actual game timers; the subsequent protocol read lets React flush.
      const advance = async (ms = 200) => { await page.clock.runFor(ms); await page.evaluate(() => document.body.childElementCount); };
      const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:progression')));
      async function clickControl(name) {
        const locator = page.getByRole('button', { name, exact: true });
        await locator.waitFor(); const box = await locator.boundingBox();
        assert.ok(box, `${name} is visible`);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await advance(400);
      }
      async function clickTile(id) {
        const point = await page.locator(`[data-tile-id="${id}"]`).evaluate(node => {
          const rect = node.getBoundingClientRect();
          for (const fy of [.5,.9,.1]) for (const fx of [.5,.9,.1]) {
            const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
            if (document.elementFromPoint(x, y)?.closest('[data-tile-id]') === node) return { x, y };
          }
        });
        assert.ok(point, `tile ${id} is physically tappable`);
        await page.mouse.click(point.x, point.y);
      }
      const snapshot = () => page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.game-tile')];
        const describe = node => ({ id: node.dataset.tileId, face: node.querySelector('.tile-front img').src });
        return { turn: document.querySelector('.duel-scoreboard')?.dataset.turn,
          you: Number(document.querySelector('.local-player strong')?.textContent.replaceAll(',', '') || 0) / 100,
          ai: Number(document.querySelector('.opponent strong')?.textContent.replaceAll(',', '') || 0) / 100,
          remaining: nodes.length,
          free: nodes.filter(node => node.dataset.free === 'true' && node.getAttribute('aria-disabled') === 'false').map(describe),
          shown: nodes.filter(node => node.dataset.faceUp === 'true').map(describe),
          result: Boolean(document.querySelector('.result-card')) };
      });
      try {
        await page.goto(origin);
        await page.getByRole('heading', { name: 'Daily Rewards', exact: true }).waitFor();
        await advance(400);
        await clickControl('Claim rewards');
        await clickControl('Play Duel');
        await page.locator('.game-board').waitFor(); await advance(600);
        await page.evaluate(() => {
          window.__observedOutcomeCues = [];
          const observe = () => {
            for (const node of document.querySelectorAll('[data-streak-id]')) {
              const entry = { id: node.dataset.streakId, owner: node.dataset.streakOwner,
                you: Number(document.querySelector('.local-player strong')?.textContent.replaceAll(',', '') || 0) / 100,
                ai: Number(document.querySelector('.opponent strong')?.textContent.replaceAll(',', '') || 0) / 100 };
              const previous = window.__observedOutcomeCues.at(-1);
              if (!previous || JSON.stringify(previous) !== JSON.stringify(entry)) window.__observedOutcomeCues.push(entry);
            }
          };
          new MutationObserver(observe).observe(document.querySelector('.game-screen'), { subtree: true, childList: true, attributes: true, characterData: true });
        });
        const observed = new Map(); let localAttempts = 0, ticks = 0, lastReport = 0, final;
        for (; ticks < 4000; ticks++) {
          const view = await snapshot();
          for (const tile of view.shown) observed.set(tile.id, { face: tile.face, at: ticks });
          if (view.result) { final = view; break; }
          if (view.you + view.ai >= lastReport + 10) { lastReport = view.you + view.ai; console.log(`${browserName} ${outcome}: ${view.you}-${view.ai}, ${localAttempts} local attempts`); }
          if (view.turn === 'you' && view.free.length >= 2) {
            const shouldMatch = outcome === 'tie' ? view.you < 20 : view.ai >= 21;
            const choices = [];
            for (let i = 0; i < view.free.length; i++) for (let j = i + 1; j < view.free.length; j++) {
              const first = view.free[i], second = view.free[j];
              if ((first.face === second.face) !== shouldMatch) continue;
              // When yielding, reveal partners of recently seen stones so the real ghost learns.
              const helpsMemory = tile => view.free.some(other => other.id !== tile.id && other.face === tile.face && observed.has(other.id) && ticks - observed.get(other.id).at < 12);
              choices.push({ ids: [first.id, second.id], priority: Number(helpsMemory(first)) + Number(helpsMemory(second)) });
            }
            if (!choices.length && !shouldMatch) throw Error(`Cannot legally yield: only matching tiles remain at ${view.you}-${view.ai}`);
            if (choices.length) {
              choices.sort((a, b) => b.priority - a.priority);
              const pair = choices[0].ids;
              await clickTile(pair[0]); await clickTile(pair[1]); localAttempts++;
            }
          }
          await advance();
        }
        assert.ok(final, `${outcome} completed within bounded 800 seconds of virtual play`);
        const progress = await stored();
        assert.equal(progress.counters.completedDuels, 1);
        assert.equal(progress.counters.completedWins, 0);
        assert.equal(progress.ranking.position, 10000);
        assert.equal(progress.ranking.leagueId, 'bronze');
        assert.equal(progress.pendingRankingPresentation.outcome, outcome);
        assert.equal(progress.pendingRankingPresentation.improved, false);
        assert.equal(final.you + final.ai, 40);
        if (outcome === 'tie') assert.equal(final.you, 20); else assert.ok(final.ai > final.you);
        const cues = await page.evaluate(() => window.__observedOutcomeCues);
        assert.ok(cues.every(cue => cue.owner === 'you'));
        assert.ok(!cues.some(cue => cue.id === 'turning_win_secured'), 'AI victory never creates local Accomplished');
        assert.ok(!cues.some(cue => cue.you === 0 && cue.id.startsWith('chain_')), 'a pure opponent run never creates a local chain');
        if (outcome === 'tie') assert.ok(cues.some(cue => cue.id === 'turning_draw_final'), 'real draw creates local Admirable');
        assert.equal(await page.locator('.leaderboards-page').count(), 0);
        assert.equal(await page.getByRole('heading', { name: outcome === 'tie' ? 'A perfect tie!' : 'Well played!', exact: true }).count(), 1);
        await advance(4000);
        assert.equal(await page.locator('.result-card').count(), 1, 'results remain open until Continue');
        await page.screenshot({ path: path.join(output, `${browserName}-${outcome}-result-before-rank.png`), animations: 'disabled' });
        await clickControl('Continue');
        await page.getByRole('heading', { name: 'Leaderboards', exact: true }).waitFor();
        assert.equal(await page.locator('.result-card').count(), 0);
        assert.equal((await stored()).pendingRankingPresentation, null);
        assert.equal(await page.locator('.is-climbing,.is-promoting').count(), 0);
        assert.match(await page.locator('.ranking-outcome').textContent(), /Position held at #10,000/);
        await page.screenshot({ path: path.join(output, `${browserName}-${outcome}-rank-held.png`), animations: 'disabled' });
        await clickControl('Back to main menu'); await page.getByRole('button', { name: 'Play Duel', exact: true }).waitFor();
        await page.reload(); await advance(400); await page.getByRole('button', { name: 'Play Duel', exact: true }).waitFor();
        const reloaded = await stored();
        assert.equal(reloaded.counters.completedDuels, 1); assert.equal(reloaded.counters.completedWins, 0);
        assert.equal(reloaded.ranking.position, 10000); assert.equal(reloaded.pendingRankingPresentation, null);
        assert.equal(await page.evaluate(() => localStorage.getItem('porcelain:session')), null);
        assert.deepEqual(errors, []);
        reports.push({ outcome, localAttempts, ticks, pairs: { you: final.you, ai: final.ai }, cues, errors });
        console.log(`PASS ${browserName}: actual ${outcome}, result stays before Leaderboards, rank held, reload idempotent`);
      } catch (error) {
        await page.screenshot({ path: path.join(output, `${browserName}-${outcome}-failure.png`), animations: 'disabled' }).catch(() => {});
        throw error;
      } finally { await context.close(); }
    }
    fs.writeFileSync(path.join(output, `${browserName}-outcomes-report.json`), JSON.stringify(reports, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
