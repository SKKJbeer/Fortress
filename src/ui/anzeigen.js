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


export function LevelBadge({ level, size }) {
  const tier = getLevelTier(level);
  const isLg = size === "lg";
  return React.createElement("div", {
    style: {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg," + tier.border + "cc," + tier.border + "55)",
      border: "1.5px solid " + tier.border,
      borderRadius: isLg ? 8 : 6,
      padding: isLg ? "3px 8px" : "2px 5px",
      fontSize: isLg ? 12 : 9,
      fontWeight: 900,
      color: tier.color,
      letterSpacing: "0.04em",
      boxShadow: "0 0 8px " + tier.glow,
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

export function WappenAvatar({ id, size = 36 }) {
  // `hasOwnProperty`, nicht nur `WAPPEN_SRC[id]` (v3.112.0): `id` kann aus
  // dem Netz kommen (playerInfo des Hosts). Bei `id = "constructor"` liefert
  // ein Objektliteral eine FUNKTION aus der Prototypkette — die stuende dann
  // als Bild-Adresse im DOM und der Browser fragte sie an.
  const src = Object.prototype.hasOwnProperty.call(WAPPEN_SRC, id)
    ? WAPPEN_SRC[id] : WAPPEN_SRC.skelett;
  return React.createElement('img', { src, width: size, height: size, alt: '', style: { display: 'block', flexShrink: 0, borderRadius: '50%', imageRendering: 'auto' } });  }

export // Statische XP-Leiste (Profil-Karte, Profil-Editor)
function XpBarUI({ level, xp }) {
  const needed = xpToNextLevel(level);
  const pct = Math.min(100, xp / needed * 100);
  return React.createElement("div", { style: { marginTop: 5 } },
    React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 3 } },
      React.createElement("span", { style: { fontSize: 9, color: "#475569" } }, xp + " / " + needed + " XP")
    ),
    React.createElement("div", { style: { height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", position: "relative" } },
      React.createElement("div", { style: { position: "absolute", top: 0, left: 0, height: "100%", width: pct + "%", background: "linear-gradient(90deg,#7c3aed,#22d3ee)", borderRadius: 3, boxShadow: "0 0 6px rgba(124,58,237,0.7)", transition: "width 0.4s ease" } })
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
        color: n > 0 ? "#e2e8f0" : "#475569", opacity: n > 0 ? 1 : 0.55
      } },
        React.createElement(MatPip, { k, size: size ? size - 2 : 9 }),
        (plus && n > 0 ? "+" : "") + n
      );
    })
  );
}
