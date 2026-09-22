// Die Sicherheitsregeln der Datenbank statisch festhalten (Sicherheits-Pass
// v3.112.0).
//
// WARUM ES DIESEN TEST GIBT — drei Fallen, alle schon einmal zugeschnappt:
//
// 1. ZWEI DATEIEN, EINE WAHRHEIT. Eingespielt wird
//    `firebase-rules-PASTE.json`; gelesen und kommentiert wird
//    `firebase-security-rules.json`. Laufen sie auseinander, steht in der
//    Dokumentation etwas anderes als in der Datenbank — und der Unterschied
//    faellt niemandem auf, weil beide Dateien fuer sich plausibel aussehen.
//
// 2. NICHT AUFGEZAEHLTE KINDER SIND IN DER REALTIME DATABASE ERLAUBT. Ohne
//    `"$other": {".validate": false}` darf jeder angemeldete Client unter
//    einem Knoten beliebige weitere Felder beliebiger Groesse anlegen. Der
//    Spark-Plan hat 1 GB, und anonyme Anmeldung steht allen offen.
//
// 3. EINE ZEICHENKETTE OHNE LAENGENGRENZE IST EIN ABLAGEORT. Jede
//    `isString()`-Pruefung braucht ein `.length <=` daneben.
//
// Dieser Test prueft die KONSTRUKTION, nicht ein Wort (siehe CLAUDE.md,
// „Eine Pruefung auf ein WORT ist keine Pruefung"): Er geht den Regelbaum
// durch und verlangt die Eigenschaften an jedem Knoten, den er findet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const lies = (n) => JSON.parse(readFileSync(join(WURZEL, n), "utf8"));

const DOKU = lies("firebase-security-rules.json");
const EINGESPIELT = lies("firebase-rules-PASTE.json");
const R = EINGESPIELT.rules;

/** Alle Knoten des Regelbaums als [pfad, knoten]. */
function knoten(obj = R, pfad = "") {
  const out = [[pfad || "/", obj]];
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith(".")) continue;
    if (v && typeof v === "object") out.push(...knoten(v, pfad + "/" + k));
  }
  return out;
}
/** Knoten, die Schreibzugriffe annehmen (selbst oder geerbt). */
function schreibbar() {
  const out = [];
  for (const [pfad, n] of knoten()) {
    if (typeof n[".write"] === "string" || n[".write"] === true) out.push([pfad, n]);
  }
  return out;
}

test("PASTE-Datei und dokumentierte Fassung sind identisch", () => {
  assert.deepEqual(EINGESPIELT.rules, DOKU.rules,
    "firebase-rules-PASTE.json weicht von firebase-security-rules.json ab — " +
    "eingespielt wird die PASTE-Datei, gelesen die andere.");
});

test("nirgends steht ein offenes .write", () => {
  for (const [pfad, n] of knoten()) {
    assert.notEqual(n[".write"], true, `${pfad} hat .write: true`);
    if (typeof n[".write"] === "string") {
      assert.match(n[".write"], /auth/,
        `${pfad} erlaubt Schreiben ohne jeden Auth-Bezug: ${n[".write"]}`);
    }
  }
});

test("die Wurzel ist weder les- noch schreibbar", () => {
  assert.equal(R[".read"], undefined);
  assert.equal(R[".write"], undefined);
});

test("ein Knoten mit $other hat auch benannte Kinder", () => {
  // DIESE PRUEFUNG GIBT ES WEGEN EINES ECHTEN FEHLSCHLAGS (v3.112.4).
  // `$other: {".validate": false}` weist JEDES Kind ab, das keine eigene
  // Regel hat. Bei `leaderboard/$playerId` steckte die gesamte Pruefung in
  // EINEM grossen Ausdruck am Elternknoten — kein einziges Feld hatte eine
  // eigene Regel. Mit `$other` daneben konnte damit kein angemeldeter
  // Spieler mehr seinen Eintrag schreiben.
  //
  // Die Probe in `firebase-regeln.py` hat es beim Einspielen gesehen und der
  // Ablauf ist automatisch zurueckgerollt. Diese Zeilen sorgen dafuer, dass
  // es gar nicht erst so weit kommt.
  for (const [pfad, n] of knoten()) {
    if (!(n.$other && n.$other[".validate"] === false)) continue;
    const benannt = Object.keys(n).filter((k) => !k.startsWith(".") && k !== "$other");
    assert.ok(benannt.length > 0,
      `${pfad} hat $other, aber KEIN benanntes Kind — damit weist es alles ab`);
  }
});

