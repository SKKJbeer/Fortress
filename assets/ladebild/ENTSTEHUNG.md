# Ladebild / Startschirm — Entstehung (v3.120.0)

Erzeugt mit dem Skill `.claude/skills/spielgrafik` (FLUX.1-schnell, lokal).
Gewaehlt nach 7 Varianten in 3 Prompt-Fassungen (Qualitaetspruefung je Bild):

| Fassung | Seeds | Ergebnis |
|---|---|---|
| 1: 8 Figuren + Burgen | 7, 42, 99 | Figuren gut, aber keine Kanonenschlacht; Kreuz auf Turm |
| 2: Haelften-Aufbau, 6 Figuren | 11, 77 | Schlacht da, aber Pestdoktor fehlt bzw. Figuren verschmolzen |
| 3: Pestdoktor gross in der Mitte, 4 Figuren | 11, **303** | 303 gewaehlt |

| Feld | Wert |
|---|---|
| Modell | FLUX.1-schnell, GGUF Q4_0 (second-state), Apache 2.0 |
| Seed | **303** |
| Groesse | 576 x 1024, Real-ESRGAN x4plus anime 6B (BSD-3) → 1152 x 2048 |
| Parameter | `--cfg-scale 1.0 --sampling-method euler --steps 4` |

## Prompt (wortgleich)

```
vertical mobile game loading screen splash art, cartoon style with chunky proportions and big heads, stylized 3D render, hand-painted textures, vibrant saturated colors, thick dark outlines, full bleed illustration filling the entire image, no border, no frame, no text, no letters. Upper half: an epic battle between two cartoon castles across a river, on the left a castle with glossy blue stone block walls and blue cone roofs, on the right a castle with glossy red stone block walls and red cone roofs, big black cannons on both walls firing flaming cannonballs at each other, explosions and flying blocks, a fiery phoenix in the sky. Lower half, center foreground, large: the hero, a hooded plague doctor with a long white bird beak mask, round glowing green goggles, dark green cloak with golden trim, holding up a glowing green lantern. Next to him on the left a green Frankenstein monster, on the right a purple witch skeleton with a pointed hat and a small flaming fire skull. Golden sunset light, highly detailed
```

Figuren = freischaltbare Avatare: Pestdoktor (Lv 25), Frankenstein (Lv 15),
Hexerin (Lv 5), Feuerschaedel (Lv 20), Phoenix (Lv 50).

## Dateien

- `rohbild-576x1024.png` — Ausgabe des Modells, unveraendert
- `vorlage-1152x2048.png` — hochgerechnet; Quelle der Ausspielung
- Ausgespielt mit `scripts/ladebild.py`:
  `public/ladebild.jpg` (Web, 1080x1920) und
  `ios/App/App/Assets.xcassets/Splash.imageset/splash.png` (1152x2048, ohne Alpha)

```
python3 .claude/skills/spielgrafik/scripts/ladebild.py assets/ladebild/vorlage-1152x2048.png \
  --web public/ladebild.jpg \
  --ios ios/App/App/Assets.xcassets/Splash.imageset/splash.png --ios-breite 1152
```
