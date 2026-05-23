#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import sharp from 'sharp';

const apiKey = process.env.XAI_API_KEY;
if (!apiKey) {
  console.error('XAI_API_KEY env var not set');
  process.exit(1);
}

const [, , tileName, ...promptParts] = process.argv;
if (!tileName || promptParts.length === 0) {
  console.error('Usage: node scripts/generate-tile-grok.mjs <tileName> "<prompt>"');
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
      const outDir = 'verify-shots';
      fs.mkdirSync(outDir, { recursive: true });
      const rawPath = path.join(outDir, `${tileName}_grok_raw.png`);
      const outPath = path.join(outDir, `${tileName}_grok.png`);
      const buf = Buffer.from(b64, 'base64');
      fs.writeFileSync(rawPath, buf);
      const targetSize = Number(process.env.GROK_TILE_SIZE) || 256;
      sharp(buf, { unlimited: true })
        .resize(targetSize, targetSize, { kernel: sharp.kernel.nearest })
        .png({ compressionLevel: 9 })
        .toFile(outPath)
        .then(() => {
          console.log(`Saved raw 1024 -> ${rawPath}`);
          console.log(`Saved ${targetSize}x${targetSize} -> ${outPath}`);
          if (json.data?.[0]?.revised_prompt) {
            console.log('Revised prompt:', json.data[0].revised_prompt);
          }
        })
        .catch((err) => {
          console.error('Downscale failed:', err);
          process.exit(1);
        });
    });
  },
);

req.on('error', (err) => {
  console.error('Request error:', err);
  process.exit(1);
});

req.write(body);
req.end();
