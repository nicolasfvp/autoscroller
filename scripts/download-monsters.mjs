#!/usr/bin/env node
/**
 * Download all monster assets from PixelLab and organize into directory structure.
 * Downloads ZIP for each character, extracts animation frames.
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const API_URL = 'https://api.pixellab.ai/mcp';
const API_KEY = 'b5189ce1-34d6-4765-b37f-eea2a0e93c7d';
const BASE_DIR = 'public/assets/monsters';
let rpcId = 1;

const MONSTERS = {
  slime: { charId: '3e088727-ddca-45d1-93be-bf38a3cfcbe7', name: 'Slime', attackTemplate: 'jumping-1' },
  goblin: { charId: 'c6643bc6-9dde-4acd-a0ab-8b4ce1fdb1ae', name: 'Goblin', attackTemplate: 'cross-punch' },
  orc: { charId: '9f004850-f892-4a46-98ae-f8ec950d80e8', name: 'Orc', attackTemplate: 'cross-punch' },
  mage: { charId: '290cb8a5-338a-4a4e-a747-cfc6419f158b', name: 'Dark Mage', attackTemplate: 'fireball' },
  elite_knight: { charId: '01611f6a-ede3-4c85-9cc5-63676273b1e0', name: 'Elite Knight', attackTemplate: 'cross-punch' },
  boss_demon: { charId: 'a84e0cf4-c42c-4f85-b425-4b6f3c951a67', name: 'Demon Lord', attackTemplate: 'high-kick', extraAnims: ['walking'] },
};

function mcpCall(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0', id: rpcId++,
      method: 'tools/call',
      params: { name: method, arguments: params },
    });
    const url = new URL(API_URL);
    const req = https.request({
      hostname: url.hostname, port: 443, path: url.pathname, method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const lines = data.split('\n').filter(l => l.startsWith('data: '));
        for (const l of lines) {
          try {
            const j = JSON.parse(l.replace('data: ', ''));
            if (j.result) {
              const content = j.result.content || [];
              resolve({ text: content.filter(c => c.type === 'text').map(c => c.text).join('\n'), images: content.filter(c => c.type === 'image') });
              return;
            }
            if (j.error) { reject(new Error(JSON.stringify(j.error))); return; }
          } catch (e) {}
        }
        reject(new Error('No valid response'));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function downloadUrl(url, destPath) {
  return new Promise((resolve, reject) => {
    const doGet = (targetUrl, redirectCount = 0) => {
      if (redirectCount > 5) { reject(new Error('Too many redirects')); return; }
      const mod = targetUrl.startsWith('https') ? https : require('http');
      mod.get(targetUrl, { headers: { 'Authorization': `Bearer ${API_KEY}` } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doGet(res.headers.location, redirectCount + 1);
          return;
        }
        if (res.statusCode !== 200) {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 200)}`)));
          return;
        }
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        const ws = fs.createWriteStream(destPath);
        res.pipe(ws);
        ws.on('finish', () => { ws.close(); resolve(); });
        ws.on('error', reject);
      }).on('error', reject);
    };
    doGet(url);
  });
}

async function processMonster(monsterId, config) {
  console.log(`\n=== Processing ${monsterId} (${config.name}) ===`);
  const monsterDir = path.join(BASE_DIR, monsterId);
  fs.mkdirSync(monsterDir, { recursive: true });

  // Get character info
  const result = await mcpCall('get_character', { character_id: config.charId, include_preview: false });
  const text = result.text;

  // Check if all animations are complete
  const pendingMatch = text.match(/processing|pending|queued/i);
  if (pendingMatch && !text.includes('Available Template Animations')) {
    console.log(`  WARNING: Some jobs may still be processing`);
  }

  // Extract URLs for rotations
  const rotUrlRegex = /\[([a-z-]+)\]\((https:\/\/backblaze\.pixellab\.ai[^\)]+rotations\/[^\)]+)\)/g;
  let match;
  while ((match = rotUrlRegex.exec(text)) !== null) {
    const dir = match[1];
    const url = match[2];
    if (dir === 'south-east') {
      const dest = path.join(monsterDir, 'rotations', 'south-east.png');
      console.log(`  Downloading rotation south-east`);
      await downloadUrl(url, dest);
    }
  }

  // Download ZIP
  const zipUrl = `https://api.pixellab.ai/mcp/characters/${config.charId}/download`;
  const zipPath = path.join(monsterDir, 'character.zip');
  console.log(`  Downloading ZIP...`);

  try {
    await downloadUrl(zipUrl, zipPath);
    const stats = fs.statSync(zipPath);
    console.log(`  ZIP size: ${stats.size} bytes`);

    if (stats.size < 500) {
      const content = fs.readFileSync(zipPath, 'utf8');
      console.log(`  ZIP too small, might be error: ${content.substring(0, 100)}`);

      // Fall back to downloading individual frame URLs from the text
      await downloadFramesFromUrls(text, monsterId, config);
    } else {
      // Extract ZIP
      console.log(`  Extracting ZIP...`);
      const extractDir = path.join(monsterDir, '_extracted');
      fs.mkdirSync(extractDir, { recursive: true });

      try {
        // Use PowerShell to extract ZIP on Windows
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath.replace(/\//g, '\\\\')}' -DestinationPath '${extractDir.replace(/\//g, '\\\\')}' -Force"`, { stdio: 'pipe' });
        console.log(`  Extracted successfully`);

        // Organize extracted files
        await organizeExtractedFiles(extractDir, monsterDir, monsterId, config);
      } catch (err) {
        console.log(`  ZIP extraction failed: ${err.message}`);
        await downloadFramesFromUrls(text, monsterId, config);
      }
    }
  } catch (err) {
    console.log(`  ZIP download failed (${err.message}), trying individual URLs...`);
    await downloadFramesFromUrls(text, monsterId, config);
  }

  // Create metadata.json
  const metadata = {
    character: {
      id: config.charId,
      name: config.name,
      prompt: '',
      size: { width: 64, height: 64 },
      directions: 8,
      view: 'side',
      created_at: new Date().toISOString(),
    },
    frames: {
      rotations: {
        'south-east': 'rotations/south-east.png',
      },
      animations: {},
    },
  };

  // Populate animation entries in metadata
  const anims = ['breathing-idle', 'attack'];
  if (config.extraAnims) anims.push(...config.extraAnims);

  for (const anim of anims) {
    const animDir = path.join(monsterDir, 'animations', anim, 'south-east');
    if (fs.existsSync(animDir)) {
      const frames = fs.readdirSync(animDir).filter(f => f.endsWith('.png')).sort();
      if (frames.length > 0) {
        metadata.frames.animations[anim] = {
          'south-east': frames.map(f => `animations/${anim}/south-east/${f}`),
        };
      }
    }
  }

  fs.writeFileSync(path.join(monsterDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  console.log(`  Metadata saved`);
}

async function organizeExtractedFiles(extractDir, monsterDir, monsterId, config) {
  // Walk the extracted directory to find animation frames
  const walk = (dir) => {
    const entries = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        entries.push(...walk(fullPath));
      } else {
        entries.push(fullPath);
      }
    }
    return entries;
  };

  const files = walk(extractDir);
  console.log(`  Found ${files.length} files in ZIP`);

  // Map animations to our directory structure
  const animMap = {
    'breathing-idle': 'breathing-idle',
    'breathing_idle': 'breathing-idle',
    'attack': 'attack',
    [config.attackTemplate]: 'attack',
    [config.attackTemplate.replace(/-/g, '_')]: 'attack',
  };
  if (config.extraAnims) {
    for (const a of config.extraAnims) {
      animMap[a] = a;
      animMap[a.replace(/-/g, '_')] = a;
    }
  }

  for (const file of files) {
    if (!file.endsWith('.png')) continue;
    const relPath = path.relative(extractDir, file).replace(/\\/g, '/');

    // Check if it's a rotation
    if (relPath.includes('rotations/') || relPath.includes('rotation')) {
      if (relPath.includes('south-east') || relPath.includes('south_east')) {
        const dest = path.join(monsterDir, 'rotations', 'south-east.png');
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(file, dest);
        console.log(`  Copied rotation south-east`);
      }
      continue;
    }

    // Check if it's an animation frame
    for (const [pattern, targetAnim] of Object.entries(animMap)) {
      if (relPath.includes(pattern)) {
        // Check for south-east direction
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

  // Verify we got frames
  const anims = ['breathing-idle', 'attack'];
  if (config.extraAnims) anims.push(...config.extraAnims);

  for (const anim of anims) {
    const animDir = path.join(monsterDir, 'animations', anim, 'south-east');
    if (fs.existsSync(animDir)) {
      const frames = fs.readdirSync(animDir).filter(f => f.endsWith('.png'));
      console.log(`  ${anim}: ${frames.length} frames`);
    } else {
      console.log(`  ${anim}: NO FRAMES FOUND`);
    }
  }
}

async function downloadFramesFromUrls(text, monsterId, config) {
  console.log(`  Attempting to download individual frame URLs from API response...`);

  // The get_character response text typically doesn't include direct frame URLs
  // but we can try the download endpoint with a different approach
  // For now, let's try using the structure from the ZIP URL approach

  // Alternative: re-fetch with include_preview to get images
  const result = await mcpCall('get_character', { character_id: config.charId, include_preview: true });

  // Save any base64 images from the response
  const images = result.images || [];
  console.log(`  Got ${images.length} inline images from API`);

  // These inline images are typically preview sheets, not individual frames
  // We need the ZIP for individual frames
  // Let's try the ZIP download again with auth header
  const zipUrl = `https://api.pixellab.ai/mcp/characters/${config.charId}/download`;
  const monsterDir = path.join(BASE_DIR, monsterId);
  const zipPath = path.join(monsterDir, 'character.zip');

  console.log(`  Retrying ZIP download with auth...`);
  try {
    await downloadUrl(zipUrl, zipPath);
    const stats = fs.statSync(zipPath);
    if (stats.size > 500) {
      console.log(`  ZIP OK: ${stats.size} bytes`);
      const extractDir = path.join(monsterDir, '_extracted');
      fs.mkdirSync(extractDir, { recursive: true });
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath.replace(/\//g, '\\\\')}' -DestinationPath '${extractDir.replace(/\//g, '\\\\')}' -Force"`, { stdio: 'pipe' });
      await organizeExtractedFiles(extractDir, monsterDir, monsterId, config);
    }
  } catch (err) {
    console.log(`  Retry failed: ${err.message}`);
  }
}

async function main() {
  console.log('=== Monster Asset Downloader ===');

  // Optional: only process specific monsters passed as args
  const requested = process.argv.slice(2);
  const toProcess = requested.length > 0
    ? Object.entries(MONSTERS).filter(([k]) => requested.includes(k))
    : Object.entries(MONSTERS);

  for (const [monsterId, config] of toProcess) {
    try {
      await processMonster(monsterId, config);
    } catch (err) {
      console.error(`  ERROR processing ${monsterId}: ${err.message}`);
    }
  }

  console.log('\n=== Download complete ===');

  // Summary
  for (const [monsterId] of toProcess) {
    const monsterDir = path.join(BASE_DIR, monsterId);
    const metaPath = path.join(monsterDir, 'metadata.json');
    if (fs.existsSync(metaPath)) {
      console.log(`${monsterId}: metadata OK`);
    } else {
      console.log(`${monsterId}: MISSING metadata`);
    }
    for (const anim of ['breathing-idle', 'attack']) {
      const dir = path.join(monsterDir, 'animations', anim, 'south-east');
      const count = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.png')).length : 0;
      console.log(`  ${anim}: ${count} frames`);
    }
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
