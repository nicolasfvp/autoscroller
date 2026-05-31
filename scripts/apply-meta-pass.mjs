// Meta-progression pass (user-approved "fazer os prédios funcionarem").
// Makes the Village buildings actually function:
//  - Shrine: gate 26 strong/rare relics behind shrine tiers (unlockSource).
//  - Forge: drop 24 phantom legacy card IDs; the building now gates crafting
//    tiers + gold discount (ForgeSystem + ElementSystem), not loot.
//  - Library: drop phantom passive IDs; building grants a class-XP multiplier
//    (MetaProgressionSystem.getLibraryXPMultiplier) so XP-gated passives unlock
//    faster across runs (totalXP is now seeded from meta.classXP in createNewRun).
//  - Workshop: L3 now unlocks desert + lava terrain (was empty).
//  - Tavern/Storehouse: already functional (Tavern gold now read in createNewRun).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'json');
const relicsPath = join(root, 'relics.json');
const buildingsPath = join(root, 'buildings.json');

// --- Shrine relic gating ---------------------------------------------------
const shrineTiers = {
  1: ['iron_will', 'first_strike_amulet', 'thin_deck_charm', 'swift_boots', 'heavy_tome'],
  2: ['berserker_ring', 'glass_cannon', 'catalyst_core', 'crimson_stiletto', 'stormcallers_rod', 'echo_chamber'],
  3: ['phoenix_feather', 'demon_heart', 'sanguine_pact', 'bloodgorged_heart', 'soulforge_chalice', 'hemlock_vial', 'stoneheart_sigil'],
  4: ['wargods_mantle', 'the_last_banner', 'archon_codex', 'constellation_sigil', 'pandoras_embers', 'cinderkeep', 'tempest_resonator', 'tideheart_amulet'],
};
const gated = new Set(Object.values(shrineTiers).flat());

const relics = JSON.parse(readFileSync(relicsPath, 'utf8'));
const relicArr = Array.isArray(relics) ? relics : relics.relics;
const relicIds = new Set(relicArr.map((r) => r.id));
for (const id of gated) if (!relicIds.has(id)) throw new Error('shrine gates unknown relic: ' + id);
let gatedCount = 0;
for (const r of relicArr) {
  if (gated.has(r.id)) { r.unlockSource = 'shrine'; gatedCount++; }
  else if (r.unlockSource === 'shrine') { delete r.unlockSource; } // idempotent re-run
}
writeFileSync(relicsPath, JSON.stringify(relics, null, 2) + '\n');
console.log(`Shrine: gated ${gatedCount} relics with unlockSource (base pool = ${relicArr.length - gatedCount}).`);

// --- buildings.json rewrites ----------------------------------------------
const b = JSON.parse(readFileSync(buildingsPath, 'utf8'));

// Forge: building gates crafting tiers + gold discount (no loot-unlock IDs).
b.forge.description = 'Reduce forge gold cost and unlock higher-tier card crafting';
const forgeDesc = {
  1: 'Forge attuned — Tier 2 crafting unlocks at Lv 2',
  2: 'Craft Tier 2 cards · −10% forge gold cost',
  3: '−15% forge gold cost',
  4: 'Craft Tier 3 cards · −20% forge gold cost',
  5: '−25% forge gold cost',
  6: '−30% forge gold cost',
};
for (const t of b.forge.tiers) { t.unlocks = {}; t.description = forgeDesc[t.level]; }

// Library: grants +15% class XP per level (no phantom passive IDs).
b.library.description = 'Accelerate class XP to unlock passive skills faster';
for (const t of b.library.tiers) { t.unlocks = {}; t.description = `+${15 * t.level}% class XP earned`; }

// Workshop: L3 unlocks desert + lava (was a reserved no-op).
const wsL3 = b.workshop.tiers.find((t) => t.level === 3);
wsL3.unlocks = { tiles: ['desert', 'lava'] };
wsL3.description = 'Unlock Desert and Lava Fields tiles';

// Shrine: real relic IDs per tier.
const shrineDesc = {
  1: 'Unlock Iron Will, First Strike Amulet, Thin Deck Charm, Swift Boots, Heavy Tome',
  2: 'Unlock Berserker Ring, Glass Cannon, Catalyst Core, and more',
  3: 'Unlock Phoenix Feather, Demon Heart, Sanguine Pact, and more',
  4: 'Unlock the legendary relics: War God’s Mantle, Archon Codex, and more',
};
for (const t of b.shrine.tiers) { t.unlocks = { relics: shrineTiers[t.level] }; t.description = shrineDesc[t.level]; }

writeFileSync(buildingsPath, JSON.stringify(b, null, 2) + '\n');
console.log('buildings.json: forge/library unlock-IDs cleared (effect-driven), workshop L3 = desert+lava, shrine = 26 real relics.');
