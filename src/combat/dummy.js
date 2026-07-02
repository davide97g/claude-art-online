import * as THREE from 'three';

// Training dummy: takes hits, wobbles, dies, respawns. Our first "enemy".
export class Dummy {
  constructor(scene, x, z, getHeight, hud) {
    this.hud = hud;
    this.getHeight = getHeight;
    this.pos = new THREE.Vector3(x, getHeight(x, z), z);
    this.alive = true;
    this.maxHp = 40;
    this.hp = this.maxHp;
    this.wobble = 0;
    this.wobbleDir = new THREE.Vector3();
    this.respawnT = 0;

    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    scene.add(this.group);

    const wood = new THREE.MeshLambertMaterial({ color: 0xa9825a, flatShading: true });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.1, 6), wood);
    post.position.y = 0.55;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.0, 7), wood);
    body.position.y = 1.6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 7, 6), wood);
    head.position.y = 2.4;
    const arms = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.16), wood);
    arms.position.y = 1.85;
    this.body = new THREE.Group();
    this.body.add(post, body, head, arms);
    this.group.add(this.body);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

    this.flashMats = [];
    this.body.traverse((o) => { if (o.isMesh) this.flashMats.push(o.material = o.material.clone()); });

    // 3D hp bar
    this.barBg = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.12, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x22262e })
    );
    this.barBg.position.y = 3.0;
    this.barFg = new THREE.Mesh(
      new THREE.BoxGeometry(1.16, 0.08, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x53e07f })
    );
    this.barFg.position.y = 3.0;
    this.group.add(this.barBg, this.barFg);
  }

  takeHit(dmg, dir) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.wobble = 1;
    this.wobbleDir.copy(dir);
    for (const m of this.flashMats) { m.emissive = new THREE.Color(0xff5533); }
    this.flashT = 0.12;
    if (this.hp <= 0) {
      this.alive = false;
      this.respawnT = 3;
      this.hud.addKill();
    }
  }

  update(sdt, camera) {
    if (this.flashT > 0) {
      this.flashT -= sdt;
      if (this.flashT <= 0) for (const m of this.flashMats) m.emissive = new THREE.Color(0x000000);
    }

    if (!this.alive) {
      this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, this.pos.y - 3.2, sdt * 4);
      this.respawnT -= sdt;
      if (this.respawnT <= 0) {
        this.alive = true;
        this.hp = this.maxHp;
        this.group.position.copy(this.pos);
      }
    } else {
      // recoil wobble
      this.wobble = Math.max(0, this.wobble - sdt * 3.5);
      const w = Math.sin(this.wobble * Math.PI) * 0.35;
      this.body.rotation.x = this.wobbleDir.z * w;
      this.body.rotation.z = -this.wobbleDir.x * w;
    }

    // hp bar faces camera, scales with hp
    const r = Math.max(0, this.hp / this.maxHp);
    this.barFg.scale.x = Math.max(0.001, r);
    this.barFg.position.x = -(1 - r) * 0.58;
    this.barFg.material.color.setHSL(0.35 * r, 0.75, 0.55);
    this.barBg.lookAt(camera.position);
    this.barFg.rotation.copy(this.barBg.rotation);
  }
}
