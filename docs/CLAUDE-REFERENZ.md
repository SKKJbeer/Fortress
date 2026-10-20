# Stack & Siege — Nachschlagewerk zu CLAUDE.md

> Ausgelagert am 20.10.2026 (Token-Sparmassnahme): CLAUDE.md wird bei JEDEM Sitzungsstart
> und bei jeder Neueinlesung komplett geladen. Hier steht, was man nur bei Arbeit an
> der jeweiligen Stelle braucht. **Inhalt unveraendert uebernommen.**

---

## Wichtige Refs und State

| Ref/State | Typ | Bedeutung |
|---|---|---|
| `grid.current` | 2D-Array | Spielfeld (EMPTY=0, WALL1=1, WALL2=2, CANNON1=3, ...) |
| `phase_r.current` | string | Aktuelle Phase (setup/build/shoot/cannon/result) |
| `numPlayersRef.current` | number | 2 oder 3 |
| `myRole.current` | number | 0=Menü, 1=Host, 2=Gast2, 3=Gast3 |
| `botMode.current` | bool | Bot-/KI-Modus aktiv (seit v3.13.0): Mensch=P1, KI=P2, lokal, zählt nicht für ELO. KI-Tick `botTick` via `setInterval(600)` in `useEffect([screen])`. |
| `tutorialMode.current` | bool | Interaktives Tutorial (seit v3.14.0): wie Bot-Modus, aber Bot passiv (`botShoot` no-op) + Coach-Sprechblase pro Phase. Start `startGuidedTutorial()`; Merker localStorage `fortress_tutorial_done`; Auto-Start nach Onboarding für Erstspieler. Coach-Blase im GAME-Return (nicht Menü-Return!). |
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
- **Felder**: `id, name, wappen, color, stats{wins,losses,games}, stats3, elo, elo3, peakElo, peakElo3, gold, level, xp, unlockedRewards[], achievements[], dailyTasks[], seasonXp`
- **ELO**: Standard-Formel, K=32, Startpunkt 1000
- **Nur Online-Spiele** zählen für Stats und ELO
- **Leaderboard**: Firebase `/leaderboard/{playerId}` — sortiert nach ELO

---

## Langzeit-Progressionssystem (seit v3.11.0)

### localStorage-Keys
| Key | Inhalt |
|---|---|
| `fortress_profile` | Profil inkl. `level, xp, gold, peakElo, peakElo3, achievements[], dailyTasks[], seasonXp, unlockedRewards[]` |
| `fortress_daily` | `{ lastCollect: timestamp, streak: number, lastStreakDay: "YYYY-MM-DD" }` |
| `fortress_onboarded` | `'1'` = Tutorial/Onboarding gesehen (seit v3.12.1). Fehlt der Key → `OnboardingModal` zeigt sich automatisch beim ersten Menüstart. |
| `fortress_sound` | `'1'`/`'0'` = Sound-Effekte an/aus (seit v3.12.2, Default an). Steuert `SFX.enabled`. |
| — Sounds (seit v3.28.0) | CC0-Samples in `sounds/*.mp3` (Kenney.nl + OpenGameArt). `SFX._play` (Buffer+Gain), Laden beim 1. Pointer-Event, prozedurale Töne nur noch Fallback. Neue Sounds: Datei nach `public/sounds/` + in `SFX._load`-Liste. **Kein**
sw.js-Eintrag mehr — der Service Worker wird seit v3.75.0 von
`vite-plugin-pwa` erzeugt und kennt alle gebauten Dateien selbst. |
| `fortress_ach_seen` | Anzahl der zuletzt gesehenen Achievements (seit v3.14.5). Button-Badge zeigt nur NEUE (unlocked − ach_seen), verschwindet beim Öffnen (`openAchievements`). |
| `fortress_haptics` | `'1'`/`'0'` = Vibration an/aus (seit v3.12.2, Default an). Steuert `SFX.haptics`. |
| `fortress_device_id` | Persistente Geräte-ID `d_...` (seit v3.14.12). Matchmaking-Ticket-Feld `dev` + `pid`-Fallback — verhindert Selbst-Matches über Reloads/fehlendes Profil hinweg. |
| `fortress_my_game` | Crash-Marker `{code, ts}` des eigenen Spielknotens (seit v3.14.15). Bei sauberem Verlassen entfernt; nach Absturz löscht `gcOwnStaleGame()` (Marker >30 Min) den verwaisten Knoten beim nächsten Online-Einstieg. |
| ~~`fortress_bot_level`~~ | ENTFERNT in v3.29.0 (keine Vorauswahl mehr — Stufe wird bei jedem Bot-Start aktiv gewählt, Wahl startet das Spiel). `BOT_LEVELS` steuert weiterhin Streuung/Feuer-Drossel/Einkauf via `botLvl()`; Bau-KI seit v3.29.0 mit Versiegelungs-Intelligenz (`botPlaceCovering`/`botSealCastle`, SPEC 14.1b). Tutorial nutzt immer `mid`. |
| `fortress_tasks` | Daily Tasks `{day, tasks:[{id,prog,collected}]}` (seit v3.22.0). Rotation deterministisch aus dem Datum (`rollDailyTasks`), Ernte am Rundenende aus `matchStats` (Bot+Online zählen, Tutorial/lokales Duell nicht), 📋-Menü-Button mit Claim-Badge. |

