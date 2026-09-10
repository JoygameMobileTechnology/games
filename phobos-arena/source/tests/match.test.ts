import test from "node:test";
import assert from "node:assert/strict";
import {
  areEnemies,
  canDamage,
  chooseJuggernaut,
  defaultConfig,
  isFlagMode,
  isTeamMode,
  matchResult,
  normalizeConfig,
  scoreFor,
  teamScores,
  type MatchActor,
  type MatchConfig,
  type Mode,
} from "../src/match.ts";

const actor = (
  id: number,
  overrides: Partial<MatchActor> = {},
): MatchActor => ({
  id,
  kills: 0,
  deaths: 0,
  health: 100,
  team: null,
  possession: 0,
  ...overrides,
});

test("match setup enforces playable rosters, independent bot levels and a ten-minute ceiling", () => {
  const draft = {
    ...defaultConfig("tdm"),
    population: 7,
    timeLimit: 900,
    scoreLimit: -4,
    botDifficulties: ["Easy", "Competitive", "impossible"],
    teamColors: ["red; display:none", "#52c7ef"],
  } as MatchConfig;
  const saved = normalizeConfig(draft);
  assert.equal(saved.population, 6);
  assert.equal(saved.timeLimit, 600);
  assert.equal(saved.scoreLimit, 1);
  assert.deepEqual(saved.botDifficulties, [
    "Easy",
    "Competitive",
    "Medium",
    "Medium",
    "Medium",
  ]);
  assert.deepEqual(saved.teamColors, ["#ff663f", "#52c7ef"]);
  saved.botDifficulties[0] = "Medium";
  assert.equal(
    draft.botDifficulties[0],
    "Easy",
    "running settings do not share mutable roster with the form",
  );
  assert.equal(
    normalizeConfig({ ...draft, mode: "duel", population: 8 }).population,
    2,
  );
  assert.equal(
    normalizeConfig({ ...draft, mode: "ffa", population: 100 }).population,
    10,
  );
  assert.equal(
    normalizeConfig({ ...draft, mode: "ffa", population: 100 }, 8).population,
    8,
  );
  assert.equal(normalizeConfig({ ...draft, population: 1 }).population, 2);
});

test("invalid numeric input and identical colors recover to usable settings", () => {
  const config = normalizeConfig({
    ...defaultConfig(),
    timeLimit: NaN,
    scoreLimit: Infinity,
    population: NaN,
    teamColors: ["#52C7EF", "#52c7ef"],
  });
  assert.equal(config.timeLimit, 240);
  assert.equal(config.scoreLimit, 15);
  assert.equal(config.population, 6);
  assert.notEqual(
    config.teamColors[0].toLowerCase(),
    config.teamColors[1].toLowerCase(),
  );
  assert.equal(
    normalizeConfig({ ...config, mode: "constructor" as Mode }).mode,
    "ffa",
  );
});

test("team targeting distinguishes friends from enemies while preserving self and world damage", () => {
  const config = defaultConfig("tdm");
  const player = actor(0, { team: 0 }),
    friend = actor(2, { team: 0 }),
    enemy = actor(1, { team: 1 });
  assert.equal(areEnemies(config, player, player), false);
  assert.equal(areEnemies(config, player, friend), false);
  assert.equal(areEnemies(config, player, enemy), true);
  assert.equal(canDamage(config, friend, player), false);
  assert.equal(canDamage(config, enemy, player), true);
  assert.equal(canDamage(config, player, player), true);
  assert.equal(canDamage(config, player, null), true);
  assert.equal(
    areEnemies(defaultConfig(), player, friend),
    true,
    "team identities do not leak into a later FFA round",
  );
});

test("individual modes use score targets, time leaders, tied sudden death and a forced draw", () => {
  for (const mode of ["ffa", "duel"] as const) {
    const config = { ...defaultConfig(mode), timeLimit: 180, scoreLimit: 12 };
    const players = [actor(0, { kills: 8 }), actor(1, { kills: 7 })];
    assert.equal(matchResult(config, players, 179.999), null);
    assert.deepEqual(matchResult(config, players, 180), {
      winnerId: 0,
      winnerTeam: null,
      draw: false,
      reason: "time",
    });
    players[1].kills = 8;
    assert.equal(matchResult(config, players, 180), null);
    assert.equal(matchResult(config, players, 599.99), null);
    assert.deepEqual(matchResult(config, players, 600), {
      winnerId: null,
      winnerTeam: null,
      draw: true,
      reason: "cap",
    });
    players[1].kills = 12;
    assert.deepEqual(matchResult(config, players, 60), {
      winnerId: 1,
      winnerTeam: null,
      draw: false,
      reason: "score",
    });
    assert.equal(matchResult(config, players, 600)?.reason, "cap");
  }
});

