// Bewertungs-Bitte (v3.118.0): WANN die App im App Store um eine Bewertung bittet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  leererBewertungsStand, bewertungsStandAus, sollUmBewertungBitten, nachPartie, nachBitte,
  BEWERTUNG_AB_SPIELEN, BEWERTUNG_ABSTAND_MS, BEWERTUNG_HOECHSTENS,
} from '../src/engine/bewertung.ts';

const nach = (n) => { let s = leererBewertungsStand(); for (let i = 0; i < n; i++) s = nachPartie(s); return s; };
const T = 1_800_000_000_000;

test('nie nach einer Niederlage, nie vor genug Partien', () => {
  assert.equal(sollUmBewertungBitten(nach(50), { gewonnen: false, jetzt: T }), false);
  assert.equal(sollUmBewertungBitten(nach(BEWERTUNG_AB_SPIELEN - 1), { gewonnen: true, jetzt: T }), false);
  assert.equal(sollUmBewertungBitten(nach(BEWERTUNG_AB_SPIELEN), { gewonnen: true, jetzt: T }), true);
});

test('Abstand und Obergrenze', () => {
  let s = nachBitte(nach(10), T);
  assert.equal(sollUmBewertungBitten(s, { gewonnen: true, jetzt: T + BEWERTUNG_ABSTAND_MS - 1 }), false);
  assert.equal(sollUmBewertungBitten(s, { gewonnen: true, jetzt: T + BEWERTUNG_ABSTAND_MS }), true);
  for (let i = 1; i < BEWERTUNG_HOECHSTENS; i++) s = nachBitte(s, T + i * BEWERTUNG_ABSTAND_MS);
  assert.equal(s.anzahl, BEWERTUNG_HOECHSTENS);
  assert.equal(sollUmBewertungBitten(s, { gewonnen: true, jetzt: T * 2 }), false);
});

test('kaputter oder fremder Speicherwert faellt auf leer zurueck', () => {
  for (const roh of [null, 'x', 42, [], { zuletzt: -5, anzahl: 'a', spiele: NaN }, { constructor: 1 }]) {
    assert.deepEqual(bewertungsStandAus(roh), leererBewertungsStand());
  }
  assert.deepEqual(bewertungsStandAus({ zuletzt: 7, anzahl: 2.9, spiele: 4 }), { zuletzt: 7, anzahl: 2, spiele: 4 });
});

test('Spielcode: Bitte haengt an der Ernte am Partieende, nur nativ, ueber den Speicherschluessel', () => {
  const app = fs.readFileSync(new URL('../src/game/app.js', import.meta.url), 'utf8');
  const ernte = app.slice(app.indexOf('function harvestDailyTasks('), app.indexOf('function bewertungNachPartie('));
  assert.match(ernte, /bewertungNachPartie\(won\);/, 'Ernte ruft die Bewertungsregel auf');
  // Erst NACH den Ausschluessen (Tutorial, lokales Duell)
  assert.ok(ernte.indexOf('tasksHarvested.current = true') < ernte.indexOf('bewertungNachPartie(won)'));
  const fn = app.slice(app.indexOf('function bewertungNachPartie('), app.indexOf('function collectDailyTask('));
  assert.match(fn, /istNativ\(\)\s*&&\s*sollUmBewertungBitten\(/);
  assert.match(fn, /localStorage\.setItem\(SCHLUESSEL\.bewertung,/);
  assert.match(fn, /bitteUmBewertung\(\)/);
});
