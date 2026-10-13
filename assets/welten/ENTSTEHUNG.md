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
| Vulkanschlund | 7 | dark brown and charcoal volcanic rock ground with bright glowing orange lava cracks in thin veins, warm ash patches, small red embers, friendly cartoon look not scary |
| Nebelmoor | 7 | mossy swamp ground in fresh greens and teal, small muddy puddle spots, little mushrooms and lily-like plants, soft misty light |
| Herbstwald | 7 | forest floor of soft grass covered with bright orange red and yellow fallen leaves, small acorns and mushrooms, warm autumn light |
| Astralebene | 7 | magical floor of smooth lavender and deep blue stone with softly glowing cyan rune lines and tiny twinkling stars, dreamy fantasy look |
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

Vulkanschlund: helle Lavastroeme liefen quer ueber das Feld — mit dem Fluss
(Lava, nicht bebaubar) zu verwechseln, und rote Mauern gingen darauf unter.
Leuchtende Pixel sind gedaempft (Helligkeit −68 %, Saettigung −50 %), das
Gestein ist um 20 % aufgehellt.

Nebelmoor: orangefarbene Kugeln (lasen sich wie Kanonenkugeln) zu Moospolstern
und ein blauer Bach am Rand (Verwechslung mit dem Fluss) zu Moorwasser
umgefaerbt — nach Farbton, nicht uebermalt.

Herbstwald: drei rote Aepfel mit Grasflicken aus demselben Bild entfernt; die
Flicken sind farblich an ihre Umgebung angeglichen (die Wiese hat einen
Helligkeitsverlauf, ungeglichene Flicken standen als helle Quadrate da).

Astralebene: eine leuchtend tuerkise Linie lief senkrecht durch das ganze Feld
und wirkte wie eine Grenze; das Leuchten (auch in den Fugen) ist in das
Lavendel der Platten umgefaerbt und gedaempft.

Werkzeuge der Nachbearbeitung: `retusche.py` (Flicken mit Farbangleich),
`umfaerben.py` (Farbton-Bereiche), `glut.py` (Leuchten daempfen),
`risse.py` (dunkle Linien abschwaechen) — im Skill spielgrafik dokumentiert.

## Beruhigt fuer das Spielfeld (v3.128.0)

Gemeldet aus TestFlight: Die gemalten Elemente (Steine, Bueschel, Laub,
Moospolster) waren so kontrastreich, dass sie wie Hindernisse wirkten —
„man muss / kann ja darueber bauen". Hindernis ist allein der Fluss.

Deshalb laeuft jedes Bild (Retusche bzw. Rohbild) vor der Auslieferung durch
`scripts/beruhigen.py` des Skills spielgrafik mit
`anteil_scharf 0.7, radius 4, kontrast 0.62, saettigung 0.82`: leicht
weichgezeichnet, flacher, etwas entsaettigt. Starke Weichzeichnung wurde
probiert und verworfen — das Laub im Herbstwald sah dann unscharf aus wie ein
zu klein aufgeloestes Bild. Was Hindernis-Charakter erzeugt, ist die
plastische Schattierung, nicht die Kante.

Dazu zeichnet das Spiel auf gemalten Boeden keine prozeduralen Berge mehr
(Code 4 — sie sperrten nie, sahen aber wie Felsen aus).
