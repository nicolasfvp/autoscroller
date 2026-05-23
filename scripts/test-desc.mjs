import { formatCardDescription } from '../src/systems/cards/CardText.ts';
import cardsData from '../src/data/json/cards.json' with { type: 'json' };

const samples = ['t1-attack', 't1-fire', 't2-fire-fire', 't3-attack-fire-fire', 't3-counter-counter-defense', 't3-earth-fire-water'];
for (const id of samples) {
  const card = cardsData.cards.find((c) => c.id === id);
  if (!card) { console.log(`${id}: NOT FOUND`); continue; }
  const desc = formatCardDescription({
    effects: card.effects,
    exhaust: card.exhaust,
    spend_armor: card.spend_armor,
    cooldown_scale: card.cooldown_scale,
  });
  console.log(`${id} (${card.name}):`);
  console.log(`  formatter   >>> ${JSON.stringify(desc)}`);
  console.log(`  json.descr  >>> ${JSON.stringify(card.description)}`);
}
