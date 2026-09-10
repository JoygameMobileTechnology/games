export type Difficulty = "Easy" | "Medium" | "Competitive";
export type Mode = "ffa" | "duel" | "tdm" | "juggernaut" | "ctf" | "oneflag";
export type FlagMode = "ctf" | "oneflag";
export function isFlagMode(mode: Mode): mode is FlagMode {
  return mode === "ctf" || mode === "oneflag";
}
export function isTeamMode(mode: Mode) {
  return mode === "tdm" || isFlagMode(mode);
}
export type Team = 0 | 1;

export interface MatchConfig {
  mode: Mode;
  population: number;
  timeLimit: number;
  scoreLimit: number;
  botDifficulties: Difficulty[];
  teamColors: [string, string];
}

export interface MatchActor {
  id: number;
  kills: number;
  deaths: number;
  health: number;
  team: Team | null;
  possession: number;
  captures?: number;
}

export interface MatchResult {
  winnerId: number | null;
  winnerTeam: Team | null;
  draw: boolean;
  reason: "score" | "time" | "cap";
}

export const MODE_INFO: Record<
  Mode,
  {
    name: string;
    short: string;
    description: string;
    scoreLabel: string;
  }
> = {
  ffa: {
    name: "Free for All",
    short: "FFA",
    scoreLabel: "FRAGS",
    description:
      "Every operator is an enemy. Control the weapons. Take the arena.",
  },
  duel: {
    name: "Duel",
    short: "DUEL",
    scoreLabel: "FRAGS",
    description: "One opponent. Every pickup, route and frag counts.",
  },
  tdm: {
    name: "Team Deathmatch",
    short: "TDM",
    scoreLabel: "TEAM FRAGS",
    description: "Two teams. Shared score. Friendly fire is off.",
  },
  ctf: {
    name: "Capture the Flag",
    short: "CTF",
    scoreLabel: "CAPTURES",
    description:
      "Steal the enemy flag. Bring it home while your own flag is safe.",
  },
  oneflag: {
    name: "One Flag CTF",
    short: "ONE FLAG",
    scoreLabel: "CAPTURES",
    description:
      "Take the neutral flag to the enemy base. Protect your carrier.",
  },
  juggernaut: {
    name: "Juggernaut",
    short: "JUGGERNAUT",
    scoreLabel: "POINTS",
    description:
      "Kill the glowing holder to claim the role. Each second held earns a point.",
  },
};

const DEFAULT_COLORS: [string, string] = ["#ff663f", "#52c7ef"];
const LIMITS: Record<Mode, { population: number; score: number }> = {
  ffa: { population: 6, score: 15 },
  duel: { population: 2, score: 10 },
  tdm: { population: 8, score: 40 },
  juggernaut: { population: 6, score: 120 },
  ctf: { population: 6, score: 3 },
  oneflag: { population: 6, score: 3 },
};

export function defaultConfig(mode: Mode = "ffa"): MatchConfig {
  const { population, score } = LIMITS[mode];
  return {
    mode,
    population,
    timeLimit: 240,
    scoreLimit: score,
    botDifficulties: Array<Difficulty>(population - 1).fill("Medium"),
    teamColors: [...DEFAULT_COLORS],
  };
}

