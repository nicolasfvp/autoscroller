#!/usr/bin/env node
/**
 * Download all monster assets from PixelLab.
 * 1. Downloads ZIP for each character
 * 2. Extracts and organizes into directory structure
 * 3. Creates metadata.json
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const API_KEY = 'b5189ce1-34d6-4765-b37f-eea2a0e93c7d';
const BASE_DIR = 'public/assets/monsters';

const MONSTERS = [
  { id: 'slime', charId: '3e088727-ddca-45d1-93be-bf38a3cfcbe7', name: 'Slime', prompt: 'green slime monster, gelatinous blob creature, simple round body, fantasy RPG enemy', attackTemplate: 'jumping-1' },
  { id: 'goblin', charId: 'c6643bc6-9dde-4acd-a0ab-8b4ce1fdb1ae', name: 'Goblin', prompt: 'goblin warrior with dagger, small green-skinned humanoid, leather armor, pointy ears, fantasy RPG enemy', attackTemplate: 'cross-punch' },
  { id: 'orc', charId: '9f004850-f892-4a46-98ae-f8ec950d80e8', name: 'Orc', prompt: 'orc brute with club, large muscular green humanoid, crude armor, tusks, fantasy RPG enemy', attackTemplate: 'cross-punch' },
  { id: 'mage', charId: '91c61d88-7f18-43e7-9410-3d12fa138987', name: 'Dark Mage', prompt: 'dark mage in purple robes, hooded spellcaster, mystical energy, fantasy RPG enemy', attackTemplate: 'fireball' },
  { id: 'elite_knight', charId: '4a796c88-d9e6-4126-bddc-444cfcca62f4', name: 'Elite Knight', prompt: 'elite knight in silver plate armor, large sword, ornate helmet, fantasy RPG elite enemy', attackTemplate: 'cross-punch' },
  { id: 'boss_demon', charId: 'b2f5726d-9f04-4fe1-b750-bda688a4c67a', name: 'Demon Lord', prompt: 'demon lord boss, dark red skin, horns, massive muscular body, fantasy RPG boss', attackTemplate: 'high-kick', extraAnims: ['walking'] },
];

function mcpRequest(toolName, args) {
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1,
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  });
  const tmpFile = path.join(process.env.TEMP || '/tmp', 'mcp_req.json');
  fs.writeFileSync(tmpFile, body);
  const result = execSync(`curl -s -X POST "https://api.pixellab.ai/mcp" -H "Authorization: Bearer ${API_KEY}" -H "Content-Type: application/json" -d @"${tmpFile}"`, {
    encoding: 'utf8',
    timeout: 30000,
  });
  const lines = result.split('\n').filter(l => l.startsWith('data: '));
  for (const line of lines) {
    try {
      const j = JSON.parse(line.replace('data: ', ''));
      if (j.result) {
        return j.result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
      }
    } catch (e) {}
  }
  return null;
}

function getCharacterInfo(charId) {
  return mcpRequest('get_character', { character_id: charId, include_preview: false });
}

function downloadZip(charId, destPath) {
  const url = `https://api.pixellab.ai/mcp/characters/${charId}/download`;
  try {
    execSync(`curl --fail -s -o "${destPath}" -H "Authorization: Bearer ${API_KEY}" "${url}"`, {
      timeout: 60000,
    });
    return fs.existsSync(destPath) && fs.statSync(destPath).size > 500;
  } catch (e) {
    return false;
  }
}

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const absZip = path.resolve(zipPath).replace(/\//g, '\\');
  const absDest = path.resolve(destDir).replace(/\//g, '\\');
  execSync(`powershell -Command "Expand-Archive -Path '${absZip}' -DestinationPath '${absDest}' -Force"`, {
    timeout: 30000, stdio: 'pipe',
  });
}

function walk(dir) {
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) entries.push(...walk(fullPath));
    else entries.push(fullPath);
  }
  return entries;
}

function organizeFiles(extractDir, monsterDir, monster) {
  const files = walk(extractDir);
  console.log(`  Found ${files.length} files in ZIP`);

  // Build animation name mapping
  const animMap = new Map();
  animMap.set('breathing-idle', 'breathing-idle');
  animMap.set('breathing_idle', 'breathing-idle');
  animMap.set(monster.attackTemplate, 'attack');
  animMap.set(monster.attackTemplate.replace(/-/g, '_'), 'attack');
  if (monster.extraAnims) {
    for (const a of monster.extraAnims) {
      animMap.set(a, a);
      animMap.set(a.replace(/-/g, '_'), a);
    }
  }

  for (const file of files) {
    if (!file.endsWith('.png')) continue;
    const relPath = path.relative(extractDir, file).replace(/\\/g, '/').toLowerCase();

    // Check rotations
    if (relPath.includes('rotation')) {
      if (relPath.includes('south-east') || relPath.includes('south_east')) {
        const dest = path.join(monsterDir, 'rotations', 'south-east.png');
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(file, dest);
        console.log(`  Copied rotation: south-east`);
      }
      continue;
    }

    // Check animations
    for (const [pattern, targetAnim] of animMap) {
      const normalizedPattern = pattern.replace(/-/g, '[-_]');
      if (relPath.includes(pattern) || relPath.includes(pattern.replace(/-/g, '_'))) {
        if (relPath.includes('south-east') || relPath.includes('south_east')) {
          const basename = path.basename(file);
          const dest = path.join(monsterDir, 'animations', targetAnim, 'south-east', basename);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(file, dest);
          break;
        }
      }
    }
  }
}

function downloadRotation(charInfo, monsterDir) {
  // Extract south-east rotation URL
  const match = charInfo.match(/\[south-east\]\((https:\/\/backblaze\.pixellab\.ai[^\)]+rotations\/south-east\.png[^\)]*)\)/);
  if (match) {
    const dest = path.join(monsterDir, 'rotations', 'south-east.png');
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try {
        execSync(`curl -s -o "${dest}" "${match[1]}"`, { timeout: 30000 });
        console.log(`  Downloaded rotation south-east`);
      } catch (e) {
        console.log(`  Failed to download rotation: ${e.message}`);
      }
    }
  }
}

// Main
console.log('=== Monster Asset Downloader ===\n');

for (const monster of MONSTERS) {
  console.log(`\n=== ${monster.id} (${monster.name}) ===`);
  const monsterDir = path.join(BASE_DIR, monster.id);
  fs.mkdirSync(monsterDir, { recursive: true });

  // Get character info
  console.log(`  Getting character info...`);
  const charInfo = getCharacterInfo(monster.charId);
  if (!charInfo) {
    console.log(`  ERROR: Could not get character info`);
    continue;
  }

  // Check for pending animations
  if (charInfo.includes('⏳') || charInfo.includes('processing')) {
    console.log(`  WARNING: Some animations may still be processing`);
    console.log(`  ${charInfo.substring(charInfo.indexOf('Animations'), charInfo.indexOf('Download')).trim()}`);
  }

  // Download rotation
  downloadRotation(charInfo, monsterDir);

  // Download ZIP
  const zipPath = path.join(monsterDir, 'character.zip');
  console.log(`  Downloading ZIP...`);
  if (downloadZip(monster.charId, zipPath)) {
    const size = fs.statSync(zipPath).size;
    console.log(`  ZIP: ${size} bytes`);

    // Extract
    const extractDir = path.join(monsterDir, '_extracted');
    try {
      extractZip(zipPath, extractDir);
      organizeFiles(extractDir, monsterDir, monster);

      // Clean up
      fs.rmSync(extractDir, { recursive: true, force: true });
      fs.unlinkSync(zipPath);
    } catch (e) {
      console.log(`  Extract failed: ${e.message}`);
    }
  } else {
    console.log(`  ZIP download failed or too small`);
  }

  // Create metadata.json
  const metadata = {
    character: {
      id: monster.charId,
      name: monster.name,
      prompt: monster.prompt,
      size: { width: 64, height: 64 },
      directions: 8,
      view: 'side',
      created_at: new Date().toISOString(),
    },
    frames: {
      rotations: { 'south-east': 'rotations/south-east.png' },
      animations: {},
    },
  };

  const anims = ['breathing-idle', 'attack'];
  if (monster.extraAnims) anims.push(...monster.extraAnims);

  for (const anim of anims) {
    const animDir = path.join(monsterDir, 'animations', anim, 'south-east');
    if (fs.existsSync(animDir)) {
      const frames = fs.readdirSync(animDir).filter(f => f.endsWith('.png')).sort();
      metadata.frames.animations[anim] = { 'south-east': frames.map(f => `animations/${anim}/south-east/${f}`) };
      console.log(`  ${anim}: ${frames.length} frames`);
    } else {
      console.log(`  ${anim}: NO FRAMES`);
    }
  }

  fs.writeFileSync(path.join(monsterDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  console.log(`  Metadata saved`);
}

// Final summary
console.log('\n=== SUMMARY ===');
for (const monster of MONSTERS) {
  const monsterDir = path.join(BASE_DIR, monster.id);
  const hasMeta = fs.existsSync(path.join(monsterDir, 'metadata.json'));
  const anims = ['breathing-idle', 'attack'];
  if (monster.extraAnims) anims.push(...monster.extraAnims);
  const animCounts = anims.map(a => {
    const d = path.join(monsterDir, 'animations', a, 'south-east');
    return `${a}:${fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.png')).length : 0}`;
  });
  console.log(`${monster.id}: meta=${hasMeta ? 'OK' : 'MISSING'} ${animCounts.join(' ')}`);
}
