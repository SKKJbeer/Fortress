# Store-Texte — FORTRESS

Vorlage für App Store Connect und Google Play. Zeichengrenzen sind eingehalten
und in Klammern vermerkt; sie sind bei beiden Anbietern **hart**.

Was hier **nicht** steht, ist Absicht: keine Superlative, keine erfundenen
Nutzerzahlen, keine Vergleiche mit anderen Spielen. Beides fällt in der Prüfung
auf, und keins davon verkauft ein Strategiespiel.

---

## Apple App Store

### Name (max. 30)
```
FORTRESS – Burgenduell
```
21 Zeichen. „Fortress" allein ist als Suchbegriff hoffnungslos belegt; der
Zusatz macht sofort klar, worum es geht, und ist auffindbar.

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
FORTRESS ist kostenlos und bleibt es. Keine Werbung, keine Käufe mit
echtem Geld, keine Abonnements. Gold und Kosmetik haben keinen Wert
außerhalb des Spiels — sie sind Anerkennung, kein Verkaufsartikel.
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
FORTRESS – Burgenduell
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

**Hinweis an die Prüfung** (Apple, Feld „App Review Information → Notes"):
```
FORTRESS ist ein eigenständiges Spiel, kein verpackter Webauftritt.
Es läuft vollständig offline: nach dem ersten Start ist eine komplette
Partie gegen den Bot ohne Internetverbindung spielbar (Service Worker,
alle Ressourcen liegen im Bundle). Der Online-Modus ist eine Zusatz-
funktion, keine Voraussetzung.

Zum Testen: „LOKAL SPIELEN" → „Übung gegen Bot" → Stufe wählen.
Ein Konto wird nicht benötigt und in dieser Fassung auch nicht angeboten.
```
Dieser Hinweis zielt auf **Richtlinie 4.2 (Minimum Functionality)** — den
wahrscheinlichsten Ablehnungsgrund. Er benennt die Offline-Fähigkeit, weil sie
der stärkste Beleg dagegen ist.
