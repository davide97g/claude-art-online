import * as THREE from 'three';

// Cozy cel-shading, shared across the whole game.
// A MeshToonMaterial banded by a tiny gradient ramp gives flat, chunky, storybook
// shading instead of smooth Lambert falloff. One ramp texture, reused everywhere.
//
// ponytail: 4-band ramp is the whole look. Fewer steps = harder cartoon banding,
// more steps = softer. Tune these four bytes to retune the entire game's shading.
// Floor must stay LOW: hemi+ambient already lift shadows; a high first band
// (was 120) gives shadow faces ~half the sun and models read flat/2D.
const steps = new Uint8Array([60, 135, 200, 255]);
export const gradientMap = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

// Drop-in replacement for `new THREE.MeshLambertMaterial(params)` — same params,
// cel-banded shading. Use for our hand-built (gray-box) geometry.
export function toonMat(params = {}) {
  return new THREE.MeshToonMaterial({ gradientMap, ...params });
}

// Convert one already-loaded material (Lambert/Standard from a GLB) to toon,
// keeping its color, base texture and emissive (hit-flash / glowing eyes rely on it).
export function toonify(mat) {
  if (!mat || mat.isMeshToonMaterial) return mat;
  const t = new THREE.MeshToonMaterial({
    gradientMap,
    color: mat.color ? mat.color.clone() : 0xffffff,
    map: mat.map || null,
    transparent: mat.transparent,
    opacity: mat.opacity,
    side: mat.side,
    alphaTest: mat.alphaTest,
    vertexColors: mat.vertexColors,
    flatShading: mat.flatShading,
  });
  t.name = mat.name; // code finds CAO_GolemEye / CAO_EdgeGlow etc. by material name
  if (mat.emissive) { t.emissive.copy(mat.emissive); t.emissiveIntensity = mat.emissiveIntensity; }
  return t;
}

// Toonify every mesh material under a loaded GLB root, in place, preserving
// array-vs-single material shape (single wrapped in an array renders invisible).
export function toonifyObject(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map(toonify) : toonify(o.material);
  });
}
