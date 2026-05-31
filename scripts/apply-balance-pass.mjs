// Card balance pass (user-approved "plano completo").
// Deterministic transforms on cards.json: OP nerfs, underpowered buffs,
// archetype fixes (rage/heal/poison T2 entry), and the T2 cost-curve lift.
// Run: node scripts/apply-balance-pass.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'json', 'cards.json');
const data = JSON.parse(readFileSync(PATH, 'utf8'));
const byId = new Map(data.cards.map((c) => [c.id, c]));
const log = [];
function card(id) { const c = byId.get(id); if (!c) throw new Error('missing card ' + id); return c; }
function setDesc(c, d) { c.description = d; }

// ---------------------------------------------------------------- NERFS
// 1. Tempest Pike — triple-hit AoE + STR scaling is the air ceiling.
{
  const c = card('t3-air-air-attack');
  c.cooldown = 2.2;                       // 1.8 -> 2.2
  c.effects[0].multi_hit = 1;             // 3 hits -> 2 hits
  setDesc(c, 'Deal 6([str]) twice to all enemies. Apply 2[slow].');
  log.push('Tempest Pike: cd 1.8->2.2, 3 hits->2');
}
// 2. Concussive Smash — drop the always-firing "+6 conditional" prong.
{
  const c = card('t3-attack-attack-earth');
  c.effects = c.effects.filter((e) => !(e.condition && e.condition.enemy_stunned));
  setDesc(c, 'Deal 14([str]). Apply 2[stun]([int]) and 3[slow].');
  log.push('Concussive Smash: removed always-on conditional +6 prong');
}
// 3. Cinder Thrust — burn ceiling on a cheap CD: trim base 10 -> 7.
{
  const c = card('t3-attack-attack-fire');
  c.effects[0].value = 7;
  setDesc(c, 'Deal 7([str]) twice. Apply 2[burn].');
  log.push('Cinder Thrust: base 10->7');
}
// 4. Stormhilt — triple-effect bundle: base 8 -> 6 and drop the slow prong.
{
  const c = card('t3-air-attack-defense');
  c.effects[0].value = 6;
  c.effects = c.effects.filter((e) => !(e.stack === 'slow'));
  setDesc(c, 'Deal 6([str]) twice. Gain 6[armor].');
  log.push('Stormhilt: base 8->6, dropped slow');
}
// 5. Wickfencer — shortest CD in tier: 1.7 -> 2.0.
{
  const c = card('t3-agility-attack-fire');
  c.cooldown = 2.0;
  log.push('Wickfencer: cd 1.7->2.0');
}
// 6-8. Earthcleaver / Granitewrath / Mirebreaker — drop double-STR scale 2 -> 1.
for (const id of ['t3-attack-defense-earth', 't3-attack-counter-earth', 't3-attack-earth-water']) {
  const c = card(id);
  const main = c.effects.find((e) => e.type === 'damage' && e.scale && e.scale.stat === 'str');
  main.scale.value = 1;                   // 2 -> 1
  log.push(`${c.name}: main STR scale 2->1`);
}
// 9. Mountain's Answer — raise the self-satisfied armor gate 20 -> 32.
{
  const c = card('t3-earth-earth-earth');
  const dmg = c.effects.find((e) => e.condition && e.condition.self_armor_atleast != null);
  dmg.condition.self_armor_atleast = 32;
  setDesc(c, 'Gain 26[armor]([vit]). If [armor] is at least 32: deal 22 Pierce to all enemies.');
  log.push("Mountain's Answer: armor gate 20->32");
}
// 10. Tectonic Reckoning — drop stun apply 5 -> 3 (co-defines the stun bucket).
{
  const c = card('t3-air-counter-earth');
  const stun = c.effects.find((e) => e.stack === 'stun');
  stun.value = 3;
  setDesc(c, 'Exhaust. Apply 3[stun]([int]) to all enemies. Deal 50([str]) Pierce to all enemies.');
  log.push('Tectonic Reckoning: stun 5->3');
}

