# Prompts para Geração de Arte das Cartas

> **Status:** 156 cartas sem arte (36 Tier 1 + 120 Tier 2). O sistema novo usa IDs como `t1-attack-fire`; o Preloader ainda referencia os nomes antigos e precisa ser atualizado após gerar as imagens.

---

## Bloco de Estilo Universal

Adicione este texto **antes** de cada prompt individual no Grok Imagine:

```
Dark fantasy trading card game illustration, digital painting, highly detailed, dramatic moody lighting, deep dark near-black background (#1a1a2e), centered composition, portrait orientation 1:1, no text no UI no borders, vibrant atmospheric color glow, masterwork quality, Hearthstone / Slay the Spire art style
```

**Paleta de elementos** (use as cores abaixo como `atmospheric glow` ou `energy color`):

| Elemento | Cor principal | Tom/Tema visual |
|---|---|---|
| attack | `#DC2626` vermelho vivo | Agressivo, aço, sangue, fúria |
| defense | `#6B7280` cinza-aço | Fortaleza, armadura, imovável |
| agility | `#FACC15` ouro-amarelo | Velocidade, blur, precisão |
| counter | `#B91C1C` vermelho-escuro | Reativo, cicatrizes, represália |
| fire | `#F97316` laranja-brasa | Chamas, brasa, calor persistente |
| water | `#0EA5E9` ciano-azul | Gelo, cura, fluxo |
| air | `#C4B5FD` lilás-lavanda | Vento, relâmpago, leveza |
| earth | `#92400E` marrom-pedra | Pedra, raiz, controle, peso |

---

## Como usar

1. Copie o **Bloco de Estilo Universal** acima
2. Cole o prompt da carta logo após (separado por vírgula ou ponto)
3. Envie ao Grok Imagine
4. Salve o resultado como `public/assets/cards/<ID-da-carta>.png`
5. Adicione o ID ao array `cardIds` no `src/scenes/Preloader.ts`

**Exemplo completo:**
```
Dark fantasy trading card game illustration, digital painting, highly detailed, dramatic moody lighting, deep dark near-black background (#1a1a2e), centered composition, portrait orientation 1:1, no text no UI no borders, vibrant atmospheric color glow, masterwork quality, Hearthstone / Slay the Spire art style. A berserk warrior mid-swing with a massive broadsword, crimson energy trails, wild bloodshot eyes, torn armor, pure rage incarnate, #DC2626 red atmospheric glow.
```

---

## TIER 1 — Cartas Base (36 cartas)

> Tier 1 = 2 elementos. Cartas do starter deck do jogador. Prioridade **máxima**.

---

### Elementos Puros (8 cartas)

#### `t1-attack-attack` — Reckless Strike
A battle-scarred warrior in mid-spin with a massive two-handed broadsword, crimson energy trails bleeding from the blade's arc, wild bloodshot eyes, armor torn and soaked in blood — pure unrestrained rage incarnate. Dominant #DC2626 red glow saturating the air around the figure.

#### `t1-defense-defense` — Bulwark Vow
A heavy armored knight kneeling on one knee behind an enormous raised tower shield, protection runes glowing blue-gray along the steel edges, immovable as a fortress wall, the air around compressed with defensive force. Dominant #6B7280 steel-gray luminescence emanating from the shield.

#### `t1-agility-agility` — Flurry Step
A shadow-wrapped rogue frozen in mid-sprint, three golden afterimage silhouettes trailing behind, twin daggers blurring with speed, pure kinetic energy barely contained in a single frame. Dominant #FACC15 golden-yellow motion blur radiating outward.

#### `t1-counter-counter` — Razor Stance
A scarred warrior in an ultra-low fighting stance, twin serrated blades raised at opposing angles, dark red serpentine energy coiling around both arms like vengeance waiting to strike. Dominant #B91C1C dark crimson energy crackling with reactive potential.

#### `t1-fire-fire` — Pyre
A roaring vertical column of pure orange-red fire erupting from cracked dark stone, a silhouette of rage lost within the inferno, embers spiraling upward in an oppressive swirl. Dominant #F97316 orange-red fire consuming all shadow.

#### `t1-water-water` — Frostbind
Blue-white crystalline ice chains materializing from thin air around an unseen prisoner, frost patterns spreading like fractals across dark stone, ethereal cold light refracting in the ice. Dominant #0EA5E9 cyan ice glow casting the scene in frozen stillness.

