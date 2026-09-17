# Stack & Siege — Marktstart-Checkliste

> Stand: **v3.94.0, 17.09.2026.** **iOS zuerst** — der Developer-Account steht,
> und TestFlight hat keine 12-Tester-über-14-Tage-Regel wie Google Play.
> Architektur-Entscheidungen: `ARCHITEKTUR.md`. Store-Texte: `store/listing.md`.

---

## Stand 17.09.2026 — Beta läuft, Bau 28 wartet auf Apples Beta-Prüfung

**Die Beta läuft öffentlich.** Der Link `testflight.apple.com/join/hE2AdHwr`
nimmt Tester an, ohne Einladung und ohne Konto bei uns.

**Bau 28 (v3.94.0)** ist am 17.09. hochgeladen, bei Apple `VALID`, der
öffentlichen Gruppe zugeordnet und zur Beta-Prüfung eingereicht
(`WAITING_FOR_REVIEW`). **Bau 20 (v3.90.0)** bleibt bis zur Freigabe der
ausgelieferte Stand.

> **Achtung, Bau 20 ist nicht harmlos.** Er trägt die tote Brücke aus v3.90.0:
> der Nachrichtenkanal `textfeld` war nur an der Konfiguration angemeldet, nicht
> am fertigen WebView — die Lupen-Umschaltung hat auf dem Gerät **nie** gewirkt
> (gefunden in v3.93.0 durch den Simulator-Probelauf). Wer heute über den Link
> installiert, bekommt diesen Stand. Behoben ist es erst mit Bau 28.

**Der Knopf „Jetzt testen" auf der Website** hängt an
`scripts/testflight-stand.py`: Er fragt je Bau der öffentlichen Gruppe den
Prüfzustand ab und sagt `ja`, sobald **irgendein** Bau `APPROVED` ist. Ein neu
eingereichter Bau schaltet den Knopf also nicht ab, solange der alte freigegeben
bleibt. Nachsehen ohne etwas zu schreiben:
`Actions → App Store (Stand / Eintragen) → beta-stand`.

**Der Store-Eintrag ist maschinell gefüllt.** Was in App Store Connect steht,
steht dort nicht, weil jemand es abgehakt hat, sondern weil Apple es auf
Nachfrage bestätigt: `Actions → App Store (Stand / Eintragen) → marktreif`
fragt und berichtet, `→ store` trägt ein. Beides ist wiederholbar und schreibt
nur, was fehlt.

### Bei Apple steht — von Apple bestätigt, nicht behauptet
- [x] App-ID `de.skkjbeer.stackandsiege`, Eintrag „Stack & Siege – Burgenduell"
- [x] Fassung 1.0 (`PREPARE_FOR_SUBMISSION`)
- [x] Untertitel, Datenschutz-Adresse, Beschreibung, Schlagworte, Werbetext
- [x] **Kategorie** GAMES / Strategie / Puzzle
- [x] **Altersfreigabe** — 24 Angaben, mit Begründung in `scripts/asc-store.py`
- [x] **Prüfkontakt vollständig** und Prüfhinweise hinterlegt
- [x] **Bildschirmfotos** 4× iPhone 6,7" und 4× iPad 12,9"
- [x] **Preisplan** vorhanden
- [x] **Impressum** ausgefüllt (12.09.), Datenschutz und Nutzungsbedingungen live
- [ ] **Bau der Fassung zuordnen** — Bau 20 ist zugeordnet; vor der Einreichung
      auf **28** wechseln (`→ store`), sonst geht v3.90.0 in den Store.

## ⏸ Wartet auf dich — und nur darauf

Beides kann **kein Schlüssel und kein Skript**; Apples Schnittstelle bietet es
nicht an. Drüben im Schwesterprojekt sind acht Pfade gemessen worden, alle
„does not exist".

- [ ] **Datenschutz-Fragebogen** — App Store Connect → *App-Datenschutz* →
      *Bearbeiten*. Die Antworten stehen fertig in `store/listing.md`.
      Ohne ihn lässt sich nicht einreichen.
