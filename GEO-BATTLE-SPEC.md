# GEO BATTLE — Spezifikation & Architektur

> **Status**: Planungsphase (v0.1 — 2026-06-18)
> **Autor**: Claude (Software-Architekt) + SKKJbeer
> **Plattform-Ziel**: iOS 16+ (iPhone 15 Testgerät), Android (Phase 2), App Stores

---

## 1. Vision & Spielkonzept

### Kernidee

**Geo Battle** ist ein standortbasiertes Echtzeit-Strategie-Spiel (Location-Based Game).  
Drei Fraktionen kämpfen um territoriale Vorherrschaft auf der **echten Weltkarte** — in deiner Stadt, deinem Viertel, deiner Welt.

**Das Grundprinzip:**  
Du gehst Joggen. Wenn du dabei durch gegnerisches Territorium läufst (Zeit + Kilometer erfüllt), eroberst du diese Fläche für deine Fraktion. Du hältst die Welt durch Bewegung lebendig.

---

### Die drei Fraktionen

| Fraktion | Symbol | Spielgefühl | Farbe |
|---|---|---|---|
| **Untote** (Undead) | 💀 | Dunkel, aggressiv, ausdauernd | Lila / Schwarz |
| **Menschen** (Humans) | ⚔️ | Ausgewogen, strategisch | Blau / Gold |
| **Elfen** (Elves) | 🌿 | Schnell, mobil, naturverbunden | Grün / Türkis |

Jede Fraktion hat **andere Spielwerte** (Conquest-Speed, Decay-Rate, Sonderfähigkeiten).  
Fraktionszuweisung: Spieler wählt einmalig bei Registrierung.

---

### Kernmechanik (Conquest-Loop)

```
1. Spieler öffnet App → sieht Weltkarte mit Territorien aller Fraktionen
2. Spieler plant eine Route durch gegnerisches Gebiet
3. Spieler startet "Geo Run" → GPS-Tracking aktiv
4. Nach X Minuten / Y Kilometer in Hex-Zellen der Gegner:
   → Zellen werden zur eigenen Fraktion konvertiert
5. Zurück in App → Karte aktualisiert sich für alle
```

**Conquest-Trigger:**
- Mindest-Aufenthalt in einer Hexzelle: **3 Minuten ODER 500m Strecke** (konfigurierbar)
- Zelle muss zu **anderer Fraktion** gehören (eigene Zellen befestigen = anderer Modus)
- Anti-Cheat: Geschwindigkeits-Cap (max. 35 km/h → Fahrrad erlaubt, Auto nicht)

---

## 2. Technische Architektur — Gesamtüberblick

```
┌─────────────────────────────────────────────────────────────┐
│                    GEO BATTLE APP (Expo RN)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Map View   │  │  Run Tracker │  │   Fraktions-UI   │  │
│  │ (MapLibre GL)│  │(Expo Location)│  │   (React Native) │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         └─────────────────┴───────────────────┘            │
│                      ┌────────────┐                         │
│                      │ Game Store │  (Zustand: Zustand-     │
│                      │  (Zustand) │   management)           │
│                      └─────┬──────┘                         │
└────────────────────────────┼────────────────────────────────┘
                             │ Firebase SDK
                    ┌────────▼────────────────────┐
                    │      FIREBASE (Spark = €0)  │
                    │  ┌──────────────────────┐   │
                    │  │    Firestore DB       │   │
                    │  │  /territories/{h3id} │   │
                    │  │  /users/{uid}         │   │
                    │  │  /runs/{runId}        │   │
                    │  └──────────────────────┘   │
                    │  ┌──────────────────────┐   │
                    │  │   Firebase Auth       │   │
                    │  │   (Email + Google)    │   │
                    │  └──────────────────────┘   │
                    └─────────────────────────────┘
```

---

## 3. Technologie-Stack (Entscheidungen + Begründung)

### 3.1 Frontend: Expo (React Native)

**Gewählt: Expo SDK 53 + React Native**

