import test from "node:test";
import assert from "node:assert/strict";
import { settleLanMatch } from "../src/lan/settlement";
import { defaultCosmetics } from "../src/cosmetics";
import type { Profile } from "../src/profile";
import type { GameSnapshot } from "../src/lan/types";

const profile = (): Profile => ({ name: "Player", settings: {} as Profile["settings"], cosmetics: defaultCosmetics(), stats: { matches: 0, wins: 0, kills: 0, deaths: 0, tournaments: 0, tournamentWins: 0, tournamentDraws: 0 } });
const snapshot = (change: Partial<GameSnapshot> = {}): GameSnapshot => ({
  matchId: "lan-match-1", ended: true, result: { draw: false, winnerId: 3, winnerTeam: null, reason: "score" },
  actors: [{ id: 3, team: null, kills: 21, deaths: 12, humanKills: 7, humanDeaths: 4 }], ...change,
} as GameSnapshot);

test("LAN settlement uses human-only totals and rewards the actual local slot", () => {
  const p = profile();
  assert.equal(settleLanMatch(p, snapshot(), 3), 100);
  assert.deepEqual(p.stats, { matches: 1, wins: 1, kills: 7, deaths: 4, tournaments: 0, tournamentWins: 0, tournamentDraws: 0 });
});
test("replayed final state after profile reload cannot duplicate stats or Favor", () => {
  const p = profile(); settleLanMatch(p, snapshot(), 3);
  const restored = JSON.parse(JSON.stringify(p)) as Profile;
  assert.equal(settleLanMatch(restored, snapshot(), 3), 0);
  assert.equal(restored.stats.matches, 1); assert.equal(restored.cosmetics?.favor, 100);
});
test("team victory and draw completion settle correctly; unfinished states cannot pay", () => {
  const p = profile();
  assert.equal(settleLanMatch(p, snapshot({ ended: false }), 3), 0);
  const draw = snapshot({ result: { draw: true, winnerId: null, winnerTeam: null, reason: "cap" } });
  assert.equal(settleLanMatch(p, draw, 3), 25); assert.equal(p.stats.wins, 0);
  const team = snapshot({ matchId: "team-match", actors: [{ id: 3, team: 1, humanKills: 2, humanDeaths: 1 }] as any, result: { draw: false, winnerId: null, winnerTeam: 1, reason: "score" } });
  assert.equal(settleLanMatch(p, team, 3), 100); assert.equal(p.stats.wins, 1);
});
