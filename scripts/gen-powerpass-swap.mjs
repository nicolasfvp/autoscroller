// Convert power-pass-cells.json (synergy-matched baselines + tier-peer controls)
// into loop-attrition swap-test run-specs. Per cell: CONTROL (filler in swapSlot)
// + one run per candidate (candidate in swapSlot), at the cell's band + pressure.
import { readFileSync, writeFileSync } from 'node:fs';
const cells = JSON.parse(readFileSync('tests/audit/power-pass-cells.json', 'utf-8'));
const REPS = 12;
const BAND = {
  boss1: { startLoop: 7, bk: 0, runXP: 480 },
  boss2: { startLoop: 17, bk: 1, runXP: 1000 },
  boss3: { startLoop: 27, bk: 2, runXP: 1550 },
  boss5: { startLoop: 47, bk: 4, runXP: 2700 },
};
const PLAN = (p) => ({ terrainPool: ['desert', 'graveyard', 'swamp', 'lava', 'forest'], tilesPerLoop: p === 'moderate' ? 2 : 1 });

const runs = [];
cells.forEach((cell, idx) => {
  const b = BAND[cell.band] ?? BAND.boss3;
  const plan = PLAN(cell.pressure);
  const mk = (variant, slotCard) => {
    const deck = [...cell.baseline];
    deck[cell.swapSlot ?? 0] = slotCard;
    return {
      id: `cell${idx}__${variant}`, class: cell.class, quality: cell.metric, stage: cell.band,
      archetype: cell.family, variant, boss: cell.boss,
      deck, startLoop: b.startLoop, startBossKills: b.bk, startRunXP: b.runXP,
      loopsToSimulate: 5, visitsShop: true, planning: plan, repeats: REPS, seed: `pp${idx}-${variant}`,
    };
  };
  runs.push(mk('CONTROL', cell.fillerControl));
  for (const c of cell.candidates) runs.push(mk(c, c));
});
writeFileSync('tests/audit/powerpass-swap-spec.json', JSON.stringify({ runs }, null, 1), 'utf-8');
console.log(`Wrote ${runs.length} power-pass swap runs across ${cells.length} cells.`);