test("team victory depends on aggregate frags, including suicide deductions", () => {
  const config = { ...defaultConfig("tdm"), scoreLimit: 10 };
  const players = [
    actor(0, { team: 0, kills: -2 }),
    actor(1, { team: 1, kills: 4 }),
    actor(2, { team: 0, kills: 10 }),
    actor(3, { team: 1, kills: 5 }),
  ];
  assert.deepEqual(teamScores(players), [8, 9]);
  assert.equal(
    matchResult(config, players, 120),
    null,
    "one operator reaching the target does not win for their team",
  );
  assert.deepEqual(matchResult(config, players, 240), {
    winnerId: null,
    winnerTeam: 1,
    draw: false,
    reason: "time",
  });
  players[3].kills++;
  assert.deepEqual(matchResult(config, players, 120), {
    winnerId: null,
    winnerTeam: 1,
    draw: false,
    reason: "score",
  });
  players[0].kills = 0;
  assert.equal(matchResult(config, players, 240), null);
  assert.equal(matchResult(config, players, 600)?.draw, true);
});

test("Juggernaut standings count whole accumulated seconds and preserve fractional ties", () => {
  const config = { ...defaultConfig("juggernaut"), scoreLimit: 120 };
  const players = [
    actor(0, { kills: 999, possession: 7.99 }),
    actor(1, { kills: -3, possession: 7.01 }),
  ];
  assert.equal(scoreFor(config, players[0]), 7);
  assert.equal(
    matchResult(config, players, 240),
    null,
    "kills and fractional seconds cannot break a displayed points tie",
  );
  assert.equal(matchResult(config, players, 600)?.draw, true);
  players[1].possession = 120;
  assert.deepEqual(matchResult(config, players, 150), {
    winnerId: 1,
    winnerTeam: null,
    draw: false,
    reason: "score",
  });
  players[1].possession = 0;
  for (let i = 0; i < 120; i++) players[1].possession += 1 / 120;
  assert.equal(
    scoreFor(config, players[1]),
    1,
    "fixed-step arithmetic does not lose a completed second",
  );
});

test("Juggernaut reassignment chooses living non-victims and tolerates an empty arena", () => {
  const players = [actor(0), actor(1, { health: 0 }), actor(2), actor(3)];
  assert.equal(
    chooseJuggernaut(players, 2, () => 0),
    0,
  );
  assert.equal(
    chooseJuggernaut(players, 2, () => 0.999),
    3,
  );
  assert.equal(chooseJuggernaut([actor(0, { health: 0 })]), null);
  assert.equal(chooseJuggernaut([actor(0)], 0), null);
});

test("flag modes use balanced map capacities and capture scores independently of frags", () => {
  for (const mode of ["ctf", "oneflag"] as const) {
    const config = defaultConfig(mode);
    assert.equal(config.population, 6);
    assert.equal(config.scoreLimit, 3);
    assert.equal(isTeamMode(mode), true);
    assert.equal(isFlagMode(mode), true);
    assert.equal(normalizeConfig({ ...config, population: 10 }).population, 10);
    assert.equal(
      normalizeConfig({ ...config, population: 10 }, 8).population,
      8,
    );
    assert.equal(normalizeConfig({ ...config, population: 9 }).population, 8);
    const players = [
      actor(0, { team: 0, kills: 999, captures: 1 }),
      actor(1, { team: 1, kills: 0 }),
    ];
    assert.equal(areEnemies(config, players[0], actor(2, { team: 0 })), false);
    assert.equal(canDamage(config, players[0], players[1]), true);
    assert.equal(scoreFor(config, players[0]), 1);
    assert.equal(scoreFor(config, players[1]), 0);
    assert.deepEqual(teamScores(players, config, [1, 2]), [1, 2]);
    assert.equal(matchResult(config, players, 10, [0, 0]), null);
    assert.equal(matchResult(config, players, 10), null);
    assert.equal(matchResult(config, players, 240, [1, 1]), null);
    assert.deepEqual(matchResult(config, players, 250, [1, 2]), {
      winnerId: null,
      winnerTeam: 1,
      draw: false,
      reason: "time",
    });
    assert.equal(matchResult(config, players, 30, [3, 2])?.winnerTeam, 0);
    assert.equal(matchResult(config, players, 600, [2, 2])?.draw, true);
  }
  assert.equal(isFlagMode("tdm"), false);
  assert.equal(isTeamMode("ffa"), false);
});
