/* GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/tile-inspector-check.cjs [--webkit] */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const source = file => import(pathToFileURL(path.join(root, 'src', file)));
  const { createCollection, awardCollectedPair, COLLECTION_STORAGE_KEY } = await source('collection.js');
  const { themes, rulesetForTheme } = await source('themes.js');
  const { themeTileSets } = await source('tile-data.js');
  const { rarityForTile } = await source('rarity.js');
  const { tileDescription } = await source('tile-descriptions.js');
  const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.addInitScript(() => { localStorage.setItem('porcelain:language', '"en"'); });
  const output = path.join(root, 'tmp/collection-fullscreen'); fs.mkdirSync(output, { recursive: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  let value = createCollection();
  for (const theme of themes) {
    const ruleset = rulesetForTheme(theme.id);
    for (const id of (ruleset === 'eastern' ? ['C01', 'A01', 'A11', 'K01'] : ['W01', 'W10', 'W40'])) {
      const tile = themeTileSets[theme.id][ruleset].find(item => item.id === id);
      assert.ok(tile, `${theme.id} ${ruleset} fixture ${id} exists`);
      for (let index = 0; index < (id === 'C01' ? 3 : 1); index += 1) {
        value = awardCollectedPair(value, { gameId: 'inspector-check', pairId: `${tile.matchKey}-${index}`, actor: 'you', matchKey: tile.matchKey });
      }
    }
  }
  const card = key => page.locator(`.collection-card[data-match-key="${key}"]`);
  const detail = page.locator('.collection-detail');
  const previous = page.getByRole('button', { name: 'Previous tile', exact: true });
  const next = page.getByRole('button', { name: 'Next tile', exact: true });
  const back = () => page.getByRole('button', { name: 'Back to collection', exact: true }).click();
  async function verifyDetails(themeId, ruleset, id, count = 1) {
    const tile = themeTileSets[themeId][ruleset].find(item => item.id === id);
    await detail.waitFor({ state: 'visible' });
    await detail.locator('img').evaluate(image => image.decode());
    assert.equal(await detail.getByRole('heading', { level: 3 }).innerText(), tile.name);
    assert.equal(await detail.locator('.collection-detail-description').innerText(), tileDescription(themeId, ruleset, id), 'retains historic theme-specific lore');
    assert.equal(await detail.locator('img').getAttribute('alt'), tile.name);
    assert.equal(await detail.locator('img').getAttribute('src'), tile.src);
    assert.equal((await detail.locator('.collection-detail-rarity').innerText()).trim(), rarityForTile(themeId, ruleset, id).label);
    assert.match(await detail.locator('.collection-detail-status').innerText(), new RegExp(`Matched ${count} ${count === 1 ? 'time' : 'times'}`));
    assert.equal(await detail.locator('.tile-rarity-frame').count(), 1, 'details retain rarity glow');
    assert.equal(await page.locator('.tile-rarity-code').count(), 0, 'no corner rarity tags');
    const artLayout = await detail.evaluate(node => { const rect = selector => node.querySelector(selector).getBoundingClientRect().toJSON(); return { art: rect('.collection-detail-art'), image: rect('img'), copy: rect('.collection-detail-copy') }; });
    assert.ok(artLayout.image.left >= artLayout.art.left - 1 && artLayout.image.right <= artLayout.art.right + 1 && artLayout.image.top >= artLayout.art.top - 1 && artLayout.image.bottom <= artLayout.art.bottom + 1, 'detail artwork stays within its image area');
    const overlapWidth = Math.min(artLayout.copy.right, artLayout.image.right) - Math.max(artLayout.copy.left, artLayout.image.left);
    const overlapHeight = Math.min(artLayout.copy.bottom, artLayout.image.bottom) - Math.max(artLayout.copy.top, artLayout.image.top);
    assert.ok(overlapWidth <= 1 || overlapHeight <= 1, 'detail artwork never overlaps the tile title in stacked or side-by-side layouts');
    return tile;
  }
  try {
    await page.goto(process.env.GAME_URL || 'http://localhost:5173');
    await page.evaluate(({ key, value }) => {
      localStorage.clear(); localStorage.setItem('porcelain:language', '"en"'); localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem('porcelain:gentle', 'true'); localStorage.setItem('porcelain:sound', 'false');
    }, { key: COLLECTION_STORAGE_KEY, value });
    await page.reload();
    const launch = page.getByRole('button', { name: 'Collection', exact: true });
    const home = page.getByRole('button', { name: 'Back to main menu', exact: true });
    await launch.or(home).first().waitFor();
    if (await home.isVisible()) await home.click();
    await launch.click();
    await page.locator('.collection-browser').waitFor();
    const persisted = await page.evaluate(key => localStorage.getItem(key), COLLECTION_STORAGE_KEY);
    assert.equal(await page.locator('.collection-card.is-collected .collection-inspect-button').count(), 4);
    assert.equal(await page.locator('.collection-card.is-locked button').count(), 0, 'locked tiles have no inspection affordance');
    await page.locator('.collection-card.is-locked').first().click();
    assert.equal(await detail.count(), 0, 'locked tile does not reveal a details screen');

    const peach = card('ming-porcelain:eastern:C01').getByRole('button', { name: 'Inspect 1 peach', exact: true });
    await peach.scrollIntoViewIfNeeded(); await peach.focus();
    const scrollBefore = await page.locator('.collection-grid').evaluate(node => node.scrollTop);
    assert.ok(scrollBefore > 0, 'fixture exercises a scrolled collection');
    await page.keyboard.press('Enter'); await verifyDetails('ming-porcelain', 'eastern', 'C01', 3);
    assert.equal(await page.locator('.collection-browser').isVisible(), false, 'phone details replace the gallery');
    assert.equal(await page.getByRole('dialog', { name: 'Tile details', exact: true }).count(), 1, 'one full-page detail surface');
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('Tab');
      const active = await page.evaluate(() => ({ inPage: Boolean(document.activeElement?.closest('.collection-page')), inGallery: Boolean(document.activeElement?.closest('.collection-browser')), tag: document.activeElement?.tagName, name: document.activeElement?.getAttribute('aria-label'), html: document.activeElement?.outerHTML.slice(0, 240) }));
      assert.equal(active.inPage && !active.inGallery, true, `keyboard cannot reach the hidden gallery or menu: ${JSON.stringify({ iteration: i, ...active })}`);
    }
    await page.keyboard.press('Escape'); await detail.waitFor({ state: 'detached' });
    assert.equal(await peach.evaluate(node => node === document.activeElement), true, 'Escape returns focus to originating tile');
    assert.ok(Math.abs(await page.locator('.collection-grid').evaluate(node => node.scrollTop) - scrollBefore) <= 1, 'return preserves exact grid scroll');

    // Previous/next browse collected tiles only, in the selected rarity and grid order.
    await page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: 'Gold', exact: true }).click();
    const foundKeys = await page.locator('.collection-card.is-collected').evaluateAll(nodes => nodes.map(node => node.dataset.matchKey));
    assert.equal(foundKeys.length, 2, 'fixture has two found Gold tiles and one locked Gold tile');
    await card(foundKeys[0]).getByRole('button').click();
    assert.equal(await previous.isDisabled(), true, 'first found tile cannot go previous');
    assert.equal(await next.isEnabled(), true);
    await next.click(); await verifyDetails('ming-porcelain', 'eastern', foundKeys[1].split(':').at(-1));
    assert.equal(await next.isDisabled(), true, 'next stops at last found tile, skipping locked tiles');
    await previous.click(); await verifyDetails('ming-porcelain', 'eastern', foundKeys[0].split(':').at(-1));
    await back();
    await page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: 'All', exact: true }).click();

    for (const theme of themes) {
      const ruleset = rulesetForTheme(theme.id);
      await page.getByLabel('Collection theme', { exact: true }).selectOption(theme.id);
      const id = ruleset === 'eastern' ? 'A01' : 'W10';
      await card(`${theme.id}:${ruleset}:${id}`).getByRole('button').click();
      await verifyDetails(theme.id, ruleset, id); await back();
    }
    await page.getByLabel('Collection theme', { exact: true }).selectOption('ming-porcelain');
    await card('ming-porcelain:eastern:K01').getByRole('button').click();
    for (const [width, height, split] of [[320, 568, false], [390, 664, false], [440, 956, false], [768, 1024, false], [1024, 768, true], [844, 390, false], [390, 844, false]]) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(expected => document.querySelector('.collection-layout').dataset.split === String(expected), split);
      await verifyDetails('ming-porcelain', 'eastern', 'K01');
      assert.equal(await page.locator('.collection-browser').isVisible(), split, 'orientation switches between single details and a simultaneous gallery');
      assert.equal(await detail.count(), 1, 'rotation preserves one selected tile/details instance');
      const layout = await page.evaluate(() => {
        const root = document.querySelector('.collection-page'), detail = document.querySelector('.collection-detail');
        return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, root: root.getBoundingClientRect().toJSON(), back: root.querySelector('header button').getBoundingClientRect().toJSON(), detailOverflow: detail.scrollWidth > detail.clientWidth + 1 };
      });
      assert.ok(layout.documentWidth <= width && !layout.detailOverflow, `${width}×${height}: detail content has no horizontal overflow`);
      assert.ok(layout.root.left >= -1 && layout.root.right <= width + 1 && layout.root.top >= -1 && layout.root.bottom <= height + 1, 'page fits viewport');
      assert.ok(layout.back.width >= 44 && layout.back.height >= 44 && layout.back.bottom <= height, 'Back is reachable and touch-sized');
      await detail.locator('.collection-detail-description').scrollIntoViewIfNeeded();
      await next.scrollIntoViewIfNeeded();
      const nav = await next.boundingBox();
      assert.ok(nav.y >= 0 && nav.y + nav.height <= height + 1, 'detail navigation can be reached');
      await detail.locator('img').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `details-${browserName}-${width}x${height}.png`) });
    }
    await back();
    assert.equal(await card('ming-porcelain:eastern:K01').getByRole('button').evaluate(node => node === document.activeElement), true, 'rotation and Back preserve tile focus');
    // Short landscape scrolls the browser pane instead of squeezing the grid.
    await page.setViewportSize({ width: 844, height: 390 });
    await peach.scrollIntoViewIfNeeded();
    const shortScroll = await page.evaluate(() => ['.collection-grid', '.collection-browser', '.progression-page-scroll'].map(selector => document.querySelector(selector).scrollTop));
    assert.ok(shortScroll.some(value => value > 0), 'short-landscape fixture is scrolled');
    await peach.click(); await verifyDetails('ming-porcelain', 'eastern', 'C01', 3); await back();
    const restoredShortScroll = await page.evaluate(() => ['.collection-grid', '.collection-browser', '.progression-page-scroll'].map(selector => document.querySelector(selector).scrollTop));
    assert.ok(shortScroll.every((value, index) => Math.abs(value - restoredShortScroll[index]) <= 1), 'short-landscape return restores the active scroll owner');
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForFunction(() => document.querySelector('.collection-layout').dataset.split === 'true');
    await card('ming-porcelain:eastern:K01').getByRole('button').click();
    assert.equal(await card('ming-porcelain:eastern:K01').getByRole('button').getAttribute('aria-pressed'), 'true', 'split view exposes selected tile');
    await page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: 'Marble', exact: true }).click();
    assert.equal(await detail.count(), 0, 'filter change clears a no-longer-visible selection');
    assert.equal(await page.locator('.collection-detail-empty').isVisible(), true, 'split view gives useful empty-state instructions');
    await page.getByRole('button', { name: 'Back to main menu', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.matches('.binder-launch'));
    assert.equal(await page.evaluate(key => localStorage.getItem(key), COLLECTION_STORAGE_KEY), persisted, 'inspection never changes earned collection or counts');
    assert.deepEqual(errors, [], 'no runtime or resource errors');
    console.log(`PASS fullscreen tile details: collected-only navigation/filter boundaries, lore/counts, scroll/focus restoration, orientation continuity, split view, seven sizes, read-only collection (${browserName})`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, `details-${browserName}-failure.png`), fullPage: true }).catch(() => {});
    console.error('Browser errors:', errors); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
