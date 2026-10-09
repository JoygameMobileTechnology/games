/* Production daily-welcome motion, tested through an isolated in-memory route.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/daily-welcome-motion-check.cjs [--webkit]
 * WAAPI seeks make sequence checks independent of machine/rendering speed.
 */
const assert = require('node:assert/strict');
const kind = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const near = (actual, expected, label, tolerance = .002) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} ≈ ${expected}`);

(async () => {
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[kind].launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  const source = await (await page.request.get(`${origin}/src/main.jsx`)).text();
  const react = source.match(/"([^"\n]*\/react\.js\?[^"\n]*)"/)[1];
  const reactDom = source.match(/"([^"\n]*\/react-dom_client\.js\?[^"\n]*)"/)[1];
  await page.route('**/__daily-welcome-motion', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div><script type="module">
    import React from ${JSON.stringify(react)};
    import ReactDOM from ${JSON.stringify(reactDom)};
    import '/src/style.css'; import '/src/fullscreen-board.css'; import '/src/remake.css'; import '/src/phone-ui.css';
    import { DailyWelcomePage } from '/src/daily-welcome-page.jsx';
    import { createProgression, reduceProgression } from '/src/progression.js';
    const now = Date.parse('2026-10-10T12:00:00Z'), root = ReactDOM.createRoot(document.getElementById('fixture'));
    let mount = 0, revision = 0, props = {}, progression;
    window.fixtureClicks = { claim: 0, double: 0, close: 0 };
    const render = () => root.render(React.createElement('div', { className: 'remake', 'data-fixture-revision': String(++revision) },
      React.createElement(DailyWelcomePage, { key: mount, progression, now, ...props,
        onClose: () => window.fixtureClicks.close++, onClaim: () => window.fixtureClicks.claim++, onDoubleClaim: () => window.fixtureClicks.double++ })));
    window.fixtureShow = (options = {}) => {
      const { day = 3, ...rest } = options;
      props = rest; progression = createProgression({ seed: 33 }); mount++;
      for (let index = 1; index <= day; index++) {
        const at = now - (day - index) * 86400000;
        progression = reduceProgression(progression, { type: 'login', now: at });
        if (index < day) progression = reduceProgression(progression, { type: 'daily-claim', eventId: 'fixture-prior-' + index, now: at });
      }
      render(); return revision;
    };
    window.fixturePatch = patch => { props = { ...props, ...patch }; render(); return revision; };
    window.fixtureClaim = () => { progression = reduceProgression(progression, { type: 'daily-claim', eventId: 'fixture-claim', now }); render(); return revision; };
    window.fixtureShow();
  </script></body></html>` }));
  const button = name => page.getByRole('button', { name, exact: true });
  const waitRevision = revision => page.waitForFunction(revision => document.querySelector('[data-fixture-revision]')?.dataset.fixtureRevision === String(revision), revision);
  async function show(props = {}) { await waitRevision(await page.evaluate(props => window.fixtureShow(props), props)); }
  async function patch(props) { await waitRevision(await page.evaluate(props => window.fixturePatch(props), props)); }
  async function holdAndSeek(time) {
    return page.evaluate(time => {
      const root = document.querySelector('.daily-welcome-page');
      window.heldAnimations = root.getAnimations({ subtree: true });
      for (const animation of window.heldAnimations) { animation.pause(); animation.currentTime = time; }
      const line = root.querySelector('.daily-welcome-track-line > span');
      const stamp = root.querySelector('.is-current .daily-welcome-step');
      const rewards = [...root.querySelectorAll('.daily-welcome-rewards .reward-item')];
      const transform = node => { const css = getComputedStyle(node); return css.transform === 'none' ? 1 : new DOMMatrix(css.transform).a; };
      return { scale: transform(line), stamp: transform(stamp), rewardOpacity: rewards.map(node => Number(getComputedStyle(node).opacity)), animations: window.heldAnimations.map(a => ({ name: a.animationName, ...a.effect.getTiming() })) };
    }, time);
  }
  async function finalPresentation(label) {
    const state = await page.evaluate(() => {
      const root = document.querySelector('.daily-welcome-page');
      return { animations: root.getAnimations({ subtree: true }).filter(a => a.playState !== 'finished').length,
        line: new DOMMatrix(getComputedStyle(root.querySelector('.daily-welcome-track-line > span')).transform).a,
        rewards: [...root.querySelectorAll('.daily-welcome-rewards .reward-item')].map(node => Number(getComputedStyle(node).opacity)),
        halo: Number(getComputedStyle(root.querySelector('.daily-welcome-medallion'), '::after').opacity),
        stamp: getComputedStyle(root.querySelector('.is-current .daily-welcome-step')).transform };
    });
    assert.equal(state.animations, 0, `${label}: no active animation`);
    near(state.line, 2 / 6, `${label}: final day-three progress`);
    assert.ok(state.rewards.every(opacity => opacity === 1), `${label}: rewards visible immediately`);
    assert.equal(state.halo, 0, `${label}: no frozen halo`);
    assert.equal(state.stamp, 'none', `${label}: current-day stamp at final size`);
  }
  try {
    await page.goto(`${origin}/__daily-welcome-motion`);
    await page.locator('.daily-welcome-page').waitFor();
    const start = await holdAndSeek(0);
    near(start.scale, 1 / 6, 'Day 3 starts at previous-day progress');
    assert.ok(start.stamp < 1, 'current-day stamp starts small');
    assert.ok(start.rewardOpacity.every(opacity => opacity === 0), 'rewards start before their reveal');
    for (const name of ['daily-welcome-progress', 'daily-welcome-stamp', 'daily-welcome-seal', 'daily-welcome-halo', 'daily-welcome-reveal']) assert.ok(start.animations.some(animation => animation.name === name), `${name} is present`);
    assert.ok(await button('Claim rewards').isEnabled(), 'normal claim is usable before animation starts');
    assert.ok(await button('Claim rewards 2x').isEnabled(), 'double claim is usable before animation starts');
    await button('Claim rewards').click(); await button('Claim rewards 2x').click();
    assert.deepEqual(await page.evaluate(() => ({ claim: window.fixtureClicks.claim, double: window.fixtureClicks.double })), { claim: 1, double: 1 }, 'both claims work while presentation is held at its first frame');
    const middle = await holdAndSeek(450), finish = await holdAndSeek(1600);
    assert.ok(middle.scale > 1 / 6 && middle.scale < 2 / 6, 'progress travels between days');
    near(finish.scale, 2 / 6, 'progress finishes at today');
    near(finish.stamp, 1, 'stamp settles at normal size');
    assert.ok(finish.rewardOpacity.every(opacity => opacity === 1), 'all rewards settle fully visible');

    await show({ day: 7 });
    const sequence = await holdAndSeek(780);
    assert.equal(sequence.rewardOpacity.length, 4, 'weekly day seven displays four rewards');
    assert.ok(sequence.rewardOpacity[0] > 0 && sequence.rewardOpacity.slice(1).every(opacity => opacity === 0), 'first reward reveals ahead of later rewards');
    const afterSecond = await holdAndSeek(880);
    assert.ok(afterSecond.rewardOpacity[0] > afterSecond.rewardOpacity[1] && afterSecond.rewardOpacity[1] > 0 && afterSecond.rewardOpacity[2] === 0, 'second reward follows without revealing later rewards early');

    await show({ day: 3, paused: true });
    const frozen = await page.evaluate(async () => {
      const animations = document.querySelector('.daily-welcome-page').getAnimations({ subtree: true });
      for (const animation of animations) animation.currentTime = 300;
      const before = animations.map(a => a.currentTime);
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      return { before, after: animations.map(a => a.currentTime), states: animations.map(a => a.playState) };
    });
    assert.ok(frozen.states.every(state => state === 'paused'), 'paused prop pauses all CSS animations');
    frozen.after.forEach((time, index) => near(time, frozen.before[index], 'paused animation holds its timeline', .1));
    await patch({ paused: false });
    const resumed = await page.evaluate(async () => {
      const animation = document.querySelector('.daily-welcome-track-line > span').getAnimations()[0];
      const before = animation.currentTime;
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      return { before, after: animation.currentTime, state: animation.playState };
    });
    assert.equal(resumed.state, 'running', 'resume restarts the held CSS timeline');
    assert.ok(resumed.after > resumed.before, 'resume advances from held progress');

    await show({ day: 3, gentle: true }); await finalPresentation('gentle setting');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await show({ day: 3 }); await finalPresentation('system reduced motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await show({ day: 3, gentle: true, adState: 'loading' });
    assert.ok(await button('Claim rewards').isDisabled()); assert.ok(await button('Please wait…').isDisabled());
    assert.match(await page.locator('.daily-welcome-claim-state').textContent(), /Preparing/);
    await patch({ adState: 'unavailable' });
    assert.ok(await button('Claim rewards').isEnabled()); assert.ok(await button('Claim rewards 2x').isDisabled());
    assert.match(await page.locator('.daily-welcome-claim-state').textContent(), /Standard rewards are ready/);
    for (const adState of ['failed', 'cancelled']) {
      await patch({ adState });
      assert.ok(await button('Claim rewards').isEnabled()); assert.ok(await button('Claim rewards 2x').isEnabled());
      assert.match(await page.locator('.daily-welcome-claim-state').textContent(), /You can still claim/);
    }
    await patch({ adState: 'idle' });
    const rewardText = await page.locator('.daily-welcome-rewards .reward-item').allTextContents();
    await waitRevision(await page.evaluate(() => window.fixtureClaim()));
    assert.ok(await button('Claimed').isDisabled()); assert.ok(await button('Claim rewards 2x').isDisabled());
    assert.deepEqual(await page.locator('.daily-welcome-rewards .reward-item').allTextContents(), rewardText, 'claimed receipt retains the same actual reward');
    assert.deepEqual(errors, []);
    console.log(`PASS ${kind}: deterministic progress/stamp/reward sequence; immediate claims; pause/resume; gentle/reduced final states; ad errors and claimed receipt`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
