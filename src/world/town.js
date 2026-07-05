import * as THREE from 'three';
import { gltf as loader } from '../loading.js';
import { GATE_POS } from './floor.js';
import { cityLayout } from './citylayout.js';
import { toonifyObject } from './toon.js';

// Populates Floor 1 with KayKit Medieval Hexagon Pack models (CC0, Kay Lousberg —
// same artist as the knight, so silhouettes stay coherent). Everything loads
// async and pops in when ready; the game runs fine if the assets are missing.
//
// KayKit hex units are tiny (a house is ~0.9 tall). SCALE brings a house to
// ~3.8 units so it reads against the ~1.8-tall player. Model origins sit at the
// base (y=0), so placing at terrainHeight(x,z) drops them straight onto the ground.

const BASE = '/assets/kaykit';
const CASTLE = '/assets/castle';
const SCALE = 4.2;

// Cylinder colliders {x, z, r} the player pushes out of. Filled as models load
// (async), so the reference is handed to the Player and populates over time.
// Buildings + scattered trees/rocks + ruins register here; thin decorations
// (flags, small props) stay passable on purpose.
// ponytail: flat array, linear scan in the player each frame. A few hundred
// colliders is nothing; add a broad-phase grid only if a floor blows past ~2k.
export const colliders = [];
const BUILDING_R = 2.4;   // footprint radius of a SCALE'd KayKit house
const CASTLE_R = 4.5;     // the Floor-5 castle reads much larger
const TREE_FACTOR = 0.35; // fraction of a tree's XZ footprint used as a collider (trunk-ish, not the whole canopy)
const ROCK_FACTOR = 0.7;  // rocks are solid all the way out, so block most of their footprint
const RUIN_FACTOR = 0.6;

// XZ footprint radius of a loaded prototype (half of its larger horizontal extent).
// Prototypes sit at scale 1, so callers multiply by the per-instance scale.
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
function footprintR(obj) {
  _box.setFromObject(obj);
  _box.getSize(_size);
  return Math.max(_size.x, _size.z) * 0.5;
}

// seeded RNG → the town/forest layout is identical on every reload (nicer for tuning)
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// load once, cache the prepped prototype scene (shadows enabled).
// ext/base let us load KayKit .gltf and Kenney Castle Kit .glb through one path.
const cache = new Map();
function proto(path, base = BASE, ext = 'gltf') {
  const key = `${base}/${path}.${ext}`;
  if (!cache.has(key)) {
    cache.set(key, new Promise((resolve) => {
      loader.load(key,
        (g) => {
          g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          toonifyObject(g.scene); // cel-shade KayKit/Kenney assets to match the world
          resolve(g.scene);
        },
        undefined,
        () => { console.log(`[CAO] model missing: ${key}`); resolve(null); });
    }));
  }
  return cache.get(key);
}

const bp = (type, color) => `buildings/${color}/building_${type}_${color}`;

const _v = new THREE.Vector3();
// Lowest ground height under a model's footprint (its 4 world-AABB base corners
// + center). Rigid buildings sit on this so the downhill side never floats on a
// slope — the uphill side just nestles into the hill, which reads as cozy.
function groundMin(m, x, z, getHeight) {
  _box.setFromObject(m);
  _box.getSize(_size);
  const hx = _size.x * 0.5, hz = _size.z * 0.5;
  let gy = getHeight(x, z);
  for (const dx of [-hx, hx]) for (const dz of [-hz, hz]) gy = Math.min(gy, getHeight(x + dx, z + dz));
  return gy;
}
async function place(parent, path, x, z, getHeight, { yaw = 0, scale = SCALE, sink = 0.15, level = false } = {}) {
  const s = await proto(path);
  if (!s) return null;
  const m = s.clone(true);
  m.position.set(x, getHeight(x, z) - sink, z);
  m.rotation.y = yaw;
  m.scale.setScalar(scale);
  parent.add(m);
  if (level) { m.updateMatrixWorld(true); m.position.y = groundMin(m, x, z, getHeight) - sink; }
  return m;
}

// multiply a cloned material's color toward `hex` so shared KayKit greenery reads
// as snowy / stormy per biome. Cloning avoids mutating the cached prototype material.
function tintObject(obj, hex) {
  if (hex == null) return;
  const c = new THREE.Color(hex);
  obj.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    // preserve array-vs-single shape: wrapping a single material in a 1-element array
    // would make it invisible (Three.js only renders array materials via geometry.groups).
    if (Array.isArray(o.material)) {
      o.material = o.material.map((m) => { const n = m.clone(); n.color.multiply(c); return n; });
    } else {
      const n = o.material.clone();
      n.color.multiply(c);
      o.material = n;
    }
  });
}

