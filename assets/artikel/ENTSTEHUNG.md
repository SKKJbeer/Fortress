# Artikelbilder — Entstehung (seit v3.127.0)

Je ein gemaltes Bild fuer jeden kauf- und schmiedbaren Artikel (Kanonen,
Kugelspuren, Einschlaege, Sieges-Effekte) mit dem Skill
`.claude/skills/spielgrafik` (FLUX.1-schnell, Apache 2.0, lokal), 384 x 384,
`--cfg-scale 1.0 --sampling-method euler --steps 4`. Ins Spiel kommt eine
192-px-WebP-Fassung (`public/artikel/<id>.webp`, Qualitaet 86); Rohbilder
liegen hier daneben (`<id>-rohbild.png`). Rahmen bleiben gezeichnete Ringe.

Gemeinsamer Stil-Teil jedes Prompts:

```
mobile game shop item icon, stylized 3D cartoon render, hand-painted textures, a single object centered and fully visible, thick dark outlines, vibrant saturated colors, soft studio light, full bleed square, no border, no frame, no text, no letters,
```

| Artikel | Seed | Motiv-Teil |
|---|---|---|
| cannon_standard | 5 | a classic black iron cannon on sturdy wooden wheels, three quarter view, on a solid medium blue radial background |
| cannon_bronze | 5 | a polished bronze cannon with rivets and a flared trumpet muzzle on wooden wheels, three quarter view, on a solid warm orange radial background |
| cannon_steel | 5 | a sleek armored steel twin barrel cannon with metal plates and a muzzle brake, three quarter view, on a solid cool grey blue radial background |
| cannon_royal | 5 | an ornate golden royal cannon decorated with a crown, red gems and engravings, three quarter view, on a solid royal purple radial background |
| cannon_crystal | 5 | a magical cannon made of glowing cyan crystal prisms with a prism muzzle, three quarter view, on a solid deep teal radial background |
| cannon_obsidian | 5 | a dark obsidian monolith cannon with glowing violet runes and a ring muzzle, three quarter view, on a solid dark indigo radial background |
| cannon_dragon | 5 | a red dragon head cannon with scales, horns and fire glowing in its open jaws, three quarter view, on a solid dark red radial background |
| cannon_star | 5 | a deep blue cannon decorated with golden stars and a star shaped muzzle, three quarter view, on a solid midnight blue radial background |
| cannon_hexer | 5 | a purple witch cannon with a hooked curved barrel and magenta magic sparks, three quarter view, on a solid dark magenta radial background |
| trail_standard | 5 | a black iron cannonball flying with a short grey smoke trail, on a solid sky blue radial background |
| trail_ember | 5 | a cannonball flying with a long trail of fiery orange sparks and embers, on a solid dark blue radial background |
| trail_frost | 5 | a cannonball flying with a trail of sharp icy blue crystal shards, on a solid dark blue radial background |
| trail_venom | 5 | a cannonball flying with a trail of bubbling toxic green bubbles, on a solid dark blue radial background |
| trail_gold | 6 | a shiny golden cannonball flying fast, leaving a bright trail of glittering golden stars and sparkles, on a solid dark blue radial background |
| trail_ember_m | 5 | a glowing cannonball flying with a huge blazing trail of fire in red orange and yellow, magical aura, on a solid deep purple radial background |
| trail_frost_m | 5 | a glowing cannonball flying with a huge trail of ice crystals in white light blue and deep blue, magical aura, on a solid deep purple radial background |
| trail_venom_m | 5 | a glowing cannonball flying with a huge trail of toxic bubbles in lime and dark green, magical aura, on a solid deep purple radial background |
| trail_gold_m | 6 | a glowing radiant golden cannonball with a magical aura, leaving a huge swirling trail of golden stars, comet sparkles and light streaks, on a solid deep purple radial background |
| impact_standard | 5 | a cartoon explosion burst with orange fire and puffy grey smoke clouds, on a solid dark blue radial background |
| impact_lava | 5 | a molten lava splash explosion with glowing rocks flying up, on a solid dark brown radial background |
| impact_ice | 5 | an explosion of shattering ice crystals and frost shards, on a solid deep blue radial background |
| impact_blitz | 5 | a crackling lightning strike burst with bright yellow electric sparks, on a solid dark navy radial background |
| impact_void | 5 | a swirling purple void vortex implosion pulling sparkles inward, on a solid black purple radial background |
| win_confetti | 5 | a festive burst of colorful confetti and curly ribbons, on a solid teal radial background |
| win_fireworks | 5 | colorful fireworks rockets exploding into bright star bursts, on a solid night blue radial background |
| win_goldrain | 6 | a festive shower of falling shiny golden stars, gold nuggets and glittering sparkles raining down from above, celebration, on a solid warm purple radial background |

## Verworfen und nachbearbeitet

- **Gold-Spur, Gold-Meisterspur, Goldregen:** zweimal mit Muenzen mit
  Dollarzeichen gemalt, der Goldregen mit einem Geldkoffer — wirkt wie echtes
  Geld, in einem Spiel ohne Echtgeld-Kaeufe das falsche Signal. „no dollar
  signs" im Prompt half NICHT (das Wort zieht das Motiv eher an). Neu gemalt
  ganz ohne Muenzen: goldene Sterne, Funken, Nuggets (Seed 6).
- **Goldregen:** auch die dritte Fassung trug in der Mitte eine Kiste mit
  „$" — mit einem Ausschnitt des Sternenhimmels aus demselben Bild
  ueberdeckt (`retusche.py`). Das Rohbild hier ist bereits die Retusche.
