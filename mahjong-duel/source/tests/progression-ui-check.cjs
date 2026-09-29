/* Responsive progression pages and presentation-only edge cases.
 * GAME_URL=http://localhost:5173 PLAYWRIGHT_MODULE=/path/to/playwright node tests/progression-ui-check.cjs [--webkit]
 * The isolated component fixture exists only through Playwright route fulfillment.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = process.env.GAME_URL || 'http://localhost:5173';
const browserName = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const output = path.join(root, 'output/remake/progression-review');
const sizes = [[320,568],[375,553],[375,667],[390,844],[440,956],[844,390],[768,1024],[1024,1366],[1024,768],[1366,1024]];
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
const {createRoot}=ReactDOM;
import '/node_modules/@fontsource/manrope/latin-400.css';
import '/node_modules/@fontsource/manrope/latin-700.css';
import '/node_modules/@fontsource/manrope/latin-800.css';
import '/node_modules/@fontsource/cormorant-garamond/latin-600.css';
import '/src/style.css';import '/src/fullscreen-board.css';import '/src/remake.css';import '/src/phone-ui.css';
import {DailyRewardsPage,AchievementsPage,LeaderboardsPage} from '/src/progression-pages.jsx';
import {ProgressionMenuHeader} from '/src/progression-menu.jsx';
import {createProgression,reduceProgression} from '/src/progression.js';
import {advanceRanking} from '/src/leaderboards.js';
const params=new URLSearchParams(location.search),mode=params.get('case')||'daily30';
const now=Date.now();let initial=createProgression({seed:413});
for(let i=(mode==='daily7'?6:29);i>=0;i--)initial=reduceProgression(initial,{type:'login',now:now-i*86400000});
initial=reduceProgression(initial,{type:'daily-claim',eventId:'prior-claim',now:now-1});
initial.daily.claimReceipts={};initial.daily.claims={};
const latest=Object.keys(initial.daily.entitlements).at(-1);for(const key of Object.keys(initial.daily.entitlements))if(key!==latest){initial.daily.claims[key]={receiptId:'fixture-prior',claimedAt:now,multiplier:1};}
if(mode==='daily-claimed2x'){initial=reduceProgression(initial,{type:'daily-ad-start',attemptId:'fixture-double',eventId:'fixture-double-start',now});initial=reduceProgression(initial,{type:'daily-ad-complete',attemptId:'fixture-double',status:'completed',eventId:'fixture-double-paid',now});}
const profile={version:1,name:'Alexandria Rose',avatarId:'avatar-5',countryCode:'TR'};
let presentation=null;if(mode.startsWith('rank')){const first=mode.includes('first'),held=mode.includes('held');initial.ranking={seed:413,wins:9,position:first?1:8338,leagueId:'bronze'};const result=advanceRanking(initial.ranking,{outcome:held?'lose':'win',wins:held?9:10,eventId:'fixture-win',gameId:'fixture-board',newAchievementIds:['A013']});initial.ranking=result.ranking;presentation=result.presentation;}
function Harness(){if(mode==='menu-large'){const noop=()=>{};return React.createElement('div',{className:'world remake at-home'},React.createElement('main',{className:'app-shell'},React.createElement('section',{className:'home-screen'},React.createElement(ProgressionMenuHeader,{profile,loginDays:1234567,onProfile:noop,onDaily:noop,onAchievements:noop,onThemes:noop,onSettings:noop,onLeaderboards:noop}),React.createElement('div',{className:'home-actions'},React.createElement('button',{className:'duel-launch'},'Play Duel'),React.createElement('div',{className:'home-links'},React.createElement('button',{className:'binder-launch'},'Collection'))))));}const[state,setState]=React.useState(initial);const close=()=>document.body.dataset.closed='true';const claim=()=>setState(s=>reduceProgression(s,{type:'daily-claim',eventId:'fixture-claim',now}));const common={progression:state,onClose:close,gentle:mode==='rank-reduced'};return React.createElement('div',{className:'remake'},mode.startsWith('rank')?React.createElement(LeaderboardsPage,{...common,profile,presentation,sound:false}):React.createElement(DailyRewardsPage,{...common,onClaim:claim,onDoubleClaim:()=>{},adState:mode==='daily-unavailable'?'unavailable':mode==='daily-failed'?'failed':'idle'}));}
createRoot(document.getElementById('root')).render(React.createElement(Harness));
</script></body></html>`;
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await require(process.env.PLAYWRIGHT_MODULE||'playwright')[browserName].launch({headless:true});
 const errors=[],records=[];
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',e=>{errors.push(e.message);console.error('Page error:',e.message)});
 page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))errors.push(`${r.status()} ${r.url()}`)});
 const button=name=>page.getByRole('button',{name,exact:typeof name==='string'});
 const settle=async()=>{await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(320)};
 async function screenshot(name){await page.screenshot({path:path.join(output,`${browserName}-${page.viewportSize().width}x${page.viewportSize().height}-${name}.png`)})}
 async function dailyFits(label){
  const result=await page.evaluate(()=>{
   const area=document.querySelector('.daily-rewards-page .progression-page-scroll'),content=document.querySelector('.daily-rewards-page .progression-page-content');
   const controls=[...document.querySelectorAll('.daily-rewards-page button')].map(node=>({label:node.textContent||node.getAttribute('aria-label'),...node.getBoundingClientRect().toJSON()}));
   const all=[...content.querySelectorAll('.daily-topline,.daily-hero>div,.daily-long-track,.daily-grand-reward,.daily-claim-state,.daily-claim-actions')].map(node=>({name:node.className,...node.getBoundingClientRect().toJSON()}));
   return {w:innerWidth,h:innerHeight,doc:document.documentElement.scrollWidth,scroll:area.scrollHeight,client:area.clientHeight,controls,all};
  });
  assert.ok(result.doc<=result.w,`${label} document has no horizontal overflow`);
  assert.ok(result.scroll<=result.client+1,`${label} Daily is one page: ${JSON.stringify(result)}`);
  for(const box of [...result.controls,...result.all])assert.ok(box.left>=-1&&box.right<=result.w+1&&box.top>=-1&&box.bottom<=result.h+1,`${label} visible ${box.name||box.label}: ${JSON.stringify(box)}`);
  const hero=result.all.find(box=>box.name===''),calendar=result.all.find(box=>box.name==='daily-long-track');assert.ok(result.w>result.h||!hero||hero.bottom<calendar.top-12,'login count stays above calendar heading');
  for(const box of result.controls)assert.ok(box.height>=44&&box.width>=44,`${label} minimum target ${box.label}`);
  records.push({label,...result});
 }
 for(const[width,height]of (process.env.FIXTURES_ONLY || process.env.RANK_ONLY ? [] : sizes)){
  await page.setViewportSize({width,height});await page.goto(base);await page.evaluate(()=>localStorage.clear());await page.reload();await button('Back to main menu').waitFor();await settle();
  await dailyFits('daily '+width+'x'+height);await screenshot('daily');await button('Back to main menu').click();await settle();
  const menu=await page.evaluate(()=>{const controls=[...document.querySelectorAll('.home-toolbar button,.leaderboard-menu-control,.home-actions button')];return controls.map(node=>{const rect=node.getBoundingClientRect(),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);return{name:node.getAttribute('aria-label')||node.textContent,...rect.toJSON(),hit:hit===node||node.contains(hit)};});});
  assert.equal(menu.length,8);for(const box of menu){assert.ok(box.left>=-1&&box.right<=width+1&&box.top>=-1&&box.bottom<=height+1,`menu ${width}x${height} ${JSON.stringify(box)}`);assert.ok(box.width>=44&&box.height>=44,`menu target ${box.name}`);assert.ok(box.hit,`menu clipped/covered ${width}x${height}: ${box.name}`)}
  await screenshot('menu');await button('Achievements').click();await settle();assert.equal(await page.locator('button[data-achievement-family]').count(),43);
  await button('Filter achievements').click();assert.equal(await page.getByRole('combobox',{name:'Achievement category'}).locator('option').count(),7);
  await page.getByRole('combobox',{name:'Achievement category'}).selectOption('memory');assert.equal(await page.locator('button[data-achievement-family]').count(),10);await page.locator('button[data-achievement-family]').nth(3).scrollIntoViewIfNeeded();
  const before=await page.locator('.progression-page-scroll').evaluate(node=>node.scrollTop);const familyId=await page.locator('button[data-achievement-family]').nth(3).getAttribute('data-achievement-family');await page.locator('button[data-achievement-family]').nth(3).click();await settle();assert.ok(await page.locator('button[data-achievement-level]').count()>0);await button('Back to achievements').first().click();await settle();
  assert.equal(await page.getByRole('combobox',{name:'Achievement category'}).inputValue(),'memory');assert.ok(Math.abs(await page.locator('.progression-page-scroll').evaluate(n=>n.scrollTop)-before)<2,'detail restores scroll');assert.equal(await page.evaluate(()=>document.activeElement?.dataset.achievementFamily),familyId,'detail restores card focus');
  await page.locator('.progression-page-scroll').evaluate(n=>n.scrollTop=0);await screenshot('achievements');await button('Back to main menu').click();await settle();await button('Leaderboards').click();await settle();assert.equal(await page.locator('.ranking-row.is-player').count(),1);await screenshot('ranking');await button('Top players').click();assert.equal(await page.locator('.ranking-your-position').count(),1);await button('Back to main menu').click();
  console.log(`PASS ${browserName} ${width}x${height}: Daily fits; all menu controls reachable; categories/detail/leaderboard work`);
 }
 await page.route('**/__progression_fixture?*',route=>route.fulfill({contentType:'text/html',body:fixture}));
 if(!process.env.RANK_ONLY){
 for(const[width,height]of sizes){await page.setViewportSize({width,height});await page.goto(base+'/__progression_fixture?case=daily30');await button('Claim rewards').waitFor();await settle();await dailyFits('day30 '+width+'x'+height);assert.equal(await page.locator('.daily-claim-panel .reward-item').count(),4);await screenshot('daily30');}
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/__progression_fixture?case=daily7');await settle();await dailyFits('day7 reference');assert.equal(await page.locator('.daily-claim-panel .reward-item').count(),4);await screenshot('daily7');
 await page.goto(base+'/__progression_fixture?case=daily-unavailable');await settle();assert.ok(await button('Claim rewards').isEnabled());assert.ok(await button('Claim rewards 2x').isDisabled());await screenshot('daily-unavailable');const unclaimed=await page.locator('.daily-claim-panel .reward-item').allTextContents();await button('Claim rewards').click();assert.ok(await button('Claimed').isDisabled());assert.deepEqual(await page.locator('.daily-claim-panel .reward-item').allTextContents(),unclaimed,'claimed receipt retains day-30 bonus');await screenshot('daily-claimed');
 await page.goto(base+'/__progression_fixture?case=daily-claimed2x');await button('Claimed').waitFor();await settle();assert.match(await page.locator('.daily-claim-panel').innerText(),/×12/);assert.equal((await page.locator('.daily-claim-panel .reward-item').allTextContents()).filter(text=>text.includes('×10')).length,3);await screenshot('daily-claimed2x');
 for(const width of [320,390,768]){await page.setViewportSize({width,height:width===768?1024:844});await page.goto(base+'/__progression_fixture?case=menu-large');await settle();const badge=await page.locator('.daily-menu-count').boundingBox(),next=await page.getByRole('button',{name:'Achievements',exact:true}).boundingBox();assert.ok(badge.x+badge.width<=next.x,'large badge does not collide');assert.equal(await page.getByRole('button',{name:'Daily Rewards, 1,234,567 login days',exact:true}).count(),1);await screenshot('menu-large-count');}
 for(const width of [320,390]){await page.setViewportSize({width,height:width===320?568:844});await page.goto(base+'/__progression_fixture?case=daily30');await button('Claim rewards').waitFor();await settle();await page.evaluate(()=>{const nodes=[...document.querySelectorAll('.daily-rewards-page *')].filter(n=>[...n.childNodes].some(c=>c.nodeType===Node.TEXT_NODE&&c.textContent.trim()));const sizes=nodes.map(n=>parseFloat(getComputedStyle(n).fontSize));nodes.forEach((n,i)=>n.style.fontSize=sizes[i]*1.25+'px');});await dailyFits('125-percent text '+width);await screenshot('daily-125-percent-text');}
 await page.setViewportSize({width:390,height:844});
 }
 await page.setViewportSize({width:390,height:844});
 await page.clock.install(); await page.clock.pauseAt(new Date());
 for(const mode of ['rank-held','rank-win','rank-first','rank-reduced']){
  await page.goto(base+'/__progression_fixture?case='+mode);await page.getByRole('heading',{name:'Leaderboards'}).waitFor();await page.clock.runFor(16);
  if(mode==='rank-win'){
   await page.locator('.ranking-float-row').waitFor();await page.clock.runFor(250);await screenshot('rank-lift');
   const lifted=await page.locator('.ranking-float-row').evaluate(n=>({phase:n.dataset.flightPhase,transform:getComputedStyle(n).transform,shadow:getComputedStyle(n).boxShadow,...n.getBoundingClientRect().toJSON()}));assert.equal(lifted.phase,'lift');assert.notEqual(lifted.shadow,'none');
   await page.clock.runFor(650);await screenshot('rank-climb');const travelling=await page.locator('.ranking-float-row').boundingBox();assert.ok(travelling.y<lifted.y-15,'floating local row clearly climbs past neighbours');
   await page.clock.runFor(900);await screenshot('rank-landing');await page.clock.runFor(250);await page.locator('.league-hero.is-promoting').waitFor();assert.equal(await page.locator('.ranking-rows.is-climbing').count(),0);await screenshot('rank-promotion');await page.clock.runFor(1500);assert.equal(await page.locator('.league-hero.is-promoting').count(),0);assert.match(await page.locator('.ranking-summary').innerText(),/#8,171/);
  }
  if(mode==='rank-first'){assert.equal(await page.locator('.ranking-rows.is-climbing').count(),0);await page.clock.runFor(350);await page.locator('.league-hero.is-promoting').waitFor();await screenshot('rank-first-promotion');await page.clock.runFor(1500);assert.equal(await page.locator('.league-hero.is-promoting').count(),0);}
  if(mode==='rank-held'){assert.equal(await page.locator('.ranking-rows.is-climbing,.league-hero.is-promoting').count(),0);assert.match(await page.locator('.ranking-outcome').innerText(),/Position held/);await page.clock.runFor(250);await screenshot('rank-held');}
  if(mode==='rank-reduced'){await page.clock.runFor(350);assert.equal(await page.locator('.ranking-rows.is-climbing,.league-hero.is-promoting').count(),0);assert.equal(await page.locator('.league-hero h3').innerText(),'Silver League');}
 }
 for(const [width,height]of sizes){
  await page.setViewportSize({width,height});await page.goto(base+'/__progression_fixture?case=rank-win');await page.locator('.ranking-float-row').waitFor();await page.clock.runFor(266);
  const float=await page.locator('.ranking-float-row').boundingBox(),rows=await page.locator('.ranking-rows').boundingBox();assert.ok(float.x>=0&&float.x+float.width<=width&&float.y>=rows.y&&float.y+float.height<=rows.y+rows.height+1,`floating card visible ${width}x${height}: ${JSON.stringify({float,rows})}`);await screenshot('rank-lift-matrix');
  await page.clock.runFor(1534);await screenshot('rank-land-matrix');await page.clock.runFor(2000);assert.equal(await page.locator('.ranking-float-row').count(),0);const local=await page.locator('.ranking-rows .is-player').boundingBox();assert.ok(local.y>=rows.y-1&&local.y+local.height<=rows.y+rows.height+1,`settled player visible ${width}x${height}: ${JSON.stringify({local,rows})}`);
 }
 assert.deepEqual(errors,[]);if(records.length)fs.writeFileSync(path.join(output,`${browserName}-metrics.json`),JSON.stringify(records,null,2));await browser.close();console.log(`PASS ${browserName}: component fixtures, unavailable/claimed rewards, held rank, climb/promotion, rank-one promotion, reduced motion; floating row fits all 10 sizes`);
})().catch(error=>{console.error(error);process.exit(1)});
