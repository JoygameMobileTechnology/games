/* Sessionless duel navigation and the simplified home screen.
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/menu-flow-check.cjs [--webkit]
 * Uses actual UI actions and a legacy storage seed; no production test hooks.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';

(async () => {
  const engine = await import(pathToFileURL(path.join(root, 'src/engine.js')));
  const { createDuelState } = await import(pathToFileURL(path.join(root, 'src/duel.js')));
  const oldSave = { version: 3, ...engine.createGame('eastern', 9012, 'calm', 'ming-porcelain'),
    ...createDuelState(), gameId: 'retired-board', mode: 'duel', elapsed: 20, aiMemory: {},
    boosters: { shuffle: 3, hint: 3, freeze: 3, eagle: 3 }, duelView: { revealed: [], pending: null } };
  const initialCollection = { version: 1, counts: { 'ming-porcelain:eastern:K01': 2 }, receipts: {} };
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
  await context.addInitScript(({ oldSave, initialCollection }) => {
    const originalSet = Storage.prototype.setItem;
    if (!sessionStorage.getItem('menu-flow-seeded')) {
      localStorage.clear(); localStorage.setItem('porcelain:language', '"en"');
      for (const [key, value] of Object.entries({ session: oldSave, collection: initialCollection, sound: false, gentle: true }))
        originalSet.call(localStorage, `porcelain:${key}`, JSON.stringify(value));
      originalSet.call(sessionStorage, 'menu-flow-seeded', 'true');
      originalSet.call(sessionStorage, 'menu-flow-session-writes', '[]');
    }
    // Observe writes without exposing or changing app state. Keep the audit through reload.
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === 'porcelain:session') {
        const writes = JSON.parse(sessionStorage.getItem('menu-flow-session-writes') || '[]');
        writes.push(value);
        originalSet.call(sessionStorage, 'menu-flow-session-writes', JSON.stringify(writes));
      }
      return originalSet.call(this, key, value);
    };
  }, { oldSave, initialCollection });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const output = path.join(root, 'tmp/menu-flow-qa'); fs.mkdirSync(output, { recursive: true });
  const errors = [], checks = [], layouts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' });
  const stored = key => page.evaluate(key => JSON.parse(localStorage.getItem(`porcelain:${key}`)), key);
  const report = label => { checks.push(label); console.log(`PASS ${browserName}: ${label}`); };
  async function noSavedBoard() {
    assert.equal(await page.evaluate(() => localStorage.getItem('porcelain:session')), null, 'no duel is stored');
    assert.deepEqual(await page.evaluate(() => JSON.parse(sessionStorage.getItem('menu-flow-session-writes'))), [], 'gameplay never writes a new saved duel');
  }
  async function dialog(name) {
    await page.waitForFunction(name => {
      const panels = document.querySelectorAll('.sheet-backdrop');
      return panels.length === 1 && panels[0].querySelector('.parchment-header h2')?.textContent === name;
    }, name);
    await page.getByRole('dialog', { name, exact: true }).waitFor();
  }
  async function home() {
    await button('Play').waitFor();
    await page.locator('.game-board').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.menu-fan:visible').count(), 0, 'the decorative tile fan is hidden');
    assert.equal(await page.locator('.home-resume, .home-rules, .home-help, .collection-label').count(), 0);
    assert.equal(await page.locator('.home-screen [aria-label="Ruleset"]').count(), 0);
    assert.equal(await button(/^Continue duel/).count(), 0);
    assert.equal(await button('Rules').count(), 0);
    assert.equal(await page.locator('.home-screen .home-toolbar [aria-label="Choose tile theme"]').count(), 1);
    assert.equal(await button('Choose tile theme').count(), 1, 'one theme selector is in the toolbar');
    await noSavedBoard();
  }
  async function closeTo(parent) {
    await button('Close dialog').click();
    if (parent) await dialog(parent);
    else await page.locator('.sheet-backdrop').waitFor({ state: 'detached' });
  }
  const board = () => page.locator('.game-board').evaluate(node => ({
    label: node.getAttribute('aria-label'),
    tiles: [...node.querySelectorAll('.game-tile')].map(tile => ({ id: tile.dataset.tileId, up: tile.dataset.faceUp,
      left: tile.style.left, top: tile.style.top, face: tile.querySelector('.tile-front img')?.getAttribute('src') })),
    scores: [...document.querySelectorAll('.player-score strong')].map(node => node.textContent),
    tools: [...document.querySelectorAll('.game-tools button')].map(node => node.getAttribute('aria-label')),
  }));
  async function launch(ruleset) {
    await button('Play').click(); await page.locator('.game-board').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.game-tile').length === 60);
    assert.match(await page.locator('.game-board').getAttribute('aria-label'), new RegExp(`^${ruleset} Mahjong board, 60 tiles left$`));
    assert.equal(await page.locator('.game-tile[data-face-up="true"]').count(), 0);
    const wallet = (await stored('progression')).wallet;
    for (const [id, name] of Object.entries({ shuffle: 'Shuffle', hint: 'Hint', freeze: 'Freeze', eagle: 'Eagle Eye' })) {
      assert.equal(await button(`${name}, ${wallet[id]} uses left`).isEnabled(), wallet[id] > 0);
    }
    assert.deepEqual(await page.locator('.player-score strong').allTextContents(), ['0', '0']);
    await noSavedBoard();
    return stored('lastFormation');
  }
  async function pause() { await button('Pause game').click(); await dialog('Paused'); }
  async function leave() {
    await pause(); await button('Leave duel').click(); await dialog('Leave duel?'); await button('Keep playing').waitFor();
    await button('Leave duel').click(); await home();
  }
  async function tap(id) {
    const node = page.locator(`.game-tile[data-tile-id="${id}"]`);
    const point = await node.evaluate(node => {
      const rect = node.getBoundingClientRect();
      for (const fy of [.5, .92, .08]) for (const fx of [.5, .92, .08]) {
        const x = rect.x + rect.width * fx, y = rect.y + rect.height * fy;
        if (document.elementFromPoint(x, y)?.closest('[data-tile-id]') === node) return { x, y };
      }
      return null;
    });
    assert.ok(point, `tile ${id} has an exposed pointer target`); await page.mouse.click(point.x, point.y);
  }
  async function captureLayout(label, selectors) {
    // Capture the settled panel rather than its entering slide animation.
    await page.waitForFunction(selectors => selectors.every(selector => {
      const node = document.querySelector(selector);
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1;
    }), selectors);
    await page.waitForFunction(() => {
      const panels = document.querySelectorAll('.sheet-backdrop, .sheet, .home-screen:not([inert])');
      return [...panels].every(node => {
        const style = getComputedStyle(node);
        const matrix = style.transform === 'none' ? null : new DOMMatrixReadOnly(style.transform);
        return parseFloat(style.opacity) >= .99 && (!matrix || (Math.abs(matrix.m42) < .5 && Math.abs(matrix.m11 - 1) < .005));
      });
    });
    await page.evaluate(() => document.fonts.ready);
    const value = await page.evaluate(selectors => {
      const box = node => node.getBoundingClientRect().toJSON();
      return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
        boxes: Object.fromEntries(selectors.map(selector => [selector, box(document.querySelector(selector))])) };
    }, selectors);
    assert.ok(value.documentWidth <= value.width, `${label}: no horizontal overflow`);
    for (const [selector, rect] of Object.entries(value.boxes)) assert.ok(rect.left >= -1 && rect.right <= value.width + 1 && rect.top >= -1 && rect.bottom <= value.height + 1, `${label}: ${selector} stays on screen (${JSON.stringify(value)})`);
    layouts.push({ label, ...value });
    await page.screenshot({ path: path.join(output, `${label}-${browserName}-${value.width}x${value.height}.png`) });
    return value;
  }
  try {
    await page.goto(origin); await page.evaluate(() => document.fonts.ready);
    await button('Claim rewards 2x').click(); await home();
    assert.deepEqual(await stored('collection'), initialCollection, 'discarding a legacy board preserves collection progress');
    report('legacy saved boards are deleted; home has no fan, resume, ruleset or help controls and one toolbar theme selector');

    await button('Edit profile').click(); await dialog('Profile');
    await page.getByLabel(/Player name/).fill('Menu tester');
    await button(/^Avatar 3:/).click(); await page.getByLabel('Country', { exact: true }).selectOption('TR');
    await button('Save profile').click(); await page.locator('.sheet-backdrop').waitFor({ state: 'detached' });
    const expectedProfile = await stored('profile'); assert.equal(expectedProfile.name, 'Menu tester');
    assert.equal(expectedProfile.avatarId, 'avatar-3'); assert.equal(expectedProfile.countryCode, 'TR');
    await button('Choose tile theme').click(); await dialog('Theme');
    await page.locator('.collection-row').filter({ has: page.getByText('Dancheong', { exact: true }) }).click();
    await page.getByRole('tab', { name: 'Background', exact: true }).click();
    await page.locator('.background-swatch').filter({ has: page.getByText('Stained Glass', { exact: true }) }).click();
    await button(/^Confirm/).click(); await page.locator('.sheet-backdrop').waitFor({ state: 'detached' });
    await button('Settings').click(); await dialog('Settings');
    await page.locator('.settings-ruleset-switch').getByRole('button', { name: 'Western', exact: true }).click();
    await page.getByRole('switch', { name: /Rank pips/ }).uncheck();
    assert.equal(await stored('ruleset'), 'western'); assert.equal(await stored('pips'), false);
    await page.locator('.settings-rules-button').click(); await dialog('How to play');
    assert.match(await page.locator('.rules-content').innerText(), /Trust the picture/);
    await closeTo('Settings');
    await page.locator('.settings-rules-button').click();
    await page.getByRole('heading', { name: 'How to play', exact: true }).waitFor();
    await page.keyboard.press('Escape'); // Do not wait for the outgoing Settings animation.
    await dialog('Settings');
    assert.equal(await page.locator('.settings-ruleset-switch').getByRole('button', { name: 'Western', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape'); await page.locator('.sheet-backdrop').waitFor({ state: 'detached' });
    await home(); await page.reload(); await home();
    assert.deepEqual(await stored('profile'), expectedProfile);
    assert.deepEqual(await stored('collection'), initialCollection);
    assert.equal(await stored('ruleset'), 'western'); assert.equal(await stored('pips'), false);
    assert.equal(await page.locator('.world').getAttribute('data-theme'), 'dancheong');
    assert.equal(await page.locator('.world').getAttribute('data-board-theme'), 'stained-glass');
    report('profile, collection, themes and settings persist; Settings owns ruleset/help and child Rules returns to Settings');

    const firstFormation = await launch('western');
    await button('Hint, 2 uses left').click();
    await page.waitForFunction(() => document.querySelectorAll('.game-tile.hinted').length === 2);
    const pair = await page.locator('.game-tile.hinted').evaluateAll(nodes => nodes.map(node => node.dataset.tileId));
    await tap(pair[0]); await tap(pair[1]);
    await page.waitForFunction(() => document.querySelectorAll('.game-tile').length === 58);
    assert.equal(await page.locator('.player-score').first().locator('strong').innerText(), '100');
    assert.equal(await button('Hint, 1 uses left').count(), 1);
    const earnedCollection = await stored('collection');
    assert.equal(Object.values(earnedCollection.counts).reduce((sum, count) => sum + count, 0), 3);
    await page.locator('.game-tile[data-free="true"]').first().click();
    await page.waitForFunction(() => document.querySelectorAll('.game-tile[data-face-up="true"]').length === 1);
    const pausedBoard = await board();
    await pause(); await button('Continue').click(); await page.locator('.sheet-backdrop').waitFor({ state: 'detached' });
    assert.deepEqual(await board(), pausedBoard, 'Pause/Continue preserves scores, positions, boosters and the partly revealed attempt');
    await pause(); await button('Settings').click(); await dialog('Settings');
    assert.match(await page.locator('.settings-ruleset').innerText(), /Next duel/i);
    await page.locator('.settings-ruleset-switch').getByRole('button', { name: 'Eastern', exact: true }).click();
    assert.equal(await stored('ruleset'), 'eastern');
    assert.match(await page.locator('.game-board').getAttribute('aria-label'), /^western /);
    await page.locator('.settings-rules-button').click(); await dialog('How to play');
    assert.match(await page.locator('.rules-content').innerText(), /Trust the picture/, 'rules describes the current match');
    await button('Got it').click(); await dialog('Settings');
    await page.locator('.settings-rules-button').click();
    await page.getByRole('heading', { name: 'How to play', exact: true }).waitFor();
    await page.keyboard.press('Escape'); // Exiting Settings must not also consume Escape.
    await dialog('Settings'); await closeTo('Paused');
    await button('Leave duel').click(); await dialog('Leave duel?'); await button('Keep playing').waitFor();
    await button('Keep playing').click(); await dialog('Paused');
    await button('Continue').click(); await page.locator('.sheet-backdrop').waitFor({ state: 'detached' });
    assert.deepEqual(await board(), pausedBoard, 'canceling Leave keeps the complete current board');
    await noSavedBoard();
    report('Pause/Continue and canceled Leave preserve the active attempt; nested Settings/Rules return to their parent and ruleset changes apply only next duel');

    await leave(); assert.deepEqual(await stored('collection'), earnedCollection);
    assert.deepEqual(await stored('profile'), expectedProfile);
    const secondFormation = await launch('eastern'); assert.notEqual(secondFormation, firstFormation);
    await page.reload(); await home();
    assert.deepEqual(await stored('collection'), earnedCollection); assert.deepEqual(await stored('profile'), expectedProfile);
    const thirdFormation = await launch('eastern'); assert.notEqual(thirdFormation, secondFormation);
    await leave();
    await button('Collection').click(); await page.getByRole('dialog', { name: 'Collection', exact: true }).waitFor();
    assert.match(await page.locator('.collection-progress-copy').innerText(), /Eastern/);
    assert.equal(await page.getByRole('group', { name: 'Collection ruleset' }).count(), 0, 'Collection follows the edition chosen in Settings');
    assert.match(await page.locator('.collection-summary').innerText(), /\b3 pairs matched\b/);
    await button('Back to main menu').click(); await page.locator('.collection-page').waitFor({ state: 'detached' });
    report('confirmed Leave and reload discard the duel; earned binder progress survives and fresh 60-tile games with a persistent booster wallet never repeat the previous formation');

    for (const [width, height] of [[320, 568], [375, 667], [390, 844], [440, 956], [768, 1024], [1024, 1366]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(180); await home();
      const layout = await captureLayout('home', ['.home-toolbar', '.home-brand', '.duel-launch', '.binder-launch']);
      const play = layout.boxes['.duel-launch'], binder = layout.boxes['.binder-launch'];
      assert.ok(binder.width >= play.width * .95, 'binder is a full-width home action');
      assert.ok(binder.height >= 44 && play.height >= 44, 'primary home actions have comfortable touch targets');
      const title = layout.boxes['.home-brand']; assert.ok(Math.abs(title.left + title.width / 2 - width / 2) <= 2, 'title remains centered');
      await button('Settings').click(); await dialog('Settings');
      await captureLayout('settings', ['.sheet', '.parchment-header', '[aria-label="Close dialog"]']);
      await page.locator('.settings-rules-button').scrollIntoViewIfNeeded();
      assert.ok(await page.locator('.settings-rules-button').isVisible());
      await closeTo(null);
    }
    await noSavedBoard(); assert.deepEqual(errors, []);
    report('simplified home and Settings fit older/small phones, modern phones and tablets with wide touch-friendly actions');
    fs.writeFileSync(path.join(output, `${browserName}-report.json`), JSON.stringify({ checks, layouts, errors }, null, 2));
    console.log(JSON.stringify({ browser: browserName, passed: checks.length, errors }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${browserName}-failure.png`), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(output, `${browserName}-failure.json`), JSON.stringify({ checks, errors, error: error.stack }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
