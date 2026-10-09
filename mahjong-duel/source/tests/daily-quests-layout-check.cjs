/* Daily Quests: responsive artwork, objective text and real claim/reroll actions.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/daily-quests-layout-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const kind = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const output = path.resolve('tmp/daily-quests-layout-qa');
const sizes = [[320,568],[375,667],[390,844],[430,932],[768,1024],[1024,768],[568,320],[844,390]];

(async () => {
  const { DAILY_QUEST_POOL } = await import(pathToFileURL(path.resolve('src/daily-quests.js')).href);
  const { createProgression, reduceProgression } = await import(pathToFileURL(path.resolve('src/progression.js')).href);
  const now = Date.parse('2026-10-03T12:00:00Z'), dayId = '2026-10-03';
  let base = reduceProgression(createProgression({ seed: 25 }), { type: 'login', now });
  for (const type of ['daily-presented', 'quests-presented']) base = reduceProgression(base, { type, dayId, now });
  base.currencies = { coins: 2400, gems: 42 };
  const byId = new Map(DAILY_QUEST_POOL.map(quest => [quest.id, quest]));
  function fixture(ids, states = [], rerollsUsed = 0) {
    const state = structuredClone(base);
    state.quests = { dayId, presented: true, rerollsUsed, entries: ids.map((id, index) => {
      const quest = byId.get(id), status = states[index] || 'progress';
      return { id, progress: ['ready', 'claimed'].includes(status) ? quest.target : Math.floor((quest.target - 1) / 2),
        claimed: status === 'claimed', startedAt: now, uniqueKeys: [], chains: {} };
    }) };
    return state;
  }
  const mixedIds = ['easy-recall-1', 'medium-recovery-3', 'hard-pairs-50'];
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[kind].launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
  await context.addInitScript(initial => {
    if (!localStorage.getItem('daily-quests-layout-seeded')) {
      localStorage.setItem('porcelain:progression', JSON.stringify(initial));
      localStorage.setItem('porcelain:gentle', 'true');
      localStorage.setItem('porcelain:sound', 'false');
      localStorage.setItem('daily-quests-layout-seeded', 'true');
    }
  }, fixture(mixedIds, ['progress', 'ready', 'claimed']));
  const page = await context.newPage(), errors = [], report = [], covered = new Set(), metricArtwork = new Map();
  page.setDefaultTimeout(15000);
  await page.clock.setFixedTime(new Date(now));
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  fs.mkdirSync(output, { recursive: true });
  const article = quest => page.getByRole('article', { name: `${quest.title}, ${quest.difficulty[0].toUpperCase() + quest.difficulty.slice(1)} quest`, exact: true });
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:progression')));
  async function show(state) {
    if (page.url() === 'about:blank') await page.goto(origin);
    else {
      await page.evaluate(state => localStorage.setItem('porcelain:progression', JSON.stringify(state)), state);
      await page.reload();
    }
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Daily Quests', exact: true }).click();
    await page.getByRole('heading', { name: 'Daily Quests', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
  }
  async function textScale(scale) {
    await page.evaluate(scale => {
      document.querySelectorAll('[data-layout-text-scale]').forEach(node => { node.style.removeProperty('font-size'); delete node.dataset.layoutTextScale; });
      if (scale === 1) return;
      const nodes = [...document.querySelectorAll('.daily-quests-page *')].filter(node => node.namespaceURI === 'http://www.w3.org/1999/xhtml' && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()));
      const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node, index) => { node.dataset.layoutTextScale = String(scale); node.style.fontSize = `${sizes[index] * scale}px`; });
    }, scale);
  }
  async function check(label, screenshot = false) {
    const metrics = await page.evaluate(() => {
      const bounds = node => node.getBoundingClientRect().toJSON();
      const root = document.querySelector('.daily-quests-page'), scroll = root.querySelector('.progression-page-scroll');
      const cards = [...root.querySelectorAll('.daily-quest-card')].map(card => ({
        name: card.getAttribute('aria-label'), bounds: bounds(card),
        regions: ['.daily-quest-art', '.daily-quest-copy', '.daily-quest-progress', '.daily-quest-reward', '.daily-quest-actions'].map(selector => {
          const node = card.querySelector(selector); return node && { selector, ...bounds(node) };
        }).filter(Boolean),
        text: [...card.querySelectorAll('.daily-quest-copy h3,.daily-quest-copy p,.daily-quest-reroll-confirm h4,.daily-quest-reroll-confirm p')].map(node => {
          const range = document.createRange(); range.selectNodeContents(node);
          return { text: node.textContent.trim(), bounds: bounds(node), range: bounds(range), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight, overflowY: getComputedStyle(node).overflowY };
        }),
        artwork: [...card.querySelectorAll('.daily-quest-art svg')].map(node => ({ ...bounds(node), shapes: node.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line,use').length })),
      }));
      return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
        scroll: { ...bounds(scroll), scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth }, cards };
    });
    const failures = [], intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    if (metrics.cards.length !== 3) failures.push('Exactly three daily quests must render');
    if (metrics.documentWidth > metrics.viewport.width + 1 || metrics.scroll.scrollWidth > metrics.scroll.clientWidth + 1) failures.push('Horizontal overflow');
    for (let i = 0; i < metrics.cards.length; i++) {
      const card = metrics.cards[i];
      if (card.bounds.left < metrics.scroll.left - 1 || card.bounds.right > metrics.scroll.right + 1) failures.push(`${card.name}: card crosses scroll viewport`);
      if (!card.artwork.length || card.artwork.some(icon => icon.width < 1 || icon.height < 1 || !icon.shapes)) failures.push(`${card.name}: objective artwork missing`);
      for (const region of card.regions) {
        if (region.left < card.bounds.left - 1 || region.right > card.bounds.right + 1 || region.top < card.bounds.top - 1 || region.bottom > card.bounds.bottom + 1) failures.push(`${card.name}: ${region.selector} crosses card boundary`);
      }
      for (let a = 0; a < card.regions.length; a++) for (let b = a + 1; b < card.regions.length; b++) {
        if (intersects(card.regions[a], card.regions[b])) failures.push(`${card.name}: ${card.regions[a].selector} overlaps ${card.regions[b].selector}`);
      }
      for (const text of card.text) {
        const clipsVertically = ['hidden', 'clip'].includes(text.overflowY) && text.scrollHeight > text.clientHeight + 1;
        if (text.scrollWidth > text.clientWidth + 1 || clipsVertically || text.range.left < card.bounds.left - 1 || text.range.right > card.bounds.right + 1) failures.push(`${card.name}: clipped text ${text.text}`);
      }
      for (let j = i + 1; j < metrics.cards.length; j++) if (intersects(card.bounds, metrics.cards[j].bounds)) failures.push(`${card.name}: quest cards overlap`);
    }
    const buttons = page.locator('.daily-quests-page button');
    for (let i = 0; i < await buttons.count(); i++) {
      const button = buttons.nth(i);
      if (!await button.isVisible()) continue;
      await button.scrollIntoViewIfNeeded();
      const control = await button.evaluate(node => {
        const r = node.getBoundingClientRect();
        return { name: node.getAttribute('aria-label') || node.textContent.trim(), width: r.width, height: r.height,
          reachable: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('button') === node };
      });
      if (control.width < 44 || control.height < 44) failures.push(`${control.name}: target smaller than 44px`);
      if (!control.reachable) failures.push(`${control.name}: pointer target covered`);
    }
    await page.locator('.progression-page-scroll').evaluate(node => { node.scrollTop = 0; });
    report.push({ label, ...metrics, failures });
    if (screenshot || failures.length) await page.screenshot({ path: path.join(output, `${kind}-${label}.jpg`), type: 'jpeg', quality: 90, animations: 'disabled' });
    assert.deepEqual(failures, [], label);
  }
  try {
    await show(fixture(mixedIds, ['progress', 'ready', 'claimed']));
    for (const [width, height] of sizes) for (const scale of [1, 1.25]) {
      await textScale(1); await page.setViewportSize({ width, height }); await textScale(scale);
      await check(`${width}x${height}-${scale === 1 ? 'normal' : 'text125'}`, true);
    }
    await textScale(1);
    // Every objective is rendered at the narrowest viewport with enlarged text.
    await page.setViewportSize({ width: 320, height: 568 });
    for (let start = 0; start < DAILY_QUEST_POOL.length; start += 3) {
      const quests = DAILY_QUEST_POOL.slice(start, start + 3);
      await show(fixture(quests.map(quest => quest.id))); await textScale(1.25);
      for (const quest of quests) {
        const card = article(quest), objective = (await card.locator('h3').textContent()).trim();
        assert.ok(objective && objective !== quest.title, `${quest.id}: heading describes the objective`);
        assert.equal(await card.getByRole('progressbar', { name: `${quest.title} progress`, exact: true }).count(), 1);
        const artwork = await card.locator('.daily-quest-art .daily-quest-icon').getAttribute('data-quest-art');
        assert.ok(artwork, `${quest.id}: objective has semantic artwork`);
        if (metricArtwork.has(quest.metric)) assert.equal(artwork, metricArtwork.get(quest.metric), `${quest.id}: repeated metrics use consistent artwork`);
        metricArtwork.set(quest.metric, artwork);
        covered.add(quest.id);
      }
      await check(`objectives-${start + 1}-${start + quests.length}`, true);
    }
    assert.equal(covered.size, DAILY_QUEST_POOL.length, 'Every quest objective covered');
    assert.equal(new Set(metricArtwork.values()).size, new Set(DAILY_QUEST_POOL.map(quest => quest.metric)).size, 'Every objective metric has distinct artwork');
    await show(fixture(mixedIds, ['progress', 'ready', 'claimed']));
    const ready = byId.get(mixedIds[1]), pending = byId.get(mixedIds[0]);
    const before = await stored();
    await article(ready).getByRole('button', { name: 'Claim', exact: true }).click();
    await article(ready).getByText('Claimed', { exact: true }).waitFor();
    let state = await stored();
    for (const currency of ['coins', 'gems']) assert.equal(state.currencies[currency], before.currencies[currency] + ready.reward[currency]);
    assert.equal(await article(ready).getByRole('button', { name: 'Claim', exact: true }).count(), 0, 'Claim action becomes a claimed state');
    await check('claimed', true);
    await article(pending).getByRole('button', { name: `Replace ${pending.title}`, exact: true }).click();
    await page.getByRole('heading', { name: 'Replace this quest?', exact: true }).waitFor();
    await textScale(1.25); await check('replacement-confirm-text125', true);
    await page.getByRole('button', { name: 'Keep quest', exact: true }).click();
    assert.equal((await stored()).quests.rerollsUsed, 0, 'Cancel preserves free replacement');
    await article(pending).getByRole('button', { name: `Replace ${pending.title}`, exact: true }).click();
    await page.getByRole('button', { name: 'Replace for free', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('porcelain:progression')).quests.rerollsUsed === 1);
    state = await stored();
    assert.ok(!state.quests.entries.some(entry => entry.id === pending.id));
    for (const button of await page.getByRole('button', { name: /^Replace / }).all()) assert.equal(await button.isDisabled(), true, 'No second daily replacement');
    await textScale(1); await textScale(1.25); await check('replacement-exhausted-text125', true);
    await page.getByRole('button', { name: 'Back to main menu', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
    await page.reload(); await page.getByRole('button', { name: 'Daily Quests', exact: true }).click();
    await page.getByRole('heading', { name: 'Daily Quests', exact: true }).waitFor();
    assert.equal((await stored()).quests.rerollsUsed, 1, 'Exhausted replacement survives reload');
    assert.ok((await stored()).quests.entries.find(entry => entry.id === ready.id).claimed, 'Claim survives reload');
    await check('persisted', true);
    assert.deepEqual(errors, []);
    console.log(`PASS ${kind}: ${report.length} quest layouts, all ${covered.size} objectives/icons, 44px targets, enlarged text, claim and replacement states`);
  } finally {
    fs.writeFileSync(path.join(output, `${kind}-report.json`), JSON.stringify({ report, objectives: [...covered], metricArtwork: Object.fromEntries(metricArtwork), errors }, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
