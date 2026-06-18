# Geo Battle — Entwickler-Setup

## iPhone 15 sofort testen (5 Minuten)

### 1. Expo Go auf iPhone installieren

App Store → "Expo Go" suchen und installieren.

### 2. Projekt lokal klonen & starten

```bash
git clone https://github.com/SKKJbeer/Fortress.git
cd Fortress/geo-battle
npm install
npx expo start
```

### 3. QR-Code scannen

Terminal zeigt einen QR-Code → iPhone Kamera App öffnen → QR scannen → App startet in Expo Go.

**Wichtig**: iPhone und Computer müssen im selben WLAN sein.

---

## Was Phase 1 kann

- Weltkarte mit Apple Maps (dark mode)
- H3-Hexagone (~460m Durchmesser) sichtbar auf der Karte
- Demo-Territorien werden beim ersten Start um deine Position generiert
- Fraktion wählen beim ersten Start (💀 Untote / ⚔️ Menschen / 🌿 Elfen)
- Run starten → GPS trackt Position → Hexzellen werden captured
- Speed-Check: >52 km/h = kein Capture (Anti-Cheat)
- Profil mit Stats + Spell-System

---

## Limitierungen Expo Go (Phase 1)

| Feature | Status |
|---|---|
| Karte | ✅ Apple Maps, dunkel |
| GPS (Foreground) | ✅ Funktioniert |
| H3 Hexagone | ✅ Sichtbar |
| Captures | ✅ Lokal gespeichert |
| GPS (Background) | ❌ Braucht Dev Build |
| Mehrspielern / Firebase | ❌ Phase 2 |
| Push Notifications | ❌ Phase 2 |

---

## Background GPS (Development Build)

Für echte Runs mit gesperrtem Bildschirm:

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile development
# → Download & auf iPhone installieren
```

Benötigt: Apple Developer Account ($99/Jahr).

---

## Projektstruktur

```
geo-battle/
├── App.tsx                    # Entry point
├── app.json                   # Expo Konfiguration
├── src/
│   ├── constants/factions.ts  # Fraktionen, Farben, Spells
│   ├── stores/
│   │   ├── userStore.ts       # Spielerprofil (AsyncStorage)
│   │   ├── mapStore.ts        # Territorien (lokal)
│   │   └── runStore.ts        # Aktiver Run
│   ├── utils/h3Utils.ts       # H3 Hexagon-Berechnungen
│   ├── navigation/            # React Navigation Setup
│   └── screens/
│       ├── WelcomeScreen.tsx  # Fraktion wählen (Onboarding)
│       ├── MapScreen.tsx      # Hauptkarte mit Hexagonen
│       ├── RunOverlay.tsx     # HUD während eines Runs
│       └── ProfileScreen.tsx  # Stats + Spell
```
