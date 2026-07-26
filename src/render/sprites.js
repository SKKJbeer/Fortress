// Phase 3 der Modularisierung (v3.36.0) — aus index.html extrahiert.
// Render-Schicht: Sprite-Cache + alle Canvas-Zeichenfunktionen.
// PERF-REGELN (v3.15.5): Gradients/shadowBlur NUR beim einmaligen Backen
// der Sprites, NIE pro Objekt pro Frame. Im Frame-Loop wird nur geblittet.
import { CELL } from '../engine/const.js';

// Mauerblock mit Volumen (v3.41.0, AAA-Stufe 1: Licht & Tiefe).
// Licht kommt global von OBEN LINKS (siehe SHADOW_DX/DY in index.html).
// Wird einmal in ein Sprite gebacken (wallSprite) → im Frame-Loop nur geblittet,
// die PERF-Regel „keine Gradients pro Objekt pro Frame" bleibt eingehalten.
export function drawWall(ctx, px, py, base, hi, lo, mortar) {
  const m = 0.6;
  const x = px + m, y = py + m, w = CELL - 2 * m, hgt = CELL - 2 * m;
  // 1) Körper — Verlauf jetzt DIAGONAL entlang der Lichtachse statt rein vertikal
  const g = ctx.createLinearGradient(px, py, px + CELL * 0.75, py + CELL);
  g.addColorStop(0, hi);
  g.addColorStop(0.26, base);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, hgt, 3.5);
  ctx.fill();
  // 2) Steinkorn — feine deterministische Sprenkel, brechen den Plastik-Look
  ctx.save();
  roundRectPath(ctx, x, y, w, hgt, 3.5);
  ctx.clip();
  for (let i = 0; i < 7; i++) {
    // deterministisch aus i: identisch bei jedem Backen, kein Math.random
    const h1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const h2 = Math.abs(Math.sin(i * 78.233 + 1.7) * 43758.5453) % 1;
    ctx.fillStyle = h1 > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.16)";
    ctx.beginPath();
    ctx.arc(x + h1 * w, y + h2 * hgt, 0.5 + h2 * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // 3) Ambient Occlusion — Abdunklung zur lichtabgewandten Seite (unten/rechts)
  const ao = ctx.createLinearGradient(x + w * 0.35, y + hgt * 0.35, x + w, y + hgt);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(0,0,0,0.40)");
  ctx.fillStyle = ao;
  ctx.fillRect(x, y, w, hgt);
  // 4) Specular — weiches Glanzlicht an der lichtzugewandten Ecke
  const sp = ctx.createRadialGradient(x + w * 0.28, y + hgt * 0.24, 0, x + w * 0.28, y + hgt * 0.24, w * 0.62);
  sp.addColorStop(0, "rgba(255,255,255,0.26)");
  sp.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sp;
  ctx.fillRect(x, y, w, hgt);
  ctx.restore();
  // 5) Leuchtende Oberkante (durchgehende Linie über Mauerreihen — bleibt)
  ctx.fillStyle = hi;
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, 2.0, 1.3);
  ctx.fill();
  // 6) Harte Steinfase: helle Kante oben/links …
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + hgt - 2.5);
  ctx.lineTo(x + 1, y + 2.5);
  ctx.lineTo(x + 2.5, y + 1);
  ctx.lineTo(x + w - 2.5, y + 1);
  ctx.stroke();
  // … dunkle Kante unten/rechts (Tiefe)
  ctx.strokeStyle = "rgba(0,0,0,0.52)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + w - 0.8, y + 2.5);
  ctx.lineTo(x + w - 0.8, y + hgt - 2.5);
  ctx.lineTo(x + w - 2.5, y + hgt - 0.8);
  ctx.lineTo(x + 2.5, y + hgt - 0.8);
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
// Burg-Sprite (v3.43.0, AAA): frueher wurde die Burg PRO FRAME mit mehreren
// Gradients gezeichnet - Detail war dadurch teuer. Jetzt EINMAL pro Spieler in
// ein Sprite gebacken, im Frame nur noch geblittet. Dadurch ist reichhaltige
// Architektur (Mauerwerk, Ecktuerme, Torbogen, Fase, AO) praktisch gratis.
// Licht global von OBEN LINKS - konsistent mit SHADOW_DX/DY und drawWall.
const CASTLE_PAD = 16;
export function castleSprite(player) {
  if (!SPR.castle) SPR.castle = {};
  if (SPR.castle[player]) return SPR.castle[player];
  const S = CELL * 1.5;
  const D = Math.ceil(S * 2 + CASTLE_PAD * 2);
  const c = mkSpriteCanvas(D, D);
  const x = c.getContext("2d");
  const cx = D / 2, cy = D / 2;
  const roof = ROOF_OF[player] || "#2563eb";
  const lt = { 1: "#93c5fd", 2: "#fca5a5", 3: "#6ee7b7" }[player] || "#93c5fd";
  const glow = { 1: "rgba(59,130,246,", 2: "rgba(239,68,68,", 3: "rgba(16,185,129," }[player] || "rgba(59,130,246,";
  const hash = (i) => Math.abs(Math.sin(i * 12.9898 + player * 7.13) * 43758.5453) % 1;
  // 1) Schlagschatten (weich, entlang der Lichtachse)
  x.save();
  x.globalAlpha = 0.55;
  x.fillStyle = "#000";
  if (typeof x.filter === "string") x.filter = "blur(4px)";
  roundRectPath(x, cx - S + 4, cy - S + 5, S * 2, S * 2, 5);
  x.fill();
  x.filter = "none";
  x.restore();
  // 2) Keep-Koerper - Verlauf diagonal entlang der Lichtachse
  const bg = x.createLinearGradient(cx - S, cy - S, cx + S * 0.7, cy + S);
  bg.addColorStop(0, "#69788f");
  bg.addColorStop(0.45, "#3c4759");
  bg.addColorStop(1, "#1b2230");
  x.fillStyle = bg;
  roundRectPath(x, cx - S, cy - S, S * 2, S * 2, 4);
  x.fill();
  // 3) Mauerwerk - versetzte Steinlagen, gibt der Flaeche Materialitaet
  x.save();
  roundRectPath(x, cx - S, cy - S, S * 2, S * 2, 4);
  x.clip();
  const courseH = S * 0.34;
  for (let row = 0; row * courseH < S * 2; row++) {
    const yy = cy - S + row * courseH;
    x.strokeStyle = "rgba(0,0,0,0.34)";
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(cx - S, yy);
    x.lineTo(cx + S, yy);
    x.stroke();
    x.strokeStyle = "rgba(255,255,255,0.07)";
    x.beginPath();
    x.moveTo(cx - S, yy + 1);
    x.lineTo(cx + S, yy + 1);
    x.stroke();
    const off = row % 2 ? courseH * 0.9 : 0;
    for (let vx = cx - S + off; vx < cx + S; vx += courseH * 1.8) {
      x.strokeStyle = "rgba(0,0,0,0.26)";
      x.beginPath();
      x.moveTo(vx, yy);
      x.lineTo(vx, yy + courseH);
      x.stroke();
    }
  }
  // 4) Ambient Occlusion zur lichtabgewandten Seite
  const ao = x.createLinearGradient(cx - S * 0.2, cy - S * 0.2, cx + S, cy + S);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(0,0,0,0.38)");
  x.fillStyle = ao;
  x.fillRect(cx - S, cy - S, S * 2, S * 2);
  x.restore();
  // 5) Zinnenkranz oben - mit Lichtkante und eigenem Schatten auf den Koerper
  const nM = 5, mW = (S * 2) / nM;
  for (let i = 0; i < nM; i++) {
    const mx = cx - S + i * mW;
    x.fillStyle = "rgba(0,0,0,0.4)";
    x.fillRect(mx + 2.4, cy - S - 4, mW - 3, 6);
    const mg = x.createLinearGradient(mx, cy - S - 6, mx, cy - S + 1);
    mg.addColorStop(0, "#5c6880");
    mg.addColorStop(1, "#232b38");
    x.fillStyle = mg;
    x.fillRect(mx + 1, cy - S - 6, mW - 3, 7);
    x.fillStyle = roof;
    x.fillRect(mx + 1, cy - S - 6, mW - 3, 1.5);
    x.fillStyle = "rgba(255,255,255,0.30)";
    x.fillRect(mx + 1, cy - S - 4.5, 1, 5);
  }
  // 6) Ecktuerme - vier runde Bastionen mit Kegeldach in Spielerfarbe
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = cx + sx * S, ty = cy + sy * S, tr = S * 0.34;
    x.fillStyle = "rgba(0,0,0,0.5)";
    x.beginPath();
    x.arc(tx + 2, ty + 2.5, tr, 0, Math.PI * 2);
    x.fill();
    const tg = x.createRadialGradient(tx - tr * 0.4, ty - tr * 0.45, 0.5, tx, ty, tr);
    tg.addColorStop(0, "#6b7890");
    tg.addColorStop(0.55, "#38414f");
    tg.addColorStop(1, "#141a24");
    x.fillStyle = tg;
    x.beginPath();
    x.arc(tx, ty, tr, 0, Math.PI * 2);
    x.fill();
    // Zinnenkranz statt Vollring: der durchgehende Farbring ließ den Turm wie
    // einen Knopf wirken. Einzelne Merlons lesen sich als Turmkrone von oben.
    for (let mi = 0; mi < 7; mi++) {
      const ma = mi / 7 * Math.PI * 2 + 0.3;
      const mrx = tx + Math.cos(ma) * tr * 0.74, mry = ty + Math.sin(ma) * tr * 0.74;
      x.fillStyle = "rgba(0,0,0,0.45)";
      x.beginPath();
      x.arc(mrx + 0.5, mry + 0.6, tr * 0.20, 0, Math.PI * 2);
      x.fill();
      // Lichtseite (oben links) heller als Schattenseite
      const litT = (Math.cos(ma) < 0.15 && Math.sin(ma) < 0.15) ? 1 : 0;
      x.fillStyle = litT ? "#7c8aa4" : "#3c4657";
      x.beginPath();
      x.arc(mrx, mry, tr * 0.19, 0, Math.PI * 2);
      x.fill();
    }
    // Dunkle Turmöffnung mit farbigem Innenlicht (Team-Erkennung bleibt)
    x.fillStyle = "#0d1119";
    x.beginPath();
    x.arc(tx, ty, tr * 0.42, 0, Math.PI * 2);
    x.fill();
    const tglow = x.createRadialGradient(tx, ty, 0.5, tx, ty, tr * 0.42);
    tglow.addColorStop(0, roof);
    tglow.addColorStop(1, glow + "0)");
    x.fillStyle = tglow;
    x.beginPath();
    x.arc(tx, ty, tr * 0.42, 0, Math.PI * 2);
    x.fill();
    // Rim-Light auf der Lichtseite des Turms
    x.strokeStyle = "rgba(255,255,255,0.34)";
    x.lineWidth = 1.3;
    x.beginPath();
    x.arc(tx, ty, tr - 0.7, Math.PI * 0.8, Math.PI * 1.7);
    x.stroke();
  }
  // 7) Innenhof - dunkle Vertiefung mit warmem Eigenlicht (bewohnt wirken)
  const yardR = S * 0.62;
  const yg = x.createRadialGradient(cx, cy - S * 0.1, 1, cx, cy - S * 0.1, yardR);
  yg.addColorStop(0, glow + "0.30)");
  yg.addColorStop(0.6, "rgba(12,17,24,0.55)");
  yg.addColorStop(1, "rgba(8,11,16,0.75)");
  x.fillStyle = yg;
  roundRectPath(x, cx - yardR, cy - S * 0.72, yardR * 2, yardR * 1.5, 5);
  x.fill();
  // 8) Torbogen unten - Tiefe durch dunklen Kern + beleuchtete Laibung
  x.fillStyle = "#080c12";
  roundRectPath(x, cx - 6, cy + S * 0.18, 12, S * 0.82, 5);
  x.fill();
  x.strokeStyle = glow + "0.65)";
  x.lineWidth = 1.3;
  x.stroke();
  x.fillStyle = "rgba(255,255,255,0.18)";
  roundRectPath(x, cx - 6, cy + S * 0.18, 3, S * 0.82, 3);
  x.fill();
  // 9) Wappen-Scheibe mit Glow
  const crestY = cy - S * 0.36;
  const crestGlow = x.createRadialGradient(cx, crestY, CELL * 0.15, cx, crestY, CELL * 0.9);
  crestGlow.addColorStop(0, glow + "0.34)");
  crestGlow.addColorStop(1, glow + "0)");
  x.fillStyle = crestGlow;
  x.beginPath();
  x.arc(cx, crestY, CELL * 0.9, 0, Math.PI * 2);
  x.fill();
  const disc = x.createRadialGradient(cx - 2, crestY - 2, 0.5, cx, crestY, CELL * 0.62);
  disc.addColorStop(0, "#39424f");
  disc.addColorStop(1, "#151b25");
  x.fillStyle = disc;
  x.beginPath();
  x.arc(cx, crestY, CELL * 0.62, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = lt;
  x.lineWidth = 1.5;
  x.beginPath();
  x.arc(cx, crestY, CELL * 0.62, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = "rgba(255,255,255,0.96)";
  x.font = `${CELL * 0.7}px serif`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(FLAG_OF[player] || "♔", cx, crestY);
  x.textAlign = "left";
  x.textBaseline = "alphabetic";
  // 10) Steinkorn + helle Fase oben/links (Licht) als Abschluss
  x.save();
  roundRectPath(x, cx - S, cy - S, S * 2, S * 2, 4);
  x.clip();
  for (let i = 0; i < 26; i++) {
    x.fillStyle = hash(i) > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.14)";
    x.beginPath();
    x.arc(cx - S + hash(i + 3) * S * 2, cy - S + hash(i + 60) * S * 2, 0.6 + hash(i + 9) * 1.3, 0, Math.PI * 2);
    x.fill();
  }
  x.restore();
  x.strokeStyle = "rgba(255,255,255,0.34)";
  x.lineWidth = 1.4;
  x.beginPath();
  x.moveTo(cx - S + 1, cy + S - 4);
  x.lineTo(cx - S + 1, cy - S + 3);
  x.lineTo(cx - S + 4, cy - S + 1);
  x.lineTo(cx + S - 4, cy - S + 1);
  x.stroke();
  SPR.castle[player] = c;
  return c;
}
export function drawCastle(ctx, cx, cy, player, open, now) {
  const S = CELL * 1.5;
  const spr = castleSprite(player);
  ctx.drawImage(spr, cx - spr.width / 2, cy - spr.height / 2);
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
    // Panzerplatten-Fugen (v3.43.0): Segmentlinien geben der Kuppel Bauform
    x.save();
    x.beginPath();
    x.arc(cx, cy, R * 0.78, 0, Math.PI * 2);
    x.clip();
    x.strokeStyle = "rgba(0,0,0,0.38)";
    x.lineWidth = 1.1;
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI;
      x.beginPath();
      x.moveTo(cx - Math.cos(a) * R, cy - Math.sin(a) * R);
      x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      x.stroke();
    }
    // Ambient Occlusion zur lichtabgewandten Seite (unten rechts)
    const dao = x.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R * 0.85);
    dao.addColorStop(0, "rgba(0,0,0,0)");
    dao.addColorStop(1, "rgba(0,0,0,0.5)");
    x.fillStyle = dao;
    x.fillRect(cx - R, cy - R, R * 2, R * 2);
    x.restore();
    // Nieten mit Eigenlicht statt flacher schwarzer Punkte
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const bx = cx + Math.cos(a) * R * 0.58, by = cy + Math.sin(a) * R * 0.58;
      x.fillStyle = "rgba(0,0,0,0.5)";
      x.beginPath();
      x.arc(bx + 0.5, by + 0.6, 1.8, 0, Math.PI * 2);
      x.fill();
      const rg = x.createRadialGradient(bx - 0.6, by - 0.7, 0.2, bx, by, 1.9);
      rg.addColorStop(0, "rgba(215,225,240,0.95)");
      rg.addColorStop(1, "rgba(90,100,118,0.9)");
      x.fillStyle = rg;
      x.beginPath();
      x.arc(bx, by, 1.6, 0, Math.PI * 2);
      x.fill();
    }
    // Rim-Light auf der Lichtseite - trennt die Kuppel vom Untergrund
    x.strokeStyle = "rgba(255,255,255,0.42)";
    x.lineWidth = 1.6;
    x.beginPath();
    x.arc(cx, cy, R * 0.78, Math.PI * 0.75, Math.PI * 1.65);
    x.stroke();
    // ── Signatur-Formen je Skin (v3.44.0) ────────────────────────────────
    // Bisher unterschieden sich die Skins NUR in der Farbe — dieselbe Kuppel
    // viermal umgefärbt erzeugt keinen Sammel-Anreiz. Jetzt bekommt jeder Stil
    // eine eigene Geometrie, die schon im Standbild erkennbar ist.
    const style = skinDef && skinDef.style;
    const fxc = (skinDef && skinDef.fx) || n.lt;
    if (style === "crystal") {
      // Facetten-Kuppel: geschliffene Flächen mit hellen Graten
      x.save();
      x.beginPath();
      x.arc(cx, cy, R * 0.78, 0, Math.PI * 2);
      x.clip();
      for (let f = 0; f < 6; f++) {
        const a0 = f / 6 * Math.PI * 2, a1 = (f + 1) / 6 * Math.PI * 2;
        x.beginPath();
        x.moveTo(cx, cy);
        x.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
        x.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
        x.closePath();
        x.fillStyle = f % 2 ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.18)";
        x.fill();
        x.strokeStyle = "rgba(255,255,255,0.30)";
        x.lineWidth = 0.9;
        x.beginPath();
        x.moveTo(cx, cy);
        x.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
        x.stroke();
      }
      x.restore();
      // Prismen-Spitze in der Mitte
      x.fillStyle = "rgba(255,255,255,0.55)";
      x.beginPath();
      x.moveTo(cx, cy - R * 0.34);
      x.lineTo(cx + R * 0.17, cy);
      x.lineTo(cx, cy + R * 0.3);
      x.lineTo(cx - R * 0.17, cy);
      x.closePath();
      x.fill();
    } else if (style === "rune") {
      // Hexer/Obsidian: eingelassener Runenkranz + Beschwörungskreis
      x.strokeStyle = fxc;
      x.lineWidth = 1.1;
      x.globalAlpha = 0.75;
      x.beginPath();
      x.arc(cx, cy, R * 0.60, 0, Math.PI * 2);
      x.stroke();
      x.globalAlpha = 1;
      for (let g = 0; g < 8; g++) {
        const a = g / 8 * Math.PI * 2 - 0.2;
        const gx = cx + Math.cos(a) * R * 0.60, gy = cy + Math.sin(a) * R * 0.60;
        x.save();
        x.translate(gx, gy);
        x.rotate(a + Math.PI / 2);
        x.strokeStyle = fxc;
        x.lineWidth = 1.3;
        x.beginPath();
        // vier abwechselnde Rune-Glyphen
        const gtype = g % 4;
        if (gtype === 0) { x.moveTo(-1.7, -2.2); x.lineTo(1.7, -2.2); x.moveTo(0, -2.2); x.lineTo(0, 2.2); }
        else if (gtype === 1) { x.moveTo(-1.7, -2.2); x.lineTo(1.7, 0); x.lineTo(-1.7, 2.2); }
        else if (gtype === 2) { x.moveTo(-1.6, 2.2); x.lineTo(0, -2.2); x.lineTo(1.6, 2.2); x.moveTo(-0.9, 0.4); x.lineTo(0.9, 0.4); }
        else { x.moveTo(-1.6, -2.2); x.lineTo(-1.6, 2.2); x.lineTo(1.6, 2.2); }
        x.stroke();
        x.restore();
      }
      // Hexer-Variante: zweiter, gegenläufiger Innenkreis + Kristallsplitter
      if (skinDef.hexer) {
        x.strokeStyle = "rgba(255,255,255,0.45)";
        x.lineWidth = 0.8;
        x.beginPath();
        x.arc(cx, cy, R * 0.38, 0, Math.PI * 2);
        x.stroke();
        for (let sp = 0; sp < 3; sp++) {
          const a = sp / 3 * Math.PI * 2 + 0.5;
          x.fillStyle = fxc;
          x.beginPath();
          x.moveTo(cx + Math.cos(a) * R * 0.30, cy + Math.sin(a) * R * 0.30);
          x.lineTo(cx + Math.cos(a + 0.35) * R * 0.5, cy + Math.sin(a + 0.35) * R * 0.5);
          x.lineTo(cx + Math.cos(a - 0.35) * R * 0.5, cy + Math.sin(a - 0.35) * R * 0.5);
          x.closePath();
          x.fill();
        }
      }
    } else if (style === "scale") {
      // Drachenschuppen: überlappende Panzerschuppen mit glühenden Fugen
      x.save();
      x.beginPath();
      x.arc(cx, cy, R * 0.78, 0, Math.PI * 2);
      x.clip();
      for (let ring = 1; ring <= 3; ring++) {
        const rr2 = R * (0.24 * ring);
        const cnt = 5 + ring * 3;
        for (let i = 0; i < cnt; i++) {
          const a = i / cnt * Math.PI * 2 + ring * 0.4;
          const sx2 = cx + Math.cos(a) * rr2, sy2 = cy + Math.sin(a) * rr2;
          x.beginPath();
          x.arc(sx2, sy2, R * 0.16, Math.PI, Math.PI * 2);
          x.fillStyle = "rgba(0,0,0,0.30)";
          x.fill();
          x.strokeStyle = "rgba(251,146,60,0.42)";
          x.lineWidth = 0.8;
          x.stroke();
        }
      }
      x.restore();
      // glühende Rissader über die Kuppel
      x.strokeStyle = fxc;
      x.lineWidth = 1.5;
      x.globalAlpha = 0.8;
      x.beginPath();
      x.moveTo(cx - R * 0.6, cy - R * 0.2);
      x.lineTo(cx - R * 0.15, cy + R * 0.1);
      x.lineTo(cx + R * 0.2, cy - R * 0.25);
      x.lineTo(cx + R * 0.62, cy + R * 0.05);
      x.stroke();
      x.globalAlpha = 1;
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
    // Obere Lichtkante entlang des Laufs (Licht von oben)
    x.fillStyle = "rgba(255,255,255,0.34)";
    roundRectPath(x, ox - CELL * 0.15, oy - barrelW / 2 + 0.8, barrelLen - CELL * 0.1, 1.5, 1);
    x.fill();
    // Verstaerkungsbaender (v3.43.0): machen aus dem Rohr ein gebautes Teil
    for (let b = 0; b < 3; b++) {
      const bxp = ox + CELL * 0.25 + b * (barrelLen * 0.27);
      x.fillStyle = "rgba(0,0,0,0.42)";
      x.fillRect(bxp, oy - barrelW / 2 - 0.6, 2.4, barrelW + 1.2);
      x.fillStyle = "rgba(190,202,220,0.5)";
      x.fillRect(bxp, oy - barrelW / 2 - 0.6, 0.9, barrelW + 1.2);
    }
    // Energie-Ader in Spielerfarbe
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
// ── Geschütz-Neubau (v3.45.0) ───────────────────────────────────────────────
// Vorher: statische Kuppel + dünner Stab = las sich als Platzhalter.
// Jetzt echtes Artillerie-Layout in Draufsicht:
//   FEST     Basisplatte (Panzerung, Bolzen) + Turmring
//   ROTIEREND Turmgehäuse + Rohr + zwei Rücklaufzylinder + Mündungsbremse
// Beides wird gebacken; im Frame nur zwei drawImage (eins davon rotiert).
// ── KANONEN-BEZWINGER (v3.61.0) ───────────────────────────────────────────
// Bewusst eine ANDERE Silhouette als der Mauerbrecher: breiterer, kantiger
// Sockel mit vier Ankerklauen statt runder Panzerplatte, und ein deutlich
// laengeres, dickeres Rohr mit mehrkammriger Muendungsbremse. Violette
// Energieadern sind seine Signaturfarbe (dieselbe wie im Shop und am Schalter).
// Er soll auf einen Blick als schwerere, spezialisierte Waffe lesbar sein.
const SLAYER_VIO = "#a78bfa", SLAYER_VIO_HELL = "#ddd6fe", SLAYER_VIO_DUNKEL = "#5b21b6";

function slayerBaseSprite(player) {
  const R = CELL * 1.6;
  const D = Math.ceil(R * 2.9);
  const c = mkSpriteCanvas(D, D);
  const x = c.getContext("2d");
  const cx = D / 2, cy = D / 2;
  // Bodenschatten — groesser als beim Mauerbrecher, das Ding ist schwerer
  x.fillStyle = "rgba(0,0,0,0.45)";
  x.beginPath(); x.ellipse(cx + 2.5, cy + 4, R * 1.18, R * 0.55, 0, 0, Math.PI * 2); x.fill();
  // VIER ANKERKLAUEN diagonal — die markanteste Formaenderung
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    x.save(); x.translate(cx, cy); x.rotate(a);
    x.fillStyle = "rgba(0,0,0,0.40)"; x.fillRect(R * 0.62 + 1.5, -R * 0.30 + 2, R * 0.62, R * 0.60);
    const g = x.createLinearGradient(R * 0.6, -R * 0.3, R * 1.25, R * 0.3);
    g.addColorStop(0, "#8b95a6"); g.addColorStop(0.55, "#4a5464"); g.addColorStop(1, "#232b36");
    x.fillStyle = g; x.fillRect(R * 0.62, -R * 0.30, R * 0.62, R * 0.60);
    // Kralle vorn
    x.fillStyle = "#1b222d";
    x.beginPath();
    x.moveTo(R * 1.24, -R * 0.30); x.lineTo(R * 1.44, 0); x.lineTo(R * 1.24, R * 0.30);
    x.closePath(); x.fill();
    x.fillStyle = "rgba(255,255,255,0.16)"; x.fillRect(R * 0.62, -R * 0.30, R * 0.62, 2);
    x.restore();
  }
  // Kantiger Sechseck-Sockel statt runder Platte
  const pr = R * 0.98;
  x.save();
  x.fillStyle = "rgba(0,0,0,0.35)";
  x.beginPath();
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3;
    const px = cx + Math.cos(a) * pr + 2, py = cy + Math.sin(a) * pr + 2.5;
    i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.closePath(); x.fill();
  const bg = x.createLinearGradient(cx - pr, cy - pr, cx + pr, cy + pr);
  bg.addColorStop(0, "#79839a"); bg.addColorStop(0.5, "#3a4351"); bg.addColorStop(1, "#161c26");
  x.fillStyle = bg;
  x.beginPath();
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3;
    const px = cx + Math.cos(a) * pr, py = cy + Math.sin(a) * pr;
    i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.closePath(); x.fill();
  x.strokeStyle = "rgba(255,255,255,0.18)"; x.lineWidth = 1.3; x.stroke();
  x.restore();
  // Violette Energieadern im Sockel
  x.strokeStyle = SLAYER_VIO; x.lineWidth = 1.5; x.globalAlpha = 0.75;
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6;
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * pr * 0.42, cy + Math.sin(a) * pr * 0.42);
    x.lineTo(cx + Math.cos(a) * pr * 0.86, cy + Math.sin(a) * pr * 0.86);
    x.stroke();
  }
  x.globalAlpha = 1;
  // Schwerer Drehkranz mit Zaehnen
  x.strokeStyle = "#0d1219"; x.lineWidth = R * 0.20;
  x.beginPath(); x.arc(cx, cy, R * 0.62, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = "#6d7789"; x.lineWidth = 1.6;
  x.beginPath(); x.arc(cx, cy, R * 0.62, 0, Math.PI * 2); x.stroke();
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    x.strokeStyle = i % 2 ? "#8b95a6" : SLAYER_VIO_DUNKEL;
    x.lineWidth = 2.2;
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55);
    x.lineTo(cx + Math.cos(a) * R * 0.70, cy + Math.sin(a) * R * 0.70);
    x.stroke();
  }
  return c;
}