#### `t1-air-air` — Tailwind
A swirling levitating vortex of lavender wind energy, feather-light particles spiraling outward in perfect arcs, translucent pressure lines rippling — pure acceleration with no physical form. Dominant #C4B5FD lavender-purple atmospheric shimmer.

#### `t1-earth-earth` — Tremor Lock
Massive rocky fists erupting violently from cracked dark earth, the stone floor splitting open like a mechanical trap, brown-grey rock shards exploding outward under crushing geological weight. Dominant #92400E earth-brown energy pulsing from the shattered ground.

---

### Elementos Cruzados (28 cartas)

#### `t1-agility-attack` — Quickstrike
A single dagger frozen at point of impact, golden speed afterimage trailing behind the blade while crimson blood droplets float suspended in the air ahead. Two colors of energy — #FACC15 and #DC2626 — colliding at the moment of lethal precision.

#### `t1-agility-counter` — Sidestep & Slash
A nimble fighter caught mid-dodge, the entire left side of the figure blurred into a golden-yellow afterimage while the right arm unleashes a dark-red bleeding slash arc. The duality of evasion and retaliation in one frozen moment.

#### `t1-agility-defense` — Parrying Stance
An agile warrior deflecting a blade with a small buckler, golden footwork marks glowing on the dark floor showing the dance of movement, shield edge catching light in a defensive parry. Speed and protection as a graceful unified form.

#### `t1-agility-fire` — Flame Dart
A spinning throwing knife enveloped in orange fire, golden velocity blur trailing behind it, both speed and flame leaving a spiraling trail in dark air. The knife itself barely visible within the combined #FACC15/#F97316 energy.

#### `t1-agility-water` — Mist Step
A figure dissolving mid-stride into cyan-blue healing mist, one solid foot planted on dark stone and the other already becoming vapor, a ghost outline of movement surrounded by restorative light.

#### `t1-agility-air` — Gale Cut
A crescent slash leaving a visible pressure wave cut through the air itself, golden blade-arc and lavender wind lines emanating from the same edge, the cut lingering as ephemeral wind energy.

#### `t1-agility-earth` — Tremor Dash
A charging warrior in full sprint, golden speed blur above the waist while the footsteps crack and shatter dark stone below, brown-grey rock fragments exploding outward from each impact point.

#### `t1-attack-counter` — Bloodprice Strike
A warrior driving the point of their own blade through their open palm, dark blood dripping downward while dark-red counter-energy concentrates in the wound — self-inflicted pain feeding into devastating power.

#### `t1-attack-defense` — Shield Bash
A massive crimson-edged tower shield accelerating forward in a devastating bash, the force meeting a crumbling stone wall, sparks of defensive rune energy colliding with pure offensive impact.

#### `t1-attack-fire` — Kindle Strike
A broadsword blade erupting into orange-crimson flame mid-swing, fire and steel fusing together in a single brutal arc, the heat distortion warping the air around the burning edge.

#### `t1-attack-water` — Crimson Tithe
A gauntleted warrior's forearm held over a small floating cyan orb, dark blood dripping from a self-inflicted cut and dissolving into glowing blue mana — life force willingly sacrificed.

#### `t1-air-attack` — Stormstrike
A single armored fist erupting forward crackling with lavender-purple chain lightning, a tight spiral of wind pressure converging into the point of impact, sky and steel fused into one lethal strike.

#### `t1-attack-earth` — Granite Lunge
An armored gauntlet slamming into dark earth with catastrophic force, a perfect circular shockwave of brown-grey stone fragments exploding outward, the ground fundamentally broken by the impact.

#### `t1-counter-defense` — Iron Reckoning
A warrior in a wide-stance absorbing a blow, their iron-gray armor dented on one side while dark-red counter-charge runes glow brighter with each hit taken — punishment stored as future vengeance.

#### `t1-counter-fire` — Cinderscar
A close-up of a scarred forearm, an open wound glowing dark-red at the edges while orange fire crackles from within the cut — pain literally converted into burning retribution.

#### `t1-counter-water` — Bloodtide Mend
Dark crimson lacerations on skin slowly closing under flowing cyan-blue healing light, the contrast of crimson blood and restorative water energy intertwined — suffering and renewal as one.

#### `t1-air-counter` — Hollow Echo
A lavender wind-based strike creating a visible ghost echo of itself just behind the primary hit, the second strike darker and tinged dark-red — the strike that strikes twice from the same motion.

#### `t1-counter-earth` — Thornwall
Razor-sharp stone thorns erupting violently upward from dark ground, dark-red blood on the stone spikes, the earth itself retaliating — a wall of pain grown from bedrock.

