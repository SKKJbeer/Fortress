// Der Auth-Start darf in der APP keinen Weiterleitungs-Aufloeser starten.
//
// ANLASS (v3.111.4): In der TestFlight-App ging Online gar nicht — weder
// Matchmaking noch die oeffentlich lesbare Bestenliste. Die Selbstauskunft auf
// dem Geraet sagte: „SDK ✓ · keine Anmeldung · keine Verbindung", ohne
// Fehlermeldung. Die Anmeldung schlug also nicht fehl, sie HING — und mit ihr
// die Datenbank, denn das RTDB-SDK holt vor dem Verbinden ein Auth-Token.
//
// Ursache war `getRedirectResult(auth)`, bedingungslos aufgerufen. Er erzwingt
// den Start des Popup-/Redirect-Aufloesers, und der laedt ein iframe von
// `<authDomain>/__/auth/iframe` — eine fremde Herkunft, geladen aus einer Seite
// unter `capacitor://localhost`. Im WebView bleibt das haengen, im Browser nicht.
//
// Besonders aergerlich: Konto-Verknuepfung ist in der App ohnehin AUS
// (`kontoVerknuepfbar()`, wegen Apple 5.1.1(v)/4.8). Die App bezahlte mit ihrer
// gesamten Online-Faehigkeit fuer eine Funktion, die sie nicht anbietet.
//
// Diese Pruefung ist STATISCH — die E2E-Suite sperrt Firebase aus (FB_SPERRE)
// und startet `firebase-boot.js` gar nicht erst. Ein Laufzeit-Test wuerde es
// also nicht bemerken; der Quelltext sagt es eindeutig.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOT = readFileSync(join(WURZEL, "src", "firebase-boot.js"), "utf8");
const zeilen = BOOT.split("\n");

/** Zeilennummern (0-basiert), in denen ein Ausdruck AUFGERUFEN wird — Kommentare zaehlen nicht. */
function aufrufe(muster) {
  return zeilen.reduce((raus, z, i) => {
    const ohneKommentar = z.replace(/^\s*\/\/.*$/, "");
    if (muster.test(ohneKommentar)) raus.push(i);
    return raus;
  }, []);
}

test("getRedirectResult wird NUR hinter kontoVerknuepfbar() aufgerufen", () => {
  const stellen = aufrufe(/getRedirectResult\s*\(/);
  assert.ok(stellen.length > 0, "getRedirectResult kommt gar nicht mehr vor — Test veraltet?");
  for (const i of stellen) {
    // Der Waechter muss unmittelbar davor stehen (drei Zeilen Luft).
    const davor = zeilen.slice(Math.max(0, i - 3), i).join("\n");
    assert.match(davor, /kontoVerknuepfbar\s*\(\s*\)/,
      `getRedirectResult in Zeile ${i + 1} ohne kontoVerknuepfbar()-Waechter — `
      + "das startet in der App den Weiterleitungs-Aufloeser und laesst die Anmeldung haengen");
  }
});

test("die App bekommt initializeAuth OHNE popupRedirectResolver", () => {
  assert.match(BOOT, /initializeAuth\s*\(/, "initializeAuth fehlt — die App faellt auf getAuth zurueck");
  const stelle = BOOT.indexOf("initializeAuth(");
  const aufruf = BOOT.slice(stelle, stelle + 260);
  assert.ok(!/popupRedirectResolver/.test(aufruf),
    "initializeAuth bekommt einen popupRedirectResolver — genau das war die Ursache");
  assert.match(aufruf, /persistence/,
    "Persistenz nicht ausdruecklich benannt — raten laesst sie im WebView haengen");
});

test("getAuth bleibt dem Browser vorbehalten", () => {
  // getAuth installiert den Aufloeser mit. In der App darf er nicht vorkommen,
  // also muss der Aufruf an der Plattform-Weiche haengen.
  const stellen = aufrufe(/[^a-zA-Z]getAuth\s*\(/);
  for (const i of stellen) {
    const umfeld = zeilen.slice(Math.max(0, i - 4), i + 2).join("\n");
    assert.match(umfeld, /kontoVerknuepfbar\s*\(\s*\)/,
      `getAuth in Zeile ${i + 1} ohne Plattform-Weiche`);
  }
});

test("eine haengende Anmeldung wird nach einer Frist gemeldet", () => {
  // Ohne Frist meldet die Selbstauskunft nur „keine Anmeldung" und verschweigt,
  // dass gar keine Antwort kam. Genau daran hat diese Suche Stunden gekostet.
  assert.match(BOOT, /__fbAuthError\s*=\s*"Anmeldung antwortet nicht/,
    "keine Frist um signInAnonymously — ein Haenger bliebe wieder stumm");
});

test("die Plattform-Weiche kommt aus platform.ts, nicht aus einer eigenen Kopie", () => {
  // Eine zweite Erkennung wuerde abdriften; die Weiche ist ausdruecklich EINE Datei.
  assert.match(BOOT, /from\s+["']\.\/platform\.ts["']/,
    "firebase-boot.js erkennt die Plattform selbst statt ueber platform.ts");
});
