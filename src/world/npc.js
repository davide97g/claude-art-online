import * as THREE from 'three';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { gltf } from '../loading.js';
import { resolvePushOut } from '../player/collision.js';
import { toonMat, toonifyObject } from './toon.js';
import { NAMED_BY_FLOOR, CROWD_LINES } from './dialogue.js';

// Townsfolk that populate the spawn town (Floor 1) and the Royal Mile city (Floor 5).
//
// Two-tier, following the project's graceful-degradation rule:
//  1. Real character GLBs — Quaternius CC0 packs (Ultimate Animated Character + RPG
//     Characters, see public/assets/models/npc/LICENSE.txt): rigged, skinned, with
//     Idle/Walk clips. Each is SkeletonUtils-cloned per instance (plain .clone() breaks
//     skinning) and driven by its own AnimationMixer. The RPG adventurers in the list
//     read as fellow players in the SAO fiction; the rest are villagers.
//  2. Fallback — ~12 hand-built low-poly archetypes (below) so the town is populated
//     even with zero GLBs. Fallback i dresses archetype (i % ARCHETYPES.length).
//
// scale: raw models are ~3–4.3u tall, feet at y=0; scale brings each to ~1.6–1.9u
// (children are Casual adults shrunk). Clips matched exact 'Idle'/'Walk' first, so
// 'Idle_Weapon'/'Walk_Carry' variants don't win.
// `key` = filename stem, used by biome.npcRoster to pick a per-floor cast.
// `fb` = index into ARCHETYPES (below) so the gray-box fallback keeps the same flavour.
const NPC_MODELS = [
  { key: 'worker_male', file: '/assets/models/npc/worker_male.glb', scale: 0.51, fb: 8 },
  { key: 'worker_female', file: '/assets/models/npc/worker_female.glb', scale: 0.48, fb: 1 },
  { key: 'oldclassy_male', file: '/assets/models/npc/oldclassy_male.glb', scale: 0.45, fb: 4 },
  { key: 'oldclassy_female', file: '/assets/models/npc/oldclassy_female.glb', scale: 0.44, fb: 5 },
  { key: 'chef_male', file: '/assets/models/npc/chef_male.glb', scale: 0.54, fb: 0 },
  { key: 'elf', file: '/assets/models/npc/elf.glb', scale: 0.45, fb: 10 },
  { key: 'casual_male', file: '/assets/models/npc/casual_male.glb', scale: 0.35, fb: 10 },
  { key: 'casual_female', file: '/assets/models/npc/casual_female.glb', scale: 0.34, fb: 9 },
  { key: 'viking_male', file: '/assets/models/npc/viking_male.glb', scale: 0.5, fb: 0 },
  { key: 'kimono_female', file: '/assets/models/npc/kimono_female.glb', scale: 0.52, fb: 5 },
  { key: 'rpg_monk', file: '/assets/models/npc/rpg_monk.glb', scale: 0.58, fb: 2 },
  { key: 'knight_male', file: '/assets/models/npc/knight_male.glb', scale: 0.52, fb: 11 },
  { key: 'rpg_warrior', file: '/assets/models/npc/rpg_warrior.glb', scale: 0.6, fb: 11 },
  { key: 'rpg_rogue', file: '/assets/models/npc/rpg_rogue.glb', scale: 0.56, fb: 10 },
  { key: 'rpg_ranger', file: '/assets/models/npc/rpg_ranger.glb', scale: 0.59, fb: 10 },
  { key: 'rpg_cleric', file: '/assets/models/npc/rpg_cleric.glb', scale: 0.58, fb: 2 },
  { key: 'witch', file: '/assets/models/npc/witch.glb', scale: 0.46, fb: 3 },
  { key: 'wizard', file: '/assets/models/npc/wizard.glb', scale: 0.47, fb: 2 },
  { key: 'knight_golden_female', file: '/assets/models/npc/knight_golden_female.glb', scale: 0.55, fb: 5 },
];
const MODEL_INDEX = Object.fromEntries(NPC_MODELS.map((m, i) => [m.key, i]));

