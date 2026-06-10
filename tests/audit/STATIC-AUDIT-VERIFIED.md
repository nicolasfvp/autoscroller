# Static-audit findings — RE-VERIFIED against current code (2026-06-09)

Of 35 prior static-audit findings: 17 stale (already fixed by later batches), 18 still actionable. Verified lane-by-lane against live cards.json/enemies.json/CardResolver/CardText. Each actionable item is categorized; balance smells defer to the power pass, text-clarity needs formatter+regen, deferred-content/dead-code needs no gameplay action.

## STALE (already fixed) — 17

- #1 t2-attack-defense (desc_mismatch)
- #2 t2-counter-counter (desc_mismatch)
- #5 t3-air-earth-water (card-mechanic)
- #7 t3-air-fire-water (dead_effect)
- #8 t3-agility-attack-counter (dead_effect)
- #11 t3-counter-counter-fire (dead_effect)
- #12 t3-counter-counter-fire (card_bug)
- #13 t3-counter-counter-fire (card-mechanic)
- #14 t3-air-air-earth (card-mechanic)
- #16 t3-defense-defense-earth (card-mechanic)
- #18 t3-counter-defense-water (card-mechanic)
- #22 t3-agility-attack-counter (card-mechanic)
- #23 t3-attack-counter-counter (card-mechanic)
- #26 t3-counter-counter-fire (dead_effect)
- #27 t3-attack-counter-counter (dead_effect)
- #30 src/data/tiles.json (data)
- #32 desert_golem (balance_smell)

## ACTIONABLE

### card-text (5)

**#3 t1-water (Mend) + all T2 heal cards (Mist Step, Bloodtide Mend, Vow of the Tide, Misting Veil, Mire Bloom, Steam Surge)** [still-applies/risk:low/conf:high]

Still applies (text-clarity only; the engine behaves as intended). Per design constraint, this is NOT a power change — keep the +15%/pt global SPI heal multiplier exactly as-is. Two documentation-level options, no balance impact: (a) document the global SPI heal multiplier as a known engine convention alongside the STR (1+(STR-1)*0.25) and magic elemMult conventions, OR (b) drop the redundant explicit ([spi]) additive scale clauses on heal effects (e.g. Mire Bloom 'Heal 3([spi])') so the per-card text stops understating SPI on two axes. Mend itself shows no scaler at all, so option (a) is the cleaner fix for it. NOTE the card-integrity invariant: option (b) edits the scale clause, which changes the formatter output (CardText healBody), so the stored description MUST be regenerated to match — do not hand-edit one without the other. Keep severity low.

**#15 t3-counter-counter-earth (Stonewrath), t3-counter-earth-earth (Tombrage), t3-counter-defense-earth (Tombplate), t3-agility-defense-earth (Quickstone) — "For 15 seconds, if you have less than X%[HP]: ..." reads as a sustained while-true condition but the aura arms once and self-removes on first trigger** [still-applies/risk:medium/conf:high]

