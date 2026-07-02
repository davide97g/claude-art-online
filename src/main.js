import * as THREE from 'three';
import { createFloor, terrainHeight } from './world/floor.js';
import { createTown } from './world/town.js';
import { Player } from './player/controller.js';
import { Blade } from './combat/blade.js';
import { Dummy } from './combat/dummy.js';
import { Golem } from './combat/golem.js';
import { HUD } from './ui/hud.js';

// --- renderer / scene ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9dc2ec);
scene.fog = new THREE.Fog(0x9db8d9, 60, 175);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000);

const hemi = new THREE.HemisphereLight(0xcfe5ff, 0x5b7a4a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 1.25);
sun.position.set(60, 90, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.camera.far = 300;
scene.add(sun);

// --- input (pointer lock; per-frame mouse deltas) ---
const input = { keys: {}, dx: 0, dy: 0, attackQueued: false, locked: false };
const overlay = document.getElementById('lock-overlay');

// background music: CC0 "Medieval: The Bard's Tale" by RandomMind (opengameart.org).
// Autoplay is blocked until a user gesture, so it kicks off on the first Link-start click.
const music = new Audio('/assets/audio/bards_tale.mp3');
music.loop = true;
music.volume = 0.35;

overlay.addEventListener('click', async () => {
  music.play().catch(() => {}); // no-op if already playing / gesture didn't count
  try { await document.documentElement.requestFullscreen(); } catch { /* fullscreen optional */ }
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  input.locked = document.pointerLockElement === renderer.domElement;
  overlay.style.display = input.locked ? 'none' : 'flex';
});
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
const floor = createFloor(scene);
createTown(scene, terrainHeight);
const player = new Player(scene, camera, input, terrainHeight);
player.hud = hud;
const blade = new Blade(player, scene, world, hud);
const enemies = [
  // training dummies near spawn
  new Dummy(scene, 5, -9, terrainHeight, hud),
  new Dummy(scene, -7, -14, terrainHeight, hud),
  // moss golems guarding the way to the gate
  new Golem(scene, 14, -28, terrainHeight, hud, player, world),
  new Golem(scene, -18, -42, terrainHeight, hud, player, world),
  new Golem(scene, 8, -66, terrainHeight, hud, player, world),
  new Golem(scene, -10, -88, terrainHeight, hud, player, world),
  new Golem(scene, 20, -102, terrainHeight, hud, player, world),
];

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
