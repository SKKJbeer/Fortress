# Die Website

Eine Werbeseite für Stack & Siege, ausgeliefert von **Cloudflare Pages** unter
`https://stack-and-siege.pages.dev/`. Sie ist von der Spielseite auf GitHub
Pages getrennt: Das Spiel bleibt, wo es ist, die Website wirbt dafür.

## Woraus sie besteht

| Ort | Inhalt |
|---|---|
| `docs/website/index.html` | Die Seite. Von Hand geschrieben, kein Bauwerkzeug. |
| `docs/website/stil.css` | Eine Stildatei. Keine fremde Schrift, kein fremdes Skript. |
| `docs/website/bilder/*.jpg` | Fuenf Bildschirmfotos aus dem echten Spiel, erzeugt von `tools/make-screenshots.cjs` (Ziel `website`). Alles Uebrige ist gezeichnet — siehe unten. |
| `public/{impressum,privacy,agb}.html` | Die Rechtstexte. **Eine Quelle** — sie gehören zum Spiel und werden für die Website nur kopiert. |
| `scripts/website-bauen.sh` | Stellt beides zum Auslieferordner zusammen. |
| `scripts/check-website.mjs` | Sagt nein, wenn etwas fehlt. |
| `scripts/testflight-stand.py` | Fragt bei Apple, ob die offene Beta schon Tester annimmt. |
| `.github/workflows/website.yml` | Prüft und veröffentlicht bei jedem Push auf `main` — und einmal täglich. |

## Örtlich ansehen

```bash
scripts/website-bauen.sh build/website
node scripts/check-website.mjs build/website
cd build/website && python3 -m http.server 8790   # nicht 8765/8766 — die belegt die Testsuite
```

## Die Gestaltung: Entwurf „Einschlag"

Aus sechs Entwürfen (`docs/entwuerfe/`) gewählt. Das Prinzip: **die Seite
bewegt sich, so wie das Spiel sich bewegt.**

- Der Anfang besteht aus **Schichten**, die beim Scrollen unterschiedlich
  schnell laufen — Parallaxe wie bei Alto's Odyssey (dort neun Ebenen).
- **Kugeln fliegen quer durchs Bild**, und alle paar Sekunden zittert die
  Überschrift, als sei etwas eingeschlagen. Gleichmässiges Wackeln wäre
  Zierrat; ein kurzer harter Stoss mit langer Ruhe liest sich als Treffer.
- Die **sieben Welten** stehen als grosse, gezeichnete Kacheln in einer eigenen
  Galerie und heben sich beim Überfahren aus dem Rahmen.

Alles aus CSS. Kein Skript, keine Bibliothek, keine fremde Anfrage.
`prefers-reduced-motion` friert jede Bewegung ein.

Was bewusst **fehlt**, weil es nach Software-Baukasten aussieht: Kopfnavigation
mit fünf Punkten, Drei-Spalten-Karten mit Symbolen, „So funktioniert's" in drei
Schritten, Zahlenreihen als Beleg, Kundenstimmen, Aufklapp-Fragen, gekippte
Telefon-Attrappen. Pressezitate und Auszeichnungen wären das nächste Mittel
echter Spieleseiten — die gibt es hier nicht, und erfunden werden sie nicht.

Die anderen fünf Entwürfe bleiben in `docs/entwuerfe/` liegen. Sie werden
**nicht** ausgeliefert (das Bauskript kopiert nur `docs/website/`) und sind die
Begründung dafür, warum es diese Fassung geworden ist.

## Gezeichnet statt abfotografiert

Die Fassung davor war eine Bildschirmfoto-Galerie: achtzehn Aufnahmen aus dem
Spiel, ordentlich aufgereiht. Das zeigt, was da ist, und macht keine Lust
darauf.

Jetzt trägt die Seite **Zeichnungen**:

- Die **sieben Welten** sind gemalte Szenen — Himmel, Berge, ein glimmender
  Fluss, zwei Burgen mit Zinnen, Requisiten je nach Welt: Kristalle, Bäume,
  Kakteen, Glutpunkte. Eine Szene, sieben Farbsätze; die Werte stammen aus
  `WORLD_THEMES` in `src/engine/terrain.ts`. Es ist also nicht erfunden, nur
  nicht abfotografiert.
- Ebenfalls gezeichnet: die **Landschaft im Anfang**, die **beiden Kanonen**
  und die **vier Einblicke** (Amboss, Münzstapel, Pokal, Merkzettel).
- Der **Zierrahmen** (`.rahmen`) setzt Zinnen auf die Oberkante und Nieten in
  die vier Ecken; die Kleinüberschriften sitzen auf einem **Band** mit zwei
  Zipfeln statt nackt in der Luft.

Alles Inline-SVG und CSS: **null zusätzliche Anfragen, null Kilobyte
Bilddaten**, und in jeder Grösse scharf.

