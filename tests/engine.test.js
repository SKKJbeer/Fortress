// Unit-Tests für die Engine-Module (Phase 1 der Modularisierung, v3.34.0).
// Läuft in <1s ohne Browser: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ROWS, COLS, WALL_OF, CASTLE_OF, CASTLE_P1, CASTLE_P2, EMPTY, CANNON_HP } from '../src/engine/const.js';
import { SCRAP_WALL, SCRAP_CANNON, SCRAP_SURVIVE, SCRAP_REBUILD, SHOP } from '../src/engine/economy.js';
import { makeRng, castle3Positions, WORLD_THEMES, worldThemeOf, generateTerrainFromSeed, generateTerrain3FromSeed, buildSectorMap } from '../src/engine/terrain.js';
import { computeOutsideMap, isObjectClosed, isCastleClosed, closedCannons } from '../src/engine/flood.js';
import { getLevelTier, eloDelta, goldDelta, xpToNextLevel, computeXpGain, applyXpGain, isLegacyKey, dropMigratedDupes } from '../src/engine/progression.js';
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

// ── Leck-Pfad (v3.37.0) ──────────────────────────────────────────────
import { findLeakPath } from '../src/engine/flood.js';
test('findLeakPath: dichte Burg → null', () => {
  const g = emptyGrid();
  g[CASTLE_P1.r][CASTLE_P1.c] = CASTLE_OF[1];
  ringAround(g, CASTLE_P1.r, CASTLE_P1.c, 2, WALL_OF[1]);
  assert.equal(findLeakPath(g, 1, CASTLE_P1), null);
});
test('findLeakPath: EIN Loch → Pfad führt exakt durch die Loch-Zelle', () => {
  const g = emptyGrid();
  g[CASTLE_P1.r][CASTLE_P1.c] = CASTLE_OF[1];
  ringAround(g, CASTLE_P1.r, CASTLE_P1.c, 2, WALL_OF[1]);
  const hole = [CASTLE_P1.r - 2, CASTLE_P1.c];
  g[hole[0]][hole[1]] = EMPTY;
  const path = findLeakPath(g, 1, CASTLE_P1);
  assert.ok(path && path.length > 2, 'kein Pfad trotz Loch');
  assert.ok(path.some(([r, c]) => r === hole[0] && c === hole[1]), 'Pfad geht nicht durchs Loch');
  // beginnt an der Burg, endet am Feldrand
  assert.deepEqual(path[0], [CASTLE_P1.r, CASTLE_P1.c]);
  const [er, ec] = path[path.length - 1];
  assert.ok(er === 0 || er === ROWS - 1 || ec === 0 || ec === COLS - 1, 'Ende nicht am Rand');
});
test('findLeakPath: offene Burg ohne Mauern → Pfad existiert', () => {
  const g = emptyGrid();
  g[CASTLE_P1.r][CASTLE_P1.c] = CASTLE_OF[1];
  const path = findLeakPath(g, 1, CASTLE_P1);
  assert.ok(path && path.length > 0);
});
test('findLeakPath: GEGNER-Mauern blockieren den Pfad nicht (konsistent zu Regel v1.0.6)', () => {
  const g = emptyGrid();
  g[CASTLE_P1.r][CASTLE_P1.c] = CASTLE_OF[1];
  ringAround(g, CASTLE_P1.r, CASTLE_P1.c, 2, WALL_OF[2]);
  assert.ok(findLeakPath(g, 1, CASTLE_P1), 'Gegner-Ring darf nicht dichten');
});

