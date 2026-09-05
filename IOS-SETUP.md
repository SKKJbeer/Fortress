# iOS-Einrichtung — Schritt für Schritt

> Für FORTRESS mit `de.skkjbeer.fortress`. Reihenfolge einhalten: jeder Schritt
> braucht das Ergebnis des vorigen. Zusammen etwa 45 Minuten, davon die Hälfte
> Wartezeit.

> **Stand:** Der Xcode-Teil ist bereits belegt. Der signierungsfreie Probelauf
> vom 25.08. endet mit `ARCHIVE SUCCEEDED` (Xcode 26.3, iOS-26.2-SDK) — die App
> übersetzt vollständig, ohne dass ein Zertifikat existiert. Was hier folgt,
> beschafft nur noch die Papiere für den Upload.

---

## Vorab: lokal in Xcode ausprobieren — ohne App-ID, ohne Zertifikat

Für den **Simulator** brauchst du von den Schritten unten **nichts**. Kein
Apple-Konto, keine App-ID, keine Signierung — der Simulator signiert nicht.

```bash
npm ci
npm run build          # erzeugt dist/ — Capacitor liefert genau das aus
npx cap sync ios       # kopiert dist/ ins Xcode-Projekt, loest die Plugins auf
npx cap open ios       # oeffnet ios/App/App.xcodeproj
```

In Xcode oben ein **Simulator**-Ziel wählen (z. B. iPhone 17) und auf **Run**.
Das ist derselbe Weg, den der Probelauf in der CI mitprüft — dort wird die
Debug-Konfiguration für den Simulator eigens mitübersetzt, damit du nicht der
erste bist, der einen Fehler in diesem Pfad findet.

**Auf einem echten iPhone** brauchst du eine Signierung, aber immer noch keine
der Registrierungen unten: in Xcode *App* → *Signing & Capabilities* → **Team**
auswählen. `CODE_SIGN_STYLE` steht im Projekt bewusst auf `Automatic` — Xcode
legt die App-ID dann selbst an. Nur die CI schaltet auf `Manual`, weil dort
kein Xcode-Konto angemeldet ist; das geschieht auf der Kommandozeile und
verändert das Projekt nicht.

> Ändere die Signierungseinstellungen im Projekt **nicht** dauerhaft, um lokal
> etwas zum Laufen zu bringen — sonst wandert dein persönliches Team ins
> öffentliche Repository, und die CI-Signierung bricht.

**Was lokal *nicht* geht:** Online-Partien nur, wenn die Firebase-Kette steht
(siehe `LAUNCH-TODO.md` §1). Bot-Partie, Ton, Haptik und Safe-Areas kannst du
sofort prüfen — das ist ohnehin der interessantere Teil, weil Apple genau
danach fragt (Richtlinie 4.2).

---

## 0. Was du am Ende hast

**Vier** Werte, die als **GitHub-Secrets** hinterlegt werden. Danach baut und
lädt der Workflow selbständig hoch — du brauchst dafür **keinen Mac**.

| Secret | Woher |
|---|---|
| `APPLE_TEAM_ID` | Schritt 1 |
| `ASC_KEY_ID` · `ASC_ISSUER_ID` · `ASC_KEY_P8` | Schritt 4 |

> **Kein Zertifikat, kein Provisioning-Profil.** Bis zum 5. September standen
> hier sieben Werte, darunter ein aus dem Schlüsselbund exportiertes `.p12`
> und eine Profildatei aus dem Entwicklerportal. Beides ist entbehrlich:
> `xcodebuild` legt Zertifikat und Profil über den App-Store-Connect-Schlüssel
> selbst an. Der Weg läuft im Schwesterprojekt auf demselben Apple-Konto.
>
> **Eine Falle, die dort gemessen wurde:** Ohne hinterlegtes Zertifikat legt
> *jeder* Lauf ein neues an, und nach dem dritten ist die Grenze erreicht.
> Fürs Erste reicht das; wenn die Meldung kommt, bauen wir die Wiederverwendung
> ein — dann kommt ein `.p12` doch noch dazu, aber erzeugt aus der CI und nicht
> von Hand.

---

## 1. Team-ID herausfinden

`developer.apple.com/account` → oben rechts, unter deinem Namen, oder unter
**Membership details**. Zehn Zeichen, z. B. `A1B2C3D4E5`.

→ Secret **`APPLE_TEAM_ID`**

## 2. App-ID registrieren

`developer.apple.com/account/resources/identifiers` → **+** → *App IDs* → *App*

- **Description:** `FORTRESS`
- **Bundle ID:** *Explicit* → **`de.skkjbeer.fortress`**
  (muss **exakt** so lauten — steht identisch in `capacitor.config.json`)
- **Capabilities:** nichts ankreuzen. Das Spiel braucht weder Push noch Game
  Center noch iCloud. Jede aktivierte Fähigkeit, die nicht genutzt wird, ist
  eine Frage mehr in der Prüfung.

