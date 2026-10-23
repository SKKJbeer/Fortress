// Store-Updates (v3.131.2): Die App ist fuehrend, also braucht jede neue
// Version einen Weg in den App Store — nicht nur nach TestFlight. Bis
// v3.131.1 war die Fassung „1.0" in allen Store-Skripten fest verdrahtet, und
// `fuellen` haette fuer ein Update die Texte der laufenden 1.0 ueberschrieben.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (...p) => fs.readFileSync(path.join(W, ...p), 'utf8');

const marketing = () => {
  const werte = [...lies('ios', 'App', 'App.xcodeproj', 'project.pbxproj').matchAll(/MARKETING_VERSION = ([\d.]+);/g)].map((m) => m[1]);
  assert.ok(werte.length >= 2, 'MARKETING_VERSION fuer Debug und Release');
  assert.equal(new Set(werte).size, 1, `Debug und Release mit derselben Version: ${werte}`);
  return werte[0];
};

test('Fassung ist einstellbar und wird nach NUMMER gewaehlt', () => {
  const asc = lies('scripts', 'asc.py');
  assert.match(asc, /FASSUNG = \(os\.environ\.get\("ASC_FASSUNG"\) or ""\)\.strip\(\) or ERSTE_FASSUNG/);
  // fassung(): nur die Fassung mit DIESER Nummer, nicht „die erste offene"
  const fn = asc.slice(asc.indexOf('def fassung('), asc.indexOf('\ndef namen('));
  assert.match(fn, /if feld\(eintrag, "versionString"\) != FASSUNG:\s*\n\s*continue/);
  assert.doesNotMatch(fn, /READY_FOR_SALE/, 'Auswahl nach Zustand statt Nummer ist der alte Fehler');
  const ablauf = lies('.github', 'workflows', 'appstore.yml');
  assert.match(ablauf, /\n      fassung:\n        description:[^\n]*\n        type: string/);
  assert.match(ablauf, /\n          ASC_FASSUNG: \$\{\{ inputs\.fassung \}\}\n/);
});

test('Bauten nur DIESER Fassung werden angehaengt und geprueft', () => {
  for (const f of ['asc-store.py', 'asc-einreichen.py']) {
    assert.match(lies('scripts', f), /"filter\[processingState\]": "VALID",\s*\n[^\n]*\n\s*"filter\[preReleaseVersion\.version\]": FASSUNG,/, f);
  }
});

test('Neuigkeiten: nur bei Updates, DE und EN, passend zur App-Version', () => {
  const asc = lies('scripts', 'asc.py');
  assert.match(asc, /def ist_update\(\) -> bool:\s*\n(?:\s*"""[\s\S]*?"""\s*\n)?\s*return FASSUNG != ERSTE_FASSUNG/);
  assert.match(asc, /if ist_update\(\):[\s\S]{0,200}soll\["whatsNew"\] = texte\.get\("Neuigkeiten"\)/);
  assert.match(lies('scripts', 'asc-sprachen.py'), /\*\*\(\{"whatsNew": t\["Neuigkeiten"\]\} if ist_update\(\) else \{\}\)/);
  const version = marketing();
  for (const datei of ['listing.md', 'listing-en.md']) {
    const t = lies('store', datei);
    const m = t.match(/### Neuigkeiten[^\n]*?(\d+\.\d+(?:\.\d+)?)\)\n+```\n([\s\S]*?)\n```/);
    assert.ok(m, `${datei}: Block „Neuigkeiten" mit Versionsnummer in der Ueberschrift`);
    // Wer die App-Version hebt, schreibt neue Neuigkeiten — sonst geht der
    // Text der Vorversion mit in den Store.
    assert.equal(m[1], version, `${datei}: Neuigkeiten fuer ${m[1]}, App ist ${version}`);
    assert.ok(m[2].length > 40 && m[2].length <= 4000, `${datei}: Laenge ${m[2].length}`);
  }
  assert.notEqual(version, '1.0', 'die erste Fassung ist bei Apple — Bauten fuers Update brauchen eine hoehere Nummer');
});

// appInfo-Auswahl (23.10.2026): Neben der verkauften Fassung (1.0.1) liefert Apple fuer 1.0.2
// ZWEI appInfos. Die Skripte nahmen blind den ERSTEN — den verkauften, gesperrten —, und
// Untertitel (1.0.2) bzw. Kategorie (1.0.1) scheiterten mit HTTP 409 „can not be modified in
// the current state". Gegenprobe: die alte Zeile `erste(... appInfos ...)` bzw. `[0]` bringt
// diese Pruefung zum Rot.
test('appInfo: Untertitel, Sprachen und Kategorie gehen an den BEARBEITBAREN Datensatz', () => {
  const asc = lies('scripts', 'asc.py');
  assert.match(asc, /def bearbeitbare_info\(daten: list\):/);
  assert.match(asc, /INFO_GESPERRT = \{[^}]*"READY_FOR_SALE"[^}]*"IN_REVIEW"[^}]*\}/);
  const namen = asc.slice(asc.indexOf('def namen('), asc.indexOf('def texte_der_fassung('));
  assert.match(namen, /bearbeitbare_info\(/);
  assert.doesNotMatch(namen, /erste\(apple, f"v1\/apps\/\{app\}\/appInfos"/, 'erster appInfo = verkaufter');
  const spr = lies('scripts', 'asc-sprachen.py');
  assert.match(spr, /bearbeitbare_info\(a_info\.json\(\)/);
  assert.doesNotMatch(spr, /erste\(apple, f"v1\/apps\/\{app\['id'\]\}\/appInfos"/);
  const store = lies('scripts', 'asc-store.py');
  assert.match(store, /ziel = bearbeitbare_info\(daten\)\["id"\]/);
  assert.doesNotMatch(store, /ziel = daten\[0\]\["id"\]/);
  assert.match(store, /info = bearbeitbare_info\(antwort\.json\(\)\.get\("data"\) or \[\]\)/);
});
