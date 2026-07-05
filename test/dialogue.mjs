import assert from 'node:assert/strict';
import { NAMED_BY_FLOOR, CROWD_LINES } from '../src/world/dialogue.js';

// model keys that exist in src/world/npc.js NPC_MODELS
const MODELS = new Set([
  'worker_male', 'worker_female', 'oldclassy_male', 'oldclassy_female', 'chef_male',
  'elf', 'casual_male', 'casual_female', 'viking_male', 'kimono_female', 'rpg_monk',
  'knight_male', 'rpg_warrior', 'rpg_rogue', 'rpg_ranger', 'rpg_cleric', 'witch',
  'wizard', 'knight_golden_female',
]);

assert.ok(Array.isArray(CROWD_LINES) && CROWD_LINES.length >= 6, 'crowd lines present');
for (const l of CROWD_LINES) assert.equal(typeof l, 'string', 'crowd line is a string');

let npcCount = 0;
for (const [floor, list] of Object.entries(NAMED_BY_FLOOR)) {
  for (const npc of list) {
    npcCount++;
    assert.ok(npc.name && npc.tag, `floor ${floor}: name+tag`);
    assert.ok(MODELS.has(npc.model), `floor ${floor} ${npc.name}: model "${npc.model}" exists in NPC_MODELS`);
    assert.ok(npc.nodes[npc.root], `${npc.name}: root "${npc.root}" is a real node`);
    for (const [key, node] of Object.entries(npc.nodes)) {
      assert.ok(typeof node.text === 'string' && node.text.length, `${npc.name}.${key}: has text`);
      assert.ok(node.choices.length >= 1, `${npc.name}.${key}: has choices`);
      for (const c of node.choices) {
        assert.ok(c.label, `${npc.name}.${key}: choice label`);
        assert.ok(c.to === null || npc.nodes[c.to], `${npc.name}.${key}: choice.to "${c.to}" is null or a real node`);
      }
    }
    // every non-root node must be reachable from root
    const seen = new Set(), stack = [npc.root];
    while (stack.length) {
      const k = stack.pop();
      if (seen.has(k)) continue;
      seen.add(k);
      for (const c of npc.nodes[k].choices) if (c.to) stack.push(c.to);
    }
    for (const k of Object.keys(npc.nodes)) assert.ok(seen.has(k), `${npc.name}: node "${k}" reachable from root`);
  }
}
assert.ok(npcCount >= 5, 'at least 5 named NPCs');
console.log(`OK — ${npcCount} named NPCs, ${CROWD_LINES.length} crowd lines`);
