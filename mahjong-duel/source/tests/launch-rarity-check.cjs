/* Launch catalogue, cosmetic rarity glows and testing booster budget.
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/launch-rarity-check.cjs [--webkit]
 * Fixtures use public game/save modules; interactions use the rendered UI.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';

(async () => {
  const moduleAt = name => import(pathToFileURL(path.join(root, `src/${name}.js`)));
  const [engine, { createDuelState }, { GHOST_MEMORY_VERSION }, { themes }, { RARITIES, rarityForTile }, { themeTileSets }] =
    await Promise.all(['engine', 'duel', 'ghost', 'themes', 'rarity', 'tile-data'].map(moduleAt));
  const expectedIds = ['ming-porcelain', 'dancheong', 'stained-glass', 'dutch-golden-age'];
  const expectedCounts = { bamboo: 22, granite: 10, amethyst: 5, gold: 2, celestial: 1 };
  assert.deepEqual(themes.map(theme => theme.id), expectedIds);
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const output = path.join(root, 'tmp/launch-rarity-qa'); fs.mkdirSync(output, { recursive: true });
  const errors = [], checks = [], layouts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' });
  const report = label => { checks.push(label); console.log(`PASS ${browserName}: ${label}`); };
  const session = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:session')));
  const storedCollection = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:collection')));
  const collection = { version: 1, counts: Object.fromEntries(expectedIds.flatMap(id => Object.values(themeTileSets[id]).flat().map(tile => [tile.matchKey, 1]))), receipts: {} };
  collection.counts['neon-shrine:western:W35'] = 7;
  collection.receipts[JSON.stringify(['hidden-game', 'hidden-pair'])] = 'neon-shrine:western:W35';
  function savedGame(theme = 'ming-porcelain', boardTheme = theme, seed = 1, ruleset = 'western') {
    return { version: 3, ...engine.createGame(ruleset, seed, 'calm', theme, { formationId: 'crown' }),
      ...createDuelState(), gameId: `launch-rarity-${browserName}-${theme}`, boardTheme, mode: 'duel', elapsed: 12,
      hints: 0, shuffles: 0, flips: 0, aiMemory: {}, ghostMemoryVersion: GHOST_MEMORY_VERSION,
      duelView: { revealed: [], pending: null }, boosters: { shuffle: 20, hint: 20, freeze: 20, eagle: 20 },
      freezeReady: false, hintEffect: null, eagleMs: 0 };
  }
  async function seed(extra = {}) {
    await page.goto(origin);
    await page.evaluate(({ collection, extra }) => {
      localStorage.clear();
      const values = { gentle: true, sound: false, collection, ...extra };
      for (const [key, value] of Object.entries(values)) localStorage.setItem(`porcelain:${key}`, JSON.stringify(value));
    }, { collection, extra });
    await page.reload(); await button('Play Duel').waitFor();
  }
  async function closeSheet() {
    await button('Close dialog').click();
    await page.locator('.sheet-backdrop').waitFor({ state: 'detached' });
  }
  async function startSaved(value, settings = {}) {
    assert.ok(engine.isCurrentCatalogueDeal(value), 'save fixture keeps complete four-copy catalogue');
    await seed({ theme: value.theme, boardTheme: value.boardTheme, session: value, ...settings });
    await button(/^Continue duel/).click(); await page.locator('.game-board').waitFor();
    await page.waitForTimeout(300);
  }
  async function geometry(scope, label) {
    const result = await page.evaluate(scope => {
      const root = document.querySelector(scope);
      const bounds = node => node.getBoundingClientRect().toJSON();
      return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
        root: bounds(root), codeCount: document.querySelectorAll('.tile-rarity-code').length,
        overlays: [...root.querySelectorAll('.tile-rarity-frame')].map(frame => ({
          frame: bounds(frame), tile: bounds(frame.parentElement),
          borders: ['Top', 'Right', 'Bottom', 'Left'].map(side => getComputedStyle(frame)[`border${side}Width`]),
          glow: getComputedStyle(frame, '::before').boxShadow,
        })) };
    }, scope);
    assert.equal(result.codeCount, 0, `${label}: no corner rarity tags are rendered anywhere`);
    assert.ok(result.documentWidth <= result.viewport.width, `${label}: no horizontal page overflow`);
    assert.ok(result.root.left >= -1 && result.root.right <= result.viewport.width + 1, `${label}: panel stays within viewport`);
    for (const { frame, tile, borders, glow } of result.overlays) {
      assert.ok(borders.every(value => parseFloat(value) === 0), `${label}: tile has no physical rarity border`);
      assert.notEqual(glow, 'none', `${label}: tile has a soft rarity glow`);
      assert.ok(frame.left >= tile.left - 1 && frame.right <= tile.right + 1 && frame.top >= tile.top - 1 && frame.bottom <= tile.bottom + 1, `${label}: glow overlay stays aligned with its tile`);
    }
    layouts.push({ label, ...result });
    return result;
  }
  function shadowHasColor(shadow, hex) {
    const rgb = hex.match(/\w\w/g).map(value => parseInt(value, 16));
    return (shadow.match(/(?:rgba?|color)\([^)]*\)/g) || []).some(color => {
      const values = color.match(/[\d.]+/g).map(Number);
      const channels = color.startsWith('color(srgb ') ? values.slice(0, 3).map(value => value * 255) : values.slice(0, 3);
      return channels.length === 3 && channels.every((value, index) => Math.abs(value - rgb[index]) < 1.1) && (values[3] === undefined || values[3] > 0);
    });
  }
  async function rarityEffects(locator) {
    return locator.evaluateAll(nodes => nodes.map(node => {
      const frame = node.querySelector('.tile-rarity-frame');
      const glow = frame && getComputedStyle(frame, '::before');
      return { tier: node.dataset.rarity, codeCount: node.querySelectorAll('.tile-rarity-code').length,
        borders: frame && ['Top', 'Right', 'Bottom', 'Left'].map(side => getComputedStyle(frame)[`border${side}Width`]),
        shadow: glow?.boxShadow, opacity: Number(glow?.opacity), animation: glow?.animationName };
    }));
  }
  function checkGlow(tile, rarity, context) {
    assert.equal(tile.codeCount, 0, `${context}: ${rarity.label} has no corner tag`);
    assert.ok(tile.borders.every(value => parseFloat(value) === 0), `${context}: ${rarity.label} has no rarity border`);
    assert.ok(shadowHasColor(tile.shadow, rarity.color), `${context}: ${rarity.label} glow uses its configured color (${tile.shadow})`);
    assert.ok(tile.opacity > 0, `${context}: ${rarity.label} glow remains visible`);
  }
  try {
    await seed({ theme: 'neon-shrine', boardTheme: 'brass-meridian', session: savedGame('neon-shrine') });
    assert.equal(await page.locator('.world').getAttribute('data-theme'), 'ming-porcelain');
    assert.equal(await page.locator('.world').getAttribute('data-board-theme'), 'ming-porcelain');
    assert.equal(await button(/^Continue duel/).count(), 0, 'unreleased saved theme is not playable');
    assert.deepEqual(await storedCollection(), collection, 'hidden collection counts and receipts survive startup');
    await button('Choose tile theme').click();
    assert.deepEqual(await page.locator('.collection-row strong').allTextContents(), themes.map(theme => theme.name));
    await page.getByRole('tab', { name: 'Background', exact: true }).click();
    assert.deepEqual(await page.locator('.background-swatch strong').allTextContents(), themes.map(theme => theme.name));
    await closeSheet();
    await button('Settings').click();
    assert.equal(await page.getByRole('switch').count(), 3, 'settings only exposes sound, motion and pips');
    assert.doesNotMatch(await page.getByRole('dialog').innerText(), /unlock|unreleased|all themes|non.launch/i);
    await closeSheet();
    report('only four launch themes appear for tiles and boards; hidden selections/saves fall back with no unlock switch');

    await button('Tile binder').click(); await page.locator('.tile-binder').waitFor();
    assert.deepEqual(await page.getByLabel('Collection theme', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(node => node.value)), expectedIds);
    assert.match(await page.locator('.binder-summary').innerText(), /320\s*\/\s*320/);
    assert.equal(await page.locator('.binder-match-total strong').innerText(), '320');
    for (const theme of themes) {
      await page.getByLabel('Collection theme', { exact: true }).selectOption(theme.id);
      for (const ruleset of ['Eastern', 'Western']) {
        await page.getByRole('group', { name: 'Collection ruleset' }).getByRole('button', { name: new RegExp(`^${ruleset}`) }).click();
        for (const rarity of RARITIES) {
          await page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: rarity.label, exact: true }).click();
          assert.equal(await page.locator('.binder-card').count(), expectedCounts[rarity.id]);
          assert.equal(await page.locator('.tile-rarity-code').count(), 0);
          assert.deepEqual([...new Set((await page.locator('.binder-rarity').allTextContents()).map(value => value.trim()))], [rarity.label], 'binder keeps its readable tier names');
        }
      }
    }
    await page.getByLabel('Collection theme', { exact: true }).selectOption('ming-porcelain');
    await page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: 'All', exact: true }).click();
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
      await geometry('.tile-binder', `binder ${width}x${height}`);
      const close = await button('Close dialog').boundingBox();
      assert.ok(close.width >= 44 && close.height >= 44 && close.y >= 0 && close.y + close.height <= height, 'binder close remains comfortably reachable');
      if (width === 320) {
        await page.getByLabel('Collection rarity', { exact: true }).selectOption('celestial');
        assert.equal(await page.locator('.binder-card').count(), 1);
        await page.getByLabel('Collection rarity', { exact: true }).selectOption('all');
      }
      await page.screenshot({ path: path.join(output, `binder-${browserName}-${width}x${height}.png`) });
      await page.locator('.binder-inspect-button').first().click(); await page.locator('.tile-inspector:modal').waitFor();
      await geometry('.tile-inspector', `inspector ${width}x${height}`);
      assert.equal(await page.locator('.tile-rarity-code').count(), 0);
      assert.match(await page.locator('.tile-inspector-meta').innerText(), /Celestial/, 'inspector retains its tier name');
      await page.screenshot({ path: path.join(output, `inspector-${browserName}-${width}x${height}.png`) });
      await button('Close tile preview').click();
    }
    assert.deepEqual(await storedCollection(), collection, 'all hidden collection data survives binder browsing');
    report('binder shows 320 launch faces, every rarity/filter and readable phone/tablet previews; hidden collection remains intact');

    await page.setViewportSize({ width: 390, height: 844 });
    await startSaved(savedGame('dancheong', 'brass-meridian'));
    assert.equal(await page.locator('.world').getAttribute('data-theme'), 'dancheong');
    assert.equal(await page.locator('.world').getAttribute('data-board-theme'), 'dancheong');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('porcelain:session'))?.boardTheme === 'dancheong');
    report('a launch-theme saved game replaces its unavailable board background with the matching launch theme');

    await seed(); await button('Play Duel').click(); await page.locator('.game-board').waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('porcelain:session'))?.boosters?.eagle === 20);
    assert.deepEqual((await session()).boosters, { shuffle: 20, hint: 20, freeze: 20, eagle: 20 });
    for (const name of ['Shuffle', 'Hint', 'Freeze', 'Eagle Eye']) assert.ok(await button(`${name}, 20 uses left`).isEnabled());
    assert.equal(await page.locator('.tile-rarity-code').count(), 0);
    assert.equal(await page.locator('.game-board .tile-rarity-frame').count(), 0);
    assert.equal(await page.locator('.game-tile[data-rarity-visible="true"]').count(), 0);
    assert.doesNotMatch((await page.locator('.game-tile').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))).join(' '), /Bamboo|Granite|Amethyst|Gold|Celestial/);
    report('fresh duels have 20 of each booster and face-down tiles reveal no rarity glows or accessible rarity names');

    let allRarities;
    for (let seed = 1; seed <= 200; seed += 1) {
      const candidate = savedGame('ming-porcelain', 'ming-porcelain', seed);
      if (new Set(candidate.tiles.filter(tile => engine.isFree(tile, candidate.tiles)).map(tile => rarityForTile(candidate.theme, candidate.ruleset, tile.faceId).id)).size === 5) { allRarities = candidate; break; }
    }
    assert.ok(allRarities, 'a standard unmodified deal includes every cosmetic tier');
    await startSaved(allRarities);
    const exposed = allRarities.tiles.find(tile => engine.isFree(tile, allRarities.tiles));
    const stone = page.locator(`.game-tile[data-tile-id="${exposed.id}"]`);
    await stone.click(); await page.waitForFunction(() => document.querySelectorAll('.game-tile[data-face-up="true"]').length === 1);
    assert.equal(await page.locator('.tile-rarity-code').count(), 0);
    checkGlow((await rarityEffects(stone))[0], rarityForTile(allRarities.theme, allRarities.ruleset, exposed.faceId), 'Revealed tile');
    assert.equal(await page.locator('.game-tile[data-face-up="false"] .tile-rarity-frame').count(), 0);
    await button('Eagle Eye, 20 uses left').click();
    await page.waitForFunction(() => document.querySelectorAll('.game-board .tile-rarity-frame').length === 80);
    assert.equal((await session()).boosters.eagle, 19);
    const lit = await rarityEffects(page.locator('.game-tile'));
    for (const rarity of RARITIES) {
      const stones = lit.filter(tile => tile.tier === rarity.id);
      assert.ok(stones.length > 0);
      for (const tile of stones) checkGlow(tile, rarity, 'Eagle Eye');
    }
    assert.equal(await page.locator('.rarity-aura').count(), 0, 'the previous separate rarity aura is removed');
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(150);
      const layout = await geometry('.game-board', `board ${width}x${height}`);
      assert.equal(layout.overlays.length, 80);
      assert.ok(layout.root.top >= 0 && layout.root.bottom <= height, 'the complete board fits the viewport');
      await page.screenshot({ path: path.join(output, `board-${browserName}-${width}x${height}.png`) });
    }
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('porcelain:session'))?.eagleMs === 0, undefined, { timeout: 12000 });
    assert.equal(await page.locator('.game-tile[data-face-up="false"] .tile-rarity-frame').count(), 0);
    assert.equal(await page.locator('.tile-rarity-code').count(), 0);
    assert.equal(await page.locator('.game-board .tile-rarity-frame').count(), 1, 'only the manually revealed face retains its glow');
    assert.equal(await page.locator('.game-tile.eagle-lit').count(), 0);
    assert.equal((await session()).boosters.eagle, 19);
    report('all five tiers glow without corner tags or physical borders; Eagle Eye exposes hidden rarity then conceals it again');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const rarity of RARITIES) {
      await startSaved(allRarities, { gentle: false });
      const exposed = allRarities.tiles.find(tile => engine.isFree(tile, allRarities.tiles) && rarityForTile(allRarities.theme, allRarities.ruleset, tile.faceId).id === rarity.id);
      const tile = page.locator(`.game-tile[data-tile-id="${exposed.id}"]`);
      await tile.click();
      await page.waitForFunction(id => document.querySelector(`[data-tile-id="${id}"]`)?.dataset.faceUp === 'true', exposed.id);
      const effects = await rarityEffects(tile);
      checkGlow(effects[0], rarity, 'Reduced-motion face-up tile');
      assert.equal(await page.locator('.tile-rarity-code').count(), 0);
      assert.equal(effects[0].animation, 'none', `${rarity.label} glow becomes static with reduced motion`);
      assert.equal(await page.locator('.game-tile[data-face-up="false"] .tile-rarity-frame').count(), 0, 'hidden tiles have no glow overlay');
      await page.screenshot({ path: path.join(output, `face-up-${rarity.id}-${browserName}.png`) });
    }
    report('flipping every tier, including Bamboo, reveals a borderless colored glow that stays visible without animation under reduced motion');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, `${browserName}-report.json`), JSON.stringify({ checks, errors, layouts }, null, 2));
    console.log(JSON.stringify({ browser: browserName, passed: checks.length, errors }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${browserName}-failure.png`), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(output, `${browserName}-failure.json`), JSON.stringify({ checks, errors, error: error.stack }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
