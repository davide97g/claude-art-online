// Scripted cinematic camera — DEV ONLY. Wired by src/trailer/harness.js when the URL
// has `?cam=<preset>`. `apply(camera, player)` overwrites camera.position + lookAt each
// render, so it overrides the behind-shoulder camera without touching controller.js or
// the game loop. Combat stays human-driven; this is for atmospheric / vista / hero shots.
//
// Presets: orbit | reveal | dolly | flyover
// Tunable via URL params (all optional, sensible defaults per preset):
//   ?cam=orbit&dur=10&r=9&h=3&speed=1&cx=0&cz=0&tx=0&tz=0
//   dur  seconds for eased pans (orbit ignores it — it rotates continuously)
//   r    radius / travel span      h   camera height above ground
//   speed orbit angular speed      cx,cz  center point (defaults to the player)
//   tx,tz target point for reveal (e.g. the gate)

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => t * t * (3 - 2 * t); // ease-in-out
const now = () => performance.now() / 1000;

export class CineCam {
  constructor(preset, q, getHeight) {
    this.preset = preset || 'orbit';
    this.getHeight = getHeight || (() => 0);
    const num = (k, d) => (q.has(k) ? parseFloat(q.get(k)) : d);
    this.dur = num('dur', 10);
    this.r = num('r', 9);
    this.h = num('h', 3);
    this.speed = num('speed', 1);
    this.cx = num('cx', 0);
    this.cz = num('cz', 0);
    this.tx = num('tx', 0);
    this.tz = num('tz', 0);
    this.push = num('push', 0); // orbit: start push*r further out + higher, zoom in over dur
    this.t0 = -1;

    // cinematic = no HUD, no loading overlay in frame
    document.getElementById('hud')?.style.setProperty('display', 'none');
    document.getElementById('lock-overlay')?.classList.add('hidden');

    console.log(`[CAO] cinecam preset=${this.preset} dur=${this.dur} r=${this.r} h=${this.h} speed=${this.speed}`);
  }

  apply(camera, player) {
    if (this.t0 < 0) this.t0 = now();
    const t = now() - this.t0; // seconds since first frame
    const e = smooth(clamp01(t / this.dur)); // eased 0..1, holds at 1
    const cx = player ? player.pos.x : this.cx;
    const cz = player ? player.pos.z : this.cz;
    const ground = this.getHeight(cx, cz);

    switch (this.preset) {
      case 'orbit': {
        const a = t * 0.35 * this.speed; // continuous slow orbit
        // optional cinematic push-in: start further out + higher, ease to r/h over dur
        const rad = this.r * (1 + this.push * (1 - e));
        const hh = this.h * (1 + this.push * (1 - e) * 0.5);
        camera.position.set(cx + Math.sin(a) * rad, ground + hh, cz + Math.cos(a) * rad);
        camera.lookAt(cx, ground + 1.4, cz);
        break;
      }
      case 'reveal': {
        // push in + rise toward the target (e.g. the gate)
        const far = this.r * 2.2, near = this.r * 0.8;
        const dist = far + (near - far) * e;
        const y = ground + 1.2 + (this.h - 1.2) * e;
        camera.position.set(this.tx, y, this.tz + dist);
        camera.lookAt(this.tx, ground + 2.2, this.tz);
        break;
      }
      case 'dolly': {
        // lateral drift across the plaza, looking at center
        const span = this.r * 2;
        camera.position.set(cx - span / 2 + span * e, ground + this.h, cz + this.r);
        camera.lookAt(cx, ground + 1.4, cz);
        break;
      }
      case 'flyover': {
        // high slow pan across terrain
        const span = this.r * 3;
        const z = this.cz - span / 2 + span * e;
        const x = this.cx + Math.sin(clamp01(t / this.dur) * Math.PI) * this.r * 0.5;
        const gy = this.getHeight(x, z);
        camera.position.set(x, gy + this.h + 8, z);
        camera.lookAt(x, gy, z + 12);
        break;
      }
      case 'walk': {
        // Behind-follow tracking shot. The player walks forward at a fixed heading
        // (driven by harness.js), so framing + stride match across biomes for a
        // seamless match cut. Camera sits behind/above, looking ahead into the biome.
        if (!player) break;
        const fx = -Math.sin(player.yaw);
        const fz = -Math.cos(player.yaw);
        const p = player.pos;
        camera.position.set(p.x - fx * this.r, p.y + this.h, p.z - fz * this.r);
        // look slightly down at the ground ahead → horizon sits low, keeps the sky
        // dome out of frame; biome ground/fog/weather + the walking knight fill it
        camera.lookAt(p.x + fx * 6, p.y + 1.2, p.z + fz * 6);
        break;
      }
    }
  }
}
