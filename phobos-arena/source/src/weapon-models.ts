import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { WEAPONS, type WeaponId } from "./rules";
import { WEAPON_SKINS, type WeaponSkinId } from "./cosmetics";

/** Original low-poly weapons. Origin matches the viewmodel mount, muzzle faces -Z. */
export function makeWeaponModel(id: WeaponId, skin: WeaponSkinId = "original"): THREE.Group {
  const group = new THREE.Group();
  group.name = `weapon-${id}`;
  group.userData.skin = skin;
  const finish = (WEAPON_SKINS.find(item => item.id === skin) ?? WEAPON_SKINS[0]).palette;
  const metal = new THREE.MeshStandardMaterial({
    color: finish.metal,
    metalness: finish.metalness,
    roughness: finish.roughness,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: finish.dark,
    metalness: 0.65,
    roughness: 0.5,
  });
  const bone = new THREE.MeshStandardMaterial({
    color: finish.bone,
    metalness: 0.28,
    roughness: 0.55,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: WEAPONS[id].color,
    emissive: WEAPONS[id].color,
    emissiveIntensity: 0.7,
    metalness: 0.35,
    roughness: 0.4,
  });
  metal.name = "weapon-metal";
  dark.name = "weapon-housing";
  bone.name = "weapon-trim";
  accent.name = "weapon-energy";
  const mesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    group.add(part);
    return part;
  };
  const box = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material = metal,
  ) => mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.12), material, x, y, z);
  const tube = (
    radius: number,
    length: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material = metal,
    ends = true,
  ) => {
    const part = mesh(
      new THREE.CylinderGeometry(radius, radius * 1.07, length, 8, 1, !ends),
      material,
      x,
      y,
      z,
    );
    part.rotation.x = Math.PI / 2;
    return part;
  };
  const ring = (
    radius: number,
    thickness: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material = bone,
  ) =>
    mesh(new THREE.TorusGeometry(radius, thickness, 4, 10), material, x, y, z);
  const horn = (x: number, y: number, z: number, length = 0.26, tilt = 0) => {
    const part = mesh(new THREE.ConeGeometry(0.038, length, 4), bone, x, y, z);
    part.rotation.set(-Math.PI / 2, tilt, 0);
    return part;
  };
  if (id === "melee") {
    box(0.21, 0.15, 0.25, 0, -0.05, 0.05);
    box(0.2, 0.035, 0.13, 0, 0.04, 0.01, accent);
    for (const x of [-0.09, 0, 0.09]) horn(x, 0, -0.22, 0.48);
    return group;
  }
  box(0.22, 0.18, 0.4, 0, 0, 0.02);
  box(0.13, 0.13, 0.26, 0, -0.11, 0.12, bone);
  box(0.065, 0.028, 0.17, 0, 0.11, 0.03, accent);

  switch (id) {
    case "machinegun":
      box(0.075, 0.08, 0.48, 0, 0.04, -0.37);
      for (const x of [-0.075, 0.075])
        box(0.035, 0.07, 0.34, x, 0.04, -0.28, bone);
      tube(0.047, 0.09, 0, 0.04, -0.63, dark);
      box(0.025, 0.055, 0.05, 0, 0.13, -0.43, bone);
      box(0.08, 0.16, 0.12, 0.12, -0.075, -0.05, dark);
      break;
    case "rocket":
      tube(0.16, 0.68, 0, 0.025, -0.22);
      ring(0.145, 0.024, 0, 0.025, -0.57);
      tube(0.105, 0.008, 0, 0.025, -0.564, dark);
      box(0.06, 0.055, 0.3, 0.16, 0.075, -0.23, accent);
      for (const x of [-0.14, 0.14]) horn(x, 0.07, -0.37, 0.23);
      break;
    case "rail":
      box(0.09, 0.08, 0.55, 0, 0.045, -0.4, dark);
      for (const x of [-0.092, 0.092]) {
        box(0.035, 0.09, 0.57, x, 0.065, -0.35, accent);
        box(0.065, 0.035, 0.2, x, 0.11, -0.22, bone);
      }
      ring(0.09, 0.016, 0, 0.055, -0.52);
      tube(0.045, 0.22, 0, 0.17, -0.035, dark);
      tube(0.038, 0.01, 0, 0.17, -0.15, accent);
      break;
    case "shotgun":
      for (const x of [-0.067, 0.067]) {
        tube(0.065, 0.53, x, 0.04, -0.35);
        ring(0.056, 0.014, x, 0.04, -0.62);
        tube(0.042, 0.012, x, 0.04, -0.61, dark);
      }
      box(0.21, 0.06, 0.21, 0, -0.04, -0.27, bone);
      for (const z of [-0.34, -0.28, -0.22])
        box(0.23, 0.027, 0.02, 0, -0.055, z, dark);
      box(0.16, 0.08, 0.25, 0, 0.07, 0.14, bone);
      break;
    case "lightning":
      tube(0.09, 0.24, 0, 0.04, -0.2, dark);
      for (const z of [-0.15, -0.22, -0.29])
        ring(0.087, 0.018, 0, 0.04, z, accent);
      for (const x of [-0.115, 0.115]) {
        box(0.045, 0.065, 0.39, x, 0.055, -0.36, bone);
        box(0.023, 0.035, 0.12, x * 0.7, 0.055, -0.56, accent);
      }
      box(0.18, 0.085, 0.15, 0, -0.06, -0.2, dark);
      break;
    case "grenade": {
      const drum = tube(0.16, 0.23, 0, -0.015, -0.19, dark);
      drum.rotation.set(0, 0, Math.PI / 2);
      for (const x of [-0.13, 0.13]) {
        const cap = tube(0.145, 0.025, x, -0.015, -0.19, bone);
        cap.rotation.set(0, 0, Math.PI / 2);
      }
      tube(0.105, 0.2, 0, 0.06, -0.4);
      ring(0.095, 0.02, 0, 0.06, -0.51, accent);
      box(0.025, 0.09, 0.04, 0, 0.17, -0.25, bone);
      break;
    }
    case "plasma":
      mesh(new THREE.IcosahedronGeometry(0.115, 0), accent, 0, 0.04, -0.24);
      for (const x of [-0.13, 0.13])
        box(0.045, 0.18, 0.33, x, 0.02, -0.24, bone);
      tube(0.11, 0.1, 0, 0.04, -0.43, dark);
      ring(0.1, 0.02, 0, 0.04, -0.48, accent);
      ring(0.135, 0.012, 0, 0.04, -0.17);
      ring(0.135, 0.012, 0, 0.04, -0.3);
      break;
    case "bfg":
      box(0.38, 0.18, 0.36, 0, -0.015, -0.18, dark);
      mesh(new THREE.IcosahedronGeometry(0.135, 1), accent, 0, 0.055, -0.34);
      for (const x of [-0.18, 0.18]) {
        tube(0.07, 0.45, x, 0.01, -0.29);
        box(0.1, 0.06, 0.29, x, 0.105, -0.16, bone);
        horn(x, 0.075, -0.55, 0.2, x * 1.4);
      }
      box(0.25, 0.035, 0.24, 0, -0.125, -0.25, accent);
      ring(0.14, 0.017, 0, 0.055, -0.43);
      break;
    case "nailgun":
      box(0.28, 0.14, 0.23, 0, 0.02, -0.16, bone);
      for (const x of [-0.082, 0, 0.082]) {
        tube(0.036, 0.36, x, 0.06, -0.38);
        horn(x, 0.06, -0.53, 0.13);
      }
      for (const x of [-0.155, 0.155]) {
        box(0.045, 0.16, 0.19, x, 0.05, -0.05, dark);
        box(0.015, 0.1, 0.11, x * 1.1, 0.05, -0.05, accent);
      }
      break;
    case "proximity":
      box(0.26, 0.055, 0.35, 0, 0.045, -0.27, bone);
      box(0.16, 0.035, 0.35, 0, 0.08, -0.28, dark);
      for (const y of [0.095, 0.14, 0.185]) {
        const disc = tube(
          0.105,
          0.025,
          0,
          y,
          -0.16,
          y === 0.185 ? accent : metal,
        );
        disc.rotation.x = 0;
      }
      box(0.04, 0.06, 0.1, -0.12, 0.09, -0.4, accent);
      box(0.04, 0.06, 0.1, 0.12, 0.09, -0.4, accent);
      break;
    case "chaingun":
      tube(0.145, 0.15, 0, 0.03, -0.13, dark);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        tube(
          0.03,
          0.43,
          Math.cos(a) * 0.087,
          0.03 + Math.sin(a) * 0.087,
          -0.38,
        );
      }
      ring(0.115, 0.027, 0, 0.03, -0.55, bone);
      ring(0.13, 0.017, 0, 0.03, -0.25, accent);
      box(0.13, 0.17, 0.19, -0.17, -0.04, 0.01, dark);
      box(0.12, 0.02, 0.06, -0.17, 0.055, -0.01, bone);
      break;
  }
  // Small chamfered fasteners and cooling cuts make the receiver readable up close.
  {
    for (const side of [-1, 1]) {
      for (const z of [-0.045, 0.05]) {
        const fastener = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.009, 6), bone, side * 0.127, 0.032, z);
        fastener.rotation.z = Math.PI / 2;
      }
      for (let i = 0; i < 3; i++)
        box(0.008, 0.041, 0.013, side * 0.13, -0.024, -0.058 + i * 0.035, dark);
    }
  }
  // Four material batches keep the detailed first-person model inexpensive.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const object of [...group.children]) {
    if (!(object instanceof THREE.Mesh)) continue;
    object.updateMatrix();
    const geometry = object.geometry.clone().applyMatrix4(object.matrix);
    const normalized = geometry.index ? geometry.toNonIndexed() : geometry;
    if (normalized !== geometry) geometry.dispose();
    const bucket = batches.get(object.material as THREE.Material) ?? [];
    bucket.push(normalized);
    batches.set(object.material as THREE.Material, bucket);
    object.geometry.dispose();
    group.remove(object);
  }
  for (const [material, geometries] of batches) {
    group.add(new THREE.Mesh(mergeGeometries(geometries, false)!, material));
    geometries.forEach(geometry => geometry.dispose());
  }
  return group;
}

