#!/usr/bin/env node
// Generate card art via Grok Imagine. 1024x1024 PNG, square 1:1 so the
// central composition fits both the small in-hand crop (taller art slot)
// and the popup crop (wider art slot).
//
// Usage:
//   node scripts/generate-card-grok.mjs <cardId> "<prompt>"
//   node scripts/generate-card-grok.mjs --batch scripts/card-prompts.json
//
// Saves: public/assets/cards/<cardId>.png

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const apiKey = process.env.XAI_API_KEY;
if (!apiKey) {
  console.error('XAI_API_KEY env var not set');
  process.exit(1);
}

const args = process.argv.slice(2);

function requestOne(cardId, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: process.env.GROK_IMAGE_MODEL || 'grok-imagine-image',
      prompt,
      n: 1,
      response_format: 'b64_json',
    });

    const req = https.request(
      {
        hostname: 'api.x.ai',
        port: 443,
        path: '/v1/images/generations',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode} ${data}`));
          }
          try {
            const json = JSON.parse(data);
            const b64 = json.data?.[0]?.b64_json;
            if (!b64) return reject(new Error('No b64_json in response: ' + data));
            const outDir = process.env.CARD_OUT_DIR || 'public/assets/cards';
            fs.mkdirSync(outDir, { recursive: true });
            const outPath = path.join(outDir, `${cardId}.png`);
            fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
            console.log(`OK  -> ${outPath}`);
            if (json.data?.[0]?.revised_prompt) {
              console.log(`     revised: ${json.data[0].revised_prompt}`);
            }
            resolve();
          } catch (err) { reject(err); }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (args[0] === '--batch') {
    const file = args[1];
    if (!file) { console.error('Usage: --batch <jsonFile>'); process.exit(1); }
    const list = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const item of list) {
      try {
        console.log(`Generating ${item.id}...`);
        await requestOne(item.id, item.prompt);
      } catch (err) {
        console.error(`FAIL ${item.id}:`, err.message);
      }
    }
  } else {
    const [cardId, ...promptParts] = args;
    if (!cardId || promptParts.length === 0) {
      console.error('Usage: node scripts/generate-card-grok.mjs <cardId> "<prompt>"');
      console.error('   or: node scripts/generate-card-grok.mjs --batch <jsonFile>');
      process.exit(1);
    }
    await requestOne(cardId, promptParts.join(' '));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