// ---------------------------------------------------------------- BUFFS
// 11. Drowning Lance — add an unconditional 4 Pierce floor.
{
  const c = card('t3-attack-water-water');
  c.effects.unshift({ type: 'damage', value: 4, target: 'enemy', pierce_armor: true });
  setDesc(c, 'Deal 4 Pierce + 3 Pierce per [poison] consumed.');
  log.push('Drowning Lance: +4 Pierce floor');
}
// 12. Marsh Squall — self-enabling poison prong so it works on a clean board.
{
  const c = card('t3-air-earth-water');
  c.effects.unshift({ type: 'dot', stack: 'poison', value: 2, target: 'enemy', scale: { stat: 'int', per: 3, value: 1 } });
  setDesc(c, "Exhaust. Apply 2[poison]([int]). 50% of enemy's [poison] spreads to up to 4 enemies. Then deal 4 Pierce per [poison] consumed to all enemies.");
  log.push('Marsh Squall: self-poison prong');
}
// 13. Galeward — thin payload: armor 12 -> 16.
{
  const c = card('t3-air-air-defense');
  c.effects[0].value = 16;
  setDesc(c, 'Gain 16[armor]([vit]). Haste 20% for 10 seconds.');
  log.push('Galeward: armor 12->16');
}
// 14. Body Slam Vow — setup/payoff card: cost 2 -> 1 stam.
{
  const c = card('t3-attack-defense-defense');
  c.cost = { stamina: 1 };
  log.push('Body Slam Vow: cost 2->1 stam');
}
// 15. Crimson Cascade — immediate bleed prong so it does something alone.
{
  const c = card('t3-counter-counter-water');
  c.effects.unshift({ type: 'dot', stack: 'bleed', value: 3, target: 'enemy', scale: { stat: 'spi', per: 3, value: 1 } });
  setDesc(c, 'Apply 3[bleed]([spi]). Apply 1[bleed] to yourself. For 15 seconds: every time you kill an enemy with [bleed], apply 4[bleed]([spi]) to the nearest enemy.');
  log.push('Crimson Cascade: +3 bleed immediate');
}
// 16. Vengeful Pyre — small immediate rage so the buff-only card has output.
{
  const c = card('t3-counter-counter-fire');
  c.effects.unshift({ type: 'stack', stack: 'rage', value: 3, target: 'self' });
  setDesc(c, 'Exhaust. Gain 3[rage]. Exhaust the next card in order. Double all [rage] gained this combat.');
  log.push('Vengeful Pyre: +3 rage immediate');
}

// ------------------------------------------------------------ ARCHETYPE
// 17. Reckless Strike — the only spammable rage source: 2 -> 3.
{
  const c = card('t2-attack-attack');
  const rage = c.effects.find((e) => e.stack === 'rage');
  rage.value = 3;
  setDesc(c, 'Deal 9([str]). Gain 3[rage]. Apply 1[bleed] to yourself.');
  log.push('Reckless Strike: rage 2->3');
}
// 18. Phoenix Aura — give the heal archetype an offensive secondary (burn).
{
  const c = card('t3-fire-water-water');
  c.effects.splice(1, 0, { type: 'dot', stack: 'burn', value: 3, target: 'enemy', scale: { stat: 'int', per: 3, value: 1 } });
  setDesc(c, 'Heal 10([spi]). Apply 3[burn]([int]). For 12 seconds: if you have less than 50%[HP], gain 18[armor].');
  log.push('Phoenix Aura: +3 burn secondary');
}
// 19. Mire Bloom — the T2 poison ON-RAMP (zero existed). Add poison, give it a
//     real cost (was free) and drop the mana refund to keep it fair.
{
  const c = card('t2-earth-water');
  c.cost = { mana: 1 };
  c.effects = c.effects.filter((e) => e.type !== 'mana');
  c.effects.push({ type: 'dot', stack: 'poison', value: 2, target: 'enemy', scale: { stat: 'int', per: 3, value: 1 } });
  setDesc(c, 'Gain 4[armor]([vit]). Heal 3([spi]). Deal 3([str]). Apply 2[poison]([int]).');
  log.push('Mire Bloom: T2 poison on-ramp (cost mana1, +2 poison, -mana refund)');
}

// ----------------------------------------------------------- COST CURVE
// T2 avg cost (0.61) was below T1 (0.88). Assign a cost to the strongest free
// offensive/utility T2 cards; leave weaker situational ones as cantrips.
const costCurve = {
  't2-air-attack': { stamina: 1 },   // Stormstrike
  't2-agility-fire': { mana: 1 },    // Flame Dart
  't2-fire-fire': { mana: 1 },       // Pyre
  't2-agility-air': { mana: 1 },     // Gale Cut
  't2-agility-counter': { stamina: 1 }, // Sidestep & Slash
  't2-attack-water': { stamina: 1 }, // Crimson Tithe (also fixes cost:{} encoding)
  't2-attack-defense': { stamina: 1 }, // Shield Bash
  't2-air-water': { mana: 1 },       // Misting Veil
};
for (const [id, cost] of Object.entries(costCurve)) {
  const c = card(id);
  c.cost = cost;
  log.push(`${c.name}: free -> ${JSON.stringify(cost)}`);
}

writeFileSync(PATH, JSON.stringify(data, null, 2) + '\n');
console.log('Applied ' + log.length + ' balance changes:');
for (const l of log) console.log('  - ' + l);
