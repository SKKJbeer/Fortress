# Stack & Siege — Claude-Kontext für Weiterentwicklung

## Projekt-Übersicht

**Stack & Siege** ist ein eigenstaendiges 2–3-Spieler-PWA-Burgenspiel.
> **Positionierung:** Stack & Siege steht fuer sich. Verweise auf aeltere Spiele
> gehoeren weder in den Code, noch in die Dokumentation, noch in Store-Texte —
> weder als Herkunftsangabe noch als Werbeargument.
Spieler bauen Burgmauern aus Tetrominos und beschiessen danach gegenseitig ihre Festungen.

- **Live-URL**: https://skkjbeer.github.io/Fortress/
- **Repo**: https://github.com/SKKJbeer/Fortress
- **Aktuelle Version**: v3.132.0
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
| `src/ui/*` | `icons.js` (ICON_PATHS + Icon), **`modale.js`** (WinFx, rarityMeta, forgeItemVisual, AchievementPopup, AchievementsModal, ItemRevealModal, XpResultAnim, OnboardingModal, DailyRewardModal — seit v3.98.0/v3.99.0; `t`/`achTitle`/`achDesc` kommen als Requisiten, NICHT ueber einen Kontext: in der Signatur kann man sie lesen und im Test einsetzen), **`anzeigen.js`** (LevelBadge, ConfettiBurst, WappenAvatar, XpBarUI, MatPip, MatRow — seit v3.96.0; `MatRow` bekommt `t` als Requisite, nicht mehr aus dem Abschluss) und **`wappen.js`** (Avatar-Katalog: WAPPEN_SRC/WAPPEN/WAPPEN_GLOW/WAPPEN_MIGRATION/AVATAR_UNLOCKS, seit v3.95.0; **seit v3.125.0 Dateipfade** `wappen/<schluessel>.webp` statt Base64 — gemalte Avatare, Herkunft `assets/wappen/ENTSTEHUNG.md`; Schluessel und Reihenfolge sind Netz-Vertrag). Erster Schnitt beim Abtragen des Grossblocks. **`WAPPEN_SVG` ist entfallen** — 17,2 KB Inline-SVG, die nur noch `Object.keys()` lieferten; die Namensliste kommt aus `WAPPEN_SRC`. `tests/wappen.test.js` haelt den Katalog fest. |
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
- **Gegenüber-Modus (seit v3.132.0):** Lokal zu zweit (kein Bot, nicht online) sitzt P1 (Burg oben) OBEN
  und sieht das Brett auf dem Kopf — `istGegenueber()` in app.js. Seine Leiste, sein Shop, sein
  HUD-Kasten und sein Phasenschild sind um 180° gedreht (`topBarRef`/`data-leiste="oben"`); das Bauteil
  hebt sich bei ihm bildschirmabwärts, sein Abbruchbereich liegt ÜBER dem Brett (`imAbbruchBereich`).
  Neue Bedienelemente im lokalen 2-Spieler-Spiel müssen BEIDE Seiten bedenken. `suiteGegenueber`
  (`NUR=gegenueber`) hält es fest.
- **Ton im Hintergrund (seit v3.132.0):** `src/audio.js` → `hintergrund()` (visibilitychange, pagehide,
  freeze): Im Hintergrund wird NICHTS eingeplant (`SFX._ruht`/`MUSIC._ruht`), laufende Quellen werden
  gestoppt, Context `suspend()`. Neue Klangquellen in audio.js über `_merke(src)` anmelden, sonst sind
  sie nicht anhaltbar. `tests/audio.test.js`.

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

## Nachschlagen statt mitlesen (Refs, Profil, Progression, 3 Spieler, gelöste Bugs)

Folgendes steht in **`docs/CLAUDE-REFERENZ.md`** (bewusst ausgelagert, um bei jedem
Laden Token zu sparen) — **vor Änderungen an der jeweiligen Stelle lesen**:

- **Wichtige Refs und State** (`grid`, `phase_r`, `myRole`, `botMode`, `frozenReady` …)
- **Spieler-Profil & ELO**, **Langzeit-Progressionssystem** (localStorage-Schlüssel,
  Daily/Gold-Shop, Konstanten, Komponenten) und **3-Spieler-Besonderheiten**
