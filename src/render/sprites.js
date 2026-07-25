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
