import { COSMIC_EFFECT_MS, CORE_DESTRUCTION_MS } from '/shared/presentation.js';

const TAU = Math.PI * 2;
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const random = n => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
const TEAM = ['#4db7a1', '#ed8467'];
export const FINISH_PLAYBACK_MS = 700;
const eventId = event => event.id ?? `${event.type}:${event.weaponId}:${event.at}:${event.x}:${event.y}:${event.pulse || 0}`;
const disk = (c, x, y, r, color) => { c.fillStyle = color; c.beginPath(); c.arc(x, y, Math.max(.01, r), 0, TAU); c.fill(); };
function glow(c, radius, inner, outer = '#ffffff00') {
  const paint = c.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, radius));
  paint.addColorStop(0, inner); paint.addColorStop(1, outer);
  disk(c, 0, 0, radius, paint);
}
function ring(c, radius, squash, color, width = 3, rotation = 0, start = 0, end = TAU) {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath();
  c.ellipse(0, 0, Math.max(.01, radius), Math.max(.01, radius * squash), rotation, start, end); c.stroke();
}
function diamond(c, radius, color, edge = '#fff2b0') {
  c.beginPath(); c.moveTo(0, -radius); c.lineTo(radius * .65, 0); c.lineTo(0, radius); c.lineTo(-radius * .65, 0); c.closePath();
  c.fillStyle = color; c.fill(); c.strokeStyle = edge; c.lineWidth = 2; c.stroke();
  c.beginPath(); c.moveTo(0, -radius); c.lineTo(0, radius); c.moveTo(-radius * .65, 0); c.lineTo(radius * .65, 0); c.stroke();
}
function moonBody(c, radius) {
  disk(c, 0, 0, radius, '#e6eff0');
  c.strokeStyle = '#718c9e'; c.lineWidth = 3; c.stroke();
  for (const [x, y, size] of [[-.35, -.3, .21], [.3, .18, .26], [-.22, .48, .12], [.3, -.48, .1]]) {
    disk(c, x * radius, y * radius, size * radius, '#b1c9d3');
    c.strokeStyle = '#91adbd'; c.lineWidth = 2; c.beginPath(); c.arc(x * radius, y * radius, size * radius, Math.PI * .95, Math.PI * 1.9); c.stroke();
  }
}

