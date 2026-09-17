// Die Tages-Logik, durchgerechnet.
//
// Diese Funktionen entscheiden, wie viel Gold jemand fuer seine Treue bekommt.
// Bis v3.97.0 standen sie mitten im Spielcode und liefen nur im Browser — also
// hat sie nie jemand nachgerechnet. Jetzt liegen sie in `engine/daily.ts`.
import { test } from 'node:test';
import assert from 'node:assert';
import {
  DAILY_REWARDS, DAILY_TASK_POOL, todayStr, msTillMidnight,
  getDailyCollectable, getDailyStreakIndex, dailyWeekMult, dailyReward,
  rollDailyTasks, taskDef,
} from '../src/engine/daily.ts';

test('Der Kalender hat sieben Tage, der siebte ist die Kiste', () => {
  assert.strictEqual(DAILY_REWARDS.length, 7);
  assert.strictEqual(DAILY_REWARDS[6].special, 'chest');
  for (const r of DAILY_REWARDS) assert.ok(r.gold > 0);
  // Der letzte Tag muss sich lohnen, sonst traegt die Woche nicht.
  assert.ok(DAILY_REWARDS[6].gold > DAILY_REWARDS[0].gold * 2);
});

test('Abholbar ist an einen neuen KALENDERTAG geknuepft, nicht an 24 Stunden', () => {
  assert.strictEqual(getDailyCollectable(null), true, 'ohne Stand immer abholbar');
  assert.strictEqual(getDailyCollectable({}), true);
  assert.strictEqual(getDailyCollectable({ lastCollect: Date.now() }), false, 'heute schon geholt');
  // Gestern 23:59 geholt → heute wieder dran. Genau das ist gemeint: Wer
  // abends spaet abholt, soll morgens frueh wieder duerfen.
  const gestern = new Date(); gestern.setDate(gestern.getDate() - 1); gestern.setHours(23, 59, 0, 0);
  assert.strictEqual(getDailyCollectable({ lastCollect: gestern.getTime() }), true);
});

test('Der Kalender laeuft zyklisch ueber sieben Tage', () => {
  assert.strictEqual(getDailyStreakIndex(null), 0);
  assert.strictEqual(getDailyStreakIndex({ streak: 0 }), 0);
  assert.strictEqual(getDailyStreakIndex({ streak: 6 }), 6);
  assert.strictEqual(getDailyStreakIndex({ streak: 7 }), 0, 'Woche 2 beginnt von vorn');
  assert.strictEqual(getDailyStreakIndex({ streak: 13 }), 6);
  for (let s = 0; s < 40; s++) {
    const i = getDailyStreakIndex({ streak: s });
    assert.ok(i >= 0 && i <= 6 && Number.isInteger(i), `Index ${i} bei Streak ${s}`);
  }
});

test('Treue-Bonus: +25 % je voller Woche, gedeckelt bei x3', () => {
  assert.strictEqual(dailyWeekMult(0), 1);
  assert.strictEqual(dailyWeekMult(6), 1, 'erst die VOLLE Woche zaehlt');
  assert.strictEqual(dailyWeekMult(7), 1.25);
  assert.strictEqual(dailyWeekMult(56), 3, 'nach acht Wochen am Deckel');
  assert.strictEqual(dailyWeekMult(5000), 3, 'und bleibt dort');
  assert.strictEqual(dailyWeekMult(null), 1);
  // Monoton: eine laengere Straehne darf nie weniger wert sein.
  let vor = 0;
  for (let s = 0; s <= 200; s++) {
    const m = dailyWeekMult(s);
    assert.ok(m >= vor, `Bonus faellt bei Streak ${s}`);
    vor = m;
  }
});

test('dailyReward liefert ganze Zahlen und traegt das Sondermerkmal weiter', () => {
  const tag7 = dailyReward({ streak: 6 });
  assert.strictEqual(tag7.special, 'chest');
  assert.strictEqual(tag7.gold, 50, 'Woche 1: kein Bonus');
  // Woche 2, Tag 7: Streak 13 → Index 6, Multiplikator 1.25
  const spaeter = dailyReward({ streak: 13 });
  assert.strictEqual(spaeter.gold, Math.round(50 * 1.25));
  for (let s = 0; s < 60; s++) {
    const r = dailyReward({ streak: s });
    assert.ok(Number.isInteger(r.gold), `krummes Gold bei Streak ${s}: ${r.gold}`);
    assert.ok(Number.isInteger(r.xp), `krumme XP bei Streak ${s}: ${r.xp}`);
    assert.ok(r.gold > 0);
  }
});

test('Aufgaben-Rotation ist deterministisch pro Tag und liefert drei verschiedene', () => {
  const a = rollDailyTasks('2026-09-17');
  const b = rollDailyTasks('2026-09-17');
  // Alle Spieler desselben Tages muessen dieselben Aufgaben sehen — sonst
  // waere jedes Gespraech darueber sinnlos.
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.length, 3);
  assert.strictEqual(new Set(a.map(x => x.id)).size, 3, 'doppelte Aufgabe');
  assert.notDeepStrictEqual(a, rollDailyTasks('2026-09-18'), 'anderer Tag, gleiche Aufgaben');
  for (const t of a) {
    assert.strictEqual(t.prog, 0);
    assert.strictEqual(t.collected, false);
    assert.ok(taskDef(t.id), `Aufgabe ${t.id} hat keine Definition`);
  }
});

test('Ueber ein Jahr hinweg bleibt die Rotation gesund', () => {
  // Ein einzelnes Datum zu pruefen faengt keinen Ausreisser. Hier laufen 365
  // Tage durch: immer drei, immer verschieden, immer definiert.
  const gesehen = new Map();
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    const t = rollDailyTasks(d);
    assert.strictEqual(t.length, 3, `nur ${t.length} Aufgaben am ${d}`);
    assert.strictEqual(new Set(t.map(x => x.id)).size, 3, `Dopplung am ${d}`);
    for (const x of t) gesehen.set(x.id, (gesehen.get(x.id) || 0) + 1);
  }
  // Jede Aufgabe des Vorrats muss im Jahr vorkommen — sonst gaebe es tote
  // Eintraege, die niemand je zu sehen bekommt.
  for (const def of DAILY_TASK_POOL) {
    assert.ok(gesehen.get(def.id) > 0, `Aufgabe ${def.id} kam in 365 Tagen nie vor`);
  }
});

test('Jede Aufgabe ist vollstaendig und nennt ein Icon, kein Emoji', () => {
  assert.ok(DAILY_TASK_POOL.length >= 6);
  const ids = new Set();
  for (const d of DAILY_TASK_POOL) {
    assert.ok(!ids.has(d.id), `doppelte id ${d.id}`); ids.add(d.id);
    assert.ok(d.target > 0 && d.gold > 0, `${d.id}: unbrauchbare Zahlen`);
    assert.ok(typeof d.stat === 'string' && d.stat.length, `${d.id}: kein Statistikfeld`);
    // Design-Regel des Projekts: Icons sind ICON_PATHS-Namen, keine Emojis.
    assert.match(d.icon, /^[a-zA-Z]+$/, `${d.id}: "${d.icon}" sieht nach Emoji aus`);
  }
});

test('todayStr und msTillMidnight sind plausibel', () => {
  assert.match(todayStr(), /^\d{4}-\d{2}-\d{2}$/);
  const ms = msTillMidnight();
  assert.ok(ms > 0 && ms <= 86400000, `unplausibel: ${ms}`);
});
