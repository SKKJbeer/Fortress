// Auto-extrahiert aus index.html (Phase 1 der Modularisierung, v3.34.0).
// Reine Logik/Daten — kein DOM, kein React, kein Firebase. Unit-testbar via node --test.
// Spielfeld-, Zeit- und Zelltyp-Konstanten — gemeinsame Basis aller Engine-Module.

// ── Domaenentypen (v3.75.0) ────────────────────────────────────────────────
// Die drei Werte, die sich in einem 10.000-Zeilen-Spiel am leichtesten still
// vertauschen: WELCHER Spieler, WELCHE Zelle, WELCHES Material. Als eigene
// Typen kann der Compiler genau das aufhalten.

/** Spieler-Index. Es gibt nie einen Spieler 0 oder 4. */
export type Player = 1 | 2 | 3;
/** Inhalt einer Rasterzelle — siehe die EMPTY/WALL1/... Konstanten unten. */
export type Cell = number;
/** Das Spielfeld: Zeilen von oben nach unten, je ROWS x COLS. */
export type Grid = Cell[][];
/** Rasterposition. r = Zeile, c = Spalte — in dieser Reihenfolge, immer. */
export interface Pos { r: number; c: number; }
/**
 * Rasterposition als PAAR [Zeile, Spalte] — bewusst ein eigener Typ neben Pos.
 * Beide Formen kommen im Bestand vor (Pos bei Burgen und Kanonen, Paare bei
 * Pfaden und Zellmengen). Sie zu vermischen waere genau die Verwechslung, die
 * Typen verhindern sollen.
 */
export type RC = [number, number];
/** Die vier Schmiede-Materialien. */
export type MatKey = "iron" | "silver" | "dragon" | "star";
export type Materials = Record<MatKey, number>;
/** Sieg/Niederlage/Partien je Modus. */
export interface Stats { wins: number; losses: number; games: number; }
/**
 * Der Spielerfortschritt — die Struktur, an der Cloud-Save und Zusammenfuehrung
 * haengen. Fast alles ist optional, weil ueber die Versionen Felder dazukamen
 * und alte Profile aus dem localStorage sie nicht haben. Genau deshalb ist der
 * Typ wertvoll: er zwingt an jeder Stelle zur Entscheidung, was bei "fehlt"
 * gelten soll.
 */
export interface Profile {
  id?: string; name?: string; wappen?: string; color?: string;
  elo?: number; elo3?: number; peakElo?: number; peakElo3?: number;
  stats?: Stats; stats3?: Stats;
  gold?: number; level?: number; xp?: number; seasonXp?: number;
  winStreak?: number; lifetimeGold?: number; blocksDestroyed?: number;
  achievements?: unknown[]; unlockedRewards?: unknown[]; dailyTasks?: unknown[];
  cosmetics?: { owned?: string[]; equipped?: Record<string, string> };
  materials?: Partial<Materials>;
  historicalXpApplied?: boolean; achievementsRetroApplied?: boolean;
  updatedAt?: number;
}
/** Etwas, das je Spieler existiert (Beute, Kanonen, Upgrades ...). */
export type PerPlayer<T> = Record<Player, T>;

export const CELL = 14;
export const COLS = 44;
export const ROWS_HALF = 34;
export const ROWS = ROWS_HALF * 2;
export const W = COLS * CELL;
export const H = ROWS * CELL;
export const BUILD_TIME = 25;
export const SHOOT_TIME = 20;
export const CANNON_TIME = 15;
export const SETUP_TIME = 20;
export const CANNON_HP = 12;  // v3.31.0: 8→12 — Playtest (2 Spieler): mit 8 starb eine
                       // Kanone in <1 Runde Fokus-Feuer (2 Kanonen × 4 Salven à 2,5s).
                       // Mit 12 kostet ein Kill ~1,5 Runden Commitment — erreichbar
                       // (15 war laut Selfplay tot), aber eine echte Investition.
export const RELOAD_MS = 2500;
// Sprengradius der Kanonen-Explosion (v3.57.0). Eine Kanone belegt SELBST ein
// 3x3-Feld, Radius 1 traf deshalb nur sie selbst und nie eine Mauer — die seit
// v3.16.0 dokumentierte Wirkung "Kill oeffnet die Huelle" trat nie ein.
export const KILL_BLAST = 2;
// Schaden des Kanonen-Bezwingers (v3.57.0). Deutlich hoeher als der eines
// Mauerbrechers, weil je Salve nur EINE Kanonenart feuert — gemessen bricht
// das System bei Schaden 1 zusammen (5/32 entschiedene Partien statt 19/32).
export const SLAYER_DMG = 3;
// Streuung der Salve in Zellen (v3.60.0). Die ERSTE Kanone trifft immer exakt
// die anvisierte Zelle; jede weitere streut zufaellig um bis zu FAN_SPREAD
// Zellen in beide Richtungen — und darf dabei auch dieselbe Zelle treffen wie
// die erste. Zielen bleibt damit verlaesslich, die Bresche wird trotzdem
// breiter und unregelmaessiger.
export const FAN_SPREAD = 2;
export const GRAV = 0.07;
export const EMPTY = 0, WALL1 = 1, WALL2 = 2, CANNON1 = 3, CANNON2 = 4, RUBBLE = 5, CASTLE1 = 6, CASTLE2 = 7, RIVER = 8, MOUNTAIN = 9, WALL3 = 10, CANNON3 = 11, CASTLE3 = 12
// v3.31.1: Kanonen-Trümmer als EIGENER Typ — Reparatur (repairRubble) darf nur
// Mauer-Trümmer (RUBBLE) zurückverwandeln, keine zerstörten Kanonen. Rendering
// identisch (rubbleSprite); Flood-Fill behandelt beide gleich (kein Blocker).
export const RUBBLE_C = 13;
export const WALL_OF: PerPlayer<Cell> = { 1: WALL1, 2: WALL2, 3: WALL3 };
export const CANNON_OF: PerPlayer<Cell> = { 1: CANNON1, 2: CANNON2, 3: CANNON3 };
export const CASTLE_OF: PerPlayer<Cell> = { 1: CASTLE1, 2: CASTLE2, 3: CASTLE3 };
export const CASTLE_P1: Pos = { c: Math.floor(COLS / 2), r: Math.floor(ROWS_HALF * 0.5) };
export const CASTLE_P2: Pos = { c: Math.floor(COLS / 2), r: ROWS_HALF + Math.floor(ROWS_HALF * 0.5) };
export const C1 = CASTLE_P1;
export const C2 = CASTLE_P2;