## 3. App in App Store Connect anlegen

`appstoreconnect.apple.com/apps` → **+** → *Neue App*

- **Plattform:** iOS
- **Name:** `FORTRESS – Burgenduell` (muss store-weit eindeutig sein)
- **Primäre Sprache:** Deutsch
- **Bundle-ID:** `de.skkjbeer.fortress` (aus Schritt 2 auswählbar)
- **SKU:** `fortress-ios` (nur intern, frei wählbar)

## 4. API-Schlüssel für den Upload

`appstoreconnect.apple.com/access/integrations/api` → **+**

- **Name:** `GitHub Actions`
- **Zugriff:** *App Manager*

Die `.p8`-Datei lässt sich **nur ein einziges Mal** laden. Sofort sichern.

Sie wird **nicht** kodiert — der Dateiinhalt geht so, wie er ist, ins Secret:

```bash
cat AuthKey_XXXXXXXXXX.p8
```

→ Secrets **`ASC_KEY_ID`** (die zehn Zeichen aus dem Dateinamen),
**`ASC_ISSUER_ID`** (steht über der Tabelle) und **`ASC_KEY_P8`** — der
**ganze Inhalt** der `.p8`-Datei, samt der `BEGIN`- und `END`-Zeilen. Nicht
base64, sondern der Text selbst.

> Ein API-Schlüssel statt eines app-spezifischen Passworts: kein persönliches
> Apple-Passwort im Repository, und jederzeit einzeln widerrufbar.

## 5. Secrets hinterlegen

`github.com/SKKJbeer/Fortress/settings/secrets/actions` → *New repository
secret*, für jeden der vier Werte.

## 6. Hochladen

Actions → **iOS-Build (TestFlight)** → *Run workflow* → Haken bei
**„Nach TestFlight hochladen"** setzen.

Danach in App Store Connect unter *TestFlight*: die Verarbeitung dauert
10–30 Minuten.

Die **Exportbestimmungs-Angabe** ist bereits in der `Info.plist` beantwortet
(`ITSAppUsesNonExemptEncryption` = `false`; FORTRESS nutzt nur HTTPS, also die
Standardausnahme). Ohne diese Angabe bliebe **jeder** Build in „Missing
Compliance" stehen, bis du die Frage von Hand beantwortest — bei jedem Upload
aufs Neue.

**Interne Tester** (bis 100 Personen aus deinem Team) können sofort laden.
**Externe Tester** brauchen eine Beta-Prüfung durch Apple — die ist kürzer als
die Store-Prüfung, aber sie findet statt.

---

## Vor der Einreichung noch nötig

- **Screenshots** hochladen — liegen fertig unter `store/ios-6.7/`,
  `store/ios-6.5/`, `store/ipad-13/`
- **Texte** aus `store/listing.md`
- **Altersfreigabe:** Fragebogen. Gewalt ist abstrakt (Blöcke zerfallen), keine
  Figuren, kein Blut → 4+
- **App-Datenschutz:** erfasst werden Spielername (Pseudonym), Spielstand,
  Spielverlauf. **Nicht** mit der Identität verknüpft, **kein** Tracking, keine
  Werbenetzwerke
- **Datenschutz-URL:** `https://skkjbeer.github.io/Fortress/privacy.html`
- **Prüfungshinweis:** der Text aus `store/listing.md` — er benennt die
  Offline-Fähigkeit und zielt damit auf Richtlinie 4.2, den wahrscheinlichsten
  Ablehnungsgrund
- **Impressum ausfüllen** — `public/impressum.html` enthält noch Platzhalter

## Wenn der Build scheitert

| Meldung | Ursache |
|---|---|
| `Bundle identifier mismatch` | App-ID aus Schritt 2 ≠ `capacitor.config.json` |
| `redundant binary upload` | Build-Nummer schon vergeben — erneut laufen lassen, sie steigt automatisch |
| `your team has no devices from which to generate a provisioning profile` | Es wurde ein **Development**-Profil gesucht statt eines Verteilprofils. Der Lauf setzt dagegen `-configuration Release` und `CODE_SIGN_IDENTITY="Apple Distribution"` — tritt es trotzdem auf, hat einer der beiden Werte nicht gegriffen. |
| `Maximum number of certificates generated` | Die Drei-Zertifikate-Grenze. Alte im Entwicklerportal widerrufen, oder die Wiederverwendung einbauen (siehe Abschnitt 0). |
| `FEHLER: Secret ... fehlt` | genau das — der Build nennt den fehlenden Wert und bricht ab, bevor daraus eine kryptische codesign-Meldung wird |
| `has no member 'webView'` / `'reject'` (Capacitor-Plugins) | Xcode zu alt. Der Lauf waehlt das neueste installierte Xcode und bricht unter 16 ab — tritt das trotzdem auf, hat das Runner-Abbild nichts Neueres. |
