# FORTRESS — Claude-Kontext für Weiterentwicklung

## Projekt-Übersicht

**FORTRESS** ist ein 2–3-Spieler PWA-Burgenspiel (Neuauflage des Flash-Klassikers "Festung").
Spieler bauen Burgmauern aus Tetrominos und beschiessen danach gegenseitig ihre Festungen.

- **Live-URL**: https://skkjbeer.github.io/Fortress/
- **Repo**: https://github.com/SKKJbeer/Fortress
- **Aktuelle Version**: v3.0.9
- **Sprache**: Deutsch (UI und Kommentare)

---

## Technischer Aufbau

### Dateien
| Datei | Inhalt |
|---|---|
| `index.html` | **Die einzige Quelldatei** — kompiliertes React (kein separates JSX mehr). ~3600 Zeilen. Enthält alles: Spiel-Logik, Rendering, Firebase, UI. |
| `FORTRESS-SPEC.md` | Verbindliche Spielspezifikation + vollständiger Changelog. **Immer mitpflegen bei Änderungen.** |
| `fortress-pwa.html` | Ältere PWA-Shell-Datei, nicht mehr aktiv genutzt. |
| `.github/workflows/deploy.yml` | Auto-Deployment: Push auf `main` → GitHub Pages + Git-Tag + GitHub Release. |

### Stack
- **React** via unpkg CDN (kein Build-Schritt nötig — `index.html` direkt editieren)
- **Firebase Realtime Database** für Online-Multiplayer (Web SDK v10.12.2, ES-Module via gstatic CDN)
- **GitHub Pages** für Hosting
- **localStorage** für Spieler-Profile

### Build-Workflow
```
index.html direkt editieren
→ git push origin main
→ GitHub Actions deployt automatisch
→ Version wird aus <title>FORTRESS vX.Y.Z</title> gelesen
```

**Versionen immer an 2 Stellen hochsetzen:**
1. `<title>FORTRESS vX.Y.Z</title>` (Zeile ~11)
2. `"⚔️ FORTRESS · Version X.Y.Z"` (Versionsanzeige im Menü, Zeile ~2815ff)

**SPEC immer mitpflegen:**
1. `# FORTRESS — Spezifikation & Regelwerk (aktuell: vX.Y.Z)` (Zeile 1)
2. Changelog-Eintrag am Ende von `FORTRESS-SPEC.md`

---

## Spielmechanik (Kurzreferenz)

- **Phasen**: Setup (20s) → Build (25s) → Shoot (30s) → Cannon (12s) → Build ...
- **Verlust**: Burg am Bauende nicht vollständig von Mauern umschlossen (Flood-Fill)
- **Kanonen**: schießen nur wenn zu Beginn der Schussrunde vollständig ummauert (`frozenReady`)
- **Grid**: 44×68 Zellen, 14px pro Zelle (W=616, H=952)
- **Spieler**: P1=Blau(♔), P2=Rot(♚), P3=Grün(♜)

---

## Online-Multiplayer-Architektur

- **Firebase Schema**: `/games/{code}/` → `{ state, guestAction2, guestAction3, numPlayers, createdAt, updatedAt }`
- **Host (P1) ist autoritativ**: berechnet alles, pusht State
- **Gäste**: senden Actions, rendern empfangenen State via `applyState()`
- **Session-Token**: `hostSessionRef` verhindert State-Verwechslung bei mehreren Spielen
- **Rate-Limit**: max 8 Pushes/Sek, force-Push für Spielende

### Gast-Slot-Reservierung
- P2: schreibt in `guestAction2` via Firebase-Transaktion (`fb.reserve`)
- P3: schreibt in `guestAction3` (nur bei numPlayers=3)
- Atomare Reservierung verhindert Race-Condition beim gleichzeitigen Beitreten

### Kritische applyState-Reihenfolge (seit v3.0.7)
**Phase/Timer/Runde/Scores/Screen werden ZUERST gesetzt**, bevor Grid/Terrain/Objekte
verarbeitet werden. Die schwere Verarbeitung läuft in eigenem try/catch. Nie wieder
rückgängig machen — verhindert dass Gäste in alter Phase einfrieren.

---

## Wichtige Refs und State

