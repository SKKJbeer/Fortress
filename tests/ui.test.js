// UI-Daten-Tests (Phase 3, v3.36.0) — prüft die Icon-Pfade als Daten
// (die Icon-Komponente selbst braucht einen Browser und wird via Playwright getestet).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ICON_PATHS } from '../src/ui/icons.js';
import { WIN_ICON } from '../src/engine/catalog.js';

test('ICON_PATHS: jeder Eintrag ist ein nicht-leeres Array von SVG-Pfad-Strings', () => {
  const names = Object.keys(ICON_PATHS);
  assert.ok(names.length >= 40, 'verdächtig wenige Icons: ' + names.length);
  for (const [name, paths] of Object.entries(ICON_PATHS)) {
    assert.ok(Array.isArray(paths) && paths.length > 0, name);
    for (const d of paths) {
      assert.ok(typeof d === 'string' && /^[Mm]/.test(d.trim()), `${name}: Pfad beginnt nicht mit M/m`);
    }
  }
});

test('Katalog-Referenzen: WIN_ICON-Namen existieren in ICON_PATHS', () => {
  for (const [id, def] of Object.entries(WIN_ICON)) {
    assert.ok(ICON_PATHS[def.name], `${id} referenziert unbekanntes Icon "${def.name}"`);
  }
});
