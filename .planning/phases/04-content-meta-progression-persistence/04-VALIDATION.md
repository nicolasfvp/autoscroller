---
phase: 04
slug: content-meta-progression-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed in Phase 3 Wave 0, or install here if not present) |
| **Config file** | `vitest.config.ts` (exists from Phase 3, or Wave 0 creates) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CONT-01 | unit | `npx vitest run tests/content.test.ts -t "card count"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CONT-02, RELC-04 | unit | `npx vitest run tests/content.test.ts -t "relic"` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | CONT-03 | unit | `npx vitest run tests/content.test.ts -t "boss types"` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | CONT-04 | unit | `npx vitest run tests/content.test.ts -t "event count"` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | RELC-01, RELC-02 | unit | `npx vitest run tests/relics.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-06 | 01 | 1 | RELC-03 | unit | `npx vitest run tests/loot.test.ts -t "relic sources"` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | META-01 | manual | Manual: verify CityHubScene renders | n/a | ⬜ pending |
| 04-02-02 | 02 | 2 | META-02 | unit | `npx vitest run tests/unlocks.test.ts -t "card unlock"` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | META-03 | unit | `npx vitest run tests/unlocks.test.ts -t "tile unlock"` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 2 | META-04 | unit | `npx vitest run tests/persistence.test.ts -t "class xp"` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | PERS-02 | integration | `npx vitest run tests/persistence.test.ts -t "meta save load"` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | PERS-03 | unit | `npx vitest run tests/rng.test.ts -t "deterministic"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install -D fake-indexeddb` — for testing idb-keyval MetaState in Node
- [ ] `tests/content.test.ts` — validates card/relic/boss/event counts and uniqueness (CONT-01..04, RELC-04)
- [ ] `tests/relics.test.ts` — validates relic effect application and modifier types (RELC-01, RELC-02)
- [ ] `tests/loot.test.ts` — validates loot pool filtering by unlock state, relic sources (RELC-03)
- [ ] `tests/unlocks.test.ts` — validates unlock filtering, card/tile unlock into loot pool (META-02, META-03)
- [ ] `tests/persistence.test.ts` — validates MetaState save/load cycle with fake-indexeddb (META-04, PERS-02)
- [ ] `tests/rng.test.ts` — validates SeededRNG determinism, same seed = same sequence (PERS-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| City hub displays buildings and progression | META-01 | Phaser scene rendering + click interactions | Launch game, complete a run, verify city hub shows buildings, click each building to verify upgrade panels work |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
