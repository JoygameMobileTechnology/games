/* GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/tile-binder-check.cjs [--webkit] */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const { createCollection, awardCollectedPair, COLLECTION_STORAGE_KEY } = await import(pathToFileURL(path.join(root, 'src/collection.js')));
  const { themes } = await import(pathToFileURL(path.join(root, 'src/themes.js')));
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
    assert.match(await page.locator('.binder-summary').innerText(), /6\s*\/\s*720/);
    assert.equal(await page.locator('.binder-match-total strong').innerText(), '8');
    assert.match(await page.locator('[data-match-key="ming-porcelain:eastern:K01"]').innerText(), /Matched ×3/);
    assert.equal(await page.locator('.binder-card[data-collected="true"]').count(), 6);
    await page.waitForTimeout(500);
    for (const [width, height] of [[390, 844], [390, 664], [320, 568], [768, 1024]]) {
      await page.setViewportSize({ width, height }); await page.waitForTimeout(200);
      const layout = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
        return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
          close: rect('[aria-label="Close dialog"]'), binder: rect('.tile-binder'), grid: rect('.binder-grid'), card: rect('.binder-card') };
      });
      assert.ok(layout.documentWidth <= width, `${width}×${height}: document has no horizontal overflow`);
      assert.ok(layout.close.left >= 0 && layout.close.right <= width && layout.close.top >= 0 && layout.close.bottom <= height, 'close control stays reachable');
      assert.ok(layout.binder.left >= 0 && layout.binder.right <= width);
      assert.ok(layout.card.bottom <= layout.grid.bottom, `${width}×${height}: at least one full card row is readable`);
      if (height <= 620) {
        await page.getByLabel('Collection edition', { exact: true }).selectOption('western');
        assert.equal(await page.locator('.binder-card').count(), 40);
        await page.getByLabel('Collection edition', { exact: true }).selectOption('eastern');
      }
      if (width <= 350) {
        await page.getByLabel('Collection rarity', { exact: true }).selectOption('legendary');
        assert.equal(await page.locator('.binder-card').count(), 2);
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
    for (const [label, count] of [['Common', 22], ['Rare', 10], ['Epic', 6], ['Legendary', 2], ['All', 40]]) {
      const control = page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: label, exact: true });
      await control.click(); assert.equal(await control.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.binder-card').count(), count);
    }
    await page.getByLabel('Collection theme', { exact: true }).focus();
    assert.ok(await page.getByLabel('Collection theme', { exact: true }).evaluate(node => parseFloat(getComputedStyle(node).outlineWidth) >= 2));
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Tile binder', exact: true }).click();
    assert.match(await page.locator('.binder-summary').innerText(), /6\s*\/\s*720/);
    assert.equal(await page.locator('.binder-match-total strong').innerText(), '8');
    await page.getByRole('group', { name: 'Rarity filter' }).getByRole('button', { name: 'Rare', exact: true }).click();
    assert.equal(await page.locator('.binder-card').count(), 10);
    assert.equal(await page.locator('.binder-card[data-collected="true"]').count(), 1);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(output, `binder-${browserName}-rare-390x844.png`) });
    assert.deepEqual(errors, []);
    console.log(`PASS binder: 720 images decode, all tiers/themes/editions, duplicate counts persist, four responsive sizes, accessible close/focus; no errors (${browserName})`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, `binder-${browserName}-failure.png`), fullPage: true }).catch(() => {});
    console.error('Browser errors:', errors); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
