// Generate the full attrition validation matrix spec for loop-attrition-sim.test.ts.
// Builds run-specs over: deck quality (random/naive/optimized/mixed) x class x
// planning (light/moderate) x depth band (the 7 REAL boss bands). Each run starts
// a few loops before a boss with depth-appropriate runXP/bossKills and simulates
// forward through the boss. Uses the REAL 6-boss rotation (NO lizard_king).
//
// Usage: node scripts/gen-attrition-matrix.mjs [decksPerCell] [reps]
import { readFileSync, writeFileSync } from 'node:fs';

const decksPerCell = Number(process.argv[2] ?? 6);
const reps = Number(process.argv[3] ?? 12);

const lib = JSON.parse(readFileSync('tests/audit/val/decks-v2-full.json', 'utf-8')).decks;

// stage -> band params. startLoop = bossLoop-3, sim 5 loops to clear the boss.
// runXP anchored to stage-model (~moderate planning); sim adds forward XP per kill.
const BANDS = {
  boss1: { startLoop: 7,  bk: 0, runXP: 480,  boss: 'doom_knight' },
  boss2: { startLoop: 17, bk: 1, runXP: 1000, boss: 'iron_golem' },
  boss3: { startLoop: 27, bk: 2, runXP: 1550, boss: 'bog_witch' },
  boss4: { startLoop: 37, bk: 3, runXP: 2100, boss: 'desert_golem' },
  boss5: { startLoop: 47, bk: 4, runXP: 2700, boss: 'infernal_dragon' },
  boss6: { startLoop: 57, bk: 5, runXP: 3300, boss: 'boss_iron_golem' },
  boss7: { startLoop: 67, bk: 6, runXP: 4200, boss: 'doom_knight' }, // rotation wraps
};

const TERRAINS = ['desert', 'graveyard', 'swamp', 'lava', 'forest'];
const PLANS = {
  light:    { terrainPool: TERRAINS, tilesPerLoop: 1 },
  moderate: { terrainPool: TERRAINS, tilesPerLoop: 2 },
};

// bucket decks by stage|class|quality
const buckets = {};
for (const d of lib) {
  if (!BANDS[d.stage]) continue;
  const key = `${d.stage}|${d.class}|${d.quality}`;
  (buckets[key] ??= []).push(d);
}

const runs = [];
let thin = [];
for (const stage of Object.keys(BANDS)) {
  const band = BANDS[stage];
  for (const cls of ['warrior', 'mage']) {
    for (const quality of ['random', 'naive', 'optimized', 'mixed']) {
      const pool = buckets[`${stage}|${cls}|${quality}`] ?? [];
      if (pool.length === 0) { thin.push(`${stage}|${cls}|${quality}: 0 decks`); continue; }
      if (pool.length < decksPerCell) thin.push(`${stage}|${cls}|${quality}: only ${pool.length}`);
      const sample = pool.slice(0, decksPerCell);
      for (const d of sample) {
        for (const planName of Object.keys(PLANS)) {
          runs.push({
            id: `${d.id}__${planName}`,
            class: cls,
            quality,
            stage,
            archetype: d.archetype ?? 'mixed',
            deck: d.deck,
            startLoop: band.startLoop,
            startBossKills: band.bk,
            startRunXP: band.runXP,
            loopsToSimulate: 5,
            visitsShop: true,
            planning: PLANS[planName],
            repeats: reps,
            seed: `${d.id}-${planName}`,
          });
        }
      }
    }
  }
}

writeFileSync('tests/audit/attrition-matrix-spec.json', JSON.stringify({ runs }, null, 1), 'utf-8');
console.log(`Wrote ${runs.length} run-specs (decksPerCell=${decksPerCell}, reps=${reps}).`);
if (thin.length) console.log(`Thin/empty cells (${thin.length}):\n  ` + thin.join('\n  '));