| Kriterium | Begründung |
|---|---|
| iPhone 15 sofort | Expo Go App → QR-Code scannen → fertig, kein Mac Build nötig |
| Cross-Platform | Gleicher Code → iOS + Android (Phase 2) |
| Vertrautheit | Ähnlich zu React (Fortress-Stack), leichter Einstieg |
| App Store | Expo EAS Build → direkt IPA/AAB generieren |
| GPS | Expo Location API — Background-Tracking mit Permission |
| Maps | `@maplibre/maplibre-react-native` — OpenStreetMap, kostenlos |

**Alternativen verworfen:**
- Flutter: Dart-Learning-Curve, kein Vorteil hier
- Swift native: iOS-only, zu aufwändig für Phase 1
- PWA + Capacitor: GPS-Background-Tracking zuverlässiger in RN

### 3.2 Karte: MapLibre GL Native

- **OpenStreetMap** als Basis-Tiles (kostenlos)
- **Maptiler Cloud** Free Tier (100k Requests/Monat) für schönere Styles
- Territorien als **GeoJSON Overlay** auf der Karte
- H3-Hexagone werden als Polygon-Layer gerendert

### 3.3 Hexagonales Grid: Uber H3

**H3** teilt die Erdoberfläche deterministisch in Sechsecke ein.

Gewählte Auflösung: **H3 Resolution 8**
- Zellgröße: ~0.74 km² (ca. 460m Durchmesser)
- In einer typischen Stadt: Hunderte von Zellen → interessante Granularität
- Deterministisch: App berechnet Hexagon-ID aus GPS-Koordinaten lokal (kein Server-Round-Trip)

```
Lat/Lng → H3.latLngToCell(lat, lng, 8) → "882a100d43fffff"
```

Vorteil: Wir speichern **nur Zellen die besetzt sind** in Firestore — keine leeren Zellen.

### 3.4 Backend: Firebase (Spark Plan — kostenlos)

| Service | Verwendung | Spark Limit |
|---|---|---|
| Firebase Auth | User-Login (Email + Google) | 10.000 Users/Monat |
| Firestore | Territorien, User-Profile, Runs | 1 GB, 50k reads/day, 20k writes/day |
| Firebase Hosting | Landing Page (optional) | 10 GB/Monat |

**Skalierung**: Bei Wachstum → Blaze Plan (~pay-as-you-go, minimal bei kleiner Community)

### 3.5 State Management: Zustand

Leichtgewichtig (wie Jotai/Recoil), perfekt für React Native.  
Kein Redux-Boilerplate. Stores für: `mapStore`, `runStore`, `userStore`, `territoriesStore`.

---

## 4. Datenmodell (Firestore)

### 4.1 Territories Collection

```
/territories/{h3CellId}
{
  h3id: "882a100d43fffff",       // H3 Res-8 Zell-ID
  faction: "undead" | "human" | "elf" | null,
  ownerId: "uid_xyz",            // letzter Conquerer
  ownerName: "PlayerName",
  conqueredAt: Timestamp,
  strength: 1–10,                // Verteidigungsstärke (wächst mit Zeit)
  lastActivityAt: Timestamp,
  // Denormalisiert für Map-Rendering:
  lat: 47.123,
  lng: 8.456
}
```

**Index**: `faction` + `conqueredAt` für Leaderboard-Queries

### 4.2 Users Collection

```
/users/{uid}
{
  uid: "firebase_auth_uid",
  name: "PlayerName",
  faction: "undead" | "human" | "elf",
  avatar: "...",                 // URL oder Emoji-Code
  stats: {
    totalRuns: 12,
    totalKm: 48.3,
    cellsCaptured: 127,
    cellsLost: 34,
  },
  elo: 1000,                    // Aktivitäts-Score (kein Elo im klassischen Sinn)
  createdAt: Timestamp,
  lastActiveAt: Timestamp,
  region: "Zürich",             // Optional: für lokale Leaderboards
}
```

### 4.3 Runs Collection

```
/runs/{runId}
{
  uid: "firebase_auth_uid",
  faction: "elf",
  startedAt: Timestamp,
  endedAt: Timestamp,
  distanceKm: 5.3,
  durationMin: 28,
  capturedCells: ["882a100d43fffff", "882a100d41fffff", ...],
  path: [[lat,lng], [lat,lng], ...],   // Vereinfachte Route (Douglas-Peucker)
  speedCheck: true,              // Anti-Cheat bestanden
}
```

