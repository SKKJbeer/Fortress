// Die kleinen Anzeige-Komponenten, festgehalten.
//
// Sie sind in v3.96.0 aus dem Grossblock herausgeloest worden. Der Umzug war
// mechanisch — bis auf `MatRow`, das `t()` nicht mehr aus dem Abschluss zieht,
// sondern als Requisite bekommt. Genau diese eine Aenderung braucht eine
// Pruefung, sonst ist sie eine Behauptung.
//
// Geprueft wird die Struktur des React-Elements, nicht sein Aussehen: Was
// gerendert AUSSIEHT, prueft die E2E-Suite am echten Bildschirm.
import { test } from 'node:test';
import assert from 'node:assert';
import { LevelBadge, ConfettiBurst, WappenAvatar, XpBarUI, MatPip, MatRow }
  from '../src/ui/anzeigen.js';

// Kinder eines React-Elements flach einsammeln
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
const titel = (el) => kinder(el).map(x => x && x.props && x.props.title).filter(Boolean);

test('LevelBadge zeigt die Stufe an', () => {
  assert.strictEqual(kinder(LevelBadge({ level: 7 })).includes('L7'), true);
  assert.strictEqual(kinder(LevelBadge({ level: 42, size: 'lg' })).includes('L42'), true);
});

test('ConfettiBurst rendert nur wenn aktiv, und deterministisch', () => {
  assert.strictEqual(ConfettiBurst({ active: false }), null);
  const a = ConfettiBurst({ active: true });
  const b = ConfettiBurst({ active: true });
  assert.ok(a);
  // Keine Math.random: zwei Aufrufe muessen dasselbe ergeben. Sonst flackert
  // der Effekt bei jedem Neuzeichnen.
  assert.strictEqual(JSON.stringify(a.props.children.map(x => x.props.style)),
                     JSON.stringify(b.props.children.map(x => x.props.style)));
  assert.strictEqual(a.props.children.length, 20);
});

test('WappenAvatar faellt auf einen vorhandenen Avatar zurueck', () => {
  const gut = WappenAvatar({ id: 'skelett' });
  const murks = WappenAvatar({ id: 'gibtesnicht' });
  assert.ok(gut.props.src.startsWith('data:image/'));
  // Ein unbekannter Schluessel darf kein leeres Bild ergeben — alte Profile
  // tragen alte Schluessel.
  assert.ok(murks.props.src.startsWith('data:image/'));
  assert.strictEqual(WappenAvatar({ id: 'skelett', size: 64 }).props.width, 64);
});

test('XpBarUI deckelt den Balken bei 100 Prozent', () => {
  const viel = XpBarUI({ level: 1, xp: 999999 });
  const breite = kinder(viel).map(x => x && x.props && x.props.style && x.props.style.width)
                             .filter(w => typeof w === 'string' && w.endsWith('%'));
  assert.ok(breite.length, 'kein Balken gefunden');
  for (const w of breite) assert.ok(parseFloat(w) <= 100, `Balken laeuft ueber: ${w}`);
});

test('MatRow nimmt t als Requisite (v3.96.0) und setzt den Titel', () => {
  // Ohne `nurPositive` stehen ALLE Materialsorten in der Zeile, die leeren
  // gedimmt — so sieht man auch, welche Sorten es ueberhaupt gibt. Jede
  // bekommt ihren uebersetzten Titel.
  const el = MatRow({ vals: { iron: 3 }, t: (k) => 'UEBERSETZT:' + k });
  const ts = titel(el);
  assert.ok(ts.includes('UEBERSETZT:mat_iron'));
  assert.ok(ts.length >= 4, `nur ${ts.length} Sorten in der Zeile`);
  assert.ok(ts.every(x => x.startsWith('UEBERSETZT:mat_')));
});

test('MatRow ohne t laesst den Titel weg, statt den rohen Schluessel zu zeigen', () => {
  // Ein stiller Rueckfall auf "mat_iron" saehe aus wie eine Uebersetzung.
  // Lieber gar kein Titel als ein falscher.
  const el = MatRow({ vals: { iron: 3 } });
  assert.deepStrictEqual(titel(el), []);
  assert.ok(el, 'darf trotzdem rendern');
});

test('MatRow: nurPositive blendet Nullwerte aus, sonst bleiben sie stehen', () => {
  const alle = MatRow({ vals: { iron: 0, silver: 2 }, t: (k) => k });
  const nurPos = MatRow({ vals: { iron: 0, silver: 2 }, nurPositive: true, t: (k) => k });
  assert.ok(alle.props.children.length > nurPos.props.children.length);
  assert.strictEqual(nurPos.props.children.length, 1);
  assert.strictEqual(MatRow({ vals: {}, nurPositive: true, t: (k) => k }), null);
});

test('MatPip traegt die Materialfarbe', () => {
  const el = MatPip({ k: 'iron' });
  assert.match(el.props.style.background, /^#[0-9a-f]{3,8}$/i);
  assert.strictEqual(MatPip({ k: 'iron', size: 14 }).props.style.width, 14);
});