// Resolve biome.npcRoster (array of model keys) → indices into NPC_MODELS. Unknown keys are
// dropped; no roster (or nothing valid) → the full cast, cycled in order (Floors 1 & 5).
function rosterPool(biome) {
  const keys = biome && biome.npcRoster;
  if (Array.isArray(keys)) {
    const pool = keys.map((k) => MODEL_INDEX[k]).filter((i) => i !== undefined);
    if (pool.length) return pool;
  }
  return NPC_MODELS.map((_, i) => i);
}

const PLAZA = new THREE.Vector2(0, 22); // spawn-town center (matches town.js CENTER)

// ---------- fallback archetypes: real variety from primitives ----------
const SKIN = { light: 0xf0c8a0, tan: 0xe0b088, olive: 0xc98a5b, brown: 0x8a5a3a };
const HAIR = { black: 0x2b2320, brown: 0x5a3a22, blonde: 0xc9a25a, gray: 0xb9b6ae, red: 0x8a4a2a };
const mat = (c) => toonMat({ color: c, flatShading: true });

// build:{topR,botR,h}  hair:{color,style}  hat:{type,color}  cape/beard/belt flags  scale
const ARCHETYPES = [
  { name: 'peasant_man',  skin: SKIN.tan,   tunic: 0x6b4f3a, build: { topR: 0.26, botR: 0.34, h: 1.02 }, hair: { color: HAIR.brown, style: 'short' }, beard: true, belt: true, scale: 1.0 },
  { name: 'peasant_woman',skin: SKIN.light, tunic: 0x7a3a4a, build: { topR: 0.22, botR: 0.5,  h: 1.12 }, dress: true, hair: { color: HAIR.brown, style: 'long' }, hat: { type: 'scarf', color: 0x8a6a3a }, scale: 0.97 },
  { name: 'elder_man',    skin: SKIN.olive, tunic: 0x4a5548, build: { topR: 0.25, botR: 0.33, h: 0.98 }, hair: { color: HAIR.gray, style: 'short' }, beard: true, beardColor: HAIR.gray, belt: true, scale: 0.95 },
  { name: 'elder_woman',  skin: SKIN.light, tunic: 0x40404c, build: { topR: 0.22, botR: 0.48, h: 1.06 }, dress: true, hair: { color: HAIR.gray, style: 'bun' }, cape: 0x33333c, scale: 0.92 },
  { name: 'merchant',     skin: SKIN.tan,   tunic: 0x38506b, build: { topR: 0.3,  botR: 0.4,  h: 1.05 }, hair: { color: HAIR.black, style: 'short' }, beard: true, hat: { type: 'brim', color: 0x2a2a30 }, cape: 0x5a3a2a, belt: true, scale: 1.03 },
  { name: 'noble_woman',  skin: SKIN.light, tunic: 0x704a6b, build: { topR: 0.22, botR: 0.52, h: 1.16 }, dress: true, hair: { color: HAIR.blonde, style: 'long' }, cape: 0x9a6aa0, scale: 1.05 },
  { name: 'child_boy',    skin: SKIN.light, tunic: 0x4a6b3a, build: { topR: 0.24, botR: 0.3,  h: 0.9  }, hair: { color: HAIR.brown, style: 'short' }, scale: 0.6 },
  { name: 'child_girl',   skin: SKIN.light, tunic: 0xa0506a, build: { topR: 0.2,  botR: 0.42, h: 0.95 }, dress: true, hair: { color: HAIR.blonde, style: 'long' }, scale: 0.58 },
  { name: 'worker',       skin: SKIN.brown, tunic: 0x8a7a4a, build: { topR: 0.3,  botR: 0.4,  h: 1.0  }, hair: { color: HAIR.black, style: 'bald' }, belt: true, scale: 1.02 },
  { name: 'young_woman',  skin: SKIN.tan,   tunic: 0x38707a, build: { topR: 0.22, botR: 0.46, h: 1.08 }, dress: true, hair: { color: HAIR.red, style: 'bun' }, scale: 0.98 },
  { name: 'young_man',    skin: SKIN.tan,   tunic: 0x7a3a3a, build: { topR: 0.24, botR: 0.32, h: 1.04 }, hair: { color: HAIR.red, style: 'short' }, hat: { type: 'cone', color: 0x5a4a2a }, scale: 1.0 },
  { name: 'guard_civ',    skin: SKIN.olive, tunic: 0x2f3540, build: { topR: 0.28, botR: 0.36, h: 1.08 }, hair: { color: HAIR.black, style: 'short' }, hat: { type: 'brim', color: 0x22252c }, belt: true, scale: 1.08 },
];

