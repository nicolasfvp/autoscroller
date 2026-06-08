// Correct-HP batch: the deck-battle-sim harness starts combat at base maxHP (70 mage / 100 warrior)
// even though resolveHeroStats gives a higher maxHP from runXP leveling — createCombatState clamps
// heroHP = min(currentHP=base.maxHP, resolved.maxHP). This understates survival. Here we set
// currentHP = resolved.maxHP so the hero starts at FULL leveled HP (the true in-game condition).
process.env.SIM_ELEM_RATE = process.env.SIM_ELEM_RATE || '0.22';
const { CombatEngine } = await import('../../../../src/systems/combat/CombatEngine.ts');
const { createCombatState } = await import('../../../../src/systems/combat/CombatState.ts');
const { scaleEnemyForLoop } = await import('../../../../src/systems/DifficultyScaler.ts');
const { loadAllData, getCardById } = await import('../../../../src/data/DataLoader.ts');
const { setRun } = await import('../../../../src/state/RunState.ts');
const { resolveHeroStats } = await import('../../../../src/systems/hero/HeroStatsResolver.ts');
const enemiesJson = (await import('../../../../src/data/json/enemies.json', { with: { type: 'json' } })).default;
loadAllData();

function applyOverrides(overrides) {
  const restores = [];
  for (const [id, patch] of Object.entries(overrides || {})) {
    const card = getCardById(id);
    if (!card) throw new Error('unknown card ' + id);
    const orig = { cost: card.cost, cooldown: card.cooldown, exhaust: card.exhaust, effects: JSON.parse(JSON.stringify(card.effects || [])) };
    restores.push(() => { card.cost = orig.cost; card.cooldown = orig.cooldown; card.exhaust = orig.exhaust; card.effects = orig.effects; });
    if (patch.cost !== undefined) card.cost = patch.cost;
    if (patch.cooldown !== undefined) card.cooldown = patch.cooldown;
    if (patch.exhaust !== undefined) card.exhaust = patch.exhaust;
    if (patch.effects !== undefined) card.effects = JSON.parse(JSON.stringify(patch.effects));
    else if (patch.effectsPatch) { card.effects = JSON.parse(JSON.stringify(card.effects || [])); patch.effectsPatch.forEach((p, i) => { if (p && card.effects[i]) Object.assign(card.effects[i], p); }); }
  }
  return () => { for (const r of restores) r(); };
}

function runOnce(m) {
  const restore = applyOverrides(m.cardOverrides);
  try {
    const isMage = m.class === 'mage';
    const base = isMage ? { maxHP: 70, maxStamina: 30, maxMana: 60, defenseMultiplier: 0.8 } : { maxHP: 100, maxStamina: 50, maxMana: 30, defenseMultiplier: 1 };
    const sd = {}; const s = m.stats || {};
    for (const k of ['str','vit','dex','int','spi','maxHP','maxStamina','maxMana']) if (s[k]) sd[k] = s[k];
    const run = { version:5, runId:'b', seed:'b', generation:1, startedAt:0,
      hero:{ maxHP:base.maxHP,currentHP:base.maxHP,maxStamina:base.maxStamina,currentStamina:base.maxStamina,maxMana:base.maxMana,currentMana:base.maxMana,currentDefense:0,strength:1,defenseMultiplier:base.defenseMultiplier,moveSpeed:2,vitality:0,dexterity:0,intellect:0,spirit:0,statDeltas:sd,className:m.class,runXP:m.runXP||0,totalXP:0},
      deck:{ active:[...m.deck], inventory:{}, upgraded:new Array(m.deck.length).fill(false), droppedCards:[] },
      loop:{count:1,tiles:[],difficulty:1,tileLength:20}, economy:{gold:0,tilePoints:0,tileInventory:{},materials:{}}, relics:[...(m.relics||[])], stats:{damageDealt:0,cardsPlayed:0,combosTriggered:0,goldEarned:0}, isInCombat:false, currentScene:'Game', stopAtShop:true, combatSpeed:1, mapSpeed:1, pool:{cards:[],relics:[],tiles:[]} };
    // FIX: start at full leveled HP
    const resolved = resolveHeroStats(run);
    run.hero.currentHP = resolved.maxHP;
    setRun(run);
    const be = enemiesJson.find(e => e.id === m.enemy);
    const merged = { ...be, ...(m.enemyOverride || {}) };
    if (m.enemyOverride && m.enemyOverride.attack) merged.attack = { ...be.attack, ...m.enemyOverride.attack };
    const scaled = scaleEnemyForLoop({ baseHP: merged.baseHP, attack: { damage: merged.attack.damage }, baseDefense: merged.baseDefense, goldReward: merged.goldReward }, 1, !!m.isBoss, m.loopMultiplier || 1.0);
    const enemy = { ...merged, baseHP: scaled.hp, baseDefense: scaled.defense, attack: { ...merged.attack, damage: scaled.damage } };
    const state = createCombatState(run, enemy);
    const heroMaxHP = state.heroMaxHP;
    const engine = new CombatEngine(state);
    let elapsed = 0;
    while (!engine.isComplete() && elapsed < 180000) { engine.tick(100); elapsed += 100; }
    const fs = engine.getState(); const st = engine.getStats();
    const won = fs.enemyHP <= 0 && fs.heroHP > 0;
    return { won, timeout: !engine.isComplete(), ttk: elapsed, hpPct: won ? Math.max(0, fs.heroHP)/heroMaxHP : 0, dmg: st.damageDealt, cards: st.cardsPlayed, startHP: heroMaxHP, enemyHP: scaled.hp, enemyDmg: scaled.damage };
  } finally { restore(); }
}

const spec = JSON.parse((await import('node:fs')).readFileSync(new URL('./' + process.env.BATCH_SPEC, import.meta.url), 'utf8'));
const out = [];
for (const m of spec.matchups) {
  const reps = m.repeats || 6;
  let wins = 0, deaths = 0, to = 0, dmg = 0, cards = 0, hpw = 0, hwc = 0, ttk = 0, tc = 0; let startHP = 0, eHP = 0, eDmg = 0;
  for (let i = 0; i < reps; i++) { const r = runOnce(m); startHP = r.startHP; eHP = r.enemyHP; eDmg = r.enemyDmg; if (r.won) { wins++; hpw += r.hpPct; hwc++; ttk += r.ttk; tc++; } else if (r.timeout) to++; else deaths++; dmg += r.dmg; cards += r.cards; }
  out.push({ id: m.id, winRate: +(wins/reps).toFixed(3), deaths, timeouts: to, avgDmg: Math.round(dmg/reps), avgCards: Math.round(cards/reps), hpOnWin: hwc ? +(hpw/hwc).toFixed(3) : null, ttkS: tc ? +(ttk/tc/1000).toFixed(1) : null, startHP, enemyHP: eHP, enemyDmg: eDmg });
}
console.log('RATE=' + process.env.SIM_ELEM_RATE);
for (const r of out) console.log(JSON.stringify(r));
(await import('node:fs')).writeFileSync(new URL('./' + (process.env.BATCH_OUT || 'fullhp-out.json'), import.meta.url), JSON.stringify({ rate: process.env.SIM_ELEM_RATE, results: out }, null, 2));
