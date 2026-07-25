# Enemy Attacks Mapping

## Mapeamento de Ataques Genéricos para Inimigos

### Attack Types Available

| Attack | Description | Ideal For | Base Damage |
|--------|-------------|-----------|------------|
| **Claw** | 3x rasgos (claw marks) | Predadores com garras | 5-7 |
| **Bite** | 1x mordida grande | Predadores com dentes | 6-8 |
| **Slash** | 1x corte grande com espada | Inimigos com arma branca | 7-9 |
| **Smash** | Golpe esmagador com pesão | Golems e criaturas pesadas | 8-12 |
| **Poison** | Ataque com veneno | Aranhas, cobras, insetos | 5-7 |
| **Fire Breath** | Sopro de fogo | Dragões, elementais de fogo | 8-10 |
| **Water Surge** | Onda de água | Elementais de água, sapos | 6-8 |
| **Thorn Spike** | Espinhos/raízes | Árvores, plantas | 5-7 |
| **Slam** | Impacto do corpo | Criaturas grandes | 7-9 |
| **Spit** | Cuspe/goo | Slimes, bestas com boca | 4-6 |
| **Pierce** | Espinho/ferrão | Escorpiões, insetos | 5-7 |
| **Bone Throw** | Osso arremessado | Esqueletos, mortos-vivos | 6-8 |
| **Drain** | Sugação de vida | Vampiros | 5-7 (+ heal) |
| **Curse** | Maldição/debilidade | Bruxas | 4-6 (+ debuff) |
| **Multi-Hit** | Série de golpes | Beasts, dragões | 2-4 cada |

---

## Enemy → Attack Mapping

### Normal Enemies

#### **Lost Lizard** (Predador verde)
- **Type:** Reptile/Predator
- **Features:** Claws, teeth
- **Primary Attack:** CLAW (3x rasgos)
- **Secondary:** (none - single attack)
- **Rationale:** Lagartos atacam com garras paralelas

#### **Corpse Eater** (Mutant scavenger)
- **Type:** Beast
- **Features:** Teeth, strong jaw
- **Primary Attack:** BITE (1x mordida funda)
- **Rationale:** Eater = dentes fortes

#### **Pocket Cat** (Feline predator)
- **Type:** Predator
- **Features:** Claws
- **Primary Attack:** CLAW (3x rasgos)
- **Rationale:** Gatos têm garras distintas

#### **Baby Dragon** (Young dragon)
- **Type:** Dragon
- **Features:** Breath attack, teeth, small size
- **Primary Attack:** FIRE BREATH (sopro pequeno)
- **Rationale:** Dragões respiram fogo

#### **Mutated Salamander** (Fire creature)
- **Type:** Elemental/Fire
- **Features:** Fire affinity, reptile
- **Primary Attack:** FIRE BREATH
- **Rationale:** Salamandra de fogo = respirar chamas

#### **Ancient Tree** (Plant creature)
- **Type:** Plant
- **Features:** Branches, roots
- **Primary Attack:** THORN SPIKE (espinhos/raízes)
- **Rationale:** Árvores atacam com ramos/raízes

#### **Mush** (Mushroom creature)
- **Type:** Plant/Fungus
- **Features:** Spore/poison
- **Primary Attack:** POISON (nuvem de esporo)
- **Rationale:** Cogumelos liberam esporos

#### **Forge Slime** (Metallic slime)
- **Type:** Slime
- **Features:** Gooey, metallic
- **Primary Attack:** SPIT (lançamento de goo)
- **Rationale:** Slimes cospem/atacam com o corpo

#### **Lava Golem** (Rock elemental)
- **Type:** Golem
- **Features:** Stone, heavy, lava
- **Primary Attack:** SMASH (golpe pesado)
- **Rationale:** Golems atacam com peso corporal

#### **Depths Horror** (Unknown tentacled thing)
- **Type:** Eldritch/Tentacle
- **Features:** Tentacles, unknown physiology
- **Primary Attack:** SLAM (batida com tentáculo)
- **Rationale:** Criaturas com tentáculos batem

#### **Toxic Gooze** (Toxic slime)
- **Type:** Slime/Poison
- **Features:** Toxic, gooey
- **Primary Attack:** POISON (veneno tóxico)
- **Rationale:** Nome diz tudo - tóxico

