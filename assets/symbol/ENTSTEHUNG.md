# App-Symbol — Entstehung (v3.119.0)

Erzeugt mit dem Skill `.claude/skills/spielgrafik` (FLUX.1-schnell, lokal).
Gewaehlt vom Betreiber: Entwurf 3 von 3 (Seeds 101, 202, 303).

| Feld | Wert |
|---|---|
| Modell | FLUX.1-schnell, GGUF Q4_0 (second-state), Apache 2.0 |
| Text-Encoder | t5xxl Q4_0, clip_l Q8_0; VAE ae f16 |
| Werkzeug | stable-diffusion.cpp (MIT), CPU |
| Seed | **303** |
| Groesse | 512 x 512, danach Real-ESRGAN x4plus anime 6B (BSD-3) → 1024 |
| Parameter | `--cfg-scale 1.0 --sampling-method euler --steps 4` |

## Prompt (wortgleich)

```
mobile strategy game app icon artwork, stylized 3D cartoon render, hand-painted textures, full bleed square illustration filling the entire image, no border, no rounded corners, no frame. In the foreground a hooded plague doctor hero character with a long white bird beak mask and round glowing green goggles, dark green hooded cloak with golden trim, holding a wooden staff with a glowing green lantern. Behind him a medieval castle tower with a blue cone roof and a blue flag, castle walls built from glossy blue stone blocks, on a small floating grass island. A flaming cannonball smashes into the wall with a big orange comic explosion and flying blue blocks. Vibrant saturated colors, bold dark outlines, warm rim light, blue sky with sun rays background, highly detailed, no text, no letters
```

Die Figur ist der freischaltbare Avatar **Pestdoktor (ab Level 25)**.

## Dateien

- `rohbild-512.png` — Ausgabe des Modells, unveraendert
- `vorlage-1024.png` — hochgerechnet; Quelle aller Symbole
- Ausgespielt mit `scripts/symbole.py`: iOS-AppIcon, `public/icon-*.png`,
  `public/icon-maskable-*.png`, `store/play-icon-512.png`,
  `docs/website/favicon.svg`

Neu ausspielen (z. B. nach Austausch der Vorlage):

```
python3 .claude/skills/spielgrafik/scripts/symbole.py assets/symbol/vorlage-1024.png \
  --ios ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png \
  --pwa public --maskable public --play store/play-icon-512.png \
  --favicon-svg docs/website/favicon.svg
```
