#!/usr/bin/env node
/**
 * Generate all 6 monster characters via PixelLab MCP API.
 * Creates characters, adds animations, downloads frames.
 */
import fs from 'fs';
import path from 'path';
import https from 'https';

const API_URL = 'https://api.pixellab.ai/mcp';
const API_KEY = 'b5189ce1-34d6-4765-b37f-eea2a0e93c7d';
const BASE_DIR = 'public/assets/monsters';

const MONSTERS = [
  {
    id: 'slime',
    description: 'green slime monster, gelatinous blob creature, simple round body, fantasy RPG enemy',
    name: 'Slime',
    attackAnim: 'jumping-1', // slimes don't have weapons
  },
  {
    id: 'goblin',
    description: 'goblin warrior with dagger, small green-skinned humanoid, leather armor, pointy ears, fantasy RPG enemy',
    name: 'Goblin',
    attackAnim: 'cross-punch',
  },
  {
    id: 'orc',
    description: 'orc brute with club, large muscular green humanoid, crude armor, tusks, fantasy RPG enemy',
    name: 'Orc',
    attackAnim: 'cross-punch',
  },
  {
    id: 'mage',
    description: 'dark mage in purple robes, hooded spellcaster, glowing staff, mystical energy, fantasy RPG enemy',
    name: 'Dark Mage',
    attackAnim: 'fireball',
  },
  {
    id: 'elite_knight',
    description: 'elite knight in silver armor, full plate mail, large sword, ornate helmet, fantasy RPG elite enemy',
    name: 'Elite Knight',
    attackAnim: 'cross-punch',
  },
  {
    id: 'boss_demon',
    description: 'demon lord boss, dark red skin, horns, wings, massive muscular body, glowing eyes, fantasy RPG boss',
    name: 'Demon Lord',
    attackAnim: 'high-kick',
    extraAnims: ['walking'],
  },
];

let rpcId = 1;

function mcpCall(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: rpcId++,
      method: 'tools/call',
      params: { name: method, arguments: params },
    });

    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        // Parse SSE response
        const lines = data.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.replace('data: ', ''));
            if (json.result) {
              // Extract text content from MCP response
              const content = json.result.content || [];
              const textParts = content.filter(c => c.type === 'text').map(c => c.text);
              const imageParts = content.filter(c => c.type === 'image');
              resolve({ text: textParts.join('\n'), images: imageParts, raw: json.result });
              return;
            }
            if (json.error) {
              reject(new Error(JSON.stringify(json.error)));
              return;
            }
          } catch (e) { /* skip non-JSON lines */ }
        }
        reject(new Error('No valid response found: ' + data.substring(0, 500)));
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        https.get(res.headers.location, (res2) => {
          const chunks = [];
          res2.on('data', c => chunks.push(c));
          res2.on('end', () => {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.writeFileSync(destPath, Buffer.concat(chunks));
            resolve();
          });
        }).on('error', reject);
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, Buffer.concat(chunks));
        resolve();
      });
    }).on('error', reject);
  });
}

function saveBase64Image(base64Data, mimeType, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(destPath, buffer);
}

async function waitForCharacter(charId, maxWait = 600000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    console.log(`  Polling character ${charId}...`);
    const result = await mcpCall('get_character', { character_id: charId, include_preview: false });
    const text = result.text;

    // Check if character is complete
    if (text.includes('Status: completed') || text.includes('status: completed')) {
      console.log(`  Character ${charId} is complete!`);
      return result;
    }
    if (text.includes('Status: failed') || text.includes('status: failed')) {
      throw new Error(`Character ${charId} failed: ${text}`);
    }

    console.log(`  Still processing... waiting 15s`);
    await sleep(15000);
  }
  throw new Error(`Timeout waiting for character ${charId}`);
}

