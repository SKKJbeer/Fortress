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

### ⚠️ Kostenpolitik: ZERO laufende Kosten (aktuelle Phase)
Solange das Spiel noch kein Einkommen generiert, bleiben alle Kosten bei null.
Wenn das Spiel wächst und Mehrwert entsteht (App Store, Monetarisierung), können
bezahlte Services eingeführt werden — aber erst dann.

**Aktuell erlaubt (kostenlos):**
- **GitHub Pages** — Hosting, kostenlos für Public Repos
- **Firebase Spark Plan**: Realtime Database (1 GB, 100 simultane Verbindungen, 10 GB/Monat)
- **CDNs** für React/Firebase SDK (unpkg, gstatic)

**Aktuell nicht verwenden (kostenpflichtig):**
- Firebase Blaze / Cloud Functions
- Eigener Server / VPS
- Firebase Authentication mit SMS/Phone

**Wenn das Spiel monetarisiert wird:** dann Firebase Blaze (Cloud Functions für serverseitige Logik, echte Stat-Sicherheit) und ggf. eigenes Backend evaluieren. Das wäre auch der richtige Zeitpunkt für vollständige Firebase Security Rules mit Auth.

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
- **Anonymous Auth (seit v3.12.4)**: `signInAnonymously` best-effort; `window.__fb.uid` via `onAuthStateChanged`. Helfer `authUid()` / `writeId(localId)`. Leaderboard-Schlüssel = `writeId(p.id)` (= `auth.uid`, sonst Profil-ID). Ist Anon-Auth in der Console nicht aktiv → `uid=null` → Fallback, kein Bruch. `firebase-security-rules.json` enthält die auth-gebundenen Rules + Aktivierungsreihenfolge (erst Code, dann Auth aktivieren, dann Rules publishen).
- **⚠️ KEIN onDisconnect-Auto-Löschen des Spielknotens (seit v3.14.10, Regression-Fix)**: `fb.onDisconnectRemove('games/'+code)` beim Create ist ENTFERNT und darf nicht wieder eingeführt werden — mobile Browser trennen die Verbindung schon beim kurzen App-Wechsel (Code teilen!) → Server löschte das Spiel → Gast fand den Code nicht. Sauberes Verlassen löscht explizit via `cleanupGame`; verwaiste Lobbys (kein State, >2h) werden beim Join-Versuch aufgeräumt. Queue-Tickets behalten onDisconnectRemove, heilen sich aber in `mmTick` selbst (`mmMyTicket`-Ref: Ticket komplett neu eintragen + onDisconnect re-registrieren, statt status-losen `{hb}`-Stub zu patchen).
- **Gast-Disconnect-Ende (seit v3.12.4)**: `fb.subscribeRaw` + `guestStateHandler` erkennen Knoten-Löschung (`exists=false`, nach `everGotState`) → `warnHostEnded`; Watchdog-Hardtimeout 30s → `warnHostLost` via `endOnlineDisconnected`.
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
| `fortress_ach_seen` | Anzahl der zuletzt gesehenen Achievements (seit v3.14.5). Button-Badge zeigt nur NEUE (unlocked − ach_seen), verschwindet beim Öffnen (`openAchievements`). |
| `fortress_haptics` | `'1'`/`'0'` = Vibration an/aus (seit v3.12.2, Default an). Steuert `SFX.haptics`. |

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

## Langzeit-Progressionssystem (seit v3.11.0)

### localStorage-Keys
| Key | Inhalt |
|---|---|
| `fortress_profile` | Profil inkl. `level, xp, gold, peakElo, peakElo3, achievements[], dailyTasks[], seasonXp, unlockedRewards[]` |
| `fortress_daily` | `{ lastCollect: timestamp, streak: number, lastStreakDay: "YYYY-MM-DD" }` |
| `fortress_onboarded` | `'1'` = Tutorial/Onboarding gesehen (seit v3.12.1). Fehlt der Key → `OnboardingModal` zeigt sich automatisch beim ersten Menüstart. |
| `fortress_sound` | `'1'`/`'0'` = Sound-Effekte an/aus (seit v3.12.2, Default an). Steuert `SFX.enabled`. |
| `fortress_haptics` | `'1'`/`'0'` = Vibration an/aus (seit v3.12.2, Default an). Steuert `SFX.haptics`. |

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
- Achievements: Datenstruktur-Kommentare im Code
- Daily Tasks: Datenstruktur-Kommentare im Code
- Season-System: Datenstruktur-Kommentare im Code
- Social Features: Vorbereitung für Freundessystem via Firebase

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
4. **Test laufen lassen** (siehe unten) — erst wenn alle grün, commiten
5. `git add index.html FORTRESS-SPEC.md && git commit -m "vX.Y.Z: ..."` 
6. `git push origin main` → GitHub Actions deployt automatisch

