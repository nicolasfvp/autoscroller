// Card content sanity check for the Phase 10 element-driven system.
// Source of truth: docs/CARDS_SYSTEM.md (§3 tier counts, §8 schema, §15 generation rules).
//
// Pre-Phase 10 state: this file enforced per-rarity RPU bands tuned for the v2 design.
// The element system intentionally varies cost/CD per card (see §3 "tier does NOT dictate
// cost or cooldown"), so locking the new pool to numeric RPU bands would fight the design.
//
// New approach: validate STRUCTURAL correctness of the generated pool (effects + scaling
// + tier counts + element tagging). Numeric balance is owned by the design docs, not tests.

import { describe, it, expect } from "vitest";
import cardsData from "../../src/data/json/cards.json";
import type { CardDefinition } from "../../src/data/types";

describe("Phase 10 card pool — structural sanity", () => {
  const cards = cardsData.cards as CardDefinition[];
  const tier1 = cards.filter((c) => (c as any).tier === 1);
  const tier2 = cards.filter((c) => (c as any).tier === 2);

  it("contains 36 Tier 1 cards", () => {
    expect(tier1.length).toBe(36);
  });

  it("contains 120 Tier 2 cards", () => {
    expect(tier2.length).toBe(120);
  });

  it("every Tier 1 card has at least one effect", () => {
    const empty = tier1.filter((c) => !c.effects || c.effects.length === 0);
    expect(empty.map((c) => c.id)).toEqual([]);
  });

  it("every Tier 2 card has at least one effect", () => {
    const empty = tier2.filter((c) => !c.effects || c.effects.length === 0);
    expect(empty.map((c) => c.id)).toEqual([]);
  });

  it("every Tier 1 card declares exactly 2 elements (per §3)", () => {
    const offenders: string[] = [];
    for (const c of tier1) {
      const elems = (c as any).elements;
      if (!Array.isArray(elems) || elems.length !== 2) {
        offenders.push(`${c.id}: elements=${JSON.stringify(elems)}`);
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });

  it("every Tier 2 card declares exactly 3 elements (per §3)", () => {
    const offenders: string[] = [];
    for (const c of tier2) {
      const elems = (c as any).elements;
      if (!Array.isArray(elems) || elems.length !== 3) {
        offenders.push(`${c.id}: elements=${JSON.stringify(elems)}`);
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });

  it("every card id follows the canonical t{tier}-{elements} pattern (per §9)", () => {
    const offenders: string[] = [];
    for (const c of cards) {
      const tier = (c as any).tier;
      const elements = (c as any).elements as string[] | undefined;
      if (!tier || !elements) continue;
      const expected = `t${tier}-${[...elements].sort().join("-")}`;
      if (c.id !== expected) {
        offenders.push(`${c.id} (expected ${expected})`);
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });

  it("at least 80% of Tier 1 cards carry a stat-scale on some effect (per §15)", () => {
    // §15 generation rule: most cards should have at least one effect with `scale`.
    // We expect near-total coverage; allow a few hand-tuned exceptions (e.g. pure
    // utility/generator cards where scaling would distort the budget).
    const withScale = tier1.filter((c) =>
      c.effects.some((e: any) => e.scale && e.scale.stat),
    );
    expect(withScale.length / tier1.length).toBeGreaterThanOrEqual(0.8);
  });

  it("at least 90% of Tier 2 cards carry a stat-scale on some effect (per §15)", () => {
    const withScale = tier2.filter((c) =>
      c.effects.some((e: any) => e.scale && e.scale.stat),
    );
    expect(withScale.length / tier2.length).toBeGreaterThanOrEqual(0.9);
  });

  it("every card declares a numeric cooldown >= 0", () => {
    const offenders: string[] = [];
    for (const c of cards) {
      if (typeof c.cooldown !== "number" || c.cooldown < 0 || !Number.isFinite(c.cooldown)) {
        offenders.push(`${c.id}: cooldown=${c.cooldown}`);
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });

  it("every card's elements use only the 8 canonical element IDs (per §2)", () => {
    const valid = new Set([
      "attack", "defense", "agility", "counter",
      "fire", "water", "air", "earth",
    ]);
    const offenders: string[] = [];
    for (const c of cards) {
      const elems = (c as any).elements as string[] | undefined;
      if (!elems) continue;
      for (const e of elems) {
        if (!valid.has(e)) offenders.push(`${c.id}: unknown element ${e}`);
      }
    }
    expect(offenders, offenders.join("; ")).toEqual([]);
  });
});
