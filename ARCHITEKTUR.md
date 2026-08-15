# FORTRESS — Architektur

> Verbindliche Grundlage für den Umbau ab v3.73.0. Ersetzt den früheren
> Entwurf `ARCHITEKTUR-IOS.md`, der nur die iOS-Verpackung betrachtete.
> Entscheidungen stehen mit Begründung — wer sie später umdreht, soll wissen,
> wogegen er entscheidet.

---

## E1 — Kein Neuschrieb

**Entscheidung:** Die bestehende Spiellogik wird **nicht** neu geschrieben.
Modernisiert werden Werkzeugkette und Modulgrenzen.

**Warum.** `index.html` umfasst 10.046 Zeilen. Darin stecken 73 Versionen
erkämpfter Fehlerbehebungen, jede mit Begründung im Changelog:
Session-Token-Verwechslung (v3.0.2), Phasen-Einfrieren bei Gästen (v3.0.7),
Kanonen als Mauer im Flood-Fill (v1.0.6), Geister-Listener durch falsches
`off()` (v3.14.11), Selbst-Match-Race im Matchmaking (v3.15.2),
Doppel-Flip des Terrains (v3.30.2), stehengebliebener Bot-Ausbau (v3.67.0).

Ein Neuschrieb verdient sich genau diese Fehler neu. Zugleich entwertet er die
**330 E2E-Prüfungen**, die schrittweisen Umbau erst sicher machen — sie prüfen
Verhalten, nicht Struktur, und überleben deshalb jede Umstrukturierung.

**Was das nicht heisst.** Der Zustand ist nicht gut. 543 `React.createElement`
statt JSX, 229 Hooks in einer Datei, keine Typen. Das wird behoben — nur
schrittweise, unter laufendem Test.

---

## E2 — Ein Build für alles: Vite

**Entscheidung:** Vite wird eingeführt. Es erzeugt **ein** Artefakt, das sowohl
GitHub Pages als auch Capacitor ausliefern.

**Warum.** iOS erzwingt einen Build (siehe E3). Die Alternative wäre gewesen,
das Web ohne Build zu lassen und iOS daraus abzuleiten — zwei Auslieferungswege
für denselben Code. Genau daraus entsteht Divergenz: ein Fehler, der nur in
einem Weg auftritt, und niemand weiss, in welchem.

Ein Artefakt für beide Ziele schliesst diese Fehlerklasse **konstruktiv** aus.

**Preis.** Die Regel „kein Build-Schritt" aus `CLAUDE.md` fällt. Sie war eine
Vereinfachung, kein Wert an sich; ihr eigenes Architektur-Konzept sah in
Phase 4 ohnehin Bundling vor.

**Gegenmassnahme gegen den Preis.** Der Deploy-Workflow baut und prüft, bevor er
veröffentlicht. Bricht der Build, wird nicht deployed — die Live-Version bleibt
auf dem letzten funktionierenden Stand stehen.

---

## E3 — Abhängigkeiten aus npm statt vom CDN

**Entscheidung:** React und Firebase kommen aus `node_modules`, nicht von
`unpkg` und `gstatic`.

**Warum.**

*Apple 2.5.2.* Apps müssen in sich geschlossen sein und dürfen keinen
ausführbaren Code nachladen. Ein CDN-Import von React ist genau das.

*Erster Start ohne Netz.* Ohne Verbindung hätte die App keinerlei Code — nicht
einmal das Menü. Der Service Worker greift erst nach dem ersten erfolgreichen
Laden.

*Grösse.* Das Firebase-SDK von gstatic sind gemessen 440 KB über drei Dateien.
Aus npm, modular und baumgeschüttelt, bleibt ein Bruchteil übrig — das Spiel
nutzt nur `ref/set/update/remove/get/onValue/runTransaction/onDisconnect` sowie
anonyme Anmeldung.

---

## E4 — TypeScript, beginnend bei der Engine

**Entscheidung:** TypeScript wird eingeführt, aber **nicht überall auf einmal**.
Reihenfolge: `src/engine/` → `src/net/` → `src/render/`, `src/ui/` → Spielcode.

**Warum diese Reihenfolge.** Die Engine-Module sind rein, ohne DOM, React oder
Firebase, und bereits durch 60 Unit-Tests abgedeckt. Dort kostet die Umstellung
am wenigsten und bringt am meisten: Beträge, Zelltypen und Spieler-Indizes sind
genau die Werte, die sich in einem 10.000-Zeilen-Spiel still vertauschen.

Der Spielcode kommt zuletzt, weil dort 229 Hooks und Dutzende Refs hängen —
dort ist der Nutzen pro Aufwand am geringsten und das Risiko am höchsten.

`allowJs` bleibt an, `checkJs` zunächst aus. Jede Datei wird einzeln
umgestellt, nie ein Grossumbau.

---

## E5 — Capacitor, nicht React Native

**Entscheidung:** iOS über Capacitor (WKWebView).

**Warum.** Das Spiel rendert auf Canvas 2D mit eigenem Bildlauf, Sprite-Cache
und Offscreen-Puffern. React Native hätte keinen davon — die gesamte
Darstellungsschicht müsste neu entstehen. Das wäre der Neuschrieb aus E1 durch
die Hintertür.

Capacitor behält den Canvas unverändert und gibt trotzdem native Haptik,
Startbild und Statusleiste.

---

## E6 — Der Service Worker wird generiert

**Entscheidung:** `vite-plugin-pwa` erzeugt Service Worker und Manifest.
Die handgepflegte `CORE`-Liste in `sw.js` entfällt.

