// Role-aware re-analysis of swap-attrition-results.json. Judges each card by the
// metric appropriate to its ROLE, not damage alone:
//   OFFENSE (pure_damage,burn,poison,bleed,rage,scaling,detonators): dDmg (+ dWin)
//   SURVIVAL (armor,heal): dHp + dDeath (dDmg expected <=0 — NOT a flaw, per C3)
//   CONTROL (slow,stun): dWin + dDeath
// Only flags cards that fail their OWN role metric — avoids penalizing defense/
// control cards for low damage (the C3-protected race-losers).
import { readFileSync, writeFileSync } from 'node:fs';

const sums = JSON.parse(readFileSync('tests/audit/swap-attrition-results.json', 'utf-8')).summaries;
const cards = JSON.parse(readFileSync('tests/audit/val/cards-index.json', 'utf-8'));
const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
const OFFENSE = new Set(['pure_damage', 'burn', 'poison', 'bleed', 'rage', 'scaling', 'detonators']);
const SURVIVAL = new Set(['armor', 'heal']);
const CONTROL = new Set(['slow', 'stun']);
const roleOf = (arch) => OFFENSE.has(arch) ? 'offense' : SURVIVAL.has(arch) ? 'survival' : CONTROL.has(arch) ? 'control' : 'offense';

const cells = {};
for (const s of sums) {
  const [cellKey, variant] = s.id.split('__');
  const c = (cells[cellKey] ??= { control: null, cands: [] });
  const rec = { variant, dmg: s.avgDamageDealt, win: (s.bossesFaced?.['iron_golem']?.winRate ?? 0), hp: (s.bossesFaced?.['iron_golem']?.avgHpEnter ?? 0), death: s.deathRate };
  if (variant === 'CONTROL') c.control = rec; else c.cands.push(rec);
}

const rows = [];
for (const [cellKey, c] of Object.entries(cells)) {
  if (!c.control) continue;
  const arch = cellKey.split('|')[1];
  const role = roleOf(arch);
  for (const cand of c.cands) {
    const card = byId[cand.variant]; if (!card) continue;
    rows.push({
      cell: cellKey, role, id: cand.variant, name: card.name, tier: card.tier, cost: card.costStr, cd: card.cooldown,
      dDmg: cand.dmg - c.control.dmg, dWin: +(cand.win - c.control.win).toFixed(3),
      dHp: +(cand.hp - c.control.hp).toFixed(3), dDeath: +(cand.death - c.control.death).toFixed(3), peakOPS: card.peakOPS,
    });
  }
}

// genuine WEAK flags by role
const weakOffense = rows.filter((r) => r.role === 'offense' && r.dDmg <= 0 && r.dWin <= 0).sort((a, b) => a.dDmg - b.dDmg);
const weakSurvival = rows.filter((r) => r.role === 'survival' && r.dHp <= 0.01 && r.dDeath >= -0.01).sort((a, b) => a.dHp - b.dHp);
const weakControl = rows.filter((r) => r.role === 'control' && r.dWin <= 0 && r.dDeath >= -0.01).sort((a, b) => a.dWin - b.dWin);
// cards that actively HURT the deck (negative win in any role) — strongest signal
const harmful = rows.filter((r) => r.dWin <= -0.2).sort((a, b) => a.dWin - b.dWin);
// near-zero-output suspects (peakOPS 0)
const zeroOps = rows.filter((r) => (r.peakOPS ?? 0) === 0);

const fmt = (r) => `${r.id} "${r.name}" T${r.tier} [${r.cell}] cost ${r.cost} cd ${r.cd} | dDmg ${r.dDmg} dWin ${r.dWin} dHp ${r.dHp} dDeath ${r.dDeath} (peakOPS ${r.peakOPS})`;
let out = '# Role-aware per-card swap-test findings\n\n';
out += `Each card judged by its ROLE metric. Band=boss2(iron_golem), light planning. dDmg/dWin/dHp/dDeath = delta vs filler in matched baseline.\n\n`;
out += `## WEAK OFFENSE cards (offense role, dDmg<=0 AND dWin<=0) — ${weakOffense.length}\n\n` + weakOffense.map((r) => '- ' + fmt(r)).join('\n') + '\n\n';
out += `## WEAK SURVIVAL cards (armor/heal that DON'T improve cushion or death) — ${weakSurvival.length}\n\n` + weakSurvival.map((r) => '- ' + fmt(r)).join('\n') + '\n\n';
out += `## WEAK CONTROL cards (slow/stun that DON'T improve win or death) — ${weakControl.length}\n\n` + weakControl.map((r) => '- ' + fmt(r)).join('\n') + '\n\n';
out += `## HARMFUL cards (REDUCE win rate by >=0.2 in their own baseline) — ${harmful.length}\n\n` + harmful.map((r) => '- ' + fmt(r)).join('\n') + '\n\n';
out += `## peakOPS==0 (catalog says ~no offensive output) — ${zeroOps.length}\n\n` + zeroOps.map((r) => '- ' + fmt(r)).join('\n') + '\n';
writeFileSync('tests/audit/swap-roleaware-findings.md', out, 'utf-8');
console.log(`weakOffense=${weakOffense.length} weakSurvival=${weakSurvival.length} weakControl=${weakControl.length} harmful=${harmful.length} zeroOps=${zeroOps.length}`);
console.log(out);
