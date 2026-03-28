---
phase: 7
slug: polish-release
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.x |
| **Config file** | package.json `"test": "vitest run --reporter=verbose"` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

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
| 07-01-01 | 01 | 1 | POLISH-AUDIO | unit | `npx vitest run tests/audio/AudioManager.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | POLISH-STYLE | unit | `npx vitest run tests/ui/StyleConstants.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | POLISH-META | unit | `npx vitest run tests/state/MetaMigration.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 2 | POLISH-SPEED | unit | `npx vitest run tests/systems/GameSpeed.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | CMBT-05 | manual-only | Visual scene verification | N/A | ⬜ pending |
| 07-02-03 | 02 | 2 | PLSH-01 | manual-only | Visual scene verification | N/A | ⬜ pending |
| 07-03-01 | 03 | 3 | POLISH-TRANSITIONS | manual-only | Visual verification -- camera fades on scene transitions | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/audio/AudioManager.test.ts` — test tone config resolution, volume scaling, mute behavior (mock AudioContext)
- [ ] `tests/ui/StyleConstants.test.ts` — test that all color/font/layout constants are defined
- [ ] `tests/systems/GameSpeed.test.ts` — test that tick receives multiplied delta
- [ ] `tests/state/MetaMigration.test.ts` — test MetaState v2->v3 migration adds tutorialSeen, audioPrefs

*(AudioContext cannot be fully tested in Node/vitest -- mock the Web Audio API. Test the tone config resolution and gain calculations, not actual audio output.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Post-combat summary shows stats | CMBT-05 | Visual scene -- already implemented | Win combat, verify summary shows damage dealt/received, cards played, combos, XP |
| Death screen shows run statistics | PLSH-01 | Visual scene -- already implemented | Trigger hero death, verify death screen shows loops, damage, cards, combos, cause of death, retention |
| Camera fade transitions | POLISH-TRANSITIONS | Visual effect timing | Navigate between scenes, verify fade-in/fade-out (300-500ms) on full transitions |
| Tutorial step-through | POLISH-TUTORIAL | Interactive flow | Start first run with fresh meta, verify tutorial triggers, covers core loop, skippable |
| Settings UI | POLISH-SETTINGS | Interactive controls | Open settings, verify SFX slider, game speed toggle, save management options |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
