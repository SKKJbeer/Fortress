// Cloud-Save (v3.72.0) — Profil-Zusammenfuehrung zwischen Geraet und Server.
// Reine Logik/Daten — kein DOM, kein React, kein Firebase. Unit-testbar.
//
// WARUM ES DAS GIBT
// Bis v3.71.0 lag der komplette Fortschritt ausschliesslich im localStorage:
// ELO, Statistiken, Gold, Level, Achievements, gekaufte Kosmetik und
// Schmiede-Material. Eine Neuinstallation loeschte alles, ohne jede
// Wiederherstellung. Fuer den Play Store ist das der Klassiker unter den
// Ein-Stern-Bewertungen — und `cosmetics.owned` trifft am haertesten, weil
// dort steckt, wofuer jemand wochenlang Gold gesammelt hat.
//
// GRUNDHALTUNG DER ZUSAMMENFUEHRUNG: VERZEIHEND.
// Bei jedem Konflikt gewinnt die Variante, die dem Spieler MEHR laesst. Lieber
// einmal zu grosszuegig als ein verlorener Kauf. Der Client ist ohnehin nicht
// manipulationssicher (er schreibt seine Werte selbst) — echte Integritaet
// braeuchte serverseitige Validierung und damit einen kostenpflichtigen Plan.
// Cloud-Save loest "nichts verlieren", nicht "nicht schummeln".

import type { Profile, MatKey, Materials, Stats } from './const.ts';

export const CLOUD_SCHEMA = 1;
// Obergrenze fuer den hochgeladenen Profil-String. Deckt sich mit der
// Validierung in den Security-Rules; ein normales Profil liegt bei ~1-2 KB.
export const CLOUD_MAX_BYTES = 20000;

const NUM = (v: unknown, d = 0): number => (typeof v === "number" && isFinite(v) ? v : d);
const OBJ = (v: any): any => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const ARR = (v: any): any[] => (Array.isArray(v) ? v : []);

