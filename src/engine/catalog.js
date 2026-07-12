// Auto-extrahiert aus index.html (Phase 1 der Modularisierung, v3.34.0).
// Reine Logik/Daten — kein DOM, kein React, kein Firebase. Unit-testbar via node --test.
// Kosmetik-Kataloge (Gold-Shop + Schmiede) und Profil-Normalisierer.
const __spreadValues = (a, b) => Object.assign(a, b);

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
export const FRAME_STYLE = {
  frame_bronze: { c: "#b45309", glow: "rgba(180,83,9,0.6)" },
  frame_silver: { c: "#cbd5e1", glow: "rgba(203,213,225,0.6)" },
  frame_gold: { c: "#fbbf24", glow: "rgba(251,191,36,0.65)" },
  frame_dragon: { c: "#a78bfa", glow: "rgba(167,139,250,0.7)" }
};
export function cosOf(p) {
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
export const MAT_ORDER = ["iron", "silver", "dragon", "star"];
export const MAT_META = {
  iron:   { c: "#94a3b8" },  // Eisensplitter — jedes Online-Match
  silver: { c: "#e2e8f0" },  // Silbererz — Online-Siege + Tagesaufgaben
  dragon: { c: "#fb7185" },  // Drachenstahl — Siegesserien (3er-Schritte) + Tag-7-Kiste
  star:   { c: "#c4b5fd" }   // Sternenstaub — Achievement-Freischaltungen
};
export function matOf(p) {
  const m = (p && p.materials) || {};
  return { iron: m.iron || 0, silver: m.silver || 0, dragon: m.dragon || 0, star: m.star || 0 };
}
// Kanonen-Skins: Kuppel-/Kern-Farben; Spieler-Neonring bleibt (Team-Erkennung!)
export const CANNON_SKIN = {
  cannon_crystal:  { dome: ["#cffafe", "#0e7490", "#083344"], core: "#a5f3fc" },
  cannon_obsidian: { dome: ["#6d28d9", "#27216b", "#0c0a1d"], core: "#c4b5fd" },
  cannon_dragon:   { dome: ["#dc2626", "#7f1d1d", "#1c0a0a"], core: "#fca5a5" },
  cannon_star:     { dome: ["#2563eb", "#1e3a8a", "#0b1026"], core: "#fde047", stars: true }
};
// Einschlag-Effekte: p = Partikel-Palette, ring = Explosions-Gradient (r,g,b)
export const IMPACT_FX = {
  impact_lava:  { p: ["#fff7ed", "#fdba74", "#f97316", "#dc2626"], ring: ["255,237,213", "249,115,22", "220,38,38"] },
  impact_ice:   { p: ["#f0f9ff", "#bae6fd", "#38bdf8", "#0284c7"], ring: ["224,242,254", "56,189,248", "2,132,199"] },
  impact_blitz: { p: ["#fefce8", "#fde047", "#facc15", "#a16207"], ring: ["254,249,195", "250,204,21", "161,98,7"] },
  impact_void:  { p: ["#f5f3ff", "#c4b5fd", "#7c3aed", "#312e81"], ring: ["237,233,254", "124,58,237", "49,46,129"] }
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
