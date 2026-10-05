// Einreichen bei Apple (v3.117.1) — die Riegel muessen in der KONSTRUKTION
// stehen. Einreichen ist der eine Schritt, der nicht von selbst passieren darf:
// ohne ausdrueckliche Bestaetigung, ohne Trockenlauf-Vorgabe, und die
// Veroeffentlichung bleibt in der Hand des Betreibers (MANUAL).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const lies = (...t) => readFileSync(join(WURZEL, ...t), "utf8");
// Kommentare und Docstrings weg: Ein Wort in der Erklaerung ist keine Konstruktion.
const ohneErklaerung = (py) => py
  .replace(/"""[\s\S]*?"""/g, "")
  .split("\n").filter((z) => !/^\s*#/.test(z)).join("\n");

const SKRIPT = ohneErklaerung(lies("scripts", "asc-einreichen.py"));
const ABLAUF = lies(".github", "workflows", "appstore.yml");

test("Skript: Trockenlauf ist die Vorgabe, Einreichen braucht Flag UND Bestaetigung", () => {
  assert.match(SKRIPT, /echt = "--einreichen" in sys\.argv\[1:\]/);
  // Die Bestaetigung wird geprueft, BEVOR irgendetwas gelesen oder geschrieben wird.
  const main = SKRIPT.slice(SKRIPT.indexOf("def main()"));
  const iPruefung = main.search(/if echt and os\.environ\.get\("BESTAETIGUNG"\) != "EINREICHEN":\s*\n\s*sag\([^\n]*\)\s*\n\s*return 2/);
  const iApple = main.indexOf("Apple()");
  assert.ok(iPruefung >= 0, "Bestaetigungs-Pruefung mit Abbruch (return 2) fehlt");
  assert.ok(iPruefung < iApple, "Bestaetigung muss VOR dem ersten Zugriff auf Apple stehen");
  // einreichen() wird nur aufgerufen, nachdem der Trockenlauf-Zweig `return 0` lieferte.
  assert.match(main, /if not echt:[\s\S]*?return 0\s*\n\s*sag\("\\nEINREICHEN"\)\s*\n\s*return einreichen\(/);
});

test("Skript: Schreibzugriffe stehen NUR in einreichen(), nicht in den Vorbedingungen", () => {
  const vor = SKRIPT.slice(SKRIPT.indexOf("def vorbedingungen"), SKRIPT.indexOf("def einreichen"));
  assert.doesNotMatch(vor, /\.(anlegen|aendern)\(/, "die Vorbedingungen duerfen nichts schreiben");
  const main = SKRIPT.slice(SKRIPT.indexOf("def main()"));
  assert.doesNotMatch(main, /\.(anlegen|aendern)\(/, "main() darf nicht selbst schreiben");
});

test("Skript: Veroeffentlichung von Hand, VOR dem Abschicken gesetzt", () => {
  const e = SKRIPT.slice(SKRIPT.indexOf("def einreichen"), SKRIPT.indexOf("def main()"));
  const iManuell = e.indexOf('"releaseType": "MANUAL"');
  const iAbschicken = e.indexOf('"submitted": True');
  assert.ok(iManuell > 0, 'releaseType MANUAL fehlt');
  assert.ok(iAbschicken > 0, '"submitted": True fehlt');
  assert.ok(iManuell < iAbschicken, "MANUAL muss gesetzt sein, bevor abgeschickt wird");
  assert.doesNotMatch(SKRIPT, /AFTER_APPROVAL|SCHEDULED/, "andere Veroeffentlichungsarten ausgeschlossen");
});

test("Skript: Voraussetzungen — richtige Fassung, neuester Bau, keine laufende Einreichung", () => {
  assert.match(SKRIPT, /zustand != "PREPARE_FOR_SUBMISSION"/);
  assert.match(SKRIPT, /nummer\(dran\) != nummer\(neu\)/);
  assert.match(SKRIPT, /not in \("COMPLETE", "CANCELING"\)/);
  // Nach ZAHL, nicht nach Text (Apples sort=-version sortiert „99" vor „100").
  assert.match(SKRIPT, /int\(feld\(bau, "version"\)\)/);
});

test("Ablauf: 'einreichen' verlangt die Eingabe, 'einreichen-probe' schreibt nichts", () => {
  const faelle = ABLAUF.slice(ABLAUF.indexOf('case "${{ inputs.modus }}"'), ABLAUF.indexOf("esac"));
  // Genau EIN Aufruf mit --einreichen im ganzen Ablauf, und zwar im Zweig 'einreichen)'.
  assert.equal((ABLAUF.match(/asc-einreichen\.py --einreichen/g) || []).length, 1);
  const zweig = faelle.slice(faelle.indexOf("einreichen)\n"), faelle.indexOf("store-probe)"));
  assert.match(zweig, /if \[ "\$BESTAETIGUNG" != "EINREICHEN" \]; then[\s\S]*?exit 1\s*\n\s*fi\s*\n\s*python3 scripts\/asc-einreichen\.py --einreichen/);
  assert.match(faelle, /einreichen-probe\) python3 scripts\/asc-einreichen\.py ;;/);
  // Die Eingabe kommt ueber die UMGEBUNG, nie in die Shell-Zeile eingesetzt.
  assert.match(ABLAUF, /BESTAETIGUNG: \$\{\{ inputs\.bestaetigung \}\}/);
  assert.doesNotMatch(faelle, /\$\{\{ inputs\.bestaetigung \}\}/);
});

test("asc-store.py reicht weiterhin nie ein", () => {
  const store = ohneErklaerung(lies("scripts", "asc-store.py"));
  assert.doesNotMatch(store, /reviewSubmission|"submitted"|releaseType/);
});
