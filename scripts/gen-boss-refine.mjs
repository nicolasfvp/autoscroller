// Refinement probe for the two problem bosses (infernal_dragon, boss_iron_golem):
// larger deck sample (all qualities) per class + finer / affinity-targeted variants.
import { readFileSync, writeFileSync } from 'node:fs';
const reps = Number(process.argv[2] ?? 20);
const lib = JSON.parse(readFileSync('tests/audit/val/decks-v2-full.json', 'utf-8')).decks;

const BANDS = {
  boss5: { startLoop: 47, bk: 4, runXP: 2700, boss: 'infernal_dragon' },
  boss6: { startLoop: 57, bk: 5, runXP: 3300, boss: 'boss_iron_golem' },
};
const VARIANTS = {
  infernal_dragon: {
    base: null,
    'dmg8': { attackDamage: 8 },
    'mh0.4': { behaviorPatch: [{ type: 'multi_hit', damageMultiplier: 0.4 }] },
    'dmg8+mh0.4': { attackDamage: 8, behaviorPatch: [{ type: 'multi_hit', damageMultiplier: 0.4 }] },
    'enrage1.25': { behaviorPatch: [{ type: 'enrage', attackSpeedMultiplier: 1.25 }] },
  },
  boss_iron_golem: {
    base: null,
    'shield6+dmg10': { attackDamage: 10, behaviorPatch: [{ type: 'shield', shieldAmount: 6 }] },
    'affAttack': { affinity: 'attack' },
    'affAttack+shield6': { affinity: 'attack', behaviorPatch: [{ type: 'shield', shieldAmount: 6 }] },
    'affAttack+shield6+dmg10': { affinity: 'attack', attackDamage: 10, behaviorPatch: [{ type: 'shield', shieldAmount: 6 }] },
    'affNull+shield8': { affinity: null, behaviorPatch: [{ type: 'shield', shieldAmount: 8 }] },
  },
};

// up to 10 decks/class across ALL qualities for a stable sample
const pick = (stage, cls) => lib.filter((d) => d.stage === stage && d.class === cls).slice(0, 10);

const runs = [];
for (const stage of Object.keys(BANDS)) {
  const band = BANDS[stage]; const boss = band.boss;
  for (const cls of ['warrior', 'mage']) {
    for (const d of pick(stage, cls)) {
      for (const [vname, ovr] of Object.entries(VARIANTS[boss])) {
        runs.push({
          id: `${stage}-${cls}-${d.id}-${vname}`,
          class: cls, quality: d.quality, stage, boss, variant: vname, archetype: d.archetype ?? 'mixed',
          deck: d.deck,
          startLoop: band.startLoop, startBossKills: band.bk, startRunXP: band.runXP,
          loopsToSimulate: 5, visitsShop: true,
          planning: { terrainPool: ['desert','graveyard','swamp','lava','forest'], tilesPerLoop: 1 },
          repeats: reps, seed: `${d.id}-${vname}`,
          ...(ovr ? { enemyOverrides: { [boss]: ovr } } : {}),
        });
      }
    }
  }
}
writeFileSync('tests/audit/boss-refine-spec.json', JSON.stringify({ runs }, null, 1), 'utf-8');
console.log(`Wrote ${runs.length} refine runs.`);
