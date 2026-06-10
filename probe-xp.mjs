// Re-derive getLevel + in-run bonus + enemy scaling, exactly as the code does.
const XP_BASE = 50, GROWTH = 1.15;
const xpForNext = (lvl) => Math.floor(XP_BASE * Math.pow(GROWTH, lvl));
function getLevel(totalXP){let lvl=0,rem=totalXP;while(rem>=xpForNext(lvl)){rem-=xpForNext(lvl);lvl++;}return lvl;}

// in-run bonus (warrior)
function inRun(runXP, cls='warrior'){
  const level=getLevel(Math.max(0,runXP));
  const maxHP=level*6, vit=Math.floor(level/2), dex=Math.floor(level/4);
  const off=Math.floor(level/2);
  return {level, maxHP, vit, dex, str: cls==='mage'?0:off, int: cls==='mage'?off:0};
}

const stages = [
  ['loop2',2,0,120,1,null],
  ['loop5',5,0,336,1,null],
  ['loop8',8,0,480,1,null],
  ['boss1',10,0,560,1,1],
  ['loop15',15,1,900,1.1,null],
  ['boss2',20,1,1150,1.1,1.05],
  ['loop25',25,2,1450,1.2,null],
  ['boss3',30,2,1700,1.2,1.1],
  ['boss4',40,3,2300,1.3,1.15],
  ['boss5',50,4,2900,1.4,1.2],
  ['boss6',60,5,3600,1.5,1.25],
  ['boss7',70,6,4400,1.6,1.3],
];

// warrior base maxHP=100, str=1, vit base 0. resolved maxHP = 100 + inRun.maxHP + resolved.vit*5
console.log('stage  loop bk  runXP  Lvl  hpBonus vit dex off | warriorMaxHP  str | enemyNormalMult bossEffMult');
for(const [name,loop,bk,runXP,nMult,bMult] of stages){
  const b=inRun(runXP);
  const resolvedVit=b.vit; // statDeltas 0 in random decks
  const warMaxHP=100+b.maxHP+resolvedVit*5;
  const warStr=1+b.str;
  // boss effective mult as engine computes it: scaleEnemyForLoop(isBoss): loopMult=1+(nMult-1)*0.5 then *bossMultiplier(config)
  console.log(name.padEnd(7), String(loop).padStart(3), String(bk).padStart(2), String(runXP).padStart(6), String(b.level).padStart(4), String(b.maxHP).padStart(6), String(b.vit).padStart(3), String(b.dex).padStart(3), String(b.str).padStart(3), '|', String(warMaxHP).padStart(11), String(warStr).padStart(4), '|', nMult);
}
