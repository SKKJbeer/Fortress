# Avatare — Entstehung (seit v3.125.0)

Jeder der zwoelf Avatare ist einzeln gemalt mit dem Skill
`.claude/skills/spielgrafik` (FLUX.1-schnell, Apache 2.0, lokal), 512 x 512,
Seed 11, `--cfg-scale 1.0 --sampling-method euler --steps 4`. Ins Spiel kommt
eine 256-px-WebP-Fassung (`public/wappen/<schluessel>.webp`, Qualitaet 86);
die Rohbilder liegen hier daneben (`<schluessel>-rohbild.png`).

Gemeinsamer Stil-Teil jedes Prompts:

```
mobile strategy game avatar portrait icon, stylized 3D cartoon render, hand-painted textures, chunky proportions, bust of a single character facing the viewer, centered, thick dark outlines, vibrant saturated colors, warm rim light, highly detailed, full bleed square, no border, no frame, no text, no letters,
```

| Schluessel | Motiv-Teil |
|---|---|
| skelett | a friendly spooky skeleton wearing a dark purple hooded robe, glowing violet eyes, on a solid deep purple background with soft glow |
| waldhueter | a forest guardian warrior in green leaf armor and a rusty red helmet with glowing green eyes, on a solid deep green background with soft glow |
| eismagier | an ice mage with a frosty blue hood and a glowing snowflake crystal emblem, frost breath, on a solid icy cyan background with soft glow |
| roboter | a round dark steel robot head with two glowing yellow eyes and small antenna, on a solid slate blue background with soft glow |
| hexerin | a young cheeky witch girl with bright green skin, wild red hair, a tall crooked purple witch hat with a golden moon buckle, mischievous grin, sparkling purple magic in her hand, on a solid magenta purple background with soft glow |
| kanone | a living cannon character, a sturdy iron cannon robot with one big glowing orange eye in the barrel opening and riveted armor, on a solid teal blue background with soft glow |
| frankenstein | a friendly green Frankenstein monster with flat top hair, neck bolts and stitched forehead, yellow glowing eyes, on a solid orange background with soft glow |
| feuerschaedel | a flaming skull with bright orange and yellow fire hair and glowing red eyes, on a solid dark red background with soft glow |
| pestdoktor | a plague doctor with a long white bird beak mask, round glowing green goggles and a dark green hood with golden trim, on a solid dark green background with soft glow |
| blitz | a lightning spirit made of a bold golden lightning bolt with glowing electric eyes and crackling sparks, on a solid dark navy background with soft glow |
| trojanischespferd | a cute wooden trojan horse head made of planks with brass bolts and glowing amber eyes, on a solid warm brown background with soft glow |
| phoenix | a majestic fiery phoenix bird head with flaming orange and gold feathers and bright eyes, on a solid deep crimson background with soft glow |

**Verworfen:** Die erste Hexerin folgte dem alten Motiv („witch skeleton") und
war ein Skelett mit Hexenhut — zu nah am Skelett-Avatar. Neu gemalt als junge
Hexe; nur die zweite Fassung ist im Spiel.

Die Schluessel und ihre Reihenfolge sind unveraendert (Netz-Vertrag,
`playerInfo.wappen`); nur die Bilder sind neu.
