# Phase 6 — Applied balance changes (2026-06-09)

All changes below are user-approved (discussion phase) and **verified: 462 unit tests + card-integrity pass, full matrix re-simmed**.

## Result: the difficulty curve now meets the Moderate target

Boss win-rate / HP-cushion by build quality × loop band (BEFORE = original flat curve → AFTER = applied):

| Band | random BEFORE | random AFTER | naive AFTER | optimized AFTER | mixed AFTER |
|---|---|---|---|---|---|
| 1–10 | 0.93 / 0.65 | 0.93 / 0.68 | 1.00 / 0.61 | 1.00 / 0.62 | 1.00 / 0.61 |
| 11–20 | 0.80 / 0.86 | 0.60 / 0.82 | 0.77 / 0.76 | 0.92 / 0.54 | 0.87 / 0.64 |
| 21–40 | 0.95 / 0.89 | 0.85 / 0.47 | 0.92 / 0.53 | 0.92 / 0.49 | 0.89 / 0.65 |
| 41–60 | 0.85 / 0.72 | 0.65 / 0.53 | 0.77 / 0.69 | 0.92 / 0.62 | 0.83 / 0.63 |
| 61–70 | 1.00 / 0.74 | 0.30 / 0.22 | 0.62 / 0.46 | 0.62 / 0.44 | 0.86 / 0.48 |

Early game stays clearable by ANY build; random/bad builds now collapse to 30% at the final boss; average builds are pressured; well-built/optimized decks pull ahead. doom_knight (first boss) deliberately kept easy (0.99 win / 0.63 cushion).

Key lesson confirmed mid-iteration: **boss HP doesn't gate, boss DAMAGE does** (a tankier boss is just a longer fight a durable deck survives).

## Changes applied
**Scaling / root cause (decided: flatten hero scaling):**
- `HeroStatsResolver`: in-run leveling now DIMINISHES past level 7 — early game identical (accessible), deep heroes much weaker (L18 offense 5 vs 9, maxHP 75 vs 108) so DECKS matter more than raw stats.
- `difficulty.json`: percentPerBossKill 0.10 → 0.15.

**Bosses:**
- doom_knight: unchanged (kept easy).
- iron_golem: shield 4→8 + added 2-hit (multi_hit ×2 @0.6).
- bog_witch: drain 15→25%, baseHP 410→470, damage 7→10.
- lizard_king: baseHP 370→440, damage 10→13.
- desert_golem & boss_iron_golem: added multi_hit ×2 @0.6.
- `EnemyAI`: boss shield armor capped at 40 (no infinite ratchet).

**Cards (buff weak / A/B-verified):**
- Supernova: un-exhaust, cd 2.8→2.2, per-burn 5→7.
- Quench Lance: cd 2.4→1.6, burn 2→4, int-gain threshold 10→6, +6 opener hit.
- Tidesong Aura: cd 2.4→1.6, heal scaling +.
- Gale Echo: cd 2.4→1.6, + flat body (deal 4 AoE + apply 3 slow).
- Riposte: cd 2.0→1.2, on-hit 3→5.
- Cinderlance & Pyre: per-burn detonation 3→5 (burn archetype).
- Thunderstrike Catalyst: cd 2→1.8, per-slow 6→8; Concussive Smash: base 14→18 (control win-con).
- Cleaver's Tax: removed never-applied overload_lockout_ms (text now honest).

## Batch C — engine-correctness fixes (APPLIED 2026-06-09)

Each fix has a dedicated test guard in `tests/systems/combat/batch-c-fixes.test.ts` (21 guards) and
was adversarially re-verified by an 8-reviewer + critic workflow against the current code. Full suite:
**766 tests, 764 pass / 2 skip**; the lone failure (`StyleConstants` expecting font "Inter") is the
pre-existing, unrelated font-rework test. Typecheck clean. Card-integrity green (only Marsh Squall's
stored description changed, and correctly).

