import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export const GORE_LIMITS = Object.freeze({ gibs: 64, droplets: 96, stains: 32 });
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };
const UP = new THREE.Vector3(0, 1, 0);
const NORMAL = new THREE.Vector3(0, 0, 1);
const PALETTE = [0x741521, 0xa12730, 0x4b111b, 0xc5aa8b].map(
  (color) => new THREE.Color(color),
);

interface Fragment {
  active: boolean;
  settled: boolean;
  stained: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  spin: THREE.Vector3;
  scale: THREE.Vector3;
  radius: number;
  shape: RAPIER.Ball;
  born: number;
  life: number;
}
interface Stain {
  active: boolean;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  size: number;
  born: number;
  life: number;
}

/** Bounded cosmetic fragments. Queries read map geometry; effects add no physics objects. */
export class GoreEffects {
  private readonly chunks: Fragment[];
  private readonly drops: Fragment[];
  private readonly marks: Stain[];
  private readonly gibMesh: THREE.InstancedMesh;
  private readonly dropMesh: THREE.InstancedMesh;
  private readonly stainMesh: THREE.InstancedMesh;
  private readonly transform = new THREE.Object3D();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly flight = new THREE.Vector3();
  private readonly flightDirection = new THREE.Vector3();
  private nextGib = 0;
  private nextDrop = 0;
  private nextStain = 0;
  private seed = 0x70686f62;
  private enabled = true;
  private disposed = false;

