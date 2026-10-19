// Kleine Anzeige-Komponenten (aus src/game/app.js herausgeloest, v3.96.0).
//
// Zweiter Schnitt beim Abtragen des Grossblocks (ARCHITEKTUR.md, Schritt 8).
// Gemeinsames Merkmal: Sie bekommen alles ueber Requisiten und Importe und
// greifen auf KEINEN aeusseren Zustand zu — deshalb lassen sie sich ohne
// Verhaltensaenderung verschieben. Groessere Modale bleiben vorerst drueben,
// die haengen tiefer im Zustand.
//
// **Eine Ausnahme mit Absicht:** `MatRow` zog `t()` aus dem Abschluss, also
// die Uebersetzungsfunktion, die an der Sprachwahl haengt. Sie kommt jetzt als
// Requisite herein. Fehlt sie, entfaellt nur der Titel-Text des Chips — kein
// Absturz und kein falsches Etikett. Ein stiller Rueckfall auf den rohen
// Schluessel waere schlimmer: Er saehe aus wie eine Uebersetzung.
import React from "react";
import { getLevelTier, xpToNextLevel } from "../engine/progression.ts";
import { MAT_ORDER, MAT_META } from "../engine/catalog.ts";
import { WAPPEN_SRC } from "./wappen.js";
import { SCHRIFT_TITEL, KONTURTEXT } from "./stil.js";


export function LevelBadge({ level, size }) {
  const tier = getLevelTier(level);
  const isLg = size === "lg";
  return React.createElement("div", {
    style: {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      // Comic-Abzeichen (v3.121.0): Rangfarbe als Fuellung, dunkle Kontur
      background: "linear-gradient(180deg, rgba(255,255,255,0.55), " + tier.border + " 45%, " + tier.border + ")",
      border: "2.5px solid #1b0f06",
      borderRadius: isLg ? 10 : 8,
      padding: isLg ? "3px 9px" : "1px 7px",
      fontSize: isLg ? 15 : 13,
      fontFamily: SCHRIFT_TITEL,
      color: "#fff",
      textShadow: KONTURTEXT,
      letterSpacing: "0.03em",
      boxShadow: "0 2px 0 #1b0f06, inset 0 2px 0 rgba(255,255,255,0.45)",
      flexShrink: 0,
      animation: "badgePop 0.3s cubic-bezier(.36,1.6,.56,1) both"
    }
  }, "L" + level);
}

export function ConfettiBurst({ active }) {
  if (!active) return null;
  const colors = ["#fbbf24","#a78bfa","#22d3ee","#f87171","#4ade80","#60a5fa","#fb923c","#e879f9"];
  const particles = Array.from({ length: 20 }, (_, i) => {
    const color = colors[i % colors.length];
    const left = 10 + (i / 19) * 80;
    const delay = (i * 0.05).toFixed(2);
    const dur = (0.8 + (i * 0.037) % 0.6).toFixed(2);
    const sz = 4 + (i % 3) * 2;
    return React.createElement("div", {
      key: i,
      style: {
        position: "absolute", left: left + "%", top: "0%",
        width: sz, height: sz * (i % 2 === 0 ? 2 : 1),
        borderRadius: i % 3 === 0 ? "50%" : 1,
        background: color,
        animation: "confettiFall " + dur + "s " + delay + "s ease-in both",
        pointerEvents: "none"
      }
    });
  });
  return React.createElement("div", {
    style: { position: "relative", height: 0, overflow: "visible", pointerEvents: "none" }
  }, ...particles);
}

