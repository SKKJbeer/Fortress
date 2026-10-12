// Gemalte Artikelbilder (v3.127.0): jeder kauf- und schmiedbare Artikel hat
// ein Bild, und jedes Bild gehoert zu einem Artikel. Rahmen bleiben gezeichnete
// Ringe (ein gemalter Rahmen braeuchte Transparenz um das Wappen).
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { VORHANDEN, artikelPfad } from '../src/ui/artikel.js';
import { COSMETICS, RECIPES } from '../src/engine/catalog.ts';

const katalog = new Set([
  ...Object.entries(COSMETICS).filter(([k]) => k !== 'frame').flatMap(([, l]) => l.map(a => a.id)),
  ...RECIPES.map(r => r.id),
  'impact_standard', // Standard-Karte der Schmiede, kein Katalogeintrag
]);

test('Jeder Artikel (ausser Rahmen) hat ein gemaltes Bild', () => {
  for (const id of katalog) assert.ok(VORHANDEN.has(id), `${id}: kein Bild eingetragen`);
});

test('Jedes eingetragene Bild gehoert zu einem Artikel', () => {
  for (const id of VORHANDEN) assert.ok(katalog.has(id), `${id}: kein Artikel dieses Namens`);
});

test('Jedes Artikelbild liegt als echtes, kleines WebP in public/', () => {
  for (const id of VORHANDEN) {
    const pfad = new URL('../public/' + artikelPfad(id), import.meta.url);
    assert.ok(fs.existsSync(pfad), `${id}: Datei fehlt`);
    const b = fs.readFileSync(pfad);
    assert.strictEqual(b.subarray(8, 12).toString(), 'WEBP', `${id}: kein WebP`);
    assert.ok(b.length < 30000, `${id}: ${b.length} Bytes — zu gross fuer 192 px`);
  }
});

test('Herkunft der Artikelbilder ist festgehalten', () => {
  const doku = fs.readFileSync(new URL('../assets/artikel/ENTSTEHUNG.md', import.meta.url), 'utf8');
  for (const id of VORHANDEN) assert.ok(doku.includes('| ' + id + ' |'), `${id} fehlt in ENTSTEHUNG.md`);
});

test('Ohne Eintrag kein Bildpfad (Rueckfall auf die gezeichnete Vorschau)', () => {
  assert.strictEqual(artikelPfad('frame_gold'), null);
  assert.strictEqual(artikelPfad('gibtesnicht'), null);
});
