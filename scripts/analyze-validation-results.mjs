#!/usr/bin/env node
// Aggregate full-combat sim results into balance signals for the analyst agents.
//
// Usage:
//   node scripts/analyze-validation-results.mjs <decks.json> <results1.json> [results2.json ...]
//
// Writes to tests/audit/val/analysis/:
//   enemy-summary.json     — per enemy: mean winRate/HP cushion/TTK/death+timeout rate, by archetype/class
//   archetype-summary.json — per archetype × stage: viability
//   boss-report.json       — per boss: every matchup, + doom_knight EASY-CHECK verdict
//   card-appearance.json   — per card: decks containing it + their aggregate performance, vs tier baseline
//   tier-ops-perf.json     — per tier: OPS distribution + how OPS correlates with deck performance
//   overview.json          — headline counts + flags

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const r = (p) => resolve(root, p);
const readJSON = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf-8'));

const [, , decksPath, ...resultPaths] = process.argv;
if (!decksPath || resultPaths.length === 0) {
  console.error('Usage: node scripts/analyze-validation-results.mjs <decks.json> <results1.json> [...]');
  process.exit(1);
}

const outDir = r('tests/audit/val/analysis');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const lib = readJSON(decksPath);
const decks = Array.isArray(lib) ? lib : lib.decks;
const deckById = Object.fromEntries(decks.map((d) => [d.id, d]));
const cardsIndex = readJSON('tests/audit/val/cards-index.json');
const cardById = Object.fromEntries(cardsIndex.map((c) => [c.id, c]));
const enemiesIndex = readJSON('tests/audit/val/enemies-index.json');
const enemyById = Object.fromEntries(enemiesIndex.map((e) => [e.id, e]));

// Merge all result files.
const results = [];
for (const p of resultPaths) {
  const j = readJSON(p);
  for (const m of (j.results ?? [])) results.push(m);
}

const deckIdOf = (matchupId) => matchupId.split('__vs__')[0];
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const round = (x, n = 3) => (x == null ? null : +x.toFixed(n));

// ── enemy-summary ──────────────────────────────────────────
const byEnemy = {};
for (const m of results) {
  const e = (byEnemy[m.enemy] ??= { enemy: m.enemy, isBoss: m.isBoss, rows: [] });
  e.rows.push(m);
}
const enemySummary = Object.values(byEnemy).map((e) => {
  const rows = e.rows;
  const winRates = rows.map((m) => m.winRate);
  const cushions = rows.map((m) => m.avgHeroHpPctOnWin).filter((x) => x != null);
  const ttks = rows.map((m) => m.avgTtkMs).filter((x) => x != null);
  const totalRepeats = rows.reduce((a, m) => a + (m.repeats ?? 0), 0);
  const totalDeaths = rows.reduce((a, m) => a + (m.deaths ?? 0), 0);
  const totalTimeouts = rows.reduce((a, m) => a + (m.timeouts ?? 0), 0);
  // by archetype + class
  const byArch = {};
  for (const m of rows) {
    const k = `${m.archetype ?? '?'}/${m.class ?? '?'}`;
    (byArch[k] ??= []).push(m.winRate);
  }
  const meta = enemyById[e.enemy] ?? {};
  return {
    enemy: e.enemy,
    name: meta.name,
    isBoss: e.isBoss,
    affinity: meta.affinity,
    behaviors: meta.behaviors,
    baseHP: meta.baseHP, baseDefense: meta.baseDefense, baseDamage: meta.damage,
    scaledHP: rows[0]?.enemyScaledHP, scaledDamage: rows[0]?.enemyScaledDamage, scaledDefense: rows[0]?.enemyScaledDefense,
    nMatchups: rows.length,
    meanWinRate: round(mean(winRates)),
    minWinRate: round(Math.min(...winRates)),
    meanHpCushionOnWin: round(mean(cushions)),
    meanTtkMs: ttks.length ? Math.round(mean(ttks)) : null,
    deathRate: round(totalDeaths / Math.max(1, totalRepeats)),
    timeoutRate: round(totalTimeouts / Math.max(1, totalRepeats)),
    nLossesMatchups: rows.filter((m) => m.winRate < 1).length,
    winRateByArchetype: Object.fromEntries(Object.entries(byArch).map(([k, v]) => [k, round(mean(v))])),
  };
}).sort((a, b) => a.meanWinRate - b.meanWinRate || a.meanHpCushionOnWin - b.meanHpCushionOnWin);

