// Ton und Musik beim Minimieren (v3.132.0).
//
// Anlass: Nach Minimieren und Rueckkehr hing der Ton, war nicht abzustellen
// oder lief doppelt. Ursache: Im Hintergrund steht der AudioContext still,
// Bot-/Host-Zeitgeber laufen aber weiter und planten Sounds ein — der Stau
// platzte bei der Rueckkehr auf einmal los. Dazu kam, dass die Musik beim
// Minimieren nie angehalten wurde und ein spaet aufgeloestes play() sie nach
// stop() wieder anwerfen konnte.
//
// Geprueft wird gegen Attrappen von AudioContext/Audio/document: Node hat
// weder noch, und das Verhalten haengt nur an den Aufrufen, nicht am Klang.
import { test } from 'node:test';
import assert from 'node:assert';

// ── Attrappen (VOR dem Import, audio.js haengt Ereignisse am Modul-Scope ein)
const ereignisse = { doc: {}, win: {} };
globalThis.document = {
  hidden: false,
  addEventListener(n, f) { (ereignisse.doc[n] = ereignisse.doc[n] || []).push(f); },
  createElement() { return new FakeAudio(); },
};
globalThis.window = {
  addEventListener(n, f) { (ereignisse.win[n] = ereignisse.win[n] || []).push(f); },
};
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', platform: 'test', maxTouchPoints: 0 }, configurable: true });

const quellen = [];
class FakeQuelle {
  constructor() { this.gestartet = false; this.gestoppt = false; this.buffer = null; this.onended = null; }
  connect(x) { return x; }
  disconnect() {}
  start() { this.gestartet = true; }
  stop() { this.gestoppt = true; }
}
class FakeContext {
  constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; this.suspendCalls = 0; this.resumeCalls = 0; }
  createBufferSource() { const q = new FakeQuelle(); quellen.push(q); return q; }
  createOscillator() { const q = new FakeQuelle(); q.frequency = { setValueAtTime() {}, exponentialRampToValueAtTime() {} }; quellen.push(q); return q; }
  createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(x) { return x; } }; }
  createBiquadFilter() { return { frequency: { setValueAtTime() {} }, connect(x) { return x; } }; }
  createBuffer(_k, len) { return { getChannelData: () => new Float32Array(len) }; }
  createMediaElementSource() { return { connect(x) { return x; } }; }
  suspend() { this.suspendCalls++; this.state = 'suspended'; return Promise.resolve(); }
  resume() { this.resumeCalls++; this.state = 'running'; return Promise.resolve(); }
}
let letztesAudio = null;
class FakeAudio {
  constructor() {
    this.paused = true; this.src = ''; this.volume = 1; this.playCalls = 0; this.pauseCalls = 0; this.loop = false;
    this.offene = [];
    letztesAudio = this;
  }
  setAttribute() {}
  // play() wird erst aufgeloest, wenn der Test es sagt — so laesst sich das
  // „spaet aufgeloeste play()" nachstellen.
  play() {
    this.playCalls++; this.paused = false;
    return new Promise((res) => { this.offene.push(res); });
  }
  pause() { this.pauseCalls++; this.paused = true; }
}
globalThis.Audio = FakeAudio;
globalThis.window.AudioContext = FakeContext;

const { SFX, MUSIC, hintergrund } = await import('../src/audio.js');

function sichtbar(ja) {
  document.hidden = !ja;
  for (const f of ereignisse.doc.visibilitychange || []) f();
}
function zuruecksetzen() {
  sichtbar(true);
  SFX.ctx = null; SFX.enabled = true; SFX._aktiv.clear(); SFX._bufs = {}; quellen.length = 0;
  MUSIC.el = null; MUSIC._gain = null; MUSIC.enabled = true; MUSIC.cur = null; MUSIC._ruht = false;
}

test('Die Lebenszyklus-Ereignisse sind angemeldet', () => {
  for (const n of ['visibilitychange', 'freeze', 'resume']) assert.ok((ereignisse.doc[n] || []).length, n);
  for (const n of ['pagehide', 'pageshow']) assert.ok((ereignisse.win[n] || []).length, n);
});

