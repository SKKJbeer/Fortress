// Kein Testkontext darf die Produktivdatenbank erreichen.
//
// ANLASS: Bis v3.102.0 fehlte der Firebase-API-Schluessel. `getAuth()` warf,
// `uid` blieb null — ein Testkontext ohne Sperre war dadurch zufaellig
// harmlos. Mit dem Schluessel (v3.103.0) ist er es nicht mehr: Die Seite
// meldet sich anonym an, und `pushLeaderboard` schreibt das Testprofil in die
// ECHTE Bestenliste. `CLAUDE.md` warnt davor ausdruecklich; gemessen hat es
// nie jemand.
//
// Gefunden beim Eintragen des Schluessels: elf Kontexte, zehn Sperren.
// `suiteOffline` lud die echte Seite mit nur `PROFILE_INIT`.
//
// Diese Pruefung ist STATISCH — sie liest die Suite, statt sie zu fahren. Ein
// Laufzeit-Test wuerde die Verbindung erst herstellen und dann bemerken; das
// ist zu spaet, wenn dabei schon geschrieben wurde.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUITE = path.join(WURZEL, 'test_fortress.cjs');
const zeilen = fs.readFileSync(SUITE, 'utf8').split('\n');

// NACHTRAG v3.110.0: Die Pruefung las bis dahin NUR die Suite — und uebersah
// damit vier Browser-Kontexte in `tools/make-screenshots.cjs`, die ebenfalls
// die echte App von localhost:8765 laden. Seit v3.103.0 traegt die den
// API-Schluessel; der naechste Bildschirmfoto-Lauf haette das Demo-Profil
// „ARIN" mit ELO 1284 in die echte Bestenliste geschrieben, ueber jedem
// echten Spieler (Spitzenwert dort: 1046). Gemessen: noch nicht passiert.
//
// Ein Riegel, der nur einen von zwei Aufrufern kennt, ist keiner. Deshalb
// wird jetzt der GANZE Quellbaum gelesen.
const UEBERSPRINGEN = new Set(['node_modules', 'dist', '.git', 'ios', 'android', 'store', 'docs']);

function alleQuellen(verzeichnis = WURZEL, gesammelt = []) {
  for (const e of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
    if (e.name.startsWith('.') || UEBERSPRINGEN.has(e.name)) continue;
    const voll = path.join(verzeichnis, e.name);
    if (e.isDirectory()) alleQuellen(voll, gesammelt);
    else if (/\.(cjs|mjs|js)$/.test(e.name)) gesammelt.push(voll);
  }
  return gesammelt;
}

// Dateien, die einen Browser aufmachen, aber die App NICHT laden — mit Grund.
// Wer hier etwas eintraegt, nimmt es ausdruecklich vom Schutz aus; deshalb
// steht die Begruendung daneben und nicht in einem Commit-Text.
const AUSNAHMEN = {
  'tools/make-feature-graphic.cjs':
    'setzt reines HTML per setContent, laedt die App nie — kein Firebase im Spiel',
  'scripts/cloudsave-probe.cjs':
    'MUSS an die echte Datenbank: spielt Cloud-Save durch und raeumt selbst auf. '
    + 'Laeuft NIE im Dauerlauf, nur von Hand mit ausdruecklicher Freigabe.',
};

// Wie weit nach dem newContext darf die Sperre stehen? Die Kontexte werden
// unmittelbar danach bestueckt; 40 Zeilen sind reichlich Luft.
const FENSTER = 40;

/**
 * Traegt dieses Fenster eine ECHTE Sperre?
 *
 * Gesucht wird der AUFRUF, nicht das Wort. Bis v3.111.6 stand hier
 * `fenster.includes('FB_SPERRE')` — und damit erfuellte ein Kommentar wie
 * „KEINE FB_SPERRE, Absicht" die Pruefung. Beim Bau der Boot-Suite bin ich
 * genau da hineingetreten: Der Kontext hatte keine Sperre, der Riegel blieb
 * gruen, weil das Wort im Kommentar stand. Eine Pruefung, die sich von einem
 * Kommentar umstimmen laesst, ist keine.
 *
 * Drei Sperren gelten:
 *   addInitScript(FB_SPERRE)  — firebase-boot laeuft gar nicht erst
 *   makeFbMock(               — eigener Firebase-Ersatz der Online-Suiten
 *   addInitScript(WS_SPERRE)  — fuer die Boot-Suite: der echte Start SOLL
 *                               laufen, aber die Datenbank wird an ihrem
 *                               Transport abgeschnitten (WebSocket, per Route
 *                               nicht abfangbar)
 */
