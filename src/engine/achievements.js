// Achievements (aus dem Grossblock herausgeloest, v3.78.0).
//
// Reine Logik: `processAchievementEvents(profile, events)` bekommt das Profil
// als PARAMETER und liest keinen Spielzustand — deshalb ohne Weiteres
// testbar und hier richtig aufgehoben.
const createEventBus = () => {
  const _listeners = {};
  return {
    on(event, cb) { if (!_listeners[event]) _listeners[event] = []; _listeners[event].push(cb); },
    off(event, cb) { if (_listeners[event]) _listeners[event] = _listeners[event].filter(f => f !== cb); },
    emit(event, data) { (_listeners[event] || []).forEach(cb => { try { cb(data); } catch(e) {} }); }
  };
};
const GameEventBus = createEventBus();
const GAME_EVENTS = {
  GAME_PLAYED: 'GAME_PLAYED',
  GAME_WON: 'GAME_WON',
  BLOCK_DESTROYED: 'BLOCK_DESTROYED',
  GOLD_EARNED: 'GOLD_EARNED',
  ELO_CHANGED: 'ELO_CHANGED',
  WIN_STREAK_CHANGED: 'WIN_STREAK_CHANGED'
};
const ACHIEVEMENTS = [
  // Siege
  { id:'first_win',  title:'Erste Festung zerstört', desc:'Gewinne dein erstes Online-Spiel',       icon:'swords',  cat:'siege',       target:1,     xp:50,   gold:25,  hidden:false },
  { id:'wins_10',    title:'10 Siege',                desc:'Gewinne 10 Online-Spiele',               icon:'trophy',  cat:'siege',       target:10,    xp:100,  gold:50,  hidden:false },
  { id:'wins_50',    title:'50 Siege',                desc:'Gewinne 50 Online-Spiele',               icon:'crown',  cat:'siege',       target:50,    xp:300,  gold:150, hidden:false },
  { id:'wins_100',   title:'100 Siege',               desc:'Gewinne 100 Online-Spiele',              icon:'star',  cat:'siege',       target:100,   xp:500,  gold:300, hidden:false },
  // Spiele
  { id:'first_game', title:'Erstes Spiel',            desc:'Spiele dein erstes Online-Spiel',        icon:'gamepad',  cat:'spiele',      target:1,     xp:30,   gold:20,  hidden:false },
  { id:'games_25',   title:'25 Spiele',               desc:'Spiele 25 Online-Spiele',                icon:'target',  cat:'spiele',      target:25,    xp:100,  gold:50,  hidden:false },
  { id:'games_100',  title:'100 Spiele',              desc:'Spiele 100 Online-Spiele',               icon:'medal', cat:'spiele',      target:100,   xp:250,  gold:125, hidden:false },
  { id:'games_500',  title:'500 Spiele',              desc:'Spiele 500 Online-Spiele',               icon:'award',  cat:'spiele',      target:500,   xp:1000, gold:500, hidden:false },
  // Zerstörung
  { id:'blocks_100',  title:'100 Blöcke',    desc:'Zerstöre 100 feindliche Blöcke',  icon:'zap', cat:'zerstoerung', target:100,  xp:75,  gold:40,  hidden:false },
  { id:'blocks_1000', title:'1000 Blöcke',   desc:'Zerstöre 1000 feindliche Blöcke', icon:'bomb', cat:'zerstoerung', target:1000, xp:200, gold:100, hidden:false },
  { id:'blocks_5000', title:'5000 Blöcke',   desc:'Zerstöre 5000 feindliche Blöcke', icon:'skull', cat:'zerstoerung', target:5000, xp:600, gold:300, hidden:false },
  // Gold
  { id:'gold_500',   title:'500 Gold',   desc:'Verdiene insgesamt 500 Gold',   icon:'coins', cat:'gold', target:500,   xp:80,  gold:0, hidden:false },
  { id:'gold_2000',  title:'2000 Gold',  desc:'Verdiene insgesamt 2000 Gold',  icon:'gem', cat:'gold', target:2000,  xp:200, gold:0, hidden:false },
  { id:'gold_10000', title:'10000 Gold', desc:'Verdiene insgesamt 10000 Gold', icon:'crown', cat:'gold', target:10000, xp:750, gold:0, hidden:false },
  // ELO
  { id:'elo_1000', title:'1000 ELO', desc:'Erreiche 1000 ELO',  icon:'barChart', cat:'elo', target:1000, xp:50,  gold:25,  hidden:false },
  { id:'elo_1200', title:'1200 ELO', desc:'Erreiche 1200 ELO',  icon:'trendingUp', cat:'elo', target:1200, xp:150, gold:75,  hidden:false },
  { id:'elo_1400', title:'1400 ELO', desc:'Erreiche 1400 ELO',  icon:'rocket', cat:'elo', target:1400, xp:400, gold:200, hidden:false },
  // Serien
  { id:'streak_3',  title:'3 Siege in Folge',  desc:'Gewinne 3 Spiele in Folge',  icon:'flame', cat:'serien', target:3,  xp:100, gold:50,  hidden:false },
  { id:'streak_5',  title:'5 Siege in Folge',  desc:'Gewinne 5 Spiele in Folge',  icon:'zap', cat:'serien', target:5,  xp:200, gold:100, hidden:false },
  { id:'streak_10', title:'10 Siege in Folge', desc:'Gewinne 10 Spiele in Folge', icon:'sparkles', cat:'serien', target:10, xp:500, gold:250, hidden:false },
];
// Englische Übersetzungen der Achievements (DE bleibt im Array oben = Fallback).
const ACH_EN = {
  first_win:  { t:'First Fortress Destroyed', d:'Win your first online game' },
  wins_10:    { t:'10 Wins',   d:'Win 10 online games' },
  wins_50:    { t:'50 Wins',   d:'Win 50 online games' },
  wins_100:   { t:'100 Wins',  d:'Win 100 online games' },
  first_game: { t:'First Game', d:'Play your first online game' },
  games_25:   { t:'25 Games',  d:'Play 25 online games' },
  games_100:  { t:'100 Games', d:'Play 100 online games' },
  games_500:  { t:'500 Games', d:'Play 500 online games' },
  blocks_100: { t:'100 Blocks',  d:'Destroy 100 enemy blocks' },
  blocks_1000:{ t:'1000 Blocks', d:'Destroy 1000 enemy blocks' },
  blocks_5000:{ t:'5000 Blocks', d:'Destroy 5000 enemy blocks' },
  gold_500:   { t:'500 Gold',   d:'Earn 500 gold in total' },
  gold_2000:  { t:'2000 Gold',  d:'Earn 2000 gold in total' },
  gold_10000: { t:'10000 Gold', d:'Earn 10000 gold in total' },
  elo_1000:   { t:'1000 ELO', d:'Reach 1000 ELO' },
  elo_1200:   { t:'1200 ELO', d:'Reach 1200 ELO' },
  elo_1400:   { t:'1400 ELO', d:'Reach 1400 ELO' },
  streak_3:   { t:'3 Win Streak',  d:'Win 3 games in a row' },
  streak_5:   { t:'5 Win Streak',  d:'Win 5 games in a row' },
  streak_10:  { t:'10 Win Streak', d:'Win 10 games in a row' },
};
// Takes profile AFTER stats/ELO/gold have been updated.
// events: array of { type, ...data }
// Returns { achievements, newlyUnlocked, xpGained, goldGained }
function processAchievementEvents(profile, events) {
  let achs = Array.isArray(profile.achievements) ? profile.achievements.map(a => ({...a})) : [];
  let xpGained = 0, goldGained = 0;
  const newlyUnlocked = [];

  for (const evt of events) {
    for (const def of ACHIEVEMENTS) {
      const existing = achs.find(a => a.id === def.id);
      if (existing && existing.unlocked) continue;
      const curProgress = existing ? existing.progress : 0;
      let newProgress = curProgress;

      if (def.cat === 'siege' && evt.type === GAME_EVENTS.GAME_WON) {
        newProgress = (profile.stats && profile.stats.wins || 0) + (profile.stats3 && profile.stats3.wins || 0);
      } else if (def.cat === 'spiele' && evt.type === GAME_EVENTS.GAME_PLAYED) {
        newProgress = (profile.stats && profile.stats.games || 0) + (profile.stats3 && profile.stats3.games || 0);
      } else if (def.cat === 'zerstoerung' && evt.type === GAME_EVENTS.BLOCK_DESTROYED) {
        newProgress = typeof profile.blocksDestroyed === 'number' ? profile.blocksDestroyed : 0;
      } else if (def.cat === 'gold' && evt.type === GAME_EVENTS.GOLD_EARNED) {
        newProgress = typeof profile.lifetimeGold === 'number' ? profile.lifetimeGold : 0;
      } else if (def.cat === 'elo' && evt.type === GAME_EVENTS.ELO_CHANGED) {
        newProgress = Math.max(
          typeof profile.elo === 'number' ? profile.elo : 0,
          typeof profile.elo3 === 'number' ? profile.elo3 : 0
        );
      } else if (def.cat === 'serien' && evt.type === GAME_EVENTS.WIN_STREAK_CHANGED) {
        newProgress = typeof profile.winStreak === 'number' ? profile.winStreak : 0;
      } else {
        continue;
      }

      if (newProgress === curProgress && newProgress < def.target) continue;

      const justUnlocked = newProgress >= def.target && !existing?.unlocked;
      const entry = {
        id: def.id,
        progress: Math.min(newProgress, def.target),
        unlocked: newProgress >= def.target,
        unlockedAt: justUnlocked ? Date.now() : (existing?.unlockedAt || null)
      };
      const idx = achs.findIndex(a => a.id === def.id);
      if (idx >= 0) achs[idx] = entry; else achs.push(entry);

      if (justUnlocked) {
        newlyUnlocked.push(def);
        xpGained += def.xp;
        goldGained += def.gold;
      }
    }
  }
  return { achievements: achs, newlyUnlocked, xpGained, goldGained };
}
// Globale Lichtrichtung (v3.41.0, AAA-Stufe 1): EINE Sonne für die ganze Szene,
// von oben links. Alles, was Tiefe erzeugt — Kontaktschatten, Fase, Ambient
// Occlusion — richtet sich danach. Inkonsistentes Licht ist der Hauptgrund,
// warum 2D-Szenen „flach" wirken.

export { createEventBus, GameEventBus, GAME_EVENTS, ACHIEVEMENTS, ACH_EN,
         processAchievementEvents };
