// NPC dialogue data — PURE DATA, NO IMPORTS (so test/dialogue.mjs runs under node).
//
// Named story NPCs per floor: each has a branching tree. A node is
// { text, choices: [{ label, to }] } where `to` is another node key in the SAME
// NPC, or null to end the conversation. `model` is a key into NPC_MODELS (npc.js);
// `pos` is a fixed town post (grounded on load; push-out resolves any overlap).
// Generic villagers speak one CROWD_LINES entry, chosen by their index (stable).

export const NAMED_BY_FLOOR = {
  1: [
    {
      name: 'Argo', tag: 'Information Broker', model: 'rpg_rogue',
      pos: { x: 5, z: 15 }, root: 'start',
      nodes: {
        start: {
          text: "Heehee. Name's Argo — the Rat, if you're rude about it. I trade in whispers. What're you after, friend?",
          choices: [
            { label: 'Any rumors worth hearing?', to: 'rumors' },
            { label: 'What about the gate?', to: 'gate' },
            { label: 'Just passing through.', to: null },
          ],
        },
        rumors: {
          text: "The moss golems on the gate road telegraph before they swing — watch the eyes. Free tip. The rest'll cost you Col.",
          choices: [
            { label: 'And the boss?', to: 'gate' },
            { label: 'Thanks, Argo.', to: null },
          ],
        },
        gate: {
          text: "Rendfang holds the gate to Floor Two. Clear the field first — nobody solos that thing cold. Come back sharper.",
          choices: [{ label: 'Got it.', to: null }],
        },
      },
    },
    {
      name: 'Klein', tag: 'Hot-Blooded Swordsman', model: 'knight_male',
      pos: { x: -8, z: 14 }, root: 'start',
      nodes: {
        start: {
          text: "Hah! A fresh face on Floor One! Klein's the name. Don't rush the gate, rookie — grind the boars, get a feel for the blade.",
          choices: [
            { label: 'Any combat advice?', to: 'tips' },
            { label: "Not clearing it yourself?", to: 'guild' },
            { label: 'See you around.', to: null },
          ],
        },
        tips: {
          text: "Land a clean hit and time slows for a beat — that's your cue. Left-click again mid-swing and it chains. Flow, don't flail!",
          choices: [{ label: 'Nice. Thanks.', to: null }],
        },
        guild: {
          text: "Got my guildmates to keep alive first — we move together. You look like the solo type. Respect. Just don't die out there.",
          choices: [{ label: 'No promises.', to: null }],
        },
      },
    },
    {
      name: 'Sister Sasha', tag: 'Keeper of the Chapel', model: 'rpg_cleric',
      pos: { x: -20, z: 30 }, root: 'start',
      nodes: {
        start: {
          text: "Welcome, traveler. The chapel shelters those the floors have worn thin. Rest here whenever the road turns cruel.",
          choices: [
            { label: 'Who do you shelter?', to: 'orphans' },
            { label: 'Any words before I fight?', to: 'blessing' },
            { label: 'Thank you, Sister.', to: null },
          ],
        },
        orphans: {
          text: "Children, mostly — the kin of cleared players, the lost, the frightened. This game took much from them. Kindness costs nothing.",
          choices: [
            { label: 'A blessing, then?', to: 'blessing' },
            { label: "I'll remember that.", to: null },
          ],
        },
        blessing: {
          text: "May your hand be steady and your retreat be swift. Living to fight again is not cowardice — it is wisdom.",
          choices: [{ label: 'Amen.', to: null }],
        },
      },
    },
    {
      name: 'Bahr', tag: 'Town Blacksmith', model: 'worker_male',
      pos: { x: -14, z: 8 }, root: 'start',
      nodes: {
        start: {
          text: "Mind the sparks. I'm Bahr — I keep the town's steel honest. That blade of yours seen a whetstone lately?",
          choices: [
            { label: 'Tell me about my sword.', to: 'sword' },
            { label: 'Seen anything strange?', to: 'strange' },
            { label: 'Later, smith.', to: null },
          ],
        },
        sword: {
          text: "A clean edge bites deeper — every level you earn, your swings land heavier. Keep killing, keep growing. The steel follows.",
          choices: [{ label: 'Good to know.', to: null }],
        },
        strange: {
          text: "The golems past the fields — their cores glow like my forge when they wind up to strike. Unnatural. Watch that glow.",
          choices: [{ label: "I'll watch for it.", to: null }],
        },
      },
    },
    {
      name: 'The Hooded One', tag: 'Keeper of Secrets', model: 'wizard',
      pos: { x: 3, z: 48 }, root: 'start',
      nodes: {
        start: {
          text: "...You climb. They all climb. One hundred floors stacked toward a sky that isn't real. Do you know what waits at the top?",
          choices: [
            { label: 'What waits at the top?', to: 'top' },
            { label: 'How do I get out?', to: 'out' },
            { label: 'You talk in riddles.', to: null },
          ],
        },
        top: {
          text: "Freedom, or its shadow. Clear every floor and the cage opens. But the tower counts its dead, and it is patient. Climb anyway.",
          choices: [
            { label: 'And if I fall?', to: 'out' },
            { label: 'Then I climb.', to: null },
          ],
        },
        out: {
          text: "There is no logout. There is only up. Reach the summit — or make peace with the floors. Those are the only doors that open.",
          choices: [{ label: '...', to: null }],
        },
      },
    },
  ],
};

export const CROWD_LINES = [
  'Another climber, huh? Stay sharp out there.',
  'Heard the boars are thick on the gate road today.',
  'I sell nothing and know less. Good day.',
  'You cleared for the front line? Rather you than me.',
  "The chapel's the one safe place left. Sister Sasha keeps it so.",
  "Watch the golems. My cousin didn't, and he... well.",
  'Two years trapped and I still miss real bread.',
  'Link start, they said. Best day of our lives, they said.',
  "You've got that 'gonna clear it' look. Good luck.",
  "I'll buy you a drink at the tavern if you make it back.",
  "Keep your blade up. This floor's kinder than the ones above.",
  'Mind the well — the kids keep dropping things down it.',
];
