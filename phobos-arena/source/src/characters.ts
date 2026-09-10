import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  CHARACTERS, CHARACTER_SKINS,
  type CharacterId, type CharacterPalette, type CharacterSkinId,
} from "./cosmetics";

type Surface = "armor" | "detail" | "glow";
type Point = readonly [number, number, number];
interface Batch {
  group: THREE.Group;
  surfaces: Record<Surface, THREE.BufferGeometry[]>;
}
const point = (p: Point) => new THREE.Vector3(...p);

/** Original articulated arena characters. Forward is -Z; origin is the common
 * gameplay capsule center. Appearance never supplies gameplay stats or colliders. */
export function makeCharacterModel(
  id: CharacterId,
  options: { skin?: CharacterSkinId; teamColor?: string } = {},
): THREE.Group {
  const definition = CHARACTERS.find((character) => character.id === id)!;
  const skin = CHARACTER_SKINS.find((entry) => entry.id === options.skin);
  const palette: CharacterPalette = { ...definition.palette, ...skin?.palette };
  const root = new THREE.Group();
  root.name = `character-${id}`;
  root.userData.characterId = id;
  const armor = new THREE.MeshStandardMaterial({
    color: options.teamColor ?? palette.armor,
    metalness: 0.58, roughness: 0.46,
  });
  armor.name = "body-armor";
  const detail = new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: 0.5, roughness: 0.52,
  });
  detail.name = "character-detail";
  const glow = new THREE.MeshStandardMaterial({
    color: palette.glow, emissive: palette.glow, emissiveIntensity: 1.8,
    metalness: 0.15, roughness: 0.36,
  });
  glow.name = "character-glow";
  const materials = { armor, detail, glow };
  const batches: Batch[] = [];
  const batch = (group = root) => {
    const value: Batch = { group, surfaces: { armor: [], detail: [], glow: [] } };
    batches.push(value);
    return value;
  };
  const body = batch();
  const add = (
    destination: Batch, source: THREE.BufferGeometry, at: Point,
    surface: Surface = "detail", color = palette.metal,
    rotation: Point = [0, 0, 0], scale: Point = [1, 1, 1],
  ) => {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    geometry.deleteAttribute("uv");
    const matrix = new THREE.Matrix4().compose(
      point(at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), point(scale),
    );
    geometry.applyMatrix4(matrix);
    const tint = new THREE.Color(color);
    const colors = new Float32Array(geometry.getAttribute("position").count * 3);
    for (let index = 0; index < colors.length; index += 3) {
      colors[index] = tint.r; colors[index + 1] = tint.g; colors[index + 2] = tint.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    destination.surfaces[surface].push(geometry);
  };
  const box = (
    b: Batch, size: Point, at: Point, surface: Surface = "detail",
    color = palette.metal, rotation: Point = [0, 0, 0],
  ) => add(b, new THREE.BoxGeometry(...size), at, surface, color, rotation);
  const plate = (
    b: Batch, size: Point, at: Point, surface: Surface = "armor",
    color = palette.metal, rotation: Point = [0, 0, 0],
    tapered = false,
  ) => {
    const [w, h, d] = size, cut = Math.min(w, h) * 0.18;
    const shape = new THREE.Shape();
    const outline = tapered ? [
      [0, -h * 0.5], [w * 0.31, -h * 0.3], [w * 0.5, h * 0.17],
      [w * 0.32, h * 0.5], [-w * 0.32, h * 0.5],
      [-w * 0.5, h * 0.17], [-w * 0.31, -h * 0.3],
    ] : [
      [-w / 2 + cut, -h / 2],
      [w / 2 - cut, -h / 2], [w / 2, -h / 2 + cut],
      [w / 2, h / 2 - cut], [w / 2 - cut, h / 2],
      [-w / 2 + cut, h / 2], [-w / 2, h / 2 - cut],
      [-w / 2, -h / 2 + cut],
    ];
    shape.moveTo(outline[0][0], outline[0][1]);
    for (const [x, y] of outline.slice(1)) shape.lineTo(x, y);
    shape.closePath();
    const bevel = Math.min(0.012, d * 0.2);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: d - bevel * 2, bevelEnabled: true, bevelSegments: 1,
      bevelSize: bevel, bevelThickness: bevel, steps: 1, curveSegments: 1,
    });
    geometry.translate(0, 0, -d / 2 + bevel);
    add(b, geometry, at, surface, color, rotation);
  };
  const bone = (
    b: Batch, a: Point, z: Point, radius = 0.035, color = palette.bone,
    top = radius, surface: Surface = "detail", sides = 6,
  ) => {
    const from = point(a), to = point(z), direction = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(top, radius, direction.length(), sides);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), direction.clone().normalize(),
    ));
    const middle = from.add(to).multiplyScalar(0.5);
    add(b, geometry, [middle.x, middle.y, middle.z], surface, color);
  };
  const orb = (b: Batch, at: Point, scale: Point, color = palette.bone, surface: Surface = "detail") =>
    add(b, new THREE.IcosahedronGeometry(1, 1), at, surface, color, [0, 0, 0], scale);
  const horn = (b: Batch, path: Point[], radius = 0.05, color = palette.bone) => {
    for (let i = 1; i < path.length; i++)
      bone(b, path[i - 1], path[i], radius * (1 - (i - 1) / (path.length - 1)), color,
        radius * (1 - i / (path.length - 1)), "detail", 5);
  };
  const ring = (at: Point, radius: number, thickness = 0.018,
    color = palette.bone, surface: Surface = "detail", rotation: Point = [0, 0, 0]) =>
    add(body, new THREE.TorusGeometry(radius, thickness, 4, 12), at, surface, color, rotation);
  const fin = (vertices: Point[], color: string, surface: Surface = "detail") => {
    const shape = new THREE.Shape(vertices.map(([x, y]) => new THREE.Vector2(x, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false, steps: 1 });
    add(body, geometry, [0, 0, vertices[0][2]], surface, color);
  };

  const bulky = id === "karn", slender = id === "nyx" || id === "vesper";
  const width = bulky ? 0.345 : slender ? 0.205 : id === "malice" ? 0.29 : 0.255;
  const dark = new THREE.Color(palette.metal).multiplyScalar(0.48).getStyle();
  // An organic shoulder/rib/waist profile under split forged plates breaks the
  // box silhouette. The lean oracle/stalker and exposed warden retain real gaps.
  orb(body, [0, 0.18, 0.035], [width, 0.24, bulky ? 0.225 : 0.15], dark);
  orb(body, [0, -0.1, 0.045], [width * 0.56, 0.19, 0.115], dark);
  for (const side of [-1, 1]) {
    if (id !== "grim")
      plate(body, [width * 1.02, bulky ? 0.31 : 0.275, bulky ? 0.12 : 0.065],
        [side * width * 0.48, 0.235, bulky ? -0.195 : -0.125],
        "armor", palette.metal, [0.08, side * 0.25, side * -0.16], true);
    else
      plate(body, [0.22, 0.095, 0.055], [side * 0.12, 0.385, -0.065],
        "armor", palette.metal, [0.2, side * 0.15, side * -0.12], true);
    for (let rib = 0; rib < 2; rib++)
      bone(body, [side * width * 0.7, 0.05 - rib * 0.085, -0.04],
        [side * width * 0.47, -0.02 - rib * 0.085, -0.105], 0.025, palette.metal);
    plate(body, [width * 0.62, 0.18, 0.055], [side * width * 0.46, -0.22, -0.055],
      "armor", palette.metal, [0.05, side * 0.3, side * -0.18], true);
  }
  plate(body, [width * 0.72, 0.22, 0.045], [0, -0.07, -0.115], "armor", palette.metal,
    [0, 0, 0], true);
  plate(body, [0.075, 0.095, 0.025], [0, -0.22, -0.13], "detail", palette.bone, [0, 0, 0], true);
  bone(body, [0, 0.35, 0], [0, 0.49, 0], 0.085, dark);
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.name = side < 0 ? "left-leg" : "right-leg";
    leg.position.set(side * (bulky ? 0.185 : 0.135), -0.28, 0);
    root.add(leg);
    const limb = batch(leg);
    const legWidth = bulky ? 0.2 : slender ? 0.115 : 0.145;
    orb(limb, [0, -0.095, 0.02], [legWidth * 0.57, 0.15, 0.095], dark);
    orb(limb, [0, -0.365, 0.025], [legWidth * 0.43, 0.12, 0.07], dark);
    plate(limb, [legWidth, 0.24, 0.045], [0, -0.095, -0.06],
      "armor", palette.metal, [-0.14, 0, side * -0.08], true);
    plate(limb, [legWidth * 0.85, 0.225, 0.035], [0, -0.385, -0.035],
      "armor", palette.metal, [0.13, 0, 0], true);
    orb(limb, [0, -0.245, -0.04], [legWidth * 0.5, 0.064, 0.065], palette.bone);
    orb(limb, [0, -0.515, -0.047], [legWidth * 0.64, 0.055, 0.14], palette.metal);
    bone(limb, [side * legWidth * 0.4, -0.27, 0.065],
      [side * legWidth * 0.32, -0.47, 0.04], 0.015, palette.bone);
    const arm = new THREE.Group();
    arm.name = side < 0 ? "left-arm" : "right-arm";
    arm.position.set(side * (width + (bulky ? 0.055 : 0.035)), 0.3, 0);
    root.add(arm);
    const upper = batch(arm);
    const shoulderScale = id === "malice" && side < 0 ? 1.25 : 1;
    orb(upper, [0, 0.025, 0], [bulky ? 0.16 : 0.102 * shoulderScale, 0.105, bulky ? 0.17 : 0.13],
      palette.armor, "armor");
    plate(upper, [bulky ? 0.235 : 0.16 * shoulderScale, 0.13, 0.032], [0, 0.02, -0.112],
      "armor", palette.metal, [0.2, 0, side * 0.2], true);
    orb(upper, [side * 0.02, -0.145, 0.025], [bulky ? 0.095 : 0.06, 0.15, 0.068], dark);
    orb(upper, [side * 0.022, -0.3, 0], [0.052, 0.055, 0.052], palette.metal);
    bone(upper, [side * 0.025, -0.28, 0.015], [side * 0.035, -0.59, -0.085],
      bulky ? 0.065 : 0.039, dark);
    plate(upper, [bulky ? 0.145 : slender ? 0.084 : 0.103, 0.27, 0.065], [side * 0.025, -0.46, -0.06],
      "armor", palette.metal, [-0.25, 0, side * -0.1], true);
    bone(upper, [side * 0.06, -0.345, -0.075], [side * 0.065, -0.55, -0.1], 0.014, palette.bone);
    orb(upper, [side * 0.035, -0.64, -0.1], [bulky ? 0.06 : 0.045, 0.065, 0.047], palette.bone);
    for (let finger = -1; finger <= 1; finger++)
      bone(upper, [side * 0.035 + finger * 0.025, -0.665, -0.125],
        [side * 0.035 + finger * 0.025, -0.73, -0.155], 0.011);
    if (id === "malice" && side < 0)
      horn(upper, [[-0.045, 0.075, 0.06], [-0.12, 0.2, 0.08], [-0.2, 0.23, 0.04]], 0.043);
  }

  // Faces use layered sockets, cheekbones and separated jaw details, rather than
  // one glowing visor pasted on a generic recolored body.
  const skull = (mask = false) => {
    orb(body, [0, 0.64, 0], [0.16, 0.2, 0.145], mask ? palette.metal : palette.bone);
    for (const side of [-1, 1]) {
      plate(body, [0.107, 0.058, 0.034], [side * 0.075, 0.66, -0.13], "detail", dark,
        [0, side * -0.2, side * 0.15]);
      box(body, [0.056, 0.021, 0.01], [side * 0.072, 0.665, -0.156], "glow");
      bone(body, [side * 0.125, 0.61, -0.105], [side * 0.095, 0.53, -0.11], 0.027);
    }
    box(body, [0.025, 0.055, 0.027], [0, 0.61, -0.147], "detail", dark);
    for (const x of [-0.07, -0.035, 0, 0.035, 0.07])
      box(body, [0.025, 0.045, 0.03], [x, 0.535, -0.132], "detail", palette.bone);
  };

  if (id === "mordant") {
    skull();
    plate(body, [0.245, 0.09, 0.11], [0, 0.775, -0.065]);
    for (const side of [-1, 1]) {
      horn(body, [[side * 0.13, 0.74, 0.015], [side * 0.28, 0.83, 0.02],
        [side * 0.31, 1.005, -0.015]], 0.065);
      plate(body, [0.07, 0.24, 0.025], [side * 0.12, 0.235, -0.178], "detail", palette.bone,
        [0, 0, side * -0.25]);
      horn(body, [[side * 0.36, 0.37, 0.065], [side * 0.43, 0.5, 0.075]], 0.04);
    }
    plate(body, [0.065, 0.12, 0.025], [0, 0.245, -0.19], "glow", palette.glow, [0, 0, 0], true);
    for (const y of [0, 0.1, 0.2]) box(body, [0.13, 0.04, 0.075], [0, y, 0.2]);
  } else if (id === "vesper") {
    skull();
    // Five rigid hood facets frame a recessed bone face and the long oracle mantle.
    for (const side of [-1, 1]) {
      plate(body, [0.105, 0.44, 0.27], [side * 0.185, 0.64, 0.035], "armor", palette.metal,
        [0, 0, side * 0.1]);
      fin([[side * 0.13, 0.89, 0.02], [0, 1.015, 0.02], [side * 0.235, 0.5, 0.02]], palette.armor, "armor");
      fin([[side * 0.12, -0.16, 0.12], [side * 0.31, -0.68, 0.12],
        [side * 0.045, -0.6, 0.12]], palette.armor, "armor");
      bone(body, [side * 0.2, 0.37, -0.13], [0, 0.08, -0.19], 0.02);
      for (const y of [0.03, 0.13, 0.23])
        box(body, [0.045, 0.022, 0.025], [side * 0.14, y, -0.15], "detail", palette.bone);
    }
    plate(body, [0.075, 0.16, 0.025], [0, 0.04, -0.183], "glow", palette.glow, [0, 0, 0], true);
    ring([0, 0.66, 0.18], 0.27, 0.018);
  } else if (id === "karn") {
    plate(body, [0.33, 0.29, 0.27], [0, 0.63, 0]);
    plate(body, [0.27, 0.095, 0.035], [0, 0.655, -0.16], "detail", dark);
    box(body, [0.17, 0.035, 0.015], [0, 0.67, -0.184], "glow");
    for (const x of [-0.09, -0.045, 0, 0.045, 0.09])
      box(body, [0.027, 0.085, 0.04], [x, 0.535, -0.145], "detail", palette.bone);
    orb(body, [0, 0.22, -0.245], [0.15, 0.17, 0.055], palette.glow, "glow");
    ring([0, 0.22, -0.27], 0.175, 0.035, palette.metal);
    for (const x of [-0.075, 0, 0.075])
      bone(body, [x, 0.08, -0.302], [x, 0.36, -0.302], 0.017, palette.bone);
    for (const side of [-1, 1]) {
      bone(body, [side * 0.23, 0.02, 0.2], [side * 0.23, 0.8, 0.2], 0.072, palette.metal);
      ring([side * 0.23, 0.79, 0.2], 0.063, 0.019, palette.bone, "detail", [Math.PI / 2, 0, 0]);
      plate(body, [0.12, 0.37, 0.08], [side * 0.26, 0.17, -0.2]);
    }
  } else if (id === "nyx") {
    orb(body, [0, 0.65, 0], [0.14, 0.2, 0.14], dark);
    for (const side of [-1, 1]) {
      fin([[0, 0.84, -0.17], [side * 0.165, 0.75, -0.17],
        [side * 0.07, 0.49, -0.17], [0, 0.555, -0.17]], palette.armor, "armor");
      box(body, [0.075, 0.02, 0.03], [side * 0.064, 0.685, -0.188], "glow");
      horn(body, [[side * 0.07, 0.75, 0.02], [side * 0.105, 0.965, 0.11]], 0.04, palette.metal);
      fin([[side * 0.21, 0.41, 0.02], [side * 0.44, 0.61, 0.02],
        [side * 0.35, 0.2, 0.02]], palette.bone);
      plate(body, [0.04, 0.235, 0.02], [side * 0.1, 0.22, -0.172], "detail", palette.bone,
        [0, 0, side * -0.34]);
      bone(body, [side * 0.16, -0.16, 0.14], [side * 0.11, 0.35, 0.17], 0.035, palette.metal);
    }
    plate(body, [0.04, 0.14, 0.02], [0, 0.16, -0.18], "glow", palette.glow, [0, 0, 0], true);
  } else if (id === "grim") {
    skull();
    plate(body, [0.3, 0.09, 0.12], [0, 0.8, 0.02]);
    for (const x of [-0.12, 0, 0.12])
      horn(body, [[x, 0.815, 0.02], [x, 0.96 - Math.abs(x) * 0.25, 0.03]], 0.025);
    for (const side of [-1, 1]) {
      for (let rib = 0; rib < 4; rib++) {
        const y = 0.34 - rib * 0.09;
        bone(body, [side * 0.22, y + 0.02, -0.11], [side * 0.16, y - 0.045, -0.265], 0.024);
        bone(body, [side * 0.16, y - 0.045, -0.265], [side * 0.025, y - 0.06, -0.265], 0.022);
      }
      plate(body, [0.11, 0.21, 0.08], [side * 0.23, -0.2, 0.015], "detail", palette.bone,
        [0, 0, side * -0.18]);
    }
    bone(body, [0, -0.08, -0.275], [0, 0.35, -0.275], 0.024);
    box(body, [0.05, 0.115, 0.026], [0, 0.21, -0.3], "glow");
  } else if (id === "malice") {
    skull();
    for (const side of [-1, 1]) {
      horn(body, [[side * 0.105, 0.58, -0.11], [side * 0.2, 0.5, -0.1],
        [side * 0.225, 0.73, -0.16]], 0.04);
      for (let row = 0; row < (side < 0 ? 5 : 3); row++) {
        const y = 0.08 + row * 0.13;
        horn(body, [[side * 0.11, y, 0.18], [side * (0.25 + row * 0.017), y + 0.1, 0.31],
          [side * (0.3 + row * 0.027), y + 0.22, 0.35]], 0.04);
      }
      plate(body, [0.055, 0.27, 0.025], [side * 0.14, 0.18, -0.185], "detail", palette.bone,
        [0, 0, side * -0.38]);
    }
    for (const y of [0.02, 0.115, 0.21, 0.305])
      orb(body, [0, y, 0.22], [0.06, 0.055, 0.055], palette.bone);
    plate(body, [0.055, 0.19, 0.022], [0, 0.2, -0.195], "glow", palette.glow, [0, 0, 0.14], true);
  } else {
    // Folded armored wings keep a recognizable silhouette inside an arena-sized body.
    orb(body, [0, 0.65, 0], [0.15, 0.21, 0.145], palette.bone);
    plate(body, [0.21, 0.09, 0.03], [0, 0.69, -0.147], "detail", dark);
    for (const side of [-1, 1]) {
      box(body, [0.05, 0.018, 0.02], [side * 0.055, 0.69, -0.17], "glow");
      box(body, [0.018, 0.09, 0.025], [side * 0.055, 0.615, -0.154], "detail", palette.metal);
      bone(body, [side * 0.17, 0.24, 0.14], [side * 0.43, 0.76, 0.2], 0.045);
      bone(body, [side * 0.43, 0.76, 0.2], [side * 0.67, 0.53, 0.24], 0.032);
      for (let feather = 0; feather < 5; feather++) {
        const x = side * (0.29 + feather * 0.072), y = 0.64 - feather * 0.035;
        fin([[x, y, 0.23], [x + side * 0.095, y - 0.02, 0.23],
          [x + side * 0.005, -0.35 + feather * 0.085, 0.23]],
        feather % 2 ? palette.metal : palette.bone);
        bone(body, [x + side * 0.025, y - 0.035, 0.215],
          [x + side * 0.012, -0.23 + feather * 0.085, 0.215], 0.011, palette.metal);
      }
      plate(body, [0.075, 0.23, 0.025], [side * 0.11, 0.19, -0.177], "detail", palette.bone,
        [0, 0, side * -0.28]);
    }
    add(body, new THREE.TorusGeometry(0.235, 0.021, 4, 14, Math.PI * 1.65),
      [0, 0.785, 0.07], "detail", palette.bone, [0, 0, 0.55]);
    plate(body, [0.04, 0.12, 0.02], [0, 0.195, -0.195], "glow", palette.glow, [0, 0, 0], true);
  }

  for (const current of batches) {
    for (const surface of ["armor", "detail", "glow"] as const) {
      const pieces = current.surfaces[surface];
      if (!pieces.length) continue;
      const geometry = mergeGeometries(pieces, false)!;
      pieces.forEach((piece) => piece.dispose());
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, materials[surface]);
      mesh.name = `${current.group === root ? "body" : current.group.name}-${surface}`;
      current.group.add(mesh);
    }
  }
  return root;
}

/** Each model owns its geometry/materials; shared joint materials are disposed once. */
export function disposeCharacterModel(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
