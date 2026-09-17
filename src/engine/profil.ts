// Profil-Normalisierung: aus rohem Speicherinhalt ein vollstaendiges Profil.
//
// Aus `loadProfile` in app.js herausgeloest (v3.100.0). Dort lag beides in
// einer Funktion — das Lesen aus localStorage UND das Aufbauen des Profils.
// Nur das Zweite ist rein, und nur das Zweite ist das Gefaehrliche.
//
// **Warum das eine eigene, geprueft Datei verdient.** Diese Funktion baut das
// Profil aus einer Whitelist NEU auf. Ein Feld, das hier fehlt, ist nicht
// „nicht uebernommen" — es wird beim naechsten Speichern endgueltig geloescht.
// Genau so sind einmal gekaufte Gegenstaende verschwunden (v3.26.1). Der
// Kommentar dazu stand im Code; eine Pruefung gab es nie.
import { applyXpGain } from './progression.ts';
import { matOf } from './catalog.ts';
import { GAME_EVENTS, processAchievementEvents } from './achievements.js';

export type Profil = Record<string, any>;

// Die Avatar-Tabellen kommen als Argument herein statt per Import: Diese Datei
// soll nichts ueber die UI wissen muessen, und im Test laesst sich die
// Zuordnung so einsetzen.
export type WappenTabellen = {
  migration: Record<string, string>;
  vorhanden: Record<string, unknown>;
};

export function normalisiereProfil(
  p: Profil | null | undefined,
  wappen: WappenTabellen,
): { profil: Profil; mussSpeichern: boolean } | null {
  if (!p || typeof p !== 'object') return null;

  let id = p.id;
  let mussSpeichern = false;
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    mussSpeichern = true;
  }

  const zahl = (x: unknown, ersatz: number) => (typeof x === 'number' ? x : ersatz);
  const liste = (x: unknown) => (Array.isArray(x) ? x : []);

  const prof: Profil = {
    id,
    name: p.name || '',
    wappen: (p.wappen && wappen.migration[p.wappen])
      ? wappen.migration[p.wappen]
      : (p.wappen && wappen.vorhanden[p.wappen] ? p.wappen : 'skelett'),
    color: p.color || '#2563eb',
    // ELO-Wertung (Start 1000). stats/stats3 = Siege/Niederlagen je Modus.
    elo: zahl(p.elo, 1e3),
    elo3: zahl(p.elo3, 1e3),
    stats:  { wins: p.stats?.wins || 0,  losses: p.stats?.losses || 0,  games: p.stats?.games || 0 },
    stats3: { wins: p.stats3?.wins || 0, losses: p.stats3?.losses || 0, games: p.stats3?.games || 0 },
    gold: zahl(p.gold, 100),
    level: zahl(p.level, 1),
    xp: zahl(p.xp, 0),
    unlockedRewards: liste(p.unlockedRewards),
    peakElo: zahl(p.peakElo, zahl(p.elo, 1000)),
    peakElo3: zahl(p.peakElo3, zahl(p.elo3, 1000)),
    achievements: liste(p.achievements),
    dailyTasks: liste(p.dailyTasks),
    seasonXp: zahl(p.seasonXp, 0),
    historicalXpApplied: p.historicalXpApplied === true,
    achievementsRetroApplied: p.achievementsRetroApplied === true,
    winStreak: zahl(p.winStreak, 0),
    blocksDestroyed: zahl(p.blocksDestroyed, 0),
    lifetimeGold: zahl(p.lifetimeGold, typeof p.gold === 'number' ? Math.max(0, p.gold - 100) : 0),
    // Gold-Shop-Kaeufe (v3.26.1) und Schmiede-Material (v3.33.0) MUESSEN hier
    // stehen — siehe Kopf der Datei.
    cosmetics: {
      owned: liste(p.cosmetics && p.cosmetics.owned),
      equipped: (p.cosmetics && typeof p.cosmetics.equipped === 'object' && p.cosmetics.equipped) || {},
    },
    materials: matOf(p),
  };

  // Einmalige Nachtraege fuer Profile aus der Zeit vor Level und Achievements.
  if (!p.historicalXpApplied && prof.level === 1 && prof.xp === 0
      && (prof.stats.games > 0 || prof.stats3.games > 0)) {
    const histXp = (prof.stats.wins || 0) * 30 + (prof.stats.losses || 0) * 10
                 + (prof.stats3.wins || 0) * 30 + (prof.stats3.losses || 0) * 10;
    if (histXp > 0) {
      const migriert = applyXpGain(prof, histXp);
      prof.level = migriert.level;
      prof.xp = migriert.xp;
      prof.historicalXpApplied = true;
      mussSpeichern = true;
    }
  }

  if (!p.achievementsRetroApplied) {
    const rueckwirkend = [
      { type: GAME_EVENTS.GAME_PLAYED },
      { type: GAME_EVENTS.GAME_WON },
      { type: GAME_EVENTS.GOLD_EARNED },
      { type: GAME_EVENTS.ELO_CHANGED },
      { type: GAME_EVENTS.WIN_STREAK_CHANGED },
      { type: GAME_EVENTS.BLOCK_DESTROYED },
    ];
    const erg = processAchievementEvents(prof, rueckwirkend);
    if (erg.newlyUnlocked.length > 0) {
      prof.achievements = erg.achievements;
      if (erg.xpGained > 0 || erg.goldGained > 0) {
        const { level, xp } = applyXpGain(prof, erg.xpGained);
        prof.level = level;
        prof.xp = xp;
        prof.gold = zahl(prof.gold, 100) + erg.goldGained;
      }
    }
    prof.achievementsRetroApplied = true;
    mussSpeichern = true;
  }

  return { profil: prof, mussSpeichern };
}

// Die Felder, die ein Profil traegt. Eine Quelle fuer die Pruefung — steht ein
// Feld hier und faellt es in normalisiereProfil heraus, ist das Datenverlust.
export const PROFIL_FELDER = [
  'id', 'name', 'wappen', 'color', 'elo', 'elo3', 'stats', 'stats3', 'gold',
  'level', 'xp', 'unlockedRewards', 'peakElo', 'peakElo3', 'achievements',
  'dailyTasks', 'seasonXp', 'historicalXpApplied', 'achievementsRetroApplied',
  'winStreak', 'blocksDestroyed', 'lifetimeGold', 'cosmetics', 'materials',
] as const;
