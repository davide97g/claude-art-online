import * as THREE from 'three';

// Boss-intro cutscene: plays once per load when the Kobold Lord first wakes.
// Watch-only — main.js skips player/blade updates while `blocking` is true.
// The camera dollies in from a wide shot while the boss stalks forward and
// roars; the target plate reveals at the climax; a short outro blends the
// camera back to the player orbit and returns control.
// Runs on real dt (camera work must ignore hit-stop; no hits can land anyway).

const SCENE_LEN = 3.5, OUTRO_LEN = 0.8;

function smooth(k: number) {
  k = Math.min(1, Math.max(0, k));
  return k * k * (3 - 2 * k);
}

// ponytail: synthesized WebAudio growl — swap for a real roar mp3 when one
// lands in public/assets/audio/ (SOUNDTRACK.md boss cues).
let audioCtx: AudioContext | null = null;
function playRoar() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.55, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.35);
    const f = audioCtx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(700, t0);
    f.frequency.exponentialRampToValueAtTime(160, t0 + 1.2);
    for (const [type, hz0, hz1] of [['sawtooth', 92, 36], ['square', 47, 29]] as const) {
      const o = audioCtx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(hz0, t0);
      o.frequency.exponentialRampToValueAtTime(hz1, t0 + 1.1);
      o.connect(f);
      o.start(t0); o.stop(t0 + 1.4);
    }
    f.connect(g); g.connect(audioCtx.destination);
  } catch { /* audio unavailable — scene plays silent */ }
}

export class BossIntro {
  camera: THREE.Camera;
  player: any;
  boss: any;
  hud: any;
  phase: string;
  played: boolean;
  t: number;
  roared: boolean;
  plated: boolean;
  endPos: THREE.Vector3;
  endQuat: THREE.Quaternion;

  constructor(camera: THREE.Camera, player: any, boss: any, hud: any) {
    this.camera = camera;
    this.player = player;
    this.boss = boss;
    this.hud = hud;
    this.phase = 'idle'; // idle -> scene -> outro -> done
    this.played = false;
    this.t = 0;
    this.roared = false;
    this.plated = false;
    this.endPos = new THREE.Vector3();
    this.endQuat = new THREE.Quaternion();
  }

  get blocking() { return this.phase === 'scene'; }

  // boss.onWake — returns true when the cutscene takes over the wake
  start() {
    if (this.played) return false; // re-engages after leash go straight to roar
    this.played = true;
    this.phase = 'scene';
    this.t = 0;
    this.roared = false;
    this.plated = false;
    this.boss.enter('cinematic');
    this.hud.setCinematic(true);
    return true;
  }

  update(dt: number) {
    if (this.phase !== 'scene') return;
    this.t += dt;
    const boss = this.boss, player = this.player;

    // arena frame: dir = boss -> player, right = its perpendicular
    const dir = player.pos.clone().sub(boss.pos).setY(0);
    if (dir.lengthSq() > 0.001) dir.normalize(); else dir.set(0, 0, 1);
    const right = new THREE.Vector3(dir.z, 0, -dir.x);
    const head = boss.pos.clone().add(new THREE.Vector3(0, 2.9, 0));
    const mid = boss.pos.clone().lerp(player.pos, 0.5).add(new THREE.Vector3(0, 1.6, 0));

    // boss stalks toward the player, then plants and roars
    if (this.t < 1.8 && boss.pos.distanceTo(player.pos) > 6) {
      boss.pos.addScaledVector(dir, 1.2 * dt);
    }
    const roarK = smooth((this.t - 1.8) / 0.7);
    if (boss.armL) boss.armL.rotation.x = -1.5 * roarK;
    if (boss.armR) boss.armR.rotation.x = -1.5 * roarK;
    if (boss.head) boss.head.rotation.x = -0.7 * roarK;
    boss.setEyes(2 + 12 * roarK);

    if (!this.roared && this.t >= 1.9) { this.roared = true; playRoar(); }
    if (!this.plated && this.t >= 2.1) { this.plated = true; this.hud.showBossIntro(boss.name); }

    // camera: wide high (A) -> in the boss's face (B) -> side profile of both (C)
    const A = boss.pos.clone().addScaledVector(right, 10).addScaledVector(dir, -3).add(new THREE.Vector3(0, 8, 0));
    const B = boss.pos.clone().addScaledVector(right, 2.6).addScaledVector(dir, 3.6).add(new THREE.Vector3(0, 3.2, 0));
    const C = mid.clone().addScaledVector(right, 5.6).add(new THREE.Vector3(0, 0.8, 0));
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    if (this.t < 2.2) {
      pos.lerpVectors(A, B, smooth(this.t / 2.2));
      look.copy(head);
    } else {
      const k = smooth((this.t - 2.2) / (SCENE_LEN - 2.2));
      pos.lerpVectors(B, C, k);
      look.lerpVectors(head, mid, k);
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(look);

    if (this.t >= SCENE_LEN) {
      // outro: hand control back, blend the camera home over OUTRO_LEN
      this.phase = 'outro';
      this.t = 0;
      this.endPos.copy(this.camera.position);
      this.endQuat.copy(this.camera.quaternion);
      this.hud.setCinematic(false);
      this.boss.enter('chase');
    }
  }

  // called after player.update wrote the orbit camera — blends scene -> player
  postCamera(dt: number) {
    if (this.phase !== 'outro') return;
    this.t += dt;
    const k = smooth(this.t / OUTRO_LEN);
    this.camera.position.lerpVectors(this.endPos, this.camera.position, k);
    this.camera.quaternion.slerpQuaternions(this.endQuat, this.camera.quaternion, k);
    if (this.t >= OUTRO_LEN) this.phase = 'done';
  }
}
