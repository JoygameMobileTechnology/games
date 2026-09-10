import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,recordTournamentRound} from '../src/tournament.ts';
import {defaultConfig, type MatchResult} from '../src/match.ts';
const win=(id:number,team=false):MatchResult=>({winnerId:team?null:id,winnerTeam:team?id as 0|1:null,draw:false,reason:'score'});
const draw:MatchResult={winnerId:null,winnerTeam:null,draw:true,reason:'cap'};
test('a same-opponent series ends at two unanswered wins and duplicate results do not count',()=>{
 let s=createTournament(defaultConfig('duel'),'ossuary');
 const original=s.config.botDifficulties.slice();
 s=recordTournamentRound(s,win(0),0);
 assert.equal(s.finished,false);assert.equal(recordTournamentRound(s,win(0),0),s);
 s=recordTournamentRound(s,win(0),1);
 assert.equal(s.finished,true);assert.equal(s.winner,0);assert.equal(s.rounds.length,2);
 assert.deepEqual(s.config.botDifficulties,original);assert.equal(recordTournamentRound(s,win(1),2),s);
});
test('draws give half points and all-draw series stops at three matches',()=>{
 let s=createTournament(defaultConfig('duel'),'rift');
 for(let i=0;i<3;i++)s=recordTournamentRound(s,draw,i);
 assert.equal(s.finished,true);assert.equal(s.winner,null);assert.deepEqual(s.points,{0:1.5,1:1.5});
});
test('a win and a draw cannot clinch while the opponent can still tie',()=>{
 let s=createTournament(defaultConfig('duel'),'ossuary');
 s=recordTournamentRound(s,win(0),0);s=recordTournamentRound(s,draw,1);
 assert.equal(s.finished,false);s=recordTournamentRound(s,win(1),2);
 assert.equal(s.finished,true);assert.equal(s.winner,null);
});
test('ten-player flag series preserves teams and rotates only compatible arenas',()=>{
 const config={...defaultConfig('ctf'),population:10};
 let s=createTournament(config,'conduit');
 assert.deepEqual(s.maps,['conduit','bastion','conduit']);assert.equal(s.config.population,10);
 assert.deepEqual(s.entrants,[0,1]);
 s=recordTournamentRound(s,win(1,true),0);s=recordTournamentRound(s,win(0,true),1);s=recordTournamentRound(s,win(1,true),2);
 assert.equal(s.winner,1);assert.deepEqual(s.points,{0:1,1:2});
});
test('FFA with three different winners ends in a series draw',()=>{
 let s=createTournament(defaultConfig('ffa'),'crucible');
 for(let i=0;i<3;i++)s=recordTournamentRound(s,win(i),i);
 assert.equal(s.finished,true);assert.equal(s.winner,null);assert.equal(s.rounds.length,3);
});
test('incompatible maps cannot start tournaments and future results are ignored',()=>{
 assert.throws(()=>createTournament(defaultConfig('oneflag'),'ossuary'));
 const s=createTournament(defaultConfig('duel'),'ossuary');
 assert.equal(recordTournamentRound(s,win(0),1),s);
});
