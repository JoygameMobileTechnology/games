import { isTeamMode, normalizeConfig, type MatchConfig, type MatchResult } from "./match";
import { MAP_INFO, mapsForMode } from "./maps/catalog";
import type { MapId } from "./maps/types";

export interface Tournament {
  config: MatchConfig;
  maps: [MapId, MapId, MapId];
  entrants: number[];
  points: Record<number, number>;
  rounds: { map: MapId; result: MatchResult }[];
  finished: boolean;
  winner: number | null;
}
export function createTournament(config: MatchConfig, first: MapId): Tournament {
  const normalized=normalizeConfig(config,MAP_INFO[first].maxPlayers);
  const compatible=mapsForMode(normalized.mode).filter(id=>MAP_INFO[id].maxPlayers>=normalized.population);
  if(!compatible.includes(first)) throw new Error("Choose a compatible tournament arena.");
  const order=[first,...compatible.filter(id=>id!==first)];
  const entrants=isTeamMode(normalized.mode) ? [0,1] : Array.from({length:normalized.population},(_,i)=>i);
  return { config:normalized, maps:[order[0],order[1 % order.length],order[2 % order.length]], entrants,
    points:Object.fromEntries(entrants.map(id=>[id,0])), rounds:[], finished:false,winner:null };
}
/** Match index makes duplicate result delivery harmless. Draws award every entrant half a point. */
export function recordTournamentRound(series: Tournament, result: MatchResult, index: number): Tournament {
  if(series.finished || index!==series.rounds.length) return series;
  const points={...series.points};
  const winner=isTeamMode(series.config.mode) ? result.winnerTeam : result.winnerId;
  if(result.draw) for(const id of series.entrants) points[id]+=.5;
  else {
    if(winner===null || !series.entrants.includes(winner)) throw new Error("Invalid tournament winner.");
    points[winner]+=1;
  }
  const rounds=[...series.rounds,{map:series.maps[index],result:{...result}}];
  const ranking=[...series.entrants].sort((a,b)=>points[b]-points[a]);
  const remaining=3-rounds.length;
  const finished=remaining===0 || points[ranking[0]]>points[ranking[1]]+remaining;
  return {...series,points,rounds,finished,winner:finished&&points[ranking[0]]>points[ranking[1]]?ranking[0]:null};
}
