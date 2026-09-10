import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { applyWorldMaterial, loadBasaltTexture } from "../environment-art";
import type {
  JumpPad,
  NavEdge,
  NavNode,
  Teleporter,
  TravelKind,
} from "./types";

export type MaterialKey =
  | "stone"
  | "dark"
  | "floor"
  | "metal"
  | "trim"
  | "bone"
  | "ember"
  | "cyan"
  | "violet";
interface BoxOptions {
  rx?: number;
  ry?: number;
  rz?: number;
  solid?: boolean;
  /** Lift the rendered local top only; keep the bottom and collider unchanged. */
  renderTopLift?: number;
  /** Separate flush decorative faces from masonry without growing the collider. */
  renderOutset?: number;
}

/** Shared mesh batches and matching collision surfaces. No remote assets. */
export class ArenaBuilder {
  readonly nodes: NavNode[] = [];
  readonly edges: NavEdge[] = [];
  readonly pads: JumpPad[] = [];
  readonly portals: Teleporter[] = [];
  readonly materials: Record<MaterialKey, THREE.MeshStandardMaterial>;
  private batches = new Map<MaterialKey, THREE.Matrix4[]>();
  constructor(
    readonly scene: THREE.Scene,
    readonly world: RAPIER.World,
    space = false,
  ) {
    const texture = loadBasaltTexture(this.stoneTexture());
    const mat = (
      color: string,
      metalness = 0.1,
      roughness = 0.85,
      map = false,
    ) =>
      new THREE.MeshStandardMaterial({
        color,
        metalness,
        roughness,
        map: map ? texture : null,
      });
    const glow = (color: string) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2.5,
        roughness: 0.45,
      });
    this.materials = {
      stone: mat("#787074", 0.12, 0.86, true),
      dark: mat("#383b43", 0.3, 0.8, true),
      floor: mat("#62636b", 0.22, 0.85, true),
      metal: mat("#313943", 0.7, 0.5),
      trim: mat("#886655", 0.5, 0.6),
      bone: mat("#a39782", 0.18, 0.75),
      ember: glow("#ff682d"),
      cyan: glow("#55d5e4"),
      violet: glow("#a075ee"),
    };
    for (const material of Object.values(this.materials))
      if (material.map) applyWorldMaterial(material);
    scene.background = new THREE.Color(space ? "#090d1b" : "#171722");
    scene.fog = new THREE.Fog(space ? "#090d1b" : "#171722", 55, 150);
    scene.add(new THREE.HemisphereLight("#b4c3e8", "#3c2930", 1.55));
    const key = new THREE.DirectionalLight("#ffd5ac", 2.1);
    key.position.set(-20, 35, 14);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#779fdc", 0.9);
    fill.position.set(30, 15, -20);
    scene.add(fill);
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(space ? 26 : 14, 28, 20),
      new THREE.MeshStandardMaterial({
        color: "#a85138",
        roughness: 1,
        fog: false,
      }),
    );
    planet.position.set(-24, 29, -95);
    scene.add(planet);
    if (space) {
      const stars: number[] = [];
      let seed = 7547;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let i = 0; i < 450; i++) {
        const angle = random() * Math.PI * 2;
        const height = random() * 2 - 1;
        const r = Math.sqrt(1 - height * height) * 140;
        stars.push(Math.cos(angle) * r, height * 140, Math.sin(angle) * r);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
      scene.add(
        new THREE.Points(
          g,
          new THREE.PointsMaterial({
            color: "#bcc9e2",
            size: 0.18,
            sizeAttenuation: true,
            fog: false,
          }),
        ),
      );
    }
  }
  box(
    key: MaterialKey,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    opts: BoxOptions = {},
  ) {
    const rotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(opts.rx || 0, opts.ry || 0, opts.rz || 0),
    );
    const renderTopLift = opts.renderTopLift ?? 0;
    const renderOutset = opts.renderOutset ?? 0;
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z).add(
        new THREE.Vector3(0, renderTopLift / 2, 0).applyQuaternion(rotation),
      ),
      rotation,
      new THREE.Vector3(
        w + renderOutset * 2,
        h + renderTopLift + renderOutset * 2,
        d + renderOutset * 2,
      ),
    );
    const batch = this.batches.get(key) || [];
    batch.push(matrix);
    this.batches.set(key, batch);
    if (opts.solid !== false)
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
          .setTranslation(x, y, z)
          .setRotation(rotation)
          .setFriction(0),
      );
  }
  floor(
    x: number,
    z: number,
    width: number,
    depth: number,
    top = 0,
    key: MaterialKey = "floor",
    opts: Pick<BoxOptions, "renderTopLift"> = {},
  ) {
    this.box(key, x, top - 0.4, z, width, 0.8, depth, opts);
  }
  /** A continuous climbable slab, with decorative treads that do not snag movement. */
  ramp(
    x: number,
    z: number,
    width: number,
    run: number,
    from: number,
    to: number,
    axis: "x" | "z",
    key: MaterialKey = "floor",
  ) {
    const angle = Math.atan2(to - from, run),
      length = Math.hypot(run, to - from),
      thick = 0.45;
    const opts = axis === "x" ? { rz: angle } : { rx: -angle };
    this.box(
      key,
      x,
      (from + to) / 2 - thick / (2 * Math.cos(angle)),
      z,
      axis === "x" ? length : width,
      thick,
      axis === "z" ? length : width,
      opts,
    );
    const steps = Math.ceil(run / 0.55);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps,
        y = from + (to - from) * t + 0.008;
      this.box(
        "trim",
        axis === "x" ? x - run / 2 + run * t : x,
        y,
        axis === "z" ? z - run / 2 + run * t : z,
        axis === "x" ? 0.035 : width,
        0.018,
        axis === "z" ? 0.035 : width,
        { ...opts, solid: false },
      );
    }
  }
  pillar(x: number, z: number, base: number, height: number, width = 1.4) {
    this.box("stone", x, base + height / 2, z, width, height, width);
    this.box("trim", x, base + 0.2, z, width + 0.35, 0.4, width + 0.35);
    this.box(
      "bone",
      x,
      base + height - 0.15,
      z,
      width + 0.22,
      0.3,
      width + 0.22,
      // The shaft (and sometimes an arch upright) ends at this same top plane.
      { renderTopLift: 0.01 },
    );
  }
  /** Pointed doorway frame, oriented across X by default. Opening remains clear. */
  arch(
    x: number,
    z: number,
    base: number,
    width = 5,
    height = 6,
    yaw = 0,
    accent: MaterialKey = "ember",
  ) {
    const transform = (dx: number, dz: number) => ({
      x: x + dx * Math.cos(yaw) + dz * Math.sin(yaw),
      z: z - dx * Math.sin(yaw) + dz * Math.cos(yaw),
    });
    for (const sign of [-1, 1]) {
      const p = transform(sign * (width / 2 + 0.35), 0);
      this.box("stone", p.x, base + (height - 2) / 2, p.z, 0.7, height - 2, 1, {
        ry: yaw,
      });
      const q = transform((sign * width) / 4, 0);
      // Arches are visible masonry. Their collision stays above the walkable opening.
      const rotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, yaw, sign * 0.8),
      );
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(q.x, base + height - 1, q.z),
        rotation,
        // Keep beam faces clear of the uprights' shared front/back planes.
        new THREE.Vector3(0.55, width / 2 + 1.7, 1.02),
      );
      const batch = this.batches.get("bone") || [];
      batch.push(matrix);
      this.batches.set("bone", batch);
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.275, (width / 2 + 1.7) / 2, 0.5)
          .setTranslation(q.x, base + height - 1, q.z)
          .setRotation(rotation),
      );
      this.box(
        accent,
        p.x + 0.51 * Math.sin(yaw),
        base + 1.5,
        p.z + 0.51 * Math.cos(yaw),
        0.09,
        2.2,
        0.06,
        { ry: yaw, solid: false },
      );
    }
  }
  node(id: string, x: number, floorY: number, z: number) {
    this.nodes.push({ id, position: new THREE.Vector3(x, floorY + 0.9, z) });
    return id;
  }
  link(
    from: string,
    to: string,
    kind: TravelKind = "walk",
    both = kind === "walk",
  ) {
    this.edges.push({ from, to, kind });
    if (both) this.edges.push({ from: to, to: from, kind });
  }
  /** Supply floor-level start/end; velocity is solved for the declared flight time. */
  pad(
    id: string,
    x: number,
    floorY: number,
    z: number,
    endX: number,
    endFloorY: number,
    endZ: number,
    flightTime: number,
  ) {
    const position = new THREE.Vector3(x, floorY + 0.08, z);
    this.box("metal", x, floorY + 0.035, z, 2.2, 0.07, 2.2);
    for (const off of [-0.7, 0, 0.7])
      this.box(
        "cyan",
        x,
        floorY + 0.075,
        z + off,
        1.6 - Math.abs(off),
        0.012,
        0.08,
        { solid: false },
      );
    this.pads.push({
      id,
      position,
      landing: new THREE.Vector3(endX, endFloorY + 0.9, endZ),
      flightTime,
      velocity: new THREE.Vector3(
        (endX - x) / flightTime,
        (endFloorY - floorY) / flightTime + 10 * flightTime,
        (endZ - z) / flightTime,
      ),
    });
  }
  portal(
    id: string,
    x: number,
    floorY: number,
    z: number,
    endX: number,
    endFloorY: number,
    endZ: number,
    yaw = 0,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.11, 6, 24),
      this.materials.violet,
    );
    mesh.position.set(x, floorY + 1.2, z);
    mesh.rotation.y = yaw;
    this.scene.add(mesh);
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.96, 24),
      new THREE.MeshBasicMaterial({
        color: "#8152cb",
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    core.position.copy(mesh.position);
    core.rotation.y = yaw;
    this.scene.add(core);
    this.portals.push({
      id,
      position: new THREE.Vector3(x, floorY + 0.9, z),
      destination: new THREE.Vector3(endX, endFloorY + 0.95, endZ),
      yaw,
    });
  }
  seal(x: number, floorY: number, z: number, radius = 2) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.04, 4, 32),
      this.materials.ember,
    );
    ring.position.set(x, floorY + 0.04, z);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
    for (const a of [0, Math.PI / 3, -Math.PI / 3])
      this.box("trim", x, floorY + 0.013, z, 0.055, 0.025, radius * 2, {
        ry: a,
        solid: false,
      });
  }
  finish() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    for (const [key, transforms] of this.batches) {
      const mesh = new THREE.InstancedMesh(
        geometry,
        this.materials[key],
        transforms.length,
      );
      transforms.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = `${key} architecture`;
      this.scene.add(mesh);
    }
  }
  private stoneTexture() {
    const size = 128,
      bytes = new Uint8Array(size * size * 4);
    let seed = 17;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        seed = (seed * 16807) % 2147483647;
        const mortar =
          y % 32 < 2 || (x + (Math.floor(y / 32) % 2) * 32) % 64 < 2;
        const n = mortar ? 95 : 185 + (seed % 35);
        const i = (y * size + x) * 4;
        bytes[i] = n;
        bytes[i + 1] = n;
        bytes[i + 2] = n;
        bytes[i + 3] = 255;
      }
    const texture = new THREE.DataTexture(bytes, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }
}
