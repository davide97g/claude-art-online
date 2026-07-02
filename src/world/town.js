import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GATE_POS } from './floor.js';

// Populates Floor 1 with KayKit Medieval Hexagon Pack models (CC0, Kay Lousberg —
// same artist as the knight, so silhouettes stay coherent). Everything loads
// async and pops in when ready; the game runs fine if the assets are missing.
//
// KayKit hex units are tiny (a house is ~0.9 tall). SCALE brings a house to
// ~3.8 units so it reads against the ~1.8-tall player. Model origins sit at the
// base (y=0), so placing at terrainHeight(x,z) drops them straight onto the ground.

const BASE = '/assets/kaykit';
const SCALE = 4.2;
const loader = new GLTFLoader();

// seeded RNG → the town/forest layout is identical on every reload (nicer for tuning)
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// load once, cache the prepped prototype scene (shadows enabled)
const cache = new Map();
function proto(path) {
  if (!cache.has(path)) {
    cache.set(path, new Promise((resolve) => {
      loader.load(`${BASE}/${path}.gltf`,
        (g) => {
          g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          resolve(g.scene);
        },
        undefined,
        () => { console.log(`[CAO] kaykit missing: ${path}`); resolve(null); });
    }));
  }
  return cache.get(path);
}

const bp = (type, color) => `buildings/${color}/building_${type}_${color}`;

const _v = new THREE.Vector3();
async function place(parent, path, x, z, getHeight, { yaw = 0, scale = SCALE, sink = 0.15 } = {}) {
  const s = await proto(path);
  if (!s) return null;
  const m = s.clone(true);
  m.position.set(x, getHeight(x, z) - sink, z);
  m.rotation.y = yaw;
  m.scale.setScalar(scale);
  parent.add(m);
  return m;
}

// One InstancedMesh per mesh in the prototype → many props, ~1 draw call each.
async function scatter(parent, path, transforms) {
  const s = await proto(path);
  if (!s || !transforms.length) return;
  const meshes = [];
  s.updateWorldMatrix(true, true);
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

export function createTown(scene, getHeight) {
  const root = new THREE.Group();
  scene.add(root);
  const rng = mulberry32(1337);

  // --- the town: hand-placed so it reads like a village, not a pile ---
  const TOWN = [
    ['church', 'green', -24, 27], ['tower_A', 'red', 0, 52], ['tavern', 'yellow', 23, 14],
    ['market', 'red', 15, 8], ['blacksmith', 'green', -18, 10], ['well', 'green', -6, 20],
    ['home_A', 'red', -12, 25], ['home_B', 'yellow', -23, 39], ['home_A', 'green', 13, 27],
    ['home_B', 'red', 21, 35], ['home_A', 'yellow', -31, 21], ['home_B', 'green', 27, 24],
    ['windmill', 'green', 33, 43], ['watermill', 'yellow', -34, 44], ['barracks', 'red', -17, 48],
  ];
  for (const [type, color, x, z] of TOWN) {
    place(root, bp(type, color), x, z, getHeight, { yaw: facePlaza(x, z) });
  }

  // --- props: the small stuff that makes a place feel lived-in ---
  const PROPS = [
    ['barrel', -16, 12], ['barrel', -19, 13], ['bucket_water', -7, 17], ['sack', 2, 24],
    ['sack', -3, 26], ['crate_A_big', 13, 11], ['crate_B_small', 16, 10], ['crate_open', 12, 6],
    ['weaponrack', -15, 46], ['target', -20, 49], ['wheelbarrow', 5, 18], ['tent', 29, 30],
    ['tent', -29, 33], ['resource_lumber', -36, 47], ['resource_stone', 36, 40], ['ladder', 25, 20],
  ];
  for (const [name, x, z] of PROPS) {
    place(root, `decoration/props/${name}`, x, z, getHeight, { yaw: rng() * Math.PI * 2, sink: 0 });
  }

  // --- bannered lane drawing the eye from the plaza toward the boss gate ---
  const flags = ['flag_green', 'flag_yellow', 'flag_red'];
  [6, -8, -22, -36, -50].forEach((z, i) => {
    for (const x of [-7.5, 7.5]) {
      place(root, `decoration/props/${flags[i % flags.length]}`, x, z, getHeight, { sink: 0 });
    }
  });

  // --- forest: two tree types, instanced, ringing the wilderness ---
  scatter(root, 'decoration/nature/tree_single_A',
    scatterRing(rng, 120, 46, 118, getHeight, SCALE * 0.8, SCALE * 1.5, { skipTown: true }));
  scatter(root, 'decoration/nature/tree_single_B',
    scatterRing(rng, 100, 46, 118, getHeight, SCALE * 0.8, SCALE * 1.5, { skipTown: true }));
  // a few dense clumps for depth
  scatter(root, 'decoration/nature/trees_A_large',
    scatterRing(rng, 18, 55, 115, getHeight, SCALE * 0.9, SCALE * 1.3, { skipTown: true }));

  // --- rocks / boulders scattered through it all ---
  scatter(root, 'decoration/nature/rock_single_A',
    scatterRing(rng, 40, 30, 120, getHeight, SCALE * 2, SCALE * 6, { skipTown: true }));
  scatter(root, 'decoration/nature/rock_single_C',
    scatterRing(rng, 25, 30, 120, getHeight, SCALE * 2, SCALE * 5, { skipTown: true }));

  // --- distant hills & mountains ringing the edge: cheap depth under the tower skybox ---
  const SILHOUETTES = [
    'mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees',
    'hills_A_trees', 'hills_B_trees', 'hills_C_trees',
  ];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng() * 0.2;
    const r = 132 + rng() * 20;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const name = SILHOUETTES[Math.floor(rng() * SILHOUETTES.length)];
    place(root, `decoration/nature/${name}`, x, z, getHeight,
      { yaw: rng() * Math.PI * 2, scale: SCALE * (2.5 + rng() * 2), sink: 1 });
  }

  // --- a few clouds drifting over the valley ---
  for (let i = 0; i < 6; i++) {
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
      root.add(c);
    });
  }

  return root;
}
