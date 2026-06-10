// Analyze boss-probe-results.json: per boss, per class, per variant -> mean boss winRate.
// Goal: find the minimal nerf variant that lifts WARRIOR to viable (~>=60%) without
// pushing MAGE to trivial (>~95%), keeping the curve "pressured but passable".
import { readFileSync } from 'node:fs';
const path = process.argv[2] ?? 'tests/audit/boss-probe-results.json';
const sums = JSON.parse(readFileSync(path, 'utf-8')).summaries;

// group: boss|variant|class -> winrates for that boss
const g = {};
for (const s of sums) {
  const m = s.meta ?? {};
  const boss = m.boss; const variant = m.variant; const cls = m.class;
  if (!boss) continue;
  const bf = s.bossesFaced?.[boss];
  if (!bf || bf.reached === 0) continue;
  const key = `${boss}|${variant}|${cls}`;
  (g[key] ??= []).push(bf.winRate);
}
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const pct = (x) => x == null ? ' -- ' : (x * 100).toFixed(0).padStart(3) + '%';

// collect bosses and their variants in spec order
const bosses = {};
for (const s of sums) { const m = s.meta ?? {}; if (!m.boss) continue; (bosses[m.boss] ??= new Set()).add(m.variant); }

console.log('# Boss A/B probe — mixed reference decks, light planning, attrition');
console.log('# cell = boss winRate (warrior / mage)\n');
for (const boss of Object.keys(bosses)) {
  console.log(`## ${boss}`);
  for (const variant of [...bosses[boss]]) {
    const w = mean(g[`${boss}|${variant}|warrior`] ?? []);
    const m = mean(g[`${boss}|${variant}|mage`] ?? []);
    const tag = variant === 'base' ? '(baseline)' : '';
    console.log(`  ${String(variant).padEnd(18)} W ${pct(w)}  M ${pct(m)}  ${tag}`);
  }
  console.log('');
}
