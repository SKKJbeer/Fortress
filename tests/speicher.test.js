// Die Schluessel des lokalen Speichers.
//
// Ein Tippfehler in `localStorage.getItem('fortress_prohfile')` ist kein
// Absturz und keine Warnung. Der Schluessel wird nicht gefunden, das Spiel legt
// ein frisches Profil an — und jemandes Fortschritt ist weg, ohne dass irgendwo
// etwas rot wird. Deshalb wird hier der ganze Quellbaum abgesucht.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHLUESSEL, ALLE_SCHLUESSEL } from '../src/engine/speicher.ts';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function quellen(dir) {
  const raus = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') raus.push(...quellen(p)); }
    else if (/\.(js|ts|tsx|cjs)$/.test(e.name)) raus.push(p);
  }
  return raus;
}

test('Die Schluesselliste ist in sich stimmig', () => {
  assert.ok(ALLE_SCHLUESSEL.length >= 14, `nur ${ALLE_SCHLUESSEL.length} Schluessel`);
  assert.strictEqual(new Set(ALLE_SCHLUESSEL).size, ALLE_SCHLUESSEL.length, 'doppelter Schluessel');
  for (const k of ALLE_SCHLUESSEL) assert.match(k, /^fortress_[a-z_]+$/, `ungewoehnlich: ${k}`);
  assert.strictEqual(SCHLUESSEL.profil, 'fortress_profile', 'Profilschluessel darf sich NIE aendern');
});

test('Im ganzen Quellbaum steht kein unbekannter fortress_-Schluessel', () => {
  const bekannt = new Set(ALLE_SCHLUESSEL);
  const treffer = [];
  for (const f of quellen(path.join(WURZEL, 'src'))) {
    if (f.endsWith(path.join('engine', 'speicher.ts'))) continue; // die Quelle selbst
    const txt = fs.readFileSync(f, 'utf8');
    for (const m of txt.matchAll(/['"`](fortress_[A-Za-z0-9_]+)['"`]/g)) {
      if (!bekannt.has(m[1])) treffer.push(`${path.relative(WURZEL, f)}: ${m[1]}`);
    }
  }
  assert.deepStrictEqual(treffer, [],
    'unbekannte Speicher-Schluessel — Tippfehler kostet Fortschritt:\n  ' + treffer.join('\n  '));
});

test('Die Pruefung sieht ueberhaupt Dateien und Schluessel', () => {
  // Ohne diese Gegenprobe meldete ein kaputter Sammler alles gruen.
  const dateien = quellen(path.join(WURZEL, 'src'));
  assert.ok(dateien.length > 10, `nur ${dateien.length} Quelldateien gefunden`);
  const alle = dateien.map(f => fs.readFileSync(f, 'utf8')).join('');
  const gefunden = [...alle.matchAll(/['"`](fortress_[A-Za-z0-9_]+)['"`]/g)].map(m => m[1]);
  assert.ok(gefunden.length >= 10, `nur ${gefunden.length} Schluessel-Vorkommen gefunden`);
  assert.ok(gefunden.includes('fortress_profile'), 'der wichtigste Schluessel kam nicht vor');
});