function slayerTurretSprite(player) {
  const R = CELL * 1.6;
  // Deutlich laenger und dicker als der Mauerbrecher (2.9 / 8.5)
  const barrelLen = CELL * 4.1, barrelW = 11.5;
  const PAD = 14;
  const W2 = Math.ceil(R * 1.0 + barrelLen + PAD * 2);
  const H2 = Math.ceil(R * 1.8 + PAD * 2);
  const c = mkSpriteCanvas(W2, H2);
  const x = c.getContext("2d");
  const ox = PAD + R * 0.66, oy = H2 / 2;
  // Schlagschatten
  x.save(); x.translate(2.5, 3.5);
  x.fillStyle = "rgba(0,0,0,0.42)";
  x.fillRect(ox - R * 0.6, oy - R * 0.62, R * 1.25, R * 1.24);
  x.fillRect(ox + R * 0.5, oy - barrelW / 2, barrelLen, barrelW);
  x.restore();
  // Kantiges Gehaeuse
  const hg = x.createLinearGradient(ox - R * 0.6, oy - R * 0.6, ox + R * 0.6, oy + R * 0.6);
  hg.addColorStop(0, "#8d97a8"); hg.addColorStop(0.5, "#414b5a"); hg.addColorStop(1, "#191f2a");
  x.fillStyle = hg;
  x.beginPath();
  x.moveTo(ox - R * 0.60, oy - R * 0.44); x.lineTo(ox - R * 0.34, oy - R * 0.64);
  x.lineTo(ox + R * 0.52, oy - R * 0.58); x.lineTo(ox + R * 0.66, oy - R * 0.30);
  x.lineTo(ox + R * 0.66, oy + R * 0.30); x.lineTo(ox + R * 0.52, oy + R * 0.58);
  x.lineTo(ox - R * 0.34, oy + R * 0.64); x.lineTo(ox - R * 0.60, oy + R * 0.44);
  x.closePath(); x.fill();
  x.strokeStyle = "rgba(255,255,255,0.20)"; x.lineWidth = 1.2; x.stroke();
  // Violettes Kantenlicht: bindet Gehaeuse, Sockel und Rohr farblich zusammen
  x.save(); x.globalAlpha = 0.55; x.strokeStyle = SLAYER_VIO; x.lineWidth = 1.6;
  x.beginPath();
  x.moveTo(ox - R * 0.34, oy - R * 0.64); x.lineTo(ox + R * 0.52, oy - R * 0.58);
  x.stroke(); x.restore();
  // Zwei dicke Ruecklaufzylinder ueber und unter dem Rohr
  for (const sgn of [-1, 1]) {
    const zy = oy + sgn * (barrelW / 2 + 4.2);
    x.fillStyle = "rgba(0,0,0,0.35)"; x.fillRect(ox + R * 0.42 + 1.5, zy - 3 + 2, barrelLen * 0.52, 6);
    const zg = x.createLinearGradient(0, zy - 3, 0, zy + 3);
    zg.addColorStop(0, "#93a0b2"); zg.addColorStop(0.5, "#4c576a"); zg.addColorStop(1, "#232b38");
    x.fillStyle = zg; x.fillRect(ox + R * 0.42, zy - 3, barrelLen * 0.52, 6);
    // Endkappe statt aufgesetztem Farbklotz — sonst wirken die Zylinder
    // wie angeklebte Bausteine statt wie Teil der Waffe.
    x.fillStyle = "#1a212c";
    x.fillRect(ox + R * 0.42 + barrelLen * 0.52 - 3, zy - 3, 3, 6);
    x.fillStyle = "rgba(255,255,255,0.22)";
    x.fillRect(ox + R * 0.42, zy - 3, barrelLen * 0.52, 1.2);
  }
  // HAUPTROHR: lang, leicht konisch, mit violetter Energieader
  const bx0 = ox + R * 0.48, bx1 = ox + R * 0.48 + barrelLen;
  const bgr = x.createLinearGradient(0, oy - barrelW / 2, 0, oy + barrelW / 2);
  bgr.addColorStop(0, "#a3adbd"); bgr.addColorStop(0.42, "#59637a");
  bgr.addColorStop(0.75, "#2b3340"); bgr.addColorStop(1, "#141a24");
  x.fillStyle = bgr;
  x.beginPath();
  x.moveTo(bx0, oy - barrelW / 2); x.lineTo(bx1 - 10, oy - barrelW * 0.40);
  x.lineTo(bx1 - 10, oy + barrelW * 0.40); x.lineTo(bx0, oy + barrelW / 2);
  x.closePath(); x.fill();
  // Energieader laeuft durchgehend bis zur Muendung und glimmt
  x.fillStyle = "rgba(91,33,182,0.85)";
  x.fillRect(bx0 + 3, oy - 2, barrelLen - 16, 4);
  x.fillStyle = SLAYER_VIO;
  x.fillRect(bx0 + 4, oy - 1.1, barrelLen - 18, 2.2);
  x.fillStyle = SLAYER_VIO_HELL; x.globalAlpha = 0.7;
  x.fillRect(bx0 + 4, oy - 1.1, barrelLen - 18, 0.9);
  x.globalAlpha = 1;
  // Muendungsbremse: EIN breiter Block mit zwei Schlitzen — als Silhouette
  // lesbar, statt drei duenner Rippen, die bei 14 px Zellgroesse zerfallen.
  const mbx = bx1 - 14, mbw = 15;
  x.fillStyle = "rgba(0,0,0,0.40)";
  x.fillRect(mbx + 1.5, oy - barrelW * 0.70 + 2, mbw, barrelW * 1.40);
  const mbg = x.createLinearGradient(0, oy - barrelW * 0.7, 0, oy + barrelW * 0.7);
  mbg.addColorStop(0, "#9aa5b6"); mbg.addColorStop(0.45, "#4b5566"); mbg.addColorStop(1, "#1d242f");
  x.fillStyle = mbg;
  x.fillRect(mbx, oy - barrelW * 0.70, mbw, barrelW * 1.40);
  x.strokeStyle = "rgba(255,255,255,0.22)"; x.lineWidth = 1;
  x.strokeRect(mbx + 0.5, oy - barrelW * 0.70 + 0.5, mbw - 1, barrelW * 1.40 - 1);
  // zwei Auswurfschlitze
  x.fillStyle = "#0e131b";
  x.fillRect(mbx + 3.5, oy - barrelW * 0.66, 3, barrelW * 0.34);
  x.fillRect(mbx + 3.5, oy + barrelW * 0.32, 3, barrelW * 0.34);
  x.fillRect(mbx + 9, oy - barrelW * 0.66, 3, barrelW * 0.34);
  x.fillRect(mbx + 9, oy + barrelW * 0.32, 3, barrelW * 0.34);
  // Muendung mit violettem Glutkern
  x.fillStyle = "#0b1017";
  x.beginPath(); x.ellipse(bx1 + 3, oy, 3.2, barrelW * 0.44, 0, 0, Math.PI * 2); x.fill();
  const mg = x.createRadialGradient(bx1 + 3, oy, 0, bx1 + 3, oy, 5);
  mg.addColorStop(0, SLAYER_VIO_HELL); mg.addColorStop(1, "rgba(167,139,250,0)");
  x.fillStyle = mg;
  x.beginPath(); x.ellipse(bx1 + 3, oy, 5, barrelW * 0.55, 0, 0, Math.PI * 2); x.fill();
  // Visierbuegel oben auf dem Gehaeuse
  x.strokeStyle = SLAYER_VIO_HELL; x.lineWidth = 1.6; x.globalAlpha = 0.9;
  x.beginPath(); x.arc(ox + R * 0.05, oy, R * 0.34, -2.5, -0.65); x.stroke();
  x.globalAlpha = 1;
  return { canvas: c, ox, oy };
}

