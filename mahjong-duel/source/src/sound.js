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
