// Gemalte Bilder fuer kauf- und waehlbare Artikel (v3.123.0, Skill spielgrafik).
//
// Kanonen-Modelle, Kugelspuren, Einschlaege und Sieges-Effekte bekommen je ein
// gemaltes Bild unter `public/artikel/<id>.webp` (192 px, Herkunft in
// assets/artikel/ENTSTEHUNG.md). VORHANDEN listet, welche
// schon fertig sind — fehlt ein Bild, zeichnet der Aufrufer die bisherige
// Vorschau (keine kaputten Bildverweise, wenn ein Bild noch rechnet).
// Rahmen bleiben gezeichnete Ringe (ein gemalter Rahmen braeuchte Transparenz).
import React from "react";
import { FARBE } from "./stil.js";

export const VORHANDEN = new Set([
  "cannon_standard",
  "cannon_bronze",
  "cannon_steel",
  "cannon_royal",
  "cannon_crystal",
  "cannon_obsidian",
  "cannon_dragon",
  "cannon_star",
  "cannon_hexer",
  "trail_standard",
  "trail_ember",
  "trail_frost",
  "trail_venom",
  "trail_gold",
  "trail_ember_m",
  "trail_frost_m",
  "trail_venom_m",
  "trail_gold_m",
  "impact_standard",
  "impact_lava",
  "impact_ice",
  "impact_blitz",
  "impact_void",
  "win_confetti",
  "win_fireworks",
  "win_goldrain",
]);

export function artikelPfad(id) {
  return VORHANDEN.has(id) ? "artikel/" + id + ".webp" : null;
}

/** Artikelbild als runde Kachel; `ersatz` wird gezeigt, solange es kein Bild gibt. */
export function ArtikelBild({ id, groesse = 56, ersatz = null }) {
  const pfad = artikelPfad(id);
  if (!pfad) return ersatz;
  return React.createElement("img", {
    src: pfad, alt: "", draggable: false, decoding: "async", "data-artikel": id,
    style: { width: groesse, height: groesse, borderRadius: groesse * 0.28, display: "block", objectFit: "cover",
      border: "2.5px solid " + FARBE.kontur, boxShadow: "0 3px 0 " + FARBE.kontur },
  });
}
