import * as THREE from 'three';
import { gltf } from '../loading.js';
import { toonMat } from '../world/toon.js';
import type { Enemy, FlashMaterial, HeightFn } from './types.js';

// Orc raider: horde grind mob between boar and golem. Golem-style states
// (idle -> chase -> windup -> strike -> recover -> stagger), but with a full
// procedural run cycle driven by measured speed: legs stride, arms pump,
// hips bounce, torso leans into the run and into turns, head counter-bobs.
// All pose changes are damped toward targets so states blend smoothly.
// GLB rig contract (both variants): pivots named BodyPivot, HeadPivot,
// ArmL, ArmR, LegL, LegR — built by blender/orc_build.py. Two model
// variants (grey brute / warpainted Lurtz) picked at random per spawn.
// On death it respawns at a NEW random field spot — the horde reshuffles.

const MODELS = ['/assets/models/orc.glb', '/assets/models/orc2.glb'];
const protos: (THREE.Group | null)[] = [null, null];
const protoLoads: (Promise<void> | null)[] = [null, null];
function loadProto(i: number) {
  if (!protoLoads[i]) {
    protoLoads[i] = new Promise((resolve) => {
      gltf.load(
        MODELS[i],
        (g) => { protos[i] = g.scene; resolve(); },
        undefined,
        () => { console.log(`[CAO] ${MODELS[i]} missing — fallback brute`); resolve(); }
      );
    });
  }
  return protoLoads[i];
}

const AGGRO = 12, DEAGGRO = 22, REACH = 1.8, HIT_RANGE = 2.3;
const RUN_SPEED = 3.6;

// Random field spot on a ring around the town origin — where hordes roam.
export function orcSpot(): [number, number] {
  const a = Math.random() * Math.PI * 2;
  const r = 25 + Math.random() * 35;
  return [Math.sin(a) * r, Math.cos(a) * r];
}

export class Orc implements Enemy {
  getHeight: HeightFn;
  hud: any;
  player: any;
  world: any;
  home: THREE.Vector3;
  pos: THREE.Vector3;
  alive: boolean;
  maxHp: number;
  hp: number;
  state: string;
  t: number;
  struck: boolean;
  wobble: number;
  wobbleDir: THREE.Vector3;
  flashT: number;
  respawnT: number;
  group: THREE.Group;
  flashMats: FlashMaterial[] = [];
  fallback: THREE.Group | null;
  barBg: THREE.Mesh;
  barFg: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  model?: THREE.Object3D;
  variant: number;
  // rig handles (fallback provides the same names)
  armL?: THREE.Object3D | null;
  armR?: THREE.Object3D | null;
  legL?: THREE.Object3D | null;
  legR?: THREE.Object3D | null;
  bodyP?: THREE.Object3D | null;
  headP?: THREE.Object3D | null;
  bodyBaseY = 0;
  // locomotion state
  walkPhase: number;
  prevPos: THREE.Vector3;
  spd = 0;
  tLife = 0;
  turnLean = 0;
  // pose targets set by the state machine, blended in the anim block
  poseL = 0;
  poseR = 0;
  posePitch = 0;

