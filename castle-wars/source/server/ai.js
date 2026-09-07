import { WORLD, RULES, WEAPONS } from '../shared/content.js';
import { getMuzzle, launchVelocity, predictShot, projectileAcceleration, validateBuild, snapBuild } from '../shared/game.js';

const center = r => ({ x:r.x+r.w/2, y:r.y+r.h/2 });
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const normalize = a => Math.atan2(Math.sin(a),Math.cos(a));

function randomFor(text) {
  let n=2166136261;
  for (const c of text) n=Math.imul(n^c.charCodeAt(0),16777619);
  return () => {n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};
}

/** Both ballistic arcs to a public target, with the same wind/gravity as play.
 * Solving for time squared avoids treating a headwind as a flipped aim angle.
 * The muzzle depends on angle, so refine it before returning each solution.
 */
export function ballisticCandidates(state, unit, weapon, target, power) {
  const { ax, ay } = projectileAcceleration(state, weapon);
  const velocity = launchVelocity(weapon, power, 0), speed = Math.hypot(velocity.vx, velocity.vy);
  const quadratic = (origin, high) => {
    const dx = target.x - origin.x, dy = target.y - origin.y;
    const a = (ax * ax + ay * ay) / 4, b = dx * ax + dy * ay + speed * speed, c = dx * dx + dy * dy;
    const discriminant = b * b - 4 * a * c;
    if (!Number.isFinite(discriminant) || discriminant < 0 || b <= 0) return null;
    const root = Math.sqrt(discriminant);
    const timeSquared = a < 1e-9 ? c / b : high ? (b + root) / (2 * a) : 2 * c / (b + root);
    if (!Number.isFinite(timeSquared) || timeSquared <= 0) return null;
    const time = Math.sqrt(timeSquared);
    return { angle: normalize(Math.atan2(dy - ay * timeSquared / 2, dx - ax * timeSquared / 2)), flightTime: time };
  };
  const results = [];
  for (const high of [false, true]) {
    let angle = Math.atan2(target.y - unit.y - unit.h / 2, target.x - unit.x - unit.w / 2), solved;
    for (let i = 0; i < 4; i++) {
      solved = quadratic(getMuzzle(state, unit, angle), high);
      if (!solved) break;
      angle = solved.angle;
    }
    if (solved && !results.some(r => Math.abs(normalize(r.angle - solved.angle)) < 1e-5)) results.push({ ...solved, power });
  }
  return results;
}

