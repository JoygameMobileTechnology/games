export const MAX_AUDIO_VOICES = 24;
export type CharacterSoundEvent = "jump" | "hurt" | "death" | "land";
export const CHARACTER_VOICES = Object.freeze({
  mordant: { pitch: 74, formants: [360, 1150], wave: "sawtooth", breath: 0.22 },
  vesper: { pitch: 146, formants: [760, 2450], wave: "triangle", breath: 0.48 },
  karn: { pitch: 52, formants: [250, 780], wave: "sawtooth", breath: 0.62 },
  nyx: { pitch: 192, formants: [1080, 3200], wave: "triangle", breath: 0.3 },
  grim: { pitch: 94, formants: [560, 1880], wave: "square", breath: 0.44 },
  malice: { pitch: 121, formants: [470, 2910], wave: "sawtooth", breath: 0.7 },
  seraph: { pitch: 224, formants: [890, 1810], wave: "triangle", breath: 0.2 },
} satisfies Record<string, {
  pitch: number; formants: number[]; wave: OscillatorType; breath: number;
}>);

interface Layer {
  noise?: boolean;
  frequency: number;
  end: number;
  level: number;
  type?: OscillatorType;
  filter?: { type: BiquadFilterType; frequency: number; q: number };
}
interface Voice {
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  finished: boolean;
}

export class Sound {
  private context?: AudioContext;
  private noise?: AudioBuffer;
  private voices = new Set<Voice>();
  private seed = 0x61756469;
  private disposed = false;
  private step = 0;
  volume = 0.45;
  get activeVoiceCount() { return this.voices.size; }
  private random() {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967296;
  }
  unlock() {
    if (this.disposed) return;
    if (!this.context) {
      this.context = new AudioContext();
      const count = Math.floor(this.context.sampleRate);
      this.noise = this.context.createBuffer(1, count, this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < count; i++) data[i] = this.random() * 2 - 1;
    }
    void this.context.resume().catch(() => {});
  }
  tone(
    frequency: number,
    duration: number,
    level = 0.1,
    end = frequency,
    type: OscillatorType = "sine",
  ) {
    this.play(duration, [{ frequency, end, level, type }]);
  }
  blast(level: number, duration: number, frequency = 1200) {
    this.play(duration, [{
      noise: true, frequency, end: frequency, level,
      filter: { type: "lowpass", frequency, q: 0.7 },
    }]);
  }

