// App-Symbol aus EINER gemalten Vorlage (v3.119.0) und der Skill dazu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (p) => fs.readFileSync(path.join(W, p));
// PNG-Kopf: Breite/Hoehe ab Byte 16, Farbtyp an Byte 25 (2=RGB, 6=RGBA)
const kopf = (p) => { const b = lies(p); assert.equal(b.toString('latin1', 1, 4), 'PNG', `${p} ist kein PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), typ: b[25] }; };

test('jedes Symbol im Manifest existiert in der angegebenen Groesse', () => {
  const m = JSON.parse(lies('public/manifest.json'));
  assert.ok(m.icons.length >= 5);
  for (const i of m.icons) {
    const [w, h] = i.sizes.split('x').map(Number); const k = kopf(path.join('public', i.src));
    assert.deepEqual([k.w, k.h], [w, h], `${i.src}: Manifest sagt ${i.sizes}`);
  }
});

test('iOS-Symbol: 1024, OHNE Alphakanal; maskable vollflaechig', () => {
  const k = kopf('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  assert.deepEqual([k.w, k.h, k.typ], [1024, 1024, 2]);
  for (const s of [192, 512]) assert.equal(kopf(`public/icon-maskable-${s}.png`).typ, 2, 'maskable darf keine Transparenz haben');
});

test('Vorlage und Herkunft liegen bei: Seed, Modell, Prompt', () => {
  const k = kopf('assets/symbol/vorlage-1024.png'); assert.deepEqual([k.w, k.h], [1024, 1024]);
  const e = lies('assets/symbol/ENTSTEHUNG.md').toString();
  assert.match(e, /\| Seed \| \*\*\d+\*\* \|/);
  assert.match(e, /FLUX\.1-schnell/);
  assert.match(e, /```\nmobile strategy game app icon artwork[^`]+no text, no letters\n```/);
});

test('altes Zeichenwerkzeug ueberschreibt die Symbole nicht mehr', () => {
  assert.match(lies('tools/make-icons.cjs').toString(), /^const JOBS = \[\];$/m);
});

test('Skill spielgrafik: Kopf, Lizenzregel und alle genannten Skripte', () => {
  const d = '.claude/skills/spielgrafik';
  const s = lies(`${d}/SKILL.md`).toString();
  assert.match(s, /^---\nname: spielgrafik\ndescription: .{40,}\n---\n/);
  assert.match(s, /Nie FLUX\.1-dev/);
  for (const f of new Set([...s.matchAll(/scripts\/([\w.-]+\.(?:sh|py))/g)].map((x) => x[1])))
    assert.ok(fs.existsSync(path.join(W, d, 'scripts', f)), `SKILL.md nennt scripts/${f}, die Datei fehlt`);
});
