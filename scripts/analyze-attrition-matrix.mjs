// Aggregate attrition-matrix-results.json into the build-quality x depth gradient,
// per-boss win rates, per-enemy death walls, and concern flags.
// Usage: node scripts/analyze-attrition-matrix.mjs [resultsPath]
import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2] ?? 'tests/audit/attrition-matrix-results.json';
const data = JSON.parse(readFileSync(path, 'utf-8'));
const sums = data.summaries;

const BAND_BOSS = {
  boss1: 'doom_knight', boss2: 'iron_golem', boss3: 'bog_witch', boss4: 'desert_golem',
  boss5: 'infernal_dragon', boss6: 'boss_iron_golem', boss7: 'doom_knight',
};
const STAGES = ['boss1','boss2','boss3','boss4','boss5','boss6','boss7'];
const QUALITIES = ['random','naive','optimized','mixed'];
const PLANS = ['light','moderate'];

// group: stage|class|quality|plan -> aggregate
const cell = {};
const planOf = (s) => s.id.endsWith('moderate') ? 'moderate' : 'light';
for (const s of sums) {
  const stage = s.meta?.stage; const cls = s.meta?.class; const q = s.meta?.quality; const plan = planOf(s);
  if (!stage) continue;
  const boss = BAND_BOSS[stage];
  const bf = s.bossesFaced?.[boss];
  const key = `${stage}|${cls}|${q}|${plan}`;
  const c = (cell[key] ??= { n:0, bossWin:[], reach:[], death:[], hpEnter:[] });
  c.n++;
  c.death.push(s.deathRate);
  if (bf && bf.reached > 0) { c.bossWin.push(bf.winRate); c.reach.push(bf.reached/s.repeats); if (bf.avgHpEnter!=null) c.hpEnter.push(bf.avgHpEnter); }
}
const mean = (a) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const f = (x) => x==null ? ' -- ' : (x*100).toFixed(0).padStart(3)+'%';

// per-enemy death histogram (who kills builds)
const deaths = {};
for (const s of sums) for (const [e,n] of Object.entries(s.deathEnemyHistogram ?? {})) deaths[e]=(deaths[e]||0)+n;
const deathRank = Object.entries(deaths).sort((a,b)=>b[1]-a[1]);

let out = '# Attrition matrix — build-quality x depth gradient\n\n';
out += `Source: ${path} (${sums.length} cells)\n\n`;
for (const plan of PLANS) {
  for (const cls of ['warrior','mage']) {
    out += `## ${cls.toUpperCase()} — planning=${plan}  (cell = boss winRate / run deathRate)\n\n`;
    out += 'stage  | ' + QUALITIES.map(q=>q.padEnd(11)).join('| ') + '\n';
    out += '-------|' + QUALITIES.map(()=>'------------').join('|') + '\n';
    for (const stage of STAGES) {
      const row = [stage.padEnd(6)];
      for (const q of QUALITIES) {
        const c = cell[`${stage}|${cls}|${q}|${plan}`];
        if (!c) { row.push('   (none)  '); continue; }
        row.push(`${f(mean(c.bossWin))}/${f(mean(c.death))}`.padEnd(11));
      }
      out += row.join('| ') + '\n';
    }
    out += '\n';
  }
}

out += '## Top death-cause enemies (across all matrix runs)\n\n';
for (const [e,n] of deathRank.slice(0,20)) out += `- ${e}: ${n}\n`;

// concern flags vs Moderate target
out += '\n## Concern flags (vs Moderate target: easy early; random walls mid; optimized comfortable; depth=mastery)\n\n';
const flags = [];
for (const key of Object.keys(cell)) {
  const [stage,cls,q,plan] = key.split('|');
  const c = cell[key];
  const bw = mean(c.bossWin); const dr = mean(c.death);
  if (plan==='light') {
    if (q==='optimized' && bw!=null && bw < 0.5) flags.push(`WEAK: optimized ${cls} ${stage} (light) boss win ${f(bw)} — optimized should be comfortable`);
    if (stage==='boss1' && bw!=null && bw < 0.7) flags.push(`HARD FIRST BOSS: ${q} ${cls} boss1 (light) win ${f(bw)} — first boss should be easy`);
    if (q==='random' && stage>='boss4' && bw!=null && bw > 0.6) flags.push(`TOO EASY DEEP: random ${cls} ${stage} (light) win ${f(bw)} — random should fail deep`);
  }
}
out += flags.length ? flags.map(x=>'- '+x).join('\n') : '(none)';
out += '\n';

writeFileSync('tests/audit/attrition-matrix-analysis.md', out, 'utf-8');
console.log(out);
