const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve(__dirname, '../tmp/streak-feedback-qa');
const base = process.env.BASE_URL || 'http://localhost:5173';
fs.mkdirSync(output, { recursive: true });
(async () => {
  for (const [name, browserType] of Object.entries({ chromium, webkit })) {
    const browser = await browserType.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
    await page.addInitScript(() => { localStorage.setItem('porcelain:language', '"en"'); });
    try {
      await page.goto(base); await page.waitForSelector('.home-screen, .progression-page');
      await page.evaluate(async () => {
        const React = (await import('/node_modules/.vite/deps/react.js')).default;
        const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
        const { StreakFeedback, StreakPortrait } = await import('/src/streak-feedback.jsx');
        const { PlayerAvatar, DEFAULT_PROFILE } = await import('/src/player-profile.jsx');
        const { TURNING_POINTS } = await import('/src/duel-progress.js');
        const { createGame } = await import('/src/engine.js');
        const { boardMetrics, tilePosition } = await import('/src/table-layout.js');
        const { themeById } = await import('/src/themes.js');
        const { BoardSurface } = await import('/src/board-surface.jsx');
        const { boardVariants } = await import('/src/board-variants.js');
        const { boardArtStyle } = await import('/src/board-art.js');
        const { themeUiStyle } = await import('/src/theme-ui.js');
        const e = React.createElement;
        const host = document.createElement('div'); document.body.append(host);
        document.querySelector('#root').style.display = 'none';
        const root = createRoot(host);
        window.streakFixture = { completed: 0, state: { paused: true, gentle: true, cues: [], theme: 'ming-porcelain' }, events: TURNING_POINTS };
        window.streakFixture.render = patch => {
          Object.assign(window.streakFixture.state, patch); const state = window.streakFixture.state;
          const player = { ...DEFAULT_PROFILE, name: 'Alexandra' };
          const deal = createGame('western', 88, 'calm', state.theme, { formationId: 'crown' });
          const metrics = boardMetrics(deal.tiles);
          root.render(e('div', { className: 'world remake at-table', 'data-theme': state.theme, 'data-board-theme': state.theme, style: { ...boardArtStyle(state.theme), ...themeUiStyle(state.theme) } }, e(BoardSurface, { variants: boardVariants[state.theme] }), e('main', { className: 'app-shell' },
            e('div', { className: `game-screen ${state.cues.length ? 'has-streak' : ''}` },
              e('div', { className: 'scoreboard duel-scoreboard' },
                e('div', { className: 'player-score local-player active-turn' },
                  e('div', { className: 'local-avatar-wrap' }, e(PlayerAvatar, { profile: player }), e(StreakPortrait, { ...state })),
                  e('div', null, e('span', null, player.name), e('strong', null, '1,600')),
                  e(StreakFeedback, { ...state, profile: player, sound: false, onComplete: () => window.streakFixture.completed++ })),
                e('div', { className: 'score-versus' }, 'VS'),
                e('div', { className: 'player-score opponent' }, e('div', null, e('span', null, 'Alexandra’s Ghost'), e('strong', null, '900')), e(PlayerAvatar, { profile: player })),
                e('div', { className: 'duel-progress' }, e('div', { className: 'duel-progress-labels' }, e('span', null, '16 pairs'), e('strong', null, 'You secured the win'), e('span', null, '9 pairs')), e('div', { className: 'duel-progress-track' }))),
              e('div', { className: 'turn-ribbon' }, 'Your turn · 5 pairs left'),
              e('div', { className: 'board-space', style: { '--board-ratio': metrics.width / metrics.height } }, e('div', { className: 'board-frame' }, e('div', { className: 'game-board' }, ...deal.tiles.map(tile => e('button', { key: tile.id, className: 'game-tile', 'data-fixture-tile': tile.id, style: { ...tilePosition(tile, metrics), zIndex: tile.z * 100 + Math.floor(tile.y * 10) }, onClick: () => window.streakFixture.tileTaps = (window.streakFixture.tileTaps || 0) + 1 }, e('span', { className: 'tile-side tile-back' }, e('img', { className: 'tile-art', src: themeById[state.theme].back, alt: '' }))))))),
              e('div', { className: 'game-tools' }, ...['Shuffle', 'Hint', 'Freeze', 'Eagle Eye'].map(label => e('button', { key: label }, label)))))));
        };
        window.streakFixture.make = id => ({ ...TURNING_POINTS[id], id, family: 'turning', eventId: `${id}:${Math.random()}`, actor: 'you', owner: 'you' });
        window.streakFixture.render({});
      });
      await page.evaluate(() => document.fonts.ready);
      const ids = await page.evaluate(() => Object.keys(window.streakFixture.events));
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: width === 320 ? 568 : width === 390 ? 844 : 1024 });
        for (const id of [...ids, 'chain_15']) {
          await page.evaluate(id => {
            const cue = id === 'chain_15' ? { id, family: 'chain', eventId: 'peak', actor: 'you', owner: 'you', count: 15, name: 'Phenomenal', intensity: 1, duration: 900, peak: true } : window.streakFixture.make(id);
            window.streakFixture.render({ cues: [cue], paused: true, gentle: true });
          }, id);
          await page.waitForSelector(`[data-streak-id="${id}"]`);
          const geometry = await page.evaluate(() => {
            const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; };
            const feedback = document.querySelector('.streak-feedback');
            return { feedback: box('.streak-feedback'), board: box('.board-space'), score: box('.duel-scoreboard'),
              height: feedback.clientHeight, titleSize: parseFloat(getComputedStyle(feedback.querySelector('.streak-title')).fontSize), overflow: feedback.scrollWidth > feedback.clientWidth, interactive: getComputedStyle(feedback).pointerEvents,
              text: feedback.textContent, rings: document.querySelectorAll('.streak-portrait-ring').length,
              opponentRing: document.querySelector('.opponent .streak-portrait-ring') !== null, width: innerWidth };
          });
          assert.equal(geometry.interactive, 'none'); assert.equal(geometry.overflow, false, `${name} ${width} ${id} text overflows`);
          assert.ok(geometry.feedback.x >= 0 && geometry.feedback.right <= geometry.width, 'feedback fits viewport');
          assert.ok(geometry.feedback.y >= geometry.score.bottom, 'does not cover score/progress');
          assert.ok(geometry.height >= 120 && geometry.titleSize >= 32, 'banner and title are visually prominent');
          assert.ok(geometry.feedback.bottom > geometry.board.y + 60, 'celebration reaches across top of board');
          assert.equal(geometry.rings, id === 'chain_15' ? 0 : 1); assert.equal(geometry.opponentRing, false);
          if (id === 'turning_draw_only') {
            assert.ok(geometry.text.includes('Match the remaining pairs to draw'));
            const subtitle = await page.locator('.streak-copy small').evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth, parent: node.parentElement.clientWidth, grandparent: node.parentElement.parentElement.clientWidth }));
            assert.ok(subtitle.scroll <= subtitle.width + 1, `${name} ${width} Resolute subtitle clipped: ${JSON.stringify(subtitle)}`);
          }
          if (width === 320 || id === 'turning_draw_only') await page.screenshot({ path: path.join(output, `${name}-${width}-${id}.png`) });
        }
      }
      for (const theme of ['ming-porcelain', 'dancheong', 'stained-glass', 'dutch-golden-age']) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(theme => window.streakFixture.render({ theme, cues: [window.streakFixture.make('turning_draw_only')] }), theme);
        await page.waitForTimeout(100);
        await page.screenshot({ path: path.join(output, `${name}-${theme}.png`) });
      }
      // Large feedback overlays the board without changing its geometry or intercepting tiles.
      await page.setViewportSize({ width: 320, height: 568 });
      await page.evaluate(() => window.streakFixture.render({ cues: [] })); await page.waitForTimeout(40);
      const boardBefore = await page.locator('.game-board').boundingBox();
      await page.evaluate(() => window.streakFixture.render({ cues: [window.streakFixture.make('turning_win_secured'), { id: 'chain_15', family: 'chain', eventId: 'secondary-peak', actor: 'you', owner: 'you', count: 15, name: 'Phenomenal', intensity: 1, peak: true }], paused: true, gentle: true }));
      await page.waitForTimeout(60);
      assert.deepEqual(await page.locator('.game-board').boundingBox(), boardBefore, 'banner never shrinks/moves the board');
      assert.equal(await page.locator('.streak-secondary').count(), 1);
      const target = await page.evaluate(() => {
        const banner = document.querySelector('.streak-feedback').getBoundingClientRect();
        const points = [...document.querySelectorAll('[data-fixture-tile]')].map(node => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        return points.find(point => point.y > banner.y && point.y < banner.bottom && document.elementFromPoint(point.x, point.y)?.closest('[data-fixture-tile]'));
      });
      assert.ok(target, 'a real tile remains hit-testable beneath the celebration');
      await page.mouse.click(target.x, target.y);
      assert.equal(await page.evaluate(() => window.streakFixture.tileTaps), 1, 'tap crosses decorative overlay to tile');
      await page.screenshot({ path: path.join(output, `${name}-320-terminal-and-chain.png`) });
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(80);
      const landscape = await page.locator('.streak-feedback').boundingBox();
      assert.ok(landscape.x >= 0 && landscape.x + landscape.width <= 844, 'rotation retains the complete banner');
      const landscapeTools = await page.locator('.game-tools').boundingBox();
      assert.ok(landscape.x + landscape.width <= landscapeTools.x, 'rotated celebration stays out of the booster sidebar');
      await page.screenshot({ path: path.join(output, `${name}-landscape.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      // New batches replace immediately; pause preserves remaining lifetime; gentle/OS mode retains text.
      await page.evaluate(() => window.streakFixture.render({ cues: [window.streakFixture.make('turning_win_secured')], paused: false, gentle: false }));
      await page.waitForTimeout(170);
      await page.evaluate(() => window.streakFixture.render({ paused: true }));
      await page.waitForTimeout(1000);
      assert.equal(await page.evaluate(() => window.streakFixture.completed), 0, 'paused presentation cannot complete');
      await page.evaluate(() => window.streakFixture.render({ paused: false }));
      await page.waitForTimeout(1700);
      assert.equal(await page.evaluate(() => window.streakFixture.completed), 1, 'resumes remaining visual time once');
      await page.evaluate(() => window.streakFixture.render({ gentle: true })); await page.waitForTimeout(1000);
      assert.equal(await page.evaluate(() => window.streakFixture.completed), 1, 'same cues identity does not complete again');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(() => window.streakFixture.render({ cues: [window.streakFixture.make('turning_equalize')], paused: true, gentle: false }));
      await page.waitForTimeout(80);
      assert.equal(await page.locator('.streak-primary').evaluate(node => getComputedStyle(node).animationName), 'none');
      assert.ok(await page.locator('.streak-feedback').isVisible());
      await page.evaluate(() => window.streakFixture.render({ cues: [{ ...window.streakFixture.make('turning_equalize'), owner: 'ai', actor: 'ai' }] }));
      await page.waitForTimeout(50); assert.equal(await page.locator('.streak-feedback').count(), 0);
      console.log(`PASS ${name}: eight large portrait-owned Turning Points + peak chain fill phone/tablet banner, pause/resume once, reduced motion retains text, opponent cues rejected`);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
