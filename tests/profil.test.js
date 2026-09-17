// Profil-Normalisierung: die Funktion, die entscheidet, ob Fortschritt
// ein Neuladen ueberlebt.
//
// Im Code stand seit v3.26.1 dieser Satz: „loadProfile baut das Profil aus
// dieser Whitelist neu auf; fehlt ein Feld, wird es beim naechsten Speichern
// endgueltig geloescht (so gingen Kaeufe verloren)." Ein Kommentar, der eine
// Gefahr beschreibt und niemanden aufhaelt. Diese Pruefungen halten auf.
import { test } from 'node:test';
import assert from 'node:assert';
import { normalisiereProfil, PROFIL_FELDER } from '../src/engine/profil.ts';
import { WAPPEN_MIGRATION, WAPPEN_SRC } from '../src/ui/wappen.js';

const wappen = { migration: WAPPEN_MIGRATION, vorhanden: WAPPEN_SRC };
const lauf = (p) => normalisiereProfil(p, wappen);

// Ein Profil, in dem ALLES steht, was ein Spieler ansammeln kann.
const voll = {
  id: 'p_test', name: 'Testspieler', wappen: 'skelett', color: '#123456',
  elo: 1234, elo3: 1111, peakElo: 1300, peakElo3: 1200,
  stats: { wins: 9, losses: 4, games: 13 }, stats3: { wins: 2, losses: 1, games: 3 },
  gold: 777, level: 12, xp: 345, seasonXp: 99,
  unlockedRewards: ['r1', 'r2'], achievements: [{ id: 'first_win', unlocked: true }],
  dailyTasks: [{ id: 'walls30', prog: 5, collected: false }],
  historicalXpApplied: true, achievementsRetroApplied: true,
  winStreak: 3, blocksDestroyed: 4242, lifetimeGold: 5000,
  cosmetics: { owned: ['trail_ember', 'cannon_crystal'], equipped: { trail: 'trail_ember', cannon: 'cannon_crystal' } },
  materials: { iron: 50, silver: 12, dragon: 3, star: 1 },
};

test('Ein volles Profil kommt vollstaendig wieder heraus', () => {
  const { profil } = lauf(voll);
  for (const feld of PROFIL_FELDER) {
    assert.ok(feld in profil, `Feld "${feld}" fehlt im Ergebnis`);
  }
});

test('Gekaufte Gegenstaende ueberleben — genau der Fehler von v3.26.1', () => {
  const { profil } = lauf(voll);
  assert.deepStrictEqual(profil.cosmetics.owned, ['trail_ember', 'cannon_crystal']);
  assert.deepStrictEqual(profil.cosmetics.equipped,
    { trail: 'trail_ember', cannon: 'cannon_crystal' });
});

test('Schmiede-Material ueberlebt — derselbe Fehler, v3.33.0', () => {
  const { profil } = lauf(voll);
  assert.strictEqual(profil.materials.iron, 50);
  assert.strictEqual(profil.materials.silver, 12);
  assert.strictEqual(profil.materials.dragon, 3);
  assert.strictEqual(profil.materials.star, 1);
});

test('Zahlen und Zaehler kommen unveraendert durch', () => {
  const { profil } = lauf(voll);
  for (const [feld, wert] of Object.entries({
    id: 'p_test', name: 'Testspieler', color: '#123456',
    elo: 1234, elo3: 1111, peakElo: 1300, peakElo3: 1200,
    gold: 777, level: 12, xp: 345, seasonXp: 99,
    winStreak: 3, blocksDestroyed: 4242, lifetimeGold: 5000,
  })) {
    assert.strictEqual(profil[feld], wert, `${feld} veraendert`);
  }
  assert.deepStrictEqual(profil.stats, { wins: 9, losses: 4, games: 13 });
  assert.deepStrictEqual(profil.stats3, { wins: 2, losses: 1, games: 3 });
  assert.deepStrictEqual(profil.unlockedRewards, ['r1', 'r2']);
});

test('Zweimal durchlaufen aendert nichts mehr', () => {
  // Beim Laden wird normalisiert und ggf. zurueckgeschrieben. Waere der zweite
  // Durchlauf anders, wuerde das Profil bei jedem Start driften.
  const a = lauf(voll).profil;
  const b = lauf(a).profil;
  assert.deepStrictEqual(b, a);
  assert.strictEqual(lauf(a).mussSpeichern, false, 'zweiter Lauf will erneut speichern');
});

