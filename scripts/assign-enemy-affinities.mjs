// Assign element affinities to all enemies in enemies.json.
// Each enemy gets one ElementId based on thematic fit; bosses get differentiated identities.

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const FP = join(ROOT, 'src', 'data', 'json', 'enemies.json');

// Affinity map keyed by enemy id (matches enemies.json `id` field).
const AFFINITIES = {
  // ── Normal enemies ─────────────────────────────────────────
  lost_lizard:           'defense',  // slow tank, high HP
  corpse_eater:          'counter',  // undead, reflective bite
  headless_fire_horse:   'fire',     // obvious
  pocket_cat:            'agility',  // fast scrappy
  baby_dragon:           'fire',     // fire breath
  giant_beetle:          'defense',  // chitin armor
  mutated_salamander:    'water',    // amphibian, regenerative
  ancient_tree:          'earth',    // earth elemental
  giant_spider_2:        'water',    // venom (water-poison flavor)
  giant_spider:          'water',    // same family
  mush:                  'earth',    // mushroom, spore slow
  forge_slime:           'fire',     // forge heat
  lava_golen:            'fire',     // lava golem
  mecha_warrior:         'defense',  // armored construct
  depths_horror:         'air',      // psychic abyss, disorientation
  toxic_gooze:           'water',    // toxin
  venomous_kobra:        'air',      // quick venom strike

  // ── Bosses ─────────────────────────────────────────────────
  doom_knight:           'counter',  // dark knight, reflective retaliation
  iron_golem:            'defense',  // metal construct, armor stacker
  lizard_king:           'attack',   // raw damage boss
};

const enemies = JSON.parse(readFileSync(FP, 'utf8'));

let assigned = 0;
let missing = 0;
const tally = {};

for (const enemy of enemies) {
  const aff = AFFINITIES[enemy.id];
  if (aff) {
    enemy.affinity = aff;
    assigned++;
    tally[aff] = (tally[aff] ?? 0) + 1;
  } else {
    console.warn(`No affinity mapping for enemy id: ${enemy.id}`);
    missing++;
  }
}

writeFileSync(FP, JSON.stringify(enemies, null, 2));
console.log(`Assigned affinities: ${assigned}/${enemies.length}`);
console.log('Missing:', missing);
console.log('Distribution:', tally);