- **Bekannte gelöste Bugs (nicht wieder einführen)** — vor jeder Änderung an Matchmaking,
  `applyState`, Online-Join, `screenRef` oder Warteschlange PFLICHT

Kurzfassung der härtesten Regeln daraus: `setScreen` IMMER mit `screenRef.current` synchron
setzen; nie das EIGENE Matchmaking-Ticket auf `matched` patchen; `fb.subscribeRaw` für die
Warteschlange (nicht `fb.subscribe`); kein `onDisconnect`-Löschen des Spielknotens;
`profil.ts` baut aus einer Whitelist NEU auf — neues Profilfeld dort eintragen.

---

## Performance-Regeln (nicht verletzen!)

- **Offscreen-Canvas** (`bgCanvas`, `bgDirty`): Terrain nur neu rendern wenn `bgDirty=true`
- **Flood-Fill-Cache** (`floodCache`, `gridVersion`): `computeOutsideMap` nur bei Grid-Änderung
- **`setGrid(newG)`** muss verwendet werden (erhöht `gridVersion`) — NIE `grid.current =` direkt
- **`canvasRect.current`**: nur bei pointerdown/resize/scroll neu holen, nicht bei pointermove
- Alle Spielzustände in **Refs** (keine React-Re-Renders im Render-Loop)
- **Schaerfe (seit v3.129.0):** Das Spielfeld rendert mit Faktor `renderK`
  (Retina-Faktor × Anzeigegroesse / 616, Viertelschritte, max 2,5); gerechnet
  wird weiter in logischen 616×952. Sprites haben `SK`=3-fache Pixel
  (`mkSpriteCanvas`, logische Groesse in `lw`/`lh`). Darum: **`drawImage` im
  Spielfeld IMMER mit Zielgroesse** (`tests/stil.test.js` erzwingt 5 oder 9
  Argumente), `shadowBlur`/`filter: blur()` mit `SK` bzw. `RK` multiplizieren
  (wirken in Pixeln). Gemessen: Zeichendauer 0,4 ms/Bild bei 616×952 wie bei
  1232×1904.
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
- **`$other` braucht fuer JEDES erlaubte Feld eine eigene Regel (v3.112.4,
  echter Fehlschlag).** `$other: {".validate": false}` weist jedes Kind ab,
  das keine eigene Regel hat. Bei `leaderboard/$playerId` steckte die ganze
  Pruefung in EINEM grossen Ausdruck am Elternknoten — kein Feld hatte eine
  eigene Regel, also wies `$other` auch `name`, `wins` und `games` ab, und
  angemeldete Spieler haetten ihren Eintrag nicht mehr schreiben koennen. Die
  Probe in `firebase-regeln.py` hat es beim Einspielen gesehen und der Ablauf
  ist AUTOMATISCH ZURUECKGEROLLT — genau wofuer beides gebaut wurde.
  `tests/regeln.test.js` verlangt seitdem, dass ein Knoten mit `$other`
  ueberhaupt benannte Kinder hat.
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
- **Die Datenbank steht in `script-src`, nicht nur in `connect-src`
  (v3.112.1, echter Fehler).** Der Long-Poll-Rueckfall der Realtime Database
  (`/.lp?…`) laedt ueber eingehaengte `<script>`-Elemente — dafuer gilt
  `script-src`. In v3.112.0 fehlte der Host dort, und wer keinen WebSocket
  aufbauen kann (strenge Firmennetze, manche Proxys), kam gar nicht mehr
  online. **Der Auslieferungs-Riegel war gruen**: `suiteFirebaseStart` prueft,
  DASS die Anmeldung durchkommt, und die lief. Gefunden wurde es erst bei
  einer Messung gegen die LIVE-Seite (`requestfailed … errorText: "csp"`).
  Seitdem haengt die Suite die drei echten Konstruktionen selbst ein
  (Long-Poll-Skript, WebSocket) und liest den Verstossbericht — NICHT ueber
  das SDK: mit stillgelegtem WebSocket faellt es erst nach eigener Frist auf
  Long Poll zurueck, in den Sekunden eines Tests passiert nichts, und die
  Pruefung waere gruen, ohne den Weg angefasst zu haben. Genau so ist sie im
  ersten Anlauf gelaufen — gemeldet hat es nur die Zeile, die verlangt, dass
  der Weg wirklich beobachtet wurde.
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
- **App Check (seit v3.113.0) — vorbereitet, NICHT durchgesetzt.** iOS nimmt
  App Attest ueber das Firebase-SDK in der Huelle (`AppCheckBruecke.swift`),
  das Token geht ueber den Kanal `appcheck` (mit Antwort) an einen
  `CustomProvider` in `firebase-boot.js`. Einrichtung wiederholbar ueber
  `appcheck.yml` (Modi `stand`, `einrichten`). **Die Durchsetzung gilt fuer die
  GANZE Datenbank** — erst einschalten, wenn App (Trichter-Schritt
  `appcheck`), Browser (reCAPTCHA-Site-Key), Probelaeufe und die Regelpruefung
  in `firebase.yml` nachweislich Tokens schicken. Das Debug-Token fuer den
  Simulator wird je Lauf angelegt und geloescht — nie ein dauerhaftes.
