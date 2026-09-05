# FORTRESS — Marktstart-Checkliste

> Stand: v3.79.0. **iOS zuerst** — der Apple-Developer-Account ist in Prüfung,
> und TestFlight hat keine 12-Tester-über-14-Tage-Regel wie Google Play.
> Architektur-Entscheidungen: `ARCHITEKTUR.md`. Store-Texte: `store/listing.md`.

---

## 1. Blockiert — nur du kannst das

- [ ] **Firebase-API-Schlüssel** aus `Projekteinstellungen → Allgemein → Deine Apps`.
      Ohne ihn scheitert die anonyme Anmeldung, und **Cloud-Save funktioniert
      weder im Web noch in der App**. Er war nie im Code (`git log -S apiKey`
      findet keinen einzigen Commit) — die Datenbank braucht ihn nicht,
      deshalb ist es nie aufgefallen.
- [ ] **Anonyme Anmeldung aktivieren** (Authentication → Sign-in method).
- [ ] **Abgesicherte Rules veröffentlichen** — `firebase-rules-PASTE.json`.
      **Erst wenn die Anmeldung nachweislich läuft**; sonst steht der
      Online-Modus still (ist am 27.07. genau so passiert).
- [ ] **App Check** aktivieren (reCAPTCHA v3, kostenlos).
- [ ] **Bundle-ID** in App Store Connect anlegen. Aktuell eingetragen:
      `de.skkjbeer.fortress` (in `capacitor.config.json`).
- [ ] **Vier Secrets hinterlegen** — Schritt für Schritt in `IOS-SETUP.md`:
      `APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`.
      **Kein Zertifikat, kein Provisioning-Profil**: `xcodebuild` legt beides
      über den App-Store-Connect-Schlüssel selbst an. Der Build nennt ein
      fehlendes Secret beim Namen, statt später mit einer unverständlichen
      codesign-Meldung abzubrechen.
- [ ] **Impressum ausfüllen** — `public/impressum.html` enthält Platzhalter.
      Ein Impressum mit Platzhaltern ist **schlechter als keines**: nachweislich
      unvollständig und damit abmahnfähig. Die Anschrift muss ladungsfähig sein.

## 1b. Erkenntnisse aus dem Zählora-Start (04.09.2026 live)

Aus dem Schwesterprojekt, das den Weg schon gegangen ist. Die Punkte stehen
hier, weil sie **Zeit kosten, wenn man sie spät entdeckt** — nicht weil sie
schwierig wären.

- [ ] **Händlerstatus nach dem EU-Digitale-Dienste-Gesetz — der einzige Punkt,
      den man nicht durch Arbeit beschleunigen kann.** Solange unter
      `Business → Agreements → Compliance` „In Prüfung" steht, scheitert jede
      Einreichung an `appStoreVersions with id '…' is not in valid state` —
      einer Meldung, die den Händlerstatus **mit keinem Wort erwähnt**. Bei
      Zählora lagen zwischen Eintragen und „Aktiv" mehrere Tage.
      Die Konto-Ebene ist durch Zählora vermutlich erledigt; **je App ist er
      erneut zu setzen**: `App Information → Digital Services Act`.
      Achtung: Anschrift, E-Mail und **Telefonnummer stehen danach öffentlich**
      auf der Produktseite in der EU.
- [ ] **Datenschutz-Fragebogen in App Store Connect** — etwas anderes als die
      Datenschutz-URL, und **ohne ihn lässt sich nicht einreichen**. Bei
      Zählora sind acht API-Pfade dafür gemessen worden, alle antworten „does
      not exist": Das geht nur von Hand über
      `App Store → App-Datenschutz → Bearbeiten` und dann veröffentlichen.
      Für FORTRESS ist die Antwort **nicht** „keine Daten erfasst" — Name,
      Spielstand und Spielverlauf liegen in Firebase. Vorlage in
      `store/listing.md`.
- [ ] **Telefonnummer für die Prüfung.** Apple nimmt den Kontakt nur
      vollständig; ohne Nummer kommt
      `You must provide a value for the attribute 'contactPhone'`, und dann
      steht gar kein Kontakt hinterlegt.
- [x] **Prüfhinweise auf Englisch, die sieben 2.1-Punkte vorweg beantwortet.**
      Ein Entwicklerkonto ohne Prüfhistorie bekommt mit hoher
      Wahrscheinlichkeit die Rückfrage „Information Needed" — bei Zählora am
      3. September, zwei Tage Verzug, kein Mangel an der App. Der Text steht in
      `store/listing.md` und beantwortet alle sieben Punkte im Voraus.
      Kommt die Rückfrage doch, gehört er **zusätzlich ins Lösungscenter**.
- [ ] **Bildschirmaufnahme auf einem echten Gerät** (Punkt 7 der Rückfrage).
      Ablauf steht in `store/listing.md`; kein Skript erzeugt sie.
- [x] **Xcode-26-Riegel im Build** — dieselbe Prüfung wie bei Zählora, und
      dort aus demselben Grund: Apple nimmt seit dem 28.04.2026 nur noch
      Uploads mit dem iOS-26-SDK.
