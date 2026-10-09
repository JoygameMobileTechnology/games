/* Menu-to-duel transition checks through the real theme-selection flow.
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/menu-transition-check.cjs [--webkit] [--autumn-only|--night-only]
 * Uses fresh browser contexts. WAAPI pauses only the opening effect for visual samples;
 * the final completion check lets the actual CSS animation finish normally.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const output = path.resolve(__dirname, '../tmp/menu-transition-qa');
const scenes = [
  { id: 'bamboo', previous: 'lantern-night', random: 0 },
  { id: 'lantern-night', previous: 'bamboo', random: 0 },
  { id: 'autumn-daylight', previous: 'bamboo', random: .999 },
].filter(scene => (!process.argv.includes('--autumn-only') || scene.id === 'autumn-daylight')
  && (!process.argv.includes('--night-only') || scene.id === 'lantern-night'));
const sizes = [
  { width: 320, height: 568 }, { width: 390, height: 844 },
  { width: 844, height: 390 }, { width: 1024, height: 768 },
  { width: 320, height: 844 },
];
const transitionSelector = '.menu-scene-transition, .door-transition';
const homeSceneSelector = '.menu-scene:not(.menu-scene-transition)';
const button = (page, name) => page.getByRole('button', { name, exact: true });
const near = (actual, expected, message, tolerance = 1) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch({ headless: true });
  const checks = [], errors = [];
  let activePage;
  const report = value => { checks.push(value); console.log(`PASS ${browserName}: ${value.label}`); };
  const captureFailure = page => page.screenshot({ path: path.join(output, `${browserName}-failure.png`) }).catch(() => {});

  async function newPage(seed, viewport, preference = 'normal') {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true,
      reducedMotion: preference === 'system' ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
    await context.addInitScript(({ seed, preference }) => {
      localStorage.setItem('porcelain:menuBackground', JSON.stringify(seed.previous));
      localStorage.setItem('porcelain:sound', 'false');
      localStorage.setItem('porcelain:gentle', String(preference === 'gentle'));
      Math.random = () => seed.random;
    }, { seed, preference });
    const page = await context.newPage(); activePage = page; page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(origin);
    await button(page, 'Claim rewards').click();
    await page.getByRole('heading', { name: 'Daily Quests', exact: true }).waitFor();
    await button(page, 'Back to main menu').click();
    await home(page, seed.id);
    return { context, page };
  }

  async function home(page, expected) {
    await page.waitForFunction(() => !document.querySelector('.progression-page, .sheet-backdrop, .game-board'));
    await button(page, 'Play').waitFor();
    await page.waitForFunction(selector => {
      const image = document.querySelector(`${selector} .menu-scene-art`);
      return image?.complete && image.naturalWidth > 0;
    }, homeSceneSelector);
    assert.equal(await page.locator(homeSceneSelector).getAttribute('data-menu-background'), expected);
    assert.equal(await page.locator('.menu-scene-effects, .menu-scene-flash').count(), 0, 'opening effects never persist on the menu');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:menuBackground'))), expected);
  }

  async function chooseTheme(page) {
    await button(page, 'Play').click();
    await page.getByRole('heading', { name: 'Choose a theme', exact: true }).waitFor();
    assert.equal(await page.locator(transitionSelector).count(), 0, 'home Play opens theme selection before the transition');
    assert.equal(await page.locator('.game-board').count(), 0, 'no board is dealt before the final Play');
    await page.locator('.theme-choice-play').waitFor();
  }

  async function findOpponent(page) {
    await page.locator('.theme-choice-play').click();
    await page.locator('.matchmaking-page.is-searching').waitFor();
    assert.equal(await page.locator(transitionSelector).count(), 0, 'search completes before the menu opening begins');
    assert.equal(await page.locator('.game-board').count(), 0, 'search does not deal a board');
    await page.locator('.matchmaking-page.is-found').waitFor();
    assert.equal(await page.locator(transitionSelector).count(), 0, 'opponent reveal comes before the menu opening');
    await page.locator('.matchmaking-page').waitFor({ state: 'detached' });
  }

  async function observeOpening(page, pause) {
    await page.evaluate(({ transitionSelector, pause }) => {
      window.__menuOpening?.observer.disconnect();
      window.__menuOpening = { seen: [], nodes: new WeakSet(), animations: [], ended: [] };
      const capture = () => {
        for (const node of document.querySelectorAll(transitionSelector)) {
          if (window.__menuOpening.nodes.has(node)) continue;
          window.__menuOpening.nodes.add(node);
          window.__menuOpening.seen.push(node.className);
          node.addEventListener('animationend', event => window.__menuOpening.ended.push({ name: event.animationName, own: event.target === node }));
          if (pause && node.matches('.menu-scene-transition')) {
            window.__menuOpening.animations = node.getAnimations({ subtree: true });
            for (const animation of window.__menuOpening.animations) { animation.pause(); animation.currentTime = 0; }
          }
        }
      };
      window.__menuOpening.observer = new MutationObserver(capture);
      window.__menuOpening.observer.observe(document.body, { childList: true, subtree: true });
      capture();
    }, { transitionSelector, pause });
  }

  async function boardAndReturn(page, expected) {
    await page.locator(transitionSelector).waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.querySelectorAll('.game-tile').length === 60);
    assert.equal(await page.locator(homeSceneSelector).count(), 0, 'menu artwork leaves the game');
    assert.equal(await page.locator('.theme-select-page').count(), 0, 'theme selection closes after starting');
    assert.equal(await page.locator('.game-tile[data-face-up="true"]').count(), 0, 'a fresh full board remains face down');
    const paused = page.getByRole('dialog', { name: 'Paused', exact: true });
    if (!(await paused.count())) await button(page, 'Pause game').click();
    await paused.waitFor();
    await button(page, 'Leave duel').click();
    await page.getByRole('dialog', { name: 'Leave duel?', exact: true }).waitFor();
    await button(page, 'Leave duel').click();
    await home(page, expected);
  }

  async function sample(page, ms) {
    return page.evaluate(ms => {
      for (const animation of window.__menuOpening.animations) animation.currentTime = ms;
      const root = document.querySelector('.menu-scene-transition');
      const capture = selector => {
        const node = root.querySelector(selector);
        if (!node) return null;
        const style = getComputedStyle(node);
        return { opacity: Number(style.opacity), transform: style.transform, filter: style.filter, rect: node.getBoundingClientRect().toJSON() };
      };
      const shadow = root.querySelector('.menu-moon-shadow'), disc = root.querySelector('.menu-moon-disc circle');
      const glowShape = root.querySelector('.menu-moon-light-shape');
      const circleGeometry = node => ({ x: node.cx.baseVal.value, y: node.cy.baseVal.value, radius: node.r.baseVal.value });
      const nativeFilter = selector => {
        const reference = root.querySelector(selector)?.getAttribute('filter');
        const filter = reference && document.getElementById(reference.match(/#([^)'"\s]+)/)?.[1]);
        if (!filter) return null;
        return {
          reference, units: filter.getAttribute('filterUnits'),
          bounds: Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number(filter.getAttribute(key))])),
          blurs: [...filter.querySelectorAll('feGaussianBlur')].map(node => ({
            input: node.getAttribute('in'), spread: Number(node.getAttribute('stdDeviation')), result: node.getAttribute('result'),
          })),
          mergedInputs: [...filter.querySelectorAll('feMergeNode')].map(node => node.getAttribute('in')),
        };
      };
      // WebKit can report CSS `none` for a static SVG transform attribute.
      const shadowTransform = shadow ? shadow.transform.baseVal.consolidate()?.matrix
        || new DOMMatrixReadOnly(getComputedStyle(shadow).transform) : null;
      return { time: ms, opacity: Number(getComputedStyle(root).opacity),
        flash: capture('.menu-scene-flash'), sunHalo: capture('.menu-sun-halo'), sunCore: capture('.menu-sun-core'),
        moonDisc: capture('.menu-moon-disc'), moonGlow: capture('.menu-moon-glow'), moonRadiance: capture('.menu-moon-radiance'),
        moonEmission: glowShape ? {
          glowMask: glowShape.getAttribute('mask'),
          glowSource: circleGeometry(glowShape.querySelector('circle')),
          coreSource: circleGeometry(disc),
          glowSourceAnimations: glowShape.getAnimations({ subtree: true }).length,
          glowFilter: nativeFilter('.menu-moon-glow'), coreFilter: nativeFilter('.menu-moon-radiance'),
          renderedCircles: [...root.querySelectorAll('.menu-scene-effects circle')].filter(node => !node.closest('defs')).map(node => ({
            geometry: circleGeometry(node), mask: node.closest('[mask]')?.getAttribute('mask') || null,
          })),
        } : null,
        moonPhase: disc && shadow ? {
          shadowDistance: Math.hypot(shadow.cx.baseVal.value + shadowTransform.e - disc.cx.baseVal.value, shadow.cy.baseVal.value + shadowTransform.f - disc.cy.baseVal.value),
          shadowRadius: shadow.r.baseVal.value, discRadius: disc.r.baseVal.value,
          shadowTransform: { a: shadowTransform.a, b: shadowTransform.b, c: shadowTransform.c, d: shadowTransform.d, e: shadowTransform.e, f: shadowTransform.f },
          shadowCenter: { x: shadow.cx.baseVal.value, y: shadow.cy.baseVal.value },
          discCenter: { x: disc.cx.baseVal.value, y: disc.cy.baseVal.value },
          mask: root.querySelector('.menu-moon-disc').getAttribute('mask'),
          shadowAnimations: shadow.getAnimations().length,
        } : null };
    }, ms);
  }

  async function alignment(page) {
    const result = await page.locator('.menu-scene-transition').evaluate(root => {
      const image = root.querySelector('.menu-scene-art'), effects = root.querySelector('.menu-scene-effects');
      const rect = image.getBoundingClientRect(), matrix = effects.getScreenCTM(), viewBox = effects.viewBox.baseVal;
      const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
      return { viewport: { width: innerWidth, height: innerHeight }, image: { width: image.naturalWidth, height: image.naturalHeight, rect: rect.toJSON(), objectFit: getComputedStyle(image).objectFit },
        viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height },
        matrix: { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, e: matrix.e, f: matrix.f },
        expected: { scale, x: rect.x + (rect.width - image.naturalWidth * scale) / 2, y: rect.y + (rect.height - image.naturalHeight * scale) / 2 },
        preserveAspectRatio: effects.getAttribute('preserveAspectRatio'), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    assert.equal(result.image.objectFit, 'cover');
    assert.equal(result.viewBox.width, result.image.width); assert.equal(result.viewBox.height, result.image.height);
    near(result.matrix.a, result.expected.scale, 'SVG horizontal scale matches the image', .001);
    near(result.matrix.d, result.expected.scale, 'SVG vertical scale matches the image', .001);
    near(result.matrix.e, result.expected.x, 'SVG horizontal crop matches the image');
    near(result.matrix.f, result.expected.y, 'SVG vertical crop matches the image');
    assert.ok(result.overflow <= 1, 'effect does not cause horizontal overflow');
    return result;
  }

  async function pauseAndResume(page) {
    // Model a backgrounded tab through the browser visibility event, without
    // changing the app's state or replacing its animation/timer implementations.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.locator('.menu-scene-transition.is-paused').waitFor();
    const clocks = () => page.locator('.menu-scene-transition').evaluate(async node => {
      const animations = node.getAnimations({ subtree: true }).filter(animation => animation.effect.getTiming().duration === 1650);
      // CSS pause state can arrive before WebKit settles its compositor clock.
      await Promise.all(animations.map(animation => animation.ready));
      return animations.map(animation => ({ time: animation.currentTime, state: animation.playState }));
    });
    const paused = await clocks();
    assert.ok(paused.length >= 5 && paused.every(animation => animation.state === 'paused'), `backgrounding pauses every opening animation: ${JSON.stringify(paused)}`);
    await page.waitForTimeout(120);
    assert.deepEqual(await clocks(), paused, 'backgrounded transition clocks remain frozen');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => !document.querySelector('.menu-scene-transition.is-paused'));
    return { animations: paused.length, frozenForMs: 120 };
  }

  try {
    for (const seed of scenes) {
      for (const viewport of seed.id === 'bamboo' ? [sizes[1]] : sizes) {
        const { context, page } = await newPage(seed, viewport);
        try {
          await chooseTheme(page); await observeOpening(page, seed.id !== 'bamboo');
          await findOpponent(page);
          if (seed.id === 'bamboo') {
            await page.locator('.door-transition').waitFor();
            assert.equal(await page.locator('.door-transition .door-half').count(), 2);
            assert.equal(await page.locator('.menu-scene-transition').count(), 0, 'bamboo retains the sliding doors');
            await boardAndReturn(page, seed.id);
            report({ label: 'bamboo retains its two sliding doors and returns to the same menu scene' });
            continue;
          }
          const transition = page.locator('.menu-scene-transition');
          await transition.waitFor();
          assert.equal(await transition.getAttribute('data-menu-background'), seed.id);
          assert.equal(await page.locator('.door-transition').count(), 0, 'alternate backgrounds never show bamboo doors');
          const timing = await transition.evaluate(node => node.getAnimations().map(animation => ({ duration: animation.effect.getTiming().duration, iterations: animation.effect.getTiming().iterations })));
          assert.ok(timing.some(value => value.duration === 1650 && value.iterations === 1), 'the entry overlay owns one 1.65-second animation');
          const geometry = { start: await alignment(page) };
          const early = await sample(page, 0);
          const crescent = seed.id === 'lantern-night' ? await sample(page, 800) : null;
          const glow = await sample(page, 1030);
          geometry.glow = await alignment(page);
          const flash = await sample(page, 1220), exit = await sample(page, 1580);
          assert.ok(early.flash.opacity <= .01 && glow.flash.opacity < .35, 'local light builds before the fullscreen flash');
          assert.ok(flash.flash.opacity >= .9, 'the flash reaches full brightness');
          assert.ok(exit.opacity < .6, 'the scene fades away after the flash');
          assert.ok(flash.flash.rect.left <= 1 && flash.flash.rect.top <= 1 && flash.flash.rect.right >= viewport.width - 1 && flash.flash.rect.bottom >= viewport.height - 1, `the flash covers the entire viewport: ${JSON.stringify(flash.flash.rect)}`);
          if (seed.id === 'autumn-daylight') {
            assert.ok(glow.sunHalo && glow.sunCore && !glow.moonDisc);
            assert.ok(glow.sunHalo.rect.width > early.sunHalo.rect.width * 1.2, 'sunlight expands out of the painted sun');
            assert.ok(glow.sunHalo.opacity > early.sunHalo.opacity, 'sunlight grows brighter before the flash');
            // Independently measured from the artwork: the bright sun behind the
            // far-left leaves is (66,647), not the separate lower disc (276,758).
            // Compare rendered centers so this also catches drift while panning
            // or scaling the effect, rather than only matching the SVG viewport.
            for (const [phase, frame] of [['start', early], ['glow', glow]]) {
              const matrix = geometry[phase].matrix;
              const paintedSun = { x: matrix.a * 66 + matrix.c * 647 + matrix.e, y: matrix.b * 66 + matrix.d * 647 + matrix.f };
              for (const [part, light] of [['core', frame.sunCore], ['halo', frame.sunHalo]]) {
                near(light.rect.x + light.rect.width / 2, paintedSun.x, `${phase} sun ${part} stays on the far-left painted sun horizontally`);
                near(light.rect.y + light.rect.height / 2, paintedSun.y, `${phase} sun ${part} stays on the far-left painted sun vertically`);
              }
            }
          } else {
            assert.ok(glow.moonDisc && glow.moonGlow && !glow.sunCore);
            assert.ok(glow.moonDisc.opacity >= .9 && glow.moonDisc.opacity > early.moonDisc.opacity, 'the crescent core brightens before the flash');
            assert.ok(early.moonPhase.mask?.startsWith('url('), 'the moon core uses its crescent mask');
            for (const [phase, frame] of [['start', early], ['crescent', crescent], ['glow', glow], ['flash', flash], ['exit', exit]]) {
              const shape = frame.moonPhase;
              assert.ok(shape.shadowDistance > Math.abs(shape.shadowRadius - shape.discRadius)
                && shape.shadowDistance < shape.shadowRadius + shape.discRadius, `${phase}: the shadow still cuts a visible crescent from the disc`);
              assert.deepEqual(shape, early.moonPhase, `${phase}: crescent geometry remains fixed throughout the opening`);
              assert.equal(shape.shadowAnimations, 0, `${phase}: the crescent mask never waxes into a full moon`);
              const emission = frame.moonEmission;
              assert.ok(emission, `${phase}: the glow has a masked crescent source`);
              assert.equal(emission.glowMask, shape.mask, `${phase}: the glow uses the same mask as the illuminated core`);
              assert.deepEqual(emission.glowSource, emission.coreSource, `${phase}: glow and core use identical source geometry`);
              assert.deepEqual(emission, early.moonEmission, `${phase}: the glow source stays fixed while its light spreads`);
              assert.equal(emission.glowSourceAnimations, 0, `${phase}: the source itself never scales or moves`);
              assert.ok(emission.renderedCircles.length >= 2 && emission.renderedCircles.every(circle => circle.mask === shape.mask
                && JSON.stringify(circle.geometry) === JSON.stringify(emission.coreSource)), `${phase}: no separate radial disc emits behind the moon`);
              assert.equal(frame.moonGlow.transform, 'none', `${phase}: the crescent glow spreads without scaling or translating its source`);
              for (const filter of [emission.glowFilter, emission.coreFilter]) {
                assert.ok(filter && filter.units === 'userSpaceOnUse', `${phase}: crescent radiance uses a native SVG filter`);
                assert.ok(filter.blurs.length && filter.blurs.every(blur => blur.input === 'SourceGraphic' && blur.spread > 0), `${phase}: every blur emits from the masked source`);
                assert.ok(filter.blurs.every(blur => filter.mergedInputs.includes(blur.result)), `${phase}: the rendered filter includes its blurred light`);
                const reach = emission.coreSource.radius + Math.max(...filter.blurs.map(blur => blur.spread)) * 3;
                assert.ok(filter.bounds.x <= emission.coreSource.x - reach && filter.bounds.y <= emission.coreSource.y - reach
                  && filter.bounds.x + filter.bounds.width >= emission.coreSource.x + reach
                  && filter.bounds.y + filter.bounds.height >= emission.coreSource.y + reach, `${phase}: native filter bounds preserve the visible spread`);
              }
              const spreads = emission.glowFilter.blurs.map(blur => blur.spread).sort((a, b) => a - b);
              assert.ok(spreads.length >= 2 && spreads.at(-1) > spreads[0], `${phase}: the crescent emits a close edge glow and a wider bloom`);
              assert.ok(emission.coreFilter.mergedInputs.includes('SourceGraphic'), `${phase}: the luminous rim preserves the sharp crescent core`);
            }
            assert.ok(glow.moonGlow.opacity > crescent.moonGlow.opacity && crescent.moonGlow.opacity > early.moonGlow.opacity, 'the crescent light grows brighter before the flash');
          }
          const light = glow.sunCore || glow.moonDisc;
          const lightCenter = { x: light.rect.x + light.rect.width / 2, y: light.rect.y + light.rect.height / 2 };
          assert.ok(lightCenter.x > 0 && lightCenter.x < viewport.width && lightCenter.y > 0 && lightCenter.y < viewport.height, 'the focal light becomes visible even when landscape initially crops it out');
          for (const [phase, ms] of [['start', 0], ...(seed.id === 'lantern-night' && viewport.width === 390 ? [['crescent', 800]] : []), ['glow', 1030], ['flash', 1220]]) {
            await sample(page, ms);
            await page.screenshot({ path: path.join(output, `${browserName}-${seed.id}-${viewport.width}x${viewport.height}-${phase}.png`) });
          }
          await page.evaluate(() => { for (const animation of window.__menuOpening.animations) { animation.currentTime = 0; animation.play(); } });
          await boardAndReturn(page, seed.id);
          const ended = await page.evaluate(() => window.__menuOpening.ended);
          assert.ok(ended.some(event => event.own), 'the actual overlay animationend completes entry');
          let pause = null;
          if (viewport.width === 390) {
            // Use a fresh natural animation: imperative WAAPI pause/play overrides
            // CSS animation-play-state, so the sampled animation cannot prove this.
            await chooseTheme(page); await observeOpening(page, false);
            await findOpponent(page); await transition.waitFor();
            pause = await pauseAndResume(page);
            await boardAndReturn(page, seed.id);
          }
          report({ label: `${seed.id} ${viewport.width}×${viewport.height}: aligned light → flash → full 60-tile duel → same menu`, geometry, timing, samples: { early, crescent, glow, flash, exit }, pause, ended });
        } catch (error) { await captureFailure(page); throw error; }
        finally { await context.close(); }
      }
    }
    for (const preference of ['gentle', 'system']) {
      for (const seed of scenes) {
        const { context, page } = await newPage(seed, sizes[1], preference);
        try {
          await chooseTheme(page); await observeOpening(page, false); await findOpponent(page);
          await boardAndReturn(page, seed.id);
          assert.deepEqual(await page.evaluate(() => window.__menuOpening.seen), [], `${preference} motion skips opening effects entirely`);
          report({ label: `${preference} reduced motion skips ${seed.id} entry effects and starts a full duel` });
        } catch (error) { await captureFailure(page); throw error; }
        finally { await context.close(); }
      }
    }
    assert.deepEqual(errors, [], 'no runtime errors or failed local requests');
    fs.writeFileSync(path.join(output, `${browserName}-report.json`), JSON.stringify({ browser: browserName, checks, errors }, null, 2));
    console.log(JSON.stringify({ browser: browserName, passed: checks.length, errors }, null, 2));
  } catch (error) {
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(output, `${browserName}-failure.png`) }).catch(() => {});
    fs.writeFileSync(path.join(output, `${browserName}-failure.json`), JSON.stringify({ checks, errors, error: error.stack }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