  constructor(scene: THREE.Scene, x: number, z: number, getHeight: HeightFn, hud: any, player: any, world: any) {
    this.getHeight = getHeight;
    this.hud = hud;
    this.player = player;
    this.world = world;
    this.home = new THREE.Vector3(x, getHeight(x, z), z);
    this.pos = this.home.clone();
    this.prevPos = this.pos.clone();
    this.alive = true;
    this.maxHp = 30;
    this.hp = this.maxHp;
    this.state = 'idle';
    this.t = 0;
    this.struck = false;
    this.wobble = 0;
    this.wobbleDir = new THREE.Vector3();
    this.flashT = 0;
    this.respawnT = 0;
    this.walkPhase = Math.random() * Math.PI * 2; // desync the horde's stride
    this.variant = Math.random() < 0.5 ? 0 : 1;

    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(this.group);

    this.fallback = this.buildFallback();
    this.group.add(this.fallback);
    this.bindRig(this.fallback);
    loadProto(this.variant).then(() => { if (protos[this.variant]) this.useModel(); });

    this.barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: false, transparent: true, opacity: 0.85 }),
    );
    this.barBg.position.y = 2.35;
    this.barBg.renderOrder = 5;
    this.barFg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.96, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x55ff55, depthTest: false, transparent: true }),
    );
    this.barFg.position.set(0, 2.35, 0.001);
    this.barFg.renderOrder = 6;
    this.group.add(this.barBg, this.barFg);
  }

  bindRig(root: THREE.Object3D) {
    this.armL = root.getObjectByName('ArmL');
    this.armR = root.getObjectByName('ArmR');
    this.legL = root.getObjectByName('LegL');
    this.legR = root.getObjectByName('LegR');
    this.bodyP = root.getObjectByName('BodyPivot');
    this.headP = root.getObjectByName('HeadPivot');
    this.bodyBaseY = this.bodyP ? this.bodyP.position.y : 0;
  }

  // Gray-box orc: green brute with tusks and a club; same named pivots as the
  // GLB rig so the locomotion code runs identically before the model loads.
  buildFallback(): THREE.Group {
    const skin = toonMat({ color: 0x5d7a3a, flatShading: true });
    const hideWrap = toonMat({ color: 0x4a3826, flatShading: true });
    const bone = toonMat({ color: 0xe8dfc8, flatShading: true });
    const g = new THREE.Group();

    const body = new THREE.Group();
    body.name = 'BodyPivot';
    body.position.y = 0.62; // hips
    g.add(body);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.7, 0.45), skin);
    torso.position.y = 0.43;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.22, 0.48), hideWrap);
    belt.position.y = 0.10;
    body.add(torso, belt);

    const headP = new THREE.Group();
    headP.name = 'HeadPivot';
    headP.position.y = 0.84; // neck (relative to hips)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.42), skin);
    head.position.y = 0.16;
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.3), skin);
    jaw.position.set(0, 0.0, 0.1);
    headP.add(head, jaw);
    for (const sx of [-0.14, 0.14]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 5), bone);
      tusk.position.set(sx, 0.09, 0.22);
      headP.add(tusk);
    }
    body.add(headP);

    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.name = sx < 0 ? 'ArmL' : 'ArmR';
      arm.position.set(sx * 0.48, 0.70, 0); // shoulder (relative to hips)
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), skin);
      upper.position.y = -0.32;
      arm.add(upper);
      if (sx > 0) { // club in the right hand
        const club = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 0.7, 6), hideWrap);
        club.position.set(0, -0.75, 0.2);
        club.rotation.x = Math.PI / 3;
        arm.add(club);
      }
      body.add(arm);
      const leg = new THREE.Group();
      leg.name = sx < 0 ? 'LegL' : 'LegR';
      leg.position.set(sx * 0.19, 0.62, 0); // hip pivot
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.26), hideWrap);
      shin.position.y = -0.31;
      leg.add(shin);
      g.add(leg);
    }

    g.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true;
      const m = (o.material as FlashMaterial).clone();
      o.material = m;
      this.flashMats.push(m);
    });
    return g;
  }

  useModel() {
    const proto = protos[this.variant];
    if (!proto) return;
    if (this.fallback) { this.group.remove(this.fallback); this.fallback = null; }
    this.flashMats = [];
    const model = proto.clone(true);
    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = true;
      // deliberately NOT toonified: the orc keeps its realistic PBR + vertex-color
      // look (per-Davide exemption from the cel-shade rule). Clone per instance so
      // the hit flash doesn't light up the whole horde.
      const m = (o.material as FlashMaterial).clone() as FlashMaterial;
      o.material = m;
      this.flashMats.push(m);
    });
    this.model = model;
    this.bindRig(model);
    this.group.add(model);
  }

  takeHit(dmg: number, dir: THREE.Vector3) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.wobble = 1;
    this.wobbleDir.copy(dir);
    this.flashT = 0.12;
    for (const m of this.flashMats) m.emissive.setHex(0xff5533);
    if (this.state === 'idle' || this.state === 'chase') { this.state = 'stagger'; this.t = 0.25; }
    if (this.hp <= 0) {
      this.alive = false;
      this.respawnT = 7 + Math.random() * 5; // stagger the horde's respawns
      this.hud.addKill(12, 14, { name: 'Orc Tusk', chance: 0.1 });
    }
  }

  update(sdt: number, camera: THREE.Camera) {
    this.tLife += sdt;
    if (this.flashT > 0) {
      this.flashT -= sdt;
      if (this.flashT <= 0) for (const m of this.flashMats) m.emissive.setHex(0x000000);
    }

    if (!this.alive) {
      this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, this.pos.y - 2.2, sdt * 3);
      this.respawnT -= sdt;
      if (this.respawnT <= 0) {
        // the horde reforms somewhere else — new random home every death
        const [x, z] = orcSpot();
        this.home.set(x, this.getHeight(x, z), z);
        this.alive = true;
        this.hp = this.maxHp;
        this.state = 'idle';
        this.pos.copy(this.home);
        this.prevPos.copy(this.pos);
        this.spd = 0;
        this.group.position.copy(this.pos);
      }
      return;
    }

    const toP = this.player.pos.clone().sub(this.pos);
    toP.y = 0;
    const dist = toP.length();
    if (dist > 0.001) toP.normalize();

    switch (this.state) {
      case 'idle':
        this.poseL = 0; this.poseR = 0; this.posePitch = 0;
        if (dist < AGGRO && !this.player.dead) this.state = 'chase';
        break;
      case 'chase': {
        this.poseL = -0.3; this.poseR = -0.3; this.posePitch = 0;
        if (dist > DEAGGRO || this.player.dead) { this.state = 'idle'; break; }
        if (dist < REACH) { this.state = 'windup'; this.t = 0.4; this.struck = false; break; }
        this.pos.addScaledVector(toP, RUN_SPEED * sdt);
        break;
      }
      case 'windup': {
        this.t -= sdt;
        const kw = 1 - Math.max(0, this.t / 0.4);
        this.poseR = -2.3 * kw; // club raised overhead: the telegraph
        this.poseL = -0.9 * kw;
        this.posePitch = -0.20 * kw; // rear back
        if (this.t <= 0) { this.state = 'strike'; this.t = 0.2; }
        break;
      }
      case 'strike': {
        this.t -= sdt;
        this.pos.addScaledVector(toP, 5 * sdt);
        const ks = 1 - this.t / 0.2;
        this.poseR = -2.3 + ks * 3.0; // club comes down hard
        this.poseL = -0.9 + ks * 1.2;
        this.posePitch = 0.35 * ks; // lunge into it
        if (!this.struck && this.t < 0.1 && dist < HIT_RANGE && !this.player.dead) {
          this.struck = true;
          this.player.takeDamage(Math.round(7 + Math.random() * 4), toP);
        }
        if (this.t <= 0) { this.state = 'recover'; this.t = 0.7; }
        break;
      }
      case 'recover': {
        this.t -= sdt;
        const kr = this.t / 0.7;
        this.poseL = 0.3 * kr; this.poseR = 0.5 * kr; this.posePitch = 0.1 * kr;
        if (this.t <= 0) this.state = 'chase';
        break;
      }
      case 'stagger':
        this.t -= sdt;
        this.posePitch = -0.12;
        if (this.t <= 0) this.state = 'chase';
        break;
    }

    // ground + facing (shortest arc), remembering turn rate for the lean
    this.pos.y = this.getHeight(this.pos.x, this.pos.z);
    this.group.position.copy(this.pos);
    let turn = 0;
    if (this.state !== 'idle') {
      const target = Math.atan2(toP.x, toP.z);
      let d = target - this.group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      turn = d * Math.min(1, sdt * 7);
      this.group.rotation.y += turn;
    }

    // --- procedural locomotion: everything blends via damped targets ---
    const moved = this.pos.distanceTo(this.prevPos);
    this.prevPos.copy(this.pos);
    const v = moved < 2 ? moved / Math.max(sdt, 1e-6) : 0; // ignore teleports
    this.spd = THREE.MathUtils.lerp(this.spd, v, Math.min(1, sdt * 8));
    const k = Math.min(this.spd / RUN_SPEED, 1.25);
    this.walkPhase += sdt * (3.5 + this.spd * 2.6);
    const sw = Math.sin(this.walkPhase);
    const damp = Math.min(1, sdt * 12);

    if (this.legL) this.legL.rotation.x += (sw * 0.62 * k - this.legL.rotation.x) * damp;
    if (this.legR) this.legR.rotation.x += (-sw * 0.62 * k - this.legR.rotation.x) * damp;
    if (this.armL) this.armL.rotation.x += (this.poseL - sw * 0.5 * k - this.armL.rotation.x) * damp;
    if (this.armR) this.armR.rotation.x += (this.poseR + sw * 0.5 * k - this.armR.rotation.x) * damp;

    this.turnLean = THREE.MathUtils.clamp(-(turn / Math.max(sdt, 1e-6)) * 0.06, -0.2, 0.2);
    if (this.bodyP) {
      this.bodyP.rotation.x += (0.16 * k + this.posePitch - this.bodyP.rotation.x) * damp;
      this.bodyP.rotation.z += (this.turnLean * k - this.bodyP.rotation.z) * damp;
      // hip bounce while running, slow breath while idle
      const bounce = Math.abs(Math.cos(this.walkPhase)) * 0.055 * k;
      const breath = (1 - k) * Math.sin(this.tLife * 1.8) * 0.01;
      this.bodyP.position.y = this.bodyBaseY + bounce + breath;
    }
    if (this.headP) {
      // counter-bob keeps the gaze level; idle gets a slow menacing sway
      this.headP.rotation.x += (-0.10 * k - 0.5 * this.posePitch - this.headP.rotation.x) * damp;
      const sway = this.state === 'idle' ? Math.sin(this.tLife * 0.7) * 0.10 : 0;
      this.headP.rotation.y += (sway - this.headP.rotation.y) * damp;
    }

    // hit recoil wobble (whole model, on top of the rig pose)
    const visual = this.model ?? this.fallback;
    if (visual) {
      this.wobble = Math.max(0, this.wobble - sdt * 3.5);
      const w = Math.sin(this.wobble * Math.PI) * 0.3;
      visual.rotation.x = this.wobbleDir.z * w;
      visual.rotation.z = -this.wobbleDir.x * w;
    }

    // hp bar
    const r = Math.max(0, this.hp / this.maxHp);
    this.barFg.scale.x = Math.max(0.001, r);
    this.barFg.position.x = -(1 - r) * 0.48;
    this.barFg.material.color.setHSL(0.35 * r, 0.75, 0.55);
    this.barBg.lookAt(camera.position);
    this.barFg.rotation.copy(this.barBg.rotation);
    this.barBg.visible = this.barFg.visible = dist < 30;
  }
}