- **Offen und bewusst so:** `games/$code` ist fuer jeden Angemeldeten
  schreibbar (Bindung an die Host-Kennung waere ein Protokoll-Eingriff;
  praktisch verstellt durch 32^6 Codes). `npm audit` meldet `undici` unter
  `@firebase/*` — **gemessen nicht im gebauten Bundle**, es ist der Node-Pfad
  des SDK. **App Check ist noch aus** und bleibt der einzige wirksame Hebel
  gegen Flut-Angriffe (`auth != null` ist mit anonymer Anmeldung trivial).

---

## Auffindbarkeit (seit v3.115.0)

- **Landeseite fuer Suchende ist die Website** (`docs/website/`,
  `stack-and-siege.pages.dev`), nicht die Spielseite. Die Spielseite behaelt
  die Versionsnummer im Titel (Auslieferung und Tests lesen sie dort).
- **Jede Seite in `public/` ist eingeordnet**: intern (`noindex`) oder
  oeffentlich (Rechtstexte, Kanonisch auf die Website).
  `tests/auffindbarkeit.test.js` laesst eine neue, nicht eingeordnete Seite
  nicht durch.
- **IndexNow** meldet Aenderungen an Bing/Yandex/Seznam/Naver
  (`website.yml`); der Schluessel steht in der Datei `docs/website/<schluessel>.txt`
  UND im Ablauf — ein Test haelt beide gleich. Google braucht die Search Console.
- **Impressum steht NICHT im Index** (seit v3.117.0, Wunsch des Betreibers:
  die Anschrift soll nicht in Suchtreffern stehen). `noindex`, nicht in der
  Sitemap, erreichbar bleibt es. Die Datenschutzerklaerung nennt Namen und
  E-Mail, fuer die Anschrift verweist sie aufs Impressum.
- **Versionsnummer in `deploy.yml`**: Im Titel steht `&amp;`. Das Muster
  `Stack & Siege v` fand seit v3.79.0 nichts — kein Tag, kein Release. Jetzt
  `&(amp;)?`, leere Version bricht ab.

---

## Grafik (seit v3.119.0)

- **Scharfe Schrift (seit v3.131.0).** `KONTURTEXT` waechst mit der Schrift
  (7 % in em, acht Richtungen) — nie wieder feste 1,5 px: bei 12 px liefen die
  Innenraeume der Buchstaben zu. Kein weicher Textschatten (`0 0 10px`) ohne
  Kontur davor, keine Schrift unter 11 px, keine Endlos-Animation mit
  `scale()` auf Text. `tests/stil.test.js` haelt alle vier fest.
- **Zieler mit Kontur (seit v3.131.0):** jeder Strich erst dunkel, dann in
  Spielerfarbe — sonst verschwindet Gelb auf Schnee/Sand/Wiese.
  `suiteZieler` misst alle sieben Welten. Neue Canvas-Schrift im Spielfeld:
  `strokeText` ist fuer P1 genauso gegengespiegelt wie `fillText`.
- **Ueberlappungen werden GEMESSEN (seit v3.131.0):** `suiteUeberlappung`
  (Menues + Spielphasen, Bot und 3 Spieler, SE/iPhone/iPad): kein Text ragt
  aus seinem Kasten, keine Fenster ueberdecken sich. `panel()` hat 22 px
  Innenabstand — fuer kleine Knoepfe `knopf()` nehmen.
