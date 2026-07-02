// Pure city-street layout for Craghold (Floor 5). Given a `city` config and a
// seeded rng, return building placement specs the town builder turns into models.
// No THREE, no async, no DOM — kept pure so `node test/citylayout.mjs` can check it.

// face the street centreline (x=0): +x buildings turn to -x and vice-versa.
const faceStreet = (x) => Math.atan2(-x, 0.0001);

export function cityLayout(city, rng) {
  const { spineZ, halfWidth, step, palette, types, castle, jitter = 0 } = city;
  const rows = [halfWidth, halfWidth + 8]; // inner + outer tenement rows
  const out = [];
  for (let z = spineZ[0]; z <= spineZ[1]; z += step) {
    for (const side of [1, -1]) {
      for (const rx of rows) {
        const x = side * rx + (rng() - 0.5) * 2 * jitter;
        const zz = z + (rng() - 0.5) * 2 * jitter;
        const type = types[Math.floor(rng() * types.length)];
        const color = palette[Math.floor(rng() * palette.length)];
        out.push({ type, color, x, z: zz, yaw: faceStreet(x) });
      }
    }
  }
  out.push({ type: castle.type, color: castle.color, x: castle.x, z: castle.z, yaw: 0, castle: true });
  return out;
}
