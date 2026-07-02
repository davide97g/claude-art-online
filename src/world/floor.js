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

  // --- river water: a translucent ribbon following the carved channel (cosmetic, real t) ---
  let water = null;
  if (biome.river) {
    const p = biome.river.path, half = biome.river.width * 0.5;
    const verts = [], uvs = [], idx = [];
    let along = 0;
    for (let i = 0; i < p.length; i++) {
      const prev = p[Math.max(0, i - 1)], next = p[Math.min(p.length - 1, i + 1)];
      const dx = next.x - prev.x, dz = next.z - prev.z, len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len; // left normal to the flow
      verts.push(p[i].x + nx * half, biome.river.level, p[i].z + nz * half);
      verts.push(p[i].x - nx * half, biome.river.level, p[i].z - nz * half);
      if (i > 0) along += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
      uvs.push(0, along * 0.15, 1, along * 0.15);
    }
    for (let i = 0; i < p.length - 1; i++) {
      const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    wg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    wg.setIndex(idx);
    wg.computeVertexNormals();
    // cheap procedural ripple: soft blue-green noise, tiled + scrolled for flow
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = 64;
    const cx = cvs.getContext('2d');
    for (let i = 0; i < 64 * 64; i++) {
      const v = 150 + Math.floor(Math.random() * 60);
      cx.fillStyle = `rgb(${v},${v + 20},${v + 30})`;
      cx.fillRect(i % 64, Math.floor(i / 64), 1, 1);
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 6);
    water = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({
      color: biome.river.color, map: tex, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide,
    }));
    water.renderOrder = 1;
    scene.add(water);
  }

  // gate-open state: boss death flips the colors and spins the ring up.
  // spinBias keeps ring.rotation.z continuous across the speed change.
  let gateOpen = false, spinBias = 0, lastT = 0;

  return {
    gatePos: new THREE.Vector3(GATE_POS.x, gy, GATE_POS.z),
    openGate() {
      gateOpen = true;
      spinBias = lastT * (0.4 - 1.6);
      ring.material.color.setHex(0xffd34d);
      portal.material.color.setHex(0x9fd8ff);
    },
    update(t) {
      lastT = t;
      ring.rotation.z = gateOpen ? t * 1.6 + spinBias : t * 0.4;
      portal.material.opacity = gateOpen
        ? 0.75 + Math.sin(t * 3) * 0.15
        : 0.65 + Math.sin(t * 1.6) * 0.1;
      for (const r of floaters) r.position.y = r.userData.baseY + Math.sin(t * 0.3 + r.userData.phase) * 2.5;
      if (water) water.material.map.offset.y = -t * 0.06;
    },
  };
}