- **Designsystem `src/ui/stil.js` (seit v3.121.0).** Neue Oberflaechen nehmen
  `knopf`/`panel`/`titel`/… von dort, KEINE neuen Inline-Farben. Schriften
  Lilita One + Nunito lokal in `public/fonts`. Keine lokale Variable darf einen
  Baustein ueberdecken (`tests/stil.test.js` — echter Fehler im Umbau).
- **Menues rollen nicht (seit v3.123.0, Wunsch des Betreibers).** Mehr Inhalt
  als Platz → `Reiter` + `Seiten` aus `src/ui/blaettern.js`, Eintraege je Seite
  ueber `zeilenFuer` aus der echten Fensterhoehe. KEIN neues `overflowY: auto`
  in einem Menue. `suiteKeinRollen` (`NUR=rollen`) prueft neun Menues auf SE,
  iPhone und iPad. Tests, die Inhalte hinter einem Reiter suchen, klicken ihn
  per `reiterWahl(page, key)` (`data-reiter`).
- **Artikelbilder (seit v3.127.0):** `src/ui/artikel.js` (`VORHANDEN`,
  `ArtikelBild`) — jeder kauf-/schmiedbare Artikel ausser Rahmen hat ein
  gemaltes WebP in `public/artikel/`; fehlt eines, zeichnet der Aufrufer die
  alte Vorschau. `tests/artikel.test.js` verlangt Bild UND Herkunft fuer JEDEN
  Katalogeintrag — ein neuer Artikel ohne Bild faellt dort auf.
- **Lesbarkeit wird GEMESSEN (seit v3.128.0):** `suiteKontrast` (`NUR=kontrast`)
  fotografiert zwoelf Schirme, misst je Textstueck den Kontrast gegen den
  ECHTEN Hintergrund (Pixel im Ring um den Text, nicht CSS) und verlangt WCAG
  4,5:1 bzw. 3:1; Text mit Comic-Kontur ist ausgenommen. Text direkt auf einem
  Bild braucht `bildHintergrundDunkel` oder `wertKachel` (stil.js). Die alten
  Grautoene `#334155/#475569/#64748b` als Schriftfarbe verbietet
  `tests/stil.test.js` (lagen bei 1,2–3,8:1).
- **Spielfeld-Boeden sind beruhigt** (`beruhigen.py`, siehe
  `assets/welten/ENTSTEHUNG.md`): Hindernis ist allein der Fluss — nichts
  anderes darf so aussehen. Prozedurale Berge entfallen auf gemalten Boeden.
- **Logo ist gesetzt, nicht gemalt** (`tools/logo.cjs`); aufs Ladebild nur in
  der sicheren Zone (`ladebild.py --logo`).
- **Website im selben Stil (seit v3.130.0):** `docs/website/stil.css` nimmt
  die Werte aus `stil.js` (FARBE, Kontur, Knopf, Tafel) — wer das Designsystem
  aendert, passt die Seite mit an. Schriften, Avatare und Artikel kopiert
  `scripts/website-bauen.sh` aus `public/` (eine Quelle); ein neuer Avatar
  gehoert auch in die Galerie beider Sprachfassungen (`tests/auffindbarkeit`
  verlangt Galerie = `WAPPEN_SRC`). Bilder neu: `node tools/make-screenshots.cjs
  website` (+ `website-pad`, `welten`), danach `node tools/make-feature-graphic.cjs`
  (Vorschaubilder fuer Spiel, Website DE/EN und Google Play aus EINER
  Gestaltung). Gross-/Querformate am Telefon messen: `scrollWidth` muss 390
  bleiben — lange deutsche Woerter schoben die Seite einmal auf 457 px.
  **Safari pruefen, nicht nur Chromium** (v3.130.2): Bildschirmfotos ohne
  `loading="lazy"` — Safari laedt verzoegerte Bilder so spaet, dass die
  Telefonrahmen beim Scrollen schwarz blieben. WebKit laesst sich hier
  nachinstallieren (`PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw npx playwright
  install webkit` + `install-deps webkit`).
- **Rechtstexte** (`impressum`/`privacy`/`agb` in `public/`) teilen sich
  `public/rechtstext.css` (seit v3.130.1) — KEIN Stilblock in den Seiten. Sie
  liegen im Spiel UND auf der Website: nur relative Pfade, Schriften unter
  `fonts/` an beiden Orten.
