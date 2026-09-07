import test from 'node:test';
import assert from 'node:assert/strict';
import { bindAimInput } from '../public/aim-input.js';

function rig({ synchronousCaptureLoss = false } = {}) {
  const listeners = new Map(), samples = [], releases = [];
  let canceled = 0, enabled = true;
  const canvas = {
    addEventListener(type, handler) { listeners.set(type, handler); },
    focus() {}, setPointerCapture() {},
    releasePointerCapture(pointerId) {
      if (synchronousCaptureLoss) dispatch('lostpointercapture', 0, 0, pointerId);
    },
  };
  const controls = bindAimInput(canvas, {
    canStart: () => enabled, canContinue: () => enabled,
    start() {}, move(event, sample) { samples.push(sample); },
    finish(event, sample) { releases.push(sample); },
    cancel() { canceled++; },
  });
  function dispatch(type, clientX, clientY, pointerId = 1) {
    listeners.get(type)({ type, clientX, clientY, pointerId, button: 0, preventDefault() {} });
  }
  return { dispatch, samples, releases, controls, get canceled() { return canceled; }, disable() { enabled = false; } };
}

test('a short pull releases with its final coordinates even without any move event', () => {
  const r = rig();
  r.dispatch('pointerdown', 100, 100);
  r.dispatch('pointerup', 75, 106);
  assert.equal(r.releases.length, 1);
  assert.equal(r.samples.length, 1);
  assert.equal(r.releases[0].dx, -25);
  assert.equal(r.releases[0].dy, 6);
  assert.ok(r.releases[0].distance > 25 && r.releases[0].distance < 26);
  assert.equal(r.canceled, 0);
});

test('synchronous lostpointercapture during release cannot erase or duplicate a shot', () => {
  const r = rig({ synchronousCaptureLoss: true });
  r.dispatch('pointerdown', 100, 100);
  r.dispatch('pointermove', 70, 110);
  r.dispatch('pointerup', 55, 115);
  r.dispatch('lostpointercapture', 55, 115);
  r.dispatch('pointerup', 55, 115);
  assert.equal(r.releases.length, 1);
  assert.equal(r.releases[0].dx, -45);
  assert.equal(r.canceled, 0);
});

test('the final sample supersedes a previous full-power pull', () => {
  const r = rig();
  r.dispatch('pointerdown', 200, 100);
  r.dispatch('pointermove', 50, 160);
  r.dispatch('pointerup', 180, 108);
  assert.equal(r.releases[0].dx, -20);
  assert.equal(r.releases[0].dy, 8);
});

test('canceled touches and turns that expire before release never fire', () => {
  const r = rig({ synchronousCaptureLoss: true });
  r.dispatch('pointerdown', 100, 100);
  r.dispatch('pointercancel', 75, 106);
  r.dispatch('pointerup', 75, 106);
  assert.equal(r.canceled, 1);
  assert.equal(r.releases.length, 0);
  r.dispatch('pointerdown', 100, 100);
  r.disable();
  r.dispatch('pointerup', 50, 120);
  assert.equal(r.canceled, 2);
  assert.equal(r.releases.length, 0);
});

test('another finger cannot take ownership of an active pull', () => {
  const r = rig();
  r.dispatch('pointerdown', 100, 100, 1);
  r.dispatch('pointerdown', 300, 300, 2);
  r.dispatch('pointermove', 400, 400, 2);
  r.dispatch('pointerup', 400, 400, 2);
  assert.equal(r.releases.length, 0);
  r.dispatch('pointerup', 80, 105, 1);
  assert.equal(r.releases[0].dx, -20);
});

test('an explicit aim cancel discards capture without a subsequent release', () => {
  const r = rig({ synchronousCaptureLoss: true });
  r.dispatch('pointerdown', 100, 100);
  r.controls.cancel();
  r.dispatch('pointerup', 50, 110);
  assert.equal(r.releases.length, 0);
  assert.equal(r.canceled, 0);
});