// Kenney Castle Kit ruin: sunk + tilted + darkened, dropped on the terrain.
async function placeRuin(parent, name, x, z, getHeight, rng, tint) {
  const s = await proto(name, CASTLE, 'glb');
  if (!s) return null;
  const m = s.clone(true);
  m.position.set(x, getHeight(x, z) - 0.4, z); // sink into the ground
  m.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3); // tilt + yaw
  m.scale.setScalar(SCALE * 1.4); // Kenney pieces read larger than KayKit hex
  tintObject(m, tint == null ? 0x8a8f96 : tint); // always darken ruins a touch
  colliders.push({ x, z, r: footprintR(m) * RUIN_FACTOR }); // m is already scaled → footprint is world-size
  parent.add(m);
  return m;
}

// register one cylinder collider per scattered instance, sized from the prototype footprint
function scatterColliders(s, transforms, factor) {
  if (!factor) return;
  const baseR = footprintR(s) * factor;
  if (!(baseR > 0)) return;
  for (const t of transforms) colliders.push({ x: t.pos.x, z: t.pos.z, r: baseR * t.scl.x });
}

// One InstancedMesh per mesh in the prototype → many props, ~1 draw call each.
async function scatter(parent, path, transforms, { collide = 0 } = {}) {
  const s = await proto(path);
  if (!s || !transforms.length) return;
  const meshes = [];
  s.updateWorldMatrix(true, true);
  scatterColliders(s, transforms, collide);
  s.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const m = new THREE.Matrix4();
  for (const mesh of meshes) {
    const local = mesh.matrixWorld; // geometry → prototype root
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, transforms.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false; // instances span the whole map; geometry-bounds culling would wrongly hide them
    transforms.forEach((t, i) => {
      m.compose(t.pos, t.quat, t.scl).multiply(local);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
  }
}

// scatter(), but tint the shared instanced material toward the biome color.
async function scatterTinted(parent, path, transforms, tint, { collide = 0 } = {}) {
  if (tint == null) return scatter(parent, path, transforms, { collide });
  const s = await proto(path);
  if (!s || !transforms.length) return;
  const c = new THREE.Color(tint);
  const meshes = [];
  s.updateWorldMatrix(true, true);
  scatterColliders(s, transforms, collide);
  s.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const m = new THREE.Matrix4();
  for (const mesh of meshes) {
    const mat = mesh.material.clone();
    mat.color.multiply(c);
    const inst = new THREE.InstancedMesh(mesh.geometry, mat, transforms.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    transforms.forEach((t, i) => { m.compose(t.pos, t.quat, t.scl).multiply(mesh.matrixWorld); inst.setMatrixAt(i, m); });
    inst.instanceMatrix.needsUpdate = true;
    parent.add(inst);
  }
}

// keep spawn plaza (z>~14, |x|<8) and the lane down to the gate clear of scatter
function blocked(x, z) {
  if (Math.abs(x) < 9 && z < 14) return true;                          // spawn + gate corridor
  if (Math.hypot(x - GATE_POS.x, z - GATE_POS.z) < 20) return true;    // gate apron
  return false;
}

function scatterRing(rng, count, rMin, rMax, getHeight, sMin, sMax, { skipTown = false } = {}) {
  const out = [];
  const up = new THREE.Vector3(0, 1, 0);
  let guard = 0;
  while (out.length < count && guard++ < count * 30) {
    const a = rng() * Math.PI * 2;
    const r = rMin + rng() * (rMax - rMin);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (blocked(x, z)) continue;
    if (skipTown && Math.hypot(x, z - 22) < 40) continue; // don't drop forest inside town
    const s = sMin + rng() * (sMax - sMin);
    out.push({
      pos: new THREE.Vector3(x, getHeight(x, z), z),
      quat: new THREE.Quaternion().setFromAxisAngle(up, rng() * Math.PI * 2),
      scl: new THREE.Vector3(s, s, s),
    });
  }
  return out;
}

// face a building toward the plaza center so doors aren't turned away
const CENTER = new THREE.Vector2(0, 22);
const facePlaza = (x, z) => Math.atan2(CENTER.x - x, CENTER.y - z);

export function createTown(scene, getHeight, biome) {
  const root = new THREE.Group();
  scene.add(root);
  const rng = mulberry32(1337);
  const tint = biome.tint;
  colliders.length = 0; // fresh registry per build

  // --- settlement: hand-placed buildings, faced toward the cluster center ---
  for (const [type, color, x, z] of biome.settlement) {
    colliders.push({ x, z, r: BUILDING_R });
    place(root, bp(type, color), x, z, getHeight, { yaw: facePlaza(x, z), level: true })
      .then((m) => { if (m) tintObject(m, tint); });
  }

  // --- dense city (Floor 5): buildings lining the Royal Mile spine + castle on the crag ---
  if (biome.city) {
    for (const b of cityLayout(biome.city, rng)) {
      colliders.push({ x: b.x, z: b.z, r: b.castle ? CASTLE_R : BUILDING_R });
      place(root, bp(b.type, b.color), b.x, b.z, getHeight,
        { yaw: b.yaw, sink: b.castle ? 0.6 : 0.15, scale: b.castle ? SCALE * 1.6 : SCALE, level: true })
        .then((m) => { if (m) tintObject(m, tint); });
    }
  }

  // --- props: the small stuff that makes a place feel lived-in ---
  for (const [name, x, z] of biome.props) {
    place(root, `decoration/props/${name}`, x, z, getHeight, { yaw: rng() * Math.PI * 2, sink: 0 })
      .then((m) => { if (m) tintObject(m, tint); });
  }

  // --- bannered lane drawing the eye from the plaza toward the boss gate (Floor 1) / Royal Mile (Floor 5) ---
  const flags = ['flag_green', 'flag_yellow', 'flag_red'];
  if (biome.flags === true) {
    // Floor 1: bannered lane from the plaza toward the boss gate (−Z)
    [6, -8, -22, -36, -50].forEach((z, i) => {
      for (const x of [-7.5, 7.5]) {
        place(root, `decoration/props/${flags[i % flags.length]}`, x, z, getHeight, { sink: 0 });
      }
    });
  } else if (biome.flags === 'spine') {
    // Floor 5: banners down the Royal Mile (+Z)
    let i = 0;
    for (let z = 20; z <= 78; z += 12, i++) {
      for (const x of [-4.5, 4.5]) {
        place(root, `decoration/props/${flags[i % flags.length]}`, x, z, getHeight, { sink: 0 });
      }
    }
  }

  // --- ruins (Kenney Castle Kit): sunk, tilted, darkened wall/tower/gate pieces ---
  for (const { name, x, z } of biome.ruins) {
    placeRuin(root, name, x, z, getHeight, rng, tint);
  }

  // --- forest: instanced, ringing the wilderness, tinted per biome ---
  for (const t of biome.trees) {
    scatterTinted(root, t.path,
      scatterRing(rng, t.count, 46, 118, getHeight, SCALE * t.sMin, SCALE * t.sMax, { skipTown: true }), tint,
      { collide: TREE_FACTOR });
  }

  // --- rocks / boulders scattered through it all ---
  for (const r of biome.rocks) {
    scatterTinted(root, r.path,
      scatterRing(rng, r.count, 30, 120, getHeight, SCALE * r.sMin, SCALE * r.sMax, { skipTown: true }), tint,
      { collide: ROCK_FACTOR });
  }

  // --- distant hills & mountains ringing the edge: cheap depth under the tower skybox ---
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng() * 0.2;
    const r = 132 + rng() * 20;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const name = biome.mountains[Math.floor(rng() * biome.mountains.length)];
    place(root, `decoration/nature/${name}`, x, z, getHeight,
      { yaw: rng() * Math.PI * 2, scale: SCALE * (2.5 + rng() * 2), sink: 1 })
      .then((m) => { if (m) tintObject(m, tint); });
  }

  // --- a few clouds drifting over the valley ---
  for (let i = 0; i < biome.clouds; i++) {
    const a = rng() * Math.PI * 2, r = 30 + rng() * 90;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const name = rng() > 0.5 ? 'cloud_big' : 'cloud_small';
    proto(`decoration/nature/${name}`).then((s) => {
      if (!s) return;
      const c = s.clone(true);
      c.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      c.position.set(x, 42 + rng() * 26, z);
      c.scale.setScalar(SCALE * (1.5 + rng()));
      c.rotation.y = rng() * Math.PI * 2;
      tintObject(c, tint);
      root.add(c);
    });
  }

  return root;
}
