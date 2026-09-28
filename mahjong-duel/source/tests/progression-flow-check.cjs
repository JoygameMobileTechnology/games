/* Real UI + durable storage: daily claims, completed duel route, ranking replay and wallet reuse.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/progression-flow-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
(async () => {
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[browserName].launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem('progression-seeded')) {
      localStorage.clear();
      localStorage.setItem('porcelain:gentle', 'true'); localStorage.setItem('porcelain:sound', 'false');
      sessionStorage.setItem('progression-seeded', 'true');
    }
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const output = path.resolve('tmp/progression-qa'); fs.mkdirSync(output, { recursive: true });
  const errors = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(origin)) errors.push(`${response.status()} ${response.url()}`); });
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' });
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('porcelain:progression')));
  const capture = name => page.screenshot({ path: path.join(output, `${browserName}-${name}.png`) });
  const pass = label => { checks.push(label); console.log(`PASS ${browserName}: ${label}`); };
  async function tap(id) {
    const point = await page.locator(`[data-tile-id="${id}"]`).evaluate(node => {
      const r = node.getBoundingClientRect();
      for (const fy of [.5, .9, .1]) for (const fx of [.5, .9, .1]) {
        const x = r.x + r.width * fx, y = r.y + r.height * fy;
        if (document.elementFromPoint(x,y)?.closest('[data-tile-id]') === node) return { x,y };
      }
    });
    assert.ok(point, `uncovered tile ${id} remains clickable through effects`);
    await page.mouse.click(point.x, point.y);
  }
  try {
    await page.goto(origin);
    await page.getByRole('heading', { name: 'Daily Rewards', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready); await capture('daily-unclaimed');
    assert.equal((await state()).daily.loginDayIds.length, 1);
    await button('Claim rewards 2x').click(); await button('Play Duel').waitFor();
    let initial = await state();
    assert.deepEqual(initial.wallet, { shuffle:0, hint:2, freeze:0, eagle:0 });
    assert.equal(initial.ranking.position,10000); assert.equal(initial.counters.completedWins,0);
    await button(/^Daily Rewards,/).click(); await button('Claimed').waitFor();
    assert.equal(await button('Claim rewards 2x').isEnabled(),false); await capture('daily-claimed');
    await button('Back to main menu').click();
    await page.waitForFunction(() => document.activeElement?.matches('.daily-menu-control'));
    await page.reload(); await button('Play Duel').waitFor();
    assert.deepEqual((await state()).wallet,initial.wallet); assert.equal((await state()).daily.loginDayIds.length,1);
    assert.equal(await page.locator('.daily-rewards-page').count(),0);
    pass('instant test rewarded ad doubles one receipt; repeat/reload neither pays nor counts another visit');
    await capture('menu');
    await button('Achievements').click(); await page.locator('.achievement-entry').first().waitFor();
    assert.equal(await page.locator('.achievement-entry').count(),100); await capture('achievements-locked');
    await page.getByLabel('Search achievements').fill('Duel');
    const count = await page.locator('.achievement-entry').count();
    await page.locator('.achievement-entry').first().click(); await page.getByRole('heading', { name:'Achievement details' }).waitFor();
    await capture('achievement-detail'); await button('Back to achievements').first().click();
    assert.equal(await page.getByLabel('Search achievements').inputValue(),'Duel');
    assert.equal(await page.locator('.achievement-entry').count(),count);
    await button('Back to main menu').click();
    await button('Play Duel').click(); await page.locator('.game-tile').first().waitFor();
    await button('Hint, 2 uses left').click();
    assert.equal((await state()).wallet.hint,1);
    // Use actual pointer actions. Test automation may inspect image identities; the game remains face-down.
    for (let matched=0; matched<40; matched++) {
      await page.waitForFunction(() => {
        const free=[...document.querySelectorAll('.game-tile[data-free="true"][aria-disabled="false"]')];
        return free.some((a,i)=>free.slice(i+1).some(b=>a.querySelector('.tile-front img').src===b.querySelector('.tile-front img').src));
      });
      const pair = await page.locator('.game-tile[data-free="true"][aria-disabled="false"]').evaluateAll(nodes => {
        for (let i=0;i<nodes.length;i++) for(let j=i+1;j<nodes.length;j++) {
          if(nodes[i].querySelector('.tile-front img').src===nodes[j].querySelector('.tile-front img').src) return [nodes[i].dataset.tileId,nodes[j].dataset.tileId];
        }
      });
      await tap(pair[0]); await tap(pair[1]);
      await page.waitForFunction(expected => document.querySelectorAll('.game-tile').length === expected, 80-(matched+1)*2);
      if(matched===14) await capture('phenomenal');
      if(matched===20) {
        assert.equal((await state()).counters.completedWins,0,'21st pair alone is not a completed win');
        await capture('victory-secured');
      }
    }
    await page.getByRole('dialog',{name:'Game results'}).waitFor();
    const won = await state();
    assert.equal(won.counters.personalPairs,40); assert.equal(won.counters.completedDuels,1); assert.equal(won.counters.completedWins,1);
    assert.equal(won.counters.bestPairChain,40); assert.equal(won.ranking.position,9800);
    assert.ok(won.pendingRankingPresentation); assert.equal(await page.locator('.leaderboards-page').count(),0);
    await capture('result-before-rank');
    await page.waitForTimeout(1000); assert.equal((await state()).counters.completedWins,1);
    await button('Continue').click(); await page.getByRole('heading',{name:'Leaderboards',exact:true}).waitFor();
    assert.equal((await state()).pendingRankingPresentation,null); await capture('rank-win');
    await button('Back to main menu').click(); await button('Leaderboards').click();
    assert.equal(await page.locator('.is-climbing').count(),0); assert.equal((await state()).ranking.position,9800);
    await button('Back to main menu').click(); await page.reload(); await button('Play Duel').waitFor();
    assert.equal((await state()).counters.completedWins,1); assert.equal((await state()).pendingRankingPresentation,null);
    pass('40 real pointer matches award once; result precedes one-use leaderboards; reload keeps progress and discards presentation');
    await button('Achievements').click(); await button('Unlocked').click();
    assert.ok(await page.locator('.achievement-entry.is-unlocked').count()>0); await capture('achievements-unlocked');
    await button('In progress').click(); await capture('achievements-progress'); await button('Back to main menu').click();
    await button('Play Duel').click(); await page.locator('.game-board').waitFor();
    assert.equal(await button('Hint, 1 uses left').count(),1); assert.equal(await button('Shuffle, 0 uses left').isEnabled(),false);
    await button('Pause game').click(); await button('Leave duel').click();
    await page.waitForFunction(() => document.querySelectorAll('.sheet-backdrop').length === 1 && document.querySelector('.parchment-header h2')?.textContent === 'Leave duel?');
    await button('Leave duel').click(); await button('Play Duel').waitFor();
    assert.equal((await state()).counters.completedDuels,1); assert.equal(await page.evaluate(()=>localStorage.getItem('porcelain:session')),null);
    pass('earned inventory survives a new board, and abandoning never creates a completion or saved duel');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,`${browserName}-flow-report.json`),JSON.stringify({checks,errors},null,2));
  } catch(error) {
    await capture('failure').catch(()=>{}); throw error;
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
