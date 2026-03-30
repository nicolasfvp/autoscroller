#!/usr/bin/env node
/**
 * PixelLab MCP helper - handles polling, animation queueing, and downloading.
 * Usage: node scripts/pixellab-helper.mjs <command> [args...]
 * Commands:
 *   status <charId>         - Get character status
 *   queue-anim <charId> <templateId> <animName> <direction>  - Queue animation
 *   download <charId> <destDir>  - Download character ZIP and extract
 *   download-frames <charId> <monsterId>  - Download individual animation frames
 */
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const API_URL = 'https://api.pixellab.ai/mcp';
const API_KEY = 'b5189ce1-34d6-4765-b37f-eea2a0e93c7d';
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
        const lines = data.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.replace('data: ', ''));
            if (json.result) {
              const content = json.result.content || [];
              const textParts = content.filter(c => c.type === 'text').map(c => c.text);
              const imageParts = content.filter(c => c.type === 'image');
              resolve({ text: textParts.join('\n'), images: imageParts });
              return;
            }
            if (json.error) {
              reject(new Error(JSON.stringify(json.error)));
              return;
            }
          } catch (e) { /* skip */ }
        }
        reject(new Error('No valid response: ' + data.substring(0, 300)));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const doGet = (targetUrl) => {
      const mod = targetUrl.startsWith('https') ? https : http;
      mod.get(targetUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doGet(res.headers.location);
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

async function getStatus(charId) {
  const result = await mcpCall('get_character', { character_id: charId, include_preview: false });
  return result.text;
}

async function queueAnimation(charId, templateId, animName, direction) {
  const params = {
    character_id: charId,
    template_animation_id: templateId,
    directions: [direction],
  };
  if (animName && animName !== templateId) {
    params.animation_name = animName;
  }
  const result = await mcpCall('animate_character', params);
  return result.text;
}

async function downloadFrames(charId, monsterId) {
  const baseDir = `public/assets/monsters/${monsterId}`;

  // Get character info to find URLs
  const text = await getStatus(charId);

  // Extract rotation URLs
  const rotUrlPattern = /\[south-east\]\((https:\/\/[^\)]+rotations\/south-east\.png[^\)]*)\)/;
  const rotMatch = text.match(rotUrlPattern);
  if (rotMatch) {
    const dest = path.join(baseDir, 'rotations', 'south-east.png');
    console.log(`  Downloading rotation south-east -> ${dest}`);
    await downloadFile(rotMatch[1], dest);
  }

  // Extract animation info from text
  // Pattern: **animation-name** (directions, N frames)
  const animPattern = /\*\*([a-z0-9_-]+)\*\*\s*\(([^)]+)\)/g;
  const animations = [];
  let match;
  while ((match = animPattern.exec(text)) !== null) {
    const animName = match[1];
    const details = match[2];
    const frameCountMatch = details.match(/(\d+)\s*frames?/);
    if (frameCountMatch) {
      animations.push({ name: animName, frames: parseInt(frameCountMatch[1]) });
    }
  }

  console.log(`  Found animations: ${animations.map(a => `${a.name}(${a.frames}f)`).join(', ')}`);

  // Download ZIP and extract
  const zipUrl = `https://api.pixellab.ai/mcp/characters/${charId}/download`;
  const zipPath = path.join(baseDir, 'character.zip');

  console.log(`  Downloading ZIP from ${zipUrl}`);
  try {
    await downloadFile(zipUrl, zipPath);
    const stats = fs.statSync(zipPath);
    console.log(`  ZIP size: ${stats.size} bytes`);

    if (stats.size < 1000) {
      // Probably an error response, not a real ZIP
      const content = fs.readFileSync(zipPath, 'utf8');
      console.log(`  ZIP might be error: ${content.substring(0, 200)}`);
      fs.unlinkSync(zipPath);
      return { animations, zipFailed: true };
    }

    return { animations, zipPath };
  } catch (err) {
    console.log(`  ZIP download failed: ${err.message}`);
    return { animations, zipFailed: true };
  }
}

// Main
const [,, cmd, ...args] = process.argv;

try {
  switch (cmd) {
    case 'status': {
      const text = await getStatus(args[0]);
      console.log(text);
      break;
    }
    case 'queue-anim': {
      const [charId, templateId, animName, direction = 'south-east'] = args;
      const text = await queueAnimation(charId, templateId, animName, direction);
      console.log(text);
      break;
    }
    case 'download-frames': {
      const [charId, monsterId] = args;
      const result = await downloadFrames(charId, monsterId);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    default:
      console.log('Usage: node pixellab-helper.mjs <status|queue-anim|download-frames> [args...]');
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
