// Audit: for each card, list (a) what the current cost-block detector picks up
// and (b) what the engine actually consumes / requires. Mismatches are bugs.
import d from '../src/data/json/cards.json' with { type: 'json' };

const cards = d.cards;

function detectorRows(card) {
  // Mirrors buildCostRows() in CardVisual.ts / CardDetailPopup.ts (non-upgraded path).
  const rows = [];
  const push = (qty, token) => rows.push(`${qty}[${token}]`);
  const cost = card.cost;
  const effects = card.effects ?? [];
  if (cost?.stamina) push(cost.stamina, 'stam');
  if (cost?.mana) push(cost.mana, 'mana');
  if (cost?.defense) push(cost.defense, 'defense');
  for (const fx of effects) {
    if (fx.type !== 'stack' || !fx.consume_stack || !fx.stack) continue;
    const amount = Math.abs(fx.value);
    push(amount >= 99 ? 'X' : String(amount), fx.stack);
  }
  for (const fx of effects) {
    if (fx.type !== 'convert_stack' || !fx.from) continue;
    if (rows.some(r => r.endsWith(`[${fx.from}]`))) continue;
    const v = fx.value ?? 0;
    push(v >= 99 ? 'X' : String(v), fx.from);
  }
  const pyre = effects.some(fx =>
    fx.type === 'damage'
    && fx.condition?.enemy_has_stack === 'burn'
    && fx.condition?.per_stack === true,
  );
  if (pyre && !rows.some(r => r.endsWith('[burn]'))) push('X', 'burn');
  if (card.spend_armor !== undefined) {
    push(card.spend_armor === 'all' ? 'X' : String(card.spend_armor), 'armor');
  }
  if (card.exhaust) rows.push('[exhaust]');
  return rows;
}

function expectedConsumes(card) {
  // What the engine *actually* consumes, plus what the spec says should show.
  const out = [];
  for (const fx of card.effects ?? []) {
    // 1) Explicit consume_stack — already covered by detector.
    if (fx.type === 'stack' && fx.consume_stack && fx.stack) {
      // Detector already picks this up.
      continue;
    }
    // 2) Pyre semantic: damage + enemy_has_stack:'burn' + per_stack:true →
    //    engine consumes the entire burn pool (CardResolver line ~279).
    if (
      fx.type === 'damage'
      && fx.condition?.enemy_has_stack === 'burn'
      && fx.condition?.per_stack === true
    ) {
      out.push({ missing: 'X[burn]', reason: 'Pyre detonate (enemy_has_stack:burn + per_stack)' });
    }
    // 3) consume_stack_value: effect multiplies by pre-consume snapshot.
    //    The actual consumption MUST be a paired stack effect with consume_stack.
    //    If a card has consume_stack_value but no paired consume_stack of that
    //    stack, the cost block is ALSO missing.
    if (fx.consume_stack_value) {
      const paired = (card.effects ?? []).some(o =>
        o.type === 'stack' && o.consume_stack && o.stack === fx.consume_stack_value
      );
      if (!paired) {
        out.push({
          missing: `X[${fx.consume_stack_value}]`,
          reason: `consume_stack_value:${fx.consume_stack_value} without paired consume_stack effect`,
        });
      }
    }
    // 4) convert_stack: consumes `from` stack.
    if (fx.type === 'convert_stack' && fx.from) {
      const qty = fx.value >= 99 ? 'X' : String(fx.value);
      out.push({ missing: `${qty}[${fx.from}]`, reason: `convert_stack from ${fx.from}` });
    }
    // 5) multiply_stack — also reads the stack but doesn't consume; skip.
  }
  return out;
}

const issues = [];
for (const c of cards) {
  const have = detectorRows(c);
  const expected = expectedConsumes(c);
  const trulyMissing = expected.filter(m => {
    const stk = m.missing.replace(/^\d+|^X/, '').replace(/[\[\]]/g, '');
    return !have.some(r => r.endsWith(`[${stk}]`));
  });
  if (trulyMissing.length === 0) continue;
  issues.push({ id: c.id, name: c.name, have, missing: trulyMissing });
}

console.log(`Cards with missing cost-block entries: ${issues.length} / ${cards.length}`);
console.log();
for (const i of issues) {
  console.log(`[${i.id}] ${i.name}`);
  console.log(`  detected cost: ${i.have.join(' ') || '(none)'}`);
  for (const m of i.missing) {
    console.log(`  MISSING ${m.missing}  ← ${m.reason}`);
  }
  console.log();
}
