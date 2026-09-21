# Stack & Siege — Claude-Kontext für Weiterentwicklung

## Projekt-Übersicht

**Stack & Siege** ist ein eigenstaendiges 2–3-Spieler-PWA-Burgenspiel.
> **Positionierung:** Stack & Siege steht fuer sich. Verweise auf aeltere Spiele
> gehoeren weder in den Code, noch in die Dokumentation, noch in Store-Texte —
> weder als Herkunftsangabe noch als Werbeargument.
Spieler bauen Burgmauern aus Tetrominos und beschiessen danach gegenseitig ihre Festungen.

- **Live-URL**: https://skkjbeer.github.io/Fortress/
- **Repo**: https://github.com/SKKJbeer/Fortress
- **Aktuelle Version**: v3.112.0
- **Sprache**: Deutsch (UI und Kommentare)

---

## Technischer Aufbau

### Dateien
| Datei | Inhalt |
|---|---|
| `index.html` | Nur noch **Hülle** (125 Zeilen, seit v3.78.0): Stil, Splash, Wurzelknoten, zwei Modul-Verweise. |
| `src/game/app.js` | Der Spielcode (~9500 Zeilen): UI, Rendering, Firebase-Sync, Matchmaking. Wird schrittweise nach aussen abgetragen — siehe `ARCHITEKTUR.md`. |
| `src/audio.js`, `src/spread.js`, `src/platform.ts` | Ton/Musik, Objekt-Helfer, Plattform-Weiche |
| `src/engine/*` | **Engine-Schicht**: pure Logik/Daten, kein DOM/React/Firebase → unit-testbar. Seit v3.77.0 grösstenteils **TypeScript**: `const.ts` (Grid/Zelltypen/Domänentypen), `economy.ts` (Beute/SHOP), `terrain.ts` (RNG, Welten, Generatoren), `flood.ts` (Umschlossen-Regel), `progression.ts` (ELO/XP/Gold), `catalog.ts` (Kosmetik/Rezepte), `cloudsave.ts` (Profil-Zusammenführung), `profil.ts` (`normalisiereProfil` — baut das Profil aus einer Whitelist NEU auf; fehlt dort ein Feld, ist es beim naechsten Speichern endgueltig weg, siehe v3.26.1/v3.33.0. `tests/profil.test.js` haelt alle 24 Felder fest), `bot.ts` (BOT_LEVELS/BOT_NAMES/BOT_WAPPEN — Balancing gehoert nicht inline), `speicher.ts` (ALLE localStorage-Schluessel an einer Stelle; `tests/speicher.test.js` durchsucht den Quellbaum nach unbekannten `fortress_`-Schluesseln — ein Tippfehler dort ist stiller Fortschrittsverlust), `daily.ts` (Tages-Belohnungen, Treue-Bonus, Aufgaben-Rotation — seit v3.97.0; `loadDailyState`/`saveDailyState` blieben in app.js, weil sie localStorage anfassen). Noch JavaScript: `achievements.js`, `shapes.js`. **Beim Import die Endung mitschreiben** — Node führt die Unit-Tests ohne Build aus. |
| `src/i18n.js` | Alle UI-Texte (`LANGS`). de/en müssen identische Keys haben (Test erzwingt das). |
| `src/ui/*` | `icons.js` (ICON_PATHS + Icon), **`modale.js`** (WinFx, rarityMeta, forgeItemVisual, AchievementPopup, AchievementsModal, ItemRevealModal, XpResultAnim, OnboardingModal, DailyRewardModal — seit v3.98.0/v3.99.0; `t`/`achTitle`/`achDesc` kommen als Requisiten, NICHT ueber einen Kontext: in der Signatur kann man sie lesen und im Test einsetzen), **`anzeigen.js`** (LevelBadge, ConfettiBurst, WappenAvatar, XpBarUI, MatPip, MatRow — seit v3.96.0; `MatRow` bekommt `t` als Requisite, nicht mehr aus dem Abschluss) und **`wappen.js`** (Avatar-Katalog: WAPPEN_SRC/WAPPEN/WAPPEN_GLOW/WAPPEN_MIGRATION/AVATAR_UNLOCKS, seit v3.95.0). Erster Schnitt beim Abtragen des Grossblocks. **`WAPPEN_SVG` ist entfallen** — 17,2 KB Inline-SVG, die nur noch `Object.keys()` lieferten; die Namensliste kommt aus `WAPPEN_SRC`. `tests/wappen.test.js` haelt den Katalog fest. |
| `tests/*.test.js` | **Unit-Tests** (`npm run test:unit` = `node --test tests/*.test.js`, 145 Tests, ~0,6 s). Das Glob ist Absicht: bis v3.94.0 standen hier zwei Dateien namentlich, und `net.test.js` + `ui.test.js` liefen jahrelang nie mit. |
| `test_fortress.cjs` | Playwright-E2E-Suite (CommonJS — deshalb `type:module` nur in `src/`+`tests/` package.json). |
| `FORTRESS-SPEC.md` | Verbindliche Spielspezifikation + vollständiger Changelog. **Immer mitpflegen bei Änderungen.** |
| `.github/workflows/deploy.yml` | Auto-Deployment: Push auf `main` → GitHub Pages + Git-Tag + GitHub Release. |

### Stack
- **Vite**-Build (seit v3.74.0): React + Firebase aus npm, `src/` als ES-Module gebündelt nach `dist/`. Statische Dateien (Sounds, Icons, Manifest, Nebenseiten) liegen in `public/` und behalten dort ihre Pfade.
- **Firebase Realtime Database** für Online-Multiplayer (Web SDK v10.12.2,
  **aus npm gebündelt** — nicht mehr vom gstatic-CDN. Apple 2.5.2 verbietet
  nachgeladenen Code, und die CI bricht ab, wenn eine CDN-URL im Bundle steht.)
