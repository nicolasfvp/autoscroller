import { readFileSync } from 'node:fs';
const enemies = JSON.parse(readFileSync('src/data/json/enemies.json','utf-8'));
const E = Object.fromEntries(enemies.map(e=>[e.id,e]));
const bossMultiplier = 1.0; // from difficulty.json

// scaleEnemyForLoop replication
function scale(base, nMult, isBoss){
  let loopMult = nMult;
  if(isBoss){ loopMult = 1 + (loopMult-1)*0.5; loopMult *= bossMultiplier; }
  return {
    hp: Math.floor(base.baseHP*loopMult),
    dmg: Math.floor(base.attack.damage*loopMult),
    def: Math.floor(base.baseDefense*loopMult),
    eff: loopMult,
  };
}

// XP achievability: how many XP does a real run earn by loop L?
// XP_PER: normal 10, elite 30, boss 80. eliteChance 0.15, basicTileCombatChance 0.18.
// baseLoopLength 15, +loopGrowth schedule [3,2,2,1,1] per boss kill, cap 40.
// tiles per loop ~ loopLength. combat tiles = loopLength * basicTileCombatChance.
const schedule=[3,2,2,1,1];
function loopLen(bk){let len=15;for(let i=0;i<bk;i++) len+=schedule[Math.min(i,schedule.length-1)];return Math.min(len,40);}

console.log('=== XP ACHIEVABILITY (part a): does a real run reach the stage runXP? ===');
let cumXP=0; let bk=0;
const bossLoops={10:1,20:2,30:3,40:4,50:5,60:6,70:7};
for(let loop=1; loop<=70; loop++){
  const len=loopLen(bk);
  const combatTiles = len*0.18;
  // expected XP per combat tile: 85% normal(10) + 15% elite(30) = 0.85*10+0.15*30=13
  const xpPerCombat=0.85*10+0.15*30;
  cumXP += combatTiles*xpPerCombat;
  if(bossLoops[loop]){ cumXP += 80; bk++; }
  if([10,20,30,40,50,60,70].includes(loop)){
    console.log(`loop ${String(loop).padStart(2)} (bk=${bk}): cumulative runXP ~= ${Math.round(cumXP)}`);
  }
}

console.log('\n=== ENEMY THREAT vs HERO POWER per boss (parts a/c) ===');
const stageBoss=[
  ['boss1','doom_knight',1.0,560,157,4],
  ['boss2','iron_golem',1.1,1150,185,6],
  ['boss3','lizard_king',1.2,1700,202,7],
  ['boss4','bog_witch',1.3,2300,219,8],
  ['boss5','desert_golem',1.4,2900,236,9],
  ['boss6','infernal_dragon',1.5,3600,242,9],
  ['boss7','boss_iron_golem',1.6,4400,253,10],
];
console.log('boss   id                nMult  bossEff  bHP   bDmg  bDef | heroMaxHP heroStr  hitsToKillHero(@bDmg) | hp/str(roughTTKproxy)');
for(const [st,id,nMult,runXP,heroHP,heroStr] of stageBoss){
  const b=E[id]; if(!b){console.log(st,id,'MISSING');continue;}
  const s=scale(b,nMult,true);
  const hits = (s.dmg>0)? (heroHP/s.dmg).toFixed(1):'inf';
  console.log(st.padEnd(6), id.padEnd(17), String(nMult).padStart(5), s.eff.toFixed(3).padStart(7), String(s.hp).padStart(5), String(s.dmg).padStart(5), String(s.def).padStart(5),'|', String(heroHP).padStart(8), String(heroStr).padStart(6),'  ', String(hits).padStart(6),'             ', (s.hp/heroStr).toFixed(1));
}

console.log('\n=== GROWTH RATIO: hero power vs enemy threat (loop1 baseline -> loop70) ===');
console.log('heroMaxHP: 100 -> 253  (x2.53,  +153%)');
console.log('heroStr  :   1 -> 10   (x10.0,  +900%)');
console.log('enemy nMult: 1.0 -> 1.6 (x1.6, +60%)  | boss effMult: 1.0 -> 1.3 (x1.3, +30%)');
