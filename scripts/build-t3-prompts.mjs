#!/usr/bin/env node
// Build a card-prompts JSON for all T3 cards using the v2 style template
// (Slay-the-Spire / Hearthstone painted dark-fantasy illustration).
//
// The user signed off on the 8 ambiguous bleed/poison cards using the
// "paint the mechanical effect" interpretation — see the special-case
// switch at the bottom of buildPrompt().
//
// Output: scripts/card-prompts-t3.json
// Run with: node scripts/generate-card-grok.mjs --batch scripts/card-prompts-t3.json

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const cardsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/json/cards.json'), 'utf8'));

const STYLE_PREAMBLE =
  'Dark fantasy trading card game illustration, painted digital art in the style of Slay the Spire and Hearthstone, ' +
  'dramatic moody lighting, deep dark near-black background, centered square composition with the main action dead-center ' +
  'so it survives both a tall in-hand crop and a wide popup crop, no text no UI no borders, masterwork painterly quality.';

const WARRIOR =
  'a young human warrior with short messy brown hair, full silver-steel plate armor (pauldrons, breastplate, gauntlets, greaves), ' +
  'a tan-brown tattered tabard, brown leather belts and straps, wielding a large two-handed steel longsword';

const SORCERESS =
  'a slender female elf sorceress with long flowing dark-purple hair, pointed ears, deep purple velvet robe-dress with silver plate pauldrons ' +
  'and silver knee greaves, a tall dark wooden staff topped with a purple gemstone orb held in her left hand';

const HYBRID =
  'a tall spellblade — a stoic human paladin with cropped dark hair, silver-steel half-plate over deep purple robes, ' +
  'wielding both a steel longsword in his right hand and channeling arcane energy with his open left hand';

// Status effect signature colors take priority over raw element colors when the
// card description shows the effect is the visual story.
const STATUS_COLOR = {
  poison: { hex: '#65A30D', name: 'toxic-green', visual: 'sickly green vapor and bubbling acid' },
  bleed:  { hex: '#B91C1C', name: 'crimson red',  visual: 'wet arterial crimson blood spray and mist' },
  burn:   { hex: '#F97316', name: 'orange-red',  visual: 'searing orange flames and embers' },
  stun:   { hex: '#FACC15', name: 'golden-yellow', visual: 'forking yellow lightning arcs' },
  slow:   { hex: '#93C5FD', name: 'pale icy-blue', visual: 'crystalline frost and slow-falling snow' },
  rage:   { hex: '#EF4444', name: 'blood-red',   visual: 'furious red battle aura' },
  armor:  { hex: '#6B7280', name: 'steel-gray',  visual: 'rune-lit steel barriers and ward sigils' },
};

const ELEMENT_COLOR = {
  attack:  { hex: '#DC2626', name: 'crimson red',     visual: 'crimson speed trails' },
  defense: { hex: '#6B7280', name: 'steel-gray',      visual: 'steel rune light' },
  agility: { hex: '#FACC15', name: 'golden-yellow',   visual: 'golden afterimage motion blur' },
  counter: { hex: '#B91C1C', name: 'dark crimson',    visual: 'reactive vengeance crimson energy' },
  fire:    { hex: '#F97316', name: 'orange-red',      visual: 'fire glow and embers' },
  water:   { hex: '#0EA5E9', name: 'cyan-blue',       visual: 'flowing water and mist' },
  air:     { hex: '#C4B5FD', name: 'lavender-purple', visual: 'swirling wind shimmer' },
  earth:   { hex: '#92400E', name: 'earth-brown',     visual: 'cracked stone and dust' },
};

const PHYSICAL = new Set(['attack', 'defense', 'agility', 'counter']);
const ELEMENTAL = new Set(['fire', 'water', 'air', 'earth']);

function pickSubject(elements) {
  const allPhysical = elements.every(e => PHYSICAL.has(e));
  const allElemental = elements.every(e => ELEMENTAL.has(e));
  if (allPhysical) return WARRIOR;
  if (allElemental) return SORCERESS;
  return HYBRID;
}

function pickDominantColor(card) {
  // Priority: status effect mentioned in description > strongest element color.
  const desc = (card.description || '').toLowerCase();
  const statusOrder = ['poison', 'bleed', 'burn', 'stun', 'slow', 'rage'];
  for (const s of statusOrder) {
    if (desc.includes(`[${s}]`)) return STATUS_COLOR[s];
  }
  // No status → pick a non-counter element if present (counter shares red with attack)
  const nonCounter = card.elements.find(e => e !== 'counter');
  return ELEMENT_COLOR[nonCounter ?? card.elements[0]];
}

