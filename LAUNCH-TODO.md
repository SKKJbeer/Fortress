# FORTRESS — Marktstart-Checkliste

> Stand: nach v3.12.0 (App-Store-Vorbereitung). Diese Liste fasst alles zusammen,
> was für einen guten Marktstart (Google Play zuerst, dann weitere Stores) nötig
> ist. Reihenfolge = grob nach Priorität. Häkchen setzen sobald erledigt.

---

## 1. Technische Store-Blocker (MUSS vor Einreichung)

- [ ] **App-Icons final**: PNG-Icons (512×512, 192×192, 96×96) mit vollflächigem
      Hintergrund neu generieren — aktuell weiße Ecken (Maskable-Safe-Zone verletzt).
      Motiv muss in den mittleren 80 % liegen, Rand vollflächig gefüllt.
- [ ] **Bubblewrap-Setup**: PWA → Android AAB konvertieren (`bubblewrap init` + `build`).
      Liefert Paketname + SHA256-Fingerprint.
- [ ] **`.well-known/assetlinks.json` ausfüllen**: Platzhalter `TODO_REPLACE_*` durch
      echten Paketnamen + SHA256 aus Bubblewrap ersetzen, auf GitHub Pages deployen,
      Domainverknüpfung testen (`https://developers.google.com/digital-asset-links/tools/generator`).
- [ ] **Firebase Security Rules aktivieren**: Regeln aus `firebase-security-rules.json`
      in Firebase Console → Realtime Database → Rules eintragen & veröffentlichen.
      (Aktuell ist die DB offen les-/schreibbar — vor öffentlichem Launch schließen!)
      v3.39.1: Rules zusätzlich gehärtet (alle numerischen Leaderboard-Felder
      gedeckelt, state/guestAction/Queue-Payload-Größen begrenzt).
- [ ] **Firebase App Check aktivieren** (KOSTENLOS, höchste Security-Priorität):
      Console → App Check → reCAPTCHA v3 (Web) + Play Integrity (TWA), für Realtime
      Database ERZWINGEN. Einziger wirksamer Schutz gegen Queue-Wipe-DoS,
      Connection-Flood und Skript-/REST-Abuse ohne Blaze (denn `auth != null` ist
      via anonymem Login trivial erfüllbar). Client-SDK-Init + reCAPTCHA-Site-Key nötig.
- [ ] **Anonymous Auth aktivieren** (Console → Authentication → Sign-in method):
      Voraussetzung, damit die auth-gebundenen Rules greifen (sonst Fallback offen).
- [ ] **Screenshots erstellen**: `screenshots/`-Verzeichnis mit echten Spielbildern
      (390×844 PNG): Menü, Bauphase, Schussphase, Sieg. Mind. 2, besser 4–8.
- [ ] **Service-Worker-Offline-Test**: Flugmodus → App startet weiter aus Cache.

## 2. Google Play Console (Einreichung)

- [ ] **Developer-Account** anlegen (einmalig 25 USD — einzige unvermeidbare Gebühr;
      mit Kostenpolitik abklären, da sonst Zero-Cost).
- [ ] **Store-Eintrag (Listing)**: Kurzbeschreibung, lange Beschreibung, Feature-Grafik
      (1024×500), Icon (512×512), Screenshots, Kategorie „Spiele → Strategie".
- [ ] **Content-Rating-Fragebogen** ausfüllen (IARC) — bei dem Gameplay vermutlich PEGI 7/12.
- [ ] **Datenschutz-URL** eintragen: `https://skkjbeer.github.io/Fortress/privacy.html`.
- [ ] **Data-Safety-Formular**: angeben, dass localStorage + Firebase genutzt werden
      (Spielername=Pseudonym, ELO, keine echten personenbezogenen Daten, kein Tracking).
- [ ] **Geschlossener Test (closed testing)**: Play verlangt vor Produktion einen
      Testlauf mit min. 12 Testern über 14 Tage (Stand 2024+). Testergruppe organisieren.
- [ ] **Produktions-Release** beantragen nach bestandenem Test.

## 3. Qualität & Stabilität (vor breitem Launch)

- [ ] **Verbindungsabbruch-Handling**: Heartbeat/Reconnect für Online-Spiele
      (was passiert wenn Host abbricht? Gast hängt aktuell).
- [ ] **3-Spieler-Online End-to-End-Test** mit echten Geräten (v3.0.7-Fix verifizieren).
- [ ] **Matchmaking-Lasttest**: mehrere echte Spieler gleichzeitig, Cross-Device-Selbstmatch
      (bekannte Limitierung) beobachten.
- [ ] **Onboarding/Tutorial**: kurze Erklärung der Regeln für Neueinsteiger (Festung-Mechanik
      ist nicht selbsterklärend). Senkt Bounce-Rate massiv.
- [ ] **Performance auf Low-End-Geräten** testen (Render-Loop, Partikel-Cap greift jetzt).

## 4. Wachstum & Marketing (für „guten" Start, nicht nur „funktionierend")

- [ ] **Sound & Haptik**: SFX für Schuss/Treffer/Sieg + Vibration — erhöht Spielgefühl & Retention.
- [ ] **Teilen-Funktion**: „Fordere einen Freund heraus" mit Spielcode-Link (Web-Share-API).
- [ ] **Push-Re-Engagement**: später evtl. „dein Daily-Reward wartet" (braucht aber Backend/Kosten — erst nach Monetarisierung).
- [ ] **Landing-/Promo-Seite**: kurze Vorstellungsseite (GitHub Pages) mit Trailer-GIF & Play-Store-Badge.
- [ ] **Trailer/GIF**: 15–30 s Gameplay-Clip für Store & Social Media.
- [ ] **Soft-Launch**: erst in 1–2 Ländern/Freundeskreis, Feedback sammeln, dann global.
- [ ] **Feedback-Kanal**: In-App-Link zu GitHub Issues oder simples Formular.
- [ ] **App-Store-Optimierung (ASO)**: Keywords „Festung", „Burg", „Strategie", „2 Spieler" im Titel/Beschreibung.

## 5. Rechtliches & Langfristiges

- [ ] **Impressum** (in DE Pflicht bei öffentlichem Angebot) — ergänzen zu privacy.html.
- [ ] **Nutzungsbedingungen (Terms)** — simpel, Hobby-Projekt-Disclaimer.
- [ ] **Markenname prüfen**: „Fortress" ist generisch & vielfach belegt — evtl.
      eindeutigeren Store-Namen wählen (z. B. „Fortress: Burgenduell") für Auffindbarkeit.
- [ ] **Monetarisierung später** (erst wenn Mehrwert/Reichweite da): kosmetische Skins
      gegen Gold/IAP, Battle-Pass-Season — bleibt non-Pay2Win laut Design-Prinzip.
- [ ] **iOS/App Store** als zweite Plattform evaluieren (PWA-Wrapping via Capacitor/PWABuilder).

---

### Priorisierter Minimal-Pfad zum ersten Release
1. Icons fixen → 2. Bubblewrap + assetlinks → 3. Firebase Rules aktivieren →
4. Screenshots → 5. Tutorial → 6. Play Console Listing + Closed Test → 7. Produktion.
