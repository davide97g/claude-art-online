import assert from 'node:assert/strict';
import { cityLayout } from '../src/world/citylayout.js';

// deterministic rng (same mulberry32 town.js uses)
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const city = {
  spineZ: [16, 82], halfWidth: 11, step: 7, jitter: 2.2,
  palette: ['green', 'red', 'yellow'],
  types: ['home_A', 'home_B', 'tavern'],
  castle: { type: 'castle', color: 'yellow', x: 0, z: 95 },
};
const out = cityLayout(city, mulberry32(1337));

// z-steps 16,23,...,79 = 10 rows; 2 sides x 2 depth-rows = 4 per step = 40 + 1 castle
const steps = Math.floor((82 - 16) / 7) + 1;
assert.equal(out.length, steps * 4 + 1, 'building count');

const castle = out.find((b) => b.castle);
assert.ok(castle && castle.x === 0 && castle.z === 95, 'castle on the crag');

for (const b of out) {
  if (b.castle) continue;
  assert.ok(Math.abs(b.x) >= 11 - 2.2 && Math.abs(b.x) <= 19 + 2.2, `x in tenement rows: ${b.x}`);
  assert.ok(b.z >= 16 - 2.2 && b.z <= 82 + 2.2, `z on the spine: ${b.z}`);
  // +x side faces -x (yaw < 0), -x side faces +x (yaw > 0)
  assert.ok(b.x > 0 ? b.yaw < 0 : b.yaw > 0, 'faces the street');
  assert.ok(city.types.includes(b.type) && city.palette.includes(b.color), 'valid type/color');
}

console.log('citylayout.mjs OK');
