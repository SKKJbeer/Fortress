# FORTRESS — Spezifikation & Regelwerk (aktuell: v3.1.8)

> Diese Datei ist die **verbindliche Prüfgrundlage** für alle Änderungen am Spiel.
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
