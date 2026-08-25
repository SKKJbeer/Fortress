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
- [ ] **Signierung**: Distribution-Zertifikat + Provisioning-Profil erzeugen
      und **sieben** Secrets hinterlegen — Schritt fuer Schritt in
      `IOS-SETUP.md`: `APPLE_TEAM_ID`, `IOS_CERT_P12`, `IOS_CERT_PASSWORD`,
      `IOS_PROVISIONING_PROFILE`, `IOS_PROFILE_NAME`, `ASC_KEY_ID`,
      `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`.
      Der Build nennt ein fehlendes Secret beim Namen, statt spaeter mit einer
      unverstaendlichen codesign-Meldung abzubrechen.
- [ ] **Impressum ausfüllen** — `public/impressum.html` enthält Platzhalter.
      Ein Impressum mit Platzhaltern ist **schlechter als keines**: nachweislich
      unvollständig und damit abmahnfähig. Die Anschrift muss ladungsfähig sein.

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
- [x] **Screenshots** 1290×2796, 1242×2688, 1080×2340 — aus dem echten Spiel
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