#### `t1-defense-fire` — Forge Spike Ward
A knight's shield with glowing red-hot metal spikes erupting from its polished surface, forge fire simmering in each spike, the defensive object weaponized by intense heat.

#### `t1-defense-water` — Vow of the Tide
A flowing curtain of water wrapping around armor like a second shield, cyan-blue light rippling with each defensive pulse, protection and healing flowing as a single inseparable force.

#### `t1-air-defense` — Cyclone Ward
A spinning lavender-purple cyclone forming a perfect protective shell around a silhouette, compressed wind acting as rotating armor, the eye of the storm as sanctuary.

#### `t1-defense-earth` — Bramble Bulwark
A dense wall of intertwined stone and razor thorns, dark earth brown with sharp grey defensive spines, an absolute barrier that punishes anything that touches it.

#### `t1-fire-water` — Steam Surge
Orange fire meeting cyan water in a violent collision, a white steam explosion bursting outward from the point of contact, the two elements annihilating each other into raw force.

#### `t1-air-fire` — Firestorm
A devastating fire tornado, orange-red flames caught in an upward lavender wind spiral, both elements amplifying each other into a catastrophic column of spinning fire.

#### `t1-earth-fire` — Magma Vein
Orange-red lava seeping upward through deep cracks in dark brown earth, the ground itself bleeding molten rock, tectonic heat made visible through geological wounds.

#### `t1-air-water` — Misting Veil
Soft cyan mist carried horizontally on lavender wind currents, water droplets suspended in spiraling air, forming a gossamer semi-transparent veil between reality and elsewhere.

#### `t1-earth-water` — Mire Bloom
A single luminous blue flower blooming from murky dark-brown swamp roots, its petals glowing with cyan healing energy against the oppressive darkness of the bog around it.

#### `t1-air-earth` — Bedrock Snare
Stone fissures splitting open while lavender wind howls through the gaps, root-like earth tendrils and sharp wind-lines converging from opposite directions — a trap of air and stone closing simultaneously.

---

## TIER 2 — Cartas Avançadas (120 cartas)

> Tier 2 = 3 elementos. Prioridade **alta** para cartas de combos populares; baixa para combinações de nicho.

---

### Físico Puro (4 cartas)

#### `t2-attack-attack-attack` — Berserker's Ledger
A berserk warrior surrounded by three arcing crimson blade trails from a single spinning slash, skin riddled with self-inflicted wounds that fuel the rage, a ledger of blood written in combat.

#### `t2-defense-defense-defense` — Aegis of Returning Wrath
A knight encased in three overlapping tower shields forming an impenetrable rotating fortress, blue-gray rune energy cycling between shields, armor that grows stronger with each layer broken.

#### `t2-agility-agility-agility` — Quickstep Sigil
Three golden afterimage silhouettes of a rogue, each offset at different angles, converging on a burning golden sigil of pure speed etched into dark air.

#### `t2-counter-counter-counter` — Crimson Spiral
Three dark-red counter energy spirals converging clockwise into a single devastating retaliation point, scar tissue and rage forming a trinity of vengeance.

---

### Elemental Puro (4 cartas)

#### `t2-fire-fire-fire` — Supernova
A catastrophic fire detonation, three concentric rings of orange-red energy expanding outward, a miniature sun exploding in controlled darkness, embers raining in all directions.

#### `t2-water-water-water` — Tidesong Aura
Three flowing concentric water rings forming a healing aura, each ring a different shade of cyan-blue, pulsing outward like a heartbeat of restoration.

#### `t2-air-air-air` — Tempest Cadence
Three nested lavender wind vortices spinning in alternating directions, perfectly synchronized, a harmonic tempest of pure atmospheric force building to critical mass.

#### `t2-earth-earth-earth` — Mountain's Answer
Three layers of stone erupting one after another from below, each bigger than the last, the final slab a mountain-weight absolute response that crushes everything above it.

---

### Combinações Físicas Mistas (22 cartas)

#### `t2-attack-attack-defense` — Bulwark Salvo
Twin crimson sword arcs releasing from behind a half-raised shield, offense and defense inseparable — attack that flows directly from a defensive position.

#### `t2-agility-attack-attack` — Triple Slash
Three rapid golden-blurred dagger strikes, each leaving a small crimson arc, the motion so fast all three impacts coexist in a single frozen moment.

#### `t2-attack-attack-counter` — Bloodlash Salvo
Twin broadsword slashes soaked in crimson, a dark-red counter-spark igniting at the point of each impact, rage feeding itself into an escalating loop of violence.

