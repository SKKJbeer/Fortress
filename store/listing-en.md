# Store texts — English (en-US, en-GB)

Same rules as `store/listing.md`: hard character limits, no superlatives, no
invented numbers, no references to other games. `scripts/asc-sprachen.py`
reads the fenced blocks below and writes them to App Store Connect for
**en-US and en-GB**. The headings are the same as in the German file so one
parser serves both.

**Why English at all.** Until 07.10.2026 the listing existed only in German —
the app was invisible to every English search in every storefront, although
the game itself has been fully playable in English for a long time (it follows
the device language).

## Apple App Store

### Name (max. 30)
```
Stack & Siege – Castle
```
22 characters, shortened on 21.10.2026 (with 1.0.2) so the search result row does not cut it
off — on an iPhone about 23 characters show next to the button, and the old name appeared
as "Stack & Siege – Castle D…".

### Untertitel (max. 30)
```
2-3 players, one device
```
23 characters. **New with 1.0.2 (21.10.2026).** Before: "Build walls. Breach the fort." —
pure action, no search word we can win. The unique feature (two or three players on ONE
device, no internet) now sits where Apple searches and where people read first.
Measured 21.10. against Apple's search (US, top 200): no English term ranked at all
("castle", "fortress", "2 player", "local multiplayer" …), so the English listing is
about being read correctly, not about a ranking we hold today.

### Werbetext (max. 170)
```
Two or three players on one device – no internet needed. Build your castle from falling blocks and blast your rival's walls. One gap decides the match.
```

### Beschreibung (max. 4000)
```
Two or three players, one device, no internet needed. You sit face to face, and everyone has their controls on their own edge of the screen – the right way up.

Two castles, a river in between. You build your wall from falling blocks — your opponent shoots it down again.

ONE RULE DECIDES
If your castle is not fully walled in when the build phase ends, you lose. Diagonals count. A single gap is enough, and your opponent knows exactly where it is.

THE RHYTHM
Build, shoot, arm up — and again. Everyone plays at the same time, nobody waits for a turn. Every phase lasts seconds, every decision carries into the endgame.

TWO KINDS OF CANNON
The Wall Breaker tears holes into the defence. The Slayer only hits cannons and takes out your opponent's firepower — so expensive that you cannot afford it before round two.

SEVEN WORLDS, TWELVE FACES
Every match takes place in a different painted landscape, from frozen plains to a volcano's maw. Twelve painted avatars unlock as your level rises.

ONE DEVICE, NO INTERNET
Two or three players on the same screen. With two you sit face to face: shop, piece preview and displays face each player from their own edge. No network, no account, no Wi-Fi needed — not even for practice against the bot on three levels.

ONLINE
Or play online against random opponents and with friends via a code.

COLLECT AND FORGE
Spoils become upgrades, gold becomes cosmetics: cannons, impacts, ball trails, victory effects. Rare materials from online matches can be forged into pieces you cannot get in the shop.

HONESTLY
Stack & Siege is free to play. No ads, no pay-to-win — the full game is open without paying. Gold and cosmetics are a reward for playing.
```

### Schlüsselwörter (max. 100)
```
fortress,cannon,strategy,tactics,medieval,multiplayer,local,offline,defense,pvp,versus,couch,party
```
Not repeated: words from name and subtitle (stack, siege, castle, duel, players,
one, device) — Apple searches those anyway. No trademarks. Dropped on 21.10.2026:
`2`, `player`, `bot`, `blocks` ("2 player" is now covered by the subtitle's "players",
and none of them ranked); added `versus`, `couch`, `party` for the local-play audience.

### Neuigkeiten (What's New, max. 4000 — version 1.0.2)
```
New: with two players on one device you now sit face to face. Each player gets the shop, piece preview and displays on their own edge, the right way up – and the piece lifts away from their own finger.
• Sound no longer gets stuck or doubles after minimising the app.
• New screenshots in the App Store.
```

The block above belongs to version 1.0.2 (`MARKETING_VERSION`). Rewrite it for the next version.

Note for 1.0.2: the new opening sentence of the description ("You sit face to face …") is
only true once 1.0.2 ships with v3.132.0 or later.
