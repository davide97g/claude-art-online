// Pure city layouts. Given a `city` config + seeded rng, return building placement specs
// ({type,color,x,z,yaw[,castle]}) the town builder turns into models. `city.layout` selects
// the topology so each floor's street plan matches its real-world town:
//   spine    — straight two-row street  (Craghold's Royal Mile; the original, default)
//   rings    — concentric wards         (Carcassonne double walls, Mdina hilltop)
//   cluster  — organic packed disk      (Civita plateau, Český Krumlov river-bend)
//   terraces — flat rows climbing +Z    (Rocamadour's stacked layers; crag lifts each tier)
//   spiral   — winding up a cone        (Mont-Saint-Michel's climb to the abbey)
//   shore    — a line facing the water  (Hallstatt lakeside)
// No THREE, no async, no DOM — pure so `node test/citylayout.mjs` can check it.

const TAU = Math.PI * 2;
const faceStreet = (x) => Math.atan2(-x, 0.0001);                 // face the x=0 centreline
const facePoint = (x, z, cx, cz) => Math.atan2(cx - x, cz - z);   // face toward (cx,cz)
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const jit = (rng, j) => (rng() - 0.5) * 2 * j;

// straight two-row street along +Z — rng order kept identical to the original for stable Craghold
function spineLayout(city, rng) {
  const { spineZ, halfWidth, step, types, palette, jitter = 0 } = city;
  const rows = [halfWidth, halfWidth + 8]; // inner + outer tenement rows
  const out = [];
  for (let z = spineZ[0]; z <= spineZ[1]; z += step) {
    for (const side of [1, -1]) {
      for (const rx of rows) {
        const x = side * rx + jit(rng, jitter);
        const zz = z + jit(rng, jitter);
        const type = pick(types, rng);
        const color = pick(palette, rng);
        out.push({ type, color, x, z: zz, yaw: faceStreet(x) });
      }
    }
  }
  return out;
}

// concentric rings around a center; buildings face inward
function ringsLayout(city, rng) {
  const { center, rings, types, palette, jitter = 1.5 } = city;
  const out = [];
  for (const ring of rings) {
    const base = rng() * TAU; // rotate each ring so they don't align into spokes
    for (let k = 0; k < ring.count; k++) {
      const a = base + (k / ring.count) * TAU;
      const x = center.x + Math.cos(a) * ring.r + jit(rng, jitter);
      const z = center.z + Math.sin(a) * ring.r + jit(rng, jitter);
      out.push({ type: pick(types, rng), color: pick(palette, rng), x, z, yaw: facePoint(x, z, center.x, center.z) });
    }
  }
  return out;
}

// organic packed cluster in a disk (sqrt(rng) → uniform density); faces center
function clusterLayout(city, rng) {
  const { center, radius, count, types, palette, jitter = 0 } = city;
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU, r = Math.sqrt(rng()) * radius;
    const x = center.x + Math.cos(a) * r + jit(rng, jitter);
    const z = center.z + Math.sin(a) * r + jit(rng, jitter);
    out.push({ type: pick(types, rng), color: pick(palette, rng), x, z, yaw: facePoint(x, z, center.x, center.z) });
  }
  return out;
}

// discrete flat rows climbing +Z; crag terrain lifts each row into a visible tier
function terracesLayout(city, rng) {
  const { rows, types, palette, jitter = 1 } = city;
  const out = [];
  for (const row of rows) {
    for (let k = 0; k < row.count; k++) {
      const t = row.count === 1 ? 0.5 : k / (row.count - 1);
      const x = (t - 0.5) * 2 * row.halfWidth + jit(rng, jitter);
      const z = row.z + jit(rng, jitter);
      out.push({ type: pick(types, rng), color: pick(palette, rng), x, z, yaw: facePoint(x, z, 0, row.z - 20) });
    }
  }
  return out;
}

// buildings winding up around a cone toward the apex
function spiralLayout(city, rng) {
  const { center, turns, count, rMax, rMin = 3, types, palette, jitter = 0.6 } = city;
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1 || 1);
    const a = t * turns * TAU;
    const r = rMax - (rMax - rMin) * t;
    const x = center.x + Math.cos(a) * r + jit(rng, jitter);
    const z = center.z + Math.sin(a) * r + jit(rng, jitter);
    out.push({ type: pick(types, rng), color: pick(palette, rng), x, z, yaw: facePoint(x, z, center.x, center.z) });
  }
  return out;
}

// a line (or two) of buildings along a shore, all facing the water at faceZ
function shoreLayout(city, rng) {
  const { rows, xRange, faceZ = 60, types, palette, jitter = 1 } = city;
  const out = [];
  for (const row of rows) {
    for (let k = 0; k < row.count; k++) {
      const t = row.count === 1 ? 0.5 : k / (row.count - 1);
      const x = xRange[0] + t * (xRange[1] - xRange[0]) + jit(rng, jitter);
      const z = row.z + jit(rng, jitter);
      out.push({ type: pick(types, rng), color: pick(palette, rng), x, z, yaw: facePoint(x, z, x, faceZ) });
    }
  }
  return out;
}

const LAYOUTS = { spine: spineLayout, rings: ringsLayout, cluster: clusterLayout, terraces: terracesLayout, spiral: spiralLayout, shore: shoreLayout };

export function cityLayout(city, rng) {
  const gen = LAYOUTS[city.layout] || spineLayout;
  const out = gen(city, rng);
  if (city.castle) out.push({ type: city.castle.type, color: city.castle.color, x: city.castle.x, z: city.castle.z, yaw: 0, castle: true });
  // keep the spawn/gate corridor clear (matches town.js blocked()); castle is always kept.
  // Skipped for the spine layout so Craghold — and the layout test — stay byte-for-byte stable.
  if (city.layout && city.layout !== 'spine') return out.filter((b) => b.castle || !(Math.abs(b.x) < 9 && b.z < 14));
  return out;
}
