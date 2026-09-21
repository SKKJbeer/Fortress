// Netz-Schicht (Phase 2 der Modularisierung, v3.35.0).
// Pure Logik — kein DOM, kein Firebase. Unit-testbar via node --test.
import { W, H } from '../engine/const.ts';
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

// v2 (v3.57.0): Kanonen tragen eine ART (cannons[].kt = "std"|"slayer") und
// es gibt die Aktion "salvo". Ein alter Gast wuerde die Art ignorieren und
// dadurch falsche Wirkung anzeigen — deshalb inkompatibel.
export const PROTO_VERSION = 2;

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
  // Security (v3.112.0): playerInfo kommt vom HOST, und Host ist in diesem
  // Spiel jeder beliebige Mitspieler — es gibt keinen Server dazwischen. Bis
  // hierher wurde davon nur `name` gekuerzt; `wappen`, `color`, `trail`,
  // `frame`, `cannon` und `impact` gingen ungeprueft durch und landeten als
  // Nachschlage-Schluessel in Katalogen, als Bild-Quelle und als Farbwert.
  //
  // Zwei konkrete Wege, die das schliesst:
  //   - `wappen: "constructor"` liefert aus einem Objektliteral eine FUNKTION
  //     statt einer Bild-Adresse (Nachschlagen trifft die Prototypkette). Das
  //     Bild bleibt leer und der Browser fragt eine unsinnige relative
  //     Adresse an. `istKatalogWort` verlangt deshalb ein enges Zeichenmuster.
  //   - Ein `color` beliebiger Laenge geht in Zeichenketten fuer Schatten und
  //     Verlaeufe ein. Erlaubt ist jetzt nur noch eine Farbangabe.
  //
  // Verworfen wird IMMER nur das einzelne Feld, nie der ganze Zustand: ein
  // unbekannter Kosmetik-Schluessel eines neueren Clients darf das Spiel des
  // aelteren nicht anhalten (Regel 1 oben).
  if (s.playerInfo && typeof s.playerInfo === "object") {
    for (const k in s.playerInfo) {
      const pi = s.playerInfo[k];
      if (!pi || typeof pi !== "object") continue;
      // `delete` statt `= undefined`: Der Schluessel soll verschwinden, nicht
      // leer dastehen — sonst legt die Saeuberung Felder an, die der Host gar
      // nicht geschickt hat.
      if (typeof pi.name === "string") pi.name = pi.name.slice(0, 40); else delete pi.name;
      if (!istFarbe(pi.color)) delete pi.color;
      for (const f of ["wappen", "trail", "frame", "cannon", "impact"]) {
        if (pi[f] !== void 0 && !istKatalogWort(pi[f])) delete pi[f];
      }
      if (pi.elo !== void 0 && (typeof pi.elo !== "number" || !isFinite(pi.elo))) delete pi.elo;
    }
  }
  return s;
}

// Ein Katalog-Schluessel ist ein kurzes Wort aus Buchstaben, Ziffern,
// Unterstrich und Bindestrich — nichts sonst. Damit sind `__proto__`,
// `constructor` und `toString` ausgeschlossen, ohne eine Liste pflegen zu
// muessen, die beim naechsten neuen Wappen veraltet.
export function istKatalogWort(v) {
  return typeof v === "string" && v.length > 0 && v.length <= 24 && /^[A-Za-z0-9_-]+$/.test(v)
    && v !== "__proto__" && v !== "constructor" && v !== "prototype";
}
// #rgb, #rrggbb oder ein schlichtes Farbwort. Kein `rgba(…)`, keine
// Verlaeufe — nichts, was Klammern oder Semikolon tragen koennte.
export function istFarbe(v) {
  return typeof v === "string" && (/^#[0-9a-fA-F]{3}$/.test(v) || /^#[0-9a-fA-F]{6}$/.test(v)
    || /^[a-zA-Z]{1,20}$/.test(v));
}
export function sanitizeAction(raw) {
  let a;
  try {
    a = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    return null;
  }
  if (!a || typeof a !== "object") return null;
  const validTypes = ["place", "cannon", "fire", "aim", "join", "rotate", "leave", "buy", "ready", "emote", "salvo"];
  if (!validTypes.includes(a.type)) return null;
  if (a.type === "buy" && !["cannon", "slayer", "reload", "armor", "repair"].includes(a.item)) return null;
  if (a.type === "salvo" && !["std", "slayer"].includes(a.m)) return null;
  if (a.type === "emote" && (typeof a.e !== "number" || a.e < 0 || a.e > 7)) return null;
  if (a.r !== void 0 && (typeof a.r !== "number" || a.r < 0 || a.r > 300)) return null;
  if (a.c !== void 0 && (typeof a.c !== "number" || a.c < 0 || a.c > 300)) return null;
  if (a.tx !== void 0 && (typeof a.tx !== "number" || a.tx < 0 || a.tx > W * 2)) return null;
  if (a.ty !== void 0 && (typeof a.ty !== "number" || a.ty < 0 || a.ty > H * 2)) return null;
  if (a.angle !== void 0 && (typeof a.angle !== "number" || !isFinite(a.angle))) return null;
  if (a.elo !== void 0 && (typeof a.elo !== "number" || !isFinite(a.elo) || a.elo < 1 || a.elo > 9999)) return null;
  if (a.name !== void 0) a.name = String(a.name).slice(0, 30);
  if (a.color !== void 0 && !/^#[0-9a-f]{6}$/i.test(String(a.color))) delete a.color;
  // Kosmetik- und Wappen-Schluessel (v3.33.0, verschaerft v3.112.0): Bis
  // hierher wurde nur die LAENGE begrenzt. Ein Gast konnte damit
  // `wappen: "constructor"` schicken; der Host uebernimmt das Feld beim join
  // unveraendert und verteilt es an alle. Gegen den Katalog prueft der Host
  // nur `cannon` und `impact` — `wappen`, `trail` und `frame` gingen durch.
  // Jetzt muss jeder dieser Schluessel ein schlichtes Wort sein.
  for (const f of ["wappen", "cannon", "impact", "trail", "frame"]) {
    if (a[f] !== void 0 && !istKatalogWort(a[f])) delete a[f];
  }
  return a;
}

// ── Emotes (v3.25.0, hierher v3.101.0) ──────────────────────────────────
// Sechs vordefinierte Reaktionen fuers Online-Match — kein Freitext, also
// keine Moderationslast.
//
// **Warum das hier steht und nicht bei der Oberflaeche:** Uebertragen wird der
// INDEX, nicht das Zeichen. Damit sind Reihenfolge und Laenge dieser Liste ein
// Vertrag zwischen beiden Seiten. Wer sie umsortiert oder kuerzt, sorgt dafuer,
// dass ein alter und ein neuer Client verschiedene Emojis anzeigen — und zwar
// ohne Fehlermeldung: Ein unbekannter Index faellt still auf das erste Zeichen
// zurueck. Das waere ein Missverstaendnis zwischen zwei Spielern, das niemand
// als Programmfehler erkennt.
//
// Aenderung an dieser Liste = PROTO_VERSION erhoehen.
export const EMOTES = ["\u{1F44D}", "\u{1F604}", "\u{1F62E}", "\u{1F621}", "\u{1F3F0}", "\u{1F4A5}"];
