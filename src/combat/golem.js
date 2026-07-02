import * as THREE from 'three';
import { gltf } from '../loading.js';

// Moss Golem: first real enemy. No skeleton — animated in code by moving
// its named parts (Body, ArmL/R, eyes). States: idle -> chase -> windup
// (telegraph: eyes flare, arms raise) -> strike (lunge + slam) -> recover.

let proto = null;
let protoLoad = null;
function loadProto() {
  if (!protoLoad) {
    protoLoad = new Promise((resolve) => {
      gltf.load(
        '/assets/models/golem.glb',
        (g) => { proto = g.scene; resolve(); },
        undefined,
        () => { console.log('[CAO] golem.glb missing — fallback rocks'); resolve(); }
      );
    });
  }
  return protoLoad;
}

const AGGRO = 13, DEAGGRO = 20, REACH = 2.1, HIT_RANGE = 2.6;

export class Golem {
  constructor(scene, x, z, getHeight, hud, player, world) {
    this.getHeight = getHeight;
    this.hud = hud;
    this.player = player;
    this.world = world;
    this.home = new THREE.Vector3(x, getHeight(x, z), z);
    this.pos = this.home.clone();
    this.alive = true;
    this.maxHp = 60;
    this.hp = this.maxHp;
    this.state = 'idle';
    this.t = 0;
    this.struck = false;
    this.wobble = 0;
    this.wobbleDir = new THREE.Vector3();
    this.flashT = 0;
    this.respawnT = 0;
    this.bobPhase = Math.random() * Math.PI * 2;

    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    scene.add(this.group);

    this.eyeMats = [];
    this.flashMats = [];
    this.fallback = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 1),
      new THREE.MeshLambertMaterial({ color: 0x24242c, flatShading: true })
    );
    this.fallback.position.y = 0.85;
    this.group.add(this.fallback);
    loadProto().then(() => { if (proto) this.useModel(); });

    this.barBg = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.13, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x22262e })
    );
    this.barBg.position.y = 2.25;
    this.barFg = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.09, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xe05353 })
    );
    this.barFg.position.y = 2.25;
    this.group.add(this.barBg, this.barFg);
  }

  useModel() {
    if (this.fallback) { this.group.remove(this.fallback); this.fallback = null; }
    const model = proto.clone(true);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.material = o.material.clone(); // per-instance mats: eye flare + hit flash
      this.flashMats.push(o.material);
      if (o.material.name === 'CAO_GolemEye') this.eyeMats.push(o.material);
    });
    this.model = model;
    this.armL = model.getObjectByName('ArmL');
    this.armR = model.getObjectByName('ArmR');
    this.group.add(model);
  }

  setEyes(intensity) {
    for (const m of this.eyeMats) m.emissiveIntensity = intensity;
  }

  takeHit(dmg, dir) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.wobble = 1;
    this.wobbleDir.copy(dir);
    this.flashT = 0.12;
    for (const m of this.flashMats) m.emissive.setHex(0xff5533);
    if (this.state === 'idle' || this.state === 'chase') { this.state = 'stagger'; this.t = 0.3; }
    if (this.hp <= 0) {
      this.alive = false;
      this.respawnT = 14;
      this.hud.addKill();
    }
  }

  update(sdt, camera) {
    if (this.flashT > 0) {
      this.flashT -= sdt;
      if (this.flashT <= 0) {
        for (const m of this.flashMats) {
          if (m.name === 'CAO_GolemEye') m.emissive.setRGB(1.0, 0.45, 0.1);
          else m.emissive.setHex(0x000000);
        }
      }
    }

    if (!this.alive) {
      this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, this.pos.y - 2.6, sdt * 3);
      this.respawnT -= sdt;
      if (this.respawnT <= 0) {
        this.alive = true;
        this.hp = this.maxHp;
        this.state = 'idle';
        this.pos.copy(this.home);
        this.group.position.copy(this.pos);
      }
      return;
    }

    const toP = this.player.pos.clone().sub(this.pos);
    toP.y = 0;
    const dist = toP.length();
    if (dist > 0.001) toP.normalize();

    const armPose = (raise) => {
      if (this.armL) this.armL.rotation.x = raise;
      if (this.armR) this.armR.rotation.x = raise;
    };

    switch (this.state) {
      case 'idle':
        this.setEyes(2.0);
        armPose(0);
        if (dist < AGGRO && !this.player.dead) this.state = 'chase';
        break;
      case 'chase': {
        this.setEyes(3.0);
        armPose(-0.15);
        if (dist > DEAGGRO || this.player.dead) { this.state = 'idle'; break; }
        if (dist < REACH) { this.state = 'windup'; this.t = 0.55; this.struck = false; break; }
        this.pos.addScaledVector(toP, 2.9 * sdt);
        break;
      }
      case 'windup': {
        this.t -= sdt;
        const k = 1 - Math.max(0, this.t / 0.55);
        this.setEyes(3 + k * 9); // the telegraph: eyes flare hard
        armPose(-1.5 * k);
        if (this.t <= 0) { this.state = 'strike'; this.t = 0.26; }
        break;
      }
      case 'strike': {
        this.t -= sdt;
        this.pos.addScaledVector(toP, 6.5 * sdt); // lunge
        armPose(-1.5 + (1 - this.t / 0.26) * 2.1); // slam down
        if (!this.struck && this.t < 0.13 && dist < HIT_RANGE && !this.player.dead) {
          this.struck = true;
          this.player.takeDamage(Math.round(11 + Math.random() * 6), toP);
        }
        if (this.t <= 0) { this.state = 'recover'; this.t = 0.85; }
        break;
      }
      case 'recover':
        this.t -= sdt;
        this.setEyes(2.5);
        armPose(0.6 * (this.t / 0.85));
        if (this.t <= 0) this.state = 'chase';
        break;
      case 'stagger':
        this.t -= sdt;
        if (this.t <= 0) this.state = 'chase';
        break;
    }

    // ground + idle bob
    this.pos.y = this.getHeight(this.pos.x, this.pos.z);
    this.group.position.copy(this.pos);
    if (this.model) {
      this.bobPhase += sdt * 2.2;
      this.model.position.y = Math.sin(this.bobPhase) * 0.04;
      // face the player when engaged
      if (this.state !== 'idle') {
        const target = Math.atan2(toP.x, toP.z);
        let d = target - this.group.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.group.rotation.y += d * Math.min(1, sdt * 6);
      }
      // hit recoil
      this.wobble = Math.max(0, this.wobble - sdt * 3.5);
      const w = Math.sin(this.wobble * Math.PI) * 0.3;
      this.model.rotation.x = this.wobbleDir.z * w;
      this.model.rotation.z = -this.wobbleDir.x * w;
    }

    // hp bar
    const r = Math.max(0, this.hp / this.maxHp);
    this.barFg.scale.x = Math.max(0.001, r);
    this.barFg.position.x = -(1 - r) * 0.63;
    this.barBg.lookAt(camera.position);
    this.barFg.rotation.copy(this.barBg.rotation);
    this.barBg.visible = this.barFg.visible = dist < 30;
  }
}
