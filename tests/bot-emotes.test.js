// Bot-Stufen und Emote-Liste.
//
// Zwei Datensaetze, die bis v3.101.0 im Spielcode standen und deren Aenderung
// jeweils etwas kaputtmacht, das man nicht sofort sieht.
import { test } from 'node:test';
import assert from 'node:assert';
import { BOT_LEVELS, BOT_NAMES, BOT_WAPPEN } from '../src/engine/bot.ts';
import { EMOTES, PROTO_VERSION } from '../src/net/protocol.js';
import { WAPPEN_SRC, WAPPEN_MIGRATION } from '../src/ui/wappen.js';

test('Die Emote-Liste ist ein Protokoll-Vertrag: Reihenfolge und Laenge stehen fest', () => {
  // Uebertragen wird der INDEX. Wer hier umsortiert oder kuerzt, sorgt dafuer,
  // dass ein alter und ein neuer Client verschiedene Emojis zeigen — ohne
  // Fehlermeldung, denn ein unbekannter Index faellt still zurueck.
  // Diese Pruefung ist bewusst stur. Wird sie rot, ist das kein Testfehler,
  // sondern die Frage: Habt ihr PROTO_VERSION erhoeht?
  assert.deepStrictEqual(EMOTES, ['\u{1F44D}', '\u{1F604}', '\u{1F62E}', '\u{1F621}', '\u{1F3F0}', '\u{1F4A5}']);
  assert.strictEqual(EMOTES.length, 6);
  assert.strictEqual(new Set(EMOTES).size, 6, 'doppeltes Emote — zwei Indizes, ein Bild');
  assert.strictEqual(typeof PROTO_VERSION, 'number');
});

test('Jeder gueltige Emote-Index trifft, jeder ungueltige faellt sichtbar durch', () => {
  for (let i = 0; i < EMOTES.length; i++) assert.ok(EMOTES[i], `Index ${i} leer`);
  // Der Rueckfall im Spielcode ist `EMOTES[e] || "👍"` — also zeigt ein
  // ungueltiger Index das ERSTE Emote. Das ist hier festgehalten, damit
  // niemand annimmt, es passiere nichts.
  assert.strictEqual(EMOTES[99], undefined);
  assert.strictEqual(EMOTES[-1], undefined);
});

test('Die drei Bot-Stufen sind wirklich unterschiedlich', () => {
  const stufen = ['easy', 'mid', 'hard'];
  for (const s of stufen) assert.ok(BOT_LEVELS[s], `Stufe ${s} fehlt`);
  // Wer „leicht" waehlt, soll den Unterschied SEHEN. Ein Bot, dessen Stufen
  // sich kaum unterscheiden, macht die Auswahl zur Zierde.
  assert.ok(BOT_LEVELS.easy.spread > BOT_LEVELS.mid.spread, 'easy zielt nicht schlechter');
  assert.ok(BOT_LEVELS.mid.spread > BOT_LEVELS.hard.spread, 'hard zielt nicht besser');
  assert.ok(BOT_LEVELS.easy.spread >= BOT_LEVELS.hard.spread * 3, 'Abstand easy↔hard zu klein');
  assert.ok(BOT_LEVELS.easy.maxCannons < BOT_LEVELS.mid.maxCannons);
  assert.ok(BOT_LEVELS.mid.maxCannons < BOT_LEVELS.hard.maxCannons);
  assert.ok(BOT_LEVELS.easy.fire > BOT_LEVELS.hard.fire, 'easy schiesst nicht seltener');
});

test('Jede Bot-Stufe hat brauchbare Werte', () => {
  for (const [name, s] of Object.entries(BOT_LEVELS)) {
    assert.ok(s.spread > 0, `${name}: Streuung 0 waere uebermenschlich`);
    assert.ok(s.fire > 0, `${name}: Feuer-Faktor 0`);
    assert.ok(Number.isInteger(s.maxCannons) && s.maxCannons >= 1, `${name}: maxCannons`);
    assert.ok(['basic', 'standard', 'optimal'].includes(s.buy), `${name}: unbekannte Einkaufsart "${s.buy}"`);
  }
});

test('Bot-Namen: genug, verschieden, und keiner leer', () => {
  assert.ok(BOT_NAMES.length >= 40, `nur ${BOT_NAMES.length} Namen — zu oft derselbe Gegner`);
  assert.strictEqual(new Set(BOT_NAMES).size, BOT_NAMES.length, 'doppelter Name');
  for (const n of BOT_NAMES) {
    assert.ok(typeof n === 'string' && n.trim().length > 2, `unbrauchbarer Name: "${n}"`);
    assert.ok(n.length <= 40, `zu lang fuers HUD: "${n}"`);
  }
});

test('Bot-Wappen zeigen auf Avatare, die es gibt', () => {
  // Alte Schluessel sind erlaubt — die Migration faengt sie ab. Ins Leere
  // zeigen darf keiner, sonst hat der Bot kein Bild.
  for (const w of BOT_WAPPEN) {
    const ziel = WAPPEN_MIGRATION[w] || w;
    assert.ok(WAPPEN_SRC[ziel], `Bot-Wappen "${w}" → "${ziel}" hat kein Bild`);
  }
});
