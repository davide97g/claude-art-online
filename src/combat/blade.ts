import * as THREE from 'three';
import type { Enemy } from './types.js';

// Click swordplay: left-click triggers a slash in the direction the player
// faces, with a random variation (horizontal / diagonal / overhead) each time.
// Clicks during a swing are buffered, so mashing chains into combos.
const SWING_TIME = 0.13;      // seconds
const CHAIN_AT = 0.85;        // buffered click can restart the swing this early
const HIT_T = 0.45;           // point in the swing where the hit lands
const RANGE = 2.9;
const TRAIL_MAX = 24;

export class Blade {
  player: any;
  world: { hitStop(dur: number): void };
  hud: any;
  progression: any;
  roll: THREE.Group;
  sweep: THREE.Group;
  sword: THREE.Group;
  tipLocal: THREE.Vector3;
  hiltLocal: THREE.Vector3;
  swinging: boolean;
  t: number;
  didHit: boolean;
  swipePower: number;
  trailPts: THREE.Vector3[];
  trail: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

  constructor(player: any, scene: THREE.Scene, world: { hitStop(dur: number): void }, hud: any, progression: any) {
    this.player = player;
    this.world = world;
    this.hud = hud;
    this.progression = progression;

    // pivot chain: roll (swipe angle) -> sweep (the actual swing arc)
    this.roll = new THREE.Group();
    this.roll.position.set(0, 1.35, 0);
    this.sweep = new THREE.Group();
    this.roll.add(this.sweep);
    player.group.add(this.roll);

    // stylized placeholder sword — first Blender hero-piece will replace it
    const sword = new THREE.Group();
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.05, 0.16),
      new THREE.MeshLambertMaterial({ color: 0xd8e4f0, emissive: 0x223244, flatShading: true })
    );
    blade.position.y = 0.85;
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.06, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x2b2f3a })
    );
    guard.position.y = 0.3;
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.26, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a4632 })
    );
    grip.position.y = 0.16;
    sword.add(blade, guard, grip);
    sword.position.set(0.28, 0, 0.18);
    this.sweep.add(sword);
    this.sword = sword;
    this.tipLocal = new THREE.Vector3(0.28, 1.45, 0.18);
    this.hiltLocal = new THREE.Vector3(0.28, 0.25, 0.18);

    // rest pose
    this.roll.rotation.z = -0.4;
    this.sweep.rotation.x = 0.9;

    this.swinging = false;
    this.t = 0;
    this.didHit = false;
    this.swipePower = 0;

    // additive ribbon trail
    this.trailPts = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 2 * 3), 3));
    this.trail = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        color: 0x7fd4ff, transparent: true, opacity: 0.75,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    this.trail.frustumCulled = false;
    scene.add(this.trail);

  }

  update(sdt: number, dt: number, input: { attackQueued: boolean }, enemies: Enemy[], camera: THREE.Camera) {
    // once the knight model is in, its real sword takes over from the placeholder
    if (this.player.swordNode && this.sword.visible) this.sword.visible = false;

    if (this.player.dead) input.attackQueued = false;

    if (!this.swinging) {
      // ease back to rest pose
      this.sweep.rotation.x += (0.9 - this.sweep.rotation.x) * Math.min(1, dt * 10);
      if (input.attackQueued) {
        input.attackQueued = false;
        this.startSwing();
      }
    }

    if (this.swinging) {
      this.t += sdt / SWING_TIME;
      const k = Math.min(this.t, 1);
      const e = 1 - Math.pow(1 - k, 3); // ease-out: fast start, decelerate
      this.sweep.rotation.x = -1.25 + e * 2.5;

      this.recordTrail();

      if (!this.didHit && k >= HIT_T) {
        this.didHit = true;
        this.resolveHit(enemies, camera);
      }
      if (this.t >= CHAIN_AT && input.attackQueued) {
        input.attackQueued = false;
        this.startSwing(); // chain straight into the next slash
      } else if (this.t >= 1.15) {
        this.swinging = false;
        this.sweep.rotation.x = -1.15;
      }
    } else if (this.trailPts.length) {
      this.trailPts.splice(0, 2); // fade the trail out
    }
    this.updateTrailGeometry();
  }

  startSwing() {
    this.swinging = true;
    this.t = 0;
    this.didHit = false;
    this.swipePower = 0.9 + Math.random() * 0.5; // slight damage variance per swing
    // random slash variation: horizontal / diagonal / overhead, mirrored at random
    const kind = (['h', 'd', 'v'] as const)[Math.floor(Math.random() * 3)];
    const sign = Math.random() < 0.5 ? -1 : 1;
    this.roll.rotation.z = sign * { h: Math.PI / 2, d: Math.PI / 4, v: 0 }[kind];
    this.trailPts.length = 0;
    this.player.playAttack(kind);
    this.player.attackT = 0.4; // face the camera direction while swinging
  }

  resolveHit(enemies: Enemy[], camera: THREE.Camera) {
    const pPos = this.player.pos;
    const fwd = this.player.forward();
    let hitSomething = false;
    for (const e of enemies) {
      if (!e.alive) continue;
      const to = e.pos.clone().sub(pPos);
      const dist = to.length();
      if (dist > RANGE) continue;
      to.normalize();
      if (fwd.dot(to) < 0.25) continue; // must be roughly in front
      const dmg = Math.round((9 + Math.random() * 4) * this.swipePower *
        (this.progression ? this.progression.damageMult() : 1));
      e.takeHit(dmg, fwd);
      this.hud.spawnDamage(e.pos.clone().add(new THREE.Vector3(0, 2.1, 0)), dmg, camera);
      hitSomething = true;
    }
    if (hitSomething) {
      this.world.hitStop(0.07);
      this.player.shake = 0.22;
    }
  }

  recordTrail() {
    let hilt: THREE.Vector3, tip: THREE.Vector3;
    const node = this.player.swordNode;
    if (node) {
      // follow the knight's animated sword
      node.updateWorldMatrix(true, false);
      hilt = new THREE.Vector3().setFromMatrixPosition(node.matrixWorld);
      const bladeDir = new THREE.Vector3().setFromMatrixColumn(node.matrixWorld, 1).normalize();
      tip = hilt.clone().addScaledVector(bladeDir, 1.15);
    } else {
      this.roll.updateWorldMatrix(true, true);
      tip = this.tipLocal.clone().applyMatrix4(this.sweep.matrixWorld);
      hilt = this.hiltLocal.clone().applyMatrix4(this.sweep.matrixWorld);
    }
    this.trailPts.push(hilt, tip);
    while (this.trailPts.length > TRAIL_MAX * 2) this.trailPts.splice(0, 2);
  }

  updateTrailGeometry() {
    const attr = this.trail.geometry.attributes.position as THREE.BufferAttribute;
    const n = Math.min(this.trailPts.length, TRAIL_MAX * 2);
    for (let i = 0; i < n; i++) {
      const p = this.trailPts[i];
      attr.setXYZ(i, p.x, p.y, p.z);
    }
    // collapse unused verts onto the last point so nothing stretches to origin
    const last = n > 0 ? this.trailPts[n - 1] : null;
    for (let i = n; i < TRAIL_MAX * 2; i++) {
      if (last) attr.setXYZ(i, last.x, last.y, last.z);
      else attr.setXYZ(i, 0, -999, 0);
    }
    attr.needsUpdate = true;
    this.trail.geometry.setDrawRange(0, Math.max(0, n));
  }
}
