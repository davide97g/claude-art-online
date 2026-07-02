import * as THREE from 'three';

// Frenzy boar: weak roaming grind mob (the classic floor-1 boar). Wanders near
// its home patch, charges the player on sight, gores on contact. Gray-box
// primitives — no GLB, per the fallback rule.
const AGGRO = 9;      // start chasing inside this range
const DEAGGRO = 15;   // give up beyond this range
const LEASH = 18;     // never strays this far from home
const GORE_RANGE = 1.4;

export class Boar {
  constructor(scene, x, z, getHeight, hud, player) {
    this.hud = hud;
    this.player = player;
    this.getHeight = getHeight;
    this.home = new THREE.Vector3(x, getHeight(x, z), z);
    this.pos = this.home.clone();
    this.alive = true;
    this.maxHp = 18;
    this.hp = this.maxHp;
    this.wobble = 0;
    this.wobbleDir = new THREE.Vector3();
    this.flashT = 0;
    this.respawnT = 0;
    this.goreCd = 0;
    this.chasing = false;
    this.heading = Math.random() * Math.PI * 2;
    this.headT = 1 + Math.random() * 2;

    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    scene.add(this.group);

    const hide = new THREE.MeshLambertMaterial({ color: 0x6e5a48, flatShading: true });
    const bone = new THREE.MeshLambertMaterial({ color: 0xe8dfc8, flatShading: true });
    this.body = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.2), hide);
    trunk.position.y = 0.55;
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.4), hide);
    snout.position.set(0, 0.5, 0.75);
    this.body.add(trunk, snout);
    for (const sx of [-0.14, 0.14]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), bone);
      tusk.position.set(sx, 0.42, 0.95);
      tusk.rotation.x = Math.PI / 2.6; // point forward, tips up a touch
      this.body.add(tusk);
    }
    for (const [lx, lz] of [[-0.22, 0.4], [0.22, 0.4], [-0.22, -0.4], [0.22, -0.4]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), hide);
      leg.position.set(lx, 0.15, lz);
      this.body.add(leg);
    }
    this.group.add(this.body);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    this.flashMats = [];
    this.body.traverse((o) => { if (o.isMesh) this.flashMats.push(o.material = o.material.clone()); });

    // world-space hp bar (dummy pattern, lower + narrower)
    this.barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.09),
      new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: false, transparent: true, opacity: 0.85 }),
    );
    this.barBg.position.y = 1.35;
    this.barBg.renderOrder = 5;
    this.barFg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.055),
      new THREE.MeshBasicMaterial({ color: 0x55ff55, depthTest: false, transparent: true }),
    );
    this.barFg.position.set(0, 1.35, 0.001);
    this.barFg.renderOrder = 6;
    this.group.add(this.barBg, this.barFg);
  }

  takeHit(dmg, dir) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.wobble = 1;
    this.wobbleDir.copy(dir);
    this.flashT = 0.12;
    for (const m of this.flashMats) m.emissive.setHex(0xff5533);
    if (this.hp <= 0) {
      this.alive = false;
      this.respawnT = 6;
      this.chasing = false;
      this.hud.addKill(6, 8, { name: 'Boar Tusk', chance: 0.08 });
    }
  }

  update(sdt, camera) {
    if (this.flashT > 0) {
      this.flashT -= sdt;
      if (this.flashT <= 0) for (const m of this.flashMats) m.emissive.setHex(0x000000);
    }

    if (!this.alive) {
      // sink, then respawn at home
      this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, this.pos.y - 1.4, sdt * 4);
      this.respawnT -= sdt;
      if (this.respawnT <= 0) {
        this.alive = true;
        this.hp = this.maxHp;
        this.pos.copy(this.home);
        this.group.position.copy(this.pos);
      }
      return;
    }

    const toP = this.player.pos.clone().sub(this.pos);
    toP.y = 0;
    const dist = toP.length();
    if (dist > 0.001) toP.normalize();
    const fromHome = Math.hypot(this.pos.x - this.home.x, this.pos.z - this.home.z);

    // aggro with hysteresis so it doesn't flicker at the boundary
    if (this.chasing) {
      if (dist > DEAGGRO || this.player.dead || fromHome > LEASH) this.chasing = false;
    } else if (dist < AGGRO && !this.player.dead && fromHome < LEASH) {
      this.chasing = true;
    }

    this.goreCd = Math.max(0, this.goreCd - sdt);
    let move;
    if (this.chasing) {
      move = toP;
      if (dist < GORE_RANGE) {
        if (this.goreCd <= 0) {
          this.goreCd = 1.2;
          this.player.takeDamage(Math.round(4 + Math.random() * 3), toP);
        }
      } else {
        this.pos.addScaledVector(toP, 4.2 * sdt); // player walk (5.5) can disengage
      }
    } else {
      // amble a random heading; drift back when far from home
      this.headT -= sdt;
      if (this.headT <= 0) {
        this.heading = Math.random() * Math.PI * 2;
        this.headT = 2 + Math.random() * 2;
      }
      if (fromHome > 7) this.heading = Math.atan2(this.home.x - this.pos.x, this.home.z - this.pos.z);
      move = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
      this.pos.addScaledVector(move, 1.2 * sdt);
    }

    this.pos.y = this.getHeight(this.pos.x, this.pos.z);
    this.group.position.copy(this.pos);

    // face movement, shortest arc (golem pattern)
    const target = Math.atan2(move.x, move.z);
    let d = target - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * Math.min(1, sdt * (this.chasing ? 8 : 3));

    // hit recoil wobble
    this.wobble = Math.max(0, this.wobble - sdt * 3.5);
    const w = Math.sin(this.wobble * Math.PI) * 0.35;
    this.body.rotation.x = this.wobbleDir.z * w;
    this.body.rotation.z = -this.wobbleDir.x * w;

    // hp bar faces camera, scales hp
    const r = Math.max(0, this.hp / this.maxHp);
    this.barFg.scale.x = Math.max(0.001, r);
    this.barFg.position.x = -(1 - r) * 0.43;
    this.barFg.material.color.setHSL(0.35 * r, 0.75, 0.55);
    this.barBg.lookAt(camera.position);
    this.barFg.rotation.copy(this.barBg.rotation);
    this.barBg.visible = this.barFg.visible = dist < 30;
  }
}