// ── Loch-Zellen per Probe-Zumauern (v3.37.3) ─────────────────────────
import { findSealCells } from '../src/engine/flood.js';
const cellSet = (cells) => new Set(cells.map(([r, c]) => r + '_' + c));
test('findSealCells: 1er-Loch → markiert EXAKT diese eine Zelle', () => {
  const g = emptyGrid();
  g[CASTLE_P1.r][CASTLE_P1.c] = CASTLE_OF[1];
  ringAround(g, CASTLE_P1.r, CASTLE_P1.c, 2, WALL_OF[1]);
  const hole = [CASTLE_P1.r - 2, CASTLE_P1.c];
  g[hole[0]][hole[1]] = EMPTY;
  const seal = findSealCells(g, 1, CASTLE_P1);
  assert.deepEqual([...cellSet(seal)], [hole[0] + '_' + hole[1]], JSON.stringify(seal));
});
test('findSealCells: 3er-Loch (Beschuss-Beispiel) → GENAU die 3 Loch-Zellen', () => {
  const g = emptyGrid();
  g[CASTLE_P1.r][CASTLE_P1.c] = CASTLE_OF[1];
  ringAround(g, CASTLE_P1.r, CASTLE_P1.c, 2, WALL_OF[1]);
  const holes = [[CASTLE_P1.r - 2, CASTLE_P1.c - 1], [CASTLE_P1.r - 2, CASTLE_P1.c], [CASTLE_P1.r - 2, CASTLE_P1.c + 1]];
  for (const [r, c] of holes) g[r][c] = EMPTY;
  const seal = findSealCells(g, 1, CASTLE_P1);
  assert.equal(seal.length, 3, 'erwartet exakt 3 Zellen, bekam ' + JSON.stringify(seal));
  assert.deepEqual(cellSet(seal), cellSet(holes), JSON.stringify(seal));
});
test('findSealCells: nach Zumauern der markierten Zellen ist die Burg dicht', () => {
  const g = emptyGrid();
  g[CASTLE_P1.r][CASTLE_P1.c] = CASTLE_OF[1];
  ringAround(g, CASTLE_P1.r, CASTLE_P1.c, 2, WALL_OF[1]);
  for (const c of [CASTLE_P1.c - 1, CASTLE_P1.c, CASTLE_P1.c + 1]) g[CASTLE_P1.r - 2][c] = EMPTY;
  g[CASTLE_P1.r + 2][CASTLE_P1.c] = EMPTY; // zweites Loch unten
  const seal = findSealCells(g, 1, CASTLE_P1);
  for (const [r, c] of seal) g[r][c] = WALL_OF[1];
  assert.equal(findLeakPath(g, 1, CASTLE_P1), null, 'nach Versiegeln noch offen');
});
test('findSealCells: ohne Mauerring keine Markierung (nur Spur)', () => {
  const g = emptyGrid();
  g[CASTLE_P1.r][CASTLE_P1.c] = CASTLE_OF[1];
  assert.deepEqual(findSealCells(g, 1, CASTLE_P1), []);
});

// ── Bestenliste: Migrations-Dubletten (v3.71.0) ──────────────────────────
test('dropMigratedDupes: Alt-Eintrag verschwindet, wenn derselbe Name neu existiert', () => {
  const list = [
    { id: 'p_alt123', name: 'Bierkoenig', elo: 1046 },
    { id: 'XyZ28stelligeUid0000000000', name: 'Bierkoenig', elo: 1050 }
  ];
  const out = dropMigratedDupes(list);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'XyZ28stelligeUid0000000000');
});

test('dropMigratedDupes: Alt-Eintrag BLEIBT, solange es keinen neuen gibt', () => {
  // Der wichtigste Fall: direkt nach der Rules-Umstellung sind ALLE Eintraege
  // alt. Wuerde hier gefiltert, waere die Bestenliste schlagartig leer.
  const list = [
    { id: 'p_alt123', name: 'Bierkoenig', elo: 1046 },
    { id: 'p_alt456', name: 'Plo', elo: 1013 }
  ];
  assert.equal(dropMigratedDupes(list).length, 2);
});

test('dropMigratedDupes: mehrere Alt-Eintraege desselben Namens fallen zusammen weg', () => {
  const list = [
    { id: 'p_a', name: 'Galthran', elo: 1000 },
    { id: 'p_b', name: 'Galthran', elo: 1018 },
    { id: 'p_c', name: 'Galthran', elo: 1000 },
    { id: 'Uid000000000000000000000001', name: 'Galthran', elo: 1030 }
  ];
  const out = dropMigratedDupes(list);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'Uid000000000000000000000001');
});

test('dropMigratedDupes: zwei verschiedene Personen mit gleichem Namen bleiben beide', () => {
  // Namen sind nicht eindeutig. Neue Eintraege werden NIE ausgeblendet.
  const list = [
    { id: 'Uid000000000000000000000001', name: 'Spieler', elo: 1200 },
    { id: 'Uid000000000000000000000002', name: 'Spieler', elo: 900 }
  ];
  assert.equal(dropMigratedDupes(list).length, 2);
});

test('dropMigratedDupes: Namenswechsel laesst den Alt-Eintrag stehen', () => {
  const list = [
    { id: 'p_alt', name: 'AlterName', elo: 1046 },
    { id: 'Uid000000000000000000000001', name: 'NeuerName', elo: 1046 }
  ];
  assert.equal(dropMigratedDupes(list).length, 2);
});

test('dropMigratedDupes: robust gegen Muell (null, kein Array, fehlende Felder)', () => {
  assert.deepEqual(dropMigratedDupes(null), []);
  assert.deepEqual(dropMigratedDupes(undefined), []);
  const list = [null, { id: 'p_x' }, { name: 'ohneId' }];
  assert.equal(dropMigratedDupes(list).length, 3);
});

