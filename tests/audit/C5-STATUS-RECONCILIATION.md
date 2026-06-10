# C5 status-system: spec vs code reconciliation (2026-06-09)

C5 is **locked, "engine-implemented"** — so where the written spec and the engine disagree, the **engine is authoritative** and the written text is what needs correcting (no code change). Audited every clause against `CombatEngine.ts` (tick loop), `CardResolver.ts` (application/consume), `EnemyAI.ts` (slow/stun effects), and `cards.json`.

| C5 clause (as written) | Engine reality (cited) | Verdict |
|---|---|---|
| **poison/bleed = quadratic DoT** | poison `dmg = min(poisonStacks, 60)` (1/stack/tick), decay −1 every 2nd tick (`CombatEngine.ts:464-481`); bleed `dmg = min(bleedStacks*perStack, 60)`, perStack 1 (2 if enemy attacked), decay −1/tick (`:486-501`). Per-tick is **linear**; the **cumulative** total over the decaying pool is the triangular sum N+(N−1)+… = **quadratic in pool size**. | ✅ MATCH (quadratic = cumulative, not per-tick) |
| **burn = bank-and-cash soft-cap** | `base = stacks≤8 ? stacks : 8 + floor((stacks−8)/2)`, **non-decaying**, consumed only by Pyre detonators, clamped to 60/tick (`:507-523`). Comment notes it was rebalanced from a hard `min(8)` to this soft cap. | ✅ MATCH |
| **slow = pure soft control, NO damage** | No tick damage; 8%/stack cooldown throttle, cap 50% (80% w/ Stormcaller's Rod), decay −1/tick (`:537-541`, `EnemyAI.ts:36-37`). | ✅ MATCH (a stale *docstring* at `:442` says "stacks damage" — the code does not; docstring is stale) |
| **stun = pure hard control, NO damage** | No damage; halts enemy cooldown; decay −1/tick; post-freeze STUN_IMMUNE_MS window prevents perma-chain (`:525-535`). | ✅ MATCH |
| **rage = Fury, never spent, flat dmg/stack cap 12, threshold-gated payoffs** | `rageBonus = min(rageStacks, 12)` flat damage add (`CardResolver.ts:458`); **no card consumes rage** (0 `consume_stack:rage` in cards.json; payoffs use `self_stack_atleast` gates). Accumulation itself is uncapped; only the damage *bonus* caps at 12. | ✅ MATCH |
| **6 stacks, no merge** | **"no merge" ✅** — auras don't merge unless `extend_aura` (`CardResolver.ts:751-765`). **"6 stacks" ❌** — there is **no 6-stack cap anywhere**. DoT application is uncapped (`stacks += value`); the only binding limit is the per-tick throughput cap `DOT_CHUNK_CAP = 60` damage/tick. | ⚠️ "no merge" matches; **"6 stacks" is STALE** |

## The one divergence: "6 stacks"

There is no 6-stack cap in the engine. DoT pools (poison/bleed/burn) grow **unbounded by application**; the engine instead limits *throughput* via the 60-damage/tick chunk cap plus per-status decay. The engine comments explicitly document this as a deliberate **rebalance** ("soft cap (was hard `min(8)`)…", "Rebalance: now PURE soft control"). So the "6 stacks, no merge" line predates the rebalanced status engine.

**Recommendation (no code change — C5 is engine-authoritative):** update the *written* C5 spec / memory from "6 stacks, no merge" to the real model:

> Statuses do not merge (auras extend rather than stack a duplicate). DoT stacks (poison/bleed/burn) are **uncapped in application** but **throughput-capped at 60 damage/tick** and shaped by per-status decay (poison −1/2-ticks, bleed −1/tick, burn non-decaying/detonator-consumed). Rage is never spent; its damage bonus caps at 12.

## Practical implication (already reflected in this pass)
Because DoT pools are unbounded but only tick 60/sec, a deck that out-applies the tick rate **banks a standing pool that is forfeited when the enemy dies** — which is exactly why the `avgDamageDealt`-at-kill swap metric under-credits DoT (see the bleed verdict). Any future DoT-card power evaluation must use a standing-pool-aware or longer-window metric, not raw kill-time damage.

**Bottom line:** the status engine is internally consistent and matches 5/6 C5 clauses exactly; the lone gap is a stale written "6 stacks" that should be reworded to the throughput-cap model. No engine change recommended.
