import assert from 'node:assert/strict';
import { BIOMES, getBiome } from '../src/world/biomes.js';

assert.equal(BIOMES.length, 5, 'expected 5 floors');
assert.equal(getBiome('4').id, 4);
assert.equal(getBiome('5').id, 5);
assert.equal(getBiome('0').id, 1, 'clamp low');
assert.equal(getBiome('9').id, 5, 'clamp high');
assert.equal(getBiome(null).id, 1, 'default');

const f4 = getBiome('4');
assert.equal(f4.terrain.shape, 'valley');
assert.ok(f4.river && Array.isArray(f4.river.path) && f4.river.path.length >= 2, 'floor 4 has a river path');
assert.ok(f4.trees.length >= 4, 'floor 4 forest is dense / multi-species');

const f5 = getBiome('5');
assert.equal(f5.terrain.shape, 'crag');
assert.ok(f5.terrain.crag && f5.city && f5.city.castle, 'floor 5 has a crag + city + castle');

console.log('biomes.mjs OK');