- **Store-Bilder sind Plakate (seit v3.131.2, Nachtrag):** `node
  tools/make-store-bilder.cjs alles` (oder `aufnahmen` / `plakate`, je
  `[phone|pad] [de|en]`; `NUR=aktion` fuer eine Szene) nimmt das ECHTE Spiel auf
  und setzt Schlagzeile, Rahmen und Hintergrund darum — acht Plakate je
  Groesse (seit 21.10.: Platz 2 `zuzweit`, Platz 3 `drei` — das Alleinstellungsmerkmal "zu zweit/dritt an EINEM Geraet, ohne Internet" steht in den ersten drei, die Apple in der Suche zeigt), das staerkste zuerst, `store/ios-6.7[-en]` und `store/ipad-12.9[-en]`.
  Danach `appstore.yml`: `store-bilder-probe`, dann `store-bilder`. `store`
  allein laedt nur hoch, wo noch NICHTS liegt. **Nie vergroessern** (Karte wird
  schmaler statt weich), **iPad: ganze Szene** im Bild (Shop, beide Burgen),
  Aufnahme- und Poster-Reihenfolge stehen in `SZENEN`, `asc-store.py` hat sie
  als `PLAKATE` — `tests/store.test.js` haelt beide gleich. Nicht mehr
  `make-screenshots.cjs` fuer den Store: das ist nur noch Website und Play.
  Ein Satz fasst zehn Bilder; `store-bilder` ersetzt in der richtigen Reihenfolge
  (erst Platz nutzen, dann alte weg, dann Rest).

- **Neue Grafik entsteht mit dem Skill `spielgrafik`** (`.claude/skills/spielgrafik/SKILL.md`):
  FLUX.1-schnell lokal, Varianten mit 512 px, Real-ESRGAN auf 1024. Kein
  handgezeichnetes SVG, kein three.js-Aufbau fuer Werbe- und Symbolgrafik —
  beides wurde versucht und wirkte amateurhaft.
- **App-Symbol:** Quelle ist `assets/symbol/vorlage-1024.png`, Herkunft in
  `ENTSTEHUNG.md`. Alle Groessen kommen aus `scripts/symbole.py` des Skills.
  `tools/make-icons.cjs` erzeugt nur noch die Feature-Graphic.

## Datenschutz und Kapazitaet (seit v3.117.0)

- **Datenschutzerklaerung = Code.** `tests/datenschutz.test.js` verlangt,
  dass jeder Zweig aus `firebase-rules-PASTE.json` in `public/privacy.html`
  als `<code>zweig</code>` steht. Neuer Datenbank-Zweig → Regeln → Erklaerung
  → `store/app-datenschutz.md` (Apples Fragebogen) anpassen.
- **Kein reCAPTCHA im Browser** (Daten an Google ohne Einwilligung). Wer
  App Check im Browser will, braucht vorher eine Einwilligung.
- **Datenbank-Leitung nur bei Bedarf** (Spark: 100 gleichzeitige
  Verbindungen). firebase-boot startet mit `goOffline`; JEDER Zugriff laeuft
  ueber `fb` (weckt), Abos halten die Leitung (`aboHalten`). Wer an `fb`
  vorbei direkt `s.ref(s.db, …)` benutzt, umgeht das — dann `mitLeitung`.
  Pruefung am echten Socket (`WS_SPERRE` zaehlt `close()`), nicht am Merker.
- **Gegen die echte Datenbank** (nur lokal, nicht im CI): `node
  scripts/leitung-probe.mjs` (nur lesen) und `node scripts/cloudsave-probe.mjs`
  (schreibt players/<eigene uid>, raeumt Datensatz UND anonymes Konto weg).

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
- Firebase/gstatic werden abgeblockt
- Alle Button-Clicks via `page.evaluate(() => btn.click())` — Overlay-Workaround
- **Regel: Kein Commit ohne grünen Test**
- **Nach JEDEM Push den `deploy.yml`-Lauf ansehen** (seit v3.127.1): v3.125.0
  und v3.126.0 scheiterten im CI an einer lokal gruenen Pruefung und gingen
  nie live — bemerkt erst zwei Versionen spaeter. Gruen lokal heisst nicht
  ausgeliefert.
- **Der Ablauf `deploy.yml` ist seit v3.94.0 der Riegel**: `typecheck` →
  `test:unit` → `test:ios` → `build` → `test:e2e`, erst dann Auslieferung.
  Vorher lief dort nur `test:unit` — die E2E-Suite konnte kein Deployment
  aufhalten. Diese Schritte nie wieder herausnehmen.
