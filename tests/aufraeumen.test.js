// Die Loeschliste von `scripts/firebase-aufraeumen.py` statisch festhalten.
//
// Warum ein Test fuer eine Handvoll Zeilen Python: Das Dienstkonto umgeht
// ALLE Sicherheitsregeln. Steht dort eines Tages `leaderboard` statt
// `leaderboard/test_bot_001`, ist die gesamte Bestenliste beim naechsten Lauf
// weg — ohne Rueckfrage und ohne Wiederherstellung. Das Skript prueft das zur
// Laufzeit selbst; dieser Test prueft es, BEVOR irgendetwas laeuft.
//
// Gleiche Bauart wie `tests/speicher.test.js` und `tests/testsperre.test.js`:
// den Quelltext lesen und eine Zusage darueber pruefen, statt zu hoffen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUELLE = readFileSync(join(WURZEL, "scripts", "firebase-aufraeumen.py"), "utf8");

/** Die Pfade aus dem ERLAUBT-Block herausziehen — nur die, nichts sonst. */
function erlaubtePfade() {
  const block = QUELLE.match(/^ERLAUBT = \[([\s\S]*?)^\]/m);
  assert.ok(block, "ERLAUBT-Block nicht gefunden — wurde das Skript umgebaut?");
  return [...block[1].matchAll(/\(\s*"([^"]+)"/g)].map(m => m[1]);
}

const ZWEIGE = ["games", "leaderboard", "players", "queue2", "queue3", "telemetry", "funnel"];

test("die Loeschliste ist nicht leer und wird gelesen", () => {
  assert.ok(erlaubtePfade().length > 0);
});

test("kein Eintrag loescht einen ganzen Zweig", () => {
  for (const pfad of erlaubtePfade()) {
    const stufen = pfad.split("/").filter(Boolean);
    assert.ok(stufen.length >= 2,
      `"${pfad}" hat nur ${stufen.length} Stufe(n) — das waere ein ganzer Zweig`);
    assert.ok(!ZWEIGE.includes(pfad.replace(/\/+$/, "")),
      `"${pfad}" ist ein Zweig der Datenbank`);
  }
});

test("kein Eintrag enthaelt Platzhalter oder Aufstiege", () => {
  for (const pfad of erlaubtePfade()) {
    assert.ok(!pfad.includes("*"), `"${pfad}" enthaelt einen Platzhalter`);
    assert.ok(!pfad.includes(".."), `"${pfad}" enthaelt einen Aufstieg`);
  }
});

test("jeder Eintrag beginnt mit einem echten Zweig", () => {
  for (const pfad of erlaubtePfade()) {
    const erste = pfad.split("/").filter(Boolean)[0];
    assert.ok(ZWEIGE.includes(erste),
      `"${pfad}" beginnt mit "${erste}" — kein Zweig der Datenbank`);
  }
});

test("der Pfad wird nicht aus der Kommandozeile uebernommen", () => {
  // Der springende Punkt des Entwurfs: Namen stehen im Code, gehen durch
  // git und lassen sich nicht im Vorbeigehen weiten. Nimmt das Skript eines
  // Tages einen Pfad als Argument, ist dieser ganze Schutz hinfaellig.
  const argZeilen = QUELLE.split("\n").filter(z => z.includes("sys.argv"));
  for (const z of argZeilen) {
    assert.ok(/sys\.argv\[1:\]/.test(z),
      `Verdaechtige Nutzung von sys.argv: ${z.trim()} — Pfade gehoeren in ERLAUBT`);
  }
});