#### `t2-attack-defense-defense` — Body Slam Vow
An armored warrior using two shields simultaneously as battering rams, the defensive objects themselves becoming brutal weapons, gray-blue force meeting target at full sprint.

#### `t2-agility-defense-defense` — Phalanx Drift
A nimble fighter weaving between two overlapping shields, golden footwork visible on dark floor, protection and speed dancing as a coordinated defense.

#### `t2-counter-defense-defense` — Reforge Vow
A damaged shield being absorbed back into the warrior's body as dark-red energy while two new defense runes forge themselves from the stored pain.

#### `t2-agility-agility-attack` — Pinprick Volley
A cascade of small golden-blurred throwing knives, each leaving a tiny crimson wound, overwhelming precision through sheer quantity of precise strikes.

#### `t2-agility-agility-defense` — Veil of Steps
A golden-blurred evasive dancer leaving two afterimages while a third, solid silhouette shields the body — movement as its own form of defense.

#### `t2-agility-agility-counter` — Quicksilver Bleed
A rogue in triple-afterimage sprint, dark-red bleeding cuts appearing on enemies passed rather than struck, speed itself becoming a vector of damage.

#### `t2-attack-counter-counter` — Cleaver's Tax
A heavy cleaver mid-swing, two dark-red counter echoes orbiting the blade, each hit demanding compound payment from the enemy.

#### `t2-counter-counter-defense` — Wrathshell Vow
A warrior whose cracked gray armor reveals dark-red energy beneath, the shell of defense barely containing the stored counter-energy about to release.

#### `t2-agility-counter-counter` — Razor Cadence
A dancer-fighter executing a golden-blurred rhythm of strikes, each one leaving dark-red counter-gashes, a deadly cadence of speed and retaliation.

#### `t2-agility-attack-defense` — Flowstrike
A fluid strike flowing directly from a parry, the motion continuous — golden deflect transitioning instantly into a crimson counter-thrust.

#### `t2-attack-counter-defense` — Last Stand Bulwark
A warrior with one hand on a shield and the other gripping a sword through a bloody palm, standing between two energies — dark-red counter runes and blue-gray defense. Last stand.

#### `t2-agility-attack-counter` — Vein Splitter
A golden-fast blade finding the exact gap in enemy armor, dark-red arterial arc following the precise strike — speed enabling a counter's devastating accuracy.

#### `t2-agility-counter-defense` — Bramble Step
A nimble fighter stepping through a brief shield of stone thorns, golden movement weaving between dark-red spines, evasion and retaliation interlocked.

---

### Elemental Físico × Elemental (combinações de 2 físico + 1 elemental) (20 cartas)

#### `t2-attack-attack-fire` — Cinder Thrust
Twin flaming sword strikes converging into a single burning thrust, the doubled crimson blades superheated to orange-red combustion on impact.

#### `t2-attack-attack-water` — Soaking Blade
Twin sword arcs trailing cyan water ribbons, the blades themselves cooling with each strike while carrying ice-cold edge damage.

#### `t2-air-attack-attack` — Galekick
A spinning kick with lavender wind trailing behind the heel, a crimson impact mark where the strike lands — aerial offense amplified by air.

#### `t2-attack-attack-earth` — Concussive Smash
Two heavy strikes shaking the ground, brown-grey shockwaves radiating from the impact points, crimson force compounded by earthen weight.

#### `t2-defense-defense-fire` — Pyric Bulwark
A tower shield glowing red-hot across its entire surface, forge-fire burning in the defensive metal, an armored wall that scorches anything that touches it.

#### `t2-defense-defense-water` — Stagnant Bulwark
Two overlapping shields dripping with dark water, a defensive stasis field that slows and chills, protection that drains and stagnates attackers.

#### `t2-air-defense-defense` — Stormgate
Two shields spinning in a wind vortex, the gap between them channeling compressed lavender air into a lethal focused stream, a gate of storm between two walls.

#### `t2-defense-defense-earth` — Stoneward Reprisal
Two stone-fused shields erupting from the earth itself, brown-grey rock layered over steel, an immovable earthen wall that punishes anything that dares approach.

#### `t2-agility-agility-fire` — Twinflame Flicker
Two golden afterimages both trailed by orange fire, the rapid movement fanning the flames into twin blazing paths through darkness.

#### `t2-agility-agility-water` — Slipstream
Two golden velocity blurs leaving cyan water trails, a figure moving so fast it parts the air into a flowing slipstream of speed and fluid.

