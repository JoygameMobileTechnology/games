import * as THREE from "three";
import { makeCharacterModel, disposeCharacterModel } from "./characters";
import { makeWeaponModel } from "./weapon-models";
import type { CharacterId, CharacterSkinId, WeaponSkinId } from "./cosmetics";
import type { WeaponId } from "./rules";

/** One isolated, low-cost showroom. It never uses the live game's scene or effects. */
export class CosmeticPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.05, 30);
  private readonly pivot = new THREE.Group();
  private readonly resizeObserver: ResizeObserver;
  private model: THREE.Group | null = null;
  private character = true;
  private frame = 0;
  private lastRender = 0;
  private lastMotion = 0;
  private dragging: number | null = null;
  private pointerX = 0;
  private manualUntil = 0;
  private disposed = false;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    const canvas = this.renderer.domElement;
    canvas.className = "cosmetic-preview-canvas";
    canvas.setAttribute("aria-label", "3D cosmetic preview. Drag horizontally to rotate.");
    canvas.setAttribute("role", "img");
    host.append(canvas);
    this.scene.add(this.pivot, new THREE.HemisphereLight(0xcddced, 0x3b2022, 2));
    const key = new THREE.DirectionalLight(0xffe2c4, 4);
    key.position.set(-3, 4, -4);
    const rim = new THREE.DirectionalLight(0x81bcff, 3);
    rim.position.set(3, 1, 3);
    this.scene.add(key, rim);
    this.camera.position.set(0, 0.12, -4.8);
    this.camera.lookAt(0, 0, 0);
    this.reset();
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerup", this.pointerEnd);
    canvas.addEventListener("pointercancel", this.pointerEnd);
    canvas.addEventListener("lostpointercapture", this.pointerEnd);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.frame = requestAnimationFrame(this.render);
  }

  showCharacter(id: CharacterId, skin: CharacterSkinId) {
    this.replace(makeCharacterModel(id, { skin }), true);
  }

  showWeapon(id: WeaponId, skin: WeaponSkinId) {
    this.replace(makeWeaponModel(id, skin), false);
  }

  rotate(direction: number) {
    this.pivot.rotation.y += direction * Math.PI / 6;
    this.manualUntil = performance.now() + 4000;
  }

  reset() {
    this.pivot.rotation.set(0, -0.35, 0);
    this.manualUntil = performance.now() + 1500;
  }

  private replace(model: THREE.Group, character: boolean) {
    this.releaseModel();
    this.model = model;
    this.character = character;
    if (!character) model.rotation.y = Math.PI / 2;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 2.35 / Math.max(size.x, size.y, size.z, 0.1);
    const center = bounds.getCenter(new THREE.Vector3());
    model.scale.multiplyScalar(scale);
    model.position.sub(center.multiplyScalar(scale));
    this.pivot.add(model);
    this.reset();
  }

  private releaseModel() {
    if (!this.model) return;
    this.pivot.remove(this.model);
    if (this.character) disposeCharacterModel(this.model);
    else {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      this.model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        list.forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    }
    this.model = null;
  }

  private resize() {
    if (this.disposed) return;
    const { width, height } = this.host.getBoundingClientRect();
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    // Fit the complete rotating silhouette even in a narrow landscape column.
    this.camera.position.z = -Math.max(4.8, 4.8 / this.camera.aspect);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  private render = (now: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.render);
    if (document.hidden || now - this.lastRender < 1000 / 30) return;
    if (this.dragging === null && now > this.manualUntil)
      this.pivot.rotation.y += Math.min((now - this.lastMotion) / 1000, 0.05) * 0.22;
    this.lastMotion = this.lastRender = now;
    this.renderer.render(this.scene, this.camera);
  };

  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || this.dragging !== null) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragging = event.pointerId;
    this.pointerX = event.clientX;
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private pointerMove = (event: PointerEvent) => {
    if (this.dragging !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    this.pivot.rotation.y += (event.clientX - this.pointerX) * 0.012;
    this.pointerX = event.clientX;
    this.manualUntil = performance.now() + 4000;
  };

  private pointerEnd = (event: PointerEvent) => {
    if (this.dragging !== event.pointerId) return;
    this.dragging = null;
    this.manualUntil = performance.now() + 4000;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId))
      this.renderer.domElement.releasePointerCapture(event.pointerId);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.pointerDown);
    canvas.removeEventListener("pointermove", this.pointerMove);
    canvas.removeEventListener("pointerup", this.pointerEnd);
    canvas.removeEventListener("pointercancel", this.pointerEnd);
    canvas.removeEventListener("lostpointercapture", this.pointerEnd);
    this.releaseModel();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }
}