- **Einzelne Suite fahren** (nur Entwicklung): `NUR=haerte npm run test:e2e`.
  Namen stehen in der `einzeln`-Tabelle in `test_fortress.cjs`. Ohne `NUR`
  läuft immer alles.

**Ausgelagert nach `docs/CLAUDE-TESTLEHREN.md`** (lesen, wenn man die jeweilige Suite anfasst oder eine Pruefung schreibt) — Stichworte:

- Riegel gegen die Produktivdatenbank
- Testet: 2-Spieler und 3-Spieler lokal (Navigation, Canvas, Bauphase,
- Gast-Aktionen beim HOST messen
- Sektorkarten-Abgleich
- Online immer mitgetestet
- Kein `await` ohne Zeitgrenze an einer Anzeige
- Eine Pruefung auf ein WORT ist keine Pruefung
- Online auf dem GERAET pruefen
- Wartebedingung statt Momentaufnahme
- Komponenten wirklich rendern, nicht nur aufrufen
- Warteschlange und Wiedereinstieg
- iOS-App-Wechsel
- Verbindungs-Banner gehoeren in den SPIEL-Zweig
- TestFlight nur nach gruener Testkette
- Online-Härte (`suiteOnlineHaerte`, seit v3.94.0)

Drei Regeln daraus gelten IMMER: (1) eine Pruefung verlangt die KONSTRUKTION, nie ein Wort — und jede Pruefung wird gegengeprueft (Fehlerfall kuenstlich erzeugen, rot sehen); (2) auf einen Zustand WARTEN statt ihn erblicken, die Meldung nennt das Gelesene; (3) JEDER `browser.newContext(` bekommt `addInitScript(FB_SPERRE)`.

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

**Die App ist fuehrend (seit v3.131.1, Entscheidung des Betreibers).** Jede
neue Version geht automatisch nach TestFlight: `deploy.yml` stoesst nach
gruener Testkette `ios.yml` mit `upload=true` an — nur bei NEUEM Versions-Tag.
Darum: **Jede Aenderung am Spiel bekommt eine neue Versionsnummer**, sonst
kommt sie nie in die App. Nach dem Push nicht nur `deploy.yml`, sondern auch
den angestossenen `ios.yml`-Lauf ansehen. (Der Tag-Ausloeser in ios.yml greift
dafuer nicht: Tags vom GITHUB_TOKEN starten keinen Ablauf.)
`tests/app-fuehrend.test.js` haelt die Kette fest. Eine neue App-Store-Fassung
mit dem neuesten Bau wird eingereicht, sobald die vorige Pruefung durch ist.

**Verfuegbarkeit im App Store (seit v3.131.2, Nachtrag 20.10.):** Eine Fassung
auf READY_FOR_SALE ist erst dann zu finden, wenn Apple Gebiete kennt. 1.0 ging
am 20.10. in KEINEM Land live — `appAvailabilityV2` antwortete seit Wochen mit
404, und die Pruefungen fuehrten das als „nicht abfragbar". Jetzt: 404 =
**fehlt** (`verfuegbarkeit_zaehlen` in `asc.py`), `freigeben` veroeffentlicht
nicht ohne Gebiet, Ablaeufe `verfuegbar-stand` (lesen) und `verfuegbar`
(Eingabe VERFUEGBAR, nur wenn Apple keine kennt). Nach JEDER Veroeffentlichung
`itunes.apple.com/lookup?bundleId=de.skkjbeer.stackandsiege&country=de` pruefen
— `READY_FOR_SALE` allein beweist nicht, dass die App zu finden ist. App-ID
6811299708.

**Store-Fassungen (seit v3.131.2):** `appstore.yml` nimmt `fassung` (leer =
1.0). Ein Update: `MARKETING_VERSION` im Xcode-Projekt heben, Block
„Neuigkeiten (… X.Y.Z)" in `store/listing.md` + `listing-en.md` neu schreiben
(`tests/fassung.test.js` verlangt Gleichstand), dann mit `fassung=X.Y.Z`:
fuellen → sprachen → store → einreichen-probe → einreichen. Apple haengt nur
Bauten mit derselben Versionsnummer an. App: 1.0.1 (1.0 ist bei Apple).

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