### Meta-Progression Phase 2 (v3.20–v3.23, SPEC Abschnitt 14)
Konzept + Details in `FORTRESS-SPEC.md` Abschnitt 14. Kurzfassung:
- **Bot-Stufen (v3.20.0)**: `BOT_LEVELS` easy/mid/hard (Streuung 2.4/1.0/0.4, Feuer-Faktor 1.8/1/1, Einkauf basic/standard/optimal, maxCannons 3/6/8). `wantsMore` (Fertig-Bestätigung) folgt der Stufe.
- **Match-Statistik (v3.21.0)**: `matchStats`-Ref pro Spieler `{walls,cannons,scrap,shots,hits,buys}`; Reset pro Runde (`resetEconomy` + `nextRound`); Online-Sync via State-Feld `ms`; Result-Screen zeigt 4-Kachel-Bilanz. `blocksDestroyedThisGameRef` wurde dadurch ersetzt (Gäste-Lifetime-Blocks vorher immer 0!). Gated Hook: `__matchStats(p)`.
- **Daily Tasks (v3.22.0)**: `DAILY_TASK_POOL` (8 Typen, Gold 25–50), Harvest-Effect auf `screen==="result"` mit `tasksHarvested`-Guard.
- **Gold-Shop (v3.23.0)**: `COSMETICS` (trail/frame/win, 12 Artikel), `profile.cosmetics={owned,equipped}`, `cosOf()` normalisiert. Trail-Farbe läuft über `playerInfo[p].trail` (sync via join-Payload + playerInfo-State) → `TRAIL_COLOR`-Lookup im Kugel-Schweif. Rahmen im Menü-Avatar (`FRAME_STYLE`), Sieges-Effekt `WinFx` (Konfetti/Feuerwerk/Goldregen, deterministisch). 🛒-Menü-Button.
- **Gold-Quellen** (für Balancing): Sieg 10–50 (`goldDelta`), Daily-Streak 10–50/Tag, Daily Tasks ~95–135/Tag, Achievements einmalig.

### Neue Konstanten
- `AVATAR_UNLOCKS`: Map avatar-key → required level (vampir/pestdoc/eismagie/schatten = 1; sternmage=5, golem=10, seehexe=15, feuergeist=20, totenmage=25, sturmreiter=30, golddrache=40, phoenix=50)
- `DAILY_REWARDS`: Array von 7 täglichen Belohnungen (Tag 7 = Legendäre Kiste 200G+50XP)
- `getLevelTier(level)`: gibt Tier-Objekt zurück `{ name, label, color, glow, border }`

### Neue Komponenten
- `LevelBadge({ level, size })`: Tier-farbiges Badge (Silber/Gold/Platin/Legendär) — `size="lg"` für größere Darstellung
- `ConfettiBurst({ active })`: CSS-Konfetti bei Level-Up (20 Partikel, keine `Math.random()`)
- `DailyRewardModal({ daily, onCollect, onClose })`: 7-Tage-Streak-Kalender + Belohnungsabholung

### Neue CSS-Keyframes
- `confettiFall`: Konfetti-Partikel fallen und drehen sich
- `dailyBounceIn`: Modal-Einblendung mit Bounce
- `badgePop`: Badge-Erscheinen mit Scale-Animation
- `streakGlow`: Pulsierender Glow für aktiven Streak-Tag und Tages-Belohnungs-Button
- `collectBounce`: Bounce-Feedback beim Abholen

