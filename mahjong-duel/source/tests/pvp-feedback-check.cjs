/* Real HUD/feedback components and a real duel entered through the public UI.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/pvp-feedback-check.cjs [--webkit]
 * No app-state backdoors: the live case controls entropy and uses the public deal model.
 */
const assert = require('node:assert/strict');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const { [browserName]: browserType } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://localhost:5173';
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 375, height: 667 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 844, height: 390 }];
const overlaps = (a, b) => a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;

(async () => {
  const browser = await browserType.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: viewports[1] });
    await page.addInitScript(() => { localStorage.setItem('porcelain:language', '"en"'); });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForSelector('.home-screen, .progression-page');
    await page.evaluate(async () => {
      const React = (await import('/node_modules/.vite/deps/react.js')).default;
      const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const { DuelHud } = await import('/src/duel-hud.jsx');
      const { ScoreFlight } = await import('/src/duel-transition.jsx');
      const { DEFAULT_PROFILE } = await import('/src/player-profile.jsx');
      const { OPPONENT_ROSTER } = await import('/src/matchmaking.js');
      const { TURNING_POINTS } = await import('/src/duel-progress.js');
      const { createGame } = await import('/src/engine.js');
      const { boardMetrics, tilePosition } = await import('/src/table-layout.js');
      const { themeById } = await import('/src/themes.js');
      const { BoardSurface } = await import('/src/board-surface.jsx');
      const { boardVariants } = await import('/src/board-variants.js');
      const { boardArtStyle } = await import('/src/board-art.js');
      const { themeUiStyle } = await import('/src/theme-ui.js');
      const e = React.createElement, host = document.createElement('div');
      document.body.append(host); document.querySelector('#root').style.display = 'none';
      const root = createRoot(host), theme = 'ming-porcelain';
      const deal = createGame('western', 88, 'calm', theme, { formationId: 'crown' });
      const metrics = boardMetrics(deal.tiles);
      const profile = { ...DEFAULT_PROFILE, name: 'Alexandra' }, opponentProfile = [...OPPONENT_ROSTER].sort((a, b) => b.name.length - a.name.length)[0];
      const fixture = window.pvpFixture = { completed: 0, state: { turn: 'you', cues: [], paused: true, gentle: false, flight: null } };
      fixture.cue = () => ({ ...TURNING_POINTS.turning_equalize, id: 'turning_equalize', family: 'turning', eventId: 'local-streak', actor: 'you', owner: 'you' });
      fixture.render = patch => {
        Object.assign(fixture.state, patch); const s = fixture.state;
        root.render(e('div', { className: `world remake at-table ${s.gentle ? 'gentle-motion' : ''}`, 'data-theme': theme, 'data-board-theme': theme, style: { ...boardArtStyle(theme), ...themeUiStyle(theme) } },
          e(BoardSurface, { variants: boardVariants[theme] }), e('main', { className: 'app-shell' }, e('div', { className: `game-screen duel-stage ${s.cues.length ? 'has-streak' : ''}`, 'data-paused': s.paused },
            e(DuelHud, { game: { turn: s.turn, score: s.turn === 'you' ? 3000 : 1900, aiScore: s.turn === 'ai' ? 3000 : 1100 }, profile, opponentProfile, streakCues: s.cues, onStreakComplete: () => {}, paused: s.paused, gentle: s.gentle, sound: false, remainingPairs: 0, scoreFeedback: s.flight, onPause: () => {} }),
            e('div', { className: 'board-space', style: { '--board-ratio': metrics.width / metrics.height } }, e('div', { className: 'board-frame' }, e('div', { className: 'game-board' }, ...deal.tiles.map(tile => e('button', { key: tile.id, className: 'game-tile', style: { ...tilePosition(tile, metrics), zIndex: tile.z * 100 + Math.floor(tile.y * 10) } }, e('span', { className: 'tile-side tile-back' }, e('img', { className: 'tile-art', src: themeById[theme].back, alt: '' }))))))),
            e('div', { className: 'game-tools' }, ...['Shuffle', 'Hint', 'Freeze', 'Eagle Eye'].map(label => e('button', { key: label }, label))))),
          s.flight && e(ScoreFlight, { key: s.flight.id, feedback: s.flight, paused: s.paused, gentle: s.gentle, onComplete: () => { fixture.completed++; fixture.render({ flight: null }); } })));
      };
      fixture.render({});
    });
    await page.locator('.duel-hud').waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const turn of ['you', 'ai']) {
        await page.evaluate(turn => window.pvpFixture.render({ turn, cues: [window.pvpFixture.cue()] }), turn);
        await page.waitForTimeout(80);
        const ui = await page.evaluate(() => {
          const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
          return { panels: ['you', 'ai'].map(a => rect(`[data-side="${a}"]`)), portraits: ['you', 'ai'].map(a => rect(`[data-score-portrait="${a}"]`)),
            scoreSize: parseFloat(getComputedStyle(document.querySelector('[data-score-target]')).fontSize), nameSize: parseFloat(getComputedStyle(document.querySelector('.duel-player-name')).fontSize),
            scoreText: ['you', 'ai'].map(actor => { const range = document.createRange(); range.selectNodeContents(document.querySelector(`[data-score-target="${actor}"]`)); const r = range.getBoundingClientRect(); return { x: r.x, right: r.right }; }),
            pause: rect('.duel-pause'), ribbon: rect('.turn-ribbon'), feedback: rect('.streak-feedback'), board: rect('.game-board'), tools: rect('.game-tools'),
            opponentName: document.querySelector('.opponent .duel-player-name').textContent, ribbonVisible: getComputedStyle(document.querySelector('.turn-ribbon')).visibility, ribbonText: document.querySelector('.turn-ribbon').textContent,
            active: document.querySelector('.active-turn').dataset.side, rings: document.querySelectorAll('.opponent .streak-portrait-ring').length,
            documentWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, width: innerWidth, height: innerHeight };
        });
        assert.ok(Math.abs(ui.panels[0].width - ui.panels[1].width) < 1, `${browserName} ${viewport.width}: balanced panels`);
        assert.ok(ui.portraits[0].x < ui.portraits[1].x, 'player always left');
        const tablet = viewport.width >= 600 && viewport.height >= 600;
        for (const portrait of ui.portraits) assert.ok(portrait.width >= (tablet ? 68 : 52) && portrait.width <= (tablet ? 72 : 56), `portrait size ${portrait.width}`);
        assert.ok(ui.scoreSize >= (tablet ? 40 : 32) && ui.nameSize >= (tablet ? 16 : 13), 'scores and names retain requested sizes');
        assert.ok(ui.pause.width >= 44 && ui.pause.height >= 44, 'Pause retains a 44px target');
        assert.ok(ui.panels.every(panel => !overlaps(panel, ui.pause)), 'Pause has independent space');
        assert.ok(ui.scoreText.every((score, index) => score.x >= ui.panels[index].x && score.right <= ui.panels[index].right), `${browserName} ${viewport.width}: four-digit scores stay in their panels ${JSON.stringify(ui.scoreText)}`);
        assert.equal(ui.active, turn); assert.equal(ui.ribbonVisible, 'visible');
        assert.ok(ui.ribbonText.includes(turn === 'you' ? 'Your turn' : ui.opponentName), 'turn label tracks ownership');
        assert.ok(!overlaps(ui.feedback, ui.ribbon), `${browserName} ${viewport.width}: celebration never covers turn ownership`);
        assert.ok(ui.panels.every(panel => !overlaps(panel, ui.feedback)), 'celebration does not cover active portrait');
        assert.equal(ui.rings, 0, 'streak decoration remains player-only');
        assert.ok(ui.documentWidth <= ui.width + 1, `${browserName} ${viewport.width}: no horizontal overflow`);
        assert.ok(ui.tools.bottom <= ui.height + 1 && ui.board.bottom <= ui.height + 1, `${browserName} ${viewport.width}: board/tools fit height ${JSON.stringify(ui)}`);
      }
      for (const actor of ['you', 'ai']) {
        await page.evaluate(actor => window.pvpFixture.render({ turn: actor, flight: { id: `pulse-${actor}`, actor, points: 100, source: { x: innerWidth / 2, y: innerHeight / 2 } } }), actor);
        await page.locator(`[data-score-flight="${actor}"]`).waitFor();
        const pulse = await page.locator(`[data-score-target="${actor}"]`).evaluate(node => {
          const animation = node.getAnimations()[0]; animation.pause(); animation.currentTime = 152;
          const range = document.createRange(); range.selectNodeContents(node);
          const text = range.getBoundingClientRect(), panel = node.closest('[data-side]').getBoundingClientRect();
          return { left: text.left, right: text.right, panelLeft: panel.left, panelRight: panel.right };
        });
        assert.ok(pulse.left >= pulse.panelLeft && pulse.right <= pulse.panelRight, `${browserName} ${viewport.width}: score pulse stays inside its panel ${JSON.stringify(pulse)}`);
        await page.evaluate(() => window.pvpFixture.render({ flight: null }));
      }
      console.log(`PASS ${browserName}: ${viewport.width}x${viewport.height} HUD sizes, ownership and celebration separation`);
    }

    // Inspect actual rendered WAAPI trajectories at fixed times, including pause/reduced motion.
    await page.setViewportSize(viewports[1]);
    await page.evaluate(() => window.pvpFixture.render({ cues: [], paused: true }));
    for (const actor of ['you', 'ai']) {
      await page.evaluate(actor => window.pvpFixture.render({ flight: { id: `flight-${actor}`, actor, points: 100, source: { x: 195, y: 450 } } }), actor);
      await page.locator(`[data-score-flight="${actor}"]`).waitFor();
      const path = await page.locator(`[data-score-flight="${actor}"]`).evaluate((node, actor) => {
        const animation = node.getAnimations()[0], target = document.querySelector(`[data-score-target="${actor}"]`).getBoundingClientRect();
        const sample = time => { animation.currentTime = time; const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
        return { state: animation.playState, source: sample(0), end: sample(649), target: { x: target.x + target.width / 2, y: target.y + target.height / 2 }, background: getComputedStyle(node).backgroundImage };
      }, actor);
      assert.equal(path.state, 'paused');
      assert.ok(Math.abs(path.source.x - 195) < 2 && Math.abs(path.source.y - 450) < 2, 'points start on the matched pair');
      assert.ok(Math.hypot(path.end.x - path.target.x, path.end.y - path.target.y) < 2, `+100 ends at ${actor}'s score`);
      assert.ok(path.background.includes(actor === 'you' ? '38, 155, 233' : '230, 96, 80'), 'feedback uses actor enamel color');
      await page.evaluate(() => { document.querySelector('[data-score-flight]').getAnimations()[0].currentTime = 200; });
      await page.waitForTimeout(100);
      assert.equal(await page.locator('[data-score-flight]').evaluate(n => n.getAnimations()[0].currentTime), 200, 'paused feedback retains visual time');
      await page.evaluate(() => window.pvpFixture.render({ paused: false }));
      await page.waitForSelector('[data-score-flight]', { state: 'detached' });
      await page.evaluate(() => window.pvpFixture.render({ paused: true }));
    }
    assert.equal(await page.evaluate(() => window.pvpFixture.completed), 2, 'one completion per score flight');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => window.pvpFixture.render({ flight: { id: 'reduced', actor: 'you', points: 100, source: { x: 195, y: 450 } } }));
    await page.locator('[data-score-flight]').waitFor();
    assert.equal(await page.locator('[data-score-flight]').evaluate(n => n.getAnimations()[0].effect.getKeyframes().some(f => f.transform)), false, 'reduced motion fades points at the score');
    await page.evaluate(() => window.pvpFixture.render({ cues: [{ ...window.pvpFixture.cue(), actor: 'ai', owner: 'ai' }], flight: null }));
    await page.waitForTimeout(50);
    assert.equal(await page.locator('.streak-feedback').count(), 0, 'opponent cues never trigger named celebrations');
    assert.deepEqual(errors, []);
    await page.close();

    const context = await browser.newContext({ viewport: viewports[1] });
    await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
    await context.addInitScript(() => {
      localStorage.setItem('porcelain:profile', JSON.stringify({ version: 1, name: 'Ada', avatarId: 'avatar-1', countryCode: 'TR', frameId: '' }));
      localStorage.setItem('porcelain:aiModeVersion', '1'); localStorage.setItem('porcelain:aiMode', '"modern"');
      localStorage.setItem('porcelain:sound', 'false'); localStorage.setItem('porcelain:lastFormation', 'null');
      const nativeRandomValues = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 1 ? (values[0] = 88, values) : nativeRandomValues(values);
    });
    const live = await context.newPage();
    live.on('pageerror', error => errors.push(error.message));
    await live.goto(base);
    await live.getByRole('button', { name: 'Claim rewards', exact: true }).click();
    await live.getByRole('button', { name: 'Back to main menu', exact: true }).click();
    // The starter dialog opens in an effect after the quests page finishes leaving.
    const starter = live.locator('.starter-boosters-intro');
    if (await starter.waitFor({ timeout: 3000 }).then(() => true, () => false)) await live.getByRole('button', { name: 'Got it', exact: true }).click();
    await live.getByRole('button', { name: 'Play', exact: true }).click();
    await live.locator('.theme-choice-play').click();
    await live.waitForSelector('.duel-stage:not([inert])');
    const moves = await live.evaluate(async () => {
      const { createGame, getAvailablePairs, isFree, canMatch, removePair } = await import('/src/engine.js');
      const { chooseFormationId } = await import('/src/formations.js');
      const deal = createGame('eastern', 88, 'calm', 'ming-porcelain', { formationId: chooseFormationId(88, { excludeIds: [null] }) });
      const pair = getAvailablePairs(deal.tiles)[0];
      const afterFirst = removePair(deal.tiles, pair[0].id, pair[1].id);
      const secondPair = getAvailablePairs(afterFirst)[0];
      const remaining = removePair(afterFirst, secondPair[0].id, secondPair[1].id);
      const free = remaining.filter(tile => isFree(tile, remaining)), first = free[0], miss = free.find(tile => !canMatch(first, tile) && tile.id !== first.id);
      window.pvpEvents = [];
      new MutationObserver(() => {
        for (const node of document.querySelectorAll('[data-score-flight]')) {
          if (!node.dataset.recorded) {
            node.dataset.recorded = 'true';
            window.pvpEvents.push({ actor: node.dataset.scoreFlight, text: node.textContent, firstStillConnected: Boolean(window.pvpFirstFlight?.isConnected) });
            window.pvpFirstFlight ||= node;
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
      return { pair: pair.map(t => t.id), secondPair: secondPair.map(t => t.id), miss: [first.id, miss.id] };
    });
    for (const id of moves.pair) await live.locator(`[data-tile-id="${id}"]`).click();
    await live.waitForFunction(() => document.querySelector('[data-score-target="you"]').textContent === '100');
    assert.ok(await live.evaluate(() => window.pvpEvents.some(e => e.actor === 'you' && e.text === '+100')), 'a real player match launches blue score feedback');
    assert.equal(await live.locator('.active-turn').getAttribute('data-side'), 'you', 'a match retains the turn');
    // Another real pair may resolve before the first 650ms score flight finishes.
    for (const id of moves.secondPair) await live.locator(`[data-tile-id="${id}"]`).click();
    await live.waitForFunction(() => document.querySelector('[data-score-target="you"]').textContent === '200');
    const rapidMatches = await live.evaluate(() => window.pvpEvents.filter(e => e.actor === 'you'));
    assert.equal(rapidMatches.length, 2, 'each rapid match creates its own +100');
    assert.equal(rapidMatches[1].firstStillConnected, true, 'the original score flight survives when the second one starts');
    await live.waitForFunction(() => document.querySelectorAll('[data-score-flight]').length === 0);
    assert.equal(await live.evaluate(() => window.pvpFirstFlight.isConnected), false, 'both independent flights complete and leave the DOM');
    for (const id of moves.miss) await live.locator(`[data-tile-id="${id}"]`).click();
    await live.waitForSelector('.opponent.active-turn');
    await live.waitForSelector('.game-tile.opponent-reveal', { timeout: 10000 });
    assert.equal(await live.locator('.game-tile.opponent-reveal .tile-front').first().evaluate(n => getComputedStyle(n).outlineColor), 'rgb(204, 73, 64)', 'real AI reveals carry a restrained red accent');
    assert.ok(await live.locator('.turn-ribbon').innerText().then(t => t.includes('’s turn')), 'real opponent turn names the opponent');
    assert.equal(await live.locator('.opponent .streak-feedback').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${browserName}: two rapid real matches retain independent +100 flights, real turn transfer and red AI reveal; both actor score paths, pause/resume and reduced motion`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