---

## 5. Spielmechanik (detailliert)

### 5.1 Territory Strength

Zellen haben eine **Stärke 1–10** die mit Haltezeit wächst:

```
Strength nach Stunden:
  1h: Stärke 1
  6h: Stärke 3
  24h: Stärke 5
  72h: Stärke 7
  168h (7 Tage): Stärke 10 (max)
```

Zum Erobern einer Stärke-N-Zelle braucht Angreifer: **(N × Basis-Zeit)** in der Zelle.

### 5.2 Fraktions-Design ✅ (Entschieden: Passiv + 1 Spell)

Jede Fraktion hat **passive Boni** + **1 aktiven Signature-Spell** (Cooldown ~24h):

| Fraktion | Passiv | Signature Spell | Spell-Effekt |
|---|---|---|---|
| **Untote** | Capture-Zeit −20%, Decay −50% | **Pest** | Benachbarte gegnerische Zellen verlieren sofort 3 Stärke (Radius 2 Hexes) |
| **Menschen** | Ausgewogen (1.0×), Stärke wächst 20% schneller | **Festung** | Wähle 3 Zellen → uneinnehmbar für 6h |
| **Elfen** | Bewegungs-Bonus: 1.5× Speed-Cap (52 km/h) | **Naturpakt** | Laufe eine Route → alle berührten eigenen Zellen sofort Stärke 10 |

**Spell-Auslösung**: In-App Button, nur verfügbar wenn Cooldown abgelaufen + Mindest-Territorium besessen.

### 5.3 Decay-System ✅ (Entschieden: Aktiver Decay → neutral)

Verlassene Zellen werden **schwächer** (ohne aktiven Besitzer):
- Pro 24h ohne Aktivität in der Nähe: Stärke −1
- Bei Stärke 0: Zelle wird **neutral** (grau auf der Karte, niemandem gehörend)
- Verhindert "tote" Karten in inaktiven Regionen — aktives Spielen wird belohnt

Fraktion-spezifischer Decay (passiver Bonus):
- **Untote**: Decay 0.5× (halten Territorien doppelt so lang)
- **Elfen**: Decay 1.5× (verlieren Territorium schneller → Bewegung ist Pflicht)
- **Menschen**: Decay 1× (Standard)

**Decay-Berechnung**: Client-seitig beim Karten-Laden (kein Server-Cron nötig):
```javascript
const currentStrength = Math.max(0,
  territory.strength - Math.floor((now - territory.lastActivityAt) / 86400000)
);
```

### 5.4 Solo-Modus ✅ (Entschieden: Solo macht Spass)

Spieler können **ohne andere aktive Spieler** laufen:
- Neutrale (graue) Zellen können durch jeden Run captured werden
- Eigene Zellen können durch Laufen **verstärkt** werden (Stärke auf max bringen)
- Solo-Runs zählen voll für persönliche Stats + Fraktion-Gesamtterritoriuum
- **Motivation allein**: Karte in der eigenen Stadt für die Fraktion einfärben

### 5.5 Geo Run Ablauf

```
App-Flow während eines Runs:

  [Start Run Button]
      ↓
  Permission Check (Location Always)
      ↓
  Run Screen:
  - Live-Karte mit Spieler-Position
  - Aktuelle H3-Zelle + Fortschrittsring (wie lange noch?)
  - Distanz + Zeit Counter
  - Liste der captures dieser Session
      ↓
  Im Hintergrund (alle 30 Sekunden):
  - GPS lesen
  - H3-Zelle berechnen
  - Falls Zelle gegnerisch + Mindestzeit: Capture auslösen
  - Firestore-Write: territory update
      ↓
  [Stop Run Button] oder automatisch nach GPS-Loss
      ↓
  Auswertung: Karte der captured Cells, Stats-Update
```

### 5.6 Anti-Cheat

