/* Exercise theme selection through the real UI; collection fixtures use public data.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/theme-selection-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const output = path.resolve('tmp/theme-selection-qa');
const sizes = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }];
const time = new Date('2026-09-30T12:00:00Z');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const load = file => import(pathToFileURL(path.resolve('src', file)).href);
  const [{ themes, rulesetForTheme }, { themeTileSets }, { rarityForTile }, { createCollection }, { boardVariants }] = await Promise.all([
    load('themes.js'), load('tile-data.js'), load('rarity.js'), load('collection.js'), load('board-variants.js'),
  ]);
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch();
  const reports = [];
  function collectionFor(unlockedCount) {
    const collection = createCollection();
    const add = (themeId, rarities, required) => {
      const edition = rulesetForTheme(themeId);
      for (const tile of themeTileSets[themeId][edition]) {
        if (rarities.includes(rarityForTile(themeId, edition, tile.id).id)) collection.counts[tile.matchKey] = required;
      }
    };
    for (let index = 1; index < unlockedCount; index++) {
      add(themes[index - 1].id, ['marble', 'sapphire'], 3);
      if (index > 1) add(themes[index - 2].id, ['amethyst', 'gold'], 2);
    }
    return collection;
  }
  async function run(label, viewport, fixture, scenario) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
    await context.addInitScript(({ fixture }) => {
      // Seed only once, so a reload genuinely exercises the saved app state.
      if (!localStorage.getItem('theme-selection-check-seeded')) {
        localStorage.setItem('porcelain:gentle', 'true');
        localStorage.setItem('porcelain:sound', 'false');
        if (fixture.collection) localStorage.setItem('porcelain:collection', JSON.stringify(fixture.collection));
        if (fixture.ruleset) localStorage.setItem('porcelain:ruleset', JSON.stringify(fixture.ruleset));
        if (fixture.theme) localStorage.setItem('porcelain:theme', JSON.stringify(fixture.theme));
        if (fixture.boardTheme) localStorage.setItem('porcelain:boardTheme', JSON.stringify(fixture.boardTheme));
        localStorage.setItem('theme-selection-check-seeded', 'true');
      }
    }, { fixture });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
    const advance = async (ms = 200) => { await page.clock.runFor(ms); await page.evaluate(() => document.body.childElementCount); };
    const button = name => page.getByRole('button', { name, exact: true });
    const card = id => page.locator(`.theme-choice-card[data-theme="${id}"]`);
    const tap = async target => {
      const node = typeof target === 'string' ? button(target) : target;
      await node.waitFor();
      await node.scrollIntoViewIfNeeded();
      const rect = await node.boundingBox();
      assert.ok(rect && rect.width >= 44 && rect.height >= 44, `${label}: touch target ${await node.textContent()} is at least 44px`);
      await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await advance();
    };
    const openSelection = async () => {
      await tap('Play');
      await page.getByRole('heading', { name: 'Choose a theme', exact: true }).waitFor();
      assert.equal(await page.locator('.game-board').count(), 0, `${label}: home Play opens selection before dealing`);
    };
    const checkUnlocked = async count => {
      assert.equal(await page.locator('.theme-choice-card').count(), 4);
      for (let index = 0; index < themes.length; index++) {
        const classes = await card(themes[index].id).getAttribute('class');
        assert.equal(classes.includes('is-unlocked'), index < count, `${label}: ${themes[index].name} availability`);
        if (index >= count) {
          const filter = await card(themes[index].id).locator('.theme-choice-art').evaluate(node => getComputedStyle(node).filter);
          const brightness = filter.match(/brightness\(([\d.]+)\)/);
          assert.ok(brightness && Number(brightness[1]) < 1, `${label}: locked art is darkened`);
        }
      }
    };
    const populations = () => page.locator('.theme-choice-card').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.dataset.theme, Number(node.querySelector('.theme-choice-population').textContent.replace(/\D/g, ''))])));
    const populationState = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('mahjong-duel-theme-population-v1')));
    const checkLayout = async (suffix, { footer = true } = {}) => {
      const layout = await page.evaluate(() => {
        const selectors = ['html', '.theme-select-page', '.theme-select-page .progression-page-content', '.theme-choice-scroll', '.theme-unlock-scroll'];
        const overflow = selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(node => ({ selector, excess: node.scrollWidth - node.clientWidth })));
        const targets = [...document.querySelectorAll('.theme-select-page button,.theme-select-page summary')].map(node => {
          const { width, height } = node.getBoundingClientRect(); return { name: node.textContent.trim(), width, height };
        });
        const play = document.querySelector('.theme-choice-play'), bounds = play?.getBoundingClientRect();
        return { overflow, targets, footer: bounds ? { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right, reachable: document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.closest('button') === play } : null, width: innerWidth, height: innerHeight };
      });
      assert.ok(layout.overflow.every(node => node.excess <= 1), `${label}: no horizontal overflow ${JSON.stringify(layout.overflow)}`);
      assert.ok(layout.targets.every(node => node.width >= 44 && node.height >= 44), `${label}: controls meet 44px targets ${JSON.stringify(layout.targets)}`);
      if (footer) assert.ok(layout.footer && layout.footer.top >= 0 && layout.footer.bottom <= layout.height && layout.footer.left >= 0 && layout.footer.right <= layout.width && layout.footer.reachable, `${label}: Play footer stays fully visible and reachable`);
      await page.locator('.theme-select-page img:not([loading="lazy"])').evaluateAll(nodes => Promise.all(nodes.map(node => node.decode())));
      await page.screenshot({ path: path.join(output, `${browserName}-${label}-${suffix}.jpg`), type: 'jpeg', quality: 80, animations: 'disabled' });
      return layout;
    };
    const checkBoard = async themeId => {
      const edition = rulesetForTheme(themeId);
      await advance(4000); await advance(2500);
      await page.locator('.game-board').waitFor(); await advance(500);
      const result = await page.evaluate(() => ({
        theme: document.querySelector('.world').dataset.theme,
        board: document.querySelector('.world').dataset.boardTheme,
        label: document.querySelector('.game-board').getAttribute('aria-label'),
        faces: [...document.querySelectorAll('.game-tile .tile-front img')].map(node => node.src),
        backs: [...document.querySelectorAll('.game-tile .tile-back img')].map(node => node.src),
        surface: document.querySelector('.table-surface').style.getPropertyValue('--surface-image'),
      }));
      assert.equal(result.theme, themeId); assert.equal(result.board, themeId);
      assert.ok(result.label.startsWith(edition)); assert.equal(result.faces.length, 60);
      const faceUrls = new Set(themeTileSets[themeId][edition].map(tile => new URL(tile.src, `${origin}/`).href));
      assert.ok(result.faces.every(src => faceUrls.has(src)), `${label}: every dealt tile belongs to selected theme and edition`);
      assert.ok(result.backs.every(src => src === new URL(themes.find(theme => theme.id === themeId).back, `${origin}/`).href), `${label}: tile backs match selected theme`);
      assert.ok(Object.values(boardVariants[themeId]).some(art => result.surface.includes(new URL(art.src, `${origin}/`).href)), `${label}: actual board artwork matches selected theme`);
      return result;
    };
    const restart = async () => { await tap('Pause game'); await tap('New duel'); await tap('Choose a theme'); await page.getByRole('heading', { name: 'Choose a theme', exact: true }).waitFor(); };
    try {
      await page.goto(origin);
      await page.getByRole('heading', { name: 'Daily Rewards', exact: true }).waitFor();
      await advance(400); await tap('Claim rewards');
      await page.getByRole('heading', { name: 'Daily Quests', exact: true }).waitFor();
      await tap('Back to main menu');
      const result = await scenario({ page, tap, button, card, advance, openSelection, checkUnlocked, populations, populationState, checkLayout, checkBoard, restart });
      assert.deepEqual(errors, [], `${label}: no page or asset errors`);
      reports.push({ label, ...result, errors });
      console.log(`PASS ${browserName} ${label}`);
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${browserName}-${label}-failure.jpg`), type: 'jpeg', quality: 80, animations: 'disabled' }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
  try {
    for (const viewport of sizes) await run(`fresh-${viewport.width}x${viewport.height}`, viewport, {}, async ui => {
      const { page, tap, card, advance, openSelection, checkUnlocked, populations, populationState, checkLayout, checkBoard, restart } = ui;
      assert.equal(await page.getByRole('button', { name: /Themes|Choose tile theme/ }).count(), 0, 'old Themes control is absent');
      const toolbar = await page.locator('.home-toolbar').boundingBox(), utilities = await page.locator('.home-utilities').boundingBox();
      assert.ok(Math.abs(toolbar.x + toolbar.width - utilities.x - utilities.width) <= 2, 'home utilities align right');
      await page.screenshot({ path: path.join(output, `${browserName}-fresh-${viewport.width}x${viewport.height}-home.jpg`), type: 'jpeg', quality: 80, animations: 'disabled' });
      await openSelection(); await checkUnlocked(1);
      assert.equal(await card('ming-porcelain').getAttribute('aria-pressed'), 'true');
      const before = await populations();
      assert.ok(Object.values(before).every(count => count >= 18000 && count <= 130000));
      const layout = await checkLayout('selection');
      for (const theme of themes.slice(1)) {
        await tap(card(theme.id));
        await page.getByRole('heading', { name: `Unlock ${theme.name}`, exact: true }).waitFor();
        assert.equal(await page.locator('.game-board').count(), 0, 'locked card never deals a board');
        assert.equal(await page.locator('.theme-choice-play').count(), 0, 'locked requirements cannot start a duel');
        const expectedGoals = theme.id === 'dancheong' ? 2 : 4;
        assert.equal(await page.locator('.theme-unlock-goal').count(), expectedGoals);
        assert.match(await page.locator('.theme-unlock-body').textContent(), /Collection progress/);
        assert.doesNotMatch(await page.locator('.theme-unlock-body').textContent(), /Eastern|Western/);
        await tap(page.locator('.theme-unlock-goal > summary').first());
        assert.ok(await page.locator('.theme-unlock-goal[open] .theme-goal-tiles > li').count() > 0);
        if (theme.id === 'dancheong') await checkLayout('requirements', { footer: false });
        await tap('Back to theme selection');
        assert.equal(await card('ming-porcelain').getAttribute('aria-pressed'), 'true', 'locked inspection preserves playable selection');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.theme), theme.id, 'Back restores inspected card focus');
        assert.deepEqual(await populations(), before);
      }
      await checkLayout('scrolled-footer');
      await tap('Back to main menu'); await openSelection();
      assert.deepEqual(await populations(), before, 'population survives navigation');
      let populationTiming;
      if (viewport.width === 390) {
        await page.reload(); await advance(400); await openSelection();
        assert.deepEqual(await populations(), before, 'population survives reload');
        const initial = await populationState();
        const elapsed = await page.evaluate(updatedAt => Date.now() - updatedAt, initial.updatedAt);
        await page.clock.fastForward(179999 - elapsed);
        assert.deepEqual(await populations(), before, 'population remains unchanged until 180 seconds');
        await page.clock.runFor(1);
        // React may commit its scheduled update after the timer callback returns.
        let after = await populationState();
        for (let retry = 0; retry < 50 && after.updatedAt === initial.updatedAt; retry++) {
          await new Promise(resolve => setTimeout(resolve, 20));
          after = await populationState();
        }
        assert.equal(after.updatedAt - initial.updatedAt, 180000, 'population updates at 180 seconds');
        for (const id of Object.keys(before)) {
          assert.ok(after.counts[id] >= 18000 && after.counts[id] <= 130000);
          assert.ok(Math.abs(after.counts[id] - before[id]) <= Math.floor(before[id] * .02), 'each change is at most 2%');
        }
        assert.deepEqual(await populations(), after.counts, 'updated counts reach the cards');
        populationTiming = { before, after: after.counts, elapsed: after.updatedAt - initial.updatedAt };
      }
      // The only unlocked collection must always win, even across repeated random deals.
      for (let attempt = 0; attempt < 3; attempt++) {
        await tap(page.locator('.theme-random-choice')); await tap('Play');
        await checkBoard('ming-porcelain');
        if (attempt < 2) await restart();
      }
      return { layout, populationTiming, randomDeals: 3 };
    });
    await run('saved-locked-theme', sizes[1], { theme: 'dutch-golden-age', boardTheme: 'stained-glass' }, async ({ page, tap, card, openSelection, checkUnlocked, checkBoard }) => {
      await openSelection(); await checkUnlocked(1);
      assert.equal(await card('ming-porcelain').getAttribute('aria-pressed'), 'true');
      await tap('Play'); await checkBoard('ming-porcelain');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:theme'))), 'ming-porcelain');
      return { savedLockedPreferenceGuarded: true };
    });
    // Old saved preferences must not change the single collection path or deal.
    for (const legacyPreference of ['eastern', 'western']) {
      for (const unlocked of [2, 3, 4]) await run(`${legacyPreference}-preference-unlocked-${unlocked}`, sizes[1], { collection: collectionFor(unlocked), ruleset: legacyPreference }, async ({ page, tap, card, openSelection, checkUnlocked, checkBoard, restart, checkLayout }) => {
        await openSelection(); await checkUnlocked(unlocked);
        const themeId = themes[unlocked - 1].id;
        await tap(card(themeId));
        assert.equal(await card(themeId).getAttribute('aria-pressed'), 'true');
        if (unlocked === 4) await checkLayout(`${legacyPreference}-all-unlocked`);
        await tap('Play'); await checkBoard(themeId);
        await restart(); await tap('Back to main menu'); await tap('Settings');
        assert.equal(await page.getByRole('group', { name: 'Ruleset', exact: true }).count(), 0, 'Settings no longer selects tile sets');
        assert.equal(await page.getByRole('button', { name: /^(Eastern|Western)$/ }).count(), 0);
        await tap('Done');
        await openSelection(); await checkUnlocked(unlocked);
        return { legacyPreference, edition: rulesetForTheme(themeId), unlocked, selectedTheme: themeId };
      });
    }
    fs.writeFileSync(path.join(output, `${browserName}-report.json`), JSON.stringify(reports, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
