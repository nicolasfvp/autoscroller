#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import sharp from 'sharp';
import { TILE_PROMPTS } from './tile-prompts.mjs';

const apiKey = process.env.XAI_API_KEY;
if (!apiKey) {
  console.error('XAI_API_KEY env var not set');
  process.exit(1);
}

const model = process.env.GROK_IMAGE_MODEL || 'grok-imagine-image-quality';
const targetSize = Number(process.env.GROK_TILE_SIZE) || 256;
const concurrency = Number(process.env.GROK_CONCURRENCY) || 2;
const outDir = 'verify-shots';
fs.mkdirSync(outDir, { recursive: true });

// Parse tile selection: comma-separated names, or "all" to process every
// prompt in the manifest, or "missing" to skip ones already on disk.
const selection = (process.argv[2] || 'all').toLowerCase();
const allNames = Object.keys(TILE_PROMPTS);
let names;
if (selection === 'all') {
  names = allNames;
} else if (selection === 'missing') {
  names = allNames.filter(
    (n) => !fs.existsSync(path.join(outDir, `${n}_grok.png`)),
  );
} else {
  names = selection.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = names.filter((n) => !TILE_PROMPTS[n]);
  if (unknown.length) {
    console.error('Unknown tile names:', unknown.join(', '));
    process.exit(1);
  }
}

console.log(
  `Model: ${model}  Concurrency: ${concurrency}  Target: ${targetSize}x${targetSize}`,
);
console.log(`Generating ${names.length} tile(s): ${names.join(', ')}\n`);

function generateOne(name) {
  return new Promise((resolve) => {
    const prompt = TILE_PROMPTS[name];
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
        res.on('data', (c) => (data += c));
        res.on('end', async () => {
          if (res.statusCode >= 400) {
            console.error(`  [${name}] HTTP ${res.statusCode}: ${data}`);
            resolve({ name, ok: false, err: `HTTP ${res.statusCode}` });
            return;
          }
          try {
            const json = JSON.parse(data);
            const b64 = json.data?.[0]?.b64_json;
            if (!b64) {
              console.error(`  [${name}] no b64_json`);
              resolve({ name, ok: false, err: 'no b64' });
              return;
            }
            const buf = Buffer.from(b64, 'base64');
            const rawPath = path.join(outDir, `${name}_grok_raw.png`);
            const outPath = path.join(outDir, `${name}_grok.png`);
            fs.writeFileSync(rawPath, buf);
            await sharp(buf, { unlimited: true })
              .resize(targetSize, targetSize, { kernel: sharp.kernel.nearest })
              .png({ compressionLevel: 9 })
              .toFile(outPath);
            console.log(`  [${name}] OK -> ${outPath}`);
            resolve({ name, ok: true });
          } catch (err) {
            console.error(`  [${name}] parse/sharp error: ${err.message}`);
            resolve({ name, ok: false, err: err.message });
          }
        });
      },
    );
    req.on('error', (err) => {
      console.error(`  [${name}] req error: ${err.message}`);
      resolve({ name, ok: false, err: err.message });
    });
    req.write(body);
    req.end();
  });
}

async function runPool(items, limit, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]);
    }
  });
  await Promise.all(runners);
  return results;
}

const start = Date.now();
const results = await runPool(names, concurrency, generateOne);
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
const ok = results.filter((r) => r.ok).length;
const fail = results.length - ok;
console.log(
  `\nDone in ${elapsed}s — ${ok} OK, ${fail} failed.${
    fail ? '\nFailed: ' + results.filter((r) => !r.ok).map((r) => r.name).join(', ') : ''
  }`,
);
process.exit(fail ? 1 : 0);
