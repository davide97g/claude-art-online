import * as THREE from 'three';

// SAO-style branching dialogue. Owns the panel DOM, the conversation state
// machine, its own keydown listener (pointer lock stays on — keyboard only),
// and the over-shoulder two-shot camera (ease-in -> hold -> ease-back, the same
// smoothstep pattern as combat/cutscene.ts). Camera/typewriter run on real dt.

const INTRO = 0.5;   // camera ease-in seconds
const OUTRO = 0.4;   // camera ease-back seconds
const TYPE_SPEED = 45; // characters per second

function smooth(k) { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); }

export class Dialog {
  constructor({ player, villagers, camera }) {
    this.player = player;
    this.villagers = villagers;
    this.camera = camera;
    this.phase = 'idle'; // idle -> open -> closing -> idle

    this.el = document.getElementById('dialog');
    this.nameEl = document.getElementById('dlg-name');
    this.tagEl = document.getElementById('dlg-tag');
    this.textEl = document.getElementById('dlg-text');
    this.choicesEl = document.getElementById('dlg-choices');

    // conversation state
    this.tree = null;   // { root, nodes } for named NPCs; null for a one-liner
    this.node = null;   // current node { text, choices }
    this.sel = 0;       // highlighted choice
    this.full = '';     // full current line
    this.typed = 0;     // chars revealed
    this.typing = false;
    this._justOpened = false;

    // camera scratch
    this.t = 0;
    this.startPos = new THREE.Vector3();
    this.startQuat = new THREE.Quaternion();
    this.targetPos = new THREE.Vector3();
    this.targetLook = new THREE.Vector3();
    this.npcPos = new THREE.Vector3();
    this.heldPos = new THREE.Vector3();
    this.heldQuat = new THREE.Quaternion();
    this._tmp = new THREE.Object3D();

    this._onKey = (e) => this.onKey(e);
  }

  get active() { return this.phase === 'open' || this.phase === 'closing'; }

  open(identity, person) {
    if (this.phase !== 'idle') return;
    this.phase = 'open';
    this.t = 0;
    this.person = person;
    this.npcPos.copy(person.g.position);

    // freeze both actors; dialog owns the camera from here
    this.player.talking = true;
    this.player.faceTarget = this.npcPos.clone();
    this.villagers.talkingWith = person;

    this.startPos.copy(this.camera.position);
    this.startQuat.copy(this.camera.quaternion);

    this.nameEl.textContent = identity.name;
    this.tagEl.textContent = identity.tag || '';
    this.tagEl.style.display = identity.tag ? '' : 'none';

    if (identity.tree) {
      this.tree = identity.tree;
      this.goto(identity.tree.root);
    } else {
      this.tree = null;
      this.node = { text: identity.line, choices: [{ label: 'Farewell.', to: null }] };
      this.render();
    }

    this.el.classList.add('show');
    this._justOpened = true;
    setTimeout(() => { this._justOpened = false; }, 200);
    window.addEventListener('keydown', this._onKey);
    console.log('[CAO] talk:', identity.name);
  }

  goto(key) {
    if (!key || !this.tree.nodes[key]) { this.close(); return; }
    this.node = this.tree.nodes[key];
    this.render();
  }

  render() {
    this.sel = 0;
    this.full = this.node.text;
    this.typed = 0;
    this.typing = true;
    this.textEl.textContent = '';
    this.renderChoices();
  }

  renderChoices() {
    this.choicesEl.innerHTML = '';
    if (this.typing) return; // choices appear once the line finishes typing
    this.node.choices.forEach((c, i) => {
      const b = document.createElement('div');
      b.className = 'dlg-choice' + (i === this.sel ? ' selected' : '');
      b.textContent = `${i + 1}. ${c.label}`;
      this.choicesEl.appendChild(b);
    });
  }

  onKey(e) {
    if (this.phase !== 'open') return;
    if (e.repeat) return;
    e.preventDefault();

    // any key completes an in-progress reveal instead of acting
    if (this.typing) {
      this.typed = this.full.length;
      this.textEl.textContent = this.full;
      this.typing = false;
      this.renderChoices();
      return;
    }
    // the E/Enter/Space that opened the panel must not immediately advance it
    if (this._justOpened && (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space')) return;

    if (e.code === 'Escape' || e.code === 'KeyQ') { this.close(); return; }
    const n = this.node.choices.length;
    if (e.code === 'ArrowDown') { this.sel = (this.sel + 1) % n; this.renderChoices(); return; }
    if (e.code === 'ArrowUp') { this.sel = (this.sel - 1 + n) % n; this.renderChoices(); return; }
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
      const i = e.code.charCodeAt(5) - 49; // 'Digit1' -> 0
      if (i < n) this.choose(i);
      return;
    }
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') this.choose(this.sel);
  }

  choose(i) {
    const c = this.node.choices[i];
    if (!c) return;
    if (this.tree && c.to) this.goto(c.to);
    else this.close();
  }

  close() {
    if (this.phase !== 'open') return;
    window.removeEventListener('keydown', this._onKey);
    this.el.classList.remove('show');
    this.phase = 'closing';
    this.t = 0;
    this.heldPos.copy(this.camera.position);
    this.heldQuat.copy(this.camera.quaternion);
    this.player.talking = false;
    this.player.faceTarget = null;
    this.villagers.talkingWith = null;
  }

  // typewriter — real dt, only while open
  updateText(dt) {
    if (!this.typing) return;
    this.typed = Math.min(this.full.length, this.typed + dt * TYPE_SPEED);
    this.textEl.textContent = this.full.slice(0, Math.floor(this.typed));
    if (this.typed >= this.full.length) { this.typing = false; this.renderChoices(); }
  }

  computeTarget() {
    const P = this.player.pos, N = this.npcPos;
    const toN = new THREE.Vector3(N.x - P.x, 0, N.z - P.z);
    if (toN.lengthSq() < 1e-4) toN.set(0, 0, 1); else toN.normalize();
    const right = new THREE.Vector3(toN.z, 0, -toN.x); // over-the-shoulder offset
    this.targetPos.set(
      P.x - toN.x * 2.4 + right.x * 1.4,
      P.y + 1.8,
      P.z - toN.z * 2.4 + right.z * 1.4,
    );
    this.targetLook.set(
      P.x + (N.x - P.x) * 0.62,
      P.y + 1.35,
      P.z + (N.z - P.z) * 0.62, // bias the look toward the NPC
    );
  }

  // call every frame AFTER player.update. While open, dialog owns the camera
  // (player.update skipped it). While closing, player.update wrote the live
  // orbit pose — blend the held two-shot back into it.
  updateCamera(dt) {
    if (this.phase === 'open') {
      this.updateText(dt);
      this.t = Math.min(INTRO, this.t + dt);
      this.computeTarget();
      this._tmp.position.copy(this.targetPos);
      this._tmp.lookAt(this.targetLook);
      const k = smooth(this.t / INTRO);
      this.camera.position.lerpVectors(this.startPos, this.targetPos, k);
      this.camera.quaternion.copy(this.startQuat).slerp(this._tmp.quaternion, k);
    } else if (this.phase === 'closing') {
      this.t = Math.min(OUTRO, this.t + dt);
      const k = smooth(this.t / OUTRO);
      const livePos = this.camera.position.clone();   // orbit pose from player.update
      const liveQuat = this.camera.quaternion.clone();
      this.camera.position.copy(this.heldPos).lerp(livePos, k);
      this.camera.quaternion.copy(this.heldQuat).slerp(liveQuat, k);
      if (this.t >= OUTRO) this.phase = 'idle';
    }
  }
}
