// Full per-archetype MARGINAL-VALUE swap test under ATTRITION.
// For each archetype, build a matched baseline (class starter + top-peakOPS core of
// that archetype), then for every card whose PRIMARY archetype is that archetype,
// emit CONTROL (filler in slot) + CAND_<id> (card in slot) run-specs through a mid
// boss band under light planning. The candidate's marginal value = its deltas vs
// the control (avgDamageDealt is the cleanest signal; bossWin/hpEnter secondary).
import { readFileSync, writeFileSync } from 'node:fs';

const cards = JSON.parse(readFileSync('tests/audit/val/cards-index.json', 'utf-8'));
const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
const WARRIOR_STARTER = ['t1-attack', 't1-defense', 't2-attack-defense', 't2-agility-agility', 't2-attack-fire'];
const MAGE_STARTER = ['t1-fire', 't1-water', 't2-fire-water', 't2-air-earth', 't2-attack-fire'];

// class of a card by its resource (stamina->warrior, mana->mage, both/free->either; default mage for magic)
const classOf = (c) => c.resource === 'stamina' ? 'warrior' : c.resource === 'mana' ? 'mage' : (c.category === 'attack' || c.category === 'defense' ? 'warrior' : 'mage');

// primary archetype = first tag (fallback to category)
const primaryArch = (c) => (c.archetypes && c.archetypes[0]) ? c.archetypes[0] : c.category;

// group cards by (class, primary archetype) so each card is tested in a matched
// deck of ITS OWN class — a mana burn card lands in a mage burn baseline, not warrior.
const groups = {};
for (const c of cards) {
  const key = `${classOf(c)}|${primaryArch(c)}`;
  (groups[key] ??= []).push(c);
}

// build a matched baseline for a (class, archetype) cell: class starter + top-peakOPS
// core of that cell, padded with the class's best same-archetype/any cards if thin.
function buildBaseline(cls, arch, members) {
  const starter = cls === 'warrior' ? WARRIOR_STARTER : MAGE_STARTER;
  let core = members
    .filter((c) => c.tier >= 2 && classOf(c) === cls)
    .sort((a, b) => (b.peakOPS ?? 0) - (a.peakOPS ?? 0))
    .slice(0, 5)
    .map((c) => c.id);
  // pad thin cores with the class's highest-peakOPS cards sharing this archetype tag
  if (core.length < 4) {
    const extra = cards
      .filter((c) => classOf(c) === cls && c.tier >= 2 && (c.archetypes ?? []).includes(arch) && !core.includes(c.id) && !starter.includes(c.id))
      .sort((a, b) => (b.peakOPS ?? 0) - (a.peakOPS ?? 0))
      .map((c) => c.id);
    core = [...core, ...extra].slice(0, 5);
  }
  return { cls, baseline: [...starter, ...core], filler: cls === 'warrior' ? 't1-attack' : 't1-fire' };
}

// mid reference band (iron_golem boss2): bk1, light planning, post-heal-fix
const BAND = { startLoop: 17, bk: 1, runXP: 1000, boss: 'iron_golem' };
const PLAN = { terrainPool: ['desert', 'graveyard', 'swamp', 'lava', 'forest'], tilesPerLoop: 1 };
const REPS = 10;

const runs = [];
const baselines = {};
for (const [key, members] of Object.entries(groups)) {
  const [cls, arch] = key.split('|');
  const { baseline, filler } = buildBaseline(cls, arch, members);
  baselines[key] = { cls, arch, baseline, filler, candidates: members.length };
  const mk = (id, slotCard, cardId) => {
    const deck = [...baseline]; deck[1] = slotCard;
    return {
      id, class: cls, quality: 'swaptest', stage: 'boss2', archetype: arch, variant: cardId, boss: BAND.boss,
      deck, startLoop: BAND.startLoop, startBossKills: BAND.bk, startRunXP: BAND.runXP,
      loopsToSimulate: 4, visitsShop: true, planning: PLAN, repeats: REPS, seed: `${key}-${cardId}`,
    };
  };
  runs.push(mk(`${key}__CONTROL`, filler, 'CONTROL'));
  for (const c of members) runs.push(mk(`${key}__${c.id}`, c.id, c.id));
}

writeFileSync('tests/audit/swap-attrition-spec.json', JSON.stringify({ runs }, null, 1), 'utf-8');
writeFileSync('tests/audit/swap-attrition-baselines.json', JSON.stringify(baselines, null, 2), 'utf-8');
console.log(`Wrote ${runs.length} swap-test runs across ${Object.keys(groups).length} (class,archetype) cells.`);
for (const [k, b] of Object.entries(baselines)) console.log(`  ${k.padEnd(20)} cands=${String(b.candidates).padStart(3)} baseline=${b.baseline.join(',')}`);
