# Geo Battle (Web-Prototyp) — Änderungsprotokoll

> Lückenloses Protokoll aller Versionen mit **Was** und **Warum**.
> Die aktuelle Version ist immer im Spiel sichtbar (Onboarding-Screen + Versions-Pill oben rechts auf der Karte).
> Live: https://skkjbeer.github.io/Fortress/geo-battle-web/

| Version | Status |
|---|---|
| **0.1.7** | aktuell |

---

## v0.1.7 — Manueller Test-Modus: Karte antippen statt joggen
**Warum:** Zum Testen will man GPS simulieren und die Karte selbst „ablaufen", statt auf einen automatischen Jog zu warten.

- Test-Modus ist jetzt **manuell**: Auf die Karte tippen = Läufer „geht" dorthin
- Jede angetippte Gegner-/Neutral-Zelle wird **sofort erobert** (Farbe wechselt sichtbar)
- Route wird als Linie gezeichnet, Distanz wird mitgezählt
- Funktioniert komplett **ohne GPS** — ideal zum Durchspielen am Schreibtisch
- Button umbenannt: „🧪 Test-Modus (Karte antippen statt joggen)"

---

## v0.1.6 — Leaflet-CSS eingebettet + Test-Modus ohne GPS lauffähig
**Warum:** Karte blieb über alle Versionen schwarz → Verdacht: externes Leaflet-CSS (unpkg) wird im Mobilfunknetz/durch Inhaltsblocker nicht geladen, dann positioniert Leaflet seine Kacheln nicht. Test-Modus brach ohne GPS sofort ab.

- **Leaflet-Kern-CSS direkt in die HTML eingebettet** → Karte funktioniert unabhängig von externen CSS-Servern
- **Test-Modus-Bug behoben**: Start-Zelle wird jetzt aus der Kartenmitte gesetzt, wenn kein GPS vorhanden ist → Test-Modus läuft auch ohne Standortfreigabe
- Karten-Container bekommt **explizite Pixel-Höhe** (`window.innerHeight`) statt nur CSS `100%` (zusätzlicher Schutz gegen iOS-Schwarz)

---

## v0.1.5 — Version sichtbar im Spiel
**Warum:** Man soll jederzeit zweifelsfrei erkennen können, ob die aktuelle Version geladen ist (Safari cached aggressiv).

- Versions-Pill **oben rechts** auf dem Kartenbildschirm (`vX.Y.Z`)
- Version zusätzlich auf dem **Onboarding-Screen** unter dem Untertitel
- Version weiterhin in der Diagnose-Zeile und im Diagnose-Fenster

## v0.1.4 — iOS „schwarze Karte" behoben + Diagnose-Fenster
**Warum:** Auf dem iPhone war die Karte komplett schwarz — der Karten-Container hatte beim Start die Höhe 0, daher rendert Leaflet weder Kacheln noch Hexagone.

- **ResizeObserver** auf den Karten-Container → `invalidateSize()` sobald er Größe bekommt
- **Canvas-Renderer** (`preferCanvas:true`) für stabileres Zeichnen vieler Polygone
- `invalidateSize()` mehrfach gestaffelt (60/200/500/1000/2000 ms) + bei `resize`/`orientationchange`
- Antippbare Fraktions-Badge (ⓘ) öffnet ein **Diagnose-Fenster**: Leaflet geladen?, Karte erstellt?, **Karten-Größe**, Tiles, GPS-Recht, GPS-Status, Position, Anzahl Territorien → ermöglicht Ferndiagnose ohne Bildschirmzugriff

## v0.1.3 — Sichtbare Diagnose-Zeile + robusteres GPS
**Warum:** „GPS klappt nicht" ist ohne Messwerte nicht diagnostizierbar; drinnen scheitert GPS oft am Timeout.

- **Status-Zeile** unten zeigt Karte/Tiles, GPS-Berechtigung und letzten Geo-Fehlercode
- **Permissions API** liest den GPS-Berechtigungsstatus aus (granted/denied/prompt/n.a.)
- Standortabfrage mit **Retry bei Timeout** (Fehlercode 3): 2. Versuch mit `enableHighAccuracy:false` + längerem Timeout
- Klarere Fehlertexte je nach Fehlercode (1 = verweigert, 2 = nicht verfügbar, 3 = Timeout)

## v0.1.2 — In-App GPS-Hilfe bei Verweigerung
**Warum:** Sobald in Safari „Nicht erlauben" gewählt wurde, erscheint nie wieder ein Popup; die App kann es nicht erzwingen.

- **Hilfe-Box** bei Fehlercode 1 mit Schritt-für-Schritt-Anleitung (Safari „aA" → Website-Einstellungen → Standort → Erlauben; sowie iOS-Einstellungen → Ortungsdienste)
- Buttons in der Box: **Erneut versuchen**, **Test-Modus**, **Schließen**

## v0.1.1 — Karte lädt sofort, robustes GPS-Handling
**Warum:** Die Karte wurde erst nach der GPS-Antwort erstellt → bei verweigertem/verzögertem GPS blieb alles schwarz.

- Karte wird **unabhängig von GPS** sofort erstellt; GPS wird danach nachgeladen und zentriert
- `invalidateSize()` nach Layout (erster Versuch gegen schwarze Karte)
- **OSM-Fallback-Tiles** falls die CARTO-Kacheln blockiert sind
- Demo-Territorien werden auch **ohne GPS** angezeigt
- GPS-Verweigerung: Hinweis + Retry über den ◎-Button

## v0.1.0 — Erster spielbarer Web-Prototyp
**Warum:** Sofort testbar im Browser auf dem iPhone, ganz ohne Installation/Terminal.

- Einzelne HTML-Datei (wie Fortress), **Leaflet + OpenStreetMap/CARTO**, **h3-js** via CDN
- **Onboarding**: Name + Fraktionswahl (💀 Untote / ⚔️ Menschen / 🌿 Elfen) mit Passiv-Boni und Signature-Spell
- **Karte** mit H3-Hexagon-Territorien (Auflösung 8 ≈ 460 m), Demo-Territorien um den Standort
- **Geo-Run**: GPS-Tracking, Zeit/Distanz/Speed-HUD, Eroberungs-Fortschritt pro Zelle, Speed-Cap (Anti-Cheat)
- **🧪 Test-Modus**: simulierter Jog zum Ausprobieren ohne echtes Joggen
- **Profil**: Statistiken, Spell mit Cooldown, Passiv-Bonus, Profil zurücksetzen
- Persistenz via **localStorage** (Präfix `geo_battle_`, sauber getrennt von Fortress)
