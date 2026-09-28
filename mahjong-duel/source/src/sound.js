const IMPACT_SECONDS = 0.145;
const MAX_VOICES = 5;
const MIN_INTERVAL_SECONDS = 0.025;
const OUTPUT_GAIN = 0.18;

let context;
let impactBank = [];
let lastStart = -Infinity;
const voices = new Set();

const clamp = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

/** Call from a gesture if convenient. Unsupported or muted audio stays silent. */
export function unlockAudio(enabled) {
  if (!enabled || typeof window === 'undefined') return null;
  try {
    if (!context || context.state === 'closed') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext({ latencyHint: 'interactive' });
      impactBank = [];
      voices.clear();
      lastStart = -Infinity;
    }
    if (context.state === 'suspended' || context.state === 'interrupted') {
      // Browsers may reject resume until another gesture. Never leak a rejected
      // promise from optional sound, and let a later interaction retry naturally.
      const resumed = context.resume();
      resumed?.catch?.(() => {});
    }
    return context;
  } catch {
    return null;
  }
}

function makeImpact(audioContext) {
  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, Math.ceil(sampleRate * IMPACT_SECONDS), sampleRate);
  const data = buffer.getChannelData(0);
  const variation = 0.93 + Math.random() * 0.14;
  const reboundAt = 0.005 + Math.random() * 0.003;
  const noiseSmoothing = 1 - Math.exp(-2 * Math.PI * 1900 / sampleRate);
  const dcDamping = Math.exp(-2 * Math.PI * 45 / sampleRate);
  // Short, inharmonic modes give the contact a solid tile body. Their damping
  // removes the sustained pitch that makes an oscillator sound like a bell.
  const modes = [
    [438 * variation, 0.015, 0.30],
    [1093 * variation, 0.023, 0.34],
    [2367 * variation, 0.010, 0.18],
    [3749 * variation, 0.005, 0.07],
  ];
  let coloredNoise = 0;
  let previous = 0;
  let highPassed = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i += 1) {
    const t = i / sampleRate;
    const white = Math.random() * 2 - 1;
    coloredNoise += noiseSmoothing * (white - coloredNoise);
    const contact = Math.exp(-t / 0.0035);
    const rebound = t >= reboundAt ? 0.22 * Math.exp(-(t - reboundAt) / 0.0018) : 0;
    const grain = (white - coloredNoise) * 0.19 + coloredNoise * 0.85;
    let sample = grain * (contact + rebound) * 0.72;
    for (const [frequency, decay, level] of modes) {
      sample += Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t / decay) * level;
    }
    sample *= Math.min(1, t / 0.00035) * Math.min(1, (IMPACT_SECONDS - t) / 0.006);
    highPassed = sample - previous + dcDamping * highPassed;
    previous = sample;
    data[i] = highPassed;
    peak = Math.max(peak, Math.abs(highPassed));
  }
  // A fixed peak plus a five-voice cap keeps even coincident maximum-strength
  // impacts below full scale: 0.9 × 0.18 × 1.2 × 5 = 0.972.
  if (peak > 0) for (let i = 0; i < data.length; i += 1) data[i] *= 0.9 / peak;
  return buffer;
}

function release(voice) {
  if (!voice) return;
  voices.delete(voice);
  try { voice.source.disconnect(); voice.gain.disconnect(); voice.pan?.disconnect(); } catch { /* Already disconnected. */ }
}

/**
 * A dry ceramic/ivory-like tile contact, with a tiny secondary contact and no
 * melodic tail. Sweep: strength 0.45–0.7. Matching collision: strength 1.
 * pan optionally places the impact from -1 (left) to 1 (right).
 * Returns true when a voice is scheduled, false when muted or rate-limited.
 */
export function tileSmack(enabled, options = {}) {
  const audioContext = unlockAudio(enabled);
  if (!audioContext) return false;
  const now = audioContext.currentTime;
  if (now - lastStart < MIN_INTERVAL_SECONDS || voices.size >= MAX_VOICES) return false;
  let voice;
  try {
    const strength = clamp(options?.strength, 0, 1.2, 1);
    if (strength === 0) return false;
    // Warm the small variation bank gradually so the first gesture is immediate.
    if (impactBank.length < 8) impactBank.push(makeImpact(audioContext));
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const pan = typeof audioContext.createStereoPanner === 'function' ? audioContext.createStereoPanner() : null;
    source.buffer = impactBank[Math.floor(Math.random() * impactBank.length)];
    gain.gain.setValueAtTime(OUTPUT_GAIN * strength, now);
    source.connect(gain);
    if (pan) {
      pan.pan.setValueAtTime(clamp(options?.pan, -1, 1, 0), now);
      gain.connect(pan); pan.connect(audioContext.destination);
    } else gain.connect(audioContext.destination);
    voice = { source, gain, pan };
    voices.add(voice);
    source.onended = () => release(voice);
    source.start(now);
    lastStart = now;
    return true;
  } catch {
    release(voice);
    return false;
  }
}

/** Existing call sites keep their API while all feedback uses the same material. */
export function chime(kind, enabled) {
  const strength = kind === 'match' ? 1 : kind === 'win' ? 1.15 : kind === 'error' ? 0.28 : 0.42;
  return tileSmack(enabled, { strength });
}

