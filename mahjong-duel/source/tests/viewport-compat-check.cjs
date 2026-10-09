/* Emulates missing CSS capabilities in isolated contexts; this is not an old-OS test.
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/viewport-compat-check.cjs
 * Optional --chromium or --webkit runs only that browser. No source styles are modified.
 */
const assert = require('node:assert/strict');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const browsers = process.argv.includes('--webkit') ? ['webkit'] : process.argv.includes('--chromium') ? ['chromium'] : ['chromium', 'webkit'];
const modes = ['native', 'no-container-units', 'no-viewport-or-container-units'];

async function emulateStyles(page, mode) {
  if (mode === 'native') return;
  await page.evaluate(mode => {
    const unsupported = mode === 'no-container-units' ? /cqw|cqh/ : /dvh|cqw|cqh/;
    const walk = owner => {
      for (let i = 0; i < owner.cssRules.length; i++) {
        let rule = owner.cssRules[i];
        if (rule instanceof CSSSupportsRule && unsupported.test(rule.conditionText)) {
          // Activate the real fallback at its original cascade position.
          if (!rule.conditionText.startsWith('not ')) throw new Error(`Unhandled supports condition: ${rule.conditionText}`);
          const text = rule.cssText.replace(/^@supports[^\{]+/, '@supports (display: block) ');
          owner.deleteRule(i); owner.insertRule(text, i); rule = owner.cssRules[i];
        }
        if (rule.style) for (const property of [...rule.style]) {
          const value = rule.style.getPropertyValue(property);
          // An unavailable unit inside an unused var() fallback is still valid.
          if (unsupported.test(value) && !value.includes('var(--viewport-height')) rule.style.removeProperty(property);
        }
        if (rule.cssRules) walk(rule);
      }
    };
    for (const sheet of document.styleSheets) walk(sheet);
  }, mode);
}

async function checkTable(page, mode, width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForFunction(({ height }) => {
    const board = document.querySelector('.board-frame')?.getBoundingClientRect();
    const world = document.querySelector('.world')?.getBoundingClientRect();
    return board?.width > 100 && board.height > 100 && board.bottom <= height + 1
      && Math.abs(world.height - height) < 1;
  }, { height });
  const state = await page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { width: r.width, height: r.height, bottom: r.bottom }; };
    return { world: rect('.world'), board: rect('.board-frame'), tools: rect('.game-tools'),
      viewportHeight: document.documentElement.style.getPropertyValue('--viewport-height'),
      boardWidth: document.querySelector('.board-space').style.getPropertyValue('--board-width-fallback'),
      overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.ok(Math.abs(state.world.height - height) < 1, 'game fits viewport height');
  assert.ok(state.tools.bottom <= height + 1, 'boosters remain visible');
  assert.equal(state.overflow, false, 'no horizontal overflow');
  assert.equal(Boolean(state.boardWidth), mode !== 'native', 'native sizing stays untouched');
  assert.equal(state.viewportHeight, mode === 'no-viewport-or-container-units' ? `${height}px` : '', 'height fallback activates only when needed');
  return state;
}

(async () => {
  for (const name of browsers) {
    const browser = await playwright[name].launch({ headless: true });
    try {
      for (const mode of modes) {
        const context = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
        await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
        try {
          await context.addInitScript(mode => {
            localStorage.setItem('porcelain:gentle', 'true'); localStorage.setItem('porcelain:sound', 'false');
            if (mode === 'native') return;
            const supports = CSS.supports.bind(CSS);
            const unsupported = mode === 'no-container-units' ? /cqw|cqh/ : /dvh|cqw|cqh/;
            CSS.supports = (...args) => unsupported.test(args.join(' ')) ? false : supports(...args);
          }, mode);
          const page = await context.newPage(), errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(origin); await page.evaluate(() => document.fonts.ready);
          await emulateStyles(page, mode);
          await page.getByRole('button', { name: 'Play', exact: true }).click();
          await page.locator('.game-board').waitFor();
          await checkTable(page, mode, 375, 667);
          await checkTable(page, mode, 667, 375);
          await checkTable(page, mode, 375, 520);
          await page.getByRole('button', { name: 'Pause game', exact: true }).click();
          await page.getByRole('button', { name: 'Save & return home', exact: true }).click();
          await page.getByRole('button', { name: 'Collection', exact: true }).click();
          const dialog = page.getByRole('dialog', { name: 'Collection', exact: true });
          await dialog.waitFor();
          assert.equal(await page.getByRole('group', { name: 'Collection ruleset' }).count(), 0, 'Collection has no separate edition switch');
          const bounds = await dialog.boundingBox();
          assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 521, 'Collection page fits resized viewport');
          await page.getByRole('button', { name: 'Back to main menu', exact: true }).click();
          await page.getByRole('button', { name: /^Continue duel/ }).click();
          await page.locator('.game-board').waitFor();
          await checkTable(page, mode, 375, 667);
          assert.deepEqual(errors, [], 'no browser exceptions');
          console.log(`PASS ${name}: ${mode}, rotation, reduced viewport, binder and resume`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
