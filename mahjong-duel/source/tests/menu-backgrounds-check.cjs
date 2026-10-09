/* Menu scene rotation and continuity, without production test hooks.
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/menu-backgrounds-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const output = path.resolve(__dirname, '../tmp/menu-background-qa');
const sceneIds = ['bamboo', 'lantern-night', 'autumn-daylight'];
const scenes = [
  { id: 'bamboo', previous: 'lantern-night', random: 0 },
  { id: 'lantern-night', previous: 'bamboo', random: 0 },
  { id: 'autumn-daylight', previous: 'bamboo', random: .999 },
];
const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch({ headless: true });
  const checks = [], layouts = [], errors = [];
  let activePage;
  const report = label => { checks.push(label); console.log(`PASS ${browserName}: ${label}`); };
  const button = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' });
  const scene = page => page.locator('.menu-scene:not(.menu-scene-transition)');
  const sceneId = page => scene(page).getAttribute('data-menu-background');
  const savedId = page => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:menuBackground')));
  async function newPage(seed, deniedStorage = false) {
    const context = await browser.newContext({ viewport: viewports[1], isMobile: true, hasTouch: true });
    await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
    await context.addInitScript(({ seed, deniedStorage }) => {
      if (deniedStorage) {
        Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage blocked for test', 'SecurityError'); } });
      } else if (!sessionStorage.getItem('menu-background-check-seeded')) {
        localStorage.clear(); localStorage.setItem('porcelain:language', '"en"');
        if (seed) localStorage.setItem('porcelain:menuBackground', JSON.stringify(seed.previous));
        localStorage.setItem('porcelain:sound', 'false');
        sessionStorage.setItem('menu-background-check-seeded', 'true');
      }
      if (seed) Math.random = () => seed.random;
    }, { seed, deniedStorage });
    const page = await context.newPage(); activePage = page; page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto(origin);
    await home(page);
    return { context, page };
  }
  async function home(page) {
    await page.locator('.world').waitFor();
    if (await button(page, 'Back to main menu').count()) await button(page, 'Back to main menu').click();
    await button(page, 'Play').waitFor();
    await page.locator('.game-board, .sheet-backdrop, .progression-page').waitFor({ state: 'detached' });
    await page.waitForFunction(() => {
      const image = document.querySelector('.menu-scene:not(.menu-scene-transition) .menu-scene-art');
      const home = document.querySelector('.home-screen');
      return image?.complete && image.naturalWidth > 0 && home && Number(getComputedStyle(home).opacity) > .99;
    });
  }
  async function unchanged(page, expected, stage, storageAvailable = true) {
    assert.equal(await sceneId(page), expected, `${stage}: the launch scene is retained`);
    if (storageAvailable) assert.equal(await savedId(page), expected, `${stage}: the same scene ID remains stored`);
  }
  async function closeSheet(page) {
    await button(page, 'Close dialog').click();
    await page.locator('.sheet-backdrop').waitFor({ state: 'detached' });
  }
  async function settings(page, expected, storageAvailable = true) {
    await button(page, 'Settings').click();
    await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
    await unchanged(page, expected, 'Settings', storageAvailable);
    assert.ok(await page.locator('.menu-atmosphere.is-paused').count(), 'Settings pauses scene atmosphere');
    assert.ok(await page.locator('.menu-atmosphere').evaluate(node => node.getAnimations({ subtree: true }).every(animation => animation.playState === 'paused')), 'all ambient CSS animations pause behind Settings');
    await closeSheet(page);
    await unchanged(page, expected, 'return from Settings', storageAvailable);
    assert.equal(await page.locator('.menu-atmosphere.is-paused').count(), 0, 'returning home resumes atmosphere');
  }
  async function motionPreferences(page, expected) {
    await button(page, 'Settings').click();
    const gentle = page.getByRole('switch', { name: /Gentle motion/ });
    await gentle.check();
    await closeSheet(page);
    assert.equal(await page.locator('.menu-atmosphere').isVisible(), false, 'Gentle motion hides atmosphere');
    await unchanged(page, expected, 'Gentle motion');
    await button(page, 'Settings').click(); await gentle.uncheck(); await closeSheet(page);
    assert.equal(await page.locator('.menu-atmosphere').isVisible(), true, 'disabling Gentle motion restores atmosphere');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.menu-atmosphere').isVisible(), false, 'system reduced motion hides atmosphere');
    await unchanged(page, expected, 'system reduced motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(await page.locator('.menu-atmosphere').isVisible(), true);
  }
  async function navigation(page, expected) {
    await settings(page, expected);
    await button(page, 'Choose tile theme').click();
    await page.getByRole('dialog', { name: 'Theme', exact: true }).waitFor();
    await page.locator('.collection-row').filter({ has: page.getByText('Dancheong', { exact: true }) }).click();
    await page.getByRole('tab', { name: 'Background', exact: true }).click();
    await page.locator('.background-swatch').filter({ has: page.getByText('Stained Glass', { exact: true }) }).click();
    await button(page, /^Confirm/).click();
    await page.locator('.sheet-backdrop').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.world').getAttribute('data-theme'), 'dancheong');
    assert.equal(await page.locator('.world').getAttribute('data-board-theme'), 'stained-glass');
    await unchanged(page, expected, 'tile and board theme change');
    await button(page, 'Collection').click();
    await page.getByRole('dialog', { name: 'Collection', exact: true }).waitFor();
    assert.equal(await page.getByRole('group', { name: 'Collection ruleset' }).count(), 0, 'Collection has no separate edition switch');
    await unchanged(page, expected, 'Collection');
    await button(page, 'Back to main menu').click();
    await page.locator('.collection-page').waitFor({ state: 'detached' });
    await button(page, /^Daily Rewards,/).click();
    await page.getByRole('heading', { name: 'Daily Rewards', exact: true }).waitFor();
    await unchanged(page, expected, 'Daily Rewards');
    await button(page, 'Back to main menu').click();
    await home(page);
    await unchanged(page, expected, 'return from Daily Rewards');
  }
  async function duelAndReturn(page, expected, storageAvailable = true) {
    await button(page, 'Play').click();
    const transition = page.locator(expected === 'bamboo' ? '.door-transition' : '.menu-scene-transition');
    await transition.waitFor();
    if (expected !== 'bamboo') {
      assert.equal(await transition.getAttribute('data-menu-background'), expected, 'entry fades the selected scene');
      assert.equal(await page.locator('.door-transition').count(), 0, 'alternate scene entry never flashes bamboo doors');
    }
    await transition.waitFor({ state: 'detached' });
    await page.locator('.game-board').waitFor();
    assert.equal(await scene(page).count(), 0, 'menu art does not overlay the game');
    assert.equal(await page.locator('.game-tile').count(), 60, 'a complete new duel starts');
    if (storageAvailable) assert.equal(await savedId(page), expected, 'starting a duel retains the selected scene');
    await button(page, 'Pause game').click();
    await page.getByRole('dialog', { name: 'Paused', exact: true }).waitFor();
    await button(page, 'Leave duel').click();
    await page.getByRole('dialog', { name: 'Leave duel?', exact: true }).waitFor();
    await button(page, 'Leave duel').click();
    await home(page);
    await unchanged(page, expected, 'leave duel and return home', storageAvailable);
  }
  async function capture(page, expected, viewport) {
    await page.setViewportSize(viewport);
    await home(page);
    await page.evaluate(() => document.fonts.ready);
    // WebKit can expose the new viewport before dynamic viewport CSS has settled.
    await page.waitForFunction(({ width, height }) => {
      const rect = document.querySelector('.menu-scene-art').getBoundingClientRect();
      return innerWidth === width && innerHeight === height && rect.width >= width - 1 && rect.height >= height - 1;
    }, viewport);
    const metrics = await page.evaluate(() => {
      const image = document.querySelector('.menu-scene-art');
      const controls = [...document.querySelectorAll('.home-screen button')].filter(node => node.getClientRects().length > 0).map(node => {
        const rect = node.getBoundingClientRect();
        return { name: node.getAttribute('aria-label') || node.textContent.trim(), rect: rect.toJSON(),
          clickable: node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
      });
      return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
        image: { loaded: image.complete && image.naturalWidth > 0, src: image.getAttribute('src'), rect: image.getBoundingClientRect().toJSON() }, controls };
    });
    assert.ok(metrics.image.loaded, `${expected}: image is decoded`);
    assert.ok(metrics.image.rect.width >= viewport.width - 1 && metrics.image.rect.height >= viewport.height - 1, `scene covers viewport: ${JSON.stringify(metrics.image.rect)}`);
    assert.ok(metrics.documentWidth <= viewport.width, 'no horizontal overflow');
    for (const control of metrics.controls) {
      const { left, right, top, bottom } = control.rect;
      assert.ok(left >= -1 && right <= viewport.width + 1 && top >= -1 && bottom <= viewport.height + 1, `${control.name} stays on screen`);
      assert.ok(control.clickable, `${control.name} is not blocked by menu artwork or atmosphere`);
    }
    for (const name of ['Settings', 'Choose tile theme', 'Play', 'Collection']) await button(page, name).click({ trial: true });
    await page.screenshot({ path: path.join(output, `${expected}-${browserName}-${viewport.width}x${viewport.height}.png`) });
    layouts.push({ scene: expected, ...metrics });
    await settings(page, expected);
  }
  try {
    for (const seed of scenes) {
      const { context, page } = await newPage(seed);
      await unchanged(page, seed.id, 'initial launch');
      for (const viewport of viewports) await capture(page, seed.id, viewport);
      await page.setViewportSize(viewports[1]);
      await navigation(page, seed.id);
      await motionPreferences(page, seed.id);
      await duelAndReturn(page, seed.id);
      await page.reload(); await home(page);
      const next = await sceneId(page);
      assert.ok(sceneIds.includes(next)); assert.notEqual(next, seed.id, 'next reload excludes the scene from the completed session');
      assert.equal(await savedId(page), next);
      report(`${seed.id}: 3 viewports, controls accessible, atmosphere pauses/honors motion preferences, navigation and duel return preserve scene; next launch rotates`);
      await context.close();
    }
    {
      const { context, page } = await newPage();
      const sequence = [await sceneId(page)];
      for (let launch = 0; launch < 10; launch++) {
        await page.reload(); await home(page);
        const next = await sceneId(page);
        assert.ok(sceneIds.includes(next)); assert.notEqual(next, sequence.at(-1), 'natural randomness never repeats the previous launch');
        assert.equal(await savedId(page), next); sequence.push(next);
      }
      report(`11 launches without consecutive repeats: ${sequence.join(' → ')}`);
      await context.close();
    }
    {
      const { context, page } = await newPage(null, true);
      const expected = await sceneId(page); assert.ok(sceneIds.includes(expected));
      await settings(page, expected, false);
      await duelAndReturn(page, expected, false);
      await page.reload(); await home(page);
      assert.ok(sceneIds.includes(await sceneId(page)));
      report('denied localStorage still loads a valid scene, opens Settings, and starts/leaves a duel');
      await context.close();
    }
    assert.deepEqual(errors, [], 'no runtime errors or failed local responses');
    fs.writeFileSync(path.join(output, `${browserName}-report.json`), JSON.stringify({ browser: browserName, checks, layouts, errors }, null, 2));
    console.log(JSON.stringify({ browser: browserName, passed: checks.length, screenshots: layouts.length, errors }, null, 2));
  } catch (error) {
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(output, `${browserName}-failure.png`), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(output, `${browserName}-failure.json`), JSON.stringify({ checks, layouts, errors, error: error.stack }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
