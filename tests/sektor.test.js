// Fingerabdruck der Sektorkarte (v3.111.0).
//
// Wozu die Funktion da ist, steht in `terrain.ts`. Hier wird geprueft, dass
// sie das tut, was der Abgleich zwischen Host und Gast braucht: GLEICHE Karten
// gleich abbilden und UNTERSCHIEDLICHE unterscheiden. Eine Funktion, die immer
// denselben Wert liefert, wuerde den Abgleich still ausser Kraft setzen — und
// genau das ist beim ersten Anlauf des Test-Hakens passiert (dort lief die
// Schleife ueber ein flaches Int8Array wie ueber ein 2D-Feld und zaehlte nie).
import { test } from "node:test";
import assert from "node:assert/strict";
import { sectorFingerprint } from "../src/engine/terrain.ts";

const karte = (werte) => Int8Array.from(werte);

test("gleiche Karten ergeben denselben Fingerabdruck", () => {
  const a = karte([1, 1, 2, 2, 3, 0, 0, 1]);
  const b = karte([1, 1, 2, 2, 3, 0, 0, 1]);
  assert.equal(sectorFingerprint(a), sectorFingerprint(b));
  assert.equal(typeof sectorFingerprint(a), "string");
});

test("EIN abweichendes Feld aendert den Fingerabdruck", () => {
  // Der eigentliche Zweck: Ein Auseinanderlaufen muss auffallen, auch wenn es
  // nur eine Zelle betrifft — dort steht dann ein Spieler, der nicht bauen darf.
  const a = karte([1, 1, 2, 2, 3, 0, 0, 1]);
  const b = karte([1, 1, 2, 2, 3, 0, 0, 2]);
  assert.notEqual(sectorFingerprint(a), sectorFingerprint(b));
});

test("Reihenfolge zaehlt — vertauschte Zellen sind eine andere Karte", () => {
  assert.notEqual(sectorFingerprint(karte([1, 2, 3])), sectorFingerprint(karte([3, 2, 1])));
});

test("Null-Karte und leere Karte liefern null statt eines huebschen Werts", () => {
  // Wichtiger als es aussieht: Ein Fingerabdruck fuer „nichts" waere auf
  // beiden Seiten gleich und wuerde Uebereinstimmung VORTAEUSCHEN.
  assert.equal(sectorFingerprint(null), null);
  assert.equal(sectorFingerprint(undefined), null);
  assert.equal(sectorFingerprint(karte([])), null);
});

test("eine Karte aus lauter Nullen hat einen anderen Wert als eine belegte", () => {
  assert.notEqual(sectorFingerprint(karte([0, 0, 0, 0])), sectorFingerprint(karte([1, 1, 1, 1])));
});

test("laengere Karten laufen durch und liefern stabile Werte", () => {
  const gross = new Int8Array(44 * 68);
  for (let i = 0; i < gross.length; i++) gross[i] = (i % 3) + 1;
  const eins = sectorFingerprint(gross);
  const zwei = sectorFingerprint(Int8Array.from(gross));
  assert.equal(eins, zwei);
  assert.match(eins, /^[0-9a-f]{1,8}$/);
});
