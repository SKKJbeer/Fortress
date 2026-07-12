// Unit-Tests für die Netz-Schicht (Phase 2 der Modularisierung, v3.35.0).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PROTO_VERSION, sanitizeState, sanitizeAction } from '../src/net/protocol.js';
import { mmRadius, computeMatchGroup, MM_BASE_RADIUS } from '../src/net/matchmaking.js';

// ── Protokoll ────────────────────────────────────────────────────────
test('PROTO_VERSION ist eine positive Ganzzahl', () => {
  assert.ok(Number.isInteger(PROTO_VERSION) && PROTO_VERSION >= 1);
});
test('sanitizeState: akzeptiert minimalen gültigen State', () => {
  const s = { grid: [[0]], phase: 'build', timer: 10 };
  assert.equal(sanitizeState(s), s);
});
test('sanitizeState: verwirft kaputte Shapes', () => {
  assert.equal(sanitizeState(null), null);
  assert.equal(sanitizeState({}), null);
  assert.equal(sanitizeState({ grid: 'x', phase: 'build', timer: 1 }), null);
  assert.equal(sanitizeState({ grid: [[0]], phase: 'hack', timer: 1 }), null);
  assert.equal(sanitizeState({ grid: [[0]], phase: 'build', timer: -1 }), null);
  assert.equal(sanitizeState({ grid: [[0]], phase: 'build', timer: 999 }), null);
  assert.equal(sanitizeState({ grid: [new Array(500).fill(0)], phase: 'build', timer: 1 }), null);
});
test('sanitizeAction: gültige Aktionstypen passieren, unbekannte nicht', () => {
  assert.ok(sanitizeAction({ type: 'fire', tx: 10, ty: 10 }));
  assert.ok(sanitizeAction(JSON.stringify({ type: 'join', name: 'X' })));
  assert.equal(sanitizeAction({ type: 'hack' }), null);
  assert.equal(sanitizeAction('kein json {'), null);
  assert.equal(sanitizeAction({ type: 'buy', item: 'aimbot' }), null);
});
test('sanitizeAction: Feld-Hygiene (Name gekappt, Farbe validiert, Kosmetik-Länge)', () => {
  const a = sanitizeAction({ type: 'join', name: 'x'.repeat(99), color: 'javascript:', cannon: 'y'.repeat(99), impact: 'impact_lava' });
  assert.equal(a.name.length, 30);
  assert.equal(a.color, undefined);
  assert.equal(a.cannon, undefined);
  assert.equal(a.impact, 'impact_lava');
});
test('sanitizeAction: Koordinaten-Grenzen', () => {
  assert.equal(sanitizeAction({ type: 'fire', tx: -5, ty: 10 }), null);
  assert.equal(sanitizeAction({ type: 'place', r: 9999 }), null);
});

// ── Matchmaking ──────────────────────────────────────────────────────
const mkWait = (n, eloStep = 10, now = 100000) =>
  Array.from({ length: n }, (_, i) => ({ id: 's' + String(i).padStart(3, '0'), elo: 1000 + i * eloStep, ts: now - 5000 }));

test('mmRadius: wächst monoton mit der Wartezeit', () => {
  assert.equal(mmRadius(0), MM_BASE_RADIUS);
  assert.ok(mmRadius(10) > mmRadius(0));
  assert.ok(mmRadius(120) > mmRadius(60));
});
test('computeMatchGroup: deterministisch — ALLE Clients einer Gruppe sehen dieselbe Gruppe + denselben Claimer', () => {
  const now = 100000;
  const wait = mkWait(20, 10, now);
  const results = wait.map((w) => computeMatchGroup(wait, 2, now, w.id));
  for (const w of wait) {
    const r = results[wait.indexOf(w)];
    assert.ok(r.group, w.id + ' ohne Gruppe (20 Spieler, enge ELO)');
    // Jedes Gruppenmitglied berechnet dieselbe Gruppe und denselben Claimer
    for (const member of r.group) {
      const rm = computeMatchGroup(wait, 2, now, member.id);
      assert.deepEqual(rm.group.map((x) => x.id), r.group.map((x) => x.id));
      assert.equal(rm.claimer.id, r.claimer.id);
    }
    // Genau EIN Claimer pro Gruppe, und er ist Mitglied
    assert.ok(r.group.some((x) => x.id === r.claimer.id));
  }
});
test('computeMatchGroup: Schwarm-Eigenschaft — 20 Wartende → 10 disjunkte 2er-Gruppen', () => {
  const now = 100000;
  const wait = mkWait(20, 10, now);
  const groups = new Set();
  for (const w of wait) {
    const r = computeMatchGroup(wait, 2, now, w.id);
    groups.add(r.group.map((x) => x.id).join('+'));
  }
  assert.equal(groups.size, 10, [...groups].join(' | '));
  const all = [...groups].flatMap((g) => g.split('+'));
  assert.equal(new Set(all).size, 20, 'Spieler in mehreren Gruppen!');
});
test('computeMatchGroup: 3er-Modus bildet Dreiergruppen', () => {
  const now = 100000;
  const wait = mkWait(9, 10, now);
  const r = computeMatchGroup(wait, 3, now, 's000');
  assert.ok(r.group && r.group.length === 3);
});
test('computeMatchGroup: ELO-Radius trennt frische weit entfernte Spieler', () => {
  const now = 100000;
  // 2 Spieler, 5s gewartet (Radius ~100), 5000 ELO auseinander → kein Match
  const wait = [
    { id: 'a', elo: 1000, ts: now - 5000 },
    { id: 'b', elo: 6000, ts: now - 5000 }
  ];
  assert.equal(computeMatchGroup(wait, 2, now, 'a').group, null);
  // Nach langem Warten wächst der Radius → Match kommt zustande
  const wait2 = wait.map((w) => ({ ...w, ts: now - 700000 }));
  assert.ok(computeMatchGroup(wait2, 2, now, 'a').group);
});
test('computeMatchGroup: Livelock-Regression v3.14.13 — ungerade Zahl lässt genau einen übrig', () => {
  const now = 100000;
  const wait = mkWait(21, 10, now);
  let matched = 0, unmatched = 0;
  for (const w of wait) {
    const r = computeMatchGroup(wait, 2, now, w.id);
    if (r.group) matched++; else unmatched++;
  }
  assert.equal(matched, 20);
  assert.equal(unmatched, 1);
});
test('computeMatchGroup: mutiert die Eingabeliste nicht', () => {
  const now = 100000;
  const wait = mkWait(4, 500, now); // große ELO-Sprünge
  const before = JSON.stringify(wait);
  computeMatchGroup(wait, 2, now, 's000');
  assert.equal(JSON.stringify(wait), before);
});
