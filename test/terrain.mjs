import assert from 'node:assert/strict';
import { configureTerrain, terrainHeight } from '../src/world/floor.js';

// Reference "rolling" formula = the pre-change floors 1-3 behaviour.
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function oldHeight(x, z, amp = 1, freq = 1) {
  const flat = smoothstep(8, 40, Math.hypot(x, z));
  const h = Math.sin(x * 0.05 * freq) * Math.cos(z * 0.045 * freq) * 2.2
          + Math.sin(x * 0.13 * freq + 1.7) * Math.sin(z * 0.11 * freq) * 0.8;
  return h * flat * amp;
}

// 1. rolling with no shape/river must match the old formula exactly (regression guard).
configureTerrain({ terrain: { amp: 1, freq: 1 } });
for (const [x, z] of [[10, 10], [50, -30], [-70, 80], [0, 0]]) {
  assert.ok(Math.abs(terrainHeight(x, z) - oldHeight(x, z)) < 1e-9, `rolling regression at ${x},${z}`);
}

// 2. valley raises the sides well above the centre floor.
configureTerrain({ terrain: { amp: 1, freq: 1, shape: 'valley' } });
assert.ok(terrainHeight(90, 0) - terrainHeight(0, 60) > 15, 'valley walls should tower over the floor');

// 3. crag bumps up near its centre by ~height.
configureTerrain({ terrain: { amp: 1, freq: 1, shape: 'crag', crag: { x: 0, z: 95, height: 20, radius: 26 } } });
assert.ok(terrainHeight(0, 95) - terrainHeight(0, 20) > 15, 'crag should rise ~20 at its centre');

// 4. river carves a channel: a point on the centreline sits ~depth below an off-river point.
configureTerrain({ terrain: { amp: 1, freq: 1 }, river: { path: [{ x: -40, z: 0 }, { x: 40, z: 0 }], width: 7, depth: 3 } });
assert.ok(terrainHeight(0, 0) < terrainHeight(0, 20) - 2, 'river centreline should be carved down');
assert.ok(Math.abs(terrainHeight(0, 20) - oldHeight(0, 20)) < 1e-9, 'off-river terrain unchanged');

console.log('terrain.mjs OK');
