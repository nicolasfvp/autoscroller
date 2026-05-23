// Centralized prompts for generating tile sprites via xAI Grok Imagine.
// All tiles share the same visual recipe: 3/4 top-down perspective (~45°),
// packed pixel-art diorama, Stardew Valley / Octopath Traveler style,
// cohesive 16-bit JRPG palette, crisp pixel edges, no UI / text / characters.

const STYLE_TAIL =
  'Cohesive 16-bit JRPG palette, sharp blocky pixel-art shading, ' +
  'Stardew Valley / Octopath Traveler visual style. Crisp pixel edges, no ' +
  'anti-aliasing, no outline glow, no text, no UI, no human or monster ' +
  'characters, no border frame. Composition fills the entire square. ' +
  'Highly readable silhouettes when viewed small.';

const HEAD = (subject) =>
  `Pixel art roguelike map tile, square 1:1 framing, 3/4 top-down ` +
  `perspective at roughly 45 degrees. A self-contained diorama: ${subject}. `;

const SUBTILE_HEAD = (subject) =>
  `Pixel art roguelike map subtile, square 1:1 framing, 3/4 top-down ` +
  `perspective at roughly 45 degrees, slightly less dense than a full ` +
  `terrain tile but still detailed. A self-contained scene: ${subject}. `;

const RESERVED_HEAD = (terrain, subject) =>
  `Pixel art roguelike map tile, square 1:1 framing, 3/4 top-down ` +
  `perspective at roughly 45 degrees. A SPARSE, low-detail extension of a ` +
  `${terrain} biome — mostly open ground that visually flows next to the ` +
  `richer ${terrain} tile: ${subject}. `;