STILL APPLIES (text-clarity). Reword to convey single-shot arming, e.g. Stonewrath -> "Gain 12[armor]([vit]). For 15 seconds, the first time you drop below 50%[HP], gain 6[rage]."; Tombrage -> "...For 15 seconds, the first time you drop below 40%[HP], gain 8[rage]."; Tombplate -> "...For 15 seconds, the first time you drop below 40%[HP], gain 10[armor] and 4[rage]."; Quickstone -> "...For 15 seconds, the first time you drop below 60%[HP], haste 30% for 6 seconds." CARD-INTEGRITY: the stored description is regenerated from the formatter, so this CANNOT be a raw string edit — it requires changing auraTriggerPhrase's on_hp_pct_below template (CardText.ts:716-717) from "if you have less than X%[HP]" to "the first time you drop below X%[HP]" (and dropping the comma in formatTriggerAura's `${dur}, ${trigPhrase}, ${body}` path or adjusting it to read cleanly) so stored == generated. That template change also covers Phoenix Aura (finding #21, out of range) and any other on_hp_pct_below card — it is a global formatter touch, which is precisely why the team deferred it as polish. Do NOT alter the once-fires mechanic (it is intended and tested in tier2-primitives.test.ts). Honors C1-C5 (text-only, no power change).

**#24 t3-earth-earth-earth (Mountain's Answer) — unclear_desc: self-armor gate >=32 unmet by own 26 armor at base VIT** [still-applies/risk:low/conf:high]

Lowest-risk: lower the gate to self_armor_atleast:26 so the card's own base armor grant satisfies it at VIT1 (the offensive half then fires on a clean cast as the text implies). This is a data-only condition edit and does NOT change the stored description (the formatter would re-emit 'If [armor] is at least 26'), so regen keeps card-integrity intact — if applied, the stored description must be updated to '...If [armor] is at least 26:...' to match. Alternatives the finding lists: raise base armor grant to >=32, or reword to make the 'needs extra VIT/armor' requirement explicit. Avoid any change that desyncs stored desc from the gate value.

**#25 t3-defense-defense-defense (Aegis of Returning Wrath)** [still-applies/risk:medium/conf:high]

Wording/clarity only — no mechanical change. If post-gain counting is intended (it resolves fine), reword to e.g. "Gain 22[armor]([vit]). Deal 6 Pierce, +1 damage per 4[armor] you have (including this gain)." If pre-cast armor is intended, snapshot armor before the gain (use the preConsume snapshot). NOTE on card-integrity: the stored description must equal the CardText output. The current CardText armor-source damage formatter emits exactly "+1 damage per 4[armor] you have" (it drops the stat token for source:'armor' scales), so any prose edit like "(including this gain)" requires a matching change in the CardText damageBody/scaler formatter or it will break the stored-desc==formatter invariant. Do NOT change per/value (would be a power change, out of scope). Lowest-risk option: leave mechanics, accept as a known timing convention, or add the clarifier in both places.

**#28 t3-counter-fire-fire (Brine Crucible) — cd_debt 'Next card delays' prose** [still-applies/risk:low/conf:high]

Change CardText.cdDebtBody (CardText.ts:611) from `Next card delays ${fx.value} more seconds` to `This card delays ${fx.value} more seconds next time`, AND update the stored description on cards.json t3-counter-fire-fire so the trailing clause reads "...This card delays 3 more seconds next time." — BOTH must change together to preserve the card-integrity invariant (stored description must equal CardText output). The full corrected description: "Consume all [burn] and apply 2[bleed]([dex]) per [burn] consumed, plus 2[bleed]([dex]). This card delays 3 more seconds next time." If the regen pipeline regenerates descriptions from effects via CardText, then only the cdDebtBody change is needed and the stored desc will follow. NOTE: the finding's cited contrast (Cleaver's Tax 'this card delays...next time') is now stale — Cleaver's Tax no longer has that clause (see index 27) — but that does not affect Brine Crucible's own prose/mechanic mismatch. No mechanical change (cd_debt is per-slot by design).

### card-mechanic (2)

**#6 consume_stack_value detonators vs Pyre-keyword detonators (Supernova/Marsh Squall/Drowning Lance/Tremor vs Cinderlance/Cinder Sprint/Venom Detonation)** [partially-applies/risk:low/conf:medium]

Largely stale; only the abstract dual-path remains. The finding's headline example (Marsh Squall using identical 'per [X] consumed' prose to Cinder Sprint while behaving differently) is resolved: Marsh Squall's reorder makes its prose order Consume→Deal→Apply, which honestly signals the detonation reads the pre-cast pool and the application is a separate trailing ramp; the Pyre cards' prose order is Apply→Consume→Deal, signaling self-fueling. So the same wording no longer means two different things across the set. No further action strictly required. Optional hardening per the original suggestion (no behavior/power change): if you want the engine to be self-documenting, keep the convention that detonator prose ALWAYS lists Apply after Consume/Deal when the freshly-applied stack must NOT feed the burst (consume_stack_value path), and before when it must (Pyre path). Do not unify the two counting rules — the Pyre self-fuel is intentional. Severity low.

**#21 Brace (on_armor_break) cards (Bulwark Vow, Phalanx Drift, Stoneward Reprisal, Bramble Step, Ember Vault, Standing Stone, Bedrock Bulwark, et al.) — hidden ttl window** [still-applies/risk:medium/conf:high]

