# FORTRESS — Architektur für iOS

> Entwurf, Stand v3.73.0. Dieses Dokument entscheidet die Bauform, **bevor**
> Code entsteht. Es ist die Grundlage für alle folgenden Änderungen und wird
> mitgepflegt.

---

## Leitprinzip: die Web-Version ist die Quelle, iOS ist eine Ableitung

Die spielbare Fassung unter `https://skkjbeer.github.io/Fortress/` bleibt
unangetastet und jederzeit lauffähig. Der iOS-Build **leitet sich daraus ab** —
nie umgekehrt.

Das ist keine Stilfrage, sondern die Absicherung: Solange iOS nur ein
Ableitungsschritt ist, kann kein iOS-Problem die Live-Version beschädigen.
Fällt der Ableitungsschritt aus, bleibt das Web-Spiel unberührt.

**Was sich dadurch NICHT ändert:**

| | |
|---|---|
| `index.html` | bleibt wie sie ist — kompiliertes React, native ES-Module |
| `src/**` | bleibt unverändert |
| Web-Auslieferung | weiterhin **ohne Build-Schritt** |
| `.github/workflows/deploy.yml` | unangetastet |
| Beide Testsuiten | laufen weiter gegen die Web-Fassung |

---

## Warum es für iOS überhaupt einen Build braucht

Die Web-Fassung lädt zur Laufzeit von fremden Servern:

- React + ReactDOM von `unpkg.com`
- Firebase-SDK von `www.gstatic.com`

Für iOS ist das aus zwei Gründen untragbar:

**Richtlinie 2.5.2.** Apple verlangt, dass Apps in sich geschlossen sind und
keinen ausführbaren Code nachladen. Ein CDN-Import von React ist genau das.

**Erster Start ohne Netz.** Ohne Verbindung hätte die App keinerlei Code — nicht
einmal das Menü. Der Service Worker greift erst nach dem ersten erfolgreichen
Laden.

Deshalb muss der iOS-Bundle **alle** Skripte lokal enthalten.

---

## Der Ableitungsschritt: `tools/build-ios.mjs`

Erzeugt `dist-ios/` (generiert, nicht eingecheckt):

1. kopiert `index.html`, `src/`, `sounds/`, Icons, `manifest.json`
2. lädt fünf Fremddateien nach `dist-ios/vendor/`
   — `react.production.min.js`, `react-dom.production.min.js`,
   `firebase-app.js`, `firebase-database.js`, `firebase-auth.js`
3. schreibt die URLs in `index.html` auf `./vendor/…` um
4. schreibt den **internen** Firebase-Import um:
   `from"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"` → `from"./firebase-app.js"`
5. injiziert `window.__NATIVE__ = true` **vor** allen anderen Skripten
6. prüft am Ende, dass in `dist-ios/` **keine** externe URL mehr vorkommt —
   schlägt sonst fehl

### Kein Bundler — bewusst

Der Abhängigkeitsgraph des Firebase-SDK ist gemessen **trivial**: `firebase-app.js`
importiert nichts, `firebase-database.js` und `firebase-auth.js` importieren
jeweils nur `firebase-app.js`. Eine einzige Kante.

Ein Bundler (esbuild) würde eine **zweite Codeform** erzeugen, die man separat
testen müsste — genau die Divergenz zwischen Web und App, die dieses Dokument
verhindern soll. Mit reinem Vendoring führt iOS **denselben** Code aus, nur aus
lokalen Dateien.

Damit bleibt auch die Regel aus `CLAUDE.md` intakt: Für die Web-Auslieferung gibt
es weiterhin keinen Build-Schritt. Der Schritt existiert nur für iOS.

---

## Die Plattform-Weiche: `window.__NATIVE__`

**Ein** Flag, gesetzt beim Build, nicht verstreute Abfragen im Code. Es steuert:

| Was | Warum |
|---|---|
| Google-Verknüpfung ausblenden | Richtlinie 4.8 + Google blockt OAuth in WebViews |
| Haptik über Capacitor statt `navigator.vibrate` | `navigator.vibrate` gibt es auf iOS nicht |
| Statusleisten-Farbe | natives Erscheinungsbild |

Ein einzelnes Flag hält die Unterschiede zählbar. Sobald sie sich über den Code
verteilen, weiss niemand mehr, wie sich die App von der Website unterscheidet.

---