- **Speed-Cap**: GPS-Punkte mit >35 km/h → Run wird ungültig markiert
- **Minimum Accuracy**: GPS-Genauigkeit >50m → Capture wird nicht gezählt
- **Rate-Limiting**: Max 10 Firestore-Writes pro Minute pro User (Client-seitig erzwungen)
- **Run-Validation**: Server-seitig (Firestore Rules): Minimum-Abstände zwischen Punkten plausibel?

---

## 6. Map-Rendering Architektur

### Territorien als GeoJSON Layer

```javascript
// H3 Zell-ID → GeoJSON Polygon
import { cellToBoundary } from 'h3-js';

const hexToGeoJson = (h3id, faction) => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [cellToBoundary(h3id, true)] // geoJson=true
  },
  properties: { h3id, faction, color: FACTION_COLORS[faction] }
});
```

### Rendering-Strategie

1. **Viewport-basiertes Laden**: Nur Territorien im sichtbaren Kartenbereich laden
2. **Firestore Query**: `where('lat', '>=', sw.lat).where('lat', '<=', ne.lat)` (mit Geo-Index)
3. **Realtime-Listener**: `onSnapshot` für die sichtbare Region → Live-Updates
4. **Caching**: Geladene Territorien 5min im lokalen Store cachen

**Problem**: Firestore kann keine echten Geo-Queries (kein ST_Within).  
**Lösung**: Bounding-Box-Query (lat/lng range) + Client-seitiges Filtern.  
**Skalierung**: Bei Wachstum → GeoFirestore oder H3 Parent-Zellen (Res 4) als Shard-Keys.

---

## 7. Screens & Navigation

```
App Navigation (React Navigation Stack):

  ├── Auth Stack (nicht eingeloggt)
  │   ├── WelcomeScreen       — Intro + Fraktion-Wahl
  │   ├── LoginScreen         — Email / Google Sign-In
  │   └── FactionSelectScreen — Einmalige Fraktion-Wahl
  │
  └── Main Tab Navigator (eingeloggt)
      ├── MapScreen (Tab 1)   — Karte + Live-Territorien
      │   └── RunScreen       — Overlay während aktivem Run
      ├── LeaderboardScreen   — Fraktion + persönliche Stats
      ├── ProfileScreen       — Eigene Stats, Run-History
      └── SettingsScreen      — Benachrichtigungen, Account
```

### Key UX-Entscheidungen

- **MapScreen ist Home**: Spieler öffnen App → Karte sofort sichtbar
- **Run mit 1 Tap**: "Run starten" Button auf MapScreen → kein Deep-Navigation
- **Offline-Tolerant**: Runs können offline starten, Captures werden beim nächsten Sync hochgeladen
- **Dark Mode first**: Passt zu Spielatmosphäre (besonders Untote Fraktion)

---

## 7b. Zwei Tracks: Web-Prototyp + Native App

Geo Battle hat bewusst **zwei getrennte Implementierungen**:

| Track | Ordner | Zweck | Live-URL |
|---|---|---|---|
| **Web-Prototyp** | `geo-battle-web/` | Sofort testbar im Browser, kein Setup | https://skkjbeer.github.io/Fortress/geo-battle-web/ |
| **Native App (Expo)** | `geo-battle/` | App Store Track (iOS + Android), Hintergrund-GPS | später via TestFlight / EAS |

### Web-Prototyp (`geo-battle-web/index.html`)
- **Einzelne HTML-Datei** (wie Fortress) — Leaflet + OpenStreetMap, h3-js via CDN
- Läuft auf jedem Smartphone-Browser, **kein Expo Go, kein Terminal nötig**
- localStorage-Keys mit Präfix `geo_battle_` → **sauber getrennt** von Fortress (`fortress_profile`)
- Enthält **Test-Modus**: simuliert einen Jog, damit man die Eroberung ohne echtes Joggen sehen kann
- GPS via Browser-Geolocation (Vordergrund). Hintergrund-GPS → nur Native Track
- Deployt über die bestehende GitHub-Pages-Pipeline (eigener Unterordner, Fortress unberührt)

### ⚠️ Trennung von Fortress (verbindlich)
- Fortress = Root `index.html` — **niemals von Geo-Battle-Änderungen anfassen**
- Geo Battle lebt ausschließlich in `geo-battle/` und `geo-battle-web/`
- Eigene Icons, eigenes Manifest, eigene localStorage-Keys

