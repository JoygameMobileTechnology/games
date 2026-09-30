/* First-login presentation, real claims, persisted sequencing and responsive layout.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/daily-welcome-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const kind = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const output = path.resolve('tmp/daily-welcome-qa');
const sizes = [[320,568],[375,553],[375,667],[390,844],[430,932],[768,1024],[1024,768],[568,320],[844,390]];

(async () => {
  const { createProgression, reduceProgression } = await import(pathToFileURL(path.resolve('src/progression.js')));
  const { getDailyEncouragement } = await import(pathToFileURL(path.resolve('src/daily-encouragement.js')));
  const { rewardsForLogin } = await import(pathToFileURL(path.resolve('src/daily-rewards.js')));
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[kind].launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  await context.addInitScript(() => { localStorage.setItem('porcelain:sound', 'false'); });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  fs.mkdirSync(output, { recursive: true });
  let now = Date.parse('2026-10-10T12:00:00Z');
  await page.clock.setFixedTime(new Date(now));
  const button = name => page.getByRole('button', { name, exact: true });
  const welcome = () => page.locator('.daily-welcome-page');
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:progression')));
  const message = day => Object.values(getDailyEncouragement(day));
  async function expectMessage(day) {
    for (const text of message(day)) assert.ok((await welcome().innerText()).includes(text), text);
  }
  async function closeQuests() {
    await page.getByRole('heading', { name: 'Daily Quests', exact: true }).waitFor();
    await button('OK').scrollIntoViewIfNeeded();
    const note = await page.locator('.daily-quests-footnote').boundingBox(), ok = await button('OK').boundingBox();
    assert.ok(ok.y >= note.y + note.height && ok.height >= 44, 'login OK sits below the reroll note with a touch-friendly target');
    await button('OK').click();
    await button('Play Duel').waitFor();
  }
  function beforeLogin(day, unclaimed = false) {
    let state = createProgression({ seed: 14 });
    for (let i = 1; i < day; i++) {
      const at = now - (day - i) * 86400000;
      state = reduceProgression(state, { type: 'login', now: at });
      if (!unclaimed) state = reduceProgression(state, { type: 'daily-claim', eventId: `fixture-claim-${i}`, now: at });
      state = reduceProgression(state, { type: 'daily-presented', now: at });
    }
    return state;
  }
  async function showDay(day, unclaimed = false) {
    await page.evaluate(state => localStorage.setItem('porcelain:progression', JSON.stringify(state)), beforeLogin(day, unclaimed));
    await page.reload(); await welcome().waitFor(); await page.evaluate(() => document.fonts.ready);
  }
  async function fit(label, noScroll = true) {
    const result = await welcome().evaluate(root => {
      const area = root.querySelector('.progression-page-scroll');
      const bounds = node => node.getBoundingClientRect().toJSON();
      const texts = [...root.querySelectorAll('h2,h3,strong,p,button,li')].filter(node => node.textContent.trim());
      return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
        scrollHeight: area.scrollHeight, clientHeight: area.clientHeight, scrollWidth: area.scrollWidth, clientWidth: area.clientWidth,
        buttons: [...root.querySelectorAll('button')].map(node => ({ label: node.textContent || node.getAttribute('aria-label'), ...bounds(node) })),
        texts: texts.map(node => ({ text: node.textContent, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth })) };
    });
    assert.ok(result.documentWidth <= result.width + 1 && result.scrollWidth <= result.clientWidth + 1, `${label}: no horizontal overflow`);
    if (noScroll) assert.ok(result.scrollHeight <= result.clientHeight + 2, `${label}: fits one page ${JSON.stringify(result)}`);
    for (const box of result.buttons) {
      assert.ok(box.width >= 44 && box.height >= 44, `${label}: 44px target ${box.label}`);
      assert.ok(box.left >= 0 && box.right <= result.width + 1, `${label}: horizontal button fit`);
      if (noScroll) assert.ok(box.top >= 0 && box.bottom <= result.height + 1, `${label}: button in viewport`);
    }
    for (const text of result.texts) assert.ok(text.scrollWidth <= text.clientWidth + 2, `${label}: text wraps ${text.text}`);
  }
  try {
    await page.goto(origin); await welcome().waitFor(); await expectMessage(1);
    assert.equal(await page.locator('.daily-rewards-page').count(), 0, 'first visit opens welcome, not the calendar');
    await button('Claim rewards').click(); await closeQuests();
    assert.deepEqual((await stored()).wallet, rewardsForLogin(1));
    await page.reload(); await button('Play Duel').waitFor();
    assert.equal(await welcome().count(), 0, 'no repeated welcome on same-day reload');
    await page.locator('.daily-menu-control').click();
    await page.locator('.daily-rewards-page .daily-long-track').waitFor();
    assert.equal(await page.locator('.daily-long-track > li').count(), 30, 'full calendar stays available from menu');
    await button('Back to main menu').click();

    now += 86400000; await page.clock.setFixedTime(new Date(now)); await page.reload();
    await welcome().waitFor(); await expectMessage(2);
    await button('Close daily welcome').click(); await closeQuests();
    assert.equal(Object.keys((await stored()).daily.claims).length, 1, 'dismissal does not claim rewards');
    await page.reload(); await button('Play Duel').waitFor();
    assert.equal(await welcome().count(), 0, 'dismissed welcome persists');

    now += 3 * 86400000; await page.clock.setFixedTime(new Date(now)); await page.reload();
    await welcome().waitFor(); await expectMessage(3);
    assert.equal((await stored()).daily.loginDayIds.length, 3, 'missed days preserve accumulated visits');
    await button('Claim rewards 2x').click(); await closeQuests();
    assert.deepEqual((await stored()).wallet, { hint: 1, shuffle: 2, freeze: 2, eagle: 0 }, '2x pays outstanding rewards once');
    await page.reload(); await button('Play Duel').waitFor();
    assert.deepEqual((await stored()).wallet, { hint: 1, shuffle: 2, freeze: 2, eagle: 0 }, 'reload cannot duplicate claim');
    await page.locator('.quests-menu-control').click();
    assert.equal(await button('OK').count(), 0, 'main-menu Daily Quests hides the login action');
    await button('Back to main menu').click();
    let resume = reduceProgression(beforeLogin(1), { type: 'login', now });
    resume = reduceProgression(resume, { type: 'daily-presented', now });
    await page.evaluate(state => localStorage.setItem('porcelain:progression', JSON.stringify(state)), resume);
    await page.reload(); await closeQuests();
    assert.equal(await welcome().count(), 0, 'unfinished login sequence resumes directly at quests with OK');
    console.log(`PASS ${kind}: welcome → quests → menu; same-day suppression; next/missed days; calendar access; 1x/2x receipts`);
    if (process.argv.includes('--flow-only')) return;

    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const day of [3,7,30]) {
        await showDay(day); await expectMessage(day); await fit(`${width}x${height} day ${day}`);
        assert.equal(await welcome().locator('li[aria-current="step"]').count(), 1, 'one current day');
        if (day === 3 || (day === 7 && width === 320)) await page.screenshot({ path: path.join(output, `${kind}-${width}x${height}-day${day}.png`) });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await showDay(8); assert.ok((await welcome().locator('li[aria-current="step"]').innerText()).includes('8'), 'next week advances accumulated day');
    await showDay(30, true); await fit('accumulated unclaimed rewards');
    await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.daily-welcome-page *')].filter(node => node.namespaceURI === 'http://www.w3.org/1999/xhtml' && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()));
      const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node, i) => node.style.fontSize = sizes[i] * 1.25 + 'px');
    });
    await fit('125% text', false);
    await button('Claim rewards').scrollIntoViewIfNeeded(); assert.ok(await button('Claim rewards').isVisible());
    await page.setViewportSize({ width: 320, height: 568 });
    await showDay(1030); await expectMessage(1030); await fit('four-digit journey with long greeting', false);
    assert.deepEqual(errors, []);
    console.log(`PASS ${kind}: ${sizes.length * 3} responsive reward layouts, week rollover, backlog, 125% text`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