---

## Automatisierter Test (IMMER nach jeder Änderung ausführen)

```bash
# Server starten falls nicht läuft:
python3 -m http.server 8765 &

# Test ausführen (Playwright, ~60s):
node test_fortress.js
```

- Test-Datei: `test_fortress.js` (Playwright, Chromium headless)
- Prüft zuerst: Version in `index.html` auf Disk == Version vom Server (Mismatch → Abbruch)
- React-CDN wird lokal gemockt aus `/tmp/react.min.js` + `/tmp/react-dom.min.js`
- Firebase/gstatic werden abgeblockt
- Alle Button-Clicks via `page.evaluate(() => btn.click())` — Overlay-Workaround
- Testet: 2-Spieler und 3-Spieler lokal (Navigation, Canvas, Bauphase, Drehen-Buttons, Touch, Beenden-Dialog)
- **Regel: Kein Commit ohne grünen Test**

---

## Langfristiges Ziel: App Store (Android zuerst)

Das Spiel soll in den **Google Play Store** und danach weitere Stores. Das beeinflusst alle zukünftigen Entwicklungsentscheidungen.

### Geplanter Weg: TWA (Trusted Web Activity)
- Google Play erlaubt PWAs als native Apps via TWA — kein React Native oder Flutter nötig
- Tool: **Bubblewrap** (Google) konvertiert PWA → Android APK/AAB
- Voraussetzungen für TWA:
  - `manifest.json` mit korrekten Icons, `start_url`, `display: standalone`
  - Service Worker (Offline-Unterstützung)
  - HTTPS (✅ GitHub Pages)
  - Digital Asset Links (`.well-known/assetlinks.json`) verknüpft Domain mit App
- localStorage funktioniert in TWA (Chrome WebView teilt Storage) → Firebase & Profil bleiben

### Was bei der Entwicklung zu beachten ist
- **Kein `window.open()`** für wichtige Flows — funktioniert in TWA nicht zuverlässig
- **Kein Clipboard-API** ohne User-Gesture — bereits korrekt (Copy-Button vorhanden)
- **Safe-Area-Insets** bereits eingebaut (`env(safe-area-inset-*)`) ✅
- **Touch-only-Controls** bereits optimiert ✅
- **Kein externes Login-Popup** — Firebase Auth via Popup würde in TWA brechen; falls Auth nötig, Redirect-Flow nutzen
- **Viewport** `user-scalable=no` bereits gesetzt ✅
- **Icons**: aktuell nur inline SVG — für Play Store werden PNG-Icons (512×512, 192×192) benötigt
- **Privacy Policy** wird für Play Store Pflicht (Firebase = Datenspeicherung)
- **Content Rating** muss bei Google Play eingereicht werden
- **Goldsystem** / ELO: kein echtes Geld → vereinfacht Store-Zulassung (kein IAP-Review)

### Noch nicht implementiert (für Store-Readiness)
- [ ] `manifest.json` (PWA Manifest als separate Datei, nicht nur inline)
- [ ] Service Worker für Offline-Fähigkeit
- [ ] PNG App-Icons (512×512, 192×192, 96×96)
- [ ] Privacy Policy Seite
- [ ] `.well-known/assetlinks.json` (nach Bubblewrap-Setup)

---

## Was als nächstes geplant / offen ist

- 3-Spieler-Online läuft jetzt grundsätzlich (v3.0.7 hat Phasen-Freeze gefixt)
- ELO + Gold werden korrekt berechnet und angezeigt (v3.0.9/v3.1.0)
- Drehen-Button für P3 vorhanden (v3.0.9)
- **Noch zu testen**: Ob nach v3.0.7-Fix alle Phasen bei 3 Spielern online sauber durchlaufen
- **Potenzielle nächste Features**: Heartbeat für Verbindungsabbrüche, Sound-Effekte, weitere Wappen/Farben, Store-Readiness
