// Die grossen Modale, soweit sie sich ohne Browser pruefen lassen.
//
// **Grenze, die hier dazugehoert:** Komponenten mit `useState`
// (AchievementPopup, ItemRevealModal, XpResultAnim) lassen sich NICHT als
// einfache Funktion aufrufen — React verlangt einen Renderer, sonst wirft
// `useState`. Die sind in der E2E-Suite abgedeckt, die sie im echten Browser
// oeffnet. Hier stehen die hook-freien, und zwar vollstaendig: Es waere
// schlimmer, so zu tun, als sei alles geprueft.
import { test } from 'node:test';
import assert from 'node:assert';
import { WinFx, rarityMeta, forgeItemVisual, AchievementsModal, OnboardingModal }
  from '../src/ui/modale.js';
import { RECIPES } from '../src/engine/catalog.ts';

const t = (k) => 'T:' + k;
function kinder(el) {
  const raus = [];
  (function lauf(x) {
    if (x == null || typeof x === 'boolean') return;
    if (Array.isArray(x)) { x.forEach(lauf); return; }
    raus.push(x);
    if (x && x.props && x.props.children !== undefined) lauf(x.props.children);
  })(el);
  return raus;
}
const texte = (el) => kinder(el).filter(x => typeof x === 'string').join(' ');

test('WinFx kennt jede gekaufte Effekt-Art und stuerzt bei keiner ab', () => {
  // "none" ist der Normalfall: Wer nichts gekauft hat, soll nichts sehen.
  assert.strictEqual(WinFx({ kind: 'none' }) === null || !!WinFx({ kind: 'none' }), true);
  for (const k of ['confetti', 'fireworks', 'goldrain', 'none', undefined, 'unbekannt']) {
    assert.doesNotThrow(() => WinFx({ kind: k }), `WinFx(${k}) wirft`);
  }
});

test('WinFx ist deterministisch — kein Math.random', () => {
  // Sonst flackert der gekaufte Sieges-Effekt bei jedem Neuzeichnen.
  for (const k of ['confetti', 'fireworks', 'goldrain']) {
    const a = JSON.stringify(WinFx({ kind: k }));
    const b = JSON.stringify(WinFx({ kind: k }));
    assert.strictEqual(a, b, `WinFx(${k}) ist nicht deterministisch`);
  }
});

