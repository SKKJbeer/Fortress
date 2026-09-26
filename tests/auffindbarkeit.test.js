// Auffindbarkeit (v3.115.0) — was Suchmaschinen und Vorschau-Dienste sehen.
//
// Anlass: Eine Websuche nach „Stack & Siege" und nach der Website-Adresse
// fand im September 2026 NICHTS. Die Website war technisch sauber, aber
// Suchmaschinen kannten sie nicht, das Symbol war fuer die Suche unsichtbar
// (Datenadresse), Vorschaubilder waren hochkant, und acht interne Seiten
// (Studien, Diagnose, ein Vortrag) standen indexierbar neben dem Spiel.
//
// Nebenbefund, ebenfalls hier festgehalten: `deploy.yml` fand seit v3.79.0 die
// Versionsnummer nicht mehr (`&` gegen `&amp;`) — kein Tag, kein Release.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..");
const lies = (...t) => readFileSync(join(WURZEL, ...t), "utf8");
const WEB = lies("docs", "website", "index.html");
const KOPF = WEB.slice(0, WEB.indexOf("</head>"));
const entity = (s) => s.replace(/&amp;/g, "&");
const meta = (h, attr, name) => {
  const m = h.match(new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`));
  return m ? entity(m[1]) : null;
};

/** Breite und Hoehe eines JPEG aus dem SOF-Kopf. */
function jpegMasse(pfad) {
  const d = readFileSync(pfad);
  let i = 2;
  while (i < d.length) {
    if (d[i] !== 0xff) { i++; continue; }
    const m = d[i + 1];
    if (m === 0xc0 || m === 0xc2) return { h: d.readUInt16BE(i + 5), w: d.readUInt16BE(i + 7) };
    i += 2 + d.readUInt16BE(i + 2);
  }
  return null;
}

test("Website: Titel und Beschreibung passen in die Trefferanzeige", () => {
  const titel = entity((KOPF.match(/<title>([^<]+)<\/title>/) || [])[1] || "");
  assert.ok(titel.length >= 30 && titel.length <= 60, `Titel ${titel.length} Zeichen: ${titel}`);
  const beschr = meta(KOPF, "name", "description");
  assert.ok(beschr && beschr.length >= 120 && beschr.length <= 160,
    `Beschreibung ${beschr && beschr.length} Zeichen (120–160 werden ganz angezeigt)`);
  assert.match(KOPF, /<link rel="canonical" href="https:\/\/stack-and-siege\.pages\.dev\/">/);
});

test("Website: Vorschaubild ist quer, existiert und die Masse stimmen", () => {
  const url = meta(KOPF, "property", "og:image");
  assert.ok(url && url.startsWith("https://stack-and-siege.pages.dev/"), "og:image fehlt");
  const datei = join(WURZEL, "docs", "website", url.replace("https://stack-and-siege.pages.dev/", ""));
  assert.ok(existsSync(datei), `og:image zeigt ins Leere: ${datei}`);
  const m = jpegMasse(datei);
  assert.ok(m, "og:image ist kein lesbares JPEG");
  assert.ok(m.w > m.h, `og:image ist hochkant (${m.w}x${m.h}) — Vorschauen schneiden es ab`);
  assert.equal(Number(meta(KOPF, "property", "og:image:width")), m.w);
  assert.equal(Number(meta(KOPF, "property", "og:image:height")), m.h);
});

test("Website: Symbol als abrufbare Datei, nicht als Datenadresse", () => {
  const icons = [...KOPF.matchAll(/<link rel="icon" href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(icons.length > 0, "kein Symbol");
  assert.ok(icons.every((h) => !h.startsWith("data:")),
    "Datenadresse als Symbol — Google zeigt nur abrufbare Dateien neben Treffern");
  assert.ok(existsSync(join(WURZEL, "docs", "website", "favicon.svg")));
  assert.match(lies("scripts", "website-bauen.sh"), /^cp public\/icon-192\.png "\$ZIEL\/icon-192\.png"$/m,
    "Die Website verweist auf /icon-192.png, der Bau legt es aber nicht dazu");
});

test("Website: strukturierte Daten sind gueltiges JSON und beschreiben das Spiel", () => {
  const roh = (WEB.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  assert.ok(roh, "keine strukturierten Daten");
  const d = JSON.parse(roh);
  const knoten = d["@graph"] || [d];
  const spiel = knoten.find((k) => k["@type"] === "VideoGame");
  assert.ok(spiel, "kein VideoGame-Knoten");
  for (const f of ["name", "description", "url", "image", "offers", "gamePlatform"])
    assert.ok(spiel[f], `VideoGame.${f} fehlt`);
  assert.equal(spiel.offers.price, "0");
  assert.ok(knoten.some((k) => k["@type"] === "WebSite"), "kein WebSite-Knoten (Seitenname in Treffern)");
  const bild = spiel.image.replace("https://stack-and-siege.pages.dev/", "");
  assert.ok(existsSync(join(WURZEL, "docs", "website", bild)), `image zeigt ins Leere: ${bild}`);
});

test("IndexNow: Schluesseldatei und Ablauf nennen DENSELBEN Schluessel", () => {
  const dateien = readdirSync(join(WURZEL, "docs", "website")).filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  assert.equal(dateien.length, 1, `genau eine Schluesseldatei erwartet, gefunden: ${dateien.join(", ")}`);
  const schluessel = dateien[0].replace(".txt", "");
  assert.equal(lies("docs", "website", dateien[0]).trim(), schluessel, "Inhalt != Dateiname");
  const ablauf = lies(".github", "workflows", "website.yml");
  assert.match(ablauf, new RegExp(`INDEXNOW_KEY:\\s*${schluessel}\\b`),
    "website.yml meldet mit einem anderen Schluessel — IndexNow wiese jede Meldung ab");
  assert.match(ablauf, /https:\/\/api\.indexnow\.org\/indexnow/);
});

test("Interne Seiten stehen nicht im Index, Rechtstexte zeigen auf die Website", () => {
  const intern = ["balancing", "diagnose", "kanonentaktik", "review", "stats", "talk", "uebersicht", "waffen"];
  for (const n of intern)
    assert.match(lies("public", `${n}.html`), /<meta name="robots" content="noindex">/, `${n}.html ohne noindex`);
  for (const n of ["agb", "impressum", "privacy"]) {
    const s = lies("public", `${n}.html`);
    assert.doesNotMatch(s, /name="robots" content="noindex"/, `${n}.html darf gefunden werden`);
    assert.match(s, new RegExp(`<link rel="canonical" href="https://stack-and-siege\\.pages\\.dev/${n}">`),
      `${n}.html liegt doppelt und nennt keine massgebliche Adresse`);
  }
  // Jede Seite in public/ ist entweder bewusst intern oder bewusst oeffentlich —
  // eine neue Seite muss hier eingeordnet werden, statt still im Index zu landen.
  const alle = readdirSync(join(WURZEL, "public")).filter((f) => f.endsWith(".html")).map((f) => f.replace(".html", ""));
  const bekannt = new Set([...intern, "agb", "impressum", "privacy"]);
  assert.deepEqual(alle.filter((n) => !bekannt.has(n)), [], "neue Seite in public/ ohne Einordnung");
});

test("Spiel: massgebliche Adresse und ein Text ohne JavaScript", () => {
  const s = lies("index.html");
  assert.match(s, /<link rel="canonical" href="https:\/\/skkjbeer\.github\.io\/Fortress\/"\/>/);
  const ns = (s.match(/<noscript>([\s\S]*?)<\/noscript>/) || [])[1] || "";
  assert.match(ns, /<a href="https:\/\/stack-and-siege\.pages\.dev\/">/, "noscript ohne Weg zur Website");
  assert.ok(ns.replace(/<[^>]+>/g, "").trim().length > 80, "noscript zu duenn");
});

test("deploy.yml findet die Versionsnummer wirklich (seit v3.79.0 leer)", () => {
  const ablauf = lies(".github", "workflows", "deploy.yml");
  const zeile = (ablauf.match(/VERSION=\$\(grep -oP '([^']+)' index\.html/) || [])[1];
  assert.ok(zeile, "Versions-Zeile in deploy.yml nicht gefunden");
  // Das PCRE-Muster in JavaScript nachbilden: `\K` verwirft alles davor.
  const [vor, nach] = zeile.split("\\K");
  assert.ok(nach, "Muster ohne \\K — Aufbau geaendert?");
  const m = lies("index.html").match(new RegExp(vor + "(" + nach + ")"));
  const version = JSON.parse(lies("package.json")).version;
  assert.ok(m, "das Muster aus deploy.yml findet in index.html NICHTS — kein Tag, kein Release");
  assert.equal(m[m.length - 1], version);
  assert.match(ablauf, /\[ -n "\$VERSION" \] \|\| \{/, "leere Version darf nicht weiterlaufen");
});
