#!/usr/bin/env node
/**
 * Die iOS-Huelle pruefen, ohne einen Mac und ohne zu bauen.
 *
 * **Warum das hier steht.** Der iOS-Lauf braucht rund zehn Minuten auf einem
 * macOS-Laeufer. Ein falscher Eintrag in der Info.plist, eine
 * auseinandergelaufene Bundle-Kennung oder ein Icon mit Alphakanal faellt dort
 * fruehestens nach sechs Minuten auf — und bei der Alphakanal-Sache sogar erst
 * bei Apple, nach dem Hochladen. Diese Pruefungen laufen in einer Sekunde und
 * lassen sich vor jedem Commit ausfuehren.
 *
 * **Was hier NICHT hingehoert.** Alles, was sich nur zur Laufzeit zeigt. Ein
 * statischer Test kann nicht sehen, ob die App startet oder ob man in ein
 * Textfeld schreiben kann; dafuer gibt es den Probelauf im Simulator
 * (.github/workflows/ios.yml). Hier steht nur, was in Dateien steht.
 *
 * Jede Pruefung nennt ihren GRUND. Eine Regel, deren Begruendung niemand mehr
 * kennt, wird beim naechsten Umbau weggeraeumt — meistens zu Recht, manchmal
 * nicht.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lies = (p) => fs.readFileSync(path.join(WURZEL, p), "utf8");
const gibt = (p) => fs.existsSync(path.join(WURZEL, p));

let fehler = 0, geprueft = 0;
const ok = (m) => { geprueft++; console.log("  ok   " + m); };
const weh = (m, grund) => { geprueft++; fehler++; console.log("  FEHL " + m + "\n         → " + grund); };
const pruefe = (bedingung, m, grund) => bedingung ? ok(m) : weh(m, grund);
const abschnitt = (t) => console.log("\n" + t);

// ── Info.plist ────────────────────────────────────────────────────────────
abschnitt("Info.plist");
const plist = lies("ios/App/App/Info.plist");
const array = (schluessel) => {
  const i = plist.indexOf(`<key>${schluessel}</key>`);
  if (i < 0) return null;
  const a = plist.indexOf("<array>", i), e = plist.indexOf("</array>", a);
  return a < 0 || e < 0 ? null : plist.slice(a, e);
};
const wahr = (schluessel) => {
  const i = plist.indexOf(`<key>${schluessel}</key>`);
  return i >= 0 && /<true\s*\/>/.test(plist.slice(i, i + 120));
};
const falsch = (schluessel) => {
  const i = plist.indexOf(`<key>${schluessel}</key>`);
  return i >= 0 && /<false\s*\/>/.test(plist.slice(i, i + 120));
};

const ipad = array("UISupportedInterfaceOrientations~ipad");
pruefe(ipad && !/Landscape/.test(ipad), "iPad: kein Querformat",
  "Quer fuellt das Brett nur 29-35 % des Schirms statt 68-73 % (v3.87.0 gemessen). " +
  "44x68 Zellen sind hoch; auf einem querliegenden iPad bleibt links und rechts je ~400 px tot.");
pruefe(ipad && /Portrait/.test(ipad), "iPad: Hochformat erlaubt",
  "Ohne Hochformat startet die App auf dem iPad gar nicht.");

const iphone = array("UISupportedInterfaceOrientations");
pruefe(iphone && !/Landscape/.test(iphone), "iPhone: kein Querformat",
  "Dasselbe Argument wie beim iPad, nur noch deutlicher.");

pruefe(falsch("ITSAppUsesNonExemptEncryption"),
  "Verschluesselungs-Erklaerung steht auf false",
  "Fehlt sie, fragt Apple sie nach JEDEM Hochladen einzeln ab, und der Bau " +
  "bleibt so lange fuer Tester gesperrt. Das Spiel benutzt keine eigene " +
  "Verschluesselung — nur HTTPS, und das ist ausgenommen.");

pruefe(wahr("UIRequiresFullScreen"), "Vollbild erzwungen",
  "Ohne das erwartet iPadOS Split View. Zwei Spieler an einem Geraet sitzen " +
  "sich an den kurzen Kanten gegenueber; ein halbes Fenster ergibt dabei keinen Sinn.");

pruefe(/<key>CFBundleDisplayName<\/key>\s*<string>[^<]+<\/string>/.test(plist),
  "Anzeigename gesetzt", "Ohne ihn steht auf dem Hausbildschirm der Zielname aus Xcode.");

pruefe(/\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate/.test(plist),
  "Szenen-Delegat verweist auf SceneDelegate",
  "Steht dort ein anderer Name, startet die App mit einer leeren Ansicht.");

// ── Xcode-Projekt ─────────────────────────────────────────────────────────
abschnitt("Xcode-Projekt");
const pbx = lies("ios/App/App.xcodeproj/project.pbxproj");
const alle = (muster) => [...pbx.matchAll(muster)].map((m) => m[1].trim());

const familien = alle(/TARGETED_DEVICE_FAMILY = ([^;]+);/g);
pruefe(familien.length > 0 && familien.every((f) => f.replace(/"/g, "") === "1,2"),
  `Geraetefamilie 1,2 (iPhone + iPad) in allen ${familien.length} Konfigurationen`,
  "Faellt das iPad heraus, sind die iPad-Bildschirmfotos im Store ploetzlich " +
  "ueberfluessig — und umgekehrt verlangt Apple sie, sobald es drinsteht. " +
  `Gefunden: ${familien.join(" / ") || "nichts"}`);

const ziele = alle(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g);
pruefe(ziele.length > 0 && new Set(ziele).size === 1,
  `Mindest-iOS einheitlich (${ziele[0] || "?"})`,
  `Verschiedene Werte je Konfiguration heissen: Es laeuft im Simulator und ` +
  `nicht auf dem Geraet, oder umgekehrt. Gefunden: ${[...new Set(ziele)].join(" / ")}`);

const kennungen = alle(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g);
pruefe(kennungen.length > 0 && new Set(kennungen).size === 1,
  "Bundle-Kennung im Projekt einheitlich",
  `Zwei verschiedene Kennungen ergeben zwei verschiedene Apps. Gefunden: ${[...new Set(kennungen)].join(" / ")}`);

// ── Eine Kennung, viele Dateien ───────────────────────────────────────────
abschnitt("Bundle-Kennung ueber alle Dateien");
const soll = kennungen[0];
const stellen = [
  ["capacitor.config.json", (t) => (JSON.parse(t).appId || "").trim()],
  // NICHT die erste <key> der Datei nehmen: Das ist `method`. Die Kennung
  // steht als Schluessel INNERHALB von provisioningProfiles.
  ["ios/ExportOptions.plist", (t) => {
    const i = t.indexOf("<key>provisioningProfiles</key>");
    return i < 0 ? null : (t.slice(i).match(/<key>([^<]+)<\/key>/g) || [])[1]?.replace(/<\/?key>/g, "");
  }],
  ["scripts/asc.py", (t) => (t.match(/^BUNDLE = "([^"]+)"/m) || [])[1]],
  ["scripts/asc-testflight.py", (t) => (t.match(/^BUNDLE = "([^"]+)"/m) || [])[1]],
  ["scripts/testflight-stand.py", (t) => (t.match(/^BUNDLE = "([^"]+)"/m) || [])[1]],
  ["scripts/asc-profil.py", (t) => (t.match(/^BUNDLE = "([^"]+)"/m) || [])[1]],
];
const abweichend = stellen
  .filter(([datei]) => gibt(datei))
  .map(([datei, aus]) => [datei, aus(lies(datei))])
  .filter(([, wert]) => wert !== soll);
pruefe(abweichend.length === 0,
  `Kennung ${soll} steht in allen ${stellen.length} Dateien gleich`,
  "Laeuft eine davon weg, fragt ein Skript eine App ab, die es nicht gibt — " +
  "und meldet ungeruehrt »kein Eintrag gefunden«. Abweichend: " +
  abweichend.map(([d, w]) => `${d}=${w}`).join(", "));

const cap = JSON.parse(lies("capacitor.config.json"));
pruefe(cap.webDir === "dist", "Capacitor liefert dist/ aus",
  "Ein Build fuer Web UND App ist die Grundregel dieses Projekts " +
  "(ARCHITEKTUR.md). Zeigt webDir woandershin, weichen App und Web ab.");

// ── Storyboard und Swift duerfen nicht auseinanderlaufen ──────────────────
abschnitt("Storyboard und Swift");
const storyboard = lies("ios/App/App/Base.lproj/Main.storyboard");
const swift = fs.readdirSync(path.join(WURZEL, "ios/App/App"))
  .filter((d) => d.endsWith(".swift"))
  .map((d) => lies(`ios/App/App/${d}`)).join("\n");
const klassen = [...swift.matchAll(/class\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
const genannt = [...storyboard.matchAll(/customClass="([^"]+)"/g)].map((m) => m[1]);
const unbekannt = genannt.filter((k) => !klassen.includes(k));
pruefe(unbekannt.length === 0,
  `Storyboard nennt nur vorhandene Klassen (${genannt.join(", ") || "keine"})`,
  "Eine Klasse, die es nicht gibt, faellt erst beim Start auf — als leerer " +
  "Bildschirm, nicht als Fehler. Unbekannt: " + unbekannt.join(", "));

// ── Der Fehler von v3.86.0 darf nicht zurueckkommen ───────────────────────
abschnitt("Textbedienung (Regression v3.86.0)");
const ohneKommentar = swift.split("\n").filter((z) => !z.trim().startsWith("//")).join("\n");
pruefe(!/isTextInteractionEnabled\s*=\s*false/.test(ohneKommentar),
  "Textbedienung wird nirgends fest auf false gesetzt",
  "v3.86.0 hat sie beim Erzeugen der Ansicht abgeschaltet. `false` heisst laut " +
  "Apple »nicht auswaehlen UND NICHT BEARBEITEN«: Ab dem ersten Bild war jedes " +
  "Eingabefeld tot, und das erste Bild fuer einen neuen Spieler ist der " +
  "Profil-Editor mit dem Namensfeld. Ausgeschaltet werden darf sie nur auf " +
  "Zuruf der Weboberflaeche — dann ist der schlimmste Fall die Lupe, nicht " +
  "eine unbedienbare App.");

// ── Bilder ────────────────────────────────────────────────────────────────
abschnitt("Symbole und Startbild");
const iconOrdner = "ios/App/App/Assets.xcassets/AppIcon.appiconset";
const icons = fs.readdirSync(path.join(WURZEL, iconOrdner)).filter((d) => d.endsWith(".png"));
pruefe(icons.length > 0, `App-Symbol vorhanden (${icons.join(", ")})`,
  "Ohne Symbol lehnt Apple den Upload ab.");
for (const datei of icons) {
  const b = fs.readFileSync(path.join(WURZEL, iconOrdner, datei));
  const breite = b.readUInt32BE(16), hoehe = b.readUInt32BE(20), farbtyp = b[25];
  pruefe(breite === 1024 && hoehe === 1024, `${datei} ist 1024x1024`,
    `Apple verlangt genau 1024x1024. Gefunden: ${breite}x${hoehe}`);
  pruefe(farbtyp !== 4 && farbtyp !== 6, `${datei} ohne Alphakanal`,
    "Apple weist Symbole mit Alphakanal ab — und zwar erst NACH dem Hochladen, " +
    "per E-Mail, wenn der ganze Lauf durch ist.");
}
const splash = "ios/App/App/Assets.xcassets/Splash.imageset";
pruefe(gibt(splash) && fs.readdirSync(path.join(WURZEL, splash)).filter((d) => d.endsWith(".png")).length >= 1,
  "Startbild vorhanden",
  "Ohne Startbild zeigt iOS beim Start eine weisse Flaeche — auf einem dunklen Spiel besonders haesslich.");

// ── Ergebnis ──────────────────────────────────────────────────────────────
console.log(`\n${geprueft} Pruefungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
