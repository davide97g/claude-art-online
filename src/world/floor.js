import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Analytic terrain height — shared by the mesh and the player, no raycasts needed.
export function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  const flat = smoothstep(8, 40, d); // flat area around spawn
  const h =
    Math.sin(x * 0.05) * Math.cos(z * 0.045) * 2.2 +
    Math.sin(x * 0.13 + 1.7) * Math.sin(z * 0.11) * 0.8;
  return h * flat;
}

export const GATE_POS = new THREE.Vector3(0, 0, -120);

export function createFloor(scene) {
  // --- ground ---
  const size = 320, seg = 130;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const lo = new THREE.Color(0x4e8c4a), hi = new THREE.Color(0x8cc063), c = new THREE.Color();
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

  // --- scattered low-poly trees + rocks (instanced: 1 draw call each) ---
  const rng = () => Math.random() * 2 - 1;
  const spots = [];
  while (spots.length < 140) {
    const x = rng() * 150, z = rng() * 150;
    if (Math.hypot(x, z) < 22) continue;                    // keep spawn clear
    if (Math.hypot(x - GATE_POS.x, z - GATE_POS.z) < 20) continue; // keep gate clear
    spots.push([x, z]);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 1.2, 5);
  const leafGeo = new THREE.ConeGeometry(1.3, 2.6, 6);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x6d4c33, flatShading: true }), spots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ color: 0x3f7d3b, flatShading: true }), spots.length);
  spots.forEach(([x, z], i) => {
    const h = terrainHeight(x, z), k = 0.7 + Math.random() * 0.8;
    q.setFromAxisAngle(v.set(0, 1, 0), Math.random() * Math.PI * 2);
    s.setScalar(k);
    m.compose(v.set(x, h + 0.6 * k, z), q, s); trunks.setMatrixAt(i, m);
    m.compose(v.set(x, h + (1.2 + 1.3) * k, z), q, s); leaves.setMatrixAt(i, m);
  });
  trunks.castShadow = leaves.castShadow = true;
  scene.add(trunks, leaves);

  const rockGeo = new THREE.IcosahedronGeometry(0.7, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshLambertMaterial({ color: 0x8a8f96, flatShading: true }), 50);
  for (let i = 0; i < 50; i++) {
    const x = rng() * 150, z = rng() * 150;
    q.setFromEuler(new THREE.Euler(rng(), rng(), rng()));
    s.set(0.6 + Math.random(), 0.4 + Math.random() * 0.5, 0.6 + Math.random());
    m.compose(v.set(x, terrainHeight(x, z) + 0.1, z), q, s);
    rocks.setMatrixAt(i, m);
  }
  rocks.castShadow = true;
  scene.add(rocks);

  // --- ancient trees (Blender-made landmarks among the instanced filler) ---
  const loader = new GLTFLoader();
  for (const [file, count] of [['tree_old_a.glb', 8], ['tree_old_b.glb', 7]]) {
    loader.load(`/assets/models/${file}`, (g) => {
      const tree = g.scene;
      tree.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      // zero the authored root offset so clones sit exactly where placed
      for (const c of tree.children) if (c.name.startsWith('TreeRoot')) c.position.set(0, 0, 0);
      let placed = 0, guard = 0;
      while (placed < count && guard++ < 400) {
        const x = rng() * 145, z = rng() * 145;
        if (Math.hypot(x, z) < 28) continue;
        if (Math.hypot(x - GATE_POS.x, z - GATE_POS.z) < 24) continue;
        const t = tree.clone(true);
        t.scale.setScalar(0.8 + Math.random() * 0.6);
        t.rotation.y = Math.random() * Math.PI * 2;
        t.position.set(x, terrainHeight(x, z) - 0.05, z);
        scene.add(t);
        placed++;
      }
    }, undefined, () => console.log(`[CAO] ${file} missing`));
  }

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
    new THREE.MeshBasicMaterial({ color: 0x7e94b5, fog: false, side: THREE.DoubleSide })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 380;
  scene.add(ceiling);

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(45, 55, 1200, 12),
    new THREE.MeshBasicMaterial({ color: 0x93a7c4, fog: false })
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
