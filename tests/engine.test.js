// Unit-Tests für die Engine-Module (Phase 1 der Modularisierung, v3.34.0).
// Läuft in <1s ohne Browser: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ROWS, COLS, WALL_OF, CASTLE_OF, CASTLE_P1, CASTLE_P2, EMPTY, CANNON_HP } from '../src/engine/const.js';
import { SCRAP_WALL, SCRAP_CANNON, SCRAP_SURVIVE, SCRAP_REBUILD, SHOP } from '../src/engine/economy.js';
import { makeRng, castle3Positions, WORLD_THEMES, worldThemeOf, generateTerrainFromSeed, generateTerrain3FromSeed, buildSectorMap } from '../src/engine/terrain.js';
import { computeOutsideMap, isObjectClosed, isCastleClosed, closedCannons } from '../src/engine/flood.js';
import { getLevelTier, eloDelta, goldDelta, xpToNextLevel, computeXpGain, applyXpGain } from '../src/engine/progression.js';
import { COSMETICS, RECIPES, MASTER_TRAIL, CANNON_SKIN, IMPACT_FX, MAT_ORDER, cosOf, matOf } from '../src/engine/catalog.js';

// ── Progression ──────────────────────────────────────────────────────
test('eloDelta: gleiche Stärke, Sieg → +16 (K=32, erwartet 0.5)', () => {
  assert.equal(Math.round(eloDelta(1000, 1000, 1)), 16);
});
test('eloDelta: Nullsummen-Eigenschaft (Gewinn Sieger = Verlust Verlierer)', () => {
  const a = eloDelta(1100, 900, 1);
  const b = eloDelta(900, 1100, 0);
  assert.ok(Math.abs(a + b) < 1e-9, `${a} + ${b} != 0`);
});
test('eloDelta: Außenseiter-Sieg gibt mehr als Favoriten-Sieg', () => {
  assert.ok(eloDelta(900, 1300, 1) > eloDelta(1300, 900, 1));
});
test('goldDelta: immer im Rahmen 5..50', () => {
  for (const [me, opp] of [[1000, 1000], [800, 2000], [2000, 800], [1, 9999], [9999, 1]]) {
    const g = goldDelta(me, opp);
    assert.ok(g >= 5 && g <= 50, `goldDelta(${me},${opp}) = ${g}`);
  }
});
test('applyXpGain: Level-Aufstieg akkumuliert korrekt', () => {
  const { level, xp, levelsGained } = applyXpGain({ level: 1, xp: 0 }, xpToNextLevel(1) + xpToNextLevel(2) + 5);
  assert.equal(level, 3);
  assert.equal(xp, 5);
  assert.deepEqual(levelsGained, [2, 3]);
});
test('applyXpGain: robust bei fehlenden Feldern', () => {
  const r = applyXpGain({}, 10);
  assert.equal(r.level, 1);
  assert.equal(r.xp, 10);
});
test('getLevelTier: Stufengrenzen 10/25/50', () => {
  assert.equal(getLevelTier(1).name, 'silver');
  assert.equal(getLevelTier(10).name, 'gold');
  assert.equal(getLevelTier(25).name, 'platin');
  assert.equal(getLevelTier(50).name, 'legend');
});
test('computeXpGain: Sieg gibt mehr als Niederlage', () => {
  assert.ok(computeXpGain(true, 1000, [1000]) > computeXpGain(false, 1000, [1000]));
});

// ── Ökonomie ─────────────────────────────────────────────────────────
test('Schrott-Werte positiv, Kanonen-Kill lohnt sich gegen Mauerbau', () => {
  assert.ok(SCRAP_WALL > 0 && SCRAP_CANNON > 0 && SCRAP_SURVIVE > 0 && SCRAP_REBUILD > 0);
  assert.ok(SCRAP_CANNON > SCRAP_WALL, 'Kanonen-Kill muss mehr geben als 1 Mauer');
});
test('SHOP: Nachlade-Faktoren streng fallend, Preise positiv', () => {
  const f = SHOP.reload.factors;
  for (let i = 1; i < f.length; i++) assert.ok(f[i] < f[i - 1], `Faktor ${i} nicht kleiner`);
  assert.ok(SHOP.cannon.base > 0 && SHOP.cannon.step > 0 && SHOP.armor.price > 0 && SHOP.repair.base > 0);
});
test('CANNON_HP im spielbaren Rahmen (Playtest-Balancing v3.31.0)', () => {
  assert.ok(CANNON_HP >= 4 && CANNON_HP <= 30);
});

// ── Terrain (Determinismus = Online-Sync-Garantie) ───────────────────
test('makeRng: deterministisch pro Seed, verschieden je Seed', () => {
  const a = makeRng(42), b = makeRng(42), c = makeRng(43);
  const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  for (const v of sa) assert.ok(v >= 0 && v < 1);
});
test('generateTerrainFromSeed: identisches Terrain bei identischem Seed', () => {
  const t1 = generateTerrainFromSeed(1234), t2 = generateTerrainFromSeed(1234);
  assert.deepEqual(t1.grid, t2.grid);
  assert.deepEqual(t1.borderRow, t2.borderRow);
  const t3 = generateTerrainFromSeed(9999);
  assert.notDeepEqual(t1.grid, t3.grid);
});
test('generateTerrain3FromSeed: deterministisch + Sektor-Map deterministisch', () => {
  const t1 = generateTerrain3FromSeed(777), t2 = generateTerrain3FromSeed(777);
  assert.deepEqual(t1.grid, t2.grid);
  const pos = castle3Positions();
  const s1 = buildSectorMap({ ...t1, seed: 777 }, pos);
  const s2 = buildSectorMap({ ...t2, seed: 777 }, pos);
  assert.deepEqual(s1, s2);
});
test('worldThemeOf: stabil und immer ein gültiges Thema', () => {
  for (const seed of [0, 1, 7, 4294967295, 123456]) {
    const th = worldThemeOf(seed);
    assert.ok(WORLD_THEMES.includes(th), `Seed ${seed} → kein Thema`);
    assert.equal(th, worldThemeOf(seed));
  }
});
test('castle3Positions: 3 Burgen, im Feld, paarweise verschieden', () => {
  const pos = castle3Positions();
  for (const p of [1, 2, 3]) {
    assert.ok(pos[p].r >= 0 && pos[p].r < ROWS && pos[p].c >= 0 && pos[p].c < COLS);
  }
  assert.notDeepEqual(pos[1], pos[2]);
  assert.notDeepEqual(pos[2], pos[3]);
});

