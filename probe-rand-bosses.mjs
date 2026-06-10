import { readFileSync } from 'node:fs';
const data = JSON.parse(readFileSync('tests/audit/val/results-v2.json','utf-8'));
const results = data.results ?? data;
// All RANDOM boss matchups: did random decks beat every boss?
const rb = results.filter(r=>r.isBoss && (r.archetype==='random'||r.archetype==='random-chaotic'));
const byBoss={};
for(const r of rb){
  (byBoss[r.enemy] ??= []).push(r);
}
console.log('boss              nRandDecks  meanWinRate  nFullWin  nAnyLoss  meanCushionOnWin');
const order=['doom_knight','iron_golem','lizard_king','bog_witch','desert_golem','infernal_dragon','boss_iron_golem'];
for(const b of order){
  const arr=byBoss[b]; if(!arr){console.log(b,'NONE');continue;}
  const mw=arr.reduce((a,r)=>a+r.winRate,0)/arr.length;
  const full=arr.filter(r=>r.winRate>=1).length;
  const loss=arr.filter(r=>r.winRate<1).length;
  const cush=arr.filter(r=>r.avgHeroHpPctOnWin!=null);
  const mc=cush.length? cush.reduce((a,r)=>a+r.avgHeroHpPctOnWin,0)/cush.length : null;
  console.log(b.padEnd(17), String(arr.length).padStart(10), mw.toFixed(3).padStart(12), String(full).padStart(9), String(loss).padStart(9), mc!=null?mc.toFixed(3).padStart(17):'   n/a');
}

// Self-consistency: are these DIFFERENT decks per boss, or are boss7 decks generated independently?
console.log('\n=== Are boss7 random decks the SAME decks that beat boss1? (self-consistency) ===');
const b1ids = rb.filter(r=>r.enemy==='doom_knight').map(r=>r.id.split('__vs__')[0]);
const b7ids = rb.filter(r=>r.enemy==='boss_iron_golem').map(r=>r.id.split('__vs__')[0]);
console.log('boss1 random deck ids:', b1ids.slice(0,6).join(', '));
console.log('boss7 random deck ids:', b7ids.slice(0,6).join(', '));
const overlap = b1ids.filter(id=>b7ids.includes(id));
console.log('overlap (same deck tested at both boss1 AND boss7):', overlap.length);

// boss base HP sanity: compare scaledHP recorded vs the unscaled base
console.log('\n=== recorded enemyScaledHP for random boss matchups (verify not under-scaled) ===');
for(const b of order){
  const arr=byBoss[b]; if(!arr)continue;
  console.log(b.padEnd(17), 'scaledHP=', arr[0].enemyScaledHP, 'scaledDmg=', arr[0].enemyScaledDamage, 'loopMult=', arr[0].loopMultiplier);
}