#### `t2-agility-agility-air` — Zephyr Cascade
Three interlinked golden and lavender trails in a spiraling cascade, a rogue moving through successive air bursts like a leaf in a gale.

#### `t2-agility-agility-earth` — Footwork Stone
Golden footwork marks burned into cracked brown stone, the movement pattern itself etched permanently into the ground, technique preserved in earth.

#### `t2-counter-counter-fire` — Vengeful Pyre
Two dark-red counter spirals igniting simultaneously into orange-red fire, counter energy and flame combining into a self-fulfilling conflagration of retaliation.

#### `t2-counter-counter-water` — Crimson Cascade
Two dark-red counter bursts flowing into a cyan healing waterfall, the wounds inflicted feeding a river of self-restoration, pain cycling into survival.

#### `t2-air-counter-counter` — Wrath Squall
Lavender wind channeling two dark-red counter-strikes simultaneously, a gale of retaliation striking from multiple directions at once.

#### `t2-counter-counter-earth` — Stonewrath
Two dark-red counter-energies solidifying into stone spikes, vengeance crystallized into immovable brown-grey geological retribution.

---

### Físico × Elemental (combinações 1 físico + 2 elemental) (40 cartas)

#### `t2-attack-fire-fire` — Cinderlance
A burning lance of concentrated orange-red fire hurled with crimson striking force, the point superheated to white where flame and steel are indistinguishable.

#### `t2-attack-water-water` — Drowning Lance
A lance wrapped in two layers of cyan water, drowning the enemy in cold as the strike penetrates, water pressure added to physical impact.

#### `t2-air-air-attack` — Tempest Pike
A spear strike launched with dual lavender wind currents amplifying its speed, the air pressure alone creating a second invisible impact around the physical blow.

#### `t2-attack-earth-earth` — Mountain's Will
A mighty fist strike backed by two layers of earthen weight, the ground rising behind the arm like a mountain endorsing the attack, brown geological force.

#### `t2-attack-fire-water` — Tremor Detonate
A strike detonating into a steam explosion, fire and water colliding on impact, white steam burst radiating from the crimson epicenter.

#### `t2-air-attack-fire` — Galebrand
A blade swung with wind behind it, the tip of the swing catching fire, a brand drawn in air with the combined colors of #C4B5FD and #F97316.

#### `t2-attack-earth-fire` — Slag Maul
An enormous hammer glowing red-hot, the head encrusted with lava-soaked stone, earth and fire forged into the heaviest of weapons.

#### `t2-air-attack-water` — Galetide
A wind-assisted lance tip encased in ice, cold speed concentrated into an unstoppable piercing point, lavender and cyan fusing at the tip.

#### `t2-attack-earth-water` — Mirebreaker
A weapon striking through dark swampy earth, brown mud and cyan water exploding apart, the break itself creating a bog-burst shockwave.

#### `t2-air-attack-earth` — Cliffwind Maul
A maul strike with a gust of stone-dust blast, brown rock fragments suspended in lavender wind, gravity and air combined into an overhead smash.

#### `t2-defense-fire-fire` — Citadel Inferno
A fortress wall engulfed in double orange-red fire, flames part of the defense, a burning citadel that destroys any attacker who reaches its walls.

#### `t2-defense-water-water` — Brineward
A deep-sea pressure shield, two layers of dark cyan water forming a cold dense barrier, brine-pressure defensive wall that slows and chills.

#### `t2-air-air-defense` — Galeward
A rotating dual-wind barrier forming an atmospheric shield, lavender vortex spinning as armor, compressed air denser than steel.

#### `t2-defense-earth-earth` — Bedrock Bulwark
Two layers of stone fusing to a shield surface, a defensive wall that is literally geological bedrock, brown-grey absolute protection from below.

#### `t2-defense-fire-water` — Steam Bulwark
A shield emitting white steam from the collision of fire and water elements on its surface, a dynamic defensive barrier of elemental balance.

#### `t2-air-defense-fire` — Ember Aegis Gust
A shield trailing burning embers in a wind current, defensive fire fanned by air, lavender and orange protecting together.

#### `t2-defense-earth-fire` — Magmaplate
Armor with lava seeping through the joints, the forge-fire hardening the steel from within, orange-red magma as the ultimate heat treatment of iron.

#### `t2-air-defense-water` — Mistplate
Armor shrouded in cool cyan mist fanned by lavender wind, the moisture forming a ghostly second skin of fog over the physical protection.

