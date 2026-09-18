# Stack & Siege — Marktstart-Checkliste

> Stand: **v3.109.0, 18.09.2026.** **iOS zuerst** — der Developer-Account steht,
> und TestFlight hat keine 12-Tester-über-14-Tage-Regel wie Google Play.
> Architektur-Entscheidungen: `ARCHITEKTUR.md`. Store-Texte: `store/listing.md`.

---

## Stand 18.09.2026 (nachmittags) — Die Regeln stehen

**Eingespielt und gemessen** (v3.109.0, über `firebase.yml` → `regeln`). Der
Ablauf hat die alten Regeln ins Protokoll gesichert, eingespielt und sofort
beide Richtungen geprüft — **jeden der sieben Zweige einzeln**:

```
✓ unangemeldet abgewiesen: games, queue2, queue3,
  leaderboard, players, telemetry, funnel      (alle HTTP 401)
✓ angemeldet schreiben klappt: dieselben sieben
```

Vorher standen dort 1832 Zeichen mit `".write": true` **ohne jedes `auth`** —
jeder Unangemeldete durfte in jeden Zweig schreiben. Unabhängig nachgemessen
von außerhalb der CI: Schreiben 401, Bestenliste lesen 200 (öffentlich lesbar
soll sie bleiben).

**Die Reihenfolge war eingehalten, aber nicht belegt.** Vor dem Einspielen war
geprüft, dass die anonyme Anmeldung überhaupt geht (`uid rtkqgY…`) — wäre sie
aus gewesen, hätte das Skript abgebrochen, ohne ein Zeichen zu schreiben.
**Nicht** geprüft war vorher der Freigabe-Zustand von Bau 29; das wurde erst
danach nachgeholt: `beta-stand` meldet **`Bau 29: APPROVED`**, der Link
`testflight.apple.com/join/hE2AdHwr` liefert ihn aus. Es ist also gutgegangen —
aber die Prüfung gehörte davor, nicht dahinter.

**Bau 28 kommt jetzt nicht mehr online.** Kein Schlüssel → keine `uid` → die
Regeln weisen ab. Lokales Spiel, Bot und Tutorial laufen weiter. Wer über den
Link neu installiert, bekommt ohnehin Bau 29. **Offen:** Bau 28 ablaufen
lassen, damit niemand darauf sitzen bleibt.

### Was jetzt noch offen ist
1. ✅ Schlüssel im Code, live, Anmeldung nachgemessen
2. ✅ Bau 29 hochgeladen, eingereicht — und **freigegeben** (`APPROVED`)
3. ✅ Regeln veröffentlicht
4. ✅ Schreibprobe: unangemeldete Zugriffe werden abgewiesen (7/7, HTTP 401)
5. ⏳ **Cloud-Save durchspielen**: speichern → örtlich löschen → neu laden.
   Der einzige Punkt der Firebase-Kette, der noch nicht an der ECHTEN
   Datenbank gemessen ist — die Regel-Probe zeigt nur, dass `players/{uid}`
   beschreibbar ist, nicht dass die App den Stand wirklich zurückholt.
6. ⏳ Bau 28 ablaufen lassen

### Die Bestenliste — gemessen, nicht geschätzt

45 Einträge. **44 mit Schlüssel `p_…`** (Profil-IDs aus der Zeit vor
`auth.uid`), davon haben **11 tatsächlich gespielt** (Spitzenreiter 34 Spiele);
die übrigen 33 sind leer — jemand hat das Menü geöffnet, mehr nicht.

Der **45. ist kein Spieler**: `test_bot_001`, Name „TestBot", Wappen `skelett`,
Bilanz 5/2/7 — wörtlich das `PROFILE_INIT` der E2E-Suite, durchgerutscht bevor
`suiteOffline` die `FB_SPERRE` bekam. (Die frühere Notiz „darunter
`test_bot_001` und fünf weitere Testprofile" war ungenau: Es ist **ein**
Testeintrag, und er ist der einzige ohne `p_`-Schlüssel.)

Unter den neuen Regeln sind alle 44 eingefroren (`auth.uid === $playerId`, und
eine `p_…`-uid gibt es nicht). Dieselben Spieler legen beim nächsten Spiel
einen zweiten Eintrag unter ihrer uid an → **derselbe Name doppelt**. Das ist
eine Produktentscheidung: stehen lassen, löschen, oder beim nächsten
Cloud-Speichern zusammenführen. **Empfehlung: zusammenführen** — verliert
nichts und räumt die Doppelungen von selbst ab.

Zum Entfernen einzelner Reste gibt es `firebase.yml` → `reste` / `reste-weg`
(Namensliste im Code, kein Pfad-Eingabefeld — das Dienstkonto umgeht alle
Regeln). **Ausgeführt wurde `reste-weg` noch nicht.**

---

