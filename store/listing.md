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
Mauern bauen, Festung knacken
```
29 Zeichen.

### Werbetext (max. 170, jederzeit änderbar ohne neue Version)
```
Baue deine Burg aus fallenden Steinen und schieße die des Gegners auf.
Eine Lücke in deiner Mauer entscheidet die Partie. Online oder offline
gegen den Bot.
```

### Beschreibung (max. 4000)
```
Zwei Burgen, ein Fluss dazwischen. Du baust deine Mauer aus fallenden
Steinen — der Gegner schießt sie dir wieder weg.

EINE REGEL ENTSCHEIDET
Ist deine Burg am Ende der Bauphase nicht rundum ummauert, hast du
verloren. Auch diagonal. Eine einzige Lücke genügt, und der Gegner
weiß genau, wo sie ist.

DER RHYTHMUS
Bauen, schießen, aufrüsten — und wieder von vorn. Jede Runde dauert
Sekunden, jede Entscheidung wirkt bis ins Endspiel.

ZWEI ARTEN VON KANONEN
Der Mauerbrecher reißt Löcher in die Verteidigung. Der Bezwinger
trifft nur Kanonen und schaltet die Feuerkraft des Gegners aus — er
ist so teuer, dass du in der ersten Runde auf alles andere verzichten
musst, um ihn zu bekommen.

ONLINE ODER ALLEIN
Spiele online gegen zufällige Gegner, mit Freunden über einen Code,
zu zweit an einem Gerät — oder offline gegen den Bot in drei Stufen.

SAMMELN UND SCHMIEDEN
Erspielte Beute wird zu Ausbauten, erspieltes Gold zu Kosmetik.
Seltene Materialien aus Online-Partien lassen sich in der Schmiede zu
Stücken verarbeiten, die es im Shop nicht gibt.

EHRLICH GESAGT
Stack & Siege ist kostenlos spielbar. Keine Werbung, kein Kaufzwang, kein
Pay-to-Win — der volle Spielumfang steht ohne Zahlung offen. Gold und
Kosmetik sind Anerkennung für Gespieltes, kein Verkaufsartikel.
```

### Schlüsselwörter (max. 100, kommagetrennt, keine Leerzeichen)
```
burg,festung,strategie,mauer,kanone,duell,2spieler,rundenbasiert,offline,tetris,belagerung,taktik
```
99 Zeichen. Der Spielname gehört **nicht** hinein — Apple durchsucht ihn ohnehin.

### Altersfreigabe
4+ — Gewaltdarstellung ist abstrakt (Blöcke zerfallen), keine Figuren, kein
Blut, keine Schrift von Dritten im Spiel.

### Datenschutz-Angaben (App Privacy)
- **Erfasste Daten:** Spielername (Pseudonym), Spielstand, Spielverlauf
- **Verknüpft mit der Identität:** nein — die Firebase-Kennung ist anonym
- **Für Tracking verwendet:** nein
- **Werbenetzwerke:** keine

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
- `ios-6.7/` — 1290×2796, Pflichtformat für die Einreichung
- `ios-6.5/` — 1242×2688
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
everything at any time: main menu, the avatar button at the top, then
"Delete progress" / "Fortschritt löschen" - it wipes both the device and the
backup.

THE APP WILL BE IN ENGLISH ON YOUR DEVICE.
The interface follows the device language: German on a German device, English
everywhere else. On your device you will therefore see ENGLISH labels. Both
are listed below so you can find them either way; a DE/EN switch sits in the
main menu under the title.

SEEING EVERYTHING TAKES ONE MINUTE, WITH NO NETWORK.
Main menu → "PLAY LOCAL (1 Device)" (German: "LOKAL SPIELEN (1 Gerät)"), then
"Practice vs Bot" (German: "Übung gegen Bot") and a difficulty. A complete
match runs offline. That is the shortest path to the whole game.

1. PURPOSE AND AUDIENCE
Stack & Siege is a turn-based artillery game for two or three players, available in
German and English. Each player walls in a castle from falling tetromino pieces during a
timed build phase, then fires cannons at the other castles. A castle that is
not completely sealed when the build phase ends is lost. It is a game, not a
utility; the audience is casual players.

2. MAIN FEATURES AND WHERE THEY ARE
- "PLAY LOCAL (1 Device)" / "LOKAL SPIELEN (1 Gerät)": two or three players
  share one device; also holds "Practice vs Bot" (single player against the
  computer) and the tutorial "How to play?".
- "PLAY ONLINE (2-3 Devices)" / "ONLINE SPIELEN (2-3 Geräte)": matchmaking
  against another player, or a six-character room code shared between friends.
- Profile (menu, top): name, crest, colour, level, achievements, daily tasks,
  and a cosmetics shop paid for with in-game gold that is earned by playing.
  Gold cannot be bought. There is no real money anywhere in this app.

3. EXTERNAL SERVICES, TOOLS AND PLATFORMS
One: Google Firebase Realtime Database, used solely for online matchmaking, the
live state of an online match, and a leaderboard. Sign-in is anonymous - no
e-mail, no password, no personal data. There is no advertising, no analytics
product, no tracking across apps or websites, no AI service and no payment
processor. The app loads no executable code at runtime; everything ships in the
bundle.

4. REGIONAL DIFFERENCES
None. Content and features are identical in every region. The interface follows
the device language and offers German and English; that is a language setting,
not a regional difference.

5. REGULATED INDUSTRY OR PROTECTED MATERIAL
Neither. No regulated service, no gambling, no licensed media. Sound effects
and music are CC0. The interface draws its own vector icons.

6. IN-APP PURCHASES
None. No subscriptions, no consumables, no real currency. The in-game gold is
earned only by playing and cannot be purchased.

7. PLAYER-TO-PLAYER INTERACTION (declared for completeness)
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
