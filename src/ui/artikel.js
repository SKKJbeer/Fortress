// Gemalte Bilder fuer kauf- und waehlbare Artikel (v3.123.0, Skill spielgrafik).
//
// Kanonen-Modelle, Kugelspuren, Einschlaege und Sieges-Effekte bekommen je ein
// gemaltes Bild unter `public/artikel/<id>.png`. VORHANDEN listet, welche
// schon fertig sind — fehlt ein Bild, zeichnet der Aufrufer die bisherige
// Vorschau (keine kaputten Bildverweise, wenn ein Bild noch rechnet).
// Rahmen bleiben gezeichnete Ringe (ein gemalter Rahmen braeuchte Transparenz).
import React from "react";
import { FARBE } from "./stil.js";

export const VORHANDEN = new Set([
]);

export function artikelPfad(id) {
  return VORHANDEN.has(id) ? "artikel/" + id + ".png" : null;
}

/** Artikelbild als runde Kachel; `ersatz` wird gezeigt, solange es kein Bild gibt. */
export function ArtikelBild({ id, groesse = 56, ersatz = null }) {
  const pfad = artikelPfad(id);
  if (!pfad) return ersatz;
  return React.createElement("img", {
    src: pfad, alt: "", draggable: false, "data-artikel": id,
    style: { width: groesse, height: groesse, borderRadius: groesse * 0.28, display: "block", objectFit: "cover",
      border: "2.5px solid " + FARBE.kontur, boxShadow: "0 3px 0 " + FARBE.kontur },
  });
}