Two valid options (pick one; the finding's adjusted severity is low). (a) Engine/data fix matching the keyword definition: make Brace auras combat-long by setting ttl_ms:null on the on_armor_break auras so the bonus persists until armor breaks (then createAura yields Infinity remainingMs and tickAuras never prunes them). (b) Text fix: surface the window in the Brace glossary entry (KeywordDefinitions.ts:34) e.g. 'Triggers its bonus when your [armor] breaks (drops to 0), within ~12 seconds of playing the card.' NOTE: do NOT bake 'for 12 seconds' into individual card descriptions via free text — that would break the card-integrity invariant unless the CardText formatter is taught to emit the window for on_armor_break auras (it currently emits no duration for them, while it DOES emit 'for 8 seconds' for sibling Haste auras on the same card, e.g. Standing Stone). Prefer option (a) (data: ttl_ms:null) as the lowest-text-risk change.

### data (5)

**#4 t2-agility-attack (Quickstrike)** [still-applies/risk:low/conf:medium]

Still applies as a low-severity balance_smell (unchanged since the finding). Under C1 (resource cost is the primary power lever), Quickstrike pays double stamina (2) for a rider-less single hit at the same 1.2 cd as 1-stamina peers that all carry secondary value. Fix per the finding only (no power escalation beyond documented): reduce cost to {stamina:1}, OR add a modest rider (bleed/haste/stamina) befitting a 2-stamina price. Defer exact tuning to the sim (sim-handled-elsewhere note). Honor the caveat that at higher DEX Quickstrike's raw single-hit damage does eventually surpass Flurry Step's, so the durable issue is cost-vs-rider, not raw output.

**#17 t3-air-attack-attack (Galekick) over-efficient vs sibling t3-air-air-attack (Tempest Pike) — same slow payload, more damage, shorter cooldown** [still-applies/risk:medium/conf:medium]

STILL APPLIES (balance smell, light). Per the finding (and to not exceed documented scope), differentiate the two air slow-attackers so the higher-damage card is not also the more frequent one: e.g. raise Galekick's cooldown from 1.6 to ~2.2 to match Tempest Pike (cleanest, since Galekick's attack-heavy elements plausibly justify its +2 burst but not the shorter cooldown), OR shorten/buff Tempest Pike. Description is accurate and stays in sync (no text/integrity change). Do NOT add power beyond re-pointing the cooldown; honors C1 (cooldown/resource as the lever) and C2-C5. This is a tuning call the team left for sim-based balancing, so flag-only/low-priority.

**#19 t3-attack-defense-defense (Body Slam Vow) — balance_smell: per:1 armor->damage that is retained + self-fueled** [still-applies/risk:medium/conf:high]

none — keep as a documented balance/design-tension note only; do NOT make an unrequested nerf. The finding's own options remain valid if the balance pass elects to act: align rate to per:>=4 (matching the sanctioned Aegis), add spend_armor so the converter consumes what it monetizes (like Citadel Inferno), or drop the self +6 armor so it is not self-fueling. No description change — stored desc already honestly matches effects, so card-integrity is intact.

**#20 t3-attack-defense-defense (Body Slam Vow) — data_inconsistency: armor-source damage scale carries a no-op scale.stat:'vit'** [still-applies/risk:low/conf:high]

Drop the dead stat field from the armor-source DAMAGE scale, leaving {source:'armor', per:1, value:1} (matching Aegis's clean form). Data-only edit; does NOT change resolver math or generated text, so the card-integrity invariant (stored desc == formatter output) is preserved. For consistency, apply catalog-wide to all five armor-source scales that carry a stat (lines 960, 1128, 2024, 2126, 5950), not just this card.

**#29 terrain-enemies.json -> green_field (slime / red_slime / earth_dragon)** [still-applies/risk:low/conf:high]

Delete the green_field entry from terrain-enemies.json (lines 76-88) and remove the orphaned assets (Preloader.ts:103-105 slime/red_slime/earth_dragon sprite loads, Preloader.ts:145 + GameScene.ts:100-106 bg_green_field). green_field is not placeable, so this is pure dead-data/asset cleanup with zero gameplay impact. Independently (defensive hardening, optional), have getEnemyPoolForTerrain (LootGenerator.ts) filter out ids not present in enemies.json so no tile can ever be assigned an unspawnable enemyId if green_field were re-enabled. No balance impact (no card/enemy stats touched).

### enemy (3)

**#31 doom_knight (affinity: counter)** [still-applies/risk:low/conf:high]

none required to the finding — STILL VALID as written. doom_knight still pairs the intended-easy-intro-boss role with 'counter' affinity, adding +4 hero HP loss per attack (~67% uplift over its base damage 6, pre-armor effective ~10/hit) plus enrage x1.4 below 50% HP. The verdict's own correction is already reflected in the current data: attack.damage is 6 (the stale '9dmg' BP figure does not appear in current enemies.json). Suggested direction unchanged and not C1-C5-restricted: give doom_knight 'attack' (no secondary) or a defensive affinity, or trim base damage to absorb the counter uplift; reserve 'counter' for a later boss where extra pressure is intended. This is a balance lever (sim-handled elsewhere), so keep light — no power change beyond what the finding documents.

**#33 EnemyAffinity 'agility' (pocket_cat, vampire, werewolf, scorpion)** [still-applies/risk:low/conf:high]

none required to the finding — STILL VALID. Per attack cycle (~2.1-2.4s) recovery restores ~210-240ms toward base while each attack only shaves 100ms, so recovery outpaces the shave ~2:1; enemyAttackCooldown ratchets back to base and the shave never compounds (settles ~80-100ms below base, ~0-1 extra attacks per 30s). The 'speed identity' payoff remains effectively cosmetic. Not C1-C5-governed. Suggested fix unchanged: lower the recovery rate (e.g. 0.03-0.05*deltaMs), raise/stack the per-attack shave, or model agility as a flat % reduction on enemyBaseAttackCooldown so it doesn't fight its own recovery loop. (Engine code is byte-for-byte the same as the finding's evidence cited; only line numbers shifted slightly: shave at 53-55, recover at 45-50.)