---

## 8. iPhone 15 Test-Setup (sofort möglich)

### Schnellster Weg: Web-Prototyp (0 Setup)

1. Auf dem iPhone **Safari** öffnen
2. https://skkjbeer.github.io/Fortress/geo-battle-web/ aufrufen
3. Name + Fraktion wählen → Standort erlauben → loslegen
4. „🧪 Test-Modus" tippen zum Ausprobieren ohne Joggen, oder „🏃 Run starten" für echtes GPS
5. Optional: Teilen-Button → „Zum Home-Bildschirm" → läuft wie eine App

### Native App (später)


### Schritt 1: Expo Go (kein Mac Build nötig)

```bash
# Entwicklungsmaschine (Mac/Windows/Linux):
npx create-expo-app GeoBattle --template blank-typescript
cd GeoBattle
npx expo install expo-location @maplibre/maplibre-react-native h3-js zustand
npx expo start

# iPhone 15:
# 1. Expo Go App aus App Store installieren
# 2. QR-Code scannen → App läuft sofort!
```

### Schritt 2: Expo Development Build (für Background GPS)

Background Location braucht einen **Development Build** (kein Expo Go):

```bash
# EAS CLI installieren
npm install -g eas-cli
eas login
eas build:configure

# Development Build für iOS (braucht Apple Dev Account, €99/Jahr)
eas build --platform ios --profile development

# Danach: App auf iPhone installieren, Expo Go nicht mehr nötig
```

**Apple Developer Account**: Für iOS-Testen auf eigenem Gerät **zwingend nötig**.  
Kosten: €99/Jahr. Einmalig einrichten.

### Schritt 3: App Store (später)

```bash
eas build --platform ios --profile production
eas submit --platform ios  # Direkt zu TestFlight / App Store Connect
```

---

## 9. Entwicklungs-Roadmap

### Phase 1 — Fundament (Wochen 1–3)

- [ ] Expo-Projekt initialisieren (TypeScript)
- [ ] Firebase einrichten (Auth + Firestore)
- [ ] MapLibre Karte mit OpenStreetMap
- [ ] Fraktion-Auswahl + User-Profil
- [ ] Statische Test-Territorien auf Karte anzeigen

**Ziel**: App startet auf iPhone, Karte läuft, Login funktioniert.

### Phase 2 — Core Loop (Wochen 4–7)

- [ ] GPS-Tracking (Expo Location, Foreground)
- [ ] H3-Integration: GPS → Hex-Zelle
- [ ] Capture-Logik (Zeit-Counter pro Zelle)
- [ ] Firestore Territory-Writes
- [ ] Live-Update anderer Spieler auf Karte

**Ziel**: Erster echter Geo-Run funktioniert, Zellen werden captured.

### Phase 3 — Gameplay-Tiefe (Wochen 8–11)

- [ ] Territory Strength System
- [ ] Decay-System (Firebase Scheduled Function oder Client-Trigger)
- [ ] Fraktion-Eigenschaften (Multiplikatoren)
- [ ] Run-Auswertungs-Screen
- [ ] Anti-Cheat Speed-Cap

**Ziel**: Vollständiger Gameplay-Loop, erste echte Sessions testbar.

### Phase 4 — Social & Polish (Wochen 12–15)

- [ ] Leaderboard (global + regional + Fraktion)
- [ ] Push Notifications (Expo Notifications): "Deine Zelle wird angegriffen!"
- [ ] Run-History + persönliche Karte
- [ ] Onboarding-Flow
- [ ] App Icon + Splash Screen

**Ziel**: Mehrere Spieler können gegeneinander spielen.

### Phase 5 — Store-Readiness (Wochen 16–18) ✅ (iOS + Android gleichzeitig)

- [ ] Privacy Policy (Firebase = Daten!)
- [ ] App Store Screenshots
- [ ] TestFlight Beta (iOS)
- [ ] Google Play Closed Testing (Android)
- [ ] Performance-Review (Karten-Rendering, Battery)

---

## 10. Kostenkontrolle (Zero-Cost Phase)

