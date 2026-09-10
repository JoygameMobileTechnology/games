import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { STEP } from '../src/rules.ts';
import { fixture, place } from './helpers/game-fixture.ts';
import type { ArenaMechanisms } from '../src/mechanisms.ts';

const mechanisms=(g:unknown)=>(g as {mechanisms:ArenaMechanisms}).mechanisms;
const quiet=(g:any)=>{
 g.botIntent=()=>({x:0,z:0,forwardX:0,forwardZ:-1,jump:false});
 for(const a of g.actors){a.nextAttack=Infinity;a.health=10000;}
};
test('Crucible lift carries a standing player up and back down with matching mesh and collision',async t=>{
 const f=await fixture(2,'crucible');t.after(()=>f.dispose());quiet(f.game);
 const lift=mechanisms(f.game).parts[0],p=f.game.player;
 place(f.game,p,0,.865,-18);p.motion.grounded=true;f.game.world.step();
 let high=0;
 for(let i=0;i<1200;i++){
  f.game.tick();high=Math.max(high,p.motion.y);
  assert.ok(Number.isFinite(p.motion.y));
  assert.ok(Math.abs(lift.mesh.position.y-lift.collider.translation().y)<1e-5);
 }
 assert.ok(high>8.7,`rider only reached ${high}`);
 assert.ok(p.motion.y<1.05,`rider did not descend: ${p.motion.y}`);
 assert.equal(p.health>0,true);
});
test('Reliquary door opens on approach, blocks shots when shut, and stays open around a player',async t=>{
 const f=await fixture(2,'reliquary');t.after(()=>f.dispose());quiet(f.game);
 const door=mechanisms(f.game).parts[0],p=f.game.player;
 place(f.game,p,-20,.9,0);place(f.game,f.game.actors[1],20,.9,0);f.game.world.step();
 const ray=()=>f.game.world.castRay(new RAPIER.Ray({x:-13,y:1.5,z:0},{x:1,y:0,z:0}),4,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
 assert.equal(ray()?.collider.handle,door.collider.handle);
 place(f.game,p,-14,.9,0);f.game.world.step();
 for(let i=0;i<120;i++)f.game.tick();
 assert.ok(door.position.y>6.5,`door did not open: ${door.position.y}`);
 assert.notEqual(ray()?.collider.handle,door.collider.handle);
 place(f.game,p,-11,.9,0);f.game.world.step();
 for(let i=0;i<240;i++)f.game.tick();
 assert.ok(door.position.y>6.5,'door closed on player');
 place(f.game,p,-20,.9,0);f.game.world.step();
 for(let i=0;i<120;i++)f.game.tick();
 assert.ok(Math.abs(door.position.y-2)<1e-5,'door did not close');
 assert.equal(ray()?.collider.handle,door.collider.handle);
});
test('round restart resets moving mechanisms to their authored origins',async t=>{
 const f=await fixture(2,'crucible');t.after(()=>f.dispose());quiet(f.game);
 for(let i=0;i<4/STEP;i++)f.game.tick();
 const lift=mechanisms(f.game).parts[0];assert.ok(lift.position.y>0);
 f.game.start(f.game.config);
 assert.ok(lift.position.distanceTo(lift.definition.position)<1e-7);
});
test('standing on a lift expires the hop chain and jumping leaves the platform',async t=>{
 const f=await fixture(2,'crucible');t.after(()=>f.dispose());quiet(f.game);
 const p=f.game.player;
 place(f.game,p,0,.865,-18);
 Object.assign(p.motion,{grounded:true,landedAt:0,groundedSince:0,chain:true,tier:2});
 f.game.world.step();
 for(let i=0;i<120;i++)f.game.tick();
 assert.equal(p.motion.landedAt,0,'support must not manufacture fresh landings');
 assert.equal(p.motion.tier,0,'standing beyond the grace window resets the chain');
 const input=f.game.input.consume;
 f.game.input.consume=()=>({...input(),jump:true});f.game.tick();
 f.game.input.consume=input;
 assert.equal(p.motion.tier,0,'a late jump is an ordinary takeoff');
 assert.ok(p.motion.vy>0);assert.equal(p.motion.grounded,false);
 for(let i=0;i<12;i++)f.game.tick();
 assert.ok(p.motion.y>1.3,'rider can jump clear of the lift');
});
