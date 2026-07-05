import * as THREE from 'three';

// The enemy contract every mob implements (see CLAUDE.md "Enemy contract").
// Blade.resolveHit iterates these; enemies that attack call player.takeDamage back.
// The boss ignores `camera` in update() — fewer params is a valid implementation.
export interface Enemy {
  pos: THREE.Vector3;
  alive: boolean;
  takeHit(dmg: number, dir: THREE.Vector3): void;
  update(sdt: number, camera: THREE.Camera): void;
}

// A material we flash/tint by name — all of these expose emissive/color.
// ponytail: loose union covering Lambert (gray-box) + Standard (GLB clones);
// widen if a new material type joins the flash set.
export type FlashMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;

// Analytic ground height, from world/floor.js (still untyped .js).
export type HeightFn = (x: number, z: number) => number;