/** Bounded public-state planner. It never reads the other player's input. */
export function chooseAIAction(state) {
  const side=state.activeSide, own=state.teams[side], enemy=state.teams[1-side];
  const unit=own.units.find(u=>u.id===state.activeUnitId && u.alive && u.hp>0);
  if (!unit) return null;
  const rng=randomFor(`${state.matchId}:${state.turnId}`);
  const candidates=[];
  const siege=!state.suddenDeath&&rng()<.55;
  const available=Object.values(WEAPONS).filter(w=>(own.ammo[w.id]??0)!==0);
  const fire=available.filter(w=>w.kind==='fire');
  // Try the unlocked tools first in the candidate budget, and retain basics.
  fire.sort((a,b)=>(b.pool||0)-(a.pool||0));
  const targets=[...enemy.units.filter(u=>u.alive&&u.hp>0).map(u=>({...center(u),id:u.id,weight:2})),{...center(enemy.core),id:enemy.core.id,weight:3}]
    .filter(t=>t.y<state.waterY);
  const front=state.tiles.filter(t=>t.side!==side&&t.hp>0&&t.y<WORLD.groundY&&t.y<state.waterY);
  const low=[...front].sort((a,b)=>b.y-a.y||Math.abs(a.x-unit.x)-Math.abs(b.x-unit.x)).slice(0,2);
  const high=[...front].sort((a,b)=>a.y-b.y||Math.abs(a.x-unit.x)-Math.abs(b.x-unit.x)).slice(0,2);
  // Roof targets supply lofted arcs when a courtyard blocks the
  // direct line to the core. Both height bands get a place in each power sweep.
  for(const tile of [...low,...high]) if(!targets.some(target=>target.id===tile.id)) targets.push({...center(tile),id:tile.id,weight:tile.y<400?1.5:1});
  // A consistent seeded goal varies the plan without consulting hidden input.
  targets.sort((a,b)=>(siege?(a.weight-b.weight):(b.weight-a.weight)));

  function score(weapon, impact) {
    if (!impact || !Number.isFinite(impact.x) || impact.y>=state.waterY) return -100;
    const hitId=impact.hitId;
    const tile=state.tiles.find(t=>t.id===hitId);
    const damage=weapon.damage||60, radius=weapon.radius||42;
    let value=0;
    if(tile) value+=(tile.side===side?-3:(siege?1.1:.65))*Math.min(tile.hp,damage);
    for(const team of state.teams) {
      for(const body of [...team.units.filter(u=>u.alive),team.core]) {
        if(body.hp<=0) continue;
        const dx=Math.max(body.x-impact.x,0,impact.x-body.x-body.w);
        const dy=Math.max(body.y-impact.y,0,impact.y-body.y-body.h);
        const d=Math.hypot(dx,dy);
        if(d>radius) continue;
        const direct=hitId===body.id;
        const expected=Math.min(body.hp,damage*(1-d/radius))*(direct?1:0.3);
        const important=body.id===team.core.id?2.4:(siege?.9:1.5);
        value+=expected*important*(team.side===side?-2.8:1);
        if(direct&&damage>=body.hp&&team.side!==side) value+=body.id===team.core.id||team.units.filter(u=>u.alive).length===1?1000:70;
      }
    }
    if(tile&&tile.side!==side) value+= Math.max(0,(siege?70:25)-Math.abs(tile.y-(WORLD.groundY-70))*.15);
    if((weapon.pool||0)>0) value-=8;
    return value;
  }

  const safeImpact = impact => {
    if (!impact.hitType || impact.hitId?.startsWith(`s${side}:`)) return false;
    // Ground/water misses are fair; an unfinished arc above/outside the map is
    // not a useful plan, and a short shot may still blast the firing tower.
    return Boolean(impact.hitId?.startsWith(`s${1-side}:`)) || (side===0 ? impact.x>WORLD.width/2 : impact.x<WORLD.width/2);
  };
  const queues = fire.map(weapon => {
    const options=[];
    for(const power of [1,.9,.8,.7,.6,.5]) {
      for(const target of targets) {
        for(const solution of ballisticCandidates(state,unit,weapon,target,power)) {
          // Bound planning work only. High arcs have no ceiling or live expiry;
          // the allowance includes near-edge collisions before a target center.
          if(solution.flightTime>RULES.predictionHorizonMs/1000+.12) continue;
          options.push({...solution,targetId:weapon.homing?enemy.units.find(u=>u.alive)?.id:target.id});
        }
      }
    }
    // Rear shooters try reachable lofted lanes before spending their budget on
    // low arcs into cover. The sort is stable across hosts and machine speeds.
    if(unit.needsArc) options.sort((a,b)=>(Math.abs(Math.sin(b.angle))>.6?1:0)-(Math.abs(Math.sin(a.angle))>.6?1:0));
    return {weapon,options,index:0,accepted:0};
  });
  // Round-robin sampling preserves a share for the infinite default weapons.
  // Fixed work, never elapsed CPU time, decides which candidates are examined.
  let predictions=0;
  while(predictions<144) {
    let advanced=false;
    for(const queue of queues) {
      if(predictions>=144) break;
      if(queue.index>=queue.options.length||queue.accepted>=12) continue;
      advanced=true;
      const option=queue.options[queue.index++], weapon=queue.weapon;
      const impact=predictShot(state,unit.id,weapon.id,option.angle,option.power);
      predictions++;
      if(!safeImpact(impact)) continue;
      candidates.push({kind:'fire',unitId:unit.id,weaponId:weapon.id,angle:option.angle,power:option.power,targetId:option.targetId,score:score(weapon,impact)+rng()*5});
      queue.accepted++;
    }
    if(!advanced) break;
  }

  const defensive=rng()<.3;
  if(defensive||own.core.hp<own.core.maxHp*.65||own.units.some(u=>u.alive&&u.hp<70)) {
    for(const kit of available.filter(w=>w.kind==='build')) {
      const step=WORLD.tileSize;
      for(const body of [...own.units.filter(u=>u.alive),own.core]) {
        for(const dx of [-2,-1,0,1,2,3]) {
          for(const dy of [-2,-1,0,1]) {
            const {x,y}=snapBuild(state,side,body.x+dx*step,body.y+body.h-kit.footprint.h*step+dy*step);
            const ahead=side===0?x>=body.x:x+kit.footprint.w*step<=body.x+body.w;
            if(validateBuild(state,side,kit.id,x,y).ok) candidates.push({kind:'build',unitId:unit.id,weaponId:kit.id,x,y,score:(defensive?150:55)+(1-body.hp/body.maxHp)*80+(ahead?20:0)+rng()*10});
          }
        }
      }
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  const best=candidates[0];
  if(best&&best.score>-75) {
    const {score:unused,...action}=best;
    if(action.kind==='fire') {
      const angleError=(rng()+rng()-1)*.13, powerError=(rng()+rng()-1)*.1;
      // Keep human-like aim error, but shrink it at a narrow launch aperture.
      // A safe miss still stands; variation cannot turn a clear lane into a
      // self-hit or a trajectory with no predicted landing.
      for(const fraction of [1,.5,.25,.125,0]) {
        const angle=normalize(action.angle+angleError*fraction);
        const power=clamp(action.power+powerError*fraction,.15,1);
        if(safeImpact(predictShot(state,unit.id,action.weaponId,angle,power))) {
          action.angle=angle; action.power=power; break;
        }
      }
      if(WEAPONS[action.weaponId]?.id!=='seeker') delete action.targetId;
      else if(!enemy.units.some(u=>u.id===action.targetId&&u.alive)) action.targetId=enemy.units.find(u=>u.alive)?.id;
    }
    return action;
  }
  return {kind:'fire',unitId:unit.id,weaponId:'basic',angle:side===0?-.55:-Math.PI+.55,power:.87};
}