### State-Variablen (neu)
- `dailyState`: `{ lastCollect, streak, lastStreakDay }` — aus `fortress_daily` geladen
- `showDailyModal`: Boolean — steuert DailyRewardModal

### Funktionen (neu)
- `loadDailyState()` / `saveDailyState(d)`: localStorage-Helpers für Streak-Daten
- `getDailyCollectable(daily)`: true wenn ≥24h seit letzter Abholung
- `getDailyStreakIndex(daily)`: aktueller Streak-Index (0–6, zyklisch)
- `handleDailyCollect(reward, streakIdx)`: Streak updaten, Gold/XP vergeben, Profil speichern

### Design-Prinzipien
- Kein Pay2Win: Alle Freischaltungen rein kosmetisch/motivational
- Motivationskette: Online spielen → XP → Level → Belohnungen → Gold → Anpassungen → wieder spielen
- Tägliche Rückkehr: Streak-System belohnt konsistentes Spielen (Tag 7 = Legendäre Kiste)
- Progression sichtbar: LevelBadge neben Avatar im Profil und Menü

### Vorbereitet (noch keine UI)
- Achievements, Daily Tasks, Season-System, Social Features — Datenstruktur-Kommentare im Code

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
| v3.14.10 | onDisconnect-Auto-Löschen des Spielknotens → mobile App-Wechsel löschte Lobby, Gast fand Code nicht (siehe Online-Architektur oben) |
| v3.14.11 | `fb.subscribe`/`subscribeRaw`: `off(ref,'value',unsub)` meldete NIE ab (modulare SDK: `onValue()` gibt Unsubscribe-FUNKTION zurück, die muss aufgerufen werden). Geister-Listener alter Spiele beendeten neue Sessions → „2. Online-Spiel kommt nicht zustande". Test-Mock muss SDK-Semantik spiegeln (onValue → Funktion)! |
| v3.14.12 | Tutorial-Autostart/Onboarding kaperte laufendes Matchmaking (Erstgerät): Onboarding+Tutorial-Autostart nur noch im untätigen Menü; `startGuidedTutorial` bricht Matchmaking sauber ab, nie bei `online`. Selbst-Match im Quick-Match: `pid`-Fallback war SESSION_ID (ändert sich pro Load) → eigenes Geister-Ticket = „bester Gegner" (ELO-Diff 0). Fix: persistente `DEVICE_ID` (`fortress_device_id`), Ticket-Feld `dev`, alle 3 Selbst-Filter prüfen `dev`. |
| v3.14.17 | `screenRef`/`screen`-Drift: `leaveOnline`/`quitGame` setzten nur `setScreen("menu")`, NICHT `screenRef.current` → Gast, der mitten im Spiel ausstieg, behielt Ref="game"; `applyState` wechselt den Screen nur bei Differenz zum Ref → nächster Online-Beitritt blieb für immer im Menü hängen (Refs spielten unsichtbar mit, Name erschien beim Gegner!). Regel: `setScreen` IMMER mit `screenRef.current` synchron setzen. |
| v3.94.0 | Warteschlangen-Subscription hing an `fb.subscribe` — das verschluckt den Null-Fall (`if (data) onData(data)`). Die Realtime Database löscht einen Knoten, sobald sein letztes Kind weg ist: War man der EINZIGE Wartende und das eigene Ticket fiel per onDisconnect weg, kam die Leerung nie an, der Schnappschuss behielt das eigene Ticket, `mmTick` hielt es für vorhanden und trug es nie neu ein → unsichtbar in leerer Warteschlange, sucht ewig (3P ohne Bot-Rückfall unbegrenzt). Fix: `fb.subscribeRaw`. Geprüft in `suiteOnlineHaerte`. |
| v3.15.2 | Selbst-Match-Race: `mmClaimAndMatch` patchte das EIGENE Ticket auf `matched(role:1)` → Firebase-Push-Echo → `mmOnQueueUpdate` hielt es für ein Fremd-Match → Host jointe als Gast 2 ins EIGENE Spiel. Own-Patch entfernt + Guards (`mmBusy`/`claimBy`/`role 1`) + mmJoinMatchedGame verweigert eigenes Spiel. NIE das eigene Ticket auf matched patchen! Test-Mocks (Polling) treffen solche Push-Races kaum — Vorsicht bei grünen Tests. Außerdem: Verwaist-Check jetzt beobachtungsbasiert (`mmHbSeen`), nie lokale Uhr vs. fremde Zeitstempel (Uhren-Skew löschte fremde Tickets). |

---
