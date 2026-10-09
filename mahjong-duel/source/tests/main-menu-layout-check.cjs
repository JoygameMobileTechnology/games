/* Responsive main-menu regression: actual header wrapping, text collisions and pointer targets.
 * PLAYWRIGHT_MODULE=/path/to/playwright node tests/main-menu-layout-check.cjs [--webkit]
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const kind = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = process.env.GAME_URL || 'http://localhost:5173';
const sizes = [[320,480],[320,568],[360,640],[375,667],[375,812],[390,844],[393,852],[402,874],[414,736],[414,896],[428,926],[430,932],[440,956],[600,960],[768,1024],[820,1180],[1024,1366],[568,320],[667,375],[812,375],[844,390],[932,430],[1024,768],[1366,1024],[1440,900]];
(async () => {
  const { createProgression, reduceProgression } = await import(pathToFileURL(path.resolve('src/progression.js')).href);
  const now = Date.now(), dayId = new Date(now).toISOString().slice(0,10);
  let seed = reduceProgression(createProgression({seed:25}), {type:'login',now});
  seed = reduceProgression(seed, {type:'daily-presented',dayId,now});
  seed = reduceProgression(seed, {type:'quests-presented',dayId,now});
  seed.currencies = {coins:123456789,gems:987654};
  const browser = await require(process.env.PLAYWRIGHT_MODULE || 'playwright')[kind].launch();
  const context = await browser.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true, reducedMotion:'reduce'});
  await context.addInitScript(() => { try { localStorage.setItem('porcelain:language', '"en"'); } catch { /* Storage-denied fixtures use the Turkish default. */ } });
  await context.addInitScript(seed => {
    localStorage.setItem('porcelain:progression',JSON.stringify(seed));
    localStorage.setItem('porcelain:gentle','true'); localStorage.setItem('porcelain:sound','false');
    localStorage.setItem('porcelain:profile',JSON.stringify({version:1,name:'Alexandria Smith',avatarId:'avatar-1',countryCode:'TR'}));
  }, seed);
  const page = await context.newPage(), errors = [], report = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = path.resolve('tmp/main-menu-layout-qa'); fs.mkdirSync(output,{recursive:true});
  try {
    await page.goto(origin); await page.getByRole('button',{name:'Play',exact:true}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.home-screen')).opacity)>.99);
    async function check(label,w,h) {
      const metrics = await page.evaluate(()=>{
        const bounds=node=>node.getBoundingClientRect().toJSON(), get=s=>bounds(document.querySelector(s));
        const text=s=>{const r=document.createRange();r.selectNodeContents(document.querySelector(s));return bounds(r);};
        const controls=[...document.querySelectorAll('.home-screen button')].filter(node=>node.getClientRects().length>0).map(node=>{
          const r=bounds(node);return {...r,name:node.getAttribute('aria-label')||node.textContent.trim(),reachable:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===node};
        });
        return {width:innerWidth,height:innerHeight,htmlWidth:document.documentElement.scrollWidth,
          toolbar:get('.home-toolbar'),utilities:get('.home-utilities'),profile:get('.profile-launch'),avatar:get('.profile-launch .player-avatar'),
          wallet:get('.currency-balance'),coins:get('.currency-amount-coins'),gems:get('.currency-amount-gems'),brand:get('.home-brand'),
          currencyText:[...document.querySelectorAll('.currency-amount')].map(node=>({label:node.title,badge:bounds(node),number:bounds(node.querySelector('strong'))})),
          title:text('.home-brand h1 > span'),duel:text('.home-brand h1 > strong'),actions:get('.home-actions'),controls,
          homeHeight:document.querySelector('.home-screen').clientHeight,homeScroll:document.querySelector('.home-screen').scrollHeight};
      });
      assert.ok(metrics.htmlWidth<=w+1,`${label}: no horizontal page overflow`);
      for(const c of metrics.controls) {
        assert.ok(c.width>=44&&c.height>=44,`${label}: ${c.name} meets44px target`);
        assert.ok(c.left>=-1&&c.right<=w+1&&c.top>=-1&&c.bottom<=h-5,`${label}: ${c.name} fits on screen with bottom breathing room`);
        assert.ok(c.reachable,`${label}: ${c.name} accepts real pointer`);
      }
      assert.ok(metrics.homeScroll<=metrics.homeHeight+1,`${label}: entire menu fits without scrolling (${metrics.homeScroll}/${metrics.homeHeight})`);
      const walletGap=metrics.wallet.left-metrics.profile.right;
      assert.ok(walletGap>=3.5&&walletGap<=12.5,`${label}: balances sit 4–12px after the profile (${walletGap}px)`);
      const walletCenter=(metrics.wallet.top+metrics.wallet.bottom)/2, avatarCenter=(metrics.avatar.top+metrics.avatar.bottom)/2;
      assert.ok(Math.abs(walletCenter-avatarCenter)<=8,`${label}: balances stay vertically alongside the portrait (${walletCenter-avatarCenter}px center difference)`);
      assert.ok(metrics.coins.right<=metrics.gems.left&&metrics.coins.left<metrics.gems.left,`${label}: Coins are left of Gems`);
      for(const currency of metrics.currencyText) {
        assert.ok(currency.number.left>=currency.badge.left-.5&&currency.number.right<=currency.badge.right+.5,`${label}: ${currency.label} fits inside its badge`);
      }
      assert.ok(metrics.wallet.right<=metrics.utilities.left,`${label}: balances do not overlap the utility buttons`);
      assert.ok(Math.abs(metrics.utilities.top-metrics.profile.top)<=4,`${label}: utilities remain at top alongside profile`);
      assert.ok(metrics.brand.top>=metrics.toolbar.bottom+4,`${label}: toolbar and logo are separated`);
      assert.ok(Math.abs((metrics.title.left+metrics.title.right)-(metrics.duel.left+metrics.duel.right))<=2,`${label}: Mahjong stays centered above DUEL`);
      const q=metrics.controls.find(c=>c.name==='Daily Quests'),l=metrics.controls.find(c=>c.name==='Leaderboards');
      assert.ok(metrics.title.left>=q.right+5&&metrics.title.right<=l.left-5,`${label}: title clears its side buttons`);
      report.push({label,...metrics});
      if(label.startsWith('large-text-')||['320x480','390x844','430x932','768x1024','844x390','1440x900'].some(size=>label===size)) await page.screenshot({path:path.join(output,`${kind}-${label}.jpg`),animations:'disabled'});
    }
    for(const [w,h] of sizes){await page.setViewportSize({width:w,height:h});await check(`${w}x${h}`,w,h);}
    // Emulate legacy selector support: remove :has rules from this isolated test page.
    await page.evaluate(()=>{const strip=sheet=>{for(let i=sheet.cssRules.length-1;i>=0;i--){const r=sheet.cssRules[i];if(r.selectorText?.includes(':has('))sheet.deleteRule(i);else if(r.cssRules)strip(r);}};for(const sheet of document.styleSheets)strip(sheet);});
    for(const [w,h] of [[320,480],[375,667],[430,932],[768,1024]]){await page.setViewportSize({width:w,height:h});await check(`legacy-${w}x${h}`,w,h);}
    for(const [w,h] of [[320,480],[390,844]]) {
      await page.setViewportSize({width:w,height:h});
      await page.locator('.currency-amount strong').evaluateAll(nodes=>nodes.forEach(node=>{node.style.fontSize=`${parseFloat(getComputedStyle(node).fontSize)*1.25}px`;}));
      await check(`large-text-${w}x${h}`,w,h);
      await page.locator('.currency-amount strong').evaluateAll(nodes=>nodes.forEach(node=>node.style.removeProperty('font-size')));
    }
    await page.setViewportSize({width:390,height:844});
    for(const [label,title] of [['Daily Quests','Daily Quests'],['Leaderboards','Leaderboards'],['Shop','Shop']]){
      const button=page.getByRole('button',{name:label,exact:true});const r=await button.boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);
      await page.getByRole('heading',{name:title,exact:true}).waitFor();await page.getByRole('button',{name:'Back to main menu',exact:true}).click();
      await page.getByRole('button',{name:'Play',exact:true}).waitFor();await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.home-screen')).opacity)>.99);
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS ${kind}: ${report.length} responsive layouts, balances beside portrait, top-right utilities, title clearance, 44px targets, pointer navigation and legacy selector fallback`);
  } finally {fs.writeFileSync(path.join(output,`${kind}-report.json`),JSON.stringify({report,errors},null,2));await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