**#35 iron_golem (boss shield behavior, shieldAmount:4)** [partially-applies/risk:low/conf:high]

PARTIALLY-APPLIES — the finding's premise (shieldAmount:4, a 2.5x-3x gap) is partly stale: iron_golem's shield was already raised from 4 to 6, and its interval is still the slower 8000ms. The suggested fix's first option ("raise the shield toward the tank peers, e.g. +6-8") has effectively been applied (now +6). A residual, smaller outlier remains: +6/8000ms still trails desert_golem +10/7000ms and boss_iron_golem +12/7000ms (~1.7-2x per-tick plus the slower interval). Per-second armor: iron_golem 0.75/s vs 1.43/s and 1.71/s. If full curve-smoothing is desired, the only remaining lever from the finding is the BP-4 baseDefense 4->3 decision (orthogonal to the shield). Keep severity low; the shield resolver is functional and this is a numeric tuning observation, not a bug, and not C1-C5-governed. Do not change power beyond noting the gap.

### engine-deadcode (3)

**#9 t3-counter-counter-water (Crimson Cascade)** [still-applies/risk:medium/conf:high]

Still a single-enemy no-op for the 15s kill-spread clause; the upfront 3[bleed]([spi]) + 1 self-bleed still work. Until multi-enemy combat exists, either (a) replace the on_kill clause with a payoff that lands during combat (e.g. an on_hit/on_stack_threshold bleed amplifier), or (b) flag the on-kill clause as deferred future-content so the description does not promise an effect the engine can't realize. Do NOT change power levers beyond this (low severity, C1-C5 untouched). No card-text regen needed if mechanic is left as-is and documented.

**#10 Pyre-keyword burn detonators (t3-attack-fire-fire Cinderlance, t3-agility-fire-fire Cinder Sprint, t3-counter-fire-water Venom Detonation) + Quench Lance synergy** [partially-applies/risk:low/conf:high]

Part (a) of the suggested fix is already done (redundant explicit consume removed). Part (b) still open: if the Pyre+Quench-Lance synergy is intended, emit stack_consumed from the Pyre auto-consume path — e.g. at CardResolver.ts:353 capture `const consumedBurn = state.burnStacks;` before zeroing, then `if (consumedBurn > 0) { const payloads = bumpEventCounters(state,'stack_consumed',{stack:'burn',amount:consumedBurn}); for (const p of payloads) applyTriggeredPayload(state,p.effect,p.sourceCardId); }`. This is a synergy-wiring fix, not a power lever, so it does not violate C1-C5. If the synergy is deliberately not intended, mark the finding resolved (the dead-consume half is gone) and leave Quench Lance fed only by consume_stack_value detonators.

**#34 EnemyAI attack patterns ('random'/'scaling'/'conditional') and specialEffects ('double'/'stun'/'debuff'/'lifesteal') + single-hit drain fallback** [still-applies/risk:low/conf:high]

none required to the finding — STILL VALID (correctness-neutral dead code). Only correction: the roster is now 23 enemies, not 26 (PR #17 prune); the all-'fixed'/no-specialEffect property is unchanged, and bog_witch is still the sole drain enemy and still carries multi_hit, so the single-hit drain fallback remains unreachable. No correctness bug. Optional cleanup unchanged: author an enemy that uses a non-fixed pattern/specialEffect to justify the branches, or trim the unused branches and document that 'fixed' is the only live pattern. Not C1-C5-governed.

