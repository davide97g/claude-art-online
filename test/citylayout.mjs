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

// --- new topologies: each keeps the spawn/gate corridor clear (except the castle) and includes it ---
const common = { palette: ['green', 'red'], types: ['home_A', 'home_B'] };
const inCorridor = (b) => Math.abs(b.x) < 9 && b.z < 14;

const rings = cityLayout({ layout: 'rings', center: { x: 0, z: 46 }, rings: [{ r: 12, count: 7 }, { r: 22, count: 12 }], castle: { type: 'castle', color: 'green', x: 0, z: 46 }, ...common }, mulberry32(1));
assert.ok(rings.some((b) => b.castle), 'rings: castle present');
assert.ok(rings.filter((b) => !b.castle).every((b) => !inCorridor(b)), 'rings: corridor clear');

const cluster = cityLayout({ layout: 'cluster', center: { x: 0, z: 34 }, radius: 15, count: 16, castle: { type: 'castle', color: 'green', x: 0, z: 56 }, ...common }, mulberry32(2));
assert.ok(cluster.filter((b) => !b.castle).every((b) => Math.hypot(b.x, b.z - 34) <= 15 + 1e-9), 'cluster: inside disk');
assert.ok(cluster.filter((b) => !b.castle).every((b) => !inCorridor(b)), 'cluster: corridor clear');

const terr = cityLayout({ layout: 'terraces', rows: [{ z: 28, count: 5, halfWidth: 14 }, { z: 58, count: 4, halfWidth: 9 }], castle: { type: 'castle', color: 'green', x: 0, z: 88 }, jitter: 0, ...common }, mulberry32(3));
assert.equal(terr.filter((b) => !b.castle).length, 9, 'terraces: row counts');

const spiral = cityLayout({ layout: 'spiral', center: { x: 0, z: 64 }, turns: 1.4, count: 11, rMax: 17, castle: { type: 'church', color: 'green', x: 0, z: 82 }, ...common }, mulberry32(4));
assert.equal(spiral.filter((b) => !b.castle).length, 11, 'spiral: count');

const shore = cityLayout({ layout: 'shore', rows: [{ z: 26, count: 8 }, { z: 33, count: 6 }], xRange: [-32, 32], faceZ: 60, castle: { type: 'church', color: 'green', x: 0, z: 20 }, jitter: 0, ...common }, mulberry32(5));
assert.equal(shore.filter((b) => !b.castle).length, 14, 'shore: row counts');
assert.ok(shore.filter((b) => !b.castle).every((b) => Math.abs(b.yaw) < 1e-6), 'shore: all face the lake (+Z)');

console.log('citylayout.mjs OK');
