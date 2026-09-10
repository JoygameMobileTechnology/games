import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { Actor } from "./game";
import type { ArenaLayout, ArenaMechanism } from "./maps/types";
import { land } from "./rules";

interface MovingPart {
  definition: ArenaMechanism;
  mesh: THREE.Group;
  collider: RAPIER.Collider;
  position: THREE.Vector3;
  delta: THREE.Vector3;
  openness: number;
}
const rotation = { x: 0, y: 0, z: 0, w: 1 };
const capsule = new RAPIER.Capsule(0.5, 0.35);
const standingHeight = 0.865;

/** Authored arena machinery. Fixed collision queries also see doors and lifts. */
export class ArenaMechanisms {
  readonly parts: MovingPart[] = [];
  private riders = new Map<number, MovingPart>();
  private groundedRiders = new Set<number>();
  constructor(scene: THREE.Scene, private world: RAPIER.World, map: ArenaLayout) {
    for (const definition of map.mechanisms ?? []) {
      const { size, position, kind } = definition;
      const mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z),
        new THREE.MeshStandardMaterial({ color: kind === "door" ? "#545766" : "#6b5549", metalness: 0.7, roughness: 0.45 }));
      mesh.add(body);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(size.x * 0.9, 0.06, size.z * 0.9),
        new THREE.MeshBasicMaterial({ color: kind === "door" ? "#bda4ff" : "#ffae52" }));
      edge.position.y = size.y / 2 + 0.04;
      mesh.add(edge);
      if (kind === "door") {
        for (const side of [-1, 1]) {
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.09, size.y * 0.7, 0.04), edge.material);
          stripe.position.set(side * size.x * 0.3, 0, size.z / 2 + 0.025); mesh.add(stripe);
        }
      }
      mesh.position.copy(position); scene.add(mesh);
      const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(size.x/2, size.y/2, size.z/2).setTranslation(position.x, position.y, position.z));
      this.parts.push({ definition, mesh, collider, position: position.clone(), delta: new THREE.Vector3(), openness: 0 });
    }
  }
  reset() {
    this.riders.clear();
    this.groundedRiders.clear();
    for (const part of this.parts) {
      part.openness = 0; part.delta.set(0, 0, 0);
      part.position.copy(part.definition.position);
      part.collider.setTranslation(part.position); part.mesh.position.copy(part.position);
    }
  }
  begin(actors: readonly Actor[], time: number, dt: number) {
    this.riders.clear();
    this.groundedRiders.clear();
    for (const part of this.parts) {
      const d = part.definition;
      part.delta.set(0, 0, 0);
      const living = actors.filter(a => a.health > 0);
      const onTop = living.filter(a => d.kind === "platform" && a.motion.vy <= 0 &&
        Math.abs(a.motion.y - (part.position.y + d.size.y / 2 + standingHeight)) < 0.16 &&
        Math.abs(a.motion.x - part.position.x) < d.size.x / 2 + 0.15 &&
        Math.abs(a.motion.z - part.position.z) < d.size.z / 2 + 0.15);
      let targetFraction: number;
      if (d.kind === "door") {
        const near = living.some(a => Math.hypot(a.motion.x-d.position.x, a.motion.z-d.position.z) < (d.triggerRadius ?? 4) &&
          Math.abs(a.motion.y-d.position.y) < d.size.y/2+1.5);
        targetFraction = THREE.MathUtils.clamp(part.openness + (near ? 1 : -1) * dt / Math.max(0.2,d.period),0,1);
      } else {
        // Dwell at each end for boarding, then travel at a predictable speed.
        const phase = ((time % d.period) + d.period) % d.period / d.period;
        targetFraction = phase < .15 ? 0 : phase < .5 ? (phase-.15)/.35 : phase < .65 ? 1 : 1-(phase-.65)/.35;
      }
      const desired = d.position.clone().addScaledVector(d.travel,targetFraction);
      const delta = desired.sub(part.position);
      // A blocked mechanism never catches up by teleporting after the obstruction leaves.
      const speed = d.travel.length() / Math.max(.2,d.kind === "door" ? d.period : d.period*.35);
      if (delta.length() > speed * dt) delta.setLength(speed * dt);
      const next = part.position.clone().add(delta);
      const obstructed = living.some(a => !onTop.includes(a) && this.overlaps(a,next,d.size));
      const blockedRider = onTop.some(a => {
        if (delta.lengthSq() < 1e-10) return false;
        return !!this.world.castShape(new THREE.Vector3(a.motion.x,a.motion.y,a.motion.z),rotation,delta,capsule,0,1,false,
          undefined,undefined,a.collider,a.body,c=>c.handle!==part.collider.handle);
      });
      if (!obstructed && !blockedRider) {
        part.delta.copy(delta); part.position.copy(next);
        part.openness = d.travel.lengthSq() ? part.position.clone().sub(d.position).dot(d.travel)/d.travel.lengthSq() : 0;
        part.collider.setTranslation(part.position); part.mesh.position.copy(part.position);
      }
      for (const rider of onTop) {
        this.riders.set(rider.id,part);
        if (rider.motion.grounded) this.groundedRiders.add(rider.id);
      }
    }
  }
  carry(actor: Actor) {
    const part = this.riders.get(actor.id);
    if (!part || actor.motion.vy > 0) { this.riders.delete(actor.id); return; }
    actor.motion.x += part.delta.x;
    actor.motion.y += part.delta.y;
    actor.motion.z += part.delta.z;
  }
  blocks(actor: Actor, collider: RAPIER.Collider) {
    return this.riders.get(actor.id)?.collider.handle !== collider.handle;
  }
  settle(actor: Actor, time: number) {
    const part = this.riders.get(actor.id), m = actor.motion;
    if (!part || m.vy > 0) return;
    const top = part.position.y + part.definition.size.y/2 + standingHeight;
    if (Math.abs(m.x-part.position.x) < part.definition.size.x/2 &&
        Math.abs(m.z-part.position.z) < part.definition.size.z/2 && Math.abs(m.y-top) < .2) {
      // The support collider is filtered from the movement sweep, so Rapier may
      // report airborne. Retain an existing landing timestamp while still riding.
      m.y=top;
      if (this.groundedRiders.has(actor.id)) m.grounded=true;
      land(m,time);
    }
  }
  private overlaps(actor: Actor, center: THREE.Vector3, size: THREE.Vector3) {
    return Math.abs(actor.motion.x-center.x) < size.x/2+.35 &&
      Math.abs(actor.motion.z-center.z) < size.z/2+.35 &&
      Math.abs(actor.motion.y-center.y) < size.y/2+.85;
  }
}
