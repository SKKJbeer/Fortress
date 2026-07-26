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
  slayer: { price: 250 },
  repair: { base: 150, step: 50 }        // +3 Trümmer → Mauern; Preis steigt je Kauf (Staffel pro Karte)
};