async function waitForAnimation(charId, animName, maxWait = 600000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    console.log(`  Polling animation ${animName} for ${charId}...`);
    const result = await mcpCall('get_character', { character_id: charId, include_preview: false });
    const text = result.text;

    // Check if specific animation is complete
    // Look for the animation name followed by completed status
    if (text.includes(animName) && (text.includes('completed') || text.includes('Complete'))) {
      // Verify it's not just the character being complete but the animation too
      const animSection = text.substring(text.indexOf(animName));
      if (animSection.includes('completed') || animSection.includes('Complete')) {
        console.log(`  Animation ${animName} for ${charId} is complete!`);
        return result;
      }
    }

    if (text.includes('failed')) {
      const failSection = text.substring(text.indexOf(animName));
      if (failSection.includes('failed')) {
        throw new Error(`Animation ${animName} for ${charId} failed`);
      }
    }

    console.log(`  Still processing... waiting 15s`);
    await sleep(15000);
  }
  throw new Error(`Timeout waiting for animation ${animName} for ${charId}`);
}

async function processMonster(monster) {
  const monsterDir = path.join(BASE_DIR, monster.id);
  const metadataPath = path.join(monsterDir, 'metadata.json');

  // Check idempotency
  if (fs.existsSync(metadataPath)) {
    const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    if (meta.character && meta.character.id) {
      console.log(`Skipping ${monster.id} -- already generated (${meta.character.id})`);
      return meta.character.id;
    }
  }

  console.log(`\n=== Creating character: ${monster.id} (${monster.name}) ===`);

  // Create character
  const createResult = await mcpCall('create_character', {
    description: monster.description,
    name: monster.name,
    body_type: 'humanoid',
    mode: 'standard',
    n_directions: 4,
    size: 64,
    view: 'side',
    outline: 'single color black outline',
    shading: 'basic shading',
    detail: 'medium detail',
  });

  console.log('Create response:', createResult.text.substring(0, 300));

  // Extract character ID from response text
  const idMatch = createResult.text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  if (!idMatch) {
    throw new Error(`Could not extract character ID for ${monster.id}: ${createResult.text}`);
  }
  const charId = idMatch[0];
  console.log(`Character ID: ${charId}`);

  // Wait for character creation
  await waitForCharacter(charId);

  return charId;
}

async function addAnimations(monster, charId) {
  const idleDir = path.join(BASE_DIR, monster.id, 'animations', 'breathing-idle', 'south-east');
  const attackDir = path.join(BASE_DIR, monster.id, 'animations', 'attack', 'south-east');

  // Check idempotency for animations
  const idleExists = fs.existsSync(idleDir) && fs.readdirSync(idleDir).filter(f => f.endsWith('.png')).length >= 3;
  const attackExists = fs.existsSync(attackDir) && fs.readdirSync(attackDir).filter(f => f.endsWith('.png')).length >= 3;

  if (idleExists && attackExists) {
    console.log(`Skipping animations for ${monster.id} -- already exist`);
    return;
  }

  // Add breathing-idle animation
  if (!idleExists) {
    console.log(`Adding breathing-idle animation for ${monster.id}...`);
    await mcpCall('animate_character', {
      character_id: charId,
      template_animation_id: 'breathing-idle',
      directions: ['south-east'],
    });
    await waitForAnimation(charId, 'breathing-idle');
  }

  // Add attack animation
  if (!attackExists) {
    console.log(`Adding attack animation (${monster.attackAnim}) for ${monster.id}...`);
    await mcpCall('animate_character', {
      character_id: charId,
      template_animation_id: monster.attackAnim,
      animation_name: 'attack',
      directions: ['south-east'],
    });
    await waitForAnimation(charId, 'attack');
  }

  // Add extra animations (boss walking)
  if (monster.extraAnims) {
    for (const anim of monster.extraAnims) {
      const animDir = path.join(BASE_DIR, monster.id, 'animations', anim, 'south-east');
      const animExists = fs.existsSync(animDir) && fs.readdirSync(animDir).filter(f => f.endsWith('.png')).length >= 3;
      if (!animExists) {
        console.log(`Adding ${anim} animation for ${monster.id}...`);
        await mcpCall('animate_character', {
          character_id: charId,
          template_animation_id: anim,
          directions: ['south-east'],
        });
        await waitForAnimation(charId, anim);
      }
    }
  }
}