test('Ein leeres Profil bekommt brauchbare Startwerte', () => {
  const { profil, mussSpeichern } = lauf({});
  assert.ok(profil.id.startsWith('p_'), 'keine Kennung vergeben');
  assert.strictEqual(mussSpeichern, true, 'neue Kennung muss gespeichert werden');
  assert.strictEqual(profil.elo, 1000);
  assert.strictEqual(profil.wappen, 'skelett');
  assert.deepStrictEqual(profil.cosmetics.owned, []);
  assert.deepStrictEqual(profil.stats, { wins: 0, losses: 0, games: 0 });
});

test('Der Startbonus aus „1000 ELO" — kein Fehler, sondern Absicht der Zahlen', () => {
  // Ein frisches Profil hat am Ende 125 Gold, nicht 100. Grund: Der
  // rueckwirkende Achievement-Durchlauf schaltet `elo_1000` („Erreiche 1000
  // ELO") sofort frei, weil JEDES Profil bei genau 1000 startet — Ziel und
  // Startwert sind dieselbe Zahl.
  //
  // Das ist seit Langem so und steht bereits auf den Konten aller Spieler. Es
  // hier „geradezuziehen" hiesse, ihnen etwas wegzunehmen. Die Pruefung haelt
  // deshalb den IST-Zustand fest — samt Grund, damit der naechste Leser nicht
  // denkt, er habe einen Fehler gefunden.
  const { profil } = lauf({});
  assert.strictEqual(profil.gold, 125, 'Startgold 100 + 25 aus elo_1000');
  assert.ok(profil.achievements.some(a => a.id === 'elo_1000' && a.unlocked),
    'elo_1000 sollte beim ersten Laden freigeschaltet sein');
});

test('Kaputte Eingaben ergeben kein kaputtes Profil', () => {
  assert.strictEqual(lauf(null), null);
  assert.strictEqual(lauf(undefined), null);
  assert.strictEqual(lauf('murks'), null);
  for (const murks of [
    { stats: 'kaputt', achievements: 'kaputt', cosmetics: 'kaputt', materials: 'kaputt' },
    { elo: 'viel', gold: null, level: [], xp: {} },
    { cosmetics: { owned: 'nein', equipped: 42 } },
  ]) {
    const { profil } = lauf(murks);
    assert.ok(Array.isArray(profil.achievements));
    assert.ok(Array.isArray(profil.cosmetics.owned));
    assert.strictEqual(typeof profil.gold, 'number');
    assert.strictEqual(typeof profil.elo, 'number');
    assert.ok(Number.isFinite(profil.elo));
  }
});

test('Alte Avatar-Schluessel werden umgezogen, nicht verworfen', () => {
  // Wer lange nicht gespielt hat, traegt einen alten Schluessel. Ein „skelett"
  // als Rueckfall waere hier falsch: Der Avatar heisst jetzt anders, ist aber da.
  for (const [alt, neu] of Object.entries(WAPPEN_MIGRATION)) {
    assert.strictEqual(lauf({ wappen: alt }).profil.wappen, neu, `${alt} nicht umgezogen`);
  }
  assert.strictEqual(lauf({ wappen: 'gibtesnicht' }).profil.wappen, 'skelett');
  assert.strictEqual(lauf({ wappen: 'phoenix' }).profil.wappen, 'phoenix');
});

test('Alte Profile ohne Level bekommen ihre Spielzeit rueckwirkend gutgeschrieben', () => {
  const alt = { id: 'p_alt', level: 1, xp: 0, stats: { wins: 10, losses: 5, games: 15 } };
  const { profil, mussSpeichern } = lauf(alt);
  assert.ok(profil.level > 1, `blieb auf Stufe ${profil.level}`);
  assert.strictEqual(profil.historicalXpApplied, true);
  assert.strictEqual(mussSpeichern, true);
  // Und nur EINMAL: ein zweiter Lauf darf nicht noch einmal gutschreiben.
  assert.strictEqual(lauf(profil).profil.level, profil.level);
});
