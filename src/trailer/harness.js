// Trailer harness entry — DEV ONLY. Lazy-loaded by main.js only with ?rec / ?cam.
// Reads engine refs off window.__cao (set by main.js) and wires:
//   ?rec         → record-toggle (press ` to start/stop, auto-downloads a webm)
//   ?cam=<preset> → scripted cinematic camera, applied by wrapping renderer.render
//                   so it needs no game-loop edit.
import { initCapture } from './capture.js';
import { CineCam } from './cinecam.js';

const cao = window.__cao;
if (!cao) {
  console.warn('[CAO] trailer harness: window.__cao missing — main.js did not expose refs');
} else {
  const q = new URLSearchParams(location.search);

  if (q.has('rec')) {
    initCapture(cao.renderer.domElement, cao.biomeId ?? 1);
  }

  if (q.has('cam')) {
    // walk preset: drive the player forward (movement + run anim reads input.keys,
    // no pointer lock needed). Fixed spawn yaw → identical heading across biomes.
    if (q.get('cam') === 'walk' && cao.input) {
      cao.input.keys['KeyW'] = true;
      if (q.has('sprint')) cao.input.keys['ShiftLeft'] = true;
    }
    const cine = new CineCam(q.get('cam'), q, cao.terrainHeight);
    // Override the camera immediately before every render — independent of the loop.
    const orig = cao.renderer.render.bind(cao.renderer);
    cao.renderer.render = (scene, camera) => {
      cine.apply(camera, cao.player);
      orig(scene, camera);
    };
  }
}
