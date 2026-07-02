// Per-floor biome configs. A biome is DATA, not a code fork: floor.js, town.js and
// main.js read these to build terrain, lighting, weather, settlements, ruins and
// named places. Add a floor by adding a config — no new code paths.

export const BIOMES = [
  { // ---------- Floor 1: Verdant Town (the existing world, unchanged) ----------
    id: 1,
    name: 'Verdant Town',
    place0: 'Starting town outskirts',
    background: 0x9dc2ec,
    fog: { color: 0x9db8d9, near: 60, far: 175 },
    hemi: { sky: 0xcfe5ff, ground: 0x5b7a4a, intensity: 0.95 },
    sun: { color: 0xfff1d6, intensity: 1.25, pos: [60, 90, 30] },
    terrain: { lo: 0x4e8c4a, hi: 0x8cc063, amp: 1.0, freq: 1.0 },
    sky: { ceiling: 0x7e94b5, core: 0x93a7c4 },
    tint: null,
    enemyTint: null,
    weather: null,
    trees: [
      { path: 'decoration/nature/tree_single_A', count: 120, sMin: 0.8, sMax: 1.5 },
      { path: 'decoration/nature/tree_single_B', count: 100, sMin: 0.8, sMax: 1.5 },
      { path: 'decoration/nature/trees_A_large', count: 18, sMin: 0.9, sMax: 1.3 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 40, sMin: 2, sMax: 6 },
      { path: 'decoration/nature/rock_single_C', count: 25, sMin: 2, sMax: 5 },
    ],
    mountains: ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees',
      'hills_A_trees', 'hills_B_trees', 'hills_C_trees'],
    clouds: 6,
    settlement: [
      ['church', 'green', -24, 27], ['tower_A', 'red', 0, 52], ['tavern', 'yellow', 23, 14],
      ['market', 'red', 15, 8], ['blacksmith', 'green', -18, 10], ['well', 'green', -6, 20],
      ['home_A', 'red', -12, 25], ['home_B', 'yellow', -23, 39], ['home_A', 'green', 13, 27],
      ['home_B', 'red', 21, 35], ['home_A', 'yellow', -31, 21], ['home_B', 'green', 27, 24],
      ['windmill', 'green', 33, 43], ['watermill', 'yellow', -34, 44], ['barracks', 'red', -17, 48],
    ],
    props: [
      ['barrel', -16, 12], ['barrel', -19, 13], ['bucket_water', -7, 17], ['sack', 2, 24],
      ['sack', -3, 26], ['crate_A_big', 13, 11], ['crate_B_small', 16, 10], ['crate_open', 12, 6],
      ['weaponrack', -15, 46], ['target', -20, 49], ['wheelbarrow', 5, 18], ['tent', 29, 30],
      ['tent', -29, 33], ['resource_lumber', -36, 47], ['resource_stone', 36, 40], ['ladder', 25, 20],
    ],
    flags: true,
    ruins: [],
    places: [
      { name: 'Town of Beginnings', x: 0, z: 22, r: 24 },
      { name: 'Elderwood Edge', x: 0, z: 72, r: 26 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [
      { type: 'dummy', x: 5, z: -9 }, { type: 'dummy', x: -7, z: -14 },
      { type: 'golem', x: 14, z: -28 }, { type: 'golem', x: -18, z: -42 },
      { type: 'golem', x: 8, z: -66 }, { type: 'golem', x: -10, z: -88 },
      { type: 'golem', x: 20, z: -102 },
    ],
    boss: { x: 0, z: -112 }, // Rendfang guards the gate; floors without this field stay sealed-only
  },

  { // ---------- Floor 2: Frostbound (snowfield) ----------
    id: 2,
    name: 'Frostbound',
    place0: 'The frozen reaches',
    background: 0xcdd9e8,
    fog: { color: 0xbcccdd, near: 45, far: 150 },
    hemi: { sky: 0xdfeaf5, ground: 0x8a97a5, intensity: 0.85 },
    sun: { color: 0xd6e2f0, intensity: 0.9, pos: [40, 80, 40] },
    terrain: { lo: 0x9fb2c4, hi: 0xeaf1f7, amp: 1.3, freq: 1.0 },
    sky: { ceiling: 0x9fb0c4, core: 0xb8c6d8 },
    tint: 0xcfd8e2,
    enemyTint: 0x9fc4e0,
    weather: 'snow',
    trees: [
      { path: 'decoration/nature/tree_single_A_cut', count: 40, sMin: 0.8, sMax: 1.3 },
      { path: 'decoration/nature/tree_single_B_cut', count: 30, sMin: 0.8, sMax: 1.3 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 55, sMin: 2, sMax: 6 },
      { path: 'decoration/nature/rock_single_C', count: 35, sMin: 2, sMax: 5 },
    ],
    mountains: ['mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_B', 'hills_C'],
    clouds: 4,
    settlement: [
      ['home_A', 'red', 10, 30], ['home_B', 'green', -12, 34], ['tavern', 'yellow', 18, 42],
      ['well', 'green', -4, 26], ['church', 'green', -20, 46],
    ],
    props: [
      ['barrel', 8, 28], ['crate_A_big', -10, 30], ['tent', 20, 38], ['resource_lumber', -18, 42],
    ],
    flags: false,
    ruins: [
      { name: 'tower-square-base', x: 34, z: -6 }, { name: 'wall', x: 37, z: -4 },
      { name: 'wall-corner', x: 38, z: -9 }, { name: 'wall-half', x: 31, z: -8 },
      { name: 'gate', x: 34, z: -2 }, { name: 'siege-catapult-demolished', x: 29, z: -5 },
      { name: 'tower-square-base', x: -40, z: -20 }, { name: 'wall', x: -36, z: -24 },
    ],
    places: [
      { name: 'Frosthollow', x: 6, z: 34, r: 26 },
      { name: 'The Frozen Wastes', x: 0, z: -40, r: 34 },
      { name: 'Rime Ruins', x: 36, z: -6, r: 22 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [
      { type: 'golem', x: 12, z: -22 }, { type: 'golem', x: -16, z: -40 },
      { type: 'golem', x: 6, z: -64 }, { type: 'golem', x: -8, z: -90 },
      { type: 'golem', x: 22, z: -104 }, { type: 'golem', x: -24, z: -70 },
    ],
  },

  { // ---------- Floor 3: Storm Peaks ----------
    id: 3,
    name: 'Storm Peaks',
    place0: 'Windswept sunset heights',
    background: 0xe8804a,
    fog: { color: 0xd98a5e, near: 40, far: 150 },
    hemi: { sky: 0xffb27a, ground: 0x4a2f3e, intensity: 0.8 },
    sun: { color: 0xff7a3c, intensity: 1.45, pos: [95, 26, 30] }, // low on the horizon = long dramatic sunset shadows
    terrain: { lo: 0x5a3a48, hi: 0xc9794a, amp: 2.6, freq: 1.6 }, // dusky-purple shadow → orange sunlit rock
    sky: { ceiling: 0xd47a52, core: 0xf0a860 },
    tint: 0xe0955f,       // warm sunset wash over buildings/ruins/trees/mountains
    enemyTint: 0x8a5f66,  // dusky mauve golems — read against the warm ground
    weather: 'wind',
    trees: [
      { path: 'decoration/nature/tree_single_A_cut', count: 24, sMin: 0.7, sMax: 1.1 },
      { path: 'decoration/nature/tree_single_B_cut', count: 20, sMin: 0.7, sMax: 1.1 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 60, sMin: 2, sMax: 7 },
      { path: 'decoration/nature/rock_single_C', count: 40, sMin: 2, sMax: 6 },
    ],
    mountains: ['mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_B', 'hills_C'],
    clouds: 8,
    settlement: [
      ['tower_A', 'red', 8, 32], ['barracks', 'green', -14, 36], ['home_A', 'red', 16, 40],
      ['well', 'green', -4, 28],
    ],
    props: [
      ['weaponrack', 6, 30], ['target', -10, 34], ['crate_A_big', 14, 38], ['barrel', -6, 30],
    ],
    flags: false,
    ruins: [ // mostly ruins on the top floor
      { name: 'tower-square-base', x: 30, z: -6 }, { name: 'wall', x: 33, z: -4 },
      { name: 'wall-corner', x: 34, z: -10 }, { name: 'wall-doorway', x: 27, z: -9 },
      { name: 'gate', x: 30, z: -2 }, { name: 'siege-tower-demolished', x: 25, z: -7 },
      { name: 'wall', x: -32, z: -18 }, { name: 'tower-square-base', x: -36, z: -22 },
      { name: 'wall-corner', x: -28, z: -14 }, { name: 'siege-catapult-demolished', x: 8, z: -56 },
      { name: 'wall', x: -10, z: -78 }, { name: 'wall-half', x: 18, z: -94 },
      { name: 'tower-square-base', x: 24, z: -108 }, { name: 'gate', x: 0, z: -70 },
    ],
    places: [
      { name: 'Stormwatch', x: 6, z: 34, r: 24 },
      { name: 'The Howling Reach', x: 0, z: -44, r: 36 },
      { name: 'The Fallen Bastion', x: 30, z: -8, r: 24 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [
      { type: 'golem', x: 12, z: -24 }, { type: 'golem', x: -16, z: -44 },
      { type: 'golem', x: 8, z: -68 }, { type: 'golem', x: -10, z: -92 },
      { type: 'golem', x: 22, z: -106 }, { type: 'golem', x: -26, z: -74 },
      { type: 'golem', x: 30, z: -50 },
    ],
  },

  { // ---------- Floor 4: The Elderwood (deep ancient forest) ----------
    id: 4,
    name: 'The Elderwood',
    place0: 'Heart of the ancient wood',
    background: 0x2f4a3a,
    fog: { color: 0x35513f, near: 26, far: 105 },
    hemi: { sky: 0x9fc7a0, ground: 0x24301f, intensity: 0.7 },
    sun: { color: 0xffe6a8, intensity: 0.95, pos: [50, 70, -40] },
    terrain: { lo: 0x2c3d24, hi: 0x5f8544, amp: 1.6, freq: 1.2, shape: 'valley' },
    sky: { ceiling: 0x3a5240, core: 0x557a4f },
    tint: 0x8fae86,
    enemyTint: 0x6f9e5a,
    weather: 'pollen',
    // Path stays inside the flat valley floor (|x|<28) and clear of the combat lane (|x|<9, z<14) so the
    // flat water level (-0.6) sits in the carved channel everywhere. Straying onto the valley walls (the
    // 'valley' shape adds up to +22 at |x|=90) would lift the ground above the water and bury the river.
    river: { path: [{ x: -5, z: 46 }, { x: -11, z: 22 }, { x: -15, z: -6 }, { x: -15, z: -28 }, { x: -13, z: -46 }], width: 7, depth: 3, level: -0.6, color: 0x3f6b6a },
    trees: [
      { path: 'decoration/nature/trees_A_large', count: 40, sMin: 1.0, sMax: 1.6 },
      { path: 'decoration/nature/trees_B_large', count: 40, sMin: 1.0, sMax: 1.6 },
      { path: 'decoration/nature/trees_A_medium', count: 55, sMin: 0.9, sMax: 1.4 },
      { path: 'decoration/nature/trees_B_medium', count: 55, sMin: 0.9, sMax: 1.4 },
      { path: 'decoration/nature/tree_single_A', count: 45, sMin: 0.8, sMax: 1.3 },
      { path: 'decoration/nature/tree_single_B', count: 45, sMin: 0.8, sMax: 1.3 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 30, sMin: 2, sMax: 6 },
      { path: 'decoration/nature/rock_single_C', count: 25, sMin: 2, sMax: 5 },
    ],
    mountains: ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees', 'hills_A_trees', 'hills_B_trees'],
    clouds: 3,
    settlement: [ // small overgrown woodcutter's camp
      ['lumbermill', 'green', 10, 30], ['home_A', 'green', -12, 34], ['home_B', 'green', 16, 40], ['well', 'green', 0, 30],
    ],
    props: [
      ['crate_A_big', 6, 28], ['barrel', -6, 32], ['resource_lumber', 14, 34], ['weaponrack', -10, 30],
    ],
    flags: false,
    ruins: [
      { name: 'wall', x: -30, z: -18 }, { name: 'wall-corner', x: -34, z: -22 }, { name: 'wall-half', x: 22, z: -60 },
    ],
    places: [
      { name: 'The Elderwood', x: 0, z: 30, r: 26 },
      { name: 'Mistfen Hollow', x: 0, z: -44, r: 34 },
      { name: 'The Old River', x: -15, z: -12, r: 24 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [
      { type: 'golem', x: 12, z: -24 }, { type: 'golem', x: -16, z: -44 },
      { type: 'golem', x: 8, z: -68 }, { type: 'golem', x: -10, z: -92 },
      { type: 'golem', x: 22, z: -104 }, { type: 'golem', x: -24, z: -70 },
    ],
  },

  { // ---------- Floor 5: Craghold (Edinburgh-inspired medieval city) ----------
    id: 5,
    name: 'Craghold',
    place0: 'Gates of the high city',
    background: 0x9fc8ea,
    fog: { color: 0xbcd4ea, near: 70, far: 220 },
    hemi: { sky: 0xdcecff, ground: 0x6b6152, intensity: 1.0 },
    sun: { color: 0xfff3d6, intensity: 1.3, pos: [70, 95, 40] },
    terrain: { lo: 0x6f6656, hi: 0xb8ae95, amp: 1.0, freq: 1.0, shape: 'crag', crag: { x: 0, z: 95, height: 20, radius: 26 } },
    sky: { ceiling: 0x8aa6c8, core: 0xa8c0dc },
    tint: null,
    enemyTint: 0x9aa0a8,
    weather: null,
    trees: [
      { path: 'decoration/nature/tree_single_A', count: 12, sMin: 0.8, sMax: 1.2 },
      { path: 'decoration/nature/tree_single_B', count: 10, sMin: 0.8, sMax: 1.2 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 10, sMin: 3, sMax: 7 },
      { path: 'decoration/nature/rock_single_B', count: 8, sMin: 3, sMax: 6 },
    ],
    mountains: ['mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_B'],
    clouds: 5,
    city: {
      spineZ: [16, 82], halfWidth: 11, step: 7, jitter: 2.2,
      palette: ['green', 'red', 'yellow'],
      types: ['home_A', 'home_B', 'tavern', 'market', 'blacksmith', 'church', 'barracks', 'tower_A', 'tower_B'],
      castle: { type: 'castle', color: 'yellow', x: 0, z: 95 },
    },
    settlement: [],
    props: [
      ['crate_A_big', 5, 24], ['barrel', -5, 26], ['weaponrack', 6, 50], ['target', -7, 54], ['crate_open', 0, 20],
    ],
    flags: 'spine',
    ruins: [],
    places: [
      { name: 'Grassmarket', x: 0, z: 22, r: 22 },
      { name: 'The Royal Mile', x: 0, z: 50, r: 30 },
      { name: 'Castle Rock', x: 0, z: 95, r: 26 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [
      { type: 'golem', x: 12, z: -24 }, { type: 'golem', x: -16, z: -44 },
      { type: 'golem', x: 8, z: -68 }, { type: 'golem', x: -10, z: -92 },
      { type: 'golem', x: 22, z: -104 }, { type: 'golem', x: -24, z: -70 },
    ],
  },
];

// Parse ?level=N (1..5), clamp, return the biome. Defaults to Floor 1.
export function getBiome(param) {
  const n = Math.min(BIOMES.length, Math.max(1, parseInt(param, 10) || 1));
  return BIOMES[n - 1];
}