export function cannonBaseSprite(player, skinId, skinDef, kt) {
  if (!SPR.base) SPR.base = {};
  const key = player + (skinId ? "|" + skinId : "") + (kt === "slayer" ? "|S" : "");
  if (SPR.base[key]) return SPR.base[key];
  if (kt === "slayer") return (SPR.base[key] = slayerBaseSprite(player));
  const R = CELL * 1.6;
  const D = Math.ceil(R * 2.3);
  const c = mkSpriteCanvas(D, D);
  const x = c.getContext("2d");
  const n = CANNON_NEON[player] || CANNON_NEON[1];
  const cx = D / 2, cy = D / 2;
  const cols = skinDef ? skinDef.dome : ["#5a6477", "#2c333f", "#10141d"];
  // Achteckige Panzerplatte
  const plateR = R * 1.0;
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8;
    const px = cx + Math.cos(a) * plateR, py = cy + Math.sin(a) * plateR;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.closePath();
  const pg = x.createLinearGradient(cx - plateR, cy - plateR, cx + plateR * 0.6, cy + plateR);
  pg.addColorStop(0, "#6b7689");
  pg.addColorStop(0.45, "#333c4a");
  pg.addColorStop(1, "#11151d");
  x.fillStyle = pg;
  x.fill();
  x.strokeStyle = "rgba(0,0,0,0.55)";
  x.lineWidth = 1.4;
  x.stroke();
  // Lichtkante oben links auf der Platte
  x.strokeStyle = "rgba(255,255,255,0.30)";
  x.lineWidth = 1.2;
  x.beginPath();
  x.arc(cx, cy, plateR * 0.94, Math.PI * 0.78, Math.PI * 1.62);
  x.stroke();
  // Verankerungsbolzen an den Plattenecken
  for (let i = 0; i < 8; i += 2) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8;
    const bx = cx + Math.cos(a) * plateR * 0.78, by = cy + Math.sin(a) * plateR * 0.78;
    x.fillStyle = "rgba(0,0,0,0.5)";
    x.beginPath();
    x.arc(bx + 0.5, by + 0.6, 2.0, 0, Math.PI * 2);
    x.fill();
    const bg2 = x.createRadialGradient(bx - 0.7, by - 0.8, 0.2, bx, by, 2.1);
    bg2.addColorStop(0, "rgba(220,230,245,0.95)");
    bg2.addColorStop(1, "rgba(95,105,124,0.9)");
    x.fillStyle = bg2;
    x.beginPath();
    x.arc(bx, by, 1.8, 0, Math.PI * 2);
    x.fill();
  }
  // Turmring (Laufkranz) mit Zahnung
  x.strokeStyle = "rgba(10,14,20,0.85)";
  x.lineWidth = 3.4;
  x.beginPath();
  x.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
  x.stroke();
  x.strokeStyle = "rgba(150,164,186,0.55)";
  x.lineWidth = 1;
  x.beginPath();
  x.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
  x.stroke();
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2;
    x.strokeStyle = "rgba(10,14,20,0.7)";
    x.lineWidth = 1.1;
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * R * 0.66, cy + Math.sin(a) * R * 0.66);
    x.lineTo(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78);
    x.stroke();
  }
  // dunkle Grube in der Mitte (Turm sitzt darauf)
  x.fillStyle = "rgba(6,9,14,0.9)";
  x.beginPath();
  x.arc(cx, cy, R * 0.6, 0, Math.PI * 2);
  x.fill();
  SPR.base[key] = c;
  return c;
}
// Rotierender Teil: Turmgehäuse + Rohr, gezeichnet nach RECHTS (0°).
export function cannonTurretSprite(player, skinId, skinDef, kt) {
  if (!SPR.turret) SPR.turret = {};
  const key = player + (skinId ? "|" + skinId : "") + (kt === "slayer" ? "|S" : "");
  if (SPR.turret[key]) return SPR.turret[key];
  if (kt === "slayer") return (SPR.turret[key] = slayerTurretSprite(player));
  const R = CELL * 1.6;
  const barrelLen = CELL * 2.9, barrelW = 8.5;
  const PAD = 12;
  const W2 = Math.ceil(R * 0.95 + barrelLen + PAD * 2);
  const H2 = Math.ceil(R * 1.5 + PAD * 2);
  const c = mkSpriteCanvas(W2, H2);
  const x = c.getContext("2d");
  const n = CANNON_NEON[player] || CANNON_NEON[1];
  const ox = PAD + R * 0.62, oy = H2 / 2;   // Drehzentrum
  const cols = skinDef ? skinDef.dome : ["#7c8798", "#39424f", "#141922"];
  const core = skinDef ? skinDef.core : n.lt;
  // Schlagschatten des ganzen Turms
  x.save();
  x.globalAlpha = 0.5;
  x.fillStyle = "#000";
  if (typeof x.filter === "string") x.filter = "blur(3px)";
  roundRectPath(x, ox - R * 0.55 + 2, oy - R * 0.5 + 3, R * 1.1 + barrelLen * 0.5, R, 7);
  x.fill();
  x.filter = "none";
  x.restore();
  // Rücklaufzylinder (zwei schlanke Rohre neben dem Hauptrohr)
  for (const sgn of [-1, 1]) {
    const ry = oy + sgn * (barrelW * 0.62);
    x.fillStyle = "rgba(0,0,0,0.45)";
    roundRectPath(x, ox + R * 0.1, ry - 2.1 + 0.8, barrelLen * 0.62, 4.2, 2);
    x.fill();
    const cg = x.createLinearGradient(0, ry - 2.1, 0, ry + 2.1);
    cg.addColorStop(0, "#98a4b6");
    cg.addColorStop(1, "#2b323e");
    x.fillStyle = cg;
    roundRectPath(x, ox + R * 0.1, ry - 2.1, barrelLen * 0.62, 4.2, 2);
    x.fill();
  }
  // Hauptrohr — zur Mündung hin leicht verjüngt
  const bx0 = ox + R * 0.15, bx1 = ox + R * 0.15 + barrelLen;
  const bg = x.createLinearGradient(0, oy - barrelW / 2, 0, oy + barrelW / 2);
  bg.addColorStop(0, cols[0]);
  bg.addColorStop(0.42, cols[1]);
  bg.addColorStop(1, cols[2]);
  x.fillStyle = bg;
  x.beginPath();
  x.moveTo(bx0, oy - barrelW / 2);
  x.lineTo(bx1 - 6, oy - barrelW * 0.40);
  x.lineTo(bx1 - 6, oy + barrelW * 0.40);
  x.lineTo(bx0, oy + barrelW / 2);
  x.closePath();
  x.fill();
  x.fillStyle = "rgba(255,255,255,0.32)";
  x.fillRect(bx0, oy - barrelW / 2 + 0.8, barrelLen - 8, 1.4);
  // Verstärkungsbänder
  for (let b = 0; b < 3; b++) {
    const bxp = bx0 + 5 + b * (barrelLen * 0.25);
    x.fillStyle = "rgba(0,0,0,0.45)";
    x.fillRect(bxp, oy - barrelW / 2 - 0.9, 2.6, barrelW + 1.8);
    x.fillStyle = "rgba(196,208,226,0.55)";
    x.fillRect(bxp, oy - barrelW / 2 - 0.9, 1, barrelW + 1.8);
  }
  // Mündungsbremse — verdickter Kopf mit seitlichen Austrittsschlitzen
  const mbx = bx1 - 7, mbW = 9, mbH = barrelW + 4.5;
  x.fillStyle = "rgba(0,0,0,0.5)";
  roundRectPath(x, mbx + 1, oy - mbH / 2 + 1.5, mbW, mbH, 2.5);
  x.fill();
  const mg = x.createLinearGradient(0, oy - mbH / 2, 0, oy + mbH / 2);
  mg.addColorStop(0, "#a7b3c6");
  mg.addColorStop(0.45, "#4a5464");
  mg.addColorStop(1, "#171d27");
  x.fillStyle = mg;
  roundRectPath(x, mbx, oy - mbH / 2, mbW, mbH, 2.5);
  x.fill();
  x.fillStyle = "rgba(8,11,16,0.9)";
  x.fillRect(mbx + 2.2, oy - mbH / 2 + 1.2, 1.8, 2.6);
  x.fillRect(mbx + 2.2, oy + mbH / 2 - 3.8, 1.8, 2.6);
  // Mündungsöffnung mit Kernglühen
  x.fillStyle = "#06090e";
  x.beginPath();
  x.ellipse(mbx + mbW - 1.4, oy, 1.7, barrelW * 0.34, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = core;
  x.globalAlpha = 0.85;
  x.beginPath();
  x.ellipse(mbx + mbW - 1.4, oy, 0.9, barrelW * 0.2, 0, 0, Math.PI * 2);
  x.fill();
  x.globalAlpha = 1;
  // Turmgehäuse — geneigte Panzerung über dem Drehzentrum
  const hg = x.createLinearGradient(ox - R * 0.6, oy - R * 0.6, ox + R * 0.5, oy + R * 0.6);
  hg.addColorStop(0, cols[0]);
  hg.addColorStop(0.5, cols[1]);
  hg.addColorStop(1, cols[2]);
  x.fillStyle = hg;
  x.beginPath();
  x.moveTo(ox - R * 0.58, oy - R * 0.30);
  x.lineTo(ox + R * 0.26, oy - R * 0.46);
  x.lineTo(ox + R * 0.60, oy - R * 0.22);
  x.lineTo(ox + R * 0.60, oy + R * 0.22);
  x.lineTo(ox + R * 0.26, oy + R * 0.46);
  x.lineTo(ox - R * 0.58, oy + R * 0.30);
  x.closePath();
  x.fill();
  x.strokeStyle = "rgba(0,0,0,0.6)";
  x.lineWidth = 1.3;
  x.stroke();
  // Lichtkante auf der oberen Gehäusehälfte
  x.strokeStyle = "rgba(255,255,255,0.40)";
  x.lineWidth = 1.3;
  x.beginPath();
  x.moveTo(ox - R * 0.56, oy - R * 0.29);
  x.lineTo(ox + R * 0.26, oy - R * 0.45);
  x.lineTo(ox + R * 0.58, oy - R * 0.22);
  x.stroke();
  // Luke + Lüftungsschlitze + Team-Kern
  x.fillStyle = "rgba(10,14,20,0.75)";
  roundRectPath(x, ox - R * 0.40, oy - R * 0.17, R * 0.34, R * 0.34, 3);
  x.fill();
  x.strokeStyle = "rgba(255,255,255,0.16)";
  x.lineWidth = 0.8;
  x.stroke();
  for (let v = 0; v < 3; v++) {
    x.fillStyle = "rgba(6,9,14,0.8)";
    x.fillRect(ox + R * 0.02, oy - R * 0.26 + v * 5.2, R * 0.30, 2.4);
    x.fillStyle = "rgba(255,255,255,0.13)";
    x.fillRect(ox + R * 0.02, oy - R * 0.26 + v * 5.2, R * 0.30, 0.8);
  }
  const cg2 = x.createRadialGradient(ox, oy, 0.4, ox, oy, R * 0.2);
  cg2.addColorStop(0, core);
  cg2.addColorStop(1, n.glow + "0)");
  x.fillStyle = cg2;
  x.beginPath();
  x.arc(ox, oy, R * 0.2, 0, Math.PI * 2);
  x.fill();
  SPR.turret[key] = { canvas: c, ox, oy };
  return SPR.turret[key];
}

// kt = Kanonenart (v3.57.0): "std" = Mauerbrecher, "slayer" = Kanonen-Bezwinger.
// Der Bezwinger muss auf dem Feld SOFORT erkennbar sein — sonst weiss niemand,
// welche Rohre die gewaehlte Salve ueberhaupt abfeuert.
export function drawCannonFull(ctx, cx, cy, angle, player, reloadFrac, nowT, skinId, skinDef, kt) {
  const R = CELL * 1.6;
  const n = CANNON_NEON[player] || CANNON_NEON[1];
  const now = nowT != null ? nowT : Date.now();
  // Bodenschatten (eine Ellipse, billig)
  ctx.fillStyle = "rgba(0,0,0,0.40)";
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 5, R * 0.95, R * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  // FESTER Unterbau: Panzerplatte + Turmring (dreht NICHT mit — das ist der
  // Kern des Redesigns v3.45.0; vorher rotierte nur ein Stab an einer Kuppel)
  const base = cannonBaseSprite(player, skinId, skinDef, kt);
  ctx.drawImage(base, cx - base.width / 2, cy - base.height / 2);
  // ROTIERENDER Turm: Gehäuse + Rohr + Rücklaufzylinder + Mündungsbremse
  const tur = cannonTurretSprite(player, skinId, skinDef, kt);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.drawImage(tur.canvas, -tur.ox, -tur.oy);
  ctx.restore();
  // Kuppel-Sprite liefert weiterhin die Skin-Signatur (Facetten/Runen/Schuppen)
  // als Aufsatz auf dem Turmdach — kleiner skaliert, damit der Turm dominiert.
  // Der Bezwinger traegt KEINE Skin-Kuppel: sein eigenes Modell ist die
  // Signatur, ein zusaetzlicher Aufsatz wuerde die Silhouette nur zumatschen.
  if (kt !== "slayer") {
    const dome = cannonDomeSprite(player, skinId, skinDef);
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(dome, cx - dome.width * 0.31, cy - dome.height * 0.31, dome.width * 0.62, dome.height * 0.62);
    ctx.restore();
  }
  // ── Kennzeichnung Kanonen-Bezwinger ────────────────────────────────────
  // Bewusst als Aufsatz und nicht als eigenes Modell: die Silhouette bleibt
  // dieselbe (es ist eine Kanone), nur das Visier macht die Rolle klar.
  if (kt === "slayer") {
    // Kleiner pulsierender Energiekern auf dem Turmdach. Bewusst dezent —
    // das schwere Modell traegt die Erkennbarkeit, der Kern setzt nur den
    // violetten Akzent, der sich im Shop und am Salven-Schalter wiederholt.
    const t2 = (nowT != null ? nowT : Date.now()) / 700;
    ctx.save();
    ctx.translate(cx, cy);
    const puls = 0.72 + 0.28 * Math.sin(t2);
    const kg = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.34);
    kg.addColorStop(0, "rgba(221,214,254," + puls.toFixed(2) + ")");
    kg.addColorStop(0.45, "rgba(167,139,250,0.45)");
    kg.addColorStop(1, "rgba(167,139,250,0)");
    ctx.fillStyle = kg;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ede9fe";
    ctx.beginPath(); ctx.arc(0, 0, R * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // ── Signatur-Animation je Skin (v3.44.0) ────────────────────────────────
  // Das ist der eigentliche „Haben-wollen"-Faktor: ein Standbild kann man
  // umfärben, Bewegung nicht. Bewusst billig gehalten (wenige Arcs/Punkte),
  // weil bis zu ~24 Kanonen gleichzeitig auf dem Feld stehen können.
  if (skinDef && skinDef.style) {
    const fxc = skinDef.fx || n.lt;
    if (skinDef.style === "rune") {
      // Runenkranz dreht sich langsam, Hexer-Variante gegenläufig zweifach
      const rot = now / (skinDef.hexer ? 2600 : 4200);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.strokeStyle = fxc;
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now / 520);
      ctx.lineWidth = 1.2;
      for (let g = 0; g < 6; g++) {
        const a = g / 6 * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.95, a, a + 0.42);
        ctx.stroke();
      }
      ctx.restore();
      if (skinDef.hexer) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-rot * 1.6);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 0.9;
        for (let g = 0; g < 3; g++) {
          const a = g / 3 * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(0, 0, R * 1.12, a, a + 0.7);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    } else if (skinDef.style === "star") {
      // drei Sterne auf Umlaufbahn
      for (let o = 0; o < 3; o++) {
        const a = now / 1900 + o / 3 * Math.PI * 2;
        const ox2 = cx + Math.cos(a) * R * 1.05, oy2 = cy + Math.sin(a) * R * 1.05 * 0.55;
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now / 400 + o);
        ctx.fillStyle = fxc;
        ctx.beginPath();
        ctx.arc(ox2, oy2, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (skinDef.style === "scale") {
      // Hitzeflimmern: pulsierender Glutring dicht an der Kuppel
      ctx.globalAlpha = 0.20 + 0.16 * Math.sin(now / 430);
      ctx.strokeStyle = fxc;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (skinDef.style === "crystal") {
      // Prisma-Funkeln: kurzer Lichtblitz auf einer wandernden Facette
      const fa = Math.floor(now / 700) % 6;
      const a = fa / 6 * Math.PI * 2 + 0.5;
      ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(now / 350));
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
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