async function downloadMonsterAssets(monster, charId) {
  console.log(`\nDownloading assets for ${monster.id}...`);

  // Get full character data with images
  const result = await mcpCall('get_character', { character_id: charId, include_preview: true });

  // Parse the response to find download URLs and images
  const text = result.text;
  const images = result.images || [];

  console.log(`  Response text length: ${text.length}`);
  console.log(`  Image parts: ${images.length}`);

  // Save rotation images from the response
  // The get_character response includes base64 images for rotations and animations
  // We need to parse the text to understand which image corresponds to what

  // Extract all URLs from text
  const urlMatches = text.match(/https?:\/\/[^\s"'<>]+\.png[^\s"'<>]*/g) || [];
  console.log(`  Found ${urlMatches.length} image URLs in text`);

  // Parse structured data from the text response
  // We need to find rotation and animation frame URLs
  const monsterDir = path.join(BASE_DIR, monster.id);

  // Save inline base64 images (rotations/animations)
  if (images.length > 0) {
    console.log(`  Processing ${images.length} inline images...`);
    // First image is typically the preview/rotation
    // We'll need to parse the text to understand the structure
  }

  // Download from URLs if available
  for (const url of urlMatches) {
    console.log(`  URL: ${url.substring(0, 80)}...`);
  }

  // Parse out the structured information more carefully
  // Look for sections about rotations and animations
  const sections = text.split('\n');
  let currentSection = '';
  let currentAnim = '';
  let frameIdx = 0;

  for (const line of sections) {
    if (line.includes('Rotation') || line.includes('rotation')) {
      currentSection = 'rotation';
    }
    if (line.includes('Animation') || line.includes('animation')) {
      currentSection = 'animation';
    }
    if (line.includes('breathing-idle') || line.includes('breathing_idle')) {
      currentAnim = 'breathing-idle';
      frameIdx = 0;
    }
    if (line.includes('attack') || line.includes(monster.attackAnim)) {
      currentAnim = 'attack';
      frameIdx = 0;
    }
  }

  // Save the full text response for debugging
  fs.writeFileSync(path.join(monsterDir, 'api_response.txt'), text);

  // Save metadata
  const metadata = {
    character: {
      id: charId,
      name: monster.name,
      prompt: monster.description,
      size: { width: 64, height: 64 },
      directions: 4,
      view: 'side',
    },
    frames: {
      rotations: {},
      animations: {},
    },
  };

  // Process images - save base64 images from MCP response
  let imageIdx = 0;
  for (const img of images) {
    if (img.data) {
      // We have base64 image data
      // Try to figure out what this image represents from context
      const imgPath = path.join(monsterDir, `raw_image_${imageIdx}.png`);
      saveBase64Image(img.data, img.mimeType || 'image/png', imgPath);
      console.log(`  Saved raw image ${imageIdx}`);
      imageIdx++;
    }
  }

  // Return text for further processing
  return { text, images, metadata };
}

async function main() {
  console.log('=== PixelLab Monster Generator ===\n');

  // Step 1: Create all characters
  const charIds = {};

  for (const monster of MONSTERS) {
    try {
      charIds[monster.id] = await processMonster(monster);
    } catch (err) {
      console.error(`ERROR creating ${monster.id}:`, err.message);
      // Try with simplified prompt
      try {
        console.log(`Retrying ${monster.id} with simplified prompt...`);
        monster.description = monster.description.split(',')[0];
        charIds[monster.id] = await processMonster(monster);
      } catch (err2) {
        console.error(`FATAL: Could not create ${monster.id}:`, err2.message);
        process.exit(1);
      }
    }
  }

  console.log('\n=== All characters created ===');
  console.log(JSON.stringify(charIds, null, 2));

  // Save character IDs for reference
  fs.writeFileSync(path.join(BASE_DIR, 'character_ids.json'), JSON.stringify(charIds, null, 2));

  // Step 2: Add animations to each character
  for (const monster of MONSTERS) {
    try {
      await addAnimations(monster, charIds[monster.id]);
    } catch (err) {
      console.error(`ERROR animating ${monster.id}:`, err.message);
    }
  }

  console.log('\n=== All animations added ===');

  // Step 3: Download all assets
  for (const monster of MONSTERS) {
    try {
      const { text, images, metadata } = await downloadMonsterAssets(monster, charIds[monster.id]);
      const monsterDir = path.join(BASE_DIR, monster.id);
      fs.writeFileSync(path.join(monsterDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    } catch (err) {
      console.error(`ERROR downloading ${monster.id}:`, err.message);
    }
  }

  console.log('\n=== Generation complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