// ── Flood-Fill (Kern-Spielregel: Burg umschlossen?) ──────────────────
function emptyGrid() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(EMPTY));
}
function ringAround(g, r, c, dist, wall) {
  for (let dr = -dist; dr <= dist; dr++)
    for (let dc = -dist; dc <= dist; dc++)
      if (Math.max(Math.abs(dr), Math.abs(dc)) === dist) g[r + dr][c + dc] = wall;
}
test('isCastleClosed: offene Burg = false, ummauerte Burg = true', () => {
  const g = emptyGrid();
  g[CASTLE_P1.r][CASTLE_P1.c] = CASTLE_OF[1];
  assert.equal(isCastleClosed(g, 1, CASTLE_P1), false, 'offene Burg gilt als geschlossen');
  ringAround(g, CASTLE_P1.r, CASTLE_P1.c, 2, WALL_OF[1]);
  assert.equal(isCastleClosed(g, 1, CASTLE_P1), true, 'ummauerte Burg gilt als offen');
});
test('isCastleClosed: EIN Loch im Ring macht die Burg offen', () => {
  const g = emptyGrid();
  g[CASTLE_P1.r][CASTLE_P1.c] = CASTLE_OF[1];
  ringAround(g, CASTLE_P1.r, CASTLE_P1.c, 2, WALL_OF[1]);
  g[CASTLE_P1.r - 2][CASTLE_P1.c] = EMPTY; // Loch oben
  assert.equal(isCastleClosed(g, 1, CASTLE_P1), false);
});
test('Regression v1.0.6: gegnerische Mauern zählen NICHT als eigener Schutz', () => {
  const g = emptyGrid();
  g[CASTLE_P1.r][CASTLE_P1.c] = CASTLE_OF[1];
  ringAround(g, CASTLE_P1.r, CASTLE_P1.c, 2, WALL_OF[2]); // Ring aus GEGNER-Mauern
  assert.equal(isCastleClosed(g, 1, CASTLE_P1), false);
});
test('closedCannons: nur ummauerte Kanonen sind schussbereit', () => {
  const g = emptyGrid();
  const c1 = { r: CASTLE_P2.r, c: CASTLE_P2.c - 8, id: 1, hp: CANNON_HP };
  const c2 = { r: CASTLE_P2.r, c: CASTLE_P2.c + 8, id: 2, hp: CANNON_HP };
  ringAround(g, c1.r, c1.c, 2, WALL_OF[2]); // nur c1 ummauern
  const ready = closedCannons(g, 2, [c1, c2]);
  assert.deepEqual(ready.map((x) => x.id), [1]);
});

// ── Kataloge (Schmiede + Gold-Shop) ──────────────────────────────────
test('RECIPES: IDs eindeutig, Kosten positiv, Kategorien bekannt', () => {
  const ids = RECIPES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'doppelte Rezept-ID');
  for (const r of RECIPES) {
    assert.ok(['cannon', 'impact', 'trail'].includes(r.cat), r.id);
    const total = Object.values(r.cost).reduce((a, b) => a + b, 0);
    assert.ok(total > 0, r.id + ' ohne Kosten');
    for (const k of Object.keys(r.cost)) assert.ok([...MAT_ORDER, 'gold'].includes(k), r.id + ' unbekannte Zutat ' + k);
  }
});
test('RECIPES: Meister-Trails referenzieren existierende Shop-Basis-Trails', () => {
  const shopTrailIds = COSMETICS.trail.map((t) => t.id);
  for (const r of RECIPES.filter((x) => x.base)) {
    assert.ok(shopTrailIds.includes(r.base), `${r.id}: Basis ${r.base} nicht im Shop`);
    assert.ok(MASTER_TRAIL[r.id], `${r.id}: kein MASTER_TRAIL-Rendering`);
  }
});
test('RECIPES: jede Kanonen-/Einschlag-ID hat Render-Definition', () => {
  for (const r of RECIPES.filter((x) => x.cat === 'cannon')) assert.ok(CANNON_SKIN[r.id], r.id);
  for (const r of RECIPES.filter((x) => x.cat === 'impact')) assert.ok(IMPACT_FX[r.id], r.id);
});
test('cosOf/matOf: normalisieren defensive Defaults', () => {
  const c = cosOf(null);
  assert.deepEqual(c.owned, []);
  assert.equal(c.equipped.trail, 'trail_standard');
  assert.equal(c.equipped.cannon, 'cannon_standard');
  assert.equal(c.equipped.impact, 'impact_standard');
  assert.deepEqual(matOf(undefined), { iron: 0, silver: 0, dragon: 0, star: 0 });
  assert.equal(matOf({ materials: { iron: 7 } }).iron, 7);
});
test('COSMETICS: pro Kategorie genau ein Gratis-Artikel (Standard)', () => {
  for (const cat of Object.keys(COSMETICS)) {
    assert.equal(COSMETICS[cat].filter((it) => it.price === 0).length, 1, cat);
  }
});
