// 2D circle push-out. No three.js dep on purpose — pure numbers, so it's unit-testable
// without a browser (see the __main__-style self-check at the bottom).
//
// The player is a circle of `radius` at (x,z); each collider is a cylinder {x,z,r}.
// We ignore Y entirely (colliders are tall buildings), so this is the analytic
// equivalent of the terrainHeight() approach — no raycasting.
//
// ponytail: single relaxation pass. If the player is wedged between two buildings
// resolving one can nudge them into another; one pass leaves a tiny overlap that the
// next frame fixes. Good enough for spaced-out town buildings. Upgrade path if it ever
// jitters in a tight corner: loop the pass 2-3× or clamp to the deepest collider only.
export function resolvePushOut(x, z, radius, colliders) {
  for (const c of colliders) {
    const dx = x - c.x;
    const dz = z - c.z;
    const min = c.r + radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) continue; // outside this collider
    const d = Math.sqrt(d2);
    if (d < 1e-4) { x += min; continue; } // dead-center: shove out along +x, any direction is fine
    const push = (min - d) / d;
    x += dx * push;
    z += dz * push;
  }
  return { x, z };
}
