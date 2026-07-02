import * as THREE from 'three';

export class HUD {
  constructor() {
    this.killsEl = document.getElementById('kills');
    this.gateEl = document.getElementById('gate-msg');
    this.hudEl = document.getElementById('hud');
    this.hpEl = document.getElementById('hp');
    this.flashEl = document.getElementById('hit-flash');
    this.deathEl = document.getElementById('death-msg');
    this.kills = 0;
    this._v = new THREE.Vector3();
  }

  addKill() {
    this.kills++;
    this.killsEl.textContent = `kills: ${this.kills}`;
  }

  setHP(r) {
    this.hpEl.style.width = `${Math.max(0, r) * 100}%`;
  }

  hitFlash() {
    this.flashEl.style.opacity = 0.4;
    setTimeout(() => { this.flashEl.style.opacity = 0; }, 90);
  }

  showDeath(on) {
    this.deathEl.style.opacity = on ? 1 : 0;
  }

  setGateNear(near) {
    this.gateEl.style.opacity = near ? 1 : 0;
  }

  spawnDamage(worldPos, amount, camera) {
    this._v.copy(worldPos).project(camera);
    if (this._v.z > 1) return; // behind the camera
    const x = (this._v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this._v.y * 0.5 + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.className = 'dmg';
    el.textContent = amount;
    el.style.left = `${x + (Math.random() - 0.5) * 30}px`;
    el.style.top = `${y}px`;
    this.hudEl.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }
}
