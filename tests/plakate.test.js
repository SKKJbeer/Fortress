// Store-Plakate (Nachtrag zu v3.131.2): tools/make-store-bilder.cjs.
//
// Die alten Store-Bilder waren rohe Bildschirmfotos — vorn das Menue mit Profil,
// ELO und Versionsnummer. Jetzt Plakate mit Schlagzeile, das staerkste zuerst.
// Geprueft wird, was sich still verschieben kann: Reihenfolge, Sprachen, und
// dass nichts in die Bilder gelangt, was nicht dorthin gehoert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (...p) => fs.readFileSync(path.join(W, ...p), 'utf8');
const WERKZEUG = lies('tools', 'make-store-bilder.cjs');
const ohneKommentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const szenen = () => {
  const block = WERKZEUG.slice(WERKZEUG.indexOf('const SZENEN = ['), WERKZEUG.indexOf('const WELTNAMEN'));
  return [...block.matchAll(/id: '([a-z]+)'/g)].map((m) => m[1]);
};

test('Reihenfolge der Plakate: Werkzeug und Upload sind gleich', () => {
  const upload = JSON.parse(lies('scripts', 'asc-store.py').match(/PLAKATE = (\[[^\]]*\])/)[1]);
  // Dateiname = laufende Nummer + Szene, in der Reihenfolge der Szenen.
  assert.deepEqual(upload, szenen().map((id, i) => `${i + 1}-${id}`));
  assert.equal(szenen()[0], 'aktion', 'das staerkste Bild muss vorn stehen');
  assert.ok(upload.length <= 10, 'ein Satz fasst hoechstens zehn Bilder');
});

test('Schlagzeilen: Deutsch und Englisch decken dieselben Szenen ab', () => {
  const texte = WERKZEUG.slice(WERKZEUG.indexOf('const TEXTE = {'), WERKZEUG.indexOf('const daten ='));
  const de = texte.slice(texte.indexOf('de: {'), texte.indexOf('en: {'));
  const en = texte.slice(texte.indexOf('en: {'));
  const schluessel = (t) => [...t.matchAll(/^\s+([a-z]+):\s+\[/gm)].map((m) => m[1]);
  assert.deepEqual(schluessel(de), schluessel(en));
  assert.deepEqual(schluessel(de), szenen());
});

test('Keine Versionsnummer, kein Profilfeld, keine fremde Marke im Plakat', () => {
  const texte = WERKZEUG.slice(WERKZEUG.indexOf('const TEXTE = {'), WERKZEUG.indexOf('const daten ='));
  assert.doesNotMatch(texte, /\b\d+\.\d+\.\d+\b|\bVersion\b|\bELO\b/i, 'Schlagzeilen ohne Version und ELO');
  assert.doesNotMatch(texte, /tetris/i, 'fremde Marke (Positionierung in CLAUDE.md)');
  // Die Aufnahme zeigt ein Demo-Profil; es darf nie die Bestenliste erreichen.
  assert.match(WERKZEUG, /ctx\.addInitScript\(FB_SPERRE\)/);
  assert.equal((WERKZEUG.match(/browser\.newContext\(/g) || []).length, (WERKZEUG.match(/addInitScript\(FB_SPERRE\)/g) || []).length);
});

test('Schlagzeile hat Kontur: kein negativer calc im Schatten', () => {
  // Ein NEGATIVER calc() ist in text-shadow ungueltig und verwirft den ganzen
  // Schatten — die Schlagzeile stand dadurch ohne Kontur im Bild (gesehen im
  // 100-%-Ausschnitt, nicht in der Vorschau).
  const code = ohneKommentar(WERKZEUG);
  assert.match(code, /const kw = '0\.065em', kd = '0\.047em'/, 'Konturbreiten als einfache Zahlen');
  assert.doesNotMatch(code, /const (kw|kd) = [^;]*calc\(/, 'calc() in der Konturbreite');
});

test('Bilder werden nie vergroessert, das iPad (und "zuzweit") zeigt die ganze Szene', () => {
  const code = ohneKommentar(WERKZEUG);
  assert.match(code, /kartenBreite = Math\.min\(kartenBreite, Math\.floor\(\(x1 - x0\) \* bw\) \+ 2 \* rand\)/);
  assert.match(code, /if \(pad \|\| ganz\) kartenBreite = Math\.min\(kartenBreite, Math\.floor\(\(H - mindestKopf - rand\) \/ verhaeltnis\)/);
});

test('Das Gefechtsbild zaehlt keine Baender als Einschlag', () => {
  // Beim ersten Anlauf zaehlte das gelbe „RUESTPHASE"-Band als Einschlag, und das
  // Werkzeug nahm Ruestphasen statt Gefechte.
  const code = ohneKommentar(WERKZEUG);
  assert.match(code, /Math\.floor\(i\.height \* 0\.26\), y1 = Math\.floor\(i\.height \* 0\.72\)/);
  assert.match(code, /Kaufe Upgrades\|Buy upgrades\|BURG von\|CASTLE of/);
});

test('Alte Store-Aufnahme schreibt nicht mehr in die Plakat-Ordner', () => {
  const s = lies('tools', 'make-screenshots.cjs');
  assert.doesNotMatch(ohneKommentar(s), /out: 'store\/(ios|ipad)/);
});
