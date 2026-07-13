// Netz-Schicht (Phase 2 der Modularisierung, v3.35.0).
// Pure Logik — kein DOM, kein Firebase. Unit-testbar via node --test.
import { W, H } from '../engine/const.js';
// ── Sync-Protokoll zwischen Host und Gaesten ────────────────────────────
// Der Host serialisiert den kompletten Spielzustand (serializeState in
// index.html) und pusht ihn nach Firebase; Gaeste validieren mit
// sanitizeState und uebernehmen via applyState. Aktionen der Gaeste laufen
// durch sanitizeAction. REGELN:
// 1. Neue State-/Action-Felder IMMER optional mit Default — alte Clients
//    muessen unbekannte Felder ignorieren koennen (abwaertskompatibel).
// 2. Nicht-kompatible Aenderungen (Feld-Semantik, Grid-Format, Phasen) →
//    PROTO_VERSION erhoehen. Gaeste mit aelterer Version zeigen dann einen
//    "Bitte neu laden"-Hinweis statt still zu brechen.
//
// State-Schema (Host → Gast, Auszug der Kernfelder):
//   pv          Protokoll-Version (seit v3.35.0)
//   grid        ROWS×COLS Zellcodes (siehe engine/const.js)
//   terrainSeed deterministischer Seed → Gaeste regenerieren Terrain/Welt
//   phase       setup|build|shoot|cannon|result  + timer, round, scores
//   balls[]     {sx,sy,tx,ty,prog,dur,arcH,player,alive,fx}
//   explosions[] {x,y,frame,big,fx} · scrapPops[] · repairFx[]
//   cannons/castles/pieces/eliminated/frozenReady/lastShot/reloadProg
//   playerInfo  {name,wappen,color,elo,trail,frame,cannon,impact} je Spieler
//   resultInfo  Endstand · screen · numPlayers

export const PROTO_VERSION = 1;

export function sanitizeState(s) {
  if (!s || typeof s !== "object") return null;
  if (!Array.isArray(s.grid) || !s.phase || typeof s.timer !== "number") return null;
  if (!["setup", "build", "shoot", "cannon", "result", "menu", "game"].includes(s.phase)) return null;
  if (s.grid.length > 200) return null;
  for (const row of s.grid) if (!Array.isArray(row) || row.length > 200) return null;
  if (s.timer < 0 || s.timer > 300) return null;
  // Security (v3.39.1): Kollektionsgroessen deckeln. Ein manipulierter Host
  // koennte sonst Millionen-Eintraege in balls/explosions/cannons schicken →
  // der Gast iteriert sie im Render-Loop (ausserhalb schuetzender try/catch)
  // → Freeze/OOM. Reale Werte liegen weit unter diesen Grenzen (Feld 44×68).
  if (Array.isArray(s.balls) && s.balls.length > 400) return null;
  if (Array.isArray(s.explosions) && s.explosions.length > 400) return null;
  if (Array.isArray(s.scrapPops) && s.scrapPops.length > 400) return null;
  if (Array.isArray(s.repairFx) && s.repairFx.length > 400) return null;
  // cannons ist pro Spieler ein Array ({1:[...],2:[...],3:[...]})
  if (s.cannons && typeof s.cannons === "object") {
    for (const k in s.cannons) {
      if (Array.isArray(s.cannons[k]) && s.cannons[k].length > 400) return null;
    }
  }
  if (s.playerInfo && typeof s.playerInfo === "object") {
    for (const k in s.playerInfo) {
      const pi = s.playerInfo[k];
      if (pi && typeof pi.name === "string" && pi.name.length > 40) pi.name = pi.name.slice(0, 40);
    }
  }
  return s;
}
export function sanitizeAction(raw) {
  let a;
  try {
    a = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    return null;
  }
  if (!a || typeof a !== "object") return null;
  const validTypes = ["place", "cannon", "fire", "aim", "join", "rotate", "leave", "buy", "ready", "emote"];
  if (!validTypes.includes(a.type)) return null;
  if (a.type === "buy" && !["cannon", "reload", "armor", "repair"].includes(a.item)) return null;
  if (a.type === "emote" && (typeof a.e !== "number" || a.e < 0 || a.e > 7)) return null;
  if (a.r !== void 0 && (typeof a.r !== "number" || a.r < 0 || a.r > 300)) return null;
  if (a.c !== void 0 && (typeof a.c !== "number" || a.c < 0 || a.c > 300)) return null;
  if (a.tx !== void 0 && (typeof a.tx !== "number" || a.tx < 0 || a.tx > W * 2)) return null;
  if (a.ty !== void 0 && (typeof a.ty !== "number" || a.ty < 0 || a.ty > H * 2)) return null;
  if (a.angle !== void 0 && (typeof a.angle !== "number" || !isFinite(a.angle))) return null;
  if (a.elo !== void 0 && (typeof a.elo !== "number" || !isFinite(a.elo) || a.elo < 1 || a.elo > 9999)) return null;
  if (a.name !== void 0) a.name = String(a.name).slice(0, 30);
  if (a.wappen !== void 0) a.wappen = String(a.wappen).slice(0, 10);
  if (a.color !== void 0 && !/^#[0-9a-f]{6}$/i.test(String(a.color))) delete a.color;
  // Kosmetik-IDs (v3.33.0): nur kurze Strings durchlassen; inhaltliche
  // Validierung (gegen CANNON_SKIN/IMPACT_FX) macht der Host beim join.
  if (a.cannon !== void 0 && (typeof a.cannon !== "string" || a.cannon.length > 24)) delete a.cannon;
  if (a.impact !== void 0 && (typeof a.impact !== "string" || a.impact.length > 24)) delete a.impact;
  return a;
}
