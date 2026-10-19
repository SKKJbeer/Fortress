// Die App ist fuehrend (v3.131.1, Entscheidung des Betreibers): Jede neue
// Version geht nach TestFlight, nicht nur auf GitHub Pages.
//
// Bis v3.131.0 hing das am Tag-Ausloeser in ios.yml — und der griff nie:
// Tags, die deploy.yml mit dem GITHUB_TOKEN setzt, starten bei GitHub keinen
// weiteren Ablauf. v3.131.0 war deshalb nur im Browser live, die App blieb
// auf dem alten Bau. Geprueft wird die KONSTRUKTION, nicht ein Wort.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lies = (f) => fs.readFileSync(path.join(W, '.github/workflows', f), 'utf8');
// Schritte eines Ablaufs: Block ab „      - name:" bis zum naechsten.
const schritte = (text) => text.split(/\n(?=      - name: )/).slice(1).map((b) => ({
  name: b.match(/^      - name: (.*)$/m)[1].trim(), text: b,
}));

test('deploy.yml stoesst nach jeder neuen Version den App-Bau an', () => {
  const d = lies('deploy.yml');
  assert.match(d.split(/\njobs:/)[0], /\npermissions:[\s\S]*\n  actions: write\b/, 'ohne actions: write darf der Ablauf ios.yml nicht starten');
  const st = schritte(d);
  const tag = st.findIndex((s) => /\n        id: tag\n/.test(s.text));
  assert.ok(tag >= 0, 'Schritt „Git Tag setzen" braucht id: tag');
  assert.match(st[tag].text, /echo "neu=true" >> "\$GITHUB_OUTPUT"/, 'Tag-Schritt meldet, ob die Version neu ist');
  const app = st.findIndex((s) => /\n\s+gh workflow run ios\.yml\b[^\n]*-f upload=true/.test(s.text));
  assert.ok(app >= 0, 'kein Schritt startet ios.yml mit upload=true');
  assert.ok(app > tag, 'App-Bau erst NACH dem Tag (und damit nach Tests und Auslieferung)');
  assert.match(st[app].text, /\n        if: \$\{\{ steps\.tag\.outputs\.neu == 'true' \}\}/, 'nur bei neuer Version — Doku-Commits sind kein App-Bau');
  const vorher = st.slice(0, app).map((s) => s.name);
  for (const n of ['Unit-Tests', 'Bauen', 'E2E-Suite', 'Auf GitHub Pages deployen'])
    assert.ok(vorher.some((x) => x.startsWith(n)), `„${n}" fehlt vor dem App-Bau`);
});

test('ios.yml nimmt den Anstoss an und laedt nur nach gruener Testkette hoch', () => {
  const i = lies('ios.yml');
  assert.match(i, /\n  workflow_dispatch:\n    inputs:\n      upload:\n[\s\S]*?type: boolean/);
  const freigabe = schritte(i).find((s) => s.name.startsWith('Freigabe'));
  assert.ok(freigabe, 'Freigabe-Pruefung (deploy.yml gruen fuer diesen Commit) fehlt');
  assert.match(freigabe.text, /if: \$\{\{ inputs\.upload/);
  assert.match(freigabe.text, /workflows\/deploy\.yml\/runs[\s\S]{0,40}head_sha=/);
});
