// Cosmetic timelines share the host's monotonic clock. Combat ends immediately;
// these durations only keep its final effects visible before the result screen.
export const COSMIC_EFFECT_MS = Object.freeze({ moon: 2400, saturn: 2600, star: 2400 });
export const CORE_DESTRUCTION_MS = 3200;
export const LAST_SHOOTER_FINISH_MS = 2000;
export const DROWNING_FINISH_MS = 1000;

export function presentationEventDuration(event) {
  if (event.type === 'core-destroyed') return CORE_DESTRUCTION_MS;
  if (event.type === 'explosion') return COSMIC_EFFECT_MS[event.weaponId] || 0;
  return 0;
}

export function createResultPresentation(events, now) {
  const active = events.filter(event => Number.isFinite(event.at) && event.at <= now && event.at + presentationEventDuration(event) > now);
  if (!active.length) return null;
  return {
    startsAt: Math.min(...active.map(event => event.at)),
    endsAt: Math.max(...active.map(event => event.at + presentationEventDuration(event))),
    cores: active.filter(event => event.type === 'core-destroyed').map(event => ({ ...event })),
    explosions: active.filter(event => event.type === 'explosion').map(event => ({ ...event })),
  };
}

export function createVictoryPresentation(events, now, teams, suddenDeath) {
  const base = createResultPresentation(events, now);
  const eliminated = teams.filter(team => !team.units.some(unit => unit.alive)).map(team => team.side);
  const deaths = events.filter(event => event.type === 'death' && event.at === now && eliminated.includes(event.side));
  const lastDeaths = deaths.filter(event => event.lastShooter);
  const lethalIds = new Set(lastDeaths.filter(event => event.cause === 'blast').map(event => event.explosionId));
  const explosions = events.filter(event => event.type === 'explosion' && lethalIds.has(event.id));
  const drowned = suddenDeath && lastDeaths.some(event => event.cause === 'drowned');
  // A delayed rubble/fall death does not replay an earlier planetary attack.
  if (eliminated.length && !base?.cores.length && !explosions.length && !drowned) return null;
  if (!explosions.length && !drowned) return base;
  const presentation = { startsAt: now, endsAt: now, cores: base?.cores || [], explosions: [] };
  if (explosions.length) {
    presentation.finish = { at: now, endsAt: now + LAST_SHOOTER_FINISH_MS, event: { ...explosions[0] }, events: explosions.map(event => ({ ...event })), deaths: deaths.map(event => ({ ...event })) };
    presentation.endsAt = presentation.finish.endsAt;
  }
  if (drowned) {
    presentation.drowning = { at: now, endsAt: now + DROWNING_FINISH_MS, deaths: deaths.filter(event => event.cause === 'drowned').map(event => ({ ...event })) };
    presentation.endsAt = Math.max(presentation.endsAt, presentation.drowning.endsAt);
  }
  if (presentation.cores.length) {
    presentation.startsAt = Math.min(now, ...presentation.cores.map(event => event.at));
    presentation.endsAt = Math.max(presentation.endsAt, ...presentation.cores.map(event => event.at + CORE_DESTRUCTION_MS));
  }
  return presentation;
}

export function resultPresentationActive(result, now) {
  return Boolean(result?.presentation && Number.isFinite(now) && now < result.presentation.endsAt);
}