**Warum.** In `CLAUDE.md` steht die Warnung „neue Engine-Dateien in sw.js CORE
eintragen!" — eine Falle, die man dokumentieren muss, weil sie zuverlässig
zuschnappt. Vergisst man einen Eintrag, fehlt die Datei offline, und der Fehler
zeigt sich erst beim Nutzer ohne Netz.

Ein generierter Service Worker kennt alle gebauten Dateien und kann diesen
Fehler nicht machen.

---

## E7 — Eine Plattform-Weiche, nicht viele

**Entscheidung:** Ein einziges Flag unterscheidet Web und App.

**Warum.** Sobald sich Plattform-Abfragen über den Code verteilen, weiss
niemand mehr, worin sich die App von der Website unterscheidet — und
Unterschiede, die man nicht aufzählen kann, kann man nicht testen.

Gesteuert werden: Google-Verknüpfung (aus in v1, siehe E8), Haptik über
Capacitor statt `navigator.vibrate` (das es auf iOS nicht gibt), Statusleiste.

---

## E8 — Erste iOS-Fassung ohne Google-Anmeldung

**Entscheidung:** Die Konto-Verknüpfung bleibt im iOS-Build abgeschaltet.

**Warum.** Sie zieht drei Ablehnungsgründe nach sich, die alle entfallen, wenn
es keine Kontoanlage gibt:

- **5.1.1(v)** — wer Konten anlegt, muss sie in der App löschbar machen
- **4.8** — wer Fremd-Login anbietet, muss „Sign in with Apple" anbieten
- Google blockt OAuth in eingebetteten WebViews (`disallowed_useragent`) — der
  Redirect-Flow aus v3.72.0 funktioniert in Capacitor nicht

Cloud-Save läuft über die **anonyme** Kennung weiter: überlebt Updates, nicht
den Gerätewechsel. Für eine erste Fassung ausreichend.

Google- und Apple-Anmeldung kommen **zusammen** in v2, dann über das native
Firebase-Auth-Plugin. Eine Funktion „Fortschritt löschen" wird trotzdem jetzt
gebaut — der Cloud-Save legt einen Datensatz an, und für v2 ist sie Pflicht.

---

## Zielbild

```
fortress/
├── index.html              Hülle: Wurzelknoten + ein Modul-Import
├── package.json            Abhängigkeiten, Skripte
├── vite.config.ts          Build, PWA-Plugin, Pfade
├── capacitor.config.ts     webDir: dist
├── src/
│   ├── main.tsx            Einstieg
│   ├── platform.ts         E7 — die eine Weiche
│   ├── engine/*.ts         rein, unit-getestet (E4, zuerst)
│   ├── net/*.ts            Protokoll, Matchmaking
│   ├── render/*.ts         Sprites, Zeichnen
│   ├── ui/*.ts             Icons
│   └── game/               der bisherige Grossblock, schrittweise zerlegt
├── ios/                    Capacitor-Xcode-Projekt (eingecheckt)
├── dist/                   Bauergebnis — Pages UND Capacitor
├── tests/*.test.ts         Unit
└── test_fortress.cjs        E2E, laeuft gegen dist/
```

## Wie der Grossblock zerfällt

Nicht auf einmal. Der bisherige Skriptblock zieht **unverändert** nach
`src/game/app.jsx` und wird danach am Rand abgetragen — Würgefeigen-Muster:

1. `ui/` — Modale, Shop-Karten, Ergebnis-Screen (viel Fläche, wenig Verflechtung)
2. `net/` — Firebase-Anbindung, `applyState`, Push-Drosselung
3. `render/` — Bildlauf und Zeichnen
4. `state/` — die Refs, gebündelt statt verstreut

Nach jedem Schritt: beide Testsuiten grün, Web live.

---

## Reihenfolge der Umsetzung

| # | Schritt | Beweis, dass es hält |
|---|---|---|
| 1 | Vite-Gerüst, npm-Abhängigkeiten, `dist/` | **E2E läuft gegen `dist/` und ist grün** — vor jeder Deploy-Umstellung |
| 2 | Deploy-Workflow auf `dist/` umstellen | Live-Version unverändert spielbar |
| 3 | PWA-Plugin, `sw.js` entfällt | Offline-Test |
| 4 | TypeScript für `src/engine/` | 60 Unit-Tests grün |
| 5 | Plattform-Weiche + Fortschritt löschen | E2E-Prüfung für beide Zustände |
| 6 | Capacitor + `ios/` | Build im Simulator |
| 7 | `.github/workflows/ios.yml` (macos-14) | TestFlight-Upload |
| 8 | Grossblock zerlegen | fortlaufend, jeder Schritt grün |

Schritt 1 ist der Prüfstein: Solange die E2E-Suite nicht gegen `dist/` grün ist,
wird die Auslieferung **nicht** umgestellt.

## Kosten

GitHub Actions ist für öffentliche Repositories unbegrenzt frei — auch
macOS-Runner. Es bleiben die 99 USD/Jahr für den Apple-Developer-Account.

## Grösstes Restrisiko

**Apple 4.2, Minimum Functionality.** Apple lehnt verpackte Websites ab. Ein
vollwertiges Spiel mit Offline-Betrieb hat gute Chancen, garantiert ist nichts.
Dagegen: Offline gegen den Bot spielbar, natives Startbild, Haptik, kein
Browser-Chrome — und ein Review-Hinweis, der genau das benennt.
