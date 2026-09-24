// Die Zusagen des Sicherheits-Passes v3.112.0 statisch festhalten.
//
// Jede Pruefung hier steht fuer einen Befund, der einmal WIRKLICH offen war.
// Sie pruefen die KONSTRUKTION, nicht ein Wort (CLAUDE.md, „Eine Pruefung auf
// ein WORT ist keine Pruefung"), und jede ist gegengeprueft worden: Fehlerfall
// kuenstlich erzeugt, rot gesehen, zurueckgenommen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const lies = (...t) => readFileSync(join(WURZEL, ...t), "utf8");

// ── 1. Lieferkette: fremde Actions nur auf einen Commit ────────────────
//
// Ein beweglicher Zeiger wie `@v3` zeigt auf das, was der Eigentuemer des
// fremden Repositories gerade darunter legt. Diese Schritte sehen
// GITHUB_TOKEN mit `contents: write` bzw. CLOUDFLARE_API_TOKEN.
test("fremde GitHub-Actions haengen an einem Commit, nicht an einer Marke", () => {
  const dir = join(WURZEL, ".github", "workflows");
  const offen = [];
  for (const datei of readdirSync(dir).filter((f) => f.endsWith(".yml"))) {
    const text = readFileSync(join(dir, datei), "utf8");
    for (const m of text.matchAll(/^\s*(?:- )?uses:\s*([^\s#]+)/gm)) {
      const ref = m[1];
      const [pfad, version] = ref.split("@");
      // Von GitHub selbst gepflegt: geringeres Risiko, und ein fester Commit
      // hiesse, Sicherheitsaktualisierungen von Hand nachzuziehen.
      if (pfad.startsWith("actions/")) continue;
      if (!/^[0-9a-f]{40}$/.test(version || "")) offen.push(`${datei}: ${ref}`);
    }
  }
  assert.deepEqual(offen, [], "fremde Action ohne Commit-Festlegung");
});

// ── 2. Inhaltsrichtlinie auf jeder ausgelieferten Seite ────────────────
test("jede HTML-Seite traegt eine Inhaltsrichtlinie", () => {
  const seiten = ["index.html",
    ...readdirSync(join(WURZEL, "public")).filter((f) => f.endsWith(".html"))
      .map((f) => join("public", f))];
  const ohne = seiten.filter((s) =>
    !/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=/i.test(lies(s)));
  assert.deepEqual(ohne, [], "Seite ohne Content-Security-Policy");
});

test("die Richtlinien sperren Objekte, Basis-Adresse und Formulare", () => {
  const seiten = ["index.html",
    ...readdirSync(join(WURZEL, "public")).filter((f) => f.endsWith(".html"))
      .map((f) => join("public", f))];
  for (const s of seiten) {
    const m = lies(s).match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]+)"/i);
    assert.ok(m, s);
    for (const teil of ["object-src 'none'", "base-uri 'self'", "form-action 'none'"])
      assert.ok(m[1].includes(teil), `${s}: "${teil}" fehlt in der Richtlinie`);
    assert.ok(/default-src\s+'self'/.test(m[1]), `${s}: default-src fehlt`);
  }
});

// ── 3. stats.html: kein Fremdwert unmaskiert in den DOM ────────────────
//
// Der telemetry-Knoten ist von jedem angemeldeten Client beschreibbar, und
// anonyme Anmeldung steht allen offen. `mode`, `world` und `winner` landeten
// bis v3.112.0 unmaskiert in `innerHTML` — nachgewiesen ausfuehrbar auf
// skkjbeer.github.io, also auf der Herkunft des Spiels.
test("stats.html maskiert jeden Wert aus der Telemetrie", () => {
  const q = lies("public", "stats.html");
  assert.match(q, /function txt\s*\(/, "der Maskierer txt() fehlt");
  assert.match(q, /replace\(\/\[&<>"'`\]\/g/, "txt() maskiert nicht die noetigen Zeichen");
  // Jede Einsetzung in einen HTML-Baustein muss durch txt() oder num() laufen.
  // OHNE AUSNAHMEN: Jede Einsetzung faengt mit txt(, num( oder fmt( an.
  // Eine Liste erlaubter Sonderfaelle waere genau die Luecke, durch die der
  // naechste Fremdwert schluepft — deshalb wurde stattdessen der Quelltext
  // eindeutig gemacht (v3.112.0), nicht die Pruefung aufgeweicht.
  const roh = [];
  for (const m of q.matchAll(/\$\{([^}]*)\}/g)) {
    const inhalt = m[1].trim();
    if (/^(txt|num|fmt)\s*\(/.test(inhalt)) continue;
    roh.push(inhalt);
  }
  assert.deepEqual(roh, [], "unmaskierte Einsetzung in stats.html");
  assert.ok(q.includes("${"), "keine Einsetzung gefunden — prueft der Test noch etwas?");
});

// ── 4. diagnose.html raeumt seinen Probeknoten wieder weg ──────────────
//
// Die Seite ist oeffentlich erreichbar und meldet sich bei JEDEM Lauf unter
// einer neuen anonymen Kennung an. Ohne das Aufraeumen bleibt pro Knopfdruck
// dauerhaft ein `players/<uid>`-Knoten stehen — von jedem, beliebig oft.
test("diagnose.html loescht beide Probeknoten wieder", () => {
  // OHNE KOMMENTARE PRUEFEN. Beim Gegenpruefen ist genau das aufgefallen:
  // `// weg (D.remove(D.ref(db, "players/" + uid))` erfuellte die Suche nach
  // dem Text, obwohl nichts mehr geloescht wurde. Dieselbe Falle wie in
  // v3.111.7 („KEINE FB_SPERRE, Absicht"). Verlangt gehoert die ausgefuehrte
  // KONSTRUKTION: abgewartet, ueber die Frist, mit genau diesem Pfad.
  const ohneKommentar = lies("public", "diagnose.html")
    .split("\n").map((z) => z.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  for (const pfad of ['"games/ping"', '"players/" + uid']) {
    if (!ohneKommentar.includes(`D.set(D.ref(db, ${pfad})`)) continue;
    assert.ok(ohneKommentar.includes(`await mitFrist(D.remove(D.ref(db, ${pfad}))`),
      `diagnose.html schreibt ${pfad}, raeumt es aber nicht abgewartet wieder weg`);
  }
  // Gegenprobe der Gegenprobe: Wuerde der Schreibzugriff selbst verschwinden,
  // liefe die Schleife leer und der Test waere gruen, ohne etwas zu pruefen.
  assert.ok(ohneKommentar.includes('D.set(D.ref(db, "players/" + uid)'),
    "der Cloud-Save-Probelauf ist weg — prueft dieser Test noch etwas?");
});

// ── 5. Der Spielcode bleibt beim gehaerteten Zufall ────────────────────
test("der Spielcode wird aus kryptografischem Zufall gezogen", () => {
  const q = lies("src", "game", "app.js");
  const fn = q.match(/function makeCode\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(fn, "makeCode() nicht gefunden");
  assert.match(fn[0], /getRandomValues\s*\(/,
    "makeCode() zieht nicht aus crypto.getRandomValues");
});

test("die Code-Eingabe filtert wie der Tiefenlink", () => {
  const q = lies("src", "game", "app.js");
  assert.match(q, /function saeubereCode\s*\(/);
  // Beide Wege — Eingabefeld und Beitritt — muessen denselben Filter nehmen.
  const treffer = [...q.matchAll(/saeubereCode\(/g)].length;
  assert.ok(treffer >= 3, `saeubereCode wird nur ${treffer}x benutzt`);
  assert.doesNotMatch(q, /setMpInput\(e\.target\.value\.toUpperCase\(\)/,
    "das Eingabefeld filtert wieder ungefiltert");
});

// ── 6. Die Testgegenstelle darf nie in die ausgelieferte Richtlinie ────
//
// Die E2E-Suite spricht mit einem Mock auf einem zweiten lokalen Port und
// oeffnet `connect-src` dafuer — aber NUR in der Antwort, die der Browser im
// Test bekommt (`oeffneRichtlinieFuerTestgegenstelle`). Stuende `localhost`
// in der Datei, waere die Richtlinie in der ausgelieferten App aufgeweicht,
// und niemand wuerde es bemerken: die Tests waeren ja gruen.
test("keine Testgegenstelle in einer ausgelieferten Richtlinie", () => {
  const seiten = ["index.html",
    ...readdirSync(join(WURZEL, "public")).filter((f) => f.endsWith(".html"))
      .map((f) => join("public", f))];
  for (const s of seiten) {
    const m = lies(s).match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]+)"/i);
    assert.ok(m, s);
    assert.doesNotMatch(m[1], /localhost|127\.0\.0\.1|\*:\d/,
      `${s}: die Richtlinie nennt eine lokale Gegenstelle`);
  }
});

test("die Suite oeffnet die Richtlinie ueberhaupt fuer ihren Mock", () => {
  // Sonst waere die Pruefung darueber gruen, weil niemand mehr etwas oeffnet —
  // und der naechste Online-Lauf scheiterte wieder still.
  const suite = lies("test_fortress.cjs");
  assert.match(suite, /async function oeffneRichtlinieFuerTestgegenstelle\s*\(/);
  const aufrufe = [...suite.matchAll(/await oeffneRichtlinieFuerTestgegenstelle\(ctx\)/g)].length;
  assert.ok(aufrufe >= 2,
    `nur ${aufrufe} Kontext-Fabrik(en) oeffnen die Richtlinie — makeCtx UND makeOnlineCtx brauchen es`);
});

// ── 7. App Check im Browser: der Site-Key hat die Form eines Site-Keys ──
//
// Ein Tippfehler dort faellt sonst niemandem auf: Solange nicht durchgesetzt
// ist, laeuft der Browser ohne Token genau wie vorher — erst die Durchsetzung
// wuerde ihn aussperren. Und ein versehentlich eingesetztes SECRET (gleiche
// Laenge, gleicher Anfang) waere hier oeffentlich. Pruefbar ist nur die Form;
// dass es der richtige Schluessel ist, zeigt die Messung auf der Live-Seite.
test("der reCAPTCHA-Site-Key steht in der Form eines Site-Keys im Code", () => {
  const q = lies("src", "firebase-boot.js");
  const m = q.match(/const APPCHECK_SITE_KEY = "([^"]*)";/);
  assert.ok(m, "APPCHECK_SITE_KEY nicht gefunden");
  assert.match(m[1], /^6L[0-9A-Za-z_-]{38}$/, "keine Site-Key-Form: " + m[1]);
});
