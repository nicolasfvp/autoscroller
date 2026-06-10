// Calibrate the SURVIVAL swap-test pressure point. We need a deck that CAN kill
// (enough offense) but is HP-stressed, so the control (a mid survival card) dies
// ~40-60% — only then can a single armor/heal card's survival delta be measured.
// Sweep band x planning for control-only runs; pick the ~50%-death cell.
import { writeFileSync } from 'node:fs';

// offense-capable + survival-substrate baselines; swap slot = 1 (early, fires each cycle)
const WARRIOR_ARMOR = ['t1-attack', 'SWAP', 't2-attack-attack', 't3-agility-attack-attack', 't1-defense', 't2-attack-defense', 't2-attack-fire', 't2-counter-earth', 't3-earth-earth-earth', 't2-agility-agility'];
const MAGE_HEAL = ['t1-fire', 'SWAP', 't2-fire-water', 't2-attack-fire', 't2-agility-fire', 't3-agility-fire-fire', 't1-water', 't2-air-water', 't3-water-water-water', 't2-earth-water'];
// mid tier-peer survival controls
const WARRIOR_CTRL = 't1-defense'; // Guard: gain armor (clean low-mid armor unit)
const MAGE_CTRL = 't1-water';      // Mend: heal (clean low-mid heal unit)

const BANDS = { boss3: { startLoop: 27, bk: 2, runXP: 1550 }, boss4: { startLoop: 37, bk: 3, runXP: 2100 }, boss5: { startLoop: 47, bk: 4, runXP: 2700 } };
const PLANS = { moderate: 2, heavy: 3 };

const runs = [];
const mk = (id, cls, baseline, ctrl, band, planN) => {
  const deck = baseline.map((c) => c === 'SWAP' ? ctrl : c);
  const b = BANDS[band];
  return { id, class: cls, quality: 'survival-calib', stage: band, archetype: 'calib', variant: 'CONTROL', boss: '',
    deck, startLoop: b.startLoop, startBossKills: b.bk, startRunXP: b.runXP, loopsToSimulate: 5, visitsShop: true,
    planning: { terrainPool: ['desert', 'graveyard', 'swamp', 'lava', 'forest'], tilesPerLoop: planN }, repeats: 24, seed: id };
};
for (const band of Object.keys(BANDS)) for (const [pn, pv] of Object.entries(PLANS)) {
  runs.push(mk(`warr-${band}-${pn}`, 'warrior', WARRIOR_ARMOR, WARRIOR_CTRL, band, pv));
  runs.push(mk(`mage-${band}-${pn}`, 'mage', MAGE_HEAL, MAGE_CTRL, band, pv));
}
writeFileSync('tests/audit/survival-calib-spec.json', JSON.stringify({ runs }, null, 1), 'utf-8');
console.log(`Wrote ${runs.length} survival-calibration runs.`);