test('Im Hintergrund wird kein Sound eingeplant (kein Stau, der spaeter losplatzt)', () => {
  zuruecksetzen();
  SFX.resume();                 // Context entsteht
  SFX._bufs.place = {};
  sichtbar(false);
  quellen.length = 0;
  SFX.place(); SFX.shoot(); SFX.impact(); SFX.win();
  assert.strictEqual(quellen.length, 0, 'es wurden Quellen angelegt: ' + quellen.length);
});

test('Beim Minimieren werden laufende Sounds angehalten und der Context ruht', () => {
  zuruecksetzen();
  SFX.resume();
  SFX._bufs.place = {};
  SFX.place();
  assert.strictEqual(quellen.length, 1);
  assert.strictEqual(SFX._aktiv.size, 1);
  const ctx = SFX.ctx;
  sichtbar(false);
  assert.ok(quellen[0].gestoppt, 'laufende Quelle wurde nicht gestoppt');
  assert.strictEqual(SFX._aktiv.size, 0);
  assert.strictEqual(ctx.suspendCalls, 1);
});

test('Bei der Rueckkehr laeuft der Context wieder und Sounds gehen', () => {
  zuruecksetzen();
  SFX.resume();
  SFX._bufs.place = {};
  sichtbar(false);
  sichtbar(true);
  assert.strictEqual(SFX.ctx.state, 'running');
  quellen.length = 0;
  SFX.place();
  assert.strictEqual(quellen.length, 1);
});

test('Beendete Quellen bleiben nicht in der Liste haengen', () => {
  zuruecksetzen();
  SFX.resume();
  SFX._bufs.place = {};
  SFX.place();
  assert.strictEqual(SFX._aktiv.size, 1);
  quellen[0].onended();
  assert.strictEqual(SFX._aktiv.size, 0);
});

test('Musik: pausiert im Hintergrund, setzt bei der Rueckkehr fort', () => {
  zuruecksetzen();
  MUSIC.play('menu');
  const el = MUSIC.el;
  assert.strictEqual(el.paused, false);
  sichtbar(false);
  assert.strictEqual(el.paused, true, 'Musik lief im Hintergrund weiter');
  sichtbar(true);
  assert.strictEqual(el.paused, false, 'Musik kam nicht zurueck');
});

test('Musik: Spurwechsel im Hintergrund startet nichts, die Rueckkehr nimmt die neue Spur', () => {
  zuruecksetzen();
  MUSIC.play('menu');
  const el = MUSIC.el;
  sichtbar(false);
  const spiele = el.playCalls;
  MUSIC.play('w_crystal');
  assert.strictEqual(el.playCalls, spiele, 'im Hintergrund wurde play() gerufen');
  assert.strictEqual(el.paused, true);
  sichtbar(true);
  assert.ok(el.src.endsWith('music/w_crystal.mp3'), 'falsche Spur: ' + el.src);
  assert.strictEqual(el.paused, false);
});

test('Musik: ausgeschaltet bleibt sie auch nach der Rueckkehr aus', () => {
  zuruecksetzen();
  MUSIC.play('menu');
  MUSIC.setEnabled(false);
  const el = MUSIC.el;
  sichtbar(false); sichtbar(true);
  assert.strictEqual(el.paused, true);
});

test('Musik: ein spaet aufgeloestes play() startet sie nach stop() nicht neu', async () => {
  zuruecksetzen();
  MUSIC.play('menu');
  const el = MUSIC.el;
  MUSIC.setEnabled(false);          // pausiert
  el.paused = false;                 // Browser meldet das fertige play() zurueck
  for (const res of el.offene) res();
  await new Promise((r) => setTimeout(r, 0));
  assert.strictEqual(el.paused, true, 'Musik lief nach dem Ausschalten wieder an');
});

test('Musik: stop() setzt den Gain auf 0 (haengendes Element bleibt still)', () => {
  zuruecksetzen();
  MUSIC.play('menu');
  MUSIC._gain = { gain: { value: 0.7 } };
  MUSIC.stop();
  assert.strictEqual(MUSIC._gain.gain.value, 0);
});

test('Mehrfaches Melden schadet nicht (pagehide + visibilitychange + freeze)', () => {
  zuruecksetzen();
  MUSIC.play('menu');
  const el = MUSIC.el;
  hintergrund(true); hintergrund(true); hintergrund(true);
  assert.strictEqual(el.paused, true);
  hintergrund(false); hintergrund(false);
  assert.strictEqual(el.paused, false);
  assert.strictEqual(el.playCalls >= 2, true);
});
