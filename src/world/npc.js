import * as THREE from 'three';
import { resolvePushOut } from '../player/collision.js';

// Simple townsfolk: low-poly, flat-shaded gray-box people (no character GLB exists yet,
// and per VISION.md generic figures stay primitive). A tapered tunic + head, wandering
// gently around the spawn plaza to make the town feel lived-in. Purely cosmetic — no
// combat, no player collision; they just slide out of buildings via the shared push-out.

const TUNIC = [0x6b4f3a, 0x4a6b3a, 0x7a3a3a, 0x38506b, 0x8a7a4a, 0x555a66, 0x704a6b];
const SKIN = [0xf0c8a0, 0xe0b088, 0xc98a5b, 0x8a5a3a];
const PLAZA = new THREE.Vector2(0, 22); // town center (matches town.js CENTER)

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function makePerson() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.42, 1.05, 7),
    new THREE.MeshLambertMaterial({ color: pick(TUNIC), flatShading: true }));
  body.position.y = 0.72; body.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 6),
    new THREE.MeshLambertMaterial({ color: pick(SKIN), flatShading: true }));
  head.position.y = 1.4; head.castShadow = true;
  // little nose so they read as facing a direction (like the player capsule)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 5), head.material);
  nose.position.set(0, 1.4, 0.2); nose.rotation.x = Math.PI / 2;
  g.add(body, head, nose);
  return g;
}

export class Villagers {
  constructor(scene, getHeight, colliders, count = 10) {
    this.getHeight = getHeight;
    this.colliders = colliders;
    this.people = [];
    for (let i = 0; i < count; i++) {
      // spread around the plaza, rejecting spots that land inside a building
      let x, z, tries = 0;
      do {
        const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 12;
        x = PLAZA.x + Math.cos(a) * r;
        z = PLAZA.y + Math.sin(a) * r;
      } while (tries++ < 12 && this.inCollider(x, z, 0.8));
      const g = makePerson();
      g.position.set(x, getHeight(x, z), z);
      g.rotation.y = Math.random() * Math.PI * 2;
      scene.add(g);
      this.people.push({
        g, home: { x, z }, tx: x, tz: z,
        wait: Math.random() * 3,
        speed: 0.8 + Math.random() * 0.6,
      });
    }
  }

  inCollider(x, z, pad) {
    for (const c of this.colliders) {
      if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
    }
    return false;
  }

  // dt (real time) — ambient life ignores hit-stop, like the weather/camera
  update(dt) {
    for (const p of this.people) {
      const g = p.g;
      const dx = p.tx - g.position.x, dz = p.tz - g.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.2) {
        p.wait -= dt;
        if (p.wait <= 0) { // pick a new stroll target near home
          const a = Math.random() * Math.PI * 2, r = Math.random() * 5;
          p.tx = p.home.x + Math.cos(a) * r;
          p.tz = p.home.z + Math.sin(a) * r;
          p.wait = 1.5 + Math.random() * 3;
        }
      } else {
        const step = Math.min(d, p.speed * dt);
        g.position.x += (dx / d) * step;
        g.position.z += (dz / d) * step;
        const yaw = Math.atan2(dx, dz);
        let diff = yaw - g.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        g.rotation.y += diff * Math.min(1, dt * 6);
      }
      // shared push-out keeps them from strolling through buildings/trees
      const out = resolvePushOut(g.position.x, g.position.z, 0.3, this.colliders);
      g.position.set(out.x, this.getHeight(out.x, out.z), out.z);
    }
  }
}