// ── archetype-summary (archetype × stage) ───────────────────
const byArchStage = {};
for (const m of results) {
  const k = `${m.archetype ?? '?'}__${m.stage ?? '?'}__${m.class ?? '?'}`;
  const a = (byArchStage[k] ??= { archetype: m.archetype, stage: m.stage, class: m.class, normal: [], boss: [] });
  (m.isBoss ? a.boss : a.normal).push(m);
}
const archetypeSummary = Object.values(byArchStage).map((a) => ({
  archetype: a.archetype, stage: a.stage, class: a.class,
  nNormal: a.normal.length, nBoss: a.boss.length,
  normalMeanWinRate: round(mean(a.normal.map((m) => m.winRate))),
  normalMeanCushion: round(mean(a.normal.map((m) => m.avgHeroHpPctOnWin).filter((x) => x != null))),
  bossMeanWinRate: round(mean(a.boss.map((m) => m.winRate))),
  bossMeanCushion: round(mean(a.boss.map((m) => m.avgHeroHpPctOnWin).filter((x) => x != null))),
  bossMatchups: a.boss.map((m) => ({ id: m.id, enemy: m.enemy, winRate: m.winRate, cushion: m.avgHeroHpPctOnWin, deaths: m.deaths, timeouts: m.timeouts })),
})).sort((a, b) => (a.normalMeanWinRate ?? 1) - (b.normalMeanWinRate ?? 1));

// ── build-quality × loop-band MATRIX (the v2 core) ──────────
// Loop bands per the "Moderate" acceptance target.
const BAND_OF = {
  loop2: '1-10', loop5: '1-10', loop8: '1-10', boss1: '1-10',
  loop15: '11-20', boss2: '11-20',
  loop25: '21-40', boss3: '21-40', boss4: '21-40',
  boss5: '41-60', boss6: '41-60',
  boss7: '61-70',
};
const BAND_ORDER = ['1-10', '11-20', '21-40', '41-60', '61-70'];
function qualityOf(deck) {
  if (deck && deck.quality) return deck.quality;
  if (!deck) return 'unknown';
  if (/^rand-/.test(deck.id) || deck.archetype === 'random' || deck.archetype === 'random-chaotic') return 'random';
  return 'mixed'; // v1 decks without an explicit tier
}
const matrixCells = {}; // band -> quality -> {normal:[], boss:[], bossCush:[], normCush:[]}
for (const m of results) {
  const d = deckById[deckIdOf(m.id)];
  const band = BAND_OF[m.stage] ?? m.stage;
  const q = qualityOf(d);
  const cell = ((matrixCells[band] ??= {})[q] ??= { normalWR: [], bossWR: [], bossCush: [], normCush: [], decks: new Set(), reshuffles: [] });
  if (d) cell.decks.add(d.id);
  cell.reshuffles.push(m.avgReshuffles ?? 0);
  if (m.isBoss) { cell.bossWR.push(m.winRate); if (m.avgHeroHpPctOnWin != null) cell.bossCush.push(m.avgHeroHpPctOnWin); }
  else { cell.normalWR.push(m.winRate); if (m.avgHeroHpPctOnWin != null) cell.normCush.push(m.avgHeroHpPctOnWin); }
}
const qualityMatrix = {};
for (const band of BAND_ORDER) {
  qualityMatrix[band] = {};
  for (const q of ['random', 'naive', 'optimized', 'mixed', 'unknown']) {
    const c = matrixCells[band]?.[q];
    if (!c) continue;
    qualityMatrix[band][q] = {
      nDecks: c.decks.size,
      nNormal: c.normalWR.length, nBoss: c.bossWR.length,
      normalWinRate: round(mean(c.normalWR)), normalCushion: round(mean(c.normCush)),
      bossWinRate: round(mean(c.bossWR)), bossCushion: round(mean(c.bossCush)),
      pctNoCycle: round(c.reshuffles.filter((x) => x < 1).length / Math.max(1, c.reshuffles.length)),
    };
  }
}

