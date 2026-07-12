// i18n-Paritäts- und Katalog-Vollständigkeitstests (v3.34.0).
// Sichert die Regel ab: de und en haben IMMER identische Key-Mengen, und
// jeder Katalog-Artikel (Shop/Schmiede) hat einen Anzeigenamen in beiden Sprachen.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LANGS } from '../src/i18n.js';
import { COSMETICS, RECIPES, MAT_ORDER } from '../src/engine/catalog.js';

test('i18n: de und en haben exakt dieselben Keys', () => {
  const de = new Set(Object.keys(LANGS.de));
  const en = new Set(Object.keys(LANGS.en));
  const onlyDe = [...de].filter((k) => !en.has(k));
  const onlyEn = [...en].filter((k) => !de.has(k));
  assert.deepEqual(onlyDe, [], 'Keys nur in de: ' + onlyDe.join(', '));
  assert.deepEqual(onlyEn, [], 'Keys nur in en: ' + onlyEn.join(', '));
});

test('i18n: keine leeren Übersetzungen', () => {
  for (const lang of ['de', 'en']) {
    for (const [k, v] of Object.entries(LANGS[lang])) {
      assert.ok(typeof v === 'string' && v.length > 0, `${lang}.${k} leer`);
    }
  }
});

test('i18n: Platzhalter ({name} etc.) stimmen zwischen de und en überein', () => {
  const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');
  for (const k of Object.keys(LANGS.de)) {
    if (!(k in LANGS.en)) continue; // deckt der Paritätstest ab
    assert.equal(ph(LANGS.de[k]), ph(LANGS.en[k]), `Platzhalter-Drift bei "${k}"`);
  }
});

test('Katalog: jeder Shop-Artikel hat cos_<id>-Namen in beiden Sprachen', () => {
  for (const cat of Object.keys(COSMETICS)) {
    for (const it of COSMETICS[cat]) {
      assert.ok(LANGS.de['cos_' + it.id], 'de fehlt: cos_' + it.id);
      assert.ok(LANGS.en['cos_' + it.id], 'en fehlt: cos_' + it.id);
    }
  }
});

test('Katalog: jedes Schmiede-Rezept hat cos_<id>-Namen in beiden Sprachen', () => {
  for (const r of RECIPES) {
    assert.ok(LANGS.de['cos_' + r.id], 'de fehlt: cos_' + r.id);
    assert.ok(LANGS.en['cos_' + r.id], 'en fehlt: cos_' + r.id);
  }
});

test('Katalog: jedes Material hat mat_<key>-Namen in beiden Sprachen', () => {
  for (const k of MAT_ORDER) {
    assert.ok(LANGS.de['mat_' + k], 'de fehlt: mat_' + k);
    assert.ok(LANGS.en['mat_' + k], 'en fehlt: mat_' + k);
  }
});
