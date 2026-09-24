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

// ── Der Marker, an dem der Simulator-Probelauf haengt ─────────────────────
// Ohne diese Pruefung koennte jemand die NSLog-Zeile entfernen, und der
// Probelauf im Ablauf wuerde still zu dem, was er schon einmal war: eine
// Pruefung, die nicht fehlschlagen kann.
abschnitt("Lebenszeichen fuer den Simulator-Probelauf");
const MARKER = "STACK-SIEGE-BEREIT Bruecke steht";
pruefe(swift.includes(MARKER), `Swift schreibt den Marker (${MARKER})`,
  "Der Simulator-Probelauf in .github/workflows/ios.yml sucht genau diese " +
  "Zeichenkette im Systemprotokoll. Fehlt sie, schlaegt der Lauf fehl — " +
  "richtig so, aber die Ursache steht dann im Ablauf und nicht hier.");
pruefe(/override func viewDidLoad/.test(swift) &&
       /userContentController[\s\S]{0,400}add\(self, name: "textfeld"\)/.test(swift),
  "Der Kanal wird am lebenden WebView angemeldet (viewDidLoad)",
  "Die Anmeldung an der Konfiguration allein GENUEGT NICHT — im Probelauf " +
  "gemessen: Capacitor tauscht den Inhaltssteuerer aus, und die Anmeldung geht " +
  "verloren. Faellt viewDidLoad weg, schweigt die Bruecke, und die " +
  "Lupen-Umschaltung wirkt nicht mehr.");
const ablauf = lies(".github/workflows/ios.yml");
pruefe(ablauf.includes(MARKER), "Der Ablauf sucht denselben Marker",
  "Laufen die beiden auseinander, prueft der Probelauf ins Leere und meldet " +
  "trotzdem Erfolg oder Misserfolg — beides ohne Bezug zur Sache.");

