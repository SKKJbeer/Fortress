# App Store Connect — App-Datenschutz und Händlerstatus

> Zum Durchklicken. Stand v3.117.0 (04.10.2026). Jede Antwort folgt aus
> `public/privacy.html` — und die wird von `tests/datenschutz.test.js` gegen
> den Code gehalten. Ändert sich der Code, ändert sich zuerst die Erklärung,
> dann diese Liste.

## 1. App-Datenschutz (App Store Connect → App → App-Datenschutz → Bearbeiten)

**Datenschutzrichtlinie (URL):** `https://skkjbeer.github.io/Fortress/privacy.html`
(so steht sie bei Apple im Eintrag; dieselbe Seite wie
`https://stack-and-siege.pages.dev/privacy`). Wenn Apple nach der URL fragt,
diese eintragen — sie ist von `asc.py --fuellen` bereits gesetzt.

**„Erfasst du oder deine Drittanbieter Daten aus dieser App?"** → **Ja**

Dann genau diese vier Datentypen ankreuzen — sonst keine:

| Kategorie → Datentyp | Wozu (Zweck) | Mit Identität verknüpft? | Tracking? | Was es im Spiel ist |
|---|---|---|---|---|
| **Kennungen → Nutzer-ID** | App-Funktionalität | **Ja** | **Nein** | anonyme Firebase-Kennung (`uid`) |
| **Kennungen → Geräte-ID** | App-Funktionalität | **Ja** | **Nein** | zufällige Geräte-Kennung im Matchmaking (gegen Selbst-Match) |
| **Benutzerinhalte → Gameplay-Inhalte** | App-Funktionalität | **Ja** | **Nein** | Spielername, Wappen, Statistiken, Spielstand, Bestenliste, Cloud-Sicherung |
| **Nutzungsdaten → Produktinteraktion** | Analysen | **Nein** | **Nein** | anonyme Partie-Statistik und Ablauf-Zählung (ohne Name/Kennung) |

Ausdrücklich **nicht** ankreuzen: Kontaktdaten (Name, E-Mail, Telefon, Adresse),
Gesundheit, Finanzen, Standort, sensible Daten, Kontakte, Browserverlauf,
Suchverlauf, Käufe, Diagnose (Absturzdaten werden nicht gesammelt),
Werbedaten, sonstige Daten.

Begründungen, falls Apple nachfragt:
- **„Verknüpft: Ja"** bei den ersten drei: Die Daten hängen an der anonymen
  Kennung des Spielers (sonst ginge Cloud-Sicherung nicht). Ohne echten Namen
  ist das trotzdem „verknüpft" im Sinne von Apple.
- **„Tracking: Nein"** überall: keine Werbe-ID (IDFA), keine Weitergabe an
  Werbenetzwerke oder Datenhändler, kein App-übergreifendes Verfolgen. Die App
  fragt deshalb auch NICHT nach App-Tracking-Transparenz.
- **App Attest** (App Check) erzeugt einen gerätegebundenen Schlüssel bei
  Apple; das ist kein von uns erfasster Datentyp.

## 2. Händlerstatus nach dem EU-Digitale-Dienste-Gesetz (DSA)

**Zuerst nachsehen, was für das KONTO schon gilt** (App Store Connect →
Business → Compliance). Die Erklärung hängt am Konto; beim Schwesterprojekt
(Zählora) wurde sie bereits abgegeben. Dann ist die Konto-Ebene erledigt und
**dieselbe Einstufung gilt auch hier** — man wählt sie nicht je App neu.

Je App bleibt ein Schritt: **App Information → Digital Services Act**
bestätigen (so steht es in `LAUNCH-TODO.md` 1b, aus der Zählora-Erfahrung).

- Ist das Konto als **Händler** eingestuft, zeigt Apple Anschrift, E-Mail und
  Telefonnummer auf der EU-Produktseite — für diese App genauso wie für die erste.
- **Entscheidung des Betreibers (05.10.2026): In-App-Käufe sind geplant — also
  Händler.** Das ist die richtige Einstufung; „Kein Händler" wäre bei
  Monetarisierungsabsicht falsch. Die Kontaktdaten stehen damit auf der
  EU-Produktseite (und können von Suchmaschinen gefunden werden — wie schon bei
  der ersten App). Meine frühere Empfehlung „Kein Händler" ist damit hinfällig.
- Steht der Status noch auf „In Prüfung", scheitert die Einreichung mit der
  nichtssagenden Meldung „not in valid state". Bei Zählora dauerte es Tage.

Wird das Spiel später monetarisiert (In-App-Käufe, Werbung), muss der Status
auf **Händler** wechseln.

## 3. Danach — Einreichen in EINEM Schritt

Sobald 1. und 2. erledigt sind:
GitHub → Actions → **App Store (Stand / Eintragen)** → Run workflow →
Modus **`einreichen-probe`** (Trockenlauf: prüft Fassung, neuesten Bau, laufende
Einreichungen) → dann Modus **`einreichen`** mit der Eingabe
`bestaetigung` = `EINREICHEN`. Das setzt die Veröffentlichung auf **von Hand**
und reicht ein. Fehlt noch eine der beiden Pflichtangaben, lehnt Apple ab und
der Lauf zeigt die Meldung; nach dem Nachtragen einfach erneut starten.
(Oder: Claude sagen „einreichen".)

- `appstore.yml` → **marktreif** (nur lesen): die beiden Punkte verschwinden
  aus „NUR VON HAND" erst, wenn Apple sie bestätigt — die Schnittstelle meldet
  sie nicht, also bitte kurz Bescheid geben.
- Einreichen mit **manueller Veröffentlichung**: Nach der Freigabe bestimmst
  du den Tag, an dem die App sichtbar wird.