test('isLegacyKey: nur p_-Schluessel gelten als alt', () => {
  assert.equal(isLegacyKey('p_abc'), true);
  assert.equal(isLegacyKey('Uid00000000000000000000001'), false);
  assert.equal(isLegacyKey(''), false);
  assert.equal(isLegacyKey(null), false);
  assert.equal(isLegacyKey(undefined), false);
});

// ── Cloud-Save: Profil-Zusammenfuehrung (v3.72.0) ────────────────────────
import { mergeProfiles, profileForCloud, cloudPayload, parseCloud, CLOUD_MAX_BYTES }
  from '../src/engine/cloudsave.js';

const prof = (o = {}) => Object.assign({
  id: 'p_x', name: 'Held', wappen: 'ritter', color: '#2563eb',
  elo: 1000, elo3: 1000, peakElo: 1000, peakElo3: 1000,
  stats: { wins: 0, losses: 0, games: 0 }, stats3: { wins: 0, losses: 0, games: 0 },
  gold: 100, level: 1, xp: 0, seasonXp: 0, winStreak: 0,
  achievements: [], unlockedRewards: [], dailyTasks: [],
  cosmetics: { owned: [], equipped: {} },
  materials: { iron: 0, silver: 0, dragon: 0, star: 0 },
  updatedAt: 1000
}, o);

test('mergeProfiles: gekaufte Kosmetik geht NIE verloren (Vereinigung)', () => {
  const a = prof({ cosmetics: { owned: ['trail_ember', 'frame_gold'], equipped: {} } });
  const b = prof({ cosmetics: { owned: ['cannon_crystal'], equipped: {} } });
  const m = mergeProfiles(a, b);
  assert.deepEqual(m.cosmetics.owned.sort(), ['cannon_crystal', 'frame_gold', 'trail_ember']);
});

test('mergeProfiles: Achievements werden vereinigt, nicht ersetzt', () => {
  const m = mergeProfiles(prof({ achievements: ['a', 'b'] }), prof({ achievements: ['b', 'c'] }));
  assert.deepEqual(m.achievements.sort(), ['a', 'b', 'c']);
});

test('mergeProfiles: Gold und Material werden maximiert', () => {
  const a = prof({ gold: 500, materials: { iron: 30, silver: 2, dragon: 0, star: 1 } });
  const b = prof({ gold: 120, materials: { iron: 5, silver: 9, dragon: 3, star: 0 } });
  const m = mergeProfiles(a, b);
  assert.equal(m.gold, 500);
  assert.deepEqual(m.materials, { iron: 30, silver: 9, dragon: 3, star: 1 });
});

test('mergeProfiles: ELO bleibt an SEINER Bilanz — kein Feld-Mischmasch', () => {
  // Das Profil mit mehr Partien gewinnt die Bilanz KOMPLETT. Feldweises
  // Maximum ergaebe hohes ELO neben fremder Niederlagenzahl — eine Wertung,
  // die es nie gegeben hat.
  const viel = prof({ elo: 1100, stats: { wins: 12, losses: 8, games: 20 } });
  const wenig = prof({ elo: 1200, stats: { wins: 4, losses: 1, games: 5 } });
  const m = mergeProfiles(viel, wenig);
  assert.equal(m.elo, 1100);
  assert.deepEqual(m.stats, { wins: 12, losses: 8, games: 20 });
});

test('mergeProfiles: Bestmarke ist immer der Hoechststand', () => {
  const a = prof({ peakElo: 1300, elo: 1000, stats: { wins: 1, losses: 0, games: 1 } });
  const b = prof({ peakElo: 1100, elo: 1250, stats: { wins: 9, losses: 0, games: 9 } });
  const m = mergeProfiles(a, b);
  assert.equal(m.elo, 1250);          // Bilanz vom fuehrenden Profil
  assert.equal(m.peakElo, 1300);      // Bestmarke aber vom anderen
});

test('mergeProfiles: Level und XP bleiben gekoppelt', () => {
  // Getrennte Maxima ergaeben Level 12 mit dem XP-Rest eines Level-3-Profils.
  const a = prof({ level: 12, xp: 40 });
  const b = prof({ level: 3, xp: 400 });
  const m = mergeProfiles(a, b);
  assert.equal(m.level, 12);
  assert.equal(m.xp, 40);
});

