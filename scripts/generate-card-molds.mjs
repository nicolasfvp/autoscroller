#!/usr/bin/env node
// Generates two blank card-mold mockups via xAI Grok image API.
// Outputs:
//   card/mold_small.png  -- standard (small) face
//   card/mold_full.png   -- expanded (popup) face

import fs from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.XAI_API_KEY;
if (!API_KEY) {
  console.error('Set XAI_API_KEY before running this script.');
  process.exit(1);
}
const ENDPOINT = 'https://api.x.ai/v1/images/generations';
const MODEL = 'grok-imagine-image';
const OUT_DIR = 'card';

const PROMPT_SMALL = `
Blank card template mockup in the authentic visual style of Slay the
Spire's card frames: warm dark leather aesthetic with parchment accents,
flat vector, NO pixel art, NO illustration, NO text. Portrait orientation.

Color palette (strict, do not deviate):
- Outer card body background: warm dark slate brown #241f1a (aged leather).
- Outer rounded-rectangle border: muted bronze #8a7548, 2px stroke, 10px
  corner radius. Subtle warmth, not gray.
- Header band background: #2e2620 (slightly lighter than body).
- Art slot background: very dark warm #0d0a08, inner 1px stroke #5a4a30.
- Name banner background: parchment cream #d4c5a0 (a LIGHT strip, like
  Slay the Spire's title scrolls). Thin top/bottom dividers #6b5a3a.
- All slot outlines and dividers: muted bronze #8a7548 at 1px.

The template is EMPTY -- show only the structural frame and slot zones.
Do not draw any text, icons, gems, or art inside the slots.

Top header band (h ~14% of card height): three reserved slots side by
side, separated by thin vertical bronze dividers:
- LEFT SLOT (square, ~22% width): empty rounded square outline for a
  large primary cost gem.
- CENTER SLOT (~46% width): empty horizontal rectangular strip for a
  responsive row of 1-4 secondary cost icons.
- RIGHT SLOT (square, ~22% width): empty rounded rectangle outline for
  a cooldown badge.
Thin horizontal bronze divider line below the header.

Art zone (~58% of card height): the dark warm rectangular slot, 8px side
margins, full-width sized.

Bottom name banner (h ~15%): the parchment-cream horizontal strip
spanning full card width, between two bronze dividers. No text drawn.

Style notes: completely flat, no gradients, no shadows, no ornaments, no
filigree. Sober Slay-the-Spire card aesthetic -- warm dark leather body
with a bright parchment name banner for contrast. Background outside the
card border should be transparent or pure black.

Render as a clean PNG mockup of the empty card frame.
`.trim();

const PROMPT_FULL = `
Blank expanded card template mockup in the authentic visual style of
Slay the Spire's card frames: warm dark leather aesthetic with parchment
accents, flat vector, NO pixel art, NO illustration, NO text. Portrait
orientation, taller than the standard card.

Color palette (strict, do not deviate):
- Outer card body background: warm dark slate brown #241f1a (aged leather).
- Outer rounded-rectangle border: muted bronze #8a7548, 2px stroke, 10px
  corner radius.
- Header band background: #2e2620.
- Art slot background: very dark warm #0d0a08, inner 1px stroke #5a4a30.
- Name banner background: parchment cream #d4c5a0 (a LIGHT strip, like
  Slay the Spire's title scrolls). Thin top/bottom dividers #6b5a3a.
- Description panel background: warm dark #2e2620 with thin border #6b5a3a.
- All slot outlines and dividers: muted bronze #8a7548 at 1px.

The template is EMPTY -- show only the structural frame and slot zones.
Do not draw any text, icons, gems, or art inside the slots.

Top header band (identical to the small card): three reserved slots side
by side, separated by thin vertical bronze dividers:
- LEFT SLOT (square): empty rounded square outline for primary cost gem.
- CENTER SLOT (wide): empty horizontal strip for 1-4 secondary cost icons.
- RIGHT SLOT (square): empty rounded rectangle for cooldown badge.
Thin horizontal bronze divider below the header.

Art zone (~42% of card height): the dark warm rectangular slot, 8px side
margins.

Name banner (h ~8%): the parchment-cream horizontal strip, thin bronze
top/bottom dividers.

Element row (h ~7%): a row of three small empty circular slots (diameter
~30px), evenly spaced and centered horizontally. Thin 1px bronze outline
on each circle. Placeholders for element badges (1 to 3 max).

Description block (h ~22%): the warm dark recessed rectangular panel with
thin bronze border and 6px side margins. Empty interior reserved for
prose description text and inline icon tokens.

Footer strip (h ~6%): a thin horizontal band with a faint top bronze
divider, reserved for a centered "category" label. No text drawn.

Style notes: completely flat, no gradients, no shadows, no ornaments, no
filigree. Sober Slay-the-Spire card aesthetic -- warm dark leather body
with a bright parchment name banner for contrast. Background outside the
card border should be transparent or pure black.

Render as a clean PNG mockup of the empty expanded card frame.
`.trim();

async function callApi(prompt) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      n: 1,
      response_format: 'url',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API HTTP ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (!json.data || !json.data[0]?.url) {
    throw new Error(`No data: ${JSON.stringify(json)}`);
  }
  return json.data[0].url;
}

async function download(url, outPath) {
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`Download HTTP ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  await fs.writeFile(outPath, buf);
  return outPath;
}

async function generate(name, prompt) {
  console.log(`Generating ${name}...`);
  const url = await callApi(prompt);
  const outPath = path.join(OUT_DIR, `${name}.png`);
  await download(url, outPath);
  console.log(`  -> ${outPath}`);
  return outPath;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const [small, full] = await Promise.allSettled([
    generate('mold_small', PROMPT_SMALL),
    generate('mold_full', PROMPT_FULL),
  ]);
  if (small.status === 'rejected') console.error('mold_small FAILED:', small.reason?.message ?? small.reason);
  if (full.status === 'rejected')  console.error('mold_full FAILED:', full.reason?.message ?? full.reason);
  if (small.status === 'rejected' || full.status === 'rejected') process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
