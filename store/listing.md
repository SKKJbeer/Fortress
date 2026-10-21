# Store-Texte — Stack & Siege

Vorlage für App Store Connect und Google Play. Zeichengrenzen sind eingehalten
und in Klammern vermerkt; sie sind bei beiden Anbietern **hart**.

Was hier **nicht** steht, ist Absicht: keine Superlative, keine erfundenen
Nutzerzahlen, keine Vergleiche mit anderen Spielen. Beides fällt in der Prüfung
auf, und keins davon verkauft ein Strategiespiel.

---

## Apple App Store

### Name (max. 30)
```
Stack & Siege – Burgenduell
```
27 Zeichen von 30. **Die Begruendung hat sich mit dem Namen gedreht:** Beim
alten Namen war der Zusatz noetig, weil das Hauptwort als Suchbegriff
hoffnungslos belegt war. „Stack & Siege" ist dagegen eine erfundene Verbindung
— am 12.09. ueber Apples Suche geprueft, im deutschen App Store traegt keine App
diesen Namen. Der Zusatz steht jetzt aus einem anderen Grund da: Er sagt einem
deutschen Sucher, worum es geht, und bringt ein Wort ins Feld, das jemand
tatsaechlich eintippt. Ohne ihn faende die App nur, wer sie schon kennt.

### Untertitel (max. 30)
```
Strategie zu zweit, offline
```
27 Zeichen. **Neu seit 1.0.2 (21.10.2026).** Vorher „Mauern bauen, Festung knacken" —
reine Handlung, ohne Suchwort, das wir gewinnen koennen. Gemessen am 21.10. gegen
Apples Suche (DE, Top 200): „strategie zu zweit" hat nur 33 Treffer, die grossen
Begriffe („2 spieler", „offline spiele") 150-190, besetzt von Apps mit dem Wort im
Namen. Das Alleinstellungsmerkmal — zu zweit oder dritt an EINEM Geraet, ohne
Internet — gehoert dorthin, wo Apple sucht und wo der Mensch zuerst liest.

### Werbetext (max. 170, jederzeit änderbar ohne neue Version)
```
Zu zweit oder zu dritt an einem Gerät – ganz ohne Internet. Baue deine Burg aus fallenden Steinen und schieße die des Gegners auf. Eine Lücke entscheidet.
```
154 Zeichen.

### Beschreibung (max. 4000)
```
Zwei oder drei Spieler, ein Gerät, kein Internet nötig. Ihr sitzt euch
gegenüber, und jeder hat sein Bedienfeld an der eigenen Kante – richtig herum.

Zwei Burgen, ein Fluss dazwischen. Du baust deine Mauer aus fallenden
Steinen — der Gegner schießt sie dir wieder weg.

EINE REGEL ENTSCHEIDET
Ist deine Burg am Ende der Bauphase nicht rundum ummauert, hast du
verloren. Auch diagonal. Eine einzige Lücke genügt, und der Gegner
weiß genau, wo sie ist.

DER RHYTHMUS
Bauen, schießen, aufrüsten — und wieder von vorn. Alle spielen
gleichzeitig, niemand wartet auf einen Zug. Jede Phase dauert nur
Sekunden, jede Entscheidung wirkt bis ins Endspiel.

ZWEI ARTEN VON KANONEN
Der Mauerbrecher reißt Löcher in die Verteidigung. Der Bezwinger
trifft nur Kanonen und schaltet die Feuerkraft des Gegners aus — so
teuer, dass er frühestens ab der zweiten Runde zu haben ist.

SIEBEN WELTEN, ZWÖLF GESICHTER
Jede Partie spielt in einer anderen gemalten Landschaft, vom
Frostreich bis in den Vulkanschlund. Zwölf gemalte Avatare schaltest
du mit steigender Stufe frei.

AN EINEM GERÄT, OHNE INTERNET
Zu zweit oder zu dritt auf demselben Bildschirm: Zu zweit sitzt ihr euch
gegenüber, Shop, Bauteil-Vorschau und Anzeigen stehen für jeden an der
eigenen Kante. Es braucht kein Netz, kein Konto, kein WLAN — auch nicht
für die Übung gegen den Bot in drei Stufen.

ONLINE
Oder spiele online gegen zufällige Gegner und mit Freunden über einen Code.

SAMMELN UND SCHMIEDEN
Erspielte Beute wird zu Ausbauten, erspieltes Gold zu Kosmetik:
Kanonen, Einschläge, Kugelspuren, Siegeseffekte. Seltene Materialien
aus Online-Partien lassen sich in der Schmiede zu Stücken verarbeiten,
die es im Shop nicht gibt.

EHRLICH GESAGT
Stack & Siege ist kostenlos spielbar. Keine Werbung, kein Kaufzwang, kein
Pay-to-Win — der volle Spielumfang steht ohne Zahlung offen. Gold und
Kosmetik sind Anerkennung für Gespieltes, kein Verkaufsartikel.
```

