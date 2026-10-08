---
name: spielgrafik
description: Hochwertige Spielgrafik (App-Symbole, Figuren, Store-Bilder, Hintergruende, Werbegrafik) im Stil grosser Mobile-Games erzeugen — lokal mit FLUX.1-schnell, ohne Kosten und ohne fremden Dienst. Verwenden, wenn ein Projekt ein neues App-Symbol, eine Illustration oder ein anderes Grafikelement braucht, das professionell und nicht nach Baukasten-3D oder Pixelgrafik aussehen soll.
---

# Spielgrafik mit FLUX (lokal)

Erprobt bei Stack & Siege (App-Symbol v3.119.0). Ergebnis auf Augenhoehe mit
handgemalter Mobile-Game-Grafik — deutlich besser als selbstgebautes
three.js/SVG (beides versucht, beides wirkte „billig 3D" bzw. „Baukasten").

## Was NICHT funktioniert hat (nicht wiederholen)
- **SVG/Vektor von Hand**: sauber, aber amateurhaft.
- **three.js mit PBR, Bloom, Toon-Shading, Konturen**: wirkt wie ein
  einfaches Blender-Set. Zu wenig Detail, egal wie viel Licht.
- **Kostenlose Online-Generatoren ohne Schluessel** (z. B. pollinations):
  fallen auf schwache Modelle zurueck, Wasserzeichen, 768 px.

## Werkzeuge und Lizenzen (alle kommerziell frei)
| Teil | Lizenz | Zweck |
|---|---|---|
| FLUX.1-schnell (GGUF Q4_0, second-state) | Apache 2.0 | Bild erzeugen |
| stable-diffusion.cpp | MIT | laeuft auf der CPU |
| Real-ESRGAN x4plus anime 6B | BSD-3 | 512 → 2048 hochrechnen |

Nie FLUX.1-dev, SDXL-Turbo oder SD-Turbo nehmen — nicht-kommerzielle Lizenz.

## Ablauf

1. **Einrichten** (einmal je Maschine, ~10 GB, ~5 Min):
   `bash .claude/skills/spielgrafik/scripts/einrichten.sh`
   Ziel: `$SPIELGRAFIK_HOME` (Vorgabe `~/.cache/spielgrafik`). Im
   Cloud-Container den Scratchpad nehmen — nichts davon gehoert ins Repo.
   **Rauchtest vor jedem langen Lauf:** `bash scripts/erzeugen.sh /tmp/t.png 1 test 64x64`
   muss ein Bild liefern. Stirbt `sd-cli` still (Exit 132 = SIGILL), war es
   fuer einen anderen Prozessor gebaut — `einrichten.sh` erneut laufen lassen,
   es baut dann portabel neu (ist bei Stack & Siege nach einem
   Container-Wechsel genau so passiert: drei Laeufe „fertig", null Bilder).
2. **Beschreibung schreiben** (Englisch, siehe Regeln unten).
3. **Varianten erzeugen — immer 512 px, mehrere Seeds:**
   `bash scripts/erzeugen.sh <ausgabe.png> <seed> "<prompt>" [512 | BxH]`
   Hochformat (Ladebild, Store-Bild): `576x1024`, Kanten durch 64 teilbar,
   dauert ~2,3x so lang.
   Dauer auf 4 CPU-Kernen: **~10 Min je Bild**. 1024 direkt kostet ~40 Min
   und bringt nichts — hochrechnen ist schneller und schaerfer. Drei Seeds
   nacheinander im Hintergrund laufen lassen, nicht parallel (alle Kerne
   sind schon belegt).
4. **Ansehen und auswaehlen.** Jedes Bild WIRKLICH anschauen: Text-Artefakte,
   religioese Symbole (ein Kreuz auf der Turmspitze kam vor), seltsame
   Anatomie (Zaehne unter dem Schnabel), Rahmen/abgerundete Ecken im Bild.
   Dem Nutzer mehrere zeigen, mit `scripts/vorschau.py` (iOS-Rundung und
   kleine Groessen — viele Motive kippen erst bei 40 px).
5. **Hochrechnen:** `bash scripts/hochskalieren.sh <in.png> <out-1024.png>`
6. **Herkunft festhalten:** Prompt, Seed, Modell, Schritte, Groesse in eine
   `ENTSTEHUNG.md` neben die Vorlage. Ohne Seed+Prompt ist ein Bild nicht
   reproduzierbar, und FLUX kann ein Bild nicht „ein bisschen aendern".
7. **Ausspielen** (bei Symbolen): `python3 scripts/symbole.py vorlage.png ...`
   erzeugt iOS (1024, OHNE Alphakanal — Apple lehnt sonst ab, und zwar erst
   NACH dem Hochladen per Mail), PWA (gerundet), maskable (vollflaechig),
   Play (512) und ein Favicon-SVG mit eingebettetem PNG.

8. **Ladebild/Startschirm** (Hochformat `576x1024` erzeugen, auf `2304x4096`
   hochrechnen mit `hochskalieren.sh in.png out.png 1152x2048`): `python3
   scripts/ladebild.py vorlage.png --web public/ladebild.jpg --ios
   ios/.../Splash.imageset/splash.png`. Web als JPEG (leicht), iOS als PNG
   ohne Alpha.

## Prompt-Regeln
- Stil-Anker: `mobile strategy game app icon artwork, stylized 3D cartoon
  render, hand-painted textures, vibrant saturated colors, bold dark outlines,
  warm rim light, highly detailed`.
- **Immer**: `full bleed square illustration filling the entire image, no
  border, no rounded corners, no frame` — sonst malt FLUX selbst eine
  Icon-Kachel mit weissem Rand, und iOS rundet dann doppelt.
- **Immer**: `no text, no letters`.
- **Keine Marken- oder Spielenamen** in der Beschreibung (Store-Richtlinie,
  Verwechslungsgefahr). Den Stil beschreiben, nicht das Vorbild nennen.
- Figur zuerst und konkret (Kleidung, Farben, was sie haelt), dann
  Hintergrund, dann Licht. Projektfarben ausdruecklich nennen.
- **Hoechstens 4–5 Figuren je Bild.** Bei 8+ Figuren verschmilzt FLUX sie
  (Pferdekopf auf Monster, Maske als Turm, Laterne ohne Traeger) — gemessen
  bei Stack & Siege, 5 Laeufe. Hauptfigur ausdruecklich „center foreground,
  large" nennen, sonst faellt ausgerechnet sie weg.
- Bildaufbau in Haelften beschreiben („Upper half: …", „Lower half: …") —
  das hat die Burgschlacht erst zuverlaessig ins Bild gebracht.
- Gegen religioese Symbole hilft nur Ansehen und Verwerfen (Kreuze auf
  Turmspitzen kamen zweimal vor).
- FLUX.1-schnell: `--cfg-scale 1.0 --steps 4 --sampling-method euler`.
  Mehr Schritte verbessern schnell nichts.

## Grenzen (dem Nutzer ehrlich sagen)
- Kein gezieltes Nachbessern einzelner Stellen: neue Seeds statt Retusche.
- Figuren aus dem Spiel werden nachempfunden, nicht exakt getroffen.
- KI-Bilder sind urheberrechtlich schwach geschuetzt; nutzen darf man sie.

## Vorgaben des Betreibers
- Grafik fuer dieses und andere Projekte kuenftig auf diesem Weg erstellen.
- Keine Emojis in UI-Grafik, keine Verweise auf aeltere Spiele.
