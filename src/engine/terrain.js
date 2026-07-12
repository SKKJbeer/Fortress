// Auto-extrahiert aus index.html (Phase 1 der Modularisierung, v3.34.0).
// Reine Logik/Daten — kein DOM, kein React, kein Firebase. Unit-testbar via node --test.
import { ROWS, COLS } from './const.js';

const __spreadValues = (a, b) => Object.assign(a, b);
const __spreadProps = (a, b) => Object.assign(a, b);

export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 1831565813;
    let t = s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967295;
  };
}
export function castle3Positions() {
  const hubR = Math.floor(ROWS * 0.4);
  const hubC = Math.floor(COLS * 0.5);
  const mk = (deg, dr, dc) => {
    const rad = deg * Math.PI / 180;
    return {
      r: Math.max(4, Math.min(ROWS - 5, Math.round(hubR - Math.cos(rad) * dr))),
      c: Math.max(7, Math.min(COLS - 8, Math.round(hubC + Math.sin(rad) * dc)))
    };
  };
  return {
    1: mk(0, ROWS * 0.3, 0),
    // oben mittig
    2: mk(125, ROWS * 0.34, COLS * 0.32),
    // unten-rechts
    3: mk(235, ROWS * 0.34, COLS * 0.32)
    // unten-links
  };
}
// ── Welt-Themes (v3.15.0) ───────────────────────────────────────────────
// Pro Spiel wird deterministisch aus dem Terrain-Seed ein Thema gewählt:
// WORLD_THEMES[seed % length]. Host und Gäste teilen den Seed über den State
// → alle Clients rendern automatisch dieselbe Welt, ohne Protokoll-Änderung.
// Farb-Slots: bg (3 Verlaufsstufen), glow (Lichtfeld oben), tex1/tex2
// (Bodentextur), dots (Punktraster), water (Flussverlauf), waterGlow,
// waterEdge (Uferkante), waterAnim (Schimmer-Animation), mtn (Bergverlauf),
// mtnEdge, mtnCap (Gipfel), particles (3 Ambient-Farben).
export const WORLD_THEMES = [
  { name: "Kristalltal", bank: "#1b3a52", propType: "crystal", props: ["#7dd3fc", "#2a6f97", "#e0f2fe"],
    bg: ["#0e2336", "#0a1827", "#060e1a"], glow: "rgba(56,189,248,0.10)",
    tex1: "rgba(45,130,120,0.10)", tex2: "rgba(10,42,58,0.32)", dots: "rgba(125,180,210,0.05)",
    water: ["#155e8a", "#0a3a5e"], waterGlow: "rgba(34,211,238,0.7)", waterEdge: "rgba(103,232,249,0.5)", waterAnim: "160,210,255",
    mtn: ["#3a4a63", "#151e2f"], mtnEdge: "rgba(125,211,252,0.5)", mtnCap: "rgba(224,242,254,0.92)",
    particles: ["rgba(125,211,252,0.5)", "rgba(167,139,250,0.45)", "rgba(226,232,240,0.4)"] },
  { name: "Frostreich", bank: "#2c4a6e", propType: "tree", props: ["#b8c9dd", "#5c7899", "#ffffff"],
    bg: ["#182a44", "#111e34", "#0a1322"], glow: "rgba(191,219,254,0.13)",
    tex1: "rgba(226,232,240,0.11)", tex2: "rgba(30,58,92,0.30)", dots: "rgba(226,232,240,0.06)",
    water: ["#3b6fa0", "#1e3a5f"], waterGlow: "rgba(147,197,253,0.7)", waterEdge: "rgba(219,234,254,0.65)", waterAnim: "219,234,254",
    mtn: ["#64748b", "#1e293b"], mtnEdge: "rgba(226,232,240,0.6)", mtnCap: "rgba(255,255,255,0.95)",
    particles: ["rgba(255,255,255,0.6)", "rgba(203,213,225,0.5)", "rgba(147,197,253,0.45)"] },
  { name: "Glutwüste", bank: "#7a5a30", propType: "cactus", props: ["#65803a", "#41541f", "#fde68a"],
    bg: ["#3a2410", "#2a1a0c", "#160d05"], glow: "rgba(251,191,36,0.11)",
    tex1: "rgba(217,164,65,0.11)", tex2: "rgba(87,52,20,0.30)", dots: "rgba(251,211,141,0.05)",
    water: ["#0e7490", "#155e75"], waterGlow: "rgba(45,212,191,0.6)", waterEdge: "rgba(153,246,228,0.55)", waterAnim: "153,246,228",
    mtn: ["#92603a", "#3b2312"], mtnEdge: "rgba(253,230,138,0.45)", mtnCap: "rgba(254,243,199,0.9)",
    particles: ["rgba(253,230,138,0.5)", "rgba(251,191,36,0.4)", "rgba(254,215,170,0.45)"] },
  { name: "Vulkanschlund", bank: "#511f14", propType: "crystal", props: ["#6b5d55", "#2e2320", "#fb923c"],
    bg: ["#2a130e", "#1c0d09", "#0d0504"], glow: "rgba(239,68,68,0.13)",
    tex1: "rgba(130,62,42,0.13)", tex2: "rgba(45,20,15,0.35)", dots: "rgba(248,113,113,0.05)",
    water: ["#ea580c", "#9a3412"], waterGlow: "rgba(251,146,60,0.9)", waterEdge: "rgba(254,215,170,0.7)", waterAnim: "254,215,170",
    mtn: ["#44403c", "#150f0d"], mtnEdge: "rgba(251,146,60,0.5)", mtnCap: "rgba(254,202,120,0.9)",
    particles: ["rgba(251,146,60,0.6)", "rgba(239,68,68,0.5)", "rgba(254,215,170,0.45)"] },
  { name: "Nebelmoor", bank: "#2e4522", propType: "tree", props: ["#6f9440", "#3c5423", "#d9f99d"],
    bg: ["#1a2a1e", "#121e16", "#090f0b"], glow: "rgba(134,239,172,0.09)",
    tex1: "rgba(74,124,89,0.13)", tex2: "rgba(20,40,30,0.35)", dots: "rgba(163,230,53,0.05)",
    water: ["#4d7c0f", "#1a2e05"], waterGlow: "rgba(163,230,53,0.55)", waterEdge: "rgba(190,242,100,0.5)", waterAnim: "190,242,100",
    mtn: ["#4d5a4a", "#181f18"], mtnEdge: "rgba(163,230,53,0.35)", mtnCap: "rgba(217,249,157,0.8)",
    particles: ["rgba(190,242,100,0.6)", "rgba(253,224,71,0.5)", "rgba(134,239,172,0.45)"] },
  { name: "Herbstwald", bank: "#4a2f18", propType: "tree", props: ["#d97b2e", "#8a4114", "#fde047"],
    bg: ["#2c1c10", "#20140b", "#110a05"], glow: "rgba(251,146,60,0.11)",
    tex1: "rgba(180,90,40,0.12)", tex2: "rgba(60,30,15,0.32)", dots: "rgba(253,186,116,0.05)",
    water: ["#155e8a", "#0a3a5e"], waterGlow: "rgba(56,189,248,0.55)", waterEdge: "rgba(125,211,252,0.5)", waterAnim: "125,211,252",
    mtn: ["#7c5836", "#2a1c10"], mtnEdge: "rgba(253,186,116,0.45)", mtnCap: "rgba(254,235,200,0.85)",
    particles: ["rgba(251,146,60,0.55)", "rgba(239,68,68,0.45)", "rgba(253,224,71,0.5)"] },
  { name: "Astralebene", bank: "#3b2360", propType: "crystal", props: ["#c084fc", "#6b21a8", "#f0abfc"],
    bg: ["#231539", "#180e2a", "#0b0616"], glow: "rgba(167,139,250,0.13)",
    tex1: "rgba(124,58,237,0.11)", tex2: "rgba(30,15,55,0.35)", dots: "rgba(196,181,253,0.06)",
    water: ["#7e22ce", "#4a1272"], waterGlow: "rgba(217,70,239,0.7)", waterEdge: "rgba(240,171,252,0.55)", waterAnim: "240,171,252",
    mtn: ["#4c3a6b", "#1a1030"], mtnEdge: "rgba(196,181,253,0.5)", mtnCap: "rgba(233,213,255,0.92)",
    particles: ["rgba(240,171,252,0.5)", "rgba(129,140,248,0.5)", "rgba(255,255,255,0.45)"] }
];
export function worldThemeOf(seed) {
  return WORLD_THEMES[(seed >>> 0) % WORLD_THEMES.length];
}
export function generateTerrainFromSeed(seed) {
  const rng = makeRng(seed);
  const t = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const n = Math.sin(r * 0.35 + c * 0.22 + seed * 1e-3) + Math.sin(c * 0.5 - r * 0.15) * 0.7;
      t[r][c] = n > 0.8 ? 0 : n > -0.5 ? 1 : 2;
    }
  const midR = Math.floor(ROWS / 2);
  let rrow = midR;
  for (let c = 0; c < COLS; c++) {
    rrow += (rng() - 0.5) * 1.4;
    rrow = Math.max(midR - 2, Math.min(midR + 2, rrow));
    const center = Math.round(rrow);
    for (let dr = -1; dr <= 1; dr++) {
      const r = center + dr;
      if (r >= 0 && r < ROWS) t[r][c] = 3;
    }
  }
  const borderRow = new Array(COLS);
  for (let c = 0; c < COLS; c++) {
    let topR = 0;
    for (let r = 0; r < ROWS; r++) if (t[r][c] === 3) topR = r;
    borderRow[c] = topR;
  }
  const mtnClusters = 3 + Math.floor(rng() * 3);
  for (let m = 0; m < mtnClusters; m++) {
    const cr = Math.floor(rng() * ROWS);
    const cc = Math.floor(rng() * COLS);
    const size = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < size; i++) {
      const r = cr + Math.floor((rng() - 0.5) * 4);
      const c = cc + Math.floor((rng() - 0.5) * 4);
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && t[r][c] !== 3) t[r][c] = 4;
    }
  }
  return { grid: t, borderRow };
}
export function generateTerrain() {
  const seed = Math.floor(Math.random() * 4294967295);
  return __spreadProps(__spreadValues({}, generateTerrainFromSeed(seed)), { seed });
}
const HUB_R = Math.floor(ROWS * 0.4);
const HUB_C = Math.floor(COLS * 0.5);
function angleFromHub(r, c) {
  const dx = c - HUB_C;
  const dy = r - HUB_R;
  let a = Math.atan2(dx, -dy);
  if (a < 0) a += Math.PI * 2;
  return a;
}
export function sectorOf(r, c) {
  const a = angleFromHub(r, c) * 180 / Math.PI;
  if (a >= 290 || a < 70) return 1;
  if (a >= 70 && a < 180) return 2;
  return 3;
}
export function generateTerrain3FromSeed(seed) {
  const rng = makeRng(seed);
  const t = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const n = Math.sin(r * 0.35 + c * 0.22 + seed * 1e-3) + Math.sin(c * 0.5 - r * 0.15) * 0.7;
      t[r][c] = n > 0.8 ? 0 : n > -0.5 ? 1 : 2;
    }
  const armAngles = [70, 180, 290];
  for (const baseDeg of armAngles) {
    let wobble = 0;
    const maxLen = Math.max(ROWS, COLS) * 2;
    for (let step = 0; step < maxLen; step++) {
      wobble += (rng() - 0.5) * 4;
      wobble = Math.max(-10, Math.min(10, wobble));
      const deg = baseDeg + wobble;
      const rad = deg * Math.PI / 180;
      const dist = step * 0.5;
      const rr = Math.round(HUB_R - Math.cos(rad) * dist);
      const cc = Math.round(HUB_C + Math.sin(rad) * dist);
      if (rr < -2 || rr >= ROWS + 2 || cc < -2 || cc >= COLS + 2) break;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r = rr + dr, c = cc + dc;
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) t[r][c] = 3;
        }
    }
  }
  for (let dr = -2; dr <= 2; dr++)
    for (let dc = -2; dc <= 2; dc++) {
      const r = HUB_R + dr, c = HUB_C + dc;
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && dr * dr + dc * dc <= 5) t[r][c] = 3;
    }
  const mtnClusters = 3 + Math.floor(rng() * 3);
  for (let m = 0; m < mtnClusters; m++) {
    const cr = Math.floor(rng() * ROWS);
    const cc = Math.floor(rng() * COLS);
    const size = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < size; i++) {
      const r = cr + Math.floor((rng() - 0.5) * 4);
      const c = cc + Math.floor((rng() - 0.5) * 4);
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && t[r][c] !== 3) t[r][c] = 4;
    }
  }
  return { grid: t, mode3: true };
}
export function buildSectorMap(terObj, castlePos) {
  const t = terObj.grid;
  const map = new Int8Array(ROWS * COLS).fill(0);
  for (const p of [1, 2, 3]) {
    const cp = castlePos[p];
    if (!cp) continue;
    const stack = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const r = cp.r + dr, c = cp.c + dc;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) stack.push(r * COLS + c);
      }
    while (stack.length) {
      const idx = stack.pop();
      if (map[idx]) continue;
      const r = Math.floor(idx / COLS), c = idx % COLS;
      if (t[r][c] === 3) continue;
      map[idx] = p;
      if (r > 0) stack.push(idx - COLS);
      if (r < ROWS - 1) stack.push(idx + COLS);
      if (c > 0) stack.push(idx - 1);
      if (c < COLS - 1) stack.push(idx + 1);
    }
  }
  return map;
}
export function isBuildable(terrainObj, r, c, player) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
  const t = terrainObj.grid;
  if (t[r][c] === 3) return false;
  if (terrainObj.mode3) {
    if (terrainObj.sectorMap) return terrainObj.sectorMap[r * COLS + c] === player;
    return sectorOf(r, c) === player;
  }
  if (player === 1 && r >= terrainObj.borderRow[c]) return false;
  if (player === 2 && r <= terrainObj.borderRow[c]) return false;
  return true;
}
