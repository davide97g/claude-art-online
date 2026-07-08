import * as THREE from 'three';
import { gltf as loader } from '../loading.js';

// Smaug set-piece (Floor 13). On floor start he flies in high over the White
// City, circles it once, glides down and lands at cfg {x, z, yaw}, then idles.
// Purely cosmetic scenery: driven by real dt (ignores hit-stop, like weather).
// Deliberately NOT toonified — the realistic hero model keeps its baked vertex
// colors and emissive embers (blender/dragon_build.py, see DRAGON_PLAN.md).
//
// The GLB has no armature; animation is procedural through the exported pivot
// empties (WingL/WingR flap, NeckPivot/HeadPivot sway). Model faces +Z at yaw 0.
export class Dragon {
  constructor(scene, getHeight, cfg) {
    this.cfg = cfg;
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ'; // yaw → pitch → bank
    scene.add(this.root);
    this.state = 'fly';
    this.t = 0;           // state-local clock
    this.flap = 0;        // wing-beat phase
    this.bank = 0;
    this.prevYaw = null;
    this.pivots = {};
    this.ember = null;
    this.ready = false;

    this.landPos = new THREE.Vector3(cfg.x, getHeight(cfg.x, cfg.z), cfg.z);
    this.landYaw = cfg.yaw ?? 0;
    // fly-in: appear far behind the city, one wide circuit over Minas Tirith
    // (center ~(0,96)), then a descending glide onto the Pelennor landing spot
    const c = { x: 0, z: 96 };
    this.path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(c.x - 30, 90, c.z + 170),
      new THREE.Vector3(c.x + 70, 74, c.z + 50),
      new THREE.Vector3(c.x + 48, 62, c.z - 60),
      new THREE.Vector3(c.x - 62, 52, c.z - 35),
      new THREE.Vector3(c.x - 70, 42, c.z + 60),
      new THREE.Vector3(cfg.x + 30, 24, cfg.z + 60),
      new THREE.Vector3(cfg.x + 7, 9, cfg.z + 14),
      this.landPos.clone(),
    ]);
    this.flyDur = 18;

    loader.load('/assets/models/dragon.glb',
      (g) => {
        const m = g.scene;
        m.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          if (o.material?.name === 'CAO_DragonEmber') this.ember = o.material;
        });
        m.scale.setScalar(cfg.scale ?? 1);
        for (const n of ['NeckPivot', 'HeadPivot', 'WingL', 'WingR']) {
          const p = m.getObjectByName(n);
          if (p) this.pivots[n] = { node: p, base: p.rotation.clone() };
        }
        this.root.add(m);
        this.ready = true;
      },
      undefined,
      () => console.log('[CAO] dragon missing: dragon.glb'));
  }

  // delta rotation on top of a pivot's baked rest pose
  _rot(name, dx, dy, dz) {
    const p = this.pivots[name];
    if (p) p.node.rotation.set(p.base.x + dx, p.base.y + dy, p.base.z + dz);
  }

  update(dt) {
    if (!this.ready) return;
    this.t += dt;

    if (this.state === 'fly') {
      const p = Math.min(1, this.t / this.flyDur);
      const u = p * p * (3 - 2 * p); // smoothstep: gentle takeoff + landing flare
      const pos = this.path.getPointAt(u);
      const tan = this.path.getTangentAt(u);
      this.root.position.copy(pos);
      const yaw = Math.atan2(tan.x, tan.z);
      // bank into turns: roll follows yaw rate, eased so it doesn't snap
      if (this.prevYaw !== null && dt > 0) {
        let dy = yaw - this.prevYaw;
        if (dy > Math.PI) dy -= 2 * Math.PI;
        if (dy < -Math.PI) dy += 2 * Math.PI;
        const target = THREE.MathUtils.clamp(-dy / dt * 1.4, -0.55, 0.55);
        this.bank += (target - this.bank) * Math.min(1, dt * 3);
      }
      this.prevYaw = yaw;
      this.root.rotation.set(-Math.asin(THREE.MathUtils.clamp(tan.y, -1, 1)), yaw, this.bank);

      // wing beats: steady cruise, slower/deeper flare on final approach
      const flare = THREE.MathUtils.smoothstep(u, 0.82, 1);
      this.flap += dt * THREE.MathUtils.lerp(5.2, 3.0, flare);
      const amp = THREE.MathUtils.lerp(0.5, 0.75, flare);
      const w = Math.sin(this.flap) * amp;
      this._rot('WingL', 0, 0, -w);
      this._rot('WingR', 0, 0, w);
      this._rot('NeckPivot', -0.14, 0, 0); // neck stretched into the wind

      if (p >= 1) { this.state = 'settle'; this.t = 0; }
    } else if (this.state === 'settle') {
      // touch down: ease onto the exact spot/yaw, fold wings back to rest
      const k = Math.min(1, this.t / 1.6);
      const e = k * k * (3 - 2 * k);
      this.root.position.lerp(this.landPos, e);
      this.root.rotation.x *= 1 - e;
      this.bank *= 1 - e;
      let dy = this.landYaw - this.root.rotation.y;
      if (dy > Math.PI) dy -= 2 * Math.PI;
      if (dy < -Math.PI) dy += 2 * Math.PI;
      this.root.rotation.y += dy * e;
      this.root.rotation.z = this.bank;
      const w = Math.sin(this.flap) * 0.4 * (1 - e); // dying flaps
      this.flap += dt * 2.2;
      this._rot('WingL', 0, 0, -w);
      this._rot('WingR', 0, 0, w);
      this._rot('NeckPivot', -0.14 * (1 - e), 0, 0);
      if (k >= 1) { this.state = 'idle'; this.t = 0; }
    } else {
      // idle: slow breathing on the folded wings, wandering gaze, neck sway
      const b = Math.sin(this.t * 1.1) * 0.045;
      this._rot('WingL', 0, 0, -b);
      this._rot('WingR', 0, 0, b);
      this._rot('NeckPivot', Math.sin(this.t * 0.45) * 0.05, 0, 0);
      this._rot('HeadPivot', Math.sin(this.t * 0.31) * 0.04, Math.sin(this.t * 0.19) * 0.16, 0);
    }

    if (this.ember) {
      // embers breathe harder in the air (stoked by flight), settle on the ground
      const base = this.state === 'fly' ? 14 : 10;
      this.ember.emissiveIntensity = base + 6 * Math.sin(this.t * 1.15);
    }
  }
}
