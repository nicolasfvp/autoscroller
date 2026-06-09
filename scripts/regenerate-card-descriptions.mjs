#!/usr/bin/env node
// Bakes the runtime card-description formatter (src/systems/cards/CardText.ts)
// into cards.json so search, combat previews, and forge tooling stay in sync
// with the in-game text. Run this after editing CardText.ts.
//
// This imports the ACTUAL runtime formatter (Node 22 strips the TS types), so
// the baked text is guaranteed identical to what the card face renders. The
// `card-integrity-audit` test asserts stored === formatCardDescription(card)
// byte-for-byte for both the base and upgraded forms — keep this in lock-step.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { formatCardDescription } from '../src/systems/cards/CardText.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardsPath = resolve(__dirname, '..', 'src', 'data', 'json', 'cards.json');
const data = JSON.parse(readFileSync(cardsPath, 'utf-8'));

let updated = 0;
for (const card of data.cards) {
  const base = formatCardDescription({
    effects: card.effects,
    exhaust: card.exhaust,
    spend_armor: card.spend_armor,
  });
  if (base && base !== (card.description ?? '')) {
    card.description = base;
    updated++;
  }

  // Mirror the integrity test: only the upgraded forms that carry their own
  // stored description are checked, computed against upgraded effects (falling
  // back to the base effects when the upgrade only tweaks cost/cooldown).
  if (card.upgraded && card.upgraded.description !== undefined) {
    const up = formatCardDescription({
      effects: card.upgraded.effects ?? card.effects,
      exhaust: card.exhaust,
      spend_armor: card.spend_armor,
    });
    if (up && up !== card.upgraded.description) {
      card.upgraded.description = up;
      updated++;
    }
  }
}

writeFileSync(cardsPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`Updated ${updated} description(s) across ${data.cards.length} cards.`);
