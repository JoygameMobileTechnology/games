import * as THREE from "three";

export const BASALT_TEXTURE_URL = new URL("./assets/ritual-basalt.png", import.meta.url).href;

/** One planar sample per surface. Architectural scale no longer stretches masonry. */
export function applyWorldMaterial(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 arenaPosition;\nvarying vec3 arenaNormal;")
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
        vec4 arenaLocal = vec4(transformed, 1.0);
        vec3 arenaObjectNormal = objectNormal;
        #ifdef USE_INSTANCING
          arenaLocal = instanceMatrix * arenaLocal;
          arenaObjectNormal = mat3(instanceMatrix) * arenaObjectNormal;
        #endif
        arenaPosition = (modelMatrix * arenaLocal).xyz;
        arenaNormal = normalize(mat3(modelMatrix) * arenaObjectNormal);
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 arenaPosition;\nvarying vec3 arenaNormal;")
      .replace("#include <map_fragment>", `
        #ifdef USE_MAP
          vec3 surfaceAxis = abs(normalize(arenaNormal));
          vec2 arenaUV = surfaceAxis.y > max(surfaceAxis.x, surfaceAxis.z)
            ? arenaPosition.xz : surfaceAxis.x > surfaceAxis.z ? arenaPosition.zy : arenaPosition.xy;
          diffuseColor *= texture2D(map, arenaUV / 4.0);
        #endif
      `);
  };
  material.customProgramCacheKey = () => "phobos-masonry-world-v1";
}

/** Browser texture loading has a deterministic local fallback for headless simulation. */
export function loadBasaltTexture(fallback: THREE.DataTexture): THREE.Texture {
  if (typeof document === "undefined" || typeof document.createElementNS !== "function") return fallback;
  const texture = new THREE.TextureLoader().load(BASALT_TEXTURE_URL);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  fallback.dispose();
  return texture;
}
