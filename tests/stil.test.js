// Designsystem (v3.121.0): src/ui/stil.js und seine Verwendung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as STIL from '../src/ui/stil.js';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (p) => fs.readFileSync(path.join(W, p), 'utf8');
const NUTZER = ['src/game/app.js', 'src/ui/modale.js', 'src/ui/anzeigen.js'];

test('keine lokale Variable ueberdeckt einen Baustein aus stil.js', () => {
  // Echter Fehler beim Umbau: Die Tutorial-Einfuehrung hatte ein lokales
  // `const panel = (…)`; der umgestellte Kasten rief damit die FALSCHE
  // Funktion auf, und die Einfuehrung erschien nicht mehr.
  for (const datei of NUTZER) {
    const s = lies(datei);
    const imp = s.match(/import \{([^}]+)\} from '\.\.?\/(?:ui\/)?stil\.js';/);
    if (!imp) continue;
    for (const name of imp[1].split(',').map((x) => x.trim()).filter(Boolean)) {
      const schatten = new RegExp(`(?:const|let|var|function)\\s+${name}\\b`).exec(s);
      assert.equal(schatten, null, `${datei}: lokales „${name}" ueberdeckt den Baustein aus stil.js`);
    }
  }
});

test('Bausteine liefern den Comic-Stil (Kontur, Titelschrift)', () => {
  const k = STIL.knopf('gold');
  assert.match(k.border, /3px solid #1b0f06/);
  assert.equal(k.fontFamily, STIL.SCHRIFT_TITEL);
  for (const v of STIL.VARIANTEN) assert.ok(STIL.knopf(v).background.includes('linear-gradient'), v);
  assert.match(STIL.panel().border, /4px solid/);
  assert.equal(STIL.schalter(false).background, STIL.knopf('grau').background, 'aus = grau');
});

test('Schriften, Logo und Menue-Bild sind eingebunden und offline vorgeladen', () => {
  const html = lies('index.html');
  assert.match(html, /@font-face\{font-family:'Lilita One';src:url\(fonts\/lilita-one\.woff2\)/);
  assert.match(html, /@font-face\{font-family:'Nunito';src:url\(fonts\/nunito\.woff2\)/);
  for (const f of ['public/fonts/lilita-one.woff2', 'public/fonts/nunito.woff2', 'public/fonts/OFL-lilita-one.txt', 'public/fonts/OFL-nunito.txt', 'public/logo.png', 'public/menu-hintergrund.jpg'])
    assert.ok(fs.existsSync(path.join(W, f)), f + ' fehlt');
  assert.match(lies('vite.config.js'), /globPatterns: \['[^']*\bwoff2\b/, 'Schriften muessen offline da sein');
  const app = lies('src/game/app.js');
  assert.match(app, /bildHintergrund\("menu-hintergrund\.jpg"\)/);
  assert.match(app, /src: "logo\.png", alt: "Stack & Siege"/);
});

// Lesbarkeit (v3.128.0): Diese Grautoene stammen aus der Zeit vor dem
// Designsystem. Als Schriftfarbe auf dem Comic-Blau lagen sie bei 1,2–3,8:1 —
// Hinweiszeilen in Gegnersuche und Warteraum waren praktisch unsichtbar.
// Schriftfarben kommen aus FARBE (text, textGedaempft) oder sind hell genug.
test('Keine alten, unlesbaren Grautoene als Schriftfarbe', () => {
  const verboten = ['#334155', '#475569', '#64748b'];
  for (const datei of ['src/game/app.js', 'src/ui/modale.js', 'src/ui/anzeigen.js', 'src/ui/blaettern.js']) {
    const roh = fs.readFileSync(path.join(W, datei), 'utf8');
    for (const f of verboten) {
      const treffer = roh.match(new RegExp('(?<![a-zA-Z])color: [^,}]*"' + f + '"', 'g')) || [];
      assert.deepStrictEqual(treffer, [], `${datei}: Schriftfarbe ${f} (${treffer.length}×)`);
    }
  }
});

// Jedes verwendete Symbol muss es geben (v3.129.0). Ein unbekannter Name
// zeichnet NICHTS — der „Teilen"-Knopf stand lange ohne Symbol da
// („share2", „check" fehlten), und niemand hat es bemerkt.
test('Jeder Icon-Name im Spielcode existiert in ICON_PATHS', async () => {
  const { ICON_PATHS } = await import('../src/ui/icons.js');
  const da = new Set(Object.keys(ICON_PATHS));
  const fehlend = [];
  for (const datei of ['src/game/app.js', 'src/ui/modale.js', 'src/ui/anzeigen.js', 'src/ui/blaettern.js']) {
    const roh = fs.readFileSync(path.join(W, datei), 'utf8');
    for (const m of roh.matchAll(/Icon, \{ name: ([^,}]+)/g))
      for (const q of m[1].matchAll(/"([a-zA-Z0-9]+)"/g))
        if (!da.has(q[1])) fehlend.push(`${datei}: ${q[1]}`);
  }
  assert.deepStrictEqual(fehlend, []);
});

// Schaerfe (v3.129.0): Sprites haben SK-fache Pixel, das Spielfeld rendert mit
// Faktor K. Ein `drawImage(bild, x, y)` OHNE Zielgroesse zeichnet ein Sprite
// dann SK-fach zu gross bzw. ein Hintergrund-Canvas K-fach — still, ohne
// Fehler. Verlangt wird daher die Zielgroesse (5 oder 9 Argumente).
test('drawImage im Spielfeld immer mit Zielgroesse', () => {
  const fehler = [];
  for (const datei of ['src/game/app.js', 'src/render/sprites.js']) {
    const roh = fs.readFileSync(path.join(W, datei), 'utf8');
    let i = 0;
    while ((i = roh.indexOf('drawImage(', i)) !== -1) {
      const zeileEnde = roh.indexOf('\n', i);
      const zeileAnfang = roh.lastIndexOf('\n', i) + 1;
      if (roh.slice(i, zeileEnde).includes('// Pixelraum') || roh.slice(zeileAnfang, i).includes('//')) { i += 10; continue; }
      let t = 0, k = i + 'drawImage('.length, args = 1, q = null;
      for (; k < roh.length; k++) {
        const c = roh[k];
        if (q) { if (c === q && roh[k - 1] !== '\\') q = null; continue; }
        if (c === '"' || c === "'" || c === '`') q = c;
        else if (c === '(' || c === '[' || c === '{') t++;
        else if (c === ')' || c === ']' || c === '}') { if (t === 0) break; t--; }
        else if (c === ',' && t === 0) args++;
      }
      if (args !== 5 && args !== 9) fehler.push(`${datei}:${roh.slice(0, i).split('\n').length} (${args} Argumente)`);
      i = k;
    }
  }
  assert.deepStrictEqual(fehler, []);
});

// ── Scharfe Schrift (v3.131.0) ──────────────────────────────────────────
// Gemeldet: „Schrift teilweise unscharf auf Hintergruenden". Drei Ursachen,
// je eine Regel: zu dicke feste Kontur auf kleiner Schrift (Innenraeume
// liefen zu), weiche Leuchtschatten statt Kontur, und Text, der endlos
// skaliert (auf iOS wird die Ebene vergroessert statt neu gesetzt).
const ALLE = [...NUTZER, 'src/ui/blaettern.js'];

test('KONTURTEXT waechst mit der Schrift und hat keine Unschaerfe', () => {
  const teile = STIL.KONTURTEXT.split(/,(?![^(]*\))/);
  assert.ok(teile.length >= 8, `rund in acht Richtungen, nicht ${teile.length}`);
  assert.match(STIL.KONTURTEXT, /em/, 'Breite in em — fest 1,5 px fuellt bei 12 px die Buchstaben zu');
  for (const t of teile) {
    const ohneFarbe = t.replace(/#[0-9a-f]{3,8}/i, '').trim();
    assert.match(ohneFarbe, /\s0$/, `kein Weichzeichner in „${t.trim()}"`);
  }
});

test('Kein weicher Textschatten ohne scharfe Kontur davor', () => {
  // Ein Leuchten HINTER der Kontur ist erlaubt (Seltenheit, Level-Up) —
  // allein laesst es die Buchstaben verschwimmen.
  const blur = /(?:^|[\s"'`,(])-?[\d.]+(?:px)?\s+-?[\d.]+(?:px)?\s+([\d.]*[1-9][\d.]*)px/;
  const fehler = [];
  for (const datei of ALLE) {
    const s = lies(datei);
    for (const m of s.matchAll(/textShadow:\s*([^\n]*?)(?=,\s*[A-Za-z]+\s*:|\s*\}|$)/gm)) {
      if (blur.test(m[1]) && !/KONTURTEXT|titel\(/.test(m[1])) fehler.push(`${datei}: ${m[1].slice(0, 70)}`);
    }
  }
  const html = lies('index.html');
  for (const m of html.matchAll(/(?<![-\w])text-shadow:([^;}]*)/g)) {
    if (blur.test(' ' + m[1]) && !/@keyframes/.test(m[0])) fehler.push(`index.html: ${m[1].slice(0, 70)}`);
  }
  assert.deepEqual(fehler, []);
});

test('Keine Schrift unter 11 px', () => {
  const fehler = [];
  for (const datei of ALLE) {
    for (const m of lies(datei).matchAll(/fontSize:\s*(\d+(?:\.\d+)?)\s*[,}]/g)) {
      if (Number(m[1]) < 11) fehler.push(`${datei}: fontSize ${m[1]}`);
    }
  }
  assert.deepEqual(fehler, []);
});

test('Endlos-Animationen skalieren nichts', () => {
  // closePulse vergroesserte die Schliessen-Warnung um 22 % — sie ragte in
  // den Nachbarn und war auf iOS dauerhaft weich. Erlaubt nur fuer reine
  // Lichtkreise ohne Text.
  const OHNE_TEXT = new Set(['revealHalo']);
  const html = lies('index.html');
  const namen = new Set();
  for (const datei of ALLE) for (const m of lies(datei).matchAll(/animation:\s*["'`]([A-Za-z]+)[^"'`]*infinite/g)) namen.add(m[1]);
  assert.ok(namen.size >= 4, 'Endlos-Animationen gefunden: ' + [...namen]);
  for (const n of namen) {
    const kf = html.match(new RegExp(`@keyframes ${n}\\{(.*?\\})\\}`));
    assert.ok(kf, `@keyframes ${n} fehlt in index.html`);
    if (!OHNE_TEXT.has(n)) assert.doesNotMatch(kf[1], /scale\(/, `${n} skaliert endlos`);
  }
});

// Fenster und Seiten (24.10.2026). Auf dem iPhone ragte die Schmiede von y=35 bis 842 (Statusleiste
// 59, Home-Anzeige 34 px) und die Seitensteuerung lag auf „Verstanden": `maxHeight: calc(100dvh - 32px)`
// zog das Panel an den Bildschirmrand, und die Zeilenzahl war nur geschaetzt.
test('Fenster mit Seiten: maxHeight 100% im Schleier mit Sicherheitsbereichen, Seiten passt sich an', () => {
  const app = fs.readFileSync(new URL('../src/game/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /calc\(100dvh - 32px\)/, 'maxHeight 100dvh-32px zieht Fenster unter Statusleiste/Home-Anzeige');
  assert.match(app, /fensterRand\(16\)/);
  const stil = fs.readFileSync(new URL('../src/ui/stil.js', import.meta.url), 'utf8');
  assert.match(stil, /export function fensterRand\(rand = 14\)[\s\S]*?var\(--sa-top,0px\)[\s\S]*?var\(--sa-bottom,0px\)/);
  const bl = fs.readFileSync(new URL('../src/ui/blaettern.js', import.meta.url), 'utf8');
  assert.match(bl, /useLayoutEffect\(\(\) => \{[\s\S]*?scrollHeight > fenster\.clientHeight \+ 1[\s\S]*?setFit\(/, 'Seiten misst und schrumpft');
  assert.match(bl, /marginTop: 10, marginBottom: 8/, 'Abstand der Seitensteuerung zum folgenden Knopf');
});

