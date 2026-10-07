/* Matchmaking through the real theme-selection UI, with a controlled browser clock.
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/matchmaking-check.cjs [--webkit]
 * Each case owns a fresh context. Fixtures seed public collection/profile data only;
 * gameplay and matchmaking are entered through their actual controls.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const output = path.resolve(__dirname, '../tmp/matchmaking-qa');
const now = new Date('2026-09-30T12:00:00Z');
const opening = '.menu-scene-transition, .door-transition';
const profile = { version: 1, name: 'Ada', avatarId: 'avatar-1', countryCode: 'TR', frameId: '' };
const sizes = [
  { width: 320, height: 568 }, { width: 390, height: 844 },
  { width: 768, height: 1024 }, { width: 844, height: 390 }, { width: 568, height: 320 },
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const load = file => import(pathToFileURL(path.resolve(__dirname, '../src', file)).href);
  const [{ themes }, { themeTileSets }, { createCollection }, model] = await Promise.all([
    load('themes.js'), load('tile-data.js'), load('collection.js'), load('matchmaking.js'),
  ]);
  const collection = createCollection();
  for (const theme of themes) for (const tile of themeTileSets[theme.id].eastern) collection.counts[tile.matchKey] = 3;
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch({ headless: true });
  const reports = [];

  async function run(label, viewport, preference, scenario) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true,
      reducedMotion: preference === 'system' ? 'reduce' : 'no-preference' });
    await context.addInitScript(({ profile, collection, preference }) => {
      localStorage.setItem('porcelain:profile', JSON.stringify(profile));
      localStorage.setItem('porcelain:collection', JSON.stringify(collection));
      localStorage.setItem('porcelain:gentle', String(preference === 'gentle'));
      localStorage.setItem('porcelain:sound', 'false');
      localStorage.setItem('porcelain:menuBackground', JSON.stringify('lantern-night'));
      Math.random = () => 0;
    }, { profile, collection, preference });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now);
    const advance = async ms => { await page.clock.runFor(ms); await page.evaluate(() => document.body.childElementCount); };
    const button = name => page.getByRole('button', { name, exact: true });
    async function tap(target, settle = 250) {
      const node = typeof target === 'string' ? button(target) : target;
      await node.waitFor(); await node.scrollIntoViewIfNeeded();
      const rect = await node.boundingBox();
      assert.ok(rect, `${label}: control is visible`);
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
      if (settle) await advance(settle);
    }
    const status = phase => page.locator(`.matchmaking-page.is-${phase}`);
    const noBoard = async () => {
      assert.equal(await page.locator('.game-board').count(), 0, 'matchmaking does not deal a board');
      assert.equal(await page.locator(opening).count(), 0, 'matchmaking precedes the menu opening');
    };
    const selection = () => page.locator('.theme-choice-card[aria-pressed="true"], .theme-random-choice[aria-pressed="true"]');
    const choose = async themeId => {
      await tap(themeId === 'random' ? page.locator('.theme-random-choice') : page.locator(`.theme-choice-card[data-theme="${themeId}"]`));
    };
    async function start(random, doubleClick = false) {
      await page.evaluate(random => {
        Math.random = () => random;
        window.__matchmakingEvents = [];
        window.__matchmakingObserver?.disconnect();
        const seen = new WeakSet(), states = new WeakMap();
        const capture = () => {
          for (const node of document.querySelectorAll('.matchmaking-page, .game-board, .menu-scene-transition, .door-transition')) {
            const phase = node.matches('.matchmaking-page') ? node.classList.contains('is-searching') ? 'searching' : 'found' : node.matches('.game-board') ? 'board' : 'opening';
            if (seen.has(node) && states.get(node) === phase) continue;
            seen.add(node); states.set(node, phase);
            window.__matchmakingEvents.push({ phase, at: Date.now() });
          }
        };
        window.__matchmakingObserver = new MutationObserver(capture);
        window.__matchmakingObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      }, random);
      if (doubleClick) {
        // Two native DOM activations in one task exercise the synchronous guard.
        await page.locator('.theme-choice-play').evaluate(node => { node.click(); node.click(); });
      } else await tap(page.locator('.theme-choice-play'), 0);
      await status('searching').waitFor();
      assert.equal(await page.locator('.matchmaking-page').count(), 1);
      await noBoard();
      return model.matchmakingDelay(() => random);
    }
    async function foundAfter(ms) {
      await advance(ms - 1);
      assert.equal(await status('searching').count(), 1, 'search stays visible until its sampled deadline');
      await noBoard();
      await advance(1); await status('found').waitFor();
      await noBoard();
      assert.equal(await page.locator('.matchmaking-cancel').count(), 0, 'Cancel leaves the face-off once an opponent is found');
      const found = await page.locator('.matchmaking-page').evaluate(node => ({
        text: node.innerText,
        name: node.querySelector('.is-opponent .matchmaking-player-name').textContent,
        avatars: [...node.querySelectorAll('.player-avatar')].map(avatar => ({ id: avatar.dataset.avatarId, label: avatar.querySelector('[role="img"]')?.getAttribute('aria-label') })),
      }));
      const opponent = model.OPPONENT_ROSTER.find(candidate => found.name === candidate.name);
      assert.ok(opponent, `a roster username appears in the found state: ${found.text}`);
      assert.notEqual(opponent.name, profile.name);
      assert.notEqual(opponent.avatarId, profile.avatarId);
      assert.ok(found.avatars.some(avatar => avatar.id === opponent.avatarId && avatar.label?.includes(opponent.name)), 'the opponent uses its own preset portrait');
      assert.doesNotMatch(found.text, /ghost/i);
      assert.equal(await page.locator('.matchmaking-search-orbit, .matchmaking-progress-dots').count(), 0, 'search motion gives way to the face-off');
      assert.equal(await page.locator('[data-matchmaking-portrait="you"]').count(), 1);
      assert.equal(await page.locator('[data-matchmaking-portrait="ai"]').count(), 1);
      assert.equal(await page.locator('.matchmaking-preparing').innerText(), 'Preparing your table…');
      return opponent;
    }
    async function enterBoard(opponent, expectedTheme, { elapsed = 0 } = {}) {
      const revealRemaining = Math.max(0, model.MATCH_REVEAL_MS - elapsed);
      if (revealRemaining) {
        await advance(revealRemaining - 1);
        assert.equal(await status('faceoff').count(), 0, 'opponent reveal lasts 600 ms');
        await noBoard();
        await advance(1);
      }
      await status('faceoff').waitFor();
      const faceoffRemaining = model.MATCH_REVEAL_MS + model.MATCH_FACEOFF_MS - Math.max(elapsed, model.MATCH_REVEAL_MS);
      await advance(faceoffRemaining - 1);
      assert.equal(await status('faceoff').count(), 1, 'the face-off holds for 600 ms');
      await noBoard();
      await advance(1);
      await page.locator('.game-board').waitFor();
      assert.equal(await page.locator('.matchmaking-page').count(), 0);
      assert.equal(await page.locator(opening).count(), 0, 'the bright-light menu opening is removed');
      assert.equal(await page.locator('.duel-stage').getAttribute('data-intro'), 'travel');
      assert.equal(await page.locator('.duel-stage').evaluate(node => node.inert), true, 'input stays locked while portraits travel');
      assert.equal(await page.locator('[data-travelling-portrait]').count(), 2, 'both portraits connect the face-off to the scoreboard');
      await page.locator('.game-tile').first().evaluate(node => node.click());
      assert.equal(await page.locator('.game-tile[data-face-up="true"]').count(), 0, 'a tile cannot flip during entry');
      await advance(model.MATCH_TRANSFER_MS - 1);
      assert.equal(await page.locator('.duel-stage').getAttribute('data-intro'), 'travel');
      await advance(1);
      assert.equal(await page.locator('.duel-stage').getAttribute('data-intro'), 'ready');
      assert.equal(await page.locator('.duel-first-turn').innerText(), 'You play first');
      assert.equal(await page.locator('.local-player').getAttribute('class').then(value => value.includes('active-turn')), true);
      await advance(model.MATCH_READY_MS - 1);
      assert.equal(await page.locator('.duel-stage').evaluate(node => node.inert), true, 'the opening cue lasts 500 ms');
      await advance(1);
      assert.equal(await page.locator('.duel-stage').evaluate(node => node.inert), false, 'input opens 2.5 seconds after finding an opponent');
      assert.equal(await page.locator('.portrait-transfer').count(), 0);
      assert.equal(await page.locator('.game-tile').count(), 60);
      assert.equal(await page.locator('.game-tile[data-face-up="true"]').count(), 0);
      assert.equal(await page.locator('.world').getAttribute('data-theme'), expectedTheme);
      assert.equal(await page.locator('.world').getAttribute('data-board-theme'), expectedTheme);
      assert.equal((await page.locator('.opponent .duel-player-name').innerText()).trim(), opponent.name, 'the found username is the in-game opponent');
      assert.equal(await page.locator('.opponent .player-avatar').getAttribute('data-avatar-id'), opponent.avatarId, 'the found portrait is the in-game opponent');
      assert.doesNotMatch(await page.locator('body').innerText(), /ghost/i, 'visible duel text no longer calls the opponent Ghost');
      const allowedFaces = new Set(themeTileSets[expectedTheme].eastern.map(tile => new URL(tile.src, `${origin}/`).href));
      assert.ok((await page.locator('.game-tile .tile-front img').evaluateAll(nodes => nodes.map(node => node.src))).every(src => allowedFaces.has(src)), 'all tiles use the exact resolved theme');
      const timeline = await page.evaluate(() => window.__matchmakingEvents);
      assert.equal(timeline.filter(event => event.phase === 'searching').length, 1);
      assert.equal(timeline.filter(event => event.phase === 'found').length, 1);
      assert.equal(timeline.filter(event => event.phase === 'board').length, 1, 'one search launches one board');
      const found = timeline.find(event => event.phase === 'found'), board = timeline.find(event => event.phase === 'board');
      assert.ok(board.at - found.at >= model.MATCH_REVEAL_MS + model.MATCH_FACEOFF_MS, 'the board appears after reveal and face-off');
      assert.equal(timeline.filter(event => event.phase === 'opening').length, 0, 'no menu flash is ever mounted');
      return timeline;
    }
    async function capture(phase) {
      // Finish only the shared 200ms page entrance, leaving the search timer and
      // repeating matchmaking motion untouched for an unobscured layout sample.
      await page.locator('.matchmaking-page .progression-page-content').evaluate(node => {
        for (const animation of node.getAnimations()) if (animation.effect.getTiming().iterations === 1) animation.finish();
      });
      const layout = await page.locator('.matchmaking-page').evaluate(root => {
        const rect = root.getBoundingClientRect();
        const buttons = [...root.querySelectorAll('button')].map(node => {
          const bounds = node.getBoundingClientRect();
          return { text: node.textContent.trim(), disabled: node.disabled, ...bounds.toJSON(), reachable: node.disabled || document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.closest('button') === node };
        });
        return { rect: rect.toJSON(), overflow: document.documentElement.scrollWidth - innerWidth, buttons, width: innerWidth, height: innerHeight };
      });
      assert.ok(layout.overflow <= 1, `${label}: no horizontal overflow`);
      assert.ok(layout.rect.top >= 0 && layout.rect.left >= 0 && layout.rect.right <= viewport.width + 1 && layout.rect.bottom <= viewport.height + 1, `${label}: matchmaking fits the viewport`);
      for (const control of layout.buttons) assert.ok(control.width >= 44 && control.height >= 44 && control.top >= 0 && control.bottom <= viewport.height && control.reachable, `${label}: ${control.text} is reachable and at least 44px: ${JSON.stringify(control)}`);
      await page.screenshot({ path: path.join(output, `${browserName}-${label}-${phase}.jpg`), type: 'jpeg', quality: 65 });
      return layout;
    }
    async function checkMotion() {
      const motion = await page.locator('.matchmaking-page').evaluate(root => {
        const orbit = root.querySelector('.matchmaking-orbit-arcs'), spin = orbit.getAnimations()[0];
        const dots = [...root.querySelectorAll('.matchmaking-progress-dots > span')];
        if (!spin) return { rotating: false, dots: dots.map(node => node.getAnimations().length) };
        const spinTime = spin.currentTime;
        spin.pause(); spin.currentTime = 400;
        const matrix = new DOMMatrixReadOnly(getComputedStyle(orbit).transform);
        spin.currentTime = spinTime; spin.play();
        const samples = dots.map(node => {
          const animation = node.getAnimations()[0], time = animation.currentTime;
          animation.pause(); animation.currentTime = 600;
          const scale = new DOMMatrixReadOnly(getComputedStyle(node).transform).a;
          const delay = animation.effect.getTiming().delay;
          animation.currentTime = time; animation.play();
          return { scale, delay };
        });
        return { rotating: true, matrix: { a: matrix.a, b: matrix.b }, dots: samples };
      });
      if (preference !== 'normal') {
        assert.equal(motion.rotating, false, 'reduced motion stops rotation');
        assert.ok(motion.dots.every(count => count === 0), 'reduced motion stops the repeated dot pulse');
      } else {
        assert.ok(motion.rotating && motion.matrix.a > 0 && motion.matrix.b < 0, 'the orbit rotates counterclockwise');
        assert.equal(motion.dots.length, 3);
        assert.ok(motion.dots[0].delay < motion.dots[1].delay && motion.dots[1].delay < motion.dots[2].delay, 'the dots have successive animation delays');
        assert.ok(motion.dots[0].scale > motion.dots[1].scale && motion.dots[1].scale > motion.dots[2].scale, 'the rendered dots grow in sequence');
      }
      return motion;
    }
    const visibility = async hidden => {
      await page.evaluate(hidden => {
        if (hidden) Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        else delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
      await page.evaluate(() => document.body.childElementCount);
    };
    try {
      await page.goto(origin);
      await page.getByRole('heading', { name: 'Daily Rewards', exact: true }).waitFor();
      await advance(400); await tap('Claim rewards');
      await page.getByRole('heading', { name: 'Daily Quests', exact: true }).waitFor();
      await tap('Back to main menu');
      if (await page.locator('.starter-boosters-intro').count()) await tap('Got it');
      await tap('Play Duel');
      await page.getByRole('heading', { name: 'Choose a theme', exact: true }).waitFor();
      const result = await scenario({ page, advance, tap, button, status, noBoard, selection, choose, start, foundAfter, enterBoard, capture, checkMotion, visibility });
      assert.deepEqual(errors, [], `${label}: no browser or asset errors`);
      reports.push({ label, preference, viewport, ...result, errors });
      console.log(`PASS ${browserName}: ${label}`);
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${browserName}-${label}-failure.png`) }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }

  try {
    for (const [index, viewport] of sizes.entries()) await run(`layout-${viewport.width}x${viewport.height}`, viewport, 'normal', async ui => {
      const theme = themes[index % themes.length].id, random = [0, .25, .5, .75, .5][index];
      await ui.choose(theme);
      const delay = await ui.start(random, index === 0);
      assert.equal(await ui.page.locator('.matchmaking-theme').getAttribute('data-theme'), theme);
      const motion = await ui.checkMotion();
      const searching = await ui.capture('searching');
      const opponent = await ui.foundAfter(delay);
      const found = await ui.capture('found');
      const timeline = await ui.enterBoard(opponent, theme);
      return { theme, delay, opponent, motion, searching, found, timeline, doubleClick: index === 0 };
    });
    for (const preference of ['gentle', 'system']) await run(`reduced-${preference}`, sizes[1], preference, async ui => {
      const delay = await ui.start(preference === 'gentle' ? 1 - Number.EPSILON : 0);
      assert.equal(delay, preference === 'gentle' ? 4000 : 2000);
      const motion = await ui.checkMotion();
      const opponent = await ui.foundAfter(delay);
      const timeline = await ui.enterBoard(opponent, themes[0].id);
      return { delay, opponent, motion, timeline };
    });
    await run('cancel-and-retry', sizes[1], 'system', async ui => {
      await ui.choose('random');
      const before = await ui.page.locator('.theme-choice-population').allTextContents();
      const scrollTop = await ui.page.locator('.theme-choice-scroll').evaluate(node => { node.scrollTop = 140; return node.scrollTop; });
      await ui.start(1 - Number.EPSILON);
      await ui.advance(1500); await ui.tap('Cancel', 0);
      await ui.page.getByRole('heading', { name: 'Choose a theme', exact: true }).waitFor();
      assert.equal(await ui.page.locator('.theme-random-choice').getAttribute('aria-pressed'), 'true', 'Cancel preserves Random Match');
      assert.equal(await ui.page.locator('.theme-choice-scroll').evaluate(node => node.scrollTop), scrollTop, 'Cancel restores the theme list scroll position');
      assert.deepEqual(await ui.page.locator('.theme-choice-population').allTextContents(), before, 'Cancel preserves displayed populations');
      await ui.advance(10000); await ui.noBoard();
      assert.equal(await ui.page.locator('.matchmaking-page').count(), 0, 'a cancelled deadline cannot reopen matchmaking');
      await ui.choose('dancheong'); await ui.start(1 - Number.EPSILON);
      await ui.advance(500); await ui.page.keyboard.press('Escape');
      await ui.page.getByRole('heading', { name: 'Choose a theme', exact: true }).waitFor();
      assert.equal(await ui.page.locator('.theme-choice-card[data-theme="dancheong"]').getAttribute('aria-pressed'), 'true', 'Escape preserves an explicit selected theme');
      await ui.choose('random');
      const delay = await ui.start(0, true);
      assert.equal(await ui.page.locator('.matchmaking-theme').getAttribute('data-theme'), themes[0].id);
      await ui.page.evaluate(() => { Math.random = () => 1 - Number.EPSILON; });
      const opponent = await ui.foundAfter(delay);
      // Escape must remain harmless after the cancellable search has ended.
      assert.equal(await ui.page.locator('.matchmaking-cancel').count(), 0);
      await ui.page.keyboard.press('Escape');
      assert.equal(await ui.status('found').count(), 1);
      const timeline = await ui.enterBoard(opponent, themes[0].id);
      await ui.advance(10000);
      assert.equal(await ui.page.locator('.game-board').count(), 1, 'stale callbacks do not replace or duplicate the duel');
      return { delay, opponent, timeline, cancelledRequestStayedCancelled: true, randomTheme: themes[0].id };
    });
    await run('hidden-tab-pauses-countdowns', sizes[1], 'system', async ui => {
      await ui.start(0); await ui.advance(1000); await ui.visibility(true); await ui.advance(5000);
      assert.equal(await ui.status('searching').count(), 1, 'backgrounding pauses the search deadline');
      await ui.noBoard(); await ui.visibility(false);
      const opponent = await ui.foundAfter(1000);
      await ui.advance(model.MATCH_REVEAL_MS); await ui.advance(100); await ui.visibility(true); await ui.advance(5000);
      assert.equal(await ui.status('found').count(), 1, 'backgrounding pauses the found hold');
      await ui.noBoard(); await ui.visibility(false);
      const timeline = await ui.enterBoard(opponent, themes[0].id, { elapsed: 700 });
      return { opponent, timeline, hiddenSearchMs: 5000, hiddenFoundMs: 5000 };
    });
    await run('hidden-tab-pauses-entry', sizes[1], 'normal', async ui => {
      const delay = await ui.start(0);
      const opponent = await ui.foundAfter(delay);
      await ui.advance(model.MATCH_REVEAL_MS);
      await ui.advance(model.MATCH_FACEOFF_MS);
      await ui.page.locator('.game-board').waitFor();
      const stage = ui.page.locator('.duel-stage');
      const noPauseSheet = async () => assert.equal(await ui.page.locator('.sheet-backdrop').count(), 0, 'backgrounding during entry never opens a Pause sheet');
      const animationSnapshot = () => ui.page.evaluate(async () => {
        const entries = [...document.querySelectorAll('[data-travelling-portrait], .game-tile .tile-rotator')].flatMap((node, index) => node.getAnimations().map(animation => ({ target: node.dataset.travellingPortrait || `tile-${index}`, animation })));
        // WAAPI pause() commits at the next animation frame; wait for that commit
        // before sampling so a pending pause cannot look like hidden progression.
        await Promise.all(entries.map(({ animation }) => animation.ready));
        return entries.map(({ target, animation }) => ({ target, currentTime: animation.currentTime, playState: animation.playState }));
      });

      await ui.advance(300);
      await ui.visibility(true);
      assert.equal(await stage.getAttribute('data-intro'), 'travel');
      await noPauseSheet();
      const pausedAnimations = await animationSnapshot();
      assert.equal(pausedAnimations.filter(animation => ['you', 'ai'].includes(animation.target)).length, 2);
      assert.ok(pausedAnimations.every(animation => ['paused', 'finished'].includes(animation.playState)), 'portrait and tile animations pause when the tab hides');
      await ui.advance(5000);
      assert.equal(await stage.getAttribute('data-intro'), 'travel', 'hidden time does not advance the transfer clock');
      assert.equal(await stage.evaluate(node => node.inert), true);
      assert.deepEqual(await animationSnapshot(), pausedAnimations, 'portrait and tile animation time stays frozen while hidden');
      await noPauseSheet();
      await ui.visibility(false);
      await ui.advance(model.MATCH_TRANSFER_MS - 300 - 1);
      assert.equal(await stage.getAttribute('data-intro'), 'travel', 'transfer resumes its exact remaining duration');
      await ui.advance(1);
      assert.equal(await stage.getAttribute('data-intro'), 'ready');
      assert.equal(await ui.page.locator('.duel-entry-announcement').innerText(), 'You play first');
      assert.equal(await ui.page.locator('.duel-entry-announcement').evaluate(node => Boolean(node.closest('[inert]'))), false, 'the starting announcement remains available to assistive technology');

      await ui.advance(200);
      await ui.visibility(true);
      await ui.advance(5000);
      assert.equal(await stage.getAttribute('data-intro'), 'ready', 'hidden time does not consume the first-turn cue');
      assert.equal(await stage.evaluate(node => node.inert), true);
      await noPauseSheet();
      await ui.visibility(false);
      await ui.advance(model.MATCH_READY_MS - 200 - 1);
      assert.equal(await stage.getAttribute('data-intro'), 'ready');
      assert.equal(await stage.evaluate(node => node.inert), true, 'input remains locked for the full remaining first-turn cue');
      await ui.advance(1);
      assert.equal(await stage.getAttribute('data-intro'), null);
      assert.equal(await stage.evaluate(node => node.inert), false, 'input opens only after both paused stages complete');
      assert.equal(await ui.page.locator('.portrait-transfer').count(), 0);
      assert.equal(await ui.page.locator(opening).count(), 0);
      await noPauseSheet();
      return { opponent, hiddenTravelMs: 5000, hiddenReadyMs: 5000, pausedAnimations: pausedAnimations.length };
    });
    fs.writeFileSync(path.join(output, `${browserName}-report.json`), JSON.stringify(reports, null, 2));
    console.log(JSON.stringify({ browser: browserName, passed: reports.length, screenshots: output }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
