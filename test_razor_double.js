const { CardResolver } = require('./src/systems/combat/CardResolver');
const { loadAllData } = require('./src/data/DataLoader');

async function test() {
  await loadAllData();
  
  const resolver = new CardResolver();
  const cards = require('./src/data/json/cards.json').cards;
  const razorStance = cards.find(c => c.id === 't2-counter-counter');
  
  function makeState(over = {}) {
    return {
      heroHP: 100, heroMaxHP: 100,
      heroStamina: 50, heroMaxStamina: 50,
      heroMana: 30, heroMaxMana: 30,
      heroDefense: 0,
      heroStrength: 1, heroDefenseMultiplier: 1,
      heroClass: 'warrior',
      deckOrder: [],
      enemyId: 'dummy', enemyName: 'Dummy', enemyType: 'normal',
      enemyHP: 10000, enemyMaxHP: 10000, enemyDefense: 0,
      enemyDamage: 5, enemyAttackCooldown: 2000, enemyBaseAttackCooldown: 2000,
      enemyPattern: 'fixed', enemySpecialEffect: null, enemyAffinity: null,
      activeRelicIds: [], activePassives: [],
      heroStunned: false, heroStunStacks: 0, stunImmuneUntilMs: 0,
      upgraded: [], behaviors: [],
      cooldownMultiplier: 1.0, firstCardDamageMultiplier: 1.0,
      firstCardCostsZero: false, firstNCardsStaminaDiscount: 0,
      firstAttackDamageBonus: 0, firstFireCardBurnBonus: 0,
      barrierActive: false, pendingGoldBonus: 0, relicCounters: {},
      nextArmorMultiplier: 1.0,
      _bloodPactBonus: 0, _sanguinePactStrBonus: 0, _sanguinePactIntBonus: 0,
      phoenixUsed: false,
      heroVitality: 0, heroDexterity: 0, heroIntellect: 0, heroSpirit: 0,
      poisonStacks: 0, bleedStacks: 0, burnStacks: 0,
      stunStacks: 0, slowStacks: 0, rageStacks: 0,
      subtileBurnApplyBonus: 0, subtileBleedTickBonus: 0, subtileSpellDamageMult: 1,
      combatElapsedMs: 0, lastHeroDamageMs: null,
      enemyAttackedSinceLastBleedTick: false, poisonTickParity: 0,
      nextCardCooldownReduction: 0,
      buffMagnitudePerCard: {},
      heroAuras: [], enemyAuras: [],
      heroBurnStacks: 0, heroBleedStacks: 0,
      spentThisCombat: new Set(),
      cdDebtBySlot: {},
      echoCharges: 0, echoExpiresAt: 0, freeEchoCharges: 0,
      devouredSlots: new Set(),
      statBoostsThisCombat: {},
      cardStatGainCounters: {},
      ...over,
    };
  }
  
  const state = makeState({ combatElapsedMs: 1000, lastHeroDamageMs: 0 });
  
  // First cast with Vengeance armed
  resolver.resolve(razorStance, state, null);
  console.log('After first cast (Vengeance armed):');
  console.log(`  Auras: ${state.heroAuras.length}, TTL: ${state.heroAuras.map(a => a.remainingMs).join(', ')}`);
  
  // Second cast (still Vengeance armed)
  resolver.resolve(razorStance, state, null);
  console.log('After second cast (Vengeance armed):');
  console.log(`  Auras: ${state.heroAuras.length}, TTL: ${state.heroAuras.map(a => a.remainingMs).join(', ')}`);
  
  if (state.heroAuras.length === 2) {
    console.log('\nREGRESSION DETECTED: Two bleed auras coexist!');
    console.log('Expected: One aura with combined duration');
    console.log('Actual: Two auras that will each apply bleed on hit');
    process.exit(1);
  } else {
    console.log('\nOK: Single aura as expected');
  }
}

test().catch(e => {
  console.error(e);
  process.exit(1);
});
