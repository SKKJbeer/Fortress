// Phase 3 der Modularisierung (v3.36.0) — aus index.html extrahiert.
// Render-Schicht: Sprite-Cache + alle Canvas-Zeichenfunktionen.
// PERF-REGELN (v3.15.5): Gradients/shadowBlur NUR beim einmaligen Backen
// der Sprites, NIE pro Objekt pro Frame. Im Frame-Loop wird nur geblittet.
import { CELL } from '../engine/const.js';

export function drawWall(ctx, px, py, base, hi, lo, mortar) {
  const m = 0.6;
  const x = px + m, y = py + m, w = CELL - 2 * m, hgt = CELL - 2 * m;
  // glasiger Körper: hell oben → Basis → dunkel unten
  const g = ctx.createLinearGradient(px, py, px, py + CELL);
  g.addColorStop(0, hi);
  g.addColorStop(0.22, base);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, hgt, 3.5);
  ctx.fill();
  // Neon-Oberkante (durchgehende Leuchtlinie über Mauerreihen)
  ctx.fillStyle = hi;
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, 2.2, 1.4);
  ctx.fill();
  // Glanz-Highlight
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundRectPath(ctx, x + 1.4, y + 1.4, w - 2.8, 1.5, 1);
  ctx.fill();
  // dunkle Fase unten/rechts (Tiefe)
  ctx.strokeStyle = "rgba(0,0,0,0.38)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w - 0.5, y + 2);
  ctx.lineTo(x + w - 0.5, y + hgt - 0.5);
  ctx.lineTo(x + 2, y + hgt - 0.5);
  ctx.stroke();
  // feiner heller Innenrahmen
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 0.8;
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, hgt - 1, 3);
  ctx.stroke();
}
function __oldWall(ctx, px, py, base, hi, lo, mortar) {
  ctx.fillStyle = base;
  ctx.fillRect(px, py, CELL, CELL);
  ctx.fillStyle = mortar;
  ctx.fillRect(px, py + CELL / 2 - 1, CELL, 1.5);
  ctx.fillRect(px + CELL / 2 - 1, py, 1.5, CELL / 2);
  ctx.fillRect(px + CELL / 4 - 1, py + CELL / 2, 1.5, CELL / 2);
  ctx.fillRect(px + CELL * 0.75 - 1, py + CELL / 2, 1.5, CELL / 2);
  ctx.fillStyle = hi;
  ctx.fillRect(px, py, CELL, 1.5);
  ctx.fillRect(px, py, 1.5, CELL);
  ctx.fillStyle = lo;
  ctx.fillRect(px, py + CELL - 1.5, CELL, 1.5);
  ctx.fillRect(px + CELL - 1.5, py, 1.5, CELL);
}
export function drawRubble(ctx, px, py) {
  const g = ctx.createLinearGradient(px, py, px, py + CELL);
  g.addColorStop(0, "#2a3344");
  g.addColorStop(1, "#141a26");
  ctx.fillStyle = g;
  roundRectPath(ctx, px + 0.6, py + 0.6, CELL - 1.2, CELL - 1.2, 2.5);
  ctx.fill();
  // gebrochene Splitter
  ctx.fillStyle = "rgba(120,135,160,0.55)";
  ctx.beginPath();
  ctx.moveTo(px + 3, py + CELL - 3);
  ctx.lineTo(px + 6, py + 5);
  ctx.lineTo(px + 9, py + CELL - 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(90,105,130,0.5)";
  ctx.beginPath();
  ctx.moveTo(px + CELL - 3, py + CELL - 3);
  ctx.lineTo(px + CELL - 7, py + 7);
  ctx.lineTo(px + CELL - 10, py + CELL - 4);
  ctx.closePath();
  ctx.fill();
  // glimmende Glut
  ctx.fillStyle = "rgba(251,146,60,0.55)";
  ctx.beginPath();
  ctx.arc(px + CELL * 0.5, py + CELL * 0.62, 1.5, 0, Math.PI * 2);
  ctx.fill();
}
export const ROOF_OF = { 1: "#2563eb", 2: "#dc2626", 3: "#059669" };
export const FLAG_OF = { 1: "\u2654", 2: "\u265A", 3: "\u265C" };
export const ACCENT_OF = { 1: "#fbbf24", 2: "#a78bfa", 3: "#34d399" };
export const ACCENT_RGB = { 1: "rgba(251,191,36,", 2: "rgba(167,139,250,", 3: "rgba(52,211,153," };
export const GHOST_RGB = { 1: "rgba(96,165,250,", 2: "rgba(248,113,113,", 3: "rgba(52,211,153," };
export const GHOST_HEX = { 1: "#60a5fa", 2: "#f87171", 3: "#34d399" };
export const BALL_MID = { 1: "#60a5fa", 2: "#f87171", 3: "#34d399" };
export const BALL_DARK = { 1: "#1e40af", 2: "#7f1d1d", 3: "#065f46" };
export const BALL_GLOW = { 1: "rgba(59,130,246,0.9)", 2: "rgba(239,68,68,0.9)", 3: "rgba(16,185,129,0.9)" };
// Ball-Sprites (v3.15.5): Glow + Verlauf einmal backen; im Flug nur noch
// skaliert blitten. Basisradius 8, Sprite-Halbgröße 24 (Platz für den Glow).
const BALL_SPRITES = {};
export function ballSprite(player) {
  if (!BALL_SPRITES[player]) {
    const HS = 24, BR = 8;
    const c = document.createElement("canvas");
    c.width = HS * 2;
    c.height = HS * 2;
    const x = c.getContext("2d");
    x.shadowColor = BALL_GLOW[player] || BALL_GLOW[1];
    x.shadowBlur = 12;
    const g = x.createRadialGradient(HS - 3, HS - 3, 0, HS, HS, BR);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.4, BALL_MID[player] || BALL_MID[1]);
    g.addColorStop(1, BALL_DARK[player] || BALL_DARK[1]);
    x.fillStyle = g;
    x.beginPath();
    x.arc(HS, HS, BR, 0, Math.PI * 2);
    x.fill();
    BALL_SPRITES[player] = c;
  }
  return BALL_SPRITES[player];
}
export function drawCastle(ctx, cx, cy, player, open, now) {
  const S = CELL * 1.5;
  const roof = ROOF_OF[player] || "#2563eb";
  const lt = { 1: "#93c5fd", 2: "#fca5a5", 3: "#6ee7b7" }[player] || "#93c5fd";
  const glow = { 1: "rgba(59,130,246,", 2: "rgba(239,68,68,", 3: "rgba(16,185,129," }[player] || "rgba(59,130,246,";
  // Schatten
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  roundRectPath(ctx, cx - S + 3, cy - S + 5, S * 2, S * 2, 4);
  ctx.fill();
  // Keep-K\u00F6rper (dunkler Metall-Stein)
  const bg = ctx.createLinearGradient(cx, cy - S, cx, cy + S);
  bg.addColorStop(0, "#3b4556");
  bg.addColorStop(0.5, "#252d3a");
  bg.addColorStop(1, "#141a25");
  ctx.fillStyle = bg;
  roundRectPath(ctx, cx - S, cy - S, S * 2, S * 2, 4);
  ctx.fill();
  // Zinnen mit Neon-Oberkante
  for (let i = 0; i < 5; i++) {
    const mx = cx - S + i * (S * 2 / 5);
    ctx.fillStyle = "#2a323f";
    ctx.fillRect(mx + 1, cy - S - 5, S * 2 / 5 - 3, 6);
    ctx.fillStyle = roof;
    ctx.fillRect(mx + 1, cy - S - 5, S * 2 / 5 - 3, 1.6);
  }
  // Seitent\u00FCrme + Neon-D\u00E4cher
  for (const sx of [-1, 1]) {
    const tx = cx + sx * S - (sx < 0 ? 0 : 6);
    const tg = ctx.createLinearGradient(tx, cy - S, tx, cy + S);
    tg.addColorStop(0, "#454f61");
    tg.addColorStop(1, "#161d29");
    ctx.fillStyle = tg;
    ctx.fillRect(tx, cy - S - 2, 6, S * 2 + 2);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(cx + sx * S - (sx < 0 ? -3 : 3), cy - S - 11);
    ctx.lineTo(cx + sx * S - (sx < 0 ? 0 : 6), cy - S - 2);
    ctx.lineTo(cx + sx * S - (sx < 0 ? -6 : 0), cy - S - 2);
    ctx.closePath();
    ctx.fill();
  }
  // Tor mit Neon-Bogen
  ctx.fillStyle = "#0c1118";
  roundRectPath(ctx, cx - 5, cy + 1, 10, S - 1, 3);
  ctx.fill();
  ctx.strokeStyle = glow + "0.6)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // (Fahnenmast + Wimpel entfernt, v3.15.4 — verdeckten die Mauern darüber)
  // leuchtender Wappen-Kern — Glow als Radial-Verlauf statt shadowBlur (v3.15.5)
  const crestGlow = ctx.createRadialGradient(cx, cy - S * 0.35, CELL * 0.15, cx, cy - S * 0.35, CELL * 0.82);
  crestGlow.addColorStop(0, glow + "0.26)");
  crestGlow.addColorStop(1, glow + "0)");
  ctx.fillStyle = crestGlow;
  ctx.beginPath();
  ctx.arc(cx, cy - S * 0.35, CELL * 0.82, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lt;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(cx, cy - S * 0.35, CELL * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `${CELL * 0.7}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(FLAG_OF[player] || "\u2654", cx, cy - S * 0.35);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (open) {
    const a = 0.4 + 0.3 * Math.sin(now / 180);
    ctx.strokeStyle = `rgba(239,68,68,${a})`;
    ctx.lineWidth = 3;
    roundRectPath(ctx, cx - S - 2, cy - S - 2, S * 2 + 4, S * 2 + 4, 5);
    ctx.stroke();
    ctx.fillStyle = `rgba(239,68,68,${a})`;
    ctx.font = `bold ${CELL}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("\u26A0", cx, cy + S + CELL * 0.8);
    ctx.textAlign = "left";
  }
}
export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// \u2500\u2500 Sprite-Cache (v3.15.5) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Performance: Gradients + shadowBlur sind im Frame-Loop die teuersten
// Canvas-Operationen (skalieren mit Mauer-/Kanonenzahl \u2192 Ruckler auf Mobile
// ab ~15 Kanonen). Alles Statische wird EINMAL in Offscreen-Canvases
// vorgerendert; pro Frame bleibt nur drawImage (Blit, um Gr\u00f6\u00dfenordnungen
// billiger). NIEMALS wieder Gradients/shadowBlur pro Objekt pro Frame!
export const SPR = { wall: {}, rubble: null, dome: {}, barrel: {} };
export function mkSpriteCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
}
const WALL_SPRITE_COLORS = {
  [1]: ["#3b82f6", "#93c5fd", "#1e40af", "#172a63"],
  [2]: ["#ef4444", "#fca5a5", "#991b1b", "#5e1414"],
  [10]: ["#10b981", "#6ee7b7", "#065f46", "#044a37"]
};
export function wallSprite(v) {
  if (!SPR.wall[v]) {
    const c = mkSpriteCanvas(CELL, CELL);
    const col = WALL_SPRITE_COLORS[v] || WALL_SPRITE_COLORS[1];
    drawWall(c.getContext("2d"), 0, 0, col[0], col[1], col[2], col[3]);
    SPR.wall[v] = c;
  }
  return SPR.wall[v];
}
export function crackSprite() {
  if (!SPR.crack) {
    const c = mkSpriteCanvas(CELL, CELL);
    const x = c.getContext("2d");
    x.strokeStyle = "rgba(10,12,18,0.75)";
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(CELL * 0.5, CELL * 0.1);
    x.lineTo(CELL * 0.42, CELL * 0.45);
    x.lineTo(CELL * 0.62, CELL * 0.6);
    x.lineTo(CELL * 0.5, CELL * 0.92);
    x.moveTo(CELL * 0.42, CELL * 0.45);
    x.lineTo(CELL * 0.18, CELL * 0.62);
    x.moveTo(CELL * 0.62, CELL * 0.6);
    x.lineTo(CELL * 0.85, CELL * 0.72);
    x.stroke();
  SPR.crack = c;
  }
  return SPR.crack;
}
export function rubbleSprite() {
  if (!SPR.rubble) {
    const c = mkSpriteCanvas(CELL, CELL);
    drawRubble(c.getContext("2d"), 0, 0);
    SPR.rubble = c;
  }
  return SPR.rubble;
}
export const CANNON_NEON = {
  1: { ac: "#3b82f6", lt: "#93c5fd", glow: "rgba(59,130,246," },
  2: { ac: "#ef4444", lt: "#fca5a5", glow: "rgba(239,68,68," },
  3: { ac: "#10b981", lt: "#6ee7b7", glow: "rgba(16,185,129," }
};
// Kuppel (statisch pro Spieler + optionalem Schmiede-Skin): Radial-Gradient,
// Ring, Bolzen, Glanz, Kern. skinDef = CANNON_SKIN-Eintrag oder null (Standard).
// WICHTIG: Der Neonring behält IMMER die Spielerfarbe (Team-Erkennung).
export function cannonDomeSprite(player, skinId, skinDef) {
  const key = player + (skinId ? "|" + skinId : "");
  if (!SPR.dome[key]) {
    const R = CELL * 1.6;
    const D = Math.ceil(R * 1.6 + 6);
    const c = mkSpriteCanvas(D, D);
    const x = c.getContext("2d");
    const n = CANNON_NEON[player] || CANNON_NEON[1];
    const cx = D / 2, cy = D / 2;
    const domeCols = skinDef ? skinDef.dome : ["#5a6477", "#2c333f", "#10141d"];
    const grad = x.createRadialGradient(cx - R * 0.35, cy - R * 0.4, 1, cx, cy, R * 0.85);
    grad.addColorStop(0, domeCols[0]);
    grad.addColorStop(0.5, domeCols[1]);
    grad.addColorStop(1, domeCols[2]);
    x.fillStyle = grad;
    x.beginPath();
    x.arc(cx, cy, R * 0.8, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = n.ac;
    x.lineWidth = 2.2;
    x.beginPath();
    x.arc(cx, cy, R * 0.8, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = "rgba(0,0,0,0.45)";
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      x.beginPath();
      x.arc(cx + Math.cos(a) * R * 0.58, cy + Math.sin(a) * R * 0.58, 1.5, 0, Math.PI * 2);
      x.fill();
    }
    // Sternen-Skin: kleine helle Punkte auf der Kuppel (einmal beim Backen)
    if (skinDef && skinDef.stars) {
      x.fillStyle = "rgba(255,255,255,0.85)";
      const starPos = [[-0.42, 0.1], [0.3, -0.38], [0.12, 0.42], [-0.15, -0.2], [0.45, 0.22]];
      for (const [sx, sy] of starPos) {
        x.beginPath();
        x.arc(cx + sx * R, cy + sy * R, 1.2, 0, Math.PI * 2);
        x.fill();
      }
    }
    x.fillStyle = "rgba(255,255,255,0.28)";
    x.beginPath();
    x.arc(cx - R * 0.28, cy - R * 0.3, R * 0.22, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = skinDef ? skinDef.core : n.lt;
    x.beginPath();
    x.arc(cx, cy, R * 0.16, 0, Math.PI * 2);
    x.fill();
    SPR.dome[key] = c;
  }
  return SPR.dome[key];
}
// Rohr (statisch pro Spieler), M\u00fcndungsgl\u00fchen EINMAL beim Backen (shadowBlur
// nur hier, nie im Frame-Loop). Gezeichnet horizontal, ab x=PAD.
export const BARREL_PAD = 10;
export function cannonBarrelSprite(player, skinId, skinDef) {
  const key = player + (skinId ? "|" + skinId : "");
  if (!SPR.barrel[key]) {
    const barrelLen = CELL * 2.7, barrelW = 9;
    const W2 = Math.ceil(CELL * 0.2 + barrelLen + BARREL_PAD * 2);
    const H2 = Math.ceil(barrelW + 3 + BARREL_PAD * 2);
    const c = mkSpriteCanvas(W2, H2);
    const x = c.getContext("2d");
    const n = CANNON_NEON[player] || CANNON_NEON[1];
    const ox = BARREL_PAD + CELL * 0.2, oy = H2 / 2;
    const bG = x.createLinearGradient(0, oy - barrelW / 2, 0, oy + barrelW / 2);
    if (skinDef) {
      bG.addColorStop(0, skinDef.dome[0]);
      bG.addColorStop(0.45, skinDef.dome[1]);
      bG.addColorStop(1, skinDef.dome[2]);
    } else {
      bG.addColorStop(0, "#8b95a7");
      bG.addColorStop(0.45, "#3a4252");
      bG.addColorStop(1, "#141925");
    }
    x.fillStyle = bG;
    roundRectPath(x, ox - CELL * 0.2, oy - barrelW / 2, barrelLen, barrelW, 4);
    x.fill();
    x.fillStyle = n.ac;
    x.fillRect(ox + CELL * 0.2, oy - 1, barrelLen - CELL * 0.55, 1.3);
    x.shadowColor = n.ac;
    x.shadowBlur = 9;
    x.fillStyle = skinDef ? skinDef.core : n.lt;
    roundRectPath(x, ox + barrelLen - CELL * 0.4, oy - barrelW / 2 - 1.5, 4.5, barrelW + 3, 2);
    x.fill();
    x.shadowBlur = 0;
    SPR.barrel[key] = c;
  }
  return SPR.barrel[key];
}
export function drawCannonFull(ctx, cx, cy, angle, player, reloadFrac, nowT, skinId, skinDef) {
  const R = CELL * 1.6;
  const n = CANNON_NEON[player] || CANNON_NEON[1];
  const now = nowT != null ? nowT : Date.now();
  // Bodenschatten (eine Ellipse, billig)
  ctx.fillStyle = "rgba(0,0,0,0.40)";
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 5, R * 0.95, R * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rohr: vorgerendertes Sprite, nur rotiert geblittet
  const bar = cannonBarrelSprite(player, skinId, skinDef);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(bar, -BARREL_PAD - CELL * 0.2, -bar.height / 2);
  ctx.restore();
  // Kuppel: vorgerendertes Sprite
  const dome = cannonDomeSprite(player, skinId, skinDef);
  ctx.drawImage(dome, cx - dome.width / 2, cy - dome.height / 2);
  // \u2014 Reload-/Ready-Ring (dynamisch, aber OHNE shadowBlur) \u2014
  if (reloadFrac < 1) {
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = n.lt;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * reloadFrac);
    ctx.stroke();
  } else {
    // Puls \u00fcber Alpha + Linienbreite statt animiertem shadowBlur (Mobile-Killer)
    const pulse = 0.55 + 0.35 * Math.sin(now / 250);
    ctx.strokeStyle = n.glow + pulse.toFixed(2) + ")";
    ctx.lineWidth = 2.5 + Math.sin(now / 250) * 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}
