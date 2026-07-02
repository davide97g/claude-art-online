import * as THREE from 'three';

export class HUD {
  constructor() {
    this.killsEl = document.getElementById('kills');
    this.gateEl = document.getElementById('gate-msg');
    this.hudEl = document.getElementById('hud');
    this.hpEl = document.getElementById('hp');
    this.flashEl = document.getElementById('hit-flash');
    this.deathEl = document.getElementById('death-msg');
    this.floorLabelEl = document.getElementById('floor-label');
    this.badgeEl = document.getElementById('place-badge');
    this.hudEl = document.getElementById('hud');
    this.xpEl = document.getElementById('xp');
    this.lvlEl = document.getElementById('lvl');
    this.levelupEl = document.getElementById('levelup');
    this.bossWrapEl = document.getElementById('boss-wrap');
    this.bossNameEl = document.getElementById('boss-name');
    this.bossHpEl = document.getElementById('boss-hp');
    this.clearEl = document.getElementById('clear-banner');
    this.colEl = document.getElementById('col');
    this.lootEl = document.getElementById('loot-badge');
    this._lootT = 0;
    this.progression = null; // late-bound by main.js; addKill(xp) feeds it
    this.floorName = '';
    this.place0 = '';
    this._badgeT = 0;
    this.kills = 0;
    this._v = new THREE.Vector3();
  }

  // xp/col instant-grant on kill; rare = { name, chance } rolls a toast + log.
  // ponytail: no inventory — the console log IS the loot log.
  addKill(xp = 0, col = 0, rare = null) {
    this.kills++;
    this.killsEl.textContent = `kills: ${this.kills}`;
    if (xp && this.progression) this.progression.addXp(xp);
    if (col && this.progression) {
      this.progression.addCol(col);
      this.setCol(this.progression.col);
    }
    if (rare && Math.random() < rare.chance) {
      console.log(`[CAO] loot: ${rare.name}`);
      this.lootToast(`${rare.name} acquired`);
    }
  }

  setCol(n) {
    this.colEl.textContent = `${n} Col`;
    this.colEl.classList.remove('pulse');
    void this.colEl.offsetWidth; // restart the pulse animation
    this.colEl.classList.add('pulse');
  }

  lootToast(text) {
    this.lootEl.textContent = text;
    this.lootEl.classList.add('show');
    clearTimeout(this._lootT);
    this._lootT = setTimeout(() => this.lootEl.classList.remove('show'), 3000);
  }

  setXP(r, lv) {
    this.xpEl.style.width = `${Math.max(0, Math.min(1, r)) * 100}%`;
    this.lvlEl.textContent = `Lv ${lv}`;
  }

  levelUp(lv) {
    this.levelupEl.textContent = `Level up · Lv ${lv}`;
    this.levelupEl.classList.add('show');
    clearTimeout(this._luT);
    this._luT = setTimeout(() => this.levelupEl.classList.remove('show'), 2000);
  }

  showBoss(name) {
    this.bossNameEl.textContent = name;
    this.bossWrapEl.classList.add('show');
  }

  // cutscene plate reveal: plate pops in with the HP bar sweeping 0 -> full
  showBossIntro(name) {
    this.showBoss(name);
    const el = this.bossHpEl;
    el.style.transition = 'none';
    el.style.width = '0%';
    requestAnimationFrame(() => {
      el.style.transition = 'width 1.1s cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.width = '100%';
      setTimeout(() => { el.style.transition = ''; }, 1200); // back to the CSS default
    });
  }

  setCinematic(on) {
    this.hudEl.classList.toggle('cine', on);
  }

  hideBoss() {
    this.bossWrapEl.classList.remove('show');
  }

  setBossHP(r) {
    this.bossHpEl.style.width = `${Math.max(0, r) * 100}%`;
  }

  showClear(floorName) {
    this.clearEl.textContent = `${floorName} cleared`;
    this.clearEl.style.opacity = 1;
    clearTimeout(this._clearT);
    this._clearT = setTimeout(() => { this.clearEl.style.opacity = 0; }, 4000);
  }

  setGateOpen() {
    this.gateEl.textContent = 'Gate open · floor cleared';
    this.gateEl.style.color = '#ffd34d';
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

  setFloor(floorName, place0) {
    this.floorName = floorName;
    this.place0 = place0;
    this.floorLabelEl.textContent = `${floorName} · ${place0}`;
  }

  enterPlace(name) {
    this.floorLabelEl.textContent = `${this.floorName} · ${name || this.place0}`;
    if (!name) return;                 // left all zones → label reverts, no badge
    this.badgeEl.textContent = name;
    this.badgeEl.classList.add('show');
    clearTimeout(this._badgeT);
    this._badgeT = setTimeout(() => this.badgeEl.classList.remove('show'), 3500);
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