test("jeder schreibbare Knoten weist unbekannte Kinder ab", () => {
  for (const [pfad, n] of schreibbar()) {
    // Ein Knoten ohne eigene Kindregeln traegt einen Einzelwert (z. B.
    // games/ping/createdAt) — dort gibt es nichts abzuweisen.
    const kinder = Object.keys(n).filter((k) => !k.startsWith("."));
    if (!kinder.length) continue;
    // Ein reiner Sammelknoten delegiert an genau einen Platzhalter.
    if (kinder.length === 1 && kinder[0].startsWith("$")) continue;
    assert.equal(n.$other && n.$other[".validate"], false,
      `${pfad} hat kein "$other": {".validate": false} — unbekannte Kinder gehen durch`);
  }
});

test("jede Zeichenketten-Pruefung hat eine Laengengrenze", () => {
  for (const [pfad, n] of knoten()) {
    const v = n[".validate"];
    if (typeof v !== "string" || !v.includes("isString()")) continue;
    assert.match(v, /\.length\s*<=\s*\d+/,
      `${pfad} prueft isString() ohne .length <= … : ${v}`);
  }
});

test("die Felder, die der Spielcode schreibt, stehen in den Regeln", () => {
  // Faellt eines weg, lehnt die Datenbank den Schreibzugriff ab — und
  // pushTelemetry/trichter verschlucken den Fehler absichtlich. Das waere
  // ein STILLER Datenverlust.
  const erwartet = {
    "games/$code": ["state", "guestAction2", "guestAction3", "numPlayers", "createdAt", "updatedAt", "hb2", "hb3"],
    "players/$uid": ["p", "updatedAt", "v"],
    "telemetry/$id": ["ts", "v", "mode", "botLvl", "rounds", "world", "winner", "players", "per"],
    "telemetry/$id/per/$p": ["walls", "cannons", "scrap", "shots", "hits", "buys", "reload", "armor", "repair", "left", "alive"],
    "funnel/$id": ["ts", "schritt", "art", "wartete", "np", "rolle", "auto"],
    "leaderboard/$playerId": ["name", "wappen", "color", "elo", "elo3", "peakElo", "peakElo3",
                              "wins", "losses", "games", "wins3", "losses3", "games3",
                              "level", "xp", "gold", "updatedAt"],
    "queue2/$ticketId": ["name", "wappen", "color", "status", "pid", "dev", "elo", "ts", "hb", "claimBy", "claimTs", "code", "role"],
    "queue3/$ticketId": ["name", "wappen", "color", "status", "pid", "dev", "elo", "ts", "hb", "claimBy", "claimTs", "code", "role"]
  };
  for (const [pfad, felder] of Object.entries(erwartet)) {
    let n = R;
    for (const stufe of pfad.split("/")) n = n && n[stufe];
    assert.ok(n, `Knoten ${pfad} fehlt in den Regeln`);
    for (const f of felder) {
      assert.ok(Object.prototype.hasOwnProperty.call(n, f),
        `${pfad}/${f} fehlt — der Spielcode schreibt es, die Regeln kennen es nicht`);
    }
  }
});

test("die Bestenliste bindet den Schreibzugriff an den Eigentuemer", () => {
  assert.match(R.leaderboard.$playerId[".write"], /auth\.uid\s*===\s*\$playerId/);
  assert.match(R.players.$uid[".write"], /auth\.uid\s*===\s*\$uid/);
  assert.match(R.players.$uid[".read"], /auth\.uid\s*===\s*\$uid/);
});

test("das eigene Profil ist nicht oeffentlich lesbar", () => {
  // players/ traegt den kompletten Fortschritt. Anders als leaderboard
  // darf hier nichts nach aussen.
  assert.notEqual(R.players[".read"], true);
});
