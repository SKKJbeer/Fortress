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
| Glutwüste | 7 | warm golden sand desert ground with gentle dune ripples, cracked light clay patches, scattered small orange pebbles and tiny dry tufts |
| Frostreich | 7 | snowy white ground with soft blue shadows, patches of frosted pale green grass peeking through, small ice crystals and smooth snow drifts |

Fluss, Berge und Burgen zeichnet weiter der Spielcode darueber; die
prozedurale Deko entfaellt auf gemalten Boeden (wirkte dort wie Rauschen).

## Retusche

Das Modell haelt sich nicht immer an „no buildings": Frostreich kam mit zwei
angeschnittenen Haeusern in den Ecken, zwei Kisten und einem Baumstamm. Sie
sind mit sauberen Schneeflaechen AUS DEMSELBEN BILD ueberdeckt (Flicken mit
weichem Rand), nicht neu gemalt. `*-rohbild.png` ist die Ausgabe des Modells,
`*-retusche.png` die Vorlage fuer `public/welten/`.

Glutwueste: zwei breite, dunkle Risse liefen quer ueber das ganze Feld und
lasen sich wie Grenzlinien. Sie sind abgeschwaecht (dunkle Pixel zur Farbe der
Umgebung gezogen), nicht entfernt — die Textur bleibt.
