/* Shop: responsive product art, sticky wallet and confirmation navigation.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/shop-layout-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const kind = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const output = path.resolve('tmp/shop-layout-qa');
const sizes = [[320,568],[375,667],[390,844],[430,932],[768,1024],[1024,768],[568,320],[844,390]];

(async () => {
  const { SHOP_CURRENCY_PACKS, SHOP_BOOSTER_PACKS, canAfford } = await import(pathToFileURL(path.resolve('src/economy.js')).href);
  const { createProgression, reduceProgression } = await import(pathToFileURL(path.resolve('src/progression.js')).href);
  const now = Date.parse('2026-10-03T12:00:00Z'), dayId = '2026-10-03';
  let base = reduceProgression(createProgression({ seed: 25 }), { type: 'login', now });
  for (const type of ['daily-presented', 'quests-presented']) base = reduceProgression(base, { type, dayId, now });
  const fixture = currencies => ({ ...structuredClone(base), currencies });
  const zero = { coins: 0, gems: 0 }, large = { coins: 123456789, gems: 987654 };
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[kind].launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await context.addInitScript(initial => {
    if (!localStorage.getItem('shop-layout-seeded')) {
      localStorage.setItem('porcelain:progression', JSON.stringify(initial));
      localStorage.setItem('porcelain:gentle', 'true'); localStorage.setItem('porcelain:sound', 'false');
      localStorage.setItem('shop-layout-seeded', 'true');
    }
  }, fixture(zero));
  const page = await context.newPage(), errors = [], report = [];
  page.setDefaultTimeout(15000);
  await page.clock.setFixedTime(new Date(now));
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  fs.mkdirSync(output, { recursive: true });
  const scroll = () => page.locator('.shop-page .progression-page-scroll');
  const productButton = id => page.locator(`[data-shop-product="${id}"]`);
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:progression')));
  async function show(currencies) {
    if (page.url() === 'about:blank') await page.goto(origin);
    else { await page.evaluate(state => localStorage.setItem('porcelain:progression', JSON.stringify(state)), fixture(currencies)); await page.reload(); }
    await page.getByRole('button', { name: 'Shop', exact: true }).click();
    await page.getByRole('heading', { name: 'Shop', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.querySelectorAll('.shop-product-art img')].length === 5 && [...document.querySelectorAll('.shop-product-art img')].every(img => img.complete));
  }
  async function scaleText(scale) {
    await page.evaluate(scale => {
      document.querySelectorAll('[data-layout-text-scale]').forEach(node => { node.style.removeProperty('font-size'); delete node.dataset.layoutTextScale; });
      if (scale === 1) return;
      const nodes = [...document.querySelectorAll('.shop-page *')].filter(node => node.namespaceURI === 'http://www.w3.org/1999/xhtml' && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()));
      const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node, index) => { node.dataset.layoutTextScale = String(scale); node.style.fontSize = `${sizes[index] * scale}px`; });
    }, scale);
  }
  async function check(label, catalog = true) {
    const metrics = await page.evaluate(() => {
      const box = node => node.getBoundingClientRect().toJSON();
      const root = document.querySelector('.shop-page'), body = root.querySelector('.progression-page-scroll');
      const products = [...root.querySelectorAll('[data-shop-product]')].map(button => {
        const card = button.closest('article');
        const regions = [...card.querySelectorAll('h4,p,.shop-product-art,.shop-booster-contents,[data-shop-product]')].filter(node => node.getClientRects().length);
        return { id: button.dataset.shopProduct, card: box(card), button: box(button),
          text: [...card.querySelectorAll('h4,p,small')].filter(node => node.getClientRects().length).map(node => {
            const range = document.createRange(); range.selectNodeContents(node);
            return { text: node.textContent.trim(), range: box(range), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
          }),
          overlaps: regions.flatMap((node, index) => regions.slice(index + 1).filter(other => !node.contains(other) && !other.contains(node)).map(other => {
            const a = box(node), b = box(other);
            return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1 ? `${node.className || node.tagName} / ${other.className || other.tagName}` : null;
          }).filter(Boolean)),
        };
      });
      return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
        body: { ...box(body), scrollWidth: body.scrollWidth, clientWidth: body.clientWidth }, header: box(root.querySelector('.progression-page-header')),
        wallet: box(root.querySelector('.shop-wallet')), products,
        art: [...root.querySelectorAll('.shop-product-art img')].map(img => ({ src: img.getAttribute('src'), naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, ...box(img) })),
        balances: [...root.querySelectorAll('.shop-wallet .currency-amount')].map(node => ({ text: node.textContent.trim(), label: node.getAttribute('aria-label'), ...box(node) })),
        currencyGrid: root.querySelector('.shop-currency-products') && box(root.querySelector('.shop-currency-products')),
        singles: root.querySelectorAll('.shop-single-products > .shop-booster-product').length,
        combos: root.querySelectorAll('.shop-combo-products > .shop-combo-product').length };
    });
    const failures = [];
    if (metrics.documentWidth > metrics.viewport.width + 1 || metrics.body.scrollWidth > metrics.body.clientWidth + 1) failures.push('Horizontal overflow');
    if (metrics.wallet.left < metrics.body.left - 1 || metrics.wallet.right > metrics.body.right + 1) failures.push('Wallet crosses page boundary');
    for (const balance of metrics.balances) if (balance.left < metrics.wallet.left - 1 || balance.right > metrics.wallet.right + 1) failures.push(`Balance clipped: ${balance.label}`);
    if (catalog) {
      if (metrics.products.length !== 12 || metrics.art.length !== 5 || metrics.singles !== 4 || metrics.combos !== 3) failures.push('Expected five currency products, four singles and three combos');
      for (const art of metrics.art) if (!art.naturalWidth || !art.naturalHeight || art.width < 1 || art.height < 1) failures.push(`Product artwork failed: ${art.src}`);
      for (const pack of SHOP_CURRENCY_PACKS) if (!metrics.art.some(art => art.src.endsWith(`/shop/${pack.id}.webp`))) failures.push(`${pack.name}: matching artwork missing`);
      for (const product of metrics.products) {
        if (product.card.left < metrics.body.left - 1 || product.card.right > metrics.body.right + 1) failures.push(`${product.id}: product crosses page boundary`);
        for (const text of product.text) if (text.scrollWidth > text.clientWidth + 1 || text.range.left < product.card.left - 1 || text.range.right > product.card.right + 1) failures.push(`${product.id}: text overflow ${text.text}`);
        for (const overlap of product.overlaps) failures.push(`${product.id}: overlapping ${overlap}`);
      }
      const currency = SHOP_CURRENCY_PACKS.map(pack => metrics.products.find(product => product.id === pack.id)?.card);
      if (currency.every(Boolean)) {
        if (Math.abs(currency[0].top - currency[1].top) > 1 || currency[0].right > currency[1].left || Math.abs(currency[2].top - currency[3].top) > 1) failures.push('Currency products must form two columns');
        if (currency[4].width < metrics.currencyGrid.width - 2) failures.push('Imperial Chest must span the currency grid');
      }
    }
    const buttons = page.locator('.shop-page button');
    for (let index = 0; index < await buttons.count(); index++) {
      const button = buttons.nth(index); if (!await button.isVisible()) continue;
      await button.scrollIntoViewIfNeeded();
      const control = await button.evaluate(node => {
        const box = node.getBoundingClientRect();
        return { name: node.getAttribute('aria-label') || node.textContent.trim(), width: box.width, height: box.height,
          minimum: node.matches('[data-shop-product],.progression-primary') ? 48 : 44,
          reachable: document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('button') === node };
      });
      if (control.width < control.minimum || control.height < control.minimum) failures.push(`${control.name}: target below ${control.minimum}px`);
      if (!control.reachable) failures.push(`${control.name}: pointer target covered`);
    }
    await scroll().evaluate(node => { node.scrollTop = node.scrollHeight; });
    const sticky = await page.locator('.shop-wallet').evaluate(node => {
      const wallet = node.getBoundingClientRect(), header = document.querySelector('.shop-page .progression-page-header').getBoundingClientRect();
      return { top: wallet.top, bottom: wallet.bottom, headerBottom: header.bottom };
    });
    if (sticky.top < sticky.headerBottom - 1 || sticky.top > sticky.headerBottom + 16) failures.push('Balance bar does not stay beneath header while scrolling');
    if (['zero-390x844-normal','large-320x568-text125'].includes(label)) await page.screenshot({ path: path.join(output, `${kind}-${label}-bottom.jpg`), type: 'jpeg', quality: 90, animations: 'disabled' });
    await scroll().evaluate(node => { node.scrollTop = 0; });
    report.push({ label, ...metrics, sticky, failures });
    await page.screenshot({ path: path.join(output, `${kind}-${label}.jpg`), type: 'jpeg', quality: 90, animations: 'disabled' });
    assert.deepEqual(failures, [], label);
  }
  async function assertAffordability(currencies) {
    for (const pack of SHOP_CURRENCY_PACKS) {
      const button = productButton(pack.id);
      assert.equal(await button.isEnabled(), true, `${pack.name}: test purchase is available`);
      assert.equal(await button.getAttribute('aria-label'), `${pack.name}, ${pack.priceLabel}, test purchase`);
      assert.ok((await button.textContent()).includes(pack.priceLabel), `${pack.name}: displayed price matches its product`);
    }
    for (const pack of SHOP_BOOSTER_PACKS) assert.equal(await productButton(pack.id).isEnabled(), canAfford(currencies, pack.cost), `${pack.name}: affordability controls availability`);
    for (const currency of ['coins', 'gems']) {
      const label = await page.locator(`.shop-wallet .currency-amount-${currency}`).getAttribute('aria-label');
      assert.equal(label, `${currencies[currency].toLocaleString('en-US')} ${currency === 'coins' ? 'Coins' : 'Gems'}`, 'Wallet exposes exact balance');
    }
  }
  async function confirmAndBack(id, backLabel) {
    const opener = productButton(id); await opener.scrollIntoViewIfNeeded();
    const previousScroll = await scroll().evaluate(node => node.scrollTop);
    await opener.click(); await page.getByRole('heading', { name: 'Confirm purchase', exact: true }).waitFor();
    await check(`confirm-${id}`, false);
    if (SHOP_CURRENCY_PACKS.some(pack => pack.id === id)) {
      assert.match(await page.locator('.shop-confirmation').textContent(), /no real money charged/i);
      assert.equal(await page.getByRole('button', { name: 'Test purchase', exact: true }).count(), 1);
    }
    await page.getByRole('button', { name: backLabel, exact: true }).click();
    await page.getByRole('heading', { name: 'Shop', exact: true }).waitFor();
    await page.waitForFunction(({ id, previousScroll }) => document.activeElement?.dataset.shopProduct === id && Math.abs(document.querySelector('.shop-page .progression-page-scroll').scrollTop - previousScroll) <= 2, { id, previousScroll });
  }
  try {
    for (const [balanceName, currencies] of [['zero', zero], ['large', large]]) {
      await show(currencies); await assertAffordability(currencies);
      assert.match(await page.locator('.shop-page').textContent(), /no real money charged/i);
      for (const [width, height] of sizes) for (const scale of [1, 1.25]) {
        await scaleText(1); await page.setViewportSize({ width, height }); await scaleText(scale);
        await check(`${balanceName}-${width}x${height}-${scale === 1 ? 'normal' : 'text125'}`);
      }
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await show({ coins: 99999, gems: 99999 }); await scaleText(1.25); await check('full-counts-320x568-text125');
    await scaleText(1); await page.setViewportSize({ width: 390, height: 844 }); await show(large);
    for (const pack of SHOP_CURRENCY_PACKS) await confirmAndBack(pack.id, 'Back to shop');
    await confirmAndBack('masters-kit', 'Cancel');
    // One simulated purchase proves the redesigned confirmation and wallet update together.
    await show(zero); await productButton('travelers-purse').click();
    await page.getByRole('button', { name: 'Test purchase', exact: true }).click();
    await page.getByRole('heading', { name: 'Shop', exact: true }).waitFor();
    const bought = SHOP_CURRENCY_PACKS.find(pack => pack.id === 'travelers-purse');
    assert.deepEqual((await stored()).currencies, bought.grants);
    await assertAffordability(bought.grants);
    assert.equal(Object.keys((await stored()).purchaseReceipts).length, 1);
    await check('after-test-purchase');
    await page.getByRole('button', { name: 'Back to main menu', exact: true }).click();
    await page.reload(); await page.getByRole('button', { name: 'Shop', exact: true }).click();
    await page.getByRole('heading', { name: 'Shop', exact: true }).waitFor();
    assert.deepEqual((await stored()).currencies, bought.grants, 'Test purchase persists after reload');
    assert.deepEqual(errors, []);
    console.log(`PASS ${kind}: ${report.length} Shop layouts, five currency artworks, four singles, three combos, sticky wallet, enlarged text, affordability and confirmation return`);
  } finally {
    fs.writeFileSync(path.join(output, `${kind}-report.json`), JSON.stringify({ report, errors }, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
