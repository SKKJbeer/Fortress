# Die Website

Eine Werbeseite für Stack & Siege, ausgeliefert von **Cloudflare Pages** unter
`https://stack-and-siege.pages.dev/`. Sie ist von der Spielseite auf GitHub
Pages getrennt: Das Spiel bleibt, wo es ist, die Website wirbt dafür.

## Woraus sie besteht

| Ort | Inhalt |
|---|---|
| `docs/website/index.html` | Die Seite. Von Hand geschrieben, kein Bauwerkzeug. |
| `docs/website/stil.css` | Eine Stildatei. Keine fremde Schrift, kein fremdes Skript. |
| `docs/website/bilder/*.jpg` | Vier Bildschirmfotos aus dem echten Spiel, erzeugt von `tools/make-screenshots.cjs` (Ziel `website`). |
| `public/{impressum,privacy,agb}.html` | Die Rechtstexte. **Eine Quelle** — sie gehören zum Spiel und werden für die Website nur kopiert. |
| `scripts/website-bauen.sh` | Stellt beides zum Auslieferordner zusammen. |
| `scripts/check-website.mjs` | Sagt nein, wenn etwas fehlt. |
| `.github/workflows/website.yml` | Prüft und veröffentlicht bei jedem Push auf `main`. |

## Örtlich ansehen

```bash
scripts/website-bauen.sh build/website
node scripts/check-website.mjs build/website
cd build/website && python3 -m http.server 8790   # nicht 8765/8766 — die belegt die Testsuite
```

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

## Was noch fehlt, damit sie online geht

1. **Eine ladungsfähige Anschrift im Impressum.** `public/impressum.html` steht
   mit `[VORNAME NACHNAME]`, `[STRASSE HAUSNUMMER]`, `[PLZ ORT]` und
   `[E-MAIL-ADRESSE]` da. Solange das so ist, lehnt die Prüfung ab — ein
   Impressum mit Textlücke ist in Deutschland abmahnfähig, und eine Seite ohne
   Impressum ist es auch. Das ist der einzige inhaltliche Punkt.

2. **Zwei Geheimnisse für Cloudflare**, einmalig unter
   *Settings › Secrets and variables › Actions*:

   | Name | Woher |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | Cloudflare-Dashboard → *My Profile* → *API Tokens* → *Create Token* → Berechtigung **Cloudflare Pages: Edit** |
   | `CLOUDFLARE_ACCOUNT_ID` | steht in der Adresszeile des Dashboards: `dash.cloudflare.com/<hier>` |

   Das Pages-Projekt `stack-and-siege` legt der Ablauf selbst an. Es von Hand
   anzuklicken ist nicht nötig und führt leicht zu „Project not found", weil
   Cloudflare dann seinen eigenen Bauschritt erwartet.

Fehlen die Geheimnisse, läuft der Ablauf trotzdem: Er prüft die Seite und sagt
in seiner Zusammenfassung, dass nichts veröffentlicht wurde. Ein Lauf, der
nichts getan hat, soll nicht wie einer aussehen, der etwas getan hat.

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
