import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PALETTE, CONFIG } from '../config.js';

// Renderer, camera, lights, sky, fog, resize and auto quality.
export class SceneManager {
  constructor(canvas, appEl) {
    this.canvas = canvas; this.appEl = appEl;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.pixelRatio = this.maxPixelRatio;
    this.qualityLevel = 0; // 0 best .. 3 lowest
    this.renderer.setPixelRatio(this.pixelRatio);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.skyTop);
    this.fogColor = new THREE.Color(0xcfeeff);
    this.scene.fog = new THREE.Fog(this.fogColor, 35, 75);

    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 9 / 16, 0.3, 400);
    this.camera.position.set(0, 9, -7);
    this.camera.lookAt(0, 0, 8);

    // lights
    this.hemi = new THREE.HemisphereLight(0xcfefff, 0xf2e6d0, 0.95);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    this.sun.position.set(6, 14, -4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 22; sc.bottom = -14; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.02;
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget); this.sun.target = this.sunTarget;
    this.scene.add(this.sun);
    this.sunBaseColor = new THREE.Color(0xfff1dc);
    this.sunsetColor = new THREE.Color(0xffb27a);
    this.skyBase = new THREE.Color(PALETTE.skyTop);
    this.skySunset = new THREE.Color(0xf7a97a);

    // environment for metal reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    // sky dome with gradient
    this.sky = this._makeSky();
    this.scene.add(this.sky);

    this.width = 1; this.height = 1;
    this.fpsSamples = []; this.lowFpsTime = 0; this.lastQualityChange = performance.now();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  _makeSky() {
    const geo = new THREE.SphereGeometry(300, 24, 12);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(PALETTE.skyTop) }, bottom: { value: new THREE.Color(PALETTE.skyBottom) }, sea: { value: new THREE.Color(PALETTE.sea) } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sea; varying vec3 vP;
        void main(){ float h = normalize(vP).y; vec3 c = h > 0.0 ? mix(bottom, top, pow(h, 0.55)) : mix(bottom, sea, clamp(-h*6.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -10; m.frustumCulled = false;
    return m;
  }

  setSunset(t) { // 0 day .. 1 sunset
    this.sun.color.copy(this.sunBaseColor).lerp(this.sunsetColor, t);
    this.sky.material.uniforms.top.value.copy(this.skyBase).lerp(this.skySunset, t);
    this.hemi.intensity = 0.95 - 0.25 * t;
  }

  resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    let w = ww, h = wh;
    if (ww / wh > 9 / 16) { w = Math.round(wh * 9 / 16); h = wh; } // desktop letterbox
    this.appEl.style.width = w + 'px'; this.appEl.style.height = h + 'px';
    this.width = w; this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep horizontal coverage stable on very tall phones: widen vertical fov a bit
    const baseAspect = 9 / 16;
    const vFov = CONFIG.camera.fov * Math.min(1.25, Math.max(1, baseAspect / this.camera.aspect));
    this.camera.fov = vFov;
    this.camera.updateProjectionMatrix();
  }

  // auto quality: pixel ratio 2 -> 1.5 -> 1.25, then shadow res, then particles (game reads qualityLevel)
  trackFps(dt) {
    if (dt <= 0) return;
    const fps = 1 / dt;
    this.fpsSamples.push(fps); if (this.fpsSamples.length > 60) this.fpsSamples.shift();
    if (fps < 45) this.lowFpsTime += dt; else this.lowFpsTime = Math.max(0, this.lowFpsTime - dt * 0.5);
    if (this.lowFpsTime > 2.5 && performance.now() - this.lastQualityChange > 4000 && this.qualityLevel < 4) {
      this.qualityLevel++; this.lowFpsTime = 0; this.lastQualityChange = performance.now();
      this.applyQuality();
    }
  }
  applyQuality() {
    const q = this.qualityLevel;
    const pr = [this.maxPixelRatio, Math.min(this.maxPixelRatio, 1.5), Math.min(this.maxPixelRatio, 1.25), Math.min(this.maxPixelRatio, 1.25), 1][q];
    this.pixelRatio = pr; this.renderer.setPixelRatio(pr); this.renderer.setSize(this.width, this.height, false);
    const sm = q >= 3 ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== sm) { this.sun.shadow.mapSize.set(sm, sm); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
  }
  get avgFps() { if (!this.fpsSamples.length) return 60; let s = 0; for (const f of this.fpsSamples) s += f; return s / this.fpsSamples.length; }

  updateSun(px, pz) {
    this.sun.position.set(px + 6, 14, pz - 4);
    this.sunTarget.position.set(px, 0, pz + 4);
    this.sky.position.set(px, 0, pz);
  }

  render() { this.renderer.render(this.scene, this.camera); }

  // project world -> css px inside #app
  project(v3, out) {
    const v = _v.copy(v3).project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * this.width;
    out.y = (-v.y * 0.5 + 0.5) * this.height;
    out.visible = v.z < 1 && v.z > -1;
    return out;
  }
}
const _v = new THREE.Vector3();