### Schlüsselwörter (max. 100, kommagetrennt, keine Leerzeichen)
```
festung,bauen,burg,belagerung,kanone,dritt,gegeneinander,lokal,mehrspieler,mittelalter,ohne,internet
```
100 Zeichen. **Neu seit 1.0.2 (21.10.2026)**, gemessen gegen Apples Suche (DE, Top 200):
- Raus: `steine` (Treffer sind Steinbestimmung), `bot`, `taktik`, `burgen`, `2,spieler`,
  `multiplayer`. Mit ihnen standen wir bei „2 spieler", „zu zweit", „offline spiele",
  „lokaler multiplayer" auf KEINEM Platz in den Top 200 — die Zeichen waren verschenkt.
  Wieder aufnehmen, sobald Bewertungen und Downloads da sind.
- Rein: `dritt` (mit „zu" aus dem Untertitel: „zu dritt", nur 4 Treffer), `gegeneinander`
  (15), `lokal`, `mehrspieler`, `ohne`+`internet`, dazu `festung`+`bauen`, die aus dem
  alten Untertitel hierher wandern — Apple kombiniert feldübergreifend, „festung bauen"
  stand vorher auf Platz 9 und „festung bauen offline" auf Platz 1.
- Gelaufen am 21.10.: „festung bauen offline" 1, „festung bauen" 9, „kanonen strategie" 24,
  „belagerung" 35, „festung" 63; „stack siege" 2.

Frühere Überarbeitung am 07.10.2026 (`tests/store.test.js` hält die Regeln fest):
- **„tetris" raus** — fremde Marke. Apple lehnt Marken in Schlagworten ab
  (Richtlinie 2.3.7); das hätte die Prüfung kosten können.
- **„rundenbasiert" raus** — falsch: gespielt wird gleichzeitig in Phasen mit
  Uhr. Wer danach sucht, erwartet etwas anderes und springt ab.
