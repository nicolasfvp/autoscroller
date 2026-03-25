---
phase: 1
slug: architecture-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (to be installed in Wave 0) |
| **Config file** | `vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | ARCH-03 | unit | `npx vitest run tests/core/eventbus.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | ARCH-02 | unit | `npx vitest run tests/state/runstate.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | ARCH-04 | unit | `npx vitest run tests/memory/listener-leak.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | ARCH-01 | unit | `npx vitest run tests/core/eventbus.test.ts -t "no phaser"` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | PERS-01 | integration | `npx vitest run tests/core/savemanager.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install -D vitest` — test framework
- [ ] `npm install -D fake-indexeddb` — IndexedDB mock for Node
- [ ] `vitest.config.ts` — configure with jsdom environment
- [ ] `tests/core/eventbus.test.ts` — EventBus unit tests (typed emit/on/off, cleanup, listener count)
- [ ] `tests/state/runstate.test.ts` — RunState creation, JSON serialization round-trip
- [ ] `tests/core/savemanager.test.ts` — SaveManager save/load/clear with fake-indexeddb
- [ ] `tests/memory/listener-leak.test.ts` — 20+ subscribe/unsubscribe cycles, assert 0 leaks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser refresh restores game state | PERS-01 | Requires real browser + IndexedDB | 1. Start run, complete combat, 2. Hard-refresh browser (F5), 3. Verify run resumes at correct state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
