/* PLAYWRIGHT_MODULE may point to an existing Playwright installation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

function writeWav(filename, channels, sampleRate) {
  const frames = channels[0].length;
  const bytes = Buffer.alloc(44 + frames * channels.length * 2);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(channels.length, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * channels.length * 2, 28);
  bytes.writeUInt16LE(channels.length * 2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40);
  for (let i = 0; i < frames; i += 1) for (let channel = 0; channel < channels.length; channel += 1) {
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[channel][i])) * 32767), 44 + (i * channels.length + channel) * 2);
  }
  fs.writeFileSync(filename, bytes);
}

(async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/sound.js'), 'utf8');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const results = await page.evaluate(async ({ source, preview }) => {
      const nativeOffline = window.OfflineAudioContext;
      async function load() { return import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))); }
      async function render(sampleRate, burst = false, strength = 1, pan = 0) {
        let offline, realResume;
        let created = 0, resumeAttempts = 0;
        window.AudioContext = function AudioContext() {
          created += 1;
          offline = new nativeOffline(2, Math.ceil(sampleRate * (burst ? 0.4 : 0.25)), sampleRate);
          realResume = offline.resume.bind(offline);
          offline.resume = () => { resumeAttempts += 1; return Promise.reject(new Error('Deliberate autoplay rejection probe')); };
          return offline;
        };
        const sound = await load();
        const muted = sound.tileSmack(false);
        const mutedCreated = created;
        const accepted = [sound.tileSmack(true, { strength, pan })];
        let duplicateAccepted = 0;
        for (let i = 0; i < 50; i += 1) duplicateAccepted += sound.tileSmack(true) ? 1 : 0;
        const times = burst ? [0.027, 0.054, 0.081, 0.108, 0.135, 0.165] : [];
        const stops = times.map(time => offline.suspend(time));
        const rendering = offline.startRendering();
        for (const stopped of stops) {
          await stopped;
          accepted.push(sound.tileSmack(true, { strength: 1.2, pan }));
          await realResume();
        }
        const rendered = await rendering;
        const channels = Array.from({ length: rendered.numberOfChannels }, (_, channel) => rendered.getChannelData(channel));
        let peak = 0;
        for (const samples of channels) for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
        const rms = (from, to) => {
          let energy = 0, count = 0;
          for (const samples of channels) for (let i = Math.ceil(from * sampleRate); i < Math.min(samples.length, Math.floor(to * sampleRate)); i += 1) {
            energy += samples[i] * samples[i]; count += 1;
          }
          return Math.sqrt(energy / count);
        };
        return {
          sampleRate, burst, peak, earlyRms: rms(0, 0.03), lateRms: rms(0.1, 0.145), afterRms: rms(burst ? 0.32 : 0.15, burst ? 0.4 : 0.25),
          muted, mutedCreated, accepted, duplicateAccepted, resumeAttempts,
          samples: preview && sampleRate === 48000 && !burst ? channels.map(channel => Array.from(channel)) : null,
        };
      }
      const results = [];
      for (const rate of [44100, 48000, 96000]) results.push(await render(rate));
      results.push(await render(48000, true, 1.2, 1));
      window.AudioContext = undefined; window.webkitAudioContext = undefined;
      const unsupported = await load();
      const unsupportedSafe = unsupported.tileSmack(true) === false && unsupported.chime('match', true) === false;
      await new Promise(resolve => setTimeout(resolve, 20));
      return { results, unsupportedSafe };
    }, { source, preview: Boolean(process.env.AUDIO_PREVIEW_PATH) });

    assert.equal(results.unsupportedSafe, true);
    for (const result of results.results) {
      assert.equal(result.muted, false);
      assert.equal(result.mutedCreated, 0, 'muting does not initialize an audio context');
      assert.equal(result.duplicateAccepted, 0, 'rapid duplicate triggers are suppressed');
      assert.ok(result.resumeAttempts > 0, 'gesture resume was attempted safely');
      assert.ok(result.peak > 0.02 && result.peak < 0.98, 'audible transient without clipping');
      assert.equal(result.afterRms, 0, 'no audio remains beyond the decay window');
      if (result.burst) assert.deepEqual(result.accepted, [true, true, true, true, true, false, true], 'voice cap rejects a sixth overlap and frees ended voices');
      else assert.ok(result.lateRms < result.earlyRms * 0.04, 'resonance decays rapidly rather than ringing');
      console.log(`PASS ${result.sampleRate} Hz ${result.burst ? 'burst' : 'impact'}: peak ${result.peak.toFixed(4)}, early RMS ${result.earlyRms.toFixed(4)}, late RMS ${result.lateRms.toFixed(5)}`);
      if (result.samples) writeWav(process.env.AUDIO_PREVIEW_PATH, result.samples, result.sampleRate);
    }
    assert.deepEqual(errors, [], 'autoplay resume rejection causes no unhandled browser errors');
    console.log('PASS audio: muted/unsupported safety, rapid-trigger limit, voice release, no clipping, short decay');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
