// Fest verdrahtete Pfade — zweimal an einem Tag dieselbe Ursache.
//
// 1. `test_fortress.cjs` lud Playwright aus `/opt/node22/...`. Den Pfad gibt
//    es nur in einer Umgebung. Deshalb konnte die groesste Pruefschicht des
//    Projekts JAHRELANG kein Deployment aufhalten.
// 2. Direkt nach dem Fix las dieselbe Datei `index.html` aus
//    `/home/user/Fortress/`. Oertlich gruen, im Ablauf sofort rot —
//    ENOENT in der ersten Zeile.
//
// Beide Male war der Befund derselbe: Es lief hier, also sah es richtig aus.
// Diese Pruefung nimmt einem das Nachdenken ab. Sie laeuft in `test:unit`,
// also in jedem Ablauf und vor jedem Commit.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Verzeichnisse, die niemand von Hand pflegt.
const UEBERSPRINGEN = new Set(['node_modules', 'dist', '.git', 'ios', 'android', '.github-pages']);
const ENDUNGEN = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.yml', '.yaml']);

// Heimatverzeichnisse sind NIE zulaessig: Sie zeigen auf genau einen Rechner.
const VERBOTEN = /(?:^|['"\s(=])(\/home\/|\/Users\/|\/root\/)[A-Za-z0-9._-]/;
// `/opt/...` darf nur als abgesicherter Rueckfall stehen — also im catch-Zweig
// eines Versuchs, dieselbe Sache regulaer aufzuloesen.
const OPT = /(?:^|['"\s(=])\/opt\//;
const RUECKFALL = /catch\s*\([^)]*\)\s*\{\s*return\s+require\(/;

function dateien(verzeichnis) {
  const raus = [];
  for (const e of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.github') continue;
    const p = path.join(verzeichnis, e.name);
    if (e.isDirectory()) {
      if (UEBERSPRINGEN.has(e.name)) continue;
      raus.push(...dateien(p));
    } else if (ENDUNGEN.has(path.extname(e.name))) {
      raus.push(p);
    }
  }
  return raus;
}

// Diese Datei selbst traegt die verbotenen Muster im Klartext — sonst
// koennte sie nicht nach ihnen suchen.
const SELBST = path.join(WURZEL, 'tests', 'pfade.test.js');
const ALLE = dateien(WURZEL).filter(f => f !== SELBST);

test('Die Pruefung sieht ueberhaupt Dateien', () => {
  // Ohne das koennte ein kaputter Sammler alles gruen melden.
  assert.ok(ALLE.length > 15, `nur ${ALLE.length} Dateien gefunden — Sammler kaputt?`);
  assert.ok(ALLE.some(f => f.endsWith('test_fortress.cjs')), 'test_fortress.cjs nicht erfasst');
  assert.ok(ALLE.some(f => f.includes('.github')), 'Ablauf-Dateien nicht erfasst');
});

test('Keine Heimatverzeichnis-Pfade in ausgefuehrten Dateien', () => {
  const treffer = [];
  for (const f of ALLE) {
    const zeilen = fs.readFileSync(f, 'utf8').split('\n');
    zeilen.forEach((z, i) => {
      if (VERBOTEN.test(z)) treffer.push(`${path.relative(WURZEL, f)}:${i + 1}  ${z.trim().slice(0, 100)}`);
    });
  }
  assert.deepStrictEqual(treffer, [],
    'Pfade auf einen einzelnen Rechner — laeuft nirgendwo sonst:\n  ' + treffer.join('\n  '));
});

test('/opt-Pfade nur als abgesicherter Rueckfall', () => {
  const treffer = [];
  for (const f of ALLE) {
    const zeilen = fs.readFileSync(f, 'utf8').split('\n');
    zeilen.forEach((z, i) => {
      if (!OPT.test(z)) return;
      if (RUECKFALL.test(z)) return;              // try { require(x) } catch { require('/opt/...') }
      if (/^\s*(\/\/|#|\*)/.test(z)) return;      // Kommentare erklaeren die Geschichte
      treffer.push(`${path.relative(WURZEL, f)}:${i + 1}  ${z.trim().slice(0, 100)}`);
    });
  }
  assert.deepStrictEqual(treffer, [],
    '/opt ohne Rueckfall — bricht ausserhalb dieser Umgebung ab:\n  ' + treffer.join('\n  '));
});
