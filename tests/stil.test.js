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
