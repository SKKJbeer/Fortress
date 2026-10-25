// Wochenbericht aus App Store Connect (v3.132.4).
//
// Anlass: Ob Name, Untertitel, Schlagwoerter und Plakate in der Suche greifen,
// wurde nirgends gemessen. Geprueft wird die KONSTRUKTION (CLAUDE.md, „Eine
// Pruefung auf ein WORT ist keine Pruefung"): die Auswertung laeuft gegen
// Beispieldaten, die Ablaeufe haengen an den richtigen Schaltern.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (...p) => fs.readFileSync(path.join(W, ...p), 'utf8');
const ohneErklaerung = (s) => s.replace(/"""[\s\S]*?"""/g, '').replace(/^\s*#.*$/gm, '');

test('Einrichten schreibt nur mit BESTAETIGUNG=BERICHT und nie eine vorhandene Anfrage doppelt', () => {
  const s = ohneErklaerung(lies('scripts', 'asc-bericht.py'));
  const fn = s.slice(s.indexOf('def einrichten'), s.indexOf('def sammeln'));
  assert.match(fn, /os\.environ\.get\("BESTAETIGUNG"\) != "BERICHT"[\s\S]*?return 1/);
  assert.match(fn, /if art in vorhanden:[\s\S]*?continue/);
  assert.match(fn, /for art in \("ONGOING", "ONE_TIME_SNAPSHOT"\)/);
});

test('Standard- und Detailbericht werden nicht gemeinsam gezaehlt', () => {
  const s = ohneErklaerung(lies('scripts', 'asc-bericht.py'));
  const fn = s.slice(s.indexOf('def sammeln'), s.indexOf('def main'));
  assert.match(fn, /ziel = such if "detailed" in name else eng/);
  assert.match(fn, /"download" in name and "detailed" not in name/);
});

test('Der Lauf haengt nur an den eigenen Schaltern und nutzt keine fremde Action', () => {
  const y = lies('.github', 'workflows', 'bericht.yml');
  assert.match(y, /cron: '17 5 \* \* 1'/);
  assert.match(y, /issues: write/);
  assert.match(y, /BESTAETIGUNG: \$\{\{ inputs\.bestaetigung \}\}/);
  assert.doesNotMatch(y.replace(/#.*$/gm, ''), /\$\{\{ inputs\.[a-z]+ \}\}"?\s*in\b/);
  for (const m of y.matchAll(/uses:\s*([^\s@]+)@/g)) assert.match(m[1], /^actions\//, `fremde Action ${m[1]}`);
  assert.match(y, /grep -q "Noch keine Daten"/, 'ohne Daten kein Eintrag');
  assert.match(y, /ASC_KEY_ID: \$\{\{ secrets\.ASC_BERICHT_KEY_ID \|\| secrets\.ASC_KEY_ID \}\}/, 'eigener Schluessel geht vor');
  assert.match(y, /ASC_KEY_P8: \$\{\{ secrets\.ASC_BERICHT_KEY_P8 \|\| secrets\.ASC_KEY_P8 \}\}/);
});

test('Auswertung: Zeitraeume, Quellen, Vergleich, fehlende Berichte (gegen Beispieldaten)', (t) => {
  const code = `
import sys, os, importlib.util, datetime as dt, json
os.environ.update(ASC_KEY_ID='x', ASC_ISSUER_ID='x', ASC_KEY_P8='x')
sys.path.insert(0, 'scripts')
try:
    spec = importlib.util.spec_from_file_location('b', 'scripts/asc-bericht.py')
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
except ModuleNotFoundError as e:
    print('SKIP', e); sys.exit(0)
days = [(dt.date(2026, 10, 10) + dt.timedelta(d)).isoformat() for d in range(14)]
eng, dl = [], []
for i, d in enumerate(days):
    eng.append({'Date': d, 'Event': 'Impression', 'Source Type': 'App Store Search', 'Counts': '100'})
    eng.append({'Date': d, 'Event': 'Page view', 'Source Type': 'App Store Search', 'Counts': '10'})
    dl.append({'Date': d, 'Download Type': 'First-time Download', 'Source Type': 'App Store Search', 'Counts': '2', 'Territory': 'DE'})
    dl.append({'Date': d, 'Download Type': 'Redownload', 'Source Type': 'Browse', 'Counts': '1'})
print(json.dumps({'voll': m.bericht_schreiben(eng, dl, []), 'leer': m.bericht_schreiben([], [], []),
                  'ohne_dl': m.bericht_schreiben(eng, [], [])}))
`;
  const r = spawnSync('python3', ['-I', '-c', code], { cwd: W, encoding: 'utf8' });
  if (/^SKIP/.test(r.stdout)) return t.skip('Python ohne pyjwt/requests: ' + r.stdout.trim());
  assert.equal(r.status, 0, r.stderr);
  const o = JSON.parse(r.stdout);
  // Sieben Tage je 100 Einblendungen, 10 Aufrufe, 2 Erstladungen — nicht 14 Tage und nicht doppelt.
  assert.match(o.voll, /Einblendungen im Store \| 700 \| 0 %/);
  assert.match(o.voll, /Produktseiten-Aufrufe \| 70 \| 0 %/);
  assert.match(o.voll, /Erstladungen \| 14 \| 0 %/);
  assert.match(o.voll, /Wiederladungen \| 7 \|/);
  assert.match(o.voll, /Aufruf → Ladung \| 20\.0 %/);
  assert.match(o.voll, /Erstladungen nach Land[\s\S]*\| DE \| 14 \|/);
  assert.match(o.voll, /Suchbegriffe:\*\* nicht geliefert/);
  assert.match(o.leer, /Noch keine Daten/);
  assert.match(o.ohne_dl, /Ladevorgaenge: Bericht nicht geliefert/);
  assert.doesNotMatch(o.ohne_dl, /Aufruf → Ladung \| 0\.0 %/, 'fehlender Bericht ist keine Null');
});
