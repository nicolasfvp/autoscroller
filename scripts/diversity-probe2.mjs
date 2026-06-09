// Does class skew bias per-quality cushion? Compare warrior vs mage boss cushion within each quality,
// and check whether the naive/optimized 61/39 mage skew could move the headline cushion numbers.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const readJSON = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf-8'));

const lib = readJSON('tests/audit/val/decks-v2-full.json');
const decks = Array.isArray(lib) ? lib : lib.decks;
const deckById = Object.fromEntries(decks.map((d) => [d.id, d]));
const results = readJSON('tests/audit/val/results-v2.json').results;
const deckIdOf = (id) => id.split('__vs__')[0];
function qualityOf(d){ if(d&&d.quality) return d.quality; if(!d) return 'unknown'; if(/^rand-/.test(d.id)||d.archetype==='random'||d.archetype==='random-chaotic') return 'random'; return 'mixed'; }
const mean = (a) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;

// boss cushion by quality x class
const cell = {};
for (const m of results) {
  if (!m.isBoss) continue;
  const d = deckById[deckIdOf(m.id)];
  if (!d) continue;
  const q = qualityOf(d);
  const k = `${q}/${d.class}`;
  (cell[k] ??= { wr: [], cush: [] });
  cell[k].wr.push(m.winRate);
  if (m.avgHeroHpPctOnWin != null) cell[k].cush.push(m.avgHeroHpPctOnWin);
}
console.log('=== BOSS winRate / cushion by QUALITY x CLASS ===');
for (const k of Object.keys(cell).sort()) {
  const c = cell[k];
  console.log(`  ${k.padEnd(18)} n=${String(c.wr.length).padStart(3)}  WR=${mean(c.wr).toFixed(3)}  cush=${(mean(c.cush)??NaN).toFixed(3)}`);
}

// Counterfactual: re-weight naive/optimized boss cushion to a 50/50 class mix and see if it moves.
console.log('\n=== COUNTERFACTUAL: re-weight naive/optimized to 50/50 class vs observed 61/39 ===');
for (const q of ['random','naive','optimized','mixed']) {
  const w = cell[`${q}/warrior`], m = cell[`${q}/mage`];
  if (!w || !m) continue;
  const wC = mean(w.cush), mC = mean(m.cush);
  const nW = w.cush.length, nM = m.cush.length;
  const observed = (wC*nW + mC*nM)/(nW+nM);
  const balanced = (wC + mC)/2;
  console.log(`  ${q.padEnd(10)} warriorCush=${wC.toFixed(3)} mageCush=${mC.toFixed(3)} | observedPooled=${observed.toFixed(3)} (n=${nW+nM}, ${Math.round(100*nW/(nW+nM))}%war) -> 50/50=${balanced.toFixed(3)} delta=${(balanced-observed).toFixed(3)}`);
}

// Element coverage check: do any elements never appear as a deck's dominant element in the random tier?
const cardsIndex = readJSON('tests/audit/val/cards-index.json');
const cardById = Object.fromEntries(cardsIndex.map(c=>[c.id,c]));
const allElems = new Set();
for (const c of cardsIndex) for (const e of (c.elements||[])) allElems.add(e);
console.log('\n=== ELEMENT UNIVERSE ===', [...allElems].sort().join(', '));