  constructor(
    readonly scene: THREE.Scene,
    readonly world: RAPIER.World,
  ) {
    const flesh = new THREE.IcosahedronGeometry(1, 1);
    const vertices = flesh.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
      const scale = 0.85 + 0.15 * Math.sin(x * 9 + y * 7 + z * 13);
      vertices.setXYZ(i, x * scale, y * scale, z * scale);
    }
    flesh.computeVertexNormals();
    this.gibMesh = this.mesh(
      "gore-gibs", flesh,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.43 }),
      GORE_LIMITS.gibs,
    );
    this.dropMesh = this.mesh(
      "gore-droplets", new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0x8f1827 }), GORE_LIMITS.droplets,
    );
    const splat = new THREE.CircleGeometry(1, 15);
    const points = splat.getAttribute("position");
    for (let i = 1; i < points.count; i++) {
      const angle = Math.atan2(points.getY(i), points.getX(i));
      const edge = 0.8 + Math.sin(angle * 5 + 1.2) * 0.1 + Math.cos(angle * 9) * 0.1;
      points.setXY(i, points.getX(i) * edge, points.getY(i) * edge);
    }
    this.stainMesh = this.mesh(
      "gore-stains", splat,
      new THREE.MeshStandardMaterial({
        color: 0x54101d, roughness: 0.32, transparent: true,
        opacity: 0.86, depthWrite: false, polygonOffset: true,
        polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }), GORE_LIMITS.stains,
    );
    const fragments = (count: number) => Array.from({ length: count }, (): Fragment => ({
      active: false, settled: false, stained: false,
      position: new THREE.Vector3(), velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(), spin: new THREE.Vector3(),
      scale: new THREE.Vector3(), radius: 0.1, shape: new RAPIER.Ball(0.1),
      born: 0, life: 0,
    }));
    this.chunks = fragments(GORE_LIMITS.gibs);
    this.drops = fragments(GORE_LIMITS.droplets);
    this.marks = Array.from({ length: GORE_LIMITS.stains }, () => ({
      active: false, position: new THREE.Vector3(),
      rotation: new THREE.Quaternion(), size: 0, born: 0, life: 0,
    }));
    this.clear();
  }

  get counts() {
    return {
      gibs: this.chunks.filter((part) => part.active).length,
      droplets: this.drops.filter((part) => part.active).length,
      stains: this.marks.filter((part) => part.active).length,
    };
  }

  private mesh(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count: number,
  ) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(mesh);
    return mesh;
  }

  private random() {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967296;
  }

  private valid(position: THREE.Vector3, time: number) {
    return this.enabled && !this.disposed && Number.isFinite(time) &&
      Number.isFinite(position.x + position.y + position.z);
  }

  hit(position: THREE.Vector3, direction: THREE.Vector3, amount: number, time: number) {
    if (!this.valid(position, time) || !Number.isFinite(amount) || amount <= 0) return;
    const count = Math.min(16, 5 + Math.ceil(amount / 10));
    for (let i = 0; i < count; i++) this.emit(position, direction, time, false);
    this.flush();
  }

  death(position: THREE.Vector3, direction: THREE.Vector3, time: number) {
    if (!this.valid(position, time)) return;
    for (let i = 0; i < 10; i++) this.emit(position, direction, time, true);
    for (let i = 0; i < 24; i++) this.emit(position, direction, time, false);
    this.floorStain(position, 0.6 + this.random() * 0.15, time);
    this.flush();
  }

  private emit(position: THREE.Vector3, direction: THREE.Vector3, time: number, gib: boolean) {
    const index = gib ? this.nextGib++ % this.chunks.length : this.nextDrop++ % this.drops.length;
    const part = (gib ? this.chunks : this.drops)[index];
    part.active = true;
    part.settled = part.stained = false;
    part.position.copy(position);
    part.position.y += this.random() * 0.3;
    const push = Number.isFinite(direction.lengthSq()) && direction.lengthSq() > 0.001
      ? direction.clone().normalize() : new THREE.Vector3(0, 0.2, 0);
    part.velocity.set(
      (this.random() - 0.5) * (gib ? 6 : 4) + push.x * 3,
      1.5 + this.random() * (gib ? 5 : 3) + Math.max(0, push.y) * 2,
      (this.random() - 0.5) * (gib ? 6 : 4) + push.z * 3,
    );
    part.rotation.set(this.random() * 6, this.random() * 6, this.random() * 6);
    part.spin.set(this.random() * 8 - 4, this.random() * 8 - 4, this.random() * 8 - 4);
    const size = gib ? 0.075 + this.random() * 0.075 : 0.018 + this.random() * 0.018;
    const bone = gib && index % 4 === 0;
    part.scale.set(size * (bone ? 0.5 : 1), size * (bone ? 2.4 : 1.4), size * (bone ? 0.6 : 1));
    part.radius = Math.max(part.scale.x, part.scale.y, part.scale.z);
    part.shape.radius = part.radius;
    part.born = time;
    part.life = gib ? 5 + this.random() * 3 : 0.75 + this.random() * 0.65;
    if (gib) this.gibMesh.setColorAt(index, PALETTE[bone ? 3 : index % 3]);
    this.paint(gib ? this.gibMesh : this.dropMesh, index, part, 1);
  }

  private floorStain(position: THREE.Vector3, size: number, time: number) {
    const hit = this.world.castRayAndGetNormal(
      new RAPIER.Ray(position, { x: 0, y: -1, z: 0 }), 4, true,
      RAPIER.QueryFilterFlags.ONLY_FIXED,
    );
    if (!hit || hit.normal.y < 0.65) return;
    const point = position.clone().addScaledVector(UP, -hit.timeOfImpact);
    this.stain(point, new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z), size, time);
  }

  private stain(position: THREE.Vector3, normal: THREE.Vector3, radius: number, time: number) {
    if (normal.y < 0.65) return;
    let size = radius;
    // A stain must fit on its supporting face. Trim it near platform edges instead
    // of projecting blood through a wall or leaving a floating disk over a void.
    for (let attempt = 0; attempt < 3; attempt++) {
      const supported = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].every((angle) => {
        const x = position.x + Math.cos(angle) * size;
        const z = position.z + Math.sin(angle) * size;
        const y = position.y - (normal.x * (x - position.x) + normal.z * (z - position.z)) / normal.y;
        const hit = this.world.castRayAndGetNormal(
          new RAPIER.Ray({ x, y: y + 0.08, z }, { x: 0, y: -1, z: 0 }),
          0.16, true, RAPIER.QueryFilterFlags.ONLY_FIXED,
        );
        return hit && hit.normal.y > 0.65 && Math.abs(hit.timeOfImpact - 0.08) < 0.025;
      });
      if (supported) {
        const mark = this.marks[this.nextStain++ % this.marks.length];
        mark.active = true;
        mark.position.copy(position).addScaledVector(normal, 0.012);
        mark.rotation.setFromUnitVectors(NORMAL, normal);
        mark.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(NORMAL, this.random() * Math.PI * 2));
        mark.size = size;
        mark.born = time;
        mark.life = 15 + this.random() * 5;
        return;
      }
      size *= 0.5;
    }
  }

  update(time: number, dt: number) {
    if (!this.enabled || this.disposed || !Number.isFinite(time) || !Number.isFinite(dt)) return;
    const step = Math.max(0, Math.min(dt, 0.05));
    for (const [parts, mesh, gib] of [
      [this.chunks, this.gibMesh, true], [this.drops, this.dropMesh, false],
    ] as const) {
      for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        if (!part.active) continue;
        const age = time - part.born;
        if (age < 0 || age >= part.life || part.position.y < -128) {
          part.active = false;
          this.hide(mesh, index);
          continue;
        }
        if (!part.settled && step > 0) {
          part.velocity.y -= 14 * step;
          const delta = this.flight.copy(part.velocity).multiplyScalar(step);
          const distance = delta.length();
          const direction = distance > 0 ? this.flightDirection.copy(delta).divideScalar(distance) : UP;
          const sphere = gib && distance > 0 ? this.world.castShape(
            part.position, IDENTITY, direction, part.shape, 0, distance, true,
            RAPIER.QueryFilterFlags.ONLY_FIXED,
          ) : null;
          const ray = !gib && distance > 0 ? this.world.castRayAndGetNormal(
            new RAPIER.Ray(part.position, direction), distance, true,
            RAPIER.QueryFilterFlags.ONLY_FIXED,
          ) : null;
          const impact = sphere?.time_of_impact ?? ray?.timeOfImpact;
          const hitNormal = sphere?.normal1 ?? ray?.normal;
          if (impact !== undefined && hitNormal) {
            const normal = new THREE.Vector3(hitNormal.x, hitNormal.y, hitNormal.z);
            part.position.addScaledVector(direction, impact).addScaledVector(normal, 0.015);
            if (!gib) {
              if (index % 3 === 0) this.floorStain(part.position, 0.06 + this.random() * 0.09, time);
              part.active = false;
            } else {
              part.velocity.reflect(normal).multiplyScalar(0.28);
              part.spin.multiplyScalar(0.4);
              if (normal.y > 0.65) {
                if (!part.stained) this.floorStain(part.position, 0.18, time);
                part.stained = true;
                if (part.velocity.lengthSq() < 2) {
                  part.settled = true;
                  part.spin.set(0, 0, 0);
                  // The flight sweep uses a conservative sphere. Rest the actual
                  // irregular mesh on the surface so thin bone pieces do not hover.
                  const vertices = this.gibMesh.geometry.getAttribute("position");
                  const vertex = new THREE.Vector3();
                  const rotation = new THREE.Quaternion().setFromEuler(part.rotation);
                  let support = 0;
                  for (let v = 0; v < vertices.count; v++) {
                    vertex.fromBufferAttribute(vertices, v).multiply(part.scale).applyQuaternion(rotation);
                    support = Math.max(support, -vertex.dot(normal));
                  }
                  part.position.addScaledVector(normal, support - part.radius);
                }
              }
            }
          } else part.position.add(delta);
          part.rotation.x += part.spin.x * step;
          part.rotation.y += part.spin.y * step;
          part.rotation.z += part.spin.z * step;
        }
        if (!part.active) this.hide(mesh, index);
        else this.paint(mesh, index, part, Math.min(1, (part.life - age) / (gib ? 1.5 : 0.2)));
      }
    }
    for (let index = 0; index < this.marks.length; index++) {
      const mark = this.marks[index];
      if (!mark.active) continue;
      const remaining = mark.life - (time - mark.born);
      if (remaining <= 0 || time < mark.born) {
        mark.active = false;
        this.hide(this.stainMesh, index);
      } else {
        this.transform.position.copy(mark.position);
        this.transform.quaternion.copy(mark.rotation);
        this.transform.scale.setScalar(mark.size * Math.min(1, remaining / 3));
        this.transform.updateMatrix();
        this.stainMesh.setMatrixAt(index, this.transform.matrix);
      }
    }
    this.flush();
  }

  private paint(mesh: THREE.InstancedMesh, index: number, part: Fragment, fade: number) {
    this.transform.position.copy(part.position);
    this.transform.rotation.copy(part.rotation);
    this.transform.scale.copy(part.scale).multiplyScalar(fade);
    this.transform.updateMatrix();
    mesh.setMatrixAt(index, this.transform.matrix);
  }

  private hide(mesh: THREE.InstancedMesh, index: number) {
    mesh.setMatrixAt(index, this.hiddenMatrix);
  }

  private flush() {
    for (const mesh of [this.gibMesh, this.dropMesh, this.stainMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.clear();
    for (const mesh of [this.gibMesh, this.dropMesh, this.stainMesh]) mesh.visible = enabled && !this.disposed;
  }

  clear() {
    this.chunks.forEach((part, i) => { part.active = false; this.hide(this.gibMesh, i); });
    this.drops.forEach((part, i) => { part.active = false; this.hide(this.dropMesh, i); });
    this.marks.forEach((mark, i) => { mark.active = false; this.hide(this.stainMesh, i); });
    this.nextGib = this.nextDrop = this.nextStain = 0;
    this.seed = 0x70686f62;
    this.flush();
  }

  dispose() {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    for (const mesh of [this.gibMesh, this.dropMesh, this.stainMesh]) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
  }
}
