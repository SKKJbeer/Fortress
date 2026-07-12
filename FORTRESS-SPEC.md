# FORTRESS — Spezifikation & Regelwerk (aktuell: v3.39.0)> Diese Datei ist die **verbindliche Prüfgrundlage** für alle Änderungen am Spiel.
> Vor jeder Code-Änderung wird gegen diese Spec geprüft. Wenn eine Änderung
> einer Regel widerspricht, wird das gemeldet bevor etwas umgesetzt wird.
> Bei bewussten Regeländerungen wird diese Datei mit aktualisiert.

-----

## 1. SPIELKONZEPT

Fortress ist ein 2-Spieler-Burgenspiel (Neuauflage des Flash-Klassikers “Festung”).
Zwei Spieler bauen gleichzeitig geschlossene Burgmauern aus Tetris-artigen Teilen
und beschiessen danach gegenseitig ihre Festungen.

**Spielmodi:**

- **Lokal**: 2 Spieler an einem Gerät (Bildschirm oben/unten geteilt)
- **Online**: 2 Spieler je eigenes Gerät, verbunden über 6-stelligen Code

-----

## 2. SPIELFELD

- Top-Down-Sicht, prozedural generierte Landschaft
- Grid: 44 Spalten × 68 Zeilen, Zellgröße 14px (W=616, H=952). Ab v2.4
  vergrößert (vorher 36×56) für mehr Baufläche.
- Terrain-Typen: Wiese (3 Grüntöne), Fluss, Berge (mit Schneekappe), Blumen
- **Fluss** = EINE geschwungene horizontale Grenze; trennt die Baugebiete:
  - Spieler 1 (Blau, ♔) baut NUR oberhalb des Flusses
  - Spieler 2 (Rot, ♚) baut NUR unterhalb des Flusses
- **Nur der Fluss/das Wasser ist nicht bebaubar** (harte Grenze). Berge sind
  reine DEKO und dürfen überbaut werden. Zusätzlich sperrt die gegnerische Hälfte.
- Terrain wird per Seed (mulberry32 PRNG) erzeugt → deterministisch reproduzierbar

-----

## 3. BURG

- Jeder Spieler hat eine eigene 3×3-Burg, mittig in seiner Hälfte
- Die Burg ist **unzerstörbar** (Kanonenkugeln beschädigen sie nicht)
- Startaufbau: vorgebaute Start-Mauer um die Burg (Innenraum bietet Platz für
  Burg + 2 Kanonen)
- **VERLUST-BEDINGUNG**: Ist die Burg am Ende der Bauphase NICHT vollständig
  von Mauern umschlossen (Flood-Fill von aussen erreicht die Burg), verliert
  der Spieler. Geprüft wird per `isCastleClosed()` → `computeOutsideMap()`.
  WICHTIG: Nur echte Mauern + die Burg blockieren die Flut. **Kanonen zählen
  NICHT als Mauer** — eine Kanone darf kein Loch in der Burgmauer stopfen.

-----

## 4. KANONEN

- 10 HP, zerstörbar
- Start: Setup-Phase platziert 2 Kanonen
- Danach: pro Runde +1 Kanone in der Kanonen-Setzphase
- **SCHUSSREGEL (wichtig, Festung-Mechanik):**
  - Nur Kanonen die zu **Beginn der Feuerrunde** vollständig ummauert sind,
    feuern in dieser Runde (Liste wird per `frozenReady` eingefroren)
  - Wird eine Kanone WÄHREND der Runde freigeschossen (Mauer zerstört),
    feuert sie die **aktuelle Runde zu Ende** — die Mauer-Auswertung erfolgt
    erst zur nächsten Bauphase
  - **AUSNAHME**: Wird eine Kanone in der Runde ZERSTÖRT (HP ≤ 0), feuert sie
    sofort nicht mehr (Zerstörung wirkt sofort, Freischuss erst nächste Runde)
  - Offene Kanone = schiesst nur nicht → KEIN Verlust (nur die Burg zählt für Verlust)
  - Kanonen-Geschlossenheit nutzt `computeOutsideMapForCannons()` — NUR echte
    Mauern blockieren (NICHT Burg, NICHT andere Kanonen). Eine Kanone gilt nur
    als schussbereit wenn sie von echten Mauern umschlossen ist.

-----

## 5. SCHIESS-MECHANIK

- Schleuder/Slingshot: Finger von den Kanonen wegziehen → Zielrichtung
- **Alle schussbereiten Kanonen feuern gleichzeitig auf EINEN gemeinsamen
  absoluten Zielpunkt** (`slingTarget()` gibt absoluten Punkt, nicht Vektor)
- **Streuung**:
  - Erste Kanone (Leitkanone): trifft **100% exakt**, keine Abweichung
  - Jede weitere Kanone: minimale Streuung, max 1 Zelle Deckel
  - Formel: `scatter = min(index * 0.3, 1.0) * CELL`
- 1 Treffer zerstört genau 1 Mauerblock
- Reload: 2,5s (RELOAD_MS) pro Spieler
- Visuelle Vorschau: ein Crosshair am Zielpunkt, Linien von allen Kanonen dorthin,
  bei >1 Kanone ein Streuungsring + Badge (×2, ×3…)

-----

## 6. PHASEN-ZYKLUS

1. **Setup** (20s): 2 Kanonen platzieren
1. **Build / Bauen** (25s): Mauern setzen, Burg schliessen
   → Am Ende: Verlust-Check (Burg offen = verloren)
1. **Shoot / Feuern** (30s): auf Gegner schiessen
   → schussbereite Kanonen werden bei Phasenstart eingefroren
1. **Cannon / Kanone setzen** (12s): +1 Kanone platzieren
1. → zurück zu Build

-----

## 7. PLATZIER-MECHANIK (Touch)

- **Drag-to-place**: Finger aufsetzen → Ghost-Vorschau erscheint
- Ghost schwebt **LIFT_ROWS = 6 Zellen ÜBER dem Finger** (damit der Finger
  das Teil nicht verdeckt)
- Gepunktete Connector-Linie verbindet Ghost mit Fingerposition
- ✓ (gültig) / ✗ (ungültig) Indikator am Connector-Ende
- Beim Loslassen wird an der **exakt angezeigten Ghost-Position** platziert
  (NICHT neu aus dem pointerup-Event berechnen → kein Versatz)
- Teile sind Tetrominos inkl. 1×1-Einzelstein (zufällig aus Pool)
- **Bausteinvorschau**: In der Bau-Leiste (Mitte) wird das aktuelle Teil als
  Mini-Grid dauerhaft angezeigt (“nächster”), auch ohne Bildschirmberührung.
  Aktualisiert bei Drehen (setUiTick) und neuem Teil. Online: zeigt eigenes Teil.

-----

## 8. ONLINE-MULTIPLAYER (Architektur)

- **Firebase Realtime Database** über offizielles Web SDK (v10.12.2, ES-Module)
- **Echtes Realtime via `onValue()`** (WebSocket), KEIN Polling mehr
- Bleibt im kostenlosen **Spark-Plan**, KEINE Cloud Functions
- **Host (P1) ist autoritativ**: rechnet alle Spiellogik, pusht Zustand
- **Gast (P2)**: sendet Aktionen, rendert empfangenen Zustand
- Subscriptions getrennt: Host hört nur auf `guestAction`, Gast nur auf `state`
- Schema: `/games/{code}/` → { state (JSON), guestAction (JSON), createdAt, updatedAt }
- 6-stelliger Beitritts-Code (Zeichen ohne verwechselbare wie I/O/0/1)
- Host-Code kann per Button in Zwischenablage kopiert werden
- Gast kann Code per “Einfügen”-Button aus Zwischenablage übernehmen (pasteCode,
  filtert auf erlaubte Zeichen, max 6)

### Gast-spezifische Sync-Regeln (kritisch — häufige Bug-Quelle):

- **Bauteile**: Host schickt `piece1`/`piece2` Formen; Gast übernimmt Form,
  steuert aber Ghost-Position lokal
- **Drehen**: Host-autoritativ. Gast sendet `{type:"rotate"}`-Aktion, der Host
  dreht via rotateCW und pusht zurück. Gast dreht NICHT lokal (würde vom
  nächsten Push überschrieben).
- **Multitouch**: pro Spieler nur EIN aktiver Bau-Pointer (`activeBuild`-Ref).
  Zweiter Finger während des Bauens wird ignoriert → kein Ghost-Konflikt.
- **Kugeln**: Gast interpoliert Flugbahn LOKAL (flüssige Animation), übernimmt
  nur NEUE Salven vom Host; Einschlag bleibt Host-autoritativ
- **Reload**: Host schickt Fortschritt als 0..1-Wert (`reloadProg`), NICHT als
  Zeitstempel (verschiedene Uhren!). Gast merkt sich Wert + lokalen Empfangs-
  zeitpunkt (`at`) und **interpoliert lokal mit 60fps weiter** (sonst springt
  der Balken bei jedem Push). Erst der nächste Host-Wert korrigiert.
- **Phasen-Meldungen**: Gast erkennt Phasenwechsel über eigenen `lastSeenPhase`-Ref
  (NICHT phase_r, sonst Race) und zeigt Banner lokal: Setup/Bauphase/Feuer/Kanone.
  Wird bei startOnlineGame zurückgesetzt.
- **Terrain**: nur Seed übertragen, Gast regeneriert + setzt `bgDirty`

### Sicherheit:

- Session-Token (SESSION_ID), `sanitizeState()` / `sanitizeAction()`
- Replay-Schutz über Timestamps (`n`)
- Rate-Limit: max 8 Pushes/Sekunde (force-Push umgeht Limit für Spielende)
- Payload-Cap: 150 KB
- Spieldaten werden NICHT bei pagehide/visibilitychange gelöscht (iOS feuert
  diese schon beim App-Wechsel → würde Spiel killen). Nur bei bewusstem Verlassen
- Verlust-Zustand wird mehrfach gepusht (sofort, +300ms, +800ms) zur Sicherheit

### Matchmaking ("Schnellspiel", seit v3.6.0; 2 + 3 Spieler seit v3.7.1):

- **Kein aktives Koppeln per Code** — Spieler tritt einer Warteschlange bei
  statt einen Code zu teilen/einzugeben. Code-basiertes Erstellen/Beitreten
  bleibt parallel verfügbar (für Spiele mit Freunden).
- **Getrennte Queues je Spieleranzahl**: 2-Spieler → `/queue2`, 3-Spieler →
  `/queue3`. So vermischen sich 2er- und 3er-Suchende nie. Der "Schnellspiel"-
  Button respektiert die Spieleranzahl-Auswahl im Online-Menü. ELO-Quelle:
  `profile.elo` (2p) bzw. `profile.elo3` (3p).
- **Schema**: `/queueN/{SESSION_ID}` → `{ name, wappen, color, elo, ts, hb,
  status, claimBy, claimTs, code, role }`. `ts` = Eintrittszeit (fest, treibt
  den Such-Radius), `hb` = Heartbeat (alle 2s aktualisiert, Stale-Erkennung).
- **Kein Server/Cloud Function nötig** (bleibt im Spark-Plan):
  - Jeder wartende Client abonniert seine Queue per `onValue()` (echtes
    Realtime, kein Polling) und sucht bei jedem Snapshot + alle 2s
    (`MM_TICK_MS`) selbst nach Kandidaten.
  - **ELO-Suchradius wächst mit Wartezeit**: `radius = MM_BASE_RADIUS (60) +
    wartezeit_s * MM_GROWTH_PER_SEC (18)`. Damit niemand ewig wartet, gilt
    der **größere** der beiden Radien (eigener vs. Kandidat).
  - **Initiator-Auswahl (genau ein Host pro Gruppe)**: Der Suchende sammelt
    die `np-1` ELO-nächsten Kandidaten innerhalb des Radius und initiiert nur,
    wenn seine eigene `SESSION_ID` kleiner ist als die **aller** gewählten
    Kandidaten. Bei 2 Spielern ist das genau ein Gegner, bei 3 Spielern zwei.
  - **Atomares Claiming per Firebase-Transaktion** (`fb.transact`) verhindert,
    dass zwei Matcher gleichzeitig denselben Kandidaten claimen — exakt das
    gleiche Muster wie die bestehende Gast-Slot-Reservierung. Bei 3 Spielern
    werden beide Kandidaten nacheinander geclaimt; schlägt einer fehl, werden
    bereits geclaimte Tickets wieder auf `"waiting"` zurückgerollt.
  - Der **Claimer wird automatisch Host (P1)**, erstellt `/games/{code}` und
    schreibt `status:"matched"` + `code`/`role` in alle beteiligten Tickets
    (Kandidaten erhalten Rolle 2 und 3). Jeder gematchte Gegner erkennt das
    über seinen eigenen Ticket-Snapshot und tritt seinem Slot bei (`reserve`
    auf `guestAction2`/`guestAction3`, wie beim normalen Code-Beitritt). Der
    Host startet das Spiel erst, wenn **alle** Gäste beigetreten sind.
  - **Selbstheilung ohne Cron**: Ticket bleibt durch `onDisconnect().remove()`
    serverseitig konsistent (Tab-Schluss/Crash → sofort gelöscht, kein Cloud
    Function nötig). Zusätzlich: veraltete Tickets (`hb` älter als
    `MM_HEARTBEAT_STALE_MS` = 35s) werden bei jedem Scan best-effort gelöscht;
    ein hängender `"claiming"`-Status (Matcher abgestürzt) heilt nach
    `MM_CLAIM_HEAL_MS` = 6s zurück auf `"waiting"`; ein Host, dessen
    gematchte Gegner nicht binnen `MM_GUEST_JOIN_TIMEOUT_MS` = 15s tatsächlich
    beitreten (verwaiste Tickets erwischt), bricht ab und sucht automatisch
    neu (mit gleicher Spieleranzahl).
  - **Aufräumen (ereignisgesteuert, seit v3.6.3)**: Der Host löscht sein
    eigenes Ticket sofort; jedes Kandidaten-Ticket wird erst gelöscht, wenn
    der zugehörige Gast tatsächlich beigetreten ist (`mmPendingCandidates`
    hält pro Rolle den vollständigen Ticket-Pfad). Kein zeitbasiertes Löschen
    mehr — das war ein Race, der Gäste in der Suche hängen ließ.

-----

## 9. TECHNISCHE CONSTRAINTS

### Build-Pipeline (NICHT ändern ohne Grund):

- Quellcode: `fortress.jsx` (React, beginnt mit `export default function Fortress()`)
- JSX wird **vorab** mit esbuild kompiliert (aus tsx-Paket), NICHT live mit Babel
  (Babel im Browser = infinite load auf Handy)
- Ausgabe: `index.html` (eigenständige PWA, ~88 KB)
- Deployment: GitHub Pages, Repo `skkjbeer/Fortress`, URL `skkjbeer.github.io/Fortress/`
- Datei MUSS `index.html` heissen (GitHub Pages braucht das)
- React via unpkg CDN, Firebase SDK via gstatic CDN

### Performance (Pflicht — sonst Lag auf Handy):

- **Offscreen-Canvas** für statisches Terrain (`bgCanvas`, `bgDirty`): einmal
  rendern, jedes Frame per `drawImage` kopieren
- **Flood-Fill-Cache** (`floodCache`, `gridVersion`, `getFloodCache()`): die
  ~6 computeOutsideMap-Aufrufe pro Frame nur bei Grid-Änderung neu berechnen
- `setGrid(newG)` erhöht `gridVersion` (NIE `grid.current =` direkt ausser in setGrid)
- **Canvas-Rect cachen** (`canvasRect`): `getBoundingClientRect()` NICHT bei
  jedem pointermove (Layout-Thrashing → Ruckeln). Nur bei down/resize/scroll
- Alle Spielzustände in Refs (keine React-Re-Renders im Render-Loop)
- Ellipsen vermeiden (fillRect ist ~10× schneller), Wellen-Animation reduziert

### PWA / iOS:

- Splash-Screen, Burg-Icon, “Zum Home-Bildschirm”-Hinweis
- Apple: 4+ Altersfreigabe, kein ATT nötig (kein Tracking), HTTPS via Firebase
- visibilitychange drosselt Polling im Hintergrund (Apple-Konformität)

-----

## 10. UI / TONALITÄT

- Sprache: Deutsch
- Spieler 1 = Blau (♔ Blaues Königreich), Spieler 2 = Rot (♚ Rotes Königreich)
- Minimale, klare Hinweise; nicht überladen
- **Hauptmenü kompakt** (muss auf einen Screen passen): Titel → Profil-Karte →
  kurze vs-Zeile → ausklappbare Anleitung (`showHelp`, standardmäßig zu) →
  Spiel-Buttons (Lokal/Online) → Versionsanzeige
- Result-Screen: nur Host darf “Nächste Runde”/“Neues Spielfeld” (steuert die
  nächste Runde). Der Gast sieht “Warte auf Host”, hat aber IMMER auch einen
  eigenen “🏠 Hauptmenü”-Button zum Verlassen.
- HUD oben: drei Flex-Bereiche (P1 links / Timer mitte fest / P2 rechts). Namen
  per ellipsis gekürzt, flex 1 1 0 + min-width 0, damit lange Namen die mittlere
  Timer-Anzeige NICHT überlappen.
