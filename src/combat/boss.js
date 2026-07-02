import * as THREE from 'three';
import { gltf } from '../loading.js';

// Rendfang the Kobold Lord — Floor-1 boss guarding the sealed gate.
// Same no-skeleton approach as the golem: named GLB parts posed in code
// (authored by blender/boss_build.py; node/material names are load-bearing).
// Phase 1: bone axe + buckler — slam / spin sweep / charge.
// Phase 2 (≤40% hp): drops axe+buckler, draws the nodachi, faster 3-hit combos.
// Dies for good within a session (no respawn); reload to refight.

let proto = null;
let protoLoad = null;
function loadProto() {
  if (!protoLoad) {
    protoLoad = new Promise((resolve) => {
      gltf.load(
        '/assets/models/boss_kobold.glb',
        (g) => { proto = g.scene; resolve(); },
        undefined,
        () => { console.log('[CAO] boss_kobold.glb missing — fallback boss blob'); resolve(); }
      );
    });
  }
  return protoLoad;
}

const NAME = 'Rendfang the Kobold Lord';
const WAKE = 16, LEASH = 34, MELEE = 3.4;
const ENRAGE_EMISSIVE = 0x3a0a08;
const EYE_BASE = new THREE.Color(1.0, 0.35, 0.1);

export class KoboldLord {
  constructor(scene, x, z, getHeight, hud, player, world) {
    this.getHeight = getHeight;
    this.hud = hud;
    this.player = player;
    this.world = world;
    this.home = new THREE.Vector3(x, getHeight(x, z), z);
    this.pos = this.home.clone();
    this.alive = true;
    this.maxHp = 700;
    this.hp = this.maxHp;
    this.state = 'dormant';
    this.t = 0;
    this.stateDur = 0;
    this.struck = false;
    this.enraged = false;
    this.comboStep = 0;
    this.chargeCd = 3; // grace period before the first charge
    this.chargeDir = new THREE.Vector3(0, 0, 1);
    this.name = NAME;
    this.onDeath = null; // main.js hooks gate-open + banner + save here
    this.onWake = null;  // main.js hooks the intro cutscene here (return true = it takes over)
    this.wobble = 0;
    this.wobbleDir = new THREE.Vector3();
    this.flashT = 0;
    this.lean = 0; // charge crouch, blended with hit recoil below
    this.bobPhase = Math.random() * Math.PI * 2;

    this.group = new THREE.Group();
    this.group.rotation.y = Math.PI; // dormant: face the town (+Z), back to the gate
    this.group.position.copy(this.pos);
    scene.add(this.group);

    this.eyeMats = [];
    this.flashMats = [];
    this.fallback = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.0, 1),
      new THREE.MeshLambertMaterial({ color: 0x7a2420, flatShading: true })
    );
    this.fallback.scale.set(1.3, 1.7, 1.3);
    this.fallback.position.y = 1.7;
    this.group.add(this.fallback);
    loadProto().then(() => { if (proto) this.useModel(); });

    // charge telegraph: red ring at the feet during chargeWindup
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.06;
    this.ring.visible = false;
    this.group.add(this.ring);
  }

  useModel() {
    if (this.fallback) { this.group.remove(this.fallback); this.fallback = null; }
    const model = proto.clone(true);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.material = o.material.clone(); // per-instance mats: eye flare + hit flash
      this.flashMats.push(o.material);
      if (o.material.name === 'CAO_BossEye') this.eyeMats.push(o.material);
    });
    this.model = model;
    this.armL = model.getObjectByName('ArmL');
    this.armR = model.getObjectByName('ArmR');
    this.head = model.getObjectByName('Head');
    this.tail = model.getObjectByName('Tail');
    this.weaponAxe = model.getObjectByName('WeaponAxe');
    this.buckler = model.getObjectByName('Buckler');
    this.nodachi = model.getObjectByName('WeaponNodachi');
    this.nodachiBack = model.getObjectByName('NodachiBack');
    if (this.nodachi) this.nodachi.visible = false; // drawn at phase 2
    this.group.add(model);
    if (this.enraged) this.applyEnrage(); // GLB can arrive mid-fight
  }

  setEyes(intensity) {
    for (const m of this.eyeMats) m.emissiveIntensity = intensity;
  }

  applyEnrage() {
    if (this.weaponAxe) this.weaponAxe.visible = false;
    if (this.buckler) this.buckler.visible = false;
    if (this.nodachiBack) this.nodachiBack.visible = false;
    if (this.nodachi) this.nodachi.visible = true;
    for (const m of this.flashMats) {
      if (!this.eyeMats.includes(m)) m.emissive.setHex(ENRAGE_EMISSIVE);
    }
  }

  clearEnrage() {
    this.enraged = false;
    if (this.weaponAxe) this.weaponAxe.visible = true;
    if (this.buckler) this.buckler.visible = true;
    if (this.nodachiBack) this.nodachiBack.visible = true;
    if (this.nodachi) this.nodachi.visible = false;
    for (const m of this.flashMats) {
      if (!this.eyeMats.includes(m)) m.emissive.setHex(0x000000);
    }
  }

  enter(state, dur = 0) {
    this.state = state;
    this.t = dur;
    this.stateDur = dur;
    this.struck = false;
  }

  hitPlayer(base, spread, dir, stop = 0) {
    if (this.player.dead) return;
    this.player.takeDamage(Math.round(base + Math.random() * spread), dir);
    if (stop) this.world.hitStop(stop);
  }

  wake() {
    if (this.onWake && this.onWake()) return; // intro cutscene takes over
    this.enter('roar', 1.2);
    this.hud.showBoss(NAME);
  }

  takeHit(dmg, dir) {
    if (!this.alive) return;
    if (this.state === 'dormant' || this.state === 'return') this.wake();
    this.hp -= dmg;
    this.wobble = 1;
    this.wobbleDir.copy(dir);
    this.flashT = 0.12;
    for (const m of this.flashMats) m.emissive.setHex(0xff5533);
    // stagger only from chase — wind-ups and attacks have hyper-armor (no stun-lock)
    if (this.state === 'chase') this.enter('stagger', 0.35);
    if (this.hp <= 0) {
      this.alive = false;
      this.hud.addKill(250);
      this.hud.hideBoss();
      this.ring.visible = false;
      if (this.onDeath) this.onDeath();
    }
  }

  startReturn() {
    this.hp = this.maxHp; // leash break = full reset, no cheese-from-range
    this.clearEnrage();
    this.hud.hideBoss();
    this.ring.visible = false;
    this.enter('return');
  }

  update(sdt) {
    if (this.flashT > 0) {
      this.flashT -= sdt;
      if (this.flashT <= 0) {
        for (const m of this.flashMats) {
          if (this.eyeMats.includes(m)) m.emissive.copy(EYE_BASE);
          else m.emissive.setHex(this.enraged ? ENRAGE_EMISSIVE : 0x000000);
        }
      }
    }

    if (!this.alive) {
      // the fallen lord sinks and stays down
      this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, this.pos.y - 3.5, sdt * 1.2);
      return;
    }

    // phase 2 trigger — can interrupt any engaged state
    if (!this.enraged && this.hp <= this.maxHp * 0.4
        && this.state !== 'dormant' && this.state !== 'return') {
      this.enraged = true;
      this.applyEnrage();
      this.ring.visible = false;
      this.enter('phaseSwitch', 1.4);
    }

    const toP = this.player.pos.clone().sub(this.pos);
    toP.y = 0;
    const dist = toP.length();
    if (dist > 0.001) toP.normalize();
    const playerHomeDist = Math.hypot(this.player.pos.x - this.home.x, this.player.pos.z - this.home.z);

    const easeRest = () => {
      const e = Math.min(1, sdt * 6);
      for (const n of [this.armL, this.armR]) {
        if (!n) continue;
        n.rotation.x += (0 - n.rotation.x) * e;
        n.rotation.z += (0 - n.rotation.z) * e;
      }
      if (this.head) this.head.rotation.x += (0 - this.head.rotation.x) * e;
      this.lean += (0 - this.lean) * e;
    };
    const k = this.stateDur > 0 ? 1 - Math.max(0, this.t / this.stateDur) : 1;

    switch (this.state) {
      case 'dormant':
        this.setEyes(1.5);
        easeRest();
        if (playerHomeDist < WAKE && !this.player.dead) this.wake();
        break;

      case 'roar': {
        this.t -= sdt;
        this.setEyes(2 + k * 8);
        const lift = Math.sin(k * Math.PI);
        if (this.head) this.head.rotation.x = -0.5 * lift;
        if (this.armL) this.armL.rotation.x = -0.4 * lift;
        if (this.armR) this.armR.rotation.x = -0.4 * lift;
        if (this.t <= 0) this.enter('chase');
        break;
      }

      case 'chase': {
        this.setEyes(this.enraged ? 5 : 3);
        easeRest();
        this.chargeCd -= sdt;
        if (playerHomeDist > LEASH || this.player.dead) { this.startReturn(); break; }
        if (dist < MELEE) {
          if (this.enraged) this.enter('comboWindup', 0.35);
          else if (Math.random() < 0.55) this.enter('slamWindup', 0.6);
          else this.enter('sweepWindup', 0.5);
          break;
        }
        if (dist > 7 && dist < 14 && this.chargeCd <= 0) {
          this.chargeCd = this.enraged ? 5 : 6;
          this.enter('chargeWindup', this.enraged ? 0.55 : 0.7);
          break;
        }
        this.pos.addScaledVector(toP, (this.enraged ? 4.6 : 3.4) * sdt);
        break;
      }

      case 'slamWindup': {
        this.t -= sdt;
        this.setEyes(3 + k * 9); // the telegraph: eyes flare hard
        if (this.armL) this.armL.rotation.x = -1.8 * k;
        if (this.armR) this.armR.rotation.x = -1.8 * k;
        if (this.t <= 0) this.enter('slamHit', 0.3);
        break;
      }

      case 'slamHit': {
        this.t -= sdt;
        this.pos.addScaledVector(toP, 5.0 * sdt); // lunge
        if (this.armL) this.armL.rotation.x = -1.8 + k * 2.4;
        if (this.armR) this.armR.rotation.x = -1.8 + k * 2.4;
        if (!this.struck && this.t < 0.15 && dist < 4.2) {
          this.struck = true;
          this.hitPlayer(20, 8, toP, 0.05);
        }
        if (this.t <= 0) this.enter('recover', 0.9);
        break;
      }

      case 'sweepWindup': {
        this.t -= sdt;
        this.setEyes(3 + k * 9);
        if (this.armR) { this.armR.rotation.z = 1.2 * k; this.armR.rotation.x = -0.6 * k; }
        if (this.t <= 0) this.enter('sweepHit', 0.35);
        break;
      }

      case 'sweepHit': {
        this.t -= sdt;
        this.group.rotation.y += (2.0 / 0.35) * sdt; // the spin — facing skipped below
        if (this.armR) this.armR.rotation.z = 1.2 - k * 2.0;
        if (!this.struck && this.t < 0.25 && dist < 4.6) { // 360° — no facing check
          this.struck = true;
          this.hitPlayer(14, 6, toP);
        }
        if (this.t <= 0) this.enter('recover', 0.8);
        break;
      }

      case 'chargeWindup': {
        this.t -= sdt;
        this.setEyes(3 + k * 11);
        this.lean = 0.35 * k; // crouch
        this.ring.visible = true;
        this.ring.material.opacity = 0.4 + 0.3 * Math.sin(this.bobPhase * 8);
        if (this.t <= 0) {
          this.chargeDir.copy(toP); // direction locks here — sidestep to dodge
          this.ring.visible = false;
          this.enter('charge', 1.1);
        }
        break;
      }

      case 'charge': {
        this.t -= sdt;
        this.pos.addScaledVector(this.chargeDir, 14 * sdt);
        this.lean = 0.25;
        if (!this.struck && dist < 2.8) {
          this.struck = true;
          this.hitPlayer(24, 8, this.chargeDir, 0.06);
          this.t = Math.min(this.t, 0.12); // connected — stop short
        }
        if (this.t <= 0) this.enter('recover', 1.1); // the punish window
        break;
      }

      case 'comboWindup': {
        this.t -= sdt;
        this.setEyes(3 + k * 9);
        if (this.armR) this.armR.rotation.x = -2.0 * k;
        if (this.t <= 0) { this.comboStep = 1; this.enter('combo', 0.37); }
        break;
      }

      case 'combo': {
        this.t -= sdt;
        if (this.armR) {
          this.armR.rotation.x = -2.0 + k * 2.8;
          this.armR.rotation.z = (this.comboStep % 2 ? 0.5 : -0.5);
        }
        if (this.t > 0.15) this.pos.addScaledVector(toP, 3.0 * sdt); // slash-active window
        if (!this.struck && this.t < 0.3 && dist < 3.8) {
          this.struck = true;
          if (this.comboStep < 3) this.hitPlayer(12, 5, toP);
          else this.hitPlayer(18, 6, toP, 0.05); // finisher
        }
        if (this.t <= 0) {
          if (this.comboStep < 3) { this.comboStep++; this.enter('combo', 0.37); }
          else this.enter('recover', 0.55);
        }
        break;
      }

      case 'recover':
        this.t -= sdt;
        this.setEyes(this.enraged ? 5 : 3);
        easeRest();
        if (this.t <= 0) this.enter('chase');
        break;

      case 'stagger':
        this.t -= sdt;
        easeRest();
        if (this.t <= 0) this.enter('chase');
        break;

      case 'phaseSwitch': {
        this.t -= sdt;
        this.setEyes(14);
        const surge = Math.sin(k * Math.PI);
        if (this.model) this.model.scale.setScalar(1 + surge * 0.06);
        if (this.head) this.head.rotation.x = -0.6 * surge;
        if (this.t <= 0) {
          if (this.model) this.model.scale.setScalar(1);
          this.enter('chase');
        }
        break;
      }

      case 'return': {
        this.setEyes(1.5);
        easeRest();
        const toHome = this.home.clone().sub(this.pos);
        toHome.y = 0;
        const dHome = toHome.length();
        if (dHome < 1) { this.pos.copy(this.home); this.enter('dormant'); break; }
        toHome.normalize();
        this.pos.addScaledVector(toHome, 5 * sdt);
        break;
      }
    }

    // ground + facing + recoil (golem idiom, heavier creature)
    this.pos.y = this.getHeight(this.pos.x, this.pos.z);
    this.group.position.copy(this.pos);

    if (this.state !== 'dormant' && this.state !== 'sweepHit') {
      let dir = toP;
      if (this.state === 'charge') dir = this.chargeDir;
      else if (this.state === 'return') dir = this.home.clone().sub(this.pos).setY(0).normalize();
      const target = Math.atan2(dir.x, dir.z);
      let d = target - this.group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.group.rotation.y += d * Math.min(1, sdt * 5);
    }

    if (this.model) {
      this.bobPhase += sdt * 1.6;
      this.model.position.y = Math.sin(this.bobPhase) * 0.05;
      if (this.tail) this.tail.rotation.y = Math.sin(this.bobPhase * 0.7) * 0.15;
      this.wobble = Math.max(0, this.wobble - sdt * 3.5);
      const w = Math.sin(this.wobble * Math.PI) * 0.12; // barely flinches — he's huge
      this.model.rotation.x = this.wobbleDir.z * w + this.lean;
      this.model.rotation.z = -this.wobbleDir.x * w;
    }

    // DOM boss bar (no 3D overhead bar for the boss); the cutscene owns the
    // reveal animation, so don't stomp it while cinematic
    if (this.state !== 'dormant' && this.state !== 'return' && this.state !== 'cinematic') {
      this.hud.setBossHP(this.hp / this.maxHp);
    }
  }
}
