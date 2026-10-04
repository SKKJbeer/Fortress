# App Store Connect — App-Datenschutz und Händlerstatus

> Zum Durchklicken. Stand v3.117.0 (04.10.2026). Jede Antwort folgt aus
> `public/privacy.html` — und die wird von `tests/datenschutz.test.js` gegen
> den Code gehalten. Ändert sich der Code, ändert sich zuerst die Erklärung,
> dann diese Liste.

## 1. App-Datenschutz (App Store Connect → App → App-Datenschutz → Bearbeiten)

**Datenschutzrichtlinie (URL):** `https://stack-and-siege.pages.dev/privacy`

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

App Store Connect → **Business** → Händlerstatus (gilt fürs Konto, dann je App bestätigen).

**Empfehlung: „Kein Händler" (Non-Trader).** Begründung: kostenloses
Hobbyprojekt, keine Käufe mit echtem Geld, keine Werbung, keine
Gewinnerzielungsabsicht.

Folge: Apple zeigt im EU-App-Store **keine Anschrift und Telefonnummer** an.
Wählst du „Händler", werden Name, Anschrift, Telefon und E-Mail öffentlich
auf der Produktseite angezeigt.

Wird das Spiel später monetarisiert (In-App-Käufe, Werbung), muss der Status
auf **Händler** wechseln.

## 3. Danach

- `appstore.yml` → **marktreif** (nur lesen): die beiden Punkte verschwinden
  aus „NUR VON HAND" erst, wenn Apple sie bestätigt — die Schnittstelle meldet
  sie nicht, also bitte kurz Bescheid geben.
- Einreichen mit **manueller Veröffentlichung**: Nach der Freigabe bestimmst
  du den Tag, an dem die App sichtbar wird.
