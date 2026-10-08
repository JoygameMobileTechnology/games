/* Loading regression: artwork must not delay the gallery or move its shelves.
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/achievement-loading-check.cjs [--webkit] [--dev-only]
 * Run npm run build first to include the offline standalone checks.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const standalone = path.resolve(process.env.STANDALONE_HTML || 'output/mahjong-duel-web.html');
const output = path.resolve('tmp/achievement-loading-qa');
const cardsSelector = 'button[data-achievement-family]';
const sizes = [{ width: 390, height: 844 }, { width: 768, height: 1024 }];
const atlasHeader = fs.readFileSync(path.resolve(__dirname, '../public/assets/remake/achievement-trophies.png'));
const atlasSize = { width: atlasHeader.readUInt32BE(16), height: atlasHeader.readUInt32BE(20) };

function assertStable(before, after, label) {
  assert.equal(after.cards.length, 43, `${label}: all 43 trophy controls remain`);
  assert.deepEqual(after.cards.map(card => card.id), before.cards.map(card => card.id), `${label}: trophy order stays unchanged`);
  assert.ok(Math.abs(after.height - before.height) <= 1, `${label}: gallery height ${before.height} → ${after.height}`);
  for (const [index, shelf] of before.shelves.entries()) {
    const next = after.shelves[index];
    for (const key of ['top', 'width', 'height']) assert.ok(Math.abs(next[key] - shelf[key]) <= 1, `${label}: shelf ${index} ${key} ${shelf[key]} → ${next[key]}`);
  }
  for (const [index, card] of before.cards.entries()) {
    const next = after.cards[index];
    for (const key of ['width', 'height']) assert.ok(Math.abs(next[key] - card[key]) <= 1, `${label}: ${card.id} ${key} stays stable`);
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch();
  const reports = [];
  async function run(viewport, { offline = false, fallback = false } = {}) {
    const label = `${offline ? 'standalone-offline' : 'development'}-${viewport.width}x${viewport.height}${fallback ? '-without-observer' : ''}`;
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await context.addInitScript(({ fallback }) => {
      localStorage.setItem('porcelain:gentle', 'true');
      localStorage.setItem('porcelain:sound', 'false');
      if (fallback) window.IntersectionObserver = undefined;
      window.decodedImages = [];
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = async function (...args) {
        await decode.apply(this, args);
        window.decodedImages.push({ url: this.src, width: this.naturalWidth, height: this.naturalHeight });
      };
    }, { fallback });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    // Fulfill the unchanged standalone file and block all external requests.
    // WebKit's offline emulator also rejects local Blob image decoding, so use
    // this request gate there; Chromium additionally runs in browser offline mode.
    const standaloneUrl = 'http://standalone.invalid/achievement-loading';
    if (offline) await page.route('**/*', route => {
      const url = route.request().url();
      if (url === standaloneUrl) return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(standalone, 'utf8') });
      return /^(?:blob:|data:)/.test(url) ? route.continue() : route.abort();
    });
    const errors = [], assetRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (!request.isNavigationRequest() && !/^(?:blob:|data:)/.test(request.url())) assetRequests.push(request.url());
    });
    const button = name => page.getByRole('button', { name, exact: true });
    const cards = () => page.locator(cardsSelector);
    const area = () => page.locator('.achievements-page .progression-page-scroll');
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const geometry = () => page.evaluate(selector => {
      const area = document.querySelector('.achievements-page .progression-page-scroll');
      const top = area.getBoundingClientRect().top;
      const rect = node => { const r = node.getBoundingClientRect(); return { top: r.top + area.scrollTop - top, width: r.width, height: r.height }; };
      return {
        height: area.scrollHeight,
        shelves: [...document.querySelectorAll('.achievement-shelf')].map(rect),
        cards: [...document.querySelectorAll(selector)].map(node => ({ id: node.dataset.achievementFamily, ...rect(node) })),
      };
    }, cardsSelector);
    const visibleArtwork = () => page.waitForFunction(selector => {
      const area = document.querySelector('.achievements-page .progression-page-scroll').getBoundingClientRect();
      return [...document.querySelectorAll(selector)].every(card => {
        const art = card.querySelector('.achievement-trophy-stage').getBoundingClientRect();
        return art.bottom <= area.top || art.top >= area.bottom || Boolean(card.querySelector('.trophy-illustration'));
      });
    }, cardsSelector);
    const artUrl = async () => {
      const art = await page.locator('.trophy-illustration').evaluateAll(nodes => nodes.map(node => ({ standalone: node.classList.contains('trophy-illustration--standalone'), url: getComputedStyle(node).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1] })));
      const atlasUrls = [...new Set(art.filter(image => !image.standalone).map(image => image.url))];
      assert.equal(atlasUrls.length, 1, `${label}: milestone trophies share one atlas URL`);
      for (const url of new Set(art.map(image => image.url))) {
        assert.ok(url && url.length < 256, `${label}: artwork does not repeat a large inline image`);
        if (offline) assert.match(url, /^blob:/, `${label}: embedded artwork has a short reusable URL`);
      }
      return atlasUrls[0];
    };
    try {
      await page.goto(offline ? standaloneUrl : origin);
      if (offline && browserName !== 'webkit') await context.setOffline(true);
      await page.getByRole('button', { name: /^(?:Achievements|Back to main menu|Close daily welcome)$/ }).first().waitFor();
      if (await page.locator('.daily-welcome-page').isVisible()) await button('Close daily welcome').click();
      if (await page.locator('.daily-rewards-page').isVisible()) await button('Back to main menu').click();
      if (await page.locator('.daily-quests-page').isVisible()) await button('Back to main menu').click();
      await button('Achievements').waitFor();
      await page.evaluate(() => document.fonts.ready);
      // Observe app-initiated work before opening: the test itself never warms the atlas.
      // Standalone WebPs can finish decoding first; identify the atlas by its PNG dimensions offline.
      await page.waitForFunction(({ offline, atlasSize }) => window.decodedImages.some(image => image.width > 0 && (offline ? image.url.startsWith('blob:') && image.width === atlasSize.width && image.height === atlasSize.height : image.url.includes('/achievement-trophies.png'))), { offline, atlasSize });
      assert.equal(await page.locator('.achievements-page').count(), 0, `${label}: preloading happens before opening`);
      if (!offline) assert.equal(assetRequests.filter(url => url.includes('/achievement-trophies.png')).length, 1, `${label}: menu starts one atlas request`);
      const preloaded = await page.evaluate(({ offline, atlasSize }) => window.decodedImages.find(image => offline ? image.url.startsWith('blob:') && image.width === atlasSize.width && image.height === atlasSize.height : image.url.includes('/achievement-trophies.png')), { offline, atlasSize });

      await button('Achievements').click();
      await page.getByRole('heading', { name: 'Achievements', exact: true }).waitFor();
      await settle();
      await visibleArtwork();
      assert.equal(await cards().count(), 43, `${label}: every trophy is available immediately`);
      const initialArtwork = await cards().locator('.trophy-illustration').count();
      assert.ok(initialArtwork > 0, `${label}: first shelves show artwork`);
      assert.ok(fallback ? initialArtwork === 43 : initialArtwork < 43, `${label}: ${fallback ? 'observer fallback shows all' : 'offscreen'} artwork (${initialArtwork}/43)`);
      const source = await artUrl();
      assert.equal(source, preloaded.url, `${label}: gallery reuses the menu-decoded atlas`);
      const original = await geometry();

      // Focus can jump over deferred shelves without a pointer scroll first.
      const last = cards().last(), lastId = await last.getAttribute('data-achievement-family');
      await last.focus();
      await last.locator('.trophy-illustration').waitFor();
      await visibleArtwork();
      const beforeDetail = await area().evaluate(node => node.scrollTop);
      assert.ok(beforeDetail > 0, `${label}: keyboard focus reaches the bottom`);
      await page.keyboard.press('Enter');
      await page.locator('.achievement-detail-hero .trophy-illustration').waitFor();
      assert.equal(await artUrl(), source, `${label}: detail shares the same atlas`);
      await button('Back to achievements').click();
      await page.waitForFunction(id => document.activeElement?.dataset.achievementFamily === id, lastId);
      assert.ok(Math.abs(await area().evaluate(node => node.scrollTop) - beforeDetail) <= 2, `${label}: Back restores scroll`);
      assertStable(original, await geometry(), `${label}: focus and detail return`);

      const shelves = page.locator('.achievement-shelf');
      for (let index = 0; index < await shelves.count(); index++) {
        const first = shelves.nth(index).locator(cardsSelector).first();
        await first.scrollIntoViewIfNeeded();
        await first.locator('.trophy-illustration').waitFor();
        await visibleArtwork();
      }
      assert.equal(await cards().locator('.trophy-illustration').count(), 43, `${label}: every visited shelf reveals its artwork`);
      const standaloneArt = cards().locator('.trophy-illustration--standalone');
      assert.equal(await standaloneArt.count(), 27, `${label}: all one-time trophies use individual artwork`);
      assert.equal(await standaloneArt.evaluateAll(nodes => new Set(nodes.map(node => getComputedStyle(node).backgroundImage)).size), 27, `${label}: each one-time trophy has its own image`);
      assert.equal(await cards().locator('.trophy-illustration:not(.trophy-illustration--standalone)').count(), 16, `${label}: all progressive trophies keep the shared atlas`);
      await area().evaluate(node => { node.scrollTop = 0; });
      await settle();
      assertStable(original, await geometry(), `${label}: full scroll and return`);

      // Reflow into landscape, then move between extremes without artwork shifting content.
      await page.setViewportSize({ width: viewport.height, height: viewport.width });
      await settle();
      const landscape = await geometry();
      await last.scrollIntoViewIfNeeded();
      await visibleArtwork();
      await area().evaluate(node => { node.scrollTop = 0; });
      await settle();
      assertStable(landscape, await geometry(), `${label}: landscape scroll`);
      await page.setViewportSize(viewport);
      await settle();
      assertStable(original, await geometry(), `${label}: portrait restored`);
      assert.equal(await artUrl(), source, `${label}: resize and all shelves retain the same atlas`);
      assert.deepEqual(errors, [], `${label}: no browser errors`);
      if (offline) assert.deepEqual(assetRequests, [], `${label}: works offline with no external asset requests`);
      const report = { label, initialArtwork, totalArtwork: 43, atlasUrlLength: source.length, galleryHeight: original.height, atlasRequests: assetRequests.filter(url => url.includes('/achievement-trophies.png')).length, ...(offline ? { offlineMode: browserName === 'webkit' ? 'block-external-requests' : 'browser-offline' } : {}) };
      reports.push(report);
      console.log(`PASS ${browserName} ${label}: ${initialArtwork}/43 initial artwork; stable scroll/focus/detail/resize; shared ${source.length}-character atlas${offline ? '; no asset requests' : '; menu preload and decode'}`);
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${browserName}-${label}-failure.png`) }).catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
  try {
    for (const viewport of sizes) await run(viewport);
    await run(sizes[0], { fallback: true });
    if (!process.argv.includes('--dev-only')) {
      assert.ok(fs.existsSync(standalone), 'Build the standalone HTML before the offline checks');
      for (const viewport of sizes) await run(viewport, { offline: true });
    }
    fs.writeFileSync(path.join(output, `${browserName}-report.json`), JSON.stringify(reports, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