export function WappenAvatar({ id, size = 36, eckig = false }) {
  // `hasOwnProperty`, nicht nur `WAPPEN_SRC[id]` (v3.112.0): `id` kann aus
  // dem Netz kommen (playerInfo des Hosts). Bei `id = "constructor"` liefert
  // ein Objektliteral eine FUNKTION aus der Prototypkette — die stuende dann
  // als Bild-Adresse im DOM und der Browser fragte sie an.
  const src = Object.prototype.hasOwnProperty.call(WAPPEN_SRC, id)
    ? WAPPEN_SRC[id] : WAPPEN_SRC.skelett;
  // `eckig` (v3.125.0): Die gemalten Avatare sind quadratische Bilder mit
  // eigenem Hintergrund — im Auswahl-Raster fuellen sie die Kachel ganz,
  // statt rund ausgeschnitten mit dunklen Ecken darin zu sitzen.
  if (eckig) return React.createElement('img', { src, alt: '', decoding: 'async', draggable: false,
    style: { display: 'block', width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 } });
  return React.createElement('img', { src, width: size, height: size, alt: '', decoding: 'async', style: { display: 'block', flexShrink: 0, borderRadius: '50%', imageRendering: 'auto' } });  }

export // Statische XP-Leiste (Profil-Karte, Profil-Editor)
function XpBarUI({ level, xp }) {
  const needed = xpToNextLevel(level);
  const pct = Math.min(100, xp / needed * 100);
  return React.createElement("div", { style: { marginTop: 5 } },
    React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 3 } },
      React.createElement("span", { style: { fontSize: 11, fontWeight: 800, color: "#fffaf0", textShadow: KONTURTEXT } }, xp + " / " + needed + " XP")
    ),
    React.createElement("div", { style: { height: 12, background: "#0d1f45", border: "2px solid #1b0f06", borderRadius: 8, overflow: "hidden", position: "relative", boxSizing: "border-box" } },
      React.createElement("div", { style: { position: "absolute", top: 0, left: 0, height: "100%", width: pct + "%", background: "linear-gradient(180deg,#d8f7ff 0%,#4fc3ff 45%,#1f7fd8 100%)", borderRadius: 6, boxShadow: "inset 0 2px 0 rgba(255,255,255,0.5)", transition: "width 0.4s ease" } })
    )
  );
}

export // Schmiede-Material sichtbar machen (v3.68.0). Vorher wanderten Eisen,
// Silber, Drachenstahl und Sternenstaub still ins Profil — man merkte erst
// in der Schmiede, dass sich etwas angesammelt hatte. Ein Rautenpip ist die
// gemeinsame Bildsprache: Menue-Leiste, Ergebnis-Karte, Aufgaben, Schmiede.
function MatPip({ k, size = 9 }) {
  return React.createElement("span", { style: {
    width: size, height: size, flexShrink: 0, background: MAT_META[k].c,
    transform: "rotate(45deg)", borderRadius: 2, boxShadow: "0 0 6px " + MAT_META[k].c
  } });
}

export // Zeile aus Material-Chips. `vals` = {iron,silver,...}; `nurPositive` blendet
// Nullwerte aus (Belohnungs-Anzeige), sonst bleiben sie gedimmt stehen
// (Bestands-Anzeige — so sieht man auch, welche Sorten es ueberhaupt gibt).
function MatRow({ vals, nurPositive, plus, size, gap, t }) {
  const keys = MAT_ORDER.filter((k) => !nurPositive || (vals[k] || 0) > 0);
  if (!keys.length) return null;
  return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: gap == null ? 6 : gap, flexWrap: "wrap" } },
    keys.map((k) => {
      const n = vals[k] || 0;
      return React.createElement("span", { key: k, title: t ? t("mat_" + k) : void 0, style: {
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: size || 11, fontWeight: 900,
        // 0 bleibt erkennbar gedimmt, aber lesbar (v3.128.0: vorher 2,2:1)
        color: n > 0 ? "#e2e8f0" : "#9fb0cc", opacity: n > 0 ? 1 : 0.85
      } },
        React.createElement(MatPip, { k, size: size ? size - 2 : 9 }),
        (plus && n > 0 ? "+" : "") + n
      );
    })
  );
}
