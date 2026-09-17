// Tages-Logik: Belohnungs-Kalender, Treue-Bonus, Aufgaben-Rotation.
//
// Aus `src/game/app.js` herausgeloest (v3.97.0). Hierher und nicht nach `ui/`,
// weil es **reine Logik** ist — die Architekturregel dieses Projekts sagt:
// Formeln und Kataloge gehoeren nach `src/engine/`, neue Dateien in
// TypeScript. Der Nutzen ist nicht die Ordnung, sondern die Pruefbarkeit:
// Diese Funktionen entscheiden, wie viel Gold jemand bekommt, und das laesst
// sich jetzt ohne Browser durchrechnen.
//
// **Was NICHT hierher gehoert:** `loadDailyState`/`saveDailyState` und die
// Aufgaben-Persistenz. Die fassen localStorage an, sind also nicht rein und
// bleiben drueben.

export type TagesBelohnung = { gold: number; xp?: number; special?: string };
export type TagesStand = { lastCollect?: number; streak?: number; lastStreakDay?: string };
export type AufgabenDef = { id: string; target: number; gold: number; stat: string; icon: string };
export type Aufgabe = { id: string; prog: number; collected: boolean };

import { makeRng } from './terrain.ts';

// Sieben Tage, danach wiederholt sich der Kalender — aber jede Woche ist mehr
// wert (siehe dailyWeekMult).
export const DAILY_REWARDS: TagesBelohnung[] = [
  { gold: 10 }, { gold: 15 }, { gold: 15 }, { gold: 20 },
  { gold: 20 }, { gold: 25 }, { gold: 50, special: 'chest' },
];

// 3 rotierende Tagesaufgaben, deterministisch aus dem Datum (alle Spieler
// desselben Tages sehen dieselben Aufgaben). Fortschritt kommt am Rundenende
// aus matchStats (Bot + Online zaehlen, Tutorial nicht).
export const DAILY_TASK_POOL: AufgabenDef[] = [
  { id: 'walls30',  target: 30, gold: 30, stat: 'walls',   icon: 'zap' },
  { id: 'walls80',  target: 80, gold: 50, stat: 'walls',   icon: 'zap' },
  { id: 'cannons2', target: 2,  gold: 40, stat: 'cannons', icon: 'bomb' },
  { id: 'scrap60',  target: 60, gold: 30, stat: 'scrap',   icon: 'hammer' },
  { id: 'play2',    target: 2,  gold: 25, stat: 'played',  icon: 'gamepad' },
  { id: 'play4',    target: 4,  gold: 45, stat: 'played',  icon: 'gamepad' },
  { id: 'win1',     target: 1,  gold: 40, stat: 'won',     icon: 'trophy' },
  { id: 'buy3',     target: 3,  gold: 30, stat: 'buys',    icon: 'shoppingCart' },
];

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function msTillMidnight(): number {
  const n = new Date();
  const m = new Date(n);
  m.setHours(24, 0, 0, 0);
  return m.getTime() - n.getTime();
}

// Abholbar, sobald ein neuer KALENDERTAG begonnen hat — nicht 24 Stunden
// spaeter. Wer abends um elf abholt, soll am naechsten Morgen wieder duerfen.
export function getDailyCollectable(daily: TagesStand | null | undefined): boolean {
  if (!daily || !daily.lastCollect) return true;
  return new Date(daily.lastCollect).toDateString() !== new Date().toDateString();
}

export function getDailyStreakIndex(daily: TagesStand | null | undefined): number {
  return Math.min(((daily && daily.streak) || 0) % 7, 6);
}

// Treue-Bonus: pro abgeschlossener 7-Tage-Woche +25% auf Gold/XP, gedeckelt
// bei x3 (nach 8 Wochen). Der 7-Tage-Kalender wiederholt sich, aber jede Woche
// wird wertvoller → kein „von-vorne"-Gefuehl, sondern spuerbare Belohnung fuer
// lange Straehnen.
export function dailyWeekMult(streak: number | null | undefined): number {
  return Math.min(1 + Math.floor((streak || 0) / 7) * 0.25, 3);
}

// Die effektive Belohnung eines Tages. **Anzeige und Vergabe muessen denselben
// Wert benutzen** — stuenden im Kalender andere Zahlen als auf dem Konto,
// waere das ein gebrochenes Versprechen, kein Anzeigefehler.
export function dailyReward(daily: TagesStand | null | undefined): TagesBelohnung {
  const basis = DAILY_REWARDS[getDailyStreakIndex(daily)];
  const mult = dailyWeekMult(daily && daily.streak);
  return {
    gold: Math.round(basis.gold * mult),
    xp: Math.round((basis.xp || 0) * mult),
    special: basis.special,
  };
}

export function rollDailyTasks(dayStr: string): Aufgabe[] {
  const seed = (parseInt(dayStr.replace(/-/g, ''), 10) ^ 1597334677) >>> 0;
  const rng = makeRng(seed);
  const pool = [...DAILY_TASK_POOL];
  const picked: AufgabenDef[] = [];
  while (picked.length < 3 && pool.length) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return picked.map((tk) => ({ id: tk.id, prog: 0, collected: false }));
}

export function taskDef(id: string): AufgabenDef | undefined {
  return DAILY_TASK_POOL.find((d) => d.id === id);
}
