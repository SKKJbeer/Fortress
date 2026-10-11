# Menue-Hintergrund — Entstehung (v3.121.0)

Erzeugt mit dem Skill `.claude/skills/spielgrafik` (FLUX.1-schnell, lokal).
Ruhiges Motiv ohne Figuren, damit Knoepfe und Profilkarte darauf lesbar bleiben;
nach unten dunkelt `bildHintergrund()` (src/ui/stil.js) ab.

| Feld | Wert |
|---|---|
| Modell | FLUX.1-schnell, GGUF Q4_0 (second-state), Apache 2.0 |
| Seed | **5** |
| Groesse | 576 x 1024, Real-ESRGAN x4plus anime 6B (BSD-3) → 1152 x 2048 |
| Parameter | `--cfg-scale 1.0 --sampling-method euler --steps 4` |

Verwendet fuer Menue und Ergebnisbildschirm: `public/menu-hintergrund.jpg` (1080x1920, JPEG 82).

## Prompt (wortgleich)

```
vertical mobile game main menu background art, cartoon style, stylized 3D render, hand-painted textures, vibrant saturated colors, thick dark outlines, full bleed illustration filling the entire image, no border, no frame, no text, no letters, no characters, no people. A friendly fantasy landscape seen from a hilltop: in the distance a castle with glossy blue stone block walls and blue cone roofs with flags on the left, and a castle with glossy red stone block walls and red cone roofs on the right, a sparkling blue river between them, green rolling meadows, a few trees, a wooden cannon on the grass in the foreground corner. Bright blue sky with big soft fluffy clouds and warm golden sunlight. Calm open composition with lots of sky in the middle, highly detailed
```
