// Analyze swap-attrition-results.json: per (class,archetype) cell, each candidate's
// MARGINAL value vs the cell CONTROL (filler). Flags: dead/weak (<=filler), tier
// violations (T3 below same-cell T2 median), and oppressive (huge positive delta).
import { readFileSync, writeFileSync } from 'node:fs';

const sums = JSON.parse(readFileSync('tests/audit/swap-attrition-results.json', 'utf-8')).summaries;
const cards = JSON.parse(readFileSync('tests/audit/val/cards-index.json', 'utf-8'));
const byId = Object.fromEntries(cards.map((c) => [c.id, c]));

// index summaries by cell + variant. id = `${cls}|${arch}__${variant}`
const cells = {};
for (const s of sums) {
  const m = s.meta ?? {};
  const [cellKey, variant] = s.id.split('__');
  const c = (cells[cellKey] ??= { control: null, cands: [] });
  const rec = {
    variant, dmg: s.avgDamageDealt, win: (s.bossesFaced?.['iron_golem']?.winRate ?? 0),
    hp: (s.bossesFaced?.['iron_golem']?.avgHpEnter ?? 0), death: s.deathRate,
  };
  if (variant === 'CONTROL') c.control = rec; else c.cands.push(rec);
}

const rows = [];
for (const [cellKey, c] of Object.entries(cells)) {
  if (!c.control) continue;
  const ctrl = c.control;
  for (const cand of c.cands) {
    const card = byId[cand.variant];
    if (!card) continue;
    rows.push({
      cell: cellKey, id: cand.variant, name: card.name, tier: card.tier,
      cost: card.costStr, cd: card.cooldown,
      dDmg: cand.dmg - ctrl.dmg, dWin: +(cand.win - ctrl.win).toFixed(3),
      dHp: +(cand.hp - ctrl.hp).toFixed(3), dDeath: +(cand.death - ctrl.death).toFixed(3),
      absDmg: cand.dmg, peakOPS: card.peakOPS,
    });
  }
}

// tier medians per cell (by dDmg) for T3<T2 detection
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const cellTierMed = {};
for (const r of rows) {
  const k = `${r.cell}|T${r.tier}`;
  (cellTierMed[k] ??= []).push(r.dDmg);
}
for (const k of Object.keys(cellTierMed)) cellTierMed[k] = median(cellTierMed[k]);

// flags
const dead = rows.filter((r) => r.dDmg <= 0).sort((a, b) => a.dDmg - b.dDmg);
const tierViol = rows.filter((r) => {
  if (r.tier !== 3) return false;
  const t2 = cellTierMed[`${r.cell}|T2`];
  return t2 != null && r.dDmg < t2 - 1; // T3 marginal value below the T2 median in its own cell
}).sort((a, b) => (a.dDmg - (cellTierMed[`${a.cell}|T2`] ?? 0)) - (b.dDmg - (cellTierMed[`${b.cell}|T2`] ?? 0)));
// oppressive: top dDmg, or near-100% win where control is much lower
const oppressive = rows.filter((r) => r.dWin >= 0.4 || r.dDmg > 600).sort((a, b) => b.dDmg - a.dDmg);

let out = '# Per-card swap-test (attrition) — marginal value vs filler control\n\n';
out += `${rows.length} cards across ${Object.keys(cells).length} (class,archetype) cells. dDmg = damage delta vs filler in same matched baseline; band=boss2(iron_golem), light planning, 10 reps.\n\n`;

out += `## DEAD / WEAK cards (marginal damage <= filler) — ${dead.length}\n\n`;
for (const r of dead) out += `- ${r.id} "${r.name}" T${r.tier} [${r.cell}] cost ${r.cost} cd ${r.cd} | dDmg ${r.dDmg} dWin ${r.dWin} (peakOPS ${r.peakOPS})\n`;

out += `\n## TIER VIOLATIONS (T3 marginal value < same-cell T2 median) — ${tierViol.length}\n\n`;
for (const r of tierViol) { const t2 = cellTierMed[`${r.cell}|T2`]; out += `- ${r.id} "${r.name}" T3 [${r.cell}] dDmg ${r.dDmg} vs T2-median ${t2} (gap ${(r.dDmg - t2).toFixed(0)}) cost ${r.cost} cd ${r.cd}\n`; }

out += `\n## OPPRESSIVE candidates (dWin>=0.40 or dDmg>600) — ${oppressive.length}\n\n`;
for (const r of oppressive.slice(0, 25)) out += `- ${r.id} "${r.name}" T${r.tier} [${r.cell}] dDmg ${r.dDmg} dWin ${r.dWin} cost ${r.cost} cd ${r.cd}\n`;

out += `\n## Cell tier-median marginal damage (T1/T2/T3 should ascend)\n\n`;
const cellKeys = [...new Set(rows.map((r) => r.cell))];
for (const ck of cellKeys) {
  const t1 = cellTierMed[`${ck}|T1`], t2 = cellTierMed[`${ck}|T2`], t3 = cellTierMed[`${ck}|T3`];
  out += `- ${ck.padEnd(20)} T1 ${t1 ?? '--'} | T2 ${t2 ?? '--'} | T3 ${t3 ?? '--'}${(t2 != null && t3 != null && t3 < t2) ? '   <-- T3<T2!' : ''}\n`;
}

writeFileSync('tests/audit/swap-attrition-analysis.md', out, 'utf-8');
console.log(out);
