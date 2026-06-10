// Analyze survival-swap-results.json. Judge armor/heal cards by SURVIVAL deltas
// vs the control at the calibrated ~50%-death point: dDeath (down=better),
// dLoops (up=better), dHpBoss (up=better). Flag weak (no survival benefit) and
// tier violations (T3 below same-role T2 median survival).
import { readFileSync, writeFileSync } from 'node:fs';
const sums = JSON.parse(readFileSync('tests/audit/survival-swap-results.json', 'utf-8')).summaries;
const cards = JSON.parse(readFileSync('tests/audit/val/cards-index.json', 'utf-8'));
const byId = Object.fromEntries(cards.map((c) => [c.id, c]));

const byKey = {};
for (const s of sums) byKey[s.id] = s;
// survival index: loops cleared + survival fraction + HP cushion entering boss
const surv = (s) => {
  const hp = s.bossesFaced?.['desert_golem']?.avgHpEnter ?? 0;
  return +(s.avgLoopsCleared + (1 - s.deathRate) + hp).toFixed(3);
};

const groups = { armor: [], heal: [] };
for (const role of ['armor', 'heal']) {
  const ctrl = byKey[`${role}__CONTROL`]; if (!ctrl) continue;
  const cs = surv(ctrl);
  for (const s of sums) {
    if (!s.id.startsWith(role + '__') || s.id.endsWith('CONTROL')) continue;
    const id = s.id.split('__')[1]; const card = byId[id]; if (!card) continue;
    groups[role].push({
      id, name: card.name, tier: card.tier, cost: card.costStr, cd: card.cooldown,
      surv: surv(s), dSurv: +(surv(s) - cs).toFixed(3),
      death: s.deathRate, dDeath: +(s.deathRate - ctrl.deathRate).toFixed(3),
      loops: s.avgLoopsCleared, dLoops: +(s.avgLoopsCleared - ctrl.avgLoopsCleared).toFixed(2),
      ctrlSurv: cs, ctrlDeath: ctrl.deathRate,
    });
  }
}
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

let out = '# Survival-card swap-test (calibrated boss4-heavy, ~50% control death)\n\n';
for (const role of ['armor', 'heal']) {
  const rows = groups[role].sort((a, b) => b.dSurv - a.dSurv);
  const ctrlD = rows[0]?.ctrlDeath;
  out += `## ${role.toUpperCase()} (control death ${ctrlD}) — survival delta vs control (dSurv>0 = better survival)\n\n`;
  for (const r of rows) out += `- ${r.id} "${r.name}" T${r.tier} ${r.cost} cd${r.cd} | dSurv ${r.dSurv} (death ${r.death} dDeath ${r.dDeath}, loops ${r.loops} dLoops ${r.dLoops})\n`;
  // tier medians on survival
  const tmed = {};
  for (const r of rows) (tmed[`T${r.tier}`] ??= []).push(r.surv);
  for (const k in tmed) tmed[k] = median(tmed[k]);
  out += `\n  tier-median survival: T1 ${tmed.T1 ?? '--'} | T2 ${tmed.T2 ?? '--'} | T3 ${tmed.T3 ?? '--'}${(tmed.T2 != null && tmed.T3 != null && tmed.T3 < tmed.T2) ? '  <-- T3<T2' : ''}\n`;
  const weak = rows.filter((r) => r.dSurv <= 0);
  out += `\n  WEAK (no survival benefit vs control, dSurv<=0) — ${weak.length}: ${weak.map((r) => r.id).join(', ') || 'none'}\n`;
  const tv = rows.filter((r) => r.tier === 3 && tmed.T2 != null && r.surv < tmed.T2);
  out += `  T3<T2 (below same-role T2 median survival) — ${tv.length}: ${tv.map((r) => r.id).join(', ') || 'none'}\n\n`;
}
writeFileSync('tests/audit/survival-findings.md', out, 'utf-8');
console.log(out);
