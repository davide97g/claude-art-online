import * as THREE from 'three';

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ponytail: module-level terrain profile + river, set once per page load by
// configureTerrain. One level per load, so mutable module state is safe and keeps
// terrainHeight a pure-signature export the player/enemies/town import directly.
const PROFILE = { amp: 1.0, freq: 1.0, shape: 'rolling', crag: null };
let RIVER = null; // { segs: [{ ax, az, bx, bz }], width, depth }

// distance from point (px,pz) to segment (ax,az)-(bx,bz)
function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function riverDepth(x, z) {
  if (!RIVER) return 0;
  let best = Infinity;
  for (const s of RIVER.segs) { const d = distSeg(x, z, s.ax, s.az, s.bx, s.bz); if (d < best) best = d; }
  // 0 outside the width, ramps to full depth toward the centreline
  return smoothstep(RIVER.width, RIVER.width * 0.35, best) * RIVER.depth;
}

// Set the terrain profile + river from a biome. Called by createFloor and by tests.
export function configureTerrain(biome) {
  PROFILE.amp = biome.terrain.amp;
  PROFILE.freq = biome.terrain.freq;
  PROFILE.shape = biome.terrain.shape || 'rolling';
  PROFILE.crag = biome.terrain.crag || null;
  if (biome.river) {
    const p = biome.river.path, segs = [];
    for (let i = 0; i < p.length - 1; i++) segs.push({ ax: p[i].x, az: p[i].z, bx: p[i + 1].x, bz: p[i + 1].z });
    RIVER = { segs, width: biome.river.width, depth: biome.river.depth };
  } else {
    RIVER = null;
  }
}

// Analytic terrain height — shared by the mesh and the player, no raycasts needed.
export function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  const flat = smoothstep(8, 40, d); // flat area around spawn
  const f = PROFILE.freq;
  let h = (Math.sin(x * 0.05 * f) * Math.cos(z * 0.045 * f) * 2.2 +
           Math.sin(x * 0.13 * f + 1.7) * Math.sin(z * 0.11 * f) * 0.8) * flat * PROFILE.amp;
  if (PROFILE.shape === 'valley') {
    h += smoothstep(30, 90, Math.abs(x)) * 22;              // side mountain walls, flat floor
  } else if (PROFILE.shape === 'crag' && PROFILE.crag) {
    const c = PROFILE.crag;
    const dc = Math.hypot(x - c.x, z - c.z);
    h += c.height * Math.exp(-(dc * dc) / (2 * c.radius * c.radius)); // Gaussian crag
  }
  return h - riverDepth(x, z);
}

export const GATE_POS = new THREE.Vector3(0, 0, -120);

export function createFloor(scene, biome) {
  configureTerrain(biome);

  // --- ground ---
  const size = 320, seg = 130;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const lo = new THREE.Color(biome.terrain.lo), hi = new THREE.Color(biome.terrain.hi), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    c.lerpColors(lo, hi, THREE.MathUtils.clamp(h / 3 + 0.35 + Math.random() * 0.12, 0, 1));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  );
  ground.receiveShadow = true;
  scene.add(ground);

  // Vegetation, town buildings & props are placed by world/town.js (KayKit models),
  // so the map reads as a coherent low-poly world instead of procedural filler.
  const rng = () => Math.random() * 2 - 1; // kept: the sky floaters below still use it

  // --- boss gate (sealed) ---
  const gate = new THREE.Group();
  const gy = terrainHeight(GATE_POS.x, GATE_POS.z);
  const pillarGeo = new THREE.BoxGeometry(1.3, 8, 1.3);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x545c6e, flatShading: true });
  const p1 = new THREE.Mesh(pillarGeo, pillarMat); p1.position.set(-3.2, 4, 0);
  const p2 = new THREE.Mesh(pillarGeo, pillarMat); p2.position.set(3.2, 4, 0);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.22, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0x66d9ff })
  );
  ring.position.y = 4.4;
  const portal = new THREE.Mesh(
    new THREE.CircleGeometry(2.85, 40),
    new THREE.MeshBasicMaterial({ color: 0x1a3d5c, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
  );
  portal.position.y = 4.4;
  gate.add(p1, p2, ring, portal);
  gate.position.set(GATE_POS.x, gy, GATE_POS.z);
  p1.castShadow = p2.castShadow = true;
  scene.add(gate);

  // --- sky: the floor above you + the distant tower core + floating rocks ---
  // (fog:false + pre-faded colors = cheap atmospheric distance)
  const ceiling = new THREE.Mesh(
    new THREE.CircleGeometry(900, 48),
    new THREE.MeshBasicMaterial({ color: biome.sky.ceiling, fog: false, side: THREE.DoubleSide })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 380;
  scene.add(ceiling);

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(45, 55, 1200, 12),
    new THREE.MeshBasicMaterial({ color: biome.sky.core, fog: false })
  );
  core.position.set(520, 200, -680);
  scene.add(core);

  const chunkGeo = new THREE.DodecahedronGeometry(6, 0);
  const chunkMat = new THREE.MeshBasicMaterial({ color: 0x9db3d1, fog: false });
  const floaters = [];
  for (let i = 0; i < 8; i++) {
    const rock = new THREE.Mesh(chunkGeo, chunkMat);
    rock.position.set(rng() * 220, 60 + Math.random() * 90, rng() * 220 - 80);
    rock.rotation.set(rng(), rng(), rng());
    rock.scale.setScalar(0.6 + Math.random() * 1.6);
    rock.userData.baseY = rock.position.y;
    rock.userData.phase = Math.random() * Math.PI * 2;
    floaters.push(rock);
    scene.add(rock);
  }

  return {
    gatePos: new THREE.Vector3(GATE_POS.x, gy, GATE_POS.z),
    update(t) {
      ring.rotation.z = t * 0.4;
      portal.material.opacity = 0.65 + Math.sin(t * 1.6) * 0.1;
      for (const r of floaters) r.position.y = r.userData.baseY + Math.sin(t * 0.3 + r.userData.phase) * 2.5;
    },
  };
}
