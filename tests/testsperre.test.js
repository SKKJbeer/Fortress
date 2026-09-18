// Kein Testkontext darf die Produktivdatenbank erreichen.
//
// ANLASS: Bis v3.102.0 fehlte der Firebase-API-Schluessel. `getAuth()` warf,
// `uid` blieb null — ein Testkontext ohne Sperre war dadurch zufaellig
// harmlos. Mit dem Schluessel (v3.103.0) ist er es nicht mehr: Die Seite
// meldet sich anonym an, und `pushLeaderboard` schreibt das Testprofil in die
// ECHTE Bestenliste. `CLAUDE.md` warnt davor ausdruecklich; gemessen hat es
// nie jemand.
//
// Gefunden beim Eintragen des Schluessels: elf Kontexte, zehn Sperren.
// `suiteOffline` lud die echte Seite mit nur `PROFILE_INIT`.
//
// Diese Pruefung ist STATISCH — sie liest die Suite, statt sie zu fahren. Ein
// Laufzeit-Test wuerde die Verbindung erst herstellen und dann bemerken; das
// ist zu spaet, wenn dabei schon geschrieben wurde.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUITE = path.join(WURZEL, 'test_fortress.cjs');
const zeilen = fs.readFileSync(SUITE, 'utf8').split('\n');

// Wie weit nach dem newContext darf die Sperre stehen? Die Kontexte werden
// unmittelbar danach bestueckt; 40 Zeilen sind reichlich Luft.
const FENSTER = 40;

test('Jeder Browser-Kontext der E2E-Suite bekommt eine Firebase-Sperre', () => {
  const ohne = [];
  zeilen.forEach((z, i) => {
    if (!z.includes('browser.newContext(')) return;
    const fenster = zeilen.slice(i, i + FENSTER).join('\n');
    const gesperrt = fenster.includes('FB_SPERRE') || fenster.includes('makeFbMock');
    if (!gesperrt) ohne.push(`test_fortress.cjs:${i + 1}`);
  });
  assert.deepStrictEqual(ohne, [],
    'Kontext(e) ohne Firebase-Sperre — wuerden die ECHTE Datenbank erreichen:\n  '
    + ohne.join('\n  '));
});

test('Die Pruefung sieht ueberhaupt Kontexte', () => {
  // Ohne diese Gegenprobe meldete ein kaputtes Muster alles gruen.
  const n = zeilen.filter(z => z.includes('browser.newContext(')).length;
  assert.ok(n >= 8, `nur ${n} Kontexte gefunden — Muster kaputt?`);
});

test('Beide Sperren existieren und setzen window.__fb VOR dem Seitenskript', () => {
  const txt = zeilen.join('\n');
  assert.match(txt, /const FB_SPERRE = `/, 'FB_SPERRE fehlt');
  assert.match(txt, /function makeFbMock\(/, 'makeFbMock fehlt');
  // Entscheidend: `window.__fb = window.__fb || {` — firebase-boot.js haelt
  // sich heraus, WENN das Objekt schon da ist. Ein Ueberschreiben danach waere
  // zu spaet, die Verbindung stuende dann schon.
  assert.match(txt, /window\.__fb = window\.__fb \|\| \{/, 'FB_SPERRE legt __fb nicht vorab an');
});

test('firebase-boot.js respektiert eine bereits vorhandene Sperre', () => {
  // Die andere Haelfte des Riegels. Faellt diese Weiche weg, greift keine
  // Sperre mehr, egal wie viele Tests sie setzen.
  const boot = fs.readFileSync(path.join(WURZEL, 'src', 'firebase-boot.js'), 'utf8');
  assert.match(boot, /if \(typeof window !== "undefined" && window\.__fb\)/,
    'firebase-boot.js prueft nicht mehr auf ein vorhandenes window.__fb');
});
