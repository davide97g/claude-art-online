import * as THREE from 'three';

// Cheap weather as a player-following particle box. Each type sets particle count,
// colour, downward fall, horizontal drift and a flutter; rain also flashes lightning.
// Uses REAL dt (cosmetic — ignores hit-stop, like the camera). Unknown type → no-op.

const BOX = 70;   // particle field extent; recentered on the player each frame
const TOP = 40;   // recycle height above the player
const WHITE = new THREE.Color(0xffffff);

// Per-type tuning. fall = downward units/s; drift = +X units/s (wind blows sideways);
// sway = flutter amplitude on swayAxis (0=X, 1=Y); lightning flashes sky+sun (rain only).
const TYPES = {
  snow: { count: 800,  color: 0xffffff, size: 0.22, fall: 6,  drift: 0,  sway: 1.2, swayAxis: 0, lightning: false },
  rain: { count: 1200, color: 0xafc2d6, size: 0.16, fall: 34, drift: 0,  sway: 0,   swayAxis: 0, lightning: true  },
  wind: { count: 650,  color: 0xe6b784, size: 0.14, fall: 2,  drift: 24, sway: 2.4, swayAxis: 1, lightning: false },
  pollen: { count: 500, color: 0xd8c079, size: 0.13, fall: 1.2, drift: 3, sway: 1.4, swayAxis: 0, lightning: false },
};

function field(count, color, size) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) p[i] = (Math.random() - 0.5) * BOX;
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({
    color, size, transparent: true, opacity: 0.85, depthWrite: false, fog: false,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

export function createWeather(scene, type, lights = {}) {
  const cfg = TYPES[type];
  if (!cfg) return { update() {} };

  const { count, fall, drift, sway, swayAxis, lightning } = cfg;
  const pts = field(count, cfg.color, cfg.size);
  scene.add(pts);
  const arr = pts.geometry.attributes.position.array;

  const { sun, hemi } = lights;
  const sunBase = sun ? sun.intensity : 0;
  const hemiBase = hemi ? hemi.intensity : 0;
  const bgBase = scene.background ? scene.background.clone() : null;
  let strikeT = 3;  // seconds to next lightning
  let flash = 0;    // current flash, 1 → 0
  let acc = 0;

  return {
    update(dt, playerPos) {
      const cx = playerPos.x, cz = playerPos.z, cy = playerPos.y;
      for (let i = 0; i < count; i++) {
        const j = i * 3;
        arr[j + 1] -= fall * dt;
        if (drift) arr[j] += drift * dt;
        if (sway) arr[j + swayAxis] += Math.sin(acc * 2 + i) * sway * dt;
        if (arr[j + 1] < cy - 4) arr[j + 1] = cy + TOP;
        if (arr[j] < cx - BOX / 2) arr[j] += BOX; else if (arr[j] > cx + BOX / 2) arr[j] -= BOX;
        if (arr[j + 2] < cz - BOX / 2) arr[j + 2] += BOX; else if (arr[j + 2] > cz + BOX / 2) arr[j + 2] -= BOX;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      acc += dt;

      if (lightning) {
        strikeT -= dt;
        if (strikeT <= 0) { flash = 1; strikeT = 4 + (Math.sin(acc * 13.1) * 0.5 + 0.5) * 6; } // 4–10s
        if (flash > 0) {
          flash = Math.max(0, flash - dt * 3.2);
          if (sun) sun.intensity = sunBase + flash * 2.2;
          if (hemi) hemi.intensity = hemiBase + flash * 1.5;
          if (bgBase && scene.background) scene.background.copy(bgBase).lerp(WHITE, flash * 0.5);
        }
      }
    },
  };
}