/** Two draw calls per world pickup, retaining the complete weapon silhouette. */
export function makeWeaponPickup(id: WeaponId): THREE.Group {
  const source = makeWeaponModel(id);
  source.updateMatrixWorld(true);
  const surfaces: THREE.BufferGeometry[][] = [[], []];
  const sourceMaterials = new Set<THREE.Material>();
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.MeshStandardMaterial;
    sourceMaterials.add(material);
    const copied = object.geometry.clone().applyMatrix4(object.matrixWorld);
    const geometry = copied.index ? copied.toNonIndexed() : copied;
    if (geometry !== copied) copied.dispose();
    geometry.deleteAttribute("uv");
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = material.color.r;
      colors[i * 3 + 1] = material.color.g;
      colors[i * 3 + 2] = material.color.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    surfaces[
      material.emissiveIntensity > 0 && material.emissive.getHex() !== 0 ? 1 : 0
    ].push(geometry);
    object.geometry.dispose();
  });
  sourceMaterials.forEach((material) => material.dispose());
  const group = new THREE.Group();
  group.name = `pickup-${id}`;
  surfaces.forEach((geometries, index) => {
    if (!geometries.length) return;
    const merged = mergeGeometries(geometries, false)!;
    geometries.forEach((geometry) => geometry.dispose());
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.55,
      roughness: 0.45,
      emissive: index === 1 ? WEAPONS[id].color : 0x000000,
      emissiveIntensity: index === 1 ? 0.7 : 0,
    });
    group.add(new THREE.Mesh(merged, material));
  });
  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 1.15 / Math.max(size.x, size.y, size.z);
  for (const child of group.children) {
    const part = child as THREE.Mesh;
    part.geometry.translate(-center.x, -center.y, -center.z);
    part.geometry.scale(scale, scale, scale);
  }
  return group;
}
