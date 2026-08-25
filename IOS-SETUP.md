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

Sieben Werte, die als **GitHub-Secrets** hinterlegt werden. Danach baut und lädt
der Workflow selbständig hoch — du brauchst dafür **keinen Mac**.

| Secret | Woher |
|---|---|
| `APPLE_TEAM_ID` | Schritt 1 |
| `IOS_CERT_P12` | Schritt 3 |
| `IOS_CERT_PASSWORD` | Schritt 3 |
| `IOS_PROVISIONING_PROFILE` | Schritt 5 |
| `IOS_PROFILE_NAME` | Schritt 5 |
| `ASC_KEY_ID` · `ASC_ISSUER_ID` · `ASC_PRIVATE_KEY` | Schritt 6 |

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

## 3. Verteilungs-Zertifikat

Ohne Mac geht das über eine Signieranfrage (CSR). Der bequemste Weg **mit**
Mac: Schlüsselbundverwaltung → *Zertifikatsassistent* → *Zertifikat von einer
Zertifizierungsinstanz anfordern* → auf Festplatte sichern.

Dann `developer.apple.com/account/resources/certificates` → **+** →
**Apple Distribution** → CSR hochladen → `.cer` laden.

**In `.p12` umwandeln:** `.cer` doppelklicken (landet im Schlüsselbund) → dort
den **privaten Schlüssel** mit dem Zertifikat auswählen → Rechtsklick →
*Exportieren* → `.p12` mit Passwort.

```bash
base64 -i Zertifikat.p12 | pbcopy      # macOS
base64 -w0 Zertifikat.p12              # Linux
```

→ Secrets **`IOS_CERT_P12`** (der base64-Text) und **`IOS_CERT_PASSWORD`**

> **Den Schlüssel niemals verlieren.** Ohne ihn kannst du nie wieder ein Update
> für dieselbe App veröffentlichen. Leg eine Sicherung an einem zweiten Ort an.

## 4. App in App Store Connect anlegen

`appstoreconnect.apple.com/apps` → **+** → *Neue App*

- **Plattform:** iOS
- **Name:** `FORTRESS – Burgenduell` (muss store-weit eindeutig sein)
- **Primäre Sprache:** Deutsch
- **Bundle-ID:** `de.skkjbeer.fortress` (aus Schritt 2 auswählbar)
- **SKU:** `fortress-ios` (nur intern, frei wählbar)

## 5. Provisioning-Profil

`developer.apple.com/account/resources/profiles` → **+** →
**App Store Connect** → App-ID `de.skkjbeer.fortress` → Zertifikat aus
Schritt 3 → Name vergeben, z. B. `FORTRESS AppStore`.

```bash
base64 -w0 FORTRESS_AppStore.mobileprovision
```

→ Secrets **`IOS_PROVISIONING_PROFILE`** (base64) und **`IOS_PROFILE_NAME`**
(der Name, **wörtlich** wie vergeben — daran findet xcodebuild es)

## 6. API-Schlüssel für den Upload

`appstoreconnect.apple.com/access/integrations/api` → **+**

- **Name:** `GitHub Actions`
- **Zugriff:** *App Manager*

Die `.p8`-Datei lässt sich **nur ein einziges Mal** laden. Sofort sichern.

```bash
base64 -w0 AuthKey_XXXXXXXXXX.p8
```

→ Secrets **`ASC_KEY_ID`** (die zehn Zeichen aus dem Dateinamen),
**`ASC_ISSUER_ID`** (steht über der Tabelle) und **`ASC_PRIVATE_KEY`** (base64)

> Ein API-Schlüssel statt eines app-spezifischen Passworts: kein persönliches
> Apple-Passwort im Repository, und jederzeit einzeln widerrufbar.

## 7. Secrets hinterlegen

`github.com/SKKJbeer/Fortress/settings/secrets/actions` → *New repository
secret*, für jeden der sieben Werte.

## 8. Hochladen

Actions → **iOS-Build (TestFlight)** → *Run workflow* → Haken bei
**„Nach TestFlight hochladen"** setzen.

Danach in App Store Connect unter *TestFlight*: die Verarbeitung dauert
10–30 Minuten. Beim ersten Build fragt Apple nach der
**Exportbestimmungs-Angabe** — FORTRESS nutzt nur HTTPS, also die
Standardausnahme; die Frage nach eigener Verschlüsselung wird mit **nein**
beantwortet.

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
| `No signing certificate` | `IOS_CERT_P12` oder das Passwort falsch |
| `No profile matching` | `IOS_PROFILE_NAME` stimmt nicht wörtlich mit Schritt 5 überein |
| `Bundle identifier mismatch` | App-ID aus Schritt 2 ≠ `capacitor.config.json` |
| `redundant binary upload` | Build-Nummer schon vergeben — erneut laufen lassen, sie steigt automatisch |
| `No profile for bundle identifier` | Profilname im Secret ≠ Profilname bei Apple, oder das Profil gilt für eine andere App-ID |
| `FEHLER: Secret ... fehlt` | genau das — der Build nennt den fehlenden Wert und bricht ab, bevor daraus eine kryptische codesign-Meldung wird |
| `has no member 'webView'` / `'reject'` (Capacitor-Plugins) | Xcode zu alt. Der Lauf waehlt das neueste installierte Xcode und bricht unter 16 ab — tritt das trotzdem auf, hat das Runner-Abbild nichts Neueres. |
