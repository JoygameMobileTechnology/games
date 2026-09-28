import test from 'node:test';
import assert from 'node:assert/strict';

let version = 0;
async function audioFixture(t, { state = 'running', unsupported = false } = {}) {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  const sources = [], gains = [];
  const param = () => ({ values: [], setValueAtTime(value, at) { this.values.push({ value, at }); },
    exponentialRampToValueAtTime(value, at) { this.values.push({ value, at }); },
    linearRampToValueAtTime(value, at) { this.values.push({ value, at }); }, cancelScheduledValues() {} });
  class AudioContext {
    constructor() { this.state = state; this.currentTime = 0; this.destination = {}; AudioContext.instance = this; }
    resume() { return Promise.resolve(); }
    createGain() { const node = { gain: param(), connect() {}, disconnect() {} }; gains.push(node); return node; }
    createOscillator() {
      const node = { frequency: param(), type: '', starts: [], stops: [], connect() {}, disconnect() {},
        start(at) { this.starts.push(at); }, stop(at) { this.stops.push(at); if (at === undefined) this.onended?.(); } };
      sources.push(node); return node;
    }
  }
  globalThis.window = unsupported ? {} : { AudioContext };
  globalThis.document = { hidden: false };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  });
  const sound = await import(`../src/sound.js?achievement-audio=${++version}`);
  return { ...sound, sources, gains, AudioContext };
}

test('achievement unlock has its own bounded bell phrase, distinct from ranking feedback', async t => {
  const fixture = await audioFixture(t);
  const cancel = fixture.playProgressSound('achievement', true);
  assert.equal(fixture.sources.length, 4);
  assert.ok(fixture.sources.every(source => source.type === 'sine'));
  const unlockNotes = fixture.sources.map(source => source.frequency.values[0].value);
  assert.deepEqual(unlockNotes, [659.25, 987.77, 1318.51, 783.99]);
  assert.ok(fixture.gains.every(node => Math.max(...node.gain.values.map(value => value.value)) <= .034));
  cancel(); cancel();
  assert.ok(fixture.sources.every(source => source.stops.filter(value => value === undefined).length === 1), 'cancellation is idempotent');
  fixture.AudioContext.instance.currentTime = 2;
  fixture.playProgressSound('rank', true)();
  const rankNotes = fixture.sources.slice(4).map(source => source.frequency.values[0].value);
  assert.notDeepEqual(rankNotes, unlockNotes);
});

test('rapid streaks and muted calls cannot cut the achievement signature short or queue delayed audio', async t => {
  const fixture = await audioFixture(t);
  const cancel = fixture.playProgressSound('achievement', true);
  const chain = { actor: 'you', owner: 'you', family: 'chain', id: 'chain_03', count: 3 };
  fixture.AudioContext.instance.currentTime = .2;
  fixture.playProgressSound(chain, true)();
  fixture.playProgressSound('rank', false)();
  assert.equal(fixture.sources.length, 4, 'suppressed responses schedule nothing');
  assert.ok(fixture.sources.every(source => !source.stops.includes(undefined)), 'active unlock is not cancelled');
  cancel();
  fixture.playProgressSound(chain, true)();
  assert.equal(fixture.sources.length, 6, 'explicit cancellation releases priority and the shared voice budget');
});

test('achievement sound stays silent when muted, hidden, suspended or unsupported', async t => {
  const fixture = await audioFixture(t);
  fixture.playProgressSound('achievement', false)();
  globalThis.document.hidden = true;
  fixture.playProgressSound('achievement', true)();
  assert.equal(fixture.sources.length, 0);
  globalThis.document.hidden = false;
  const context = fixture.unlockAudio(true); context.state = 'suspended';
  fixture.playProgressSound('achievement', true)();
  assert.equal(fixture.sources.length, 0, 'never schedule a delayed sound on a suspended context');
  context.state = 'closed'; globalThis.window = {};
  assert.doesNotThrow(() => fixture.playProgressSound('achievement', true)());
  assert.equal(fixture.sources.length, 0);
});

test('ordinary progression feedback resumes after the short unlock priority window', async t => {
  const fixture = await audioFixture(t);
  fixture.playProgressSound('achievement', true);
  fixture.AudioContext.instance.currentTime = 1;
  const cancel = fixture.playProgressSound('rank', true);
  assert.equal(fixture.sources.length, 8);
  assert.ok(fixture.sources.slice(0, 4).every(source => source.stops.includes(undefined)));
  cancel();
});