| Ref/State | Typ | Bedeutung |
|---|---|---|
| `grid.current` | 2D-Array | Spielfeld (EMPTY=0, WALL1=1, WALL2=2, CANNON1=3, ...) |
| `phase_r.current` | string | Aktuelle Phase (setup/build/shoot/cannon/result) |
| `numPlayersRef.current` | number | 2 oder 3 |
| `myRole.current` | number | 0=Menü, 1=Host, 2=Gast2, 3=Gast3 |
| `online.current` | bool | Online-Modus aktiv |
| `frozenReady.current` | `{1:[],2:[],3:[]}` | Eingefrorne schussbereite Kanonen-IDs je Spieler |
| `pieces.current` | `{1:{cells,ghostR,ghostC}, ...}` | Aktuelle Bauteile |
| `cannons.current` | `{1:[...], 2:[...], 3:[...]}` | Alle Kanonen mit HP, Position, ID |
| `eliminated.current` | `{3: true}` | Ausgeschiedene Spieler |
| `eloChangeRef.current` | `{oldElo, newElo, delta}` | ELO-Änderung der letzten Runde (null = noch keine) |
| `playerInfo.current` | `{1:{name,wappen,color,elo}, ...}` | Spieler-Infos inkl. ELO der Gegner |
| `terrainSeed.current` | number | PRNG-Seed für deterministisches Terrain |
| `terrain.current` | object | `{grid, seed, mode3, sectorMap, borderRow}` |
| `hostSessionRef.current` | string | Session-ID des aktuellen Hosts (Gast prüft dagegen) |
| `statRecorded.current` | bool | Verhindert doppeltes ELO-Recording pro Spiel |

---

## Spieler-Profil & ELO

- **localStorage-Key**: `fortress_profile`
- **Felder**: `id, name, wappen, color, stats{wins,losses,games}, stats3, elo, elo3`
- **ELO**: Standard-Formel, K=32, Startpunkt 1000
- **Nur Online-Spiele** zählen für Stats und ELO
- **Leaderboard**: Firebase `/leaderboard/{playerId}` — sortiert nach ELO

---

## 3-Spieler-Besonderheiten

- **Terrain**: Y-förmig (Hub bei 40% Höhe), Flussarme bei 70°/180°/290°
- **Sektorzuweisung**: `buildSectorMap()` — Flood-Fill von den Burgen (NICHT Winkel!)
  - Gäste müssen `sectorMap` aus Seed+Castles neu berechnen (deterministisch)
  - Validierung Host vs. Ghost muss identisch sein → beide nutzen `sectorMap`
- **Zell-Typen**: WALL3=10, CANNON3=11, CASTLE3=12
- **Farben**: `ROOF_OF`, `FLAG_OF`, `ACCENT_OF` für alle 3 Spieler definiert
- **Verlust**: Spieler mit offener Burg wird `eliminated`, Spiel endet bei ≤1 übrig

---

## Performance-Regeln (nicht verletzen!)

- **Offscreen-Canvas** (`bgCanvas`, `bgDirty`): Terrain nur neu rendern wenn `bgDirty=true`
- **Flood-Fill-Cache** (`floodCache`, `gridVersion`): `computeOutsideMap` nur bei Grid-Änderung
- **`setGrid(newG)`** muss verwendet werden (erhöht `gridVersion`) — NIE `grid.current =` direkt
- **`canvasRect.current`**: nur bei pointerdown/resize/scroll neu holen, nicht bei pointermove
- Alle Spielzustände in **Refs** (keine React-Re-Renders im Render-Loop)

---

## Bekannte gelöste Bugs (nicht wieder einführen)

| Version | Bug |
|---|---|
| v3.0.2 | `hostSessionRef` wurde bei neuem Spiel nicht zurückgesetzt → Session-Mismatch |
| v3.0.2 | Host pushte nach late-join (P3 nach P2) keinen State → Gäste warteten ewig |
| v3.0.6 | `pieces.current[3]` für P3-Gäste nie initialisiert → P3 konnte nichts platzieren |
| v3.0.7 | Phase/Timer wurde in `applyState` am Ende gesetzt → bei Exception froren Gäste in alter Phase |
| v2.8.2 | `activeBuild`/`activeDrag` Reset in `applyState` fehlte P3 → P3 konnte nach Phasenwechsel nichts platzieren |
| v1.0.6 | Kanonen galten als Mauer beim Flood-Fill → Burg galt fälschlich als geschlossen |
| v2.8.1 | Race-Condition beim gleichzeitigen Beitreten → beide Gäste bekamen Rolle P2 |

---

## Workflow für neue Features

1. Direkt `index.html` editieren
2. Version an 2 Stellen hochsetzen (X.Y.Z)
3. `FORTRESS-SPEC.md` Header + Changelog aktualisieren
4. `git add index.html FORTRESS-SPEC.md && git commit -m "vX.Y.Z: ..."` 
5. `git push origin main` → GitHub Actions deployt automatisch

---

## Was als nächstes geplant / offen ist

- 3-Spieler-Online läuft jetzt grundsätzlich (v3.0.7 hat Phasen-Freeze gefixt)
- ELO wird korrekt berechnet und angezeigt (v3.0.9)
- Drehen-Button für P3 vorhanden (v3.0.9)
- **Noch zu testen**: Ob nach v3.0.7-Fix alle Phasen bei 3 Spielern online sauber durchlaufen
- **Potenzielle nächste Features**: Heartbeat für Verbindungsabbrüche, Sound-Effekte, weitere Wappen/Farben
