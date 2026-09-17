// Der Avatar-Katalog, festgehalten.
//
// Anlass: Beim Herausloesen aus dem Grossblock (v3.95.0) fiel auf, dass
// `WAPPEN_SVG` — zwoelf Inline-SVG-Medaillons, 17,2 KB, in JEDEM Seitenaufruf
// mitgeliefert — nur noch fuer `Object.keys()` gebraucht wurde. Gezeichnet
// wird aus `WAPPEN_SRC`. Das SVG-Set ist entfallen, die Namensliste kommt
// jetzt aus WAPPEN_SRC.
//
// Diese Pruefungen halten fest, was dabei stimmen MUSS. Ohne sie waere die
// Loeschung eine Behauptung.
import { test } from 'node:test';
import assert from 'node:assert';
import { WAPPEN_SRC, WAPPEN, WAPPEN_GLOW, WAPPEN_MIGRATION, AVATAR_UNLOCKS }
  from '../src/ui/wappen.js';

test('Zwoelf Avatare, Liste deckt sich mit den Bildern', () => {
  assert.strictEqual(WAPPEN.length, 12);
  assert.deepStrictEqual(WAPPEN, Object.keys(WAPPEN_SRC));
});

test('Die Reihenfolge ist sichtbar und darf nicht verrutschen', () => {
  // Der Profil-Editor zeigt die Avatare in dieser Reihenfolge; die ersten vier
  // sind die sofort freien. Eine Umsortierung waere eine UI-Aenderung, keine
  // Aufraeumarbeit — und faellt hier auf.
  assert.deepStrictEqual(WAPPEN.slice(0, 4),
    ['skelett', 'waldhueter', 'eismagier', 'roboter']);
  assert.strictEqual(WAPPEN[WAPPEN.length - 1], 'phoenix');
});

test('Jeder Avatar hat Bild, Glow-Farbe und Freischaltstufe', () => {
  for (const w of WAPPEN) {
    assert.ok(typeof WAPPEN_SRC[w] === 'string' && WAPPEN_SRC[w].startsWith('data:image/'),
      `${w}: kein Bild`);
    assert.match(WAPPEN_GLOW[w] || '', /^#[0-9a-f]{6}$/i, `${w}: keine Glow-Farbe`);
    assert.ok(Number.isInteger(AVATAR_UNLOCKS[w]) && AVATAR_UNLOCKS[w] >= 1,
      `${w}: keine Freischaltstufe`);
  }
});

test('Die ersten vier sind ab Stufe 1 frei, keiner ueber Stufe 50', () => {
  const frei = WAPPEN.filter(w => AVATAR_UNLOCKS[w] === 1);
  assert.deepStrictEqual(frei, ['skelett', 'waldhueter', 'eismagier', 'roboter']);
  assert.ok(Math.max(...Object.values(AVATAR_UNLOCKS)) <= 50);
});

test('Jede Migration zeigt auf einen Avatar, den es gibt', () => {
  // Alte Profile tragen alte Schluessel. Zeigt die Tabelle ins Leere, steht
  // ein Spieler ohne Bild da — und zwar genau der mit dem aeltesten Profil.
  for (const [alt, neu] of Object.entries(WAPPEN_MIGRATION)) {
    assert.ok(WAPPEN_SRC[neu], `Migration ${alt} → ${neu}: Ziel fehlt`);
    assert.ok(!WAPPEN_SRC[alt], `${alt} ist noch ein gueltiger Avatar — Migration falsch`);
  }
});

test('Kein Inline-SVG mehr im Katalog', () => {
  // Der eigentliche Grund fuer diese Datei: 17,2 KB, die niemand brauchte.
  // Kommt ein SVG-Set zurueck, soll das eine Entscheidung sein, kein Versehen.
  const roh = JSON.stringify({ WAPPEN_SRC, WAPPEN_GLOW, WAPPEN_MIGRATION, AVATAR_UNLOCKS });
  assert.ok(!roh.includes('<svg'), 'Inline-SVG im Avatar-Katalog');
});
