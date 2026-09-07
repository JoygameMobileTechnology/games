import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../public/audio.js';

function score(event) {
  const audio = new GameAudio(), notes = [];
  audio.tone = (...args) => notes.push({ kind: 'tone', args });
  audio.noise = (...args) => notes.push({ kind: 'noise', args });
  audio.event(event);
  return notes;
}

test('cosmic weapons have distinct sound scores and bounded satellite/pulse accents', () => {
  const [moon, saturn, star] = ['moon', 'saturn', 'star'].map(weaponId => score({ type: 'explosion', weaponId }));
  assert.notDeepEqual(moon, saturn);
  assert.notDeepEqual(saturn, star);
  for (const notes of [moon, saturn, star]) assert.ok(notes.length >= 6 && notes.length <= 10);
  assert.equal(score({ type: 'explosion', weaponId: 'saturn', child: true }).length, 2);
  for (let pulse = 1; pulse < 5; pulse++) assert.equal(score({ type: 'explosion', weaponId: 'star', pulse }).length, 2);
  const core = score({ type: 'core-destroyed' });
  const crack = core.find(note => note.kind === 'noise');
  assert.equal(crack.args[2].delay, .58, 'the core crack aligns with the visible rupture');
  assert.ok(!core.some(note => note.args[0] === 523), 'the result fanfare is a separate event');
});

test('cosmic and simultaneous core sounds stay bounded, mute immediately, and retire all voices', async t => {
  const previous = globalThis.window, sources = [];
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  const param = () => ({ value: 0, setValueAtTime(value) { this.value = value; }, setTargetAtTime(value) { this.value = value; }, exponentialRampToValueAtTime(value) { assert.ok(value > 0); this.value = value; } });
  const node = () => ({ connect() {}, disconnect() {} });
  class AudioContext {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; }
    createDynamicsCompressor() { return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; }
    createGain() { return { ...node(), gain: param() }; }
    createBuffer(channels, size) { return { getChannelData: () => new Float32Array(size) }; }
    source() { const source = { ...node(), frequency: param(), start() {}, stop() {} }; sources.push(source); return source; }
    createOscillator() { return this.source(); }
    createBufferSource() { return this.source(); }
    createBiquadFilter() { return { ...node(), frequency: param() }; }
  }
  globalThis.window = { AudioContext };
  const audio = new GameAudio();
  audio.setEnabled(true); await audio.unlock();
  audio.event({ type: 'explosion', weaponId: 'star' });
  audio.event({ type: 'core-destroyed', side: 0 });
  audio.event({ type: 'core-destroyed', side: 1 });
  assert.ok(audio.voices > 15 && audio.voices <= 36);
  for (let i = 0; i < 20; i++) audio.event({ type: 'core-destroyed' });
  assert.equal(audio.voices, 36);
  audio.setEnabled(false);
  assert.equal(audio.master.gain.value, 0);
  const count = sources.length;
  audio.event({ type: 'core-destroyed' });
  assert.equal(sources.length, count);
  for (const source of sources) source.onended?.();
  assert.equal(audio.voices, 0);
});


test('drowning ends with one second of gulps and resumes only the remaining audio', () => {
  const full = score({ type: 'drowning-finale', ageMs: 0 });
  assert.equal(full.filter(note => note.kind === 'tone').length, 3);
  const end = Math.max(...full.map(note => note.kind === 'tone' ? note.args[2] + (note.args[5] || 0) + .03 : note.args[0] + (note.args[2]?.delay || 0) + .03));
  assert.equal(end, 1);
  const resumed = score({ type: 'drowning-finale', ageMs: 700 });
  assert.equal(resumed.filter(note => note.kind === 'tone').length, 2);
  assert.ok(resumed.every(note => note.kind === 'tone' ? note.args[2] + (note.args[5] || 0) <= .3 : note.args[0] + (note.args[2]?.delay || 0) <= .3));
  assert.deepEqual(score({ type: 'drowning-finale', ageMs: 1000 }), []);
});
