// Datenschutzerklaerung und Code gehoeren zusammen (v3.117.0).
//
// Anlass: Die Erklaerung behauptete „Solange du kein Online-Spiel startest,
// verlaesst ueberhaupt nichts dein Geraet" — dabei meldete sich jede App beim
// Start anonym an, schrieb den Bestenlisten-Eintrag und sicherte das ganze
// Profil in `players`. Cloud-Sicherung, Ablauf-Zaehlung und App Attest fehlten
// ganz, ein Verantwortlicher mit Namen auch. Apple vergleicht die Erklaerung
// mit dem App-Datenschutz-Fragebogen; eine falsche ist ein Ablehnungsgrund.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const lies = (...t) => readFileSync(join(WURZEL, ...t), "utf8");
const DS = lies("public", "privacy.html");
const ohneTags = (h) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

test("Jeder Datenbank-Zweig, den die Regeln erlauben, steht in der Erklaerung", () => {
  // Die Regeln sind die Liste dessen, was ueberhaupt gespeichert werden KANN —
  // ein neuer Zweig muss zuerst dort hinein (CLAUDE.md, Sicherheitsregeln).
  // Damit zwingt dieser Test, ihn auch hier zu nennen.
  const zweige = Object.keys(JSON.parse(lies("firebase-rules-PASTE.json")).rules).filter((k) => !k.startsWith("."));
  assert.ok(zweige.length >= 5, `zu wenige Zweige gelesen: ${zweige}`);
  const fehlend = zweige.filter((z) => !DS.includes(`<code>${z}</code>`));
  assert.deepEqual(fehlend, [], `Zweig(e) ohne Erwaehnung in privacy.html: ${fehlend.join(", ")}`);
});

test("Verantwortlicher: Name und Kontakt wie im Impressum", () => {
  const imp = ohneTags(lies("public", "impressum.html"));
  const mail = (imp.match(/E-Mail:\s*([^\s]+@[^\s]+)/) || [])[1];
  assert.ok(mail, "keine E-Mail im Impressum gefunden");
  assert.ok(DS.includes(`mailto:${mail}`), `Erklaerung nennt nicht dieselbe E-Mail (${mail})`);
  const abschnitt = ohneTags(DS.slice(DS.indexOf("Verantwortlicher"), DS.indexOf("</section>", DS.indexOf("Verantwortlicher"))));
  assert.match(abschnitt, /Verantwortlich .* ist Steffen Karjoth/, "Verantwortlicher ohne Namen");
  assert.match(DS, /href="impressum\.html"/, "kein Verweis auf das Impressum (Anschrift)");
});

test("Keine ueberholten Behauptungen", () => {
  const text = ohneTags(DS);
  assert.doesNotMatch(text, /unpkg|verlässt überhaupt nichts/, "Satz aus der alten Fassung");
  // reCAPTCHA ist seit v3.117.0 aus dem Browser entfernt; kommt es zurueck,
  // muss die Erklaerung es nennen (und es braucht eine Einwilligung).
  const boot = lies("src", "firebase-boot.js");
  assert.doesNotMatch(boot, /ReCaptcha(V3|Enterprise)Provider/, "reCAPTCHA im Code, aber nicht in der Erklaerung");
  assert.match(text, /Fortschritt löschen/, "Selbst-Loeschung im Spiel wird nicht beschrieben");
  assert.match(text, /Art\. 77|Aufsichtsbehörde/, "Beschwerderecht fehlt");
});

test("Der beschriebene Loesch-Knopf loescht wirklich Cloud UND Bestenliste", () => {
  // Die Erklaerung verspricht: „Fortschritt loeschen" entfernt Geraet,
  // Cloud-Sicherung und Bestenlisten-Eintrag. Das muss im Code stehen.
  const app = lies("src", "game", "app.js");
  const f = app.slice(app.indexOf("async function wipeProgress()"), app.indexOf("async function wipeProgress()") + 2000);
  assert.match(f, /`players\/\$\{uid\}`/, "wipeProgress loescht die Cloud-Sicherung nicht");
  assert.match(f, /`leaderboard\/\$\{k\}`/, "wipeProgress loescht den Bestenlisten-Eintrag nicht");
  assert.match(f, /fb\.delete\(pfad\)/, "wipeProgress ruft kein fb.delete auf");
});
