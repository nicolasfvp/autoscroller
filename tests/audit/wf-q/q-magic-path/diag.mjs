process.env.SIM_ELEM_RATE='0.22';
const { CombatEngine } = await import('../../../../src/systems/combat/CombatEngine.ts');
const { createCombatState } = await import('../../../../src/systems/combat/CombatState.ts');
const { scaleEnemyForLoop } = await import('../../../../src/systems/DifficultyScaler.ts');
const { loadAllData } = await import('../../../../src/data/DataLoader.ts');
const { setRun } = await import('../../../../src/state/RunState.ts');
const enemiesJson = (await import('../../../../src/data/json/enemies.json', { with: { type: 'json' } })).default;
loadAllData();
const deck = ["t2-agility-fire","t1-fire","t2-fire-fire","t3-agility-fire-fire","t2-fire-water","t3-attack-fire-fire","t2-air-fire","t3-agility-fire-water","t1-fire","t2-fire-fire","t3-fire-fire-fire","t2-agility-fire"];
const run = { version:5, runId:'d', seed:'d', generation:1, startedAt:0,
  hero:{ maxHP:70,currentHP:70,maxStamina:30,currentStamina:30,maxMana:60,currentMana:60,currentDefense:0,strength:1,defenseMultiplier:0.8,moveSpeed:2,vitality:0,dexterity:0,intellect:0,spirit:0,statDeltas:{},className:'mage',runXP:520,totalXP:0},
  deck:{ active:deck, inventory:{}, upgraded:new Array(deck.length).fill(false), droppedCards:[] },
  loop:{count:1,tiles:[],difficulty:1,tileLength:20}, economy:{gold:0,tilePoints:0,tileInventory:{},materials:{}}, relics:[], stats:{damageDealt:0,cardsPlayed:0,combosTriggered:0,goldEarned:0}, isInCombat:false, currentScene:'Game', stopAtShop:true, combatSpeed:1, mapSpeed:1, pool:{cards:[],relics:[],tiles:[]} };
setRun(run);
const base = enemiesJson.find(e=>e.id==='doom_knight');
const scaled = scaleEnemyForLoop({baseHP:base.baseHP,attack:{damage:base.attack.damage},baseDefense:base.baseDefense,goldReward:base.goldReward},1,true,1.0);
const enemy = {...base, baseHP:scaled.hp, baseDefense:scaled.defense, attack:{...base.attack,damage:scaled.damage}};
const state = createCombatState(run, enemy);
const engine = new CombatEngine(state);
let elapsed=0;
while(!engine.isComplete() && elapsed<180000){ engine.tick(100); elapsed+=100;
  if(elapsed%2000===0){ const s=engine.getState(); const st=engine.getStats();
    console.log('t='+(elapsed/1000)+'s eHP='+Math.round(s.enemyHP)+' hHP='+Math.round(s.heroHP)+' mana='+Math.round(s.heroMana)+' stam='+Math.round(s.heroStamina)+' burn='+s.burnStacks+' cards='+st.cardsPlayed+' dmg='+Math.round(st.damageDealt));
  }
}
const s=engine.getState(); const st=engine.getStats();
console.log('END t='+(elapsed/1000)+'s complete='+engine.isComplete()+' eHP='+Math.round(s.enemyHP)+' hHP='+Math.round(s.heroHP)+' cards='+st.cardsPlayed+' dmg='+Math.round(st.damageDealt));
console.log('state keys sample:', Object.keys(s).filter(k=>/mana|stam|HP|hp/i.test(k)).join(','));
