// Analyze powerpass-swap-results.json against the synergy cells. Each candidate is
// judged by its cell's ROLE metric vs the TIER-PEER control (not Jab), and vs its
// same-cell tier-peers. Surfaces: weak (below the tier-peer control), tier
// violations (T3 below same-cell T2 median), oppressive (far above peers).
import { readFileSync, writeFileSync } from 'node:fs';
const cells = JSON.parse(readFileSync('tests/audit/power-pass-cells.json', 'utf-8'));
const sums = JSON.parse(readFileSync('tests/audit/powerpass-swap-results.json', 'utf-8')).summaries;
const cardArr = readFileSync('tests/audit/val/cards-index.json', 'utf-8');
const byId = Object.fromEntries(JSON.parse(cardArr).map((c) => [c.id, c]));
const ROT = ['doom_knight', 'iron_golem', 'bog_witch', 'desert_golem', 'infernal_dragon', 'boss_iron_golem'];
const BK = { boss1: 0, boss2: 1, boss3: 2, boss5: 4 };

// index results by id
const byKey = {};
for (const s of sums) byKey[s.id] = s;

function score(cell, s) {
  const boss = ROT[BK[cell.band] ?? 2];
  const bf = s.bossesFaced?.[boss] ?? { winRate: 0, avgHpEnter: 0 };
  if (cell.metric === 'damage') return { primary: s.avgDamageDealt, win: bf.winRate, hp: bf.avgHpEnter ?? 0, death: s.deathRate };
  if (cell.metric === 'survival') return { primary: +(((bf.avgHpEnter ?? 0) - s.deathRate).toFixed(3)), win: bf.winRate, hp: bf.avgHpEnter ?? 0, death: s.deathRate };
  return { primary: +((bf.winRate - s.deathRate).toFixed(3)), win: bf.winRate, hp: bf.avgHpEnter ?? 0, death: s.deathRate }; // control
}
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const rows = [];
cells.forEach((cell, idx) => {
  const ctrl = byKey[`cell${idx}__CONTROL`]; if (!ctrl) return;
  const cs = score(cell, ctrl);
  for (const cand of cell.candidates) {
    const s = byKey[`cell${idx}__${cand}`]; if (!s) continue;
    const card = byId[cand]; if (!card) continue;
    const v = score(cell, s);
    rows.push({
      cellIdx: idx, family: cell.family, class: cell.class, metric: cell.metric, band: cell.band,
      id: cand, name: card.name, tier: card.tier, cost: card.costStr, cd: card.cooldown,
      primary: v.primary, dPrimary: +(v.primary - cs.primary).toFixed(3),
      win: v.win, dWin: +(v.win - cs.win).toFixed(3), hp: v.hp, death: v.death,
      ctrlPrimary: cs.primary,
    });
  }
});

// tier medians within cell (on primary)
const cellTier = {};
for (const r of rows) (cellTier[`${r.cellIdx}|T${r.tier}`] ??= []).push(r.primary);
for (const k in cellTier) cellTier[k] = median(cellTier[k]);

// flags
const weak = rows.filter((r) => r.dPrimary < 0).sort((a, b) => a.dPrimary - b.dPrimary);
const tierViol = rows.filter((r) => { if (r.tier !== 3) return false; const t2 = cellTier[`${r.cellIdx}|T2`]; return t2 != null && r.primary < t2; })
  .sort((a, b) => (a.primary - cellTier[`${a.cellIdx}|T2`]) - (b.primary - cellTier[`${b.cellIdx}|T2`]));
const oppressive = rows.filter((r) => r.dWin >= 0.35 || (r.metric === 'damage' && r.dPrimary > 500)).sort((a, b) => b.dPrimary - a.dPrimary);

const fmt = (r) => `${r.id} "${r.name}" T${r.tier} [${r.family}|${r.class}] ${r.cost} cd${r.cd} | ${r.metric}:${r.primary} (vs ctrl ${r.ctrlPrimary}, d=${r.dPrimary}) dWin ${r.dWin}`;
let out = '# Power-pass per-card findings (synergy-matched, tier-peer control, role-aware)\n\n';
out += `${rows.length} candidates across ${cells.length} cells. Judged by cell metric vs a TIER-PEER control (not Jab), inside the card's synergy substrate.\n\n`;
out += `## WEAK vs tier-peer control (dPrimary < 0) — ${weak.length}\n\n` + weak.map((r) => '- ' + fmt(r)).join('\n') + '\n\n';
out += `## TIER VIOLATIONS (T3 below same-cell T2 median on role metric) — ${tierViol.length}\n\n` + tierViol.map((r) => `- ${r.id} "${r.name}" T3 [${r.family}|${r.class}] ${r.metric}:${r.primary} < T2-median ${cellTier[`${r.cellIdx}|T2`]} (d=${(r.primary - cellTier[`${r.cellIdx}|T2`]).toFixed(1)}) ${r.cost} cd${r.cd}`).join('\n') + '\n\n';
out += `## OPPRESSIVE (dWin>=0.35 or huge dDmg) — ${oppressive.length}\n\n` + oppressive.map((r) => '- ' + fmt(r)).join('\n') + '\n';
writeFileSync('tests/audit/powerpass-findings.md', out, 'utf-8');
console.log(`weak=${weak.length} tierViol=${tierViol.length} oppressive=${oppressive.length}`);
console.log(out);