function makePerson(a) {
  const g = new THREE.Group();
  const b = a.build;
  const skinMat = mat(a.skin);

  // body (tunic or dress); feet sit at y=0 so grounding drops the whole figure onto terrain
  const body = new THREE.Mesh(new THREE.CylinderGeometry(b.topR, b.botR, b.h, 8), mat(a.tunic));
  body.position.y = b.h / 2;
  body.castShadow = true;
  g.add(body);

  // belt: a thin dark band around the waist
  if (a.belt) {
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(b.topR + 0.03, b.botR - 0.02, 0.08, 8), mat(0x3a2a1a));
    belt.position.y = b.h * 0.42;
    g.add(belt);
  }

  // arms: two thin sleeves down the sides
  const armGeo = new THREE.CylinderGeometry(0.06, 0.06, b.h * 0.55, 5);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, mat(a.tunic));
    arm.position.set(s * (b.topR + 0.05), b.h * 0.62, 0);
    arm.rotation.z = s * 0.12;
    g.add(arm);
  }

  // cape / shawl draped over the shoulders (nobles, merchants, elders)
  if (a.cape) {
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(b.topR + 0.04, b.botR + 0.06, b.h * 0.7, 8, 1, true, Math.PI * 0.15, Math.PI * 1.7), mat(a.cape));
    cape.position.y = b.h * 0.62;
    cape.rotation.y = Math.PI;
    g.add(cape);
  }

  // head + nose (nose = facing indicator, like the player capsule)
  const headY = b.h + 0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), skinMat);
  head.position.y = headY;
  head.castShadow = true;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 5), skinMat);
  nose.position.set(0, headY, 0.2); nose.rotation.x = Math.PI / 2;
  g.add(head, nose);

  // hair
  if (a.hair && a.hair.style !== 'bald') {
    const hm = mat(a.hair.color);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), hm);
    cap.position.y = headY + 0.03; cap.scale.y = 0.7;
    g.add(cap);
    if (a.hair.style === 'long') {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.14), hm);
      back.position.set(0, headY - 0.16, -0.13);
      g.add(back);
    } else if (a.hair.style === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), hm);
      bun.position.set(0, headY + 0.15, -0.14);
      g.add(bun);
    }
  }

  // beard
  if (a.beard) {
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 6), mat(a.beardColor || a.hair.color));
    beard.position.set(0, headY - 0.14, 0.1); beard.rotation.x = Math.PI;
    g.add(beard);
  }

  // hat / scarf
  if (a.hat) {
    const hm = mat(a.hat.color);
    if (a.hat.type === 'cone') {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.34, 7), hm);
      c.position.y = headY + 0.28; g.add(c);
    } else if (a.hat.type === 'brim') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 10), hm);
      brim.position.y = headY + 0.18;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.22, 8), hm);
      crown.position.y = headY + 0.3;
      g.add(brim, crown);
    } else if (a.hat.type === 'scarf') {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.23, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), hm);
      s.position.y = headY + 0.02; g.add(s);
    }
  }

  g.scale.setScalar(a.scale || 1);
  return g;
}

// ---------- placement ----------
// Region + crowd size come from biome data, not hard floor IDs:
//  biome.city  → Floor 5, line the Royal Mile spine, dense
//  biome.flags === true → Floor 1 bannered town, fill the plaza, dense
//  otherwise → a handful around the plaza
function crowdSpec(biome) {
  // region follows the building layout so the crowd lands where the town actually is:
  //  spine street → 'spine'; any other city topology → 'city' (disk around city.center); else plaza.
  const region = !biome.city ? 'plaza'
    : (biome.city.layout && biome.city.layout !== 'spine') ? 'city'
      : 'spine';
  // explicit per-floor count wins (lets a floor be denser or sparser than its layout implies)
  if (typeof biome.npc === 'number') return { n: biome.npc, region };
  if (biome.city) return { n: 34, region };
  if (biome.flags === true) return { n: 22, region: 'plaza' };
  return { n: 6, region: 'plaza' };
}

