#!/usr/bin/env node
// Generate a full-resolution scene background via Grok Imagine. Unlike
// generate-tile-grok.mjs (which downscales to 256x256 for tile sprites),
// this keeps the raw 1024x1024 and lets the caller place it where it fits.
//
// Usage: node scripts/generate-bg-grok.mjs <outName> "<prompt>"
// Saves: public/assets/ui/backgrounds/<outName>.png

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const apiKey = process.env.XAI_API_KEY;
if (!apiKey) {
  console.error('XAI_API_KEY env var not set');
  process.exit(1);
}

const [, , outName, ...promptParts] = process.argv;
if (!outName || promptParts.length === 0) {
  console.error('Usage: node scripts/generate-bg-grok.mjs <outName> "<prompt>"');
  process.exit(1);
}
const prompt = promptParts.join(' ');

const model = process.env.GROK_IMAGE_MODEL || 'grok-imagine-image';
const body = JSON.stringify({
  model,
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
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      if (res.statusCode >= 400) {
        console.error('HTTP', res.statusCode, data);
        process.exit(1);
      }
      const json = JSON.parse(data);
      const b64 = json.data?.[0]?.b64_json;
      if (!b64) {
        console.error('No b64_json in response:', JSON.stringify(json, null, 2));
        process.exit(1);
      }
      const outDir = 'public/assets/ui/backgrounds';
      fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, `${outName}.png`);
      fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
      console.log(`Saved -> ${outPath}`);
      if (json.data?.[0]?.revised_prompt) {
        console.log('Revised prompt:', json.data[0].revised_prompt);
      }
    });
  },
);

req.on('error', (err) => {
  console.error('Request error:', err);
  process.exit(1);
});

req.write(body);
req.end();
