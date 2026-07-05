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
      // frenzy boars: the floor-1 grind, roaming the fields flanking the gate road
      { type: 'boar', x: -20, z: -16 }, { type: 'boar', x: 24, z: -18 },
      { type: 'boar', x: -30, z: -32 }, { type: 'boar', x: 32, z: -36 },
      { type: 'boar', x: 6, z: -44 }, { type: 'boar', x: -14, z: -54 },
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
    boss: { x: 0, z: -112 },
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
    boss: { x: 0, z: -112 },
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
    boss: { x: 0, z: -112 },
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

  { // ---------- Floor 6: Cliffhold (Civita di Bagnoregio — cliff village adrift in fog) ----------
    id: 6,
    name: 'Cliffhold',
    place0: 'The village on the cloud-bridge',
    background: 0xd9cdb8,
    fog: { color: 0xd7ccbb, near: 22, far: 80 }, // fog cranked hard → the floating-in-cloud look
    hemi: { sky: 0xe8dcc6, ground: 0x6a5c46, intensity: 0.9 },
    sun: { color: 0xfff0d2, intensity: 1.0, pos: [50, 70, 30] },
    terrain: { lo: 0x8f7a55, hi: 0xd8b98a, amp: 1.2, freq: 1.1, shape: 'crag', crag: { x: 0, z: 92, height: 26, radius: 18 } },
    sky: { ceiling: 0xcabfa8, core: 0xd7ccb6 },
    tint: 0xd8b98a,        // warm tufa-stone wash
    enemyTint: null,
    weather: null,
    npc: 5,                // remote, near-empty — a handful of villagers by the bridge
    trees: [
      { path: 'decoration/nature/tree_single_A', count: 18, sMin: 0.7, sMax: 1.1 },
      { path: 'decoration/nature/tree_single_B', count: 14, sMin: 0.7, sMax: 1.1 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 45, sMin: 2, sMax: 7 },
      { path: 'decoration/nature/rock_single_D', count: 30, sMin: 2, sMax: 6 },
    ],
    mountains: ['mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_B'],
    clouds: 9,
    npcRoster: ['oldclassy_male', 'oldclassy_female', 'worker_male', 'rpg_monk', 'witch'], // remote elders + a hermit-mystic
    city: { // organic cluster packed onto the crag plateau (rising z rides the cliff-top)
      layout: 'cluster', center: { x: 0, z: 90 }, radius: 13, count: 11,
      palette: ['yellow', 'yellow', 'red'],
      types: ['home_A', 'home_B', 'tavern', 'well', 'market', 'blacksmith'],
      castle: { type: 'church', color: 'yellow', x: 0, z: 96 },
    },
    settlement: [],
    props: [
      ['barrel', 2, 84], ['crate_A_big', -6, 86], ['sack', 5, 88], ['ladder', -9, 90],
    ],
    flags: false,
    ruins: [
      { name: 'wall', x: 14, z: 78 }, { name: 'wall-half', x: -16, z: 76 }, { name: 'tower-square-base', x: 18, z: 82 },
    ],
    places: [
      { name: 'The Cloud-Bridge', x: 0, z: 24, r: 24 },
      { name: 'Cliffhold', x: 0, z: 90, r: 26 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [], // peaceful hidden hub — no combat
  },

  { // ---------- Floor 7: The Bastion (Carcassonne — double-walled fortress capital at war) ----------
    id: 7,
    name: 'The Bastion',
    place0: 'Before the double walls',
    background: 0xa8b0bc,
    fog: { color: 0xaeb6c2, near: 55, far: 190 },
    hemi: { sky: 0xd2dae6, ground: 0x6b5f52, intensity: 0.95 },
    sun: { color: 0xffeccb, intensity: 1.2, pos: [70, 80, 20] },
    terrain: { lo: 0x736a58, hi: 0xbcae94, amp: 1.0, freq: 1.0, shape: 'crag', crag: { x: 0, z: 50, height: 12, radius: 34 } }, // city on a low hill
    sky: { ceiling: 0x93a2b6, core: 0xb0bccd },
    tint: null,
    enemyTint: 0x8f7f6a,
    weather: 'wind',
    trees: [
      { path: 'decoration/nature/tree_single_A', count: 10, sMin: 0.8, sMax: 1.2 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 20, sMin: 2, sMax: 6 },
      { path: 'decoration/nature/rock_single_B', count: 14, sMin: 2, sMax: 5 },
    ],
    mountains: ['mountain_A', 'mountain_B', 'hills_A', 'hills_B', 'hills_C'],
    clouds: 6,
    npcRoster: ['knight_male', 'knight_golden_female', 'rpg_warrior', 'viking_male', 'worker_male', 'worker_female', 'rpg_rogue', 'oldclassy_male'], // a war-time garrison capital
    city: { // dense wards in concentric rings inside the double walls; NPC crowd defaults to 34
      layout: 'rings', center: { x: 0, z: 46 }, radius: 30,
      rings: [{ r: 12, count: 7 }, { r: 22, count: 12 }, { r: 32, count: 16 }],
      palette: ['red', 'yellow', 'green'],
      types: ['home_A', 'home_B', 'barracks', 'tower_A', 'tower_B', 'church', 'market', 'tavern', 'blacksmith'],
      castle: { type: 'castle', color: 'red', x: 0, z: 46 },
    },
    settlement: [],
    props: [
      ['weaponrack', 6, 24], ['target', -7, 26], ['bucket_arrows', 8, 30], ['tent', -10, 22],
      ['crate_A_big', 5, 50], ['barrel', -5, 52], ['pallet', 0, 40],
    ],
    flags: 'spine',
    ruins: [ // two concentric curtain-wall rings around the city — besieged, tilted, war-time
      // inner ring (r≈34), with a wall-doorway you enter through at the front
      { name: 'wall', x: 0, z: 84 }, { name: 'tower-square-base', x: 24, z: 74 }, { name: 'wall', x: 30, z: 58 },
      { name: 'wall-corner', x: 34, z: 40 }, { name: 'wall', x: 30, z: 22 }, { name: 'wall-doorway', x: 20, z: 8 },
      { name: 'tower-square-base', x: -24, z: 74 }, { name: 'wall', x: -30, z: 58 }, { name: 'wall-corner', x: -34, z: 40 },
      { name: 'wall', x: -30, z: 22 }, { name: 'wall-doorway', x: -20, z: 8 },
      // outer ring (r≈50)
      { name: 'wall', x: 0, z: 100 }, { name: 'tower-square-base', x: 38, z: 86 }, { name: 'wall', x: 46, z: 62 },
      { name: 'wall-corner', x: 50, z: 40 }, { name: 'wall', x: 46, z: 18 }, { name: 'tower-square-base', x: 36, z: -2 },
      { name: 'wall', x: -38, z: 86 }, { name: 'wall-corner', x: -50, z: 40 }, { name: 'wall', x: -46, z: 18 },
      { name: 'tower-square-base', x: -36, z: -2 },
    ],
    places: [
      { name: 'The Outer Ward', x: 0, z: 20, r: 24 },
      { name: 'The Bastion', x: 0, z: 55, r: 30 },
      { name: 'The Keep', x: 0, z: 72, r: 22 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [ // heavy — a besieging force down the gate road
      { type: 'golem', x: 10, z: -20 }, { type: 'golem', x: -14, z: -34 }, { type: 'golem', x: 8, z: -52 },
      { type: 'golem', x: -10, z: -70 }, { type: 'golem', x: 20, z: -86 }, { type: 'golem', x: -22, z: -60 },
      { type: 'golem', x: 24, z: -104 }, { type: 'golem', x: -8, z: -100 }, { type: 'golem', x: 0, z: -44 },
    ],
  },

  { // ---------- Floor 8: Rivenbend (Český Krumlov — river horseshoe wraps the town, castle above) ----------
    id: 8,
    name: 'Rivenbend',
    place0: 'Within the river bend',
    background: 0xa9c6e0,
    fog: { color: 0xbcd2e4, near: 55, far: 180 },
    hemi: { sky: 0xd8e8fa, ground: 0x6a5a44, intensity: 0.98 },
    sun: { color: 0xfff2d8, intensity: 1.25, pos: [55, 85, 35] },
    terrain: { lo: 0x5f7a4a, hi: 0xa89060, amp: 1.1, freq: 1.1 },
    sky: { ceiling: 0x88a6c6, core: 0xa6c2dc },
    tint: 0xd9a86a,        // warm terracotta-roof wash
    enemyTint: 0x9a8a6a,
    weather: null,
    npc: 14,
    // U-shaped river wrapping the town (z16..58) on left/top/right, open at the front (z<10) so the
    // player enters the arm without wading. Path stays clear of the combat lane (|x|<9, z<14).
    river: { path: [{ x: -24, z: 6 }, { x: -26, z: 26 }, { x: -22, z: 48 }, { x: 0, z: 62 }, { x: 22, z: 48 }, { x: 26, z: 26 }, { x: 24, z: 6 }], width: 8, depth: 3, level: -0.5, color: 0x3f6b8a },
    trees: [
      { path: 'decoration/nature/tree_single_A', count: 40, sMin: 0.8, sMax: 1.4 },
      { path: 'decoration/nature/tree_single_B', count: 34, sMin: 0.8, sMax: 1.4 },
      { path: 'decoration/nature/trees_A_medium', count: 20, sMin: 0.9, sMax: 1.3 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 24, sMin: 2, sMax: 5 },
      { path: 'decoration/nature/rock_single_C', count: 18, sMin: 2, sMax: 5 },
    ],
    mountains: ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'hills_A_trees', 'hills_B_trees', 'hills_C_trees'],
    clouds: 5,
    npcRoster: ['worker_male', 'worker_female', 'casual_male', 'casual_female', 'chef_male', 'oldclassy_female'], // lively riverside townsfolk
    city: { // old town packed organically inside the river's arm, castle on the back rise
      layout: 'cluster', center: { x: 0, z: 34 }, radius: 15, count: 16,
      palette: ['red', 'yellow', 'green'],
      types: ['home_A', 'home_B', 'tavern', 'market', 'blacksmith', 'church', 'watermill'],
      castle: { type: 'castle', color: 'red', x: 0, z: 56 },
    },
    settlement: [],
    props: [
      ['barrel', -6, 24], ['crate_A_big', 8, 22], ['sack', -10, 20], ['wheelbarrow', 4, 30],
      ['bucket_water', 12, 34], ['crate_open', -13, 28],
    ],
    flags: false,
    ruins: [
      { name: 'wall', x: -28, z: -10 }, { name: 'wall-corner', x: -32, z: -14 }, { name: 'tower-square-base', x: 30, z: -8 },
    ],
    places: [
      { name: 'The River Gate', x: 0, z: 18, r: 22 },
      { name: 'Rivenbend Town', x: 0, z: 34, r: 26 },
      { name: 'Castle on the Bend', x: 0, z: 58, r: 24 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [ // light
      { type: 'golem', x: 12, z: -26 }, { type: 'golem', x: -16, z: -46 }, { type: 'golem', x: 8, z: -70 },
      { type: 'golem', x: -10, z: -94 }, { type: 'golem', x: 20, z: -108 },
    ],
  },

  { // ---------- Floor 9: The Silent City (Mdina — golden hilltop, tight alleys, near-empty) ----------
    id: 9,
    name: 'The Silent City',
    place0: 'Gates of the noble town',
    background: 0xd8c9a0,
    fog: { color: 0xd6c9a4, near: 45, far: 150 },
    hemi: { sky: 0xeaddb8, ground: 0x7a6a4a, intensity: 0.9 },
    sun: { color: 0xfff0c8, intensity: 1.15, pos: [60, 82, 30] },
    terrain: { lo: 0x8a7a54, hi: 0xe0c088, amp: 0.9, freq: 1.0, shape: 'crag', crag: { x: 0, z: 50, height: 10, radius: 30 } },
    sky: { ceiling: 0xc9ba90, core: 0xd8c9a0 },
    tint: 0xe0c088,        // honey-limestone wash
    enemyTint: null,
    weather: null,         // still, silent air
    npc: 7,                // override the dense city default — the city stays "silent"
    trees: [
      { path: 'decoration/nature/tree_single_A', count: 8, sMin: 0.7, sMax: 1.0 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 16, sMin: 2, sMax: 5 },
      { path: 'decoration/nature/rock_single_B', count: 12, sMin: 2, sMax: 5 },
    ],
    mountains: ['mountain_A', 'mountain_B', 'hills_A', 'hills_B'],
    clouds: 3,
    npcRoster: ['oldclassy_male', 'oldclassy_female', 'kimono_female', 'rpg_cleric', 'rpg_monk'], // nobles + silent clergy
    city: { // tight concentric rings = narrow winding alleys around the cathedral
      layout: 'rings', center: { x: 0, z: 42 }, radius: 24,
      rings: [{ r: 9, count: 6 }, { r: 17, count: 10 }, { r: 25, count: 12 }],
      palette: ['yellow', 'yellow', 'red'], // mostly honey stone
      types: ['home_A', 'home_B', 'tavern', 'market', 'blacksmith', 'tower_A'],
      castle: { type: 'church', color: 'yellow', x: 0, z: 42 },
    },
    settlement: [],
    props: [
      ['barrel', 4, 20], ['sack', -5, 22], ['crate_B_small', 6, 30], ['bucket_water', -6, 28],
    ],
    flags: false,
    ruins: [ // bastion wall ring
      { name: 'wall', x: 28, z: 30 }, { name: 'wall-corner', x: 30, z: 12 }, { name: 'tower-square-base', x: 26, z: 46 },
      { name: 'wall', x: -28, z: 30 }, { name: 'wall-corner', x: -30, z: 12 }, { name: 'tower-square-base', x: -26, z: 46 },
      { name: 'wall-doorway', x: 0, z: 8 },
    ],
    places: [
      { name: 'The City Gate', x: 0, z: 16, r: 20 },
      { name: 'The Silent City', x: 0, z: 40, r: 28 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [], // peaceful — a still, watchful hub
  },

  { // ---------- Floor 10: Sanctuary Rise (Rocamadour — vertical holy city stacked up a cliff) ----------
    id: 10,
    name: 'Sanctuary Rise',
    place0: 'Foot of the holy stair',
    background: 0xbcc6d2,
    fog: { color: 0xc2ccd8, near: 40, far: 150 },
    hemi: { sky: 0xdce6f2, ground: 0x6e6656, intensity: 0.95 },
    sun: { color: 0xfff0d8, intensity: 1.2, pos: [40, 80, 45] },
    terrain: { lo: 0x776a54, hi: 0xcbb892, amp: 1.0, freq: 1.0, shape: 'crag', crag: { x: 0, z: 88, height: 30, radius: 22 } }, // steep = vertical layers
    sky: { ceiling: 0x9fb0c4, core: 0xbcc8d6 },
    tint: 0xcbb892,        // pale limestone wash
    enemyTint: 0x8f8470,
    weather: null,
    npc: 12,
    trees: [
      { path: 'decoration/nature/tree_single_A', count: 14, sMin: 0.7, sMax: 1.1 },
      { path: 'decoration/nature/tree_single_B', count: 12, sMin: 0.7, sMax: 1.1 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 40, sMin: 3, sMax: 8 },
      { path: 'decoration/nature/rock_single_D', count: 26, sMin: 2, sMax: 6 },
    ],
    mountains: ['mountain_A', 'mountain_B', 'mountain_C', 'hills_A', 'hills_B'],
    clouds: 5,
    npcRoster: ['rpg_cleric', 'rpg_monk', 'wizard', 'oldclassy_male', 'worker_female', 'elf'], // pilgrims + clergy
    city: { // flat rows climbing the crag → three stacked tiers (crag terrain lifts each row)
      layout: 'terraces', center: { x: 0, z: 50 }, radius: 24,
      rows: [
        { z: 28, count: 5, halfWidth: 14 }, { z: 42, count: 5, halfWidth: 12 },
        { z: 58, count: 4, halfWidth: 9 }, { z: 72, count: 3, halfWidth: 6 },
      ],
      palette: ['yellow', 'yellow', 'red'],
      types: ['home_A', 'home_B', 'tavern', 'market', 'church'],
      castle: { type: 'castle', color: 'yellow', x: 0, z: 88 }, // château at the apex
    },
    settlement: [],
    props: [
      ['barrel', -6, 24], ['sack', 6, 26], ['ladder', -8, 40], ['crate_A_big', 8, 50], ['bucket_water', 0, 30],
    ],
    flags: 'spine',
    ruins: [
      { name: 'wall', x: -14, z: 44 }, { name: 'wall-half', x: 14, z: 46 }, { name: 'tower-square-base', x: -16, z: 66 },
    ],
    places: [
      { name: 'The Holy Stair', x: 0, z: 24, r: 22 },
      { name: 'The Sanctuary', x: 0, z: 58, r: 24 },
      { name: 'The High Château', x: 0, z: 88, r: 22 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [ // light
      { type: 'golem', x: 12, z: -26 }, { type: 'golem', x: -16, z: -46 }, { type: 'golem', x: 8, z: -70 },
      { type: 'golem', x: -10, z: -94 }, { type: 'golem', x: 20, z: -108 },
    ],
  },

  { // ---------- Floor 11: Tidewatch Abbey (Mont-Saint-Michel — tidal island, abbey capstone, boss) ----------
    id: 11,
    name: 'Tidewatch Abbey',
    place0: 'The tidal causeway',
    background: 0x8fa4bc,
    fog: { color: 0x93a8c0, near: 40, far: 165 },
    hemi: { sky: 0xc2d4e8, ground: 0x5a6472, intensity: 0.85 },
    sun: { color: 0xe6eef8, intensity: 1.0, pos: [60, 70, -30] },
    terrain: { lo: 0x5a6472, hi: 0xaab6c4, amp: 1.0, freq: 1.0, shape: 'crag', crag: { x: 0, z: 80, height: 30, radius: 22 } }, // pyramidal island
    sky: { ceiling: 0x7e94ac, core: 0x9aafc6 },
    tint: 0x9fb0c4,        // cool grey-blue stone wash
    enemyTint: 0x6f7a86,
    weather: 'rain',       // drama + lightning flashes = final-castle mood
    npc: 12,
    // wide ring of water around the island base = the tide/moat (no water plane exists; a fat ring is
    // the stand-in). Shallow (depth 2) so the player wades the flats to reach the island. Front at z~34.
    river: { path: [{ x: 0, z: 100 }, { x: 28, z: 86 }, { x: 36, z: 62 }, { x: 28, z: 40 }, { x: 0, z: 34 }, { x: -28, z: 40 }, { x: -36, z: 62 }, { x: -28, z: 86 }, { x: 0, z: 100 }], width: 14, depth: 2, level: -0.8, color: 0x35506b },
    trees: [
      { path: 'decoration/nature/tree_single_A', count: 6, sMin: 0.6, sMax: 0.9 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 30, sMin: 2, sMax: 7 },
      { path: 'decoration/nature/rock_single_C', count: 20, sMin: 2, sMax: 6 },
    ],
    mountains: ['mountain_A', 'mountain_B', 'hills_A', 'hills_B'],
    clouds: 7,
    npcRoster: ['rpg_monk', 'rpg_cleric', 'knight_male', 'rpg_warrior', 'wizard', 'oldclassy_female'], // abbey monks + guardian knights
    city: { // village winding up the cone to the abbey at the apex
      layout: 'spiral', center: { x: 0, z: 64 }, radius: 18, turns: 1.4, count: 11, rMax: 17, rMin: 3,
      palette: ['green', 'green', 'yellow'],
      types: ['home_A', 'home_B', 'tavern', 'market', 'tower_A'],
      castle: { type: 'church', color: 'green', x: 0, z: 82 }, // the abbey
    },
    settlement: [],
    props: [
      ['barrel', -6, 44], ['crate_A_big', 6, 46], ['sack', -8, 54], ['ladder', 8, 60],
    ],
    flags: 'spine',
    ruins: [ // ramparts at the island base
      { name: 'wall', x: -18, z: 40 }, { name: 'wall-corner', x: -22, z: 44 }, { name: 'wall', x: 18, z: 40 },
      { name: 'wall-corner', x: 22, z: 44 }, { name: 'tower-square-base', x: 0, z: 38 },
    ],
    places: [
      { name: 'The Causeway', x: 0, z: 20, r: 22 },
      { name: 'The Tidal Village', x: 0, z: 58, r: 24 },
      { name: 'Tidewatch Abbey', x: 0, z: 82, r: 22 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [ // heavy — fought up the island toward the abbey (+Z), starting past the causeway
      { type: 'golem', x: -12, z: 32 }, { type: 'golem', x: 12, z: 34 }, { type: 'golem', x: 0, z: 42 },
      { type: 'golem', x: -14, z: 46 }, { type: 'golem', x: 14, z: 48 }, { type: 'golem', x: -8, z: 58 },
      { type: 'golem', x: 8, z: 60 }, { type: 'golem', x: 0, z: 68 },
    ],
    boss: { x: 0, z: 78 }, // the abbey's guardian — reuses the Kobold Lord; opens the forward portal on death
  },

  { // ---------- Floor 12: Stillmere (Hallstatt — alpine lake village, slice-of-life calm) ----------
    id: 12,
    name: 'Stillmere',
    place0: 'The lakeside hamlet',
    background: 0xbfd4e2,
    fog: { color: 0xc8dae6, near: 50, far: 175 },
    hemi: { sky: 0xdcecf6, ground: 0x5c6a5a, intensity: 0.95 },
    sun: { color: 0xfff2e0, intensity: 1.1, pos: [45, 80, 40] },
    terrain: { lo: 0x5a7458, hi: 0x9fb0a0, amp: 1.4, freq: 1.2 },
    sky: { ceiling: 0x9fb8cc, core: 0xbcd0dc },
    tint: 0xbcd0dc,        // cool serene wash
    enemyTint: null,
    weather: 'snow',       // light — "unreal in winter"
    npc: 16,               // lively hamlet
    // the lake: a broad water band across the back (z~42), village strung along the shore in front of it
    river: { path: [{ x: -70, z: 44 }, { x: -30, z: 40 }, { x: 10, z: 42 }, { x: 50, z: 40 }, { x: 90, z: 44 }], width: 20, depth: 2, level: -0.6, color: 0x4a6f86 },
    trees: [
      { path: 'decoration/nature/tree_single_A', count: 50, sMin: 0.9, sMax: 1.5 },
      { path: 'decoration/nature/tree_single_B', count: 44, sMin: 0.9, sMax: 1.5 },
      { path: 'decoration/nature/trees_A_medium', count: 24, sMin: 0.9, sMax: 1.3 },
    ],
    rocks: [
      { path: 'decoration/nature/rock_single_A', count: 26, sMin: 2, sMax: 6 },
      { path: 'decoration/nature/rock_single_C', count: 18, sMin: 2, sMax: 5 },
    ],
    mountains: ['mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees', 'mountain_A', 'mountain_B'],
    clouds: 4,
    npcRoster: ['casual_male', 'casual_female', 'worker_male', 'worker_female', 'chef_male', 'oldclassy_male', 'oldclassy_female'], // slice-of-life villagers & families
    city: { // hamlet strung in two rows along the shore, all facing the lake (+Z)
      layout: 'shore', center: { x: 0, z: 28 }, radius: 26,
      rows: [{ z: 26, count: 8 }, { z: 33, count: 6 }],
      xRange: [-32, 32], faceZ: 60,
      palette: ['red', 'yellow', 'green'],
      types: ['home_A', 'home_B', 'tavern', 'watermill', 'market'],
      castle: { type: 'church', color: 'red', x: 0, z: 20 }, // the church spire over the hamlet
    },
    settlement: [],
    props: [
      ['barrel', -6, 20], ['crate_A_big', 6, 22], ['sack', -10, 24], ['crate_long_A', 14, 30],
      ['bucket_water', 0, 28], ['wheelbarrow', -14, 22],
    ],
    flags: false,
    ruins: [],
    places: [
      { name: 'Stillmere Hamlet', x: 0, z: 26, r: 26 },
      { name: 'The Mirror Lake', x: 0, z: 46, r: 30 },
      { name: 'The Sealed Gate', x: 0, z: -120, r: 20 },
    ],
    enemies: [], // peaceful slice-of-life village
  },
];

// Parse ?level=N (1..BIOMES.length), clamp, return the biome. Defaults to Floor 1.
export function getBiome(param) {
  const n = Math.min(BIOMES.length, Math.max(1, parseInt(param, 10) || 1));
  return BIOMES[n - 1];
}