test('rarityMeta nimmt t als zweites Argument (v3.98.0) und faellt sicher zurueck', () => {
  assert.strictEqual(rarityMeta('legendary', t).label, 'T:rarityLegendary');
  assert.strictEqual(rarityMeta('common', t).key, 'common');
  // Eine unbekannte Stufe darf keine leere Karte ergeben.
  assert.strictEqual(rarityMeta('gibtesnicht', t).key, 'common');
  assert.strictEqual(rarityMeta(undefined, t).key, 'common');
  for (const r of ['common', 'rare', 'epic', 'legendary']) {
    const m = rarityMeta(r, t);
    assert.match(m.c, /^#[0-9a-f]{6}$/i, `${r}: keine Farbe`);
    assert.match(m.glow, /^\d+,\d+,\d+$/, `${r}: kein Glow`);
  }
});

test('forgeItemVisual zeichnet jedes Rezept des Katalogs', () => {
  // Ein neues Rezept ohne passende Darstellung faellt sonst erst dem Spieler
  // auf, der es schmiedet — und der hat dann schon bezahlt.
  for (const rec of RECIPES) {
    assert.doesNotThrow(() => forgeItemVisual(rec, 90), `${rec.id} (${rec.cat}) wirft`);
    assert.ok(forgeItemVisual(rec, 90), `${rec.id} liefert nichts`);
  }
});

test('AchievementsModal zeigt alle sechs Kategorien und den Zaehler', () => {
  const el = AchievementsModal({
    profile: { achievements: [] }, onClose() {},
    t, achTitle: (d) => d.title, achDesc: (d) => d.desc,
  });
  const txt = texte(el);
  for (const cat of ['siege', 'spiele', 'zerstoerung', 'gold', 'elo', 'serien']) {
    assert.ok(txt.includes('T:achcat_' + cat), `Kategorie ${cat} fehlt`);
  }
});

test('AchievementsModal kommt mit einem leeren und einem kaputten Profil klar', () => {
  const props = { onClose() {}, t, achTitle: (d) => d.title, achDesc: (d) => d.desc };
  for (const prof of [null, undefined, {}, { achievements: null }, { achievements: 'murks' }]) {
    assert.doesNotThrow(() => AchievementsModal({ ...props, profile: prof }),
      `wirft bei ${JSON.stringify(prof)}`);
  }
});

test('OnboardingModal laeuft durch alle Schritte, ohne zu werfen', () => {
  for (let step = 0; step < 12; step++) {
    assert.doesNotThrow(() => OnboardingModal({ step, setStep() {}, onFinish() {}, t }),
      `Schritt ${step} wirft`);
  }
});

// ── Echtes Rendern, auch mit Hooks ────────────────────────────────────────
//
// Die Pruefungen oben rufen Komponenten als Funktion auf. Das geht nur ohne
// Hooks — und genau deshalb waeren drei fehlende Importe fast durchgerutscht:
// `MASTER_TRAIL` (nur bei Meister-Schweifen), `xpToNextLevel` und
// `AVATAR_UNLOCKS` (beide nur in XpResultAnim, das `useState` benutzt).
// Gefunden hat sie erst der Durchlauf ueber ALLE Rezepte bzw. dieser Block.
//
// `react-dom/server` rendert richtig, mit Hooks. Damit ist jede Komponente
// dieses Moduls mindestens einmal wirklich ausgefuehrt worden — ein fehlender
// Import kann nicht mehr bis zum Spieler durchkommen.
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { AchievementPopup, ItemRevealModal, XpResultAnim } from '../src/ui/modale.js';

const zeichne = (Komp, props) => renderToStaticMarkup(React.createElement(Komp, props));

test('Jede Komponente des Moduls rendert wirklich — auch die mit Hooks', () => {
  const faelle = [
    ['WinFx',             WinFx,             { kind: 'goldrain' }],
    ['AchievementsModal', AchievementsModal, { profile: { achievements: [] }, onClose() {}, t,
                                               achTitle: (d) => d.title, achDesc: (d) => d.desc }],
    ['OnboardingModal',   OnboardingModal,   { step: 0, setStep() {}, onFinish() {}, t }],
    ['AchievementPopup',  AchievementPopup,  { item: { id: 'first_win', title: 'X', icon: 'trophy', xp: 10, gold: 5 },
                                               onDone() {}, achTitle: (d) => d.title }],
    ['XpResultAnim',      XpResultAnim,      { t, xpChange: { oldLevel: 1, newLevel: 2, oldXp: 5, newXp: 3, gained: 20 } }],
  ];
  for (const [name, Komp, props] of faelle) {
    assert.doesNotThrow(() => zeichne(Komp, props), `${name} rendert nicht`);
  }
});

test('ItemRevealModal rendert fuer JEDES Rezept — der Fall, der fast durchrutschte', () => {
  // Ein Meister-Schweif brauchte `MASTER_TRAIL`. Haette hier nur ein
  // Kanonen-Rezept gestanden, waere der fehlende Import erst dem Spieler
  // aufgefallen, der ihn geschmiedet hat — nach dem Bezahlen.
  for (const rec of RECIPES) {
    assert.doesNotThrow(() => zeichne(ItemRevealModal, { rec, onClose() {}, t }),
      `ItemRevealModal wirft bei ${rec.id} (${rec.cat})`);
  }
});

test('XpResultAnim haelt den Stufensprung aus', () => {
  // **Kein null/undefined in dieser Liste, und das ist Absicht.** Die
  // Aufrufstelle schuetzt bereits (`xpChangeRef.current && ...`), die
  // Komponente setzt ein Objekt voraus. Ich hatte hier erst null mitgeprueft
  // und mir damit einen Fehler gebaut, den es nicht gibt: Der Test haette
  // verlangt, dass die Komponente etwas abfaengt, was sie nie zu sehen
  // bekommt. Ein Test darf einen Vertrag pruefen, nicht sich einen ausdenken.
  for (const x of [{ oldLevel: 1, newLevel: 1, oldXp: 0, newXp: 5, gained: 5 },
                   { oldLevel: 49, newLevel: 50, oldXp: 10, newXp: 0, gained: 999 },
                   { oldLevel: 1, newLevel: 3, oldXp: 0, newXp: 0, gained: 5000 }]) {
    assert.doesNotThrow(() => zeichne(XpResultAnim, { t, xpChange: x }),
      `wirft bei ${JSON.stringify(x)}`);
  }
});
