import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { CHARACTERS, CHARACTER_SKINS } from "../src/cosmetics.ts";
import { makeCharacterModel, disposeCharacterModel } from "../src/characters.ts";

function meshes(model: THREE.Group) {
  const result: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) result.push(object as (typeof result)[number]);
  });
  return result;
}
function shapeFingerprint(model: THREE.Group) {
  model.updateMatrixWorld(true);
  const hash = createHash("sha256");
  for (const mesh of meshes(model)) {
    const positions = mesh.geometry.getAttribute("position");
    const point = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      hash.update(point.toArray().map((v) => v.toFixed(5)).join(","));
    }
  }
  return hash.digest("hex");
}

test("seven unique original models keep mobile geometry budgets and a common actor origin", () => {
  const fingerprints = new Set<string>();
  const silhouettes = new Set<string>();
  assert.equal(CHARACTERS.length, 7);
  for (const character of CHARACTERS) {
    const model = makeCharacterModel(character.id);
    try {
      const parts = meshes(model);
      const triangles = parts.reduce((sum, mesh) =>
        sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position").count) / 3, 0);
      assert.ok(triangles >= 1500 && triangles <= 4000, `${character.id}: ${triangles} triangles`);
      assert.ok(parts.length <= 12, `${character.id}: ${parts.length} draw calls`);
      assert.equal(new Set(parts.map((mesh) => mesh.material)).size, 3);
      for (const mesh of parts) {
        assert.equal(Array.isArray(mesh.material), false);
        assert.equal(mesh.material.transparent, false);
        for (const name of ["position", "normal", "color"])
          assert.ok([...mesh.geometry.getAttribute(name).array].every(Number.isFinite),
            `${character.id}: invalid ${name}`);
      }
      const bounds = new THREE.Box3().setFromObject(model);
      assert.ok(Math.abs(bounds.min.y + 0.85) < 0.002, `${character.id}: feet share the capsule floor`);
      assert.ok(bounds.max.y >= 0.8 && bounds.max.y <= 1.05);
      assert.ok(bounds.min.x >= -0.75 && bounds.max.x <= 0.75);
      assert.ok(bounds.min.z >= -0.4 && bounds.max.z <= 0.4);
      assert.deepEqual(model.position.toArray(), [0, 0, 0]);
      assert.deepEqual(model.scale.toArray(), [1, 1, 1]);
      assert.deepEqual(model.userData, { characterId: character.id },
        "character appearance does not define health, damage, speed or collision overrides");
      fingerprints.add(shapeFingerprint(model));
      silhouettes.add(bounds.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(3)).join(","));
    } finally {
      disposeCharacterModel(model);
    }
  }
  assert.equal(fingerprints.size, 7, "characters differ in sculpted geometry, not only paint");
  assert.equal(silhouettes.size, 7, "each model has a distinct measured silhouette envelope");
});

test("character joints articulate independently while the upper body remains stable", () => {
  for (const character of CHARACTERS) {
    const model = makeCharacterModel(character.id);
    try {
      const left = model.getObjectByName("left-leg")!;
      const right = model.getObjectByName("right-leg")!;
      assert.ok(left instanceof THREE.Group && right instanceof THREE.Group);
      assert.equal(left.position.y, -0.28);
      assert.equal(right.position.y, -0.28);
      assert.ok(model.getObjectByName("left-arm"));
      assert.ok(model.getObjectByName("right-arm"));
      const body = model.getObjectByName("body-armor")!;
      model.updateMatrixWorld(true);
      const before = body.matrixWorld.clone();
      const original = shapeFingerprint(model);
      left.rotation.x = 0.35;
      right.rotation.x = -0.35;
      assert.notEqual(shapeFingerprint(model), original);
      assert.ok(body.matrixWorld.equals(before));
      assert.ok(model.children.some((object) => object instanceof THREE.Mesh),
        "the existing JuggernautAura can collect static upper-body batches");
    } finally {
      disposeCharacterModel(model);
    }
  }
});

test("all skins change cosmetic surfaces without changing geometry or team readability", () => {
  for (const character of CHARACTERS) {
    const original = makeCharacterModel(character.id);
    const expectedShape = shapeFingerprint(original);
    try {
      for (const skin of CHARACTER_SKINS) {
        const model = makeCharacterModel(character.id, { skin: skin.id, teamColor: "#397dff" });
        try {
          assert.equal(shapeFingerprint(model), expectedShape, `${character.id}/${skin.id}`);
          const armorParts = meshes(model).filter((mesh) => mesh.material.name === "body-armor");
          assert.ok(armorParts.length >= 5, "team armor covers the torso and all four limbs");
          for (const mesh of armorParts) assert.equal(mesh.material.color.getHexString(), "397dff");
          const emissive = meshes(model).find((mesh) => mesh.material.name === "character-glow")!.material;
          assert.equal(emissive.emissive.getHexString(),
            new THREE.Color(skin.palette?.glow ?? character.palette.glow).getHexString());
        } finally {
          disposeCharacterModel(model);
        }
      }
    } finally {
      disposeCharacterModel(original);
    }
  }
});

test("preview models own their resources and dispose shared joint materials exactly once", () => {
  const first = makeCharacterModel("mordant"), second = makeCharacterModel("mordant");
  const firstParts = meshes(first), secondParts = meshes(second);
  assert.notEqual(firstParts[0].geometry, secondParts[0].geometry);
  assert.notEqual(firstParts[0].material, secondParts[0].material);
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  for (const mesh of firstParts) { resources.add(mesh.geometry); resources.add(mesh.material); }
  const counts = new Map([...resources].map((resource) => [resource, 0]));
  for (const resource of resources)
    resource.addEventListener("dispose", () => counts.set(resource, counts.get(resource)! + 1));
  disposeCharacterModel(first);
  assert.ok([...counts.values()].every((count) => count === 1));
  assert.ok(meshes(second).every((mesh) => mesh.geometry.getAttribute("position").count > 0));
  disposeCharacterModel(second);
});
