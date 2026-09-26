/* GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/tile-inspector-check.cjs [--webkit] */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const source = file => import(pathToFileURL(path.join(root, 'src', file)));
  const { createCollection, awardCollectedPair, COLLECTION_STORAGE_KEY } = await source('collection.js');
  const { themes } = await source('themes.js');
  const { themeTileSets } = await source('tile-data.js');
  const { rarityForTile } = await source('rarity.js');
  const { tileDescription } = await source('tile-descriptions.js');
  const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const output = path.join(root, 'output/remake/binder-inspector');
  fs.mkdirSync(output, { recursive: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  let value = createCollection();
  for (const theme of themes) {
    for (const ruleset of ['eastern', 'western']) {
      for (const id of (ruleset === 'eastern' ? ['C01', 'A01', 'K01'] : ['W01', 'W10', 'W40'])) {
        const tile = themeTileSets[theme.id][ruleset].find(item => item.id === id);
        assert.ok(tile, `${theme.id} ${ruleset} fixture ${id} exists`);
        for (let index = 0; index < (id === 'C01' ? 3 : 1); index += 1) {
          value = awardCollectedPair(value, { gameId: 'inspector-check', pairId: `${tile.matchKey}-${index}`, actor: 'you', matchKey: tile.matchKey });
        }
      }
    }
  }
  const initialCollection = JSON.stringify(value);
  const card = key => page.locator(`.binder-card[data-match-key="${key}"]`);
  const inspector = page.locator('dialog.tile-inspector');
  async function selectEdition(ruleset) {
    const compact = page.getByLabel('Collection edition', { exact: true });
    if (await compact.isVisible()) await compact.selectOption(ruleset);
    else await page.getByRole('group', { name: 'Collection ruleset' }).getByRole('button', { name: new RegExp(ruleset, 'i') }).click();
  }
  async function verifyPreview(themeId, ruleset, id, count = 1) {
    const tile = themeTileSets[themeId][ruleset].find(item => item.id === id);
    await inspector.waitFor({ state: 'visible' });
    await inspector.locator('img').evaluate(image => image.decode());
    await inspector.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished.catch(() => {}))));
    assert.equal(await inspector.evaluate(node => node.open && node.matches(':modal')), true, 'preview uses a native modal');
    assert.equal(await inspector.getByRole('heading').innerText(), tile.name);
    const description = await inspector.locator('.tile-inspector-description').innerText();
    assert.ok(description.length > 25, 'description is informative');
    assert.equal(description, tileDescription(themeId, ruleset, id), 'description follows tile, theme and edition');
    assert.equal(await inspector.locator('img').getAttribute('alt'), tile.name);
    assert.equal(await inspector.locator('img').getAttribute('src'), tile.src);
    assert.match(await inspector.locator('.tile-inspector-meta').innerText(), new RegExp(rarityForTile(themeId, ruleset, id).label));
    assert.match(await inspector.locator('.tile-inspector-meta').innerText(), new RegExp(`Matched ×${count}`));
    assert.equal(await inspector.getAttribute('aria-describedby'), await inspector.locator('.tile-inspector-description').getAttribute('id'));
    const paintedSize = image => {
      const rect = image.getBoundingClientRect();
      const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
      return { width: image.naturalWidth * scale, height: image.naturalHeight * scale };
    };
    const previewArt = await inspector.locator('img').evaluate(paintedSize);
    const thumbnail = await card(tile.matchKey).locator('.binder-art img').evaluate(paintedSize);
    assert.ok(previewArt.height > thumbnail.height && previewArt.width > thumbnail.width, `inspected art ${JSON.stringify(previewArt)} is larger than its thumbnail ${JSON.stringify(thumbnail)}`);
    return tile;
  }
  async function assertBinderStillOpen() {
    await inspector.waitFor({ state: 'detached' });
    assert.equal(await page.locator('.tile-binder').isVisible(), true, 'closing inspector leaves binder open');
  }
  try {
    await page.goto(process.env.GAME_URL || 'http://localhost:5173');
    await page.evaluate(({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, value);
      localStorage.setItem('porcelain:gentle', 'true');
      localStorage.setItem('porcelain:sound', 'false');
    }, { key: COLLECTION_STORAGE_KEY, value: initialCollection });
    await page.reload();
    await page.getByRole('button', { name: 'Tile binder', exact: true }).click();
    await page.locator('.tile-binder').waitFor();
    assert.equal(await page.locator('.binder-card.is-collected .binder-inspect-button').count(), 3);
    assert.equal(await page.locator('.binder-card.is-locked button').count(), 0, 'locked art has no inspection affordance');
    await page.locator('.binder-card.is-locked').first().click();
    assert.equal(await inspector.count(), 0, 'tapping locked artwork does not inspect it');

    const key = 'ming-porcelain:eastern:C01';
    const opener = card(key).getByRole('button', { name: 'Inspect 1 peach', exact: true });
    await opener.scrollIntoViewIfNeeded();
    await opener.focus();
    const scrollBefore = await page.locator('.binder-grid').evaluate(node => node.scrollTop);
    assert.ok(scrollBefore > 0, 'fixture exercises a scrolled collection');
    await page.keyboard.press('Enter');
    await verifyPreview('ming-porcelain', 'eastern', 'C01', 3);
    const close = inspector.getByRole('button', { name: 'Close tile preview', exact: true });
    assert.equal(await close.evaluate(node => node === document.activeElement), true, 'close receives initial focus');
    for (const key of ['Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      assert.equal(await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement?.closest('.tile-inspector'))), true, 'Tab cannot reach binder controls behind modal');
      await page.keyboard.press('Escape');
      await assertBinderStillOpen();
      assert.equal(await opener.evaluate(node => node === document.activeElement), true, 'Escape after Tab restores tile focus');
      await page.keyboard.press('Enter');
      await inspector.waitFor({ state: 'visible' });
    }
    await page.keyboard.press('Escape');
    await assertBinderStillOpen();
    assert.equal(await opener.evaluate(node => node === document.activeElement), true, 'Escape restores tile focus');
    assert.ok(Math.abs(await page.locator('.binder-grid').evaluate(node => node.scrollTop) - scrollBefore) <= 1, 'inspection preserves collection scroll');

    await opener.click();
    await verifyPreview('ming-porcelain', 'eastern', 'C01', 3);
    await page.mouse.click(2, 2);
    await assertBinderStillOpen();
    assert.equal(await opener.evaluate(node => node === document.activeElement), true, 'backdrop dismissal restores tile focus');
    await opener.click();
    await inspector.getByRole('button', { name: 'Close tile preview', exact: true }).click();
    await assertBinderStillOpen();

    for (const theme of themes) {
      await page.getByLabel('Collection theme', { exact: true }).selectOption(theme.id);
      for (const ruleset of ['eastern', 'western']) {
        await selectEdition(ruleset);
        const id = ruleset === 'eastern' ? 'A01' : 'W10';
        await card(`${theme.id}:${ruleset}:${id}`).getByRole('button').click();
        await verifyPreview(theme.id, ruleset, id);
        await inspector.getByRole('button', { name: 'Close tile preview', exact: true }).click();
        await assertBinderStillOpen();
      }
    }
    await page.getByLabel('Collection theme', { exact: true }).selectOption('ming-porcelain');
    await selectEdition('eastern');
    const layouts = [];
    for (const [width, height] of [[320, 568], [375, 553], [390, 844], [440, 956], [768, 1024], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await opener.click();
      await verifyPreview('ming-porcelain', 'eastern', 'C01', 3);
      const layout = await page.evaluate(() => {
        const dialog = document.querySelector('.tile-inspector');
        const rect = node => node.getBoundingClientRect().toJSON();
        return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
          dialog: rect(dialog), close: rect(dialog.querySelector('.tile-inspector-close')),
          horizontalOverflow: dialog.scrollWidth > dialog.clientWidth + 1 };
      });
      assert.ok(layout.documentWidth <= width, `${width}×${height}: document stays within viewport`);
      assert.equal(layout.horizontalOverflow, false, `${width}×${height}: popup has no horizontal overflow`);
      for (const [label, rect] of [['dialog', layout.dialog], ['close', layout.close]]) {
        assert.ok(rect.left >= 0 && rect.right <= width + 1 && rect.top >= 0 && rect.bottom <= height + 1, `${width}×${height}: ${label} is fully visible`);
      }
      assert.ok(layout.close.width >= 44 && layout.close.height >= 44, 'close has a 44px target');
      await inspector.locator('.tile-inspector-meta').scrollIntoViewIfNeeded();
      assert.equal(await inspector.locator('.tile-inspector-meta').isVisible(), true, 'count and rarity remain reachable');
      await inspector.evaluate(node => { node.scrollTop = 0; });
      await page.screenshot({ path: path.join(output, `${browserName}-${width}x${height}.png`) });
      layouts.push(layout);
      await inspector.getByRole('button', { name: 'Close tile preview', exact: true }).click();
      await assertBinderStillOpen();
    }
    fs.writeFileSync(path.join(output, `${browserName}-layouts.json`), JSON.stringify(layouts, null, 2));
    assert.equal(await page.evaluate(key => localStorage.getItem(key), COLLECTION_STORAGE_KEY), initialCollection, 'inspection never modifies collection or duplicate counts');
    assert.deepEqual(errors, [], 'no runtime or resource errors');
    console.log(`PASS tile inspector: collected-only access; enlarged art, description and metadata across ${themes.length} launch themes/two editions; Escape/backdrop/close, focus and scroll restoration; six responsive sizes; collection unchanged (${browserName})`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, `${browserName}-failure.png`), fullPage: true }).catch(() => {});
    console.error('Browser errors:', errors);
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