### Firestore-Optimierungen für Spark-Limit (50k reads/day)

| Maßnahme | Einsparung |
|---|---|
| Viewport-Query (nur sichtbare Zellen) | −80% reads |
| Lokales 5min-Cache | −60% reads |
| Nur geänderte Territorien per `onSnapshot` | Effizienter als Polling |
| Pagination (max 200 Hex/Request) | Kontrolle über Burst |

**Rechnung bei 10 aktiven Usern:**
- 1 User öffnet App → 1 Viewport-Query ≈ 200 reads
- 10 User × 200 reads × 10 Map-Moves/Tag = 20.000 reads → sicher im Limit

### Wenn das Limit nähert:

1. Regionale Sharding via H3 Parent-Zellen
2. Server-Sent-Events statt Realtime-Listener wo möglich
3. Blaze Plan evaluieren (Kosten bei 10k DAU: ~$5/Monat)

---

## 11. Sicherheit & Firestore Rules

```javascript
// firestore.rules (v1 — einfach)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User kann nur eigenes Profil schreiben
    match /users/{uid} {
      allow read: if true;
      allow write: if request.auth.uid == uid;
    }

    // Territorien: lesen für alle, schreiben nur authentifiziert
    match /territories/{h3id} {
      allow read: if true;
      allow write: if request.auth != null
        && request.resource.data.uid == request.auth.uid;
    }

    // Runs: nur eigene lesen/schreiben
    match /runs/{runId} {
      allow read, write: if request.auth.uid == resource.data.uid;
      allow create: if request.auth.uid == request.resource.data.uid;
    }
  }
}
```

---

## 12. Offene Fragen (für nächste Planungsrunde)

### Game Design
- [ ] **Sonderfähigkeiten** je Fraktion: nur passive Multiplikatoren oder aktive Spells?
- [ ] **Allianz-System**: Können Spieler gleicher Fraktion koordinieren?
- [ ] **Events**: Zeitlimitierte Gebiete, doppelte Conquest-Punkte?
- [ ] **Burg-Mechnik**: Spezielle Zellen (wie in Fortress) die extra stark sind?
- [ ] **Fraktion-Wechsel**: Erlaubt? Nach 30 Tagen? Nie?
- [ ] **Minimale Spielerzahl**: Ab wann macht das Spiel Spass (1 reicht zum Testen)?

### Technisch
- [ ] **Background GPS on iOS**: Wie aggressive ist iOS Battery-Throttling?
  → Expo Location `taskManager` + `startLocationUpdatesAsync` evaluieren
- [ ] **Offline-Runs**: Queue für Captures wenn kein Internet → beim Sync hochladen
- [ ] **Karten-Tiles**: Maptiler Free vs. OSM direkt (Quality vs. Zero-Cost)?
- [ ] **Notification-Server**: Für "deine Zelle wird angegriffen" brauchen wir Push-Infrastruktur
  → Expo Push Notifications (kostenlos, eigener Server)

---

## 13. Wichtige Designprinzipien

1. **Real-World First**: Das Spiel folgt der echten Welt — kein künstliches Grid
2. **Bewegung belohnen**: Mehr laufen = mehr Einfluss. Sitzende Spieler verlieren Territorien
3. **Async-Friendly**: Kein Echtzeit-PvP nötig — Territorien ändern sich asynchron
4. **Battery-Aware**: GPS-Tracking muss Battery-schonend sein (sonst deinstallieren User)
5. **Solo-playable**: Auch ohne andere Spieler in der Region macht es Spass (Karte erkunden)
6. **Privacy**: Genaue GPS-Tracks nie öffentlich anzeigen — nur Hex-Territorien

---

## Changelog

| Datum | Version | Änderung |
|---|---|---|
| 2026-06-18 | 0.1 | Initiale Architektur + Planungsphase |
| 2026-06-18 | 0.2 | Design-Entscheidungen: Passiv+Spell, Decay, Solo-Modus, iOS+Android parallel |
| 2026-06-18 | 0.3 | Web-Prototyp (geo-battle-web/) für sofortiges Browser-Testen + Native Expo-App (geo-battle/) |