- Online-Result zeigt “Du gewinnst/verlierst” je nach eigener Rolle
- Versionsanzeige im Menü gut lesbar (#64748b), Format “⚔️ FORTRESS · Version X.Y.Z”

-----

## 11. SPIELER-PROFIL (ab v2.0)

- Persistent via **localStorage** (`fortress_profile`) — funktioniert in der PWA
- Felder: `id` (stabil, für Leaderboard-Identität), `name` (max 16 Zeichen),
  `wappen`, `color`, `stats` { wins, losses, games } = 2-Spieler-Statistik,
  `stats3` { wins, losses, games } = 3-Spieler-Statistik (getrennt)
- **Erstanlage**: beim ersten Start wird der Editor automatisch gezeigt (Pflicht)
- **Bearbeiten**: über ✏️-Button in der Profil-Karte im Hauptmenü
- **Profil-Karte** im Menü: Wappen, Name, Statistik (Siege/Niederlagen/Spiele/Quote)
- **Statistik-Erfassung**: nur im Online-Modus (eigene Rolle bekannt). `recordResult()`
  wird genau einmal pro Spiel aufgerufen (`statRecorded`-Flag, reset bei Spielstart).
  Host erfasst in checkLossOrContinue, Gast in applyState beim Empfang des Ergebnisses.
- **Namen im Spiel**: Beim Online-Spiel werden Name + Wappen über `playerInfo` im
  State (Host) bzw. join-Aktion (Gast→Host) ausgetauscht und im HUD angezeigt.
  Lokal bleibt es bei “P1”/“P2”.
- **Geplant (künftige Versionen)**: weitere Individualisierung.

-----

## 12. LEADERBOARD / BESTENLISTE (ab v2.1)

- Global über Firebase: `/leaderboard/{playerId}` → { name, wappen, color, wins,
  losses, games, updatedAt }
- Jeder Spieler hat eine stabile `id` im Profil (Leaderboard-Identität)
- `pushLeaderboard(profile)`: schreibt/aktualisiert den eigenen Eintrag — wird bei
  `recordResult()` (nach jedem Online-Spiel), bei `saveProfileEditor()` und
  EINMAL beim App-Start (useEffect on mount, sobald Firebase bereit) aufgerufen.
  Letzteres trägt bestehende Stats (vor v2.1) nach.
- `openLeaderboard()`: liest `/leaderboard`, filtert `ping` + Einträge mit games=0,
  **sortiert primär nach Siegen, dann nach Spielen** (Tiebreaker)
- **Sortierung laut Vorgabe: nach Siegen, Quote nur als Zusatzanzeige** (nicht
  als Sortierkriterium)
- UI: eigenes Overlay (Button “🏆 Bestenliste” im Menü), Rang mit Medaillen
  (🥇🥈🥉) für Top 3, eigener Eintrag hervorgehoben (”(Du)”), Aktualisieren-Button
- **Firebase Security Rules müssen `/leaderboard` erlauben** (read: alle,
  write: validiert) — siehe Hinweis unten

-----

## 13. 3-SPIELER-MODUS (ab v2.2, aktuell NUR lokal)

- Wählbar im Menü: “LOKAL · 2 SPIELER” oder “LOKAL · 3 SPIELER (alle gegen alle)”.
  2-Spieler-Modus ist UNVERÄNDERT — der gesamte 3-Spieler-Code ist über
  `numPlayers`/`numPlayersRef` und `playersList()` gekapselt und greift nur bei 3.
- **Feld-Geometrie**: Y-förmige Teilung in 3 Sektoren. Ein Hub in der Feldmitte,
  drei Flussarme bei 0°/120°/240° nach außen (`generateTerrain3FromSeed`).
  `sectorOf(r,c)` ordnet jede Zelle einem Sektor zu (1=oben, 2=unten-rechts,
  3=unten-links). Grenzen bei 60°/180°/300°.
- **Burgen**: je eine pro Sektor in dessen Mitte (`castle3Positions`).
- **Zell-Typen** erweitert: WALL3=10, CANNON3=11, CASTLE3=12. Lookups
  `WALL_OF/CANNON_OF/CASTLE_OF[player]`. Farb-Lookups ROOF_OF/FLAG_OF/ACCENT_OF
  etc. (Spieler 3 = Grün ♜).
- **Bauen**: `isBuildable` prüft im 3er-Modus `sectorOf === player`. Touch→Spieler
  per Sektor unter dem Finger (lokal).
- **Schiessen/Treffer**: `impactAt` erkennt JEDEN Gegner (nicht nur “den einen”).
  Eine Kugel kann beide Gegner treffen — Logik sonst identisch.
- **Verlust/Sieg**: “Letzter mit geschlossener Burg gewinnt”. Spieler mit offener
  Burg am Bauende werden eliminiert (`eliminated`-Ref), Spiel endet bei ≤1 übrig.
  Eliminierte bekommen kein Kanonen-Budget mehr.
- **HUD**: 3. Spieler als eigene Zeile unter der Haupt-HUD (nur 3er-Modus),
  ausgeschiedene ausgegraut + ☠️.
- **Flood-Cache** generalisiert auf per-Spieler-Maps (`outside[p]`,
  `cannonOutside[p]`, `castleClosed[p]`), Legacy-P1/P2-Felder bleiben gespiegelt.
- **Online für 3 Spieler (ab v2.5)**: Host verwaltet ZWEI Gäste (P2+P3).
  - Schema: `/games/{code}/` → state, guestAction2, guestAction3, numPlayers, createdAt, updatedAt
  - Jeder Gast schreibt in seinen eigenen Slot (`guestAction{role}`) → kein
    Überschreiben. Host abonniert beide Slots (mpChannel + mpChannel2).
  - Rolle des Gasts: P2 wenn Slot frei, sonst P3 (nur bei numPlayers=3). Gast
    liest numPlayers aus dem Spiel und übernimmt den Modus.
  - Spielstart: 2er → 1 Gast reicht; 3er → beide Gäste müssen beigetreten sein
    (joinedGuests-Tracking). Lobby zeigt “x/2 beigetreten”.
  - State enthält numPlayers, piece3, reloadProg[3], eliminated. Gast regeneriert
    bei numPlayers=3 das Y-Terrain aus dem Seed + baut sectorMap neu.
  - Guest-Checks im Code: `myRole.current !== 1` (statt ===2) = “bin ich Gast”.

-----

## 14. META-PROGRESSION PHASE 2 (Konzept, umgesetzt in v3.20–v3.23)

> Design-Grundlage: Spieldesign-Review v3.19.5. Kernbefund: Der Match-Loop ist
> fertig und ausbalanciert, aber die **Motivationskette der Meta-Ebene ist
> unterbrochen** — Gold wird verdient (Siege, Daily-Streak, Achievements), hat
> aber **keine Senke**; `dailyTasks[]`/`seasonXp` liegen ungenutzt im Profil;
> der Bot hat genau eine Schwierigkeit; der Result-Screen zeigt keinen
> Match-Fortschritt. Phase 2 schließt diese Löcher mit vier Bausteinen, die
> sich gegenseitig füttern:
>
> **Match-Statistik** (Zähler) → speist **Daily Tasks** (Ziele) → geben **Gold**
> → fließt in den **Gold-Shop** (Kosmetik) → sichtbar im Spiel → Motivation für
> weitere Matches. **Bot-Stufen** senken parallel die Einstiegshürde.
>
> Reihenfolge der Umsetzung = Abhängigkeitsreihenfolge:
> v3.20 Bot-Stufen (unabhängig, klein) → v3.21 Match-Statistik (Infrastruktur)
> → v3.22 Daily Tasks (nutzt Zähler) → v3.23 Gold-Shop (nutzt Task-Gold).

### 14.1 Bot-Schwierigkeitsgrade (v3.20.0)

**Ziel**: Lernkurve nach dem Tutorial (Leicht), fairer Sparringspartner
(Mittel = bisheriges Verhalten, unverändert), Herausforderung für Veteranen
(Schwer). Bot-Spiele zählen weiterhin NICHT für ELO/Stats.

**Drei Stellschrauben, alle bereits im Code vorhanden:**

| Stufe | Ziel-Streuung (`botDifficulty`) | Feuer-Drossel (Faktor auf Nachladezeit) | Einkaufsverhalten |
|---|---|---|---|
| 😴 Leicht | 2.4 Zellen (verfehlt oft) | ×1.8 (schießt selten) | nur Kanonen, max. 3, kein Reload/Armor |
| ⚔️ Mittel | 1.0 (bisheriger Wert) | ×1.0 | bisherige Logik (Kanone→Reload→Armor, max. 6) |
| 💀 Schwer | 0.4 (präzise) | ×1.0 | optimierte Reihenfolge (Armor→Reload→Kanone, max. 8) + Reparatur bei Trümmern nahe Burg |

- Bauverhalten (Burg schließen) ist auf allen Stufen gleich — eine offene
  Bot-Burg wäre kein Spielspaß, sondern ein Sofort-Sieg. Seit v3.29.0 ist es
  ECHT zuverlässig: abdeckungs-genaues Platzieren (`botPlaceCovering`) +
  Leck-Versiegler (`botSealCastle`, umbaut Trümmer) — siehe 14.1b.
- **UI**: Tipp auf „Übung gegen Bot“ klappt eine 3-Knopf-Reihe aus
  (😴 Leicht / ⚔️ Mittel / 💀 Schwer); Tipp auf eine Stufe startet das Spiel.
  **Seit v3.29.0 bewusst OHNE Vorauswahl**: keine Stufe ist hervorgehoben,
  nichts wird gespeichert (`fortress_bot_level` entfernt) — der Spieler trifft
  bei jedem Start eine aktive Wahl.
- Tutorial nutzt intern immer „Mittel“-Werte (Coach-Verhalten unverändert).

### 14.1b Bau-KI: Versiegelungs-Intelligenz (v3.29.0)

Nutzer-Report: „Die Bots sind noch zu dumm und schließen nicht wirklich ihre
Burg." Zwei strukturelle Schwächen der alten Bau-KI, beide behoben:

1. **Abdeckungs-genaues Platzieren (`botPlaceCovering`)**: Die alte KI
   platzierte Teile, die zwar NEBEN die Lücke passten, die Lückenzelle aber
   oft nicht abdeckten (`placePiece` prüft nur „passt", nicht „deckt ab") —
   der Bot baute Müll neben das Loch und hielt es für repariert. Jetzt werden
   alle 4 Rotationen × alle Zell-Offsets geprüft, sodass eine Teil-Zelle die
   Zielzelle EXAKT abdeckt; platziert wird nur bei echter Abdeckung.
2. **Leck-Versiegler (`botSealCastle`)**: Solange die Burg offen ist, wird die
   außen-erreichbare bebaubare Zelle mit kleinstem Burg-Abstand (Chebyshev
   2–9) abdeckend bebaut und neu geprüft. Konvergiert auch bei Trümmern in der
   Soll-Mauer (nicht bebaubar!) — es entsteht automatisch ein Umgehungs-Ring.

Bau-Kette in `botBuild`: Rechteck-Ring (hübsch, jetzt deckend) → Versiegler
(robust) → FillNear (verbrennt ein nirgends abdeckend passendes Teil → nächster
Tick bekommt ein neues Zufallsteil). Solange die Burg offen ist, baut der Bot
NICHT an Kanonen weiter.

**Tests**: `TIMER_SPEEDUP` skaliert den KI-Tick proportional (600→60 ms), sonst
bekäme der Bot in der 20× gerafften Bauphase nur ~2 statt ~40 Ticks. Gated
Hooks `__castleClosed(p)` / `__blastWall(p,n)`. Suite-Beweis: 3-Zellen-Bresche
in die Bot-Burg → Bot versiegelt sie (inkl. Trümmer-Umbau) innerhalb 25 s;
Stufen-Menü: alle 3 Buttons identisch gestylt (keine Vorauswahl).

### 14.2 Match-Statistik & Result-Zusammenfassung (v3.21.0)

**Ziel**: Fortschritt pro Match sichtbar machen; zugleich die Zähler-
Infrastruktur, auf der Daily Tasks (14.3) und künftige Achievements aufsetzen.

**Datenmodell** (Ref, kein React-State): `matchStats.current = { 1: {...}, 2: {...}, 3: {...} }`
mit je `{ walls, cannons, scrap, shots, hits, buys }`:

| Zähler | Inkrement-Ort (Host-autoritativ) |
|---|---|
| `walls` — zerstörte Gegner-Mauern | `impactAt` Mauer-Treffer (wo `SCRAP_WALL` gutgeschrieben wird), inkl. Explosions-Kollateral |
| `cannons` — Kanonen-Kills | `impactAt` Kanonen-Kill (wo `SCRAP_CANNON` gutgeschrieben wird) |
| `scrap` — verdienter Schrott gesamt | alle Stellen, die `scrap.current[p]` erhöhen (Mauer, Kanone, Überleben) |
| `shots` — abgefeuerte Kugeln | `fireMortar` (pro Kugel, inkl. Mehrfach-Kanonen) |
| `hits` — Kugeln mit Wirkung | `impactAt`: Zerstörung ODER Schaden (Kanonen-HP-Treffer, Panzermauer-Riss) |
| `buys` — Rüstungs-Shop-Käufe | `buyUpgrade` nach erfolgreichem Kauf (für Daily Task `buy3`) |

- Reset in `resetEconomy()` (jeder Spielstart lokal+online) UND in `nextRound()`
  — die Bilanz zählt **pro Runde**, passend zum Result-Screen nach jeder Runde
  und zur Daily-Task-Ernte (keine Doppelzählung über Runden).
- **Online-Sync**: Host serialisiert `matchStats` in den State-Push (kleines
  Objekt); Gäste übernehmen es in `applyState`. Damit zeigt der Result-Screen
  auf allen Geräten dieselben Zahlen.
- **Result-Screen**: unter der Score-Zeile eine 4-Kachel-Reihe für den eigenen
  Spieler: 🧱 Mauern · 💣 Kanonen · ⚙ Schrott · 🎯 Treffsicherheit
  (`hits/shots` in %, „—“ bei 0 Schüssen). Zweizeilig klein, kein Scrollen.
- **Profil-Lebenszeit-Zähler**: `blocksDestroyedThisGameRef` (existiert) wird
  auf `matchStats[me].walls` umgestellt → eine Quelle statt zwei parallele.

### 14.3 Daily Tasks (v3.22.0)

**Ziel**: Der stärkste Retention-Hebel neben dem Streak — 3 konkrete
Tagesziele mit Gold-Belohnung. Ergänzt den bestehenden 7-Tage-Streak
(`fortress_daily`), ersetzt ihn nicht.

**Rotation**: deterministisch aus dem Datum — `seed = YYYY*10000+MM*100+DD`,
`mulberry`-PRNG wählt 3 verschiedene Tasks aus dem Pool. Kein Server nötig,
alle Geräte desselben Tages sehen dieselben Tasks (bewusst: Community-Gefühl).

**Task-Pool v1 (8 Typen, Zähler aus 14.2):**

| id | Text | Ziel | Gold |
|---|---|---|---|
| `walls30` | Zerstöre 30 Mauern | 30 × `walls` | 30 |
| `walls80` | Zerstöre 80 Mauern | 80 | 50 |
| `cannons2` | Zerstöre 2 Kanonen | 2 × `cannons` | 40 |
| `scrap60` | Verdiene 60 Schrott | 60 × `scrap` | 30 |
| `play2` | Spiele 2 Matches | 2 Matches beendet | 25 |
| `play4` | Spiele 4 Matches | 4 | 45 |
| `win1` | Gewinne 1 Match | 1 Sieg | 40 |
| `buy3` | Kaufe 3× im Rüstungs-Shop | 3 Käufe | 30 |

- **Zählung**: Bot- UND Online-Matches zählen (Tutorial nicht). Begründung:
  Dailies sind Aktivitäts-Anreiz, kein Ranking — Bot-Farmen ist ok und zieht
  Anfänger in die Spielroutine; ELO bleibt davon unberührt.
- **Fortschritt** wird am **Match-Ende** aus `matchStats[eigene Rolle]`
  aufsummiert (nicht live pro Treffer → kein Perf-Einfluss im Render-Loop).
- **Persistenz**: `fortress_tasks` = `{ day:"YYYY-MM-DD", tasks:[{id,prog,done,collected}] }`.
  Neuer Tag ⇒ neue Rotation, alter Fortschritt verfällt.
- **UI**: Menü-Button „Aufgaben“ (📋) mit Badge (Anzahl abholbereiter Tasks);
  Panel im Stil des DailyRewardModal: 3 Zeilen mit Fortschrittsbalken +
  „Abholen“-Button (Gold ins Profil, `lifetimeGold` mitzählen → füttert
  Gold-Achievements). Nach Abholen aller 3: kleiner Bonus-Hinweis auf morgen.

### 14.4 Gold-Shop — Kosmetik (v3.23.0)

**Ziel**: Die fehlende Gold-Senke. Rein kosmetisch (Design-Prinzip „kein
Pay2Win“ bleibt: alles nur mit erspieltem Gold, kein Echtgeld).

**Drei Kategorien, 12 Artikel (v1):**

| Kategorie | Artikel (Preis) | Wirkung |
|---|---|---|
| 🎇 **Ball-Trails** | Standard (0, immer), Glut 🔥 (150), Frost ❄️ (150), Gift ☠️ (250), Gold ✨ (400) | Färbt die Kugel-Schweif-Partikel der EIGENEN Kugeln (Trail-Farbe statt `BALL_MID[player]`) |
| 🖼️ **Wappen-Rahmen** | Kein (0), Bronze (100), Silber (250), Gold (500), Drachen 🐉 (800) | Zierrahmen um das eigene Wappen in Menü, Profil, Result-Screen und (online) beim Gegner |
| 🎉 **Sieges-Effekte** | Konfetti (0, immer), Feuerwerk (200), Goldregen (350) | Partikel-Effekt auf dem eigenen Result-Screen bei Sieg |

- **Preisspanne begründet**: Tages-Einkommen nach Phase 2 ≈ 100–150 Gold
  (Streak 10–50 + 3 Tasks ~95–135 + Siege 10–50/Match). Erster Kauf nach
  1–2 Tagen, Top-Artikel nach ~1 Woche — sichtbare, erreichbare Ziele.
- **Datenmodell**: `profile.cosmetics = { owned: [ids], equipped: { trail, frame, win } }`.
- **Online-Sichtbarkeit**: `trail` + `frame` wandern in `playerInfo`
  (bestehender Sync-Kanal für Name/Wappen/ELO) → Gegner sehen Trail-Farbe der
  gegnerischen Kugeln und den Rahmen im Result-Screen. Fallback bei alten
  Clients: Feld fehlt ⇒ Standard-Optik (abwärtskompatibel).
- **Rendering-Budget**: Trails nutzen den BESTEHENDEN Trail-Mechanismus
  (nur andere Farbe pro Spieler-Lookup) — keine neuen Per-Frame-Kosten.
  Rahmen/Sieges-Effekte sind reine Menü-/Result-UI (außerhalb des Loops).
- **UI**: Menü-Button „Shop“ (🛒) → Modal mit 3 Tabs; Artikel-Karte zeigt
  Vorschau, Preis oder „Besitzt“/„Angelegt“; Kauf = Gold-Abzug + sofort
  angelegt. Gold-Kontostand im Shop-Header.

### 14.5 Bewusst NICHT in Phase 2

- Kanonen-/Mauer-Skins im Spielfeld (berühren den Sprite-Cache pro Spieler —
  eigener sauberer Umbau, Phase 3).
- Season-System/Ligen (braucht Spielerbasis), Freunde/Rematch, Emotes.
- Balancing-Änderungen an der Schrott-Ökonomie (separater Messpass).

-----

## CHANGELOG

- **v1.0**: Erste vollständige Version. Online via Firebase SDK (onValue),
  Festung-Kanonenmechanik mit frozenReady, flüssiges Platzieren/Schiessen,
  Code-Kopierfunktion, alle Gast-Sync-Bugs behoben.
- **v1.0.1**: Reload-Balken beim Gast wird lokal interpoliert (60fps) statt bei
  jedem Push zu springen — flüssige Nachladeanimation auch für Host-Kanonen.
  Phasenwechsel-Banner beim Gast über eigenen lastSeenPhase-Ref zuverlässig.
  Versionsanzeige im Hauptmenü.
- **v1.0.2**: Drehen im Online-Modus host-autoritativ (Gast sendet rotate-Aktion).
  Multitouch-Fix: nur ein Bau-Pointer pro Spieler (activeBuild) → kein
  Ghost-Konflikt bei zwei Fingern.
- **v1.0.3**: Bausteinvorschau in der Bau-Leiste wieder eingebaut — zeigt das
  aktuelle Teil dauerhaft als Mini-Grid (Host & Gast), aktualisiert beim Drehen.
- **v1.0.4**: KRITISCHER FIX — nach der Schiessphase konnte man nichts mehr
  platzieren (hängender activeBuild/activeDrag-Pointer-Slot). Slots werden jetzt
  bei jedem Phasenwechsel zurückgesetzt (Host in start*-Funktionen, Gast in
  applyState), plus verwaiste Slots werden in onPointerDown automatisch
  freigegeben wenn der Pointer nicht mehr existiert.
- **v1.0.5**: Gast kann den Code per “Code einfügen”-Button direkt aus der
  Zwischenablage übernehmen (mit Zeichenfilter + Fehlerhinweis).
- **v1.0.6**: FIX — Kanonen galten fälschlich als Mauer und konnten Löcher in
  der Burgmauer “stopfen” (Burg galt zu Unrecht als geschlossen). Jetzt zählen
  im Burg- UND Kanonen-Check nur echte Mauern (+ Burg beim Burg-Check) als Blocker.
- **v1.0.7**: Berge sind jetzt reine Deko und bebaubar — nur noch Fluss/Wasser
  (und die gegnerische Hälfte) sperrt das Bauen.
- **v2.0**: Spieler-Profile eingeführt — Name, Wappen, Farbe, persönliche
  Statistik (Siege/Niederlagen/Spiele), persistent via localStorage. Erstanlage
  beim ersten Start, Bearbeiten im Menü. Namen werden online ausgetauscht und im
  HUD angezeigt. Versionsanzeige im Menü besser sichtbar. Fundament für künftige
  Individualisierung + Ladder-Board.
- **v2.0.1**: Hauptmenü kompakter — Anleitung ist jetzt ausklappbar (standardmäßig
  zu, “Wie spielt man?”-Toggle), Königreich-Badges gekürzt, Abstände reduziert,
  damit Profil-Karte + Spiel-Buttons wieder auf einen Screen passen.
- **v2.0.2**: HUD-Overlap-Fix — Spielernamen oben überlappten die Timer-Anzeige;
  jetzt sauberes Flex-Layout mit ellipsis. Gast bekommt auf dem Online-Result-
  Screen einen eigenen “Hauptmenü”-Button (vorher nur Warte-Hinweis).
- **v2.1**: Globales Leaderboard/Bestenliste eingeführt — über Firebase
  `/leaderboard`, sortiert nach Siegen (Quote als Zusatz), eigenes Overlay mit
  Medaillen-Rängen, eigener Eintrag hervorgehoben. Profil bekam stabile ID.
  Stats werden nach jedem Online-Spiel hochgeladen. ⚠️ Firebase-Rules müssen für
  /leaderboard erweitert werden.
- **v2.1.1**: Bestehende Stats werden beim App-Start einmalig ins Leaderboard
  hochgeladen (vorher wurden nur Spiele AB v2.1 gezählt). So erscheinen schon
  gespielte Partien sofort in der Bestenliste.
- **v2.2**: 3-Spieler-Modus (lokal, alle gegen alle) eingeführt — Y-förmige
  Sektor-Teilung, 3 Burgen, Spieler 3 = Grün ♜, “letzter mit geschlossener Burg
  gewinnt”. Komplett gekapselt: 2-Spieler-Modus völlig unverändert. Online für 3
  Spieler folgt als nächster Schritt. Menü: separate 2-/3-Spieler-Buttons.
- **v2.2.1**: Fixes nach erstem 3-Spieler-Test:
  • Ghost-Position wird nach oben geklemmt (gr>=1) → oberer Spieler (P1) konnte
  nahe seiner Burg nichts setzen, weil der Ghost über den Rand rutschte.
  • Leaderboard: neu erzeugte Profil-id wird sofort in localStorage persistiert
  (vorher bei jedem Laden neue id → doppelte Einträge). Bestehende Doppel-
  Einträge müssen einmalig manuell in der Firebase-Konsole gelöscht werden.
  • 3-Spieler: Burgen weiter nach außen gerückt (dist 0.34) → nicht mehr im Fluss.
  • 3-Spieler: ausgeschiedene Spieler (offene Burg) können nicht mehr bauen,
  Kanonen setzen oder feuern (Checks in placePiece/placeCannon/fireMortar).
- **v2.2.2**: 3-Spieler-Sektoren ausbalanciert fürs Hochformat. Hub auf 40% Höhe
  nach oben verschoben, Sektor 1 (oben) auf ±70° verbreitert. Flussarme laufen
  jetzt entlang der Sektor-GRENZEN (70°/180°/290°) und trennen sichtbar. Burgen
  an die neuen Sektor-Mitten gesetzt. Ergebnis: P1 34% / P2 31% / P3 35% Fläche,
  alle Burgen sauber im eigenen Sektor.
- **v2.3**: Bestenliste & Statistik nach Modus getrennt. Profil hat jetzt `stats`
  (2-Spieler) UND `stats3` (3-Spieler). Leaderboard speichert beide
  (wins/games + wins3/games3 unter /leaderboard/{id}) und hat einen 2er/3er-
  Tab-Umschalter. Profil-Karte zeigt beide Statistiken (⚔️ 2P / 👑 3P).
  recordResult(won, mode) bucht in den richtigen Topf. Lokale Spiele zählen
  weiterhin GAR NICHT (nur online). 3-Spieler-Liste füllt sich erst mit dem
  künftigen 3-Spieler-Online-Modus.
- **v2.4**: (1) 3-Spieler-Bauzonen per Land-Flood-Fill von den Burgen
  (`buildSectorMap`) statt Winkel-Sektor → man kann exakt bis ans Wasser bauen,
  keine toten 2-3-Zellen-Streifen mehr an den Grenzen. (2) Spielfeld vergrößert
  auf 44×68 (CELL 14) für mehr Baufläche in allen Modi.
- **v2.5**: 3-Spieler-ONLINE-Modus. Host koordiniert zwei Gäste über getrennte
  Action-Slots (guestAction2/3), beide Gäste über Code beitreten, Rolle wird
  automatisch vergeben. Online-Screen hat 2/3-Spieler-Wahl beim Erstellen.
  Lobby wartet bei 3er auf beide Gäste. 3er-Bestenliste füllt sich jetzt.
  ⚠️ Firebase-Rules müssen guestAction2/guestAction3/numPlayers erlauben.
- **v2.5.1**: Klarere Beschriftung — Online-Button heißt jetzt “ONLINE SPIELEN
  (2–3 Geräte)”, Online-Screen-Text “zu zweit oder zu dritt”. Die 2/3-Spieler-
  Wahl war schon da (im Online-Screen über “Spiel erstellen”), nur missverständlich
  beschriftet.
- **v2.5.2**: (1) Anleitung-Aufklapper ist jetzt ein klar sichtbarer Button
  (📖 Rahmen + Icon) statt unscheinbarem Link. (2) Leaderboard-Overlay hat einen
  “🧹 Doppelte entfernen”-Button: sammelt alle Einträge mit dem eigenen Namen,
  merged Stats (Maximum je Feld), behält den aktuellen id-Eintrag, löscht die
  anderen (cleanupMyDuplicates). Behebt die durch den alten id-Bug entstandenen
  Mehrfach-Einträge.
- **v2.6**: (1) Temporären “Doppelte entfernen”-Button wieder entfernt (Funktion
  cleanupMyDuplicates bleibt im Code, nur ohne Button). (2) “✕ Beenden”-Button in
  der Top-Leiste des Spielbildschirms (lokal UND online). Öffnet eine
  Sicherheitsabfrage (“Spiel beenden? Ja/Weiterspielen”) → verhindert
  versehentliches Verlassen. Lokal → Hauptmenü, Online → leaveOnline.
- **v2.7**: Online-Verlassen wird jetzt korrekt aufgelöst. Gast verlässt → sendet
  “leave”-Aktion, Host markiert ihn als ausgeschieden (handlePlayerLeft):
  bei ≤1 Verbliebenem endet das Spiel (Sieger), sonst läuft es weiter (3er).
  Host verlässt → hostLeaveResolve() pusht finalen “host_left”-Zustand mit dem/den
  Verbliebenen als Sieger, Spiel-Löschung um 2,5s verzögert (cleanupGame) damit
  Gäste den Endzustand sicher empfangen. Result-Screen zeigt “Ein Spieler hat das
  Spiel verlassen”. sanitizeAction erlaubt “leave”. Hinweis: deckt sauberes
  Beenden ab; harter Verbindungsabbruch (App-Crash) bräuchte später Heartbeat.
- **v2.8**: UI-Anpassungen. (1) HUD-Spielerbalken werden nicht mehr abgeschnitten:
  Mittelblock (Phase+Timer) verschlankt (kein “DU = BLAU”-Text mehr, maxWidth 34%,
  Phase-Badge über Timer gestapelt), Namen elliptisch gekürzt statt überlaufend,
  eigener Spieler im Online-Modus mit “(Du)” markiert (alle 3 Balken). 3er-Balken
  ebenfalls breitenbegrenzt. (2) Obsolete “♔ Blau vs ♚ Rot”-Badges aus dem
  Hauptmenü entfernt (haben durch 2/3-Spieler-Wahl keine feste Bedeutung mehr).
- **v2.8.1**: 3-Spieler-Online Platzierungs-Bug behoben. Ursache war eine Race
  Condition beim Beitreten: lasen beide Gäste fast gleichzeitig den Snapshot,
  bekamen beide Rolle P2 → P3-Slot blieb leer, ein Gast konnte nichts platzieren.
  Fix: atomare Slot-Reservierung per Firebase-Transaktion (fb.reserve →
  runTransaction, neu im SDK-Import). Erst guestAction2 versuchen, dann
  guestAction3 — schreibt nur wenn Slot leer. Zusätzlich Sicherheitsnetz im Host:
  Aktion von noch nicht registriertem Gast registriert ihn nach + sichert
  pieces-Struktur, statt die Aktion zu verwerfen.
  ⚠️ index.html SDK-Header importiert jetzt runTransaction (Build-Header beibehalten).
- **v2.8.2**: ECHTE Ursache des 3er-Online-Platzierungsbugs gefunden (Gäste
  nacheinander verbunden, also keine Join-Race). Beim Gast-seitigen
  Phasenwechsel-Reset in applyState wurden activeBuild/activeDrag hart auf
  { 1:null, 2:null } gesetzt — Slot für P3 FEHLTE. Dadurch hatte P3 nach dem
  ersten Phasenwechsel keinen gültigen Bau-Pointer-Slot und konnte nichts mehr
  platzieren. Fix: Reset für alle aktiven Spieler (modusabhängig 1/2/3). Die
  Transaktions-Reservierung aus v2.8.1 bleibt als zusätzliche Absicherung.
- **v2.9**: UI-Vereinheitlichung & Platz. (1) Hauptmenü: ein einziger “LOKAL
  SPIELEN”-Button öffnet (wie Online) einen Auswahl-Screen für 2 oder 3 Spieler
  (mpScreen “local”) — stringent zur Online-Flow-Struktur, statt zwei separater
  lokaler Buttons. (2) Ingame: Beenden-Button ist jetzt ein kompaktes “✕” oben
  rechts schwebend (position absolute) statt einer eigenen vollbreiten Zeile —
  spart vertikalen Platz. (3) HUD-Namen: letterSpacing entfernt, Mittelblock auf
  28% verschmälert, Namensschrift 12px → lange Namen wie “Bierkönig” passen jetzt
  ohne Abschneiden.
- **v3.0**: ELO-Ranking eingeführt. Jeder startet mit 1000 ELO (elo = 2-Spieler,
  elo3 = 3-Spieler, getrennt). ECHTE ELO-Berechnung gegen die tatsächlichen
  Mitspieler: deren ELO wird beim join übertragen + im playerInfo/State geführt,
  recordResult rechnet gegen jeden Gegner einzeln (eloDelta, K=32, Erwartungswert
  per Standard-Formel) und mittelt die Deltas. score: Sieg=1, Niederlage=0,
  Remis=0.5. Bestenliste sortiert nach ELO (statt Siegen), zeigt ELO groß +
  Siege/Niederlagen als Detail. Profil-Karte zeigt ELO + Gesamt-S/N je Modus.
  Leaderboard speichert elo/elo3. Unentschieden (alle verbleibenden Spieler
  scheiden gleichzeitig aus): sauberes Spielende, 🤝-Symbol, neutrale Anzeige,
  ELO-Remis (0.5), zählt als Spiel ohne Sieg/Niederlage. P3-Königreich-Banner
  (Grün) im Result korrigiert.
  ⚠️ Firebase-Rules: leaderboard erlaubt zusätzliche Felder (elo/elo3) — mit der
  bestehenden Regel (hasChildren name/wins/games) bereits abgedeckt.
- **v3.0.1**: 3-Spieler-Online Platzieren ging nicht (2-Spieler ok). Ursache: die
  Gast-sectorMap wurde nur im Seed-Änderungs-Block von applyState berechnet —
  war der Seed schon gesetzt oder das Terrain nicht als mode3 vorliegend, blieb
  sectorMap undefined → Gast-Ghost nutzte Winkel-sectorOf (andere Zonen als die
  Host-Land-Flood-sectorMap) → Host lehnte die gesendete Bauposition ab, nichts
  passierte. Fix: applyState stellt bei numPlayers=3 IMMER sicher, dass (a) das
  Terrain als mode3 regeneriert ist und (b) die sectorMap aus Seed+castles gebaut
  ist (deterministisch identisch zum Host). Damit stimmen Gast-Ghost und Host-
  Validierung überein.
- **v3.0.2**: 3-Spieler-Online — Gäste sahen keine Host-Updates (P2-Aktionen
  erschienen beim Host, aber Gäste sahen nichts; P3 ging gar nichts). Zwei
  Ursachen: (1) Stale Session-Check: hostSessionRef wurde beim Beitreten/Erstellen
  nicht zurückgesetzt — bei mehreren Spielen hintereinander (ohne Reload) verwarf
  applyState alle States des neuen Hosts (Session-ID-Mismatch → return). Fix:
  hostSessionRef beim guestJoinGame auf “” und beim hostCreateGame auf SESSION_ID
  setzen. (2) Nach einem join während das Spiel schon läuft (P3 tritt nach P2 bei)
  pushte der Host keinen State → späte Gäste warteten ewig. Fix: Host pusht nach
  jedem join (mehrfach) den aktuellen Zustand.
- **v3.0.3**: *(im Chat entwickelt — Details nachzutragen)*
- **v3.0.4**: *(im Chat entwickelt — Details nachzutragen)*
- **v3.0.5**: *(im Chat entwickelt — Details nachzutragen; enthielt “(Diagnose)”-Label in der Versionsanzeige)*
- **v3.0.6**: KRITISCHER FIX 3-Spieler-Online — P3-Gäste konnten keine Bauteile
  platzieren. Ursache: `pieces.current[3]` wurde für Gäste nie initialisiert, da
  `startOnlineGame()` für Gäste nicht aufgerufen wird (nur für Host). In
  `applyState` prüfte der Guard `pieces.current[3]` vor dem Setzen — war undefined,
  wurde das Stück nie übernommen → P3 hatte kein Bauteil. Fix: applyState
  initialisiert jetzt alle Spieler-Einträge in `pieces.current` sobald numPlayers
  bekannt ist. Zusätzlich: `reloadProgRef` um Spieler-3-Eintrag ergänzt (P3-Kanonen
  zeigten immer vollen Reload), `frozenReady`- und `lastShot`-Fallbacks um P3
  ergänzt. Versionsanzeige: “(Diagnose)”-Label entfernt.
  Deployment: Automatisches GitHub Pages Deployment via GitHub Actions eingeführt
  (push auf main → Pages automatisch aktualisiert, Release wird erstellt).
- **v3.0.7**: KRITISCHER FIX 3-Spieler-Online — Gäste hingen in der alten Phase
  fest (z. B. Host in Schießphase, Gäste weiter in Bauphase mit „Drehen"-Button),
  obwohl States ankamen und das Grid synchron blieb. Ursache: In `applyState` wurde
  die Phase/Timer/Runde erst GANZ AM ENDE eines großen try-Blocks gesetzt — nach
  `setGrid` und der kompletten Terrain-/Sector-/Objekt-Verarbeitung. Wirft irgend-
  eine dieser nachgelagerten Operationen, wird der Phasenwechsel nie angewendet,
  während das Grid (weiter oben) schon aktualisiert ist → Gast friert in der alten
  Phase ein. Fix: `applyState` synchronisiert jetzt Phase/Timer/Runde/Scores/Screen
  + den Phasen-Banner-/Pointer-Reset ZUERST (direkt nach den Session-/Sanitize-
  Checks). Die schwere Grid-/Terrain-/Objekt-Verarbeitung läuft danach in einem
  EIGENEN try/catch — ein Fehler dort kann die Phasen-Synchronisation nicht mehr
  blockieren und wird sichtbar als `applyObjects:`-Fehler im Diagnose-Overlay
  protokolliert (statt still die Phase einzufrieren).
- **v3.0.8**: Diagnose-Overlay für Endnutzer deaktiviert (`showDbg` startet
  jetzt auf `false`). Overlay bleibt im Code und kann bei Bedarf reaktiviert
  werden, ist aber standardmäßig unsichtbar.
- **v3.0.9**: (1) Drehen-Button für Spieler 3 ergänzt — fehlte sowohl im
  3-Spieler-Online (P3-Gast sah keinen Button) als auch im lokalen 3er-Modus
  (P3 konnte sein Teil nicht drehen). Grüner Button erscheint für P3-Gäste
  online und für alle Spieler offline wenn numPlayers=3. Mini-Grid-Vorschau
  zeigt P3-Teile jetzt in Grün (#34d399). (2) ELO-Änderung im Ergebnis-Screen:
  nach jedem Online-Spiel wird "ELO: alt → neu (±delta)" angezeigt (grün/rot
  je nach Richtung). `eloChangeRef` speichert die Änderung in `recordResult`
  und wird beim Spielstart zurückgesetzt.- **v3.1.0**: Goldsystem eingeführt. Jeder Spieler startet mit 100 Goldmünzen
  (gespeichert in `profile.gold`, localStorage). Gold wird ausschließlich in
  Online-Spielen verdient — nur der Gewinner erhält Gold, kein Goldabzug bei
  Niederlage. Formel: `goldEarned = clamp(5, 50, round(10 * (1 + max(0, gegnerELO - meineELO) / 100)))`.
  Niedrigere ELO gegen höhere ELO → mehr Gold (Anreiz, gegen Stärkere zu spielen
  und verhindert Farm-Abuse). Bei 3 Spielern wird der Schnitt über beide Gegner
  gebildet. Gold wird im Menü-Profilbereich angezeigt (💰 X Gold). Nach Online-
  Siegen erscheint auf dem Ergebnis-Screen eine goldene Box "alt → neu +delta 💰"
  (analog zur ELO-Box). Gold wird mit dem Leaderboard auf Firebase synchronisiert.
  Sicherheit: Berechnung erfolgt clientseitig (wie ELO), Host-autoritativ — kein
  serverseitiger Code benötigt. `goldChangeRef` speichert die Änderung in
  `recordResult` und wird beim Spielstart zurückgesetzt.
- **v3.1.1**: Prominente Phasen-Ankündigungen für alle Modi (lokal + online, Host + Gäste).
  Zentrierter Overlay-Banner mit Animation (fade-in, scale, fade-out, 2.5s) erscheint
  bei jedem Phasenwechsel: 🏰 SPIELSTART (blau), 🧱 BAUPHASE (grün), 💥 FEUER FREI!
  (rot), 🎯 NEUE KANONE (orange). Jede Phase hat eigene Farbe, Emoji, Kurz-Anleitung
  und Glow-Effekt. Ersetzt die alten showWarn()-Aufrufe für Gäste online; für lokale
  Spiele und den Host gab es vorher gar keine Ankündigung.
- **v3.1.2**: Setup-Timer springt auf 3s wenn alle Spieler ihre 2 Start-Kanonen
  gesetzt haben und der Timer noch über 3s steht. Verhindert unnötiges Warten
  wenn alle fertig sind. Check in `placeCannon()` nach Budget-Dekrement:
  `phase === "setup" && alle cannonBudget <= 0 && timer > 3 → timer = 3`.
- **v3.1.3**: Timer pausiert während Phasen-Banner (2.5s). `startTimer()` akzeptiert
  jetzt optionales `delayMs`-Argument. Bei allen Phasenwechseln mit Banner wird
  `startTimer(2500)` aufgerufen — Timer startet erst wenn der Banner verschwunden
  ist. Gilt für Setup, Bau, Schuss und Kanonen-Phase.
- **v3.1.4**: Alle Spieler-Interaktionen gesperrt während Phasen-Banner läuft (2.5s).
  `bannerActive` Ref wird in `showPhaseBanner()` auf true gesetzt und nach 2.5s
  zurückgesetzt. `onPointerDown`, `onPointerMove`, `onPointerUp` prüfen am Anfang
  `bannerActive.current` und kehren sofort zurück. Pointer-State wird in
  `onPointerUp` trotzdem immer bereinigt (verhindert stale Pointer-Einträge).

- **v3.1.5**: Race-Condition zwischen Banner-Ende und Timer-Start behoben. Vorher
  liefen zwei separate `setTimeout(fn, 2500)` unabhängig voneinander: einer in
  `showPhaseBanner()` (Banner ausblenden + `bannerActive=false`) und einer in
  `startTimer(2500)` — mit minimalem Zeitversatz, sodass kurz nach Bannerablauf
  weder Timer lief noch Interaktionen möglich waren. Fix: `startTimer()` hat kein
  `delayMs`-Argument mehr. Stattdessen wird `startTimer` als `onDone`-Callback an
  `showPhaseBanner()` übergeben und direkt im selben `setTimeout`-Callback
  aufgerufen. Dadurch ist der Übergang von Banner→Timer→Spielbar atomar ohne Lücke.
  Alle vier Phasenfunktionen nutzen jetzt `showPhaseBanner("phase", () => startTimer())`.
- **v3.1.6**: Code-Review und Wartbarkeits-Optimierungen (Software-Architekt-Pass).
  BUG: `phaseBannerTimer.current` wurde beim Verlassen des Spiels (screen → menu)
  nicht gecancelt → `onDone()` feuerte 2.5s nach Spielende und startete einen neuen
  Timer-Intervall im Menü, der Phasenfunktionen auf einem beendeten Spiel aufrief.
  Fix: `clearTimeout(phaseBannerTimer.current)` + `bannerActive.current = false` im
  useEffect([screen]) Cleanup (beide Pfade: screen !== "game" und Cleanup-Return).
  SIMPLIFICATION: `() => startTimer()` Wrapper-Lambdas durch direkte Funktions-
  referenz `startTimer` ersetzt (4 Stellen). 4-branch if/else in `applyState` für
  Phasen-Banner vereinfacht zu `if (PHASE_BANNERS[s.phase]) showPhaseBanner(s.phase)`
  — neue Phasen werden automatisch unterstützt. Tote Fallback `|| PHASE_BANNERS.build`
  im Banner-Render entfernt. EFFICIENCY: `playersList()` im renderLoop von 7 Aufrufen
  pro Frame (7 Array-Allokationen á 60fps = 420/s) auf einen einzigen Cache `const
  players = playersList()` am Frame-Anfang reduziert.
- **v3.1.7**: Beenden-Button UX überarbeitet. Vorher: absolut positionierter 30×30px
  Button (position:absolute, top:6, right:6) überlagerte den P2-Score-Bereich im HUD.
  Jetzt: "✕ beenden" als statisch positionierter Text-Button im HUD-Center (unter
  Timer+Runde), passend zum visuellen Stil. Kein Overlap mehr möglich. Tests erweitert:
  Overlap-Check (position ≠ absolute, keine Button-Überlappung), Timer-Countdown,
  CSS-Animation-Check, Gold im Menü, Weiterspielen-Dialog, Ja-beenden-Rückkehr ins
  Menü — von 10 auf 42 Test-Assertions erweitert (3 Test-Suiten).
- **v3.1.8**: Beenden-Button Redesign + Mechanik-Tests. Button-Styling: dark semi-
  transparent background (rgba(15,23,42,0.7)), Rahmen (rgba(100,116,139,0.22)),
  slate-600 Text, borderRadius 8, uppercase-Buchstaben, 22px Höhe (5+9+6+2 border).
  Tests erweitert von 42 auf 50 Assertions: 4. Test-Suite "Spielmechanik" prüft
  den vollständigen Phasenzyklus — Kanonen in Setup platzieren, Tetrominos bauen
  (Drag-Geste), Schussphase erreichen und Schuss-Geste ausführen, Kanonen-Phase
  und neue Kanone setzen, Runde-2-Bauphase als Zyklus-Bestätigung.
- **v3.1.9**: Phasenwechsel nach Setup geändert. Nach der Setup-Phase (Kanonen platzieren)
  geht das Spiel jetzt direkt in die Schussphase (FEUER) statt in die Bauphase.
  Der normale Zyklus danach: Schuss → Kanone → Bau → Schuss → ... bleibt unverändert.
  `startShoot()` als eigene Funktion extrahiert (wurde zuvor inline in `endBuild`
  dupliziert); `endSetup()` ruft jetzt `startShoot()` statt `startBuild()` auf.
  Tests (45 Assertions) auf neuen Startphasen-Flow angepasst — alle grün.
- **v3.2.0**: Diagonale Lücken zählen als offene Mauer. Flood-Fill für Burgschluss-Prüfung
  (`computeOutsideMap` + `computeOutsideMapForCannons`) von 4-Wege auf 8-Wege erweitert.
  Wird eine Ecke der Mauer weggeschossen, kann der Außenraum diagonal hindurchsickern
  → Burg gilt als offen. Gleiches gilt für die Kanonen-Abschirmprüfung (`closedCannons`).
- **v3.2.1**: Drehmechanik komplett überarbeitet.
  1. **Canvas-Tap dreht**: Kurzer Tap auf Canvas (< 1.5 Zellen Bewegung, < 450ms) dreht das
     aktuelle Stück — kein Wechsel zum Drehen-Button nötig. Drag (> 1.5 Zellen) platziert.
  2. **Stück-Vorschau-Panel** ersetzt die Text-Buttons: zeigt die aktuelle Tetromino-Form
     als farbige Punkte (11px/Zelle). Antippen dreht. Alle 3 Spieler haben eigenes Panel.
  3. **Haptic Feedback**: `navigator.vibrate(30)` bei jeder Drehung (Android/Chrome).
     iOS Safari unterstützt Vibration API nicht — kein Audio-Workaround gewünscht.
  Tests auf 47 Assertions erweitert: Canvas-Tap-Rotation, Vorschau-Panel-Sichtbarkeit,
  Panel-Tap-Rotation, Drag-Platzierung.
- **v3.2.2**: Audio-Workaround für iOS wieder entfernt (kein Audio gewünscht).
  `navigator.vibrate(30)` bleibt für Android. iOS ohne Haptik — plattformlimitierung.
- **v3.3.0**: PWA-Grundlage für Android Store (TWA) implementiert.
  Neue Dateien: `manifest.json` (name/icons/display:standalone/start_url:/Fortress/),
  `sw.js` (Network-first Service Worker — online immer neueste Version, offline Cache),
  `icon-512.png`, `icon-192.png`, `icon-96.png` (aus bestehendem SVG generiert).
  `index.html`: `<link rel="manifest">` + SW-Registrierung hinzugefügt.
  GitHub Pages bleibt immer aktuell (Network-first überschreibt Cache bei jedem Deploy).
  Noch fehlend für Store: Privacy Policy, `.well-known/assetlinks.json`, Bubblewrap-Setup.
- **v3.4.0**: Visuelles & Gameplay-Upgrade — modernes mittelalterliches Mobile-Game-Feel.
  **Canvas-Effekte:**
  1. **Mauerstein-Textur**: `drawWall` zeichnet jetzt horizontale Fugen + versetzte Senkrechtfugen
     auf jeder Mauerzelle (Backsteinmuster). Farbe via `mortar`-Parameter.
  2. **Bildschirm-Shake**: `shakeRef = useRef(0)`. Bei Wandtreffer: +7, bei Kanonentreffer: +14.
     Zerfällt mit Faktor 0.72/Frame. `ctx.save/translate/restore` um gesamtes Frame.
  3. **Feuerpartikel**: `impactAt` erzeugt 20 Partikel (60% Feuer: gold/orange/rot, 40% Trümmer).
     Kanonentreffer: 26 Partikel. Alle mit `size`, `round`, `gravity`-Feldern.
  4. **Partikelphysik**: Alle Partikel haben `gravity`-Feld (Standard 0.08 px/Frame²) statt
     linearer Dämpfung: `p.vy = p.vy * 0.92 + gravity`. Feuerpartikel steigen initial auf,
     Trümmer fallen nach. Schmauch (smoke) der Kanone hat `gravity: -0.05` (schwebt auf).
  5. **Geschossschweif**: Jedes `ball`-Objekt hat `trail: []`. Im Render-Loop werden bis zu
     9 Positionspunkte gesammelt; jeder wird als abnehmend-transparenter Kreis gezeichnet.
  6. **Kanonenmündung Smoke**: Schuss erzeugt jetzt 10 Partikel (6 Blitz-Flash + 4 Schmauch),
     Schmauch hat `gravity: -0.05` und `round: true`.
  7. **Partikelrender**: Unterstützt jetzt `p.size` (Radius/Halbseite) und `p.round` (Kreis vs. Quadrat).
  **Hintergrund & Atmo:**
  8. **Dunkleres Battlefield**: Grundgradient nun #2e5a22 → #172e10 (satter, mittelalterlicher Ton).
  9. **Vignette**: Radial-Gradient-Overlay am Ende des bgCanvas (Dunkelrand ~55% Alpha außen).
  10. **Dunkleres Wasser**: #1a3d70 statt #2563a8, mehr Kontrast.
  11. **Goldener Feldrand**: 2.5px Strich `rgba(170,140,55,0.35)` um das gesamte Spielfeld.
  **HUD-Redesign:**
  12. **Spielerkarten**: Tieferer Hintergrund (Blau/Rot/Grün mit 0.88 Alpha), Goldrand
      `rgba(160,140,70,0.65)`, Innen-Glow. Punkte in Goldfarbe `#fde68a` mit Text-Glow.
  13. **Phasenbadge**: Erhöhte Sättigung + `boxShadow`-Glow je nach Phase (Grün/Rot/Gold).
  14. **Timer**: Immer leichter Glow (`0 0 5px rgba(200,180,100,0.25)`), bei ≤5s intensiv.
- **v3.5.0**: Zweisprachigkeit DE/EN — vollständige UI-Übersetzung.
  - **LANGS-Objekt** mit ~100 Schlüsseln (DE + EN) vor der App-Funktion definiert.
  - **`lang`-State** in React, persistiert in `localStorage('fortress_lang')`, Standard: 'de'.
  - **`t(key, vars)`-Funktion** für alle UI-Strings; `{variable}`-Ersetzung per Regex.
  - **Sprachschalter** im Menü: 🇩🇪 DE / 🇬🇧 EN als Pill-Buttons.
  - Alle UI-Strings ersetzt: Menü, HUD, Phasenbanner, Tipps, Beenden-Dialog, Profil,
    Online-Lobby, Wartescreen, Ergebnis-Screen, Leaderboard, Hilfekarten.
- **v3.5.1**: Fix — verbliebene hartcodierte deutsche Strings im Spiel übersetzt.
  Letzte-Kanone-platziert-Meldung, Warte-/Verbinde-Bildschirm, Code-teilen-Hinweis,
  Fallback-Spielernamen (`Spieler N`) und Profil-Editor-Default nutzen jetzt `t()`.
- **v3.5.2**: UX — mehr Spielfläche während der Bauphase.
  - **Stück-Vorschau-Panel verkleinert**: Padding, Mindesthöhe (64→42px), Punktgröße
    (11→8px) und Beschriftung kompakter, ohne die Drehen-Funktion einzuschränken.
  - **Dynamische Höhenmessung statt fixem Abzug**: `fit()` misst jetzt die tatsächliche
    Höhe von Score-Leiste, 3-Spieler-Zeile und Vorschau-Panel per Ref/`ResizeObserver`
    statt einen festen Wert (150px) vom Viewport abzuziehen. Dadurch passt sich das
    Spielfeld korrekt an — auch bei 3 Spielern oder wenn sich die Panel-Höhe durch
    Phasenwechsel ändert — ohne dass das Layout über den Bildschirmrand hinausragt.
- **v3.5.3**: Fix — Layout-Sprünge & Online-Verzögerung beim Bauen.
  - **Stück-Vorschau fixe Box-Größe**: Vorschau-Raster sitzt jetzt in einer festen
    32×32px-Box (Dot-Größe passt sich pro Stück an: `Math.floor(BOX / max(Zeilen,
    Spalten)) - 1`). Lange Teile (z. B. I-Stück) ändern dadurch nicht mehr die Höhe
    des Panels, also kein Aufblähen von Bauleiste/Spielfeld mehr bei länglichen Teilen.
  - **Client-seitige Vorhersage für Gäste (Online)**: Platzieren, Kanone setzen und
    Drehen werden beim Gast jetzt sofort lokal angewendet (`placePiece`/`placeCannon`/
    `rotatePiece`) statt auf die Host-Bestätigung über Firebase zu warten — die nächste
    Stück-Vorschau erscheint ohne Round-Trip-Delay. Der autoritative Host-State
    überschreibt anschließend wie gewohnt (`applyState`), Diskrepanzen korrigieren
    sich selbst.
- **v3.5.4**: Fix — Vorschau-Delay auch lokal behoben.
  - **`placePiece()` löste keinen Re-Render aus**: `setGrid()` aktualisiert nur Refs
    (`grid.current`, `gridVersion.current`), kein React-State. `placeCannon()` rief
    danach bereits `setUiTick()` auf, `placePiece()` jedoch nicht — die neue
    Stück-Vorschau erschien erst beim nächsten zufälligen Re-Render (z. B. Timer-Tick,
    bis zu ~1s Verzögerung). Jetzt ruft `placePiece()` nach dem Platzieren ebenfalls
    `setUiTick()` auf — die nächste Vorschau erscheint sofort, lokal wie online.
- **v3.5.5**: Fix — wahre Ursache des Vorschau-"Delays" beim Drop gefunden.
  - **Drag-vs-Tap-Schwelle skalierte fälschlich mit der Canvas-Anzeigegröße**:
    `onPointerUp` klassifizierte Gesten als Tap (→ Drehen) statt Platzieren,
    wenn die Bewegung `< CELL * 1.5` in **internen Grid-Pixeln** war. Da diese
    aus den CSS-Pixeln über `toCanvas()` (Skalierung `viewSize.w / W`) berechnet
    werden, musste man bei größerer Canvas-Anzeige (z. B. nach der UX-Vergrößerung
    in v3.5.2) physisch deutlich weiter ziehen, damit ein Drop überhaupt als
    Platzierung erkannt wurde — sonst drehte sich nur das Stück, ohne Fehlermeldung,
    und der Spieler musste erneut ziehen → gefühltes "Delay".
  - **Fix**: Die Klassifizierung nutzt jetzt die tatsächliche Bildschirmbewegung
    (`e.clientX/clientY` ggü. `startCX/startCY`, feste Schwelle `14px`), unabhängig
    von Canvas-Auflösung oder Zoom. Platzieren reagiert dadurch beim ersten
    Loslassen zuverlässig und ohne gefühlte Verzögerung.
- **v3.5.6**: Feature — Timer-Verkürzung jetzt auch in der Kanonen-Setzphase.
  - Beim initialen Kanonen-Setup (Setup-Phase) wurde der Timer schon bisher auf
    3s verkürzt, sobald alle Spieler ihr Budget verbraucht hatten (`placeCannon()`).
    Diese Logik galt aber nicht für die spätere **Kanone-setzen-Phase** (`cannon`,
    +1 Kanone pro Runde) — dort musste der volle 12s-Timer ablaufen, selbst wenn
    alle bereits fertig platziert hatten.
  - Fix: Die Bedingung in `placeCannon()` prüft jetzt zusätzlich auf
    `phase_r.current === "cannon"`, sodass auch dort der Timer auf 3s springt,
    sobald `cannonBudget` aller Spieler aufgebraucht ist.
- **v3.6.0**: Feature — Matchmaking ("Schnellspiel") für 2-Spieler-Online.
  - Neuer Button "⚡ Schnellspiel" im Online-Menü, neben den bestehenden
    Optionen Code erstellen/beitreten (bleiben erhalten). Spieler tritt einer
    Warteschlange bei (`/queue2/{SESSION_ID}`) statt aktiv einen Code zu
    teilen.
  - Matching erfolgt **ELO-nah mit wachsendem Suchradius** (Basis ±60,
    +18/Sekunde Wartezeit) — kurze Wartezeit garantiert, ohne grobe
    ELO-Fehlpaarungen am Anfang.
  - Komplett ohne Cloud Functions (Spark-Plan-konform): atomares Claiming per
    Firebase-Transaktion, `onDisconnect().remove()` für sofortige Aufräumung
    bei Verbindungsabbruch, Heartbeat-basierte Stale-Erkennung und
    Selbstheilung bei abgebrochenem Matching-Versuch. Details siehe Abschnitt
    8 ("Matchmaking").
  - Siehe `index.html`: `startMatchmaking()`, `mmTryFindMatch()`,
    `mmClaimAndMatch()`, `mmBecomeHost()`, `mmJoinMatchedGame()`.
  - Firebase Security Rules um `queue2`-Knoten ergänzt (gleiches offenes
    Schema wie `games`, mit Feld-Validierung für `ts`/`status`/`elo` etc.).
- **v3.6.1**: Fix — Warte-Icon im Matchmaking-Screen.
  - Das Lupen-Emoji nutzte versehentlich die `sl`-Keyframe-Animation der
    Splash-Screen-Ladebalken (`translateX(-100%) → translateX(390%)`) — dafür
    gedacht, einen schmalen Balken über seine eigene Breite zu bewegen, nicht
    ein Emoji über den ganzen Bildschirm.
  - Neue `jesterdance`-Keyframe-Animation (Hoch-Tief-Wippen + Rotation in
    Schleife) + Hofnarr-Emoji (🤡) ersetzt die Lupe als Warte-Symbol.
- **v3.6.2**: Fix — Matchmaking matchte nicht zuverlässig (zwei Bugs).
  - Bug 1 (Firebase-Regeln): `.read: true` für `queue2` war nur auf
    Ticket-Ebene (`/queue2/{ticketId}`) gesetzt, nicht auf der Listen-Ebene
    selbst. `mmTryFindMatch()` muss aber die **ganze Liste** lesen
    (`onValue("queue2")`), um Kandidaten zu finden — das wurde von Firebase
    mit `permission_denied` abgelehnt, da keine Regel auf Listenebene
    existierte. Fix: `.read: true` jetzt zusätzlich auf `queue2`-Root-Ebene.
  - Bug 2 (Race-Condition beim Claiming): Wenn zwei wartende Clients sich
    gegenseitig als Match fanden, versuchten **beide gleichzeitig** den
    anderen zu claimen (`mmClaimAndMatch` transagiert nur das fremde
    Ticket, nicht das eigene). Beide Transaktionen liefen auf
    unterschiedlichen Pfaden und konnten beide erfolgreich committen —
    dadurch erstellten beide Seiten ein eigenes Spiel und überschrieben sich
    gegenseitig die `matched`-Markierung. Resultat: beide Clients wurden
    Host (gleicher Spieler/gleiche Rolle) und der jeweilige Gast trat dem
    falschen/keinem Spiel bei, wodurch `playerInfo` nie korrekt vom Host
    übertragen wurde und der Fallback-Name ("Spieler 1"/"Spieler 2") stehen
    blieb. Fix: deterministischer Tie-Breaker in `mmTryFindMatch()` — nur
    die Seite mit der lexikographisch kleineren `SESSION_ID` darf claimen.
- **v3.6.3**: Fix — Gast hing nach erfolgreichem Match dauerhaft in der
  Suche fest (Race-Condition bei der Ticket-Aufräumung).
  - `mmBecomeHost()` löschte bisher **beide** Queue2-Tickets (eigenes +
    Kandidat) nach einer fixen `MM_CLEANUP_DELAY_MS`-Verzögerung (8s),
    unabhängig davon, ob der Gast seinen "matched"-Status überhaupt schon
    gelesen hatte. Bei Netzwerklatenz konnte das Kandidat-Ticket gelöscht
    werden, bevor der Gast (via `queue2`-Subscription) je davon erfuhr —
    er sah dann nie `status: "matched"`, blieb in `mmActive` stecken und
    hatte kein Ticket mehr, über das ein erneuter Versuch möglich gewesen
    wäre.
  - Fix: Aufräumung ist jetzt ereignisgesteuert statt zeitbasiert.
    - Der Host löscht sein **eigenes** Ticket sofort in `mmBecomeHost()`
      (unkritisch, der Host braucht es nicht mehr).
    - Das **Kandidat-Ticket** (= Gast) wird erst gelöscht, wenn der Host
      den echten Beitritt über `guestAction2` bestätigt bekommt
      (`handleGuestAction`, Fall `type === "join"`, neuer Ref
      `mmPendingCandidateId`).
    - Der bestehende 15s-Watchdog (`MM_GUEST_JOIN_TIMEOUT_MS`) bleibt als
      Fallback: tritt der Gast nie bei (z. B. Ticket war ohnehin eine
      Karteileiche), wird das Kandidat-Ticket gelöscht und der Host kehrt
      automatisch in die Warteschlange zurück.
- **v3.7.1**: Feature — Matchmaking jetzt auch für **3 Spieler**.
  - Der "⚡ Schnellspiel"-Button respektiert nun die Spieleranzahl-Auswahl
    (2 oder 3) im Online-Menü; der Button-Text zeigt die gewählte Anzahl.
  - **Getrennte Queues**: 2-Spieler nutzt `/queue2`, 3-Spieler `/queue3` —
    so vermischen sich 2er- und 3er-Suchende nie. Die ELO-Werte stammen
    aus `profile.elo` (2p) bzw. `profile.elo3` (3p).
  - **Mehrfach-Claiming**: Bei 3 Spielern sammelt der Initiator `np-1 = 2`
    Gegner. `mmTryFindMatch()` wählt die zwei ELO-nächsten Kandidaten und
    initiiert nur, wenn die eigene `SESSION_ID` kleiner ist als die **aller**
    gewählten Kandidaten (genau ein Host pro kompatibler Gruppe).
  - **Atomares Claiming mit Rollback**: `mmClaimAndMatch()` claimt die
    Kandidaten nacheinander per Transaktion; schlägt ein Claim fehl (jemand
    war schneller), werden alle bereits geclaimten Tickets wieder auf
    `waiting` zurückgesetzt — kein hängender Halbzustand.
  - Rollen 2 und 3 werden den Kandidaten zugewiesen; jeder Gast tritt seinem
    Slot (`guestAction2`/`guestAction3`) bei. Der Host startet das Spiel erst,
    wenn **beide** Gäste beigetreten sind (bestehende `need`-Logik).
  - Ereignisgesteuerte Ticket-Aufräumung (aus v3.6.3) verallgemeinert:
    `mmPendingCandidates` hält jetzt pro Rolle den vollständigen Ticket-Pfad;
    jeder wird gelöscht, sobald der zugehörige Gast beigetreten ist. Der
    15s-Watchdog räumt verbliebene Tickets auf und re-queued mit gleicher
    Spieleranzahl.
  - Firebase Security Rules um `queue3`-Knoten ergänzt (identisches Schema
    wie `queue2`, inkl. Listen-`.read` für die Kandidatensuche).
  - **Anzeige-Timer** entkoppelt: eigener 1-Sekunden-Interval
    (`mmDisplayTimer`) aktualisiert Wartezeit und ELO-Radius im UI; der
    Firebase-Heartbeat-Takt (`MM_TICK_MS = 2s`) bleibt unverändert — kein
    2-Sekunden-Sprung mehr in der Zähleranzeige.
  - **ELO-Radius-Wachstum** verlangsamt: `MM_GROWTH_PER_SEC` von 18 auf 8
    reduziert (±60 Basis + 8/s; nach 60s Wartezeit ±540, nach ~2min
    unbegrenzt) — bevorzugt faire Paarungen statt sofortiger Weitwinkel-
    Matches.
- **v3.7.2**: Feature — Teilen-Button im Ergebnis-Screen.
  - Nach jeder Partie erscheint ein "🔗 Teilen"-Button unter dem Ergebnis.
  - Auf Mobile: Web Share API (nativer Share-Dialog mit App-Auswahl).
  - Auf Desktop: Fallback auf Clipboard-Copy (Text + URL).
  - Share-Text passt sich dem Ergebnis an (Sieg / Niederlage / Unentschieden).
  - Button zeigt kurz "✓ Geteilt!" nach dem Tippen, kehrt dann zurück.
- **v3.7.3**: UX — Online 2v2: P1 sieht sich immer unten.
  - P1 (Host) sieht seine Burg jetzt unten, P2 (Gegner) oben — identisch
    mit der Perspektive von P2.
  - Umsetzung: `ctx.translate(0,H); ctx.scale(1,-1)` im Render-Loop.
    Burg und Kanone erhalten lokalen Counter-Flip, damit sie aufrecht
    erscheinen. `ctx.fillText` wird per Monkey-Patch gegen-skaliert.
    Kanonen-Winkel wird negiert für korrekte Schussrichtung.
  - Pointer-Y wird invertiert (`y = H - rawY`).
  - `liftedGhost` hebt den Ghost in die korrekte Richtung (+LIFT_ROWS
    statt -LIFT_ROWS), Hilfs-Linie und ✓/✗ werden entsprechend gespiegelt.
- **v3.7.4**: Bugfix — Render-Loop-Absturz verhindert Quick-Match.
  - Render-Loop-Hauptteil in `try/finally` eingebettet: `pushState` und
    `requestAnimationFrame` laufen nun immer, auch wenn ein Rendering-Fehler
    auftritt. Ohne diesen Fix stoppte ein Fehler im Loop das komplette State-
    Pushing, sodass der Gast nie Spielzustand empfing und in der Queue blieb.
  - `delete ctx.fillText` durch `ctx.fillText = CanvasRenderingContext2D.prototype.fillText`
    ersetzt (sicherer, kein Abhängigkeit von Konfigurierbarkeit des Host-Objekts).
- **v3.7.5**: Bugfix — Berge in P1-Flipped-Ansicht zeigen nach oben.
  - Beim Rendern des Hintergrund-Canvas (`bgCanvas`) wird für P1 (Host, Online
    2v2) ein Pre-Flip angewendet: `bc.translate(0,H); bc.scale(1,-1)`.
  - Der globale Canvas-Flip des Haupt-Canvas "hebt" den Pre-Flip wieder auf,
    sodass Berge (und andere gerichtete Hintergrund-Elemente) für P1 aufrecht
    erscheinen und korrekt zur Spielfeld-Orientierung passen.
- **v3.7.6**: "Schnellspiel"/"Quick Match" → "Matchmaking" umbenannt.
  - DE: `"⚡ Schnellspiel ({n} Spieler)"` → `"⚡ Matchmaking ({n} Spieler)"`
  - EN: `"⚡ Quick Match ({n} Players)"` → `"⚡ Matchmaking ({n} Players)"`
- **v3.8.0**: Visual-Overhaul — Dark Glassmorphism & Icon-System.
  - Neues Theme: tiefes Navy/Indigo statt Grün, Glas-Panels (backdrop-blur),
    Neon-Akzente (Cyan/Violett/Blau). CSS-Variablen in `:root`.
  - **Icon-System** (`Icon`-Komponente + `ICON_PATHS`): saubere Lucide-Strich-SVGs
    als React-Inline-Komponente — ersetzt Deko-Emojis in der gesamten UI
    (Menü, Online-Overlay, HUD, Phasen-Banner, Ergebnis-Screen, Quit-Dialog).
  - Haupt-Buttons (LOKAL/ONLINE/Matchmaking/Erstellen/Beitreten) mit Icon +
    Gradient + Neon-Glow. Spieler-HUD-Panels auf Glassmorphism mit Spielerfarben
    (P1 Blau, P2 Rot, P3 Grün).
  - Canvas: Wandfarben an Neon-Palette angeglichen, Terrain kühler/cinematischer,
    Fluss mit Cyan-Glow. Phasen-Banner zeigt großes Icon statt Emoji.
  - Emoji-Präfixe aus i18n-Strings entfernt (Tipps, Warnungen, Buttons).
    Saubere Glyphen (✕ ← ✓ ♔♚♜) bleiben erhalten.
  - Test: alle 87 Checks grün (Button-Texte unverändert → keine Test-Brüche).
- **v3.8.1**: Kanonen-HP von 10 auf 15 erhöht.
  - `CANNON_HP = 15` — eine Kanone hält jetzt 15 direkte Treffer aus, bevor
    sie zerstört wird (vorher 10). HP-Balken skaliert automatisch.
- **v3.9.0**: Canvas-Grafik-Overhaul — moderne Neon-Spielfeld-Optik.
  - **Terrain**: tiefer Navy/Teal-Untergrund mit Lichtfeld von oben, Tech-Punktraster,
    leuchtende Cyan-Flüsse (Glow + Uferschimmer), kristalline Berge mit Neon-Kantenlicht,
    kühle Ambient-Partikel, stärkere Vignette (vorher Gras-Grün).
  - **Mauern** (`drawWall`): schlanke beveled Neon-Tech-Blöcke — Glas-Gradient,
    durchgehende Neon-Oberkante, Glanz-Highlight, Tiefen-Fase (vorher Backstein-Mörtel).
  - **Kanonen** (`drawCannonFull`): Gunmetal-Geschütztürme mit Neon-Ring um die Basis,
    glühende Mündung, Energiekern, pulsierender Ready-Glow, Neon-Wimpel (vorher flacher Kreis).
  - **Festung** (`drawCastle`): schlanker dunkler Keep mit Neon-Dächern/Zinnen,
    leuchtendem Wappen-Kern (Krone) und Neon-Tor (vorher Cartoon-Stein).
  - **Schutt** (`drawRubble`): gebrochene Splitter mit glimmender Glut.
  - **Geschosse**: leuchtende Energie-Orbs in Spielerfarbe (Blau/Rot/Grün) mit Glow.
  - Spielmechanik unverändert; alle 87 Tests grün.
- **v3.9.1**: Fantasy-Avatar-System — 12 individuelle SVG-Charaktere ersetzen Emojis.
  - `WAPPEN_SVG`: Objekt mit 12 einzigartigen Charakteren als inline-SVG (40×40 viewBox):
    `vampir` (Vampirlord), `pestdoc` (Pestdoktor), `eismagie` (Eismagierin),
    `schatten` (Schattenjäger), `sternmage` (Sternenzauberer), `golem` (Eisengolem),
    `seehexe` (Seehexe), `feuergeist` (Feuergeist), `totenmage` (Totenmagier),
    `sturmreiter` (Sturmreiter), `golddrache` (Golddrache), `phoenix` (Phönix).
  - `WAPPEN = Object.keys(WAPPEN_SVG)` — Array der IDs (strings, rückwärtskompatibel).
  - `WAPPEN_SRC`: precomputed data-URIs (`data:image/svg+xml,...`) für alle 12 Avatare.
  - `WappenAvatar({ id, size })`: React-Komponente, rendert Avatar als `<img>` mit data-URI.
    Fallback auf `vampir` wenn ID unbekannt (Rückwärtskompatibilität mit alten Profilen).
  - Render-Stellen aktualisiert: Profilkarte, Profil-Editor-Buttons, Rangliste,
    P1/P2/P3-Anzeigetafel im Spiel — alle nutzen jetzt `WappenAvatar`.
  - Spielmechanik unverändert; alle 87 Tests grün.
- **v3.10.0**: XP- und Level-System eingeführt.
  - **XP-Gewinn** (nur Online-Spiele): Niederlage +10 XP, Sieg +25 XP Basis.
    ELO-Bonus bei Sieg: +0–5 XP (schwächerer Gegner), +10 XP (gleich stark),
    +15–20 XP (stärkerer Gegner, ab +100 ELO-Differenz). Max. +20 Bonus.
  - **Level-Formel**: XP bis nächstes Level = 100 + (Level × 25).
    Level 1→2: 125 XP, Level 5→6: 225 XP, Level 10→11: 350 XP.
    Unbegrenzte Level; Start: Level 1, 0 XP.
  - **Neue Hilfsfunktionen**: `xpToNextLevel(level)`, `computeXpGain(won, myElo, opponentElos)`,
    `applyXpGain(prof, xpGained)` → gibt `{level, xp, levelsGained}`.
  - **Profil-Erweiterung**: `level`, `xp`, `unlockedRewards` in localStorage + Firebase.
    `unlockedRewards: []` als Basis-Architektur für spätere freischaltbare Inhalte.
  - **`xpChangeRef`**: neuer Ref (analog `eloChangeRef`/`goldChangeRef`).
    Inhalt: `{ oldLevel, newLevel, oldXp, newXp, xpGained, levelsGained }`.
  - **UI-Komponenten**:
    - `XpBarUI({ level, xp })`: statische XP-Leiste (violett→cyan Gradient, 5px Höhe)
      — in Profilkarte unterhalb Gold-Anzeige.
    - `XpResultAnim({ xpChange })`: animierter XP-Reward-Screen auf Ergebnis-Bildschirm
      — XP-Zahl hochzählen (easeOutCubic, bis 2,2s), Leiste füllt sich, Glow-Animation.
      Bei Level-Up: "★ LEVEL UP! ★" Badge mit `lvlUpFlash`-Animation (0,55s spring).
  - **CSS-Keyframes**: `lvlUpFlash`, `xpBarGlow`, `xpNumPop`.
  - **Ergebnis-Bildschirm**: XpResultAnim erscheint nach Gold-Block (nur Online, wenn xpChangeRef gesetzt).
  - Spielmechanik unverändert; alle 87 Tests grün.
- **v3.10.1**: Matchmaking-Icon: 🤡-Emoji durch neon-cyan Radar/Crosshair-SVG ersetzt.
  - `@keyframes jesterdance` entfernt, ersetzt durch `@keyframes radarSpin` (360°-Rotation, 3s linear).
  - Matchmaking-Wartescreen zeigt jetzt rotierendes `target`-Icon (Lucide, 48px, #22d3ee)
    mit Drop-Shadow-Glow statt clown-Emoji.

### v3.11.0 — Langzeit-Progressionssystem
- **LevelBadge**: Tier-farbige Level-Anzeige neben Avatar (Silber L1-9, Gold L10-24, Platin L25-49, Legendär L50+)
- **getLevelTier()**: Hilfsfunktion für Tier-Farben und Glow-Effekte
- **ConfettiBurst**: CSS-Konfetti-Animation bei Level-Up (20 Partikel, deterministische Timings)
- **XpResultAnim**: Konfetti + "Nächste Belohnung"-Vorschau nach Level-Up
- **AVATAR_UNLOCKS**: 4 Basis-Avatare gratis, 8 weitere ab Level 5/10/15/20/25/30/40/50
- **DailyRewardModal**: Tägliche Belohnung mit 7-Tage-Streak-Kalender (Tag 1–7: 25/35/50/75/100/150/200G, Tag 7 +50XP + Legendäre Kiste)
- **Profil-Karte**: LevelBadge auf Avatar-Overlay, Win-Rate-Anzeige, Peak-ELO-Zeile, Tages-Belohnung-Button mit Glow
- **Avatar-Editor**: Gesperrte Avatare ausgegraut mit Schloss-Symbol und Level-Anforderung
- **Peak ELO**: Tracking in `recordResult`, gespeichert in `peakElo`/`peakElo3`, im Leaderboard
- **Neue CSS-Keyframes**: `confettiFall`, `dailyBounceIn`, `badgePop`, `streakGlow`, `collectBounce`
- **localStorage**: Neuer Key `fortress_daily` für Streak-System; Profil erweitert um `peakElo`, `peakElo3`, `achievements[]`, `dailyTasks[]`, `seasonXp`
- **Architektur-Vorbereitung**: Datenstrukturen für Achievements, Daily Tasks, Season-System, Social Features (Kommentare im Code)
- **i18n**: Neue Strings für Tier-Labels, Daily Reward, Win-Rate, Peak ELO, Avatar-Lock-Hinweise

### v3.11.1 — Ergebnis-Bildschirm iPhone-Fix
- **Problem**: Ergebnis-Bildschirm wurde auf iPhone 15 (390×844) am unteren Rand abgeschnitten.
- **Fix**: ~120px Gesamt-Höhe reduziert:
  - Äußeres Padding auf 14px/20px reduziert + `overflowY: auto` hinzugefügt
  - Trophy-Icon auf 44px verkleinert
  - Score-Margin auf 10px reduziert
  - Alle Abstände kompaktiert

### v3.11.2 — XP-Animation Infinite-Loop-Fix
- **Problem**: `XpResultAnim`-Komponente ging in eine Endlosschleife, weil sie innerhalb von `FortressApp` definiert ist — jedes Re-Render von `FortressApp` erzeugt eine neue Funktionsreferenz → React unmountet/remountet die Komponente → `setInterval` startet neu.
- **Root Cause**: Online-Spiele → Firebase-Push → `applyState` → `setUiTick(t=>t+1)` → FortressApp Re-Render → Loop.
- **Fix**: `setInterval`-basierte Animation durch CSS-Transition ersetzt. `useState(started)` togglet nach 350ms → Balken animiert via `transition: "width 1s cubic-bezier(0.34,1.1,0.64,1)"`. Kein laufendes Interval → immun gegen Remounting.

### v3.11.3 — DailyRewardModal Bug-Fix + Test-Erweiterung
- **Bug-Fix**: `DailyRewardModal` zeigte nach dem Abholen kurz den Countdown statt "✓ Abgeholt".
  - **Root Cause**: Gleicher Remount-Mechanismus wie v3.11.2 — `collected`-State in der Komponente wurde bei FortressApp-Re-Render (durch `setDailyState`/`saveProfile`) zurückgesetzt.
  - **Fix**: `collected`-State in `FortressApp` gehoben als `dailyCollected`. `DailyRewardModal` erhält es als Prop. `handleDailyCollect` setzt `setDailyCollected(true)` synchron, schließt Modal nach 1400ms.
### v3.11.4 — Daily Reward: Kalender-Tag-Check + Neues Profil Fix
- **Bug 1 (24h-Sperre zu streng)**: `getDailyCollectable` prüfte striktes 24h-Fenster (`Date.now() - lastCollect >= 86400000`). Wer um 22 Uhr sammelte, bekam erst am nächsten Tag um 22 Uhr wieder etwas — nicht intuitiv.
  - **Fix**: Kalender-Tag-Check: `lastCollect.date < heute`. Einmal pro Kalendertag abholbar. Neue Hilfsfunktion `msTillMidnight()` berechnet Zeit bis Mitternacht für den Countdown im Modal.
- **Bug 2 (neues Profil)**: `useEffect([], [])` lief beim ersten Mount, wenn `profile = null` (neues Konto / Profil-Editor offen). Early-Return → 1200ms-Timer nie gestartet. Nach Profil-Erstellung ändert sich `profile`, aber leerer Deps-Array verhinderte Re-Run → Modal erschien nie automatisch.
  - **Fix**: `profile?.id` als Dependency. Effekt läuft wenn Profil von `null` auf einen Wert wechselt.

- **Test-Erweiterung** (`test_fortress.js`):
  - `PROFILE_INIT` aktualisiert: alle neuen Felder (level, xp, peakElo, peakElo3, unlockedRewards, achievements, dailyTasks, seasonXp). `fortress_daily` mit aktuellem Timestamp → verhindert Auto-Show in unrelated Tests.
  - Neue Suite `suiteProgression`: 14 Tests für LevelBadge, XP-Leiste, Win-Rate %, ELO-Anzeige, CSS-Keyframes, Tages-Belohnungs-Button, Modal-Kalender, Abhol-Flow, Gold-Update, Streak-Persistenz, gesperrte Avatare, Basis-Avatare frei, Level-Overlay.

### v3.11.5 — Match-End-Screen Redesign
- **Visuelles Redesign** des Ergebnis-Bildschirms (Clash Royale / Brawl Stars Stil):
  - **Hintergrund**: Dunkles radial-gradient (`#180f30 → #06080f`) statt flachem Dunkelblau
  - **Online-Chip**: Zeigt jetzt Spieler-Avatar (15px `WappenAvatar`) + Spielername statt "Rotes Königreich"
  - **Pokal**: 70px Icon (von 44px), goldener Radial-Glow-Halo dahinter (180×90px, `rgba(251,191,36,0.32)`, blur 8px)
  - **Siegestext**: 30px, fontWeight 900, starker textShadow (von 24px/800)
  - **Score-Box**: Inline-flex mit glühenden Spielerfarben (60a5fa/f87171/34d399 + textShadow je Farbe)
  - **Einheitliche Karten-Fabrik `card(r,g,b)`**: Gleiche borderRadius (14), padding (11px 18px), boxShadow für ELO / Gold / XP
  - **ELO-Karte**: Grün bei Gewinn (`card(74,222,128)`), Rot bei Verlust (`card(239,68,68)`). Alte ELO 20px grau → neue ELO 28px farbig + Delta-Pill mit Hintergrund
  - **Gold-Karte**: `card(251,191,36)`, gleiche Struktur, Gold-Zahl 28px
  - **XP-Karte**: `XpResultAnim` angepasst — Card-Style vereinheitlicht (borderRadius 14, padding 11px 18px, boxShadow), XP-Zahl 28px (von 20px), Fortschrittsbalken 10px (von 9px)
  - **Button-Hierarchie**: Primär (gradient, 15px padding, 16px font) → Sekundär (ghost) → Tertiär (transparent text); Gast: Status-Info-Box + Ghost "Hauptmenü"
  - **Teilen-Button**: Tertiäre Ghost-Variante (kleiner, dezenter)
  - **Abstandsreduzierung**: gap: 8 zwischen Karten (von separaten marginTop/marginBottom)
- **Bugfix**: Doppelter Ergebnis-Block entfernt — alter `if (screen === "result")` Block war nach dem Redesign unreachable aber strukturell vorhanden → JS-Syntaxfehler (`Unexpected token '}'`). Alter Block (137 Zeilen) vollständig entfernt.

### v3.11.6 — Avatar-Redesign: Neue Charaktere + Profil-Editor Redesign
- **12 neue Avatare** mit deutschen Namen ersetzen die alten Fantasy-Avatare:
  - Frei (Level 1): SKELETT (lila Schädel), WALDHÜTER (grüner Waldgeist), EISMAGIER (Schneeflocke), ROBOTER (orange Augen)
  - Level 5: HEXERIN, Level 10: KANONE, Level 15: FRANKENSTEIN, Level 20: FEUERSCHÄDEL
  - Level 25: PESTDOKTOR, Level 30: BLITZ, Level 40: TROJANISCHES PFERD, Level 50: PHÖNIX
- **Neue SVG-Artwork**: Jeder Avatar hat 3-lagige farbige Glow-Ringe (äußerer Glow/mittlerer Ring/scharfer Ring), kreisförmig statt eckig
- **`WappenAvatar`**: `borderRadius: 6` → `borderRadius: '50%'` (kreisrund)
- **`WAPPEN_GLOW`**: Neue Konstante — Avatar-Key → Glow-Farbe (für Profil-Editor Auswahl-Ringe)
- **`WAPPEN_MIGRATION`**: Migriert alte Keys (vampir/pestdoc/eismagie/schatten/...) automatisch auf neue Keys beim Profilladen
- **Profil-Editor Avatar-Grid** redesigned: Zwei Sektionen
  - **AKTIVE AVATARE**: Freigeschaltete Avatare mit farbigem Glow-Ring (WAPPEN_GLOW); ausgewählter Avatar leuchtet mit weißem Ring + verstärktem Glow
  - **GESPERRTE AVATARE**: Graustufige, abgedunkelte Avatare mit Schloss-Emoji 🔒 und Level-Anforderung
- **Fallback-Wappen**: `"vampir"` → `"skelett"` in HUD, Leaderboard, Ergebnis-Screen

### v3.11.7 — Tages-Belohnung, CSS-Keyframes, LevelBadge & Win-Rate
- **Tages-Belohnungs-System**: `DailyRewardModal`-Komponente jetzt vollständig eingebunden:
  - `DAILY_REWARDS` (7 Einträge: Tag 1–7, letzter Tag = 50G + Sonderkiste)
  - Hilfsfunktionen: `getDailyCollectable()`, `getDailyStreakIndex()`, `msTillMidnight()`
  - Tages-Belohnungs-Button im Menü (sichtbar wenn heute noch nicht abgeholt, `streakGlow`-Animation)
  - Modal zeigt Streak-Kalender T1–T7, Goldbelohnung, "Abholen!"-Button
  - Abholen erhöht Gold im Profil und speichert Streak in `fortress_daily` localStorage
  - Modal schließt sich automatisch nach "✓ Abgeholt"-Bestätigung (1.4s Delay)
- **CSS-Keyframes** in `<style>`-Block hinzugefügt (zuvor nur referenziert, nie definiert):
  - `confettiFall`, `badgePop`, `streakGlow`, `dailyBounceIn`, `collectBounce`
- **LevelBadge** wird jetzt im Menü-Profil-Bereich neben der XP-Leiste angezeigt ("L1")
- **Win-Rate** im Menü sichtbar: Prozentzahl (Siege / Spiele) in der Stats-Zeile
- **Übersetzungen** ergänzt (de + en): `lockedAt`, `dailyTitle`, `dailyStreak`, `dailyCollect`, `dailyCollected`, `dailyNextIn`, `dailyChest`, `nextRewardAt`
- **Tests**: `suiteProgression` nun vollständig grün (114 ✅ 0 ❌)
  - `hasWappenLabel`-Check auf `/WAPPEN|AVATARE/i` erweitert

### v3.11.8 — Avatar-Grafiken überarbeitet
- **Alle 12 WAPPEN_SVG-Einträge** neu gestaltet, um dem Referenzbild besser zu entsprechen:
  - `skelett`: Dunkle Kapuze/Robe hinter dem Totenkopf (Sensenmann-Stil)
  - `waldhueter`: Verbesserte Blattdetails, Pupillenreflex in den Bernsteinaugen
  - `roboter`: Antenne oben, klar rechteckiger Kopf mit Ohrplatten
  - `hexerin`: Spitzer Hexenhut + Totenkopf-Gesicht mit lila Augen + Zähnen
  - `kanone`: Einzelnes großes zentrales Orange-Auge, deutlichere Roboterrahmung
  - `frankenstein`: Flacher Kopf, größere gelb-grüne Halsschrauben, Strichlinie als Naht
  - `feuerschaedel`: Dramatischere geschichtete Flammen (rot → orange → gelb)
  - `pestdoktor`: Dunkle Kapuze + grüne Leuchtbrillen + **langer Schnabelmasken-Keil** (Hauptmerkmal)
  - `blitz`: Dunklerer Hintergrundschein, zusätzliche Entladungslinien
  - `trojanischespferd`: Verbesserte Pferdeaugen, Nasenlöcher-Details
  - `phoenix`: Flügelstruktur und Federn überarbeitet

### v3.11.9 — Avatar-Icons aus Referenzbild extrahiert (verbessert)
- **9 Icons** aus neuer Referenzdatei (bereinigtes UI-Mockup) extrahiert: saubere Kreise ohne Label-Text, korrekte Zentrierung mit Neon-Glow-Ring
  - `skelett`, `waldhueter`, `eismagier`, `roboter`, `hexerin`, `kanone`, `frankenstein`, `feuerschaedel`, `phoenix`
- **3 Icons** aus originaler Referenzdatei extrahiert (nicht im neuen Bild enthalten):
  - `pestdoktor`, `blitz`, `trojanischespferd` — `cy=360`, `R=82`, kein Label-Text-Überlapp
- **WAPPEN_SRC** komplett aktualisiert: alle 12 PNG-Data-URIs aus echten Referenzbildern (keine SVG-Nachbauten mehr)
- Alle Icons 96×96px RGBA PNG mit Kreismaske, LANCZOS-Resampling

### v3.11.10 — Avatar-Anzeige vergrößert
- **Hauptmenü Profilkarte**: Avatar von 28px → 72px, kreisförmig mit Neon-Glow (`box-shadow` in Spieler-Farbe), Hintergrundbox entfernt
- **Profil-Editor Avatar-Picker**: Freie und gesperrte Icons von 48px → 64px

### v3.11.11 — Profil-Editor Komplett-Redesign (Premium Mobile Game Style)
- **Header-Karte**: Avatar 96px, Name-Input inline, LevelBadge groß, Tier-Label, XP-Fortschrittsbalken mit animiertem Glow
- **Avatar-Galerie**: Glasmorphismus-Karte mit Sektion "AVATAR GALERIE" (freie Icons) und "GESPERRT" (gesperrte Icons)
  - Ausgewählter Avatar: `scale(1.12)` + weiß-neon Doppel-Glow-Ring
  - Gesperrte Avatare: gedimmt (opacity 0.35) + 🔒-Overlay mit Level-Anforderung ("L5", "L10" etc.)
  - Nächster freischaltbarer Avatar: Motivations-Banner mit Wappen-Vorschau und Level-Abstand
- **Farb-Picker**: Neon-Farbkugeln mit radialen Gradienten und Glow-Effekt bei Auswahl
- **Buttons**: Speichern mit Neon-Lila→Cyan-Gradient, Abbrechen transparent mit gedämpftem Text
- **Design**: Dunkles Glasmorphismus-Layout (wie Brawl Stars / Clash Royale), border-radius:16px Karten

### v3.11.12 — XP-Migrationsfix für Altdaten
- **Bug**: Spieler mit vor v3.11.0 gespielten Online-Spielen hatten `level: 1, xp: 0` obwohl ELO/Stats korrekt gespeichert waren
- **Fix**: Einmalige retroaktive XP-Migration in `loadProfile()`: bei `level===1`, `xp===0`, `games>0` und fehlendem `historicalXpApplied`-Flag wird geschätztes XP berechnet (30 XP pro Sieg, 10 XP pro Niederlage für 2-Spieler + 3-Spieler-Spiele) und via `applyXpGain()` angewendet (inkl. Level-Ups)
- **Persistenz**: `historicalXpApplied: true` wird in `fortress_profile` gespeichert — Migration läuft nur einmal
- **saveProfileEditor**: `historicalXpApplied`-Flag wird beim Speichern des Profil-Editors erhalten

### v3.11.13 — XP-Leiste: "LVL X"-Label entfernt
- **Bug**: Im Hauptmenü stand neben dem LevelBadge ("L1") zusätzlich "LVL 1" im XpBarUI — wirkte wie zwei Zahlen nebeneinander ("1 ... 98")
- **Fix**: "LVL X"-Label aus `XpBarUI` entfernt; nur noch "X / Y XP" rechts angezeigt — LevelBadge zeigt das Level bereits

### v3.11.14 — In-Game-Erklärungstext unten entfernt
- **Änderung**: Hilfstexte (`tipCannon`, `tipSetup`, `tipShoot`) am unteren Spielfeldrand entfernt — mehr Platz für das Spielfeld

### v3.11.15 — Profil-Editor: Farbauswahl entfernt, Layout kompakter
- **Farbauswahl entfernt**: Karte "🎨 FARBE" komplett entfernt — Avatar gibt visuelle Unterscheidung
- **Kompakter**: Avatar im Header 96→72px, Avatare in Galerie 64→52px, Abstände reduziert — Editor passt auf einen Screen ohne Scrollen

### v3.11.16 — Achievement-System implementiert
- **GameEventBus**: Leichtgewichtiger In-App-Event-Bus (`createEventBus`) für lose Kopplung zwischen Spiellogik und Progressionssystem
- **GAME_EVENTS**: Konstanten für `GAME_PLAYED`, `GAME_WON`, `BLOCK_DESTROYED`, `GOLD_EARNED`, `ELO_CHANGED`, `WIN_STREAK_CHANGED`
- **ACHIEVEMENTS**: 20 Achievements in 6 Kategorien (Siege, Spiele, Zerstörung, Gold, ELO, Serien) mit XP- und Gold-Belohnungen
- **processAchievementEvents()**: Pure-Funktion nimmt aktualisiertes Profil + Event-Array, gibt neue Achievement-Liste + neu freigeschaltete Achievements + XP/Gold-Gewinne zurück
- **recordResult()**: Integration des Achievement-Systems — nach jedem Online-Spiel werden passende Events ausgelöst, Achievements verarbeitet, XP/Gold für neue Achievements vergeben
- **Blockverfolgung**: `blocksDestroyedThisGameRef` zählt zerstörte feindliche Blöcke pro Spiel (in `impactAt()`), summiert in `recordResult()` zu `profile.blocksDestroyed`
- **Win-Streak**: `profile.winStreak` wird bei Sieg erhöht, bei Niederlage auf 0 gesetzt
- **Lifetime-Gold**: `profile.lifetimeGold` akkumuliert über alle Spiele (für Gold-Achievements)
- **AchievementPopup**: Floating Toast am unteren Bildschirmrand (3,7s Anzeigedauer, Fade-In/Out) — zeigt Icon, Titel, XP- und Gold-Gewinn
- **Achievement-Queue**: `achievementQueue`-State verhindert überlappende Popups — Achievements werden nacheinander angezeigt
- **Profil-Editor**: Achievement-Grid (4 Spalten) im Profil-Editor mit Fortschrittsbalken für gesperrte und ✓-Badge für freigeschaltete Achievements
- **Neue Profilfelder**: `winStreak`, `blocksDestroyed`, `lifetimeGold` in `loadProfile()` und `saveProfileEditor()` persistent

### v3.11.17 — Achievements als eigenes Menü
- **Eigener Achievement-Button**: Neuer Trophäen-Button (🏆) direkt unter dem Profil-Bearbeiten-Button im Profilbereich des Hauptmenüs
- **Badge-Counter**: Zeigt Anzahl freigeschalteter Achievements als goldenes Badge auf dem Trophäen-Button; Button wird golden hervorgehoben wenn Achievements vorhanden
- **AchievementsModal**: Vollbild-Overlay mit allen 20 Achievements, gegliedert nach 6 Kategorien (Siege/Spiele/Zerstörung/Gold/ELO/Serien)
- **Belohnungsanzeige**: Jedes Achievement zeigt explizit die Belohnung (+XP und/oder +Gold) als farbige Chips (lila für XP, gold für Gold)
- **Fortschrittsbalken**: Für noch nicht freigeschaltete Achievements: Fortschrittsbalken mit X/Ziel-Anzeige und Prozentangabe
- **Kategorie-Farbcodierung**: Jede Kategorie hat eine eigene Akzentfarbe (rot/blau/orange/gold/lila/grün)
- **Profil-Editor bereinigt**: Achievement-Grid aus dem Profil-Editor entfernt (jetzt dediziertes Modal)

### v3.11.18 — Rückwirkende Achievement-Freischaltung
- **Retro-Migration beim Laden**: Beim ersten Öffnen nach Update werden alle Achievements einmalig rückwirkend geprüft und freigeschaltet, falls die aktuellen Profilwerte (Siege, Spiele, Gold, ELO, Blocks) die Bedingungen erfüllen
- **Flag `achievementsRetroApplied`**: Verhindert wiederholtes Ausführen der Migration — läuft exakt einmal pro Profil
- **XP+Gold für retro Achievements**: Bereits beim Laden werden XP und Gold für rückwirkend freigeschaltete Achievements gutgeschrieben

### v3.11.19 — Matchmaking Self-Match-Bug behoben
- **Root Cause**: `SESSION_ID` ist pro Tab/Page-Load zufällig generiert — zwei Tabs des gleichen Spielers (oder ein nicht bereinigtes altes Ticket nach Absturz/Reload) hatten unterschiedliche `SESSION_ID`s aber identische Spieler-Identität; der bisherige Self-Filter (`id === SESSION_ID`) hat das nicht erkannt
- **Fix 1**: `pid` (Spieler-Profil-ID aus `fortress_profile`) wird jetzt ins Matchmaking-Ticket geschrieben
- **Fix 2**: In `mmTryFindMatch()` werden Kandidaten mit identischer `pid` gefiltert — verhindert Match mit eigenem alten Tab/Session
- **Fix 3**: Beim Start von Matchmaking werden alle eigenen alten Queue-Einträge (gleiche `pid`, anderer Session-Key) aus Firebase gelöscht — bereinigt Zombie-Tickets von abgestürzten Tabs

### v3.11.20 — Bauphase Letzte-5-Sekunden-Warnung
- **Build-Urgency-Overlay**: Zeigt in den letzten 5 Sekunden der Bauphase ein pulsierendes rotes Overlay an ("⚠️ BURG OFFEN — Schließe deine Mauern!"), wenn die eigene Burg noch nicht vollständig ummauert ist
- **Countdown**: Overlay zeigt die verbleibenden Sekunden in Echtzeit
- **Nur wenn nötig**: Overlay verschwindet sofort wenn die Burg geschlossen wird
- **Online-Modus**: Prüft nur die eigene Burg (nicht die der Gegner)
- **Lokal-Modus**: Prüft alle Spieler — bei mehreren offenen Burgen wird "Offen: P1, P2" angezeigt
- **CSS-Animation**: `urgencyPulse` — Glow-Puls zwischen 0.88 und 1.0 Opazität im 0.45s-Takt

### v3.11.21 — Build-Warnung in HUD verlegt (kein Blocking)
- **Fix**: Warnung nicht mehr als fixes Overlay am unteren Bildschirmrand (hat Spielfläche verdeckt)
- **Neu**: Kompakte Warnung direkt im HUD-Timer-Bereich — erscheint zwischen Countdown und Beenden-Button, blockiert keine Spielfläche
- **Format**: "⚠️ Burg offen!" (pulsiert via `urgencyPulse`) — bei lokal mehreren offenen Burgen: "⚠️ P1+P2 Burg offen!"

### v3.11.22 — Build-Warnung als Spielfeld-Glow (game-industry-standard)
- **Design**: Pulsierender roter Glow-Rahmen um das Spielfeld (wie FPS Low-Health-Vignette, Minecraft-Damage-Flash usw.) — kein Overlay, kein Text, kein Blocking
- **Keyframe `dangerGlow`**: 0.6s Puls — Canvas-Border wechselt von rgba(239,68,68,0.25) zu 0.85 Opazität + 50px roter Außenglow
- **Canvas-Border** wechselt gleichzeitig von weiß (0.07) zu rot (0.5) für verstärkten Kontrast
- **Bedingung**: Bauphase, ≤5 Sek., eigene Burg (online) bzw. irgendeine Burg (lokal) noch nicht geschlossen
- **Endet sofort** wenn Burg geschlossen wird (reaktiv auf Grid-Änderungen via getFloodCache)
- HUD-Text-Warnung aus v3.11.21 entfernt (Canvas-Glow reicht)

### v3.11.23 — Timing-Anpassungen
- **Burg-Warnung**: Schwellwert von 5 auf 8 Sekunden erhöht (mehr Vorwarnzeit)
- **Schussrunde**: `SHOOT_TIME` von 30 auf 25 Sekunden reduziert (strafferes Gameplay)

### v3.11.28 — Online-Warn Fix: Benachrichtigungen nur beim richtigen Spieler
- **Bug**: "Keine schussbereite Kanone"-Warnung erschien beim Host, auch wenn ein Gast schoss
- **Root Cause**: Host führt `fireMortar()` für alle Spieler aus (autoritäre Architektur) — `showWarn()` zeigte immer auf dem Host-Screen
- **Fix 1 (primär)**: Gast prüft Kanonenbereitschaft lokal aus `frozenReady` bevor er `fire`-Action sendet — Warnung erscheint direkt beim Gast, Action wird gar nicht erst verschickt
- **Fix 2 (defense-in-depth)**: In `fireMortar` — Warnung nur zeigen wenn `!online || player === myRole.current` (kein fremder Spieler)
- Andere `showWarn`-Aufrufe (Burg geöffnet, Spieler ausgeschieden, Kanone zerstört) sind globale Infos und bleiben für alle Spieler sichtbar

### v3.11.27 — Matchmaking-Fix: Name+Wappen-Filter entfernt (zu aggressiv)
- **Root Cause v3.11.24-Regression**: Name+Wappen-Vergleich im Zombie-Cleanup löschte Tickets ANDERER Spieler — alle Avatare kommen mehrfach vor, somit räumte jeder neue Spieler die Queue für sich ab
- **Behobene Logik**: Zombie-Cleanup und Self-Match-Filter wieder auf `pid`-only reduziert
- `pid` (=`profile.id` aus localStorage) identifiziert eindeutig den eigenen Browser — kein False-Positive bei anderen Spielern mit gleichem Avatar
- `await Promise.all(dels)` aus v3.11.24 bleibt erhalten — verhindert Race-Condition mit eigenem Zombie-Ticket

### v3.11.26 — Beenden-Button: Inline mit Phasen-Badge
- Beenden-Button aus eigenem HUD-Block entfernt — spart eine ganze Zeile Höhe
- Neues Layout: Phase-Badge und `✕`-Button erscheinen nebeneinander in einer Flex-Zeile
- `✕` statt "✕ beenden" als kompaktes Icon, `title="beenden"` für Accessibility
- Darunter: nur noch der große Timer — HUD insgesamt deutlich kompakter
- Mittelspalte: `maxWidth: 30%` (war 28%) für mehr Spielraum

### v3.11.25 — In-Game UI Redesign (Feldoptimierung)
- **Canvas größer**: `vw = innerWidth - 2` (war -8) und `chrome -= 8` (Padding 16→8) → +6px Breite, mehr Höhe
- **Canvas-Rahmen**: `borderRadius: 14` (war 6) — passt zum Menü-Design
- **Score-Bar**: kompakteres Padding (8px→5px oben), Spielerkarten `borderRadius: 14`, `padding: 4px 6px`
- **Timer**: `fontSize: 30` (war 28) — prominenter im HUD
- **P3-Leiste**: `borderRadius: 14`, `padding: 2px 10px` (war 4px 14px)
- **Drehen-Buttons**: kompaktes Layout ohne Text-Label (war "↻ DREHEN"), BOX 32→24, minHeight 42→36, padding 2px statt 4px — mehr Platz für Spielfeld

### v3.11.24 — Matchmaking Selbst-Match Fix (3-Layer)
- **Race-Condition**: Zombie-Ticket-Löschungen werden jetzt geawaited (`Promise.all`) bevor die Firebase-Subscription startet — verhindert, dass `mmTryFindMatch()` das Zombie-Ticket noch sieht
- **Cross-Device-Filter** in `mmTryFindMatch`: Zusätzlich zu pid-Check nun auch Name+Wappen-Vergleich — filtert selben Spieler auf zwei Geräten (unterschiedliche `localStorage`-IDs)
- **Startup-Cleanup** erweitert: bereinigt jetzt auch Tickets mit gleichem Name+Wappen (nicht nur gleicher pid)
- **Defense-in-Depth** in `mmClaimAndMatch`: Letzte Sicherung — Kandidaten mit gleichem Name+Wappen oder pid werden vor dem Claim erkannt, Zombie-Ticket gelöscht, Match abgebrochen

### v3.12.0 — App Store Release Preparation (TWA/Google Play)

#### PWA & Manifest
- `manifest.json`: vollständig überarbeitet — `name`, `short_name`, `description`, `start_url`, `scope`, `display: standalone`, `orientation: portrait`, `background_color`/`theme_color: #050d05`, `lang: de`, `categories: ["games"]`
- Icons jetzt mit `purpose: "any"` und `purpose: "maskable"` für Android Adaptive Icons
- `screenshots`-Feld vorbereitet (menu.png, game.png bei 390×844 für Play-Store-Listing)
- `theme-color` Meta-Tag: `#050d05` (war `#02060f` — jetzt konsistent mit manifest.json)
- `apple-touch-icon`: zeigt auf `icon-192.png` (war inline SVG — funktioniert in iOS Safari nicht korrekt)
- `<link rel="icon">` Einträge für 192×192 und 512×512 PNG hinzugefügt

#### Service Worker
- `sw.js`: Cache-Key `fortress-v3.12.0` (war statisch `fortress-v1` — stale Assets konnten nicht geräumt werden)

#### Neue Dateien
- `privacy.html`: Datenschutzerklärung auf Deutsch (Pflicht für Google Play Store) — deckt localStorage, Firebase Realtime Database, keine Werbung/Tracking ab
- `.well-known/assetlinks.json`: Template für Digital Asset Links (TWA-Domainverknüpfung) — Platzhalter für App-Paketname und SHA256-Fingerprint nach Bubblewrap-Setup
- `firebase-security-rules.json`: Dokumentation empfohlener Firebase Security Rules — leaderboard (name ≤30 Zeichen, elo 0–9999), queue (status+ts), games (createdAt) — muss manuell in Firebase Console eingetragen werden

#### Sicherheit & Robustheit
- `sanitizeAction()`: Erweiterte Validierung — `tx`/`ty` müssen `number` im Spielfeldbereich sein, `angle` muss finite sein, `elo` nur 1–9999, `name` auf 30 Zeichen geclipt, `wappen` auf 10 Zeichen geclipt, `color` muss `#rrggbb` sein sonst gelöscht
- `handleGuestAction()`: Phase-Gating — `place` nur in `build`, `cannon` nur in `setup`/`cannon`, `fire` nur in `shoot`; verhindert Late-Action-Exploits

#### Bug-Fixes
- Ball-Merge (Gast): `balls.current = s.balls || []` — Host ist immer autoritativ (war: Längenvergleich konnte neue Bälle verpassen wenn gleichzeitig Ball ablief und neuer abgefeuert wurde)
- ELO `numPlayers`-Fallback: `|| numPlayersRef.current || 2` — schützt vor `undefined` im resultInfo
- `fit()` useEffect: `fitTimerRef` für clearTimeout im Cleanup — kein Timer-Leak bei Unmount
- `fireMortar` frozenIds: `new Set(frozenReady.current[player])` + `.has()` statt `.filter().find()` — O(1) statt O(n²) bei großen Kanonen-Arrays
- Partikel-Cap: `particles.current.length < 350` vor allen drei Partikel-Loops (fireMortar, impactAt-Einschlag, impactAt-Kanonenvernichtung) — verhindert unbegrenztes Wachstum bei langen Spielen

#### Noch manuell zu erledigen (nach Bubblewrap-APK)
- `.well-known/assetlinks.json`: App-Paketname + SHA256-Fingerprint eintragen
- Firebase Console: Security Rules aus `firebase-security-rules.json` aktivieren
- `screenshots/` Verzeichnis mit echten Spielscreenshots füllen (390×844 PNG)
- Icon-PNGs mit vollflächigem Hintergrund (ohne abgerundete Ecken) neu generieren für Maskable-Safe-Zone

### v3.12.1 — Onboarding / Tutorial (Erstkontakt-Anleitung)

#### Neue Komponente
- `OnboardingModal({ step, setStep, onFinish })`: 5-Slide-Tutorial (Willkommen + 4 Schritte:
  Kanonen platzieren → Mauern bauen → Feuer frei → Spielziel). Icon-Kreis, Titel, Text,
  Fortschritts-Dots (anklickbar) und Weiter/Zurück/Überspringen-Navigation. Style passt
  zum Menü-Design (gleiches Modal-Gradient + `dailyBounceIn`-Animation).

#### Verhalten
- **Auto-Popup bei Erstkontakt**: erscheint 600ms nach Menüstart, wenn `localStorage`-Key
  `fortress_onboarded` nicht gesetzt ist. Hat Vorrang vor dem Daily-Reward-Modal (dieses
  zeigt sich erst, wenn `fortress_onboarded` gesetzt ist).
- **Abschluss** ("Los geht's!" oder "Überspringen") setzt `fortress_onboarded='1'` →
  erscheint nie wieder automatisch.
- **Jederzeit erneut öffenbar** über den Menü-Button „Wie spielt man?".

#### Geändert
- Menü-Button „Wie spielt man?" öffnet jetzt das interaktive Tutorial statt der alten,
  eingeklappten 2×2-Hilfe-Kachel-Ansicht (kompakter, einsteigerfreundlicher).
- Neue localStorage-Key: `fortress_onboarded` (`'1'` = Tutorial gesehen).
- Neue i18n-Keys (de/en): `tutorialBtn`, `onbSkip/onbNext/onbBack/onbStart`,
  `onbWelcomeTitle/Text`, `onbStep1–4Title/Text`.

#### Tests
- Neue Suite `suiteOnboarding` (8 Checks): Auto-Popup, Navigation, Durchklicken bis
  letzter Slide, Abschluss schließt + setzt Flag, Re-Open via Menü, Überspringen schließt,
  keine JS-Fehler. Gesamt jetzt **148 Tests grün**.
- `test_fortress.js` PROFILE_INIT setzt `fortress_onboarded='1'`, damit das Auto-Popup
  andere Suites nicht blockiert.

### v3.12.2 — Sound & Haptik (prozedurale SFX + Vibration)

#### Sound-Engine (global `SFX`)
- Web Audio API, **rein prozedural** — keine Asset-Dateien (offline-/TWA-tauglich, ZERO Cost).
- Oszillatoren (`_tone`) + gefilterter Rausch-Buffer (`_noise`) erzeugen alle Klänge live.
- AudioContext wird lazy beim ersten Bedarf erzeugt und erst nach User-Geste resumed
  (Browser-Autoplay-Policy) — globaler `pointerdown`-Listener ruft `SFX.resume()`.
- Alle Methoden in try/catch gekapselt — wirft nie, auch ohne Audio-Hardware/headless.

#### Sound-Events
- `SFX.shoot()` — beim Abfeuern (in `fireMortar` für Host/lokal; im Gast-Sende-Zweig fürs eigene Gerät)
- `SFX.impact()` / `SFX.destroy()` — **render-loop-getrieben** über Explosions-Zähler-Delta
  (`prevExplCount`/`prevBigCount`). Da `explosions` synchronisiert sind, hören **alle Geräte**
  (Host + Gäste + lokal) Einschläge; `big`-Explosionen (Kanone zerstört) → `destroy()`.
- `SFX.win()` / `SFX.lose()` — beim Erscheinen des Ergebnisbildschirms (useEffect auf `screen`/`resultInfo`),
  Sieg-Arpeggio aufsteigend bzw. Niederlage absteigend.

#### Haptik (Vibration)
- `SFX.vibrate(pattern)` via `navigator.vibrate` (Android/Chrome; iOS Safari ignoriert es still).
- Schuss=15ms, Einschlag=25ms, Zerstörung=[30,40,60], Sieg/Niederlage als Muster.

#### UI & Einstellungen
- Zwei Toggle-Chips im Menü (neben DE/EN): 🔊/🔇 Sound und 📳/📴 Vibration.
- Persistenz: localStorage `fortress_sound` und `fortress_haptics` (`'1'`/`'0'`, Default an).
- Vibrations-Toggle gibt beim Aktivieren ein kurzes Test-Vibrieren.

#### Tests
- Neue Suite `suiteSound` (7 Checks): SFX-Engine vorhanden, alle Methoden fehlerfrei,
  beide Toggles sichtbar, Toggle schaltet `SFX.enabled` + localStorage (0/1), keine JS-Fehler.
  Gesamt jetzt **155 Tests grün**.

### v3.12.3 — Reconnect / Verbindungsstatus (Online-Robustheit)

#### Verbindungs-Banner mit Auto-Recovery
- Neuer Status-State `connLost` + `connLostRef`. Ein nicht-blockierendes Banner oben im
  Spielbildschirm zeigt „Verbindung instabil — wird wiederhergestellt…" mit Spinner und
  „Erneut verbinden"-Button (nur bei `online && screen==="game"`).
- `setConn(lost)` aktualisiert State nur bei echter Änderung (kein Re-Render-Spam).

#### Gast-Seite (Watchdog + Reconnect)
- Watchdog-Intervall von 5s auf **2s** verkürzt, Schwelle von 15s auf **6s**.
- Bei >6s ohne State: Banner an + **einmaliger automatischer Reconnect** via
  `resubscribeGuestState()` (stoppt den `onValue`-Listener und baut ihn neu auf →
  Firebase liefert den letzten Stand erneut). `resubAttempted`-Flag verhindert Thrashing.
- Sobald wieder State fließt: Banner verschwindet automatisch, Flags zurückgesetzt.
- Der frühere transiente `warnHostAntwortetNicht`-Toast wird durch das persistente,
  selbstheilende Banner ersetzt.

#### Host-Seite (Push-Fehler-Erkennung)
- `hostPushResult(ok)` wertet jedes `fb.patch`-Ergebnis aus: 3 Fehlschläge in Folge →
  Banner an; erster Erfolg → Banner aus, `pushFails` zurückgesetzt.

#### „Erneut verbinden"-Button
- Gast → `resubscribeGuestState()`, Host → `pushState(true)` (Force-Push).
- Setzt `lastStateAt`, `resubAttempted`, `pushFails` zurück.

#### Cleanup
- Beim Verlassen/Stoppen: `connWatchdog`-Intervall geleert, `connLost`/Flags zurückgesetzt.

#### i18n
- Neue de/en-Keys: `connLostTitle`, `connLostSub`, `connReconnect`.

#### Tests
- Online-2-Spieler-Suite prüft zusätzlich: **kein falscher Reconnect-Banner** bei aktiver
  Verbindung (Host + Gast). Gesamt jetzt **156 Tests grün**.
- Hinweis: Der echte 6s-Reconnect-Pfad ist netzwerk-/wallclock-abhängig und wird manuell
  getestet; die Suite sichert den False-Positive-Fall ab.

### v3.12.4 — Multiplayer-Härtung „Stufe 0" (Anonymous Auth + Reconnect, Zero-Cost)

Basierend auf dem Security-/Netzwerk-Review des Multiplayer-Modus. Alle Maßnahmen
bleiben im kostenlosen Spark-Plan (kein Server, kein Blaze).

#### Anonymous Auth (Vorbereitung für auth-gebundene Rules)
- Firebase-Auth-SDK (`firebase-auth.js`) im ES-Module-Init ergänzt; `signInAnonymously`
  als **Best-Effort** — ist „Anonymous" in der Console nicht aktiviert, bleibt `uid` null
  und das Spiel läuft unverändert mit der lokalen Profil-ID weiter (kein Bruch).
- `window.__fb.uid` wird via `onAuthStateChanged` gepflegt; Helfer `authUid()` / `writeId(localId)`.
- **Leaderboard-Schreibschlüssel** ist jetzt `writeId(p.id)` = `auth.uid` (sonst Profil-ID).
  Damit kann die strikte Rule `auth.uid === $playerId` greifen → niemand überschreibt mehr
  fremde Leaderboard-Einträge. Gilt auch für `cleanupMyDuplicates`.
- `getFirebase()` wartet best-effort bis ~3s auf die Auth-UID, bevor Online-Aktionen laufen
  (nötig sobald die auth-gebundenen Rules aktiv sind).

#### Security Rules (Datei, manuell zu aktivieren)
- `firebase-security-rules.json` neu: Leaderboard nur eigentümer-schreibbar (`auth.uid===$id`),
  Queue/Games nur für authentifizierte Clients schreibbar, **kein Collection-Listing** von
  `games` mehr (Massen-Enumeration/Scraping unterbunden). Enthält dokumentierte
  Aktivierungs-Reihenfolge (erst Code deployen → Anon-Auth aktivieren → testen → Rules publishen).

#### H-A — Verwaiste Spiele verhindert
- `fb.onDisconnectRemove('games/'+code)` beim Host-Create (`hostCreateGame` + `mmClaimAndMatch`)
  → Firebase löscht den Spielknoten serverseitig bei Host-Abbruch (Tab zu / Crash / Netz weg).
- In `cleanupGame` wird die onDisconnect-Registrierung bei sauberem Leave abbestellt
  (`gameDisconnectCancel`-Ref), damit nichts doppelt gelöscht wird.

#### H-C — Gast hängt nicht mehr ewig bei Host-Disconnect
- Neuer `fb.subscribeRaw` liefert auch den Gelöscht-Fall (`onData(data, exists)`).
- Gemeinsamer `guestStateHandler`: erkennt Knoten-Löschung (`exists===false`, nur nach
  erstem gültigen State via `everGotState`) → sauberes Ende `warnHostEnded`.
- Watchdog-Eskalation: nach **30s** ohne State → `endOnlineDisconnected('warnHostLost')` →
  sauber zurück ins Menü mit Hinweis (statt ewigem „Verbindung instabil"-Banner).
- `endOnlineDisconnected` ist gegen Mehrfachauslösung geschützt (`disconnectEnding`).
- Neue i18n-Keys (de/en): `warnHostEnded`, `warnHostLost`.

#### Service Worker
- Cache-Key `fortress-v3.12.4` — stellt sicher, dass wiederkehrende Spieler den
  auth-fähigen Build erhalten, BEVOR die neuen Rules aktiviert werden.

#### Tests
- Online-2-Spieler-Suite läuft weiter grün über den neuen `subscribeRaw`/`guestStateHandler`-Pfad.
  Gesamt **156 Tests grün**.

#### Bewusst NICHT in Stufe 0 (braucht später Blaze + Server)
- Echte ELO-Integrität (Client rechnet ELO weiter selbst), verifiziertes Spielergebnis
  (Host-autoritative P2P-Architektur), Connection-Flood-DoS (App Check). Leaderboard bleibt
  bis dahin „vorläufig/advisory".

### v3.12.5 — Auth-Wait ohne Verzögerung (Folge-Fix zu v3.12.4)

- `getFirebase()` bricht das Warten auf die anonyme Auth-UID jetzt SOFORT ab, sobald
  der Login fehlschlägt (`window.__fbAuthError`). Vorher hätte das Warten — solange
  Anonymous-Auth in der Console nicht aktiviert ist — bei jeder Online-Aktion bis zu
  3 Sekunden gekostet. Jetzt: keine spürbare Verzögerung in der Übergangsphase.
- Cache-Key `fortress-v3.12.5`.

> Live-Backend-Befund (per REST geprüft, ohne Console-Zugriff): `leaderboard`-Schreibzugriffe
> sind bereits OHNE Auth abgelehnt (HTTP 401), `games`-Direktzugriff offen, `games`-Listing
> gesperrt (401). Das bestätigt: Anonymous-Auth zu aktivieren ist nicht nur Härtung, sondern
> Voraussetzung dafür, dass Leaderboard-Schreibvorgänge überhaupt wieder funktionieren.

### v3.12.6 — Schriftzug "ZUMAUERN!" in der Namensbox (Bau-Dringlichkeit)

- Ergänzung zum bereits vorhandenen pochenden roten Spielfeld-Rand (`dangerGlow`): In den
  letzten 8 Bau-Sekunden, solange die Burg eines Spielers noch offen ist, ersetzt ein
  pulsierender roter Schriftzug `⚠ ZUMAUERN!` (en: `⚠ SEAL IT!`) den Spielernamen in dessen
  Namensbox (P1/P2/P3) — maximale Klarheit, welcher Spieler handeln muss.
- Neue Logik: `urgentPlayers` (pro Spieler offen+dringlich) ersetzt das frühere
  einzelne `buildUrgencyOpen`-Boolean; `buildUrgencyOpen` wird daraus abgeleitet (Rand bleibt
  unverändert). Helfer `closeWarnSpan(align)` für die drei Boxen (links/rechts/zentriert).
- Identische Bedingung wie der Rand (`!castleClosed[p]`, Online: nur eigene Burg) → Schriftzug
  und Rand erscheinen/verschwinden synchron, kein false-positive bei geschlossener Burg.
- Neue i18n-Keys: `closeWarn` (de/en).
- Test: zusätzliche Absicherung, dass der Schriftzug bei geschlossener Burg NICHT erscheint
  (157/157 grün).

### v3.12.7 — "ZUMAUERN!"-Schriftzug größer & stärker pochend

- Der Bau-Dringlichkeits-Schriftzug in der Namensbox ist jetzt deutlich auffälliger:
  Schriftgröße 10.5 → 14, hellerer Ton (#fee2e2), und ein echter Skalier-Puls statt nur
  Opacity.
- Neues Keyframe `closePulse` (0.45s): skaliert 1 → 1.22 + pulsierender roter Text-Shadow.
- `transformOrigin` je Box verankert (P1 links / P2 rechts / P3 zentriert), damit der Text
  beim Vergrößern in die Box hinein wächst statt über den Rand.

### v3.12.8 — i18n-Review: alle hartkodierten deutschen UI-Texte übersetzt

Vollständiges Review der Zweisprachigkeit (DE/EN). Zahlreiche benutzer-sichtbare Strings
waren hartkodiert auf Deutsch und blieben im englischen UI deutsch. Jetzt durchgängig via
`t()` / `LANGS` bzw. (für die Achievements) über eine Übersetzungs-Map.

#### Achievements (Hauptfall)
- `ACH_EN`-Map mit englischen `title`/`desc` für alle 20 Achievements (DE bleibt im
  `ACHIEVEMENTS`-Array als Fallback); Helfer `achTitle(def)` / `achDesc(def)` wählen nach `lang`.
- AchievementsModal + AchievementPopup nutzen jetzt `achTitle`/`achDesc`.
- Kategorie-Labels (Siege/Spiele/Zerstörung/Gold/ELO/Serien), Zähler "X/N freigeschaltet",
  "Geheimes Achievement", "✓ Freigeschaltet" → neue `t()`-Keys (`achcat_*`, `achUnlocked`,
  `achSecret`, `achDone`).

#### Weitere behobene Stellen
- **Leaderboard**: Modus-Toggle "3 Spieler", "Lädt…", beide Leer-Zustände, "Aktualisieren",
  "(Du)"-Marker, Statistik-Kürzel (S/N/Sp.) → `t()` (neu: `lbLoading/lbRefresh/lbEmpty/lbEmpty3p/gamesAbbr`, `youSuffix`).
- **Hauptmenü**: falsch hartkodierter Online-Button "ONLINE SPIELEN (2–3 Geräte)" nutzt jetzt
  `t('playOnline')`; Tooltips ("Profil bearbeiten", "tages-belohnung") via `t()`.
- **Profil-Editor**: "AVATAR GALERIE", "GESPERRT", "Nächste Freischaltung", "benötigt" → `t()`
  (neu: `avatarGallery/avatarLocked/nextUnlock/requiredLabel`).
- **Setup/HUD**: "← Zurück" (lokal) → `t('back')`; "Code einfügen" → `t('pasteCode')`;
  3× "(Du)" in den HUD-Namensboxen + "P3 (Grün)"-Fallback → `t()` (`youSuffix`, `p3GreenFallback`).

#### Tests
- Neue Suite `suiteI18n`: lädt das UI auf Englisch (`fortress_lang='en'`) und prüft, dass
  Menü + Achievements (Zähler, Kategorien, Titel/Beschreibung) englisch sind und kein
  deutscher Resttext erscheint. Gesamt jetzt **163 Tests grün**.

### v3.13.0 — Bot-/KI-Gegner (Einzelspieler, „Übung gegen Bot")

Erste Empfehlung aus der Gameplay-Analyse: ein lokaler Einzelspieler-Modus gegen eine KI —
behebt die „kein Online-Gegner = Sackgasse"-Situation und dient als praktisches Onboarding.

#### Einstieg & Steuerung
- Neuer Button **„Übung gegen Bot"** (EN „Practice vs Bot") oben im Lokal-Untermenü.
- Mensch = P1, KI = P2. Im Bot-Modus gehen ALLE Touch-Eingaben an P1 (`botMode.current`
  in `onPointerDown`).
- **Zählt NICHT für ELO/Stats/Leaderboard** (lokal, `online.current=false` → `recordResult`
  ist online-gegated). Bewusst, damit Übung die Wertung nicht verfälscht.

#### KI-Architektur (rein clientseitig, kostenlos)
- `botMode`-Ref + Intervall (`setInterval(botTick, 600)`), gestartet via `useEffect([screen])`
  nur wenn `screen==='game' && botMode && !online`.
- Die KI nutzt dieselben Spielfunktionen wie ein Mensch: `placeCannon`/`placePiece`/`fireMortar`.
- **Setup/Kanonenphase** (`botPlaceOneCannon`): sucht eingemauerte (innere) 3×3-Plätze nahe der
  eigenen Burg via `computeOutsideMapForCannons` (nur dort sind Kanonen schussbereit), platziert
  das gesamte Budget.
- **Bauphase** (`botBuild`): erkennt offene Burg via `computeOutsideMap`, sammelt Leck-Frontier-
  Zellen (außen-erreichbar, leer, baubar, an geschütztes Feld grenzend), füllt die der Burg
  nächsten zuerst → baut emergent einen engen Schutzring um die Burg (re-versiegelt nach Treffern).
  Probiert pro Zelle bis zu 4 Rotationen, Erkennung des Platzierens über Grid-Identitätswechsel.
- **Schussphase** (`botShoot`): zielt mit `RELOAD_MS`-Takt auf die gegnerische Burgmitte
  (`castles.current[1]`) mit kleiner Streuung (`botDifficulty`-Ref als Tuning-Hook für spätere
  Schwierigkeitsgrade). Die 100%-genaue Leitkanone bohrt sich über Runden zur Burg durch.

#### Tests
- Neue Suite `suiteBot`: Bot-Button sichtbar, Spielstart, **Bot platziert nachweislich selbst
  Kanonen** (Toast-Beleg, da der Test-Mensch nichts platziert), stabiler voller Phasenzyklus,
  keine JS-Fehler. Gesamt **169 Tests grün**.

#### Offen / nächster Schritt
- Schwierigkeitsgrade (Easy/Normal/Hard) über `botDifficulty` + Tick-Tempo + Bau-Aggressivität.

### v3.13.1 — Bot-Intelligenz-Fixes (verifiziert per Selbstspiel-Diagnose)

Ein Selbstspiel-Test (zwei Bots gegeneinander, echte Geschwindigkeit) deckte zwei gravierende
Schwächen des v3.13.0-Bots auf; beide behoben:

- **Offensive war wirkungslos:** Der Bot zielte auf die Burg*mitte* — die Burg ist unzerstörbar
  und der Mörser ist ein Bogenschuss, der über die Mauer hinweg auf der Burg landet → null Schaden,
  nie ein Durchbruch. **Fix (`botShoot`):** marschiert von der gegnerischen Burg nach außen Richtung
  eigener Kanonen und zielt auf die ERSTE gegnerische Mauerzelle = innerste Schutzmauer → ihre
  Zerstörung öffnet die Burg. Streuung reduziert, damit die Leitkanone die Mauer zuverlässig trifft.
- **Defensive baute nichts:** Die Offen-Erkennung in `botBuild` prüfte die Burgzellen selbst (die der
  Flood-Fill nie markiert) → Burg galt immer als „geschlossen" → 0 Bausteine. Zusätzlich zwang der
  „an-Mauer-angrenzend"-Filter die Teile direkt an Mauern zu zentrieren (Überlappung → Ablehnung).
  **Fix:** Offen-Erkennung über `isCastleClosed`; Versiegelung füllt die der Burg nächsten
  außen-erreichbaren Leerzellen (Chebyshev-Distanz für 8-Konnektivität) dort, wo das Teil passt,
  bis zu 3 Teile/Tick → engt das Leck ein, bis die Burg wieder 8-dicht ist.

**Diagnose-Ergebnis nach Fixes:** Im Selbstspiel durchbrechen sich beide Bots gegenseitig die Burg
(Offensive ✓) UND versiegeln in der Bauphase wieder (Defensive ✓) — echtes Hin und Her statt
Sofort-Unentschieden. Der Bot ist damit ein vollwertiger Übungsgegner.

Offen: Schwierigkeitsgrade (der Bot ist aktuell recht stark — schnelle, fast perfekte Versiegelung
+ präzise Offensive); tunebar über `botDifficulty` (Streuung), Tick-Tempo und Teile/Tick.

### v3.13.2 — Bot wächst & bleibt aktiv (kein „Aufhören nach dem Schießen")

Spieler-Feedback: der Bot blieb bei 2 Kanonen stehen und wirkte nach der ersten Schussphase
passiv. Ursache: er konnte im Kanonen-Setzschritt keinen Platz für eine 3. Kanone finden
(Innenraum voll, nur eingemauerte Plätze gesucht) und baute bei geschlossener Burg nichts.

- **Kanonen-Platzierung (`botPlaceOneCannon`)** jetzt zweistufig: Pass 0 sucht bereits
  eingemauerte Plätze (sofort schussbereit); Pass 1 setzt die Kanone an die eigene Festung
  angrenzend (wird in der Bauphase ummauert). → Der Bot setzt **jede Runde +1 Kanone** statt
  bei 2 zu verharren.
- **Bauphase (`botBuild`)** erledigt jetzt zwei Aufgaben über den gemeinsamen Helfer
  `botFillNear` (füllt die einem Objekt nächsten außen-erreichbaren Leerzellen auf):
  1. Burg versiegeln (Priorität), 2. **noch offene Kanonen einmauern** → sie werden schussbereit.
  → Wachsende Feuerkraft, Bot ist in jeder Phase beschäftigt.
- **Service-Worker-Cache** `fortress-v3.13.2` — erzwingt, dass wiederkehrende Spieler den neuen
  Bot (inkl. v3.13.1-Ziel-Fix) bekommen statt der gecachten alten Version.

**Selbstspiel-Diagnose bestätigt:** Kanonenzahl wächst 2→3→4, neu gesetzte Kanonen werden in der
Bauphase eingemauert und schussbereit (ready 2→3→…), beide Bots durchbrechen & versiegeln —
durchgehend aktives, wachsendes Spiel. 169/169 Tests grün.

Offen weiterhin: Schwierigkeitsgrade (der Bot spielt stark/fast optimal).

### v3.14.0 — Interaktives Tutorial (geführtes erstes Spiel)

Auf Wunsch: ein interaktives Tutorial direkt am Anfang, wie man es von anderen Spielen kennt —
Lernen durch Tun statt nur Text-Slides.

- **`startGuidedTutorial()`**: lokales Spiel gegen einen **passiven Bot** (`botShoot` no-op bei
  `tutorialMode.current` → kein Druck; der Bot baut/verteidigt aber, liefert also ein realistisches
  Ziel). `tutorialMode`-Ref neben `botMode`.
- **Coach-Sprechblase** (unten, blockt das obere Spielfeld des Spielers nicht): zeigt pro Phase
  eine konkrete Anweisung — Setup („Kanone setzen"), Bauen („Burg lückenlos einmauern"), Schießen
  („Finger von der Kanone wegziehen, auf gegnerische Mauer zielen"), Kanone („weitere Kanone").
  Plus „Tutorial beenden"-Button. **Wichtig: im GAME-Return gerendert, nicht im Menü-Return.**
- **Einstieg**: Auto-Start direkt nach dem Onboarding für Erstspieler (`finishOnboarding` →
  `startGuidedTutorial` wenn `fortress_tutorial_done` fehlt) + jederzeit über einen 🎓-Button
  „Interaktives Tutorial" im Lokal-Untermenü wiederholbar. Merker `fortress_tutorial_done` (kein
  erneuter Auto-Start).
- **Zählt nicht für ELO** (lokal). Neue i18n-Keys (de/en): `guidedTutorial`, `coachLabel`,
  `coachSetup/Build/Shoot/Cannon/Done`, `tutorialExit`.
- **Tests**: neue Suite `suiteTutorial` (Button, Start, Coach-Blase + Anweisung + Exit-Button,
  stabiler Phasenlauf); `PROFILE_INIT` setzt `fortress_tutorial_done='1'` gegen Auto-Start in
  anderen Suites. Gesamt **176 Tests grün**.

> Nebenbefund (separat zu fixen): Das Reconnect-Banner (`connLost`, v3.12.3) wird im **Menü-Return**
> gerendert und damit während eines Online-Spiels (screen="game") nie angezeigt — funktionslos.
> Sollte in den GAME-Return verschoben werden.

### v3.14.1 — Tutorial/Bot-Feinschliff + Sprach-Autoerkennung (Spieler-Feedback)

- **Bot oben, Spieler unten:** Im Bot-/Tutorial-Modus wird das Feld jetzt gespiegelt (gleiche
  `p1Flipped`-Mechanik wie beim Online-Host) → Mensch = P1 (blau) unten, Bot = P2 (rot) oben.
  Bedingung erweitert: `(online && myRole===1 || botMode.current) && numPlayers===2`.
- **Weniger „krasses" Bauen:** `botFillNear` baut nur noch im Umkreis (Chebyshev ≤ 5) der Burg/Kanone
  und max. 2 Teile/Tick (statt 3, 30 Kandidaten) → kompakter Schutzring statt riesiger Klotz.
- **Tutorial einfach & kurz:** Bot setzt im Tutorial nur seine 2 Start-Kanonen (kein Wachstum,
  keine Kanonen-Ummauerung). Nach dem **ersten eigenen Schuss** des Spielers erscheint ein
  Abschluss-Overlay („🎉 Tutorial abgeschlossen!") mit „Online spielen"/„Hauptmenü" → schnell vorbei.
- **Coach-Wechsel deutlich sichtbar:** Sprechblase ist nun oben (Bot-Hälfte, blockt den Spieler nicht),
  animiert bei jedem Phasenwechsel (`key=phase` + `coachPop`/`coachFlash`-Keyframes) und zeigt einen
  Schritt-Zähler „1/4 … 4/4".
- **Sprache automatisch:** Beim Erststart wird die Gerätesprache erkannt (`navigator.language`):
  „de…" → Deutsch, sonst Englisch (statt immer Deutsch). Manuell weiter umschaltbar.
- i18n: `tutorialDoneTitle/Text`, `tutorialToOnline`. Tests: `PROFILE_INIT` setzt `fortress_lang='de'`
  (Headless meldet en-US). **176 Tests grün.** SW-Cache `fortress-v3.14.1`.

### v3.14.2 — Tutorial lehrt jetzt die Umschließungs-Regel (Spieler-Feedback)

Rückmeldung: das Bauen ist im Tutorial WICHTIG — der Spieler muss verstehen, dass seine Burg
rundum geschlossen sein muss. Bisher startete die Burg schon geschlossen → kein Lerneffekt.

- **Lücke in der Spieler-Burg**: In `initGrid` wird im Tutorial (nur P1, 2-Spieler) eine 3-Zellen-
  Lücke in den Start-Mauerring gerissen → die Burg ist offen und der Spieler muss sie in der
  Bauphase selbst schließen (Kernregel durch Tun gelernt).
- **Coach-Bautext angepasst**: „Deine Burg hat eine LÜCKE! … schließe sie RUNDUM — nur eine komplett
  umschlossene Burg ist sicher."
- **Forgiving im Tutorial**: Bleibt die Burg am Bauende offen, wird der Spieler NICHT eliminiert,
  sondern bekommt die Regel erklärt (`tutorialCastleOpen`-Warnung) → keine Sackgasse, aber die
  Lektion sitzt (zusätzlich zur bestehenden „ZUMAUERN!"-Dringlichkeitswarnung in den letzten 8s).
- i18n: `tutorialCastleOpen` (de/en), `coachBuild` neu. 176 Tests grün. SW-Cache `fortress-v3.14.2`.

### v3.14.3 — Tutorial: Bot schießt ein echtes Loch (authentische Umschließungs-Lektion)

Ersetzt die vorgefertigte Lücke (v3.14.2) durch echtes Gameplay:

- **Bot schießt ein Loch:** In der Schussphase feuert der Tutorial-Bot gezielt auf die innerste
  Mauer der Spielerburg (exakter Treffer, keine Streuung) — solange, bis die Burg **offen** ist,
  danach passiv. `botShoot` prüft `isCastleClosed(...,1)`; `tutorialBotShot` markiert den Durchbruch.
- **Coach-Box reagiert:** Sobald die Burg offen ist, wechselt der Coach-Text (dynamisch über
  `coachP1Open` = `!floodCache.castleClosed[1]`, Key enthält den Offen-Zustand → Neu-Animation):
  Schussphase → „⚠ Der Bot hat ein Loch in deine Burg geschossen! … schließe sie in der nächsten
  Bauphase" (`coachShootOpen`); Bauphase → „Deine Burg hat ein LOCH! Schließe die Lücke RUNDUM"
  (`coachBuildOpen`).
- **Abschluss beim Wieder-Verschließen:** `placePiece` erkennt, wenn P1 nach dem Durchbruch die Burg
  wieder schließt (`tutorialBotShot` && `isCastleClosed`) → „✓ Stark! Burg wieder geschlossen"
  (`tutorialSealed`) + Abschluss-Overlay. Der frühere „Ende nach erstem Schuss"-Trigger entfällt.
- Vorgefertigte Start-Lücke aus `initGrid` wieder entfernt. Neue i18n: `coachBuildOpen`,
  `coachShootOpen`, `tutorialSealed` (de/en); `coachBuild` = Übungstext. Per Screenshot verifiziert.
  176 Tests grün. SW-Cache `fortress-v3.14.3`.

### v3.14.4 — „Wie spielt man?"-Menübutton entfernt

Da das interaktive Tutorial (v3.14.x) jetzt den Einstieg übernimmt (Auto-Start beim Erststart +
🎓-Button im Lokal-Menü), ist der dominante „Wie spielt man?"-Button im Hauptmenü überflüssig.

- Button (rief `openTutorial` → statisches Onboarding-Modal) aus dem Hauptmenü entfernt → Menü
  aufgeräumter, Sprach-/Sound-Reihe sitzt direkt über den Spiel-Buttons.
- Das statische Onboarding-Modal zeigt sich weiterhin automatisch beim Erststart (danach interaktives
  Tutorial). Es ist nur nicht mehr manuell über einen Menübutton aufrufbar; das interaktive Tutorial
  ist die wiederholbare Anleitung.
- Test: Onboarding-Suite um die „Re-Open/Überspringen via Menübutton"-Checks bereinigt (Button gibt es
  nicht mehr); Auto-Anzeige + Navigation + Abschluss bleiben abgedeckt. 174 Tests grün. SW-Cache v3.14.4.

### v3.14.5 — Achievement-Badge als „Ungelesen"-Marker

Die Zahl am Achievement-Button im Hauptmenü zeigte bisher immer die Gesamtzahl freigeschalteter
Achievements. Jetzt verhält sie sich wie ungelesene Nachrichten:

- **Nur NEUE anzeigen**: Badge = `freigeschaltet − zuletzt_gesehen` (`achNew`). Ist er 0, wird weder
  Zahl noch die goldene Hervorhebung (Hintergrund/Rahmen) angezeigt.
- **Beim Öffnen als gelesen markieren**: `openAchievements()` setzt `achSeenCount = unlocked` und
  persistiert es in `localStorage['fortress_ach_seen']` → Badge verschwindet nach dem ersten Blick
  ins Achievement-Menü und kommt erst bei der nächsten Freischaltung wieder.
- Neue localStorage-Key `fortress_ach_seen`. Tests: Badge zeigt neue (3 retroaktive), wird nach dem
  Öffnen als gelesen markiert und verschwindet. **177 Tests grün.** SW-Cache `fortress-v3.14.5`.

### v3.14.6 — Daily-Reward: Treue-Bonus statt „von-vorne"-Gefühl

Bisher wiederholte sich der 7-Tage-Kalender nach Tag 7 mit denselben kleinen Belohnungen —
das fühlte sich wie ein Neustart an. Neu: die Wochen bleiben, werden aber wertvoller.

- **`dailyWeekMult(streak)`**: pro abgeschlossener 7-Tage-Woche +25 % auf Gold/XP, gedeckelt bei
  **×3** (nach 8 Wochen / 56 Tagen). Der Streak-Zähler lief schon immer weiter — jetzt zahlt er sich
  auch aus.
- **DailyRewardModal**: zeigt die multiplizierten Werte im Kalender (T1–T7) und in der Abhol-Anzeige;
  ab Woche 2 erscheint ein pulsierendes **„🔥 Woche {w} · Treue-Bonus ×{m}"**-Badge. Die effektive
  Belohnung (`reward` inkl. Multiplikator) wird sowohl angezeigt als auch vergeben (kein Auseinanderlaufen).
- Kein Neustart-Gefühl mehr: der 7-Tage-Aufbau (Tag 7 = Bonus-Kiste) bleibt als Wochen-Dopamin,
  aber jede neue Woche gibt mehr — Langzeit-Streaks werden spürbar belohnt (Deckel gegen Inflation).
- Neue i18n: `dailyLoyalty` (de/en). Test: Streak 14 → Woche 3 → ×1.5-Badge + Gold 10×1.5=15 verifiziert.
  **178 Tests grün.** SW-Cache `fortress-v3.14.6`.

### v3.14.7 — Tutorial: Kanonen-Umschließung lehren + Bot setzt +1 Kanone

Spieler-Feedback zum Tutorial:

- **Kanonen müssen umschlossen sein, um zu feuern** — jetzt im Coach erklärt:
  - Setup: „Setze 2 Kanonen INNERHALB deiner Burgmauern … Nur von Mauern UMSCHLOSSENE Kanonen
    können feuern!" (`coachSetup`)
  - Kanonenphase: „Setze eine weitere Kanone und MAUERE SIE EIN — nur umschlossene Kanonen feuern."
    (`coachCannon`)
- **Bot setzt im Tutorial wieder seine +1 Kanone**: `botActFor` platziert Kanonen auch im Tutorial
  in der Kanonenphase (nicht mehr ausgeschlossen). Sobald beide Spieler ihr Budget auf 0 haben,
  springt die Kanonenphase vorzeitig weiter (`placeCannon`-Auto-Advance) → Tutorial läuft flotter.
  Der Bot bleibt sonst passiv (feuert nur das eine Loch, mauert seine Extra-Kanone nicht ein).

178 Tests grün. SW-Cache `fortress-v3.14.7`.

### v3.14.8 — Bot-Intelligenz: gezieltes Schießen + sauberes Mauer-Reparieren

Spieler-Feedback: der Bot wirkte willkürlich beim Bauen und traf beim Schießen immer dieselbe Stelle.

- **Schießen mit Regelverständnis (`botShoot`)**: sammelt burgnahe gegnerische Mauerzellen (innerste
  Schutzmauern = am wirksamsten, um die Burg zu öffnen) und zielt **rotierend** (`botAimSeq`) über
  die innersten ~12 → das Feuer WANDERT die Schutzmauer entlang und trägt sie systematisch ab, statt
  eine Zelle zu hämmern. Sind keine Schutzmauern mehr da → gezielt auf die gegnerischen Kanonen
  (Offensive brechen), sonst vor die Burg. Streuung reduziert (0.35).
- **Bauen als saubere Mauer (`botRebuildRing` + `botBuild`)**: baut die SOLL-Mauer als Rechteck-Ring
  wieder auf (füllt gezielt die Lücken auf dem Mauer-Rand um Burg bzw. Kanone, ±3/±6 bzw. ±2/±2) →
  sieht aus wie eine reparierte Mauer statt eines zufälligen Klotzes. `botFillNear` bleibt als
  Fallback, falls der Soll-Ring gerade keine passende Lücke bietet.
- **Selbstspiel-Diagnose**: beide Bots tragen sich gegenseitig die Schutzmauern ab (verteilte
  Bresche) und reparieren ihre Ringe — das Spiel endet jetzt **entscheidend** (Sieger) statt im
  Dauer-Patt. Fortress-Struktur im Screenshot klar rechteckig (Ring + eingemauerte Kanonen).

178 Tests grün. SW-Cache `fortress-v3.14.8`.

### v3.14.9 — Bauphase auf 15 Sekunden verkürzt
- **`BUILD_TIME` von 25 → 15 Sekunden** gesenkt. Die Bau-/Schließphase ist jetzt straffer:
  weniger Leerlauf, schnelleres Spieltempo pro Runde. Die Umschließungs-Prüfung (Flood-Fill am
  Bauende) und die Dringlichkeits-Warnung (`≤8s`) bleiben unverändert wirksam.

Tests grün. SW-Cache `fortress-v3.14.9`.

### v3.14.10 — Online-Fix: onDisconnect-Auto-Löschen zerstörte Lobbys & Matchmaking
**Regression aus v3.12.4 behoben.** Das serverseitige Auto-Löschen bei Verbindungsabbruch
(`onDisconnect().remove()`) war gut gemeint (keine verwaisten Knoten), brach aber das
Online-Spiel in der Praxis: Mobile Browser trennen die Firebase-Verbindung bereits beim
kurzen App-Wechsel (Code per Messenger teilen, Bildschirm sperren, WLAN↔LTE).

- **Host-Lobby überlebt jetzt Verbindungs-Blips**: Das `onDisconnectRemove('games/'+code)`
  beim Erstellen (Code-Spiel UND Quick-Match) ist entfernt. Vorher: Host teilt den Code per
  WhatsApp → Verbindung kurz weg → Server löscht das Spiel → Gast: „Spiel nicht gefunden".
  Sauberes Verlassen löscht weiterhin explizit (`cleanupGame`); Gäste behalten ihre Watchdogs.
- **Quick-Match-Ticket heilt sich selbst**: Nach einem Blip löschte der Server das Queue-Ticket;
  der 2s-Heartbeat (`mmTick`) patchte danach nur noch `{hb}` und erzeugte einen status-losen
  Stub, den niemand matchen konnte → „sucht ewig". Jetzt erkennt `mmTick` das fehlende/kaputte
  Ticket, trägt das komplette Ticket neu ein (`mmMyTicket`-Ref) und registriert das
  onDisconnect neu (onDisconnect-Operationen feuern nur einmal).
- **Verwaiste Lobby-Hygiene beim Join**: Ein Spiel ohne State und älter als 2h gilt beim
  Code-Join als verwaist → wird gelöscht und als „nicht gefunden" gemeldet.
- **Diagnose-Klarstellung**: Die Firebase-Rules sind NICHT die Ursache — Live-Probes mit den
  echten Datenformaten (Ticket mit `status`/`ts`, `guestAction2` als JSON-String) laufen alle
  ohne Auth durch. Hinweis: Zwei Tabs im selben Browser matchen sich per Quick-Match absichtlich
  nie (gleiche Profil-ID = Selbst-Match-Schutz); zum Testen zwei Geräte oder Code-Join nutzen.

Tests grün. SW-Cache `fortress-v3.14.10`.

### v3.14.11 — Online-Fix Teil 2: Geister-Listener + Phasenzeiten korrigiert
**Kernbug „erstes Online-Spiel klappt, danach keins mehr":** Die modulare Firebase-SDK
(v9/v10) gibt bei `onValue()` eine **Unsubscribe-Funktion** zurück. `fb.subscribe`/
`fb.subscribeRaw` übergaben diesen Rückgabewert aber als „Callback" an
`off(ref,'value',cb)` — das matcht keinen registrierten Listener, **kein `stop()` hat
je einen Listener wirklich abgemeldet**. Nach dem ersten Spiel lebten alle Listener
(Gast-State, Host-guestActions, Matchmaking-Queue) als Geister weiter: Löschte der
Host-Cleanup 2,5s später den alten Spielknoten, feuerte der verwaiste Gast-Listener
`exists=false` → „Host hat das Spiel beendet" → `leaveOnline()` warf den Spieler
mitten aus dem zweiten Beitritt/Matchmaking. Erst ein Seiten-Reload räumte auf.

- `subscribe`/`subscribeRaw`: `stop()` ruft jetzt die von `onValue()` zurückgegebene
  Unsubscribe-Funktion auf (statt wirkungslosem `off(ref,'value',unsub)`).
- `guestStateHandler`: Schutz-Guard — reagiert nur noch, wenn wirklich eine
  Online-Gast-Session aktiv ist (`online && myRole !== 1`); ein verwaister Listener
  kann keine neue Session mehr beenden.
- Test-Mock (`test_fortress.js`): `onValue` gibt jetzt wie die echte SDK eine
  Unsubscribe-Funktion zurück (die alte Mock-Semantik hatte den Bug unsichtbar gemacht).

**Phasenzeiten (Klarstellung nach v3.14.9):** Bauphase wieder **25s** (v3.14.9 hatte
fälschlich die Bauzeit gekürzt); stattdessen Schussphase **25s → 20s** gekürzt.

Tests grün. SW-Cache `fortress-v3.14.11`.

### v3.14.12 — Flow-Exklusivität + gerätestabile Matchmaking-Identität
Zwei Findings vom Test mit einem fabrikneuen Zweitgerät behoben:

**Finding 1 — Tutorial kaperte die Matchmaking-Session:** Auf einem frischen Gerät
existiert beim App-Start noch kein Profil → das Onboarding-Popup (Effect auf
`profile?.id`) erschien erst NACH der Profilerstellung — auch mitten über dem
Matchmaking-Screen (technisch `screen==='menu'`). Beim Schließen startete
`finishOnboarding()` das Erstspieler-Tutorial, `startGuidedTutorial()` setzte zwar
`mpScreen=null`, brach aber das Matchmaking NICHT ab: `mmActive`, Queue-Listener,
`mmTick`-Heartbeat und Ticket liefen unsichtbar hinter dem Tutorial weiter. Betrat
der zweite Spieler die Queue, matchte die Hintergrund-Maschinerie mitten ins
Tutorial hinein (Hybrid aus Bot-/Tutorial-/Online-Zustand).
- Onboarding-Popup erscheint nur noch im untätigen Hauptmenü (kein `mpScreen`,
  kein `mmActive`, kein `online`) und wird nachgeholt, sobald der Spieler dorthin
  zurückkehrt (Effect-Deps: `profile?.id, screen, mpScreen`).
- Tutorial-Autostart in `finishOnboarding()` ebenso nur im untätigen Menü.
- `startGuidedTutorial()`: Hard-Guards — bricht bei `online` ab; laufendes
  Matchmaking wird zuerst sauber via `cancelMatchmaking()` beendet.
- Online-Einstiege (`startMatchmaking`, `hostCreateGame`, `guestJoinGame`) setzen
  defensiv `botMode=false, tutorialMode=false`.
- `startMatchmaking` ist idempotent: `stopMatchmakingListeners(false)` am Anfang —
  nie zwei parallele mmTick-Loops.

**Finding 2 — Selbst-Match („mit sich selber gejoint"):** Die Selbst-Erkennung
hing an `pid = profile?.id || SESSION_ID`. Bei Erstspielern ohne Profil bzw. nach
Reload/App-Neustart (neue SESSION_ID) galt das eigene verwaiste Ticket als fremder
Gegner — mit ELO-Differenz 0 sogar als BESTER Kandidat.
- Neue `DEVICE_ID` (localStorage `fortress_device_id`, einmalig pro Gerät erzeugt,
  überlebt Reloads). Ticket trägt jetzt `dev: DEVICE_ID`; `pid`-Fallback ist die
  DEVICE_ID statt SESSION_ID.
- Alle drei Selbst-Filter prüfen zusätzlich `dev`: Kandidatensuche
  (`mmTryFindMatch`), Claim-Sicherung (`mmClaimAndMatch`, löscht eigene
  Zombie-Tickets), Alt-Ticket-Bereinigung beim Queue-Beitritt.

Tests grün. SW-Cache `fortress-v3.14.12`.

### v3.14.13 — Matchmaking skaliert: deterministisches globales Pairing
**Frage „funktioniert die Queue auch mit 10/50/100 Spielern?" → Nein, tat sie nicht.**
Schwarm-Test (20 simulierte Clients) deckte einen Livelock auf: Im alten Verfahren
wählte jeder Client seinen ELO-nächsten Wunschgegner und claimte nur, wenn seine
eigene Session-ID kleiner war als die ALLER Gewählten — sonst wartete er darauf,
selbst geclaimt zu werden. Der Wunschgegner bevorzugt aber oft einen Dritten: ab
~15 Wartenden entstehen Präferenz-Ketten, in denen NIEMAND claimen darf →
Stillstand (reproduzierbar: nur 8/20 gematcht, 12 Tickets für immer in der Queue).

**Neues Verfahren (serverlos, Spark-kompatibel):**
- Alle Clients berechnen aus demselben Queue-Snapshot dieselbe Zuteilung:
  Warteliste deterministisch sortiert (ELO, dann Session-ID als Tie-Break),
  gierige Bildung benachbarter 2er-/3er-Gruppen (paarweise im ELO-Radius,
  der mit der Wartezeit wächst — `ts` aus dem Ticket, für alle sichtbar).
- Pro Gruppe claimt GENAU der Client mit der kleinsten Session-ID (wird Host);
  alle anderen warten passiv auf ihren `matched`-Status. Kein Wunsch-Voting,
  keine Ketten, garantierter Fortschritt.
- Claim-Ablauf gehärtet: Der Claimer setzt ZUERST sein EIGENES Ticket atomar
  auf `claiming` (Transaktion). Damit ist die Race „gleichzeitig claimen und
  geclaimt werden" (Snapshot-Versatz) geschlossen: Wer nicht mehr `waiting`
  ist, kann nicht geclaimt werden; wer schon geclaimt wurde, bricht ab und
  folgt dem Match. Alle Fehlerpfade geben Kandidaten UND eigenes Ticket frei.
- `startMatchmaking` räumt direkt vor der Timer-Neuanlage auf (nie zwei
  parallele mmTick-Intervalle nach Doppelklick/Rejoin).
- Debug-Fenster `window.__mmDebug`/`__mmDbg` (opt-in, kostenlos wenn aus) für
  künftige Matchmaking-Diagnosen.

**Empirisch validiert** (Schwarm-Diagnose, Mock-Firebase, Echtzeit-Ticks):
20/20 Clients gematcht in 6,5s (10 Spiele), 40 Clients → 20 Spiele, Queue leer.
Skalierungsgrenzen jetzt extern: Spark-Plan erlaubt 100 simultane Verbindungen
(hartes Limit, inkl. laufender Spiele) — genug für die aktuelle Phase; darüber
wäre der Monetarisierungs-/Blaze-Moment (siehe Kostenpolitik).

Tests grün. SW-Cache `fortress-v3.14.13`.

### v3.14.14 — Matchmaking-Spiele ohne Rematch (echtes Ranked-Verhalten)
Matchmaking-Spiele (Quick Match) enden jetzt wie in richtigen Ranked-Games:
Ergebnis + ELO ansehen → zurück ins Hauptmenü → neues Matchmaking starten.

- Neuer Ref `mmMatched`: true bei Spielen aus dem Matchmaking (`mmBecomeHost` /
  `mmJoinMatchedGame`), false bei Code-Spielen (`hostCreateGame` / `guestJoinGame`).
- Ergebnisbildschirm bei Matchmaking-Spielen (Host UND Gast): nur noch ein
  prominenter „Hauptmenü"-Button + Hinweis (`mmResultHint` DE/EN). „Nächste
  Runde" und „Neue Karte" gibt es dort nicht mehr — bei Code-Spielen mit
  Freunden und lokalen Spielen bleiben sie erhalten.
- Ergebnisbildschirm ist jetzt „Disconnect-sicher": Verlässt ein Spieler das
  Match zuerst (Knoten gelöscht bzw. keine State-Pushes mehr), wird der andere
  NICHT mehr per warnHostEnded/warnHostLost von der ELO-Anzeige geworfen —
  Knoten-Löschung und 30s-Watchdog werden auf `screen==='result'` ignoriert.

Tests grün. SW-Cache `fortress-v3.14.14`.

### v3.14.15 — Lifecycle-Hygiene: Queue & DB nach jedem Match garantiert sauber
Architektur-Audit aller Online-Ausstiegspfade; Ziel: nach JEDEM Spielende/Abbruch
kann sofort wieder gematcht werden, ohne dass Leichen (Tickets, Timer, Knoten)
den nächsten Beitritt stören.

- **Zentraler Teardown in `cleanupGame`** (läuft bei jedem Online-Ausstieg):
  räumt jetzt auch den Gast-Beitritts-Watchdog (`mmWatchdog`) ab — der feuerte
  sonst nach Abbruch des Wartescreens später und startete UNSICHTBAR ein neues
  Matchmaking (Zombie-Resurrection). Gibt reservierte Kandidaten-Tickets frei
  (`mmPendingCandidates` → DB-Delete), stoppt notfalls noch aktive
  Queue-Maschinerie (inkl. eigenes Ticket) und nullt `mmMatched`/`mmMyTicket`.
- **Abbruch-sichere Claims**: `mmClaimAndMatch` prüft an drei Punkten
  (nach Selbst-Claim, nach Kandidaten-Claims, nach Spielanlage), ob die Suche
  inzwischen abgebrochen wurde → gibt Kandidaten frei, löscht ggf. den frisch
  angelegten Spielknoten. `releaseSelf` löscht das eigene Ticket nach Abbruch,
  statt per Patch einen status-losen Stub wiederauferstehen zu lassen.
- **Crash-Marker `fortress_my_game`** (localStorage `{code, ts}`): wird bei
  jeder eigenen Spielanlage gesetzt und beim sauberen Löschen entfernt. Bleibt
  er nach App-Absturz/Tab-Kill liegen, löscht `gcOwnStaleGame()` den verwaisten
  eigenen Spielknoten beim nächsten Online-Einstieg (nur Marker >30 Min —
  ein zweiter Tab mit laufendem Spiel bleibt unberührt). Fremde Knoten kann
  kein Client aufräumen (Rules verbieten Auflisten der games-Collection).
- **Tote-Lobby-Timeout (Gast)**: beigetreten, aber nie State empfangen
  (Host verschwand vor Spielstart) → nach 45s sauber zurück ins Menü
  (`warnHostLost`) statt endlosem Wartescreen.

Tests grün. SW-Cache `fortress-v3.14.15`.

### v3.14.16 — Bot-Spiele mit echten Namen statt P1/P2
- **Neue Konstanten** `BOT_NAMES` (50 witzige Burgen-/Belagerungs-Fantasy-Namen,
  z.B. „Sir Bröckelbert von Bruchstein", „Katapulta die Ungeduldige",
  „Zugbrücken-Zacharias") und `BOT_WAPPEN` (Wappen-Pool für Bots).
- **`initBotMatchIdentity()`**: Wird bei beiden Bot-Starts (Übung gegen Bot +
  Tutorial) aufgerufen. P1 = eigenes Profil (Name, Wappen, Farbe); P2 = pro
  Spiel zufällig gezogener Bot-Name + zufälliges Wappen.
- **HUD**: zeigt bei `botMode` jetzt die `playerInfo`-Namen/Wappen (wie online)
  statt „P1"/„P2" — der eigene Name bekommt den „(Du)"-Suffix. Lokale
  Hotseat-Spiele (2 Menschen an einem Gerät) behalten P1/P2.

Tests grün. SW-Cache `fortress-v3.14.16`.

### v3.14.17 — 3-Spieler-Online verifiziert + Gast-Rejoin-Bug behoben
**Systematische 3P-Online-Prüfung** (neue Diagnose: Code-Join mit 2 Gästen,
Phasen-Sync, Quick-Match-Tripel über queue3, Gast-Ausstieg mitten im Spiel,
Runde 2, Queue-Hygiene) deckte einen schweren, NICHT 3P-spezifischen Bug auf:

**`screenRef`/`screen`-Drift (Gast-Rejoin-Bug):** `leaveOnline()` und der
lokale `quitGame`-Pfad setzten beim Ausstieg nur den React-State
(`setScreen("menu")`), aber NICHT `screenRef.current`. Ein Gast, der mitten
im Spiel ausstieg, behielt `screenRef="game"`. `applyState` wechselt den
Screen nur bei Differenz zum Ref (`newScreen !== screenRef.current`) — beim
nächsten Online-Beitritt kam `screen:"game"` → keine Differenz → kein
`setScreen`. Folge: Der Spieler hing für immer im Hauptmenü, während seine
Refs unsichtbar im Spiel waren (sein Name erschien beim Gegner im HUD!).
Fix: `screenRef.current` wird an allen drei `setScreen("menu")`-Stellen
mitgesetzt (leaveOnline, quitGame lokal, Ergebnis-Hauptmenü lokal).

**Neue Test-Suite `suiteOnline3P`** (läuft bei jedem Testlauf mit):
3P-Code-Join (Host + 2 Gäste), Phasen-Sync aller drei Clients,
Quick-Match-Tripel, Gast-Ausstieg + Rejoin (Regression für den
screenRef-Bug), queue3-Hygiene. Gated Debug: `window.__myRole` +
`window.__guestDbg` (nur bei `__mmDebug`).

3P-Diagnose 4× komplett grün (inkl. deterministischem Gast-zuerst-Ausstieg).

Tests grün. SW-Cache `fortress-v3.14.17`.

### v3.15.0 — Welt-Themes: 7 Welten, zufällig pro Spiel
Jedes Spiel spielt jetzt in einer von **7 zufälligen Welten** — komplette
Farbwelten für Untergrund, Bodentextur, Fluss (inkl. Glow + Ufer +
Schimmer-Animation), Berge und Ambient-Partikel:

| Welt | Charakter |
|---|---|
| 🔮 Kristalltal | das bisherige Navy/Teal-Design |
| ❄️ Frostreich | Eisblau, gefrorener Fluss, weiße Gipfel, Schneepartikel |
| 🏜️ Glutwüste | warmer Sand, türkise Oase, Sandstein-Berge, Goldstaub |
| 🌋 Vulkanschlund | Basaltschwarz, GLÜHENDER LAVA-Fluss, Glut-Funken |
| 🐸 Nebelmoor | Sumpfgrün, giftgrünes Wasser, Glühwürmchen |
| 🍂 Herbstwald | warmes Braun/Rost, kühler Fluss als Kontrast, Blätter |
| ✨ Astralebene | Violett-kosmisch, Magenta-Energiefluss, Sternenstaub |

**Technik:**
- `WORLD_THEMES` (14 Farb-Slots pro Thema) + `worldThemeOf(seed)`.
- Deterministische Wahl: `seed % 7` aus dem Terrain-Seed → **online automatisch
  synchron** (Host und Gäste teilen den Seed über den State, null
  Protokoll-Änderung; gilt für 2P und 3P, lokal, Bot und Tutorial).
- Alle Theme-Farben laufen über den bestehenden Offscreen-Render (`bgCanvas`,
  nur bei `bgDirty` neu gezeichnet) — keine Performance-Änderung.
- Dezenter Welt-Namenszug unten links im Terrain (innerhalb der
  Flip-Transformation gezeichnet — steht auch bei P1-Flip nie kopf).
- Visuell verifiziert: Screenshots aller 7 Welten (Seed-Erzwingung).

Tests grün. SW-Cache `fortress-v3.15.0`.

### v3.15.1 — Design-Overhaul der Welten (moderner Game-Art-Look)
Kompletter visueller Umbau des Terrain-Renderers im Stil moderner Mobile-Games:

- **Organischer Fluss (Metaball-Look)**: 4-Pass-Rendering — Uferband
  (Theme-Farbe `bank`), Wasserkörper mit Glow, durchgängiges helles
  Strömungsband (Kreisradius > halber Zellabstand → verschmilzt), elliptische
  Glanzlichter an der Oberkante. Keine Pixel-Kacheln mehr.
- **Gemalter Boden**: 12 große weiche Farbinseln (Radial-Verläufe) + hash-
  gestreute weiche Bodenflecken (Farbe → transparent, Positions-Jitter) —
  kein Raster-/Bubble-Muster.
- **Plastische Berge**: weicher Bodenschatten (Ellipse), Licht-/Schatten-
  Facetten (Licht von links oben), Kantenlicht, Gipfelkappe.
- **Thematische Deko-Props** (~34 pro Karte, seeded via eigenem Deko-RNG →
  auf allen Clients identisch): Bäume/Büsche (Frostreich, Nebelmoor,
  Herbstwald), Kristalle/Scherben (Kristalltal, Vulkanschlund, Astralebene),
  Kakteen (Glutwüste) — jeweils mit Bodenschatten, Licht-/Schattenseite und
  Akzent; nur auf freiem Boden mit Abstand zu Wasser/Bergen.
- **Theme-Slots erweitert**: `bank`, `propType`, `props [hell, dunkel, akzent]`.
- **Welt-Badge**: Pill mit Theme-Kantenfarbe statt einfachem Rechteck.
- Alles weiterhin im einmaligen Offscreen-Render (bgDirty) — keine
  Laufzeit-Kosten. Visuell verifiziert über Screenshots aller 7 Welten.

Tests grün. SW-Cache `fortress-v3.15.1`.

### v3.15.2 — Matchmaking-Review: Selbst-Match-Race + Uhren-Immunität
Komplettes Review nach erneutem Selbst-Match-Report. Drei Findings:

**Finding 1 (KRITISCH, die Selbst-Match-Ursache):** `mmClaimAndMatch` patchte
am Ende das EIGENE Ticket auf `{status:'matched', code, role:1}`. Echtes
Firebase pusht dieses Update sofort zurück in die eigene Queue-Subscription →
`mmOnQueueUpdate` behandelte es bedingungslos als Fremd-Match →
`mmJoinMatchedGame` zwang role 1→2 → der designierte HOST jointe als GAST 2
in sein EIGENES Spiel (guestAction2 = eigenes Profil) und wurde eine
Millisekunde später zusätzlich Host → „Spieler connected mit sich selbst".
Die Test-Mocks (onValue = 120ms-Polling statt Push) trafen dieses Fenster
praktisch nie — deshalb blieben alle Suites grün.
- Fix 1: Own-Patch ENTFERNT (hatte keinen Konsumenten; mmBecomeHost löscht
  das Ticket ohnehin sofort).
- Fix 2: `mmOnQueueUpdate` befolgt `matched` nur noch bei echten
  Fremd-Matches (`!mmBusy && claimBy !== SESSION_ID && role !== 1`).
- Fix 3 (Tiefenverteidigung): `mmJoinMatchedGame` verweigert Rollen ≠ 2/3
  und joint nie in ein Spiel, das der Client selbst hostet.
- Regressionstest: nach Quick Match müssen BEIDE Namen in BEIDEN HUDs stehen.

**UI:** „Match beendet"-Hinweis-Box auf dem Ranked-Ergebnisbildschirm entfernt
(Nutzerwunsch) — nur noch der Hauptmenü-Button.

**Finding 2 (Uhren-Skew):** Verwaist-Check verglich lokale Uhr mit fremden
Zeitstempeln (`now − tk.hb > 35s`) — Geräte mit >35s Uhrabweichung löschten
permanent fremde, frische Tickets („Queue immer leer"). Fix: beobachtungs-
basierte Staleness (`mmHbSeen`-Map): verwaist erst, wenn sich das hb über
35s EIGENER Beobachtung nicht ändert. Komplett uhren-immun.

**Finding 3 (klein):** Der 6s-Claim-Heal konnte das eigene Ticket während des
EIGENEN laufenden Claims auf `waiting` zurücksetzen (Dritter hätte einen
aktiven Claimer claimen können). Fix: kein Self-Heal bei
`claimBy === SESSION_ID && mmBusy`.

Tests grün. SW-Cache `fortress-v3.15.2`.

### v3.15.3 — Theme-Sync für Gäste + Geister-Tickets endgültig eliminiert
**Finding A — Spieler sahen online unterschiedliche Welten:** `applyState`
hängte im 2P-Zweig den `seed` NICHT ans Terrain-Objekt (nur der 3P-Zweig tat
es) → Gäste renderten `worldThemeOf(undefined)` = immer Welt 0 (Kristalltal),
der Host die echte Seed-Welt. Fix: seed in beiden Zweigen + Fallback auf
`terrainSeed.current` im Renderer.

**Finding B (kritisch) — Dritter matchte sich mit Spielern im laufenden
Spiel:** Blinde `fb.patch`-Freigaben (releaseAll/releaseSelf/Claim-Heal)
konnten auf inzwischen GELÖSCHTE Tickets treffen und erschufen dabei
besitzerlose `{status:'waiting'}`-GEISTER — voll matchbar. Ein neu
ankommender Spieler claimte den Geist und „connectete" sich scheinbar mit
einem Spieler, der längst im Spiel war. Gehärtet auf fünf Ebenen:
1. Alle Freigaben transaktional („nur wenn Ticket noch existiert") —
   `reviveToWaiting`; gelöscht bleibt gelöscht.
2. Claim-Heal transaktional (statt get+patch).
3. Heartbeat transaktional — nie mehr `{hb}`-Stubs auf gelöschten Pfaden.
4. Kandidatensuche verlangt Wohlgeformtheit (`ts` UND `pid`/`dev`) —
   erkannte Geister werden sofort gelöscht.
5. Claim-Transaktion verlangt `current.ts` — Geister sind nie claimbar.
Plus: `mmJoinMatchedGame` prüft vor dem Reserve, ob das Spiel noch existiert
(veralteter matched-Status erzeugte sonst Orphan-Knoten + ewiges Warten).

Tests grün. SW-Cache `fortress-v3.15.3`.

### v3.15.4 — Fahnen entfernt (freie Sicht auf die Mauern)
Burg-Fahnenmast+Wimpel und der Neon-Wimpel über jeder Kanone (ragten bis zu
2 Zellen nach oben) sind entfernt — sie verdeckten die Mauerreihen darüber.
Das runde Wappen-Emblem auf dem Burgkörper bleibt (verdeckt nichts).

Tests grün. SW-Cache `fortress-v3.15.4`.

### v3.15.5 — Performance-Overhaul: Sprite-Caching (Lag ab ~15 Kanonen behoben)
Nutzerreport: langes Spiel mit 15+ Kanonen wurde auf dem Handy laggy.
Audit des Frame-Loops fand vier mit der Objektzahl skalierende Kostentreiber —
alle über einmaliges Offscreen-Vorrendern (Sprites) eliminiert:

1. **Mauern/Trümmer** (`drawWall`/`drawRubble`): erzeugten pro Zelle pro Frame
   einen Gradient + ~6 Pfad-Ops (bei 600 Mauerzellen ~36.000 Ops/s). Jetzt:
   4 einmalig gebackene Zell-Sprites, pro Zelle nur noch EIN drawImage.
2. **Kanonen** (`drawCannonFull`): 2 Gradients + 2 shadowBlur pro Kanone pro
   Frame — einer mit ANIMIERTEM Blur-Radius (für den Browser uncachebar;
   der Mobile-Killer schlechthin). Jetzt: Kuppel- und Rohr-Sprite pro Spieler
   (Mündungsglühen einmalig eingebacken), Rohr rotiert als Blit;
   Ready-Ring pulsiert über Alpha/Linienbreite statt shadowBlur.
3. **Bälle im Flug**: shadowBlur 12 + Radial-Gradient pro Ball pro Frame —
   bei 15 Kanonen bis zu 15 Bälle gleichzeitig, genau in der Ruckel-Phase.
   Jetzt: ein Ball-Sprite pro Spieler, skaliert geblittet.
4. **Zonen-Overlay**: >1000 fillRects pro Frame, obwohl sich Zonen nur mit dem
   Grid ändern. Jetzt: Offscreen-Canvas, gecacht per gridVersion, pro Frame
   ein drawImage. Burg-Wappenglühen: Radial-Verlauf statt shadowBlur.

**Gemessen** (gated Metrik `window.__perfDbg` → `__frameMs`, 45s Bot-Spiel):
Ø 1,07→0,62 ms (−42%), p95 1,60→0,70 ms (−56%), Max 4,0→2,5 ms — auf
Desktop-Hardware bei kleiner Szene; auf Mobil-GPUs (teure Blur-Pässe) und
vollen Endgame-Karten ist der Effekt um ein Vielfaches größer, und die
Kosten pro Objekt sind jetzt konstant klein (Blit) statt Gradient+Blur.

**Regel (nicht verletzen):** NIE Gradients oder shadowBlur pro Objekt pro
Frame im Render-Loop — Statisches gehört in den Sprite-Cache (`SPR`).

Tests grün. SW-Cache `fortress-v3.15.5`.

### v3.16.0 — Schrott-Ökonomie: In-Match-Levelsystem mit Shop (Konzept-Feature)
Löst die Kanonen-Inflation langer Spiele: Kanonen sind nicht mehr gratis,
Zerstören lohnt sich, und übers Match entsteht ein Level-/Aufrüst-Gefühl.

**⚙ Schrott (In-Match-Währung, getrennt vom Meta-Gold):**
- Gegnerische Mauer zerstört: **+1** · Gegnerische Kanone zerstört: **+12**
- Überlebens-Sold: **+6** je Rüstphase (pro aktivem Spieler)
- KEIN Schrott für Burg-Treffer (nicht farmbar) und keinen Dicht-Bonus
- **Match-persistent**: Schrott + Upgrades überleben den Rundenwechsel
  (Level-Gefühl übers ganze Match); nur ein neues Spiel resettet. Pro Runde
  (neue Karte) resetten nur `wallHp` und die Kanonenpreis-Staffel.

**Rüstphase (ehem. Kanonenphase, 12s → 15s) mit Shop (4 Karten):**
- 🧨 **Kanone** ⚙20 (+8 je Kauf — Selbstlimitierung statt hartem Cap)
- ⚡ **Schnellladen** ⚙25/⚙50 (global −20% / −35% Nachladezeit — passt zur
  Ein-Gesten-Steuerung, `reloadMsOf(player)` ersetzt festes RELOAD_MS)
- 🛡 **Panzermauern** ⚙35 (Mauern halten 2 Treffer; 1. Treffer = Riss-Overlay,
  `wallHp`-Map, online synchron)
- 🔧 **Reparatur** ⚙15 (nächste Bauphase: bis zu 3 Trümmer nahe der eigenen
  Burg werden wieder zu Mauern)
- **Der stupide Gratis-Kanonen-Nachschub (+1/Runde) ist ABGESCHAFFT** —
  nur die 2 Setup-Kanonen sind frei. Rüstphase wird auf 4s verkürzt, wenn
  niemand Budget oder ≥15 Schrott hat.

**Kanonen-Explosion:** Zerstörte Kanonen reißen im 3×3 auch die MAUERN des
Besitzers mit (Kill öffnet die Hülle; +1 Schrott je Mauer an den Schützen).

**Technik:** Host-autoritativ (`scrap`/`upgrades`/`wallHp` im State; Gäste
senden `buy`-Action, `sanitizeAction` erweitert). Bot kauft selbst (Kanone →
Schnellladen → Panzerung). Gated Debug: `__buys`, `__econ`, `__botSelfPlay`
(Zwei-Bot-Selbstspiel in botTick). Phasen-Banner/Coach-Texte auf Rüstphase
umgestellt. Balance-Validierung im Echtzeit-Selbstspiel (Kauf-Loop
nachgewiesen); Suite-Test „Schrott-Shop in Rüstphase sichtbar".

Tests grün (195). SW-Cache `fortress-v3.16.0`.

### v3.16.1 — Rüstphase immer 15s + sichtbares Schrott-Farming
- **Rüstphase konstant 15s** (Nutzer-Feedback „Timer buggy"): Die Auto-
  Verkürzung auf 4s („niemand kann kaufen") ist entfernt — konsistente
  Phasendauer zum Planen. Der Schnellvorlauf nach Platzierung gilt nur noch
  in der Setup-Phase.
- **„+N ⚙"-Popups**: Bei jedem Schrott-Zuwachs steigt ein goldener Betrag
  über der Burg des Verdieners auf (Canvas, Delta-Erkennung im Render-Loop →
  funktioniert auch beim Gast, der scrap nur über den State erhält;
  fillText-Konterflip hält die Schrift bei P1-Flip lesbar).
- **Permanenter Kontostand**: ⚙-Badge im HUD neben dem Punktestand beider
  Spieler — das eigene Konto (und das des Gegners) ist immer sichtbar.

Tests grün (195). SW-Cache `fortress-v3.16.1`.

### v3.16.2 — Preview-/Animations-Feinschliff (Nutzer-Feedback)
- **Baustein-Preview**: `liftedGhost` klemmt jetzt BEIDSEITIG (Zeile 1..ROWS−2,
  Spalte 1..COLS−2) — vorher konnte der Ghost über den Spielfeldrand hinaus
  zeigen: Vorschau teils unsichtbar, Platzierung schlug still fehl („Preview
  stimmt nicht mit Landeposition überein").
- **Rect-Drift-Schutz**: `canvasRect` wird während eines Drags sanft gedrosselt
  (400ms) neu vermessen — mobile Browserleisten kollabieren mitten im Drag und
  verschoben sonst den Ghost gegenüber dem Finger.
- **„+N ⚙"-Popups**: spawnen jetzt bildschirm-OBEN über der Burg (flip-bewusst;
  vorher beim gedrehten P1 unterhalb) und mit Stapel-Versatz, damit schnelle
  Serien lesbar bleiben.
- **Wappen-Glühen**: Radius CELL·1.05 → CELL·0.82 — passt wieder vollständig
  in den Burgkörper.

Tests grün (195). SW-Cache `fortress-v3.16.2`.

### v3.16.3 — Schrott-Popups am Trefferort + Phantom-Vorschau behoben
- **„+N ⚙"-Popups am EINSCHLAGSORT in Spielerfarbe** (Nutzerwunsch): Mauer-
  Treffer poppen an der zerstörten Zelle, Kanonen-Kills als Gesamtsumme an
  der Kanone, Überlebens-Sold an der eigenen Burg. Farbe = Verdiener
  (P1 hellblau, P2 hellrot, P3 mintgrün) → eindeutige Zuordnung. Wie
  `explosions` über den State synchronisiert (`scrapPops`) — Gäste sehen
  identische Popups. Delta-Erkennung von v3.16.1/2 ersetzt.
- **Phantom-Vorschau behoben** („Preview zeigt anderes als Platzierung"):
  `placePiece`/`placeCannon` übergaben dem Nachlege-Stein die ALTE
  Ghost-Position — nach jedem Bot-/Gegner-Zug blieb dadurch eine (oft graue)
  Geister-Vorschau auf dem Feld stehen und suggerierte eine falsche
  Platzierungs-Vorschau. Nachlege-Stein startet jetzt ohne Ghost.

Tests grün (195). SW-Cache `fortress-v3.16.3`.

### v3.16.4 — Startkapital für Rüstphase 1 + Reparatur verständlich gemacht
Zwei Nutzer-Rückfragen umgesetzt:
- **⚙15 Startkapital** (`startGame`): Damit ist schon in der ERSTEN Rüstphase
  eine echte Kaufentscheidung möglich (Reparatur ⚙15 sofort, oder mit den
  ersten Treffern die Kanone ⚙20).
- **Reparatur jetzt SOFORT + sichtbar** (war unverständlich, weil verzögert):
  Kauf verwandelt AUGENBLICKLICH bis zu 3 Trümmer im Umkreis der eigenen Burg
  (Chebyshev ≤10) zurück in Mauern (`repairRubble`), plus Toast „🔧 N Mauern
  repariert!". Die verzögerte Gutschrift zur nächsten Bauphase ist entfernt.
  Gibt es nichts zu reparieren, ist die Karte ausgegraut (Preis bleibt
  sichtbar, KEIN irreführendes „MAX" mehr — eigener `noNeed`-Zustand).

Tests grün (195). SW-Cache `fortress-v3.16.4`.

### v3.16.5 — Hand-Vorschau-Orientierung endlich gefixt (echte Ursache)
**Der langjährige „Preview zeigt andere Richtung als die Platzierung"-Bug —
korrekt diagnostiziert:** Es lag NICHT an der Feld-Vorschau (die stimmte immer
mit der Platzierung überein, identische Grid-Mathematik). Ursache war die
**Hand-Vorschau in der Toolbar** unten: Sie zeichnete den Stein in
Grid-Orientierung (Reihe 0 oben). Für Spieler 1 ist das Feld aber vertikal
gespiegelt (`scale(1,-1)`, sobald `p1Flipped` = Bot-/Online-Host-Spiel, 2
Spieler) → auf dem Feld liegt Grid-Reihe 0 UNTEN. Damit zeigte die
Hand-Vorschau den Stein vertikal gespiegelt gegenüber dem Feld-Ghost, den man
zieht — „das Element kommt nicht so wie in der Vorschau".
- Fix: Die P1-Hand-Vorschau spiegelt ihre Reihen jetzt (`maxR - r`), wenn
  `p1Flipped` aktiv ist → Hand-Vorschau und Feld zeigen dieselbe Richtung.
  Lokales Hotseat-Spiel (P1 nicht gespiegelt) und P2/P3 bleiben unverändert.

Tests grün (195). SW-Cache `fortress-v3.16.5`.

### v3.16.6 — Reset-Geste beim Platzieren wieder da
Verlorene Funktion zurückgebracht: Wer den Finger neu ansetzen will, zieht ihn
beim Bauen/Kanonen-Setzen auf die Vorschau-Leiste UNTERHALB des Spielfelds und
lässt los → die Platzierung wird abgebrochen (Ghost verworfen), man kann frisch
ansetzen. Kein versehentliches Setzen mehr an ungewollter Stelle.
- Erkennung: Der Canvas fängt den Pointer (`setPointerCapture`), daher feuert
  `pointerup` auch über der Toolbar. Loslassen mit `clientY > canvasRect.bottom`
  → abbrechen statt platzieren (Build UND Setup/Rüstphase).
- Visuelles Feedback: Sobald der Finger über der Leiste schwebt, wird der Ghost
  grau und zeigt „↺" (statt ✓/✗ bzw. ⊕) — man sieht, dass Loslassen zurücklegt.
- Regressionstest `Reset-Geste` (gated Zähler `window.__places[1]`): Cancel-Drag
  in der Setup-Phase erhöht P1s Platzierungen NICHT.

Tests grün (196). SW-Cache `fortress-v3.16.6`.

### v3.17.0 — Shop-Redesign auf Premium-Mobile-Niveau (rein optisch)
Kompletter visueller Neuaufbau des Rüstphasen-Shops im Stil moderner
Supercell-Games — KEINE neuen Features/Mechaniken, KEINE Balance-Änderung,
identische Upgrades/Preise/Wiring (`doBuy`, `max`/`noNeed`, Online-Sync).

- **Panel statt Leiste**: abgesetztes Glas-Panel (Verlauf, Innen-Highlight,
  weicher Schlagschatten, 20px-Radius, Slide-up-Entrance `shopRise`).
- **Header**: „⚒ RÜSTPHASE"-Label links + goldener Schrott-Chip rechts
  (Verlauf, Glanz, `shopCoinPulse` bei jeder Schrott-Änderung).
- **4 Upgrade-Karten** je in eigener Farbwelt (`SHOP_THEME`): glänzende
  runde Medaille mit maßgeschneidertem **SVG-Icon** (`SHOP_ICONS`) statt Emoji
  — Bombe mit Lunte (Kanone), Blitz (Schnellladen), Schild (Panzermauern),
  Schraubenschlüssel (Reparatur). Glow-Rahmen + sanftes Icon-Floaten +
  Lauf-Sheen bei leistbaren Karten; ausgegraut/entsättigt wenn nicht leistbar;
  grüner MAX-Chip bei ausgereizten Upgrades; Preis-Pille mit ⚙.
- **Animationen**: gestaffelte Karten-Einblendung (`shopCardIn`), Press-Scale,
  Kauf-Pop (`shopBuyPop`, via Remount-Key `shopBuyAnim`).
- Alles GPU-freundlich (CSS-Transforms/Filter), inline-SVG (self-contained,
  CSP-konform). Visuell abgenommen (Screenshots aller Zustände).

Tests grün (196). SW-Cache `fortress-v3.17.0`.

### v3.17.1 — Shop weicht der Kanonen-Platzierung
Nutzer-Bug: Nach dem Kanonenkauf verdeckte das Shop-Panel unten die eigene
Burg — dort konnte man die Kanone nicht platzieren.
- Sobald eine gekaufte Kanone auf Platzierung wartet (`cannonBudget[sp] > 0`),
  wird das Shop-Panel ausgeblendet → das ganze Feld ist frei. Es kommt zurück,
  sobald die Kanone gesetzt ist (Budget wieder 0).
- Stattdessen ein schmaler, nicht-blockierender Hinweis oben („🎯 Tippe aufs
  Feld, um die Kanone zu platzieren", DE/EN, `armoryPlaceHint`).

Tests grün (196). SW-Cache `fortress-v3.17.1`.

### v3.17.2 — Testsuite deckt den neuen Shop ab
Reine Test-/Absicherungs-Erweiterung (kein Spiel-Change):
- Premium-Shop-Struktur geprüft: 4 Karten, jede mit **SVG-Medaille** (kein
  Emoji), Preis-Pille/MAX, RÜSTPHASE-Header, goldener Schrott-Chip.
- v3.17.1-Verhalten deterministisch getestet: Kanonenkauf blendet das
  Shop-Panel aus (Feld frei) und zeigt den Platzier-Hinweis.
- Neuer gated Test-Hook `window.__grantScrap(p,n)` (nur bei `__mmDebug`),
  damit der echte Kauf-Flow im Test auslösbar ist (Bot kauft+platziert sonst
  im selben Tick — der Zwischenzustand ist nie sichtbar).

203 Tests grün (2 Läufe). SW-Cache `fortress-v3.17.2`.

### v3.18.0 — Kugel-Nachlauf bei Rundenende
Bisher verschwanden Kugeln, die beim Ablauf der Schussphase noch in der Luft
waren, ohne Wirkung — kein Treffer, keine Gutschrift.
- Sind bei Ablauf der Schussphase noch Kugeln in der Luft, bleibt die Phase
  kurz „shoot" (`shootSettling`), sodass sie normal einschlagen (Mauer-/Kanonen-
  Treffer + Schrott-Gutschriften). Erst wenn alle gelandet sind, wechselt das
  Spiel in die Rüstphase (`endShoot`). Sicherheits-Timeout 4s.
- Während des Nachlaufs sind keine neuen Schüsse mehr möglich (`fireMortar`).
- Host-autoritativ: der Host spielt die Kugeln aus und pusht State, Gäste sehen
  die Einschläge normal.
- Neue isolierte Testsuite `suiteBallSettle` (deterministisch via gated Hooks
  `__spawnBallAtEnemy`/`__setSettling`/`__readScrap`/`__phase`, alle
  call-time-gated auf `__mmDebug`): späte Kugel schlägt ein, Schrott wird
  gutgeschrieben, danach Rüstphase, keine Kugel verworfen.

Tests grün (208). SW-Cache `fortress-v3.18.0`.

### v3.18.1 — „Fertig"-Bestätigung in der Rüstphase
Neuer grüner **„✓ Fertig"-Button** unter den Shop-Karten: Wer fertig gekauft
hat oder nichts machen kann, bestätigt. Sobald ALLE aktiven Spieler (2 bzw. 3)
bestätigt haben, springt der Timer auf 3s — aber nur wenn er noch > 3 ist
(wie das Auto-Vorspulen im Setup).
- `armoryReady`-Ref pro Spieler, Reset bei jedem Rüstphasen-Start (`endShoot`).
- `checkArmoryReady()`: alle aktiven bereit + Timer > 3 → 3s.
- Nach Bestätigung: kompaktes „Bereit ✓ · Warte auf Mitspieler"-Panel statt Shop.
- Host-autoritativ: Gäste senden `ready`-Action; `armoryReady` im State
  synchronisiert. Bot bestätigt automatisch, sobald er nichts mehr
  kaufen/platzieren kann.
- Neue isolierte Suite `suiteArmoryReady`: Button sichtbar; alle bereit →
  Timer 15→3 (gated Hooks `__forceReady`/`__readTimer`/`__readReady`).

Tests grün (211). SW-Cache `fortress-v3.18.1`.

### v3.18.2 — Bugfix: Platzieren am unteren Feldrand wieder möglich
Regression aus v3.16.6 (Reset-Geste): Der eigene Spieler (unten, gespiegelt)
erreicht die untersten Bau-/Kanonen-Reihen, indem der Finger knapp UNTER den
Feldrand geht — der Ghost ist um `LIFT_ROWS` nach oben versetzt. Die Reset-Zone
(„Finger unter das Feld = abbrechen") begann aber direkt am Feldrand und fing
dadurch genau diese Platzierungen ab → man konnte ganz unten nichts mehr setzen.
- Reset-Schwelle von `bottom − 2` auf `bottom + (LIFT_ROWS+2)·Zellhöhe` gesenkt:
  knapp-unter-dem-Rand platziert wieder (untere Reihen), erst ein klar tiefer
  Drag in die Leiste bricht ab. Gilt für Bau- UND Setup-/Rüstphase.
- Reset-Regressionstest zieht jetzt entsprechend TIEFER; „nicht eingefroren"-
  Check mit großzügigeren Timeouts (paralleler Testlast-Flake entschärft).
- Hinweis: Das reine Unter-dem-Feld-Verhalten ist headless nicht testbar
  (Playwright routet gecapturte Pointer-Events nicht off-element wie ein echter
  Touchscreen) — auf echten Geräten greift die Logik.

Tests grün (211, 4 Läufe stabil). SW-Cache `fortress-v3.18.2`.

### v3.19.0 — Balancing: Kanonen-Kill-Ökonomie repariert (CANNON_HP 15→8)
Datengestützter Balancing-Pass (Bot-vs-Bot-Selbstspiel vermessen). Befund: Die
Schrott-Ökonomie ist überwiegend gut austariert — Kanone-vs-Schnellladen hat
einen sauberen Crossover (~3–4 Kanonen), Panzermauern/Reparatur sind fair
bepreist. EINE Stellschraube war kaputt:
- **CANNON_HP 15 → 8**: Eine Kanone brauchte 15 Treffer → ~2 Runden fokussiertes
  Feuer für einen +12-Kill = unwirtschaftlich → NIEMAND zerstörte Kanonen (genau
  das Ur-Problem, das die Ökonomie lösen sollte). Mit 8 HP ist ein Kill ~1 Runde
  fokussiertes Feuer → die stärkste Einkommensquelle (+12 Schrott) + die
  3×3-Explosion + das Verwehren einer Gegner-Kanone tragen jetzt die
  Zerstör→Verdien→Kauf-Schleife. Gegenspiel bleibt: Panzermauern verdoppeln die
  Trefferzahl bis zur Kanone, und Kanonenjagd kostet Tempo am Feind-Castle.
- Alle übrigen Preise/Einkommen UNVERÄNDERT (bewusst diszipliniert, ohne
  Playtest-Daten nicht mehr drehen als nötig).
- Neue isolierte Suite `suiteCannonKill` (gated Hooks): 8 Treffer zerstören eine
  Feindkanone und schreiben +12 Schrott gut.

Tests grün (214). SW-Cache `fortress-v3.19.0`.

### v3.19.1 — Bugfix: Online-Spiele resetten die Schrott-Ökonomie nicht
Nutzer-Report „Startschrott jedes Spiel unterschiedlich". Ursache: `startGame`
(lokal/Bot) setzt die Ökonomie auf ⚙15 zurück — `startOnlineGame` rief aber nur
`beginSetup()` auf (match-persistent, KEIN Reset). Dadurch schleppte jedes
Online-Spiel den Schrott/Upgrade-Stand des vorigen mit: 1. Spiel startete bei 0
(Ref-Default), Folgespiele beim Endstand des vorigen → jedes Mal anders.
- Reset in Helfer `resetEconomy()` ausgelagert (⚙15, keine Upgrades, keine
  angeknacksten Mauern); wird jetzt AUCH in `startOnlineGame` (Host) aufgerufen.
  Gäste erhalten den frischen Stand wie gewohnt über den State-Sync.
- Suite prüft: 2. Online-Spiel in Folge startet mit ⚙15 (nicht Carry-over).

Tests grün (215). SW-Cache `fortress-v3.19.1`.

### v3.19.2 — Shop: prägnante Tagline pro Karte + Info-Button mit Fakten
Neue Spieler wussten nicht, was jeder Kauf bewirkt (Karten zeigten nur Name +
Preis). Statt platzraubender Beschreibungszeilen jetzt zweistufig:
- **Tagline pro Karte** (winzig, in Item-Farbe unter dem Namen): Kanone „+1 extra",
  Schnellladen „schneller", Panzermauern „2 Treffer", Reparatur „+3 Mauern".
- **Info-Button** (ⓘ) im Shop-Header (links neben dem Schrott-Chip) öffnet ein
  Overlay `showShopInfo` mit allen Fakten: Verdienst-Tabelle (Mauer +1, Kanone
  +12, Überleben +6, Start ⚙15) und je Upgrade Icon + genaue Wirkung (inkl.
  Nachlade-Stufen 2,5s→2,0s→1,6s, Preis-Staffel Kanone 20→28→36).
- Rein additiv/optisch — keine Balance-/Mechanik-Änderung. Modal schließt bei
  Phasenende (`endCannon` → `setShowShopInfo(false)`) und rendert nur in der
  Rüstphase (`phase === "cannon"`-Guard), damit es Gäste beim Phasenwechsel nicht
  überlagert. i18n de/en vollständig.

Tests grün. SW-Cache `fortress-v3.19.2`.

### v3.19.3 — Fix: Kugeln werden bei FPS-Einbrüchen langsamer (zeitbasierte Bewegung)
Nutzer-Report „seit dem Balance-Update fliegen die Kugeln plötzlich langsam /
werden langsamer beim Schießen". Ursache: Kugel-Fortschritt lief **pro Frame**
(`ball.prog += 1 / ball.dur`), nicht pro Zeit. Seit der Schrott-Ökonomie sind
mehr Objekte auf dem Feld (Riss-Sprites, Schrott-Popups, länger überlebende
Kanonen) → FPS sinkt im Gefecht → jede Kugel bewegt sich pro Frame gleich weit,
aber es gibt weniger Frames pro Sekunde → real langsamer. `ball.dur` selbst war
unverändert (`Math.max(30, 26 + dist*0.09)`).
- Neuer `frameScale` im Render-Loop: `min(3, Δt / (1000/60))` (1 = 60fps-Norm,
  gedeckelt gegen Überschießen nach einem Stall), `lastFrameTime`-Ref.
- Beide Kugel-Pfade (Host + Gast) nutzen `ball.prog += frameScale / ball.dur`.
  Nachlade-Logik war bereits zeitbasiert. Einschlag bleibt endpunktbasiert
  (prog≥1) → kein Tunneling durch große Δt.
- Kugel-Geschwindigkeit jetzt konstant unabhängig von der Framerate/Geräteklasse.

Tests grün. SW-Cache `fortress-v3.19.3`.

### v3.19.4 — Performance-Pass: Per-Frame-Scans & Allokationen im Render-Loop entfernt
Folge-Arbeit zu „Performance ist absolute Priorität". Der Render-Loop war seit
v3.15.5 bereits stark optimiert (Sprite-Cache SPR, gecachtes Zonen-/BG-Overlay,
keine Gradients/shadowBlur pro Objekt). Verbleibende Overhead-Quellen beseitigt:
- **Wasser-Animation**: scannte pro Frame ALLE 44×68 = 2992 Zellen, um Wasser zu
  finden. Wasserzellen ändern sich nie innerhalb eines Spiels → jetzt einmal pro
  Terrain (`waterCellsRef`, Key = Seed) gecacht; pro Frame nur noch die echten
  Wasserzellen (~100–300) iteriert.
- **Riss-Overlay**: `wallHp.current[r+'_'+c]` erzeugte pro Mauerzelle pro Frame
  einen String (GC-Druck), obwohl `wallHp` meist leer ist (keine Panzermauern).
  Jetzt einmal `anyCrack`-Guard vor der Schleife → String-Concat nur wenn Risse
  existieren.
- **Kanonen**: `drawCannonFull` rief pro Kanone pro Frame `Date.now()` für den
  Ready-Puls. `now` (bereits im Loop vorhanden) wird jetzt durchgereicht.
Rein interne Optimierung, keine sichtbare/mechanische Änderung. Selbstmessung am
Gerät: `window.__perfDbg=true` → `__frameMs` (Zeichendauer je Frame, gated).

Tests grün (219). SW-Cache `fortress-v3.19.4`.

### v3.19.5 — Result-Screen: redundanten „Neue Karte"-Button entfernt
Nutzer-Report (Bot-Spiel): „Nächste Runde" und „Neue Karte" fühlen sich gleich
an. Grund: `nextRound()` ruft `initGrid()` → erzeugt eine **neue Zufallskarte**,
genau wie „Neue Karte" (`startGame()`). Einziger Unterschied war der Score
(Nächste Runde behält ihn, Neue Karte setzt auf 0), optisch aber „beide = neue
Karte". Im Nicht-Ranked-Result-Zweig (Bot/Lokal/Code-Join-Host) den sekundären
„Neue Karte"-Button gestrichen → nur noch „Nächste Runde" (primär, Score bleibt)
+ „Hauptmenü" (kompletter Neustart). Tote `onlineNewGame2`/Alias-Vars entfernt.
i18n-Keys `newMap` bleiben (ungenutzt, schadlos). Ranked-Zweig unverändert.

Tests grün (219). SW-Cache `fortress-v3.19.5`.

### v3.20.0 — Bot-Schwierigkeitsgrade Leicht/Mittel/Schwer (Meta-Progression Phase 2, Teil 1/4)
Umsetzung von SPEC-Abschnitt 14.1. Der Bot hatte genau eine Stärke (Streuung
1.0) — zu stark für Anfänger nach dem Tutorial, zu schwach als Warm-up.
- **`BOT_LEVELS`**: easy `{spread:2.4, fire:1.8, maxCannons:3, buy:'basic'}`,
  mid `{1.0, 1.0, 6, 'standard'}` (= bisheriges Verhalten, unverändert),
  hard `{0.4, 1.0, 8, 'optimal'}`. Zugriff via `botLvl()`; Tutorial nutzt
  immer 'mid'. Alte Ref `botDifficulty` entfernt.
- **Feuer-Drossel**: `botShoot` wartet `reloadMsOf(B) * lvl.fire` — der
  Leicht-Bot schießt fast nur halb so oft.
- **Einkauf je Stufe**: basic = nur gelegentlich Kanonen (50 %-Chance, max 3,
  keine Upgrades); standard = bisherige Reihenfolge Kanone→Reload→Armor;
  optimal = Armor→Reload→Kanone (stärkste Erstkauf-Reihenfolge) + Reparatur
  wenn Trümmer ≤10 Felder um die Bot-Burg (`botRubbleNearCastle`).
  `wantsMore` (Fertig-Bestätigung) folgt der Stufen-Strategie, sonst würde
  der Leicht-Bot nie bestätigen.
- **Bauverhalten unverändert** auf allen Stufen (offene Bot-Burg = kein Spaß).
- **UI**: „Übung gegen Bot“ klappt eine 3-Knopf-Reihe aus (😴 Leicht /
  ⚔️ Mittel / 💀 Schwer); Auswahl startet das Spiel. Letzte Wahl persistent in
  `fortress_bot_level`, vorausgewählt markiert. Einklappen bei Panelwechsel.
- Bot-Spiele zählen weiterhin nicht für ELO/Stats. i18n de/en.
- Test angepasst: Suite prüft 3 Stufen-Buttons und startet über „Mittel“.

Tests grün. SW-Cache `fortress-v3.20.0`.

### v3.21.0 — Match-Statistik + Result-Bilanz (Meta-Progression Phase 2, Teil 2/4)
Umsetzung von SPEC-Abschnitt 14.2 — die Zähler-Infrastruktur für Daily Tasks
(14.3) und die sichtbare Match-Bilanz.
- **`matchStats`-Ref** pro Spieler `{walls, cannons, scrap, shots, hits, buys}`;
  Helfer `msZero()`/`msOf(p)`. Inkremente: `fireMortar` (shots je Kugel),
  `impactAt` (walls/cannons/hits/scrap inkl. Explosions-Kollateral; Kanonen-
  HP-Treffer und Panzermauer-Riss zählen als Wirkungstreffer), Überlebens-Sold
  (scrap), `buyUpgrade` (buys).
- **Semantik pro Runde**: Reset in `resetEconomy()` (Spielstart) und
  `nextRound()`; Gast-Reset zusätzlich in `startOnlineGame` (bis der Host-Sync
  greift).
- **Online-Sync**: Feld `ms` im State-Push; `applyState` übernimmt mit
  `msZero()`-Fallback je Spieler → alle Geräte zeigen dieselben Zahlen.
- **Result-Screen**: 4-Kachel-Bilanz für den eigenen Spieler unter der
  Score-Zeile — 🧱 Mauern · 💣 Kanonen · ⚙ Schrott · 🎯 Präzision
  (hits/shots in %, „—“ ohne Schuss). i18n de/en.
- **Konsolidierung**: `blocksDestroyedThisGameRef` entfernt;
  `recordGameResult` liest Lebenszeit-Blocks jetzt aus `matchStats[meP].walls`.
  Nebeneffekt-Fix: Gäste bekamen bisher IMMER 0 Blocks gutgeschrieben
  (Host-only-Ref) — via synchronisiertem `matchStats` zählt es jetzt korrekt.
- Gated Hook `__matchStats(p)`; Suite prüft Kill-, Hit-, Scrap- und
  Wall-Zähler in den bestehenden Isolier-Suites.

Tests grün. SW-Cache `fortress-v3.21.0`.

### v3.22.0 — Daily Tasks (Meta-Progression Phase 2, Teil 3/4)
Umsetzung von SPEC-Abschnitt 14.3 — 3 rotierende Tagesaufgaben mit
Gold-Belohnung, der stärkste Retention-Hebel neben dem Streak.
- **Pool (8 Typen)**: walls30/80, cannons2, scrap60, play2/4, win1, buy3
  (Gold 25–50). Rotation deterministisch aus dem Datum (`makeRng(dateSeed)`,
  3 verschiedene) — alle Spieler desselben Tages sehen dieselben Aufgaben.
- **Persistenz**: `fortress_tasks` = `{day, tasks:[{id, prog, collected}]}`;
  neuer Tag ⇒ neue Rotation, alter Fortschritt verfällt.
- **Ernte**: `useEffect` auf `screen==="result"` liest `matchStats[meP]`
  (walls/cannons/scrap/buys) + Match-gespielt/-gewonnen; Guard
  `tasksHarvested` (Reset beim Verlassen des Result-Screens). Bot- UND
  Online-Matches zählen; Tutorial und lokales Duell am selben Gerät nicht.
  Effect-Timing garantiert: matchStats ist auf Host und Gast final, bevor
  geerntet wird.
- **Abholen**: Gold + `lifetimeGold` ins Profil (füttert Gold-Achievements);
  `collected`-Flag verhindert Doppelabholung.
- **UI**: 📋-Button neben dem Achievements-Button (Badge = abholbereite
  Aufgaben, Glow-Animation); Modal mit 3 Zeilen — Icon, Text, Fortschritts-
  balken x/Ziel, Gold-Chip bzw. „Abholen“-Button bzw. ✓. i18n de/en.
- Neue Suite `suiteDailyTasks`: Button, Modal (3 Aufgaben), Abhol-Flow
  (Seed prog→9999, Gold steigt, collected gesetzt).

Tests grün. SW-Cache `fortress-v3.22.0`.

### v3.23.0 — Gold-Shop: Kosmetik (Meta-Progression Phase 2, Teil 4/4)
Umsetzung von SPEC-Abschnitt 14.4 — die bislang fehlende Gold-Senke. Rein
kosmetisch, nur mit erspieltem Gold (kein Pay2Win, kein Echtgeld).
- **12 Artikel in 3 Kategorien** (`COSMETICS`, IDs mit Kategorie-Präfix):
  Kugel-Trails (Standard 0 / Glut 150 / Frost 150 / Gift 250 / Gold 400),
  Wappen-Rahmen (Kein 0 / Bronze 100 / Silber 250 / Gold 500 / Drache 800),
  Sieges-Effekte (Konfetti 0 / Feuerwerk 200 / Goldregen 350).
- **Datenmodell**: `profile.cosmetics = { owned:[ids], equipped:{trail,frame,win} }`;
  `cosOf(profile)` normalisiert (Gratis-Artikel implizit besessen).
- **Rendering**:
  - Trail: Kugel-Schweif nutzt `TRAIL_COLOR[playerInfo[p].trail]`, sonst
    Spielerfarbe — EIN Lookup pro Kugel pro Frame, keine neuen Per-Frame-Kosten.
  - Rahmen: Zierring + Glow um das Wappen im Menü-Profil (`FRAME_STYLE`).
  - Sieges-Effekt: `WinFx`-Komponente auf dem Result-Screen bei eigenem Sieg —
    Konfetti (bestehend), Feuerwerk (`fwBurst`-Keyframe, 6 Burst-Punkte),
    Goldregen (`coinFall`, 14 Münzen). Deterministisch, kein `Math.random()`.
- **Online-Sichtbarkeit**: `trail`/`frame` in beiden join-Payloads, im Host-
  `playerInfo` (Gast + Host-Selbst) und in `initBotMatchIdentity` → via
  bestehendem playerInfo-Sync sehen Gegner die Trail-Farbe der Kugeln.
  Fehlendes Feld (alte Clients) ⇒ Standard-Optik, abwärtskompatibel.
- **UI**: 🛒-Button neben 📋; Modal mit Gold-Chip, 3 Sektionen, Karten mit
  Vorschau (Farbkreis/Ring/Emoji), Preis bzw. „Besitzt“/„Angelegt ✓“.
  Kauf = Gold-Abzug + sofort angelegt; Umrüsten gratis. i18n de/en.
- Neue Suite `suiteGoldShop`: Kauf zieht Gold ab, owned/equipped korrekt,
  Umrüsten auf Gratis-Artikel ohne Gold-Abzug.

Tests grün. SW-Cache `fortress-v3.23.0`.

### v3.24.0 — Balancing-Messpass: Panzerung 35→45, Reparatur-Preis-Staffel
Datenbasierter Pass (Review-Punkt 5). **Messaufbau**: Bot-Selfplay
(`__botSelfPlay`), 2 Konfigurationen × 2 parallele Läufe × 7 Min bei
moderatem 4×-Tempo (Phasen ≥900ms→250ms, Bot-Tick 600→150ms — hält das
Verhältnis Bot-Aktionen/Phase; Nachladezeit bleibt Echtzeit → absolute Werte
verzerrt, aber beide Konfigurationen identisch verzerrt = relativer Vergleich
gültig). Kurze Degenerat-Spiele (Burg in Runde 1 nicht geschlossen,
15s-Artefakte des Speedups) aus der Wertung genommen.

**Daten (aussagekräftige lange Spiele):**
| Konfiguration | Spieldauer (4×-s) | Kanonen/Sp. Ende | Restschrott/Sp. |
|---|---|---|---|
| Mittel vs. Mittel (Kanone→Reload→Armor) | 59–113, Ø ~90 | 4 | 1–29, Ø ~12 |
| Schwer vs. Schwer, beide MIT Panzerung | **146–187** | 4–5 | **20–31** |

**Befunde & Entscheidungen:**
1. **Panzerung verlängert beidseitig gekaufte Spiele auf fast das Doppelte**
   und führt zu Schrott-Hortung (Verteidigung übersättigt). → Preis **35→45**:
   Panzerung landet erst Mitte des Matches statt in Runde 1–2, bleibt aber
   erreichbar. Neue Preisleiter: Kanone 20 < Reload 25 < Armor 45 < Reload II 50.
2. **Reparatur wurde in KEINEM Selfplay-Spiel gekauft** → keine Missbrauchs-
   Daten, aber der Flat-Preis (⚙15, beliebig oft) bleibt das strukturelle
   Patt-Risiko aus dem Review. → **Preis-Staffel 15→20→25…** (`repair:
   {base:15, step:5}`, Zähler `up.repair`, Reset pro Karte in `beginSetup`
   analog Kanonen-Staffel). 1–2 Notfall-Reparaturen bleiben billig, Dauer-
   Abo wird teuer. Präventiv, minimal-invasiv.
3. **Überlebens-Sold +6 unverändert**: Restschrott Ø ~12 = gesunde
   Ausgabenquote, keine Hortung im Normalspiel. Die Review-Idee
   (+Aggro-Kopplung) bleibt Hypothese — keine Änderung ohne Spielerdaten.
4. **CANNON_HP 8 unverändert**: lange Spiele enden weiterhin entscheidbar.

Umsetzung: `SHOP.armor.price=45`; `SHOP.repair={base,step}` an allen 3
Stellen (buyUpgrade, Shop-Karte, Schwer-Bot); `up.repair`-Inkrement +
Rundenreset; Shop-Info-Text erwähnt die Staffel. i18n de/en.

Tests grün. SW-Cache `fortress-v3.24.0`.

### v3.25.0 — Emotes im Online-Match (Review-Punkt 6)
6 vordefinierte Reaktionen (`EMOTES` = 👍 😄 😮 😡 🏰 💥) — bewusst kein
Freitext (keine Moderationslast, keine Übersetzung nötig).
- **Transport host-autoritativ**: Gäste senden `{type:'emote', e:Index}` als
  Action (sanitizeAction validiert 0–7); der Host prüft das Rate-Limit
  (3 s/Spieler, `emoteLastAt`), setzt `emoteCur = {p, e, n:seq}` und pusht —
  Gäste zeigen die Bubble ausschließlich über das State-Echo (Feld `emo`,
  Dedupe via Sequenznummer `emoteSeen`). Der Host zeigt lokal sofort.
- **UI**: 😊-Button links unten (nur online, `aria-label="Emote"`), klappt
  eine 6er-Leiste auf; Senden schließt die Leiste, lokale Sperre 3 s.
  Anzeige als Bubble oben mittig: großes Emoji + Spielername, Rand in
  Spielerfarbe, `badgePop`-Animation, auto-hide nach 2,6 s.
- Suite (Online-2P): Host sendet 👍 → eigene Bubble + Gast-Empfang via State;
  Gast sendet 😮 → Host-Empfang via Action→State (Emoji-Wahl kollidiert
  bewusst nicht mit Phasenbanner-Emojis 🏰/💥).

Tests grün. SW-Cache `fortress-v3.25.0`.

### v3.26.0 — Matchmaking-Wartezeit: Tipps-Karussell (Review-Punkt „Wartezeit nutzen“)
Der Queue-Screen zeigte nur Spinner + Sekunden — tote Wartezeit.
- **8 Gameplay-Tipps** (i18n `queueTip_0..7`): Kanonen-Ummauerung,
  Kanonen-Kill-Ökonomie, Panzermauern, Reparatur, Schnellladen,
  Abbrech-Geste, Überlebens-Sold, Daily Tasks.
- **Rotation ohne neuen Timer**: `tipIdx = floor(mmElapsed / 5) % 8` — nutzt
  den vorhandenen Warteschlangen-Ticker; `key`-Wechsel triggert die
  `badgePop`-Einblendung pro Tipp.
- Dezente Karte (Cyan-Rahmen, 💡 TIPP-Label) zwischen ELO-Radius und
  Abbrechen-Button. Suite prüft Sichtbarkeit im Suche-Screen.

Tests grün. SW-Cache `fortress-v3.26.0`.

### v3.26.1 — Fix: Gold-Shop-Käufe gingen verloren + Inventar im Profil
Nutzer-Report: „Der Shop soll permanent sein — wenn man etwas gekauft hat, dann
hat man es auch wirklich." Käufe wurden zwar in `profile.cosmetics` gespeichert,
aber ZWEI Whitelist-Stellen bauten das Profil ohne dieses Feld neu auf:
- `loadProfile()` — beim App-Start wurde `cosmetics` verworfen; bei Migrations-
  `needsSave` sogar sofort ohne Käufe zurückgeschrieben → Käufe endgültig weg.
- `saveProfileEditor()` — jede Profiländerung (Name/Wappen/Farbe) löschte die
  Käufe ebenfalls.
Beide reichen `cosmetics {owned[], equipped{}}` jetzt (sanitisiert) durch.
**Regel: Neue Profil-Felder MÜSSEN in beide Whitelists (loadProfile +
saveProfileEditor) aufgenommen werden** — alle anderen Speicherpfade nutzen
Spread und sind sicher.

Außerdem NEU: **Inventar im Profil-Editor** (🎒, zwischen Avatar-Galerie und
Speichern): zeigt alle besessenen Kosmetik-Artikel je Kategorie (Trails/Rahmen/
Sieges-Effekte) mit Preview; Tippen legt an (grüner Rahmen = angelegt, nutzt
`buyOrEquipCosmetic`, kauft hier nichts). Footer-Button „Mehr im Gold-Shop"
wechselt in den Shop. `WIN_EMOJI` auf Komponenten-Ebene gehoist (Shop + Inventar
teilen sie). i18n: `invTitle`, `invTapEquip`, `invMoreInShop` (de/en).

Tests grün (inkl. neuem Persistenz-Regressionstest). SW-Cache `fortress-v3.26.1`.

### v3.26.2 — Gold-Shop: Kauf-Bestätigungsdialog
Nutzer-Wunsch: „Es braucht ein Kaufen-bestätigen-Button, ob man sich sicher
ist." Bisher kaufte EIN Tipp auf eine unbesessene Karte sofort (versehentliche
Käufe möglich). Jetzt zweistufig:
- Tipp auf **unbesessenen** Artikel → Bestätigungs-Overlay (`confirmBuy`-State,
  z-Index über dem Shop): Artikel-Preview + Name, Preis-/Danach-Anzeige
  (Restgold, rot wenn nicht zahlbar), „✓ Kaufen" (Gold-Gradient) + „Abbrechen".
- Tipp auf **besessenen** Artikel → wie bisher direkt anlegen (gratis, keine
  Bestätigung nötig). Inventar im Profil unverändert (nur Anlegen).
- Abbrechen/Backdrop/Shop-Schließen setzen `confirmBuy` zurück — kein
  hängender Dialog. i18n: `confirmBuyQuestion/Price/After/Yes` (de/en).
- Suite: Kauf-Flow zweistufig getestet (Dialog erscheint, Abbrechen kauft
  NICHT + Gold unverändert, Bestätigen kauft + Restgold korrekt).

Tests grün. SW-Cache `fortress-v3.26.2`.

### v3.27.0 — UI-Politur: alle Emojis durch professionelle SVG-Icons ersetzt (+ Design-Regel)
Nutzer-Wunsch: „ersetze überall die Emojis mit professionellen Icons — mache das
auch als Regel." Das UI verwendet jetzt durchgängig die `Icon`-Komponente
(Lucide-Stil, `ICON_PATHS`, stroke-basiert).

**Neue Design-Regel (verbindlich, auch in CLAUDE.md):**
- KEINE Emojis im UI. Symbole laufen über `Icon`/`ICON_PATHS` (SVG).
- Erlaubte typografische Glyphen (monochrom): ✓ ✕ ⚠ ★ ← ↑ · sowie die
  Spiel-Glyphen ⚙ (Schrott-Währung) und ♔ ♚ ♜ (Spielerfarben).
- **Inhalts-Ausnahmen** (Emoji IST das Produkt/die Nachricht): `EMOTES`
  (Spieler-Kommunikation), `WIN_EMOJI`/WinFx-Goldregen (gekaufte
  Sieges-Effekte), `shareResult`-Text (externe Chat-Nachricht).

**Umgesetzt:**
- 27 neue `ICON_PATHS` (star, medal, award, gamepad, bomb, gem, barChart,
  trendingUp, rocket, sparkles, skull, lock, hammer, gradCap, save, clipboard,
  helpCircle, volume2, volumeX, vibrate, vibrateOff, shoppingCart, backpack,
  smile, lightbulb, moon …).
- Achievements: `icon`-Feld = ICON_PATHS-Name; Liste, Kategorie-Chips
  (`{key,icon,label}`), Hidden-? (helpCircle) und Unlock-Toast rendern `Icon`.
- Daily Tasks: Definitions-Icons (zap/bomb/gamepad/trophy/shoppingCart),
  📋-Menü-Button + Modal-Header → clipboard.
- Gold-Shop: 🛒-Button + Modal-Header → shoppingCart; Inventar 🎒 → backpack;
  Sektions-Titel ohne Emoji.
- Match-Statistik-Kacheln: 🧱💣⚙🎯 → zap/bomb/coins/target als Icon.
- Bot-Stufen: 😴⚔️💀 → moon/swords/skull (`icon`-Feld statt `emoji`).
- Menü/Einstellungen: „DE/EN" statt Flaggen, Sound → volume2/volumeX,
  Vibration → vibrate/vibrateOff; Emote-Auslöser 😊 → smile-Icon
  (EMOTE-Inhalte selbst bleiben Emojis).
- Profil: Galerie (sparkles), Locks (lock), Speichern/Erstellen (save/swords).
- Leaderboard: 🥇🥈🥉 → medal-Icon Gold/Silber/Bronze; Zeilen-Stats ohne
  🏆/💀; 3P-Tab crown.
- Queue-Tipp 💡 → lightbulb; Shop ⚒️ → hammer; Tutorial 🎓 → gradCap;
  Tutorial-Ende 🌐 → globe; Code einfügen 📋 → clipboard.
- Phasen-Banner: totes `emoji`-Feld entfernt; Welt-Badge (Canvas) ohne Emoji.
- i18n: Emojis aus Strings entfernt (resultWin, tipShoot, repairDone,
  armoryPlaceHint, coachDone, tutorialDoneTitle, profileCreate, onbStart,
  tasksAllDone, cosSection*, queueTip_7 …), de/en.
- Achievements-Modal: Schließen-Button mit `aria-label="Schließen"` (a11y).
- Tests: Modal-Titel/Schließen, 💡-Tipp, 📋/🛒-Buttons auf Icon-basierte
  Selektoren (title/aria-label) umgestellt.

Tests grün. SW-Cache `fortress-v3.27.0`.

### v3.28.0 — Hochwertige CC0-Sounds statt prozeduraler Töne
Nutzer-Feedback: „Die Sounds hören sich noch billig an." Die per Web-Audio-
Oszillator synthetisierten Töne sind durch kuratierte **CC0-Samples** ersetzt
(Public Domain, kostenlos — Zero-Cost-konform):
- **Quellen**: Kenney.nl (Impact Sounds, Sci-Fi Sounds, Casino Audio — CC0) und
  OpenGameArt.org („Classic fanfare lick" fanfare_3, „Game Over #10" — CC0).
- **Mapping**: shoot=explosionCrunch (Kanonendonner), impact=impactPlate_heavy
  (Steintreffer), destroy=lowFrequency_explosion (tiefes Grollen),
  place=impactWood (Baustein), buy=chips-handle (Schrott/Gold-Kauf),
  win=Orchester-Fanfare (2,9s), lose=Game-Over-Sting (1,4s).
- **Technik**: `sounds/*.mp3` (mono, 44,1 kHz, loudnorm −16 LUFS, ~88 KB gesamt).
  `SFX._load()` lädt+dekodiert beim ersten Pointer-Event (Autoplay-Policy),
  `SFX._play(name, vol)` spielt via BufferSource+Gain. Die alten prozeduralen
  Töne bleiben als **Fallback**, bis Samples bereit sind bzw. wenn der Codec
  fehlt (Playwright-Chromium dekodiert kein MP3 → Tests laufen unverändert).
- **Neu verdrahtet**: `SFX.place()` (war toter Guard-Aufruf) beim Platzieren;
  `SFX.buy()` im Rüstphasen-Shop (`doBuy`) und im Gold-Shop (ersetzt dort die
  unpassende win-Fanfare). Ungenutztes `SFX.cannon()` entfernt.
- Haptik/Vibrationsmuster und Sound-Toggle unverändert. SW precached die
  7 Dateien (offline/TWA-tauglich).

Tests grün. SW-Cache `fortress-v3.28.0`.

### v3.29.0 — Bau-KI: echte Versiegelungs-Intelligenz + Stufenwahl ohne Vorauswahl
Nutzer-Report: „Die Bots sind noch zu dumm und schließen nicht wirklich ihre
Burg" + „bei der Schwierigkeitswahl ist eins immer vordefiniert".
- **Bau-KI-Kernfix**: `botPlaceCovering` platziert Teile nur, wenn eine
  Teil-Zelle die Ziellücke WIRKLICH abdeckt (alle 4 Rotationen × Zell-Offsets).
  Vorher baute der Bot passende Teile NEBEN das Loch. Neuer Leck-Versiegler
  `botSealCastle` dichtet die Burg von innen nach außen und umbaut Trümmer in
  der Soll-Mauer (Umgehungs-Ring). Burg offen → kein Kanonen-Weiterbau.
  Details: Abschnitt 14.1b.
- **Stufenwahl ohne Vorauswahl**: Hervorhebung der zuletzt gewählten Stufe und
  `fortress_bot_level`-Persistenz entfernt — alle 3 Buttons gleichwertig, der
  Spieler wählt bei jedem Start aktiv (Wahl startet das Spiel).
- **Tests**: KI-Tick im Speedup proportional (600→60 ms), Hooks
  `__castleClosed`/`__blastWall`, Versiegelungs-Beweis (Bresche → Bot dichtet
  in 25 s), Keine-Vorauswahl-Check (identische Button-Styles).

Tests grün. SW-Cache `fortress-v3.29.0`.

### v3.29.1 — UI-Fix: Tagesaufgaben-Icons gerendert + Gold-Shop ohne Emojis
Nutzer-Report mit Screenshot: Tagesaufgaben zeigten die Icon-NAMEN als Text
(„shoppingCart", „bomb", „gamepad") — die v3.27.0-Migration hatte die
Task-Defs auf Icon-Namen umgestellt, aber die Modal-Renderstelle gab `def.icon`
weiter als String aus. Und die Sieges-Effekt-Previews im Gold-Shop/Inventar/
Kaufdialog waren noch Emojis (🎊/🎆/🪙).
- Tagesaufgaben: Icon-Medaillon (34px-Kreis) mit `Icon`-Komponente; Task
  `scrap60` von Rohzeichen „⚙" auf Icon `hammer` umgestellt.
- `WIN_EMOJI` → `WIN_ICON` (sparkles/rocket/coins in Themenfarben, mit
  Glow-Medaillon) — wirkt in Gold-Shop-Karten, Kaufbestätigung UND Inventar
  (gleiche preview-Funktionen).
- Goldregen-Sieges-Animation: gezeichnete Gold-Münzen (Radial-Verlauf +
  Prägerand) statt 🪙-Emoji.
- Suite: Tagesaufgaben-Check (keine rohen Icon-Namen als Text, ≥3 SVGs) +
  Gold-Shop-Check (keine Emoji-Codepoints im Modal).

Tests grün. SW-Cache `fortress-v3.29.1`.

### v3.30.0 — Wiederaufbau-Paket: Comeback-Ökonomie ohne Kanonen (Konzept A+B+C)
Konzeptphase mit Nutzer: „Was passiert, wenn ein Spieler keine Kanonen mehr
hat? Dann bekommt er ja kein Einkommen mehr durch Schießen." Analyse: Ohne
Kanonen blieb nur der Überlebens-Sold (+6), die nächste Kanone kostete durch
die Preisstaffel 20–44+ → 3–6 Rüstphasen erzwungene Passivität (Todesspirale),
zugleich Igel-Patt-Gefahr. Entschieden: Paket A+B+C, aktiv NUR solange ein
Spieler keine einsatzfähige Kanone hat (auch keine gekaufte unplatzierte);
Helfer `rebuildAidActive(p)` / `cannonPriceOf(p)`:
- **A) Wiederaufbau-Sold**: Überlebens-Sold verdoppelt (`SCRAP_REBUILD` 12
  statt 6) — „das Volk sammelt Trümmer".
- **B) Schmied-Rabatt**: nächste Kanone zum Basispreis 20 (Staffel pausiert
  für diesen Kauf; `cbought` zählt weiter). Wirkt in Kauf-Logik, Shop-Karte
  und Bot-Einkauf (alle über `cannonPriceOf`).
- **C) Trümmer-Bergung**: +1 Schrott an den Verteidiger je EIGENER zerstörter
  Mauer (Direkttreffer + Kanonen-Explosions-Splash; eigener Schrott-Popup in
  Spielerfarbe unterhalb des Angreifer-Popups). Einkommen wächst proportional
  zum erlittenen Beschuss. Kein Selbst-Farm möglich (eigene Treffer auf
  eigene Mauern geben weiter nichts).
Nicht ausnutzbar: Kanonenverlust kostet die Investition UND schenkt dem Gegner
+12 — die Hilfen kompensieren nur teilweise. Wiedereinstieg jetzt in 1–2 statt
3–6+ Rüstphasen. Shop-Info-Overlay erklärt die Regel (Zeile unter der
Verdienst-Tabelle, i18n de/en). Gated Hook `__rebuildAid(p)`; Suite-Beweis in
der Kanonen-Kill-Suite: letzte Bot-Kanone töten → Status aktiv, Preis 20,
Bergung +1 beim Verteidiger (alles in einer Schussphase, Nachlauf hält offen).

Tests grün. SW-Cache `fortress-v3.30.0`.

### v3.30.1 — Fixes: „Bauen im Wasser" (visuell) + Bot-Hand-Vorschau versteckt
Zwei Nutzer-Reports:
1. **„Ich konnte im Wasser bauen"**: Die Bau-LOGIK war dicht (alle
   Platzierungspfade — placePiece, placeCannon, Bot — prüfen `isBuildable`,
   Wasser `ter===3` ist gesperrt). Ursache war die Metaball-Fluss-OPTIK
   (v3.15.0): Das Uferband zeichnete Kreise mit Radius 0.95×CELL und ragte
   damit ~45 % in bebaubare Nachbarzellen — dort gebaute Mauern sahen aus, als
   stünden sie im Fluss. Radien verkleinert (Ufer 0.95→0.68, Wasserkörper
   0.72→0.60, Strömung 0.58→0.52; alle >0.5 → Kreise verschmelzen weiter zum
   Band). Radien-Regel als Kommentar im Code verankert.
2. **Bot-Modus zeigte die Hand des Bots**: Die P2-Hand-Vorschau in der
   Bauleiste rendert bei `!online` — im Bot-Spiel sah man also das nächste
   Teil des BOTS. Wie online sieht man jetzt nur das eigene Teil
   (Bedingung: `!online && !botMode`; gilt auch im Tutorial).
Suite: Bauphase im Bot-Spiel → genau 1 Hand-Vorschau sichtbar.

Tests grün. SW-Cache `fortress-v3.30.1`.

### v3.30.2 — Echter Fix: „Bauen im Fluss" war ein Terrain-Spiegel-Bug (Doppel-Flip)
Nutzer-Report mit Screenshot: Kanone stand trotz v3.30.1 mitten im Lavafluss.
Wahre Ursache (tiefer als die Radien): Im p1Flipped-Modus (Bot/Online-Host,
2 Spieler) wurde der bgCanvas mit VOR-Flip gerendert und dann durch den
geflippten Haupt-Canvas geblittet — Doppel-Flip. Ergebnis: Das TERRAIN erschien
aufrecht (logische Zeile 0 oben), während Mauern/Kanonen/Burgen gespiegelt
rendern (logische Zeile 0 unten). Der Fluss wurde also an der GESPIEGELTEN
Position gezeichnet; weil die Karte grob symmetrisch ist, fiel das nie auf —
bis jemand auf einer „Fluss-Optik"-Zelle baute, die logisch Land ist (und der
echte Fluss unsichtbar daneben lag).
- Vor-Flip entfernt: bgCanvas durchläuft jetzt denselben Haupt-Flip wie alle
  Spielobjekte → Terrain-Optik == Terrain-Logik, in ALLEN Modi.
- Nur der Welt-Namenszug bekommt einen eigenen Gegen-Flip (bleibt lesbar
  unten links).
- Die Radien-Verkleinerung aus v3.30.1 bleibt (Wasser ragt nicht in Bauland).
Damit ist auch der ursprüngliche „Mauer im Wasser"-Report vollständig erklärt.

Tests grün. SW-Cache `fortress-v3.30.2`.

### v3.30.3 — ELO-Fix: Gäste verbuchten nur das ERSTE Online-Spiel der Session
Nutzer-Report: „ELO wird nicht angepasst, wenn man online spielt." Review des
kompletten Verbuchungs-Pfads (recordResult, Host-/Gast-/Forfeit-Wege):
1. **Kern-Bug — statRecorded hing bei Gästen fest**: `startOnlineGame` (das
   `statRecorded` zurücksetzt) läuft NUR beim Host (`startOnlineGame(1)` ist
   der einzige Aufruf); Gäste betreten das Spiel rein über applyState. Kein
   Gast-Eintrittspfad setzte das Flag zurück → ein Gast verbuchte das erste
   beendete Spiel der Browser-Session, danach NIE wieder (weder Stats noch
   ELO noch Gold/XP). Da das Matchmaking den Host deterministisch wählt
   (kleinste Session-ID), war derselbe Spieler oft dauerhaft Gast → für ihn
   „ändert sich nie etwas". Fix: Reset von `statRecorded` +
   eloChange/goldChange/xpChange-Refs in BEIDEN Gast-Eintrittspfaden
   (`mmJoinMatchedGame` + Code-Join `joinGame`). Regel im Kommentar: der
   Reset muss in JEDEM Gast-Eintrittspfad stehen.
2. **Quit-Dodge geschlossen**: Wer mitten im laufenden Spiel aufgibt
   (`quitGame` bei screen==game), verbuchte selbst gar nichts — absehbare
   Niederlagen ließen sich per „Beenden" dodgen. Jetzt zählt Aufgeben als
   Niederlage (recordResult(false), Guard über statRecorded; vom
   Ergebnis-Screen aus ist bereits verbucht → kein Doppel).
Suite (Matchmaking): Match-Ende jetzt via HOST-Aufgabe → der GAST durchläuft
den applyState-Verbuchungs-Pfad. Asserts: Gast-Sieger verbucht Match 1
(1050→X), Aufgeber verbucht Niederlage (1050→Y<1050), und der Gast verbucht
AUCH Match 2 (X→Z>X — exakt die festgehangene Flag-Regression).
Host-Erkennung via gated `__myRole` (mmIdentInit setzt `__mmDebug` beim Laden).

Tests grün. SW-Cache `fortress-v3.30.3`.

### v3.31.0 — Balancing III (Playtest, 2 echte Spieler): Kanonen robuster + Einkommen verdoppelt
Playtest-Feedback: (a) Kanonen gehen zu leicht kaputt, (b) man verdient kaum
Schrott und kann sich wenig leisten. Analyse aus dem Code: HP 8 ÷ 2 fokussierte
Kanonen × Salve alle 2,5s = Kill in ~10s — deutlich unter einer Schussrunde.
Einkommen 1 Treffer = 1 Mauer = ⚙1 → realistisch ~12–18 ⚙/Runde bei Preisen
15–50. Echtes 2-Spieler-Feedback gewichtet höher als Bot-Selfplay (v3.24.0
behielt HP 8/Sold 6 auf Selfplay-Basis — Bots fokussieren Kanonen kaum).

| Konstante | alt | neu | Begründung |
|---|---|---|---|
| `CANNON_HP` | 8 | **12** | Kill = ~1,5 Runden Commitment beider Kanonen; erreichbar (15 war tot), aber Investition |
| `SCRAP_WALL` | 1 | **2** | Haupt-Einkommensstrom verdoppelt (~16–24 ⚙/Runde); Trümmer-Bergung (v3.30.0) läuft über dieselbe Konstante → verdoppelt mit, Parität bleibt |
| `SCRAP_CANNON` | 12 | **18** | Kill ist mit HP 12 ~50 % teurer erkämpft; 18 ≈ fast eine neue Kanone (⚙20) |

Bewusst NICHT geändert: `SCRAP_SURVIVE` 6 und `SCRAP_REBUILD` 12 (Messpass
v3.24.0: gesunde Ausgabenquote; das Einkommens-Problem ist das aktive
Verdienen, nicht der Sold — und die verdoppelte Bergung stärkt das
Comeback-Paket bereits). Preise unverändert (Kanonen-Staffel limitiert die
Flut weiterhin). Shop-Info-Overlay zeigt die Werte jetzt dynamisch aus den
Konstanten; Comeback-Zeile nennt +2. Suite: Kill-Bonus ≥ +18, HP dynamisch
aus dem Hook, Info-Fakten +2/+18/+6, Bergung-Label +2.

Tests grün. SW-Cache `fortress-v3.31.0`.

### v3.31.1 — Bugfix: Reparatur baute Mauern in zerstörte Kanonen
Nutzer-Report: Die Reparatur-Funktion verwandelte auch die Trümmer ZERSTÖRTER
KANONEN in Mauern. Ursache: Beim Kanonen-Kill wurden Kanonen-Zellen und
umliegende Mauer-Zellen zum SELBEN Typ `RUBBLE` — `repairRubble` konnte sie
nicht unterscheiden.
- Neuer Zell-Typ **`RUBBLE_C = 13`** für Kanonen-Trümmer (Kill-Loop schreibt
  ihn statt `RUBBLE` für `enemyCannon`-Zellen). Reparatur wandelt weiterhin
  nur `RUBBLE` → zerstörte Kanonen bleiben Trümmer.
- Rendering identisch (`rubbleSprite`), Flood-Fill unverändert (beide Sorten
  sind kein Blocker), State-Sync unkritisch (Grid = rohes Array, Werte >9
  existieren seit den 3-Spieler-Typen).
- Shop-Karten-Check (`noNeed`) und Bot-Reparaturkauf zählen nur `RUBBLE` —
  korrekt: Reparatur lohnt nur für Mauer-Trümmer. Shop-Info-Text präzisiert
  („zerstörte Kanonen sind nicht reparierbar", de/en).
- Gated Hook `__repairCheck(p)` (zählt beide Sorten, repariert, zählt erneut);
  Suite-Beweis in der Kanonen-Kill-Suite: nach dem Kill bleiben Kanonen-
  Trümmer liegen, nur Mauer-Trümmer werden gewandelt (Zählung konsistent).

Tests grün. SW-Cache `fortress-v3.31.1`.

### v3.32.0 — UX: Reparatur-Highlight + fester Ziel-Anker (eigene Burg)
Zwei Playtest-Punkte:
1. **Reparatur unsichtbar**: Der Kauf reparierte sofort, aber das Shop-Panel
   verdeckte das Feld — man sah nie, WO repariert wurde. Jetzt: Beim Kauf
   blendet das Shop-Panel ~1,8s aus (`shopHideUntil`, pro Spieler; Gast
   optimistisch beim Absenden der buy-Action) und die reparierten Zellen
   pulsieren ~1,5s grün (Füllung + wachsender Ring). Marker in `repairFx`
   (Ref, max 12), via State synchronisiert wie `scrapPops` (buildState/
   applyState), Zeichnung frame-basiert im Render-Loop. Hook `__repairCheck`
   liefert zusätzlich `fx`; Suite prüft Marker je reparierter Zelle.
2. **Ziel-Anker sprang umher**: `slingAnchor` war der Schwerpunkt der
   schussbereiten Kanonen — war z. B. nur die ganz rechte Kanone bereit, saß
   der Anker am Feldrand und Zielen wurde extrem unhandlich. Jetzt: fester
   Standard-Anker = **Zentrum der EIGENEN BURG** (immer gleiche, vorhersagbare
   Stelle; Fallback Kanonen-Schwerpunkt nur ohne Burg). Kanonen feuern
   unverändert von ihren Positionen; nur die Ziel-Referenz ist stabil.
   Alle Anleitungs-Texte (Banner, Coach, Hilfe, Tipp, Onboarding, de/en)
   sagen jetzt „von deiner Burg wegziehen".

Tests grün. SW-Cache `fortress-v3.32.0`.

### v3.32.1 — Fix: iOS-Text-Lupe beim Ziehen (Safari)
Nutzer-Report: Beim Zielen/Ziehen erschien ab und zu die iOS-Vergrößerungslupe
(Safari-Textauswahl). Ursache: `user-select:none` lag nur auf `html,body` —
Safari wendet das nicht zuverlässig auf Kind-Elemente an; startete/wanderte der
Finger über HUD-/Shop-Texte, begann Safari eine Textauswahl (= Lupe).
- `-webkit-user-select:none / user-select:none / -webkit-touch-callout:none /
  -webkit-tap-highlight-color:transparent` jetzt GLOBAL auf `*`.
- Ausnahme `input, textarea` → Textauswahl bleibt (Profil-Editor).
- `-webkit-touch-callout:none` zusätzlich auf `html,body`.
Rein CSS, keine Logik-Änderung. In der späteren TWA/App irrelevant, stört aber
beim Browser-Playtest.

Tests grün. SW-Cache `fortress-v3.32.1`.

### v3.32.2 — Fix: Kein Sound auf iOS (Stummschalter-Kanal + interrupted-State)
Nutzer-Report „bei mir kommt kein Sound". Die Sound-Dateien und der Lade-Code
(v3.28.0) waren intakt — drei iOS-spezifische Lücken:
1. **Stummschalter**: iOS legt Web-Audio auf den KLINGELTON-Kanal — Hardware-
   Schalter auf lautlos = Spiel komplett stumm. Fix: `_unlockMediaChannel()`
   spielt bei der ersten Geste einmal ein stilles `<audio playsinline>`
   (WAV-Data-URI) ab → App wechselt auf den MEDIEN-Kanal, der den Schalter
   ignoriert (Standard-Trick, vgl. unmute.js).
2. **`interrupted`**: Nach Anruf/App-Wechsel steht der AudioContext auf
   "interrupted" — `resume()` griff nur bei "suspended". Jetzt: bei allem
   ≠ "running" resümieren; zusätzlich `visibilitychange`-Listener (Rückkehr
   in den Tab → resume).
3. `_load()`-Robustheit: `_loading`-Flag wurde vor dem Context-Check gesetzt —
   schlug die Context-Erzeugung beim ersten Versuch fehl, wurde nie nachgeladen.

Tests grün. SW-Cache `fortress-v3.32.2`.

### v3.32.3 — iOS-Sound II: HTML-Audio-Pool als primärer Pfad + Lupen-Härtung
v3.32.2 (Medien-Kanal-Unlock für WebAudio) reichte auf dem Gerät nicht — Sound
blieb stumm, Lupe kam noch vereinzelt.
1. **Sound**: Auf iOS (inkl. iPadOS als „MacIntel" mit Touch) spielen alle
   Effekte jetzt PRIMÄR über einen Pool aus 7 `<audio playsinline>`-Elementen
   (`_tags`) — HTML-Audio läuft nativ auf dem MEDIEN-Kanal (spielt auch bei
   Stummschalter) und hat keine AudioContext-Zustandsfallen. Jedes Element
   wird bei der ersten Geste einmal stumm angespielt („gesegnet") — danach
   ist programmatisches Abspielen erlaubt. WebAudio bleibt der Pfad für alle
   anderen Plattformen + Fallback (`_play` → `_playTag` zuerst auf iOS).
   `a.volume` wird gesetzt, iOS ignoriert es (immer 1) — akzeptiert.
2. **Sofort-Feedback**: Der Sound-Toggle im Menü spielt beim EINSCHALTEN
   direkt einen Testton (in der Klick-Geste → segnet gleichzeitig die
   Audio-Elemente). Damit ist am Gerät sofort verifizierbar, ob Sound geht.
3. **Lupe (Härtung)**: zusätzlich zu CSS jetzt `selectstart`- und
   `contextmenu`-preventDefault global (Eingabefelder ausgenommen) — Safari
   startete die Text-Lupe vereinzelt trotz `user-select:none`.

Tests grün. SW-Cache `fortress-v3.32.3`.

### v3.32.4 — Bot-Backfill im Matchmaking (leere Queue → Übungsmatch nach 60s)
Launch-kritische Maßnahme aus dem AAA-Review: Bei frischer User-Base ist die
Queue meist leer → neuer Spieler wartet ewig → deinstalliert. Jetzt:
- **`MM_BOT_BACKFILL_S = 60`**: Wer 60s allein in der **2P-Queue** wartet, bekommt
  nahtlos ein Bot-Match (`mmBotBackfill()`): Suche wird sauber beendet
  (Ticket gelöscht, Listener gestoppt — gleicher Pfad wie `cancelMatchmaking`),
  dann exakt der „Übung gegen Bot"-Flow (`botLevel="mid"`, `initBotMatchIdentity`
  + `fullReset`). Bot bekommt wie immer einen zufälligen Fantasy-Namen; Spiel
  zählt NICHT für ELO/Stats (Bot-Regel unverändert).
- **Transparenz**: Suchbildschirm zeigt Countdown („Kein Gegner? In {s}s startet
  ein Übungsmatch gegen einen Bot") + Warn-Toast beim Start („zählt nicht für
  ELO"). Kein Fake-Match — ehrlich, aber nahtlos.
- **Guards**: feuert nie während Claim/Match (`mmBusy`, Ticket-Status ≠ waiting)
  und nur bei `mmNp === 2` — der Bot kann keine 3P-Partien; die 3P-Queue sucht
  unverändert weiter. Trigger im 1s-Display-Ticker (echtzeitbasiert).
- **Testhilfen (gated)**: `__mmForceWait(s)` spult die Wartezeit vor,
  `__botMode()` liest den Bot-Modus. Suite: Client allein in Queue → 61s
  vorspulen → im Spiel + botMode aktiv + Queue-Ticket gelöscht.

Tests grün. SW-Cache `fortress-v3.32.4`.

### v3.32.5 — Fix: Gäste sahen keine Kugel-Schweife (auch keine Gold-Shop-Trails)
Serialisierte Kugeln (`serializeState` → `balls`) tragen kein `trail`-Feld;
`applyState` übernahm sie unverändert → der Render-Loop-Guard `if (ball.trail)`
war auf Gast-Clients immer false → Gäste sahen GAR keine Schweife. Damit war
die Online-Sichtbarkeit der Gold-Shop-Kosmetik-Trails (v3.23.0) nur auf dem
Host-Bildschirm gegeben — Gäste sahen weder eigene noch fremde Trails.
- `applyState` initialisiert empfangene Kugeln jetzt mit `trail: []` →
  Schweif baut sich zwischen den State-Pushes auf (~7 Punkte bei 60fps/8Hz).
- Kein neues Sync-Feld nötig: die Trail-FARBE kommt bereits über
  `playerInfo[player].trail` (join-Payload) auf alle Clients.

Tests grün. SW-Cache `fortress-v3.32.5`.

### v3.33.0 — Die Schmiede: Crafting-System (Materialien + feste Rezepte)
Nutzer-Wunsch nach der Konzeptphase: „alles — Kanonen-Skins, Einschlag-Effekte
und Meister-Trails". Zweiter Meta-Loop neben dem Gold-Shop: Shop = kaufen,
Schmiede = ERSPIELEN. Feste Rezepte, KEIN Glücksspiel/Lootboxen (Design- und
Store-Entscheidung), rein kosmetisch (kein Pay2Win).
- **Materialien** (`profile.materials`, Whitelist im Profil-Loader wie
  cosmetics): Eisensplitter/Silbererz/Drachenstahl/Sternenstaub.
  Verdienst: Online-Sieg +5 Eisen +1 Silber, Niederlage +2 Eisen, jede volle
  3er-Siegesserie +1 Drachenstahl (in `recordResult`); Tagesaufgabe einlösen
  +3 Eisen +1 Silber; Tag-7-Streak-Kiste +1 Drachenstahl; jedes frisch
  freigeschaltete Achievement +1 Sternenstaub. `matChangeRef` hält den letzten
  Match-Gewinn (für spätere Result-Anzeige).
- **12 Rezepte** (`RECIPES`, Kosten = Materialien + Gold → zweiter Gold-Sink):
  4 Kanonen-Skins (Kristall/Obsidian/Drache/Sternenwerfer — `CANNON_SKIN`,
  Kuppel/Rohr/Kern-Farben; Spieler-Neonring bleibt IMMER zur Team-Erkennung;
  Sprite-Cache-Key jetzt `player|skin`), 4 Einschlag-Effekte (Lava/Eis/Blitz/
  Void — `IMPACT_FX`: Partikel-Palette in `impactAt` + Explosions-Gradient;
  `explosions[].fx` wird serialisiert → Gäste sehen die Farben), 4 Meister-
  Trails (`MASTER_TRAIL`, Veredeln: setzt Besitz des Shop-Basis-Trails voraus;
  längerer 13-Punkte-Schweif, 3-Farben-Zyklus, kräftigeres Alpha).
- **Ergebnisse** landen in `profile.cosmetics.owned/equipped` (neue Slots
  `cannon`/`impact` mit Standard-Defaults in `cosOf`). Online-Sync: `cannon`/
  `impact` in allen join-Payloads + playerInfo (Host validiert gegen die
  Kataloge) + `initBotMatchIdentity`; `sanitizeAction` lässt kurze Strings zu.
- **UI**: Hammer-Button (SVG, Design-Regel v3.27.0) neben dem Gold-Shop →
  Modal mit Material-Inventar (Rauten-Chips), Verdienst-Legende, 3 Sektionen
  mit Rezeptkarten (Zutaten-Chips, rot bei Mangel; Standard-Karten zum
  Abrüsten; gesperrte Veredelungen zeigen „Basis-Trail zuerst kaufen").
  Schmiede-Bestätigungsdialog analog Kauf-Bestätigung v3.26.2. i18n de/en.
- Performance: Skins = einmalig gebackene Sprites (kein neuer Frame-Aufwand),
  Trails/Partikel nur fillStyle+arc, Explosions-Gradient existierte bereits.

Tests grün. SW-Cache `fortress-v3.33.0`.

### v3.34.0 — Architektur Phase 1: Engine-Module + Unit-Tests (kein Verhaltens-Change)
Umsetzung des Architektur-Reviews (Konzept „Schichten statt Datei-Splitting").
index.html schrumpft 9433 → 8309 Zeilen; die reine Logik lebt jetzt in nativen
ES-Modulen (KEIN Build-Schritt — Browser lädt sie direkt, GitHub Pages liefert
sie aus, der Service Worker cached sie):
- `src/engine/const.js` — Grid-/Zeit-/Zelltyp-Konstanten (gemeinsame Basis)
- `src/engine/economy.js` — Schrott-Werte + Rüstphasen-SHOP (Balancing-Zahlen)
- `src/engine/terrain.js` — makeRng, Welt-Themes, Terrain-Generatoren (2P/3P),
  Sektor-Map, isBuildable (Determinismus = Online-Sync-Garantie)
- `src/engine/flood.js` — Flood-Fill (computeOutsideMap, isCastleClosed,
  closedCannons) — die Kern-Spielregel
- `src/engine/progression.js` — ELO/Gold/XP/Level-Formeln (pure → können später
  1:1 in einer Cloud Function serverseitig validiert werden)
- `src/engine/catalog.js` — COSMETICS/RECIPES/Materialien + cosOf/matOf
- `src/i18n.js` — LANGS komplett (de/en)
index.html importiert alles via `import`-Statements im Modul-Script — identische
Semantik, keine Verhaltens-Änderung. `src/package.json`+`tests/package.json`
(`type: module`) machen die Module für Node ESM-fähig, ohne test_fortress.js
(CommonJS) anzufassen.
**Neue Test-Etage (Pyramide):** `node --test tests/engine.test.js tests/i18n.test.js`
— 31 Unit-Tests in ~0,2s: ELO-Nullsumme, Gold-Grenzen, XP-Level-Aufstieg,
Terrain-Determinismus (Seed→identisches Grid), Flood-Fill-Regeln inkl.
Regression v1.0.6 (Gegner-Mauern schützen nicht), Rezept-Integrität
(IDs eindeutig, Meister-Trails referenzieren Shop-Basis, Render-Defs vorhanden)
und i18n-Parität (de≡en Keys, Platzhalter-Gleichheit, Katalog-Namen vollständig).
Aufgeräumt: `fortress-pwa.html` (tot seit PWA-Umbau) entfernt; CLAUDE.md
Doppel-Block bereinigt + Architektur-Abschnitt ergänzt.
**Regel ab jetzt: Beide Testebenen müssen grün sein** (Unit + Playwright).
Technische Details der Umstellung:
- Das große Spiel-Script ist jetzt `type="module"` (Voraussetzung für
  `import`). Das Firebase-Loader-Modul bekam `async`, damit der Spielstart
  NICHT auf gstatic wartet (Module führen sonst in Dokument-Reihenfolge aus).
- Modul-Scope-Konsequenzen: `window.SFX = SFX` explizit exportiert (Testsuite/
  Debugging); `__spreadValues/__spreadProps` als lokale Helfer in terrain.js/
  catalog.js (Object.assign-Äquivalent für die dortigen Nutzungen).

Tests grün (31 Unit + Playwright-Suite). SW-Cache `fortress-v3.34.0`.

### v3.35.0 — Architektur Phase 2: Netz-Schicht (Protokoll + Matchmaking-Kern)
Fortsetzung des Architektur-Konzepts (kein Verhaltens-Change im Spiel):
- **`src/net/protocol.js`**: `PROTO_VERSION` (=1), `sanitizeState`,
  `sanitizeAction` + dokumentiertes State-Schema und die zwei Protokoll-Regeln
  (neue Felder immer optional; inkompatible Änderungen → Version erhöhen).
  `serializeState` sendet jetzt `pv`; `applyState` warnt einmalig freundlich
  („Neue Spielversion verfügbar — bitte neu laden", `protoOutdated` de/en),
  wenn der Host eine NEUERE Protokoll-Version fährt — statt stiller Geist-Bugs
  zwischen unterschiedlich alten Clients. Alte Clients ignorieren `pv` (abwärts-
  kompatibel).
- **`src/net/matchmaking.js`**: `mmRadius` (+Konstanten MM_*) und der
  deterministische Pairing-Kern als pure Funktion `computeMatchGroup(wait, np,
  now, myId)` → `{sorted, group, claimer}`. Der mmTick-Code ruft sie auf —
  identische Logik, jetzt isoliert testbar.
- **13 neue Unit-Tests** (`tests/net.test.js`, gesamt 44): sanitize-Grenzen
  (Shapes, Phasen, Koordinaten, Kosmetik-Feldhygiene), Pairing-Determinismus
  (alle Gruppenmitglieder berechnen dieselbe Gruppe + denselben Claimer),
  Schwarm-Eigenschaft (20 Wartende → 10 disjunkte Paare), ELO-Radius-Wachstum,
  Livelock-Regression v3.14.13, Eingabe-Immutabilität.

Tests grün (44 Unit + Playwright-Suite). SW-Cache `fortress-v3.35.0`.

### v3.36.0 — Architektur Phase 3: Render- und Icon-Schicht (kein Verhaltens-Change)
- **`src/render/sprites.js`** (~400 Zeilen aus index.html): kompletter
  Sprite-Cache + alle Canvas-Zeichenfunktionen (drawWall/drawCastle/
  drawCannonFull, wall/crack/rubble/ball/dome/barrel-Sprites, Farb-Maps
  ROOF/FLAG/ACCENT/GHOST/BALL, roundRectPath). Die Perf-Regeln (Gradients/
  shadowBlur nur beim Backen) stehen jetzt als Kopf-Kommentar im Modul.
- **`src/ui/icons.js`**: ICON_PATHS (Lucide-Pfade) + Icon-Komponente.
- index.html: 8249 → 7792 Zeilen. Gesamt seit Phase 1: 9433 → 7792 (−17%),
  elf Module in src/ (engine 6, net 2, ui 1, render 1, i18n 1).
- **2 neue Unit-Tests** (46 gesamt): ICON_PATHS-Datenintegrität (jeder Pfad
  beginnt mit M/m) + Katalog-Querverweis (WIN_ICON-Namen existieren).

Tests grün (46 Unit + 290 Playwright). SW-Cache `fortress-v3.36.0`.

### v3.37.0 — Tutorial-Redesign: Die Umschlossen-Regel sichtbar machen
Spieler-Feedback: Das Umschließen von Burg und Kanonen wird nicht verstanden
(Ziel? Woran verliert man?). Design-Prinzip der Überarbeitung: ZEIGEN statt
erklären.
- **Leck-Spur** (Kern-Feature): `findLeakPath(g, player, castle)` in
  `src/engine/flood.js` — BFS von der Burg durch die Lücke bis zum Feldrand
  (8-Richtungen, nur eigene Mauern blockieren; konsistent zum Flood-Fill).
  Der Render-Loop zeichnet den Pfad als pulsierende, „fließende" rote Punkt-
  Spur: Man SIEHT, wo die Burg leckt und wohin man bauen muss.
  Sichtbarkeit: im Tutorial die gesamte Bauphase (solange offen); in normalen
  Spielen die letzten 8s der Bauphase zusammen mit der ZUMAUERN-Warnung
  (nur die eigene Burg; Bot-Spiele nur P1). Cache je gridVersion — eine BFS
  pro Grid-Änderung, im Frame nur Arcs.
- **Ziel-Intro vor dem Tutorial** (`showTutorialIntro`): Vollbild-Karte
  „Das Ziel" mit zwei SVG-Mini-Diagrammen (geschlossener Ring = gewinnen ·
  Ring mit Lücke + roter Pfeil = verlieren), der Kanonen-Regel („offene
  Kanone = stumme Kanone") und der Ankündigung der roten Spur.
  `startGuidedTutorial` zeigt erst das Intro; `beginTutorialRun` startet das
  Spiel. „Später" bricht ab (Tutorial-Merker wird trotzdem gesetzt — kein
  Auto-Start-Loop für Erstspieler).
- **Coach-Texte präzisiert** (de/en): Setup erklärt die Burg als Verlust-
  Bedingung; Build nennt Diagonalen + „EINE Lücke = verloren" + rote Spur;
  NEU `coachShootNoCannon`: erklärt in der Schussphase, WARUM die Kanone
  nicht schießen darf (war beim Rundenstart nicht ummauert).
- **Tests**: 4 neue Unit-Tests für findLeakPath (dicht→null, Pfad durchs
  Loch, Rand-Ende, Gegner-Mauern dichten nicht — konsistent zu v1.0.6);
  Tutorial-E2E prüft das Intro (Titel, Panels, Kanonen-Regel, Leck-Hinweis,
  Start-Button) vor dem Spielstart.

Tests grün (50 Unit + Playwright). SW-Cache `fortress-v3.37.0`.

### v3.37.1 — Tutorial-Feinschliff (Nutzer-Feedback)
- **Lücken-Zellen exakt markiert**: `leakGapCells(g, player, path)` in flood.js
  — die Leck-Pfad-Zellen, die an einer eigenen Mauer anliegen (= die Mündung
  des Lochs). Diese Zellen bekommen einen pulsierenden roten Rahmen + Füllung;
  die Spur zeigt weiter den Weg. Man sieht jetzt ZELLGENAU, wo zu bauen ist.
- **Diagonal-Regel explizit**: neuer Intro-Kasten mit Mini-Diagramm (zwei
  Mauern berühren sich nur an der Ecke → rote Spur schlüpft diagonal durch):
  „Dicht heißt: gerade UND diagonal geschlossen." Coach-Text bei offener Burg
  nennt die rot umrandete Zelle + „gerade und diagonal zählt".
- **Coach verdeckt nicht mehr den Gegner**: Sprechblase von oben (lag über
  der Bot-Burg) in die neutrale Feldmitte (Fluss-Band, 45%) verlegt; dimmt
  nach 7s auf 42% Opazität (`coachDim`-Keyframe, remountet pro Phase) — Infos
  bleiben lesbar, ohne das Spielfeld zu blockieren.
- 2 neue Unit-Tests (leakGapCells trifft exakt die Loch-Zelle; ohne Mauern
  keine Markierung); Intro-E2E prüft die Diagonal-Erklärung.

Tests grün (52 Unit + Playwright). SW-Cache `fortress-v3.37.1`.

### v3.37.2 — Tutorial: pausierende Coach-Popups oben (Nutzer-Feedback)
Neues Popup-Verhalten statt passiver Sprechblase in der Feldmitte:
- **Popups wieder OBEN** (verdecken nichts Kritisches mehr, weil …)
- **… das Spiel pausiert, solange ein Popup offen ist**: Timer, Bot und
  Kugelflug stehen still (`tutPausedRef` in startTimer-Tick, botTick und dem
  Ball-Advance des Render-Loops); ein Vollbild-Dim blockiert Eingaben.
  Lesen ohne Zeitdruck — „OK — weiter!" setzt fort.
- **Popup-Logik** (`coachMsg` + `coachShownRef`): bei jedem Phasenwechsel ein
  Basis-Popup (Schuss-Basis wählt automatisch die „Kanone nicht schussbereit"-
  Erklärung, wenn nichts feuern darf); Zustands-Popups (Burg aufgeschossen)
  je Phase einmal, erst nach Bestätigung des vorherigen. Badge „SPIEL
  PAUSIERT" im Popup-Kopf; Tutorial-beenden bleibt im Popup.
- E2E beweist die Pause: Timer eingefroren solange offen, läuft nach OK
  weiter; Phasen-Fortschritt via OK-Klicks. i18n de/en (`coachOk`,
  `coachPausedTag`).

Tests grün (52 Unit + Playwright). SW-Cache `fortress-v3.37.2`.

### v3.37.3 — Loch-Markierung exakt: Min-Vertex-Cut statt Nachbarschafts-Heuristik
Nutzer-Feedback: Markiert werden sollen NUR die Kästchen, die das Loch wirklich
ausmachen („beim Beschuss-Beispiel genau 3"), und nur nach außen.
- `findSealCells` (flood.js) ersetzt `leakGapCells`: **minimaler Schnitt**
  (Min-Vertex-Cut via Dinic-Max-Flow) zwischen Burg und Feldrand im
  Passierbarkeits-Graphen. Bebaubare Zellen (leer/Trümmer) = Kapazität 1;
  Burg/Kanonen/Gegner-Mauern passierbar aber unschneidbar (∞). Der Schnitt
  wird SENKEN-seitig extrahiert — Min-Cuts sind nicht eindeutig, quellseitig
  käme die innerste Linie an der Burg heraus, senkenseitig das Loch in der
  Mauerlinie selbst („nach außen").
- Eigenschaften (unit-getestet): 1er-Loch → exakt 1 Zelle; 3er-Beschussloch →
  exakt die 3 Loch-Zellen; markierte Zellen zumauern ⇒ Burg dicht (auch bei
  mehreren Löchern); ohne eigenen Ring in Burg-Nähe → keine Markierung
  (nur die Leck-Spur); Schnitt > 12 Zellen → keine Markierung.
- Läuft nur bei Grid-Änderung (Cache je gridVersion); Fluss ≤ 12 → Dinic
  bleibt im Mikrosekunden-Bereich auf dem 44×68-Grid.

Tests grün (33 Engine-Unit gesamt 54, Playwright unverändert).
SW-Cache `fortress-v3.37.3`.

### v3.37.4 — Tutorial: Bot bestätigt die Rüstphase sofort
Im Tutorial kauft der passive Bot nichts — trotzdem lief die Rüstphase die
vollen 15s, weil er nie „Fertig" meldete (die Kaufstrategie-Prüfung hielt ihn
für kauf-willig). Jetzt: `tutorialMode` → sofort `setArmoryReady(2)` beim
ersten Bot-Tick der Rüstphase. Bestätigt der Spieler ebenfalls, springt der
Timer wie gewohnt auf 3s — kein Leerlauf mehr im Tutorial.

Tests grün. SW-Cache `fortress-v3.37.4`.

### v3.38.0 — Audio-Qualität: neue CC0-Sounds + Hintergrundmusik
Nutzer-Feedback: Sounds wirkten „wie von einem billigen Spiel".
- **7 SFX ersetzt** (alle CC0 von opengameart.org, Quellen in CREDITS.md;
  Nachbearbeitung: Onset-Trim, Fades, Peak-Normalisierung, 128kbps mono):
  shoot = echter Kanonenschuss (thimras) · impact = Kanonentreffer auf Mauer
  (thimras) · destroy = berstender Stein (spring-spring) · place = Stein-
  Thunk · buy = Münz-Klimpern (rubberduck RPG-SFX) · win = Orchester-Fanfare
  (Zane Little) · lose = Medieval-Defeat-Sting (snabisch). ~240 KB gesamt.
- **Hintergrundmusik NEU**: `music/menu.mp3` („King's Feast", snabisch,
  130s-Loop) + `music/game.mp3` („Medieval Battle", supergamersgames,
  79s-Loop), beide CC0, 128kbps stereo (~3,2 MB). `MUSIC`-Manager
  (HTML-Audio, Loop, dezente Lautstärke 0.45/0.32, Track wechselt mit dem
  Screen Menü↔Spiel). BEWUSST nicht im SW-Precache — der Fetch-Handler
  cached beim ersten Abspielen (danach offline verfügbar).
- **Musik-Toggle** im Menü (music-Icon, `fortress_music`, Default an) neben
  Sound/Vibration. Autoplay-Policy: erster pointerdown holt den Start nach
  (`MUSIC.retry()` im bestehenden Gesten-Handler).
- E2E: MUSIC-Manager + Toggle + Persistenz + Track-Wahl.

Tests grün. SW-Cache `fortress-v3.38.0`.

### v3.38.1 — Audio-Feinschliff (Nutzer-Feedback)
- **Sieges-Sound ersetzt**: „Medieval: Victory Theme" (randommind, CC0,
  7s-Sting mit Fade) statt der generischen Fanfare — passt stilistisch zum
  Defeat-Sting (beide mittelalterlich).
- **Match-Musik jetzt mystisch**: „Isle of Avalon" (the-oracle, CC0) —
  sphärisch-mystische Fantasy statt Battle-Getrommel; 160s-Loop-Schnitt
  (8s–168s, 2s Loop-Kanten-Fades), 128kbps stereo.
- **Musik-Lautstärke-Regler** im Menü (erscheint unter der Toggle-Reihe,
  wenn Musik an): 0–100%, `fortress_music_vol` (Default 45%),
  `MUSIC.setVolume` = Master × relative Track-Mischung (Menü 1.0 / Spiel
  0.75), wirkt live ohne Neustart des Tracks.

Tests grün. SW-Cache `fortress-v3.38.1`.

### v3.39.0 — Welt-Musik + iOS-Lautstärke-Fix
- **Lautstärke-Regler wirkt jetzt auch auf iOS**: `el.volume` ist auf iOS
  read-only (Apple-Policy) — der Regler tat dort nichts. Das Audio-Element
  wird jetzt einmalig durch einen WebAudio-GainNode geroutet
  (`MUSIC._wire/_applyVol`, nutzt den SFX-AudioContext); Gain wirkt überall.
  Fallback ohne WebAudio bleibt `el.volume`.
- **Match-Musik je Welt** (7 CC0-Tracks, Quellen in CREDITS.md, RMS-angeglichen
  ~0.11, 112kbps stereo, Loop-Kanten behandelt): Kristalltal = Isle of Avalon
  (mystisch) · Frostreich = Beyond the Frozen Veil (eisig-sphärisch) ·
  Glutwüste = DesertMystic (orientalisch) · Vulkanschlund = Medieval Battle
  (dramatisch) · Nebelmoor = Mirror Lake (dunkel-ruhig) · Herbstwald =
  Grasslands (warm-folkig) · Astralebene = ObservingTheStar (Weltraum-Ambient).
  `WORLD_THEMES[..].music` (terrain.js) → Screen/Phase-Effect wählt den Track
  über `worldThemeOf(terrainSeed)` — deterministisch, online automatisch
  synchron; neue Karte/Runde zieht den Track nach. `music/game.mp3` entfernt.
- Musikdateien weiterhin NICHT precached (~11 MB gesamt) — Runtime-Cache.

Tests grün. SW-Cache `fortress-v3.39.0`.