export const TILE_PROMPTS = {
  // --- TERRAIN TILES (already generated: forest) ---
  graveyard:
    HEAD(
      'a haunted graveyard with four or five varied stone tombstones ' +
      '(cross, slab, broken obelisk) sticking out of grayish-purple dead ' +
      'grass, a twisted leafless dead tree with gnarled branches looming ' +
      'on one side, cracked earth, dark fog tendrils crawling between ' +
      'graves, a small candle flame on one stone, a black crow perched on ' +
      'a tombstone, a few pale bones scattered, muted grays / pale moss / ' +
      'deep purple shadows / dim sickly green accents',
    ) + STYLE_TAIL,

  swamp:
    HEAD(
      'a murky bog swamp with dark stagnant green-brown water covering ' +
      'most of the tile, three knotted mangrove tree trunks rising out of ' +
      'it with visible roots spreading into the water, large green lily ' +
      'pads floating with two pink lotus flowers, brown cattail reeds at ' +
      'one edge, a rotting log half-submerged, drifting mist tendrils, ' +
      'deep murky greens / swamp browns / soft pinks / muted teal water',
    ) + STYLE_TAIL,

  desert:
    HEAD(
      'a sun-baked desert with rolling sand dunes in warm gold and orange ' +
      'tones, two tall saguaro cacti with small pink flowers, weathered ' +
      'sandstone rocks of varied sizes, bleached white animal bones (ribs, ' +
      'a skull) half-buried in the sand, sparse dry yellow grass tufts, a ' +
      'tumbleweed near one edge, faint cracked sun-dried mud, warm sand ' +
      'yellow / burnt orange shadows / dusty rose / bone white',
    ) + STYLE_TAIL,

  lava:
    HEAD(
      'a volcanic lava field with cracked black basalt rock floor, bright ' +
      'orange-red molten lava flowing through deep fissures, glowing ' +
      'yellow embers floating in the air, jagged black obsidian shards ' +
      'jutting up at varied heights, small ash piles, a bleached white ' +
      'skull resting on a rock, faint heat haze, deep black basalt / vivid ' +
      'orange and crimson lava / bright yellow glow highlights / ash gray',
    ) + STYLE_TAIL,

  // --- SPECIAL TILES ---
  treasure:
    HEAD(
      'a treasure cache scene: an open large wooden treasure chest with ' +
      'golden trim and an open lid, sitting on stone-tiled floor, spilling ' +
      'out a pile of gold coins, scattered rubies, emeralds, sapphires, a ' +
      'small gold crown, two lit torches mounted on stones to either side ' +
      'casting warm light, an old map scroll, a jeweled dagger, warm gold ' +
      'and amber / deep wood brown / rich red and green gems / golden glow',
    ) + STYLE_TAIL,

  event:
    HEAD(
      'a mysterious magical event site in a clearing: an ancient stone ' +
      'shrine in the center with a glowing magical orb / floating crystal ' +
      'hovering above it, cyan-blue runes carved into the shrine emitting ' +
      'magical light, a campfire with mystic teal flames burning to one ' +
      'side, a glowing question-mark-shaped sigil (the iconic ? shape) ' +
      'faintly drifting above the shrine, small candles in a circle, ' +
      'mossy stone ground with weathered runes, deep purples and blues / ' +
      'glowing cyan-teal magic / warm stone gray / mystic green',
    ) + STYLE_TAIL,

  boss:
    HEAD(
      'a foreboding boss lair entrance: a cracked dark stone arena floor ' +
      'with a glowing red blood-magic summoning circle etched in the ' +
      'center, ominous human skulls on pikes around the perimeter, ' +
      'dripping red banners hanging from posts, broken weapons (a snapped ' +
      'sword, a cracked shield) scattered, smoldering braziers with eerie ' +
      'red flames, dark cracks in the floor leaking red glow, scattered ' +
      'bones, deep cold gray stone / ominous crimson red / dark blood-' +
      'purple shadows / sickly green / ember orange',
    ) + STYLE_TAIL,

  basic:
    HEAD(
      'a section of an ancient stone-brick path filling the entire tile — ' +
      'large rectangular gray stone bricks in a staggered (running-bond) ' +
      'pattern with darker mortar between them, a few cracked or chipped ' +
      'bricks, patches of moss creeping between some cracks, sparse tufts ' +
      'of dry grass poking up at the edges, scattered tiny pebbles, ' +
      'faint boot-print scuffs across the bricks. The pattern is designed ' +
      'to read as a continuous walkway when many copies repeat down a ' +
      'loop — no strong focal point, no centered hero element, just a ' +
      'cohesive paved surface. Weathered gray stone / warm mossy green ' +
      'accents / dusty earth-tan grout',
    ) + STYLE_TAIL,

  // --- SUBTILES (effect spots) ---
  subtile_ambush:
    SUBTILE_HEAD(
      'an ambush trap site: a hidden hunter snare on grassy ground (coil ' +
      'of rope and a wooden trigger), a sharpened wooden pungi stake ' +
      'jutting up, a torn bloodied cloth strip caught on a thorny bush, ' +
      'blood drops on the grass, a few crow feathers. Muted greens / warm ' +
      'rust browns / deep crimson accents',
    ) + STYLE_TAIL,

  subtile_magma:
    SUBTILE_HEAD(
      'a small volcanic vent: a cracked rocky ground patch with glowing ' +
      'orange-red magma seeping through cracks, small ember sparks rising ' +
      'in the air, two glowing red obsidian shards, a small puddle of ' +
      'bubbling molten rock, faint orange heat haze. Dark basalt black / ' +
      'vivid orange and crimson lava / bright yellow embers',
    ) + STYLE_TAIL,

  subtile_manawell:
    SUBTILE_HEAD(
      'a magical mana well: a small stone-rimmed circular pool of glowing ' +
      'magical blue water in the center, soft cyan magical mist rising ' +
      'from the surface, glowing runes carved into the rim, a wooden ' +
      'bucket beside it, floating mana sparkles (small blue diamonds) ' +
      'hovering above. Glowing arcane blue / soft cyan highlights / ' +
      'weathered gray stone / deep midnight blue water',
    ) + STYLE_TAIL,

  subtile_camp:
    SUBTILE_HEAD(
      'a small tactical military camp: a small canvas tent with a banner ' +
      'on top, a campfire surrounded by logs (embers only, no big ' +
      'flames), a wooden weapon rack with two spears, a metal shield ' +
      'leaning against a crate, a wooden barrel, a folded map on a small ' +
      'table. Military green canvas / warm wood brown / steel gray / deep ' +
      'ember orange',
    ) + STYLE_TAIL,

  subtile_burnaltar:
    SUBTILE_HEAD(
      'a fire altar: a stone ritual altar in the center with a vivid ' +
      'orange-red flame burning on top, glowing red runes etched into the ' +
      'stone face, two flanking torches with red-orange flames, ash ' +
      'scattered on the floor around it, glowing ember floor cracks. Dark ' +
      'stone gray / vivid fire orange and red / glowing ember yellow / ' +
      'soot black',
    ) + STYLE_TAIL,

  subtile_bleedtotem:
    SUBTILE_HEAD(
      'a tribal blood totem: a tall wooden totem pole carved with snarling ' +
      'animal faces in the center, dried blood splattered down its ' +
      'length, bone fragments tied to it with leather cords, a circle of ' +
      'crimson-stained bones laid on the ground around its base, dried ' +
      'blood pooled in the dirt, a single crow feather. Weathered wood ' +
      'brown / deep crimson blood red / bone white / earthy dirt brown',
    ) + STYLE_TAIL,

  subtile_resonance:
    SUBTILE_HEAD(
      'a resonance crystal formation: a large jagged purple-magenta ' +
      'magical crystal cluster growing from the ground in the center with ' +
      'a strong inner glow, smaller crystals around its base, a faint ' +
      'magical purple aura, glowing motes drifting in the air, a small ' +
      'ring of cracked stone tile beneath it. Vivid magenta and violet / ' +
      'glowing pale pink highlights / deep purple shadows / weathered ' +
      'gray stone',
    ) + STYLE_TAIL,

  subtile_warhorn:
    SUBTILE_HEAD(
      'a war horn camp marker: a large curved iron-bound war horn mounted ' +
      'on a wooden tripod stand in the center, a red banner with a wolf ' +
      'sigil flapping nearby, two crossed spears stuck in the ground ' +
      'behind it, a small battle-scarred shield leaning beside, dried mud ' +
      'and trampled grass. Weathered iron gray / deep crimson banner red ' +
      '/ warm wood brown / scuffed leather tan',
    ) + STYLE_TAIL,

  // --- RESERVED SLOTS (sparse versions of each terrain) ---
  reserved_forest:
    RESERVED_HEAD(
      'forest',
      'mostly mossy green grass and forest floor with only one small pine ' +
      'sapling near a corner, scattered fallen pine needles, a few patches ' +
      'of dead leaves, one small mossy rock, faint dirt path traces. Deep ' +
      'forest greens / warm browns / soft moss',
    ) + STYLE_TAIL,

  reserved_graveyard:
    RESERVED_HEAD(
      'graveyard',
      'pale dead grayish-purple grass covering most of the tile, one small ' +
      'simple tombstone in a corner, cracked dirt patches, sparse pale ' +
      'weeds, a single weathered bone. Muted grays / pale moss / deep ' +
      'purple shadows',
    ) + STYLE_TAIL,

  reserved_swamp:
    RESERVED_HEAD(
      'swamp',
      'dark stagnant green-brown shallow swamp water filling the entire ' +
      'square edge-to-edge with no white space, no transparent background, ' +
      'no empty corners — water bleeds all the way to all four edges. Two ' +
      'small lily pads floating, a single cattail reed cluster in a ' +
      'corner, faint mist tendrils, a small half-submerged stone. Deep ' +
      'murky greens / swamp browns / muted teal water',
    ) + STYLE_TAIL,

  reserved_desert:
    RESERVED_HEAD(
      'desert',
      'warm gold-orange sand dunes covering the tile with rippled wind ' +
      'patterns, one small dry grass tuft, one weathered sandstone rock ' +
      'in a corner, a tiny bleached bone fragment, scattered tiny pebbles. ' +
      'Warm sand yellow / burnt orange shadows / bone white',
    ) + STYLE_TAIL,

  reserved_lava:
    RESERVED_HEAD(
      'lava',
      'cracked black basalt rock floor covering the tile with one thin ' +
      'glowing red lava crack running across, faint ember glow in the ' +
      'cracks, scattered small ash piles, one small obsidian shard. Deep ' +
      'black basalt / vivid orange lava accents / ash gray',
    ) + STYLE_TAIL,
};
