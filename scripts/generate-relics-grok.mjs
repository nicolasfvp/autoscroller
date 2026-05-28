#!/usr/bin/env node
// Generate relic art via Grok Imagine, 4 concurrent.
// Reads scripts/relic-prompts.json and writes public/assets/relics/<id>.png.

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const apiKey = process.env.XAI_API_KEY;
if (!apiKey) {
  console.error('XAI_API_KEY env var not set');
  process.exit(1);
}

const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const MODEL = process.env.GROK_IMAGE_MODEL || 'grok-imagine-image';
const OUT_DIR = process.env.RELIC_OUT_DIR || 'public/assets/relics';
const PROMPTS_FILE = process.env.RELIC_PROMPTS || 'scripts/relic-prompts.json';

fs.mkdirSync(OUT_DIR, { recursive: true });

function requestOne(id, prompt, attempt = 1) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, prompt, n: 1, response_format: 'b64_json' });
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
        timeout: 120_000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            const retriable = res.statusCode === 429 || res.statusCode >= 500;
            if (retriable && attempt < 3) {
              const wait = 1500 * attempt;
              return setTimeout(() => requestOne(id, prompt, attempt + 1).then(resolve, reject), wait);
            }
            return reject(new Error(`HTTP ${res.statusCode} ${data.slice(0, 300)}`));
          }
          try {
            const json = JSON.parse(data);
            const b64 = json.data?.[0]?.b64_json;
            if (!b64) return reject(new Error('No b64_json in response'));
            const outPath = path.join(OUT_DIR, `${id}.png`);
            fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
            resolve(outPath);
          } catch (err) { reject(err); }
        });
      },
    );
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (err) => {
      if (attempt < 3) {
        const wait = 1500 * attempt;
        return setTimeout(() => requestOne(id, prompt, attempt + 1).then(resolve, reject), wait);
      }
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  const list = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf8'));
  let idx = 0;
  let done = 0;
  let failed = 0;
  const total = list.length;
  const errors = [];
  const startedAt = Date.now();

  async function worker(workerId) {
    while (true) {
      const i = idx++;
      if (i >= list.length) return;
      const item = list[i];
      const t0 = Date.now();
      try {
        await requestOne(item.id, item.prompt);
        done++;
        const ms = Date.now() - t0;
        console.log(`[w${workerId}] OK ${done + failed}/${total} (${ms}ms) -> ${item.id}.png`);
      } catch (err) {
        failed++;
        errors.push({ id: item.id, error: err.message });
        console.error(`[w${workerId}] FAIL ${done + failed}/${total} ${item.id}: ${err.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
  const dur = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nDone in ${dur}s — ${done} ok, ${failed} failed.`);
  if (errors.length) {
    fs.writeFileSync('scripts/relic-generation-errors.json', JSON.stringify(errors, null, 2));
    console.log('Errors logged to scripts/relic-generation-errors.json');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
