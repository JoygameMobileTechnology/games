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
  const notes = kind === 'win' ? [523.25, 659.25, 783.99, 1046.5] : kind === 'turn' ? [523.25, 659.25] : [880, 1320];
  notes.forEach((frequency, i) => {
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    const start = now + i * (kind === 'win' ? .115 : .075);
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.055, start + .006); gain.gain.exponentialRampToValueAtTime(.0001, start + .32);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start + .35);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  });
}