- [ ] **Händlerstatus nach dem EU-Digitale-Dienste-Gesetz** — *Business →
      Agreements → Compliance* **und** je App unter *App Information*. Steht er
      auf „In Prüfung", scheitert jede Einreichung an einer Meldung, die ihn
      nicht erwähnt.

Danach ist die Einreichung selbst der letzte Schritt — der einzige, der sich
nicht zurücknehmen lässt, und deshalb bewusst kein Skript.

### Empfohlen, aber kein Riegel
- [ ] **Bildschirmaufnahme auf einem echten Gerät** (Punkt 7 der 2.1-Rückfrage,
      Ablauf in `store/listing.md`).
- [ ] **Firebase absichern.** Gemessen am 15.09.: Die Datenbank nimmt
      **unangemeldete** Schreibzugriffe auf `games` und `queue2` an — von der
      Kommandozeile aus nachgewiesen und sofort wieder aufgeräumt. Die
      auth-gebundenen Regeln liegen fertig in `firebase-rules-PASTE.json`,
      lassen sich aber nicht veröffentlichen, solange die anonyme Anmeldung
      nicht geht: Es fehlt der Firebase-API-Schlüssel (eine öffentliche
      Kennung, kein Geheimnis) und der Schalter *Authentication → Sign-in
      method → Anonym*. **Cloud-Save funktioniert deshalb heute gar nicht** —
      `players` weist unangemeldete Zugriffe ab, und angemeldet ist niemand.

---

## Der kürzeste Weg nach TestFlight

Die Code-Seite ist fertig und belegt. Für einen Build in TestFlight fehlen
**genau vier Handgriffe**, alle im Browser, zusammen etwa 20 Minuten:

| # | Was | Wo |
|---|---|---|
| 1 | App-ID `de.skkjbeer.fortress` registrieren | `developer.apple.com` → Identifiers |
| 2 | App anlegen (Name, Sprache, SKU) | `appstoreconnect.apple.com/apps` |
| 3 | API-Schlüssel erzeugen (Rolle *App Manager*) | App Store Connect → Integrations |
| 4 | Vier Secrets hinterlegen, Workflow mit Haken starten | GitHub → Settings → Secrets |

Schritt für Schritt in **`IOS-SETUP.md`**. Kein Mac nötig, kein Zertifikat,
kein Provisioning-Profil.

**Das reicht für internes Testen.** Externe Tester brauchen zusätzlich eine
Beta-Prüfung durch Apple; für den Verkauf kommt der ganze Abschnitt 1b dazu.

**Was im TestFlight-Build noch NICHT geht:** Online-Partien, solange der
Firebase-Schlüssel fehlt (Abschnitt 1). Bot-Partie, Tutorial, Ton, Haptik und
der komplette Fortschritt laufen.

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
      Für Stack & Siege ist die Antwort **nicht** „keine Daten erfasst" — Name,
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
- [x] **Die App übersetzt** — signierungsfreier Probelauf, `ARCHIVE SUCCEEDED`
      mit Xcode 26.3 und iOS-26.2-SDK, dazu Debug für den Simulator. Damit ist
      belegt, dass der Xcode-Teil trägt, bevor ein einziges Zertifikat existiert.
- [x] **Und im Bündel steckt wirklich das Spiel.** Der Probelauf öffnet das
      erzeugte App-Paket: `index.html`, gebündelter Spielcode, acht
      Musikstücke, Töne — dazu Bundle-ID, Build-Nummer und Ausfuhrangabe.
      Ein Capacitor-Bau gelingt auch dann, wenn `cap sync` die Oberfläche nicht
      mitgenommen hat; das Ergebnis wäre eine App, die startet und weiß bleibt.
- [x] **E2E-Suite 353/353 grün** vor der ersten Auslieferung. Eine Prüfung
      meldete seit Wochen grundlos rot (Tutorial-Pause) — nachgemessen, als
      Testfehler erkannt, behoben.
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
