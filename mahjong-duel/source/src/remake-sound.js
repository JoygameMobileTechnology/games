import { unlockAudio } from './sound.js';

// Short synthesized effects: no network, autoplay, or looping audio.
export function playEffect(kind, enabled) {
  const ctx = unlockAudio(enabled);
  if (!ctx) return;
  const now = ctx.currentTime;
  if (kind === 'doors' || kind === 'shuffle') {
    const duration = kind === 'doors' ? .8 : .38;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / data.length) ** 2;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(450, now); filter.frequency.exponentialRampToValueAtTime(1800, now + duration * .4); filter.frequency.exponentialRampToValueAtTime(160, now + duration);
    gain.gain.value = .065; source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.start(now); source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    return;
  }
  const cues = {
    'opponent-reveal': { notes: [659.25, 987.77], step: .08, length: .24, gain: .04 },
    faceoff: { notes: [196, 783.99, 1174.66], step: .018, length: .18, gain: .04 },
    'duel-start': { notes: [523.25, 783.99, 1046.5], step: .065, length: .23, gain: .04 },
    score: { notes: [1174.66, 1567.98], step: .035, length: .12, gain: .028 },
    turn: { notes: [740, 493.88], step: .075, length: .15, gain: .035 },
  };
  const cue = cues[kind] || { notes: kind === 'win' ? [523.25, 659.25, 783.99, 1046.5] : [880, 1320], step: kind === 'win' ? .115 : .075, length: .32, gain: .055 };
  const notes = cue.notes;
  notes.forEach((frequency, i) => {
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    const start = now + i * cue.step;
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(cue.gain, start + .006); gain.gain.exponentialRampToValueAtTime(.0001, start + cue.length);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start + cue.length + .03);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