// ── Online-Probe auf dem Geraet ───────────────────────────────────────────
//
// WARUM das hier steht und nicht nur im Ablauf: In Bau 29 und 30 war Online in
// der App vollstaendig tot — keine Anmeldung, keine Verbindung —, und die
// E2E-Suite meldete 462 gruene Pruefungen. Keine davon konnte es sehen:
// `FB_SPERRE` verhindert, dass firebase-boot.js ueberhaupt laeuft, und der
// Simulator-Probelauf pruefte nur, DASS die App startet.
//
// Seit v3.111.7 meldet die App beim Start ihre Verbindungsauskunft ueber den
// Kanal `pruefung` ins Systemprotokoll, und der Probelauf verlangt eine uid
// UND eine gemessene Lesezeit. Diese drei Pruefungen halten die Kette
// zusammen: Weboberflaeche → Huelle → Ablauf. Faellt ein Glied weg, prueft der
// Probelauf ins Leere und meldet trotzdem Erfolg.
abschnitt("Online-Probe (Kette Weboberflaeche → Huelle → Ablauf)");
const NETZ_MARKER = "STACK-SIEGE-NETZ";
// Gesucht wird die DEKLARATION, nicht der Namensanfang: `includes` haette
// auch `meldeAnHuelleWEG` durchgelassen — in der Gegenprobe genau so passiert.
pruefe(/export function meldeAnHuelle\s*\(/.test(lies("src/platform.ts")),
  "platform.ts bietet meldeAnHuelle an",
  "Ohne sie kann die Weboberflaeche der Huelle nichts melden, und die " +
  "Online-Pruefung im Probelauf findet nie etwas.");
const szene = lies("ios/App/App/SceneDelegate.swift");
pruefe(szene.includes('name: "pruefung"') && szene.includes(NETZ_MARKER),
  "Die Huelle meldet den Kanal `pruefung` an und protokolliert " + NETZ_MARKER,
  "Fehlt der Kanal, verpufft die Meldung der Weboberflaeche. Fehlt NSLog mit " +
  "dem Marker, steht sie nicht im Systemprotokoll — und nur dort liest der " +
  "Probelauf nach (console.log kommt dort NIE an).");
// Gesucht wird das MUSTER der Abbruchbedingung, nicht der Text. Der erste
// Anlauf prueft mit `includes("uid=-")` — und das erfuellte schon der
// Kommentar daneben. Dieselbe Falle wie im Sperren-Riegel eine Stunde zuvor:
// Eine Pruefung, die sich von einer Erwaehnung umstimmen laesst, ist keine.
pruefe(ablauf.includes(NETZ_MARKER)
       && /\*"uid=-"\*/.test(ablauf)
       && /\*"lesen=keine"\*/.test(ablauf)
       && /lesen=\[0-9\]\+ms/.test(ablauf),
  "Der Ablauf bricht bei fehlender uid oder fehlender Lesezeit ab",
  "Nur auf den Marker zu pruefen wuerde genuegen, um gruen zu sein — auch " +
  "wenn dort `uid=- lesen=keine` steht, also genau der kaputte Zustand aus " +
  "Bau 29/30.");

// ── App Check (v3.113.0) ──────────────────────────────────────────────────
//
// Eine Kette aus sechs Gliedern: Start des SDK in der Huelle → Anbieter
// (App Attest bzw. Debug) → Kanal `appcheck` mit Antwort → Brueckenfunktion in
// platform.ts → CustomProvider in firebase-boot.js → Probelauf verlangt
// `ac=ok(`. Faellt ein Glied weg, meldet der Rest trotzdem Erfolg — oder die
// App kommt nach dem Einschalten der Durchsetzung nicht mehr online.
// Gesucht wird ueberall die KONSTRUKTION (Aufruf, Anmeldung, Muster), an
// einer von Kommentaren befreiten Fassung.
abschnitt("App Check (Huelle → Weboberflaeche → Probelauf)");
const ohneKom = (t) => t.split("\n").filter((z) => !z.trim().startsWith("//")).join("\n");
const delegat = ohneKom(lies("ios/App/App/AppDelegate.swift"));
pruefe(/AppCheckStart\.einrichten\(\)/.test(delegat),
  "Die Huelle richtet App Check beim Start ein",
  "Ohne den Aufruf steht keine Firebase-App in der Huelle, und der Kanal " +
  "`appcheck` liefert nie ein Token.");
const bruecke = ohneKom(lies("ios/App/App/AppCheckBruecke.swift"));
pruefe(/#if DEBUG[\s\S]*AppCheckDebugProviderFactory\(\)[\s\S]*#else[\s\S]*AppAttestFabrik\(\)[\s\S]*#endif/.test(bruecke)
       && /AppAttestProvider\(app:\s*app\)/.test(bruecke),
  "Release nimmt App Attest, Debug den Debug-Anbieter",
  "Waere es umgekehrt, liefe die TestFlight-App mit dem Debug-Anbieter — und " +
  "der ist ohne hinterlegtes Token wertlos.");
pruefe(/addScriptMessageHandler\(\s*appCheckKanal\s*,\s*contentWorld:\s*\.page\s*,\s*name:\s*"appcheck"\s*\)/
         .test(ohneKom(szene)),
  "Die Huelle meldet den Kanal `appcheck` (mit Antwort) an",
  "Ohne ihn findet die Weboberflaeche den Kanal nicht und nimmt still gar " +
  "keinen Anbieter — nach der Durchsetzung kaeme die App nicht mehr online.");
const recht = lies("ios/App/App/App.entitlements");
const projekt = lies("ios/App/App.xcodeproj/project.pbxproj");
pruefe(/appattest-environment<\/key>\s*<string>production<\/string>/.test(recht)
       && (projekt.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) || []).length === 2
       && /productName = FirebaseAppCheck;/.test(projekt)
       && /AppCheckBruecke\.swift in Sources \*\/,/.test(projekt),
  "Entitlements, Firebase-Paket und Bruecke stecken im Xcode-Projekt",
  "Eine Datei, die nicht im Projekt steht, wird nicht uebersetzt — und ohne " +
  "die Berechtigung lehnt App Attest auf dem Geraet jede Anfrage ab.");