#### `t2-defense-earth-water` — Bogplate
Stone armor fused with dark swamp water, brown and cyan merged into a heavy bog-plate, the weight of earth and the cold of water.

#### `t2-air-defense-earth` — Dustward
Brown stone and lavender wind forming a defensive dust-storm barrier, spinning rock particles at gale speed as a wall of abrasion.

#### `t2-agility-fire-fire` — Cinder Sprint
A figure sprinting through double fire, leaving two orange-red flame trails behind, the speed intensifying the fire rather than being slowed by it.

#### `t2-agility-water-water` — Slipvenom Tempo
A nimble fighter gliding through twin cyan water streams, slipping between them in golden blur, speed amplified by the flowing water's current.

#### `t2-agility-air-air` — Gale Echo
A rogue in golden blur surrounded by two spinning lavender wind echoes, speed and air resonating in a triple-layered motion event.

#### `t2-agility-earth-earth` — Stonepacer
A sprinter leaving cracked stone footprints, each step shattering brown earth, speed measured in geological damage caused by each stride.

#### `t2-agility-fire-water` — Boilstep
A dancer stepping through fire and water simultaneously, golden blur splitting between orange-red and cyan puddles, steam rising from each footfall.

#### `t2-agility-air-fire` — Galecinder
A golden-blurred runner trailing both lavender wind and orange fire, the speed fanning the flame and the flame marking the wind path.

#### `t2-agility-earth-fire` — Cinderquake
A leaping strike landing with a shockwave of brown earth and orange fire, the impact melting stone underfoot while ground cracks radiate outward.

#### `t2-agility-air-water` — Stormsplash
A nimble fighter leaping through a lavender storm-burst leaving a cyan water splash, three elements blending into one acrobatic strike.

#### `t2-agility-earth-water` — Mireglide
A figure gliding across dark swamp surface on golden blur, the brown mire and cyan water parting smoothly rather than hindering the motion.

#### `t2-agility-air-earth` — Stormstone Tempo
A sprinter kicking up brown stone dust into a lavender wind vortex, each step a small storm of earth and air, unstoppable forward momentum.

#### `t2-counter-fire-fire` — Brine Crucible
A dark cauldron of counter-pain fed into double orange-red fire, the retaliation itself igniting, vengeance as a self-feeding furnace.

#### `t2-counter-water-water` — Tidefoot Bloom
Dark-red counter wounds dissolving into a twin cyan healing tide, the pain converted into regeneration, two water flows healing the very damage that triggered them.

#### `t2-air-air-counter` — Stormrage
Twin lavender wind vortices spiraling into a dark-red counter detonation at their center, air feeding a rage that explodes outward.

#### `t2-counter-earth-earth` — Tombrage
Dark-red vengeance energy crystallizing into a brown-grey stone tomb, the counter becoming a geological prison, rage made permanent in stone.

#### `t2-counter-fire-water` — Venom Detonation
A dark-red venomous counter triggering a fire-water explosion, the toxin detonating into orange and cyan, a poison-fueled elemental burst.

#### `t2-air-counter-fire` — Static Bleed
Lavender chain lightning striking and leaving dark-red bleeding wounds that smolder orange, electricity causing lingering fire damage through the wounds.

#### `t2-counter-earth-fire` — Magmavow
A warrior taking a hit and immediately summoning a brown-red lava eruption in retaliation, the earth cracking open with fire born from the pain received.

#### `t2-air-counter-water` — Tempestbleed
Lavender wind carrying dark-red bleeding wounds through the air, the storm itself bleeding, kinetic energy leaving icy cyan wounds in its wake.

#### `t2-counter-earth-water` — Bogwrath
A dark-red vengeance spiral erupting from muddy brown-cyan swamp water, rage emerging from the depths of the mire, slow but absolute.

#### `t2-air-counter-earth` — Tectonic Reckoning
A lavender air-blast cracking brown-grey tectonic plates open, wind and earth combining into a counter that splits the very ground beneath the attacker.

---

### Elemental Puro × Físico (combinações 2+ físico com 1 elemental) — Continuação (20 cartas)

#### `t2-attack-defense-fire` — Forge Strike
A blade forged while striking, crimson attack and gray defense energies merging in orange forge-fire, the act of defending and attacking unified by heat.

#### `t2-attack-defense-water` — Mire Cleave
A slash cutting through cyan water and gray armor simultaneously, crimson impact splitting both, the blade that ignores the distinction between target and shield.

#### `t2-air-attack-defense` — Stormhilt
A weapon whose hilt channels lavender wind, the blade crimson-charged for offense, the crossguard gray-blue for defense, wind flowing through all three components.

