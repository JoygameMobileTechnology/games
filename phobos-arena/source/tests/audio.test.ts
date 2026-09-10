import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { Sound, CHARACTER_VOICES, MAX_AUDIO_VOICES } from "../src/audio.ts";

class Param {
  value = 0;
  changes: number[] = [];
  setValueAtTime(value: number, at: number) { this.changes.push(value, at); this.value = value; }
  exponentialRampToValueAtTime(value: number, at: number) { this.changes.push(value, at); }
  linearRampToValueAtTime(value: number, at: number) { this.changes.push(value, at); }
}
class Node {
  disconnected = false;
  gain = new Param(); frequency = new Param(); Q = new Param(); pan = new Param();
  type = ""; loop = false; buffer: unknown;
  onended: (() => void) | null = null;
  stopTimes: number[] = [];
  constructor(readonly kind: string) {}
  connect<T extends Node>(node: T): T { return node; }
  disconnect() { this.disconnected = true; }
  start() {}
  stop(at = 0) { this.stopTimes.push(at); }
}
class Context {
  sampleRate = 8000;
  currentTime = 0;
  destination = new Node("destination");
  nodes: Node[] = [];
  noise = new Float32Array(0);
  closed = false;
  node(kind: string) { const node = new Node(kind); this.nodes.push(node); return node; }
  createGain() { return this.node("gain"); }
  createOscillator() { return this.node("oscillator"); }
  createBufferSource() { return this.node("noise"); }
  createBiquadFilter() { return this.node("filter"); }
  createStereoPanner() { return this.node("pan"); }
  createBuffer(_channels: number, count: number) {
    this.noise = new Float32Array(count);
    return { getChannelData: () => this.noise };
  }
  resume() { return Promise.resolve(); }
  close() { this.closed = true; return Promise.resolve(); }
}
function harness(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  const contexts: Context[] = [];
  class AudioContext extends Context { constructor() { super(); contexts.push(this); } }
  Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: AudioContext });
  const sound = new Sound();
  t.after(() => {
    sound.dispose();
    if (previous) Object.defineProperty(globalThis, "AudioContext", previous);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  });
  return { sound, contexts };
}

test("seven procedural voices have distinct finite formants and layered directional events", (t) => {
  const { sound, contexts } = harness(t);
  assert.equal(Object.keys(CHARACTER_VOICES).length, 7);
  assert.equal(new Set(Object.values(CHARACTER_VOICES).map((voice) => JSON.stringify(voice))).size, 7);
  sound.unlock();
  const ctx = contexts[0];
  for (const id of Object.keys(CHARACTER_VOICES)) {
    for (const event of ["jump", "hurt", "death", "land"] as const) {
      const before = ctx.nodes.length;
      sound.character(event, id, 8, -0.75);
      const created = ctx.nodes.slice(before);
      assert.equal(created.filter((node) => node.kind === "oscillator").length, 3);
      assert.equal(created.filter((node) => node.kind === "noise").length, 1);
      assert.equal(created.find((node) => node.kind === "pan")!.pan.value, -0.75);
      assert.ok(created.filter((node) => node.kind === "filter").length >= 3);
    }
  }
  for (const node of ctx.nodes)
    for (const param of [node.gain, node.frequency, node.Q, node.pan])
      assert.ok([param.value, ...param.changes].every(Number.isFinite));
});

test("audio is gesture-unlocked, distance-attenuated, muted and safe for invalid parameters", (t) => {
  const { sound, contexts } = harness(t);
  sound.character("hurt", "mordant");
  assert.equal(contexts.length, 0);
  sound.unlock();
  const ctx = contexts[0];
  sound.gore(0, 2);
  const closeGain = ctx.nodes.find((node) => node.kind === "gain")!.gain.value;
  assert.equal(ctx.nodes.find((node) => node.kind === "pan")!.pan.value, 1);
  const start = ctx.nodes.length;
  sound.gore(30, 0);
  const farGain = ctx.nodes.slice(start).find((node) => node.kind === "gain")!.gain.value;
  assert.ok(farGain < closeGain);
  const count = ctx.nodes.length;
  sound.gore(55); sound.gore(Infinity); sound.tone(NaN, 1);
  sound.volume = 0;
  sound.footstep("karn"); sound.hit();
  assert.equal(ctx.nodes.length, count);
});

test("audio caps polyphony and disconnects every layer on completion, clear and dispose", (t) => {
  const { sound, contexts } = harness(t);
  sound.unlock();
  const ctx = contexts[0];
  for (let i = 0; i < 100; i++) sound.character("death", "malice");
  assert.equal(sound.activeVoiceCount, MAX_AUDIO_VOICES);
  assert.ok(ctx.nodes[0].disconnected, "oldest voices are retired under pressure");
  for (const node of ctx.nodes) if (!node.disconnected && node.onended) node.onended();
  assert.equal(sound.activeVoiceCount, 0);
  assert.ok(ctx.nodes.every((node) => node.disconnected));
  sound.footstep("nyx"); sound.gore(); sound.shot("rocket");
  sound.clear();
  assert.equal(sound.activeVoiceCount, 0);
  assert.ok(ctx.nodes.every((node) => node.disconnected));
  sound.character("jump", "seraph");
  sound.dispose(); sound.dispose();
  assert.equal(ctx.closed, true);
  assert.equal(sound.activeVoiceCount, 0);
  const count = ctx.nodes.length;
  sound.unlock(); sound.hit();
  assert.equal(ctx.nodes.length, count);
});

test("audio noise and voice variations never advance gameplay randomness", (t) => {
  const { sound, contexts } = harness(t);
  t.mock.method(Math, "random", () => { throw new Error("audio must use a private RNG"); });
  sound.unlock();
  sound.character("hurt", "vesper");
  sound.footstep("grim"); sound.gore();
  assert.ok(contexts[0].noise.some((sample) => sample !== 0));
  assert.ok(contexts[0].noise.every((sample) => sample >= -1 && sample <= 1));
});
