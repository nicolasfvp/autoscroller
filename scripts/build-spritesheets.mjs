import sharp from 'sharp';
import { readdir, mkdir } from 'fs/promises';
import { join } from 'path';

// --- Hero config ---
const HERO_DIR = 'public/assets/hero';
const HERO_OUT_DIR = 'public/assets/hero/spritesheets';

const heroAnimations = [
  { name: 'hero_idle', src: 'animations/breathing-idle/east', baseDir: HERO_DIR, outDir: HERO_OUT_DIR },
  { name: 'hero_walk', src: 'animations/walking/east', baseDir: HERO_DIR, outDir: HERO_OUT_DIR },
  { name: 'hero_attack', src: 'animations/cross-punch/east', baseDir: HERO_DIR, outDir: HERO_OUT_DIR },
  { name: 'hero_death', src: 'animations/falling-back-death/east', baseDir: HERO_DIR, outDir: HERO_OUT_DIR },
];

// --- Mage Hero config ---
const MAGE_DIR = 'public/assets/mage';
const MAGE_OUT_DIR = 'public/assets/mage/spritesheets';

const mageAnimations = [
  { name: 'mage_idle', src: 'animations/breathing-idle/south-east', baseDir: MAGE_DIR, outDir: MAGE_OUT_DIR },
  { name: 'mage_walk', src: 'animations/walking/south-east', baseDir: MAGE_DIR, outDir: MAGE_OUT_DIR },
  { name: 'mage_attack', src: 'animations/fireball/south-east', baseDir: MAGE_DIR, outDir: MAGE_OUT_DIR },
  { name: 'mage_death', src: 'animations/falling-back-death/south-east', baseDir: MAGE_DIR, outDir: MAGE_OUT_DIR },
];

// --- Monster config ---
const MONSTER_IDS = ['slime', 'goblin', 'orc', 'mage', 'elite_knight', 'boss_demon'];

// Map each monster to its specific attack animation name
const MONSTER_ATTACK_ANIMS = {
  slime: 'lead-jab',
  goblin: 'cross-punch',
  orc: 'cross-punch',
  mage: 'fireball',
  elite_knight: 'cross-punch',
  boss_demon: 'high-kick',
};

const monsterAnimations = MONSTER_IDS.flatMap(id => [
  { name: `${id}_idle`, src: 'animations/breathing-idle/west', baseDir: `public/assets/monsters/${id}`, outDir: `public/assets/monsters/${id}/spritesheets` },
  { name: `${id}_attack`, src: `animations/${MONSTER_ATTACK_ANIMS[id]}/west`, baseDir: `public/assets/monsters/${id}`, outDir: `public/assets/monsters/${id}/spritesheets` },
  { name: `${id}_death`, src: 'animations/falling-back-death/west', baseDir: `public/assets/monsters/${id}`, outDir: `public/assets/monsters/${id}/spritesheets` },
]);

// --- Shared builder ---
async function buildSpritesheet(anim) {
  const srcDir = join(anim.baseDir, anim.src);
  const files = (await readdir(srcDir)).filter(f => f.endsWith('.png')).sort();

  if (files.length === 0) {
    console.log(`  Skipping ${anim.name}: no frames`);
    return false;
  }

  // Get frame dimensions from first frame
  const firstMeta = await sharp(join(srcDir, files[0])).metadata();
  const w = firstMeta.width;
  const h = firstMeta.height;

  // Build horizontal strip
  const composites = await Promise.all(
    files.map(async (file, i) => ({
      input: await sharp(join(srcDir, file)).toBuffer(),
      left: i * w,
      top: 0,
    }))
  );

  const totalWidth = w * files.length;
  await mkdir(anim.outDir, { recursive: true });
  await sharp({
    create: { width: totalWidth, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toFile(join(anim.outDir, `${anim.name}.png`));

  console.log(`  ${anim.name}: ${files.length} frames @ ${w}x${h} -> ${totalWidth}x${h}`);
  return true;
}

// --- Main ---
let built = 0;
let skipped = 0;

console.log('Building hero spritesheets...');
for (const anim of heroAnimations) {
  (await buildSpritesheet(anim)) ? built++ : skipped++;
}

console.log('Building mage hero spritesheets...');
for (const anim of mageAnimations) {
  (await buildSpritesheet(anim)) ? built++ : skipped++;
}

console.log('Building monster spritesheets...');
for (const anim of monsterAnimations) {
  (await buildSpritesheet(anim)) ? built++ : skipped++;
}

console.log(`\nDone! Built: ${built}, Skipped: ${skipped}`);
