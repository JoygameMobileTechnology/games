/* Trophy shelves, every milestone, avatar rewards and responsive navigation.
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/achievement-gallery-check.cjs [--webkit] [--layout-only]
 * Presentation fixtures exist only inside the test browser's route fulfillment.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const layoutOnly = process.argv.includes('--layout-only');
const origin = process.env.GAME_URL || 'http://localhost:5173';
const output = path.resolve('output/remake/achievement-gallery-review');
const sizes = layoutOnly ? [[320, 568], [768, 1024]] : [[320, 568], [390, 844], [768, 1024], [1024, 768], [844, 390]];
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import '/node_modules/@fontsource/manrope/latin-400.css';
import '/node_modules/@fontsource/manrope/latin-700.css';
import '/node_modules/@fontsource/manrope/latin-800.css';
import '/node_modules/@fontsource/cormorant-garamond/latin-600.css';
import '/src/style.css';import '/src/fullscreen-board.css';import '/src/remake.css';import '/src/phone-ui.css';
import {AchievementsPage} from '/src/progression-pages.jsx';
import {createProgression} from '/src/progression.js';
import {ACHIEVEMENTS,evaluateAchievements} from '/src/achievements.js';
import {ACHIEVEMENT_FAMILIES,ACHIEVEMENT_SHELVES,achievementFamilyProgress} from '/src/achievement-milestones.js';
import {AVATAR_FRAMES,isFrameUnlocked} from '/src/avatar-frames.js';
const params=new URLSearchParams(location.search), mode=params.get('case')||'locked';
let initial=createProgression({seed:413});
if(mode==='partial')Object.assign(initial.counters,{completedDuels:50,completedWins:5,personalPairs:250,bestPairChain:5});
if(mode==='complete')for(const family of ACHIEVEMENT_FAMILIES){const target=family.milestones.at(-1).target;if(family.counterKey.startsWith('distinct'))initial.sets[family.counterKey]=Array.from({length:target},(_,i)=>'fixture-'+i);else initial.counters[family.counterKey]=target;}
if(mode==='legacy'){initial.counters.completedDuels=25;initial.unlocked={A001:1,A002:2,A003:3,A004:4};delete initial.awardedPoints;}
initial={...initial,...evaluateAchievements(initial,1750000000000)};
if(params.has('points'))initial.points=Number(params.get('points'));
window.fixtureCatalog={families:ACHIEVEMENT_FAMILIES,shelves:ACHIEVEMENT_SHELVES,frames:AVATAR_FRAMES};
function Harness(){const [profile,setProfile]=React.useState({version:1,name:'Alexandria Rose',avatarId:'avatar-5',countryCode:'TR',frameId:''});window.fixtureState={points:initial.points,profile,entries:ACHIEVEMENT_FAMILIES.map(f=>achievementFamilyProgress(f,initial))};return React.createElement('div',{className:'remake'},React.createElement(AchievementsPage,{progression:initial,profile,gentle:params.get('gentle')==='true',onClose:()=>document.body.dataset.closed='true',onEquipFrame:frameId=>{if(!isFrameUnlocked(frameId,initial.points))throw Error('Locked frame equipped');setProfile(p=>({...p,frameId}));return true;}}));}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
</script></body></html>`;

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [], checks = [], metrics = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  await page.route('**/__achievement_fixture?*', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' });
  const cards = () => page.locator('button[data-achievement-family]');
  const card = id => page.locator(`button[data-achievement-family="${id}"]`);
  const scroll = () => page.locator('.achievements-page .progression-page-scroll');
  const pass = label => { checks.push(label); console.log(`PASS ${browserName}: ${label}`); };
  const settle = async () => {
    await page.evaluate(async () => {
      await document.fonts.ready;
      const urls = new Set([...document.querySelectorAll('.trophy-illustration,.player-avatar-portrait')].map(node => getComputedStyle(node).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1]).filter(Boolean));
      await Promise.all([...urls].map(async url => { const image = new Image(); image.src = url; await image.decode(); }));
    });
    await page.waitForTimeout(260);
  };
  const capture = async name => { const { width, height } = page.viewportSize(); await page.screenshot({ path: path.join(output, `${browserName}-${width}x${height}-${name}.png`) }); };
  async function load(mode = 'locked', extra = '') {
    await page.goto(`${origin}/__achievement_fixture?case=${mode}${extra}`);
    await page.getByRole('heading', { name: 'Achievements', exact: true }).waitFor();
    await settle();
  }
  async function fit(label) {
    const result = await page.evaluate(() => {
      const area = document.querySelector('.achievements-page .progression-page-scroll');
      const controls = [...document.querySelectorAll('.achievements-page button,.achievements-page input,.achievements-page select')].filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden').map(node => ({ name: node.getAttribute('aria-label') || node.textContent, ...(node.matches('input') ? node.closest('label') || node : node).getBoundingClientRect().toJSON() }));
      return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, areaWidth: area.clientWidth, contentWidth: area.scrollWidth, scrollHeight: area.scrollHeight, clientHeight: area.clientHeight, controls };
    });
    assert.ok(result.documentWidth <= result.width, `${label}: document has no horizontal overflow`);
    assert.ok(result.contentWidth <= result.areaWidth + 1, `${label}: page content has no horizontal overflow`);
    for (const box of result.controls) {
      assert.ok(box.width >= 43.9 && box.height >= 43.9, `${label}: minimum 44px target ${box.name}: ${box.width}×${box.height}`);
      assert.ok(box.left >= -1 && box.right <= result.width + 1, `${label}: control fits horizontally: ${box.name}`);
    }
    metrics.push({ label, ...result });
    return result;
  }
  async function closeDetail(id, before) {
    await button('Back to achievements').first().click();
    await page.getByRole('heading', { name: 'Achievements', exact: true }).waitFor();
    await page.waitForFunction(familyId => document.activeElement?.dataset.achievementFamily === familyId, id);
    const after = await scroll().evaluate(node => node.scrollTop);
    assert.ok(Math.abs(after - before) <= 2, `Back restores ${id} scroll: ${before} → ${after}`);
  }
  async function unfilteredGallery() {
    assert.equal(await page.locator('.achievement-toolbar').isVisible(), false, 'search and filter toolbar stays hidden');
    assert.equal(await page.getByRole('searchbox', { name: 'Search achievements' }).count(), 0, 'search is absent from accessible controls');
    assert.equal(await button('Filter achievements').count(), 0, 'filter is absent from accessible controls');
    assert.equal(await page.getByRole('combobox', { name: /Achievement (category|status)/ }).count(), 0, 'filter options are absent from accessible controls');
    assert.equal(await cards().count(), 43, 'all trophies stay available without search or filters');
  }
  try {
    let frames;
    if (!layoutOnly) {
    await page.setViewportSize({ width: 320, height: 568 });
    await load();
    const catalog = await page.evaluate(() => window.fixtureCatalog);
    const { families, shelves } = catalog;
    frames = catalog.frames;
    assert.equal(families.length, 43);
    await unfilteredGallery();
    const visited = [];
    for (const family of families) {
      assert.equal(await card(family.id).count(), 1, `${family.name} is available in its shelf`);
      await card(family.id).scrollIntoViewIfNeeded();
      const before = await scroll().evaluate(node => node.scrollTop);
      await card(family.id).click();
      await page.getByRole('heading', { name: family.name, exact: true }).first().waitFor();
      await page.locator('.achievement-condition').waitFor();
      await fit(`all details: ${family.id}`);
      if (family.id === 'completed-duels') await capture('duelist-locked');
      const levels = page.locator('button[data-achievement-level]');
      assert.equal(await levels.count(), family.totalLevels > 1 ? family.totalLevels : 0, `${family.name} exposes its milestone controls`);
      const trophyStages = new Set();
      let previousTarget = 0, previousPoints = 0;
      for (const milestone of family.milestones) {
        assert.ok(milestone.target > previousTarget, `${family.name} targets increase`);
        assert.ok(milestone.points > previousPoints, `${family.name} rewards increase`);
        previousTarget = milestone.target; previousPoints = milestone.points;
        if (family.totalLevels > 1) {
          const level = page.locator(`button[data-achievement-level="${milestone.id}"]`);
          assert.equal(await level.count(), 1, `${milestone.id} has its own level control`);
          const label = await level.getAttribute('aria-label');
          assert.ok(label.includes(milestone.target.toLocaleString('en-US')), `${milestone.id} shows target ${milestone.target}`);
          assert.ok(label.includes(`${milestone.points} AP`), `${milestone.id} shows reward ${milestone.points} AP`);
          await level.click();
          assert.equal(await level.getAttribute('aria-pressed'), 'true', `${milestone.id} can be inspected`);
          trophyStages.add(await page.locator('.achievement-detail-hero .achievement-trophy').evaluate(node => `${node.dataset.glory}:${node.querySelectorAll('.trophy-ornament path').length}`));
          if (family.id === 'completed-duels' && [1, 10].includes(milestone.level)) {
            await page.waitForFunction(() => document.querySelector('.achievements-page .progression-page-scroll').scrollTop <= 1);
            await capture(`duelist-level-${milestone.level}`);
          }
        }
        assert.equal(await page.locator('.achievement-condition').innerText(), milestone.description, `${milestone.id} explains its exact condition`);
        assert.match(await page.locator('.achievement-progress-note').innerText(), new RegExp(`${milestone.points} AP on unlock`), `${milestone.id} explains its exact reward`);
        visited.push(milestone.id);
      }
      if (family.totalLevels > 1) assert.equal(trophyStages.size, family.totalLevels, `${family.name} has a distinct appearance at every level`);
      await closeDetail(family.id, before);
      await unfilteredGallery();
    }
    assert.equal(new Set(visited).size, 100);
    for (const shelf of shelves) {
      assert.equal(await page.locator(`.achievement-shelf[aria-labelledby="shelf-${shelf.id}"] button[data-achievement-family]`).count(), families.filter(family => family.shelfId === shelf.id).length, `${shelf.name} shows its complete family set`);
    }
    pass('search and filters stay hidden; all 43 families and 100 milestone targets and increasing rewards are inspectable; Back preserves focus and scroll');

    await load('partial');
    const entries = await page.evaluate(() => window.fixtureState.entries);
    await unfilteredGallery();
    assert.deepEqual((await page.locator('button[data-achievement-family].is-earned').evaluateAll(nodes => nodes.map(node => node.dataset.achievementFamily))).sort(), entries.filter(entry => entry.unlocked).map(entry => entry.id).sort(), 'earned trophies match saved progress');
    await load('complete');
    await unfilteredGallery();
    assert.equal(await page.locator('button[data-achievement-family].is-earned').count(), 43, 'all completed families show earned status');
    pass('partial and completed collections show all trophies with honest earned status');

    await load('legacy');
    assert.equal(await page.locator('.achievement-total > strong').innerText(), '25', 'legacy AP total stays unchanged');
    await card('completed-duels').click();
    await page.locator('[data-achievement-level="A004"]').click();
    assert.match(await page.locator('.achievement-progress-note').innerText(), /10 AP earned/, 'legacy milestone shows its original award');
    assert.match(await page.locator('[data-achievement-level="A004"]').innerText(), /10 AP/, 'legacy tier badge shows its original award');
    await page.locator('[data-achievement-level="A005"]').click();
    assert.match(await page.locator('.achievement-progress-note').innerText(), /40 AP on unlock/, 'future milestone uses the new increasing reward');
    await capture('legacy-earned-and-future-points');
    pass('legacy AP total and earned milestone values stay unchanged while future milestones use increasing rewards');
    }

    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await load('locked');
      await unfilteredGallery();
      await fit(`locked shelves ${width}×${height}`);
      await capture('shelves-locked');
      await load('partial');
      await unfilteredGallery();
      const result = await fit(`shelves ${width}×${height}`);
      assert.ok(result.scrollHeight > result.clientHeight, 'trophy gallery scrolls as one page');
      await capture('shelves');
      const lastId = await cards().last().getAttribute('data-achievement-family');
      await card(lastId).scrollIntoViewIfNeeded();
      const before = await scroll().evaluate(node => node.scrollTop);
      assert.ok(before > 0, 'lower shelves are reachable');
      await card(lastId).click();
      await settle();
      await fit(`detail ${width}×${height}`);
      await capture('detail');
      await closeDetail(lastId, before);
      await unfilteredGallery();
      await card('completed-duels').click();
      await capture('earned-level-five');
      await page.locator('.achievement-detail-frame-link').click();
      await settle();
      await fit(`frames ${width}×${height}`);
      await capture('frames');
      await button('Back to achievement').first().click();
      await page.getByRole('heading', { name: 'Duelist', exact: true }).first().waitFor();
      pass(`${width}×${height}: shelves/details/frames fit horizontally, page scroll works and all controls are at least 44px`);
    }

    if (!layoutOnly) {
    await page.setViewportSize({ width: 390, height: 844 });
    await load('locked');
    await button('View milestones').first().click();
    for (const frame of frames) assert.ok(await button(`Equip ${frame.name} frame`).isDisabled(), `${frame.name} starts locked`);
    await button('Back to achievements').first().click();
    for (const frame of frames) {
      await load('locked', `&points=${frame.pointsRequired}`);
      await button('View milestones').first().click();
      const pointsBefore = await page.evaluate(() => window.fixtureState.points);
      assert.ok(await button(`Equip ${frame.name} frame`).isEnabled(), `${frame.name} unlocks at ${frame.pointsRequired} AP`);
      await button(`Equip ${frame.name} frame`).click();
      await page.waitForFunction(id => window.fixtureState.profile.frameId === id, frame.id);
      assert.ok(await button(`${frame.name} frame equipped`).isDisabled(), `${frame.name} shows equipped state`);
      assert.equal(await page.evaluate(() => window.fixtureState.points), pointsBefore, 'equipping never spends earned AP');
      for (const higher of frames.filter(other => other.pointsRequired > frame.pointsRequired)) assert.ok(await button(`Equip ${higher.name} frame`).isDisabled(), `${higher.name} remains locked`);
    }
    pass('all frame thresholds unlock correctly; locked frames cannot equip; equipping keeps AP unchanged');

    await load('partial', '&gentle=true');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Back to main menu');
    await card('completed-duels').focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Duelist', exact: true }).first().waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.dataset.achievementFamily === 'completed-duels');
    const motion = await page.locator('.achievements-page').evaluate(node => [...node.querySelectorAll('*')].filter(child => getComputedStyle(child).animationName !== 'none').map(child => ({ className: child.className, duration: getComputedStyle(child).animationDuration })));
    assert.ok(motion.every(item => item.duration.split(',').every(duration => parseFloat(duration) <= .01)), `Gentle disables decorative animations: ${JSON.stringify(motion)}`);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await load('partial');
    assert.deepEqual(await page.locator('.achievements-page').evaluate(node => [...node.querySelectorAll('*')].filter(child => getComputedStyle(child).animationName !== 'none' && getComputedStyle(child).animationDuration.split(',').some(duration => parseFloat(duration) > .01)).map(child => child.className)), [], 'system reduced motion disables decorative animation');
    pass('keyboard opening/Escape restores the card; Gentle and system reduced motion suppress decorative animation');
    }

    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, `${browserName}-report.json`), JSON.stringify({ checks, errors, metrics }, null, 2));
  } catch (error) {
    await capture('failure').catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
