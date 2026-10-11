# Gemalte Weltboeden — Entstehung (seit v3.122.0)

Erzeugt mit dem Skill `.claude/skills/spielgrafik` (FLUX.1-schnell, Apache 2.0,
lokal), 576 x 896, ohne Hochrechnen auf Brettgroesse 616 x 952 gebracht
(`public/welten/<welt>.jpg`, JPEG 85). Parameter: `--cfg-scale 1.0
--sampling-method euler --steps 4`. Rohbilder liegen hier daneben.

Gemeinsamer Stil-Teil jedes Prompts:

```
top-down orthographic view of a mobile strategy game map ground, seen straight from above, stylized hand-painted cartoon texture, gentle even daylight, vibrant saturated colors, full bleed texture filling the entire image, flat ground only, no buildings, no castles, no river, no water, no trees, no characters, no text, no letters, no border
```

| Welt | Seed | Motiv-Teil |
|---|---|---|
| Kristalltal | 7 | lush bright green grass meadow with subtle color variation, small clumps of flowers, a few tiny light blue crystal shards scattered, soft dirt patches |

Fluss, Berge und Burgen zeichnet weiter der Spielcode darueber; die
prozedurale Deko entfaellt auf gemalten Boeden (wirkte dort wie Rauschen).