// ── boss-report (incl. doom_knight easy-check) ──────────────
const bossRows = results.filter((m) => m.isBoss);
const byBoss = {};
for (const m of bossRows) (byBoss[m.enemy] ??= []).push(m);
const bossReport = Object.entries(byBoss).map(([boss, rows]) => {
  const sorted = [...rows].sort((a, b) => a.winRate - b.winRate);
  return {
    boss,
    name: enemyById[boss]?.name,
    nDecks: rows.length,
    meanWinRate: round(mean(rows.map((m) => m.winRate))),
    fracDecksFullWin: round(rows.filter((m) => m.winRate >= 0.999).length / rows.length),
    fracDecksAnyLoss: round(rows.filter((m) => m.winRate < 1).length / rows.length),
    meanCushionOnWin: round(mean(rows.map((m) => m.avgHeroHpPctOnWin).filter((x) => x != null))),
    worst5: sorted.slice(0, 5).map((m) => ({ id: m.id, archetype: m.archetype, class: m.class, winRate: m.winRate, cushion: m.avgHeroHpPctOnWin, deaths: m.deaths, timeouts: m.timeouts })),
  };
});
const dk = byBoss['doom_knight'] ?? [];
const doomKnightCheck = {
  boss: 'doom_knight',
  intent: 'FIRST boss — should be EASY. Almost all builds (even weak) should win with cushion.',
  nDecks: dk.length,
  fracWin: round(dk.filter((m) => m.winRate >= 0.999).length / Math.max(1, dk.length)),
  fracAnyLoss: round(dk.filter((m) => m.winRate < 1).length / Math.max(1, dk.length)),
  meanCushionOnWin: round(mean(dk.map((m) => m.avgHeroHpPctOnWin).filter((x) => x != null))),
  losers: dk.filter((m) => m.winRate < 1).map((m) => ({ id: m.id, archetype: m.archetype, class: m.class, winRate: m.winRate, deaths: m.deaths, timeouts: m.timeouts })),
  verdict: dk.length === 0 ? 'NO DATA' : (dk.every((m) => m.winRate >= 0.999) ? 'PASS (all win)' : (dk.filter((m) => m.winRate < 1).length / dk.length <= 0.1 ? 'MOSTLY PASS (<=10% loss)' : 'FAIL (too many losses for an easy boss)')),
};

// ── card-appearance ─────────────────────────────────────────
// For each card, aggregate the performance of decks containing it.
const cardAgg = {};
for (const m of results) {
  const d = deckById[deckIdOf(m.id)];
  if (!d) continue;
  for (const cid of new Set(d.deck)) {
    const c = (cardAgg[cid] ??= { decks: new Set(), normalWR: [], bossWR: [], normalCushion: [] });
    c.decks.add(d.id);
    if (m.isBoss) c.bossWR.push(m.winRate);
    else { c.normalWR.push(m.winRate); if (m.avgHeroHpPctOnWin != null) c.normalCushion.push(m.avgHeroHpPctOnWin); }
  }
}
const cardAppearance = cardsIndex.map((c) => {
  const a = cardAgg[c.id];
  return {
    id: c.id, name: c.name, tier: c.tier, category: c.category, resource: c.resource,
    cost: c.costStr, cooldown: c.cooldown, peakOPS: c.peakOPS, archetypes: c.archetypes,
    nDecks: a ? a.decks.size : 0,
    nNormalMatchups: a ? a.normalWR.length : 0,
    meanNormalWinRate: a ? round(mean(a.normalWR)) : null,
    meanNormalCushion: a ? round(mean(a.normalCushion)) : null,
    meanBossWinRate: a ? round(mean(a.bossWR)) : null,
    covered: !!a,
  };
});
const uncovered = cardAppearance.filter((c) => !c.covered).map((c) => c.id);

