# FORTRESS — Spezifikation & Regelwerk (aktuell: v2.0.1)

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
- Grid: 36 Spalten × 56 Zeilen, Zellgröße 16px (W=576, H=896)
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
- Result-Screen: nur Host darf “Nächste Runde”/“Neues Spielfeld”, Gast wartet
- Online-Result zeigt “Du gewinnst/verlierst” je nach eigener Rolle
- Versionsanzeige im Menü gut lesbar (#64748b), Format “⚔️ FORTRESS · Version X.Y.Z”

-----

## 11. SPIELER-PROFIL (ab v2.0)

- Persistent via **localStorage** (`fortress_profile`) — funktioniert in der PWA
- Felder: `name` (max 16 Zeichen), `wappen` (Emoji aus WAPPEN-Pool), `color`
  (aus PROFILE_COLORS), `stats` { wins, losses, games }
- **Erstanlage**: beim ersten Start wird der Editor automatisch gezeigt (Pflicht)
- **Bearbeiten**: über ✏️-Button in der Profil-Karte im Hauptmenü
- **Profil-Karte** im Menü: Wappen, Name, Statistik (Siege/Niederlagen/Spiele/Quote)
- **Statistik-Erfassung**: nur im Online-Modus (eigene Rolle bekannt). `recordResult()`
  wird genau einmal pro Spiel aufgerufen (`statRecorded`-Flag, reset bei Spielstart).
  Host erfasst in checkLossOrContinue, Gast in applyState beim Empfang des Ergebnisses.
- **Namen im Spiel**: Beim Online-Spiel werden Name + Wappen über `playerInfo` im
  State (Host) bzw. join-Aktion (Gast→Host) ausgetauscht und im HUD angezeigt.
  Lokal bleibt es bei “P1”/“P2”.
- **Geplant (künftige Versionen)**: weitere Individualisierung, Ladder-/Bestenliste
  (würde Firebase-Aggregation über alle Spieler brauchen).

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