// A small, bounded presentation layer. Positions are analytic functions of wall time,
// so reconnecting or suspending a phone resumes the finale instead of replaying it.
export class ImpactEffects {
  constructor() { this.items = []; this.seen = new Set(); }
  reset() { this.items = []; this.seen.clear(); }
  add(event, ageMs = 0, now = performance.now()) {
    const kind = event.type === 'core-destroyed' ? 'core' : event.weaponId;
    const duration = kind === 'core' ? CORE_DESTRUCTION_MS : COSMIC_EFFECT_MS[kind];
    if (!duration || !Number.isFinite(event.x) || !Number.isFinite(event.y)) return false;
    const id = eventId(event);
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    if (this.seen.size > 400) this.seen = new Set(Array.from(this.seen).slice(-200));
    if (ageMs >= duration) return false;
    const started = now - Math.max(0, ageMs);
    // One corona holds all of a Pocket Star's pulses; each pulse adds its own ring.
    const previous = kind === 'star' && !event.child && this.items.find(item => item.kind === 'star' && !item.finish && item.x === event.x && item.y === event.y && Math.abs(started - item.started) < 1000);
    if (previous) {
      previous.ids.push(id); previous.pulses.push(started); previous.pulses = previous.pulses.slice(-6);
      previous.expires = Math.max(previous.expires, started + duration);
      return true;
    }
    const radius = clamp((Number(event.terrainRadius) || Number(event.radius) || 150) * 1.3, 150, kind === 'moon' ? 340 : 300);
    this.items.push({ id, ids: [id], kind, x: event.x, y: event.y, side: event.side ?? 0, radius, started, expires: started + duration, duration, child: !!event.child, pulses: [started], seed: random(event.x + event.y * 3 + (event.side || 0) * 53) });
    // Prioritize both cores over transient satellite impacts when many effects overlap.
    while (this.items.length > 10) { const index = this.items.findIndex(item => item.kind !== 'core' && !item.finish); this.items.splice(index < 0 ? 0 : index, 1); }
    return true;
  }
  addFinish(finish, ageMs = 0, now = performance.now()) {
    const duration = finish?.endsAt - finish?.at;
    if (!(duration > 0) || !finish.event) return false;
    const events = finish.events?.length ? finish.events : [finish.event];
    let added = false;
    for (const event of events) {
      if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) continue;
      const id = eventId(event);
      if (this.items.some(item => item.id === id && item.finish)) continue;
      // A normal cosmic effect may already own several pulse IDs. Replace its
      // existing corona rather than drawing the fatal pulse a second time.
      this.items = this.items.filter(item => !(item.ids || [item.id]).includes(id));
      const finishKey = `finish:${id}:${finish.at}`;
      if (this.seen.has(finishKey)) continue;
      this.seen.add(id); this.seen.add(finishKey);
      if (ageMs >= duration) continue;
      const started = now - Math.max(0, ageMs), kind = event.weaponId || 'basic';
      const cosmic = Boolean(COSMIC_EFFECT_MS[kind]);
      const radius = cosmic
        ? clamp((Number(event.terrainRadius) || Number(event.radius) || 150) * 1.3, 150, kind === 'moon' ? 340 : 300)
        : Math.max(65, clamp(Number(event.terrainRadius) || Number(event.radius) || 42, 20, 250) * 1.1);
      this.items.push({ id, ids: [id], kind, x: event.x, y: event.y, side: event.side ?? 0, radius,
        started, expires: started + duration, duration, child: !!event.child, pulses: [started],
        finish: true, deaths: id === eventId(finish.event) ? finish.deaths || [] : [],
        seed: random(event.x + event.y * 3 + (event.side || 0) * 53) });
      added = true;
    }
    return added;
  }
  addDrowning(drowning, ageMs = 0, now = performance.now()) {
    const duration = drowning?.endsAt - drowning?.at;
    if (!(duration > 0)) return false;
    const id = `drowning:${drowning.at}:${(drowning.deaths || []).map(death => death.id || death.unitId).join(',')}`;
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    if (ageMs >= duration) return false;
    const started = now - Math.max(0, ageMs);
    this.items.push({ id, ids: [id], kind: 'drowning', x: 0, y: 0, started, expires: started + duration,
      duration, deaths: drowning.deaths || [] });
    return true;
  }
  draw(c, now = performance.now(), reduced = false) {
    this.items = this.items.filter(item => now < item.expires);
    for (const item of this.items) {
      const elapsed = Math.max(0, now - item.started);
      const t = clamp(elapsed / item.duration);
      // Fatal impact geometry advances only 700 ms during the full two-second
      // host deadline. This slows the blast itself, including late reconnects.
      const playbackMs = item.finish ? t * FINISH_PLAYBACK_MS : elapsed;
      const age = playbackMs / 1000, playbackNow = item.started + playbackMs;
      c.save(); c.translate(item.x, item.y);
      if (item.kind === 'drowning') this.drowning(c, item, t, reduced);
      else if (reduced) this.reduced(c, item, now);
      else if (item.kind === 'moon') this.moon(c, item, age, t);
      else if (item.kind === 'saturn') this.saturn(c, item, age, t);
      else if (item.kind === 'star') this.star(c, item, playbackNow, item.finish ? t : undefined);
      else if (item.kind === 'core') this.core(c, item, age, t);
      else this.blast(c, item, age, t);
      c.restore();
      if (item.finish) this.casualties(c, item, age, t, reduced);
    }
  }
  blast(c, item, age, t) {
    const r = item.radius, fade = clamp((1 - t) * 3), rise = clamp(age / .08);
    c.globalAlpha = fade * .72; glow(c, r * (1 + age * .8), '#ffc05d80');
    if (age < .42) {
      const ringProgress = age / .42;
      c.globalAlpha = (1 - ringProgress) * .85; ring(c, r * (.25 + ringProgress * 1.5), .83, '#ffe8a9', 3 + 9 * (1 - ringProgress));
    }
    const cloud = r * (.3 + rise * .65), cloudFade = clamp(1 - (age - .16) / .42) * fade;
    c.globalAlpha = cloudFade;
    for (let i = 0; i < 8; i++) {
      const a = TAU * i / 8 + item.seed;
      disk(c, Math.cos(a) * cloud * .53, Math.sin(a) * cloud * .53, cloud * (.42 + random(i) * .08), i % 2 ? '#e77937' : '#d26034');
    }
    glow(c, cloud, '#fff9d7', '#f68c3e00');
    for (let i = 0; i < 6; i++) { const a = TAU * i / 6 + item.seed; disk(c, Math.cos(a) * cloud * .4, Math.sin(a) * cloud * .4, cloud * .25, i % 2 ? '#ffcd68' : '#ffdf8b'); }
    for (let i = 0; i < 20; i++) {
      const a = i * 2.399 + item.seed, speed = 70 + random(i + 4) * (180 + r);
      const x = Math.cos(a) * speed * age, y = Math.sin(a) * speed * age - age * 30 + age * age * 105;
      c.globalAlpha = fade * clamp(1 - age / .95); c.strokeStyle = i % 2 ? '#ffd369' : '#fff1b7'; c.lineWidth = 2 + random(i) * 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(a) * speed * .033, y - Math.sin(a) * speed * .033); c.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const a = TAU * i / 7 + item.seed, travel = r * .3 + age * (45 + random(i) * 75);
      c.globalAlpha = fade * .35 * clamp(age / .3);
      disk(c, Math.cos(a) * travel, Math.sin(a) * travel - age * 45, r * (.16 + random(i + 7) * .15) * (.65 + age), i % 2 ? '#766d5c' : '#aca184');
    }
    c.lineCap = 'butt';
  }
  casualties(c, item, age, t, reduced) {
    for (const death of item.deaths) {
      if (!Number.isFinite(death.x) || !Number.isFinite(death.y)) continue;
      const direction = death.x >= item.x ? 1 : -1;
      c.save(); c.translate(death.x + (reduced ? 0 : direction * age * 42), death.y + (reduced ? 0 : -age * 48 + age * age * 25));
      c.globalAlpha = clamp((1 - t) * 2); if (!reduced) c.rotate(direction * age * 1.5);
      c.fillStyle = TEAM[death.side ?? 0]; c.strokeStyle = '#36574e'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(-11, 0, 22, 19, 6); c.fill(); c.stroke();
      disk(c, 0, -7, 11, '#e1b27d');
      c.fillStyle = TEAM[death.side ?? 0]; c.beginPath(); c.ellipse(0, -12, 15, 11, 0, Math.PI, 0); c.lineTo(15, -10); c.lineTo(-15, -10); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#5d5544'; c.lineWidth = 1.5;
      for (const x of [-4, 5]) { c.beginPath(); c.moveTo(x - 2, -6); c.lineTo(x + 2, -2); c.moveTo(x + 2, -6); c.lineTo(x - 2, -2); c.stroke(); }
      c.restore();
    }
  }
  drowning(c, item, t, reduced) {
    for (const death of item.deaths) {
      if (!Number.isFinite(death.x) || !Number.isFinite(death.y)) continue;
      c.save(); c.translate(death.x, death.y); c.globalAlpha = (1 - t) * .8;
      for (let i = 0; i < 6; i++) {
        const drift = reduced ? 0 : t * (28 + i * 5);
        c.strokeStyle = '#d4f4e8'; c.lineWidth = 2;
        c.beginPath(); c.arc(Math.sin(i * 2.4) * (8 + i * 2), -i * 5 - drift, 2 + i % 3, 0, TAU); c.stroke();
      }
      c.restore();
    }
  }
  reduced(c, item, now) {
    const t = clamp((now - item.started) / (item.expires - item.started));
    c.globalAlpha = Math.min(1, (1 - t) * 2);
    const r = item.kind === 'core' ? 62 : item.radius * .35;
    const color = item.kind === 'moon' ? '#dceaf1' : item.kind === 'star' ? '#ffd184' : '#f6d080';
    glow(c, r * 1.8, `${color}bb`);
    if (item.kind === 'core') { ring(c, r, 1, TEAM[item.side], 4); diamond(c, 30, '#ffe49a'); }
    else if (item.kind === 'moon') moonBody(c, r);
    else if (item.kind === 'saturn') { disk(c, 0, 0, r * .7, color); ring(c, r * 1.5, .4, '#b98860', 8, -.35); ring(c, r * 1.5, .4, '#ffe5a7', 3, -.35); }
    else { disk(c, 0, 0, r * .55, '#fff6cc'); ring(c, r, 1, item.kind === 'star' ? '#e4a4dd' : '#efb476', 5); }
    // Static fragments communicate shattering without expansion or rapid flashes.
    for (let i = 0; i < 8; i++) { c.save(); c.translate(Math.cos(i * TAU / 8) * r * 1.45, Math.sin(i * TAU / 8) * r * 1.45); c.rotate(i); diamond(c, 6, color); c.restore(); }
  }
  moon(c, item, age, t) {
    const r = item.radius, burst = clamp((age - .12) / .7), fade = clamp((1 - t) * 2.5);
    c.globalAlpha = fade * .65; glow(c, r * (1 + burst * .35), '#b8d9efaa');
    if (age < .7) { c.globalAlpha = (1 - age / .7) * .9; ring(c, r * (.16 + age * 2), .86, '#f0fcff', 5 + 10 * (1 - age / .7)); }
    c.globalAlpha = fade;
    if (age < .12) { moonBody(c, r * (.24 + age)); return; }
    const travel = age - .12, pieces = 9, body = r * .34;
    for (let i = 0; i < pieces; i++) {
      const angle = i * TAU / pieces, speed = r * (.18 + random(i + item.seed) * .25);
      const distance = travel * speed, x = Math.cos(angle) * distance, y = Math.sin(angle) * distance + travel * travel * 23;
      c.save(); c.translate(x, y); c.rotate(travel * (random(i + 29) - .5));
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, body, angle - .28, angle + .28); c.closePath();
      c.fillStyle = i % 2 ? '#e8f2f1' : '#cddfe8'; c.strokeStyle = '#758f9c'; c.lineWidth = 2.5; c.fill(); c.stroke();
      c.save(); c.clip(); disk(c, Math.cos(angle) * body * .67, Math.sin(angle) * body * .67, body * .16, '#a9c3cf'); c.restore(); c.restore();
    }
    for (let i = 0; i < 22; i++) {
      const a = i * 2.399 + item.seed, distance = r * (.16 + random(i + 10) * .5) * travel;
      const x = Math.cos(a) * distance, y = Math.sin(a) * distance + travel * travel * 25;
      c.globalAlpha = fade * .5; disk(c, x, y, 5 + t * 22 + random(i) * 12, i % 2 ? '#b5cad0' : '#dfedef');
      c.globalAlpha = fade; c.save(); c.translate(x * 1.2, y * .85); c.rotate(a + travel); c.fillStyle = '#edf9f7'; c.fillRect(-3, -3, 6 + random(i + 5) * 5, 5); c.restore();
    }
  }
  saturn(c, item, age, t) {
    const r = item.radius * (item.child ? .65 : 1), fade = clamp((1 - t) * 2), spread = 1 - Math.exp(-age * 3);
    c.globalAlpha = fade * .7; glow(c, r, '#ffc878aa');
    c.save(); c.rotate(-.33);
    for (let i = 0; i < 4; i++) {
      const orbit = r * (.22 + spread * (.65 + i * .14));
      c.globalAlpha = fade * (1 - i * .12); ring(c, orbit, .36, i % 2 ? '#fff1b9' : '#d79365', 4 + (3 - i) * 3, 0, age * .7 + i * .17, age * .7 + TAU - .45 - i * .2);
    }
    c.restore();
    const coreFade = clamp(1 - age / 1.25); c.globalAlpha = coreFade;
    if (coreFade > 0) {
      const body = r * (.23 + Math.min(age, .25) * .3); disk(c, 0, 0, body, '#eec07d');
      c.save(); c.beginPath(); c.arc(0, 0, body, 0, TAU); c.clip(); c.rotate(-.33);
      for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#ffe2a1' : '#bc8261'; c.fillRect(-body, -body + i * body * .42, body * 2, body * .14); } c.restore();
      glow(c, body * 1.4, '#fff9d2bb');
    }
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12 + age * (i % 2 ? 1 : -.7), orbit = r * (.4 + t * (.8 + random(i) * .9));
      const ox = Math.cos(a) * orbit, oy = Math.sin(a) * orbit * .55;
      const x = ox * .95 + oy * .3, y = oy * .95 - ox * .3 + age * age * 7;
      c.globalAlpha = fade; c.strokeStyle = i % 2 ? '#ffe9a0' : '#eda885'; c.lineWidth = i % 3 ? 3 : 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x - Math.cos(a + .3) * (20 + age * 18), y - Math.sin(a + .3) * 18); c.stroke();
      disk(c, x, y, i % 3 ? 4 : 9, i % 3 ? '#fff5ca' : '#bd957c');
      if (i % 3 === 0) disk(c, x - 2, y - 3, 3, '#e9d8b1');
    }
    c.lineCap = 'butt';
  }
  star(c, item, now, progress) {
    const latest = item.pulses[item.pulses.length - 1], age = Math.max(0, now - latest) / 1000;
    const t = progress ?? clamp((now - latest) / item.duration), r = item.radius, fade = clamp((1 - t) * 2.1);
    c.globalAlpha = fade * .72; glow(c, r * (1 + t * .3), '#a75ba78c', '#69548900');
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12 + item.seed, length = r * (.65 + random(i) * .7) * (.55 + clamp(age * 2) * .45);
      c.save(); c.rotate(a); c.globalAlpha = fade * .7; c.fillStyle = i % 2 ? '#ffde99' : '#edb3d8';
      c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(length * .28, -14, length, 0); c.quadraticCurveTo(length * .28, 14, 0, 8); c.closePath(); c.fill(); c.restore();
    }
    for (const pulse of item.pulses) {
      const pulseAge = Math.max(0, now - pulse) / 1000;
      if (pulseAge > 1.6) continue;
      c.globalAlpha = (1 - pulseAge / 1.6) * .75;
      ring(c, r * (.13 + pulseAge * .68), .83, '#ffe5b8', 3 + 5 * (1 - pulseAge / 1.6), -.16);
    }
    c.globalAlpha = fade;
    const core = r * (.17 + Math.exp(-age * 3.6) * .22);
    glow(c, core * 2.2, '#fff1adaf');
    c.fillStyle = '#f7b073'; c.beginPath();
    for (let i = 0; i < 24; i++) { const a = i * TAU / 24, length = core * (i % 2 ? .84 : 1.35); const x = Math.cos(a) * length, y = Math.sin(a) * length; if (!i) c.moveTo(x, y); else c.lineTo(x, y); } c.closePath(); c.fill();
    disk(c, 0, 0, core * .9, '#fff5c9'); disk(c, -core * .12, -core * .1, core * .58, '#fffef0');
    for (let i = 0; i < 20; i++) {
      const a = i * 2.399, travel = (now - item.started) / 1000, distance = r * (.3 + random(i + 37) * .65) * (.7 + travel * .3);
      const x = Math.cos(a) * distance, y = Math.sin(a) * distance, size = 3 + random(i) * 5;
      c.globalAlpha = fade * (.5 + .5 * Math.sin(i + travel * 2) ** 2); c.fillStyle = '#fff4c7'; c.beginPath(); c.moveTo(x - size, y); c.lineTo(x, y - size * 2); c.lineTo(x + size, y); c.lineTo(x, y + size * 2); c.closePath(); c.fill();
    }
  }
  core(c, item, age, t) {
    const color = TEAM[item.side], charge = .58, after = Math.max(0, age - charge), fade = clamp((1 - t) * 3.2);
    if (age < charge) {
      const p = age / charge;
      c.globalAlpha = .75; glow(c, 60 + p * 95, `${color}aa`); glow(c, 40 + p * 45, '#ffde7bbb');
      c.globalAlpha = 1; ring(c, 70 - p * 30, 1, '#ffe7a2', 3); c.save(); c.rotate(Math.sin(age * 22) * .07 * p); diamond(c, 29 + p * 15, '#ffd765'); c.restore();
      c.strokeStyle = '#fffdf1'; c.lineWidth = 3; c.beginPath(); c.moveTo(-3, -25); c.lineTo(8, -6); c.lineTo(-7, 6); c.lineTo(7, 29); c.stroke();
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8, distance = 100 * (1 - p) + 38; disk(c, Math.cos(a) * distance, Math.sin(a) * distance, 3 + p * 2, '#ffefb1'); }
      return;
    }
    c.globalAlpha = fade * .72; glow(c, 280, `${color}75`); glow(c, 180, '#ffd884a0');
    if (after < 1.45) {
      const p = after / 1.45; c.globalAlpha = (1 - p) * .9;
      ring(c, 45 + p * 290, .75, '#ffeab4', 14 * (1 - p) + 2);
      ring(c, 25 + p * 210, 1, color, 7 * (1 - p) + 2);
      // A rising local column makes the blast readable even beside the arsenal.
      const height = 310 * Math.sin(Math.min(1, after / 1.1) * Math.PI / 2);
      c.fillStyle = `${color}65`; c.beginPath(); c.moveTo(-65 * (1 - p), 10); c.quadraticCurveTo(-25, -height * .65, 0, -height); c.quadraticCurveTo(25, -height * .65, 65 * (1 - p), 10); c.closePath(); c.fill();
    }
    if (after < .5) {
      c.globalAlpha = 1 - after / .5;
      c.fillStyle = '#fff5c5'; c.beginPath();
      for (let i = 0; i < 20; i++) { const a = i * TAU / 20, r = (i % 2 ? 52 : 125) * (.5 + after * 2); if (!i) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
    }
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI + (.1 + random(i + item.seed) * .8) * Math.PI, speed = 90 + random(i + 73) * 160;
      const x = Math.cos(a) * speed * after, y = Math.sin(a) * speed * after + after * after * 43;
      c.globalAlpha = fade; c.save(); c.translate(x, y); c.rotate(i + after * (random(i + 13) - .5) * 6); diamond(c, 5 + random(i + 9) * 12, i % 3 ? '#ffd77b' : color, '#fff0b8'); c.restore();
    }
    for (let i = 0; i < 14; i++) {
      const a = i * 2.399, d = (35 + random(i) * 120) * after;
      c.globalAlpha = fade * .35; disk(c, Math.cos(a) * d, -Math.abs(Math.sin(a) * d) - after * 20, 15 + after * 13, i % 2 ? '#d4c7a3' : '#a8b7a1');
    }
    c.globalAlpha = fade; glow(c, Math.max(10, 70 - after * 20), '#ffe49dcc');
  }
}