function actionVerb(card) {
  const name = card.name;
  const desc = (card.description || '');
  // Build a short imperative line describing what the figure is doing.
  // Falls back to a generic combat stance when the card name is abstract.
  const hasDamage = /damage|deal|pierce|cleave|strike|lance|slash|jab|hit|smash|crush|tear/i.test(name + ' ' + desc);
  const hasHeal = /heal|mend|rejuv|brine|soak/i.test(name);
  const hasShield = /shield|bulwark|guard|aegis|plate|ward|fortify|brace|stagnant/i.test(name);
  const hasAoe = /tempest|cascade|squall|storm|reckoning|plague|swarm|crater|nova|burst|tide|wave|wrath/i.test(name);
  if (hasAoe) {
    return 'unleashing a sweeping AREA-OF-EFFECT attack — energy radiating outward in a wide ring around them, all directions';
  }
  if (hasShield) {
    return 'planted in a low defensive stance, energy coalescing into a glowing protective barrier directly in front of them';
  }
  if (hasHeal) {
    return 'channeling restorative energy that wraps around their body in luminous ribbons';
  }
  if (hasDamage) {
    return 'mid-attack — body committed forward, weapon or spell driving toward the viewer in a powerful single strike';
  }
  return 'in a charged spellcasting stance, raw elemental energy gathering around their hands and weapon';
}

function namedAction(card) {
  // Pull the card's name as a stylistic note so the artist has something to anchor on.
  return `The illustration is titled "${card.name}".`;
}

function buildPrompt(card) {
  const subject = pickSubject(card.elements);
  const color = pickDominantColor(card);
  const action = actionVerb(card);
  const titleHint = namedAction(card);
  // Element list for visual flavor — converted to color words so the painter
  // weaves the right palette in.
  const elementBlend = card.elements
    .map(e => ELEMENT_COLOR[e].name)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(' and ');

  // Special-case the 8 ambiguous cards (per user direction):
  let actionOverride = null;
  switch (card.id) {
    case 't3-attack-attack-attack':
      actionOverride = 'triple-slashing the air in a frenzied combo, his own blood spattering off his blade — three crimson afterimage swings overlap and his own self-inflicted bleeding mists around him';
      break;
    case 't3-agility-counter-counter':
      actionOverride = 'whirling through three rapid sword arcs in tight cadence, each arc cleaving a crimson blood mist trail behind it, his stance coiled to counter';
      break;
    case 't3-agility-attack-counter':
      actionOverride = 'driving a precision thrust toward an unseen target — a crimson spray bursts from the strike line, additional bleed arcs forming as ribbons of red';
      break;
    case 't3-agility-counter-defense':
      actionOverride = 'crouched behind a wall of thorny brambles entwined in his armor, the thorns dripping blood, ready to bleed any attacker on retaliation';
      break;
    case 't3-fire-fire-water':
      actionOverride = 'extending a long lance of hissing steam and crimson sparks toward the viewer — the lance converts fire into wet arterial crimson, blood and burn together';
      break;
    case 't3-agility-counter-fire':
      actionOverride = 'dashing with a flaming razor-edged blade, leaving a curving trail of orange flame and crimson blood spray together';
      break;
    case 't3-attack-fire-water':
      actionOverride = 'driving his greatsword into the ground — the impact detonates a shockwave that scatters glowing icons of toxic green, crimson red, and ember orange outward';
      break;
    case 't3-defense-fire-water':
      actionOverride = 'planted behind a steaming shield wall — boiling water hisses against red-hot steel, releasing a toxic green vapor that wreathes around him';
      break;
  }

  const finalAction = actionOverride ?? action;

  return [
    STYLE_PREAMBLE,
    `Subject: ${subject}.`,
    `${titleHint} They are ${finalAction}.`,
    `Color palette weaves ${elementBlend}, with a dominant ${color.hex} ${color.name} key light and ${color.visual} as the signature visual effect.`,
    `The main action and the character's torso are dead-center in the frame.`,
  ].join(' ');
}

const t3 = cardsData.cards.filter(c => c.tier === 3);
const prompts = t3.map(c => ({ id: c.id, prompt: buildPrompt(c) }));
const outPath = path.join(ROOT, 'scripts/card-prompts-t3.json');
fs.writeFileSync(outPath, JSON.stringify(prompts, null, 2));
console.log(`Wrote ${prompts.length} T3 prompts -> ${outPath}`);
