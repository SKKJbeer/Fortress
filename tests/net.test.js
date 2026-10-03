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
// ── Mehrere Wartende: Ablauf ueber Runden nachgestellt (v3.115.2) ─────────
// Die Einzelaufrufe oben pruefen EINEN Schnappschuss mit EINER Uhr. Im Spiel
// rechnet jeder Client mit seiner eigenen Uhr (Versatz bis zu Sekunden), und
// geclaimt wird nacheinander per Transaktion — wer schon vergeben ist, laesst
// den ganzen Claim scheitern (mmClaimAndMatch gibt dann alles frei). Diese
// Simulation stellt genau das nach: Runde fuer Runde rechnet jeder Wartende,
// die zustaendigen Claimer greifen in zufaelliger Reihenfolge zu, die Zeit
// laeuft weiter. Gefordert: Am Ende bleiben nur (n mod np) uebrig, niemand
// steckt in zwei Partien, jede Partie hat genau np Mitglieder.
function zufall(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function simuliereWarteschlange({ n, np, seed, eloSpanne, uhrVersatzMs, ankunftMs, rechne = computeMatchGroup }) {
  const r = zufall(seed);
  const start = 1_000_000;
  const spieler = Array.from({ length: n }, (_, i) => ({
    id: 's' + Math.floor(r() * 1e9).toString(36) + '_' + i,
    elo: 1000 + Math.round((r() - 0.5) * eloSpanne),
    ts: start + Math.round(r() * ankunftMs),
    uhr: Math.round((r() - 0.5) * 2 * uhrVersatzMs),
  }));
  const partie = new Map(); // id -> Partie-Nummer
  const partien = [];
  for (let runde = 0, jetzt = start; runde < 400; runde++, jetzt += 2000) {
    const wartend = spieler.filter((s) => !partie.has(s.id) && s.ts <= jetzt);
    const snapshot = wartend.map(({ id, elo, ts }) => ({ id, elo, ts }));
    const vorhaben = [];
    for (const s of wartend) {
      const e = rechne(snapshot, np, jetzt + s.uhr, s.id);
      if (e.group && e.claimer.id === s.id) vorhaben.push(e.group.map((x) => x.id));
    }
    // zufaellige Reihenfolge der Transaktionen
    for (let i = vorhaben.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [vorhaben[i], vorhaben[j]] = [vorhaben[j], vorhaben[i]];
    }
    for (const g of vorhaben) {
      if (g.some((id) => partie.has(id))) continue; // Claim scheitert, alles frei
      partien.push(g);
      for (const id of g) partie.set(id, partien.length - 1);
    }
    if (spieler.every((s) => s.ts <= jetzt) && n - partie.size < np) {
      return { partien, uebrig: n - partie.size, runden: runde + 1 };
    }
  }
  return { partien, uebrig: n - partie.size, runden: Infinity };
}
for (const np of [2, 3]) {
  test(`Warteschlange ${np}P: viele gleichzeitig, verschiedene Uhren — alle werden verteilt`, () => {
    const faelle = [];
    for (let seed = 1; seed <= 60; seed++) {
      for (const n of [np, np + 1, 2 * np, 2 * np + 1, 7, 12, 25, 40]) {
        const e = simuliereWarteschlange({ n, np, seed: seed * 101 + n, eloSpanne: 200, uhrVersatzMs: 3000, ankunftMs: 0 });
        faelle.push({ n, seed, ...e });
      }
    }
    for (const f of faelle) {
      const name = `n=${f.n} seed=${f.seed}`;
      assert.ok(Number.isFinite(f.runden), `${name}: haengt — ${f.uebrig} bleiben ewig in der Schlange`);
      assert.equal(f.uebrig, f.n % np, `${name}: ${f.uebrig} uebrig statt ${f.n % np}`);
      for (const g of f.partien) assert.equal(g.length, np, `${name}: Partie mit ${g.length} Spielern`);
      const alle = f.partien.flat();
      assert.equal(new Set(alle).size, alle.length, `${name}: jemand steckt in zwei Partien`);
    }
  });
  test(`Warteschlange ${np}P: gestaffelte Ankunft und weite ELO-Spanne — niemand bleibt haengen`, () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const n of [np + 1, 2 * np, 9, 16]) {
        const e = simuliereWarteschlange({ n, np, seed: seed * 7 + n, eloSpanne: 900, uhrVersatzMs: 2000, ankunftMs: 30000 });
        assert.ok(Number.isFinite(e.runden), `n=${n} seed=${seed}: haengt`);
        assert.equal(e.uebrig, n % np, `n=${n} seed=${seed}: ${e.uebrig} uebrig`);
        // Radius waechst 8 ELO/s: 900 Spanne ist nach spaetestens ~2 Minuten
        // ueberbrueckt. Mehr als 120 Runden (4 Minuten) waere ein Haenger.
        assert.ok(e.runden <= 120, `n=${n} seed=${seed}: erst nach ${e.runden} Runden`);
      }
    }
  });
}
test('Warteschlange: die Simulation erkennt Fehler wirklich (Gegenproben)', () => {
  // Ohne Gegenprobe koennte die Simulation alles fuer gut befinden.
  // 1) Zustaendigkeit verdreht: jeder haelt einen ANDEREN fuer den Claimer —
  //    genau der Livelock von v3.14.13. Muss als Haenger auffallen.
  const fremderClaimer = (w, np, now, me) => {
    const e = computeMatchGroup(w, np, now, me);
    if (!e.group) return e;
    return { ...e, claimer: e.group.find((x) => x.id !== me) };
  };
  const h = simuliereWarteschlange({ n: 8, np: 2, seed: 3, eloSpanne: 100, uhrVersatzMs: 0, ankunftMs: 0, rechne: fremderClaimer });
  assert.equal(h.runden, Infinity, 'verdrehte Zustaendigkeit wurde nicht als Haenger erkannt');
  // 2) Gruppen eine Person zu klein: muss an der Partiegroesse scheitern.
  const zuKlein = (w, np, now, me) => computeMatchGroup(w, np - 1, now, me);
  const k = simuliereWarteschlange({ n: 6, np: 3, seed: 3, eloSpanne: 100, uhrVersatzMs: 0, ankunftMs: 0, rechne: zuKlein });
  assert.ok(k.partien.some((g) => g.length !== 3), 'zu kleine Partien wurden nicht bemerkt');
});
test('computeMatchGroup: mutiert die Eingabeliste nicht', () => {
  const now = 100000;
  const wait = mkWait(4, 500, now); // große ELO-Sprünge
  const before = JSON.stringify(wait);
  computeMatchGroup(wait, 2, now, 's000');
  assert.equal(JSON.stringify(wait), before);
});

