// Verfuegbarkeit im App Store (v3.131.3).
//
// Am 20.10.2026 ging Fassung 1.0 auf READY_FOR_SALE — und war in KEINEM Land zu
// finden: Apple kannte fuer die App gar keine Verfuegbarkeit. Die Pruefungen
// hatten den 404 wochenlang als „? nicht abfragbar" durchgelassen; `marktreif`
// fragte zusaetzlich einen Pfad ab, den es nicht gibt. Geprueft wird die
// KONSTRUKTION, nicht ein Wort (CLAUDE.md, „Eine Pruefung auf ein WORT ...").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (...p) => fs.readFileSync(path.join(W, ...p), 'utf8');
const ohneErklaerung = (s) => s.replace(/"""[\s\S]*?"""/g, '').replace(/^\s*#.*$/gm, '');

test('404 auf die Verfuegbarkeit heisst FEHLT, nicht „nicht abfragbar"', () => {
  const asc = ohneErklaerung(lies('scripts', 'asc.py'));
  const fn = asc.slice(asc.indexOf('def verfuegbarkeit_zaehlen'), asc.indexOf('def erste('));
  assert.match(fn, /if st == 404:\s*\n\s*return "fehlt", 0/);
  assert.match(fn, /v1\/apps\/\{app_id\}\/appAvailabilityV2/);
  assert.match(fn, /sum\(1 for g in j\.get\("data"\) or \[\] if feld\(g, "available"\)\)/);
});

test('marktreif: richtiger Pfad, fehlende Verfuegbarkeit ist ein Mangel', () => {
  const s = ohneErklaerung(lies('scripts', 'asc-marktreif.py'));
  assert.doesNotMatch(s, /v2\/apps\/\{app_id\}\/appAvailability/, 'dieser Pfad existiert nicht');
  assert.match(s, /art, anzahl = verfuegbarkeit_zaehlen\(apple, app_id\)/);
  assert.match(s, /else:\s*\n\s*fehlt\("Verfuegbarkeit: kein Gebiet/);
  assert.match(s, /elif art == "unbekannt":\s*\n\s*blind\(/, 'nur „unbekannt" darf blind bleiben');
});

test('freigeben: ohne Verfuegbarkeit wird nicht veroeffentlicht', () => {
  const s = ohneErklaerung(lies('scripts', 'asc-freigeben.py'));
  assert.match(s, /def verfuegbarkeit\(apple: Apple, app_id: str\) -> bool:/);
  assert.match(s, /if not anzahl:[\s\S]*?return False/);
  // Das Veroeffentlichen selbst steht HINTER der Sperre.
  const sperre = s.indexOf('if not verfuegbar:');
  const anlegen = s.indexOf('appStoreVersionReleaseRequests');
  assert.ok(sperre > 0 && anlegen > sperre, 'Sperre muss vor dem Veroeffentlichen stehen');
  assert.match(s.slice(sperre, anlegen), /return 1/);
});

test('verfuegbar: legt nur an, wenn Apple KEINE kennt, und nur mit Eingabe', () => {
  const s = ohneErklaerung(lies('scripts', 'asc-verfuegbar.py'));
  assert.match(s, /os\.environ\.get\("BESTAETIGUNG"\) != "VERFUEGBAR"/);
  const fn = s.slice(s.indexOf('def setzen'), s.indexOf('def main'));
  assert.match(fn, /if st == 200:[\s\S]*?return 0/, 'eine vorhandene Verfuegbarkeit wird nie ueberschrieben');
  assert.match(fn, /if st != 404:[\s\S]*?return 1/);
  assert.match(fn, /if len\(ids\) < 100:[\s\S]*?return 1/, 'Abbruch bei unvollstaendiger Gebietsliste');
  assert.match(fn, /"availableInNewTerritories": True/);
  assert.equal((s.match(/apple\.anlegen\(/g) || []).length, 1, 'genau EIN Schreibzugriff');
  const ablauf = lies('.github', 'workflows', 'appstore.yml');
  const faelle = ablauf.slice(ablauf.indexOf('case "${{ inputs.modus }}"'), ablauf.indexOf('esac'));
  assert.match(faelle, /verfuegbar-stand\) python3 scripts\/asc-verfuegbar\.py ;;/);
  assert.match(faelle, /verfuegbar\)\n\s+if \[ "\$BESTAETIGUNG" != "VERFUEGBAR" \]; then[\s\S]*?exit 1\s*\n\s*fi\s*\n\s*python3 scripts\/asc-verfuegbar\.py --setzen/);
  assert.equal((ablauf.match(/asc-verfuegbar\.py --setzen/g) || []).length, 1);
  assert.doesNotMatch(faelle, /\$\{\{ inputs\.bestaetigung \}\}/);
});