/** The selected arena supplies its authored capacity; team rosters remain even. */
export function normalizeConfig(
  config: MatchConfig,
  maxPlayers = 10,
): MatchConfig {
  const mode = Object.hasOwn(MODE_INFO, config.mode) ? config.mode : "ffa";
  const defaults = defaultConfig(mode);
  const bounded = (
    value: number,
    fallback: number,
    min: number,
    max: number,
  ) =>
    Number.isFinite(value)
      ? Math.min(max, Math.max(min, Math.round(value)))
      : fallback;
  const capacity = bounded(maxPlayers, 10, 2, 10);
  let population = bounded(
    config.population,
    Math.min(defaults.population, capacity),
    2,
    capacity,
  );
  if (mode === "duel") population = 2;
  if (isTeamMode(mode)) population -= population % 2;
  const colors = DEFAULT_COLORS.map((fallback, i) => {
    const value = config.teamColors?.[i];
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
      ? value
      : fallback;
  }) as [string, string];
  // Team badges also carry I/II identifiers, so hue is never the sole team cue.
  if (colors[0].toLowerCase() === colors[1].toLowerCase()) {
    colors[1] =
      colors[0].toLowerCase() === DEFAULT_COLORS[1]
        ? DEFAULT_COLORS[0]
        : DEFAULT_COLORS[1];
  }
  return {
    mode,
    population,
    timeLimit: bounded(config.timeLimit, defaults.timeLimit, 60, 600),
    scoreLimit: bounded(config.scoreLimit, defaults.scoreLimit, 1, 999),
    botDifficulties: Array.from({ length: population - 1 }, (_, i) => {
      const difficulty = config.botDifficulties?.[i];
      return difficulty === "Easy" || difficulty === "Competitive"
        ? difficulty
        : "Medium";
    }),
    teamColors: colors,
  };
}

export function areEnemies(
  config: MatchConfig,
  a: MatchActor,
  b: MatchActor,
): boolean {
  return a.id !== b.id && (!isTeamMode(config.mode) || a.team !== b.team);
}

export function canDamage(
  config: MatchConfig,
  victim: MatchActor,
  attacker: MatchActor | null,
): boolean {
  return (
    !attacker ||
    attacker.id === victim.id ||
    areEnemies(config, attacker, victim)
  );
}

export function scoreFor(config: MatchConfig, actor: MatchActor): number {
  // The epsilon only removes accumulated fixed-step floating point error.
  return config.mode === "juggernaut"
    ? Math.floor(actor.possession + 1e-7)
    : isFlagMode(config.mode)
      ? (actor.captures ?? 0)
      : actor.kills;
}

export function teamScores(
  actors: readonly MatchActor[],
  config?: MatchConfig,
  captures?: readonly [number, number],
): [number, number] {
  if (config && isFlagMode(config.mode))
    return captures ? [...captures] : [0, 0];
  const totals: [number, number] = [0, 0];
  for (const actor of actors)
    if (actor.team !== null) totals[actor.team] += actor.kills;
  return totals;
}

export function matchResult(
  config: MatchConfig,
  actors: readonly MatchActor[],
  time: number,
  captures?: readonly [number, number],
): MatchResult | null {
  if (actors.length < 2) return null;
  const ranking = isTeamMode(config.mode)
    ? teamScores(actors, config, captures).map((score, id) => ({ id, score }))
    : actors.map((a) => ({ id: a.id, score: scoreFor(config, a) }));
  ranking.sort((a, b) => b.score - a.score);
  const tied = ranking[0].score === ranking[1].score;
  const atCap = time >= 600;
  const atScore = ranking[0].score >= config.scoreLimit;
  const atTime = time >= config.timeLimit;
  // Keep tied play running after the target; the absolute cap resolves a draw.
  if (!atCap && (tied || (!atScore && !atTime))) return null;
  return {
    winnerId: tied || isTeamMode(config.mode) ? null : ranking[0].id,
    winnerTeam:
      !tied && isTeamMode(config.mode) ? (ranking[0].id as Team) : null,
    draw: tied,
    reason: atCap ? "cap" : atScore ? "score" : "time",
  };
}

/** Provisional initial/environmental-death selection: uniformly choose living players. */
export function chooseJuggernaut(
  actors: readonly MatchActor[],
  excludeId?: number,
  random: () => number = Math.random,
): number | null {
  const eligible = actors.filter((a) => a.health > 0 && a.id !== excludeId);
  if (!eligible.length) return null;
  return eligible[
    Math.min(
      eligible.length - 1,
      Math.max(0, Math.floor(random() * eligible.length)),
    )
  ].id;
}