- **Keine Wörter aus Name und Untertitel** („festung", „mauer", „duell"):
  Apple durchsucht beide ohnehin, im Schlagwortfeld wären sie verschenkt.
- **„2,spieler" getrennt**: Apple kombiniert Schlagworte untereinander — so
  greift „2 spieler" UND „spieler" einzeln.
Der Spielname gehört **nicht** hinein — Apple durchsucht ihn ohnehin.

### Neuigkeiten (max. 4000, nur Updates — Fassung 1.0.1)
```
Besser zu sehen, auf jedem Gerät:
• Schrift ist auf allen Hintergründen scharf und klar lesbar.
• Der Zieler hat eine dunkle Kontur und ist auf allen sieben Welten gut sichtbar – auch auf Schnee, Sand und Herbstlaub.
• Zu dritt an einem Gerät überdecken sich die Rüst-Shops nicht mehr.
• Kleinere Korrekturen an Anzeigen, die auf kleinen Telefonen über ihren Rand ragten.
```
Wird von `asc.py` nur bei Updates eingetragen (`ist_update()`); bei der ersten
Fassung lehnt Apple das Feld ab. Für jede neue Fassung neu schreiben.

**Entwurf für Fassung 1.0.2** (bewusst KEIN Codeblock: `tests/fassung.test.js` verlangt, dass
der Block oben zur `MARKETING_VERSION` passt. Beim Heben auf 1.0.2 die Überschrift oben auf
1.0.2 stellen und diesen Text einsetzen):

> Neu: Zu zweit am selben Gerät sitzt ihr euch jetzt gegenüber. Jeder Spieler hat Shop,
> Bauteil-Vorschau und Anzeigen an seiner Kante, richtig herum — und das Bauteil hebt sich
> von seinem Finger weg. Dazu:
> • Der Ton bleibt nach dem Minimieren nicht mehr hängen und läuft nicht doppelt.
> • Kleine Schrift ist schärfer und besser lesbar.
> • Neue Bildschirmfotos im App Store.

Hinweis zu 1.0.2: Der neue Einstiegssatz der Beschreibung („Ihr sitzt euch gegenüber …")
stimmt erst, wenn 1.0.2 mit v3.132.0 oder später ausgeliefert wird. Bis dahin NICHT mit
`fassung=1.0.1` einspielen (die Fassung ist ohnehin in Prüfung und gesperrt).

### Altersfreigabe
4+ — Gewaltdarstellung ist abstrakt (Blöcke zerfallen), keine Figuren, kein
Blut, keine Schrift von Dritten im Spiel.

### Datenschutz-Angaben (App Privacy)
Die verbindlichen Antworten stehen in **`store/app-datenschutz.md`** (vier
Datentypen, „verknüpft: ja", „Tracking: nein") — sie folgen aus
`public/privacy.html`, und die wird gegen den Code geprüft. Die frühere
Kurzfassung hier („verknüpft: nein") war falsch: Spielstand und Bestenlisten-
Eintrag hängen an der anonymen Kennung.

---

## Google Play

### Titel (max. 30)
```
Stack & Siege – Burgenduell
```

### Kurzbeschreibung (max. 80)
```
Baue deine Burg, schieß die des Gegners auf. Eine Lücke entscheidet.
```
67 Zeichen.

### Vollständige Beschreibung (max. 4000)
Wie oben (App Store), unverändert übernehmbar.

### Kategorie
Spiele → Strategie

### Data-Safety-Formular
| Frage | Antwort |
|---|---|
| Werden Daten erhoben? | Ja |
| Welche? | Spielername (Pseudonym), Spielstand, App-Aktivität |
| Zweck? | Spielfunktion (Online-Partien, Rangliste, Sicherung des Fortschritts) |
| Verschlüsselt übertragen? | Ja (HTTPS/WSS) |
| Löschung möglich? | Ja — im Spiel unter *Profil → Fortschritt löschen* |
| Mit Dritten geteilt? | Nein |
| Für Werbung/Tracking? | Nein |

---

## Beide Stores

**Datenschutz-URL**
```
https://skkjbeer.github.io/Fortress/privacy.html
```

**Grafiken** liegen unter `store/`:
- `ios-6.7/` — 1290×2796, Pflichtformat für die Einreichung; `ipad-12.9/` —
  2048×2732. Sieben **Plakate** je Größe mit Schlagzeile, das stärkste zuerst
  (Apple zeigt in der Suche nur die ersten drei). Erzeugt von
  `node tools/make-store-bilder.cjs alles` aus ECHTEN Spielaufnahmen
- `ios-6.7-en/`, `ipad-12.9-en/` — dieselben Plakate mit englischer Oberfläche
  und Schlagzeile (für en-US und en-GB)
- `feature-graphic-1024x500.png` — nur Google Play
- Play-Telefonbilder: `public/screenshots/` (1080×2340)

**Hinweis an die Prüfung** (Apple, Feld „App Review Information → Notes")

**Auf Englisch, und das ist eine Entscheidung.** Ein Entwicklerkonto ohne
Prüfhistorie bekommt mit hoher Wahrscheinlichkeit eine Rückfrage nach
**Richtlinie 2.1 „Information Needed"** — sieben Punkte, auf Englisch gestellt,
kein Mangel an der App. Bei Zählora kam sie am 3. September und kostete zwei
Tage. Dieser Text beantwortet die sieben Punkte **vorab**; wer in der Sprache
der Frage antwortet, wird sicher verstanden.

Die Oberfläche bleibt deutsch — **die Wörter, die ein Prüfer auf dem Bildschirm
sucht, stehen deshalb mit Umlaut im Text** und nicht in Umschrift. Genau daran
wäre er sonst an der einen Stelle wertlos, an der er zum Bildschirm passen muss.

Kommt die Rückfrage trotzdem, gehört derselbe Text **zusätzlich als Antwort ins
Lösungscenter** — Apple verlangt beides.

```
NO ACCOUNT, NO LOGIN, NO CREDENTIALS. This build has no sign-in and no user
accounts, and therefore no account deletion flow. Progress is stored on the
device and, as a backup, under an anonymous identifier. The player can erase
everything at any time: main menu, the blue person button in the profile card
("Edit profile" / "Profil bearbeiten"), tab "Account" / "Konto", then
"Delete progress" / "Fortschritt löschen" - it wipes both the device and the
backup.

THE APP WILL BE IN ENGLISH ON YOUR DEVICE.
The interface follows the device language (German on a German device, English
elsewhere). Both labels are listed below; a DE/EN switch sits in the main menu.

SEEING EVERYTHING TAKES ONE MINUTE, WITH NO NETWORK.
Main menu → "PLAY LOCAL (1 Device)" (German: "LOKAL SPIELEN (1 Gerät)"), then
"Practice vs Bot" (German: "Übung gegen Bot") and a difficulty. A complete
match runs offline. That is the shortest path to the whole game.

1. PURPOSE AND AUDIENCE
Stack & Siege is a real-time castle strategy game for one to three players,
available in German and English. All players act at the same time in short timed
phases - there are no turns. Each player walls in a castle from falling block pieces
during the build phase, then fires cannons at the other castles. A castle that is
not completely sealed when the build phase ends is lost. It is a game, not a
utility; the audience is casual players.

2. MAIN FEATURES AND WHERE THEY ARE
- "PLAY LOCAL (1 Device)" / "LOKAL SPIELEN (1 Gerät)": two or three players
  share one device; also holds "Practice vs Bot" (single player against the
  computer) and the tutorial "How to play?".
- "PLAY ONLINE (2-3 Devices)" / "ONLINE SPIELEN (2-3 Geräte)": matchmaking
  against another player, or a six-character room code shared between friends.
- Profile card (menu, top): name, avatar, level and rating, with a row of round
  buttons - profile, achievements, daily tasks, gold shop (cosmetics paid for
  with in-game gold that is earned by playing) and forge. Gold cannot be
  bought. There is no real money anywhere in this app.

3. EXTERNAL SERVICES, TOOLS AND PLATFORMS
One: Google Firebase (Realtime Database, anonymous Authentication, App Check
with App Attest), used solely for online matchmaking, the live state of an
online match, a leaderboard, a backup of the player's progress and anonymous
match statistics without name or identifier. Sign-in is anonymous - no e-mail,
no password, no personal data. There is no advertising, no third-party
analytics SDK, no tracking across apps or websites, no AI service and no
payment processor. The app loads no executable code at runtime; everything ships in the
bundle.

4. REGIONAL DIFFERENCES
None. Content and features are identical in every region; German/English is a
language setting, not a regional difference.

5. REGULATED INDUSTRY OR PROTECTED MATERIAL
Neither. No regulated service, no gambling, no licensed media. The painted
artwork (backgrounds, avatars, item pictures) was made for this app. Sound
effects and music are CC0, the two fonts are under the SIL Open Font License,
and the interface draws its own vector icons.

6. IN-APP PURCHASES
None. No subscriptions, no consumables, no real currency. The in-game gold is
earned only by playing and cannot be purchased.

7. PLAYER-TO-PLAYER INTERACTION
In an online match a player sees the opponent's self-chosen display name and
can send one of six fixed emoji reactions. There is no free-form chat, no
image or file sharing, and no way to send text to another player.

WHY THIS IS NOT A WRAPPED WEBSITE (guideline 4.2)
The app is self-contained and fully playable without a network: after the first
launch a complete match against the bot runs offline, because every asset ships
inside the bundle. The online mode is an addition, not a prerequisite. The app
has a native launch screen, native haptics, no browser chrome and no address
bar, and it never fetches code from a server.
```

Der Verweis auf den Bot-Weg ist kein Beiwerk: Ein Prüfer, der ein Spiel öffnet
und nicht binnen Sekunden hineinkommt, bewertet das, was er gesehen hat.

**Was hier bewusst NICHT steht:** dass die App auf einem echten Gerät geprüft
wurde. Das kann nur der Gründer sagen.

### Was nur der Gründer liefern kann

Punkt 7 der 2.1-Rückfrage ist eine **Bildschirmaufnahme auf einem echten
Gerät** — kein Skript erzeugt sie. Eine Minute genügt:

1. App starten, „LOKAL SPIELEN" → „Übung gegen Bot" → Stufe wählen.
2. Eine Bauphase spielen: Teil drehen, ablegen, Burg schließen.
3. Eine Schussphase: zielen, feuern, Treffer.
4. Zurück ins Menü, Profil öffnen — Level, Abzeichen, Kosmetik-Laden.
5. „ONLINE SPIELEN" antippen, damit die Suche einmal sichtbar ist.

Schritt 4 ist der, den man vergisst, und der zeigt, dass es kein Prototyp ist.