#### `t2-attack-defense-earth` — Earthcleaver
A massive cleave that simultaneously raises an earthen wall behind the attacker, crimson offensive force backed by brown-grey geological defense rising on impact.

#### `t2-agility-attack-fire` — Wickfencer
A golden-blurred fencer whose blade ignites mid-thrust, orange fire trail behind the crimson attack — speed fanning the flame at the moment of impact.

#### `t2-agility-attack-water` — Drowner's Dart
A golden-fast throwing dart trailing cyan water, its path ending in a cold impact that floods the wound with ice-cold water damage.

#### `t2-agility-air-attack` — Skywire
A wire-thin golden slash descending from above on lavender wind, the cut nearly invisible until crimson blood follows the invisible line.

#### `t2-agility-attack-earth` — Quarry Dance
A dancer's strikes that crack brown stone with each golden-blurred impact, a quarry-rhythm of beautiful violence cutting through geological resistance.

#### `t2-attack-counter-fire` — Wrath Brand
A burning mark seared onto skin by a crimson strike that also triggers a dark-red counter, the brand as both attack and activated vengeance trigger.

#### `t2-attack-counter-water` — Necrotic Festering
A dark wound on pale skin where crimson struck and dark-red counter energy pools, the wound refusing to close, cyan light failing to heal what festers.

#### `t2-air-attack-counter` — Thunderstrike Catalyst
Lavender lightning striking and leaving a dark-red counter charge in the impact scar, electricity as a catalyst igniting stored retaliation energy.

#### `t2-attack-counter-earth` — Granitewrath
A fist strike shattering brown-grey stone while dark-red counter runes carve themselves into the fragments, physical force and stored vengeance erupting simultaneously.

#### `t2-agility-defense-fire` — Ember Vault
A golden-blurred vault over a burning gray-blue shield, the acrobatic pass through forge-fire leaving an orange ember trail through the air.

#### `t2-agility-defense-water` — Tidefoot Guard
A nimble fighter with one hand on a cyan water-shield while the feet remain in golden blur, protection and movement maintained simultaneously.

#### `t2-agility-air-defense` — Galeguard
A golden-blurred dodge leaving a lavender wind-wall behind as a guardian barrier, the speed of evasion creating a temporary defensive vortex.

#### `t2-agility-defense-earth` — Quickstone
A rogue who's left footprints burned into brown stone, the golden movement pattern visible as cracked earth, agility having literally carved its own defensive terrain.

#### `t2-counter-defense-fire` — Ashen Bulwark
A gray-blue shield covered in burning ash and dark-red counter runes, defensive armor that retaliates with fire each time it absorbs a blow.

#### `t2-counter-defense-water` — Crimson Regen Mantle
A flowing cyan-blue mantle of restoration wrapped over dark-red counter runes, the more punishment absorbed the more the healing waters flow.

#### `t2-air-counter-defense` — Glacial Pact
A dark pact between lavender wind and dark-red vengeance, the pact manifesting as a thin glowing cyan-white barrier — a deal that exchanges cold clarity for retribution.

#### `t2-counter-defense-earth` — Tombplate
Dark-red counter energy crystallizing into a brown-grey stone breastplate, rage hardened into geological protection, vengeance worn as armor.

---

### Físico × Elemental Múltiplo — Finais (10 cartas)

#### `t2-agility-counter-fire` — Searing Razor
A golden-blurred blade coated in dark-red counter energy that ignites orange-red on impact, the speed of the cut and the pain of the counter both feeding the fire.

#### `t2-agility-counter-water` — Venom Dance
A nimble fighter leaving dark-red bleeding marks through cyan water, each evasive movement also a counter that poisons through the water medium.

#### `t2-agility-air-counter` — Static Skirmish
A golden-blurred skirmisher crackling with lavender static electricity, each dodge leaving a dark-red charged residue that shocks whatever moves into the afterimage.

#### `t2-agility-counter-earth` — Quickearth Rite
A sprinter whose golden footsteps crack brown earth and leave dark-red counter runes carved into each fissure, ritual marks etched by speed into stone.

---

### Elemental Puro Avançado (10 cartas)

#### `t2-fire-fire-water` — Quench Lance
A lance of concentrated orange-red fire being extinguished by cyan water at its tip, the superheated steam forming the actual weapon — fire and water generating destruction through their conflict.

#### `t2-air-fire-fire` — Pyre Surge
Twin orange-red fire columns caught in a lavender wind updraft, both pillars swirling upward in a devastating fire-gale column.