- [x] **Signierung ohne Zertifikats-Export übernommen.** Vier Geheimnisse
      statt sieben, kein Handgriff im Schlüsselbund: nur der
      App-Store-Connect-Schlüssel und `-allowProvisioningUpdates`.
      Zwei bei Zählora gemessene Fallen sind mit eingebaut: `-configuration
      Release` **und** `CODE_SIGN_IDENTITY="Apple Distribution"` — das
      eingecheckte Projekt schreibt „iPhone Developer" vor, und mit einer
      Entwickler-Identität sucht Xcode ein Development-Profil, das ohne
      registriertes Gerät nicht existiert („your team has no devices").
      Offen bleibt die Drei-Zertifikate-Grenze: ohne hinterlegtes Zertifikat
      legt jeder Lauf ein neues an. Fürs Erste tragbar, in `IOS-SETUP.md`
      benannt.

## 2. Fertig und geprüft

- [x] **Ein Build für Web und App** (Vite) — `dist/` geht an Pages *und* Capacitor
- [x] **Keine externe Skript-Quelle im Bundle** — Apple 2.5.2, im CI erzwungen
- [x] **Offline spielbar** — belegt durch eigene Testsuite: Netz kappen,
      neu laden, Bot-Partie startet
- [x] **Service Worker generiert** (`vite-plugin-pwa`), Vorabcache 2,5 MB
- [x] **TypeScript** in allen Engine-Modulen, `strict`, 0 Fehler
- [x] **Cloud-Save** mit Zusammenführung zweier Geräte (19 Unit-Tests)
- [x] **Fortschritt löschen** — Apple 5.1.1(v), löscht lokal *und* serverseitig
- [x] **Plattform-Weiche** `src/platform.ts`, beide Zustände getestet
- [x] **Capacitor + `ios/`** eingecheckt, geteiltes Schema angelegt
- [x] **iOS-Workflow** auf `macos-15` (für öffentliche Repos kostenlos).
      Die Toolchain wird nicht geraten: der Lauf waehlt das neueste
      installierte Xcode und bricht unter 16 ab — mit `macos-14` und dessen
      Xcode 15.4 uebersetzt Capacitor 8 nicht.
- [x] **Die App uebersetzt** — signierungsfreier Probelauf am 25.08.,
      `ARCHIVE SUCCEEDED` mit Xcode 26.3 und iOS-26.2-SDK. Damit ist belegt,
      dass der Xcode-Teil traegt, bevor ein einziges Zertifikat existiert.
- [x] **Screenshots** — gegen Apples aktuelle Liste geprüft: 1290×2796 ist
      gültig für den **6,9-Zoll-Platz** (der einzige iPhone-Pflichtplatz),
      2064×2752 für den **13-Zoll-iPad-Platz**. iPad-Bilder sind Pflicht,
      solange die App auf dem iPad läuft — sie liegen vor.
- [x] **Feature-Grafik** 1024×500 (Google Play)
- [x] **App-Icon** 1024×1024 ohne Alphakanal
- [x] **Hochkant erzwungen**, helle Statusleiste
- [x] **Store-Texte** DE, mit Zeichengrenzen — `store/listing.md`
- [x] **Nutzungsbedingungen** — `public/agb.html`
- [x] **Datenschutzerklärung** — `public/privacy.html`
- [x] **Verbindungs-Diagnose** für die Firebase-Kette — `public/diagnose.html`

## 3. Nächste Schritte (iOS)

- [x] **Probelauf ohne Zertifikat** — grün (siehe oben). Jederzeit
      wiederholbar: Actions → „iOS-Build (TestFlight)" → *Run workflow*,
      Haken bei „hochladen" **weglassen**.
- [ ] Erster TestFlight-Build
- [ ] Auf einem echten Gerät prüfen: Online-Partie, Ton, Haptik, Safe-Areas
- [ ] App Store Connect: Eintrag, Altersfreigabe, App-Privacy-Angaben
- [ ] Einreichen — mit dem Prüfungshinweis aus `store/listing.md`
      (zielt auf Richtlinie 4.2)

## 4. Später — Android

- [ ] Bubblewrap → AAB, dann `.well-known/assetlinks.json` ausfüllen
      (steht noch auf `TODO_REPLACE_*`)
- [ ] Play-Console-Konto (25 USD einmalig)
- [ ] **Geschlossener Test: 12 Tester über 14 Tage** — der längste Posten,
      früh anfangen
- [ ] Data-Safety-Formular (Vorlage in `store/listing.md`)

## 5. Nach dem Start

- [ ] **v2: Google- und Apple-Anmeldung zusammen.** Beide zugleich, weil
      Richtlinie 4.8 „Sign in with Apple" verlangt, sobald es Fremd-Login gibt.
      In der App über das native Firebase-Auth-Plugin — der Redirect-Flow
      scheitert in WebViews an Googles `disallowed_useragent`.
- [ ] Grossblock `src/game/app.js` weiter zerlegen (`ARCHITEKTUR.md`, Schritt 8)
- [ ] Trailer/GIF, Landing-Seite, Feedback-Kanal

---

### Grösstes Restrisiko

**Apple 4.2, Minimum Functionality.** Apple lehnt verpackte Websites ab. Ein
vollwertiges Spiel mit Offline-Betrieb hat gute Chancen — garantiert ist
nichts. Dagegen steht: offline gegen den Bot spielbar (durch Test belegt),
natives Startbild, Haptik, kein Browser-Chrome, und ein Prüfungshinweis, der
genau das benennt.