Three small schema additions in `types.ts`: `CardEffect.literal_damage`, `CardEffect.extend_aura`,
`CardEffectCondition.pre_consume`.

1. **Vengeful Pyre `exhaust_next`** — `devour.exhaust_next` now surfaces `ResolveResult.exhaustNext`;
   `CombatEngine.markNextSlotExhausted()` devours the next play-order slot (edge-safe: 1-card deck no-op,
   skips already-devoured, never self).
2. **Full rage-double** — `StatusEffects.applyTriggeredPayload` now applies `stack_gain_mult`, so
   Vengeful Pyre doubles rage from triggers/ticks/Brace/low-HP, not just directly-played rage.
3. **Self-gates read pre-cast** — new `condition.pre_consume` flag; the resolver's `gateStack()` reads the
   pre-cast snapshot for that gate. Set ONLY on Steaming Plague + Vein Splitter (their "If enemy has [X]"
   now means PRE-EXISTING X). per_stack multipliers (Pyre detonators) stay live; all other gate cards
   (Slipvenom, Kindle, Stormstone) unchanged — verified.
4. **Shield Bash literal armor dmg** — new `literal_damage` flag bypasses STR/Rage/hit-bonus/relic/elem
   mults; with `pierce_armor` the hit equals current armor exactly. CardText branch relaxed so the clean
   "Deal damage equal to your [armor]" text survives the added pierce.
5. **Razor Stance extends its aura** — new `extend_aura` flag on BOTH aura effects; a recast/Vengeance
   adds ttl to the existing same-source aura instead of arming a second concurrent bleed-on-hit aura
   (no double bleed). Match scoped by `sourceCardId` to never merge across cards.
6. **Marsh Squall snapshot** — effects reordered to [detonate, strip, apply] so the burst pays on the
   same pool the strip removes (self-applied poison no longer inflates the strip vs the burst).
7. **SPI on aura/triggered heals** — `applyTriggeredPayload` heal gets the universal +15%/pt SPI mult
   (parity with direct heals): Standing Stone Brace heal, Crimson Regen Mantle tick heal, etc.
8. **Dust Plague stun threshold** — `checkEnemyStackThreshold` exported; `CombatEngine.tick()` re-checks
   enemy stack thresholds after periodic aura-tick payloads, so tick-applied slow can cross the
   slow≥5→stun threshold. Stun applied via any trigger payload now respects the immunity window.

**Cleanup:** removed the 3 dead Pyre explicit-consume effects (Cinderlance / Cinder Sprint / Venom
Detonation — the Pyre keyword auto-consumes; 0 desc change); removed the dead/misleading
`tiles.json combatChance` field (claimed 1.0 while spawn is hardcoded 0.5) + its orphaned interface field.

### Deferred (NOT done — out of correctness scope or design calls)
- **Wording-only nuances** (LOW unclear_desc, integrity-locked): one-shot HP-gate auras
  (Stonewrath/Tombrage/Tombplate/Quickstone, Phoenix Aura) read as sustained checks; Mountain's Answer
  self-armor gate; Brine Crucible cd_debt "Next card" vs this card; Aegis "armor it just granted". Left
  as polish to avoid broad formatter churn.
- **Crimson Cascade on-kill** bleed-spread — inert in single-enemy combat; intentional future-content
  hook (documented, not removed).
- **Pyre→Quench Lance synergy** — Pyre detonations still emit no `stack_consumed`, so they can't feed
  Quench Lance's counter. Wiring it is a balance/design call, not correctness — deferred.
- **EnemyAI non-`fixed` patterns / `specialEffect` branches** and **EnemyAffinity `agility` near-no-op** —
  unreachable/near-inert dead branches; left for a dedicated dead-code pass (touch enemy combat logic).
- **green_field phantom enemies** — documented only (data-warnings.json).
- **Balance smells** (Quickstrike 2-stamina, Galekick vs Tempest Pike, Body Slam Vow armor breadth) —
  these are balance, not correctness; out of Batch C scope.
