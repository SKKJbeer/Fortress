// Store-Texte (ASO) — deutsch und englisch (v3.117.x).
//
// Anlass: Die deutschen Schlagworte enthielten „tetris" (fremde Marke —
// Apple lehnt das nach Richtlinie 2.3.7 ab) und „rundenbasiert" (falsch:
// gespielt wird gleichzeitig in Phasen mit Uhr), dazu Woerter, die schon in
// Name und Untertitel stehen und im Schlagwortfeld nur Platz kosten. Einen
// englischen Eintrag gab es gar nicht.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { LANGS } from "../src/i18n.js";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const lies = (...t) => readFileSync(join(WURZEL, ...t), "utf8");
const bloecke = (datei) => {
  const t = lies("store", datei).split("## Google Play")[0];
  const out = {};
  for (const m of t.matchAll(/### ([^\n(]+)[^\n]*\n+```\n([\s\S]*?)\n```/g)) out[m[1].trim()] = m[2].trim();
  return out;
};
const GRENZEN = { Name: 30, Untertitel: 30, Werbetext: 170, Beschreibung: 4000, "Schlüsselwörter": 100 };
// Fremde Marken und Titel. Apple lehnt sie in Schlagworten ab, und CLAUDE.md
// verbietet Verweise auf andere Spiele ueberhaupt.
const MARKEN = /\b(tetris|rampart|minecraft|fortnite|clash|roblox|pubg|candy ?crush|angry ?birds|apple|iphone|ipad|android|google)\b/i;
const FALSCH = /\b(rundenbasiert|turn-?based)\b/i;
const woerter = (s) => s.toLowerCase().split(/[^a-zäöüß0-9]+/).filter((w) => w.length > 1);

for (const [datei, sprache] of [["listing.md", "de"], ["listing-en.md", "en"]]) {
  const b = bloecke(datei);
  test(`Store ${sprache}: alle Felder da und innerhalb der Grenzen`, () => {
    for (const [feld, grenze] of Object.entries(GRENZEN)) {
      assert.ok(b[feld], `${feld} fehlt in ${datei}`);
      assert.ok(b[feld].length <= grenze, `${feld}: ${b[feld].length} > ${grenze}`);
    }
  });
  test(`Store ${sprache}: Schlagworte ohne Marken, ohne falsche Begriffe, ohne Doppelungen`, () => {
    const kw = b["Schlüsselwörter"];
    assert.doesNotMatch(kw, /\s/, "Leerzeichen kosten Zeichen — Apple trennt am Komma");
    assert.doesNotMatch(kw, MARKEN, "fremde Marke im Schlagwortfeld");
    assert.doesNotMatch(kw, FALSCH, "falscher Genre-Begriff");
    const titel = new Set([...woerter(b.Name), ...woerter(b.Untertitel)]);
    const doppelt = kw.split(",").filter((w) => titel.has(w.toLowerCase()));
    assert.deepEqual(doppelt, [], `steht schon in Name/Untertitel: ${doppelt}`);
    const liste = kw.split(",");
    assert.equal(new Set(liste).size, liste.length, "Schlagwort doppelt");
  });
  test(`Store ${sprache}: keine Marken oder fremden Spieletitel in Name, Untertitel, Texten`, () => {
    for (const feld of ["Name", "Untertitel", "Werbetext", "Beschreibung"]) {
      assert.doesNotMatch(b[feld], MARKEN, `${feld} nennt eine fremde Marke`);
      assert.doesNotMatch(b[feld], FALSCH, `${feld} nennt einen falschen Genre-Begriff`);
    }
  });
}

test("Store en: Begriffe wie im Spiel (Wall Breaker, Slayer, spoils)", () => {
  const en = Object.values(LANGS.en).join(" ").toLowerCase();
  const b = bloecke("listing-en.md").Beschreibung;
  for (const [imText, imSpiel] of [["Wall Breaker", "wall breaker"], ["Slayer", "slayer"], ["Spoils", "spoils"]]) {
    assert.ok(b.includes(imText), `Beschreibung nennt ${imText} nicht`);
    assert.ok(en.includes(imSpiel), `das Spiel nennt ${imSpiel} nicht — Beschreibung und Spiel sprechen verschieden`);
  }
});

test("asc-sprachen.py schreibt en-US UND en-GB, mit denselben Grenzen wie asc.py", () => {
  const s = lies("scripts", "asc-sprachen.py");
  assert.match(s, /SPRACHEN = \["en-US", "en-GB"\]/);
  assert.match(s, /GRENZEN = \{"Name": 30, "Untertitel": 30, "Werbetext": 170,\s*\n\s*"Beschreibung": 4000, "Schlüsselwörter": 100\}/);
  // Schreiben nur mit --eintragen.
  assert.match(s, /schreiben = "--eintragen" in sys\.argv\[1:\]/);
});
