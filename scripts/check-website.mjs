/* Prueft die Website, bevor sie online geht.
 *
 * **Warum eine eigene Pruefung.** Diese Seiten sind das einzige Stueck des
 * Projekts, an dem ein Fehler nicht nur aergerlich, sondern teuer ist: Ein
 * toter Verweis aufs Impressum ist in Deutschland abmahnfaehig, eine
 * Textluecke darin ebenso, und eine Datenschutz-Adresse, die ins Leere geht,
 * lehnt Apple bei der Einreichung ab.
 *
 * **Ohne Browser, und das ist keine Abkuerzung.** Die wichtigste Zusage der
 * Seite lautet: keine fremde Anfrage, also keine Cookies, also kein
 * Zustimmungsfenster. Bei einer Seite mit Skripten muesste man das messen.
 * Diese Seite hat keine — und genau das wird hier geprueft. Ist kein Skript
 * da und zeigt keine Adresse nach draussen, kann zur Laufzeit auch nichts
 * nachgeladen werden. Der Beweis steht damit im Quelltext.
 *
 *   Aufruf:  node scripts/check-website.mjs [ordner]
 *   Vorgabe: build/website
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ordner = process.argv[2] || "build/website";
const fehler = [];
const sag = (ok, text) => {
  console.log((ok ? "  ok   " : "  FEHL ") + text);
  if (!ok) fehler.push(text);
};

if (!existsSync(ordner)) {
  console.error(`Ordner ${ordner} gibt es nicht — erst scripts/website-bauen.sh laufen lassen.`);
  process.exit(1);
}

const seiten = readdirSync(ordner).filter(f => f.endsWith(".html")).sort();
sag(seiten.includes("index.html"), "index.html vorhanden");
for (const pflicht of ["impressum.html", "privacy.html", "agb.html"]) {
  sag(seiten.includes(pflicht), `${pflicht} vorhanden`);
}

console.log("\nQuelltext");

for (const datei of seiten) {
  const html = readFileSync(join(ordner, datei), "utf8");
  const ohneKommentar = html.replace(/<!--[\s\S]*?-->/g, "");

  sag(/<html lang="de">/.test(html), `${datei}: Sprache ausgezeichnet`);

  const titel = html.match(/<title>([^<]+)<\/title>/);
  sag(!!titel && titel[1].length >= 10 && titel[1].length <= 70,
      `${datei}: Titel vorhanden und brauchbar lang`);

  const beschreibung = html.match(/<meta name="description" content="([^"]+)"/);
  sag(!!beschreibung, `${datei}: Beschreibung vorhanden`);
  if (beschreibung) {
    // Google schneidet bei rund 160 Zeichen ab; unter 70 verschenkt man die
    // einzige Zeile, mit der man in der Ergebnisliste um Aufmerksamkeit wirbt.
    const n = beschreibung[1].length;
    sag(n >= 70 && n <= 200, `${datei}: Beschreibung ${n} Zeichen (70–200)`);
  }

  // **Jede eckige Klammer im Text ist ein Platzhalter.** Das Impressum steht
  // live mit [VORNAME NACHNAME] und Konsorten — eine Seite mit einer offenen
  // Textluecke im Impressum ist schlimmer als keine Seite.
  const luecken = ohneKommentar.match(/\[[A-ZÄÖÜ][A-ZÄÖÜa-zäöüß0-9 .\-\/]{2,40}\]/g);
  sag(!luecken, `${datei}: keine Platzhalter` + (luecken ? ` — ${[...new Set(luecken)].join(", ")}` : ""));
  const todos = ohneKommentar.match(/TODO[_A-Z]*|FIXME|XXX_/g);
  sag(!todos, `${datei}: keine offenen Merkzettel` + (todos ? ` — ${[...new Set(todos)].join(", ")}` : ""));

  // Beim Entfernen eines Platzhalters kann die zweite Zeile eines
  // zweizeiligen Kommentars stehenbleiben — ein `-->` ohne Anfang. Der
  // Browser zeigt so etwas als TEXT an, mitten auf der Seite.
  sag(!ohneKommentar.includes("-->") && !ohneKommentar.includes("<!--"),
      `${datei}: keine losen Kommentarzeichen`);

  // **Keine Skripte.** Darauf steht das Cookie-Versprechen. Ausgenommen sind
  // Auszeichnungsdaten (ld+json), die nichts ausfuehren und nichts laden.
  const skripte = [...html.matchAll(/<script\b([^>]*)>/gi)]
    .filter(m => !/type\s*=\s*["']application\/ld\+json["']/i.test(m[1]));
  sag(skripte.length === 0, `${datei}: kein ausfuehrbares Skript`);

  // **Keine fremde Ressource.** Verweise (`href` auf eine andere Seite) sind
  // erlaubt — geladen wird dabei nichts, bis jemand klickt. Verboten ist, was
  // der Browser von sich aus holt: Bilder, Stile, Schriften, Rahmen.
  //
  // Bei <link> entscheidet das `rel`: `stylesheet` holt etwas, `canonical`
  // nicht. Ohne diese Unterscheidung meldete die Pruefung die eigene
  // kanonische Adresse als fremden Server — ein Fehlalarm, der nach zweimal
  // Wegsehen dafuer sorgt, dass man auch den echten Fund uebersieht.
  const HOLT = /\b(stylesheet|icon|apple-touch-icon|manifest|preload|modulepreload|prefetch|preconnect|dns-prefetch)\b/i;
  const geladen = [...html.matchAll(/<(img|link|script|iframe|source|video|audio|embed|object)\b([^>]*)>/gi)]
    .filter(m => m[1].toLowerCase() !== "link" || HOLT.test((m[2].match(/rel\s*=\s*["']([^"']+)["']/i) || [, ""])[1]))
    .flatMap(m => [...m[2].matchAll(/(?:src|href|srcset|data)\s*=\s*["']([^"']+)["']/gi)].map(a => a[1]))
    .filter(u => /^(https?:)?\/\//i.test(u));
  sag(geladen.length === 0,
      `${datei}: laedt nichts von fremden Servern` + (geladen.length ? ` — ${geladen.join(", ")}` : ""));
  const importiert = html.match(/@import|url\(\s*["']?https?:/gi);
  sag(!importiert, `${datei}: kein fremder Stil eingebunden`);
}

console.log("\nVerweise");

// Jeder seiteninterne Verweis muss auf eine Datei zeigen, die es gibt. Ein
// toter Verweis auf das Impressum ist der teuerste von allen.
for (const datei of seiten) {
  const html = readFileSync(join(ordner, datei), "utf8");
  const ziele = [...html.matchAll(/(?:href|src)\s*=\s*["']([^"'#][^"']*)["']/g)]
    .map(m => m[1])
    .filter(u => !/^(https?:|mailto:|tel:|data:|\/\/)/i.test(u))
    .map(u => u.split("#")[0].split("?")[0])
    .filter(Boolean);
  for (const ziel of [...new Set(ziele)]) {
    const pfad = ziel.startsWith("/") ? join(ordner, ziel.slice(1)) : join(ordner, ziel);
    sag(existsSync(pfad), `${datei}: Verweis "${ziel}" fuehrt irgendwohin`);
  }
}

// Von der Startseite aus muessen die Pflichtseiten mit EINEM Klick erreichbar
// sein. Zwei waeren erlaubt, einer ist die Zusage im Fuss.
{
  const start = readFileSync(join(ordner, "index.html"), "utf8");
  for (const ziel of ["impressum.html", "privacy.html", "agb.html"]) {
    sag(start.includes(`href="${ziel}"`), `index.html: Verweis auf ${ziel}`);
  }
  sag(start.includes("skkjbeer.github.io/Fortress"),
      "index.html: das Spiel ist verlinkt (sonst ist die Seite zwecklos)");
}

console.log("\nBilder");

{
  // Bilder sind der Teil, den jemand im Zug ueber Mobilfunk laedt. Ein
  // Telefonbild als PNG wiegt schnell ein Megabyte — bei vieren davon bricht
  // der Besuch ab, bevor die Seite steht.
  const bilder = join(ordner, "bilder");
  const dateien = existsSync(bilder) ? readdirSync(bilder) : [];
  sag(dateien.length > 0, "Bilder vorhanden");
  let gesamt = 0;
  for (const f of dateien) {
    const n = statSync(join(bilder, f)).size;
    gesamt += n;
    sag(n <= 400 * 1024, `bilder/${f}: ${Math.round(n / 1024)} kB (hoechstens 400)`);
    sag([".jpg", ".png", ".svg", ".webp"].includes(extname(f)), `bilder/${f}: brauchbares Format`);
  }
  sag(gesamt <= 1400 * 1024, `Bilder zusammen ${Math.round(gesamt / 1024)} kB (hoechstens 1400)`);

  // Jedes Bild braucht einen Alternativtext, und zwar einen, der etwas sagt.
  const start = readFileSync(join(ordner, "index.html"), "utf8");
  const bildTags = [...start.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  for (const tag of bildTags) {
    const alt = tag.match(/alt\s*=\s*["']([^"']*)["']/);
    const quelle = (tag.match(/src\s*=\s*["']([^"']+)["']/) || [, "?"])[1];
    sag(!!alt && alt[1].trim().length >= 25, `${quelle}: Alternativtext beschreibt das Bild`);
    sag(/width\s*=/.test(tag) && /height\s*=/.test(tag),
        `${quelle}: Masse angegeben (sonst springt die Seite beim Laden)`);
  }
}

console.log("");
if (fehler.length) {
  console.log(`${fehler.length} Punkt(e) offen — die Seite geht so nicht online:`);
  fehler.forEach(f => console.log("  · " + f));
  process.exit(1);
}
console.log("Alles in Ordnung.");