function statsOf(p: any, key: string): Stats {
  const s = OBJ(p && p[key]);
  return { wins: NUM(s.wins), losses: NUM(s.losses), games: NUM(s.games) };
}
function totalGames(p: any): number {
  return statsOf(p, "stats").games + statsOf(p, "stats3").games;
}
function unite(a: any, b: any): any[] {
  const out = [];
  const seen = new Set();
  for (const v of ARR(a).concat(ARR(b))) {
    const k = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

// Fuehrt zwei Profile zusammen. Reihenfolge ist egal (kommutativ) — ausser bei
// den Anzeige-Feldern, wo bewusst der juengere Zeitstempel gewinnt.
//
//   Zaehler        -> Maximum          (Gold, XP, Material, Bestwerte)
//   Mengen         -> Vereinigung      (Kosmetik, Achievements) — nie verlieren
//   Spielbilanz    -> aus EINEM Profil (siehe unten)
//   Anzeige/Wahl   -> juengerer Zeitstempel
//
// Die Spielbilanz (elo/elo3/stats/stats3/winStreak) wird bewusst NICHT je Feld
// gemischt: ein ELO-Wert gehoert zu genau der Siegesbilanz, aus der er
// entstanden ist. Feldweises Maximum ergaebe eine Wertung, die es nie gab
// (hohes ELO neben fremder Niederlagenzahl). Stattdessen gewinnt das Profil
// mit den MEHR gespielten Partien komplett — es ist nachweislich das weiter
// fortgeschrittene. Peak-Werte sind davon ausgenommen: eine Bestmarke ist per
// Definition ein Hoechststand und wird immer maximiert.
export function mergeProfiles(a: Profile | null | undefined, b: Profile | null | undefined): Profile | null {
  if (!a || typeof a !== "object") return b && typeof b === "object" ? b : null;
  if (!b || typeof b !== "object") return a;

  const aNewer = NUM(a.updatedAt) >= NUM(b.updatedAt);
  const neu = aNewer ? a : b;                 // juengeres Profil (Anzeige/Wahl)
  const fuehrend = totalGames(a) >= totalGames(b) ? a : b;  // mehr Partien

  const maxNum = (k: keyof Profile) => Math.max(NUM(a[k]), NUM(b[k]));
  const mats = (k: MatKey) => Math.max(NUM(OBJ(a.materials)[k]), NUM(OBJ(b.materials)[k]));

  // Level und XP gehoeren zusammen — sonst entstuende Level 12 mit dem XP-Rest
  // eines Level-3-Profils. Es gewinnt der hoehere Level, bei Gleichstand das
  // hoehere XP-Guthaben.
  const aLvl = NUM(a.level, 1), bLvl = NUM(b.level, 1);
  const lvlSieger = aLvl > bLvl ? a : bLvl > aLvl ? b : (NUM(a.xp) >= NUM(b.xp) ? a : b);

  const cosA = OBJ(a.cosmetics), cosB = OBJ(b.cosmetics);

  return {
    // Identitaet + Anzeige: juengere Wahl gewinnt
    id: neu.id || a.id || b.id,
    name: neu.name || a.name || b.name || "",
    wappen: neu.wappen || a.wappen || b.wappen,
    color: neu.color || a.color || b.color,

    // Spielbilanz: geschlossen aus dem weiter fortgeschrittenen Profil
    elo: NUM(fuehrend.elo, 1000),
    elo3: NUM(fuehrend.elo3, 1000),
    stats: statsOf(fuehrend, "stats"),
    stats3: statsOf(fuehrend, "stats3"),
    winStreak: NUM(fuehrend.winStreak),

    // Bestmarken: immer das Maximum
    peakElo: Math.max(maxNum("peakElo"), NUM(fuehrend.elo, 1000)),
    peakElo3: Math.max(maxNum("peakElo3"), NUM(fuehrend.elo3, 1000)),

    // Zaehler: grosszuegig maximieren
    gold: maxNum("gold"),
    seasonXp: maxNum("seasonXp"),
    lifetimeGold: maxNum("lifetimeGold"),
    blocksDestroyed: maxNum("blocksDestroyed"),
    level: NUM(lvlSieger.level, 1),
    xp: NUM(lvlSieger.xp),

    // Mengen: Vereinigung — ein Kauf darf NIE verschwinden
    achievements: unite(a.achievements, b.achievements),
    unlockedRewards: unite(a.unlockedRewards, b.unlockedRewards),
    dailyTasks: unite(a.dailyTasks, b.dailyTasks),
    cosmetics: {
      owned: unite(cosA.owned, cosB.owned),
      equipped: Object.assign({}, OBJ(cosB.equipped), OBJ(cosA.equipped),
                              OBJ((aNewer ? cosA : cosB).equipped))
    },
    materials: {
      iron: mats("iron"), silver: mats("silver"),
      dragon: mats("dragon"), star: mats("star")
    },

    // Einmal-Migrationen: einmal erledigt, bleibt erledigt
    historicalXpApplied: !!(a.historicalXpApplied || b.historicalXpApplied),
    achievementsRetroApplied: !!(a.achievementsRetroApplied || b.achievementsRetroApplied),

    updatedAt: Math.max(NUM(a.updatedAt), NUM(b.updatedAt))
  };
}

// Serverfassung: nur echte Fortschrittsdaten. Geraetegebundene Einstellungen
// (Sprache, Ton, Vibration) bleiben bewusst lokal — sie gehoeren zum Geraet,
// nicht zum Spieler, und wuerden sonst zwischen Geraeten hin- und herspringen.
export function profileForCloud(p: Profile | null | undefined, now?: number): Profile | null {
  if (!p || typeof p !== "object") return null;
  // mergeProfiles kann null liefern, wenn BEIDE Seiten leer sind — hier
  // ausgeschlossen, weil p oben geprueft wurde. Der Compiler kennt diesen
  // Zusammenhang nicht, und die Annahme stand bis v3.75.0 nirgends. Statt
  // einer Zusicherung eine echte Pruefung: sie kostet nichts und haelt auch
  // dann, wenn sich mergeProfiles einmal aendert.
  const c = mergeProfiles(p, p);          // normalisiert + fuellt Luecken
  if (!c) return null;
  c.updatedAt = NUM(now, NUM(p.updatedAt));
  return c;
}

// Prueft, ob ein hochzuladender Datensatz die Groessengrenze einhaelt.
export function cloudPayload(p: Profile | null | undefined, now?: number) {
  const c = profileForCloud(p, now);
  if (!c) return null;
  const s = JSON.stringify(c);
  if (s.length > CLOUD_MAX_BYTES) return null;
  return { p: s, updatedAt: NUM(c.updatedAt), v: CLOUD_SCHEMA };
}

// Gegenstueck: Serverdatensatz zurueck ins Profil-Objekt.
export function parseCloud(rec: any): Profile | null {
  if (!rec || typeof rec !== "object" || typeof rec.p !== "string") return null;
  if (rec.p.length > CLOUD_MAX_BYTES) return null;
  try {
    const o = JSON.parse(rec.p);
    if (!o || typeof o !== "object") return null;
    if (typeof o.updatedAt !== "number") o.updatedAt = NUM(rec.updatedAt);
    return o;
  } catch (e) { return null; }
}
