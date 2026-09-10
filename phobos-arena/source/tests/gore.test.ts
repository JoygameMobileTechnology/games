import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GoreEffects, GORE_LIMITS } from "../src/gore.ts";

const ready = RAPIER.init();
async function fixture(floor = true) {
  await ready;
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  if (floor) world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.5, 20).setTranslation(0, -0.5, 0));
  world.step();
  const scene = new THREE.Scene(), gore = new GoreEffects(scene, world);
  return { world, scene, gore, dispose() { gore.dispose(); world.free(); } };
}
const position = new THREE.Vector3(0, 0.9, 0);
const direction = new THREE.Vector3(0, 0.2, -1);
function meshes(scene: THREE.Scene) { return scene.children as THREE.InstancedMesh[]; }

test("gore remains three pooled draws with fixed limits and no physics bodies", async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  const originalColliders = f.world.colliders.len();
  for (let i = 0; i < 250; i++) {
    f.gore.hit(position, direction, 1000, i / 100);
    f.gore.death(position, direction, i / 100);
  }
  f.gore.update(2.5, 1 / 120);
  assert.deepEqual(f.gore.counts, GORE_LIMITS);
  assert.equal(f.scene.children.length, 3);
  assert.deepEqual(meshes(f.scene).map((mesh) => mesh.count), [64, 96, 32]);
  assert.equal(f.world.colliders.len(), originalColliders);
  assert.equal(f.world.bodies.len(), 0);
  assert.ok(meshes(f.scene).every((mesh) => [...mesh.instanceMatrix.array].every(Number.isFinite)));
});

test("gibs collide cosmetically with the floor, stains stay grounded and every effect expires", async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  f.gore.death(position, direction, 0);
  assert.equal(f.gore.counts.gibs, 10);
  assert.equal(f.gore.counts.droplets, 24);
  for (let tick = 1; tick <= 360; tick++) f.gore.update(tick / 120, 1 / 120);
  assert.equal(f.gore.counts.droplets, 0);
  assert.ok(f.gore.counts.stains > 0);
  const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(), at = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const gibs = f.scene.getObjectByName("gore-gibs") as THREE.InstancedMesh;
  for (let i = 0; i < gibs.count; i++) {
    gibs.getMatrixAt(i, matrix); matrix.decompose(at, rotation, scale);
    if (scale.lengthSq() > 0) assert.ok(at.y >= 0, "chunks never tunnel under the floor");
  }
  const stains = f.scene.getObjectByName("gore-stains") as THREE.InstancedMesh;
  for (let i = 0; i < stains.count; i++) {
    stains.getMatrixAt(i, matrix); matrix.decompose(at, rotation, scale);
    if (scale.lengthSq() > 0) assert.ok(Math.abs(at.y - 0.012) < 0.02);
  }
  f.gore.update(30, 0.1);
  assert.deepEqual(f.gore.counts, { gibs: 0, droplets: 0, stains: 0 });
});

test("gore never projects stains into a void and clears on disable or disposal", async (t) => {
  const f = await fixture(false); t.after(() => f.dispose());
  f.gore.death(position, direction, 0);
  for (let tick = 1; tick <= 360; tick++) f.gore.update(tick / 120, 1 / 120);
  assert.equal(f.gore.counts.stains, 0);
  f.gore.setEnabled(false);
  assert.deepEqual(f.gore.counts, { gibs: 0, droplets: 0, stains: 0 });
  assert.ok(meshes(f.scene).every((mesh) => !mesh.visible));
  f.gore.death(position, direction, 4);
  assert.equal(f.gore.counts.gibs, 0);
  f.gore.setEnabled(true);
  f.gore.hit(position, direction, 40, 4);
  assert.ok(f.gore.counts.droplets > 0);
  const objects = [...meshes(f.scene)];
  let disposed = 0;
  objects.forEach((mesh) => mesh.geometry.addEventListener("dispose", () => disposed++));
  f.gore.dispose(); f.gore.dispose();
  assert.equal(disposed, 3);
  assert.equal(f.scene.children.length, 0);
  f.gore.death(position, direction, 5);
  assert.equal(f.gore.counts.gibs, 0);
});

test("fragment sweeps stop at thin walls and stains shrink to fit small platforms", async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  f.world.createCollider(RAPIER.ColliderDesc.cuboid(10, 10, 0.01).setTranslation(0, 3, -0.8));
  f.world.step();
  f.gore.death(position, direction, 0);
  for (let tick = 1; tick <= 90; tick++) f.gore.update(tick / 120, 1 / 120);
  const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(), at = new THREE.Vector3();
  for (const mesh of meshes(f.scene).filter((mesh) => mesh.name !== "gore-stains"))
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      matrix.decompose(at, new THREE.Quaternion(), scale);
      if (scale.lengthSq() > 0) assert.ok(at.z > -0.8, "fragments cannot cross the wall");
    }
  const small = await fixture(false); t.after(() => small.dispose());
  small.world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.1, 0.5).setTranslation(0, -0.1, 0));
  small.world.step();
  small.gore.death(position, direction, 0);
  small.gore.update(0, 0);
  assert.equal(small.gore.counts.stains, 1);
  const stain = small.scene.getObjectByName("gore-stains") as THREE.InstancedMesh;
  stain.getMatrixAt(0, matrix);
  const vertices = stain.geometry.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(matrix);
    assert.ok(Math.abs(point.x) < 0.5 && Math.abs(point.z) < 0.5, "the entire blood mark is supported");
  }
});

test("gore event randomness is private and clear resets the visual sequence", async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  t.mock.method(Math, "random", () => { throw new Error("cosmetic emission must not advance gameplay RNG"); });
  f.gore.death(position, direction, 0);
  f.gore.update(0.1, 0.05);
  const first = meshes(f.scene).map((mesh) => [...mesh.instanceMatrix.array]);
  f.gore.clear();
  f.gore.death(position, direction, 0);
  f.gore.update(0.1, 0.05);
  assert.deepEqual(meshes(f.scene).map((mesh) => [...mesh.instanceMatrix.array]), first);
});

test("invalid hit inputs cannot contaminate instance matrices or allocate effects", async (t) => {
  const f = await fixture(); t.after(() => f.dispose());
  f.gore.hit(position, direction, 0, 0);
  f.gore.hit(new THREE.Vector3(NaN, 0, 0), direction, 10, 0);
  f.gore.death(position, direction, Infinity);
  f.gore.update(NaN, 1 / 120);
  assert.deepEqual(f.gore.counts, { gibs: 0, droplets: 0, stains: 0 });
  assert.ok(meshes(f.scene).every((mesh) => [...mesh.instanceMatrix.array].every(Number.isFinite)));
});
