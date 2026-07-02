import * as THREE from 'three';
import { createFloor, terrainHeight } from './world/floor.js';
import { createTown } from './world/town.js';
import { Player } from './player/controller.js';
import { Blade } from './combat/blade.js';
import { Dummy } from './combat/dummy.js';
import { Golem } from './combat/golem.js';
import { HUD } from './ui/hud.js';
import { manager } from './loading.js';
import { getBiome } from './world/biomes.js';
import { createWeather } from './world/weather.js';

const biome = getBiome(new URLSearchParams(location.search).get('level'));

// --- renderer / scene ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(biome.background);
scene.fog = new THREE.Fog(biome.fog.color, biome.fog.near, biome.fog.far);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);

const hemi = new THREE.HemisphereLight(biome.hemi.sky, biome.hemi.ground, biome.hemi.intensity);
scene.add(hemi);
const sun = new THREE.DirectionalLight(biome.sun.color, biome.sun.intensity);
sun.position.set(biome.sun.pos[0], biome.sun.pos[1], biome.sun.pos[2]);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 300;
scene.add(sun);

// --- input (pointer lock; per-frame mouse deltas) ---
const input = { keys: {}, dx: 0, dy: 0, attackQueued: false, locked: false };
const overlay = document.getElementById('lock-overlay');
const goBtn = document.getElementById('lock-go');
let ready = false; // flips true when assets finish loading (or the safety net trips)

// background music: CC0 "Medieval: The Bard's Tale" by RandomMind (opengameart.org).
// Autoplay is blocked until a user gesture, so it kicks off on the first Link-start click.
const music = new Audio('/assets/audio/bards_tale.mp3');
music.loop = true;
music.volume = 0.35;

// Entry is gated on load: clicks are ignored until `ready`.
overlay.addEventListener('click', async () => {
  if (!ready) return;
  music.play().catch(() => {}); // no-op if already playing / gesture didn't count
  try { await document.documentElement.requestFullscreen(); } catch { /* fullscreen optional */ }
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  input.locked = document.pointerLockElement === renderer.domElement;
  overlay.classList.toggle('hidden', input.locked); // fade out on enter, back on Esc-pause
});

// --- loading screen: progress bar, rotating tips, Ken Burns crossfade ---
// Wired before the world is built (below) so no onProgress/onLoad fires unheard.
const barEl = document.getElementById('load-bar');
const statusEl = document.getElementById('load-status');
manager.onProgress = (_url, loaded, total) => {
  const pct = total ? Math.round((loaded / total) * 100) : 0;
  barEl.style.width = pct + '%';
  statusEl.textContent = `Loading… ${pct}%`;
};
function markReady() {
  if (ready) return;
  ready = true;
  barEl.style.width = '100%';
  statusEl.textContent = 'Enter Aincrad';
  goBtn.classList.add('ready');
}
manager.onLoad = markReady;
manager.onError = (url) => console.log('[CAO] asset failed, continuing gray-box:', url);
// ponytail: safety net — the game is fully playable gray-box, so never trap the
// player behind a bar that never fills if a loader misbehaves. Force-enter after 12s.
setTimeout(markReady, 12000);

// rotating gameplay tips
const tips = [
  'A clean hit <b>slows time</b> for a beat — that pause is your cue to chain the next swing.',
  'Hold <b>Shift</b> to sprint; close the distance to the sealed gate.',
  'Attacks buffer: <b>left-click mid-swing</b> and the next one fires the instant the blade resets.',
  'Moss golems <b>telegraph</b> — their eyes flare before they strike. Read it, then punish.',
  'Every swing is a <b>random slash</b>; keep clicking to flow through the combo.',
  'Press <b>Esc</b> anytime to pause and free your mouse.',
];
const tipEl = document.getElementById('load-tip');
tipEl.innerHTML = tips[0];
let tipI = 1;
setInterval(() => {
  tipEl.style.opacity = '0';
  setTimeout(() => {
    tipEl.innerHTML = tips[tipI % tips.length];
    tipEl.style.opacity = '';
    tipI++;
  }, 500);
}, 5000);

// Ken Burns: cross-fade the background stack, replaying each layer's zoom.
const kbEls = [...document.querySelectorAll('#lock-bg .kb')];
let kbI = 0;
setInterval(() => {
  kbEls[kbI].classList.remove('active');
  kbI = (kbI + 1) % kbEls.length;
  const next = kbEls[kbI];
  void next.offsetWidth; // reflow so the zoom animation restarts from scale(1)
  next.classList.add('active');
}, 7000);
document.addEventListener('mousemove', (e) => {
  if (!input.locked) return;
  input.dx += e.movementX;
  input.dy += e.movementY;
});
document.addEventListener('mousedown', (e) => {
  if (e.button === 0 && input.locked) input.attackQueued = true; // buffered: fires as soon as the current swing ends
});
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  input.keys[e.code] = true;
  if (e.code === 'KeyM') music.muted = !music.muted; // toggle background music
});
document.addEventListener('keyup', (e) => { input.keys[e.code] = false; });

// --- world (hit-stop lives here) ---
const world = {
  timeScale: 1,
  stopT: 0,
  hitStop(dur) { this.stopT = dur; },
};

// --- build everything ---
const hud = new HUD();
const floor = createFloor(scene, biome);
createTown(scene, terrainHeight);
const player = new Player(scene, camera, input, terrainHeight);
player.hud = hud;
const blade = new Blade(player, scene, world, hud);
const weather = createWeather(scene, biome.weather, { sun, hemi });
const enemies = biome.enemies.map((e) =>
  e.type === 'dummy'
    ? new Dummy(scene, e.x, e.z, terrainHeight, hud)
    : new Golem(scene, e.x, e.z, terrainHeight, hud, player, world));

// --- loop ---
const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (world.stopT > 0) { world.stopT -= dt; world.timeScale = 0.07; }
  else world.timeScale += (1 - world.timeScale) * Math.min(1, dt * 14);
  const sdt = dt * world.timeScale;

  player.update(dt, sdt);
  blade.update(sdt, dt, input, enemies, camera);
  for (const e of enemies) e.update(sdt, camera);
  floor.update(elapsed);
  weather.update(dt, player.pos);

  hud.setGateNear(player.pos.distanceTo(floor.gatePos) < 14);

  input.dx = 0;
  input.dy = 0;
  renderer.render(scene, camera);
}
tick();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
