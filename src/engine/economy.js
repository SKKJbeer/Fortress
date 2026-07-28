// Auto-extrahiert aus index.html (Phase 1 der Modularisierung, v3.34.0).
// Reine Logik/Daten — kein DOM, kein React, kein Firebase. Unit-testbar via node --test.
// ── Beute-Ökonomie (v3.65.0, vormals "Schrott") ────────────────────────
// ALLE Beträge wurden gegenüber v3.64.0 mit 10 multipliziert. Die Balance
// ist damit IDENTISCH — nur das Zahlenbild ist substanzieller: eine
// zerstörte Kanone bringt 180 statt 18, eine Kanone kostet 200 statt 20.
// Zweistellige Beträge wirkten für eine Belagerungs-Ökonomie kleinlich.
// In-Match-Währung: verdient durch Zerstören (Mauer, Kanonen-Kill) und
// Überleben (je Rüstphase). KEIN Gratis-Kanonen-Nachschub mehr — alles
// nach den 2 Setup-Kanonen wird im Shop der Rüstphase gekauft.
// v3.31.0 Balancing III (Playtest, 2 echte Spieler): Mauer 1→2 (Einkommen war
// zu dünn — verdoppelt auch die Trümmer-Bergung des Comeback-Pakets, Parität
// bleibt), Kanonen-Kill 12→18 (mit HP 12 teurer erkämpft). Überlebens-Sold 6
// bleibt (Messpass v3.24.0: gesunde Ausgabenquote, keine Hortung).
export const SCRAP_WALL = 20, SCRAP_CANNON = 180, SCRAP_SURVIVE = 60;
// Wiederaufbau-Paket (v3.30.0): Überlebens-Sold, wenn ein Spieler KEINE
// einsatzfähige Kanone mehr hat — verhindert die Todesspirale (ohne Kanonen
// kein Schieß-Einkommen → nie wieder Kanone leistbar).
export const SCRAP_REBUILD = 120;
export const SHOP = {
  cannon: { base: 200, step: 80 },       // Preis steigt je Kauf (Selbstlimitierung)
  reload: { prices: [250, 500], factors: [1, 0.8, 0.65] }, // globaler Nachlade-Faktor
  // Balancing-Messpass v3.24.0 (Selfplay-Daten, SPEC-Changelog): Panzerung
  // verlängerte beidseitig gekaufte Spiele auf fast das Doppelte → 35→45
  // (landet damit erst mitte Match statt Runde 1–2). Reparatur bekam eine
  // Preis-Staffel wie Kanonen (Anti-Patt: unbegrenzte Flat-Reparatur war das
  // strukturelle Risiko; 1–2 Reparaturen pro Karte bleiben billig).
  armor:  { price: 450 },               // Mauern halten 2 Treffer
  // Kanonen-Bezwinger (v3.57.0): zweite Kanonenart, wirkt NUR gegen Kanonen.
  // Guenstiger als eine normale Kanone, weil sie keinen Mauerschaden macht.
  //
  // FREISCHALTUNG UEBER DEN PREIS (v3.73.0, loest die Regel-Sperre aus v3.67.0 ab)
  // Der Bezwinger darf in Runde 1 nicht dastehen — sonst wird die Aufbauphase
  // uebersprungen und das Spiel beginnt sofort als Kanonenjagd. Bis v3.72.0
  // erzwangen das zwei kuenstliche Bedingungen (abRunde 3, minKanonen 3). Das
  // ist jetzt eine reine PREISFRAGE: 550 ist in Runde 1 rechnerisch nicht
  // erreichbar.
  //
  // Rechnung der Obergrenze fuer Runde 1:
  //   Startbeute                                        150
  //   SCRAP_SURVIVE beim Eintritt in die Ruestphase    + 60
  //   Schuesse: 2 Startkanonen × floor(SHOOT_TIME / RELOAD_MS)
  //             = 2 × floor(20000/2500) = 16 Kugeln
  //   Beute je Treffer: SCRAP_WALL wird EINMAL pro Kugel gezahlt,
  //             nicht pro zerstoerter Zelle          + 16 × 20 = 320
  //   ─────────────────────────────────────────────────────────
  //   absolute Obergrenze bei perfektem Spiel           530
  //
  // Kanonen-Kills scheiden aus: Standardkugeln beschaedigen Kanonen gar nicht
  // (dafuer braeuchte es bereits einen Bezwinger). Gemessen erreichten Bots auf
  // Stufe Mittel in Runde 1 hoechstens 250 — der Abstand zur Grenze ist also
  // gross genug, dass auch starke Menschen sie nicht reissen.
  //
  // Ab Runde 2 ist der Kauf offen, verlangt aber Verzicht: wer ihn will, darf
  // in Runde 1 nichts anderes kaufen. Das ist die Entscheidung, die das
  // Upgrade interessant macht.
  slayer: { price: 550 },
  repair: { base: 150, step: 50 }        // +3 Trümmer → Mauern; Preis steigt je Kauf (Staffel pro Karte)
};
