/* GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/tile-binder-check.cjs [--webkit] */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const { createCollection, awardCollectedPair, COLLECTION_STORAGE_KEY } = await import(pathToFileURL(path.join(root, 'src/collection.js')));
  const { themes } = await import(pathToFileURL(path.join(root, 'src/themes.js')));
  const { rarityForTile } = await import(pathToFileURL(path.join(root, 'src/rarity.js')));
  const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const output = path.join(root, 'tmp/rarity-review'); fs.mkdirSync(output, { recursive: true });
  try {
    await page.goto(process.env.GAME_URL || 'http://localhost:5173');
    let value = createCollection();
    for (const [index, id] of ['K01', 'A11', 'K02', 'A07', 'G02', 'C01', 'K01', 'K01'].entries()) {
      value = awardCollectedPair(value, { gameId: 'binder-test', pairId: `pair-${index}`, actor: 'you', matchKey: `ming-porcelain:eastern:${id}` });
    }
    await page.evaluate(({ key, value }) => {
      localStorage.clear(); localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem('porcelain:gentle', 'true'); localStorage.setItem('porcelain:sound', 'false');
    }, { key: COLLECTION_STORAGE_KEY, value });
    await page.reload();
    await page.getByRole('button', { name: 'Tile binder', exact: true }).click();
    await page.locator('.tile-binder').waitFor();
    assert.match(await page.locator('.binder-summary').innerText(), /6\s*\/\s*320/);
    assert.equal(await page.locator('.binder-match-total strong').innerText(), '8');
    assert.match(await page.locator('[data-match-key="ming-porcelain:eastern:K01"]').innerText(), /Matched ×3/);
    assert.equal(await page.locator('.binder-card[data-collected="true"]').count(), 6);
    assert.deepEqual(await page.getByLabel('Collection theme', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.value)),
      ['ming-porcelain', 'dancheong', 'stained-glass', 'dutch-golden-age']);
    for (const faceId of ['K01', 'A11', 'K02', 'A07', 'G02', 'C01']) {
      const rarity = rarityForTile('ming-porcelain', 'eastern', faceId);
      const card = page.locator(`[data-match-key="ming-porcelain:eastern:${faceId}"]`);
      assert.equal(await card.locator('.tile-rarity-code').innerText(), rarity.code);
      await card.locator('.binder-inspect-button').click();
      await page.locator('.tile-inspector[open]').waitFor();
      assert.equal(await page.locator('.tile-inspector .tile-rarity-code').innerText(), rarity.code);
      assert.match(await page.locator('.tile-inspector-meta').innerText(), new RegExp(rarity.label));
      await page.getByRole('button', { name: 'Close tile preview', exact: true }).click();
    }
    await page.locator('.binder-grid').evaluate(grid => { grid.scrollTop = 0; });
    await page.waitForTimeout(500);
    for (const [width, height] of [[390, 844], [390, 664], [320, 568], [768, 1024]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
      const layout = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
          close: rect('[aria-label="Close dialog"]'), binder: rect('.tile-binder'), grid: rect('.binder-grid'), card: rect('.binder-card'),
          art: rect('.binder-card .binder-art'), artTile: rect('.binder-card .binder-art-tile'), caption: rect('.binder-card figcaption') };
      });
      assert.ok(layout.documentWidth <= width, `${width}×${height}: document has no horizontal overflow`);
      assert.ok(layout.close.left >= 0 && layout.close.right <= width && layout.close.top >= 0 && layout.close.bottom <= height, 'close control stays reachable');
      assert.ok(layout.binder.left >= 0 && layout.binder.right <= width);
      assert.ok(layout.card.bottom <= layout.grid.bottom, `${width}×${height}: at least one full card row is readable`);
      assert.ok(layout.artTile.top >= layout.art.top - 1 && layout.artTile.bottom <= layout.art.bottom + 1,
        `${width}×${height}: tile art stays within its capped row (${JSON.stringify({ art: layout.art, artTile: layout.artTile })})`);
      assert.ok(layout.artTile.left >= layout.art.left - 1 && layout.artTile.right <= layout.art.right + 1,
        `${width}×${height}: tile art fits its card width`);
      assert.ok(layout.caption.top >= layout.artTile.bottom - 1, `${width}×${height}: artwork never obscures the tile name or count`);
      if (height <= 620) {
        await page.getByLabel('Collection edition', { exact: true }).selectOption('western');
        assert.equal(await page.locator('.binder-card').count(), 40);
        await page.getByLabel('Collection edition', { exact: true }).selectOption('eastern');
      }
      if (width <= 350) {
        await page.getByLabel('Collection rarity', { exact: true }).selectOption('celestial');
        assert.equal(await page.locator('.binder-card').count(), 1);
        await page.getByLabel('Collection rarity', { exact: true }).selectOption('all');
      }
      await page.screenshot({ path: path.join(output, `binder-${browserName}-${width}x${height}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const theme of themes) {
      await page.getByLabel('Collection theme', { exact: true }).selectOption(theme.id);
      for (const ruleset of ['Eastern', 'Western']) {
        await page.getByRole('group', { name: 'Collection ruleset' }).getByRole('button', { name: new RegExp(ruleset) }).click();
        assert.equal(await page.locator('.binder-card').count(), 40);
        await page.locator('.binder-art img').evaluateAll(async images => {
          for (const image of images) image.loading = 'eager';
          await Promise.all(images.map(image => image.decode()));
        });
      }
    }
    for (const [label, count] of [['Bamboo', 22], ['Granite', 10], ['Amethyst', 5], ['Gold', 2], ['Celestial', 1], ['All', 40]]) {
      const control = page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: label, exact: true });
      await control.click(); assert.equal(await control.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.binder-card').count(), count);
    }
    await page.getByLabel('Collection theme', { exact: true }).focus();
    assert.ok(await page.getByLabel('Collection theme', { exact: true }).evaluate(node => parseFloat(getComputedStyle(node).outlineWidth) >= 2));
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Tile binder', exact: true }).click();
    assert.match(await page.locator('.binder-summary').innerText(), /6\s*\/\s*320/);
    assert.equal(await page.locator('.binder-match-total strong').innerText(), '8');
    await page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: 'Granite', exact: true }).click();
    assert.equal(await page.locator('.binder-card').count(), 10);
    assert.equal(await page.locator('.binder-card[data-collected="true"]').count(), 1);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, `binder-${browserName}-granite-390x844.png`) });
    assert.deepEqual(errors, []);
    console.log(`PASS binder: 320 launch images decode, five tiers and corner codes, all launch themes/editions, duplicate counts persist, four responsive sizes, accessible close/focus; no errors (${browserName})`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, `binder-${browserName}-failure.png`), fullPage: true }).catch(() => {});
    console.error('Browser errors:', errors); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
