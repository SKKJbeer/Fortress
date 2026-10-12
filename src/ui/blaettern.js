// Menues ohne Scrollen (v3.123.0): Reiter + blaetterbare Seiten.
//
// Wunsch des Betreibers: Kein Menue soll rollen — alles auf einen Blick. Wo der
// Inhalt nicht auf einen Bildschirm passt, wird er in REITER (Kategorien) und
// SEITEN (mit Punkten, Pfeilen und Wischen) geteilt statt in eine lange Liste.
// Wie viel auf eine Seite passt, rechnet `useSchirm` aus der echten
// Fensterhoehe — so passt es auf dem iPhone SE genauso wie auf dem iPad.
import React from "react";
import { useState, useEffect, useRef } from "react";
import { Icon } from "./icons.js";
import { FARBE, SCHRIFT_TITEL, KONTURTEXT, knopf, schalter } from "./stil.js";

/** Aktuelle Fensterhoehe/-breite (CSS-Pixel), aktualisiert bei Groessenaenderung. */
export function useSchirm() {
  const lies = () => ({
    h: typeof window !== "undefined" ? window.innerHeight : 800,
    w: typeof window !== "undefined" ? window.innerWidth : 390,
  });
  const [m, setM] = useState(lies);
  useEffect(() => {
    const f = () => setM(lies());
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return m;
}

/** Wie viele Zeilen der Hoehe `zeilenH` passen in `verfuegbar` Pixel (mindestens 1). */
export function zeilenFuer(verfuegbar, zeilenH, luecke = 8) {
  return Math.max(1, Math.floor((verfuegbar + luecke) / (zeilenH + luecke)));
}

/** Teilt eine Liste in Seiten zu je `proSeite` Eintraegen (mindestens eine Seite). */
export function seitenVon(eintraege, proSeite) {
  const n = Math.max(1, proSeite | 0);
  const s = [];
  for (let i = 0; i < eintraege.length; i += n) s.push(eintraege.slice(i, i + n));
  return s.length ? s : [[]];
}

/** Reiterleiste: Kategorie-Knoepfe im Comic-Stil, der aktive farbig. */
export function Reiter({ reiter, aktiv, onWahl }) {
  const h = React.createElement;
  // Platz je Reiter (Panel hoechstens ~420 breit, abzueglich Rand): Reicht er
  // nicht fuer Symbol UND Wort, faellt das Symbol weg — abgeschnittene Woerter
  // („Kan…") sind schlechter als kein Symbol.
  const { w } = useSchirm();
  const proReiter = (Math.min(w, 420) - 76) / Math.max(1, reiter.length);
  const mitSymbol = proReiter >= 116;
  return h("div", { role: "tablist", style: { display: "flex", gap: 6, marginBottom: 10 } },
    reiter.map((r) => h("button", {
      key: r.key, role: "tab", "aria-selected": aktiv === r.key, "data-reiter": r.key,
      onClick: () => onWahl(r.key),
      style: schalter(aktiv === r.key, r.farbe || "gold", { flex: 1, minWidth: 0, padding: "7px 3px", fontSize: proReiter < 76 ? 12.5 : 13.5, gap: 4, position: "relative" }),
    },
      r.icon && mitSymbol ? h(Icon, { name: r.icon, size: 15 }) : null,
      h("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.label),
      r.badge ? h("span", { style: {
        position: "absolute", top: -7, right: -5, minWidth: 18, height: 18, borderRadius: 9,
        background: "linear-gradient(180deg,#ff8a7a,#ef4b34 55%,#a8261a)", border: "2px solid " + FARBE.kontur,
        fontSize: 10, fontFamily: SCHRIFT_TITEL, color: "#fff", textShadow: KONTURTEXT,
        display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
      } }, r.badge) : null)));
}

/**
 * Blaetterbare Seiten: zeigt EINE Seite eines Rasters; darunter Punkte und
 * Pfeile, dazu Wischen. Ohne zweite Seite keine Steuerung (nichts Ueberfluessiges).
 *   eintraege  Liste beliebiger Daten
 *   proSeite   Eintraege je Seite
 *   spalten    Spalten des Rasters
 *   render     (eintrag, index) => Element
 */
export function Seiten({ eintraege, proSeite, spalten = 1, render, luecke = 8, schluessel }) {
  const h = React.createElement;
  const seiten = seitenVon(eintraege, proSeite);
  const [seite, setSeite] = useState(0);
  const start = useRef(null);
  // Wechselt die Liste (anderer Reiter, Fenster gewachsen), nicht auf einer
  // Seite stehen bleiben, die es nicht mehr gibt.
  useEffect(() => { setSeite(0); }, [schluessel, proSeite]);
  const s = Math.min(seite, seiten.length - 1);
  const geh = (d) => setSeite((x) => Math.max(0, Math.min(seiten.length - 1, x + d)));
  const pfeil = (d, name) => h("button", {
    "aria-label": d < 0 ? "vorherige Seite" : "naechste Seite", "data-blaettern": d < 0 ? "zurueck" : "vor",
    disabled: d < 0 ? s === 0 : s === seiten.length - 1,
    onClick: () => geh(d),
    style: knopf("blau", { width: 38, height: 34, padding: 0, borderRadius: 12, opacity: (d < 0 ? s === 0 : s === seiten.length - 1) ? 0.35 : 1 }),
  }, h(Icon, { name, size: 18 }));
  return h("div", { "data-seiten": seiten.length, "data-seite": s },
    h("div", {
      onPointerDown: (e) => { start.current = e.clientX; },
      onPointerUp: (e) => {
        if (start.current == null) return;
        const dx = e.clientX - start.current; start.current = null;
        if (Math.abs(dx) > 40) geh(dx < 0 ? 1 : -1);
      },
      style: { display: "grid", gridTemplateColumns: `repeat(${spalten}, minmax(0, 1fr))`, gap: luecke, touchAction: "pan-y" },
    }, seiten[s].map((e, i) => render(e, s * proSeite + i))),
    seiten.length > 1 ? h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10 } },
      pfeil(-1, "chevronLeft"),
      h("div", { style: { display: "flex", gap: 6 } }, seiten.map((_, i) => h("button", {
        key: i, "aria-label": "Seite " + (i + 1), onClick: () => setSeite(i),
        style: { width: i === s ? 22 : 10, height: 10, borderRadius: 5, padding: 0, cursor: "pointer",
          border: "2px solid " + FARBE.kontur, background: i === s ? FARBE.gold : "rgba(255,255,255,0.35)", transition: "width .2s" },
      }))),
      pfeil(1, "chevronRight")) : null);
}
