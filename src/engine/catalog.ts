import type { Profile, MatKey, Materials } from './const.ts';
// Auto-extrahiert aus index.html (Phase 1 der Modularisierung, v3.34.0).
// Reine Logik/Daten — kein DOM, kein React, kein Firebase. Unit-testbar via node --test.
// Kosmetik-Kataloge (Gold-Shop + Schmiede) und Profil-Normalisierer.
const __spreadValues = (a: any, b: any) => Object.assign(a, b);

export const COSMETICS = {
  trail: [
    { id: "trail_standard", price: 0 },
    { id: "trail_ember", price: 150 },
    { id: "trail_frost", price: 150 },
    { id: "trail_venom", price: 250 },
    { id: "trail_gold", price: 400 }
  ],
  frame: [
    { id: "frame_none", price: 0 },
    { id: "frame_bronze", price: 100 },
    { id: "frame_silver", price: 250 },
    { id: "frame_gold", price: 500 },
    { id: "frame_dragon", price: 800 }
  ],
  cannon: [
    { id: "cannon_standard", price: 0 },
    { id: "cannon_bronze", price: 250 },
    { id: "cannon_steel", price: 450 },
    { id: "cannon_royal", price: 700 }
  ],
  win: [
    { id: "win_confetti", price: 0 },
    { id: "win_fireworks", price: 200 },
    { id: "win_goldrain", price: 350 }
  ]
};
export const TRAIL_COLOR = { trail_ember: "#fb923c", trail_frost: "#7dd3fc", trail_venom: "#a3e635", trail_gold: "#fcd34d" };
// Sieges-Animationen: professionelle SVG-Icons statt Emojis (v3.29.1,
// Design-Regel aus v3.27.0 — Emojis nur noch in Spieltexten, nie als UI-Icon).
export const WIN_ICON = {
  win_confetti: { name: "sparkles", c: "#a78bfa" },
  win_fireworks: { name: "rocket", c: "#f87171" },
  win_goldrain: { name: "coins", c: "#fbbf24" }
};
// Profilrahmen (v3.66.0): `bg` gibt jedem Rahmen eine eigene MACHART statt nur
// einer anderen Randfarbe — vorher unterschieden sich Bronze, Silber, Gold und
// Drache in genau einem Farbwert. Der Ring entsteht als CSS-Verlauf hinter dem
// Avatar; das kostet nichts und wirkt wie geschmiedet.
//   bronze  genietet: harte Punkte auf mattem Metall
//   silber  kantig geschliffen: schmale helle Facetten
//   gold    Zierkranz: feine Strahlen ringsum
//   drache  Schuppenrand: ueberlappende Boegen, zweifarbig
export const FRAME_STYLE = {
  frame_bronze: { c: "#b45309", glow: "rgba(180,83,9,0.6)", dick: 4,
    bg: "repeating-conic-gradient(#7c3d06 0deg 9deg, #d97706 9deg 12deg, #a45309 12deg 18deg)" },
  frame_silver: { c: "#cbd5e1", glow: "rgba(203,213,225,0.6)", dick: 4,
    bg: "repeating-conic-gradient(#64748b 0deg 6deg, #f1f5f9 6deg 8deg, #94a3b8 8deg 15deg)" },
  frame_gold: { c: "#fbbf24", glow: "rgba(251,191,36,0.65)", dick: 5,
    bg: "repeating-conic-gradient(#a16207 0deg 4deg, #fde68a 4deg 6deg, #d97706 6deg 10deg, #fbbf24 10deg 12deg)" },
  frame_dragon: { c: "#a78bfa", glow: "rgba(167,139,250,0.7)", dick: 5,
    bg: "repeating-conic-gradient(#4c1d95 0deg 10deg, #a78bfa 10deg 14deg, #6d28d9 14deg 20deg, #c4b5fd 20deg 22deg)" }
};
export function cosOf(p: Profile | null | undefined) {
  const c = (p && p.cosmetics) || {};
  return {
    owned: Array.isArray(c.owned) ? c.owned : [],
    equipped: __spreadValues({ trail: "trail_standard", frame: "frame_none", win: "win_confetti", cannon: "cannon_standard", impact: "impact_standard" }, c.equipped || {})
  };
}
// ── Schmiede (v3.33.0): Crafting-System ─────────────────────────────
// Materialien werden ERSPIELT (Online-Matches + Tagesaufgaben + Achievements),
// Rezepte sind fest (kein Glücksspiel/Lootbox — bewusste Design- und
// Store-Entscheidung). Ergebnisse sind rein kosmetisch (kein Pay2Win) und
// landen wie Shop-Käufe in profile.cosmetics.owned/equipped.
export const MAT_ORDER: MatKey[] = ["iron", "silver", "dragon", "star"];
export const MAT_META = {
  iron:   { c: "#94a3b8" },  // Eisensplitter — jedes Online-Match
  silver: { c: "#e2e8f0" },  // Silbererz — Online-Siege + Tagesaufgaben
  dragon: { c: "#fb7185" },  // Drachenstahl — Siegesserien (3er-Schritte) + Tag-7-Kiste
  star:   { c: "#c4b5fd" }   // Sternenstaub — Achievement-Freischaltungen
};
// Material-Bonus je abgeholter Tagesaufgabe (v3.33.0, seit v3.68.0 als
// Konstante — die Aufgaben-Liste wirbt jetzt vorab damit).
export const TASK_MAT = { iron: 3, silver: 1 };
// Wie viele Rezepte koennte der Spieler JETZT schmieden? (v3.68.0)
// Treibt das Abzeichen am Schmiede-Button — ohne Hinweis merkt niemand, dass
// sich genug Material angesammelt hat.
export function craftbar(p: Profile | null | undefined): number {
  const m = matOf(p);
  const owned = ((p && p.cosmetics) || {}).owned || [];
  let n = 0;
  for (const r of RECIPES) {
    if (owned.includes(r.id)) continue;
    if ((p && p.gold || 0) < (r.cost.gold || 0)) continue;
    let ok = true;
    for (const k of MAT_ORDER) if ((r.cost[k] || 0) > m[k]) { ok = false; break; }
    if (ok) n++;
  }
  return n;
}
export function matOf(p: Profile | null | undefined): Materials {
  const m = (p && p.materials) || {};
  return { iron: m.iron || 0, silver: m.silver || 0, dragon: m.dragon || 0, star: m.star || 0 };
}
// Kanonen-Skins: Kuppel-/Kern-Farben; Spieler-Neonring bleibt (Team-Erkennung!)
// style (v3.44.0): jeder Skin bekommt eine EIGENE Form + Signatur-Effekt statt
// nur einer Umfärbung — sonst entsteht kein Sammel-Anreiz. Der Spieler-Neonring
// bleibt in allen Varianten erhalten (Team-Erkennung!).
//   crystal = Facetten-Kuppel     rune = rotierender Runenkranz (Hexer)
//   scale   = Drachenschuppen     star = umlaufende Sterne
// form (v3.62.0): eigene SILHOUETTE je Skin — vorher unterschieden sich alle
// Modelle nur in der Farbe, die Form war identisch. Jetzt beschreibt `form`
// Sockel (s), Rohr (r) und Muendung (m); src/render/sprites.js baut daraus das
// Modell. Damit ist ein Skin auf dem Spielfeld an der Kontur erkennbar, nicht
// erst an der Farbe — das ist der eigentliche "haben wollen"-Faktor.
export const CANNON_SKIN = {
  cannon_crystal:  { dome: ["#cffafe", "#0e7490", "#083344"], core: "#a5f3fc", style: "crystal", fx: "#67e8f9",
                     form: { s: "kristall", r: "kristall", m: "prisma" } },
  cannon_obsidian: { dome: ["#6d28d9", "#27216b", "#0c0a1d"], core: "#c4b5fd", style: "rune",    fx: "#a78bfa",
                     form: { s: "monolith", r: "kurz",     m: "ring" } },
  cannon_hexer:    { dome: ["#7e22ce", "#3b0764", "#100519"], core: "#f0abfc", style: "rune",    fx: "#e879f9", hexer: true,
                     form: { s: "monolith", r: "haken",    m: "ring" } },
  cannon_dragon:   { dome: ["#dc2626", "#7f1d1d", "#1c0a0a"], core: "#fca5a5", style: "scale",   fx: "#fb923c",
                     form: { s: "schuppe",  r: "hals",     m: "kiefer" } },
  cannon_star:     { dome: ["#2563eb", "#1e3a8a", "#0b1026"], core: "#fde047", style: "star",    fx: "#fde047", stars: true,
                     form: { s: "ring",     r: "stab",     m: "stern" } },
  // Gold-Shop-Modelle (v3.45.0): kaufbar statt schmiedbar. Eigene Panzerung,
  // bewusst OHNE Signatur-Animation — die bleibt der Schmiede-Stufe vorbehalten.
  cannon_bronze:   { dome: ["#e6b877", "#a06a2c", "#3c2410"], core: "#fde68a",
                     form: { s: "niete",    r: "trichter", m: "wulst" } },
  cannon_steel:    { dome: ["#dbe3ee", "#69748a", "#1b2029"], core: "#e2e8f0",
                     form: { s: "kaste",    r: "doppel",   m: "brems" } },
  cannon_royal:    { dome: ["#fef3c7", "#c79a2e", "#4a3410"], core: "#fff7d6", style: "crystal", fx: "#fde68a",
                     form: { s: "krone",    r: "zier",     m: "krone" } }
};
// Einschlag-Effekte (v3.66.0): p = Partikel-Palette, ring = Explosions-Gradient.
// NEU `art` — jeder Effekt hat jetzt eine EIGENE PHYSIK, nicht nur eine andere
// Farbe. Vorher explodierten Lava, Eis, Blitz und Leere identisch und waren
// nur umgefaerbt; fuer bis zu 800 Gold plus Drachenstahl war das zu wenig.
//   n     Partikelzahl
//   v     Grundgeschwindigkeit
//   auf   Anfangsschub nach oben (negativ = faellt sofort)
//   grav  Schwerkraft je Frame
//   life  Lebensdauer in Frames
//   size  Grundgroesse
//   rund  runde Partikel (sonst eckige Splitter)
//   sog   zieht die Partikel zum Einschlag HIN statt weg (Implosion)
export const IMPACT_FX = {
  // Lava: wenige schwere Brocken, fliegen hoch und klatschen zurueck
  impact_lava:  { p: ["#fff7ed", "#fdba74", "#f97316", "#dc2626"], ring: ["255,237,213", "249,115,22", "220,38,38"],
                  art: { n: 16, v: 3.4, auf: 2.6, grav: 0.30, life: 34, size: 3.4, rund: true } },
  // Eis: viele scharfe Splitter, flach nach aussen, kaum Schwerkraft
  impact_ice:   { p: ["#f0f9ff", "#bae6fd", "#38bdf8", "#0284c7"], ring: ["224,242,254", "56,189,248", "2,132,199"],
                  art: { n: 30, v: 6.2, auf: 0, grav: 0.03, life: 22, size: 2.0, rund: false } },
  // Blitz: sehr schnelle duenne Funken, extrem kurzlebig
  impact_blitz: { p: ["#fefce8", "#fde047", "#facc15", "#a16207"], ring: ["254,249,195", "250,204,21", "161,98,7"],
                  art: { n: 26, v: 9.0, auf: 0, grav: 0.0, life: 10, size: 1.5, rund: false } },
  // Leere: Implosion — die Partikel starten aussen und werden hineingezogen
  impact_void:  { p: ["#f5f3ff", "#c4b5fd", "#7c3aed", "#312e81"], ring: ["237,233,254", "124,58,237", "49,46,129"],
                  art: { n: 24, v: 4.5, auf: 0, grav: 0.0, life: 26, size: 2.6, rund: true, sog: true } }
};
// Schweif-Formen (v3.66.0): Vorher war JEDER Trail eine Kette gleich grosser
// Kreise, nur in einer anderen Farbe — bei fuenf Kaufartikeln zu wenig.
// Jetzt hat jeder eine eigene Form und Bewegung.
//   form  "funke" | "kristall" | "blase" | "muenze" | "kugel"
//   drift seitliches Ausfransen je Glied
//   wachs Groessenverlauf entlang des Schweifs
export const TRAIL_FORM = {
  trail_ember:  { form: "funke",    drift: 1.6, wachs: 0.35 },  // stiebende Funken
  trail_frost:  { form: "kristall", drift: 0.9, wachs: 0.30 },  // eckige Splitter
  trail_venom:  { form: "blase",    drift: 1.1, wachs: 0.60 },  // wachsende Blasen
  trail_gold:   { form: "muenze",   drift: 0.7, wachs: 0.28 },  // flache Plaettchen
  trail_ember_m: { form: "funke",    drift: 2.1, wachs: 0.42 },
  trail_frost_m: { form: "kristall", drift: 1.3, wachs: 0.36 },
  trail_venom_m: { form: "blase",    drift: 1.5, wachs: 0.72 },
  trail_gold_m:  { form: "muenze",   drift: 1.0, wachs: 0.34 }
};
// Meister-Trails (veredelte Shop-Trails): mehrfarbiger, längerer Schweif
export const MASTER_TRAIL = {
  trail_ember_m: ["#fde68a", "#fb923c", "#ef4444"],
  trail_frost_m: ["#e0f2fe", "#7dd3fc", "#2563eb"],
  trail_venom_m: ["#d9f99d", "#a3e635", "#16a34a"],
  trail_gold_m:  ["#fef9c3", "#fcd34d", "#d97706"]
};
export const RECIPES = [
  { id: "cannon_crystal",  cat: "cannon", cost: { iron: 20, silver: 5,  gold: 200 } },
  { id: "cannon_obsidian", cat: "cannon", cost: { iron: 25, silver: 8,  gold: 300 } },
  { id: "cannon_dragon",   cat: "cannon", cost: { silver: 10, dragon: 3, gold: 500 } },
  { id: "cannon_star",     cat: "cannon", cost: { dragon: 4, star: 2,   gold: 800 } },
  { id: "cannon_hexer",    cat: "cannon", cost: { silver: 12, dragon: 5, star: 3, gold: 1200 } },
  { id: "impact_lava",  cat: "impact", cost: { iron: 15, silver: 4, gold: 150 } },
  { id: "impact_ice",   cat: "impact", cost: { iron: 15, silver: 4, gold: 150 } },
  { id: "impact_blitz", cat: "impact", cost: { iron: 10, dragon: 2, gold: 250 } },
  { id: "impact_void",  cat: "impact", cost: { dragon: 3, star: 1,  gold: 400 } },
  // Veredeln: setzt Besitz des Basis-Trails aus dem Gold-Shop voraus
  { id: "trail_ember_m", cat: "trail", base: "trail_ember", cost: { dragon: 5, star: 1, gold: 300 } },
  { id: "trail_frost_m", cat: "trail", base: "trail_frost", cost: { dragon: 5, star: 1, gold: 300 } },
  { id: "trail_venom_m", cat: "trail", base: "trail_venom", cost: { dragon: 5, star: 1, gold: 300 } },
  { id: "trail_gold_m",  cat: "trail", base: "trail_gold",  cost: { dragon: 5, star: 2, gold: 400 } }
];