#### **Venomous Kobra** (Snake)
- **Type:** Reptile/Snake
- **Features:** Fangs, venom
- **Primary Attack:** POISON (mordida com veneno)
- **Rationale:** Cobras são venenosas

#### **Skeleton** (Undead)
- **Type:** Undead
- **Features:** Bones, armor
- **Primary Attack:** BONE THROW (osso arremessado)
- **Rationale:** Esqueletos e mortos-vivos usam ossos

#### **Vampire** (Undead predator)
- **Type:** Undead/Predator
- **Features:** Fangs, bloodsucking
- **Primary Attack:** DRAIN (sucção de sangue - heal enemy)
- **Rationale:** Vampiros sugam sangue

#### **Werewolf** (Beast form)
- **Type:** Beast/Predator
- **Features:** Claws, teeth, beast form
- **Primary Attack:** CLAW (3x rasgos com garras)
- **Rationale:** Lobisomens têm garras e dentes

#### **Sand Scorpion** (Arachnid)
- **Type:** Arachnid
- **Features:** Stinger/tail
- **Primary Attack:** PIERCE (ferrão tóxico)
- **Rationale:** Escorpiões atacam com ferrão

#### **Fire Elemental** (Pure fire)
- **Type:** Elemental
- **Features:** Pure fire, no physical form
- **Primary Attack:** FIRE BREATH (combustão de fogo)
- **Rationale:** Elementais de fogo = sopro quente

---

### Boss Enemies

#### **Doom Knight** (Armored warrior)
- **Type:** Humanoid/Knight
- **Features:** Sword, armor
- **Primary Attack:** SLASH (corte de espada)
- **Secondary:** (enrage = faster attacks)
- **Rationale:** Cavaleiros usam espadas

#### **Iron Golem** (Tank elemental)
- **Type:** Golem
- **Features:** Stone, metallic, heavy
- **Primary Attack:** SMASH (golpe de pugno pesado)
- **Secondary:** (shield defense)
- **Rationale:** Golems atacam com peso

#### **Bog Witch** (Magic user)
- **Type:** Humanoid/Witch
- **Features:** Magic, hex, water affinity
- **Primary Attack:** CURSE (maldição mágica)
- **Secondary:** DRAIN (sugação mágica)
- **Rationale:** Bruxas lançam feitiços e suçam vida

#### **Desert Golem** (Sand elemental tank)
- **Type:** Golem
- **Features:** Stone, sand, heavy
- **Primary Attack:** SMASH (golpe de areia)
- **Rationale:** Golems = smash

#### **Infernal Dragon** (Fire dragon)
- **Type:** Dragon
- **Features:** Multiple attacks (multi_hit), fire
- **Primary Attack:** FIRE BREATH (tripo de chamas)
- **Secondary:** CLAW (3x rasgos com garras)
- **Rationale:** Dragões respiram fogo E têm garras

#### **Ancient Iron Golem** (Upgraded golem boss)
- **Type:** Golem
- **Features:** Stone, metallic, very heavy
- **Primary Attack:** SMASH (golpe devastador)
- **Rationale:** Golems = smash

---

## Summary by Attack Type

| Attack | Enemies |
|--------|---------|
| **CLAW** | Lost Lizard, Pocket Cat, Werewolf, Infernal Dragon |
| **BITE** | Corpse Eater |
| **SLASH** | Doom Knight |
| **SMASH** | Lava Golem, Iron Golem, Desert Golem, Ancient Iron Golem |
| **POISON** | Mush, Toxic Gooze, Venomous Kobra, Sand Scorpion (pierce variant) |
| **FIRE BREATH** | Baby Dragon, Mutated Salamander, Fire Elemental, Infernal Dragon (secondary) |
| **THORN SPIKE** | Ancient Tree |
| **SPIT** | Forge Slime |
| **SLAM** | Depths Horror |
| **DRAIN** | Vampire, Bog Witch |
| **BONE THROW** | Skeleton |
| **CURSE** | Bog Witch |
| **PIERCE** | Sand Scorpion |

---

## Next Steps

1. Create attack card definitions with unique visual identities
2. Generate assets for each attack type (generic, reusable art)
3. Link enemies to their attack cards in enemies.json
4. Update combat system to use enemy attack cards instead of flat damage numbers