- **GitHub Pages** für Hosting
- **localStorage** für Spieler-Profile

### Architektur-Regeln (seit v3.34.0, Phase 1 des Architektur-Konzepts)
- **Pure Logik gehört in `src/engine/`** — neue Balancing-Konstanten, Formeln,
  Kataloge NIE inline im Spielcode anlegen. Neue Engine-Dateien in
  **TypeScript**; die Reihenfolge der Umstellung steht in `ARCHITEKTUR.md` (E4).
- **Ökonomie-Mutationen als pure Funktionen** halten (Signatur `(state, …) → state`),
  damit eine spätere Cloud Function sie serverseitig validieren kann.
- **Beide Testebenen müssen grün sein**: Unit (`node --test tests/…`) UND Playwright.
- **Parallele KI-Sessions**: seit v3.78.0 liegt der Spielcode in `src/game/app.js`
  statt inline in index.html — die frühere Regel „immer nur EINE Session an
  index.html" gilt für diese Datei. Getrennte Module (`audio`, `engine/*`,
  `render/*`) lassen sich parallel bearbeiten;
  jede Session startet mit `git fetch` + Abgleich mit `origin/main`.
- `src/net/` (seit v3.35.0, Phase 2): `protocol.js` (PROTO_VERSION, sanitize,
  State-Schema-Doku — bei inkompatiblen Protokoll-Änderungen Version erhöhen!)
  und `matchmaking.js` (mmRadius, MM_*-Konstanten, `computeMatchGroup`-Pairing).
  **`EMOTES` liegt seit v3.101.0 ebenfalls in `protocol.js`**: Uebertragen wird
  der INDEX, also sind Reihenfolge und Laenge ein Vertrag zwischen beiden
  Seiten. Umsortieren oder kuerzen = `PROTO_VERSION` erhoehen, sonst sehen
  alter und neuer Client verschiedene Emojis — still, der Rueckfall ist das
  erste Zeichen.
- `src/render/sprites.js` + `src/ui/icons.js` (seit v3.36.0, Phase 3):
  Sprite-Cache/Zeichenfunktionen bzw. ICON_PATHS+Icon. Neue Zeichenfunktionen
  gehören nach render/, neue Icons in ui/icons.js.
- Phase 4 (optional, wenn Store-Build ansteht): esbuild-Bundling in der
  Deploy-Action — Entwicklung modular, Auslieferung eine Datei.

### ⚠️ Kostenpolitik: sparsam, aber nicht mehr bei null

**Die frühere Null-Kosten-Regel ist aufgehoben** (Entscheidung des Gründers,
August 2026): Kleine Beträge sind zulässig, wo sie nötig sind. Konkret bezahlt
wird der **Apple-Developer-Account, 99 USD/Jahr**. macOS-Runner bei GitHub
Actions bleiben kostenlos, weil das Repository öffentlich ist.

Alles Übrige bleibt sparsam: kein eigener Server, kein Firebase Blaze, solange
der Spark-Plan trägt.

**Aktuell erlaubt (kostenlos):**
- **GitHub Pages** — Hosting, kostenlos für Public Repos
- **Firebase Spark Plan**: Realtime Database (1 GB, 100 simultane Verbindungen, 10 GB/Monat)

**Firebase-Zugaenge und wo sie hingehoeren (seit v3.104.0):**
- **Web-API-Schluessel** (`AIza…`, in `src/firebase-boot.js`): oeffentliche
  Client-Kennung, KEIN Geheimnis. Gewaehrt keinen Datenzugriff — gemessen:
  Regeln lesen damit ergibt HTTP 403, genau wie ohne. Gehoert in den Code.
- **Dienstkonto-Schluessel** (`FIREBASE_SA_JSON`): **umgeht alle Regeln**,
  das maechtigste Zugangsmittel des Projekts. Gehoert ausschliesslich in die
  GitHub-Secrets, wie `ASC_KEY_P8` und `DIST_P12`. Genutzt nur von
  `.github/workflows/firebase.yml`.
- Regeln werden NIE von Hand in der Console eingespielt, wenn der Ablauf da
  ist: `firebase.yml` sichert die alten Regeln ins Protokoll, spielt ein,
  prueft SOFORT beide Richtungen (unangemeldet muss abgewiesen werden,
  angemeldet muss durchkommen) und **rollt bei Fehlschlag automatisch
  zurueck**. Von Hand ist die Reihenfolge-Falle genau einmal falsch zu machen.
  **Seit v3.109.0 stehen die Regeln** (gemessen: unangemeldet HTTP 401 auf
  allen sieben Zweigen, angemeldet kommt durch). Die Probe fasst JEDEN Zweig
  einzeln an — `players`/`leaderboard` haengen an `auth.uid === $schluessel`,
  `games` nur an `auth != null`; ein Tippfehler dort waere sonst still.
- **Loeschen in der Datenbank nur ueber eine Namensliste im Code**
  (`scripts/firebase-aufraeumen.py`, Modi `reste`/`reste-weg`). Das
  Dienstkonto umgeht alle Regeln: `leaderboard` statt
  `leaderboard/test_bot_001` loescht die ganze Bestenliste, sofort und ohne
  Rueckfrage. Deshalb KEIN Pfad-Eingabefeld — Namen stehen in `ERLAUBT`,
  gehen durch git, und `tests/aufraeumen.test.js` haelt sie statisch fest.

