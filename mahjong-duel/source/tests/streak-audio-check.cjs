/* PLAYWRIGHT_MODULE may point to an existing Playwright installation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/sound.js'), 'utf8');
  for (const [name, browserType] of Object.entries({ chromium, webkit })) {
    const browser = await browserType.launch({ headless: true }), page = await browser.newPage();
    try {
      const result = await page.evaluate(async source => {
        const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        async function render(cue, option = {}) {
          let offline, voices = 0, contexts = 0;
          window.AudioContext = function () {
            contexts++;
            offline = new Offline(1, 48000 * 2, 48000);
            Object.defineProperty(offline, 'state', { value: option.suspended ? 'suspended' : 'running' });
            offline.resume = () => Promise.reject(new Error('Autoplay blocked'));
            const oscillator = offline.createOscillator.bind(offline);
            offline.createOscillator = () => { voices++; return oscillator(); };
            return offline;
          };
          const sound = await import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
          if (option.impact) sound.tileSmack(true, { strength: 1.2 });
          const cancel = sound.playProgressSound(cue, !option.muted);
          if (option.cancel) { cancel(); cancel(); }
          if (!offline) return { contexts, voices, peak: 0, energy: 0, signature: 0 };
          const audio = (await offline.startRendering()).getChannelData(0);
          let peak = 0, energy = 0, signature = 0;
          for (let i = 0; i < audio.length; i++) { peak = Math.max(peak, Math.abs(audio[i])); energy += audio[i] ** 2; signature += audio[i] * Math.sin(i * .07); }
          return { contexts, voices, peak, energy, signature };
        }
        const chains = [];
        for (let count = 2; count <= 16; count++) chains.push(await render({ family: 'chain', count, actor: 'you', owner: 'you', peak: count === 15, reinforcement: count > 15 }));
        const turning = [];
        for (const id of ['turning_lead_five', 'turning_recover_four', 'turning_equalize', 'turning_comeback_lead', 'turning_four_to_win', 'turning_draw_only', 'turning_win_secured', 'turning_draw_final']) turning.push(await render({ family: 'turning', actor: 'you', owner: 'you', id }));
        const cue = { family: 'chain', count: 15, actor: 'you', owner: 'you', peak: true };
        return { chains, turning, rank: await render('rank'), promotion: await render('promotion'),
          muted: await render(cue, { muted: true }), canceled: await render(cue, { cancel: true }),
          blocked: await render(cue, { suspended: true }), opponent: await render({ ...cue, owner: 'ai' }), mixed: await render(cue, { impact: true }) };
      }, source);
      for (const sample of [...result.chains, ...result.turning, result.rank, result.promotion]) {
        assert.ok(sample.energy > .001, 'cue audible'); assert.ok(sample.peak < .15, 'restrained total gain'); assert.ok(sample.voices <= 4, 'musical voices bounded'); assert.equal(sample.contexts, 1);
      }
      assert.equal(new Set(result.chains.map(x => x.signature.toFixed(6))).size, 15, 'each tier and post-peak reinforcement is distinct');
      assert.equal(result.chains.at(-1).voices, 2, 'above15 uses short reinforcement rather than repeating full peak');
      for (const sample of [result.muted, result.canceled, result.blocked, result.opponent]) assert.equal(sample.energy, 0, 'muted, canceled, blocked and opponent audio stays silent');
      assert.equal(result.muted.contexts, 0); assert.equal(result.opponent.contexts, 0);
      assert.equal(result.mixed.contexts, 1, 'impacts and flourishes share one context');
      assert.ok(result.mixed.peak < .98, 'simultaneous impact and peak flourish never clip');
      console.log(`PASS ${name}: fourteen distinct tiers plus reinforcement, eight turning cues, cancellable rank/promotion, mute/autoplay safety, shared context and bounded gain`);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
