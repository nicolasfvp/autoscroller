# Enemy Attack Card Assets Specification

## Overview
Generic enemy attack cards with simple, iconic visual design matching the game's art style.

---

## Asset Specifications

All assets follow the same format as hero cards:
- **Format:** PNG, 256×384px
- **Style:** Hand-drawn fantasy, matching game aesthetic
- **Frame:** Gold/bronze decorative border (matching hero cards)
- **Icon Style:** Simple, clear iconography

---

## Card Designs

### Physical Attacks

#### 1. **CLAW** - `enemy_claw.png`
- **Visual:** Three parallel diagonal claw marks (bright slashes)
- **Color palette:** Orange/red with white highlights
- **Icon position:** Center-left to right, showing motion
- **Details:** Three lines representing three hits
- **Special note:** Should feel predatory and quick

#### 2. **BITE** - `enemy_bite.png`
- **Visual:** Large open mouth with sharp teeth
- **Color palette:** Dark red/brown with white teeth
- **Icon position:** Center
- **Details:** One large jaw mark, dripping slightly
- **Special note:** Menacing, solid impact

#### 3. **SLASH** - `enemy_slash.png`
- **Visual:** Single diagonal sword blade cut with motion lines
- **Color palette:** Gray/silver blade with red impact zone
- **Icon position:** Diagonal across center
- **Details:** Clean, sharp blade motion
- **Special note:** Martial, precise attack

#### 4. **SMASH** - `enemy_smash.png`
- **Visual:** Heavy crushing impact with radiating force lines
- **Color palette:** Dark gray/brown stone with white impact streaks
- **Icon position:** Center
- **Details:** Large impact crater/wave effect
- **Special note:** Feels heavy and devastating

#### 5. **SLAM** - `enemy_slam.png`
- **Visual:** Tentacle or limb impact
- **Color palette:** Dark purple/blue with white impact lines
- **Icon position:** Center-bottom, coming down
- **Details:** Curved striking shape with motion blur
- **Special note:** Different from smash - feels wet/organic

#### 6. **PIERCE** - `enemy_pierce.png`
- **Visual:** Sharp stinger/spike puncturing downward
- **Color palette:** Brown/tan stinger with green poison drip
- **Icon position:** Center, vertical
- **Details:** Single point penetration with toxin drops
- **Special note:** Looks venomous and precise

#### 7. **BONE THROW** - `enemy_bone_throw.png`
- **Visual:** Curved bone flying across screen
- **Color palette:** Pale gray/white bone on dark background
- **Icon position:** Diagonal, left to right motion
- **Details:** Ribbed bone texture, dust trail
- **Special note:** Flying projectile feel

#### 8. **SPIT** - `enemy_spit.png`
- **Visual:** Arc of gooey projectiles
- **Color palette:** Sickly yellow/green blobs with slime trails
- **Icon position:** Center, upward arc
- **Details:** 3-4 droplets in parabolic trajectory
- **Special note:** Feels wet and nasty

#### 9. **THORN SPIKE** - `enemy_thorn_spike.png`
- **Visual:** Multiple thorns/spikes bursting upward
- **Color palette:** Green/brown plant material with sharp tips
- **Icon position:** Center, vertical burst
- **Details:** 3-5 spikes radiating, roots visible
- **Special note:** Earthy and organic

---

### Elemental Attacks

#### 10. **FIRE BREATH** - `enemy_fire_breath.png`
- **Visual:** Cone of flames from mouth
- **Color palette:** Orange/red/yellow gradient flames
- **Icon position:** Left side, cone radiating right
- **Details:** Billowing smoke, hot glow
- **Special note:** Dragon-like, warm colors

#### 11. **WATER SURGE** - `enemy_water_surge.png`
- **Visual:** Wave of water crashing
- **Color palette:** Blue/cyan water with white foam
- **Icon position:** Center-bottom moving upward
- **Details:** Splashing droplets, wave shape
- **Special note:** Fluid, cascading motion

#### 12. **POISON** - `enemy_poison.png`
- **Visual:** Toxic cloud or spray
- **Color palette:** Sickly purple/green mist
- **Icon position:** Center, expanding cloud
- **Details:** Noxious fumes, hazard feel
- **Special note:** Looks dangerous and spreads

---

### Magic Attacks

#### 13. **DRAIN** - `enemy_drain.png`
- **Visual:** Swirling vortex sucking energy
- **Color palette:** Dark purple/black with red/pink swirls
- **Icon position:** Center
- **Details:** Spiral pulling inward, life-like wisps
- **Special note:** Supernatural, life-draining feel

#### 14. **CURSE** - `enemy_curse.png`
- **Visual:** Magical rune or arcane symbol
- **Color palette:** Dark purple/blue with glowing highlights
- **Icon position:** Center
- **Details:** Complex mystical symbol, ethereal glow
- **Special note:** Feels cursed and corrupted

---

## Asset Generation Priority

### Phase 1 (Most Common)
1. CLAW - Used by 4 enemies (Lost Lizard, Pocket Cat, Werewolf, Infernal Dragon)
2. SMASH - Used by 4 enemies (Lava Golem, Iron Golem, Desert Golem, Ancient Iron Golem)
3. FIRE BREATH - Used by 4 enemies (Baby Dragon, Mutated Salamander, Fire Elemental, Infernal Dragon)
4. POISON - Used by 4 enemies (Mush, Toxic Gooze, Venomous Kobra, Sand Scorpion uses PIERCE variant)

### Phase 2
5. BITE - Corpse Eater only
6. SLASH - Doom Knight only
7. PIERCE - Sand Scorpion only
8. BONE THROW - Skeleton only
9. DRAIN - Vampire, Bog Witch
10. SPIT - Forge Slime only

### Phase 3
11. SLAM - Depths Horror only
12. THORN SPIKE - Ancient Tree only
13. CURSE - Bog Witch only
14. WATER SURGE - (Future enemies)

---

## Style Notes

- **Consistency:** All cards should match the hero card aesthetic (gold frame, fantasy art style)
- **Readability:** Icons must be clear and readable at thumbnail size
- **Animation ready:** Card designs should be single-frame, but composition should allow for future animation/VFX
- **No text:** Icons only, no damage numbers or labels on the card itself
- **Emotional impact:** Each attack should feel visually distinct and communicate its nature

---

## File Locations

All assets go to: `public/assets/cards/`

Naming convention: `enemy_<attack_type>.png`

Examples:
- `public/assets/cards/enemy_claw.png`
- `public/assets/cards/enemy_fire_breath.png`
- `public/assets/cards/enemy_poison.png`

---

## Integration Checklist

After assets are created:
- [ ] Add card asset keys to `ENEMY_ATTACK_CARDS` in `src/data/EnemyAttackCards.ts`
- [ ] Register cards in texture loader (`src/systems/TextureManager.ts` or equivalent)
- [ ] Create UI component to display enemy attack cards in combat
- [ ] Link enemy attack cards to actual combat mechanics
- [ ] Test enemy card display in combat scene