pruefe(/export function nativesAppCheckToken\s*\(/.test(lies("src/platform.ts"))
       && /new CustomProvider\(/.test(ohneKom(lies("src/firebase-boot.js")))
       && lies("src/firebase-boot.js").indexOf("initializeAppCheck(app")
          < lies("src/firebase-boot.js").indexOf("getDatabase(app)"),
  "Die Weboberflaeche holt das Token ueber die Bruecke, VOR der Datenbank",
  "Wird App Check erst nach getDatabase eingerichtet, gehen die ersten " +
  "Anfragen ohne Token hinaus.");
pruefe(/getToken:\s*async\s*\(\)\s*=>\s*\{[\s\S]{0,300}Promise\.race\(\[[\s\S]{0,120}nativesAppCheckToken\(false\)[\s\S]{0,200}setTimeout\(/
         .test(ohneKom(lies("src/firebase-boot.js"))),
  "Das Token aus der Huelle hat eine Frist",
  "Ohne Frist haengt die ANMELDUNG, sobald die Huelle beim Token haengt — " +
  "App Attest wartet bis zu 60 s aufs Netz. Das waere das Bild aus Bau 29/30.");
pruefe(/SIMCTL_CHILD_FIRAAppCheckDebugToken="\$APPCHECK_DEBUG_TOKEN"/.test(ablauf)
       && /grep -qE 'ac=ok\\\('/.test(ablauf)
       && /if: always\(\)[\s\S]{0,200}--debug-token-weg/.test(ablauf),
  "Der Probelauf verlangt ein Token und raeumt sein Debug-Token weg",
  "Ohne `ac=ok(` waere der Probelauf gruen, auch wenn App Check nie ein " +
  "Token liefert. Ohne das Wegraeumen bliebe ein Generalschluessel liegen.");

// ── Signierung am App-Ziel, nicht auf der Kommandozeile (v3.113.3) ────────
//
// Bau 35: `PROVISIONING_PROFILE_SPECIFIER` auf der Kommandozeile gilt fuer
// ALLE Ziele, auch fuer die Ressourcen-Buendel der Firebase-Pakete — und die
// koennen kein Profil tragen. Archivieren scheiterte an jedem einzelnen.
abschnitt("Signierung (Regression Bau 35)");
const archivZeilen = (ablauf.match(/- name: Archivieren[\s\S]*?\n      - name:/) || [""])[0]
  .split("\n").filter((z) => !z.trim().startsWith("#")).join("\n");
pruefe(archivZeilen.length > 0 && !/PROVISIONING_PROFILE_SPECIFIER=|CODE_SIGN_STYLE=|CODE_SIGN_IDENTITY=/.test(archivZeilen),
  "Der Archivschritt gibt Profil und Signierart NICHT global mit",
  "Auf der Kommandozeile treffen sie auch die Firebase-Buendel, die kein " +
  "Profil tragen koennen — genau daran ist Bau 35 gescheitert.");
const profilName = (lies("scripts/asc-profil.py").match(/^NAME = "([^"]+)"/m) || [])[1];
const releaseZiel = (projekt.match(/504EC3181FED79650016851F \/\* Release \*\/ = \{[\s\S]*?name = Release;/) || [""])[0];
pruefe(!!profilName && releaseZiel.includes(`PROVISIONING_PROFILE_SPECIFIER = "${profilName}";`)
       && /CODE_SIGN_STYLE = Manual;/.test(releaseZiel),
  `Das App-Ziel signiert in Release manuell mit „${profilName}"`,
  "Der Name muss GENAU der sein, den asc-profil.py anlegt — sonst findet " +
  "xcodebuild das Profil nicht.");

// ── Zuordnung an die oeffentliche Gruppe ──────────────────────────────────
//
// Der Upload allein bringt den Bau zu niemandem: Er muss der oeffentlichen
// Gruppe zugeordnet und zur Beta-Pruefung eingereicht werden. Von Hand ist das
// die Sorte Schritt, die man vergisst — am 18.09. lag Bau 30 deshalb
// stundenlang nur intern.
//
// ERWARTE_BAU ist der heikle Teil: Direkt nach dem Upload ist der eigene Bau
// noch in Verarbeitung, und die Zuordnung nimmt sonst den neuesten FERTIGEN,
// also den VORHERIGEN. Genau so wurde einmal Bau 30 statt 31 zugeordnet, bei
// gruenem Ablauf.
abschnitt("Zuordnung an die oeffentliche Gruppe");
pruefe(/- name: Der oeffentlichen Gruppe zuordnen/.test(ablauf),
  "Der iOS-Ablauf ordnet nach dem Upload selbst zu",
  "Sonst bleibt der Bau nur intern sichtbar, bis jemand daran denkt.");
pruefe(/ERWARTE_BAU:\s*\$\{\{\s*github\.run_number\s*\}\}/.test(ablauf),
  "Die Zuordnung wartet auf GENAU den eigenen Bau",
  "Ohne ERWARTE_BAU ordnet sie den vorherigen Bau zu — und meldet Erfolg.");
const tf = lies("scripts/asc-testflight.py");
pruefe(/ERWARTE_BAU/.test(tf) && /Erwartet war Bau/.test(tf),
  "Das Skript kennt ERWARTE_BAU und weist den falschen Bau ab",
  "Der Ablauf koennte die Nummer setzen, ohne dass sie irgendwo wirkt.");

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