function candidate(biome, region) {
  if (region === 'city') {
    // scatter over the town footprint; sqrt(rng) → uniform density, push-out handles overlaps
    const c = biome.city.center || { x: 0, z: 40 };
    const rad = biome.city.radius || 18;
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * rad;
    return [c.x + Math.cos(a) * r, c.z + Math.sin(a) * r];
  }
  if (region === 'spine') {
    if (Math.random() < 0.28) { // some milling in the entry plaza
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 9;
      return [Math.cos(a) * r, 14 + Math.sin(a) * 6];
    }
    const z = 18 + Math.random() * 60;                 // down the Royal Mile (+Z)
    const x = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 7); // sides, middle stays walkable
    return [x, z];
  }
  const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 16;
  return [PLAZA.x + Math.cos(a) * r, PLAZA.y + Math.sin(a) * r];
}

export class Villagers {
  constructor(scene, getHeight, colliders, biome) {
    this.getHeight = getHeight;
    this.colliders = colliders;
    this.people = [];
    this.talkingWith = null; // set by main.js while a conversation is open
    const { n, region } = crowdSpec(biome);
    const pool = rosterPool(biome); // per-floor cast (indices into NPC_MODELS)

    for (let i = 0; i < n; i++) {
      let x = 0, z = 0, tries = 0;
      do { [x, z] = candidate(biome, region); } while (tries++ < 14 && this.inCollider(x, z, 0.8));
      // cycle the roster so every cast member shows before repeating; fallback archetype matches
      const modelIdx = pool[i % pool.length];
      const g = makePerson(ARCHETYPES[NPC_MODELS[modelIdx].fb]);
      g.position.set(x, getHeight(x, z), z);
      g.rotation.y = Math.random() * Math.PI * 2;
      scene.add(g);
      this.people.push({
        g, modelIdx, home: { x, z }, tx: x, tz: z,
        wait: Math.random() * 3, speed: 0.7 + Math.random() * 0.7,
        mixer: null, actions: null, current: null,
      });
    }

    // named story NPCs for this floor: fixed posts, no strolling, real identities.
    // modelIdx points at their chosen model so loadModels() upgrades them like anyone else.
    for (const d of (NAMED_BY_FLOOR[biome.id] || [])) {
      const modelIdx = MODEL_INDEX[d.model];
      if (modelIdx === undefined) continue;
      const g = makePerson(ARCHETYPES[NPC_MODELS[modelIdx].fb]);
      g.position.set(d.pos.x, getHeight(d.pos.x, d.pos.z), d.pos.z);
      g.rotation.y = Math.PI; // face -Z, toward the spawn plaza
      scene.add(g);
      this.people.push({
        g, modelIdx, home: { x: d.pos.x, z: d.pos.z }, tx: d.pos.x, tz: d.pos.z,
        wait: 0, speed: 0, static: true,
        identity: { name: d.name, tag: d.tag, tree: { root: d.root, nodes: d.nodes } },
        mixer: null, actions: null, current: null,
      });
    }

    if (NPC_MODELS.length) this.loadModels();
  }