  private finish(voice: Voice) {
    if (voice.finished) return;
    voice.finished = true;
    this.voices.delete(voice);
    for (const source of voice.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* A naturally ended source needs no stop. */ }
    }
    for (const node of voice.nodes) node.disconnect();
  }

  private play(duration: number, layers: readonly Layer[], distance = 0, pan = 0) {
    const ctx = this.context;
    if (!ctx || !this.noise || this.disposed || this.volume <= 0 ||
      !Number.isFinite(duration + distance + pan + this.volume) || duration <= 0 || distance >= 55) return;
    const valid = layers.slice(0, 4).filter((layer) =>
      layer.level > 0 && Number.isFinite(layer.frequency + layer.end + layer.level) &&
      (!layer.filter || Number.isFinite(layer.filter.frequency + layer.filter.q)),
    );
    if (!valid.length) return;
    while (this.voices.size >= MAX_AUDIO_VOICES) this.finish(this.voices.values().next().value!);
    const length = Math.max(0.015, Math.min(duration, 2));
    const attenuation = (1 - Math.max(0, distance) / 55) ** 2;
    const master = ctx.createGain();
    master.gain.value = Math.min(1, this.volume) * attenuation;
    const voice: Voice = { sources: [], nodes: [master], finished: false };
    if (typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      master.connect(panner).connect(ctx.destination);
      voice.nodes.push(panner);
    } else master.connect(ctx.destination);
    this.voices.add(voice);
    let remaining = valid.length;
    for (const layer of valid) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(Math.min(0.8, layer.level), ctx.currentTime + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + length);
      gain.connect(master);
      voice.nodes.push(gain);
      const source = layer.noise ? ctx.createBufferSource() : ctx.createOscillator();
      if (layer.noise) {
        const noise = source as AudioBufferSourceNode;
        noise.buffer = this.noise!;
        noise.loop = true;
      } else {
        const oscillator = source as OscillatorNode;
        oscillator.type = layer.type ?? "sine";
        oscillator.frequency.setValueAtTime(Math.max(10, Math.min(12000, layer.frequency)), ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(10, Math.min(12000, layer.end)), ctx.currentTime + length,
        );
      }
      if (layer.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = layer.filter.type;
        filter.frequency.value = Math.max(30, Math.min(ctx.sampleRate * 0.45, layer.filter.frequency));
        filter.Q.value = Math.max(0.1, Math.min(12, layer.filter.q));
        source.connect(filter).connect(gain);
        voice.nodes.push(filter);
      } else source.connect(gain);
      voice.sources.push(source);
      voice.nodes.push(source);
      source.onended = () => { if (--remaining === 0) this.finish(voice); };
      source.start();
      source.stop(ctx.currentTime + length);
    }
  }

  /** Procedural creature vocals: voiced formants, breath and a subharmonic body. */
  character(event: CharacterSoundEvent, characterId: string, distance = 0, pan = 0) {
    const voice = CHARACTER_VOICES[characterId as keyof typeof CHARACTER_VOICES] ?? CHARACTER_VOICES.mordant;
    const contours = {
      jump: { duration: 0.22, start: 0.9, end: 1.45, level: 0.16 },
      hurt: { duration: 0.31, start: 1.4, end: 0.7, level: 0.21 },
      death: { duration: 0.78, start: 1.18, end: 0.32, level: 0.24 },
      land: { duration: 0.12, start: 0.65, end: 0.45, level: 0.09 },
    }[event];
    if (!contours) return;
    const pitch = voice.pitch * (0.97 + this.random() * 0.06);
    this.play(contours.duration, [
      { frequency: pitch * contours.start, end: pitch * contours.end,
        level: contours.level, type: voice.wave,
        filter: { type: "bandpass", frequency: voice.formants[0], q: 1.1 } },
      { frequency: pitch * 2.01 * contours.start, end: pitch * 2 * contours.end,
        level: contours.level * 0.55, type: voice.wave,
        filter: { type: "bandpass", frequency: voice.formants[1], q: 0.8 } },
      { noise: true, frequency: voice.formants[1], end: voice.formants[1],
        level: contours.level * voice.breath,
        filter: { type: "bandpass", frequency: voice.formants[1], q: 1.8 } },
      { frequency: pitch * 0.5, end: pitch * contours.end * 0.5,
        level: contours.level * 0.22, type: "triangle" },
    ], distance, pan);
  }

  gore(distance = 0, pan = 0) {
    this.play(0.23, [
      { noise: true, frequency: 550, end: 550, level: 0.2,
        filter: { type: "bandpass", frequency: 550, q: 0.8 } },
      { noise: true, frequency: 1800, end: 1800, level: 0.07,
        filter: { type: "bandpass", frequency: 1800, q: 2 } },
      { frequency: 75, end: 24, level: 0.1, type: "triangle" },
    ], distance, pan);
  }

  footstep(characterId: string, distance = 0, pan = 0) {
    const voice = CHARACTER_VOICES[characterId as keyof typeof CHARACTER_VOICES] ?? CHARACTER_VOICES.mordant;
    const heel = this.step++ % 2 ? 0.86 : 1;
    this.play(0.075, [
      { noise: true, frequency: 600 + voice.pitch * 2, end: 400, level: 0.07 * heel,
        filter: { type: "lowpass", frequency: 600 + voice.pitch * 2, q: 0.8 } },
      { frequency: voice.pitch * 0.9, end: voice.pitch * 0.4,
        level: 0.04 * heel, type: "triangle" },
    ], distance, pan);
  }

  clear() {
    for (const voice of [...this.voices]) this.finish(voice);
  }

  dispose() {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    void this.context?.close().catch(() => {});
    this.context = undefined;
    this.noise = undefined;
  }
  shot(weapon: string, distant = false) {
    const level = distant ? 0.045 : 0.17;
    switch (weapon) {
      case "melee":
        this.blast(level * 0.65, 0.09, 1100);
        this.tone(180, 0.09, level * 0.45, 60, "triangle");
        break;
      case "rail":
        this.tone(1000, 0.35, level, 70, "sawtooth");
        break;
      case "rocket":
        this.blast(level * 1.3, 0.24, 500);
        this.tone(110, 0.22, level, 25);
        break;
      case "shotgun":
        this.blast(level * 1.35, 0.19, 2800);
        this.tone(95, 0.16, level * 0.9, 25, "triangle");
        break;
      case "lightning":
        this.tone(900, 0.055, level * 0.45, 1400, "sawtooth");
        this.blast(level * 0.4, 0.045, 4000);
        break;
      case "grenade":
        this.tone(170, 0.14, level, 40, "triangle");
        this.blast(level * 0.6, 0.09, 700);
        break;
      case "plasma":
        this.tone(640, 0.1, level * 0.7, 160, "sine");
        this.tone(1300, 0.075, level * 0.25, 310, "triangle");
        break;
      case "bfg":
        this.tone(140, 0.24, level * 0.8, 35, "sawtooth");
        this.blast(level * 1.1, 0.25, 950);
        break;
      case "nailgun":
        this.blast(level * 0.8, 0.11, 3200);
        this.tone(240, 0.08, level * 0.55, 80, "square");
        break;
      case "proximity":
        this.tone(310, 0.12, level * 0.65, 75, "triangle");
        this.blast(level * 0.45, 0.075, 550);
        break;
      case "chaingun":
        this.blast(level * 0.65, 0.045, 1900);
        this.tone(85, 0.045, level * 0.55, 35, "triangle");
        break;
      default:
        this.blast(level, 0.075, 2400);
        this.tone(110, 0.07, level, 30, "triangle");
    }
  }

  hit() {
    this.tone(850, 0.045, 0.14, 650);
  }
  pickup() {
    this.tone(420, 0.17, 0.12, 1000, "triangle");
  }
  hurt() {
    this.blast(0.16, 0.17, 550);
  }
  kill() {
    this.tone(150, 0.26, 0.2, 50, "sawtooth");
  }
}
