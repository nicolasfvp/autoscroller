---
phase: 5
slug: balance-economy-overhaul
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-27
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (or vite.config.ts) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 05-01 | 1 | BAL-TYPES | unit | `npx vitest run` | Yes (existing suite) | pending |
| 05-01-T2 | 05-01 | 1 | BAL-DATA | verify | `node -e "require('./src/data/json/materials.json')"` | Yes (JSON validation) | pending |
| 05-01-T3 | 05-01 | 1 | BAL-MIGRATION | unit | `npx vitest run tests/state/meta-migration.test.ts` | W0 (created by task) | pending |
| 05-02-T1 | 05-02 | 2 | BAL-RESET | unit | `npx vitest run tests/systems/combat/CombatState.test.ts` | W0 (created by task) | pending |
| 05-02-T2 | 05-02 | 2 | BAL-COMBAT | unit | `npx vitest run tests/systems/combat/balance-validation.test.ts` | W0 (created by task) | pending |
| 05-03-T1 | 05-03 | 2 | BAL-SHOP, BAL-LOOP | unit | `npx vitest run tests/systems/ShopSystem.test.ts tests/systems/DifficultyScaler.test.ts` | W0 (created by task) | pending |
| 05-03-T2 | 05-03 | 2 | BAL-MATERIALS, BAL-DEATH, BAL-STOREHOUSE | unit | `npx vitest run tests/systems/LootGenerator.test.ts tests/systems/MetaProgressionSystem.test.ts tests/systems/RunEndResolver.test.ts` | W0 (created by task) | pending |
| 05-04-T1 | 05-04 | 3 | BAL-INTEGRATION | unit | `npx vitest run` | Yes (full suite) | pending |
| 05-04-T2a | 05-04 | 3 | BAL-INTEGRATION | unit | `npx vitest run` | Yes (full suite) | pending |
| 05-04-T2b | 05-04 | 3 | BAL-INTEGRATION, BAL-RESET | unit | `npx vitest run` | Yes (full suite) | pending |
| 05-04-T3 | 05-04 | 3 | BAL-INTEGRATION | manual | Visual browser verification | N/A | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [x] Test stubs for MetaState migration (v1 metaLoot:number -> v2 materials:Record) — 05-01-T3 creates tests/state/meta-migration.test.ts
- [x] Test stubs for resource reset between combats (50% stamina/mana recovery) — 05-02-T1 creates tests/systems/combat/CombatState.test.ts
- [x] Test stubs for combat DPS validation (card damage * cooldown cycle vs enemy HP = target fight duration) — 05-02-T2 creates tests/systems/combat/balance-validation.test.ts
- [x] Test stubs for gold scaling price formulas (cards, removal, reorder, relics with caps) — 05-03-T1 creates tests/systems/ShopSystem.test.ts
- [x] Test stubs for difficulty scaling curve (enemy stat progression per loop) — 05-03-T1 creates tests/systems/DifficultyScaler.test.ts
- [x] Test stubs for multi-material drop calculations (terrain + enemy sourcing) — 05-03-T2 creates tests/systems/LootGenerator.test.ts
- [x] Test stubs for building recipe validation (multi-material costs) — 05-03-T2 creates tests/systems/MetaProgressionSystem.test.ts
- [x] Test stubs for death penalty calculation (10% base, Storehouse upgrades to 50%) — 05-03-T2 creates tests/systems/RunEndResolver.test.ts

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Combat feels 5-8s | Combat balance | Subjective timing | Run starter deck vs Slime on loop 1, time the fight |
| Shop prices feel fair | Gold economy | Subjective UX | Play through 3 loops, check if purchases feel meaningful |
| Material drops feel rewarding | Material economy | Subjective UX | Complete a loop with mixed terrains, check material variety |
| 50% stamina recovery noticeable | Resource attrition | Subjective feel | Fight 2-3 combats, observe stamina not refilling to max |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
