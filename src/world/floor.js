import * as THREE from 'three';

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
