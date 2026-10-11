// Gemalte Weltboeden (v3.122.0): jeder eingetragene Boden existiert und passt aufs Brett.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_THEMES } from '../src/engine/terrain.ts';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// JPEG-Groesse aus dem SOF-Kopf lesen (ohne Bildbibliothek)
function jpegMasse(b) {
  assert.equal(b.readUInt16BE(0), 0xffd8, 'kein JPEG');
  let i = 2;
  while (i < b.length) {
    const m = b.readUInt16BE(i), len = b.readUInt16BE(i + 2);
    if (m >= 0xffc0 && m <= 0xffc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('kein SOF gefunden');
}

test('jeder Weltboden liegt in public/ als JPEG in Brettgroesse 616x952', () => {
  const mit = WORLD_THEMES.filter((t) => t.boden);
  assert.ok(mit.length >= 1, 'mindestens eine Welt hat einen gemalten Boden');
  for (const t of mit) {
    const p = path.join(W, 'public', t.boden);
    assert.ok(fs.existsSync(p), `${t.name}: ${t.boden} fehlt`);
    const m = jpegMasse(fs.readFileSync(p));
    assert.deepEqual([m.w, m.h], [616, 952], `${t.name}: ${m.w}x${m.h}`);
    assert.ok(fs.statSync(p).size < 400 * 1024, `${t.name}: zu gross fuer schnelles Laden`);
  }
});

test('Weltboeden sind nur Optik: Reihenfolge und Anzahl der Welten unveraendert (online synchron)', () => {
  assert.deepEqual(WORLD_THEMES.map((t) => t.name),
    ['Kristalltal', 'Frostreich', 'Glutwüste', 'Vulkanschlund', 'Nebelmoor', 'Herbstwald', 'Astralebene']);
});

test('Herkunft der Weltboeden ist festgehalten', () => {
  const e = fs.readFileSync(path.join(W, 'assets/welten/ENTSTEHUNG.md'), 'utf8');
  for (const t of WORLD_THEMES.filter((x) => x.boden)) assert.match(e, new RegExp(t.name), `${t.name} fehlt in ENTSTEHUNG.md`);
});
