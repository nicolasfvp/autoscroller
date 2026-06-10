// Controlled boss A/B probe: for each boss band, run MIXED reference decks (both
// classes) vs the boss at baseline and under candidate nerf variants (behavior
// patches), light planning, attrition. Lets us find the minimal per-boss nerf
// that makes warriors viable without trivializing mages — keeping the curve
// "pressured but passable" (Moderate target).
import { readFileSync, writeFileSync } from 'node:fs';

const reps = Number(process.argv[2] ?? 16);
const decksPerCell = Number(process.argv[3] ?? 6);
const lib = JSON.parse(readFileSync('tests/audit/val/decks-v2-full.json', 'utf-8')).decks;

const BANDS = {
  boss1: { startLoop: 7,  bk: 0, runXP: 480,  boss: 'doom_knight' },
  boss2: { startLoop: 17, bk: 1, runXP: 1000, boss: 'iron_golem' },
  boss3: { startLoop: 27, bk: 2, runXP: 1550, boss: 'bog_witch' },
  boss4: { startLoop: 37, bk: 3, runXP: 2100, boss: 'desert_golem' },
  boss5: { startLoop: 47, bk: 4, runXP: 2700, boss: 'infernal_dragon' },
  boss6: { startLoop: 57, bk: 5, runXP: 3300, boss: 'boss_iron_golem' },
  boss7: { startLoop: 67, bk: 6, runXP: 4200, boss: 'doom_knight' },
};

// Candidate nerf variants per boss id. Each is an enemyOverrides payload for that boss.
// Keep mechanics varied; tune DAMAGE / shield / drain / multi_hit magnitudes + fix hard-counters.
const VARIANTS = {
  doom_knight: { base: null },
  iron_golem: {
    base: null,
    'shield5': { behaviorPatch: [{ type: 'shield', shieldAmount: 5 }] },
    'shield4+mh0.5': { behaviorPatch: [{ type: 'shield', shieldAmount: 4 }, { type: 'multi_hit', damageMultiplier: 0.5 }] },
  },
  bog_witch: {
    base: null,
    'drain15': { behaviorPatch: [{ type: 'drain', healPercent: 15 }] },
    'drain12+mhoff': { behaviorPatch: [{ type: 'drain', healPercent: 12 }], multiHitOff: true },
  },
  desert_golem: {
    base: null,
    'attackAffinity': { affinity: 'attack' },
    'attackAff+shield6': { affinity: 'attack', behaviorPatch: [{ type: 'shield', shieldAmount: 6 }] },
  },
  infernal_dragon: {
    base: null,
    'dmg7': { attackDamage: 7 },
    'mh2': { behaviorPatch: [{ type: 'multi_hit', hitCount: 2 }] },
    'dmg7+mh0.4': { attackDamage: 7, behaviorPatch: [{ type: 'multi_hit', damageMultiplier: 0.4 }] },
  },
  boss_iron_golem: {
    base: null,
    'shield6+dmg10': { attackDamage: 10, behaviorPatch: [{ type: 'shield', shieldAmount: 6 }] },
    'shield6+mhoff': { multiHitOff: true, behaviorPatch: [{ type: 'shield', shieldAmount: 6 }] },
  },
};

// mixed reference decks per band per class
const pick = (stage, cls) => lib.filter((d) => d.stage === stage && d.class === cls && d.quality === 'mixed').slice(0, decksPerCell);

const runs = [];
for (const stage of Object.keys(BANDS)) {
  const band = BANDS[stage];
  const boss = band.boss;
  const variants = VARIANTS[boss] ?? { base: null };
  for (const cls of ['warrior', 'mage']) {
    const decks = pick(stage, cls);
    for (const d of decks) {
      for (const [vname, ovr] of Object.entries(variants)) {
        runs.push({
          id: `${stage}-${cls}-${d.id}-${vname}`,
          class: cls, quality: 'mixed', stage, boss, variant: vname, archetype: d.archetype ?? 'mixed',
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
writeFileSync('tests/audit/boss-probe-spec.json', JSON.stringify({ runs }, null, 1), 'utf-8');
console.log(`Wrote ${runs.length} boss-probe runs.`);
