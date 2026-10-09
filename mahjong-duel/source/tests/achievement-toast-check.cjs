/* Isolated rendering of the production toast: FIFO, pause/replay/audio and hit testing.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/achievement-toast-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
(async () => {
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch();
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [];
  const output = path.resolve('tmp/progression-qa'); fs.mkdirSync(output, { recursive: true });
  page.on('pageerror', error => errors.push(error.message));
  const source = await (await page.request.get(`${origin}/src/main.jsx`)).text();
  const react = source.match(/"([^"\n]*\/react\.js\?[^"\n]*)"/)[1];
  const reactDom = source.match(/"([^"\n]*\/react-dom_client\.js\?[^"\n]*)"/)[1];
  await page.route('**/__achievement-toast-fixture', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#1f392f}#underlay{position:fixed;inset:0 0 auto;width:100%;height:100px}</style></head><body><button id="underlay" onclick="window.underlayClicks++">Underlying game action</button><div id="fixture"></div><script type="module">
    import React from ${JSON.stringify(react)};
    import ReactDOM from ${JSON.stringify(reactDom)};
    import { AchievementNotifications } from '/src/achievement-toast.jsx';
    window.audioStarts = 0; window.audioStops = 0; window.underlayClicks = 0; window.completedBatches = [];
    const parameter = () => ({setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}});
    window.AudioContext = class {
      state = 'running'; currentTime = 0; destination = {};
      createGain(){return{gain:parameter(),connect(){},disconnect(){}}}
      createOscillator(){return{frequency:parameter(),connect(){},disconnect(){},start(){window.audioStarts++},stop(at){if(at===undefined){window.audioStops++;this.onended?.()}}}}
    };
    const root = ReactDOM.createRoot(document.getElementById('fixture'));
    let properties = {batches:[], paused:false, sound:true, gentle:false};
    const render = () => root.render(React.createElement(AchievementNotifications, {...properties,onComplete(id){window.completedBatches.push(id);properties={...properties,batches:properties.batches.filter(batch=>batch.id!==id)};render()}}));
    window.toastControl = patch => {properties={...properties,...patch};render()};
    window.toastVisibility = hidden => {Object.defineProperty(document,'hidden',{configurable:true,value:hidden});document.dispatchEvent(new Event('visibilitychange'))};
    render(); window.fixtureReady = true;
  </script></body></html>` }));
  try {
    const now = new Date('2026-09-28T12:00:00Z'); await page.clock.install({ time: now }); await page.clock.pauseAt(now);
    await page.goto(`${origin}/__achievement-toast-fixture`);
    const advance = async ms => { await page.clock.runFor(ms); await page.evaluate(() => document.body.childElementCount); };
    for (let i = 0; i < 30 && !await page.evaluate(() => Boolean(window.fixtureReady)); i++) await advance(20);
    assert.equal(await page.evaluate(() => window.fixtureReady), true, JSON.stringify(errors));
    const patch = async value => { await page.evaluate(value => window.toastControl(value), value); await advance(20); };
    const active = () => page.locator('.achievement-toast-stage').getAttribute('data-achievement-batch');
    const first = { id: 'first', achievementIds: ['M013','M014','M014','M005','unknown'] };
    const second = { id: 'second', achievementIds: ['M015'] }, third = { id: 'third', achievementIds: ['M016'] };
    await patch({ batches: [first, second] });
    assert.equal(await active(), 'first'); assert.equal(await page.locator('.achievement-toast-heading b').textContent(), '+1 more');
    assert.equal(await page.locator('.achievement-toast-copy > strong').textContent(), 'Find Your Flow · Level 2');
    assert.equal(await page.locator('.achievement-toast-copy > strong').getAttribute('title'), 'Find Your Flow · Level 2\nWinning Form · Level 1', 'several levels of one trophy announce only its highest newly earned level');
    assert.equal(await page.evaluate(() => window.audioStarts), 4);
    assert.doesNotMatch(await page.locator('.achievement-toast').textContent(), /\bAP\b|points/i);
    for (const viewport of [{width:320,height:568},{width:390,height:844},{width:768,height:1024}]) {
      await page.setViewportSize(viewport);
      const box = await page.locator('.achievement-toast').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= viewport.width && box.y >= 0 && box.height <= 70);
      assert.equal(await page.locator('.achievement-toast').evaluate(node => node.scrollHeight <= node.clientHeight + 2), true);
    }
    await page.setViewportSize({width:320,height:568});
    await page.mouse.click(160,35);
    assert.equal(await page.evaluate(() => window.underlayClicks), 1, 'toast never intercepts game input');
    await page.screenshot({path:path.join(output,`${browserName}-achievement-toast-group.png`),animations:'disabled'});
    await advance(500);
    await patch({ batches: [{ ...first }, { ...second }, third] });
    assert.equal(await page.evaluate(() => window.audioStarts), 4, 'prop clone/new queue item does not replay sound');
    await patch({paused:true}); await advance(6000);
    assert.equal(await active(),'first'); assert.deepEqual(await page.evaluate(()=>window.completedBatches),[]);
    assert.equal(await page.locator('.achievement-toast-stage').evaluate(node=>getComputedStyle(node).visibility),'hidden');
    assert.equal(await page.evaluate(()=>window.audioStops),4);
    await patch({paused:false}); await advance(3000);
    assert.equal(await active(),'first'); assert.equal(await page.evaluate(()=>window.audioStarts),4,'resuming never replays audio');
    await advance(900);
    assert.equal(await active(),'second'); assert.deepEqual(await page.evaluate(()=>window.completedBatches),['first']);
    assert.equal(await page.evaluate(()=>window.audioStarts),8);
    await page.evaluate(()=>window.toastVisibility(true)); await advance(6000);
    assert.equal(await active(),'second');
    await page.evaluate(()=>window.toastVisibility(false)); await advance(4000);
    assert.equal(await active(),'third'); assert.equal(await page.evaluate(()=>window.audioStarts),12);
    await patch({sound:false,gentle:true}); await advance(4000);
    assert.equal(await page.locator('.achievement-toast-stage').count(),0);
    assert.deepEqual(await page.evaluate(()=>window.completedBatches),['first','second','third']);
    await patch({batches:[{id:'muted',achievementIds:['A011']}],sound:false});
    const mutedStarts = await page.evaluate(()=>window.audioStarts);
    await patch({sound:true}); assert.equal(await page.evaluate(()=>window.audioStarts),mutedStarts,'unmute never plays a muted arrival retroactively');
    await advance(4000); assert.equal(await page.locator('.achievement-toast-stage').count(),0);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${browserName}: toast FIFO/grouping, 70px bounds, pointer pass-through, pause/visibility hold, no rerender/resume/unmute sound replay`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
