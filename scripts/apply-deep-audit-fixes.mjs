#!/usr/bin/env node
// Apply the data-side priority fixes from the deep audit synthesis:
// #4 Stormsplash targeting, #5 Soaking Blade / Concussive Smash / Vein Splitter
// effect ordering, #6 four "to all enemies" descriptions, #8 rage cost text,
// #9 Tombrage HP threshold wording. Plus Last Stand Bulwark "less then" typo.
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = 'src/data/json/cards.json';
const r = JSON.parse(readFileSync(PATH, 'utf-8'));
const find = (id) => r.cards.find((c) => c.id === id);

const log = (id, what) => console.log(`  ${id} → ${what}`);

// #4 Stormsplash: targeting "self" → "single"
{
  const c = find('t3-agility-air-water');
  c.targeting = 'single';
  log(c.id, 'targeting self→single');
}

// #5a Soaking Blade: drop the always-firing conditional framing
{
  const c = find('t3-attack-attack-water');
  c.description = 'Deal 12([str]). Apply 2[poison]. Then deal 7 more.';
  // Effect order already applies poison before the conditional damage; keep effect
  // logic but drop the misleading "If" framing in description.
  // Also drop the now-unnecessary condition from the second damage effect:
  const conditional = c.effects.find((e) => e.type === 'damage' && e.condition?.enemy_has_stack === 'poison');
  if (conditional) delete conditional.condition;
  log(c.id, 'desc reworded + conditional removed from effect');
}

// #5b Concussive Smash: reorder effects so conditional damage uses pre-cast stun state
{
  const c = find('t3-attack-attack-earth');
  // New description: explicit ordering — base damage and stuns first; only fire +6 if enemy was already stunned BEFORE the cast.
  c.description = 'Deal 14([str]). Apply 2[stun]([int]) and 3[slow]. If enemy was [stun] before cast: deal 6([str]) more.';
  // Reorder: conditional damage already last; rely on engine's `enemy_stunned` condition being checked against post-apply state.
  // To actually enforce pre-cast check, gate via `enemy_stack_atleast` reading enemyStun count… but the condition framework reads
  // live state. Cleanest fix: leave effect order as-is and accept that the conditional always fires (because the card stuns itself).
  // Honest description: drop the conditional framing — the bonus always fires once the card applies its own stun.
  c.description = 'Deal 14([str]) + 6 more after applying [stun]. Apply 2[stun]([int]) and 3[slow].';
  log(c.id, 'desc reworded (no engine change — conditional reliably self-met)');
}

// #5c Vein Splitter: clarify that all 3 hits get the bonus once bleed lands
{
  const c = find('t3-agility-attack-counter');
  c.description = 'Deal 4([dex]) three times; each hit applies 1[bleed]([dex]). Once enemy has [bleed], each hit applies 1 more [bleed]([dex]).';
  log(c.id, 'desc reworded ("If enemy has" → "Once enemy has")');
}

// #6 Four "to all enemies" cards — change targeting to "aoe" where missing, OR drop wording.
// Triple Slash, Pinprick Volley already target:"aoe" in the JSON.
// Check:
for (const id of ['t3-agility-attack-attack', 't3-agility-agility-attack', 't3-air-air-air', 't3-earth-earth-earth']) {
  const c = find(id);
  // If targeting is aoe, the description is fine — no change needed.
  if (c.targeting === 'aoe') {
    log(c.id, `targeting=aoe — description "to all enemies" is correct`);
    continue;
  }
  c.targeting = 'aoe';
  log(c.id, `targeting → aoe`);
}
// But: the damage effect target is "enemy" not "aoe". For AoE behavior the effect.target must be "aoe".
for (const id of ['t3-agility-attack-attack', 't3-agility-agility-attack', 't3-air-air-air']) {
  const c = find(id);
  for (const e of c.effects) {
    if (e.type === 'damage' && e.target === 'enemy') {
      e.target = 'aoe';
      log(c.id, 'damage effect target enemy → aoe');
    }
  }
}
// Mountain's Answer's damage effect already has target:"enemy" but card.targeting="aoe" — the conditional damage should target aoe too.
{
  const c = find('t3-earth-earth-earth');
  for (const e of c.effects) {
    if (e.type === 'damage' && e.target === 'enemy') {
      e.target = 'aoe';
      log(c.id, 'damage effect target enemy → aoe');
    }
  }
}

// #8 Wrath Brand: mention rage consumption
{
  const c = find('t3-attack-counter-fire');
  c.description = 'If you have [rage]: deal 12([str]) twice and apply 2[burn]. Consume 3[rage].';
  log(c.id, 'desc adds rage consumption');
}

// #8 Stormrage: mention rage consumption
{
  const c = find('t3-air-air-counter');
  c.description = 'If you have [rage]: apply 8[slow]([int]). Consume 4[rage].';
  log(c.id, 'desc adds rage consumption');
}

// #9 Tombrage: clarify HP threshold semantics
{
  const c = find('t3-counter-earth-earth');
  c.description = 'Gain 12[armor]([vit]). For 15 seconds: when your [HP] drops below 40%, gain 8[rage].';
  log(c.id, 'desc clarifies threshold is event-based');
}

// Bonus: Last Stand Bulwark "less then" → "less than" (missed by earlier sweep)
{
  const c = find('t3-attack-counter-defense');
  if (c.description && c.description.includes('less then')) {
    c.description = c.description.replace(/less then/g, 'less than');
    log(c.id, 'typo less then → less than');
  }
}

writeFileSync(PATH, JSON.stringify(r, null, 2) + '\n');
console.log('Done.');
