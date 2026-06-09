// Adversarial diversity probe: per band x quality, compute class/archetype/element spread
// of the decks that actually fed each matrix cell (via results matchup IDs, same as analyzer).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const readJSON = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf-8'));

const lib = readJSON('tests/audit/val/decks-v2-full.json');
const decks = Array.isArray(lib) ? lib : lib.decks;
const deckById = Object.fromEntries(decks.map((d) => [d.id, d]));
const cardsIndex = readJSON('tests/audit/val/cards-index.json');
const cardById = Object.fromEntries(cardsIndex.map((c) => [c.id, c]));
const res = readJSON('tests/audit/val/results-v2.json');
const results = res.results;

const BAND_OF = {
  loop2: '1-10', loop5: '1-10', loop8: '1-10', boss1: '1-10',
  loop15: '11-20', boss2: '11-20',
  loop25: '21-40', boss3: '21-40', boss4: '21-40',
  boss5: '41-60', boss6: '41-60',
  boss7: '61-70',
};
const BAND_ORDER = ['1-10', '11-20', '21-40', '41-60', '61-70'];
const deckIdOf = (id) => id.split('__vs__')[0];
function qualityOf(deck) {
  if (deck && deck.quality) return deck.quality;
  if (!deck) return 'unknown';
  if (/^rand-/.test(deck.id) || deck.archetype === 'random' || deck.archetype === 'random-chaotic') return 'random';
  return 'mixed';
}

// Dominant element of a deck = element appearing most across cards' elements arrays.
function deckElements(deck) {
  const counts = {};
  for (const cid of deck.deck) {
    const c = cardById[cid];
    if (!c) continue;
    for (const el of (c.elements || [])) counts[el] = (counts[el] || 0) + 1;
  }
  return counts;
}

// Collect unique decks per band x quality (matches matrix decks set).
const cells = {}; // band -> quality -> Set(deckId)
for (const m of results) {
  const d = deckById[deckIdOf(m.id)];
  if (!d) continue;
  const band = BAND_OF[m.stage] ?? m.stage;
  const q = qualityOf(d);
  ((cells[band] ??= {})[q] ??= new Set()).add(d.id);
}

function tally(arr) {
  const t = {};
  for (const x of arr) t[x] = (t[x] || 0) + 1;
  return t;
}
function shannon(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return 0;
  let h = 0;
  for (const v of Object.values(counts)) { const p = v / total; h -= p * Math.log2(p); }
  return h;
}
function maxFrac(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return 0;
  return Math.max(...Object.values(counts)) / total;
}
const pct = (t) => {
  const tot = Object.values(t).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(t).sort((a,b)=>b[1]-a[1]).map(([k,v]) => [k, `${v} (${Math.round(100*v/tot)}%)`]));
};

console.log('=== BUILD DIVERSITY per BAND x QUALITY (unique decks) ===\n');
for (const band of BAND_ORDER) {
  for (const q of ['random', 'naive', 'optimized', 'mixed']) {
    const set = cells[band]?.[q];
    if (!set) continue;
    const ds = [...set].map((id) => deckById[id]);
    const classes = tally(ds.map((d) => d.class));
    const arches = tally(ds.map((d) => d.archetype));
    // element spread: sum per-deck element counts, then which element dominates each deck
    const elemAgg = {};
    const deckDomElem = [];
    for (const d of ds) {
      const ec = deckElements(d);
      for (const [k, v] of Object.entries(ec)) elemAgg[k] = (elemAgg[k] || 0) + v;
      const top = Object.entries(ec).sort((a,b)=>b[1]-a[1])[0];
      deckDomElem.push(top ? top[0] : 'none');
    }
    const domElemTally = tally(deckDomElem);
    console.log(`[${band}] ${q}  (nDecks=${ds.length})`);
    console.log(`   class:      ${JSON.stringify(pct(classes))}  | classMaxFrac=${maxFrac(classes).toFixed(2)} H=${shannon(classes).toFixed(2)}`);
    console.log(`   archetype:  ${JSON.stringify(pct(arches))}  | #arch=${Object.keys(arches).length} archMaxFrac=${maxFrac(arches).toFixed(2)} H=${shannon(arches).toFixed(2)}`);
    console.log(`   domElement: ${JSON.stringify(pct(domElemTally))}  | elemMaxFrac=${maxFrac(domElemTally).toFixed(2)} H=${shannon(domElemTally).toFixed(2)}`);
    console.log('');
  }
}

// Global per-quality class/archetype distribution (across all bands)
console.log('=== GLOBAL per-QUALITY (all bands pooled, unique decks) ===\n');
const globalQ = {};
for (const d of decks) {
  const q = qualityOf(d);
  (globalQ[q] ??= []).push(d);
}
for (const q of Object.keys(globalQ)) {
  const ds = globalQ[q];
  console.log(`${q}: nDecks=${ds.length}`);
  console.log(`   class:     ${JSON.stringify(pct(tally(ds.map(d=>d.class))))}`);
  console.log(`   archetype: ${JSON.stringify(pct(tally(ds.map(d=>d.archetype))))}`);
  console.log('');
}

// Cross-check: which quality cells are entirely single-class?
console.log('=== SINGLE-CLASS / SINGLE-ARCHETYPE CELLS (potential bias) ===');
for (const band of BAND_ORDER) {
  for (const q of ['random', 'naive', 'optimized', 'mixed']) {
    const set = cells[band]?.[q];
    if (!set) continue;
    const ds = [...set].map((id) => deckById[id]);
    const cl = tally(ds.map(d=>d.class));
    const ar = tally(ds.map(d=>d.archetype));
    const flags = [];
    if (Object.keys(cl).length === 1) flags.push(`SINGLE-CLASS(${Object.keys(cl)[0]})`);
    if (maxFrac(cl) >= 0.8) flags.push(`class>=80%(${Object.entries(cl).sort((a,b)=>b[1]-a[1])[0][0]})`);
    if (Object.keys(ar).length === 1) flags.push(`SINGLE-ARCH(${Object.keys(ar)[0]})`);
    if (flags.length) console.log(`  [${band}] ${q} n=${ds.length}: ${flags.join(', ')}`);
  }
}
