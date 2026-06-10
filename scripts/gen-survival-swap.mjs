// SURVIVAL swap-test at the calibrated ~50%-death operating point (boss4-heavy).
// Swap each armor (warrior) / heal (mage) card into slot 1 of an HP-stressed but
// offense-capable baseline, vs a mid survival control. Judge by SURVIVAL deltas
// (deathRate down, loops cleared up, HP entering boss up) — not damage.
import { readFileSync, writeFileSync } from 'node:fs';
const cards = JSON.parse(readFileSync('tests/audit/val/cards-index.json', 'utf-8'));
const classOf = (c) => c.resource === 'stamina' ? 'warrior' : c.resource === 'mana' ? 'mage' : (c.category === 'attack' || c.category === 'defense' ? 'warrior' : 'mage');

const WARRIOR_ARMOR = ['t1-attack', 'SWAP', 't2-attack-attack', 't3-agility-attack-attack', 't1-defense', 't2-attack-defense', 't2-attack-fire', 't2-counter-earth', 't3-earth-earth-earth', 't2-agility-agility'];
const MAGE_HEAL = ['t1-fire', 'SWAP', 't2-fire-water', 't2-attack-fire', 't2-agility-fire', 't3-agility-fire-fire', 't1-water', 't2-air-water', 't3-water-water-water', 't2-earth-water'];
const BAND = { startLoop: 37, bk: 3, runXP: 2100 }; // boss4 (desert_golem)
const PLAN = { terrainPool: ['desert', 'graveyard', 'swamp', 'lava', 'forest'], tilesPerLoop: 3 }; // heavy
const REPS = 24;

// candidates: armor cards playable by warrior; heal cards playable by mage
const armorCands = cards.filter((c) => (c.archetypes ?? []).includes('armor') && classOf(c) === 'warrior').map((c) => c.id);
const healCands = cards.filter((c) => (c.archetypes ?? []).includes('heal') && classOf(c) === 'mage').map((c) => c.id);

const runs = [];
const mk = (cls, baseline, ctrl, variant, slotCard) => {
  const deck = baseline.map((c) => c === 'SWAP' ? slotCard : c);
  return { id: `${cls === 'warrior' ? 'armor' : 'heal'}__${variant}`, class: cls, quality: 'survival', stage: 'boss4', archetype: cls === 'warrior' ? 'armor' : 'heal', variant, boss: 'desert_golem',
    deck, startLoop: BAND.startLoop, startBossKills: BAND.bk, startRunXP: BAND.runXP, loopsToSimulate: 5, visitsShop: true, planning: PLAN, repeats: REPS, seed: `surv-${variant}` };
};
runs.push(mk('warrior', WARRIOR_ARMOR, 't1-defense', 'CONTROL', 't1-defense'));
for (const id of armorCands) if (id !== 't1-defense') runs.push(mk('warrior', WARRIOR_ARMOR, 't1-defense', id, id));
runs.push(mk('mage', MAGE_HEAL, 't1-water', 'CONTROL', 't1-water'));
for (const id of healCands) if (id !== 't1-water') runs.push(mk('mage', MAGE_HEAL, 't1-water', id, id));

writeFileSync('tests/audit/survival-swap-spec.json', JSON.stringify({ runs }, null, 1), 'utf-8');
console.log(`Wrote ${runs.length} survival swap runs (armor cands ${armorCands.length}, heal cands ${healCands.length}).`);