// ═══════════════════════════════════════════════════════════════════════
// Sicherheits-Pass v3.112.0 — was vom Gegenueber hereinkommt
//
// Es gibt in diesem Spiel KEINEN Server. Host ist ein beliebiger Mitspieler,
// und der Zustand, den er schickt, landet direkt in den Refs des Gastes. Was
// hier durchrutscht, rutscht bis in die Zeichenschleife durch.
// ═══════════════════════════════════════════════════════════════════════
import { istKatalogWort, istFarbe } from '../src/net/protocol.js';

const guterZustand = (extra) => Object.assign(
  { grid: [[0, 0]], phase: 'build', timer: 10 }, extra || {});

test('istKatalogWort: die echten Katalog-Schluessel kommen durch', () => {
  for (const k of ['skelett', 'phoenix', 'golddrache', 'trail_gold', 'frame_bronze',
                   'cannon_crystal', 'impact_lava', 'win_goldrain', 'a', 'A1-b_2'])
    assert.equal(istKatalogWort(k), true, k + ' sollte durchkommen');
});

test('istKatalogWort: Prototyp-Schluessel und Sonderzeichen nicht', () => {
  for (const k of ['__proto__', 'constructor', 'prototype', 'toString()', 'a b', 'a/b',
                   'a.b', '<img>', '', 'x'.repeat(25), null, undefined, 42, {}])
    assert.equal(istKatalogWort(k), false, JSON.stringify(k) + ' sollte abgewiesen werden');
});

test('istFarbe: nur Farbangaben, nichts mit Klammern oder Semikolon', () => {
  for (const c of ['#fff', '#2563eb', '#2563EB', 'red', 'rebeccapurple'])
    assert.equal(istFarbe(c), true, c);
  for (const c of ['red);background:url(//fremd)', 'rgba(0,0,0,1)', 'url(x)', '#12345',
                   'a'.repeat(21), '', null, 123])
    assert.equal(istFarbe(c), false, JSON.stringify(c));
});

test('sanitizeState: Kosmetik-Schluessel eines boesartigen Hosts fallen weg', () => {
  const s = sanitizeState(guterZustand({
    playerInfo: { 1: {
      name: 'x'.repeat(200), wappen: 'constructor', trail: '__proto__',
      frame: 'frame_gold', cannon: 'a b', impact: 'impact_lava',
      color: 'red);background-image:url(//fremd)', elo: 'viel'
    } }
  }));
  const pi = s.playerInfo[1];
  assert.equal(pi.name.length, 40, 'Name wird gekuerzt');
  assert.equal(pi.wappen, undefined, 'constructor faellt weg');
  assert.equal(pi.trail, undefined, '__proto__ faellt weg');
  assert.equal(pi.cannon, undefined, 'Leerzeichen faellt weg');
  assert.equal(pi.color, undefined, 'CSS-Einschleusung faellt weg');
  assert.equal(pi.elo, undefined, 'ELO muss eine Zahl sein');
  assert.equal(pi.frame, 'frame_gold', 'echte Werte bleiben');
  assert.equal(pi.impact, 'impact_lava', 'echte Werte bleiben');
});

test('sanitizeState: ein ehrlicher Zustand geht unveraendert durch', () => {
  const s = sanitizeState(guterZustand({
    playerInfo: { 1: { name: 'Anna', wappen: 'phoenix', color: '#2563eb', elo: 1200,
                       trail: 'trail_gold', frame: 'frame_bronze' } }
  }));
  assert.deepEqual(s.playerInfo[1],
    { name: 'Anna', wappen: 'phoenix', color: '#2563eb', elo: 1200,
      trail: 'trail_gold', frame: 'frame_bronze' });
});

test('sanitizeAction: Wappen und Kosmetik muessen schlichte Woerter sein', () => {
  assert.equal(sanitizeAction({ type: 'join', wappen: 'constructor' }).wappen, undefined);
  assert.equal(sanitizeAction({ type: 'join', wappen: '__proto__' }).wappen, undefined);
  assert.equal(sanitizeAction({ type: 'join', trail: 'a/b' }).trail, undefined);
  assert.equal(sanitizeAction({ type: 'join', wappen: 'phoenix' }).wappen, 'phoenix');
  assert.equal(sanitizeAction({ type: 'join', cannon: 'cannon_dragon' }).cannon, 'cannon_dragon');
});