**Echte Aufnahmen stehen nur noch dort, wo sie die Aussage tragen:** bei „zu
zweit und zu dritt an einem Gerät" sind die Bauteil-Felder unten im Bild der
Beweis, dass zwei Leute gleichzeitig spielen — eine Zeichnung könnte das nur
behaupten. Dazu ein kurzer Streifen „So sieht es wirklich aus". Macht fünf
Bilder statt achtzehn, 512 kB statt 1097.


## Der TestFlight-Knopf

Er steht **nur dann** auf der Seite, wenn die offene Beta wirklich Tester
annimmt. Ein öffentlicher TestFlight-Link existiert nämlich schon, sobald die
externe Gruppe existiert — er funktioniert aber erst, wenn Apple den Bau für
die Beta freigegeben hat. Vorher zeigt dieselbe Adresse „This beta isn't
accepting any new testers right now"; ein Knopf dorthin wäre dasselbe leere
Versprechen wie ein App-Store-Abzeichen ohne App im Store.

Entschieden wird das bei jedem Veröffentlichen: `testflight-stand.py` fragt
Apple, `website-bauen.sh` behält einen von zwei Blöcken — `TESTFLIGHT:ANFANG …
TESTFLIGHT:ENDE`, wenn die Beta offen ist, sonst `WARTEN:ANFANG … WARTEN:ENDE`
mit dem Browser-Knopf und einem Satz zum Stand. Die Seite wirbt für die App;
ohne Ersatzblock hätte sie solange gar keinen Handlungsaufruf. Ohne Apple-Zugang —
also bei einem Bau von Hand — fällt er ebenfalls weg: Die vorsichtige Annahme
ist die richtige, wenn niemand nachgesehen hat.

Die Freigabe passiert außerhalb des Repositories, ändert also keine Datei und
löst keinen Push aus. Deshalb läuft der Ablauf **einmal täglich** — sonst
bliebe der Knopf weg, bis jemand von Hand nachfragt.

Die Gruppe heißt `Öffentlich` und wird von
`scripts/asc-testflight.py --oeffentlich` angelegt (Actions → „App Store (Stand
/ Eintragen)" → Modus `oeffentlich`). Dasselbe Skript reicht den neuesten Bau
zur Beta-Prüfung ein.

## Was die Prüfung verlangt

Sie bricht ab, statt eine halbfertige Seite online zu lassen. Geprüft wird
unter anderem:

- **Keine Platzhalter.** Jede eckige Klammer im sichtbaren Text gilt als Lücke.
- **Kein Skript, keine fremde Ressource.** Darauf steht die Zusage „keine
  Cookies, kein Zustimmungsfenster". Ein einziges eingebundenes Schriftpaket
  von einem fremden Server würde sie brechen, und man sieht ihr das nicht an.
- **Kein toter Verweis**, insbesondere nicht auf Impressum, Datenschutz und
  Nutzungsbedingungen.
- **Bilder unter 400 kB**, mit Alternativtext und mit Maßen im Markup.

## Die Einrichtung — erledigt

Beides steht seit dem 12.09.:

1. **Die Anschrift im Impressum.** `public/impressum.html` stand bis dahin mit
   vier Platzhaltern da, und die Prüfung lehnte ab — ein Impressum mit
   Textlücke ist in Deutschland abmahnfähig, eine Seite ohne Impressum
   ebenfalls.

2. **Die zwei Cloudflare-Geheimnisse** unter *Settings › Secrets and variables
   › Actions*:

   | Name | Woher |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | Cloudflare-Dashboard → *My Profile* → *API Tokens* → *Create Token* → Berechtigung **Cloudflare Pages: Edit** |
   | `CLOUDFLARE_ACCOUNT_ID` | steht in der Adresszeile des Dashboards: `dash.cloudflare.com/<hier>` |

   Sie kamen aus dem Schwesterprojekt — dasselbe Konto, dasselbe Token; „Pages:
   Edit" gilt für jedes Pages-Projekt des Kontos. Das Projekt `stack-and-siege`
   hat der Ablauf selbst angelegt; von Hand anzuklicken führt leicht zu
   „Project not found", weil Cloudflare dann seinen eigenen Bauschritt erwartet.

Fehlen die Geheimnisse einmal, läuft der Ablauf trotzdem: Er prüft die Seite
und sagt in seiner Zusammenfassung, dass nichts veröffentlicht wurde. Ein Lauf,
der nichts getan hat, soll nicht wie einer aussehen, der etwas getan hat.

## Bilder erneuern

Nach einer Änderung am Spiel:

```bash
npm run build
cd dist && python3 -m http.server 8765 &   # der Aufnehmer braucht einen Server
node tools/make-screenshots.cjs            # erneuert Store- UND Website-Bilder
```

Aufgenommen wird das echte Spiel im Bot-Selbstspiel, keine Montage. Das Werkzeug
bricht ab, wenn zwei Bilder identisch sind oder ein Phasen-Schild das Brett
verdeckt.
