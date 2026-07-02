import * as THREE from 'three';
import { gltf } from '../loading.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Player {
  constructor(scene, camera, input, getHeight) {
    this.camera = camera;
    this.input = input;
    this.getHeight = getHeight;

    this.pos = new THREE.Vector3(0, 0, 8);
    this.yaw = Math.PI;           // face -Z (toward the gate)
    this.pitch = 0.32;
    this.shake = 0;
    this.speedNow = 0;
    this.attackT = 0;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.dead = false;
    this.deadT = 0;
    this.hud = null; // set by main.js

    // visual root: +Z is the character's forward
    this.group = new THREE.Group();
    scene.add(this.group);

    // gray-box capsule (replaced by the knight GLB if it loads)
    const capMat = new THREE.MeshLambertMaterial({ color: 0x3a6ea5, flatShading: true });
    this.capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 10), capMat);
    this.capsule.position.y = 1.05;
    this.capsule.castShadow = true;
    this.nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), capMat);
    this.nose.position.set(0, 1.5, 0.38);
    this.nose.rotation.x = Math.PI / 2;
    this.group.add(this.capsule, this.nose);

    this.mixer = null;
    this.actions = {};
    this.current = null;
    this.swordNode = null;
    this.loadModel(scene);
  }

  loadModel() {
    gltf.load(
      '/assets/models/knight.glb',
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const h = box.max.y - box.min.y;
        model.scale.setScalar(1.75 / h);
        model.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
        // keep the 1H sword in the right hand, stash the rest of the armory
        for (const name of ['1H_Sword_Offhand', '2H_Sword', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield']) {
          const n = model.getObjectByName(name);
          if (n) n.visible = false;
        }
        this.swordNode = model.getObjectByName('1H_Sword') || null;
        this.loadCustomSword();
        this.group.add(model);
        this.capsule.visible = false;
        this.nose.visible = false;

        this.mixer = new THREE.AnimationMixer(model);
        const pick = (re) => gltf.animations.find((a) => re.test(a.name));
        const once = (clip, ts) => {
          const a = this.mixer.clipAction(clip);
          a.setLoop(THREE.LoopOnce);
          a.timeScale = ts;
          return a;
        };
        const idle = pick(/^idle$/i) || pick(/idle/i);
        const run = pick(/^running_a$/i) || pick(/run/i) || pick(/walk/i);
        if (idle) this.actions.idle = this.mixer.clipAction(idle);
        if (run) this.actions.run = this.mixer.clipAction(run);
        const horiz = pick(/1h.*slice_horizontal/i);
        const diag = pick(/1h.*slice_diagonal/i);
        const chop = pick(/1h.*chop/i);
        if (horiz) this.actions.slashH = once(horiz, 2.6);
        if (diag) this.actions.slashD = once(diag, 2.6);
        if (chop) this.actions.slashV = once(chop, 2.6);
        if (this.actions.idle) { this.actions.idle.play(); this.current = this.actions.idle; }
        console.log('[CAO] knight loaded. clips:', gltf.animations.map((a) => a.name).join(', '));
      },
      undefined,
      () => console.log('[CAO] no knight.glb yet — staying in gray-box mode')
    );
  }

  // our Blender-made sword replaces the knight's stock one, same hand slot
  loadCustomSword() {
    if (!this.swordNode) return;
    gltf.load(
      '/assets/models/sword.glb',
      (g) => {
        const stock = this.swordNode;
        const custom = g.scene;
        custom.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          if (o.material && o.material.name === 'CAO_EdgeGlow') o.material.emissiveIntensity = 2.4;
        });
        custom.position.copy(stock.position);
        custom.quaternion.copy(stock.quaternion);
        custom.scale.copy(stock.scale);
        stock.parent.add(custom);
        stock.visible = false;
        this.swordNode = custom;
        console.log('[CAO] custom sword equipped');
      },
      undefined,
      () => console.log('[CAO] sword.glb missing — using stock sword')
    );
  }

  // play the animation for the chosen slash variation
  playAttack(kind) {
    const map = { h: this.actions.slashH, d: this.actions.slashD, v: this.actions.slashV };
    const clip = map[kind] || this.actions.slashD || this.actions.slashH || this.actions.slashV;
    if (clip) clip.reset().play();
  }

  fade(name) {
    const next = this.actions[name];
    if (!next || this.current === next) return;
    next.reset().fadeIn(0.15).play();
    if (this.current) this.current.fadeOut(0.15);
    this.current = next;
  }

  takeDamage(dmg, dir) {
    if (this.dead) return;
    this.hp -= dmg;
    this.shake = 0.32;
    this.pos.addScaledVector(dir, 1.1); // knockback
    if (this.hud) { this.hud.setHP(this.hp / this.maxHp); this.hud.hitFlash(); }
    if (this.hp <= 0) {
      this.dead = true;
      this.deadT = 2.4;
      if (this.hud) this.hud.showDeath(true);
    }
  }

  respawn() {
    this.dead = false;
    this.hp = this.maxHp;
    this.pos.set(0, 0, 8);
    this.yaw = Math.PI;
    if (this.hud) { this.hud.setHP(1); this.hud.showDeath(false); }
  }

  update(dt, sdt) {
    const inp = this.input;
    if (this.dead) {
      this.deadT -= dt;
      if (this.deadT <= 0) this.respawn();
    }

    // camera orbit
    this.yaw -= inp.dx * 0.0023;
    this.pitch = THREE.MathUtils.clamp(this.pitch + inp.dy * 0.0018, -0.15, 1.1);
    this.attackT = Math.max(0, this.attackT - sdt);

    // movement, camera-relative
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3().crossVectors(f, UP).negate();
    const dir = new THREE.Vector3();
    const keys = this.dead ? {} : inp.keys;
    if (keys['KeyW']) dir.add(f);
    if (keys['KeyS']) dir.sub(f);
    if (keys['KeyA']) dir.add(r);
    if (keys['KeyD']) dir.sub(r);
    const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
    const speed = sprint ? 9.5 : 5.5;
    if (dir.lengthSq() > 0) {
      dir.normalize();
      this.pos.addScaledVector(dir, speed * sdt);
      const half = 155;
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -half, half);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -half, half);
    }
    this.speedNow = dir.lengthSq() > 0 ? speed : 0;
    this.pos.y = this.getHeight(this.pos.x, this.pos.z);
    this.group.position.copy(this.pos);

    // face movement direction; while attacking face where the camera looks
    let targetYaw = null;
    if (this.attackT > 0) targetYaw = this.yaw + Math.PI;
    else if (dir.lengthSq() > 0) targetYaw = Math.atan2(dir.x, dir.z);
    if (targetYaw !== null) {
      let d = targetYaw - this.group.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.group.rotation.y += d * Math.min(1, sdt * 12);
    }

    // animation state
    if (this.mixer) {
      this.fade(this.speedNow > 0.1 ? 'run' : 'idle');
      this.mixer.update(sdt);
    }

    // third-person camera
    const dist = 5.4;
    const cy = Math.sin(this.pitch), ch = Math.cos(this.pitch);
    const off = new THREE.Vector3(
      Math.sin(this.yaw) * ch * dist,
      1.4 + cy * dist,
      Math.cos(this.yaw) * ch * dist
    );
    this.shake = Math.max(0, this.shake - dt * 1.4);
    const j = this.shake;
    this.camera.position.copy(this.pos).add(off).add(
      new THREE.Vector3((Math.random() - 0.5) * j, (Math.random() - 0.5) * j, (Math.random() - 0.5) * j)
    );
    this.camera.lookAt(this.pos.x, this.pos.y + 1.55, this.pos.z);
  }

  forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
}
