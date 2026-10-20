# Stack & Siege — Test-Lehren (Nachschlagewerk zu CLAUDE.md)

> Ausgelagert am 20.10.2026 (Token-Sparmassnahme). **Inhalt unveraendert.** Die Kurzfassung
> und die drei wichtigsten Regeln stehen in CLAUDE.md, Abschnitt „Automatisierter Test".

---

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
- **Warteschlange und Wiedereinstieg** (seit v3.115.2/.3):
  `suiteWarteschlangeMehrere` (`NUR=warteschlange`: 2P/3P mit mehr Wartenden
  als in eine Partie passen, Nachzuegler, beide Schlangen parallel) und
  `suiteVerlassenNeu` (`NUR=verlassen`: Host/Gast geht, Absturz, Abbrechen,
  3P — jede Folgepartie muss GUELTIG sein: neuer Code, Rollen, DB-Knoten,
  Phasen-Sync, keine fremden Namen; am Ende kein verwaister Spielknoten).
  Beide ohne Zeitraffer, gemeinsame Helfer in `wqWerkzeug`. Der Knopf heisst
  „Suche abbrechen" — ein Klick auf „Abbrechen" trifft NICHTS, und `jsClick`
  meldet das nur ueber den Rueckgabewert. Wer klickt, prueft ihn.
- **iOS-App-Wechsel** (`suiteIosHintergrund`, `NUR=ios`, seit v3.116.0):
  iOS friert Apps beim Wechsel ein, die Verbindung reisst ab, onDisconnect
  raeumt Ticket/Herzschlag weg. Nachgebildet: Seite im Debugger angehalten
  (`Debugger.pause`; `Page.setWebLifecycleState` wirkt headless NICHT), der
  Mock trennt nach 6 s Stille. **Abriss heisst nicht „weg"**: der Host
  warnt sofort, beendet erst 30 s nach dem letzten echten Lebenszeichen.
  `resubscribeGuestState` tauscht NUR den Listener (`nurListenerStop`) —
  `mpChannel.stop()` stoppt auch Herzschlag und Waechter.
- **Verbindungs-Banner gehoeren in den SPIEL-Zweig** (`verbindungsBanner()`).
  Sie standen bis v3.116.0 im Menue-Return und waren nie sichtbar; die
  Pruefung zaehlte den internen Merker mit. Pruefungen auf Anzeigen lesen
  den SICHTBAREN Text, nicht den Zustand dahinter.
- **TestFlight nur nach gruener Testkette:** `ios.yml` verlangt einen
  erfolgreichen `deploy.yml`-Lauf fuer genau diesen Commit, bevor signiert
  und hochgeladen wird (`ios-pruefen.mjs`, Abschnitt Freigabe).
- **Online-Härte (`suiteOnlineHaerte`, seit v3.94.0)**: Beitritts-Rennen
  (v2.8.1), Abweisungen (unbekannter Code, verwaiste Lobby, volles Spiel),
  Warteschlangen-Selbstheilung (v3.14.10) und die Protokoll-Schranke (`pv`).
  Die Selbstheilungs-Prüfung hat beim ersten Lauf einen echten Fehler
  gefunden: `fb.subscribe` verschluckt den Null-Fall, deshalb hängt die
  Warteschlangen-Subscription an **`fb.subscribeRaw`** — nicht zurückbauen.