let cancelProgressSound = () => {};
let progressSoundKind = null;
let progressSoundUntil = -Infinity;
/** One quiet, cancellable musical response, sharing the tile audio context/voice budget. */
export function playProgressSound(cue, enabled) {
  const silent = () => {};
  if (!enabled || (typeof document !== 'undefined' && document.hidden) ||
      (typeof cue === 'object' && (cue?.actor !== 'you' || cue?.owner !== 'you'))) return silent;
  const audioContext = unlockAudio(enabled);
  // Never queue a flourish on a suspended context to surprise the player later.
  if (!audioContext || audioContext.state !== 'running' || typeof audioContext.createOscillator !== 'function') return silent;
  const count = typeof cue === 'object' ? clamp(cue.count, 2, 15, 2) : 2;
  const intensity = (count - 2) / 13;
  const turning = cue?.family === 'turning';
  const id = typeof cue === 'string' ? cue : cue?.id;
  // Unlocks have their own short signature. Rapid subsequent streaks stay silent
  // during it, without queuing a stale flourish or cutting the medal chime short.
  if (id !== 'achievement' && progressSoundKind === 'achievement' && audioContext.currentTime < progressSoundUntil) return silent;
  let notes;
  if (id === 'achievement') notes = [[659.25, 0, .38], [987.77, .085, .42], [1318.51, .19, .6], [783.99, .23, .7]];
  else if (id === 'rank') notes = [[392, 0, .3], [493.88, .18, .35], [587.33, .38, .5], [783.99, .62, .55]];
  else if (id === 'promotion') notes = [[261.63, 0, 1.15], [392, .08, 1], [523.25, .19, .9], [783.99, .32, .85]];
  else if (turning) {
    const phrases = {
      turning_lead_five: [[392, 0, .45], [493.88, 0, .43], [587.33, .05, .46]],
      turning_four_to_win: [[392, 0, .24], [440, .09, .26], [523.25, .18, .3], [659.25, .27, .38]],
      turning_recover_four: [[349.23, 0, .27], [440, .08, .34], [523.25, .16, .43]],
      turning_comeback_lead: [[293.66, 0, .5], [440, .07, .4], [587.33, .15, .49], [880, .24, .48]],
      turning_equalize: [[440, 0, .44], [660, 0, .44]],
      turning_draw_only: [[392, 0, .6], [523.25, .05, .6], [587.33, .1, .57]],
      turning_win_secured: [[261.63, 0, .72], [392, .05, .67], [523.25, .12, .66], [783.99, .22, .62]],
      turning_draw_final: [[392, 0, .64], [523.25, 0, .64], [659.25, .15, .64], [783.99, .15, .64]],
    };
    notes = phrases[id];
  } else if (cue?.family === 'chain') {
    const fundamental = 480 + count * 18;
    if (cue.reinforcement) notes = [[fundamental, 0, .24], [fundamental * 1.5, .05, .26]];
    else {
      notes = [[fundamental, 0, .23 + intensity * .18], [fundamental * 1.25, .035 + intensity * .02, .28 + intensity * .2]];
      if (count >= 5) notes.push([fundamental * 1.5, .10 + intensity * .04, .26 + intensity * .26]);
      if (count >= 9) notes.push([cue.peak ? fundamental * 2 : 165 + count * 2, .18, cue.peak ? .65 : .4]);
    }
  }
  if (!notes?.length) return silent;
  cancelProgressSound();
  const scheduled = [], now = audioContext.currentTime;
  let stopped = false;
  const cancel = () => {
    if (stopped) return;
    stopped = true;
    for (const voice of scheduled) {
      try { voice.gain.gain.cancelScheduledValues(audioContext.currentTime); voice.gain.gain.setValueAtTime(0, audioContext.currentTime); voice.source.stop(); } catch { /* Optional audio may already have ended. */ }
      release(voice);
    }
    if (cancelProgressSound === cancel) { progressSoundKind = null; progressSoundUntil = -Infinity; }
  };
  cancelProgressSound = cancel;
  progressSoundKind = id;
  progressSoundUntil = now + Math.max(...notes.map(([, delay, duration]) => delay + duration)) + .025;
  try {
    // Each oscillator is <= .034; sharing the five-voice cap leaves headroom even
    // with maximum-strength tile impacts (four .1944 impacts plus one .034 tone).
    for (const [frequency, delay, duration] of notes.slice(0, Math.max(0, MAX_VOICES - voices.size))) {
      const source = audioContext.createOscillator(), gain = audioContext.createGain();
      const voice = { source, gain, pan: null };
      scheduled.push(voice); voices.add(voice);
      source.type = id === 'achievement' || frequency < 230 ? 'sine' : 'triangle';
      source.frequency.setValueAtTime(frequency, now + delay);
      source.frequency.exponentialRampToValueAtTime(frequency * 1.006, now + delay + duration);
      const amplitude = frequency < 230 ? .012 : .027 + intensity * .007;
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(amplitude, now + delay + .013);
      gain.gain.exponentialRampToValueAtTime(.0001, now + delay + duration);
      source.connect(gain); gain.connect(audioContext.destination);
      source.onended = () => release(voice);
      source.start(now + delay); source.stop(now + delay + duration + .025);
    }
  } catch { cancel(); }
  return cancel;
}