**Aktuell nicht verwenden (kostenpflichtig):**
- Firebase Blaze / Cloud Functions
- Eigener Server / VPS
- Firebase Authentication mit SMS/Phone

**Wenn das Spiel monetarisiert wird:** dann Firebase Blaze (Cloud Functions für serverseitige Logik, echte Stat-Sicherheit) und ggf. eigenes Backend evaluieren. Das wäre auch der richtige Zeitpunkt für vollständige Firebase Security Rules mit Auth.

### Build-Workflow (seit v3.74.0 mit Vite — siehe ARCHITEKTUR.md)
```
index.html / src/ editieren
→ npm run build          erzeugt dist/  (Pages UND Capacitor liefern dies aus)
→ npm run test:unit && npm run test:e2e
→ git push origin main
→ GitHub Actions baut und deployt dist/
```
WICHTIG: Die E2E-Suite laeuft gegen **dist/**, nicht gegen die Quelle —
also `npm run build` VOR `npm run test:e2e`. Der Server muss dist/ ausliefern.
React und Firebase kommen aus node_modules, nicht mehr vom CDN (Apple 2.5.2).
`test_fortress.cjs` heisst .cjs, weil die Wurzel-package.json `type: module` setzt.

**Versionen immer an 4 Stellen hochsetzen:**
1. `<title>Stack & Siege vX.Y.Z</title>` in `index.html`
2. Versionsanzeige im Menü — in `src/game/app.js`, nicht mehr in index.html
3. `"version"` in `package.json`
4. Kopfzeile von `FORTRESS-SPEC.md` + Changelog-Eintrag

**SPEC immer mitpflegen:**
1. `# Stack & Siege — Spezifikation & Regelwerk (aktuell: vX.Y.Z)` (Zeile 1)
2. Changelog-Eintrag am Ende von `FORTRESS-SPEC.md`

---

## ⛔ Design-Regel: KEINE Emojis im UI (seit v3.27.0)

**Alle Symbole im UI laufen über die `Icon`-Komponente + `ICON_PATHS`**
(Lucide-Stil, stroke-basierte SVG-Pfade, `viewBox 0 0 24 24`). Neue Symbole:
Pfad in `ICON_PATHS` ergänzen, dann `React.createElement(Icon, { name, size, color })`.
Niemals Emoji-Zeichen in JSX-Children, i18n-Strings oder gerenderten
Datenfeldern (z. B. `ACHIEVEMENTS[].icon`, `DAILY_TASK_POOL[].icon`,
`BOT_LEVELS[].icon` = ICON_PATHS-Namen, keine Emojis).

**Erlaubte typografische Glyphen** (monochrom, kein Emoji-Rendering):
`✓ ✕ ⚠ ★ ← ↑ ·` sowie die Spiel-Glyphen `♔ ♚ ♜` (Spielerfarben, `FLAG_OF`).
Die **Beute-Währung** (vormals „Schrott“) nutzt seit v3.65.0 das SVG-Icon
`gem` im UI und eine gezeichnete Edelstein-Raute im Canvas — die frühere
Zahnrad-Glyphe ist ersatzlos entfallen.

**Inhalts-Ausnahmen** (das Emoji IST das Produkt/die Nachricht, kein UI-Chrome):
- `EMOTES` (Spieler-Kommunikation im Match; der Auslöse-Button ist ein Icon)
- `WIN_EMOJI` + WinFx-Goldregen (gekaufte Sieges-Effekte aus dem Gold-Shop)
- `shareResult`-Text (WhatsApp/Share-Nachricht an externe Chats)

---

## Spielmechanik (Kurzreferenz)

- **Phasen**: Setup (20s) → **Shoot (20s)** → Build (25s) → Rüstphase/Cannon (15s, seit v3.16.0) → Shoot → Build …
  **Runde 1 hat KEINE Bauphase** — `endSetup()` ruft direkt `startShoot()`. Der
  wiederkehrende Takt ist Bauen 25 + Schießen 20 + Rüsten 15 = **60 s**, nicht 80.
  (Hier stand bis v3.90.0 die Reihenfolge Setup → Build → Shoot; das war falsch
  und hat es einmal bis auf die Website geschafft. SPEC v3.1.9 hatte es richtig.)
- **Schrott-Ökonomie (seit v3.16.0, Messpass v3.24.0, Playtest-Balancing v3.31.0)**: In-Match-Währung **Beute** (`scrap`, seit v3.65.0 umbenannt und ×10: Mauer +20, Kanonen-Kill +180, Überleben +60/Rüstphase, Start 150; `CANNON_HP=12`). KEIN Gratis-Kanonen-Nachschub mehr — Shop in der Rüstphase (Kanone 200+80, Bezwinger 250, Schnellladen 250/500 → `reloadMsOf()`, Panzermauern 450 → `wallHp`-Map + Riss-Sprite, Reparatur 150+50-Staffel via `up.repair`). Match-persistent über Runden (Reset nur bei neuem Spiel; `beginSetup` resettet wallHp + Kanonen- UND Reparatur-Staffel). Kanonen-Kill sprengt 3×3-Mauern des Besitzers mit. Wiederaufbau-Paket (v3.30.0, `rebuildAidActive`/`cannonPriceOf`): bei 0 einsatzfähigen Kanonen Sold verdoppelt (12), Kanone zum Basispreis 20, Bergung = `SCRAP_WALL` je eigener zerstörter Mauer. Host-autoritativ; Gäste senden `buy`-Action. Gated Debug: `__buys`/`__econ`/`__botSelfPlay`. Messpass-Daten im SPEC-Changelog v3.24.0 (Armor verlängerte Spiele ~2× → 35→45).
- **Emotes (seit v3.25.0)**: `EMOTES` (6, Index-Übertragung). Gast → `{type:'emote',e}`-Action; Host rate-limitet 3s/Spieler, synct via State-Feld `emo` (Dedupe `emoteSeen`). Auslöse-Button = smile-Icon (aria-label "Emote"), nur online. EMOTE-Inhalte sind bewusst Emojis (Inhalts-Ausnahme der Emoji-Regel).
- **Queue-Tipps (seit v3.26.0)**: 8 i18n-Tipps im Matchmaking-Screen, Rotation `floor(mmElapsed/5)%8` — kein eigener Timer.
- **Verlust**: Burg am Bauende nicht vollständig von Mauern umschlossen (Flood-Fill)
- **Kanonen**: schießen nur wenn zu Beginn der Schussrunde vollständig ummauert (`frozenReady`)
- **Grid**: 44×68 Zellen, 14px pro Zelle (W=616, H=952)
- **Welt-Themes (seit v3.15.0)**: `WORLD_THEMES` (7 Welten: Kristalltal, Frostreich, Glutwüste, Vulkanschlund, Nebelmoor, Herbstwald, Astralebene) — `worldThemeOf(terrainSeed)` = `seed % 7`, deterministisch → online automatisch synchron. Farben laufen komplett über den bgCanvas-Offscreen-Render. WICHTIG (v3.30.2, Bug-Fix): bgCanvas wird OHNE Vor-Flip gerendert — der frühere Vor-Flip + Haupt-Flip = Doppel-Flip ließ das Terrain aufrecht erscheinen, während Objekte gespiegelt rendern; der Fluss lag dadurch visuell an der GESPIEGELTEN Position und Spieler bauten scheinbar 'im Fluss'. Nur der Welt-Namenszug hat einen eigenen Gegen-Flip (lesbar, unten links). |
- **Spieler**: P1=Blau(♔), P2=Rot(♚), P3=Grün(♜)

---

## Online-Multiplayer-Architektur

- **Firebase Schema**: `/games/{code}/` → `{ state, guestAction2, guestAction3, numPlayers, createdAt, updatedAt }`
- **Drei Cloud-Zustände (seit v3.102.0)**: `gesichert` (uid + nicht anonym), `anonym` (uid vorhanden) und **`garNichts`** (kein `auth`, keine uid). Der dritte fehlte — ohne API-Schlüssel wirft `getAuth()` (`auth/invalid-api-key`), die Sicherung läuft nie an, und die App versprach trotzdem „wird automatisch gesichert". `linkAccount` kehrt bei fehlendem `F.auth` **stillschweigend** zurück, der Knopf entfällt dort deshalb. Geprüft in `suiteCloudSave`, und zwar in BEIDEN Zuständen der Plattform-Weiche — der falsche Satz stand nur im App-Zweig, im Browser konnte die Prüfung nicht rot werden.
- **Anonymous Auth (seit v3.12.4)**: `signInAnonymously` best-effort; `window.__fb.uid` via `onAuthStateChanged`. Helfer `authUid()` / `writeId(localId)`. Leaderboard-Schlüssel = `writeId(p.id)` (= `auth.uid`, sonst Profil-ID). Ist Anon-Auth in der Console nicht aktiv → `uid=null` → Fallback, kein Bruch. `firebase-security-rules.json` enthält die auth-gebundenen Rules + Aktivierungsreihenfolge (erst Code, dann Auth aktivieren, dann Rules publishen).
- **⚠️ KEIN onDisconnect-Auto-Löschen des Spielknotens (seit v3.14.10, Regression-Fix)**: `fb.onDisconnectRemove('games/'+code)` beim Create ist ENTFERNT und darf nicht wieder eingeführt werden — mobile Browser trennen die Verbindung schon beim kurzen App-Wechsel (Code teilen!) → Server löschte das Spiel → Gast fand den Code nicht. Sauberes Verlassen löscht explizit via `cleanupGame`; verwaiste Lobbys (kein State, >2h) werden beim Join-Versuch aufgeräumt. Queue-Tickets behalten onDisconnectRemove, heilen sich aber in `mmTick` selbst (`mmMyTicket`-Ref: Ticket komplett neu eintragen + onDisconnect re-registrieren, statt status-losen `{hb}`-Stub zu patchen).
- **Gast-Disconnect-Ende (seit v3.12.4)**: `fb.subscribeRaw` + `guestStateHandler` erkennen Knoten-Löschung (`exists=false`, nach `everGotState`) → `warnHostEnded`; Watchdog-Hardtimeout 30s → `warnHostLost` via `endOnlineDisconnected`.
- **Matchmaking = deterministisches globales Pairing (seit v3.14.13)**: Alle Clients berechnen aus demselben Queue-Snapshot dieselbe Gruppenzuteilung (Sortierung: ELO, dann Session-ID; gierige benachbarte 2er/3er-Gruppen im wachsenden ELO-Radius). Pro Gruppe claimt GENAU die kleinste Session-ID (wird Host). NIE zurück zu „jeder wählt seinen Wunschgegner" — das bildete ab ~15 Wartenden Präferenz-Ketten ohne Claimer (Livelock). Claimer sperrt ZUERST sein eigenes Ticket atomar (`claiming`), Fehlerpfade geben alles frei. Diagnose: `window.__mmDebug=true` → `__mmDbg`. Schwarm-validiert (20/20 in 6,5s; 40 → 20 Spiele). |
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

## Performance-Regeln (nicht verletzen!)

- **Offscreen-Canvas** (`bgCanvas`, `bgDirty`): Terrain nur neu rendern wenn `bgDirty=true`
- **Flood-Fill-Cache** (`floodCache`, `gridVersion`): `computeOutsideMap` nur bei Grid-Änderung
- **`setGrid(newG)`** muss verwendet werden (erhöht `gridVersion`) — NIE `grid.current =` direkt
- **`canvasRect.current`**: nur bei pointerdown/resize/scroll neu holen, nicht bei pointermove
- Alle Spielzustände in **Refs** (keine React-Re-Renders im Render-Loop)
- **Sprite-Cache `SPR` (seit v3.15.5)**: Mauern/Trümmer/Kanonenkuppel/-rohr/Bälle werden EINMAL offscreen vorgerendert und pro Frame nur geblittet. Zonen-Overlay in `zoneCanvas` (Key: gridVersion). NIE Gradients oder `shadowBlur` pro Objekt pro Frame in den Render-Loop — das war die Lag-Ursache ab ~15 Kanonen auf Mobilgeräten. Perf-Messung: `window.__perfDbg=true` → `__frameMs` (Zeichendauer, gated).

---

## Sicherheitsregeln (Sicherheits-Pass v3.112.0 — nicht aufweichen)

- **Kein Fremdwert unmaskiert in `innerHTML`.** `telemetry` und `funnel` sind
  von JEDEM angemeldeten Client beschreibbar, und anonyme Anmeldung steht
  allen offen. In `public/stats.html` fuehrte das bis v3.112.0 zu
  **ausfuehrbarem Code auf der Herkunft des Spiels** (nachgewiesen) — damit
  Zugriff auf `localStorage`, Profil, Service Worker. Regel: In den
  Nebenseiten laeuft JEDE Einsetzung durch `txt(`, `num(` oder `fmt(`, ohne
  Ausnahmeliste. `tests/sicherheit.test.js` haelt das fest.
- **Neue Felder in der Datenbank zuerst in die REGELN.** Jeder schreibbare
  Knoten traegt `"$other": {".validate": false}` — sonst darf jeder
  Angemeldete beliebige Kinder beliebiger Groesse anlegen (1 GB Spark-Plan).
  Folge: Ein neues Feld im Spielcode wird ohne Regel-Eintrag ABGELEHNT, und
  `pushTelemetry`/`trichter` verschlucken den Fehler absichtlich — stiller
  Datenverlust. Zwei Dateien, eine Wahrheit: eingespielt wird
  `firebase-rules-PASTE.json`, kommentiert ist `firebase-security-rules.json`;
  `tests/regeln.test.js` erzwingt, dass sie identisch sind.
- **Was vom Mitspieler kommt, ist nicht vertrauenswuerdig.** Es gibt keinen
  Server — Host ist ein beliebiger Client. Jeder Katalog-Schluessel aus dem
  Netz (`wappen`, `trail`, `frame`, `cannon`, `impact`) muss durch
  `istKatalogWort` (src/net/protocol.js), jede Farbe durch `istFarbe`. Grund:
  `wappen: "constructor"` liefert aus einem Objektliteral eine FUNKTION aus
  der Prototypkette. Nachschlagen in Katalogen mit Netzdaten IMMER ueber
  `Object.prototype.hasOwnProperty.call(...)`.
- **Inhaltsrichtlinie auf jeder Seite.** `script-src` traegt
  `'unsafe-inline'` (inline-Skript fuer den Service Worker) — der Schutz liegt
  bei `connect-src`/`img-src`/`form-action`/`object-src`/`base-uri`: kein
  Abflussweg. Wer sie aendert, prueft ZWEI Wege: die E2E-Suite (Browser) und
  den Simulator-Probelauf in `ios.yml` (WKWebView unter `capacitor://localhost`
  plus Capacitor-Bruecke als Benutzerskript). **In der ausgelieferten Datei
  steht NIE `localhost`** — die Suite oeffnet die Richtlinie fuer ihren Mock
  nur in der Antwort (`oeffneRichtlinieFuerTestgegenstelle`).
- **Fremde GitHub-Actions haengen an einem Commit, nicht an `@v3`.** Diese
  Schritte sehen GITHUB_TOKEN bzw. CLOUDFLARE_API_TOKEN. `actions/*` (von
  GitHub selbst) bleiben bewusst auf der Marke.
- **Oeffentliche Seiten raeumen ihre Probeknoten weg.** `diagnose.html` ist
  von jedem erreichbar und meldet sich bei JEDEM Lauf unter einer neuen
  anonymen Kennung an — ohne abgewartetes `remove` bliebe pro Knopfdruck
  dauerhaft ein `players/<uid>`-Knoten stehen.
- **Offen und bewusst so:** `games/$code` ist fuer jeden Angemeldeten
  schreibbar (Bindung an die Host-Kennung waere ein Protokoll-Eingriff;
  praktisch verstellt durch 32^6 Codes). `npm audit` meldet `undici` unter
  `@firebase/*` — **gemessen nicht im gebauten Bundle**, es ist der Node-Pfad
  des SDK. **App Check ist noch aus** und bleibt der einzige wirksame Hebel
  gegen Flut-Angriffe (`auth != null` ist mit anonymer Anmeldung trivial).

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

## Workflow für neue Features

1. **Nicht** `index.html` editieren — die ist seit v3.78.0 nur noch eine
   124-Zeilen-Hülle. Der Spielcode liegt in `src/game/app.js`, reine Logik in
   `src/engine/`.
2. Version an 4 Stellen hochsetzen (siehe oben)
3. `FORTRESS-SPEC.md` Header + Changelog aktualisieren
4. **Bauen, dann testen** — die E2E-Suite läuft gegen `dist/`:
   `npm run typecheck && npm run test:unit && npm run build && npm run test:e2e`
5. Erst wenn alles grün ist, commiten
6. `git push origin main` → GitHub Actions baut, prüft und deployt

---

## Automatisierter Test (IMMER nach jeder Änderung ausführen)

```bash
# 1) Typen + Unit-Tests + iOS-Huelle (schnellstes Feedback, ~1 s):
npm run typecheck && npm run test:unit && npm run test:ios

# 2) BAUEN — die E2E-Suite laeuft gegen dist/, nicht gegen die Quelle:
npm run build

# 3) dist/ ausliefern (NICHT die Wurzel! Dort liegt nur die Huelle):
cd dist && python3 -m http.server 8765 & cd ..

# 4) E2E-Suite (~70 s):
npm run test:e2e
```

- Test-Datei: `test_fortress.cjs` (Playwright, Chromium headless)
- Prüft zuerst: Version in `index.html` auf Disk == Version vom Server (Mismatch → Abbruch)
- React und Firebase kommen seit v3.74.0 aus dem Bundle — nichts wird mehr vom CDN gemockt
- **Riegel gegen die Produktivdatenbank**: `FB_SPERRE` liegt seit v3.110.0 in
  **`scripts/fb-sperre.cjs`** — EINE Quelle fuer Suite UND Werkzeuge. Sie setzt `window.__fb` VOR dem Seitenskript,
  `firebase-boot.js` haelt sich dann heraus. Ohne das schreibt `pushLeaderboard` das Testprofil
  in die ECHTE Bestenliste — Routen-Blockaden greifen bei der WebSocket-Verbindung nicht.
  **Seit v3.103.0 erzwungen**: `tests/testsperre.test.js` verlangt, dass JEDER
  `browser.newContext(` eine Sperre bekommt. Beim Eintragen des API-Schluessels
  fiel auf, dass `suiteOffline` keine hatte — vorher zufaellig harmlos (ohne
  Schluessel warf `getAuth()`), mit Schluessel haette sie das Testprofil in die
  echte Bestenliste geschrieben. Die Pruefung ist STATISCH: ein Laufzeit-Test
  merkt es erst, wenn schon geschrieben wurde.
  **Seit v3.110.0 liest die Pruefung den GANZEN Baum**, nicht nur die Suite:
  `tools/make-screenshots.cjs` hatte vier Kontexte ohne Sperre und haette das
  Demo-Profil „ARIN" (ELO 1284) in die echte Bestenliste geschrieben — ueber
  jeden echten Spieler (Spitzenwert dort 1046). Ausnahmen stehen benannt und
  begruendet in `AUSNAHMEN`, und ein Test prueft, dass sie nicht ins Leere
  zeigen.
- Firebase/gstatic werden abgeblockt
- Alle Button-Clicks via `page.evaluate(() => btn.click())` — Overlay-Workaround
- Testet: 2-Spieler und 3-Spieler lokal (Navigation, Canvas, Bauphase, Drehen-Buttons, Touch, Beenden-Dialog)
- **Gast-Aktionen beim HOST messen** (`suiteOnlineAktionen`, seit v3.111.0):
  „Gast: Canvas-Tap ohne Crash" belegt KEINEN Multiplayer. Geprueft wird der
  ganze Weg — Gast klickt → `guestAction{2,3}` → Host wendet an → **Gitter des
  Hosts aendert sich** (`__zellen(p)`), fuer 2 UND 3 Spieler, Gast 2 UND Gast 3
  (Regression v3.0.6). Dazu `__sektorHash()` (3P) und `__eliminiert()`.
  **Diese Suite laeuft OHNE Zeitraffer** (`makeOnlineCtx(..., {langsam:true})`):
  Im Zeitraffer dauert die Setup-Phase eine Sekunde, und zwischen
  „Phase abfragen" und „klicken" liegt ein Roundtrip — das war ein Wuerfelspiel
  und hat einmal faelschlich nach einer 3P-Regression ausgesehen.
- **Sektorkarten-Abgleich** (seit v3.111.0): Der Host schickt
  `sectorFingerprint` im Zustandsfeld `sh`, der Gast vergleicht mit seiner
  NEU BERECHNETEN Karte, rechnet einmal neu und meldet erst dann. Zusaetzliches
  Feld = rueckwaertsvertraeglich, `PROTO_VERSION` bleibt. Gegengeprueft in
  beiden Richtungen: verfaelschte Karte heilt still, verbogenes GELAENDE wird
  gemeldet. (Burgpositionen zu verbiegen taugt NICHT als Gegenprobe — die
  schickt der Host in jedem Takt mit und ueberschreibt sie sofort.)
- **Online immer mitgetestet**: Code-Join (Host+Gast, Phasen-Sync, Gast-Timer, Aktionen) UND Matchmaking-Suite (`suiteMatchmaking`, seit v3.14.15): Quick Match ×2 hintereinander (Geister-Listener-Regression), Ranked-Result ohne Rematch-Buttons, Queue-Leere nach Matches (Ticket-Leichen), Selbst-Match-Schutz (gleiche `DEVICE_ID` via `mmIdentInit`-Override in `makeOnlineCtx(browser, fbPort, extraInit)`)
- **Kein `await` ohne Zeitgrenze an einer Anzeige** (seit v3.111.1): Das
  Firebase-SDK loest `get()` NICHT auf, solange keine Verbindung steht — kein
  Fehler, keine Ablehnung, nur Stille. `openLeaderboard` hing dadurch fuer
  immer auf „Laedt…" (gemeldet aus der TestFlight-App). `fb.get` faengt
  Fehler ab und liefert null; eine ABGELEHNTE Berechtigung endet also in
  „keine Eintraege" — nur das Nicht-Antworten fuehrt zum Haenger. Wer einen
  Ladezustand anzeigt, braucht eine Frist UND eine Meldung, die sagt, was
  fehlt. `suiteBestenliste` haelt beide Faelle fest.
- **Eine Pruefung auf ein WORT ist keine Pruefung** (seit v3.111.7): Zweimal in
  einer Sitzung hineingetreten. `tests/testsperre.test.js` suchte
  `includes('FB_SPERRE')` — und ein Kommentar „KEINE FB_SPERRE, Absicht"
  erfuellte sie. `scripts/ios-pruefen.mjs` suchte `includes('uid=-')` — und der
  eigene Kommentar daneben erfuellte sie. `includes('export function xy')` ist
  ausserdem bei `xyWEG` wahr. Verlangt gehoert die KONSTRUKTION:
  `addInitScript(FB_SPERRE)`, `/export function xy\s*\(/`, das case-Muster
  selbst. Und: **jede solche Pruefung gegenpruefen** — beim iOS-Riegel wurden
  von sechs kuenstlichen Eingriffen anfangs nur zwei rot.
- **Online auf dem GERAET pruefen** (seit v3.111.7): Der Simulator-Probelauf
  verlangt jetzt die Selbstauskunft `STACK-SIEGE-NETZ` mit uid UND gemessener
  Lesezeit. Kette: `meldeAnHuelle()` (platform.ts) → Kanal `pruefung`
  (SceneDelegate, NSLog) → `ios.yml`. Drei statische Pruefungen halten die
  Kette zusammen. Grund: In Bau 29/30 war Online tot, und 462 gruene
  Pruefungen sagten nichts — `FB_SPERRE` verhindert, dass firebase-boot.js
  ueberhaupt laeuft, und der Probelauf prueft sonst nur, DASS die App startet.
- **Regel: Kein Commit ohne grünen Test**
- **Wartebedingung statt Momentaufnahme** (seit v3.108.0): Im Zeitraffer
  (`TIMER_SPEEDUP`: 1000 ms → 50 ms) dauert eine Phase **rund eine Sekunde**.
  Jede Pruefung, die den DOM EINMAL liest oder zwei Werte im Abstand von
  Hunderten Millisekunden vergleicht, wuerfelt damit gegen die Last des
  Rechners. Fuenf solche Stellen fielen auf einmal auf (SPEC v3.108.0).
  Regeln daraus:
  1. **Auf den Zustand warten, nicht ihn erblicken** — pollen mit Frist, und
     die Frist kurz gegen die Phasendauer halten, nicht lang. Ein Vergleich
     ueber 1,2 s laeuft der Phasengrenze hinterher, statt sie zu ueberspringen.
  2. **Die Meldung muss sagen, was beobachtet wurde** (gelesene Werte, Zahl
     der Stichproben, Phase, Ergebnisschirm ja/nein). „Timer zaehlt nicht
     (25 → 25)" verschwieg, dass 25 die BAUphasen-Dauer ist.
  3. **Nichts behaupten, was der Lauf nicht gepruefte hat.** Aus einer
     beobachteten Bauphase folgt nicht „der Bot dichtet nicht" — die Bresche
     entsteht mitten in der Phase. Fehlt die Gelegenheit, sagt das die Meldung.
  4. **Jede Reparatur gegenpruefen**: Fehlerfall kuenstlich erzeugen und
     sehen, dass es rot wird. Beim Hand-Check sprang die Gegenprobe NICHT an —
     erst das zeigte, dass nur zwei Stichproben genommen wurden. Ohne sie
     waere das Flattern versteckt statt behoben gewesen.
- **Komponenten wirklich rendern, nicht nur aufrufen** (seit v3.98.0): Ein
  direkter Funktionsaufruf scheitert bei Hooks und lässt die Komponente
  ungeprüft. `renderToStaticMarkup` aus `react-dom/server` rendert richtig —
  so wurden beim Modal-Umzug zwei fehlende Importe gefunden, die sonst erst
  dem Spieler aufgefallen wären.
- **Der Ablauf `deploy.yml` ist seit v3.94.0 der Riegel**: `typecheck` →
  `test:unit` → `test:ios` → `build` → `test:e2e`, erst dann Auslieferung.
  Vorher lief dort nur `test:unit` — die E2E-Suite konnte kein Deployment
  aufhalten. Diese Schritte nie wieder herausnehmen.
- **Einzelne Suite fahren** (nur Entwicklung): `NUR=haerte npm run test:e2e`.
  Namen stehen in der `einzeln`-Tabelle in `test_fortress.cjs`. Ohne `NUR`
  läuft immer alles.
- **Online-Härte (`suiteOnlineHaerte`, seit v3.94.0)**: Beitritts-Rennen
  (v2.8.1), Abweisungen (unbekannter Code, verwaiste Lobby, volles Spiel),
  Warteschlangen-Selbstheilung (v3.14.10) und die Protokoll-Schranke (`pv`).
  Die Selbstheilungs-Prüfung hat beim ersten Lauf einen echten Fehler
  gefunden: `fb.subscribe` verschluckt den Null-Fall, deshalb hängt die
  Warteschlangen-Subscription an **`fb.subscribeRaw`** — nicht zurückbauen.

### iOS zusätzlich (seit v3.91.0)
- `npm run test:ios` → `scripts/ios-pruefen.mjs`: 18 statische Prüfungen an der
  iOS-Hülle (Info.plist, Xcode-Projekt, Bundle-Kennung in allen sechs Dateien,
  Storyboard gegen Swift-Klassen, Symbol ohne Alphakanal, Startbild) plus ein
  Riegel gegen die Regression aus v3.86.0. Läuft in einer Sekunde, ohne Mac.
  **Eine Quelle, drei Aufrufer:** npm-Skript, erster Schritt in `ios.yml`, und
  eine Prüfung in der E2E-Suite.
- Jeder iOS-Lauf macht einen **Simulator-Probelauf**: bauen, booten,
  installieren, STARTEN, auf Absturzbericht prüfen, Bildschirmfoto sichern
  (Artefakt `simulator-probe`). Übersetzen beweist nicht, dass die App läuft —
  v3.86.0 hat sauber übersetzt und war unbedienbar.
- Begründungen und Grenzen: `IOS-SETUP.md`, Abschnitt „Was geprüft wird".

---

## iOS (seit v3.76.0)

Architektur-Entscheidungen mit Begruendung: **`ARCHITEKTUR.md`**. Kurz:

- **Ein Build fuer beides.** `npm run build` → `dist/` geht an GitHub Pages
  UND an Capacitor. Zwei Auslieferungswege wuerden Fehler erzeugen, die nur in
  einem auftreten.
- **Plattform-Weiche:** `src/platform.ts`, EINE Datei. Neue Unterschiede
  zwischen App und Web gehoeren dorthin, nirgendwo sonst — sonst kann sie
  niemand mehr aufzaehlen oder testen.
- **Keine Konto-Verknuepfung in der App** (v1): spart Apple 5.1.1(v),
  4.8 und Googles `disallowed_useragent` in WebViews.
- **iOS bauen:** Actions-Tab → „iOS-Build (TestFlight)". Ohne Signierungs-
  Geheimnisse laeuft er bis zum Bundle-Check durch — das beantwortet
  „baut es ueberhaupt?" ohne jedes Zertifikat.
- `ios/` ist eingecheckt (auch das geteilte Schema — ohne das findet
  `xcodebuild` im CI kein Ziel).

## Store-Weg: iOS zuerst, Android danach

**Reihenfolge umgedreht (August 2026).** Früher stand hier „Android zuerst".
Google Play verlangt für neue Entwicklerkonten einen geschlossenen Test mit
**12 Testern über 14 Tage** — TestFlight verlangt nichts dergleichen. Damit ist
iOS der schnellere Weg zu echten Spielern, und der Apple-Account steht.

- **iOS:** Capacitor, siehe Abschnitt oben und `IOS-SETUP.md`.
  Stand und offene Punkte: `LAUNCH-TODO.md`.
- **Android:** später über **Bubblewrap** (PWA → AAB). Dann ist
  `public/.well-known/assetlinks.json` auszufüllen — dort stehen noch
  `TODO_REPLACE_*`-Platzhalter, die ohne den Signierschlüssel nicht zu füllen
  sind.

### Was dabei zu beachten bleibt (gilt für beide)
- **Kein `window.open()`** für wichtige Abläufe — in TWA und WebView unzuverlässig
- **Kein externes Login-Popup** — in der App ist die Konto-Verknüpfung ohnehin
  aus (`src/platform.ts`, `kontoVerknuepfbar()`)
- Safe-Area-Insets, Touch-Bedienung, `user-scalable=no`: eingebaut
- **Goldsystem/ELO: kein echtes Geld** → kein IAP-Review, einfachere Zulassung

### Store-Readiness: erledigt
`manifest.json`, generierter Service Worker, PNG-Icons (5 Größen),
Datenschutzerklärung (`public/privacy.html`), Nutzungsbedingungen
(`public/agb.html`), Screenshots und Store-Texte (`store/listing.md`) liegen
vor. **Offen bleibt nur das Impressum** — `public/impressum.html` steht live
mit Platzhaltern und braucht eine ladungsfähige Anschrift.

## Was als nächstes ansteht

Der verbindliche Stand steht in **`LAUNCH-TODO.md`** (Marktstart) und
**`ARCHITEKTUR.md`** (Umbau). Kurz:

- **iOS nach TestFlight.** Der Bau ist belegt — Release fürs Gerät und Debug
  für den Simulator übersetzen, das Bündel wird auf Inhalt geprüft. Es fehlen
  nur noch Zugänge, keine Arbeit.
- **Firebase-Kette.** Ohne API-Schlüssel und aktivierte anonyme Anmeldung
  läuft Online weder im Web noch in der App (`LAUNCH-TODO.md`, Abschnitt 1).
- **Großblock zerlegen.** `src/game/app.js` hat noch ~9.168 Zeilen (seit v3.94.0 −726,
  sieben neue Module). **Alles Reine ist draußen** — was bleibt, hängt an Refs
  (`impactAt`, `fireMortar`, `applyState`, Bot-KI, Matchmaking). Das ist der
  Schritt `state/`, der den Zustand umbaut statt Code zu verschieben.
  v3.95.0 `src/ui/wappen.js` (Daten), v3.96.0 `src/ui/anzeigen.js` (kleine
  Komponenten), v3.97.0 `src/engine/daily.ts` (reine Tages-Logik), v3.98.0
  `src/ui/modale.js` (die großen Modale). Als Nächstes: `net/` (Firebase-
  Anbindung, `applyState`, Push-Drosselung) und `render/`.
  Reihenfolge und Begründung: `ARCHITEKTUR.md`, Schritt 8.
- **v2:** Google- und Apple-Anmeldung zusammen (Richtlinie 4.8 verlangt „Sign
  in with Apple", sobald es Fremd-Login gibt).
