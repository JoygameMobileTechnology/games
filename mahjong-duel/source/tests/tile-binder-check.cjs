/* GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/tile-binder-check.cjs [--webkit] */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const source = file => import(pathToFileURL(path.join(root, 'src', file)));
  const { createCollection, awardCollectedPair, COLLECTION_STORAGE_KEY } = await source('collection.js');
  const { themes, rulesetForTheme } = await source('themes.js');
  const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.addInitScript(() => { localStorage.setItem('porcelain:language', '"en"'); });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const output = path.join(root, 'tmp/collection-fullscreen'); fs.mkdirSync(output, { recursive: true });
  const collectionPage = page.getByRole('dialog', { name: 'Collection', exact: true });
  const filter = label => page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: label, exact: true });
  async function openCollection() {
    const launch = page.getByRole('button', { name: 'Collection', exact: true });
    const back = page.getByRole('button', { name: 'Back to main menu', exact: true });
    await launch.or(back).first().waitFor();
    if (await back.isVisible()) await back.click();
    await launch.click(); await collectionPage.waitFor();
    assert.equal(await page.getByRole('group', { name: 'Collection ruleset', exact: true }).count(), 0, 'the theme determines its artwork; Collection has no edition toggle');
  }
  try {
    await page.goto(process.env.GAME_URL || 'http://localhost:5173');
    let value = createCollection();
    for (const [index, id] of ['K01', 'A11', 'K02', 'A07', 'G02', 'C01', 'K01', 'K01'].entries()) {
      value = awardCollectedPair(value, { gameId: 'binder-test', pairId: `pair-${index}`, actor: 'you', matchKey: `ming-porcelain:eastern:${id}` });
    }
    await page.evaluate(({ key, value }) => {
      localStorage.clear(); localStorage.setItem('porcelain:language', '"en"'); localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem('porcelain:gentle', 'true'); localStorage.setItem('porcelain:sound', 'false');
    }, { key: COLLECTION_STORAGE_KEY, value });
    await page.reload(); await openCollection();
    const persisted = await page.evaluate(key => localStorage.getItem(key), COLLECTION_STORAGE_KEY);
    assert.match(await page.locator('.collection-progress-copy').innerText(), /6\s*\/\s*40 collected/);
    assert.match(await page.locator('.collection-summary').innerText(), /6\s*\/\s*160 total collected/);
    assert.match(await page.locator('.collection-summary').innerText(), /8 pairs matched/);
    assert.match(await page.locator('[data-match-key="ming-porcelain:eastern:K01"]').innerText(), /Matched ×3/);
    assert.equal(await page.locator('.collection-card[data-collected="true"]').count(), 6);
    assert.deepEqual(await page.getByLabel('Collection theme', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.value)),
      ['ming-porcelain', 'dancheong', 'stained-glass', 'dutch-golden-age']);
    assert.deepEqual((await page.getByRole('group', { name: 'Rarity filter' }).getByRole('button').allTextContents()).map(text => text.trim()),
      ['All', 'Marble', 'Sapphire', 'Amethyst', 'Gold']);
    assert.equal(await page.locator('.tile-rarity-code').count(), 0, 'tile art has no corner rarity tags');
    assert.equal(await page.locator('.sheet').count(), 0, 'Collection is a full page, not a Sheet');

    for (const [width, height, columns, split] of [[320, 568, 2, false], [390, 664, 2, false], [390, 844, 2, false], [440, 956, 2, false], [768, 1024, 3, false], [1024, 768, 3, true], [844, 390, null, false]]) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(expected => document.querySelector('.collection-layout').dataset.split === String(expected), split);
      const layout = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        const grid = document.querySelector('.collection-grid');
        return { documentWidth: document.documentElement.scrollWidth, root: rect('.collection-page'), grid: rect('.collection-grid'), back: rect('[aria-label="Back to main menu"]'), art: rect('.collection-art'), image: rect('.collection-art img'), caption: rect('.collection-card figcaption'), columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          overflow: [...document.querySelectorAll('.collection-theme-control')].some(node => node.scrollWidth > node.clientWidth + 1),
          targets: [...document.querySelectorAll('.collection-page-header button,.collection-editions button,.collection-tiers button')].filter(node => node.getClientRects().length).map(node => ({ label: node.getAttribute('aria-label') || node.textContent, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })) };
      });
      assert.ok(layout.documentWidth <= width, `${width}×${height}: no document horizontal overflow`);
      assert.ok(layout.root.left >= -1 && layout.root.right <= width + 1 && layout.root.top >= -1 && layout.root.bottom <= height + 1, `${width}×${height}: full page fits viewport`);
      assert.ok(Math.abs(layout.root.width - width) <= 2 && Math.abs(layout.root.height - height) <= 2, 'Collection fills the screen');
      assert.ok(layout.back.top >= 0 && layout.back.bottom <= height, 'Back stays reachable');
      assert.ok(layout.image.left >= layout.art.left - 1 && layout.image.right <= layout.art.right + 1 && layout.image.top >= layout.art.top - 1 && layout.image.bottom <= layout.art.bottom + 1, `${width}×${height}: artwork fits its tile area`);
      assert.ok(layout.caption.top >= layout.image.bottom - 1, `${width}×${height}: artwork never overlaps its caption`);
      assert.equal(layout.overflow, false, `${width}×${height}: theme selector does not clip`);
      assert.ok(layout.grid.height >= 100 && layout.grid.width > 200, `${width}×${height}: meaningful gallery space`);
      if (columns) assert.equal(layout.columns, columns, `${width}×${height}: appropriate grid columns`);
      for (const target of layout.targets) assert.ok(target.width >= 43.5 && target.height >= 43.5, `${width}×${height}: ${target.label} has a 44px touch target`);
      await page.locator('.collection-grid').evaluate(node => { node.scrollTop = 0; });
      await page.screenshot({ path: path.join(output, `collection-${browserName}-${width}x${height}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of themes) {
      await page.getByLabel('Collection theme', { exact: true }).selectOption(theme.id);
      assert.equal(await page.locator('.collection-card').count(), 40);
      const expectedPrefix = `${theme.id}:${rulesetForTheme(theme.id)}:`;
      assert.ok((await page.locator('.collection-card').evaluateAll(nodes => nodes.map(node => node.dataset.matchKey))).every(key => key.startsWith(expectedPrefix)), 'each theme exposes only its assigned tile set');
      await page.locator('.collection-art img').evaluateAll(async images => {
        for (const image of images) image.loading = 'eager';
        await Promise.all(images.map(image => image.decode()));
      });
    }
    for (const [label, count] of [['Marble', 22], ['Sapphire', 10], ['Amethyst', 5], ['Gold', 3], ['All', 40]]) {
      await filter(label).click(); assert.equal(await filter(label).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.collection-card').count(), count);
    }
    await page.getByLabel('Collection theme', { exact: true }).selectOption('ming-porcelain');
    assert.match(await page.locator('.collection-progress-copy').innerText(), /6\s*\/\s*40 collected/, 'Ming porcelain keeps its Eastern artwork and saved counts');
    await page.getByLabel('Collection theme', { exact: true }).focus();
    assert.ok(await page.getByLabel('Collection theme', { exact: true }).evaluate(node => parseFloat(getComputedStyle(node).outlineWidth) >= 2));
    await page.getByRole('button', { name: 'Back to main menu', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.matches('.binder-launch'));
    await page.reload(); await openCollection();
    assert.match(await page.locator('.collection-summary').innerText(), /6\s*\/\s*160 total collected/);
    assert.match(await page.locator('.collection-summary').innerText(), /8 pairs matched/);
    await filter('Sapphire').click();
    assert.equal(await page.locator('.collection-card').count(), 10);
    assert.equal(await page.locator('.collection-card[data-collected="true"]').count(), 1);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), COLLECTION_STORAGE_KEY), persisted, 'browsing never modifies collected tiles or duplicate counts');
    assert.deepEqual(errors, []);
    console.log(`PASS fullscreen Collection: fixed tile set per theme, 160 assets decode, four rarity filters, duplicate counts persist, seven responsive sizes, full-screen navigation/focus, no errors (${browserName})`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, `collection-${browserName}-failure.png`), fullPage: true }).catch(() => {});
    console.error('Browser errors:', errors); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