## Stand 18.09.2026 (vormittags) — Anmeldung läuft, Regeln warten auf Bau 29

**Der Firebase-API-Schlüssel ist eingetragen** (v3.103.0) und die anonyme
Anmeldung funktioniert. Gemessen an der echten Seite:

```
uid    : jxmT1frqPBghswE6oKN1cy4ASEP2
anonym : true
Fehler : keiner            (nach ~1 Sekunde)
```

**Bau 29 (v3.103.0)** ist hochgeladen, der öffentlichen Gruppe zugeordnet, zur
Beta-Prüfung eingereicht (`WAITING_FOR_REVIEW`) und an die Store-Fassung
gehängt.

### ✅ (erledigt) Die Regeln erst NACH Bau 29 veröffentlichen

`firebase-rules-PASTE.json` verlangt überall `auth != null`. **Bau 28
(v3.94.0) hat keinen Schlüssel**, dort bleibt `uid = null`. Würden die Regeln
jetzt veröffentlicht, könnte kein Tester auf Bau 28 mehr ein Online-Spiel
erstellen oder betreten.

Reihenfolge also:
1. ✅ Schlüssel im Code, live, Anmeldung nachgemessen
2. ✅ Bau 29 hochgeladen und eingereicht
3. ⏳ **Apple gibt Bau 29 frei** (beim letzten Mal knapp drei Stunden)
4. ⏳ Tester haben aktualisiert
5. ⏳ **Dann** Regeln veröffentlichen
6. ⏳ Schreibprobe: unangemeldete Zugriffe müssen abgewiesen werden
7. ⏳ Cloud-Save durchspielen: speichern → örtlich löschen → neu laden

### Was nach der Veröffentlichung offen bleibt

**45 Alt-Einträge in der Bestenliste**, alle mit lokalen Profil-IDs (`p_…`)
verschlüsselt, darunter `test_bot_001` und fünf weitere Testprofile — die
E2E-Suite *hat* also irgendwann in die Produktivdatenbank geschrieben. Mit den
neuen Regeln (`auth.uid === $playerId`) werden sie zu unveränderlichen
Geistern. Aufräumen braucht Admin-Zugang; das wäre ein enger, klar begrenzter
Zweck für ein Dienstkonto.

> Hinweis zur Dauerhaftigkeit: Eine anonyme Kennung ist an den lokalen Speicher
> gebunden. Nach einer Neuinstallation gibt es eine neue uid — und damit einen
> neuen Bestenlisten-Eintrag. Das lässt sich erst mit echten Konten (Sign in
> with Apple) beenden, nicht über die Regeln.

---

## Stand 17.09.2026 — Bau 28 ist freigegeben und bei den Testern

**Die Beta läuft öffentlich mit v3.94.0.** Bau 28 ist am 17.09. hochgeladen,
bei Apple `VALID`, der öffentlichen Gruppe zugeordnet und von Apple
**freigegeben** (`APPROVED`, gemessen um 10:56 UTC — knapp drei Stunden nach dem
Upload). Der Link `testflight.apple.com/join/hE2AdHwr` nimmt Tester an und
liefert diesen Stand.

> **Damit ist die tote Brücke aus v3.90.0 draußen.** Bau 20 hat den
> Nachrichtenkanal `textfeld` nur an der Konfiguration angemeldet, nicht am
> fertigen WebView — die Lupen-Umschaltung hat auf dem Gerät nie gewirkt
> (gefunden in v3.93.0 durch den Simulator-Probelauf). Wer ab jetzt über den
> Link installiert, bekommt Bau 28 mit der Behebung.

**Nachsehen ohne etwas zu schreiben:** `Actions → App Store (Stand /
Eintragen) → beta-stand`. Der Modus ruft `scripts/testflight-stand.py` auf,
liest je Bau der öffentlichen Gruppe den Prüfzustand und sagt `ja`/`nein` —
dieselbe Frage, an der der Knopf „Jetzt testen" auf der Website hängt. Vorher
ließ sie sich nur beantworten, indem man etwas **schrieb** (`oeffentlich`).

**Der Store-Eintrag ist maschinell gefüllt.** Was in App Store Connect steht,
steht dort nicht, weil jemand es abgehakt hat, sondern weil Apple es auf
Nachfrage bestätigt: `→ marktreif` fragt und berichtet, `→ store` trägt ein,
`→ store-probe` zeigt vorher, was es täte. Alles wiederholbar, alles schreibt
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
- [x] **Bau 28 (v3.94.0) der Fassung zugeordnet** (17.09., `→ store`)

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
- [x] **Firebase-Schlüssel eingetragen** (18.09., v3.103.0), anonyme Anmeldung
      läuft — live nachgemessen. **Die Regeln stehen noch nicht**: siehe oben,
      sie würden Bau 28 aussperren.

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