#### `t2-earth-fire-fire` — Magma Welling
Two orange lava streams welling up from cracked brown earth, the ground bleeding fire from two separate wounds simultaneously.

#### `t2-fire-water-water` — Phoenix Aura
An orange-red flame phoenix rising from two layers of cyan water, the fire-bird born from its own extinguishing, death and rebirth in a single image.

#### `t2-air-water-water` — Misted Cadence
Lavender wind carrying two cyan water currents in perfect rhythm, a cadence of mist and air creating a pulsing atmospheric healing cycle.

#### `t2-earth-water-water` — Brine Bedrock
Two cyan water streams flowing over a brown stone base, salt water slowly reshaping bedrock, patient geological erosion made visible.

#### `t2-air-air-fire` — Cinder Squall
A spinning lavender air squall with orange-red fire erupting at its core, the whirlwind becoming an incinerating tornado.

#### `t2-air-air-water` — Squall Aura
A dual lavender wind aura encasing a cyan water core, the spinning air compressing the water into a dense healing pressure sphere.

#### `t2-air-air-earth` — Dust Plague
Twin lavender air vortices filled with brown stone dust, a blinding choking dust storm generated by two intersecting wind currents.

#### `t2-earth-earth-fire` — Magma Vow
Two stone layers above an orange-red lava core, a vow carved into the earth itself in fire, geological oath made permanent in molten rock.

#### `t2-earth-earth-water` — Bog Catalyst
Two stone masses submerged in dark cyan water, a catalyst reaction of earth and water forming brown sediment that catalyzes change.

#### `t2-air-earth-earth` — Standing Stone
A lavender wind currents circling a massive brown-grey monolith, the standing stone immovable while the air dances around it, earth absolute in the storm.

#### `t2-air-fire-water` — Steaming Plague
Lavender wind dispersing orange-red fire and cyan water in alternating toxic steam pockets, a plague of elemental vapor spread by the air.

#### `t2-earth-fire-water` — Alchemic Drain
Brown earth containing both orange lava and cyan water in perfect equilibrium, the alchemic balance being deliberately drained to release elemental force.

#### `t2-air-earth-fire` — Sandfury
A burning sand storm — brown stone particles carried in lavender wind with orange fire igniting them, a blazing desert sandstorm of pure elemental fury.

#### `t2-air-earth-water` — Marsh Squall
A lavender wind squall tearing through brown-cyan marsh water, cattails and mud flying, the swamp surface broken by atmospheric violence.

---

## Notas Técnicas

### Adicionando ao Preloader

Após gerar e salvar as imagens, adicione os IDs ao `src/scenes/Preloader.ts`:

```typescript
// Substitua a lista antiga por:
const cardIds = [
  // T1 — Puros
  't1-attack-attack', 't1-defense-defense', 't1-agility-agility', 't1-counter-counter',
  't1-fire-fire', 't1-water-water', 't1-air-air', 't1-earth-earth',
  // T1 — Cruzados
  't1-agility-attack', 't1-agility-counter', 't1-agility-defense', 't1-agility-fire',
  't1-agility-water', 't1-agility-air', 't1-agility-earth',
  't1-attack-counter', 't1-attack-defense', 't1-attack-fire', 't1-attack-water',
  't1-air-attack', 't1-attack-earth', 't1-counter-defense', 't1-counter-fire',
  't1-counter-water', 't1-air-counter', 't1-counter-earth', 't1-defense-fire',
  't1-defense-water', 't1-air-defense', 't1-defense-earth', 't1-fire-water',
  't1-air-fire', 't1-earth-fire', 't1-air-water', 't1-earth-water', 't1-air-earth',
  // T2 — adicionar IDs conforme as imagens forem geradas
];

// Todas as imagens novas são PNG
const jpgCards = new Set<string>(); // limpar após migrar

for (const id of cardIds) {
  const ext = jpgCards.has(id) ? '.jpg' : '.png';
  this.load.image(`card_${id}`, `assets/cards/${id}${ext}`);
}
```

### Dimensões recomendadas
- **Tamanho de geração:** 512×512px (Grok Imagine padrão)
- **Tamanho final no jogo:** exibido em ~130×85px dentro do card frame
- As imagens são redimensionadas automaticamente pelo `CardVisual.ts` para caber na área de arte do card

### Nomenclatura dos arquivos
O arquivo deve se chamar exatamente `<card-id>.png`, por exemplo:
- `t1-attack-attack.png`
- `t2-fire-fire-water.png`