  inCollider(x, z, pad) {
    for (const c of this.colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
    return false;
  }

  // closest person within `range` of `pos`, with an identity to talk to.
  // named NPCs carry their own; everyone else gets a stable crowd one-liner.
  nearestTalkable(pos, range) {
    let best = null, bestIdx = -1, bestD = range;
    this.people.forEach((p, i) => {
      const d = Math.hypot(p.g.position.x - pos.x, p.g.position.z - pos.z);
      if (d < bestD) { bestD = d; best = p; bestIdx = i; }
    });
    if (!best) return null;
    const identity = best.identity
      || { name: 'Villager', line: CROWD_LINES[bestIdx % CROWD_LINES.length] };
    return { person: best, identity };
  }

  // load the real GLBs, then swap each fallback figure for a cloned + animated model
  loadModels() {
    const loaded = new Array(NPC_MODELS.length).fill(null);
    NPC_MODELS.forEach((m, i) => gltf.load(m.file,
      (g) => {
        g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
        toonifyObject(g.scene); // cel-shade townsfolk to match the world
        loaded[i] = g;
        // upgrade every person assigned to this model
        for (const p of this.people) {
          if (p.modelIdx !== i || p.mixer) continue;
          this.swapToModel(p, g, m);
        }
      },
      undefined,
      () => console.log(`[CAO] NPC model missing: ${m.file} — keeping gray-box archetype`)));
  }

  swapToModel(p, g, cfg) {
    const obj = skeletonClone(g.scene);
    obj.scale.setScalar(cfg.scale || 1);
    // no yaw flip: Quaternius rigs already face +Z, same as the fallback's nose,
    // so the movement yaw (atan2(dx,dz)) points them along their path
    while (p.g.children.length) p.g.remove(p.g.children[0]); // drop the fallback visuals
    p.g.add(obj);
    const mixer = new THREE.AnimationMixer(obj);
    const find = (re) => g.animations.find((a) => re.test(a.name));
    // exact name first: packs also ship 'Idle_Weapon' / 'Walk_Carry' variants
    const idle = find(/^idle$/i) || find(/idle/i);
    const walk = find(/^walk$/i) || find(/walk/i) || find(/locomotion/i) || find(/^move/i);
    p.actions = {
      idle: idle ? mixer.clipAction(idle) : null,
      walk: walk ? mixer.clipAction(walk) : null,
    };
    if (p.actions.walk) p.actions.walk.timeScale = 0.6 + p.speed * 0.55; // stride roughly tracks stroll speed
    p.mixer = mixer;
    // desync the crowd so clones don't animate in lockstep
    if (p.actions.idle) { p.actions.idle.play(); p.current = p.actions.idle; p.current.time = Math.random() * p.current.getClip().duration; }
    else if (p.actions.walk) { p.actions.walk.play(); p.current = p.actions.walk; }
  }

  // dt (real time) — ambient life ignores hit-stop, like the weather/camera.
  // playerPos lets the person we're talking to turn and face the player.
  update(dt, playerPos) {
    for (const p of this.people) {
      const g = p.g;
      let moving = false;

      if (p === this.talkingWith) {
        // frozen in conversation: face the player, hold idle
        if (playerPos) {
          const ty = Math.atan2(playerPos.x - g.position.x, playerPos.z - g.position.z);
          let d = ty - g.rotation.y;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          g.rotation.y += d * Math.min(1, dt * 8);
        }
      } else if (!p.static) {
        const dx = p.tx - g.position.x, dz = p.tz - g.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.2) {
          p.wait -= dt;
          if (p.wait <= 0) { // pick a new stroll target near home
            const a = Math.random() * Math.PI * 2, r = Math.random() * 5;
            p.tx = p.home.x + Math.cos(a) * r;
            p.tz = p.home.z + Math.sin(a) * r;
            p.wait = 1.5 + Math.random() * 3;
          }
        } else {
          moving = true;
          const step = Math.min(d, p.speed * dt);
          g.position.x += (dx / d) * step;
          g.position.z += (dz / d) * step;
          const yaw = Math.atan2(dx, dz);
          let diff = yaw - g.rotation.y;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          g.rotation.y += diff * Math.min(1, dt * 6);
        }
      }

      // shared push-out keeps them out of buildings/trees
      const out = resolvePushOut(g.position.x, g.position.z, 0.3, this.colliders);
      g.position.set(out.x, this.getHeight(out.x, out.z), out.z);

      // animation (GLB people only): crossfade idle <-> walk
      if (p.mixer) {
        const want = (moving && p.actions.walk) ? p.actions.walk : (p.actions.idle || p.actions.walk);
        if (want && want !== p.current) {
          want.reset().fadeIn(0.2).play();
          if (p.current) p.current.fadeOut(0.2);
          p.current = want;
        }
        p.mixer.update(dt);
      }
    }
  }
}