## Erste iOS-Fassung bewusst **ohne** Google-Anmeldung

Das spart drei Ablehnungsgründe auf einmal:

- **keine Kontoanlage** → keine Pflicht zur Kontolöschung (5.1.1(v))
- **kein Fremd-Login** → kein „Sign in with Apple" nötig (4.8)
- **kein OAuth im WebView** → kein `disallowed_useragent` von Google

Cloud-Save läuft weiter über die **anonyme** Kennung: überlebt App-Updates, nicht
den Gerätewechsel. Für eine erste Fassung ausreichend.

Google- und Apple-Anmeldung kommen **zusammen** in v2, dann über das native
Firebase-Auth-Plugin.

Unabhängig davon wird eine **Fortschritt-löschen**-Funktion eingebaut: Der
Cloud-Save legt einen Datensatz unter `players/{uid}` an, und für v2 ist sie
ohnehin Pflicht.

---

## Capacitor

`capacitor.config.json` mit `webDir: "dist-ios"`.

Das `ios/`-Verzeichnis wird einmalig mit `npx cap add ios` erzeugt und
**eingecheckt** — damit der CI-Runner es nicht jedes Mal neu generiert und
Signierungs-Einstellungen stabil bleiben.

Plugins für v1, bewusst sparsam:

- `@capacitor/haptics` — Vibration
- `@capacitor/status-bar` — Farbe
- `@capacitor/splash-screen` — Startbild

---

## CI: `.github/workflows/ios.yml`

Läuft auf `macos-14`:

```
node tools/build-ios.mjs      → dist-ios/
npx cap sync ios
xcodebuild archive            → .xcarchive
xcodebuild -exportArchive     → .ipa
xcrun altool --upload-app     → TestFlight
```

**Kosten: keine.** Das Repository ist öffentlich, GitHub-Actions-Minuten sind
damit unbegrenzt frei — auch für macOS-Runner. (Bei privaten Repos zählen
macOS-Minuten zehnfach; das trifft hier nicht zu.)

Benötigte Secrets:

| Secret | Woher |
|---|---|
| `IOS_CERT_P12` + `IOS_CERT_PASSWORD` | Distribution-Zertifikat, aus dem Schlüsselbund exportiert |
| `IOS_PROVISIONING_PROFILE` | App Store Connect → Profile |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` | App Store Connect → Integrationen → API-Schlüssel |

Der API-Schlüssel ist dem `altool`-Passwort vorzuziehen: kein persönliches
Apple-Passwort im Repository, jederzeit widerrufbar.

---

## Risiken und Gegenmassnahmen

| Risiko | Gegenmassnahme |
|---|---|
| **4.2 Minimum Functionality** — Apple lehnt verpackte Websites ab | Offline-Betrieb (Service Worker), natives Splash, Haptik, kein Browser-Chrome. Im Review-Hinweis ausdrücklich erklären: vollwertiges Spiel, offline spielbar gegen Bot. **Das bleibt das grösste Restrisiko.** |
| **2.5.2 Remote Code** | alles lokal, Build-Schritt prüft das automatisch |
| **4.8 Sign in with Apple** | Google-Login in v1 abgeschaltet |
| WebSocket in WKWebView | RTDB nutzt WebSocket — funktioniert; im Simulator gegenprüfen |
| localStorage-Verlust | Cloud-Save an der anonymen Kennung |
| Divergenz Web ↔ iOS | iOS ist reine Ableitung; der Build bricht ab, sobald eine externe URL übrigbleibt |

---

## Reihenfolge

1. **Dieser Entwurf** — zur Abnahme
2. `tools/build-ios.mjs` + lokaler Verifikationslauf (`dist-ios/` im Browser gegen die Web-Fassung vergleichen)
3. Plattform-Weiche + Fortschritt-löschen im Spielcode
4. `capacitor.config.json` + `ios/`-Projekt
5. `.github/workflows/ios.yml`
6. Erster TestFlight-Build

Nach jedem Schritt bleiben beide Testsuiten grün und die Web-Version live.

---

## Offen, ausserhalb dieses Entwurfs

- **API-Schlüssel** — ohne ihn kein Cloud-Save, weder Web noch iOS
- App-Store-Screenshots in Apples Pflichtgrössen (6,7″ und 6,5″)
- Listing-Texte, Age Rating, Privacy Nutrition Labels
- Impressum und Nutzungsbedingungen (in DE Pflicht)