test('mergeProfiles: Name und angelegte Kosmetik vom juengeren Profil', () => {
  const alt = prof({ name: 'Alt', updatedAt: 1000, cosmetics: { owned: ['x'], equipped: { trail: 'a' } } });
  const neu = prof({ name: 'Neu', updatedAt: 2000, cosmetics: { owned: ['y'], equipped: { trail: 'b' } } });
  const m = mergeProfiles(alt, neu);
  assert.equal(m.name, 'Neu');
  assert.equal(m.cosmetics.equipped.trail, 'b');
  assert.deepEqual(m.cosmetics.owned.sort(), ['x', 'y']);   // Besitz bleibt vereinigt
});

test('mergeProfiles: Reihenfolge egal bei Besitz und Zaehlern', () => {
  const a = prof({ gold: 700, cosmetics: { owned: ['q'], equipped: {} }, achievements: ['m'] });
  const b = prof({ gold: 200, cosmetics: { owned: ['r'], equipped: {} }, achievements: ['n'] });
  const ab = mergeProfiles(a, b), ba = mergeProfiles(b, a);
  assert.equal(ab.gold, ba.gold);
  assert.deepEqual(ab.cosmetics.owned.sort(), ba.cosmetics.owned.sort());
  assert.deepEqual(ab.achievements.sort(), ba.achievements.sort());
});

test('mergeProfiles: frisches Geraet gegen vollen Spielstand verliert nichts', () => {
  // Der Alltagsfall nach einer Neuinstallation: leeres Anon-Profil trifft auf
  // den Cloud-Stand. Es darf NICHTS vom Cloud-Stand verloren gehen.
  const frisch = prof({ updatedAt: 9999 });
  const voll = prof({
    elo: 1250, gold: 3000, level: 14, xp: 120,
    stats: { wins: 40, losses: 22, games: 62 },
    cosmetics: { owned: ['cannon_dragon', 'frame_gold'], equipped: { cannon: 'cannon_dragon' } },
    materials: { iron: 55, silver: 12, dragon: 4, star: 3 },
    achievements: ['erster_sieg', 'zehn_siege'], updatedAt: 500
  });
  const m = mergeProfiles(frisch, voll);
  assert.equal(m.elo, 1250);
  assert.equal(m.gold, 3000);
  assert.equal(m.level, 14);
  assert.deepEqual(m.stats, { wins: 40, losses: 22, games: 62 });
  assert.deepEqual(m.cosmetics.owned.sort(), ['cannon_dragon', 'frame_gold']);
  assert.deepEqual(m.materials, { iron: 55, silver: 12, dragon: 4, star: 3 });
  assert.deepEqual(m.achievements.sort(), ['erster_sieg', 'zehn_siege']);
});

test('mergeProfiles: Einmal-Migrationen bleiben erledigt', () => {
  const m = mergeProfiles(prof({ historicalXpApplied: true }), prof({ achievementsRetroApplied: true }));
  assert.equal(m.historicalXpApplied, true);
  assert.equal(m.achievementsRetroApplied, true);
});

test('mergeProfiles: robust gegen null und Muell', () => {
  assert.equal(mergeProfiles(null, null), null);
  assert.equal(mergeProfiles(prof(), null).gold, 100);
  assert.equal(mergeProfiles(null, prof()).gold, 100);
  const m = mergeProfiles({ gold: 'viel', stats: 'kaputt', cosmetics: 5 }, prof());
  assert.equal(m.gold, 100);
  assert.deepEqual(m.stats, { wins: 0, losses: 0, games: 0 });
});

test('cloudPayload / parseCloud: Rundlauf erhaelt den Stand', () => {
  const p = prof({ gold: 640, cosmetics: { owned: ['trail_gold'], equipped: {} } });
  const rec = cloudPayload(p, 4242);
  assert.equal(rec.updatedAt, 4242);
  const back = parseCloud(rec);
  assert.equal(back.gold, 640);
  assert.deepEqual(back.cosmetics.owned, ['trail_gold']);
});

test('cloudPayload: uebergrosse Profile werden abgelehnt statt abgeschnitten', () => {
  // Bewusst UNTERSCHIEDLICHE Werte: unite() entdoppelt, gleiche Eintraege
  // waeren nach dem Zusammenfuehren nur noch einer und blieben winzig.
  const viele = Array.from({ length: 3000 }, (_, i) => 'achievement_mit_langem_schluessel_' + i);
  const p = prof({ achievements: viele });
  assert.equal(cloudPayload(p, 1), null);
});

test('parseCloud: Muell ergibt null, nie eine Ausnahme', () => {
  assert.equal(parseCloud(null), null);
  assert.equal(parseCloud({}), null);
  assert.equal(parseCloud({ p: 'kein json' }), null);
  assert.equal(parseCloud({ p: '"nur ein string"' }), null);
  assert.equal(parseCloud({ p: 'x'.repeat(CLOUD_MAX_BYTES + 1) }), null);
});