// ── tier-ops-perf ───────────────────────────────────────────
const tierOps = {};
for (const c of cardAppearance) {
  if (c.peakOPS == null) continue;
  const t = (tierOps[c.tier] ??= { ops: [], cushions: [] });
  t.ops.push(c.peakOPS);
}
const tierOpsPerf = Object.fromEntries(Object.entries(tierOps).map(([t, v]) => {
  const sorted = [...v.ops].sort((a, b) => a - b);
  const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];
  return [t, { n: sorted.length, min: sorted[0], q25: q(0.25), median: q(0.5), q75: q(0.75), max: sorted[sorted.length - 1], mean: round(mean(sorted), 2) }];
}));

// ── overview ────────────────────────────────────────────────
const overview = {
  nResults: results.length,
  nDecks: decks.length,
  nEnemiesCovered: enemySummary.length,
  enemiesNotCovered: enemiesIndex.map((e) => e.id).filter((id) => !byEnemy[id]),
  cardsUncovered: uncovered,
  nCardsUncovered: uncovered.length,
  hardestEnemies: enemySummary.slice(0, 8).map((e) => ({ enemy: e.enemy, isBoss: e.isBoss, meanWinRate: e.meanWinRate, cushion: e.meanHpCushionOnWin, deathRate: e.deathRate, timeoutRate: e.timeoutRate })),
  easiestNormals: enemySummary.filter((e) => !e.isBoss).slice(-6).map((e) => ({ enemy: e.enemy, meanWinRate: e.meanWinRate, cushion: e.meanHpCushionOnWin, ttk: e.meanTtkMs })),
  doomKnightVerdict: doomKnightCheck.verdict,
};

writeFileSync(r('tests/audit/val/analysis/enemy-summary.json'), JSON.stringify(enemySummary, null, 2));
writeFileSync(r('tests/audit/val/analysis/archetype-summary.json'), JSON.stringify(archetypeSummary, null, 2));
writeFileSync(r('tests/audit/val/analysis/boss-report.json'), JSON.stringify({ doomKnightCheck, bossReport }, null, 2));
writeFileSync(r('tests/audit/val/analysis/card-appearance.json'), JSON.stringify(cardAppearance, null, 2));
writeFileSync(r('tests/audit/val/analysis/tier-ops-perf.json'), JSON.stringify(tierOpsPerf, null, 2));
writeFileSync(r('tests/audit/val/analysis/overview.json'), JSON.stringify(overview, null, 2));
writeFileSync(r('tests/audit/val/analysis/quality-matrix.json'), JSON.stringify(qualityMatrix, null, 2));

console.log(`Analyzed ${results.length} matchup results from ${decks.length} decks.`);
console.log('=== BUILD-QUALITY x LOOP-BAND MATRIX (bossWR/bossCushion | normalWR/normalCushion) ===');
for (const band of BAND_ORDER) {
  const row = qualityMatrix[band]; if (!row) continue;
  const parts = Object.entries(row).map(([q, v]) => `${q}[n${v.nDecks}]: boss ${v.bossWinRate ?? '-'}/${v.bossCushion ?? '-'} norm ${v.normalWinRate ?? '-'}/${v.normalCushion ?? '-'}`);
  console.log(`  ${band.padEnd(6)} | ${parts.join('  ||  ')}`);
}
console.log('doom_knight:', doomKnightCheck.verdict, `(${dk.length} decks, ${doomKnightCheck.fracWin} full-win, cushion ${doomKnightCheck.meanCushionOnWin})`);
console.log('uncovered cards:', uncovered.length, uncovered.length ? uncovered.slice(0, 20).join(',') : '');
console.log('hardest enemies:', overview.hardestEnemies.map((e) => `${e.enemy}(wr=${e.meanWinRate}${e.isBoss ? ',BOSS' : ''})`).join('  '));