function gesperrt(fenster) {
  return /addInitScript\(\s*FB_SPERRE\s*\)/.test(fenster)
      || /addInitScript\(\s*WS_SPERRE\s*\)/.test(fenster)
      || /makeFbMock\s*\(/.test(fenster);
}

test('Jeder Browser-Kontext der E2E-Suite bekommt eine Firebase-Sperre', () => {
  const ohne = [];
  zeilen.forEach((z, i) => {
    if (!z.includes('browser.newContext(')) return;
    const fenster = zeilen.slice(i, i + FENSTER).join('\n');
    if (!gesperrt(fenster)) ohne.push(`test_fortress.cjs:${i + 1}`);
  });
  assert.deepStrictEqual(ohne, [],
    'Kontext(e) ohne Firebase-Sperre — wuerden die ECHTE Datenbank erreichen:\n  '
    + ohne.join('\n  '));
});

test('KEIN Browser-Kontext im ganzen Baum ohne Sperre (ausser benannten Ausnahmen)', () => {
  const ohne = [];
  let gesehen = 0;
  for (const datei of alleQuellen()) {
    const rel = path.relative(WURZEL, datei).split(path.sep).join('/');
    const zs = fs.readFileSync(datei, 'utf8').split('\n');
    zs.forEach((z, i) => {
      if (!z.includes('newContext(')) return;
      if (rel === 'tests/testsperre.test.js') return;   // diese Datei selbst
      gesehen++;
      if (AUSNAHMEN[rel]) return;
      const fenster = zs.slice(i, i + FENSTER).join('\n');
      if (!gesperrt(fenster)) ohne.push(`${rel}:${i + 1}`);
    });
  }
  assert.ok(gesehen >= 12, `nur ${gesehen} Kontexte im Baum gefunden — Muster kaputt?`);
  assert.deepStrictEqual(ohne, [],
    'Browser-Kontext(e) ohne Firebase-Sperre — wuerden die ECHTE Datenbank erreichen:\n  '
    + ohne.join('\n  '));
});

test('Jede Ausnahme existiert wirklich und hat eine Begruendung', () => {
  // Eine Ausnahmeliste, die auf geloeschte Dateien zeigt, gibt falsche
  // Sicherheit: Sie sieht nach Sorgfalt aus und schuetzt nichts mehr.
  for (const [rel, grund] of Object.entries(AUSNAHMEN)) {
    assert.ok(fs.existsSync(path.join(WURZEL, rel)), `Ausnahme zeigt ins Leere: ${rel}`);
    assert.ok(grund && grund.length > 30, `Ausnahme ${rel} ohne brauchbare Begruendung`);
  }
});

test('Die Pruefung sieht ueberhaupt Kontexte', () => {
  // Ohne diese Gegenprobe meldete ein kaputtes Muster alles gruen.
  const n = zeilen.filter(z => z.includes('browser.newContext(')).length;
  assert.ok(n >= 8, `nur ${n} Kontexte gefunden — Muster kaputt?`);
});

test('Ein blosser KOMMENTAR gilt nicht als Sperre', () => {
  // Die Gegenprobe zum Loch von oben: Wer „FB_SPERRE" nur erwaehnt, hat keine.
  assert.equal(gesperrt('  // hier steht bewusst KEINE FB_SPERRE\n  const ctx = 1;'), false);
  assert.equal(gesperrt('  await page.addInitScript(FB_SPERRE);'), true);
  assert.equal(gesperrt('  await page.addInitScript(WS_SPERRE);'), true);
  assert.equal(gesperrt('  await page.addInitScript(makeFbMock(port));'), true);
});

test('WS_SPERRE legt den WebSocket wirklich still', () => {
  // Sie ist als Sperre zugelassen — dann muss sie auch eine sein.
  const quelle = fs.readFileSync(path.join(WURZEL, 'scripts', 'fb-sperre.cjs'), 'utf8');
  assert.match(quelle, /const WS_SPERRE = `/, 'WS_SPERRE fehlt');
  const block = quelle.slice(quelle.indexOf('const WS_SPERRE'));
  assert.match(block, /window\.WebSocket\s*=/, 'WS_SPERRE ersetzt window.WebSocket nicht');
  assert.ok(!/new Echt\(/.test(block), 'WS_SPERRE baut doch eine echte Verbindung auf');
});

test('Beide Sperren existieren und setzen window.__fb VOR dem Seitenskript', () => {
  const txt = zeilen.join('\n')
    + fs.readFileSync(path.join(WURZEL, 'scripts', 'fb-sperre.cjs'), 'utf8');
  assert.match(txt, /const FB_SPERRE = `/, 'FB_SPERRE fehlt');
  assert.match(txt, /function makeFbMock\(/, 'makeFbMock fehlt');
  // Entscheidend: `window.__fb = window.__fb || {` — firebase-boot.js haelt
  // sich heraus, WENN das Objekt schon da ist. Ein Ueberschreiben danach waere
  // zu spaet, die Verbindung stuende dann schon.
  assert.match(txt, /window\.__fb = window\.__fb \|\| \{/, 'FB_SPERRE legt __fb nicht vorab an');
});

test('firebase-boot.js respektiert eine bereits vorhandene Sperre', () => {
  // Die andere Haelfte des Riegels. Faellt diese Weiche weg, greift keine
  // Sperre mehr, egal wie viele Tests sie setzen.
  const boot = fs.readFileSync(path.join(WURZEL, 'src', 'firebase-boot.js'), 'utf8');
  assert.match(boot, /if \(typeof window !== "undefined" && window\.__fb\)/,
    'firebase-boot.js prueft nicht mehr auf ein vorhandenes window.__fb');
});
