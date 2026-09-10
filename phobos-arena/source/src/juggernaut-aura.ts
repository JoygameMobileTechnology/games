import * as THREE from "three";
import type { Power } from "./rules";

/** A close body shimmer, soft edge haze and wisps: three draws for the holder. */
export class JuggernautAura extends THREE.Group {
  private readonly clock = { value: 0 };
  private readonly pixelScale = { value: 390 };
  private readonly sparkColor = { value: new THREE.Color(0xffb72e) };

  constructor(character: THREE.Group) {
    super();
    this.name = "juggernaut-glow";
    this.visible = false;

    // Merge the static upper body in character-local coordinates. Animated legs
    // keep their stride; the wisps cover the lower body without a frozen shell.
    const positions: number[] = [],
      normals: number[] = [];
    for (const object of character.children) {
      if (!(object instanceof THREE.Mesh) || object.name === "aura") continue;
      object.updateMatrix();
      const copy = object.geometry.clone().applyMatrix4(object.matrix);
      const p = copy.getAttribute("position"),
        n = copy.getAttribute("normal");
      const count = copy.index?.count ?? p.count;
      for (let i = 0; i < count; i++) {
        const index = copy.index?.getX(i) ?? i;
        positions.push(p.getX(index), p.getY(index), p.getZ(index));
        normals.push(n.getX(index), n.getY(index), n.getZ(index));
      }
      copy.dispose();
    }
    const body = new THREE.BufferGeometry();
    body.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    body.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    body.computeBoundingSphere();
    if (body.boundingSphere) body.boundingSphere.radius += 0.1;
    const shimmer = new THREE.ShaderMaterial({
      uniforms: { clock: this.clock },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: `
        uniform float clock;
        varying vec3 surfaceNormal;
        varying vec3 toEye;
        varying float height;
        void main() {
          height = position.y;
          float ripple = sin(height * 12.0 - clock * 5.0 + position.x * 8.0);
          vec3 raised = position + normal * (0.012 + ripple * 0.004);
          vec4 eyePosition = modelViewMatrix * vec4(raised, 1.0);
          surfaceNormal = normalize(normalMatrix * normal);
          toEye = -eyePosition.xyz;
          gl_Position = projectionMatrix * eyePosition;
        }
      `,
      fragmentShader: `
        uniform float clock;
        varying vec3 surfaceNormal;
        varying vec3 toEye;
        varying float height;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(surfaceNormal), normalize(toEye))), 1.4);
          float flow = 0.8 + 0.2 * sin(height * 13.0 - clock * 5.0);
          vec3 gold = mix(vec3(1.0, 0.28, 0.025), vec3(1.0, 0.82, 0.26), rim);
          gl_FragColor = vec4(gold * 1.3, (0.09 + rim * 0.35) * flow);
          #include <colorspace_fragment>
        }
      `,
    });
    this.add(new THREE.Mesh(body, shimmer));

    const haze = new THREE.ShaderMaterial({
      uniforms: { clock: this.clock },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: `
        varying vec2 local;
        void main() {
          local = position.xy;
          vec4 center = modelViewMatrix * vec4(0.0, 0.1, 0.0, 1.0);
          center.xy += local;
          gl_Position = projectionMatrix * center;
        }
      `,
      fragmentShader: `
        uniform float clock;
        varying vec2 local;
        void main() {
          float y = local.y + 0.1;
          float shoulders = 0.14 * exp(-pow((y - 0.23) * 5.0, 2.0));
          float bodyWidth = mix(0.34, 0.25, smoothstep(0.3, 0.62, y)) + shoulders;
          float drift = 0.025 * sin(y * 11.0 - clock * 3.0 + sign(local.x));
          float edge = abs(local.x) - bodyWidth - drift;
          float glow = exp(-pow(edge / 0.095, 2.0));
          float vertical = smoothstep(-1.05, -0.65, y) * (1.0 - smoothstep(0.88, 1.22, y));
          float flow = 0.72 + 0.28 * sin(y * 14.0 - clock * 4.0);
          gl_FragColor = vec4(1.0, 0.58, 0.10, glow * vertical * flow * 0.42);
          #include <colorspace_fragment>
        }
      `,
    });
    this.add(new THREE.Mesh(new THREE.PlaneGeometry(1.65, 2.7), haze));

    const seeds = new Float32Array(28 * 3);
    for (let i = 0; i < 28; i++) {
      seeds[i * 3] = i * 2.39996323;
      seeds[i * 3 + 1] = ((i * 13) % 28) / 28;
      seeds[i * 3 + 2] = 0.34 + (i % 5) * 0.045;
    }
    const wisps = new THREE.BufferGeometry();
    wisps.setAttribute("position", new THREE.BufferAttribute(seeds, 3));
    wisps.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.2, 0), 1.5);
    const fire = new THREE.ShaderMaterial({
      uniforms: {
        clock: this.clock,
        pixelScale: this.pixelScale,
        sparkColor: this.sparkColor,
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader: `
        uniform float clock;
        uniform float pixelScale;
        varying float fade;
        void main() {
          float life = fract(position.y + clock * (0.32 + 0.025 * sin(position.x)));
          float angle = position.x + clock * 0.5 + life * 0.7;
          float radius = position.z + 0.045 * sin(clock * 3.0 + position.x);
          vec3 point = vec3(cos(angle) * radius, -0.8 + life * 2.0, sin(angle) * radius);
          vec4 eyePosition = modelViewMatrix * vec4(point, 1.0);
          fade = sin(life * 3.14159265);
          gl_PointSize = clamp(pixelScale * 0.18 / max(0.5, -eyePosition.z), 1.0, 42.0);
          gl_Position = projectionMatrix * eyePosition;
        }
      `,
      fragmentShader: `
        uniform vec3 sparkColor;
        varying float fade;
        void main() {
          vec2 q = (gl_PointCoord - 0.5) * vec2(3.4, 1.8);
          float glow = exp(-dot(q, q) * 5.0) * fade;
          if (glow < 0.025) discard;
          gl_FragColor = vec4(sparkColor * 1.8, glow * 0.85);
          #include <colorspace_fragment>
        }
      `,
    });
    this.add(new THREE.Points(wisps, fire));
  }

  animate(time: number, pixelHeight: number, power: Power | null) {
    this.clock.value = time;
    this.pixelScale.value = pixelHeight;
    // Power color rides the wisps; a holder never gains the old spherical cage.
    this.sparkColor.value.set(
      power === "immortal" ? 0x86b4ff : power === "quad" ? 0xff662e : 0xffb72e,
    );
  }
}
