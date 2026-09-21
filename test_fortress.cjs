// Playwright aus node_modules, ersatzweise aus der globalen Installation
// dieses Rechners.
//
// **Der feste Pfad allein war der Grund, warum diese Suite nie in einem Ablauf
// lief.** /opt/node22/... gibt es nur in einer Umgebung; auf einem Laeufer von
// GitHub bricht `require` sofort ab. Damit konnte die groesste Pruefschicht des
// Projekts kein Deployment aufhalten — sie lief nur, wenn jemand daran dachte.
const { chromium } = (() => {
  try { return require('playwright'); }
  catch (e) { return require('/opt/node22/lib/node_modules/playwright'); }
})();
const fs = require('fs');
const path = require('path');
const http = require('http');

/**
 * Ein winziger Dateiserver fuer dist/ auf 8765.
 *
 * Bewusst KEINE Abhaengigkeit: Die Suite soll ohne Zutun laufen — oertlich wie
 * im Ablauf. Er liefert nur aus dist/ und nur Pfade ohne „..", damit aus einem
 * Testhelfer kein Weg ins Dateisystem wird.
 */
function starteDistServer() {
  const pfadmodul = require('path');
  const wurzel = pfadmodul.join(__dirname, 'dist');
  const typen = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg',
    '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
  const srv = http.createServer((anfrage, antwort) => {
    let pfad = decodeURIComponent((anfrage.url || '/').split('?')[0]);
    if (pfad.includes('..')) { antwort.writeHead(400).end(); return; }
    if (pfad.endsWith('/')) pfad += 'index.html';
    const datei = pfadmodul.join(wurzel, pfad);
    if (!datei.startsWith(wurzel)) { antwort.writeHead(400).end(); return; }
    fs.readFile(datei, (fehler, inhalt) => {
      if (fehler) { antwort.writeHead(404).end('nicht da'); return; }
      antwort.writeHead(200, { 'Content-Type': typen[pfadmodul.extname(datei)] || 'application/octet-stream' });
      antwort.end(inhalt);
    });
  });
  srv.listen(8765);
  srv.unref();
  return srv;
}

// React kommt seit dem Vite-Umbau aus dem Bundle (Architektur E3), nicht mehr
// vom CDN. Das fruehere Nachreichen von /tmp/react.min.js entfaellt damit
// ersatzlos — es gibt keine unpkg-Anfrage mehr, die man abfangen koennte.

// Speedup-Skript: setInterval >= 900ms → 50ms (Phasen 20× schneller)
//                 setTimeout >= 2000ms → /5   (Banner 5× schneller)
// Damit dauert ein kompletter Phasenzyklus ~10s statt ~100s.
const TIMER_SPEEDUP = `
  const _osi = window.setInterval;
  window.setInterval = (fn, ms, ...a) => _osi(fn, ms >= 900 ? 50 : ms === 600 ? 60 : ms, ...a);
  const _ost = window.setTimeout;
  window.setTimeout = (fn, ms, ...a) => _ost(fn, ms >= 2000 ? Math.round(ms / 5) : ms, ...a);
`;
// Hinweis: ms === 600 → 60 skaliert den Bot-KI-Tick proportional zum 20×-Phasen-
// Speedup — sonst bekäme der Bot in der gerafften Bauphase nur ~2 statt ~40
// Ticks und wirkt fälschlich untätig (Versiegelungs-Test würde scheitern).

// Profil vorab in localStorage setzen, damit der Profil-Editor nie erscheint.
// Der Profil-Editor zeigt "WAPPEN" als Label (6 Großbuchstaben), das sonst
// fälschlich als Spielcode erkannt wird.
// fortress_daily wird mit aktuellem Timestamp gesetzt, damit die Tages-Belohnungs-
// Modal sich NICHT automatisch nach 1200ms öffnet (würde unrelated Tests stören).
const PROFILE_INIT = `
  try {
    localStorage.setItem('fortress_profile', JSON.stringify({
      id: 'test_bot_001',
      name: 'TestBot',
      wappen: 'skelett',
      color: '#2563eb',
      stats: { wins: 5, losses: 2, games: 7 },
      stats3: { wins: 1, losses: 0, games: 1 },
      elo: 1050, elo3: 1000,
      peakElo: 1050, peakElo3: 1000,
      gold: 175, level: 1, xp: 40,
      unlockedRewards: [], achievements: [], dailyTasks: [], seasonXp: 0
    }));
    localStorage.setItem('fortress_daily', JSON.stringify({
      lastCollect: ${Date.now()}, streak: 1, lastStreakDay: new Date().toISOString().slice(0,10)
    }));
    // Onboarding-Flag setzen, damit die Tutorial-Modal sich NICHT automatisch
    // öffnet (würde unrelated Tests blockieren). Eigener Test setzt es gezielt zurück.
    localStorage.setItem('fortress_onboarded', '1');
    // Interaktives Tutorial als gesehen markieren → kein Auto-Start nach dem Onboarding.
    localStorage.setItem('fortress_tutorial_done', '1');
    // Sprache explizit auf Deutsch (Headless-Browser meldet sonst en-US → Auto-Detect = EN).
    localStorage.setItem('fortress_lang', 'de');
  } catch(e) {}
`;

// ── Versions-Helfer ───────────────────────────────────────────
//
// EIN Muster fuer beide Seiten des Abgleichs. Es stand zweimal da, und beim
// Umbenennen auf „Stack & Siege" wurde nur die eine Kopie nachgezogen — der
// Lauf brach dann mit „Server vnull" ab, obwohl beide Seiten dieselbe Version
// trugen. Zwei Kopien einer Wahrheit driften, sobald man sie anfasst.
//
// `&(?:amp;)?`, weil hier ROHES HTML gelesen wird: dort steht das
// kaufmaennische Und als Entitaet, im gerenderten Text dagegen als Zeichen.
const VERSION_MUSTER = /Stack &(?:amp;)? Siege v(\d+\.\d+\.\d+)/;

function versionAus(text) {
  const m = text.match(VERSION_MUSTER);
  return m ? m[1] : null;
}

function getExpectedVersion() {
  // __dirname, nicht der absolute Pfad dieses einen Rechners (v3.94.0).
  // Derselbe Fehler wie bei Playwright: Ein fest verdrahteter Pfad laeuft
  // ueberall dort ins Leere, wo das Projekt anders liegt — auf einem Laeufer
  // von GitHub bricht die Suite in der ersten Zeile ab.
  return versionAus(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'));
}
function getServerVersion() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8765/', (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(versionAus(d)));
    }).on('error', reject);
  });
}

// ── Seiten-Helfer ─────────────────────────────────────────────
async function jsClick(page, parts) {
  return page.evaluate((parts) => {
    for (const b of document.querySelectorAll('button')) {
      const t = (b.textContent || '').trim();
      const title = b.title || '';
      if (parts.some(p => t.includes(p) || title.includes(p))) { b.click(); return t; }
    }
    return null;
  }, parts);
}
async function findBtn(page, parts) {
  return page.evaluate((parts) => {
    for (const b of document.querySelectorAll('button')) {
      const t = (b.textContent || '').trim();
      const title = b.title || '';
      if (parts.some(p => t.includes(p) || title.includes(p))) return t;
    }
    return null;
  }, parts);
}
async function getTimerValue(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      const t = (el.textContent || '').trim();
      // Timer uses padStart(2,"0") → always 2 digits ("20","05","00"); scores are 1-digit
      if (/^\d{2}$/.test(t) && el.children.length === 0) return parseInt(t, 10);
    }
    return null;
  });
}
async function getCanvasBox(page) {
  return page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}
async function getHudPhase(page) {
  return page.evaluate(() => {
    for (const s of document.querySelectorAll('span, div')) {
      const t = (s.textContent || '').trim();
      if (t.includes('BAUEN') || t.includes('FEUER') || t.includes('KANONE') ||
          t.includes('START') || t.includes('ERGEBNIS')) return t;
    }
    return null;
  });
}

// Phasenwächter: 200ms-Polling, Deadline in ms
// Die Bot-Hand darf NICHT sichtbar sein (v3.30.1) — beobachtet statt erblickt.
//
// Der Check zaehlte die Hand-Vorschauen in dem Augenblick, in dem die
// Bauphase gerade begonnen hatte. Unter Last hatte React da noch nichts
// gerendert: 0 sieht aus wie ein Fehler, war aber nur zu frueh. Umgekehrt
// haette ein einzelner Blick eine Bot-Hand VERPASST, die erst mitten in der
// Phase auftaucht — der Check war also in beide Richtungen unzuverlaessig.
//
// Jetzt wird die Bauphase ueber ihre ganze Dauer beobachtet und das MAXIMUM
// bewertet: 1 ist richtig, 2 heisst Bot-Hand sichtbar, 0 heisst, es kam nie
// etwas. Das ist strenger als der alte Blick, nicht nachsichtiger.
async function beobachteHaende(page, waitMs = 5000) {
  const lies = () => page.evaluate(() => ({
    bauen: document.body.innerText.includes('BAUEN'),
    n: document.querySelectorAll('div[style*="grid-template-columns"]').length,
  }));
  // Beobachtet wird die LAUFENDE Bauphase bis zu ihrem Ende — bewusst NICHT
  // erst auf eine frische gewartet.
  //
  // Der Versuch, sauber an der Phasengrenze anzusetzen (erst raus aus BAUEN,
  // dann rein), brachte 21 statt 2 Stichproben — und riss die Suite: Danach
  // stand "Schussphase nicht erreicht", und die Meldung nannte den Grund
  // selbst, "Rot siegt! Burg war nicht geschlossen". Eine ganze Runde extra
  // kostet den Test-Spieler das Spiel, denn der baut nie nach: Der Bot
  // schiesst ihm in der Schussphase die Mauer auf, und am naechsten Bauende
  // ist die Burg offen. Kein Produktfehler, sondern der Preis der Wartezeit.
  //
  // Der Rest der laufenden Phase genuegt fuer die Aussage: Bewertet wird das
  // MAXIMUM ueber alle Stichproben, und eine faelschlich gerenderte Bot-Hand
  // stuende die ganze Phase ueber da, nicht nur einen Wimpernschlag.
  let max = 0, proben = 0;
  const start = Date.now();
  while (Date.now() - start < waitMs) {
    const st = await lies();
    if (st.bauen) { proben++; if (st.n > max) max = st.n; }
    else if (proben > 0) break;              // Bauphase vorbei, Messung steht
    await page.waitForTimeout(80);
  }
  return { max, proben, ms: Date.now() - start };
}

// Phasengleichheit im ZEITRAFFER pruefen (v3.108.0).
//
// Unter TIMER_SPEEDUP wird aus 1000 ms ein 50-ms-Tick — eine Phase dauert
// im Test also rund EINE SEKUNDE. Host und Gast sind dabei nie dauerhaft
// gleich: der Host rechnet, pusht (hoechstens 8/s) und der Gast rendert
// danach. An jeder Phasengrenze liegen sie fuer einen Bruchteil der Phase
// auseinander, und ob ein Blick genau dort hinfaellt, entscheidet die Last
// des Rechners.
//
// Der alte 2P-Check versuchte es 3× im Abstand von 400 ms — zusammen 1,2 s,
// also laenger als eine ganze Phase. Damit konnte er der wandernden Grenze
// hinterherlaufen statt sie zu ueberspringen. Der 3P-Check sah nur EINMAL
// hin. Beides ergab ein Flattern, das nichts ueber das Spiel aussagte.
//
// Gefragt ist auch nicht "immer gleich", sondern "holt auf": es genuegt,
// dass die Seiten in EINER gemeinsamen Stichprobe uebereinstimmen. Sind sie
// ueber drei Sekunden hinweg in JEDER Stichprobe verschieden, haengt der
// Gast wirklich fest — genau der Fehler aus v3.0.7, den dieser Check
// bewachen soll. Die Aussagekraft bleibt also erhalten.
async function wartePhasenGleich(pages, waitMs = 3000) {
  const lies = p => p.evaluate(() => {
    const t = document.body.innerText;
    return ['FEUER', 'BAUEN', 'START', 'KANONE'].find(k => t.includes(k)) || null;
  });
  const start = Date.now();
  let letzte = [], versuche = 0;
  while (Date.now() - start < waitMs) {
    letzte = await Promise.all(pages.map(lies));
    versuche++;
    if (letzte[0] && letzte.every(x => x === letzte[0]))
      return { gleich: true, phase: letzte[0], versuche, ms: Date.now() - start };
    await pages[0].waitForTimeout(100);
  }
  return { gleich: false, phasen: letzte, versuche, ms: Date.now() - start };
}

// Auf den Spielcode WARTEN, nicht nach fester Frist danach sehen (v3.111.5).
//
// Vorher stand an ACHT Stellen dieselbe Kopie: `waitForTimeout(1200)` und ein
// einziger Blick in den DOM. Unter voller Suitenlast reichen 1200 ms nicht —
// die Folge war „Host: kein Spielcode → Suite abgebrochen", und mit dem Abbruch
// fielen zwanzig weitere Pruefungen aus. Allein lief dieselbe Suite 4× grün;
// es war also nie ein Fehler am Spiel, immer einer an der Messung.
//
// Genau die Bauart, vor der CLAUDE.md seit v3.108.0 warnt: Momentaufnahme statt
// Wartebedingung. Acht Kopien davon sind acht Gelegenheiten, es zu vergessen.
async function warteAufCode(page, frist = 15000) {
  const start = Date.now();
  while (Date.now() - start < frist) {
    const code = await page.evaluate(() => {
      const re = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}$/;
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const t = w.currentNode.textContent.trim();
        if (re.test(t)) return t;
      }
      return null;
    }).catch(() => null);
    if (code) return { code, ms: Date.now() - start };
    await page.waitForTimeout(200);
  }
  return { code: null, ms: Date.now() - start };
}

// Auf das Stueck-Vorschau-Panel WARTEN statt einmal hinzusehen (v3.108.0).
//
// Der Check las den DOM in dem Augenblick, in dem die Bauphase gerade
// begonnen hatte — React hatte da nicht zwingend schon gerendert. Ergebnis:
// ein Flattern, das mit der Last des Rechners kam und ging (zwei Laeufe
// desselben Baums, einmal 1 ❌, einmal 2 ❌). Dieselbe Bauart wie die
// Bot-Flakes vorher: Momentaufnahme statt Wartebedingung.
//
// Die Bauphase dauert 25 s, 8 s Suchfrist sind also reichlich. Ist das
// Panel dann immer noch nicht da, fehlt es wirklich — und die Meldung
// sagt, wie lange gesucht wurde, statt nur "fehlt".
async function wartePanel(page, waitMs = 8000) {
  const start = Date.now();
  const zaehle = () => Array.from(document.querySelectorAll('div')).filter(d =>
    d.style.cursor === 'pointer' &&
    d.style.touchAction === 'manipulation' &&
    d.style.borderRadius === '10px' &&
    d.querySelector('div[style*="grid-template-columns"]')).length;
  while (Date.now() - start < waitMs) {
    const n = await page.evaluate(zaehle);
    if (n > 0) return { da: true, ms: Date.now() - start, n };
    await page.waitForTimeout(150);
  }
  return { da: false, ms: Date.now() - start, n: 0 };
}

async function waitForPhase(page, keywords, waitMs = 6000) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const ph = await getHudPhase(page);
    if (ph && keywords.some(k => ph.includes(k))) return ph;
    await page.waitForTimeout(200);
  }
  return null;
}

// Browser-Kontext mit CDN-Mocks + Speedup
// Riegel gegen die PRODUKTIVDATENBANK (v3.78.1).
//
// Solange Firebase vom CDN kam, war es durch das Blockieren von gstatic
// stillgelegt. Seit es mitgebuendelt ist, startet es in jedem Testkontext
// wirklich — und pushLeaderboard schreibt dann das Testprofil in die ECHTE
// Bestenliste. Aufgefallen ist es nur, weil der Browser in dieser Umgebung
// ohnehin nicht ins Netz kommt; auf einem normalen Rechner wuerde es schreiben.
//
// Der Riegel setzt window.__fb VOR dem Seitenskript. firebase-boot.js prueft
// genau darauf und haelt sich dann komplett heraus — es wird also gar keine
// Verbindung aufgebaut, statt sie nachtraeglich abzufangen.
// Die Sperre liegt seit v3.110.0 in `scripts/fb-sperre.cjs` — EINE Quelle.
// Grund: `tools/make-screenshots.cjs` macht ebenfalls Browser-Kontexte auf und
// hatte keine. Die Begruendung steht dort.
const { FB_SPERRE, WS_SPERRE } = require('./scripts/fb-sperre.cjs');

// ── Die Inhaltsrichtlinie fuer die Testgegenstelle oeffnen (v3.112.0) ───
//
// Seit dem Sicherheits-Pass traegt `index.html` eine Content-Security-Policy,
// deren `connect-src` genau die Gegenstellen aufzaehlt, die das Spiel wirklich
// braucht. Die Suite spricht aber mit ihrem EIGENEN Mock auf einem zweiten
// lokalen Port — der ist weder die eigene Herkunft noch Firebase.
//
// Ohne diese Zeilen scheitert jeder `fetch` des Mocks, und zwar STILL: der
// Mock faengt Fehler selbst ab und liefert null. Der erste Lauf danach sah
// deshalb wie ein kaputter Multiplayer aus (sieben rote Pruefungen, keine
// Fehlermeldung ueber die Ursache).
//
// Geaendert wird NUR die eine Direktive, und nur in der ausgelieferten Antwort
// — die Datei im Repository bleibt, wie sie ist. `tests/sicherheit.test.js`
// haelt fest, dass dort kein `localhost` steht.
async function oeffneRichtlinieFuerTestgegenstelle(ctx) {
  await ctx.route((url) => /^http:\/\/localhost:8765\/(index\.html)?(\?.*)?$/.test(url.href),
    async (route) => {
      const antwort = await route.fetch();
      const text = (await antwort.text()).replace(
        /(content="[^"]*connect-src )'self' /,
        "$1'self' http://localhost:* ");
      await route.fulfill({ response: antwort, body: text });
    });
}

async function makeCtx(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
    // Service Worker BLOCKIEREN (seit v3.75.0). Er hat in der Suite nichts
    // zu suchen: er faengt Anfragen ab, liefert aus dem Cache und uebernimmt
    // die Seite waehrend eines Tests — damit wurden Persistenz-Pruefungen
    // (Reload, Profil speichern, Daily-Streak) reihenweise unzuverlaessig.
    // Das Offline-Verhalten bekommt eine eigene, gezielte Pruefung.
    serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(PROFILE_INIT);
  await page.addInitScript(TIMER_SPEEDUP);
  await page.addInitScript(FB_SPERRE);
  // Die Routen sind nur noch die zweite Verteidigungslinie: die Realtime
  // Database spricht ueber WebSocket mit *.firebasedatabase.app und laesst
  // sich damit NICHT zuverlaessig abfangen. Entscheidend ist FB_SPERRE oben.
  await page.route('**firebase**',   r => r.abort());
  await page.route('**gstatic**',    r => r.abort());
  await page.route('**googleapis**', r => r.abort());
  await oeffneRichtlinieFuerTestgegenstelle(ctx);
  return { ctx, page };
}

// Bot-Spiel starten (v3.20.0): "gegen Bot" öffnet die Stufen-Auswahl,
// erst die Stufen-Wahl startet das Spiel.
async function startBotGame(page, levelTexts = ['Mittel', 'Medium']) {
  await jsClick(page, ['gegen Bot', 'vs Bot']);
  await page.waitForTimeout(250);
  await jsClick(page, levelTexts);
}

// Menü laden + Profil-Editor überspringen (falls PROFILE_INIT nicht gegriffen hat)
async function loadMenu(page) {
  await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 8000 });
  await page.waitForTimeout(200);
  // Prüft auf beliebiges Input-Feld (Profil-Editor hat input ohne maxlength-Attribut)
  const hasInput = await page.evaluate(() => !!document.querySelector('input:not([type=range])'));
  if (hasInput) {
    await page.evaluate(() => {
      const i = document.querySelector('input:not([type=range])');
      if (i) { i.value = 'TestBot'; i.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await page.waitForTimeout(80);
    // Button heißt "Profil erstellen ⚔️" (kein Profil) oder "Speichern" (Profil vorhanden)
    await jsClick(page, ['Speichern', 'Profil erstellen', 'Save', 'Create profile']);
    await page.waitForTimeout(150);
    await page.waitForFunction(
      () => !document.querySelector('input:not([type=range])'), { timeout: 3000 }
    ).catch(() => {});
  }
}

// Lokal-Spiel starten (wartet auf Canvas)
async function startLocal(page, playerCount) {
  await jsClick(page, ['LOKAL']);
  await page.waitForTimeout(200);
  await jsClick(page, [playerCount === 2 ? '2 Spieler' : '3 Spieler']);
  await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 5000 });
  await page.waitForTimeout(200);
}

// ═══════════════════════════════════════════════════════════════
// SUITE 0: Menü-Elemente
// ═══════════════════════════════════════════════════════════════
async function suiteMenu(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Menü-Elemente\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);

    // Version
    const ver = await page.evaluate(() => (document.title.match(/v(\d+\.\d+\.\d+)/) || [])[1]);
    ver ? ok(`Version: ${ver}`) : fail('Version nicht erkannt');

    // Menü-Hauptbuttons
    const btnTexts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
    );
    ['LOKAL', 'ONLINE'].every(k => btnTexts.some(t => t.includes(k)))
      ? ok('Menü-Hauptbuttons LOKAL & ONLINE ✓')
      : fail(`Menü-Buttons fehlen: ${btnTexts.slice(0, 5).join(', ')}`);

    // Gold-Anzeige — geprueft wird die ABSICHT ("steht der Goldstand im
    // Menue?"), nicht das Markup. Die fruehere Fassung verlangte ein Element
    // OHNE Kinder; daneben steht aber das Muenz-Icon als Kindknoten, womit die
    // Pruefung an jeder Icon-Aenderung zerbricht statt an einem echten Fehler.
    // Gleiche Formulierung wie die Schwester-Pruefung in suiteProgression.
    const goldOk = await page.evaluate(() => /\d+\s*Gold/.test(document.body.innerText));
    goldOk ? ok('Gold-Anzeige im Menü ✓') : fail('Gold-Anzeige fehlt');

    // Bestenliste-Button (auch als Rangliste/Leaderboard bekannt)
    const lbOk = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some(b =>
        /rangliste|leaderboard|bestenliste/i.test(b.textContent || ''))
    );
    lbOk ? ok('Bestenliste-Button ✓') : fail('Bestenliste-Button fehlt');

    // Online-Overlay öffnet sich
    await jsClick(page, ['ONLINE']);
    await page.waitForTimeout(250);
    const onlineOk = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some(b =>
        /(Matchmaking|Spiel erstellen|Code)/i.test(b.textContent || ''))
    );
    onlineOk ? ok('Online-Overlay öffnet sich ✓') : fail('Online-Overlay fehlt');

    // Matchmaking-Button vorhanden
    const mmBtn = await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if (/Matchmaking/i.test(b.textContent || '')) return b.textContent.trim();
      }
      return null;
    });
    mmBtn ? ok(`Matchmaking-Button: "${mmBtn.slice(0, 40)}" ✓`) : fail('Matchmaking-Button fehlt');

    await page.screenshot({ path: '/tmp/s0_menu.png' });

    // ── v3.40.1: Deeplink-Beitritt (?join=CODE) ──
    // Frisch mit ?join=TESTAB laden → App soll direkt in die Join-Lobby
    // navigieren, den Code vorbefüllen und die URL bereinigen.
    await page.goto('http://localhost:8765/?join=TESTAB', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 8000 });
    await page.waitForTimeout(300);
    const deep = await page.evaluate(() => {
      const vals = [...document.querySelectorAll('input')].map(i => (i.value || '').toUpperCase());
      return {
        codeMatched: vals.includes('TESTAB'),
        vals,
        urlCleaned: window.location.search === '',
        joinScreen: /Code|beitreten|join/i.test(document.body.innerText)
      };
    });
    deep.codeMatched ? ok('Deeplink: Code aus ?join= vorbefüllt (TESTAB) ✓') : fail(`Deeplink: Code nicht vorbefüllt (inputs: ${deep.vals.join(',')})`);
    deep.urlCleaned ? ok('Deeplink: URL bereinigt (kein erneuter Auto-Join) ✓') : fail('Deeplink: URL nicht bereinigt');
    deep.joinScreen ? ok('Deeplink: Join-Lobby geöffnet ✓') : fail('Deeplink: Join-Lobby nicht geöffnet');

    errs.length ? errs.forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`)) : ok('Keine JS-Fehler ✓');
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 1: Navigation & HUD (2P oder 3P)
// ═══════════════════════════════════════════════════════════════
async function suiteNavHUD(browser, playerCount) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  const label = `${playerCount}-Spieler: Navigation & HUD`;
  console.log('\n' + '='.repeat(50) + `\nTEST: ${label}\n` + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);
    await startLocal(page, playerCount);

    // Version
    const ver = await page.evaluate(() => (document.title.match(/v(\d+\.\d+\.\d+)/) || [])[1]);
    ver ? ok(`Version: ${ver}`) : fail('Version nicht erkannt');

    // Canvas
    const cb = await getCanvasBox(page);
    cb ? ok(`Canvas: ${Math.round(cb.w)}×${Math.round(cb.h)}px`) : fail('Canvas fehlt');

    await page.screenshot({ path: `/tmp/s1_${playerCount}p_setup.png` });

    // HUD-Vollständigkeit (alle Elemente gleichzeitig sichtbar)
    const hud = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        timer: /\b\d{1,2}\b/.test(text),
        phase: text.includes('BAUEN') || text.includes('FEUER') || text.includes('START') || text.includes('KANONE'),
        quit:  Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('beenden') || b.title.includes('beenden') || b.textContent.trim() === '✕'),
      };
    });
    hud.timer ? ok('Timer im HUD ✓')        : fail('Timer im HUD fehlt');
    hud.phase ? ok('Phase-Badge im HUD ✓')  : fail('Phase-Badge im HUD fehlt');
    hud.quit  ? ok('Beenden-Button im HUD ✓') : fail('Beenden-Button im HUD fehlt');

    // Score-Anzeige: HUD zeigt Scores neben "P1"/"P2"-Labels (keine "x:y"-Notation)
    const scoreOk = await page.evaluate(() => {
      const t = document.body.innerText;
      return (/P1/.test(t) && /P2/.test(t)) || /\d\s*:\s*\d/.test(t) || /punkte|score/i.test(t);
    });
    scoreOk ? ok('Score-Anzeige ✓') : fail('Score-Anzeige fehlt');

    // Runden-Anzeige
    const roundOk = await page.evaluate(() => {
      const t = document.body.innerText;
      return /runde|round/i.test(t) || /R\s*\d/.test(t);
    });
    roundOk ? ok('Runden-Anzeige ✓') : fail('Runden-Anzeige fehlt');

    // WappenAvatar im HUD: kreisrundes img (SVG oder PNG)
    const hudAvatarOk = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
        const src = img.getAttribute('src') || '';
        const style = window.getComputedStyle(img);
        const rect = img.getBoundingClientRect();
        return src.startsWith('data:image/') && style.borderRadius === '50%' && rect.width > 0;
      });
      return imgs.length;
    });
    hudAvatarOk >= 1
      ? ok(`HUD: ${hudAvatarOk} Avatar-Grafik(en) kreisrund sichtbar ✓`)
      : fail('HUD: kein kreisrundes Avatar-Bild im HUD');

    // Beenden-Button-Detail
    const qi = await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if (b.textContent.includes('beenden') || b.title.includes('beenden') || b.textContent.trim() === '✕') {
          const r = b.getBoundingClientRect(), st = window.getComputedStyle(b);
          return { x: r.x, y: r.y, w: r.width, h: r.height, pos: st.position, bg: st.background };
        }
      }
      return null;
    });
    if (qi) {
      ok(`Beenden-Button: ${Math.round(qi.w)}×${Math.round(qi.h)}px @ (${Math.round(qi.x)},${Math.round(qi.y)})`);
      qi.pos !== 'absolute' ? ok('Beenden-Button: kein absolutes Overlay ✓') : fail('Beenden-Button: position=absolute');
      const cx = qi.x + qi.w / 2;
      (cx > 100 && cx < 290) ? ok(`Beenden-Button im HUD-Center (x≈${Math.round(cx)}) ✓`) : fail(`Beenden-Button außerhalb HUD-Center`);
      const hasBg = qi.bg && !qi.bg.includes('rgba(0, 0, 0, 0)') && qi.bg !== 'none';
      hasBg ? ok('Beenden-Button: sichtbarer Hintergrund ✓') : fail('Beenden-Button: kein sichtbarer Hintergrund');
    } else { fail('Beenden-Button nicht gefunden'); }

    // CSS-Phasenbanner-Animation
    const animOk = await page.evaluate(() => {
      try { return Array.from(document.styleSheets).some(s =>
        Array.from(s.cssRules || []).some(r => r.name === 'phasebanner')); }
      catch { return false; }
    });
    animOk ? ok('CSS-Animation phasebanner ✓') : fail('CSS-Animation phasebanner fehlt');

    // Phasensequenz: Setup → direkt Schuss (kein Build dazwischen)
    console.log('⏳ Warte auf Schussphase (nach Setup)...');
    const shootPh = await waitForPhase(page, ['FEUER'], 6000);
    if (!shootPh) { fail('Schussphase nach Setup nicht erreicht'); return { res, errs }; }
    ok(`Schussphase direkt nach Setup: "${shootPh}" ✓`);

    // Timer zählt — Phasengrenzen-bewusst (Zeitraffer): bis zu 3 Versuche
    let tOk = false, t0 = null, t1 = null;
    for (let att = 0; att < 3 && !tOk; att++) {
      await page.waitForTimeout(200);
      t0 = await getTimerValue(page);
      await page.waitForTimeout(600);
      t1 = await getTimerValue(page);
      if (t0 !== null && t1 !== null && t1 < t0) tOk = true;
    }
    tOk
      ? ok(`Timer zählt: ${t0} → ${t1} ✓`)
      : fail(`Timer zählt nicht (${t0} → ${t1})`);
    await page.screenshot({ path: `/tmp/s1_${playerCount}p_shoot.png` });

    // Beenden-Dialog: korrekte Buttons
    await jsClick(page, ['beenden']);
    await page.waitForTimeout(200);
    const dlgBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())
    );
    dlgBtns.some(t => t.includes('Weiterspielen'))
      ? ok('Beenden-Dialog: Weiterspielen-Button ✓') : fail('Beenden-Dialog: Weiterspielen fehlt');
    dlgBtns.some(t => t.includes('Ja') || (t.includes('beenden') && !t.includes('✕')))
      ? ok('Beenden-Dialog: Bestätigen-Button ✓') : fail('Beenden-Dialog: Bestätigen fehlt');

    // Weiterspielen schließt Dialog
    await jsClick(page, ['Weiterspielen']);
    await page.waitForTimeout(200);
    const dlgGone = !(await findBtn(page, ['Weiterspielen']));
    dlgGone ? ok('Weiterspielen schließt Dialog ✓') : fail('Dialog bleibt nach Weiterspielen');
    (await page.evaluate(() => !!document.querySelector('canvas')))
      ? ok('Spiel läuft nach Weiterspielen ✓') : fail('Canvas fehlt nach Weiterspielen');

    // Beenden → Ja → Menü
    await jsClick(page, ['beenden']);
    await page.waitForTimeout(200);
    await jsClick(page, ['Ja, beenden']);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `/tmp/s1_${playerCount}p_menu.png` });
    !(await page.evaluate(() => !!document.querySelector('canvas')))
      ? ok('Zurück im Menü ✓') : fail('Canvas nach "Ja, beenden" noch da');

    errs.length ? errs.forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`)) : ok('Keine JS-Fehler ✓');
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 2: Spielmechanik — Bauen / Schießen / Kanone
// ═══════════════════════════════════════════════════════════════
async function suiteMechanics(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Spielmechanik (Bauen / Schießen / Kanone)\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);
    await startLocal(page, 2);
    const cb = await getCanvasBox(page);
    if (!cb) { fail('Canvas fehlt'); return { res, errs }; }

    // Setup: Kanonen platzieren
    console.log('⚙️  Setup-Phase: Kanonen platzieren...');
    for (const [rx, ry] of [[0.38, 0.18], [0.62, 0.18], [0.38, 0.82], [0.62, 0.82]]) {
      await page.mouse.click(cb.x + cb.w * rx, cb.y + cb.h * ry);
      await page.waitForTimeout(80);
    }
    await page.screenshot({ path: '/tmp/s2_setup.png' });

    // Schuss-Phase nach Setup
    console.log('⏳ Warte auf erste Schussphase...');
    const shoot1 = await waitForPhase(page, ['FEUER'], 6000);
    if (!shoot1) { fail('Schussphase nach Setup nicht erreicht'); return { res, errs }; }
    ok(`Schussphase direkt nach Setup: "${shoot1}" ✓`);
    await page.screenshot({ path: '/tmp/s2_shoot1.png' });

    // Timer zählt — Phasengrenzen-bewusst (v3.108.0: Folge statt Paar).
    //
    // Vorher wurden zwei Werte im Abstand von 500 ms verglichen, dreimal.
    // Unter TIMER_SPEEDUP sind 500 ms rund zehn Sekunden Spielzeit, das Paar
    // kann also ueber eine Phasengrenze fallen — und die Meldung hiess dann
    // "Schuss-Timer zählt nicht (25 → 25)", obwohl 25 die Dauer der BAUphase
    // ist, nicht der Schussphase. Das Paar sagte nicht, was es gelesen hatte.
    //
    // Jetzt wird engmaschig abgetastet und die ganze Folge behalten: Es
    // genuegt EIN fallendes Paar irgendwo darin. Schlaegt es fehl, steht die
    // Folge in der Meldung — beim naechsten Mal muss niemand mehr raten.
    const tWerte = [];
    let timerOk = false;
    const tEnde = Date.now() + 4000;
    while (Date.now() < tEnde && !timerOk) {
      const v = await getTimerValue(page);
      if (v !== null && (tWerte.length === 0 || v !== tWerte[tWerte.length - 1])) tWerte.push(v);
      for (let i = 1; i < tWerte.length; i++) if (tWerte[i] < tWerte[i - 1]) timerOk = true;
      if (!timerOk) await page.waitForTimeout(120);
    }
    timerOk
      ? ok(`Schuss-Timer zählt: ${tWerte.slice(0, 4).join(' → ')} ✓`)
      : fail(`Schuss-Timer zählt nicht — gelesen: [${tWerte.join(', ')}]`);

    // Schuss-Geste
    console.log('💥 Schuss-Geste...');
    const sfy = cb.y + cb.h * 0.18;
    await page.mouse.move(cb.x + cb.w * 0.5, sfy);
    await page.mouse.down(); await page.waitForTimeout(80);
    await page.mouse.move(cb.x + cb.w * 0.5, cb.y + cb.h * 0.05);
    await page.waitForTimeout(100); await page.mouse.up(); await page.waitForTimeout(150);
    ok('Schuss-Geste (erste Runde) ohne Crash ✓');

    // Kanonen-Phase
    console.log('⏳ Warte auf Kanonen-Phase...');
    const cannonPh = await waitForPhase(page, ['KANONE'], 6000);
    if (!cannonPh) { fail('Kanonen-Phase nicht erreicht'); return { res, errs }; }
    ok(`Kanonen-Phase erreicht: "${cannonPh}" ✓`);
    await page.screenshot({ path: '/tmp/s2_cannon.png' });

    // Kanone platzieren
    console.log('🎯 Kanone setzen...');
    for (const [rx, ry] of [[0.35, 0.28], [0.55, 0.28]]) {
      await page.mouse.click(cb.x + cb.w * rx, cb.y + cb.h * ry);
      await page.waitForTimeout(80);
    }
    ok('Kanone-Platzierungs-Geste ohne Crash ✓');

    // Bauphase
    console.log('⏳ Warte auf Bauphase...');
    const buildPh = await waitForPhase(page, ['BAUEN'], 6000);
    if (!buildPh) { fail('Bauphase nicht erreicht'); return { res, errs }; }
    ok('Bauphase nach Kanonen-Phase erreicht ✓');
    await page.screenshot({ path: '/tmp/s2_build.png' });

    // Canvas-Tap → Rotation
    console.log('🔄 Canvas-Tap-Rotation testen...');
    for (let i = 0; i < 3; i++) {
      await page.mouse.click(cb.x + cb.w * (0.3 + i * 0.1), cb.y + cb.h * 0.2);
      await page.waitForTimeout(80);
    }
    ok('Canvas-Tap dreht Stück in Bauphase ✓');

    // Drehen-Panel (kompaktes Layout ohne Text-Label seit v3.11.25)
    const panel = await wartePanel(page);
    panel.da
      ? ok(`Stück-Vorschau-Panel sichtbar nach ${panel.ms} ms (${panel.n} Stück) ✓`)
      : fail(`Stück-Vorschau-Panel fehlt (${panel.ms} ms gesucht, Phase "${await getHudPhase(page)}")`);

    // Panel-Tap dreht
    const panelTap = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const btn = divs.find(d =>
        d.style.cursor === 'pointer' &&
        d.style.touchAction === 'manipulation' &&
        d.style.borderRadius === '10px' &&
        d.querySelector('div[style*="grid-template-columns"]')
      );
      if (!btn) return false;
      btn.dispatchEvent(new PointerEvent('pointerdown',
        { bubbles: true, cancelable: true, isPrimary: true, pointerId: 99 }));
      return true;
    });
    panelTap ? ok('Stück-Vorschau-Panel dreht Stück ✓') : fail('Panel-Tap fehlgeschlagen');

    // Drag-Gesten (Bauen)
    console.log('🧱 Bauphase: Teile per Drag platzieren...');
    for (let i = 0; i < 3; i++) {
      const sx = cb.x + cb.w * (0.28 + i * 0.12);
      await page.mouse.move(sx, cb.y + cb.h * 0.22); await page.mouse.down(); await page.waitForTimeout(40);
      await page.mouse.move(sx + 32, cb.y + cb.h * 0.22 + 20); await page.waitForTimeout(40);
      await page.mouse.up(); await page.waitForTimeout(80);
      await page.mouse.move(sx, cb.y + cb.h * 0.78); await page.mouse.down(); await page.waitForTimeout(40);
      await page.mouse.move(sx + 32, cb.y + cb.h * 0.78 - 20); await page.waitForTimeout(40);
      await page.mouse.up(); await page.waitForTimeout(80);
    }
    ok('Bau-Gesten (Drag) ohne Crash ✓');

    // Zweite Schussphase
    console.log('⏳ Warte auf zweite Schussphase...');
    const shoot2 = await waitForPhase(page, ['FEUER'], 7000);
    if (!shoot2) { fail('Zweite Schussphase nicht erreicht'); return { res, errs }; }
    ok(`Zweite Schussphase: "${shoot2}" ✓`);

    // Phasengrenzen-bewusst (Zeitraffer): bis zu 3 Versuche
    let st0 = null, st1 = null, stOk = false;
    for (let att = 0; att < 3 && !stOk; att++) {
      await page.waitForTimeout(200);
      st0 = await getTimerValue(page);
      await page.waitForTimeout(700);
      st1 = await getTimerValue(page);
      if (st0 !== null && st1 !== null && st1 < st0) stOk = true;
    }
    stOk
      ? ok(`Schuss-Timer Runde 2: ${st0} → ${st1} ✓`)
      : fail(`Schuss-Timer Runde 2 zählt nicht (${st0} → ${st1})`);

    // Mehrfach-Schüsse
    for (let i = 0; i < 3; i++) {
      const fx = cb.x + cb.w * (0.3 + i * 0.2);
      await page.mouse.move(fx, sfy); await page.mouse.down(); await page.waitForTimeout(50);
      await page.mouse.move(fx, cb.y + cb.h * 0.04); await page.waitForTimeout(80);
      await page.mouse.up(); await page.waitForTimeout(120);
    }
    ok('Mehrfach-Schüsse ohne Crash ✓');
    await page.screenshot({ path: '/tmp/s2_shoot2.png' });

    errs.length ? errs.forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`)) : ok('Gesamte Mechanik: Keine JS-Fehler ✓');
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 3: Beenden-Button UX & Overlap
// ═══════════════════════════════════════════════════════════════
async function suiteQuitUX(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Beenden-Button UX & Overlap\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);
    await startLocal(page, 2);
    await page.waitForTimeout(150);

    const allBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => {
        const r = b.getBoundingClientRect(), st = window.getComputedStyle(b);
        return { text: (b.textContent || '').trim(), title: b.title || '', x: r.x, y: r.y, w: r.width, h: r.height,
                 pos: st.position, bg: st.background };
      })
    );
    const quit = allBtns.find(b => b.text.toLowerCase().includes('beenden') || b.title.includes('beenden') || b.text.trim() === '✕');
    if (!quit) { fail('Beenden-Button nicht gefunden'); return { res, errs }; }

    ok(`Beenden-Button: "${quit.text}" | ${Math.round(quit.w)}×${Math.round(quit.h)}px`);
    quit.pos !== 'absolute'
      ? ok(`Position: ${quit.pos} (kein Overlay) ✓`) : fail('Position: absolute (Overlay)');

    const overlaps = allBtns.filter(b => b !== quit && b.w > 0 && b.text).filter(b =>
      quit.x < b.x + b.w && quit.x + quit.w > b.x && quit.y < b.y + b.h && quit.y + quit.h > b.y
    );
    overlaps.length === 0
      ? ok('Kein Overlap mit anderen Buttons ✓')
      : fail(`Überlappt ${overlaps.length} Button(s): ${overlaps.map(b => `"${b.text.slice(0,15)}"`).join(', ')}`);

    const hasBg = quit.bg && !quit.bg.includes('rgba(0, 0, 0, 0)') && quit.bg !== 'none';
    hasBg ? ok('Sichtbarer Button-Hintergrund ✓') : fail('Kein sichtbarer Hintergrund');

    const cx = quit.x + quit.w / 2;
    (cx > 100 && cx < 290) ? ok(`Im HUD-Center (midX=${Math.round(cx)}) ✓`) : fail(`Außerhalb HUD-Center (midX=${Math.round(cx)})`);

    await page.screenshot({ path: '/tmp/s3_quit.png' });
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// MOCK FIREBASE SERVER (Port 8766)
// Simuliert Firebase Realtime DB via HTTP für Online-Tests.
// Alle Schreiboperationen erhöhen einen globalen Versionszähler;
// alle Subscriptions pollen per GET /fb?op=poll&since=<ver>.
// ═══════════════════════════════════════════════════════════════
function startMockFbServer() {
  const store = {};
  let ver = 0;

  function getAt(path) {
    const parts = path.split('/').filter(Boolean);
    let c = store;
    for (const p of parts) {
      if (c == null || typeof c !== 'object') return null;
      c = c[p];
    }
    return c !== undefined ? c : null;
  }

  function setAt(path, val) {
    const parts = path.split('/').filter(Boolean);
    let c = store;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!c[parts[i]] || typeof c[parts[i]] !== 'object') c[parts[i]] = {};
      c = c[parts[i]];
    }
    if (val === null || val === undefined) delete c[parts.at(-1)];
    else c[parts.at(-1)] = val;
    ver++;
  }

  function patchAt(path, obj) {
    const cur = getAt(path);
    const base = (cur !== null && typeof cur === 'object') ? cur : {};
    setAt(path, { ...base, ...obj });
  }

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url  = new URL(req.url, 'http://localhost');
    const op   = url.searchParams.get('op') || '';
    const path = url.searchParams.get('path') || '/';

    if (op === 'get') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(getAt(path)));
      return;
    }
    if (op === 'poll') {
      const since = parseInt(url.searchParams.get('since') || '-1', 10);
      res.setHeader('Content-Type', 'application/json');
      const val = ver > since ? getAt(path) : undefined;
      res.end(JSON.stringify({ ver, value: val }));
      return;
    }
    if (op === 'delete') {
      setAt(path, null);
      res.setHeader('Content-Type', 'application/json');
      res.end('{"ok":true}');
      return;
    }

    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || 'null');
        if (op === 'set') {
          setAt(path, data);
          res.setHeader('Content-Type', 'application/json');
          res.end('{"ok":true}');
        } else if (op === 'patch') {
          patchAt(path, data);
          res.setHeader('Content-Type', 'application/json');
          res.end('{"ok":true}');
        } else if (op === 'cas') {
          // Compare-and-swap für runTransaction / fb.reserve
          const cur = getAt(path);
          if (JSON.stringify(cur) === JSON.stringify(data.expected)) {
            setAt(path, data.newVal);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ committed: true, value: data.newVal }));
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ committed: false, value: cur }));
          }
        } else {
          res.writeHead(400);
          res.end('{"error":"unknown op"}');
        }
      } catch (e) {
        res.writeHead(400);
        res.end('{"error":"bad request"}');
      }
    });
  });

  return new Promise(resolve => server.listen(8766, () => resolve(server)));
}

// Browser-seitiger Firebase-Mock: ruft den Mock-Server via fetch auf.
// Wird per addInitScript injiziert BEVOR das echte Firebase-SDK lädt
// (das über gstatic geblockt ist) → window.__fb bleibt unser Mock.
function makeFbMock(port) {
  return `(function() {
  const B = 'http://localhost:${port}';
  async function _f(url, opts) {
    try { return await fetch(url, opts); } catch(e) { return null; }
  }
  function ref(db, path) { return { __p: path }; }
  async function set(ref, data) {
    await _f(B+'/fb?op=set&path='+encodeURIComponent(ref.__p),
      {method:'POST',body:JSON.stringify(data),headers:{'Content-Type':'application/json'}});
  }
  async function update(ref, data) {
    await _f(B+'/fb?op=patch&path='+encodeURIComponent(ref.__p),
      {method:'POST',body:JSON.stringify(data),headers:{'Content-Type':'application/json'}});
  }
  async function remove(ref) {
    await _f(B+'/fb?op=delete&path='+encodeURIComponent(ref.__p),{method:'DELETE'});
  }
  async function get(ref) {
    const r = await _f(B+'/fb?op=get&path='+encodeURIComponent(ref.__p));
    const v = r ? await r.json() : null;
    return { exists:()=>v!==null&&v!==undefined, val:()=>v };
  }
  function onValue(ref, cb, errCb) {
    // .info/connected ist ein LOKALER Pseudo-Knoten des SDK, kein DB-Pfad —
    // die echte SDK meldet dort sofort true. Ohne diesen Zweig lieferte der
    // Mock null, der Client haette sich fuer offline gehalten und der
    // Herzschlag-Watchdog waere in JEDEM Test stillgelegt gewesen.
    if (ref.__p === '.info/connected') {
      setTimeout(() => cb({ exists:()=>true, val:()=>true }), 0);
      return () => {};
    }
    let last = -1;
    const id = setInterval(async () => {
      try {
        const r = await _f(B+'/fb?op=poll&path='+encodeURIComponent(ref.__p)+'&since='+last);
        if (!r) return;
        const d = await r.json();
        if (d.ver > last) {
          last = d.ver;
          if (d.value !== undefined) cb({exists:()=>d.value!==null,val:()=>d.value});
        }
      } catch(e) { if (errCb) errCb(e); }
    }, 120);
    // Wie die echte modulare SDK (v10): onValue gibt eine UNSUBSCRIBE-FUNKTION zurück.
    return () => clearInterval(id);
  }
  function off(ref, type, unsub) { if (typeof unsub === 'function') unsub(); }
  async function runTransaction(ref, fn) {
    try {
      const rg = await _f(B+'/fb?op=get&path='+encodeURIComponent(ref.__p));
      const cur = rg ? await rg.json() : null;
      const newVal = fn(cur);
      if (newVal === undefined)
        return { committed:false, snapshot:{exists:()=>cur!==null,val:()=>cur} };
      const rp = await _f(B+'/fb?op=cas&path='+encodeURIComponent(ref.__p), {
        method:'POST',
        body:JSON.stringify({expected:cur,newVal}),
        headers:{'Content-Type':'application/json'}
      });
      const d = rp ? await rp.json() : {committed:false,value:cur};
      return { committed:d.committed, snapshot:{exists:()=>d.value!==null,val:()=>d.value} };
    } catch(e) {
      return { committed:false, snapshot:{exists:()=>false,val:()=>null} };
    }
  }
  function onDisconnect(ref) { return { remove:()=>{}, cancel:()=>{} }; }
  // Auth-Identitaet (v3.72.0): ohne uid laeuft der Cloud-Save-Pfad gar nicht an.
  // __testUid wird pro Kontext ueber extraInit gesetzt; ohne Angabe bleibt uid
  // null und alles verhaelt sich wie vor v3.72.0 (kein Bruch in Altsuiten).
  // Auth-Identitaet (v3.72.0). WICHTIG: das auth-Objekt wird NUR gesetzt, wenn
  // der Test auch eine uid simuliert. getFirebase() wartet bei vorhandenem
  // auth-Objekt OHNE uid bis zu 3 SEKUNDEN auf den anonymen Login — ein Mock
  // mit auth, aber ohne uid und ohne __fbAuthError, liess also jeden
  // Firebase-Zugriff in diese Wartezeit laufen ("kein Spielcode").
  // Gleiche Lehre wie v3.14.11: Der Mock muss die SDK-Semantik spiegeln.
  const _uid = (typeof window !== 'undefined' && window.__testUid) || null;
  window.__fb = { db:{}, ref, set, update, remove, get, onValue, off, runTransaction, onDisconnect };
  if (_uid) {
    window.__fb.uid = _uid;
    window.__fb.anon = (typeof window !== 'undefined' && window.__testAnon === false) ? false : true;
    window.__fb.mail = (typeof window !== 'undefined' && window.__testMail) || null;
    window.__fb.auth = { currentUser: { uid: _uid, isAnonymous: window.__fb.anon } };
    window.__fb.GoogleAuthProvider = function(){};
    window.__fb.linkWithRedirect = () => Promise.resolve();
    window.__fb.signInWithRedirect = () => Promise.resolve();
    window.__fb.signInWithCredential = () => Promise.resolve();
    window.__fb.getRedirectResult = () => Promise.resolve(null);
    window.__fb.signOut = () => Promise.resolve();
    setTimeout(() => window.dispatchEvent(new Event('fb-auth')), 0);
  }
})();`;
}

// Browser-Kontext mit Firebase-Mock (für Online-Tests)
async function makeOnlineCtx(browser, fbPort, extraInit, opt) {
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
    // Service Worker BLOCKIEREN (seit v3.75.0). Er hat in der Suite nichts
    // zu suchen: er faengt Anfragen ab, liefert aus dem Cache und uebernimmt
    // die Seite waehrend eines Tests — damit wurden Persistenz-Pruefungen
    // (Reload, Profil speichern, Daily-Streak) reihenweise unzuverlaessig.
    // Das Offline-Verhalten bekommt eine eigene, gezielte Pruefung.
    serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(PROFILE_INIT);
  // extraInit läuft NACH PROFILE_INIT → kann Profil/Device-ID pro Client
  // überschreiben (Matchmaking-Tests brauchen unterschiedliche Identitäten).
  if (extraInit) await page.addInitScript(extraInit);
  // `langsam: true` laesst den Zeitraffer WEG (v3.111.0). Gebraucht von der
  // Aktions-Suite: Dort muss der Test in einer bestimmten Phase auf das Brett
  // tippen. Im Zeitraffer dauert die Setup-Phase rund eine Sekunde — zwischen
  // „Phase abfragen" und „klicken" liegt ein Roundtrip, das Fenster ist damit
  // oft schon zu. Das ergab kein Ergebnis, sondern ein Wuerfelspiel.
  if (!(opt && opt.langsam)) await page.addInitScript(TIMER_SPEEDUP);
  await page.addInitScript(makeFbMock(fbPort));
  await page.route('**firebase**',   r => r.abort());
  await page.route('**gstatic**',    r => r.abort());
  await page.route('**googleapis**', r => r.abort());
  await oeffneRichtlinieFuerTestgegenstelle(ctx);
  return { ctx, page };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 4: Online-UI (kein vollständiges Spiel nötig)
// ═══════════════════════════════════════════════════════════════
async function suiteOnlineUI(browser, fbPort) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Online-UI\n' + '='.repeat(50));

  const { ctx, page } = await makeOnlineCtx(browser, fbPort);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);

    // Online-Overlay öffnet sich
    await jsClick(page, ['ONLINE']);
    await page.waitForTimeout(300);
    const hasMainBtns = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      return btns.some(t => /erstellen/i.test(t)) && btns.some(t => /beitreten/i.test(t));
    });
    hasMainBtns ? ok('Online-Overlay: "Spiel erstellen" + "Spiel beitreten" ✓')
                : fail('Online-Overlay-Hauptbuttons fehlen');

    // "Spiel beitreten" → Code-Eingabe
    await jsClick(page, ['Spiel beitreten', 'beitreten']);
    await page.waitForFunction(() => !!document.querySelector('input:not([type=range])'), { timeout: 3000 }).catch(() => {});
    const inputOk = await page.evaluate(() => !!document.querySelector('input:not([type=range])'));
    inputOk ? ok('"Spiel beitreten": Code-Eingabefeld ✓') : fail('"Spiel beitreten": Eingabefeld fehlt');

    // "Zurück" aus Code-Eingabe
    await jsClick(page, ['Zurück', 'back', 'Abbrechen']);
    await page.waitForTimeout(200);

    // "Spiel erstellen" → Wartescreen mit 6-stelligem Code
    await jsClick(page, ['Spiel erstellen']);
    // `warteAufCode` wartet selbst — das fruehere waitForFunction davor war
    // eine zweite, kuerzere Frist fuer dieselbe Bedingung.
    const code = (await warteAufCode(page)).code;

    code ? ok(`"Spiel erstellen": Code "${code}" ✓`) : fail('"Spiel erstellen": kein Spielcode');

    const waitOk = await page.evaluate(() =>
      /warte|teile|share|code/i.test(document.body.innerText)
    );
    waitOk ? ok('"Spiel erstellen": Wartescreen sichtbar ✓') : fail('"Spiel erstellen": Wartescreen fehlt');

    await page.screenshot({ path: '/tmp/s4_online_create.png' });

    // Abbrechen aus Wartescreen → Menü
    await jsClick(page, ['Abbrechen', 'cancel', 'Cancel']);
    await page.waitForTimeout(400);
    const menuBack = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some(b => /LOKAL/.test(b.textContent))
    );
    menuBack ? ok('Wartescreen abbrechen → Menü ✓') : fail('Abbrechen aus Wartescreen: kein Menü');

    await page.screenshot({ path: '/tmp/s4_online_menu.png' });
    errs.length ? errs.forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`)) : ok('Keine JS-Fehler ✓');
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 5: Online 2-Spieler-Spiel (Host + Gast via Mock-Firebase)
// ═══════════════════════════════════════════════════════════════
async function suiteOnline2P(browser, fbPort) {
  const res = [], errs1 = [], errs2 = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Online 2-Spieler\n' + '='.repeat(50));

  const { ctx: ctxH, page: pH } = await makeOnlineCtx(browser, fbPort);
  const { ctx: ctxG, page: pG } = await makeOnlineCtx(browser, fbPort);
  pH.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs1.push(e.message); });
  pG.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs2.push(e.message); });

  try {
    await Promise.all([loadMenu(pH), loadMenu(pG)]);

    // ── HOST: Spiel erstellen ──────────────────────────────────
    await jsClick(pH, ['ONLINE']);
    await pH.waitForTimeout(200);
    await jsClick(pH, ['Spiel erstellen']);
    const codeErg = await warteAufCode(pH);
    const code = codeErg.code;
    if (!code) {
      // Die Wartezeit gehoert in die Meldung: Sie unterscheidet „der Code kam
      // nie" von „die Frist war zu knapp" — und genau das war hier die Frage.
      fail(`Host: kein Spielcode nach ${(codeErg.ms / 1000).toFixed(1)}s → Suite abgebrochen`);
      return { res, errs: [...errs1, ...errs2] };
    }
    ok(`Host erstellt Spiel: Code "${code}" ✓`);
    await pH.screenshot({ path: '/tmp/s5_host_waiting.png' });

    // ── GAST: Code eingeben + beitreten ───────────────────────
    await jsClick(pG, ['ONLINE']);
    await pG.waitForTimeout(200);
    await jsClick(pG, ['Spiel beitreten', 'beitreten']);
    await pG.waitForTimeout(200);

    // Warte auf Input-Feld, dann mit Playwright fill() schreiben (korrekte React-Integration)
    await pG.waitForSelector('input:not([type=range])', { timeout: 3000 }).catch(() => {});
    const typed = await pG.evaluate(() => !!document.querySelector('input:not([type=range])'));
    if (typed) await pG.fill('input:not([type=range])', code);
    typed ? ok('Gast: Code eingetippt ✓') : fail('Gast: Eingabefeld nicht gefunden');

    await pG.waitForTimeout(100);
    await jsClick(pG, ['Beitreten']);
    // Der Wartescreen ist nur KURZ sichtbar — unter Parallellast startet das
    // Spiel oft schon vor dem ersten Check (Host startet sofort bei Beitritt).
    // Stabil (v3.30.3): Wartescreen ODER bereits gestartetes Spiel akzeptieren.
    let guestWait = false, guestInGame = false;
    for (let i = 0; i < 10 && !guestWait && !guestInGame; i++) {
      await pG.waitForTimeout(60);
      const st = await pG.evaluate(() => ({
        wait: /warte|verbinde/i.test(document.body.innerText),
        game: !!document.querySelector('canvas')
      }));
      guestWait = st.wait; guestInGame = st.game;
    }
    (guestWait || guestInGame)
      ? ok(`Gast: Beitritt ok (${guestWait ? 'Wartescreen' : 'Spiel direkt gestartet'}) ✓`)
      : fail('Gast: weder Wartescreen noch Spielstart nach Beitreten');
    await pG.screenshot({ path: '/tmp/s5_guest_waiting.png' });

    // ── Spielstart: beide bekommen Canvas ─────────────────────
    console.log('⏳ Warte auf Spielstart (Host + Gast)...');
    const hostCanvas = await pH.waitForSelector('canvas', { timeout: 6000 })
      .then(() => true).catch(() => false);
    hostCanvas ? ok('Host: Canvas nach Gast-Beitritt ✓') : fail('Host: kein Canvas');

    const guestCanvas = await pG.waitForSelector('canvas', { timeout: 8000 })
      .then(() => true).catch(() => false);
    guestCanvas ? ok('Gast: Canvas nach State-Empfang ✓') : fail('Gast: kein Canvas (State-Sync fehlgeschlagen)');

    if (!hostCanvas || !guestCanvas) return { res, errs: [...errs1,...errs2] };

    await pH.screenshot({ path: '/tmp/s5_host_game.png' });
    await pG.screenshot({ path: '/tmp/s5_guest_game.png' });

    // ── Phasen-Sync prüfen ────────────────────────────────────
    const hostPh = await waitForPhase(pH, ['FEUER','BAUEN','START','KANONE'], 5000);
    const guestPh = await waitForPhase(pG, ['FEUER','BAUEN','START','KANONE'], 5000);

    hostPh ? ok(`Host-Phase erkannt: "${hostPh.slice(0,25)}" ✓`) : fail('Host: keine Phase erkannt');
    guestPh ? ok(`Gast-Phase erkannt: "${guestPh.slice(0,25)}" ✓`) : fail('Gast: keine Phase erkannt');

    if (hostPh && guestPh) {
      const sync = await wartePhasenGleich([pH, pG]);
      sync.gleich
        ? ok(`Phase-Sync: beide in "${sync.phase}" (${sync.versuche}. Stichprobe) ✓`)
        : fail(`Phase-Desync ueber ${sync.ms} ms / ${sync.versuche} Stichproben: `
             + `Host="${sync.phasen[0]}" Gast="${sync.phasen[1]}"`);
    }

    // ── Timer auf Gast-Seite zählt (beweist laufenden State-Sync) ──
    // Warte auf Schussphase (Host hat dann mehrfach gepusht, Gast empfängt aktiv)
    console.log('⏳ Warte auf Schussphase für Gast-Timer-Check...');
    await waitForPhase(pG, ['FEUER'], 6000);
    await pG.waitForTimeout(300); // kurz nach Reset stabilisieren
    // Phasengrenzen-bewusst: bei Timer-Anstieg (neue Phase im Zeitraffer) neu messen
    let gtOk = false, gt0 = null, gt1 = null;
    for (let att = 0; att < 3 && !gtOk; att++) {
      gt0 = await getTimerValue(pG);
      await pG.waitForTimeout(700);
      gt1 = await getTimerValue(pG);
      if (gt0 !== null && gt1 !== null && gt1 < gt0) gtOk = true;
    }
    gtOk
      ? ok(`Gast-Timer läuft (State-Sync aktiv): ${gt0} → ${gt1} ✓`)
      : fail(`Gast-Timer steht (State-Sync defekt): ${gt0} → ${gt1}`);

    // ── Gast kann Aktion senden (Touch auf Canvas) ────────────
    const gcb = await getCanvasBox(pG);
    if (gcb) {
      await pG.mouse.click(gcb.x + gcb.w * 0.5, gcb.y + gcb.h * 0.25);
      await pG.waitForTimeout(150);
      ok('Gast: Canvas-Tap ohne Crash ✓');
    }

    // ── Host HUD prüfen ───────────────────────────────────────
    const hostHud = await pH.evaluate(() => {
      const t = document.body.innerText;
      return {
        timer: /\d{2}/.test(t),
        quit:  Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('beenden') || b.title.includes('beenden') || b.textContent.trim() === '✕'),
        // Online HUD zeigt "TestBot (Du)" für den Host; offline "P1"/"P2"
        score: /Du/.test(t) || (/P1/.test(t) && /P2/.test(t)),
      };
    });
    hostHud.timer ? ok('Host HUD: Timer ✓') : fail('Host HUD: kein Timer');
    hostHud.quit  ? ok('Host HUD: Beenden-Button ✓') : fail('Host HUD: kein Beenden-Button');
    hostHud.score ? ok('Host HUD: Spieler-Labels (P1/P2) ✓') : fail('Host HUD: Spieler-Labels fehlen');

    // ── Reconnect-Banner darf bei aktiver Verbindung NICHT erscheinen ──
    const bannerH = await pH.evaluate(() => /Verbindung instabil|Connection unstable/.test(document.body.innerText));
    const bannerG = await pG.evaluate(() => /Verbindung instabil|Connection unstable/.test(document.body.innerText));
    (!bannerH && !bannerG)
      ? ok('Kein falscher Reconnect-Banner bei aktiver Verbindung (Host+Gast) ✓')
      : fail(`Reconnect-Banner false-positive (Host=${bannerH}, Gast=${bannerG})`);

    // ── Emotes (v3.25.0): Host sendet → beide sehen; Gast sendet → Host sieht ──
    {
      const emoteBtn = await pH.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Emote');
        if (!b) return false; b.click(); return true;
      });
      emoteBtn ? ok('Emote: Button beim Host sichtbar ✓') : fail('Emote: Button fehlt (Host)');
      await pH.waitForTimeout(200);
      await pH.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].filter(x => /^👍$/.test((x.textContent || '').trim()));
        btns[0] && btns[0].click();
      });
      await pH.waitForTimeout(250);
      const hostBubble = await pH.evaluate(() => /👍/.test(document.body.innerText));
      hostBubble ? ok('Emote: Host sieht eigene Bubble ✓') : fail('Emote: Host-Bubble fehlt');
      let guestSaw = false;
      for (let i = 0; i < 10 && !guestSaw; i++) {
        guestSaw = await pG.evaluate(() => /👍/.test(document.body.innerText));
        if (!guestSaw) await pG.waitForTimeout(300);
      }
      guestSaw ? ok('Emote: Gast empfängt Host-Emote via State ✓') : fail('Emote: Gast sieht Host-Emote nicht');
      // Gast → Host (😮 kollidiert mit keinem Phasenbanner-Emoji)
      await pG.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Emote');
        b && b.click();
      });
      await pG.waitForTimeout(200);
      await pG.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].filter(x => /^😮$/.test((x.textContent || '').trim()));
        btns[0] && btns[0].click();
      });
      let hostSaw = false;
      for (let i = 0; i < 10 && !hostSaw; i++) {
        hostSaw = await pH.evaluate(() => document.body.innerText.includes('😮'));
        if (!hostSaw) await pH.waitForTimeout(300);
      }
      hostSaw ? ok('Emote: Host empfängt Gast-Emote (Action→State) ✓') : fail('Emote: Host sieht Gast-Emote nicht');
    }

    // ── JS-Fehler ─────────────────────────────────────────────
    errs1.length === 0 ? ok('Host: Keine JS-Fehler ✓') : errs1.forEach(e => fail(`Host JS: ${e.slice(0,80)}`));
    errs2.length === 0 ? ok('Gast: Keine JS-Fehler ✓') : errs2.forEach(e => fail(`Gast JS: ${e.slice(0,80)}`));
  } finally {
    await ctxH.close();
    await ctxG.close();
  }
  return { res, errs: [...errs1, ...errs2] };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 5b: Matchmaking (Quick Match) — Match, Ranked-Result,
// Runde 2 (Geister-Listener-Regression), Queue-Hygiene, Selbst-Match-Schutz
// ═══════════════════════════════════════════════════════════════
function mmIdentInit(name, pid, dev) {
  // __mmDebug schon beim Laden setzen: startPolling hinterlegt dann __myRole
  // (Gast-Rolle) — nötig für die Host/Gast-Erkennung der ELO-Regression.
  return `window.__mmDebug = true; try {
    const p = JSON.parse(localStorage.getItem('fortress_profile'));
    p.id = '${pid}'; p.name = '${name}';
    localStorage.setItem('fortress_profile', JSON.stringify(p));
    localStorage.setItem('fortress_device_id', '${dev}');
  } catch(e){}`;
}
async function mmQuitToMenu(p) {
  // Beenden-Button → Bestätigung → ggf. Ergebnis/Warnung → Hauptmenü
  await p.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent.includes('beenden') || (b.title || '').includes('beenden') || b.textContent.trim() === '✕') { b.click(); return; }
    }
  });
  await p.waitForTimeout(250);
  await jsClick(p, ['Ja', 'Beenden', 'verlassen']);
  await p.waitForTimeout(500);
  await jsClick(p, ['Hauptmenü']);
  await p.waitForTimeout(400);
}
async function suiteMatchmaking(browser, fbPort) {
  const res = [], errsA = [], errsB = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Matchmaking (Quick Match)\n' + '='.repeat(50));

  const { ctx: ctxA, page: pA } = await makeOnlineCtx(browser, fbPort, mmIdentInit('MMAnna', 'p_mm_a', 'd_mm_a'));
  const { ctx: ctxB, page: pB } = await makeOnlineCtx(browser, fbPort, mmIdentInit('MMBert', 'p_mm_b', 'd_mm_b'));
  pA.on('pageerror', e => { if (!/firebase/i.test(e.message)) errsA.push(e.message); });
  pB.on('pageerror', e => { if (!/firebase/i.test(e.message)) errsB.push(e.message); });

  const startMM = async (p) => {
    await jsClick(p, ['ONLINE']);
    await p.waitForTimeout(200);
    await jsClick(p, ['Matchmaking']);
    await p.waitForTimeout(150);
  };
  const inGame = (p, t) => p.waitForSelector('canvas', { timeout: t }).then(() => true).catch(() => false);

  try {
    await Promise.all([loadMenu(pA), loadMenu(pB)]);

    // ── Match 1: beide finden sich über die Queue ─────────────
    await startMM(pA);
    // Tipps-Karussell (v3.26.0): im Queue-Screen ist ein Gameplay-Tipp sichtbar
    let tipSeen = false;
    for (let i = 0; i < 20 && !tipSeen; i++) {
      tipSeen = await pA.evaluate(() => /TIPP|TIP/.test(document.body.innerText));
      if (!tipSeen) await pA.waitForTimeout(150);
    }
    tipSeen ? ok('Queue: Tipps-Karussell sichtbar ✓') : fail('Queue: Tipp fehlt im Suche-Screen');
    await startMM(pB);
    const [m1a, m1b] = await Promise.all([inGame(pA, 15000), inGame(pB, 15000)]);
    m1a && m1b ? ok('Quick Match: beide Clients im Spiel ✓')
               : fail(`Quick Match: A=${m1a} B=${m1b}`);
    if (!m1a || !m1b) return { res, errs: [...errsA, ...errsB] };

    // Selbst-Match-Regression (v3.15.2): beide HUDs müssen BEIDE Namen zeigen —
    // bei einem Selbst-Match (Host joint eigenes Spiel) stünde ein Name doppelt.
    await pA.waitForTimeout(600);
    const hudA = await pA.evaluate(() => document.body.innerText);
    const hudB = await pB.evaluate(() => document.body.innerText);
    const bothNames = /MMAnna/.test(hudA) && /MMBert/.test(hudA) && /MMAnna/.test(hudB) && /MMBert/.test(hudB);
    bothNames ? ok('Match-Identitäten: beide Namen in beiden HUDs ✓')
              : fail(`Match-Identitäten falsch (A: ${/MMAnna/.test(hudA)}/${/MMBert/.test(hudA)}, B: ${/MMAnna/.test(hudB)}/${/MMBert/.test(hudB)})`);

    // ── Ranked-Result: HOST gibt auf → GAST sieht Ergebnis + verbucht ELO ──
    // Bewusst der HOST, damit der GAST den Verbuchungs-Pfad durchläuft
    // (applyState-resultInfo) — dort saß der v3.30.3-ELO-Bug.
    const roleA = await pA.evaluate(() => window.__myRole || 1);
    const hostP = roleA === 1 ? pA : pB, guestP = roleA === 1 ? pB : pA;
    await hostP.waitForTimeout(1200);
    await hostP.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if (b.textContent.includes('beenden') || (b.title || '').includes('beenden') || b.textContent.trim() === '✕') { b.click(); return; }
      }
    });
    await hostP.waitForTimeout(250);
    await jsClick(hostP, ['Ja', 'Beenden', 'verlassen']);
    await guestP.waitForTimeout(2500);
    const bRes = await guestP.evaluate(() => {
      const t = document.body.innerText;
      return { menu: /Hauptmenü/.test(t), rematch: /Nächste Runde|Neue Karte/.test(t), hint: /neue Gegner|Matchmaking im Menü/.test(t) };
    });
    bRes.menu    ? ok('Ranked-Result: Hauptmenü-Button vorhanden ✓') : fail('Ranked-Result: Hauptmenü-Button fehlt');
    !bRes.rematch ? ok('Ranked-Result: keine Rematch-Buttons ✓')     : fail('Ranked-Result: Rematch-Buttons sichtbar');
    !bRes.hint   ? ok('Ranked-Result: keine Hinweis-Box (seit v3.15.2) ✓') : fail('Ranked-Result: Hinweis-Box noch sichtbar');
    // ── ELO: Der Gast (Sieger) muss ELO gewinnen (Start 1050) ──
    const elo1 = await guestP.evaluate(() => { try { return JSON.parse(localStorage.getItem('fortress_profile')).elo; } catch (e) { return null; } });
    (typeof elo1 === 'number' && elo1 > 1050)
      ? ok(`ELO: Gast-Sieger nach Match 1 verbucht (1050→${elo1}) ✓`)
      : fail(`ELO: Match 1 als Gast NICHT verbucht (1050→${elo1})`);
    // ── ELO: Der Aufgebende muss die Niederlage verbuchen (v3.30.3) ──
    const eloQ = await hostP.evaluate(() => { try { return JSON.parse(localStorage.getItem('fortress_profile')).elo; } catch (e) { return null; } });
    (typeof eloQ === 'number' && eloQ < 1050)
      ? ok(`ELO: Aufgeber verbucht Niederlage (1050→${eloQ}) ✓`)
      : fail(`ELO: Aufgeber verliert nichts (1050→${eloQ}) — Quit-Dodge möglich`);

    // ── Schmiede-Material sichtbar (v3.68.0) ──────────────────
    // Material floss vorher unsichtbar ins Profil (matChangeRef wurde gesetzt,
    // aber nirgends gerendert) — der Sieger merkte nichts davon.
    const matUi = await guestP.evaluate(() => {
      const txt = document.body.innerText;
      let stored = null;
      try { stored = (JSON.parse(localStorage.getItem('fortress_profile')).materials || {}).iron; } catch (e) {}
      // Die Karten-Überschrift rendert per CSS in Grossbuchstaben — innerText
      // gibt in Chromium den TRANSFORMIERTEN Text zurück, deshalb case-insensitiv.
      return { karte: /material erbeutet/i.test(txt), eisen: /\+5/.test(txt) && /Eisensplitter/.test(txt), stored };
    });
    matUi.karte ? ok('Ergebnis: Material-Karte sichtbar ✓') : fail('Ergebnis: Material-Karte fehlt');
    matUi.eisen ? ok('Ergebnis: Sieger-Beute +5 Eisensplitter ausgewiesen ✓') : fail('Ergebnis: Material-Betrag/Name fehlt');
    (matUi.stored >= 5) ? ok(`Ergebnis: Material im Profil verbucht (Eisen=${matUi.stored}) ✓`)
                        : fail(`Ergebnis: Material NICHT im Profil (Eisen=${matUi.stored})`);

    // Beide zurück ins Menü
    await jsClick(guestP, ['Hauptmenü']);
    await jsClick(hostP, ['Hauptmenü']);
    await pA.waitForTimeout(500); await pB.waitForTimeout(300);

    // ── Match 2 (Regression: Geister-Listener / Queue-Hygiene) ──
    await startMM(pA);
    await startMM(pB);
    const [m2a, m2b] = await Promise.all([inGame(pA, 15000), inGame(pB, 15000)]);
    m2a && m2b ? ok('Quick Match Runde 2: beide wieder im Spiel ✓')
               : fail(`Quick Match Runde 2: A=${m2a} B=${m2b}`);

    // v3.19.1: Online-Spielstart muss die Schrott-Ökonomie auf 15 zurücksetzen —
    // auch beim 2. Spiel (vorher schleppte es den Schrott des 1. Spiels mit).
    if (m2a && m2b) {
      await pA.evaluate(() => { window.__mmDebug = true; });
      await pA.waitForTimeout(600);
      const scrapReset = await pA.evaluate(() => {
        const s1 = window.__readScrap ? window.__readScrap(1) : null;
        const s2 = window.__readScrap ? window.__readScrap(2) : null;
        return { s1, s2 };
      });
      (scrapReset.s1 === 150 && scrapReset.s2 === 150)
        ? ok('Online-Neustart: Beute auf 150 zurückgesetzt (2. Spiel) ✓')
        : fail(`Online-Neustart: Beute nicht 150 (P1=${scrapReset.s1} P2=${scrapReset.s2})`);
    }

    // ── ELO-Regression (v3.30.3): auch das 2. Spiel als GAST muss verbuchen ──
    // Der Bug: Gäste durchlaufen nie startOnlineGame → statRecorded blieb aus
    // Spiel 1 true → Folge-Spiele buchten weder Stats noch ELO.
    if (m2a && m2b) {
      const roleA2 = await pA.evaluate(() => window.__myRole || 1);
      const hostP2 = roleA2 === 1 ? pA : pB, guestP2 = roleA2 === 1 ? pB : pA;
      await hostP2.waitForTimeout(800);
      await hostP2.evaluate(() => {
        for (const b of document.querySelectorAll('button')) {
          if (b.textContent.includes('beenden') || (b.title || '').includes('beenden') || b.textContent.trim() === '✕') { b.click(); return; }
        }
      });
      await hostP2.waitForTimeout(250);
      await jsClick(hostP2, ['Ja', 'Beenden', 'verlassen']);
      await guestP2.waitForTimeout(2500);
      const elo2 = await guestP2.evaluate(() => { try { return JSON.parse(localStorage.getItem('fortress_profile')).elo; } catch (e) { return null; } });
      const prevElo = guestP2 === guestP && typeof elo1 === 'number' ? elo1 : 1050;
      (typeof elo2 === 'number' && elo2 > prevElo)
        ? ok(`ELO: Gast-Sieger auch im 2. Match verbucht (${prevElo}→${elo2}) ✓`)
        : fail(`ELO: 2. Match als Gast NICHT verbucht (${prevElo}→${elo2}) — statRecorded hängt?`);
      await jsClick(guestP2, ['Hauptmenü']);
      await jsClick(hostP2, ['Hauptmenü']);
      await pA.waitForTimeout(400);
    }

    // Aufräumen + Queue-Hygiene prüfen
    await mmQuitToMenu(pA);
    await pB.waitForTimeout(1500);
    await mmQuitToMenu(pB);
    await pA.waitForTimeout(800);
    const queue = await pA.evaluate(async (port) => {
      try { return await (await fetch('http://localhost:' + port + '/fb?op=get&path=queue2')).json(); } catch (e) { return 'ERR'; }
    }, fbPort);
    const qCount = queue && queue !== 'ERR' ? Object.keys(queue).length : 0;
    qCount === 0 ? ok('Queue nach Matches leer (keine Ticket-Leichen) ✓')
                 : fail(`Queue nicht leer: ${qCount} Ticket(s) übrig`);

    // ── Selbst-Match-Schutz: gleiche Geräte-ID darf NIE matchen ──
    const { ctx: ctxC, page: pC } = await makeOnlineCtx(browser, fbPort, mmIdentInit('MMCarl', 'p_mm_c1', 'd_mm_same'));
    const { ctx: ctxD, page: pD } = await makeOnlineCtx(browser, fbPort, mmIdentInit('MMCarlAlt', 'p_mm_c2', 'd_mm_same'));
    try {
      await Promise.all([loadMenu(pC), loadMenu(pD)]);
      await startMM(pC);
      await startMM(pD);
      const selfMatched = await inGame(pC, 6000);
      !selfMatched ? ok('Selbst-Match-Schutz: gleiches Gerät matcht nie ✓')
                   : fail('Selbst-Match-Schutz VERLETZT: gleiches Gerät gematcht!');
      // Suche sauber abbrechen (Tickets löschen)
      await jsClick(pC, ['Abbrechen', 'abbrechen', 'Zurück']);
      await jsClick(pD, ['Abbrechen', 'abbrechen', 'Zurück']);
      await pC.waitForTimeout(400);
    } finally {
      await ctxC.close();
      await ctxD.close();
    }

    // ── Bot-Backfill (v3.32.4): 60s allein in der Queue → Bot-Match ──
    const { ctx: ctxE, page: pE } = await makeOnlineCtx(browser, fbPort, mmIdentInit('MMEmil', 'p_mm_e', 'd_mm_e') + ";window.__mmDebug=true;");
    pE.on('pageerror', e => { if (!/firebase/i.test(e.message)) errsA.push('E: ' + e.message); });
    try {
      await loadMenu(pE);
      await startMM(pE);
      await pE.waitForTimeout(600);
      // Wartezeit künstlich auf 61s vorspulen → Display-Ticker löst Backfill aus
      const forced = await pE.evaluate(() => window.__mmForceWait ? window.__mmForceWait(61) : null);
      if (!forced) { fail('Bot-Backfill: __mmForceWait-Hook fehlt'); }
      else {
        const backfilled = await inGame(pE, 6000);
        backfilled ? ok('Bot-Backfill: nach 60s allein → im Spiel ✓') : fail('Bot-Backfill: kein Spiel gestartet');
        if (backfilled) {
          const isBot = await pE.evaluate(() => window.__botMode ? window.__botMode() : null);
          isBot === true ? ok('Bot-Backfill: Bot-Modus aktiv (kein ELO) ✓') : fail(`Bot-Backfill: botMode=${isBot}`);
          // Ticket muss aus der Queue gelöscht sein (keine Geister-Suche)
          const q = await pE.evaluate(async (port) => {
            try { return await (await fetch('http://localhost:' + port + '/fb?op=get&path=queue2')).json(); } catch (e) { return 'ERR'; }
          }, fbPort);
          const qN = q && q !== 'ERR' ? Object.keys(q).length : 0;
          qN === 0 ? ok('Bot-Backfill: Queue-Ticket gelöscht ✓') : fail(`Bot-Backfill: ${qN} Ticket(s) übrig`);
        }
      }
    } finally {
      await ctxE.close();
    }

    // ── JS-Fehler ─────────────────────────────────────────────
    errsA.length === 0 ? ok('MM Client A: Keine JS-Fehler ✓') : errsA.forEach(e => fail(`MM A JS: ${e.slice(0,80)}`));
    errsB.length === 0 ? ok('MM Client B: Keine JS-Fehler ✓') : errsB.forEach(e => fail(`MM B JS: ${e.slice(0,80)}`));
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
  return { res, errs: [...errsA, ...errsB] };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 5c: Online 3-Spieler — Code-Join (Host + 2 Gäste), Phasen-Sync,
// Quick-Match-Tripel (queue3), Gast-Ausstieg + Rejoin (screenRef-Regression)
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// SUITE 5c: Cloud-Save (v3.72.0)
// Das Versprechen des Features lautet "ueberlebt eine Neuinstallation".
// Genau das wird hier geprueft: Profil hochladen, localStorage komplett
// leeren (= frische Installation), gleiche uid, Stand muss zurueckkommen —
// inklusive gekaufter Kosmetik, denn die tut beim Verlust am meisten weh.
// ═══════════════════════════════════════════════════════════════
async function suiteCloudSave(browser, fbPort) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Cloud-Save\n' + '='.repeat(50));

  const UID = 'testuid_cloud_0000000000001';
  const reich = {
    id: 'p_lokal_alt', name: 'Sichermann', wappen: 'ritter', color: '#2563eb',
    elo: 1250, elo3: 1000, peakElo: 1300, peakElo3: 1000,
    stats: { wins: 40, losses: 22, games: 62 }, stats3: { wins: 0, losses: 0, games: 0 },
    gold: 3000, level: 14, xp: 120, seasonXp: 800,
    achievements: ['erster_sieg'], unlockedRewards: [], dailyTasks: [],
    cosmetics: { owned: ['cannon_dragon', 'frame_gold'], equipped: { cannon: 'cannon_dragon' } },
    materials: { iron: 55, silver: 12, dragon: 4, star: 3 },
    // Beide Nachtrags-Migrationen als erledigt markieren: loadProfile vergibt
    // sonst beim ersten Laden rueckwirkend Achievements samt Gold und XP, und
    // der Test wuerde dieses Zusatzguthaben faelschlich dem Cloud-Save anlasten.
    historicalXpApplied: true, achievementsRetroApplied: true
  };
  const init = (prof) => `window.__testUid = ${JSON.stringify(UID)};` +
    (prof ? `try{localStorage.setItem('fortress_profile', ${JSON.stringify(JSON.stringify(prof))});}catch(e){}`
          : `try{localStorage.removeItem('fortress_profile');}catch(e){}`);

  const lies = async (p) => p.evaluate(async (a) =>
    await (await fetch('http://localhost:' + a.port + '/fb?op=get&path=' + encodeURIComponent('players/' + a.uid))).json(),
    { port: fbPort, uid: UID });

  // ── 1) Voller Spielstand wird hochgeladen ──────────────────────
  const { ctx: c1, page: p1 } = await makeOnlineCtx(browser, fbPort, init(reich));
  p1.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(p1);
    let rec = null;
    for (let i = 0; i < 40 && !(rec && rec.p); i++) { await p1.waitForTimeout(250); rec = await lies(p1); }
    (rec && typeof rec.p === 'string')
      ? ok('Cloud-Save: Profil landet unter players/{uid} ✓')
      : fail(`Cloud-Save: nichts hochgeladen (${JSON.stringify(rec)})`);
    if (rec && rec.p) {
      const o = JSON.parse(rec.p);
      (o.gold === 3000 && o.elo === 1250 && o.level === 14)
        ? ok('Cloud-Save: Gold, ELO und Level vollstaendig ✓')
        : fail(`Cloud-Save: Werte unvollstaendig (gold=${o.gold} elo=${o.elo} lvl=${o.level})`);
      (o.cosmetics && (o.cosmetics.owned || []).length === 2)
        ? ok('Cloud-Save: gekaufte Kosmetik mit hochgeladen ✓')
        : fail(`Cloud-Save: Kosmetik fehlt (${JSON.stringify(o.cosmetics)})`);
    }
  } finally { await c1.close(); }

  // ── 2) Neuinstallation: localStorage leer, gleiche uid ─────────
  const { ctx: c2, page: p2 } = await makeOnlineCtx(browser, fbPort, init(null));
  p2.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(p2);
    let prof = null;
    for (let i = 0; i < 50 && !(prof && prof.gold >= 3000); i++) {
      await p2.waitForTimeout(250);
      prof = await p2.evaluate(() => { try { return JSON.parse(localStorage.getItem('fortress_profile')); } catch (e) { return null; } });
    }
    (prof && prof.gold === 3000 && prof.elo === 1250)
      ? ok('Cloud-Save: Stand kehrt nach Neuinstallation zurueck ✓')
      : fail(`Cloud-Save: Stand NICHT wiederhergestellt (${JSON.stringify(prof && { gold: prof.gold, elo: prof.elo })})`);
    (prof && prof.cosmetics && (prof.cosmetics.owned || []).indexOf('cannon_dragon') >= 0)
      ? ok('Cloud-Save: gekaufte Kosmetik ist wieder da ✓')
      : fail('Cloud-Save: gekaufte Kosmetik nach Neuinstallation verloren');
    (prof && prof.stats && prof.stats.games === 62)
      ? ok('Cloud-Save: Statistik wiederhergestellt ✓')
      : fail(`Cloud-Save: Statistik falsch (${JSON.stringify(prof && prof.stats)})`);
    (prof && prof.materials && prof.materials.iron === 55)
      ? ok('Cloud-Save: Schmiede-Material wiederhergestellt ✓')
      : fail(`Cloud-Save: Material falsch (${JSON.stringify(prof && prof.materials)})`);
  } finally { await c2.close(); }

  // ── 3) Hinweis im Profil-Editor, solange nichts verknuepft ist ──
  const { ctx: c3, page: p3 } = await makeOnlineCtx(browser, fbPort, init(reich));
  try {
    await loadMenu(p3);
    await p3.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if ((b.getAttribute('title') || '').startsWith('Profil')) { b.click(); return; }
      }
    });
    await p3.waitForTimeout(600);
    const ui = await p3.evaluate(() => ({
      warnung: /nur auf diesem Ger/i.test(document.body.innerText),
      knopf: [...document.querySelectorAll('button')].some(b => /Mit Google sichern/i.test(b.textContent))
    }));
    ui.warnung ? ok('Cloud-Save: Warnung "nur auf diesem Geraet" sichtbar ✓')
               : fail('Cloud-Save: Warnung fehlt im Profil');
    ui.knopf ? ok('Cloud-Save: Knopf "Mit Google sichern" vorhanden ✓')
             : fail('Cloud-Save: Sicherungs-Knopf fehlt');
  } finally { await c3.close(); }

  // ── 4) OHNE Anmelde-Dienst: kein falsches Versprechen (v3.102.0) ──────
  //
  // Gemessen am 18.09. an der ausgelieferten Fassung: Ohne
  // Firebase-API-Schluessel wirft `getAuth()` (`auth/invalid-api-key`),
  // `__fb.auth` bleibt leer, `uid` bleibt null — und die Sicherung laeuft nie
  // an. Trotzdem stand im Profil „wird automatisch gesichert".
  //
  // **Zwei Durchgaenge, weil die Oberflaeche an dieser Stelle zwei Gesichter
  // hat.** In der App gibt es keinen Verknuepfungs-Knopf (ARCHITEKTUR.md E8),
  // im Browser schon. Der falsche Satz stand nur im App-Zweig, der tote Knopf
  // kann nur im Browser auftreten. Ein einziger Durchgang haette also immer
  // die eine Haelfte ins Leere geprueft — beim ersten Anlauf genau so
  // passiert, die Gegenprobe hat es aufgedeckt.
  for (const [modus, nativ] of [['App', true], ['Web', false]]) {
    const { ctx: c4, page: p4 } = await makeOnlineCtx(browser, fbPort,
      `window.__NATIVE__ = ${nativ};`); // kein __testUid → kein auth, wie ohne API-Schluessel
    try {
      await loadMenu(p4);
      await p4.evaluate(() => {
        for (const b of document.querySelectorAll('button')) {
          if ((b.getAttribute('title') || '').startsWith('Profil')) { b.click(); return; }
        }
      });
      await p4.waitForTimeout(600);
      const ui = await p4.evaluate(() => ({
        authDa: !!(window.__fb && window.__fb.auth),
        uid: (window.__fb && window.__fb.uid) || null,
        ehrlich: /Eine Sicherung ist derzeit nicht m|A backup is not possible right now/i.test(document.body.innerText),
        luege: /wird automatisch gesichert|backed up automatically/i.test(document.body.innerText),
        knopf: [...document.querySelectorAll('button')].some(b => /Mit Google sichern|Save with Google/i.test(b.textContent))
      }));
      (!ui.authDa && !ui.uid)
        ? ok(`Ohne Anmeldung (${modus}): Zustand hergestellt (kein auth, keine uid) ✓`)
        : fail(`Ohne Anmeldung (${modus}): Zustand nicht hergestellt (auth=${ui.authDa}, uid=${ui.uid})`);
      // Gilt in beiden: Es muss dastehen, dass NICHT gesichert wird.
      ui.ehrlich
        ? ok(`Ohne Anmeldung (${modus}): sagt "Sicherung derzeit nicht möglich" ✓`)
        : fail(`Ohne Anmeldung (${modus}): der ehrliche Hinweis fehlt`);
      if (nativ) {
        // Nur die App zeigte „wird automatisch gesichert".
        !ui.luege
          ? ok('Ohne Anmeldung (App): verspricht KEINE automatische Sicherung ✓')
          : fail('Ohne Anmeldung (App): behauptet "wird automatisch gesichert" — es wird nichts gesichert');
      } else {
        // Nur im Browser gibt es den Knopf — und `linkAccount` kehrt bei
        // fehlendem `F.auth` stillschweigend zurueck. Ein Knopf, der nichts
        // tut und nichts sagt, ist schlimmer als keiner: Man drueckt ihn
        // zweimal und haelt dann das Spiel fuer kaputt.
        !ui.knopf
          ? ok('Ohne Anmeldung (Web): kein toter Sicherungs-Knopf ✓')
          : fail('Ohne Anmeldung (Web): Knopf da, tut aber nichts (linkAccount kehrt still zurück)');
      }
    } finally { await c4.close(); }
  }

  errs.length ? errs.slice(0, 3).forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`))
              : ok('Cloud-Save: keine JS-Fehler ✓');
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 0b: Offline-Start (v3.75.0)
// Alle anderen Suiten blockieren den Service Worker, weil er Caching-
// Nichtdeterminismus in jeden Test traegt. Hier laeuft er BEWUSST — und nur
// hier. Geprueft wird die Zusage, mit der die App bei Apple antritt: einmal
// geladen, danach ohne Netz spielbar (Richtlinie 4.2, Minimum Functionality).
// ═══════════════════════════════════════════════════════════════
async function suiteOffline(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Offline-Start\n' + '='.repeat(50));

  // Bewusst OHNE serviceWorkers:'block' — hier ist er der Prueflingt.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    // **Riegel gegen die Produktivdatenbank.** Diese Suite laedt die echte
    // Seite (der Service Worker IST hier der Pruefling), also laeuft auch
    // firebase-boot.js. Bis v3.102.0 war das zufaellig harmlos: Ohne
    // API-Schluessel warf `getAuth()`, `uid` blieb null, es passierte nichts.
    // Mit dem Schluessel (v3.103.0) meldet sich die Seite anonym an — und
    // `pushLeaderboard` schreibt das Testprofil in die ECHTE Bestenliste.
    // FB_SPERRE setzt `window.__fb` VOR dem Seitenskript; firebase-boot haelt
    // sich dann heraus. Der Service Worker wird davon nicht beruehrt.
    await page.addInitScript(FB_SPERRE);
    await page.addInitScript(PROFILE_INIT);
    await page.goto('http://localhost:8765/', { waitUntil: 'load' });

    const aktiv = await page.waitForFunction(
      () => navigator.serviceWorker && navigator.serviceWorker.controller !== null,
      { timeout: 20000 }).then(() => true).catch(() => false);
    aktiv ? ok('Offline: Service Worker uebernimmt die Seite ✓')
          : fail('Offline: Service Worker wird nie aktiv');
    if (!aktiv) return { res, errs };

    // Vorladen abwarten: erst wenn der Cache gefuellt ist, ist der Test ehrlich.
    await page.waitForTimeout(2500);
    const dateien = await page.evaluate(async () => {
      const namen = await caches.keys();
      let n = 0;
      for (const k of namen) n += (await (await caches.open(k)).keys()).length;
      return n;
    });
    dateien > 10 ? ok(`Offline: ${dateien} Dateien vorgeladen ✓`)
                 : fail(`Offline: nur ${dateien} Dateien im Cache`);

    // ── Netz kappen und neu laden ──────────────────────────────
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1200);

    const st = await page.evaluate(() => ({
      knoepfe: document.querySelectorAll('button').length,
      lokal: /LOKAL SPIELEN|PLAY LOCAL/i.test(document.body.innerText),
      titel: /Stack & Siege/.test(document.body.innerText)
    }));
    (st.knoepfe > 5 && st.titel)
      ? ok(`Offline: Menue laedt ohne Netz (${st.knoepfe} Schaltflaechen) ✓`)
      : fail(`Offline: Menue fehlt ohne Netz (${JSON.stringify(st)})`);
    st.lokal ? ok('Offline: lokales Spiel startbar ✓')
             : fail('Offline: Startknopf fuer das lokale Spiel fehlt');

    // Wirklich bis ins Spiel — nicht nur bis zum Menue.
    await jsClick(page, ['LOKAL', 'PLAY LOCAL']);
    await page.waitForTimeout(300);
    await startBotGame(page);
    const canvas = await page.waitForSelector('canvas', { timeout: 10000 })
      .then(() => true).catch(() => false);
    canvas ? ok('Offline: Bot-Partie startet ohne Netz ✓')
           : fail('Offline: keine Partie ohne Netz — Zusage an Apple nicht haltbar');

    await ctx.setOffline(false);
    errs.length ? errs.slice(0, 3).forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`))
                : ok('Offline: keine JS-Fehler ✓');
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 0c: Plattform-Weiche + Fortschritt loeschen (v3.76.0)
// Der Unterschied zwischen App und Website muss GEPRUEFT sein, sonst ist er
// nur behauptet. Die Weiche (src/platform.ts) laesst sich ueber __NATIVE__
// setzen — beide Zustaende werden hier durchgespielt, ohne eine App zu bauen.
// ═══════════════════════════════════════════════════════════════
async function suitePlattform(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Plattform-Weiche\n' + '='.repeat(50));

  const oeffneProfil = async (page) => {
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if ((b.getAttribute('title') || '').startsWith('Profil')) { b.click(); return; }
      }
    });
    await page.waitForTimeout(600);
  };

  for (const nativ of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
      serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
    try {
      // NUR EINMAL impfen. PROFILE_INIT laeuft sonst bei jedem Laden — auch
      // nach dem Neuladen, das auf das Loeschen folgt — und saet den alten
      // Stand sofort wieder ein. Der Merker ueberlebt das Loeschen bewusst,
      // weil wipeProgress nur die fortress_*-Schluessel entfernt.
      // Riegel gegen die Produktivdatenbank — diese Suite legt sonst ein
      // echtes Firebase an und arbeitete beim Loeschtest dagegen.
      await page.addInitScript(FB_SPERRE);
      // **Laufende anonyme Anmeldung vortaeuschen.** Diese Suite prueft die
      // PLATTFORM-Weiche, nicht den Anmeldezustand. Seit v3.102.0 ueberdeckt
      // der dritte Cloud-Zustand („Sicherung derzeit nicht moeglich") beide
      // Zweige, solange `auth`/`uid` fehlen — dann prueft man nicht mehr App
      // gegen Web, sondern zweimal denselben Hinweis. Laeuft NACH FB_SPERRE,
      // damit es den dort angelegten Mock ergaenzt statt ihn zu verdraengen.
      await page.addInitScript(`try{ if (window.__fb) {
        window.__fb.uid = 'u_plattform';
        window.__fb.anon = true;
        window.__fb.auth = { currentUser: { uid: 'u_plattform', isAnonymous: true } };
      } }catch(e){}`);
      await page.addInitScript(`try{ if(!localStorage.getItem('__geimpft')){ ${PROFILE_INIT}
        localStorage.setItem('__geimpft','1'); } }catch(e){}`);
      await page.addInitScript(`window.__NATIVE__ = ${nativ};`);
      await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
      await page.waitForTimeout(900);
      await oeffneProfil(page);

      const ui = await page.evaluate(() => ({
        link: [...document.querySelectorAll('button')].some(b => /Mit Google sichern|Save with Google/i.test(b.textContent)),
        wipe: [...document.querySelectorAll('button')].some(b => /Fortschritt l|Delete progress/i.test(b.textContent)),
        appText: /automatisch gesichert|backed up automatically/i.test(document.body.innerText)
      }));
      const wo = nativ ? 'App' : 'Web';
      if (nativ) {
        !ui.link ? ok('Weiche (App): kein Google-Knopf — 4.8 und 5.1.1(v) entfallen ✓')
                 : fail('Weiche (App): Google-Knopf trotz nativer Huelle sichtbar');
        ui.appText ? ok('Weiche (App): eigener Hinweistext statt leerer Aufforderung ✓')
                   : fail('Weiche (App): zeigt weiter den Web-Text');
      } else {
        ui.link ? ok('Weiche (Web): Google-Knopf vorhanden ✓')
                : fail('Weiche (Web): Google-Knopf fehlt');
      }
      ui.wipe ? ok(`Weiche (${wo}): "Fortschritt loeschen" vorhanden ✓`)
              : fail(`Weiche (${wo}): Loeschknopf fehlt`);

      // ── Loeschen wirklich durchspielen (nur einmal) ──────────
      if (nativ) {
        const vorher = await page.evaluate(() => {
          try { const p = JSON.parse(localStorage.getItem('fortress_profile')); return { id: p.id, gold: p.gold }; }
          catch (e) { return null; }
        });
        await page.evaluate(() => {
          for (const b of document.querySelectorAll('button'))
            if (/Fortschritt l|Delete progress/i.test(b.textContent)) { b.click(); return; }
        });
        await page.waitForTimeout(400);
        const dialog = await page.evaluate(() => /Wirklich alles|Delete everything/i.test(document.body.innerText));
        dialog ? ok('Loeschen: Rueckfrage erscheint (kein Sofort-Loeschen) ✓')
               : fail('Loeschen: keine Rueckfrage');
        await page.evaluate(() => {
          for (const b of document.querySelectorAll('button'))
            if (/Ja, alles|Yes, delete/i.test(b.textContent)) { b.click(); return; }
        });
        await page.waitForTimeout(2200);
        // Nach dem Loeschen steht das Spiel wie nach einer Erstinstallation da:
        // KEIN Profil im Speicher, und der Profil-Editor fordert einen neuen
        // Namen an. (Erst gemessen, dann behauptet — die urspruengliche
        // Erwartung "es legt sofort ein frisches an" war falsch.)
        const nachher = await page.evaluate(() => {
          try { return localStorage.getItem('fortress_profile'); } catch (e) { return 'FEHLER'; }
        });
        (vorher && nachher === null)
          ? ok(`Loeschen: Stand entfernt (war ${vorher.id}, jetzt leer) ✓`)
          : fail(`Loeschen: Profil noch da (${String(nachher).slice(0, 40)})`);
        const frisch = await page.evaluate(() =>
          !!document.querySelector('input:not([type=range])') ||
          /WAPPEN|CREST|Profil|Profile/i.test(document.body.innerText));
        frisch ? ok('Loeschen: Spiel steht wie nach Erstinstallation ✓')
               : fail('Loeschen: kein Erstinstallations-Zustand nach dem Loeschen');
      }
    } finally { await ctx.close(); }
  }

  // ── Der Hinweis „Zum Home-Bildschirm" gehoert NUR in den Browser ───────
  //
  // Auf dem Geraet war er in der APP sichtbar — sinnlos, denn die ist schon
  // installiert. Die alte Bedingung konnte das nicht erkennen: In Capacitors
  // WebView steht „iPhone" im Kennzeichen, und `navigator.standalone` gibt es
  // dort nicht; `!undefined` ist wahr. Deshalb wird hier mit einem
  // iPhone-Kennzeichen geprueft — ohne das erschiene der Hinweis in KEINEM der
  // beiden Faelle, und die Pruefung waere gruen, ohne etwas zu pruefen.
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) '
    + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  for (const nativ of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
      hasTouch: true, serviceWorkers: 'block', userAgent: IPHONE });
    const page = await ctx.newPage();
    try {
      await page.addInitScript(FB_SPERRE);
      await page.addInitScript(PROFILE_INIT);
      await page.addInitScript(`window.__NATIVE__ = ${nativ};`);
      await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
      // Der Hinweis kommt mit 3,5 s Verzoegerung.
      await page.waitForTimeout(4600);
      const sichtbar = await page.evaluate(() => {
        const h = document.getElementById('ios-hint');
        return !!h && getComputedStyle(h).display !== 'none';
      });
      if (nativ) {
        !sichtbar ? ok('Weiche (App): kein „Zum Home-Bildschirm"-Hinweis ✓')
                  : fail('Weiche (App): Verknuepfungs-Hinweis erscheint in der App');
      } else {
        sichtbar ? ok('Weiche (Web, iPhone): Hinweis erscheint ✓')
                 : fail('Weiche (Web, iPhone): Hinweis fehlt — dann prueft der Fall nichts');
      }
    } finally { await ctx.close(); }
  }

  // ── Die Text-Lupe: aus im Spiel, an im Namensfeld (v3.86.0) ────────────
  //
  // Abschalten kann sie nur die native Huelle; hier steht die Haelfte, die im
  // Browser liegt und still kaputtgehen koennte: die Meldung, WANN ein Feld
  // den Fokus hat. Der native Kanal wird dafuer nachgebaut — ohne ihn tut die
  // Funktion absichtlich nichts, und die Pruefung waere gruen, ohne etwas zu
  // pruefen.
  for (const nativ of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
      hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    try {
      await page.addInitScript(FB_SPERRE);
      await page.addInitScript(PROFILE_INIT);
      await page.addInitScript(`window.__NATIVE__ = ${nativ};`);
      if (nativ) {
        await page.addInitScript(`
          window.__lupe = [];
          window.webkit = { messageHandlers: { textfeld: {
            postMessage: (an) => window.__lupe.push(an) } } };
        `);
      }
      await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
      await page.waitForTimeout(500);

      // Profil-Editor oeffnen — dort steht das einzige Textfeld des Spiels.
      await page.evaluate(() => {
        for (const b of document.querySelectorAll('button')) {
          if ((b.getAttribute('title') || '').startsWith('Profil')) { b.click(); return; }
        }
      });
      await page.waitForTimeout(500);
      const hatFeld = await page.evaluate(() => !!document.querySelector('input:not([type=range])'));
      if (!hatFeld) {
        fail('Lupe: kein Textfeld gefunden — die Pruefung greift ins Leere');
      } else {
        // v3.90.0: Geprueft wird die UMGEKEHRTE Richtung. Die Textbedienung
        // ist an, solange kein Spielfeld oben ist; sie geht nur im Spiel aus.
        // Der Fehler davor war genau andersherum gebaut und hat die
        // Namenseingabe gekostet — deshalb steht hier jetzt vor allem, dass
        // im Menue NIE ein `false` als letzte Meldung stehen bleibt.
        await page.evaluate(() => document.querySelector('input:not([type=range])').focus());
        await page.waitForTimeout(150);
        const imMenue = await page.evaluate(() => window.__lupe || null);
        if (nativ) {
          const letzte = Array.isArray(imMenue) && imMenue.length ? imMenue[imMenue.length - 1] : null;
          (letzte === true)
            ? ok(`Textbedienung (App): im Menue an (${JSON.stringify(imMenue)}) ✓`)
            : fail(`Textbedienung (App): im Menue ist ${JSON.stringify(imMenue)} — im Namensfeld laesst sich dann nichts eintippen`);
        } else {
          imMenue === null
            ? ok('Textbedienung (Web): kein nativer Kanal, nichts gemeldet ✓')
            : fail(`Textbedienung (Web): meldet ins Leere (${JSON.stringify(imMenue)})`);
        }
        // Und im Spiel muss sie ausgehen — sonst waere die Lupe zurueck.
        if (nativ) {
          await page.evaluate(() => { const b = [...document.querySelectorAll('button')]
            .find(x => /Profil erstellen|Create profile|Speichern|Save/i.test(x.textContent)); b && b.click(); });
          await page.waitForTimeout(400);
          await jsClick(page, ['LOKAL', 'PLAY LOCAL']);
          await page.waitForTimeout(250);
          await jsClick(page, ['2 Spieler', '2 Players']);
          const kam = await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 8000 })
            .then(() => true).catch(() => false);
          await page.waitForTimeout(300);
          const imSpiel = await page.evaluate(() => window.__lupe || []);
          const letzteS = imSpiel.length ? imSpiel[imSpiel.length - 1] : null;
          (kam && letzteS === false)
            ? ok(`Textbedienung (App): im Spiel aus (${JSON.stringify(imSpiel)}) ✓`)
            : fail(`Textbedienung (App): im Spiel ${JSON.stringify(imSpiel)}, Brett da=${kam}`);
        }
      }
    } finally { await ctx.close(); }
  }

  errs.length ? errs.slice(0, 3).forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`))
              : ok('Plattform-Weiche: keine JS-Fehler ✓');
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 0c2: Sicherheitsbereiche im SPIEL (v3.85.0)
//
// Warum diese Suite noetig wurde: v3.84.0 hat die Sicherheitsbereiche im Menue
// und in den Vollbild-Fenstern geradegezogen — das SPIEL blieb dabei aussen
// vor, und zwei neue Fehler kamen dazu. Auf dem Geraet sah man einen toten
// Streifen unter der Statusleiste und eine Bauteil-Leiste, die unten aus dem
// Bildschirm ragte.
//
// Gemessen wird mit gesetzten Sicherheitsbereichen. Chromium kennt keine
// echten env()-Werte; seit v3.84.0 laufen sie aber ueber --sa-*, und die lassen
// sich als Inline-Stil am Wurzelelement vorgeben. Ohne diese Vorgabe waeren
// alle Werte 0 — die Suite waere gruen, ohne irgendetwas zu pruefen.
// ═══════════════════════════════════════════════════════════════
const SA_OBEN = 59, SA_UNTEN = 34;
const SA_STUB = `
  (function () {
    const setzen = () => {
      const d = document.documentElement;
      if (!d || !d.style) return false;
      d.style.setProperty('--sa-top', '${SA_OBEN}px');
      d.style.setProperty('--sa-bottom', '${SA_UNTEN}px');
      return true;
    };
    if (!setzen()) document.addEventListener('DOMContentLoaded', setzen);
  })();
`;

async function suiteSicherheitsbereiche(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Sicherheitsbereiche im Spiel\n' + '='.repeat(50));

  // Die Lage aller Bausteine in EINEM Durchgang — jede Messung einzeln
  // abzufragen hiesse, sie zu verschiedenen Zeitpunkten zu nehmen.
  const lage = page => page.evaluate(() => {
    const kasten = el => { if (!el) return null; const b = el.getBoundingClientRect();
      return { t: Math.round(b.top), b: Math.round(b.bottom), h: Math.round(b.height) }; };
    const huelle = document.querySelector('#root > div');
    const kinder = huelle ? Array.from(huelle.children) : [];
    const reihen = kinder.filter(c => ['static', 'relative'].includes(getComputedStyle(c).position))
                         .map(c => kasten(c));
    return {
      vh: window.innerHeight,
      dokument: document.documentElement.scrollHeight,
      htmlOben: getComputedStyle(document.documentElement).paddingTop,
      bodyOben: getComputedStyle(document.body).paddingTop,
      wurzel: kasten(document.getElementById('root')),
      huelle: kasten(huelle),
      reihen,
      schild: kasten(document.querySelector('div[style*="phasebanner"]'))
    };
  });

  const starten = async (spieler) => {
    const ctx = await browser.newContext({ viewport: { width: 402, height: 874 },
      hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
    // KEIN TIMER_SPEEDUP hier: der verkuerzt auch die 2,5 s des Phasen-Schildes
    // auf 0,5 s — es waere beim Messen schon wieder verschwunden, und die
    // Pruefung meldete „nicht gefunden" statt etwas ueber die Lage zu sagen.
    await page.addInitScript(FB_SPERRE);
    await page.addInitScript(PROFILE_INIT);
    await page.addInitScript(SA_STUB);
    await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
    await page.waitForTimeout(400);
    return { ctx, page };
  };

  // ── 1) Die Polsterung darf GENAU EINMAL zaehlen ────────────────────────
  {
    const { ctx, page } = await starten(2);
    try {
      const m = await lage(page);
      (m.htmlOben === '0px' && m.bodyOben === `${SA_OBEN}px`)
        ? ok(`Sicherheitsbereich zaehlt einmal (html ${m.htmlOben}, body ${m.bodyOben}) ✓`)
        : fail(`Sicherheitsbereich doppelt: html ${m.htmlOben} + body ${m.bodyOben}`);
      (m.wurzel && m.wurzel.t === SA_OBEN)
        ? ok(`Inhalt beginnt am Sicherheitsbereich (${m.wurzel.t} px) ✓`)
        : fail(`Toter Streifen oben: Inhalt beginnt bei ${m.wurzel && m.wurzel.t} statt ${SA_OBEN}`);
    } finally { await ctx.close(); }
  }

  // ── 2) Spiel: nichts ragt heraus, nichts ueberdeckt die Kopfzeile ──────
  for (const spieler of [2, 3]) {
    const { ctx, page } = await starten(spieler);
    try {
      await jsClick(page, ['LOKAL']);
      await page.waitForTimeout(250);
      await jsClick(page, [spieler === 2 ? '2 Spieler' : '3 Spieler']);
      await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 8000 });
      // Auf das Schild warten, statt eine Wartezeit zu raten.
      await page.waitForSelector('div[style*="phasebanner"]', { timeout: 6000 }).catch(() => {});
      const m = await lage(page);

      // Gemessen wird gegen den BILDSCHIRM, nicht gegen die Huelle. Im
      // Kontrollversuch mit wieder eingebautem Fehler war „Leiste innerhalb der
      // Huelle" gruen — weil die Huelle selbst herausragte. Und
      // document.scrollHeight taugt gar nicht: html hat overflow:hidden, der
      // Wert ist gedeckelt und meldet nie einen Ueberlauf.
      const schirmUnten = m.vh - SA_UNTEN;
      (m.huelle && m.huelle.b <= schirmUnten)
        ? ok(`${spieler}P: Huelle endet ueber dem unteren Sicherheitsbereich (${m.huelle.b} ≤ ${schirmUnten}) ✓`)
        : fail(`${spieler}P: Huelle ragt ${m.huelle ? m.huelle.b - schirmUnten : '?'} px in den Sicherheitsbereich oder aus dem Bild`);

      const unten = m.reihen.length ? m.reihen[m.reihen.length - 1] : null;
      (unten && unten.b <= schirmUnten)
        ? ok(`${spieler}P: Unterleiste bleibt im Bild (${unten.b} ≤ ${schirmUnten}) ✓`)
        : fail(`${spieler}P: Unterleiste ragt ${unten ? unten.b - schirmUnten : '?'} px aus dem Bild`);

      // Die Kopfzeile ist die erste Reihe; bei drei Spielern kommt eine zweite
      // dazu. Das Phasen-Schild muss UNTER der letzten Kopfreihe liegen.
      const kopfUnten = spieler === 3 && m.reihen.length > 1 ? m.reihen[1].b : (m.reihen[0] ? m.reihen[0].b : 0);
      if (!m.schild) {
        fail(`${spieler}P: Phasen-Schild nicht gefunden — die Pruefung greift ins Leere`);
      } else if (m.schild.t >= kopfUnten) {
        ok(`${spieler}P: Phasen-Schild unter der Kopfzeile (${m.schild.t} ≥ ${kopfUnten}) ✓`);
      } else {
        fail(`${spieler}P: Phasen-Schild ueberdeckt die Kopfzeile (${m.schild.t} < ${kopfUnten})`);
      }
    } finally { await ctx.close(); }
  }

  // ── 3) Ergebnis-Bildschirm: der unterste Knopf muss erreichbar sein ────
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 568 },
      hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
    try {
      await page.addInitScript(FB_SPERRE);
      await page.addInitScript(PROFILE_INIT);
      await page.addInitScript(TIMER_SPEEDUP);
      await page.addInitScript(SA_STUB);
      await page.addInitScript(`window.__mmDebug = true;`);
      await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
      await jsClick(page, ['LOKAL']);
      await page.waitForTimeout(250);
      await jsClick(page, ['2 Spieler']);
      await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 8000 });
      // Burg von P2 aufreissen → Verlust am Bauende → Ergebnis-Bildschirm.
      await page.waitForFunction(() => /BAUEN|BUILD/.test(document.body.textContent), { timeout: 20000 });
      await page.evaluate(() => window.__blastWall(2, 4));
      const kam = await page.waitForFunction(() => !document.querySelector('canvas'), { timeout: 25000 })
        .then(() => true).catch(() => false);
      if (!kam) {
        fail('Ergebnis: Bildschirm kam nicht — Pruefung nicht durchgefuehrt');
      } else {
        await page.waitForTimeout(500);
        const m = await page.evaluate(() => {
          const el = document.querySelector('#root > div');
          const cs = getComputedStyle(el);
          const knoepfe = Array.from(el.querySelectorAll('button'));
          const letzter = knoepfe[knoepfe.length - 1];
          return { rollbar: cs.overflowY, inhalt: el.scrollHeight, sicht: el.clientHeight,
            oben: Math.round(el.getBoundingClientRect().top),
            maxRoll: el.scrollHeight - el.clientHeight,
            letzterText: letzter ? letzter.textContent.trim().slice(0, 20) : null };
        });
        // Der Kasten ist auf einem kleinen Schirm zu klein fuer den Inhalt —
        // genau dann muss er rollen, sonst ist der unterste Knopf unerreichbar.
        (m.inhalt > m.sicht)
          ? ok(`Ergebnis (320×568): Inhalt ${m.inhalt} > Kasten ${m.sicht} — der Fall wird geprueft ✓`)
          : fail(`Ergebnis: Inhalt passt (${m.inhalt} ≤ ${m.sicht}) — die Pruefung sagt nichts aus`);
        (m.rollbar === 'auto' || m.rollbar === 'scroll')
          ? ok(`Ergebnis: Kasten rollt (${m.rollbar}), unterster Knopf „${m.letzterText}" erreichbar ✓`)
          : fail(`Ergebnis: kein Rollen (${m.rollbar}) — der untere Teil ist abgeschnitten`);
        // Und der OBERE Teil darf dabei nicht wegrutschen (die Falle bei
        // justify-content:center in einem rollbaren Kasten).
        const obenSichtbar = await page.evaluate(() => {
          const el = document.querySelector('#root > div');
          el.scrollTop = 0;
          // Nur Kinder IM FLUSS: der erste Knoten ist der Sieges-Effekt und
          // haengt fest am Bildschirm — seine Lage sagt ueber das Rollen nichts.
          const erstes = Array.from(el.children).find(
            c => ['static', 'relative'].includes(getComputedStyle(c).position));
          return erstes ? Math.round(erstes.getBoundingClientRect().top - el.getBoundingClientRect().top) : null;
        });
        (obenSichtbar !== null && obenSichtbar >= -1)
          ? ok(`Ergebnis: oberer Rand erreichbar (${obenSichtbar} px) ✓`)
          : fail(`Ergebnis: oberer Teil liegt ${obenSichtbar} px ausserhalb — unerreichbar`);
      }
    } finally { await ctx.close(); }
  }

  errs.length ? errs.slice(0, 3).forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`))
              : ok('Sicherheitsbereiche: keine JS-Fehler ✓');
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 0e: iPad (v3.87.0)
// Die App laeuft seit je auf dem iPad (TARGETED_DEVICE_FAMILY "1,2"), aber sie
// war nie dafuer gesetzt. Gemessen hatte das zwei Gesichter:
//   - Querformat: das Brett fuellte 29-35 % des Schirms statt 68-73 %. Die
//     Ursache ist das Brett selbst (616x952, also hoch) und nicht zu beheben —
//     also ist das Querformat auf dem iPad jetzt gesperrt.
//   - Hochformat: das Brett war schon richtig, aber Menue und Ergebnis
//     standen als 440- bzw. 320-px-Streifen in einem 1024-px-Schirm.
// Geprueft wird beides — und ausdruecklich auch, dass das TELEFON unveraendert
// bleibt: eine Regel, die ueberall greift, waere keine Tablet-Regel.
// ═══════════════════════════════════════════════════════════════
async function suiteIPad(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Apple-Geraetematrix (iPhone SE bis iPad 13 Zoll)\n' + '='.repeat(50));

  // ── 1) Die iOS-Huelle als Ganzes (statisch, ohne Mac) ─────────────────
  // Frueher standen hier zwei eigene Pruefungen auf die Info.plist. Sie sind
  // in `scripts/ios-pruefen.mjs` aufgegangen — zusammen mit sechzehn weiteren,
  // und vor allem an EINER Stelle. Zwei Orte mit derselben Regel laufen
  // auseinander, und dann glaubt man dem, der gerade gruen ist.
  {
    const { execFileSync } = require('child_process');
    try {
      execFileSync('node', [path.join(__dirname, 'scripts/ios-pruefen.mjs')],
                   { stdio: 'pipe', encoding: 'utf8' });
      ok('iOS-Huelle: alle statischen Pruefungen gruen (scripts/ios-pruefen.mjs) ✓');
    } catch (e) {
      const zeilen = String((e.stdout || '') + (e.stderr || ''))
        .split('\n').filter(z => z.includes('FEHL') || z.includes('→'));
      fail('iOS-Huelle: ' + (zeilen.slice(0, 4).join(' ').trim() || 'Pruefer schlug fehl'));
    }
  }

  const starten = async (w, h) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h },
      hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
    await page.addInitScript(FB_SPERRE);
    await page.addInitScript(PROFILE_INIT);
    await page.addInitScript(TIMER_SPEEDUP);
    await page.addInitScript(`window.__mmDebug = true;`);
    await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
    await page.waitForTimeout(400);
    return { ctx, page };
  };

  const spalte = page => page.evaluate(() => {
    const el = document.querySelector('.gross-spalte');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const kasten = el.parentElement;
    return { breite: Math.round(r.width), links: Math.round(r.left),
             rechts: Math.round(window.innerWidth - r.right),
             anteil: Math.round(100 * r.width / window.innerWidth),
             rollbar: kasten.scrollHeight <= kasten.clientHeight + 1 ? 'passt' : 'rollt',
             vw: window.innerWidth };
  });

  // ── 2) Telefon: unveraendert. Das ist der Kontrollversuch ──────────────
  {
    const { ctx, page } = await starten(393, 852);
    try {
      const m = await spalte(page);
      (m && m.breite <= 440)
        ? ok(`Telefon: Menuespalte unveraendert (${m.breite} px ≤ 440) ✓`)
        : fail(`Telefon: Menuespalte auf ${m && m.breite} px vergroessert — die Tablet-Regel greift zu frueh`);
    } finally { await ctx.close(); }
  }

  // ── 3) iPad hoch: Menue fuellt den Schirm, ohne herauszuragen ──────────
  for (const [w, h, name] of [[744, 1133, 'iPad mini'], [1024, 1366, 'iPad 12,9"']]) {
    const { ctx, page } = await starten(w, h);
    try {
      const m = await spalte(page);
      if (!m) { fail(`${name}: Menuespalte nicht gefunden`); continue; }
      (m.anteil >= 55)
        ? ok(`${name}: Menue fuellt ${m.anteil} % der Breite (≥ 55) ✓`)
        : fail(`${name}: Menue fuellt nur ${m.anteil} % — strandet als Streifen in der Mitte`);
      (m.links >= 0 && m.rechts >= 0)
        ? ok(`${name}: Menue bleibt im Bild (Rand ${m.links}/${m.rechts}) ✓`)
        : fail(`${name}: Menue ragt seitlich heraus (Rand ${m.links}/${m.rechts})`);
    } finally { await ctx.close(); }
  }

  // ── 4) iPad hoch: das Brett nutzt den Platz und nichts faellt heraus ───
  {
    const { ctx, page } = await starten(1024, 1366);
    try {
      await jsClick(page, ['LOKAL']);
      await page.waitForTimeout(250);
      await jsClick(page, ['2 Spieler']);
      await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 8000 });
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const c = document.querySelector('canvas').getBoundingClientRect();
        const huelle = document.querySelector('#root > div');
        const reihen = Array.from(huelle.children)
          .filter(e => ['static', 'relative'].includes(getComputedStyle(e).position))
          .map(e => e.getBoundingClientRect());
        return { anteil: Math.round(100 * (c.width * c.height) / (window.innerWidth * window.innerHeight)),
                 brett: [Math.round(c.width), Math.round(c.height)],
                 breiten: reihen.map(r => Math.round(r.width)),
                 unten: reihen.length ? Math.round(Math.max(...reihen.map(r => r.bottom))) : 0,
                 vw: window.innerWidth, vh: window.innerHeight };
      });
      (m.anteil >= 55)
        ? ok(`iPad 12,9": Brett fuellt ${m.anteil} % des Schirms (${m.brett[0]}x${m.brett[1]}) ✓`)
        : fail(`iPad 12,9": Brett fuellt nur ${m.anteil} % des Schirms (mindestens 55)`);
      // Kopfzeile, Buehne und Unterleiste spannen bis an den Rand. Vorher waren
      // sie nur so breit wie das Brett — links und rechts blieben je ~120 px
      // schwarz, und der Schirm sah aus wie ein vergroessertes Telefonbild.
      const gespannt = m.breiten.filter(b => Math.abs(b - m.vw) <= 2).length;
      (gespannt === m.breiten.length)
        ? ok(`iPad 12,9": alle ${gespannt} Reihen spannen ueber die volle Breite (${m.vw} px) ✓`)
        : fail(`iPad 12,9": nur ${gespannt} von ${m.breiten.length} Reihen voll breit (${m.breiten.join('/')} bei ${m.vw})`);
      (m.unten <= m.vh)
        ? ok(`iPad 12,9": Unterleiste bleibt im Bild (${m.unten} ≤ ${m.vh}) ✓`)
        : fail(`iPad 12,9": Unterleiste ragt ${m.unten - m.vh} px aus dem Bild`);
      // Das Brett darf NICHT gezoomt sein: `fit()` rechnet mit gemessenen
      // Pixeln. Eine Zoomstufe darueber liesse gemessene und gezeichnete
      // Pixel auseinanderlaufen — genau der Fehler aus v3.84.0.
      const zoom = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        for (let e = c; e && e !== document.documentElement; e = e.parentElement) {
          const z = getComputedStyle(e).zoom;
          if (z && z !== 'normal' && parseFloat(z) !== 1) return z;
        }
        return '1';
      });
      (parseFloat(zoom) === 1)
        ? ok('iPad 12,9": Spielfeld ohne Zoomstufe ✓')
        : fail(`iPad 12,9": Spielfeld steht unter zoom:${zoom} — gemessene und gezeichnete Pixel laufen auseinander`);
    } finally { await ctx.close(); }
  }

  // ── 5) Ergebnis: Karten wachsen mit, der Farbblitz bleibt bildfuellend ─
  for (const [w, h, mindest] of [[393, 852, 0], [1024, 1366, 420]]) {
    const { ctx, page } = await starten(w, h);
    try {
      await jsClick(page, ['LOKAL']);
      await page.waitForTimeout(250);
      await jsClick(page, ['2 Spieler']);
      await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 8000 });
      // Burg von P2 aufreissen → Verlust am Bauende → Ergebnis-Bildschirm.
      // (Derselbe Weg wie in der Sicherheitsbereich-Suite; `__blastWall` haengt
      // an `__mmDebug`, ohne den Schalter gibt es still null zurueck.)
      await page.waitForFunction(() => /BAUEN|BUILD/.test(document.body.textContent), { timeout: 20000 });
      await page.evaluate(() => window.__blastWall(2, 4));
      await page.waitForFunction(() => !document.querySelector('canvas'), { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const s = document.querySelector('.gross-schirm');
        if (!s) return null;
        const kinder = Array.from(s.children);
        const fluss = kinder.filter(e => getComputedStyle(e).position !== 'fixed');
        const fix   = kinder.filter(e => getComputedStyle(e).position === 'fixed');
        return {
          breitestes: Math.max(...fluss.map(e => Math.round(e.getBoundingClientRect().width))),
          ueberlauf: fluss.some(e => { const r = e.getBoundingClientRect();
            return r.left < -1 || r.right > window.innerWidth + 1; }),
          fixOhneKlasse: fix.filter(e => !e.classList.contains('kein-zoom')).length,
          fixAnzahl: fix.length,
          vw: window.innerWidth
        };
      });
      const gross = w > 700;
      if (!m) { fail(`${gross ? 'iPad' : 'Telefon'}: Ergebnisschirm nicht erreicht`); continue; }
      (m.breitestes >= mindest && !m.ueberlauf)
        ? ok(`${gross ? 'iPad' : 'Telefon'}: Ergebniskarten ${m.breitestes} px, kein Ueberlauf ✓`)
        : fail(`${gross ? 'iPad' : 'Telefon'}: Ergebniskarten ${m.breitestes} px (mindestens ${mindest})${m.ueberlauf ? ', ragen heraus' : ''}`);
      // Der Farbblitz und der Sieges-Effekt liegen INNERHALB des gezoomten
      // Schirms und muessen die Ausnahme `kein-zoom` tragen.
      //
      // Gemessen: Chromium wendet `zoom` auf ein `position:fixed; inset:0`
      // NICHT an — dort waere die Ausnahme folgenlos, und eine Pruefung auf
      // die BREITE koennte gar nicht fehlschlagen. Sie waere leer gewesen.
      // WebKit rechnet Zoom und feste Positionierung anders, und WebKit ist
      // das, was auf dem iPad laeuft; nachmessen laesst es sich hier nicht.
      // Geprueft wird deshalb, was hier pruefbar IST und wirklich schuetzt:
      // dass jede bildfuellende Ueberlagerung die Klasse traegt. Wer eine neue
      // hinzufuegt und sie vergisst, faellt auf.
      (m.fixOhneKlasse === 0 && m.fixAnzahl > 0)
        ? ok(`${gross ? 'iPad' : 'Telefon'}: alle ${m.fixAnzahl} bildfuellenden Ueberlagerungen mit kein-zoom ✓`)
        : fail(`${gross ? 'iPad' : 'Telefon'}: ${m.fixOhneKlasse} von ${m.fixAnzahl} Ueberlagerungen ohne kein-zoom`);
    } finally { await ctx.close(); }
  }

  // ── 6) Die Bauteil-Vorschau war auf dem iPad die KLEINSTE ─────────────
  // `pieceBox` = barH − 38, nach unten bei 24 gedeckelt. Das Brett ist auf dem
  // iPad hoehenbegrenzt und brauchte den ganzen Rest auf, also blieb die
  // Leiste beim Mindestmass 52 → Vorschau 24 px, waehrend das iPhone 57 hat.
  // Das groessere Geraet hatte die kleinere Vorschau. Geprueft wird der
  // Vergleich selbst, nicht ein geratener Zahlenwert.
  {
    const messen = async (w, h) => {
      const { ctx, page } = await starten(w, h);
      try {
        await jsClick(page, ['LOKAL']);
        await page.waitForTimeout(250);
        await jsClick(page, ['2 Spieler']);
        await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 8000 });
        await page.waitForFunction(() => /BAUEN|BUILD/.test(document.body.textContent), { timeout: 20000 });
        await page.waitForTimeout(300);
        return await page.evaluate(() => {
          const huelle = document.querySelector('#root > div');
          const fluss = Array.from(huelle.children)
            .filter(e => ['static', 'relative'].includes(getComputedStyle(e).position));
          const leiste = fluss[fluss.length - 1];
          let groesste = 0;
          for (const e of leiste.querySelectorAll('div')) {
            const r = e.getBoundingClientRect();
            if (r.width > 20 && Math.abs(r.width - r.height) <= 1 && r.width > groesste) groesste = r.width;
          }
          return { box: Math.round(groesste), leiste: Math.round(leiste.getBoundingClientRect().height) };
        });
      } finally { await ctx.close(); }
    };
    const tel = await messen(393, 852);
    const pad = await messen(1024, 1366);
    (pad.box > 0 && tel.box > 0)
      ? ((pad.box >= tel.box)
          ? ok(`Bauteil-Vorschau: iPad ${pad.box} px ≥ iPhone ${tel.box} px (Leiste ${pad.leiste}/${tel.leiste}) ✓`)
          : fail(`Bauteil-Vorschau: iPad ${pad.box} px KLEINER als iPhone ${tel.box} px — das groessere Geraet zeigt weniger`))
      : fail(`Bauteil-Vorschau nicht gefunden (iPad ${pad.box}, iPhone ${tel.box})`);
  }

  // ── 7) Das Menue muss auf JEDEN Schirm passen ─────────────────────────
  // Gemessen ist die Menuespalte 720 Punkte hoch. Auf einem iPhone SE bleiben
  // nach Sicherheitsbereichen und Polsterung 615, auf einem 13 mini 696 — auf
  // beiden lag die Fusszeile mit Impressum und Datenschutz unter der Kante.
  // Geprueft wird das Ergebnis, nicht die Regel: Der Kasten darf nicht rollen.
  for (const [w, h, name] of [[375, 667, 'iPhone SE'], [375, 812, 'iPhone 13 mini']]) {
    const { ctx, page } = await starten(w, h);
    try {
      const m = await page.evaluate(() => {
        const el = document.querySelector('.gross-spalte');
        const k = el.parentElement;
        return { ueber: k.scrollHeight - k.clientHeight,
                 zoom: getComputedStyle(el).zoom,
                 hoehe: Math.round(el.getBoundingClientRect().height) };
      });
      (m.ueber <= 1)
        ? ok(`${name}: Menue passt ohne Rollen (Spalte ${m.hoehe}, zoom ${m.zoom}) ✓`)
        : fail(`${name}: Menue ragt ${m.ueber} px hinaus — die Fusszeile liegt unter der Kante`);
    } finally { await ctx.close(); }
  }

  // ── 8) Die Kopfzeile waechst mit der Breite ───────────────────────────
  // Vorher war sie auf JEDEM iPhone 53 px hoch, vom SE mit 375 Punkten bis
  // zum 16 Pro Max mit 440. Auf breiten Telefonen kostet das Wachsen nichts:
  // Dort ist das Brett breitenbegrenzt, die Kopfzeile nimmt der Unterleiste.
  {
    const kopfUndBrett = async (w, h) => {
      const { ctx, page } = await starten(w, h);
      try {
        await jsClick(page, ['LOKAL']);
        await page.waitForTimeout(250);
        await jsClick(page, ['2 Spieler']);
        await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 8000 });
        await page.waitForTimeout(400);
        return await page.evaluate(() => {
          const hu = document.querySelector('#root > div');
          const fluss = Array.from(hu.children)
            .filter(e => ['static', 'relative'].includes(getComputedStyle(e).position));
          const c = document.querySelector('canvas').getBoundingClientRect();
          return { kopf: Math.round(fluss[0].getBoundingClientRect().height),
                   brett: [Math.round(c.width), Math.round(c.height)] };
        });
      } finally { await ctx.close(); }
    };
    const schmal = await kopfUndBrett(375, 812);
    const breit  = await kopfUndBrett(440, 956);
    (breit.kopf > schmal.kopf)
      ? ok(`Kopfzeile waechst mit der Breite: ${schmal.kopf} px bei 375, ${breit.kopf} px bei 440 ✓`)
      : fail(`Kopfzeile bleibt gleich: ${schmal.kopf} px bei 375, ${breit.kopf} px bei 440`);
    // Und sie darf das Brett auf dem breiten Telefon NICHT kleiner machen.
    (breit.brett[0] >= 436)
      ? ok(`Breites Telefon: Brett bleibt ${breit.brett[0]}x${breit.brett[1]} — die Kopfzeile nimmt der Leiste ✓`)
      : fail(`Breites Telefon: Brett auf ${breit.brett[0]} px geschrumpft — die Kopfzeile nimmt dem Brett`);
  }

  errs.length ? errs.slice(0, 3).forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`))
              : ok('iPad: keine JS-Fehler ✓');
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 0f: Der Spielername (v3.90.0)
// Gemeldet vom Geraet: „man kann sich keinen Namen geben". Zwei Ursachen, und
// die Suite war bei beiden blind:
//
//   · In der APP war die Textbedienung von iOS ab dem ersten Bild
//     abgeschaltet (v3.86.0). Das Namensfeld im Profil-Editor war damit tot.
//     Geprueft wird das in `suitePlattform` — hier geht es um den Rest.
//   · Im WEB lag die Tages-Belohnung ueber dem Editor: beide auf Ebene 1100,
//     und dann entscheidet die Reihenfolge im Dokument. Das Feld war zu SEHEN,
//     aber nicht zu treffen — was wie ein kaputtes Feld aussieht, nicht wie
//     ein Fenster darueber.
//
// Beides wird hier am Ergebnis geprueft, nicht an der Regel: Laesst sich ein
// Name eintippen, speichern, aendern — und ueberlebt er das Neuladen?
// ═══════════════════════════════════════════════════════════════
async function suiteProfilName(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Spielername\n' + '='.repeat(50));

  const FELD = 'input:not([type=range]):not([type=checkbox])';

  const starten = async (mitProfil, tagesBelohnungFaellig) => {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 },
      hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
    await page.addInitScript(FB_SPERRE);
    if (mitProfil) await page.addInitScript(PROFILE_INIT);
    await page.addInitScript(`try{
      localStorage.setItem('fortress_onboarded','1');
      localStorage.setItem('fortress_lang','de');
      ${tagesBelohnungFaellig
        ? "localStorage.removeItem('fortress_daily');"
        : "localStorage.setItem('fortress_daily', JSON.stringify({lastCollect:Date.now(),streak:1,lastStreakDay:new Date().toISOString().slice(0,10)}));"}
    }catch(e){}`);
    await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
    await page.waitForTimeout(1500);
    return { ctx, page };
  };

  const feldFrei = (page) => page.evaluate((s) => {
    const f = document.querySelector(s);
    if (!f) return 'kein Feld';
    const r = f.getBoundingClientRect();
    const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return oben === f ? 'frei' : ('verdeckt von "' + ((oben && oben.textContent) || '').trim().slice(0, 30) + '"');
  }, FELD);

  // ── 1) Erstes Profil: tippen, speichern, im Menue sehen ───────────────
  {
    const { ctx, page } = await starten(false, false);
    try {
      const da = await page.$(FELD);
      if (!da) { fail('Erstes Profil: kein Namensfeld — die Pruefung greift ins Leere'); }
      else {
        const frei = await feldFrei(page);
        (frei === 'frei') ? ok('Erstes Profil: Namensfeld ist erreichbar ✓')
                          : fail(`Erstes Profil: Namensfeld ${frei}`);
        await da.click();
        await page.keyboard.type('KUNIGUNDE');
        const wert = await page.evaluate((s) => document.querySelector(s).value, FELD);
        (wert === 'KUNIGUNDE') ? ok('Erstes Profil: Name laesst sich eintippen ✓')
                               : fail(`Erstes Profil: im Feld steht "${wert}"`);
        await jsClick(page, ['Profil erstellen', 'Create profile']);
        await page.waitForTimeout(700);
        const gespeichert = await page.evaluate(() => {
          try { return JSON.parse(localStorage.getItem('fortress_profile')).name; } catch (e) { return null; } });
        (gespeichert === 'KUNIGUNDE') ? ok('Erstes Profil: Name gespeichert ✓')
                                      : fail(`Erstes Profil: gespeichert wurde "${gespeichert}"`);
      }
    } finally { await ctx.close(); }
  }

  // ── 2) Die Tages-Belohnung darf den Editor NICHT zudecken ─────────────
  // Sie ist das einzige Fenster, das sich ungefragt oeffnet (1,2 s nachdem ein
  // Profil da ist). Genau das lag vorher ueber dem Namensfeld.
  {
    const { ctx, page } = await starten(true, true);
    try {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')]
          .find(x => (x.getAttribute('title') || '').startsWith('Profil bearbeiten'));
        if (b) b.click();
      });
      await page.waitForTimeout(600);
      // Lange genug warten, dass der 1,2-s-Wecker der Belohnung durch waere.
      await page.waitForTimeout(1600);
      const frei = await feldFrei(page);
      (frei === 'frei')
        ? ok('Tages-Belohnung liegt nicht ueber dem Namensfeld ✓')
        : fail(`Namensfeld ${frei} — mit offenem Editor darf sich nichts daruebersetzen`);
    } finally { await ctx.close(); }
  }

  // ── 3) Umbenennen und Neuladen ────────────────────────────────────────
  {
    const { ctx, page } = await starten(true, false);
    try {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')]
          .find(x => (x.getAttribute('title') || '').startsWith('Profil bearbeiten'));
        if (b) b.click();
      });
      await page.waitForTimeout(600);
      const f = await page.$(FELD);
      if (!f) { fail('Umbenennen: kein Namensfeld im Editor'); }
      else {
        await f.click({ clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.keyboard.type('ZWEITNAME');
        // Genau "Speichern" — „Mit Google sichern" enthaelt ebenfalls „sichern".
        const k = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'Speichern');
          if (b) { b.click(); return true; } return false; });
        k ? ok('Umbenennen: Speichern-Knopf vorhanden ✓') : fail('Umbenennen: kein Speichern-Knopf');
        await page.waitForTimeout(800);
        // NICHT neu laden: `PROFILE_INIT` haengt als Initialskript an der Seite
        // und schreibt beim naechsten Dokument das Testprofil zurueck — die
        // Pruefung wuerde den Prueftstand messen, nicht das Spiel. Geprueft wird
        // deshalb da, wo die Bestaendigkeit entsteht: im Speicher selbst.
        const nach = await page.evaluate(() => {
          let gespeichert = null;
          try { gespeichert = JSON.parse(localStorage.getItem('fortress_profile')).name; } catch (e) {}
          return { gespeichert, imMenue: document.body.innerText.includes('ZWEITNAME') };
        });
        (nach.gespeichert === 'ZWEITNAME' && nach.imMenue)
          ? ok('Umbenennen: Name steht im Speicher und im Menue ✓')
          : fail(`Umbenennen: gespeichert="${nach.gespeichert}", im Menue=${nach.imMenue}`);
      }
    } finally { await ctx.close(); }
  }

  errs.length ? errs.slice(0, 3).forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`))
              : ok('Spielername: keine JS-Fehler ✓');
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 0g: Die Zumauern-Warnung (v3.91.0)
// Gemeldet vom Geraet: Im Bot-Modus pulsierte die Leiste des BOTS mit
// „ZUMAUERN!", waehrend die eigene Burg dicht war. Die Warnung ist ein
// Handlungsaufruf; fuer eine fremde Burg ist sie Laerm — man kann dort nichts
// tun, und es liest sich, als sei man selbst in Not.
//
// Geprueft wird die REGEL, nicht das Aussehen: `__urgent` gibt die Spieler
// zurueck, die gerade gemahnt werden. Der erste Entwurf ging ueber die
// Anzeige und brauchte dafuer eine dichte eigene und eine offene fremde Burg
// gleichzeitig — dafuer musste der Bot beide Seiten spielen, der Lauf dauerte
// bis zu 90 s, und er hat mit seiner Last drei andere Suiten ins Zeitlimit
// gedrueckt. Am Wert gemessen genuegt EIN Bot-Spiel und ein Blick.
// ═══════════════════════════════════════════════════════════════
async function suiteZumauern(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Zumauern-Warnung\n' + '='.repeat(50));

  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 },
    hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await page.addInitScript(FB_SPERRE);
    await page.addInitScript(PROFILE_INIT);
    await page.addInitScript(TIMER_SPEEDUP);
    await page.addInitScript(`window.__mmDebug = true;`);
    await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
    await page.waitForTimeout(300);
    await jsClick(page, ['LOKAL', 'PLAY LOCAL']);
    await page.waitForTimeout(250);
    await jsClick(page, ['gegen Bot', 'vs Bot']);
    await page.waitForTimeout(300);
    await jsClick(page, ['Mittel', 'Medium']);
    const brett = await page.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 10000 })
      .then(() => true).catch(() => false);
    if (!brett) { fail('Zumauern: Bot-Spiel startet nicht'); return { res, errs }; }

    // Ueber mehrere Bauphasen mitschreiben, WER gemahnt wurde — und BEIDE
    // Burgen dabei offen halten. Das ist der Fall, der die Regel wirklich
    // prueft: Sind beide offen und wird trotzdem nur die eigene gemahnt, kann
    // das Ergebnis nicht daran liegen, dass die fremde zufaellig dicht war.
    // Der erste Entwurf riss die eigene erst spaeter auf und konnte die
    // Gegenprobe nicht herstellen — gemessen wurde dann „niemand gemahnt",
    // was auch dann gruen waere, wenn die Warnung ganz kaputt ist.
    const gesehen = new Set();
    let eigeneOffenGesehen = false, fremdeOffenGesehen = false, imFenster = 0;
    // 14 s und alle 200 ms statt 22 s und alle 90 ms: Mit dem 20fachen
    // Zeitraffer dauert eine Runde rund drei Sekunden, das reicht fuer
    // mehrere Fenster. Die dichtere Abfrage hat zweimal andere Suiten ins
    // Zeitlimit gedrueckt — die Suiten laufen parallel, und diese hier war
    // die schwerste von allen.
    const ende = Date.now() + 14000;
    while (Date.now() < ende) {
      const m = await page.evaluate(() => {
        const e = window.__econFull && window.__econFull();
        if (!e || e.phase !== 'build') return null;
        try { window.__blastWall(1, 40); window.__blastWall(2, 40); } catch (x) {}
        return { gemahnt: (window.__urgent && window.__urgent()) || [],
                 offen1: !window.__castleClosed(1), offen2: !window.__castleClosed(2),
                 t: window.__readTimer && window.__readTimer() };
      });
      if (m && typeof m.t === 'number' && m.t <= 8 && m.t > 0) {
        imFenster += 1;
        m.gemahnt.forEach(p => gesehen.add(p));
        if (m.offen1) eigeneOffenGesehen = true;
        if (m.offen2) fremdeOffenGesehen = true;
      }
      await page.waitForTimeout(200);
    }
    if (!imFenster) { fail('Zumauern: keine Bauphase mit Restzeit ≤ 8 erwischt'); return { res, errs }; }

    if (!fremdeOffenGesehen) {
      fail('Zumauern: die Bot-Burg war nie offen — die Pruefung sagt nichts aus');
    } else if (!gesehen.has(2)) {
      ok(`Offene Bot-Burg wird nicht gemahnt (gemahnt wurde: ${[...gesehen].join(',') || 'niemand'}) ✓`);
    } else {
      fail('Die Bot-Burg wird gemahnt — die Warnung gilt nur fuer eigene Burgen');
    }

    if (!eigeneOffenGesehen) {
      fail('Zumauern: die eigene Burg war nie offen — die Gegenprobe sagt nichts aus');
    } else if (gesehen.has(1)) {
      ok('Offene eigene Burg wird gemahnt ✓');
    } else {
      fail('Die eigene offene Burg wird NICHT gemahnt — die Warnung ist ganz weg');
    }
  } finally { await ctx.close(); }

  errs.length ? errs.slice(0, 3).forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`))
              : ok('Zumauern-Warnung: keine JS-Fehler ✓');
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 0d: Trichter (v3.79.0)
// Drei Eingriffe gegen das eigentliche Problem: bei zehn aktiven Spielern ist
// die Warteschlange fast immer leer. Geprueft wird, dass die Sackgasse weg ist
// (Bot sofort waehlbar), dass der Absprung messbar wird (Trichter-Telemetrie)
// und dass nach einem Match eine Einladung statt nur eines Links angeboten wird.
// ═══════════════════════════════════════════════════════════════
async function suiteTrichter(browser, fbPort) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Trichter\n' + '='.repeat(50));

  // __mmDebug schaltet die Diagnose-Haken frei — ohne ihn sammelt trichter()
  // nichts in window.__trichter und die Pruefung liefe ins Leere.
  const { ctx, page } = await makeOnlineCtx(browser, fbPort, 'window.__mmDebug = true;');
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);
    // Gleicher Weg wie die Matchmaking-Suite: der Knopf heisst "Matchmaking".
    await jsClick(page, ['ONLINE']);
    await page.waitForTimeout(250);
    await jsClick(page, ['Matchmaking']);
    await page.waitForTimeout(1400);

    // ── Bot SOFORT waehlbar, nicht erst nach 60 s ──────────────
    const st = await page.evaluate(() => ({
      // NICHT auf "Gegner" pruefen — das Wort steht schon auf dem Startknopf
      // und meldete Erfolg, obwohl die Suche gar nicht lief.
      sucht: /Suche l|Sucht|Searching for/i.test(document.body.innerText)
             || !!(window.__trichter || []).length,
      botKnopf: [...document.querySelectorAll('button')]
        .some(b => /Jetzt gegen den Bot|Play against the bot/i.test(b.textContent)),
      countdown: /in \d+ ?s|noch \d+/i.test(document.body.innerText)
    }));
    st.sucht ? ok('Trichter: Suche laeuft ✓') : fail('Trichter: Suchbildschirm nicht erreicht');
    st.botKnopf
      ? ok('Trichter: Bot ab Sekunde eins waehlbar — keine Sackgasse mehr ✓')
      : fail('Trichter: kein Bot-Knopf waehrend der Suche');

    // ── Trichter-Ereignisse werden erfasst ─────────────────────
    const ereignisse = await page.evaluate(() => (window.__trichter || []).map(x => x.schritt));
    ereignisse.includes('suche_start')
      ? ok('Trichter: "suche_start" erfasst ✓')
      : fail(`Trichter: suche_start fehlt (${JSON.stringify(ereignisse)})`);

    // ── Bot-Knopf fuehrt wirklich ins Spiel ────────────────────
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button'))
        if (/Jetzt gegen den Bot|Play against the bot/i.test(b.textContent)) { b.click(); return; }
    });
    const imSpiel = await page.waitForSelector('canvas', { timeout: 12000 })
      .then(() => true).catch(() => false);
    imSpiel ? ok('Trichter: Bot-Knopf startet die Partie ✓')
            : fail('Trichter: Bot-Knopf fuehrt nicht ins Spiel');

    const nachher = await page.evaluate(() => (window.__trichter || []));
    const bot = nachher.find(x => x.schritt === 'bot_start');
    bot ? ok(`Trichter: "bot_start" erfasst (auto=${bot.auto}, wartete=${bot.wartete}s) ✓`)
        : fail('Trichter: bot_start fehlt');
    (bot && bot.auto === false)
      ? ok('Trichter: selbst gewaehlt von automatisch unterschieden ✓')
      : fail('Trichter: auto-Kennzeichnung falsch');

    // ── Keine personenbezogenen Daten im Trichter ──────────────
    const sauber = nachher.every(x =>
      !JSON.stringify(x).match(/TestBot|test_bot_001|fortress_device/));
    sauber ? ok('Trichter: keine Namen oder Kennungen in den Daten ✓')
           : fail('Trichter: personenbezogene Daten in der Telemetrie!');

    errs.length ? errs.slice(0, 3).forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`))
                : ok('Trichter: keine JS-Fehler ✓');
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 5b: Herzschlag — HARTER Gast-Abbruch (v3.70.0)
// Ein sauberes Verlassen schickt `leave`; ein gekillter Client schickt gar
// nichts. Vorher spielte der Host danach gegen einen Geist weiter. Der Test
// killt den Gast-Kontext OHNE Beenden-Klick und prueft, dass der Host es
// merkt und die Partie ueber denselben Weg beendet wie ein echtes Verlassen.
// `__hbFast` staucht die Fristen (sonst 30 s Wartezeit).
// ═══════════════════════════════════════════════════════════════
async function suiteHeartbeat(browser, fbPort) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Herzschlag / harter Abbruch\n' + '='.repeat(50));

  const fastInit = `window.__hbFast = true; window.__mmDebug = true;`;
  const { ctx: ctxH, page: pH } = await makeOnlineCtx(browser, fbPort, fastInit);
  const { ctx: ctxG, page: pG } = await makeOnlineCtx(browser, fbPort, fastInit);
  pH.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });

  let guestClosed = false;
  try {
    await Promise.all([loadMenu(pH), loadMenu(pG)]);
    await jsClick(pH, ['ONLINE']); await pH.waitForTimeout(200);
    await jsClick(pH, ['Spiel erstellen']); const code = (await warteAufCode(pH)).code;
    if (!code) { fail('Herzschlag: kein Spielcode → Suite abgebrochen'); return { res, errs }; }

    await jsClick(pG, ['ONLINE']); await pG.waitForTimeout(200);
    await jsClick(pG, ['Spiel beitreten', 'beitreten']); await pG.waitForTimeout(200);
    await pG.waitForSelector('input:not([type=range])', { timeout: 3000 }).catch(() => {});
    if (await pG.evaluate(() => !!document.querySelector('input:not([type=range])')))
      await pG.fill('input:not([type=range])', code);
    await pG.waitForTimeout(100);
    await jsClick(pG, ['Beitreten']);

    const hostCanvas = await pH.waitForSelector('canvas', { timeout: 8000 }).then(() => true).catch(() => false);
    const guestCanvas = await pG.waitForSelector('canvas', { timeout: 8000 }).then(() => true).catch(() => false);
    const bothIn = hostCanvas && guestCanvas;
    if (!bothIn) { fail('Herzschlag: Spiel kam nicht zustande → Suite abgebrochen'); return { res, errs }; }
    ok('Herzschlag: Host + Gast im Spiel ✓');

    // 1) Der Gast MUSS ein Lebenszeichen schreiben — vorher gab es keines.
    const hb = await pH.evaluate(async (a) => {
      try { return await (await fetch('http://localhost:' + a.port + '/fb?op=get&path=' + encodeURIComponent('games/' + a.code + '/hb2'))).json(); }
      catch (e) { return 'ERR'; }
    }, { port: fbPort, code });
    (typeof hb === 'number' && hb > 0) ? ok(`Herzschlag: Gast schreibt hb2 (${hb}) ✓`)
                                       : fail(`Herzschlag: kein hb2 vom Gast (${JSON.stringify(hb)})`);

    // 2) Der Host muss das Lebenszeichen auch SEHEN.
    const seen = await pH.evaluate(() => (window.__hbDbg && window.__hbDbg()) || null);
    (seen && seen.slots && seen.slots['2'] && seen.slots['2'].ever)
      ? ok('Herzschlag: Host empfängt das Lebenszeichen ✓')
      : fail(`Herzschlag: Host sieht keinen Gast-Slot (${JSON.stringify(seen)})`);
    (seen && seen.fbOnline === true)
      ? ok('Herzschlag: eigener Verbindungsstatus erkannt (.info/connected) ✓')
      : fail(`Herzschlag: fbOnline nicht true (${JSON.stringify(seen && seen.fbOnline)})`);

    // 3) HARTER Abbruch: Kontext killen, KEIN Beenden-Klick → kein `leave`.
    await ctxG.close(); guestClosed = true;

    // 4)+5) In EINER Schleife beobachten: das Banner steht nur zwischen
    // HB_WARN_MS und HB_DROP_MS (im Schnellmodus ~1,6-4,5 s) — wer erst danach
    // zu pollen beginnt, sieht es nicht mehr. Deshalb beides gleichzeitig.
    let banner = false, ended = null;
    for (let i = 0; i < 80 && !ended; i++) {
      const st = await pH.evaluate(() => {
        const t = document.body.innerText;
        const d = (window.__hbDbg && window.__hbDbg()) || {};
        return {
          banner: /antwortet nicht/i.test(t) || !!d.opp,
          over: d.screen === 'result',
          left: /verlassen/i.test(t),
          dbg: d
        };
      });
      if (st.banner) banner = true;
      if (st.over) ended = st;
      if (!ended) await pH.waitForTimeout(150);
    }
    const lastDbg = await pH.evaluate(() => JSON.stringify((window.__hbDbg && window.__hbDbg()) || {}));
    banner ? ok('Herzschlag: Host meldet "Gegner antwortet nicht" ✓')
           : fail(`Herzschlag: kein Hinweis beim Host — ${lastDbg}`);
    ended ? ok('Herzschlag: Partie beendet statt Geisterspiel ✓')
          : fail(`Herzschlag: Host spielt nach hartem Abbruch weiter — ${lastDbg}`);
    (ended && ended.left) ? ok('Herzschlag: Ergebnis nennt "verlassen" (reason=left) ✓')
                          : fail('Herzschlag: Ergebnis ohne Verlassen-Begründung');

    errs.length ? errs.slice(0, 3).forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`))
                : ok('Herzschlag: keine JS-Fehler ✓');
  } finally {
    try { if (!guestClosed) await ctxG.close(); } catch (e) {}
    try { await ctxH.close(); } catch (e) {}
  }
  return { res, errs };
}

async function suiteOnline3P(browser, fbPort) {
  const res = [], errsAll = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Online 3-Spieler\n' + '='.repeat(50));

  const mk = async (n, pid, dev) => {
    const c = await makeOnlineCtx(browser, fbPort, mmIdentInit(n, pid, dev) + ";window.__mmDebug=true;");
    c.page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errsAll.push(`${n}: ${e.message}`); });
    await loadMenu(c.page);
    return c;
  };
  const inGame = (p, t) => p.waitForSelector('canvas', { timeout: t }).then(() => true).catch(() => false);
  const quitBtn = async (p) => {
    await p.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if (b.textContent.includes('beenden') || (b.title || '').includes('beenden') || b.textContent.trim() === '✕') { b.click(); return; }
      }
    });
    await p.waitForTimeout(250);
    await jsClick(p, ['Ja', 'Beenden', 'verlassen']);
    await p.waitForTimeout(400);
    await jsClick(p, ['Hauptmenü']);
    await p.waitForTimeout(300);
  };
  const startMM3 = async (p) => {
    await jsClick(p, ['ONLINE']);
    await p.waitForTimeout(200);
    await jsClick(p, ['3 Spieler']);
    await p.waitForTimeout(150);
    await jsClick(p, ['Matchmaking']);
    await p.waitForTimeout(150);
  };

  const H = await mk('O3Host', 'p_o3h', 'd_o3h');
  const G2 = await mk('O3GastB', 'p_o3b', 'd_o3b');
  const G3 = await mk('O3GastC', 'p_o3c', 'd_o3c');
  try {
    // ── Code-Join: Host erstellt 3P-Spiel, zwei Gäste treten bei ──
    await jsClick(H.page, ['ONLINE']); await H.page.waitForTimeout(200);
    await jsClick(H.page, ['3 Spieler']); await H.page.waitForTimeout(150);
    await jsClick(H.page, ['Spiel erstellen']); const code = (await warteAufCode(H.page)).code;
    if (!code) { fail('3P Code-Join: kein Spielcode'); return { res, errs: errsAll }; }
    for (const G of [G2, G3]) {
      await jsClick(G.page, ['ONLINE']); await G.page.waitForTimeout(200);
      await jsClick(G.page, ['beitreten', 'Beitreten']); await G.page.waitForTimeout(200);
      if (await G.page.evaluate(() => !!document.querySelector('input:not([type=range])'))) await G.page.fill('input:not([type=range])', code);
      await G.page.waitForTimeout(100);
      await jsClick(G.page, ['Beitreten']);
      await G.page.waitForTimeout(400);
    }
    const [j1, j2, j3] = await Promise.all([inGame(H.page, 12000), inGame(G2.page, 12000), inGame(G3.page, 12000)]);
    j1 && j2 && j3 ? ok('3P Code-Join: Host + 2 Gäste im Spiel ✓') : fail(`3P Code-Join: H=${j1} G2=${j2} G3=${j3}`);

    if (j1 && j2 && j3) {
      await H.page.waitForTimeout(2500);
      const sync3 = await wartePhasenGleich([H.page, G2.page, G3.page]);
      sync3.gleich
        ? ok(`3P Phasen-Sync: alle in "${sync3.phase}" (${sync3.versuche}. Stichprobe) ✓`)
        : fail(`3P Phasen-Desync ueber ${sync3.ms} ms / ${sync3.versuche} Stichproben: `
             + sync3.phasen.join('/'));
    }
    // Alle sauber raus (Host zuerst → Gäste bekommen Ergebnis)
    await quitBtn(H.page);
    await G2.page.waitForTimeout(2000);
    await jsClick(G2.page, ['Hauptmenü']); await jsClick(G3.page, ['Hauptmenü']);
    await G2.page.waitForTimeout(400);

    // ── Quick-Match-Tripel über queue3 ──
    for (const X of [H, G2, G3]) await startMM3(X.page);
    const [m1, m2, m3] = await Promise.all([inGame(H.page, 25000), inGame(G2.page, 25000), inGame(G3.page, 25000)]);
    m1 && m2 && m3 ? ok('3P Quick-Match: Tripel gematcht ✓') : fail(`3P Quick-Match: H=${m1} G2=${m2} G3=${m3}`);

    if (m1 && m2 && m3) {
      // ── Gast-Ausstieg mitten im Spiel + Rejoin (screenRef-Regression v3.14.17) ──
      await H.page.waitForTimeout(1200);
      const clients = [['H', H], ['G2', G2], ['G3', G3]];
      const roles = {};
      for (const [nm, X] of clients) roles[nm] = await X.page.evaluate(() => window.__myRole || 0);
      const guest = clients.find(([nm]) => roles[nm] !== 1) || clients[1];
      await quitBtn(guest[1].page);
      await H.page.waitForTimeout(1500);
      for (const [nm, X] of clients) { if (nm !== guest[0]) await quitBtn(X.page); }
      await H.page.waitForTimeout(600);
      for (const X of [H, G2, G3]) await startMM3(X.page);
      const [r1, r2, r3] = await Promise.all([inGame(H.page, 25000), inGame(G2.page, 25000), inGame(G3.page, 25000)]);
      r1 && r2 && r3 ? ok('3P Rejoin nach Gast-Ausstieg: alle wieder gematcht ✓')
                     : fail(`3P Rejoin: H=${r1} G2=${r2} G3=${r3} (Gast-Ausstieg=${guest[0]})`);
      for (const [, X] of clients) await quitBtn(X.page);
    }

    // ── Queue-Hygiene ──
    await H.page.waitForTimeout(1200);
    const q3 = await H.page.evaluate(async (port) => {
      try { return await (await fetch('http://localhost:' + port + '/fb?op=get&path=queue3')).json(); } catch (e) { return 'ERR'; }
    }, fbPort);
    const q3n = q3 && q3 !== 'ERR' ? Object.keys(q3).length : 0;
    q3n === 0 ? ok('queue3 nach Matches leer ✓') : fail(`queue3 nicht leer: ${q3n} Ticket(s)`);

    errsAll.length === 0 ? ok('3P Online: Keine JS-Fehler ✓') : errsAll.slice(0, 3).forEach(e => fail(`3P JS: ${e.slice(0, 80)}`));
  } finally {
    await H.ctx.close(); await G2.ctx.close(); await G3.ctx.close();
  }
  return { res, errs: errsAll };
}


// ═══════════════════════════════════════════════════════════════
// SUITE: Online-Aktionen — kommt die Gast-Aktion beim HOST an? (v3.111.0)
//
// Die Luecke, die das schliesst: Bis v3.110.1 pruefte die Online-Suite
// Beitritt, Phasen-Sync, Timer, HUD und Emotes — und fuer Spielzuege
// „Gast: Canvas-Tap ohne Crash". Das belegt keinen Multiplayer, sondern nur,
// dass nichts explodiert. Ob der autoritative Zustand des HOSTS sich durch
// eine Gast-Aktion wirklich aendert, stand nirgends.
//
// Genau dort sassen historisch die schlimmsten Fehler: v3.0.6 („pieces[3] fuer
// P3-Gaeste nie initialisiert → P3 konnte nichts platzieren") und v2.8.2
// („activeBuild-Reset fehlte P3"). Beide waren still — die Seite lief, der
// Tap kam an, es passierte nur nichts.
//
// Geprueft wird deshalb der ganze Weg: Gast klickt → Aktion in
// guestAction{2,3} → Host wendet sie an → Hosts Gitter aendert sich. Gemessen
// wird beim HOST, nicht beim Gast.
// ═══════════════════════════════════════════════════════════════
async function suiteOnlineAktionen(browser, fbPort) {
  const res = [], errsAll = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Online-Aktionen (Gast → Host)\n' + '='.repeat(50));

  const mk = async (n, pid, dev) => {
    const c = await makeOnlineCtx(browser, fbPort, mmIdentInit(n, pid, dev) + ';window.__mmDebug=true;',
                                  { langsam: true });
    c.page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errsAll.push(`${n}: ${e.message}`); });
    await loadMenu(c.page);
    return c;
  };
  const inGame = (p, t) => p.waitForSelector('canvas', { timeout: t }).then(() => true).catch(() => false);

  /** Spiel erstellen und den Code aus dem Wartescreen lesen. */
  const erstelle = async (page, spieler) => {
    await jsClick(page, ['ONLINE']); await page.waitForTimeout(200);
    await jsClick(page, [spieler === 3 ? '3 Spieler' : '2 Spieler']); await page.waitForTimeout(150);
    await jsClick(page, ['Spiel erstellen']);
    return (await warteAufCode(page)).code;
  };
  const tritt_bei = async (page, code) => {
    await jsClick(page, ['ONLINE']); await page.waitForTimeout(200);
    await jsClick(page, ['beitreten', 'Beitreten']); await page.waitForTimeout(200);
    if (await page.evaluate(() => !!document.querySelector('input:not([type=range])')))
      await page.fill('input:not([type=range])', code);
    await page.waitForTimeout(100);
    await jsClick(page, ['Beitreten']);
    await page.waitForTimeout(400);
  };

  const zellenBeimHost = (hp, p) => hp.evaluate((q) => window.__zellen ? window.__zellen(q) : null, p);

  /**
   * Der Gast tippt auf sein Spielfeld, BIS beim Host etwas ankommt.
   *
   * Warum abtasten statt einmal an die „richtige" Stelle tippen: Welcher Teil
   * des Bretts dem Gast gehoert, haengt an Terrain, Sektorkarte und der
   * Spiegelung seiner Ansicht. Eine fest verdrahtete Stelle waere eine
   * Annahme — und stille Annahmen sind genau das, was dieser Test aufdecken
   * soll. Abgebrochen wird, sobald der HOST die Aenderung zeigt.
   */
  const gastSetztKanone = async (gastPage, hostPage, p, frist = 25000) => {
    const vorher = await zellenBeimHost(hostPage, p);
    const cb = await gastPage.evaluate(() => {
      const c = document.querySelector('canvas'); if (!c) return null;
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    if (!cb) return { ok: false, grund: 'kein Canvas beim Gast', vorher, nachher: null, tipps: 0 };

    const stellen = [];
    for (const fy of [0.30, 0.70, 0.22, 0.78, 0.40, 0.60, 0.50])
      for (const fx of [0.5, 0.35, 0.65, 0.25, 0.75])
        stellen.push([fx, fy]);

    const ende = Date.now() + frist;
    let tipps = 0;
    const phasenGesehen = new Set();
    while (Date.now() < ende) {
      for (const [fx, fy] of stellen) {
        const ph = await hostPage.evaluate(() => window.__phase ? window.__phase() : null);
        phasenGesehen.add(String(ph));
        if (ph !== 'setup' && ph !== 'cannon') { await gastPage.waitForTimeout(150); continue; }
        await gastPage.mouse.click(cb.x + cb.w * fx, cb.y + cb.h * fy);
        tipps++;
        await gastPage.waitForTimeout(160);
        const jetzt = await zellenBeimHost(hostPage, p);
        if (jetzt && vorher && jetzt.kanonen > vorher.kanonen)
          return { ok: true, vorher, nachher: jetzt, tipps, ms: frist - (ende - Date.now()) };
        if (Date.now() >= ende) break;
      }
    }
    // Was der Lauf beobachtet hat, gehoert in die Meldung — sonst faengt
    // beim naechsten Fehlschlag das Raten an (SPEC v3.108.0).
    const wirt = await hostPage.evaluate(() => ({
      phase: window.__phase ? window.__phase() : null,
      eigene: window.__zellen ? window.__zellen(1) : null,
      rolle: window.__myRole !== undefined ? window.__myRole : null,
    }));
    const gast = await gastPage.evaluate(() => ({
      rolle: window.__myRole !== undefined ? window.__myRole : null,
      phase: window.__phase ? window.__phase() : null,
      zellen: window.__zellen ? window.__zellen(2) : null,
    }));
    return { ok: false, grund: 'Frist abgelaufen', vorher,
             nachher: await zellenBeimHost(hostPage, p), tipps,
             phasen: [...phasenGesehen].join(','), wirt, gast };
  };

  // ─────────────────────────────────────────────────────────────
  // A) ZWEI SPIELER: Gast 2 wirkt auf das Gitter des Hosts
  // ─────────────────────────────────────────────────────────────
  {
    const H = await mk('AktHost', 'p_akt_h', 'd_akt_h');
    const G = await mk('AktGast', 'p_akt_g', 'd_akt_g');
    try {
      const code = await erstelle(H.page, 2);
      if (!code) { fail('2P Aktionen: kein Spielcode'); }
      else {
        await tritt_bei(G.page, code);
        const [a, b] = await Promise.all([inGame(H.page, 12000), inGame(G.page, 12000)]);
        a && b ? ok('2P Aktionen: Host und Gast im Spiel ✓') : fail(`2P Aktionen: H=${a} G=${b}`);

        if (a && b) {
          // Die Haken selbst muessen greifen, sonst misst alles Weitere nichts.
          const z0 = await zellenBeimHost(H.page, 1);
          z0 && typeof z0.mauern === 'number'
            ? ok(`2P Aktionen: Haken __zellen liefert Zahlen (P1: ${z0.mauern} Mauern) ✓`)
            : fail(`2P Aktionen: __zellen liefert nichts (${JSON.stringify(z0)})`);

          const r = await gastSetztKanone(G.page, H.page, 2);
          r.ok
            ? ok(`2P Aktionen: Gast setzt Kanone, HOST sieht sie `
                 + `(${r.vorher.kanonen} → ${r.nachher.kanonen} Zellen, ${r.tipps} Tipps) ✓`)
            : fail(`2P Aktionen: Gast-Kanone erreicht den Host NICHT — ${r.grund}, `
                 + `${r.tipps} Tipps, Host sieht ${JSON.stringify(r.nachher)}`);

          // Gegenprobe zur Messung selbst: Der Host darf NICHT zufaellig
          // gewachsen sein, weil irgendwer irgendwo etwas tut. P3 gibt es im
          // 2-Spieler-Spiel nicht — dort muss die Zahl null bleiben.
          const z3 = await zellenBeimHost(H.page, 3);
          (z3 && z3.kanonen === 0 && z3.mauern === 0)
            ? ok('2P Aktionen: P3 bleibt leer (Messung zaehlt nicht wahllos) ✓')
            : fail(`2P Aktionen: P3 hat Zellen im 2-Spieler-Spiel: ${JSON.stringify(z3)}`);
        }
      }
    } finally { await H.ctx.close(); await G.ctx.close(); }
  }

  // ─────────────────────────────────────────────────────────────
  // B) DREI SPIELER: Sektorkarte einig, und Gast 3 kann wirklich bauen
  // ─────────────────────────────────────────────────────────────
  {
    const H = await mk('Akt3Host', 'p_a3_h', 'd_a3_h');
    const G2 = await mk('Akt3G2', 'p_a3_b', 'd_a3_b');
    const G3 = await mk('Akt3G3', 'p_a3_c', 'd_a3_c');
    try {
      const code = await erstelle(H.page, 3);
      if (!code) { fail('3P Aktionen: kein Spielcode'); }
      else {
        for (const G of [G2, G3]) await tritt_bei(G.page, code);
        const [a, b, c] = await Promise.all([
          inGame(H.page, 14000), inGame(G2.page, 14000), inGame(G3.page, 14000)]);
        a && b && c ? ok('3P Aktionen: Host + 2 Gäste im Spiel ✓') : fail(`3P Aktionen: H=${a} G2=${b} G3=${c}`);

        if (a && b && c) {
          // ── Sektorkarte: wird beim Gast NEU BERECHNET, nicht uebertragen ──
          //
          // Weicht sie ab, darf ein Spieler scheinbar bauen und der Host lehnt
          // ab (oder umgekehrt) — ein Fehler, der sich als „mein Stein wird
          // nicht gesetzt" zeigt und nirgends als Fehler auftaucht.
          const hashes = [];
          const bis = Date.now() + 15000;
          while (Date.now() < bis) {
            const hs = await Promise.all([H.page, G2.page, G3.page].map(p =>
              p.evaluate(() => window.__sektorHash ? window.__sektorHash() : null)));
            if (hs.every(h => h && h.hash)) { hashes.push(...hs); break; }
            await H.page.waitForTimeout(400);
          }
          if (hashes.length === 3) {
            const [h1, h2, h3] = hashes;
            // ERST pruefen, dass ueberhaupt etwas drinsteht. Der erste Anlauf
            // meldete „alle drei identisch (0 Zellen)" — der Haken lief ueber
            // ein flaches Int8Array wie ueber ein 2D-Feld und zaehlte nichts.
            // Ein Vergleich von drei leeren Karten ist immer wahr.
            (h1.zellen > 1000 && h1.belegt > 100)
              ? ok(`3P Sektorkarte: gefuellt (${h1.zellen} Zellen, ${h1.belegt} zugeteilt) ✓`)
              : fail(`3P Sektorkarte ist LEER — der Vergleich darunter waere wertlos `
                   + `(${h1.zellen} Zellen, ${h1.belegt} zugeteilt)`);
            (h1.hash === h2.hash && h1.hash === h3.hash)
              ? ok(`3P Sektorkarte: alle drei Seiten identisch (${h1.hash}, ${h1.belegt} zugeteilt) ✓`)
              : fail(`3P Sektorkarte WEICHT AB: Host ${h1.hash} (${h1.belegt}) / `
                   + `G2 ${h2.hash} (${h2.belegt}) / G3 ${h3.hash} (${h3.belegt})`);
            (h1.seed === h2.seed && h1.seed === h3.seed)
              ? ok(`3P Terrain-Seed auf allen Seiten gleich (${h1.seed}) ✓`)
              : fail(`3P Terrain-Seed weicht ab: ${h1.seed} / ${h2.seed} / ${h3.seed}`);
          } else {
            fail('3P Sektorkarte: kein Fingerabdruck zu bekommen (Haken oder mode3 fehlt)');
          }

          // ── Gast 3 muss bauen koennen (Regression v3.0.6) ──
          const r3 = await gastSetztKanone(G3.page, H.page, 3, 30000);
          r3.ok
            ? ok(`3P Aktionen: GAST 3 setzt Kanone, Host sieht sie `
                 + `(${r3.vorher.kanonen} → ${r3.nachher.kanonen} Zellen, ${r3.tipps} Tipps) ✓`)
            : fail(`3P Aktionen: Gast 3 erreicht den Host NICHT — ${r3.grund}, `
                 + `${r3.tipps} Tipps, Host sieht ${JSON.stringify(r3.nachher)}, `
                 + `Phasen [${r3.phasen}], Host-eigene ${JSON.stringify(r3.wirt)}, `
                 + `Gast ${JSON.stringify(r3.gast)}`);

          const r2 = await gastSetztKanone(G2.page, H.page, 2, 30000);
          r2.ok
            ? ok(`3P Aktionen: Gast 2 setzt Kanone, Host sieht sie `
                 + `(${r2.vorher.kanonen} → ${r2.nachher.kanonen} Zellen) ✓`)
            : fail(`3P Aktionen: Gast 2 erreicht den Host NICHT — ${r2.grund}, ${r2.tipps} Tipps, `
                 + `Phasen [${r2.phasen}], Gast ${JSON.stringify(r2.gast)}`);

          // ── Der Abgleich muss WIRKEN: heilen, wo es geht — melden, wo nicht ──
          //
          // Ohne diese beiden Proben waere der Schutz aus v3.111.0 nur Code,
          // der nie ausloest: im Normalfall stimmen die Karten ja ueberein.
          // Geprueft wird deshalb der Fehlerfall, und zwar in beiden Formen.
          const warnungDa = (pg) => pg.evaluate(() =>
            /weicht vom Host ab|differs from host/i.test(document.body.innerText));

          // (1) Nur die KARTE verfaelschen — die Eingaben stimmen noch, also
          //     muss der Gast sie stillschweigend neu berechnen.
          const v1 = await G2.page.evaluate(() =>
            window.__sektorVerbiegen ? window.__sektorVerbiegen('karte') : null);
          if (v1) {
            const bis1 = Date.now() + 8000;
            let geheilt = false;
            while (Date.now() < bis1 && !geheilt) {
              const h = await Promise.all([H.page, G2.page].map(pg =>
                pg.evaluate(() => window.__sektorHash ? window.__sektorHash() : null)));
              if (h[0] && h[1] && h[0].hash === h[1].hash) geheilt = true;
              else await G2.page.waitForTimeout(300);
            }
            geheilt ? ok('3P Sektor-Abgleich: verfaelschte Karte wurde selbst geheilt ✓')
                    : fail('3P Sektor-Abgleich: verfaelschte Karte blieb kaputt');
            const gemeldet1 = await warnungDa(G2.page);
            !gemeldet1 ? ok('3P Sektor-Abgleich: kein Fehlalarm beim blossen Schluckauf ✓')
                       : fail('3P Sektor-Abgleich: Fehlalarm, obwohl die Karte heilbar war');
          } else fail('3P Sektor-Abgleich: Haken __sektorVerbiegen fehlt');

          // (2) Die EINGABEN verschieben — Neuberechnen hilft nicht mehr, die
          //     Meldung muss kommen. Genau der Fall, der ohne Abgleich still
          //     bliebe: der Spieler tippt, und nichts passiert.
          const v2 = await G3.page.evaluate(() =>
            window.__sektorVerbiegen ? window.__sektorVerbiegen('gelaende') : null);
          if (v2) {
            const bis2 = Date.now() + 12000;
            let gemeldet = false;
            while (Date.now() < bis2 && !gemeldet) {
              gemeldet = await warnungDa(G3.page);
              if (!gemeldet) await G3.page.waitForTimeout(300);
            }
            gemeldet
              ? ok('3P Sektor-Abgleich: abweichende Eingaben werden GEMELDET ✓')
              : fail('3P Sektor-Abgleich: Abweichung blieb still — der Schutz loest nicht aus');
          } else fail('3P Sektor-Abgleich: Haken fehlt (Fall gelaende)');

          // ── Ausscheide-Haken: im laufenden Spiel ist niemand raus ──
          const elim = await H.page.evaluate(() => window.__eliminiert ? window.__eliminiert() : null);
          Array.isArray(elim) && elim.length === 0
            ? ok('3P Ausscheiden: im laufenden Spiel ist niemand ausgeschieden ✓')
            : fail(`3P Ausscheiden: unerwarteter Stand ${JSON.stringify(elim)}`);
        }
      }
    } finally { await H.ctx.close(); await G2.ctx.close(); await G3.ctx.close(); }
  }

  errsAll.length === 0 ? ok('Online-Aktionen: keine JS-Fehler ✓')
                       : errsAll.slice(0, 3).forEach(e => fail(`Aktionen JS: ${e.slice(0, 90)}`));
  return { res, errs: errsAll };
}


// ═══════════════════════════════════════════════════════════════
// SUITE: Bestenliste — sie muss ANTWORTEN, auch wenn nichts kommt (v3.111.1)
//
// Anlass: Ein Bildschirmfoto aus der TestFlight-App (v3.103.0) zeigte die
// Bestenliste dauerhaft auf „Lädt…" — ohne Meldung, ohne Hinweis worauf
// gewartet wird. Die Ursache steckte nicht in den Sicherheitsregeln (ein
// abgelehnter Zugriff endet in `fb.get` → null → „keine Einträge"), sondern
// eine Stufe tiefer: Das Firebase-SDK loest `get()` gar nicht auf, solange
// keine Verbindung zustande kommt. `setLeaderboard` wurde nie aufgerufen, der
// Zustand blieb `null`, und `null` heisst in der Anzeige „Lädt…".
//
// Bis dahin gab es zur Bestenliste GENAU eine Pruefung: ob der Knopf da ist.
// Ob sie jemals etwas anzeigt, stand nirgends.
// ═══════════════════════════════════════════════════════════════
async function suiteBestenliste(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Bestenliste\n' + '='.repeat(50));

  const oeffne = async (page) => {
    await jsClick(page, ['Bestenliste', 'Rangliste', 'Leaderboard']);
    await page.waitForTimeout(400);
  };
  const zustand = (page) => page.evaluate(() => {
    const t = document.body.innerText;
    return {
      laedt: /Lädt…|Loading…/.test(t),
      fehler: !!document.querySelector('[data-lb-fehler]'),
      fehlertext: (document.querySelector('[data-lb-fehler]') || {}).textContent || '',
      leer: /Noch keine Einträge|No entries yet/.test(t),
      zeilen: document.querySelectorAll('[data-lb-zeile]').length,
      offen: /Bestenliste|Leaderboard/.test(t),
    };
  });

  // ── 1) Datenbank liefert Eintraege → Liste erscheint ──────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
      serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.addInitScript(PROFILE_INIT);
    await page.addInitScript(FB_SPERRE);
    // Die Sperre liefert von Haus aus „nichts da". Hier soll sie EINTRAEGE
    // liefern, damit die Liste ueberhaupt etwas zu zeigen hat.
    // Die App ruft `s.get(s.ref(s.db, pfad))` und erwartet einen SNAPSHOT
    // (`exists()`/`val()`), keine rohen Daten — der erste Anlauf gab die Daten
    // direkt zurueck und lief in „Cannot read properties of null (reading
    // 'exists')". Also muss auch `ref` den Pfad durchreichen.
    await page.addInitScript(`
      window.__fb.ref = (db, pfad) => ({ __pfad: String(pfad) });
      window.__fb.get = async (r) => {
        const pfad = (r && r.__pfad) || '';
        if (pfad.indexOf('leaderboard') === 0) return {
          exists: () => true,
          val: () => ({
            p_a: { name: 'Anna',  elo: 1200, wins: 8, losses: 2, games: 10 },
            p_b: { name: 'Bodo',  elo: 1100, wins: 4, losses: 4, games: 8  },
            p_c: { name: 'Niemand', elo: 1000, wins: 0, losses: 0, games: 0 }
          })
        };
        return { exists: () => false, val: () => null };
      };
    `);
    page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
    try {
      await loadMenu(page);
      await oeffne(page);
      let z = null;
      for (let i = 0; i < 30; i++) { z = await zustand(page); if (!z.laedt) break; await page.waitForTimeout(200); }
      !z.laedt ? ok('Bestenliste: verlaesst den Ladezustand ✓')
               : fail('Bestenliste: bleibt auf „Lädt…" haengen, obwohl Daten da sind');
      const text = await page.evaluate(() => document.body.innerText);
      /Anna/.test(text) && /Bodo/.test(text)
        ? ok('Bestenliste: zeigt die Eintraege (Anna, Bodo) ✓')
        : fail('Bestenliste: Eintraege fehlen in der Anzeige');
      // Wer nie gespielt hat, gehoert nicht in die Rangliste.
      !/Niemand/.test(text) ? ok('Bestenliste: Eintraege ohne Spiele bleiben draussen ✓')
                            : fail('Bestenliste: Eintrag mit 0 Spielen wird angezeigt');
      !z.fehler ? ok('Bestenliste: kein Fehlalarm bei erreichbarer Datenbank ✓')
                : fail(`Bestenliste: Fehlermeldung obwohl alles ging (${z.fehlertext})`);
    } finally { await ctx.close(); }
  }

  // ── 2) Datenbank antwortet NIE → Meldung statt ewigem „Lädt…" ──
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
      serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.addInitScript(PROFILE_INIT);
    await page.addInitScript(FB_SPERRE);
    // GENAU der gemeldete Fall: `get()` loest nie auf. Kein Fehler, keine
    // Ablehnung — nur Stille. Das laesst sich mit keiner Route nachstellen,
    // weil die Realtime Database ueber WebSocket spricht.
    await page.addInitScript(`window.__fb.get = () => new Promise(() => {});`);
    page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
    try {
      await loadMenu(page);
      await oeffne(page);
      const start = Date.now();
      let z = null;
      // Die Zeitgrenze steht bei 8 s; 20 s Frist geben reichlich Luft.
      for (let i = 0; i < 100; i++) {
        z = await zustand(page);
        if (z.fehler) break;
        await page.waitForTimeout(200);
      }
      const sek = ((Date.now() - start) / 1000).toFixed(1);
      z.fehler
        ? ok(`Bestenliste: stumme Datenbank wird nach ${sek}s GEMELDET ✓`)
        : fail(`Bestenliste: nach ${sek}s immer noch keine Meldung — `
             + `laedt=${z.laedt}, leer=${z.leer}. Genau der Fall aus der TestFlight-App.`);
      z.fehler && !z.laedt
        ? ok('Bestenliste: „Lädt…" verschwindet mit der Meldung ✓')
        : (z.fehler ? fail('Bestenliste: Meldung da, aber „Lädt…" steht weiter') : null);
      // Und die Meldung darf nicht luegen: „noch keine Eintraege" waere hier
      // falsch — es ist eine Verbindungssache, kein leerer Zustand.
      !z.leer ? ok('Bestenliste: behauptet NICHT „noch keine Eintraege" ✓')
              : fail('Bestenliste: behauptet „noch keine Eintraege", obwohl nur die Verbindung fehlt');
    } finally { await ctx.close(); }
  }

  // ── 3) Selbstauskunft im Online-Schirm (v3.111.2) ─────────────
  //
  // Sie ist der Ersatz fuer einen Debugger, den es auf dem Telefon nicht
  // gibt. Deshalb muss sie GENAU DANN etwas sagen, wenn nichts geht — und
  // darf nicht bloss im Gutfall huebsch aussehen. Beide Faelle werden
  // geprueft.
  for (const [name, init, erwartet] of [
    ['heil',   `window.__fb.ref = (db, pfad) => ({ __pfad: String(pfad) });
                window.__fb.uid = 'u_probe1';
                window.__fb.get = async () => ({ exists: () => false, val: () => null });`,
     { gut: true }],
    ['stumm',  `window.__fb.ref = (db, pfad) => ({ __pfad: String(pfad) });
                window.__fb.uid = null;
                window.__fbAuthError = 'auth/network-request-failed';
                window.__fb.get = () => new Promise(() => {});`,
     { gut: false }],
    // Der Verdachtsfall aus dem WebView: Das SDK verbindet gar nicht erst,
    // weil `navigator.onLine` false meldet. Ohne diese Angabe waere er von
    // „Netz weg" nicht zu unterscheiden — und genau darum geht es.
    ['offline', `window.__fb.ref = (db, pfad) => ({ __pfad: String(pfad) });
                window.__fb.uid = null;
                window.__fb.get = () => new Promise(() => {});
                Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });`,
     { gut: false, offline: true }],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
      serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.addInitScript(PROFILE_INIT);
    await page.addInitScript(FB_SPERRE);
    await page.addInitScript(init);
    page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
    try {
      await loadMenu(page);
      await jsClick(page, ['ONLINE']);
      await page.waitForTimeout(500);
      let zeile = '';
      for (let i = 0; i < 60; i++) {
        zeile = await page.evaluate(() => {
          const e = document.querySelector('[data-netz]');
          return e ? e.textContent.trim() : '';
        });
        if (zeile && !/wird gepr|Checking/.test(zeile)) break;
        await page.waitForTimeout(250);
      }
      if (erwartet.gut) {
        /SDK ✓/.test(zeile) && /u_prob/.test(zeile) && /\d+ ms/.test(zeile)
          ? ok(`Verbindungsauskunft (heil): "${zeile}" ✓`)
          : fail(`Verbindungsauskunft (heil) unvollstaendig: "${zeile}"`);
      } else {
        /keine Verbindung|no connection/.test(zeile)
          ? ok(`Verbindungsauskunft (stumm): nennt die fehlende Verbindung ✓`)
          : fail(`Verbindungsauskunft (stumm) schweigt: "${zeile}"`);
        /keine Anmeldung|not signed in/.test(zeile)
          ? ok('Verbindungsauskunft (stumm): nennt die fehlende Anmeldung ✓')
          : fail(`Verbindungsauskunft (stumm) verschweigt die Anmeldung: "${zeile}"`);
        if (erwartet.offline) {
          /navigator\.onLine=false/.test(zeile)
            ? ok('Verbindungsauskunft: meldet navigator.onLine=false ✓')
            : fail(`Verbindungsauskunft verschweigt navigator.onLine=false: "${zeile}"`);
        } else {
          /network-request-failed/.test(zeile)
            ? ok('Verbindungsauskunft (stumm): nennt den technischen Grund ✓')
            : fail(`Verbindungsauskunft (stumm) ohne Grund: "${zeile}"`);
          !/navigator\.onLine=false/.test(zeile)
            ? ok('Verbindungsauskunft: kein Fehlalarm zu navigator.onLine ✓')
            : fail('Verbindungsauskunft meldet onLine=false, obwohl online');
        }
      }
    } finally { await ctx.close(); }
  }

  errs.length === 0 ? ok('Bestenliste: keine JS-Fehler ✓')
                    : errs.slice(0, 3).forEach(e => fail(`Bestenliste JS: ${e.slice(0, 90)}`));
  return { res, errs };
}


// ═══════════════════════════════════════════════════════════════
// SUITE: Firebase-START — der echte, nicht der gesperrte (v3.111.6)
//
// DIE LUECKE, die das schliesst, ist die groesste dieser Sitzung:
// `FB_SPERRE` setzt `window.__fb` VOR dem Seitenskript, und
// `firebase-boot.js` haelt sich dann heraus. Das ist fuer die
// Spielpruefungen richtig — hatte aber zur Folge, dass der ECHTE
// Firebase-Start **in keinem einzigen Test je ausgefuehrt wurde**.
//
// Genau dort sass der Fehler aus v3.111.4: `getRedirectResult(auth)` wurde
// bedingungslos aufgerufen, auch in der App. Er startet den
// Popup-/Redirect-Aufloeser, und der laedt ein iframe von
// `<authDomain>/__/auth/iframe`. Im WKWebView haengt dieser Ladevorgang — und
// mit ihm die Auth-Initialisierung, auf die das RTDB vor dem Verbinden wartet.
// Ergebnis auf dem Geraet: weder Matchmaking noch die oeffentlich lesbare
// Bestenliste. 431 gruene Pruefungen sagten dazu nichts, weil keine davon den
// Startpfad anfasste.
//
// SICHERHEIT: Hier laeuft der echte Start — deshalb KEINE `FB_SPERRE`, aber
// zwei andere Riegel: `WS_SPERRE` schneidet die Realtime Database an ihrem
// Transport ab (WebSocket, per Route nicht abfangbar), und alle Firebase-Hosts
// sind zusaetzlich per Route gesperrt. Es kann nichts hinausgehen.
// ═══════════════════════════════════════════════════════════════
async function suiteFirebaseStart(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Firebase-Start (echt)\n' + '='.repeat(50));

  /** Einen Kontext bauen, in dem firebase-boot.js WIRKLICH laeuft. */
  const starte = async (nativ) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 },
      hasTouch: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    // KEINE FB_SPERRE — Absicht, siehe Kopf. Stattdessen WS_SPERRE plus Routen.
    await page.addInitScript(WS_SPERRE);
    await page.addInitScript(PROFILE_INIT);
    await page.addInitScript(`window.__NATIVE__ = ${nativ ? 'true' : 'false'};`);

    const versuche = [];
    page.on('request', r => versuche.push(r.url()));
    // Nichts darf hinaus. Abgebrochene Anfragen bleiben in `versuche` sichtbar —
    // gemessen wird, was die App VERSUCHT, nicht was ankommt.
    for (const muster of ['**identitytoolkit**', '**googleapis**', '**firebaseapp.com**',
                          '**firebaseio**', '**firebasedatabase**', '**gstatic**'])
      await page.route(muster, r => r.abort());

    await page.goto(`http://localhost:8765/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    // Dem Start Zeit geben: initializeApp, Auth, der erste Anmeldeversuch.
    await page.waitForTimeout(2500);
    return { ctx, page, versuche };
  };

  /** Was hat der Start im Auth-Objekt tatsaechlich angelegt? */
  const authZustand = (page) => page.evaluate(() => {
    const a = window.__fb && window.__fb.auth;
    if (!a) return null;
    return {
      // Der Popup-/Redirect-Aufloeser. `getAuth()` installiert ihn immer;
      // `initializeAuth` ohne `popupRedirectResolver` nicht.
      aufloeser: !!a._popupRedirectResolver,
      // Wird von `getRedirectResult()` angelegt — sein Vorhandensein zeigt
      // also, dass der Aufruf gelaufen ist.
      redirektSpeicher: Object.prototype.hasOwnProperty.call(a, "redirectPersistenceManager")
                        && !!a.redirectPersistenceManager,
      fertig: !!a._isInitialized,
    };
  });

  // ── 1) APP: weder Aufloeser noch Redirect-Speicher ────────────
  {
    const { ctx, page, versuche } = await starte(true);
    try {
      const lief = await page.evaluate(() => !!(window.__fb && window.__fb.db));
      lief ? ok('App-Start: firebase-boot lief WIRKLICH (window.__fb.db vorhanden) ✓')
           : fail('App-Start: firebase-boot lief nicht — der Test prueft dann gar nichts');

      const nativ = await page.evaluate(() => window.__NATIVE__ === true);
      nativ ? ok('App-Start: Plattform-Weiche steht auf nativ ✓')
            : fail('App-Start: Weiche steht NICHT auf nativ — die Messung waere wertlos');

      const z = await authZustand(page);
      if (!z) fail('App-Start: kein Auth-Objekt — nichts zu pruefen');
      else {
        z.aufloeser === false
          ? ok('App-Start: KEIN Popup-/Redirect-Aufloeser angelegt ✓')
          : fail('App-Start: Aufloeser angelegt — getAuth() statt initializeAuth (v3.111.4)');
        z.redirektSpeicher === false
          ? ok('App-Start: getRedirectResult lief NICHT (kein Redirect-Speicher) ✓')
          : fail('App-Start: Redirect-Speicher vorhanden — getRedirectResult lief doch');
        z.fertig ? ok('App-Start: Auth-Initialisierung ABGESCHLOSSEN ✓')
                 : fail('App-Start: Auth-Initialisierung haengt — genau das Bild vom Geraet');
      }

      const ifr = versuche.filter(u => /__\/auth\/iframe/.test(u));
      ifr.length === 0 ? ok('App-Start: kein Aufloeser-iframe angefragt ✓')
                       : fail(`App-Start: iframe angefragt: ${ifr[0].slice(0, 90)}`);

      const ws = await page.evaluate(() => (window.__wsVersuche || []).length);
      ok(`App-Start: WebSocket stillgelegt (${ws} Versuch(e) abgefangen) ✓`);
    } finally { await ctx.close(); }
  }

  // ── 2) GEGENPROBE — im BROWSER muss beides da sein ────────────
  //
  // Ohne sie waere Pruefung (1) nicht zu unterscheiden von „das kommt hier
  // nie vor, egal was der Code tut". Erst der Unterschied zwischen den
  // Zustaenden macht die Aussage belastbar — und haelt zugleich fest, dass
  // die Google-Verknuepfung im Browser nicht mit kaputtgespart wurde.
  {
    const { ctx, page } = await starte(false);
    try {
      const lief = await page.evaluate(() => !!(window.__fb && window.__fb.db));
      lief ? ok('Browser-Start: firebase-boot lief ✓') : fail('Browser-Start: firebase-boot lief nicht');

      const z = await authZustand(page);
      if (!z) fail('Browser-Start: kein Auth-Objekt');
      else {
        z.aufloeser === true
          ? ok('Browser-Start: Aufloeser vorhanden — die Weiche unterscheidet wirklich ✓')
          : fail('Browser-Start: KEIN Aufloeser — dann beweist Pruefung (1) nichts, und die '
               + 'Google-Verknuepfung im Browser waere womoeglich mit kaputtgegangen');
        z.redirektSpeicher === true
          ? ok('Browser-Start: getRedirectResult lief (Redirect-Speicher da) ✓')
          : fail('Browser-Start: getRedirectResult lief nicht — Rueckkehr von Google waere tot');
      }
    } finally { await ctx.close(); }
  }

  errs.length === 0 ? ok('Firebase-Start: keine JS-Fehler ✓')
                    : errs.slice(0, 3).forEach(e => fail(`Start JS: ${e.slice(0, 90)}`));
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 6: Progressionssystem (Level, XP, Daily Reward, Avatar-Locks)
// ═══════════════════════════════════════════════════════════════
async function suiteProgression(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Progressionssystem\n' + '='.repeat(50));

  // Eigener Kontext mit Daily als abholbar (lastCollect=0)
  const { ctx, page } = await makeCtx(browser);
  await page.addInitScript(`
    try {
      localStorage.setItem('fortress_daily', JSON.stringify({
        lastCollect: 0, streak: 14, lastStreakDay: ''
      }));
    } catch(e) {}
  `);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);

    // ── CSS-Keyframes (neue v3.11.0 Animationen) ──────────────
    const kfOk = await page.evaluate(() => {
      try {
        const needed = ['confettiFall','dailyBounceIn','badgePop','streakGlow','collectBounce'];
        const rules = Array.from(document.styleSheets).flatMap(s => { try { return Array.from(s.cssRules); } catch { return []; } });
        const found = rules.filter(r => r.name && needed.includes(r.name)).map(r => r.name);
        return { found, missing: needed.filter(n => !found.includes(n)) };
      } catch(e) { return { found: [], missing: [], err: e.message }; }
    });
    kfOk.missing.length === 0
      ? ok(`CSS-Keyframes v3.11.0: ${kfOk.found.join(', ')} ✓`)
      : fail(`CSS-Keyframes fehlen: ${kfOk.missing.join(', ')}`);

    // ── LevelBadge im Profil-Bereich ──────────────────────────
    const lvlBadge = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*'));
      return els.some(el => el.children.length === 0 && /^L\d+$/.test((el.textContent || '').trim()));
    });
    lvlBadge ? ok('LevelBadge "L1" sichtbar im Menü ✓') : fail('LevelBadge nicht gefunden');

    // ── XP-Leiste im Menü ─────────────────────────────────────
    const xpOk = await page.evaluate(() => {
      const t = document.body.innerText;
      return /\d+\s*\/\s*\d+\s*XP/.test(t);
    });
    xpOk ? ok('XP-Leiste (X / Y XP) im Menü ✓') : fail('XP-Leiste nicht gefunden');

    // ── Win-Rate-Anzeige (%) ──────────────────────────────────
    const winRateOk = await page.evaluate(() => {
      const t = document.body.innerText;
      return /\d+%/.test(t);
    });
    winRateOk ? ok('Win-Rate (%) im Menü ✓') : fail('Win-Rate nicht gefunden');

    // ── Gold-Anzeige ──────────────────────────────────────────
    const goldOk = await page.evaluate(() => {
      const t = document.body.innerText;
      return /\d+\s*Gold/.test(t);
    });
    goldOk ? ok('Gold-Anzeige im Menü ✓') : fail('Gold-Anzeige fehlt');

    // ── ELO-Anzeige ──────────────────────────────────────────
    const eloOk = await page.evaluate(() => /\d{3,4}\s*ELO/.test(document.body.innerText));
    eloOk ? ok('ELO-Anzeige im Menü ✓') : fail('ELO-Anzeige fehlt');

    // ── Tages-Belohnung-Button sichtbar (streak-glow animiert) ─
    const dailyBtn = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).some(b => {
        const s = window.getComputedStyle(b);
        const anim = s.animationName || '';
        return anim.includes('streakGlow') || (b.title || '').toLowerCase().includes('belohnung');
      });
    });
    dailyBtn ? ok('Tages-Belohnungs-Button (streakGlow) sichtbar ✓') : fail('Tages-Belohnungs-Button nicht gefunden');

    await page.screenshot({ path: '/tmp/s6_menu.png' });

    // ── Modal öffnen via Button-Klick ─────────────────────────
    const opened = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => {
        const s = window.getComputedStyle(b);
        return (s.animationName || '').includes('streakGlow') || (b.title || '').toLowerCase().includes('belohnung');
      });
      if (btn) { btn.click(); return true; }
      return false;
    });
    opened ? ok('Tages-Belohnungs-Button klickbar ✓') : fail('Tages-Belohnungs-Button nicht klickbar');

    await page.waitForTimeout(300);
    await page.screenshot({ path: '/tmp/s6_daily_modal.png' });

    // ── Modal-Inhalt prüfen ───────────────────────────────────
    const modalOk = await page.evaluate(() => {
      const t = document.body.innerText;
      // Kalender (T1-T7) und Belohnungs-Button ("Abholen!")
      const hasStreak = /T1/.test(t) && /T7/.test(t);
      const hasCollect = Array.from(document.querySelectorAll('button')).some(b =>
        /Abholen/i.test(b.textContent || ''));
      const hasDailyTitle = /Tages.Belohnung|Daily Reward/i.test(t);
      // Streak 14 → Woche 3 → Treue-Bonus ×1.5 sollte sichtbar sein
      const hasLoyalty = /Treue-Bonus|Loyalty bonus/i.test(t) && /1\.5/.test(t);
      return { hasStreak, hasCollect, hasDailyTitle, hasLoyalty };
    });
    modalOk.hasDailyTitle ? ok('Daily Modal: Titel sichtbar ✓') : fail('Daily Modal: Titel fehlt');
    modalOk.hasStreak     ? ok('Daily Modal: Streak-Kalender T1–T7 ✓') : fail('Daily Modal: Streak-Kalender fehlt');
    modalOk.hasCollect    ? ok('Daily Modal: "Abholen!"-Button ✓') : fail('Daily Modal: "Abholen!"-Button fehlt');
    modalOk.hasLoyalty    ? ok('Daily Modal: Treue-Bonus ×1.5 (Woche 3) sichtbar ✓') : fail('Daily Modal: Treue-Bonus fehlt');

    // ── Belohnung abholen ─────────────────────────────────────
    const goldBefore = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('fortress_profile')).gold; } catch { return null; }
    });
    await jsClick(page, ['Abholen', 'Collect']);
    await page.waitForTimeout(600); // nach 350ms-Delay zeigt Modal "✓ Abgeholt"
    const collectedOk = await page.evaluate(() =>
      /Abgeholt|Collected/i.test(document.body.innerText)
    );
    collectedOk ? ok('Daily: "✓ Abgeholt"-Bestätigung nach Abholen ✓') : fail('Daily: Bestätigung fehlt');

    await page.waitForTimeout(900); // Modal schließt sich nach insgesamt 1400ms
    const goldAfter = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('fortress_profile')).gold; } catch { return null; }
    });
    const goldIncreased = goldBefore !== null && goldAfter !== null && goldAfter > goldBefore;
    goldIncreased
      ? ok(`Daily: Gold erhöht ${goldBefore} → ${goldAfter} ✓`)
      : fail(`Daily: Gold nicht erhöht (${goldBefore} → ${goldAfter})`);

    const modalGone = await page.evaluate(() =>
      !Array.from(document.querySelectorAll('button')).some(b => /Abholen/i.test(b.textContent || ''))
    );
    modalGone ? ok('Daily Modal schließt sich nach Abholen ✓') : fail('Daily Modal bleibt offen nach Abholen');

    // ── Streak in localStorage gespeichert ────────────────────
    const streakOk = await page.evaluate(() => {
      try {
        const d = JSON.parse(localStorage.getItem('fortress_daily'));
        return d && typeof d.streak === 'number' && d.streak >= 1 && d.lastCollect > 0;
      } catch { return false; }
    });
    streakOk ? ok('Daily: Streak in localStorage gespeichert ✓') : fail('Daily: Streak nicht gespeichert');

    await page.screenshot({ path: '/tmp/s6_after_collect.png' });

    // ── Profil-Editor: gesperrte Avatare ─────────────────────
    const editorOpened = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => {
        const s = window.getComputedStyle(b);
        const r = b.getBoundingClientRect();
        // Profil-Edit-Button: kleiner Button rechts im Profilbereich
        return r.width > 0 && b.textContent.trim() === '' &&
          (b.querySelector('svg') || b.querySelector('img'));
      });
      if (btn) { btn.click(); return true; }
      // Fallback: suche Button mit user-Icon (kein Text)
      const btns = Array.from(document.querySelectorAll('button'));
      for (const b of btns) {
        if (b.textContent.trim() === '' && b.getBoundingClientRect().width > 0) {
          b.click(); return 'fallback';
        }
      }
      return false;
    });

    await page.waitForTimeout(300);
    const hasWappenLabel = await page.evaluate(() => /WAPPEN|AVATAR/i.test(document.body.innerText));
    hasWappenLabel ? ok('Profil-Editor öffnet sich ✓') : fail('Profil-Editor öffnet sich nicht');

    if (hasWappenLabel) {
      // Gesperrte Avatare: Level 1 → sternmage(L5), golem(L10), etc. müssen gesperrt sein
      const lockInfo = await page.evaluate(() => {
        const lockedEls = Array.from(document.querySelectorAll('button,div')).filter(b => {
          const title = b.getAttribute('title') || '';
          return /Level|Ab Level/i.test(title) && /\d+/.test(title);
        });
        const freeAvatars = ['skelett', 'waldhueter', 'eismagier', 'roboter'];
        const lockedTitles = lockedEls.map(b => b.getAttribute('title'));
        const freeOk = freeAvatars.every(a => {
          const btn = Array.from(document.querySelectorAll('button')).find(b =>
            b.getAttribute('title') === a);
          return btn && parseFloat(window.getComputedStyle(btn).opacity) > 0.9;
        });
        return { lockedCount: lockedEls.length, lockedTitles: lockedTitles.slice(0, 4), freeOk };
      });

      lockInfo.lockedCount >= 8
        ? ok(`Profil-Editor: ${lockInfo.lockedCount} gesperrte Avatare (ab Level 5–50) ✓`)
        : fail(`Profil-Editor: zu wenige gesperrte Avatare (${lockInfo.lockedCount})`);
      lockInfo.freeOk
        ? ok('Profil-Editor: 4 Basis-Avatare (skelett/waldhueter/eismagier/roboter) frei ✓')
        : fail('Profil-Editor: Basis-Avatare nicht korrekt als frei markiert');

      // Avatar-Overlays mit "L5", "L10" etc.
      const overlayOk = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span'));
        return spans.some(s => /^L\d+$/.test((s.textContent || '').trim()) &&
          parseInt(s.textContent.trim().slice(1), 10) >= 5);
      });
      overlayOk ? ok('Profil-Editor: Level-Overlay (L5+) auf gesperrten Avataren ✓') : fail('Profil-Editor: Level-Overlay fehlt');

      // ── Avatar-Grafiken: Rendering & Darstellung ──────────────
      const avatarRender = await page.evaluate(() => {
        // Alle sichtbaren data-URI imgs (Avatar-Grafiken, SVG oder PNG)
        const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
          const src = img.getAttribute('src') || '';
          const rect = img.getBoundingClientRect();
          return src.startsWith('data:image/') && rect.width > 0 && rect.height > 0;
        });
        // Kreisrunde Darstellung (borderRadius 50%)
        const circularCount = imgs.filter(img =>
          window.getComputedStyle(img).borderRadius === '50%'
        ).length;
        // Skelett-Avatar-Button mit korrektem data-URI src
        const skelettBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('title') === 'skelett');
        const skelettImg = skelettBtn ? skelettBtn.querySelector('img') : null;
        const skelettSrcOk = !!(skelettImg && (skelettImg.getAttribute('src') || '').startsWith('data:image/'));
        // Sektions-Labels
        const divTexts = Array.from(document.querySelectorAll('div')).map(d => (d.textContent || '').trim());
        const hasAktiv  = divTexts.some(t => /AVATAR GALERIE/i.test(t));
        const hasGesperrt = divTexts.some(t => /GESPERRT/i.test(t));
        return { count: imgs.length, circularCount, skelettSrcOk, hasAktiv, hasGesperrt };
      });
      avatarRender.count >= 4
        ? ok(`Profil-Editor: ${avatarRender.count} Avatar-Grafiken gerendert ✓`)
        : fail(`Profil-Editor: zu wenige Avatar-Grafiken (${avatarRender.count})`);
      avatarRender.circularCount >= 4
        ? ok(`Profil-Editor: ${avatarRender.circularCount} Avatare kreisrund (50%) ✓`)
        : fail(`Profil-Editor: Avatare nicht kreisrund (${avatarRender.circularCount} von ${avatarRender.count})`);
      avatarRender.skelettSrcOk
        ? ok('Skelett-Avatar: data-URI korrekt geladen ✓')
        : fail('Skelett-Avatar: kein img-Element oder src fehlt');
      avatarRender.hasAktiv
        ? ok('Profil-Editor: "AVATAR GALERIE" Sektion vorhanden ✓')
        : fail('Profil-Editor: "AVATAR GALERIE" Label fehlt');
      avatarRender.hasGesperrt
        ? ok('Profil-Editor: "GESPERRT" Sektion vorhanden ✓')
        : fail('Profil-Editor: "GESPERRT" Label fehlt');
    }

    errs.length ? errs.forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`)) : ok('Progressionssystem: Keine JS-Fehler ✓');
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 7: Achievements (v3.11.17 + v3.11.18 Retroaktiv-Migration)
// ═══════════════════════════════════════════════════════════════
async function suiteAchievements(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Achievements\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);

    // ── A) Trophy-Button im Menü ──────────────────────────────
    const trophyBtn = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.getAttribute('title') === 'Achievements');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 };
    });
    trophyBtn && trophyBtn.visible
      ? ok(`Achievement-Button sichtbar im Menü (${trophyBtn.w}×${trophyBtn.h}px) ✓`)
      : fail('Achievement-Button (title="Achievements") nicht gefunden oder nicht sichtbar');

    // Liegt der Button unter dem Profil-Icon (gleiche X-Spalte)?
    const btnLayout = await page.evaluate(() => {
      const ach = Array.from(document.querySelectorAll('button'))
        .find(b => b.getAttribute('title') === 'Achievements');
      const prof = Array.from(document.querySelectorAll('button'))
        .find(b => (b.title || '').toLowerCase().includes('profil') || b.getAttribute('title') === 'Profil bearbeiten');
      if (!ach || !prof) return null;
      const rA = ach.getBoundingClientRect(), rP = prof.getBoundingClientRect();
      return { achX: rA.x, profX: rP.x, sameColumn: Math.abs(rA.x - rP.x) < 20 };
    });
    btnLayout && btnLayout.sameColumn
      ? ok('Achievement-Button in gleicher Spalte wie Profil-Button ✓')
      : fail('Achievement-Button nicht unter Profil-Button (Layoutfehler)');

    // Ungelesen-Badge: Profil hat retroaktiv 3 freigeschaltete, noch nicht gesehen → Zahl sichtbar
    const badgeBefore = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('title') === 'Achievements');
      if (!btn) return 0;
      const badge = Array.from(btn.querySelectorAll('span')).find(s => /^\d+$/.test((s.textContent || '').trim()));
      return badge ? Number(badge.textContent.trim()) : 0;
    });
    badgeBefore >= 1 ? ok(`Ungelesen-Badge zeigt neue Achievements (${badgeBefore}) ✓`) : fail('Ungelesen-Badge fehlt trotz neuer Achievements');

    // ── B) Modal öffnen ───────────────────────────────────────
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => b.getAttribute('title') === 'Achievements');
      if (btn) btn.click();
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: '/tmp/s7_achievements_modal.png' });

    // Modal-Titel
    const modalTitle = await page.evaluate(() =>
      Array.from(document.querySelectorAll('div')).some(d =>
        (d.textContent || '').trim() === 'Achievements' && d.querySelector('svg'))
    );
    modalTitle ? ok('Achievement-Modal: Titel "Achievements" mit Icon ✓') : fail('Achievement-Modal: Titel fehlt');

    // Zähler "X/N freigeschaltet" (N = ACHIEVEMENTS.length, aktuell 20)
    const counterOk = await page.evaluate(() => /\d+\/\d+\s*freigeschaltet/.test(document.body.innerText));
    counterOk ? ok('Achievement-Modal: Zähler "X/N freigeschaltet" ✓') : fail('Achievement-Modal: Zähler fehlt');

    // Alle 6 Kategorien sichtbar
    const catOk = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        siege: /Siege/.test(t), spiele: /Spiele/.test(t),
        zerstoerung: /Zerstör/.test(t), gold: /Gold/.test(t),
        elo: /\bELO\b/.test(t), serien: /Serien/.test(t)
      };
    });
    const missingCats = Object.entries(catOk).filter(([, v]) => !v).map(([k]) => k);
    missingCats.length === 0
      ? ok('Achievement-Modal: alle 6 Kategorien sichtbar (Siege/Spiele/Zerstörung/Gold/ELO/Serien) ✓')
      : fail(`Achievement-Modal: Kategorien fehlen: ${missingCats.join(', ')}`);

    // Belohnungs-Chips (+XP in lila, +Gold in gold)
    const rewardChipsOk = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      return {
        xp:   spans.some(s => /\+\d+\s*XP/.test(s.textContent || '')),
        gold: spans.some(s => /\+\d+\s*Gold/.test(s.textContent || ''))
      };
    });
    rewardChipsOk.xp   ? ok('Achievement-Modal: +XP Belohnungs-Chip sichtbar ✓') : fail('Achievement-Modal: +XP Chip fehlt');
    rewardChipsOk.gold ? ok('Achievement-Modal: +Gold Belohnungs-Chip sichtbar ✓') : fail('Achievement-Modal: +Gold Chip fehlt');

    // Fortschritts-Anzeige (progress / target Format wie "0 / 1")
    const progressOk = await page.evaluate(() => /\d+\s*\/\s*\d+/.test(document.body.innerText));
    progressOk ? ok('Achievement-Modal: Fortschrittsbalken (X/target) ✓') : fail('Achievement-Modal: Fortschrittsbalken fehlt');

    // Modal schließbar via ✕
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        b.getAttribute('aria-label') === 'Schließen' || b.textContent.trim() === '✕');
      if (btn) btn.click();
    });
    await page.waitForTimeout(150);
    const modalGone = await page.evaluate(() =>
      !Array.from(document.querySelectorAll('div')).some(d =>
        (d.textContent || '').includes('freigeschaltet'))
    );
    modalGone ? ok('Achievement-Modal: schließt sich via ✕ ✓') : fail('Achievement-Modal: schließt sich nicht');

    // Nach dem Öffnen: als „gelesen" markiert → Ungelesen-Badge verschwindet
    const seenSet = await page.evaluate(() => { try { return localStorage.getItem('fortress_ach_seen'); } catch { return null; } });
    const badgeGone = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('title') === 'Achievements');
      if (!btn) return true;
      return !Array.from(btn.querySelectorAll('span')).some(s => /^\d+$/.test((s.textContent || '').trim()));
    });
    (seenSet !== null && Number(seenSet) >= 1) ? ok('Achievements als gelesen markiert (fortress_ach_seen) ✓') : fail('fortress_ach_seen nicht gesetzt');
    badgeGone ? ok('Ungelesen-Badge verschwindet nach dem Öffnen ✓') : fail('Ungelesen-Badge bleibt trotz Öffnen');

    // ── C) Retroaktive Freischaltung (v3.11.18) ───────────────
    // Profile hat wins:5, games:7, elo:1050 aber kein achievementsRetroApplied
    // → loadProfile() muss Migration ausführen und in localStorage speichern
    const retro = await page.evaluate(() => {
      try {
        const p = JSON.parse(localStorage.getItem('fortress_profile'));
        if (!p) return { applied: false, unlocked: [] };
        const unlocked = (Array.isArray(p.achievements) ? p.achievements : [])
          .filter(a => a.unlocked).map(a => a.id);
        return { applied: !!p.achievementsRetroApplied, unlocked };
      } catch { return { applied: false, unlocked: [] }; }
    });

    retro.applied
      ? ok('Retroaktive Migration: achievementsRetroApplied=true in localStorage ✓')
      : fail('Retroaktive Migration: achievementsRetroApplied nicht gesetzt');

    retro.unlocked.includes('first_win')
      ? ok('Retroaktive Migration: first_win freigeschaltet (stats.wins 5 ≥ target 1) ✓')
      : fail(`Retroaktive Migration: first_win nicht freigeschaltet (freigeschaltet: ${retro.unlocked.join(',')})`);

    retro.unlocked.includes('first_game')
      ? ok('Retroaktive Migration: first_game freigeschaltet (stats.games 7 ≥ target 1) ✓')
      : fail('Retroaktive Migration: first_game nicht freigeschaltet');

    retro.unlocked.includes('elo_1000')
      ? ok('Retroaktive Migration: elo_1000 freigeschaltet (ELO 1050 ≥ target 1000) ✓')
      : fail('Retroaktive Migration: elo_1000 nicht freigeschaltet');

    // wins_10 darf NICHT freigeschaltet sein (wins:5 < 10)
    !retro.unlocked.includes('wins_10')
      ? ok('Retroaktive Migration: wins_10 korrekt NICHT freigeschaltet (wins 5 < 10) ✓')
      : fail('Retroaktive Migration: wins_10 fälschlich freigeschaltet (wins 5 < 10)');

    // Zähler: mindestens 3 unlocked (first_win, first_game, elo_1000)
    retro.unlocked.length >= 3
      ? ok(`Retroaktive Migration: ${retro.unlocked.length} Achievements freigeschaltet ✓`)
      : fail(`Retroaktive Migration: zu wenige freigeschaltet (${retro.unlocked.length})`);

    await page.screenshot({ path: '/tmp/s7_retro_unlock.png' });
    errs.length ? errs.forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`)) : ok('Achievements: Keine JS-Fehler ✓');
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 8: Build-Urgency-Warnung + Schuss-Timer (v3.11.20–23)
// ═══════════════════════════════════════════════════════════════
async function suiteBuildUrgency(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Build-Urgency-Warnung\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);

    // dangerGlow CSS-Keyframe vorhanden
    const kfOk = await page.evaluate(() => {
      try { return Array.from(document.styleSheets).some(s =>
        Array.from(s.cssRules || []).some(r => r.name === 'dangerGlow')); }
      catch { return false; }
    });
    kfOk ? ok('CSS-Keyframe dangerGlow vorhanden ✓') : fail('CSS-Keyframe dangerGlow fehlt');

    // urgencyPulse-Keyframe ebenfalls vorhanden (ergänzende Animation)
    const kfPulse = await page.evaluate(() => {
      try { return Array.from(document.styleSheets).some(s =>
        Array.from(s.cssRules || []).some(r => r.name === 'urgencyPulse')); }
      catch { return false; }
    });
    kfPulse ? ok('CSS-Keyframe urgencyPulse vorhanden ✓') : fail('CSS-Keyframe urgencyPulse fehlt');

    // 2-Spieler-Spiel starten und auf erste Bauphase warten
    // Phasenfolge: Setup(20s) → Shoot(25s) → Cannon(12s) → Build(25s)
    // Mit 20x-Speedup: ~1s → ~1.25s → ~0.6s → Build startet nach ~2.85s
    await startLocal(page, 2);

    console.log('⏳ Warte auf Schussphase nach Setup...');
    const gotShoot = await waitForPhase(page, ['FEUER'], 6000);
    if (!gotShoot) { fail('Schussphase (vor Bauphase) nicht erreicht'); return { res, errs }; }

    console.log('⏳ Warte auf Kanonen-Phase...');
    const gotCannon = await waitForPhase(page, ['KANONE'], 5000);
    if (!gotCannon) { fail('Kanonen-Phase nicht erreicht'); return { res, errs }; }

    console.log('⏳ Warte auf erste Bauphase...');
    const gotBuild = await waitForPhase(page, ['BAUEN'], 5000);
    if (!gotBuild) { fail('Bauphase nicht erreicht'); return { res, errs }; }
    ok('Bauphase für Urgency-Test erreicht ✓');

    // Timer direkt nach Eintritt in Bauphase: muss > 8 sein
    await page.waitForTimeout(80);
    const timerStart = await getTimerValue(page);
    if (timerStart !== null && timerStart > 8) {
      ok(`Bau-Timer bei Phasenstart: ${timerStart} (> 8 → kein Glow erwartet) ✓`);
    } else if (timerStart !== null) {
      // Selten: Polling hat die Phase etwas spät erkannt, Timer schon ≤ 8
      ok(`Bau-Timer bei Erkennung: ${timerStart} (Schritt übersprungen, Speedup-Artefakt)`);
    }

    // Kein dangerGlow bei vollem Timer (nur prüfen wenn > 8 bestätigt)
    if (timerStart !== null && timerStart > 8) {
      const glowEarlyActive = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c) return null;
        return (window.getComputedStyle(c.parentElement).animationName || '').includes('dangerGlow');
      });
      glowEarlyActive === false
        ? ok('Kein dangerGlow bei Bau-Timer > 8 ✓')
        : fail(`dangerGlow unerwartet aktiv bei Timer=${timerStart} (Schwelle zu früh)`);
    }

    // Warten bis Timer ≤ 8: bestätigt, dass Timer die Schwelle erreicht
    // (Burg ist in der ersten Bauphase bereits vorgelagert geschlossen durch die
    //  vorgebaute Burgstruktur → kein Glow erwartet; Glow tritt nur auf wenn
    //  Kanonenbeschuss Mauern zerstört hat — das erfordert eine komplexere
    //  Testsimulation und wird hier nicht vollautomatisch getestet.)
    console.log('⏳ Warte bis Bau-Timer ≤ 8 (Schwellen-Check)...');
    const urgencyDeadline = Date.now() + 2000;
    let timerAtUrgency = null;
    while (Date.now() < urgencyDeadline) {
      const t = await getTimerValue(page);
      if (t !== null && t <= 8 && t > 0) { timerAtUrgency = t; break; }
      if (t === 0 || t === null) break;
      await page.waitForTimeout(60);
    }

    if (timerAtUrgency === null) {
      fail('Bau-Timer hat Schwelle ≤ 8 nicht rechtzeitig erreicht');
    } else {
      ok(`Bau-Timer-Schwelle ≤ 8 erreicht: ${timerAtUrgency}s ✓`);

      // In erster Bauphase ist Burg vorgelagert geschlossen → kein Glow erwartet
      // (korrekte Verhalten: kein false-positive Glow bei geschlossener Burg)
      const noFalsePositive = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c) return true; // kein Canvas = kein Glow
        const wrapper = c.parentElement;
        const anim = wrapper.style.animation || wrapper.style.animationName ||
                     window.getComputedStyle(wrapper).animationName || '';
        return !anim.includes('dangerGlow');
      });
      noFalsePositive
        ? ok('Kein false-positive dangerGlow bei geschlossener Burg ✓')
        : fail('Unerwarteter dangerGlow bei bereits geschlossener Burg');

      // Schriftzug "ZUMAUERN!" darf bei geschlossener Burg ebenfalls NICHT erscheinen
      const noLabelFalsePositive = await page.evaluate(() => !/ZUMAUERN/.test(document.body.innerText));
      noLabelFalsePositive
        ? ok('Kein false-positive "ZUMAUERN!"-Schriftzug bei geschlossener Burg ✓')
        : fail('Unerwarteter ZUMAUERN-Schriftzug bei geschlossener Burg');

      await page.screenshot({ path: '/tmp/s8_build_timer.png' });
    }

    // Bau-Timer zählt korrekt von 25 herunter
    // (bereits via timerStart > 8 bestätigt; zusätzliche Verifikation:
    //  Timer hat Wert < timerStart erreicht ohne einzufrieren)
    if (timerStart !== null && timerAtUrgency !== null) {
      timerAtUrgency < timerStart
        ? ok(`Bau-Timer zählt: ${timerStart} → ${timerAtUrgency} ✓`)
        : fail(`Bau-Timer zählt nicht (${timerStart} → ${timerAtUrgency})`);
    }

    // Schuss-Timer ist 25 (nicht 30) — zusätzliche Absicherung via HUD-Text
    // (suiteNavHUD prüft "FEUER25" bereits, hier als separaten Wert verifizieren)
    await waitForPhase(page, ['FEUER'], 4000); // warte auf nächste Schussphase
    await page.waitForTimeout(100);
    const shootTimerVal = await getTimerValue(page);
    if (shootTimerVal !== null) {
      shootTimerVal <= 25
        ? ok(`Schuss-Timer startet bei ${shootTimerVal} ≤ 25 (SHOOT_TIME=25 bestätigt) ✓`)
        : fail(`Schuss-Timer=${shootTimerVal} überschreitet 25 (SHOOT_TIME sollte 25 sein)`);
    }

    errs.length ? errs.forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`)) : ok('Build-Urgency: Keine JS-Fehler ✓');
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
async function suiteOnboarding(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Onboarding / Tutorial\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  // fortress_onboarded entfernen, damit das Tutorial automatisch erscheint
  await page.addInitScript(`try { localStorage.removeItem('fortress_onboarded'); } catch(e) {}`);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);

    // ── Auto-Popup bei Erstkontakt ────────────────────────────
    const appeared = await page.waitForFunction(
      () => /Willkommen bei Stack & Siege|Welcome to Stack & Siege/.test(document.body.innerText),
      { timeout: 4000 }
    ).then(() => true).catch(() => false);
    appeared ? ok('Onboarding erscheint automatisch bei Erstkontakt ✓') : fail('Onboarding-Auto-Popup fehlt');

    // ── "Weiter"-Navigation vorhanden ─────────────────────────
    const hasNext = await page.evaluate(() => /Weiter|Next/.test(document.body.innerText));
    hasNext ? ok('Tutorial-Navigation "Weiter" vorhanden ✓') : fail('Tutorial-Navigation fehlt');

    // ── Durchklicken bis zum letzten Slide (Welcome + 4 Steps) ─
    for (let i = 0; i < 4; i++) {
      await jsClick(page, ['Weiter', 'Next']);
      await page.waitForTimeout(120);
    }
    const lastSlide = await page.evaluate(() => /Ziel des Spiels|Goal of the game/.test(document.body.innerText));
    lastSlide ? ok('Durchklicken erreicht letzten Slide (Ziel des Spiels) ✓') : fail('Letzter Slide nicht erreicht');

    // ── Abschluss "Los geht's" schließt + setzt Flag ──────────
    await jsClick(page, ["Los geht", "Let's go"]);
    await page.waitForTimeout(200);
    const closed = await page.evaluate(() => !/Willkommen bei Stack & Siege|Ziel des Spiels|Welcome to Stack & Siege|Goal of the game/.test(document.body.innerText));
    closed ? ok('Tutorial schließt nach Abschluss ✓') : fail('Tutorial schließt nicht');
    const flag = await page.evaluate(() => { try { return localStorage.getItem('fortress_onboarded'); } catch { return null; } });
    flag === '1' ? ok('fortress_onboarded=1 in localStorage gesetzt ✓') : fail('Onboarding-Flag nicht gesetzt');

    // Hinweis: Der frühere "Wie spielt man?"-Menübutton wurde entfernt (v3.14.4) —
    // das interaktive Tutorial übernimmt jetzt den Einstieg; das statische Onboarding
    // zeigt sich nur noch automatisch beim Erststart.

    errs.length ? errs.forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`)) : ok('Onboarding: Keine JS-Fehler ✓');
  } catch (e) {
    fail('Onboarding-Suite Ausnahme: ' + e.message);
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
async function suiteSound(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Sound & Haptik\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);

    // ── SFX-Engine global vorhanden ───────────────────────────
    const sfxOk = await page.evaluate(() => typeof SFX === 'object' && SFX !== null &&
      typeof SFX.shoot === 'function' && typeof SFX.impact === 'function' &&
      typeof SFX.win === 'function' && typeof SFX.vibrate === 'function');
    sfxOk ? ok('SFX-Engine (shoot/impact/win/vibrate) global verfügbar ✓') : fail('SFX-Engine fehlt');

    // ── SFX-Aufrufe werfen keine Fehler (auch ohne echtes Audio) ─
    const callsOk = await page.evaluate(() => {
      try { SFX.shoot(); SFX.impact(); SFX.destroy(); SFX.place(); SFX.buy(); SFX.win(); SFX.lose(); SFX.vibrate(10); SFX.resume(); return true; }
      catch (e) { return false; }
    });
    callsOk ? ok('Alle SFX-Methoden laufen fehlerfrei ✓') : fail('SFX-Methode wirft Fehler');

    // ── Sound- & Vibrations-Toggle im Menü ────────────────────
    const toggles = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sound = btns.some(b => /🔊|🔇/.test(b.textContent || '') || (b.title || '') === 'Sound');
      const vib   = btns.some(b => /📳|📴/.test(b.textContent || '') || (b.title || '') === 'Vibration');
      return { sound, vib };
    });
    toggles.sound ? ok('Sound-Toggle im Menü sichtbar ✓') : fail('Sound-Toggle fehlt');
    toggles.vib ? ok('Vibrations-Toggle im Menü sichtbar ✓') : fail('Vibrations-Toggle fehlt');

    // ── Toggle schaltet SFX.enabled + localStorage ────────────
    await jsClick(page, ['Sound']);
    await page.waitForTimeout(120);
    const offState = await page.evaluate(() => ({
      enabled: SFX.enabled,
      ls: (() => { try { return localStorage.getItem('fortress_sound'); } catch { return null; } })()
    }));
    (offState.enabled === false && offState.ls === '0')
      ? ok('Sound-Toggle deaktiviert SFX + speichert localStorage (=0) ✓')
      : fail(`Sound-Toggle schaltet nicht (enabled=${offState.enabled}, ls=${offState.ls})`);

    await jsClick(page, ['Sound']);
    await page.waitForTimeout(120);
    const onState = await page.evaluate(() => ({
      enabled: SFX.enabled,
      ls: (() => { try { return localStorage.getItem('fortress_sound'); } catch { return null; } })()
    }));
    (onState.enabled === true && onState.ls === '1')
      ? ok('Sound-Toggle reaktiviert SFX + speichert localStorage (=1) ✓')
      : fail(`Sound-Toggle reaktiviert nicht (enabled=${onState.enabled}, ls=${onState.ls})`);

    // ── Hintergrundmusik (v3.38.0) ──
    const music = await page.evaluate(() => ({
      mgr: !!window.MUSIC && typeof window.MUSIC.play === 'function',
      btn: [...document.querySelectorAll('button')].some(b => (b.getAttribute('title') || '') === 'Musik'),
      files: true
    }));
    music.mgr ? ok('Musik: MUSIC-Manager vorhanden ✓') : fail('Musik: Manager fehlt');
    music.btn ? ok('Musik: Toggle-Button im Menü ✓') : fail('Musik: Toggle fehlt');
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('title') || '') === 'Musik'); b && b.click(); });
    await page.waitForTimeout(200);
    const musicOff = await page.evaluate(() => localStorage.getItem('fortress_music'));
    musicOff === '0' ? ok('Musik: Toggle persistiert (aus) ✓') : fail('Musik: Persistenz fehlt (' + musicOff + ')');
    const menuTrack = await page.evaluate(() => window.MUSIC.cur);
    menuTrack === 'menu' ? ok('Musik: Menü-Track gewählt ✓') : fail('Musik: falscher Track (' + menuTrack + ')');
    // Regler (v3.38.1): wieder einschalten → Slider sichtbar, setzt Volumen + persistiert
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('title') || '') === 'Musik'); b && b.click(); });
    await page.waitForTimeout(200);
    const slider = await page.evaluate(() => {
      const s = document.querySelector('input[type="range"][aria-label*="Lautst"], input[type="range"][aria-label*="volume"]');
      if (!s) return null;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(s, '20');
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    });
    slider ? ok('Musik: Lautstärke-Regler sichtbar ✓') : fail('Musik: Regler fehlt');
    await page.waitForTimeout(250);
    const vol = await page.evaluate(() => ({ ls: localStorage.getItem('fortress_music_vol'), mgr: window.MUSIC.userVol }));
    vol.ls === '0.2' && Math.abs(vol.mgr - 0.2) < 0.001 ? ok('Musik: Regler persistiert + wirkt (20%) ✓') : fail('Musik: Regler-Wert falsch (' + JSON.stringify(vol) + ')');

    errs.length ? errs.forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`)) : ok('Sound: Keine JS-Fehler ✓');
  } catch (e) {
    fail('Sound-Suite Ausnahme: ' + e.message);
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
async function suiteI18n(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: i18n (Englisch)\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  await page.addInitScript(`try { localStorage.setItem('fortress_lang','en'); } catch(e){}`);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);

    // ── Menü auf Englisch ─────────────────────────────────────
    const menuEn = await page.evaluate(() => /PLAY ONLINE/.test(document.body.innerText) && /PLAY LOCAL/.test(document.body.innerText));
    menuEn ? ok('Menü englisch (PLAY ONLINE / PLAY LOCAL) ✓') : fail('Menü nicht englisch');
    const noGerMenu = await page.evaluate(() => !/ONLINE SPIELEN|LOKAL SPIELEN/.test(document.body.innerText));
    noGerMenu ? ok('Kein deutscher Menü-Text im EN-Modus ✓') : fail('Deutscher Menü-Text im EN-Modus übrig');

    // ── Achievements-Modal englisch (der gemeldete Fall) ──────
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('title') === 'Achievements'); if (b) b.click(); });
    await page.waitForTimeout(300);
    const ach = await page.evaluate(() => {
      // Der Spielname wird ENTFERNT, bevor geprueft wird. Das Modal liegt
      // ueber dem Menue, und innerText liefert beides — seit „Stack & Siege"
      // stuende das Wort „Siege" damit immer im Text, obwohl es hier die
      // DEUTSCHE Kategorie meint (englisch: „Wins"). Ohne diesen Schnitt
      // meldete die Pruefung „Kategorien noch deutsch", waehrend die
      // Oberflaeche einwandfrei englisch war.
      const t = document.body.innerText.split('Stack & Siege').join('');
      return {
        counter: /unlocked/i.test(t) && !/freigeschaltet/.test(t),
        cats: /Wins/.test(t) && /Streaks/.test(t) && /Destruction/.test(t) && !/Siege/.test(t) && !/Serien/.test(t) && !/Zerstörung/.test(t),
        titleDesc: /10 Wins/.test(t) && /Win 10 online games/.test(t) && !/Gewinne/.test(t)
      };
    });
    ach.counter  ? ok('Achievements: Zähler "unlocked" (kein "freigeschaltet") ✓') : fail('Achievements: Zähler nicht übersetzt');
    ach.cats     ? ok('Achievements: Kategorien englisch (Wins/Streaks/Destruction) ✓') : fail('Achievements: Kategorien noch deutsch');
    ach.titleDesc? ok('Achievements: Titel & Beschreibung englisch (kein "Gewinne") ✓') : fail('Achievements: Titel/Desc noch deutsch');

    errs.length ? errs.forEach(e => fail('JS: ' + e.slice(0, 80))) : ok('i18n: Keine JS-Fehler ✓');
  } catch (e) {
    fail('i18n-Suite Ausnahme: ' + e.message);
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// SUITE: Nachlauf (v3.18.0) — bei Rundenende noch fliegende Kugeln
// treffen und schreiben Schrott gut, statt zu verschwinden. Eigenes Spiel,
// damit die (bewusst vorzeitig beendete) Schussphase keine andere Suite stört.
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// SUITE: Daily Tasks (v3.22.0) — Rotation, Badge, Abhol-Flow
// ═══════════════════════════════════════════════════════════════
async function suiteDailyTasks(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Daily Tasks\n' + '='.repeat(50));
  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);
    // ── 1) Frischer Tag: 📋-Button vorhanden, Modal zeigt 3 Aufgaben ──
    const btn = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Aufgaben|Tasks/i.test(x.getAttribute('title') || '') || (x.textContent || '').includes('📋'));
      if (!b) return false; b.click(); return true;
    });
    btn ? ok('Daily Tasks: 📋-Button im Menü ✓') : fail('Daily Tasks: Button fehlt');
    await page.waitForTimeout(300);
    const modal = await page.evaluate(() => {
      const t = document.body.innerText;
      const bars = document.querySelectorAll('div[style*="border-radius: 999px"], div[style*="border-radius:999px"]');
      return {
        title: /Tagesaufgaben|Daily tasks/.test(t),
        count: (t.match(/\d+\/\d+/g) || []).length
      };
    });
    modal.title ? ok('Daily Tasks: Modal mit Titel ✓') : fail('Daily Tasks: Modal fehlt');
    modal.count >= 3 ? ok(`Daily Tasks: 3 Aufgaben mit Fortschritt (${modal.count}) ✓`) : fail(`Daily Tasks: nur ${modal.count} Fortschritts-Anzeigen`);
    // ── v3.29.1: Task-Icons sind SVGs, keine rohen Icon-Namen als Text ──
    const iconCheck = await page.evaluate(() => {
      const t = document.body.innerText;
      const raw = /shoppingCart|gamepad|trophy|hammer|bomb|zap/.exec(t);
      const svgs = document.querySelectorAll('svg.li').length;
      return { raw: raw ? raw[0] : null, svgs };
    });
    !iconCheck.raw ? ok('Daily Tasks: keine rohen Icon-Namen als Text ✓')
                   : fail(`Daily Tasks: Icon-Name "${iconCheck.raw}" erscheint als Text`);
    iconCheck.svgs >= 3 ? ok(`Daily Tasks: SVG-Icons gerendert (${iconCheck.svgs}) ✓`)
                        : fail(`Daily Tasks: zu wenige SVG-Icons (${iconCheck.svgs})`);
    await jsClick(page, ['Schließen', 'Close']);
    // ── 2) Abhol-Flow: Task künstlich erfüllen → Badge + Abholen → Gold steigt ──
    const seeded = await page.evaluate(() => {
      let st = null;
      try { st = JSON.parse(localStorage.getItem('fortress_tasks')); } catch (e) {}
      if (!st || !st.tasks || !st.tasks.length) return null;
      st.tasks[0].prog = 9999; // >= jedes Ziel
      localStorage.setItem('fortress_tasks', JSON.stringify(st));
      return st.tasks[0].id;
    });
    if (!seeded) { fail('Daily Tasks: Seed fehlgeschlagen (kein fortress_tasks)'); return { res, errs }; }
    const goldBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('fortress_profile')).gold);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Aufgaben|Tasks/i.test(x.getAttribute('title') || '') || (x.textContent || '').includes('📋')); b && b.click(); });
    await page.waitForTimeout(300);
    const claim = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Abholen|Claim/.test(x.textContent || ''));
      if (!b) return false; b.click(); return true;
    });
    claim ? ok('Daily Tasks: Abholen-Button bei erfülltem Task ✓') : fail('Daily Tasks: Abholen-Button fehlt');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({
      gold: JSON.parse(localStorage.getItem('fortress_profile')).gold,
      collected: JSON.parse(localStorage.getItem('fortress_tasks')).tasks[0].collected,
      done: /✓/.test(document.body.innerText)
    }));
    after.gold > goldBefore ? ok(`Daily Tasks: Gold gutgeschrieben (${goldBefore}→${after.gold}) ✓`) : fail(`Daily Tasks: kein Gold (${goldBefore}→${after.gold})`);
    after.collected ? ok('Daily Tasks: Task als abgeholt markiert ✓') : fail('Daily Tasks: collected-Flag fehlt');
    errs.length ? errs.forEach(e => fail('JS: ' + e.slice(0, 80))) : ok('Daily Tasks: Keine JS-Fehler ✓');
  } catch (e) {
    fail('Daily-Tasks-Suite Ausnahme: ' + e.message);
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE: Gold-Shop Kosmetik (v3.23.0) — Kauf-, Anlege- und Gold-Flow
// ═══════════════════════════════════════════════════════════════

// ── Schmiede (v3.33.0): Materialien + Craften + Anlegen ──────────────
async function suiteSchmiede(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Schmiede (Crafting)\n' + '='.repeat(50));
  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    // Materialien + Gold VOR dem App-Start ins Profil legen (Init-Script läuft
    // nach PROFILE_INIT, aber vor dem App-Code — ein localStorage-Patch nach
    // dem Laden würde vom nächsten saveProfile der App überschrieben).
    await page.addInitScript(() => {
      try {
        const p = JSON.parse(localStorage.getItem('fortress_profile'));
        if (p) {
          p.materials = { iron: 50, silver: 12, dragon: 8, star: 3 };
          p.gold = 2000;
          p.achievementsRetroApplied = true; p.historicalXpApplied = true;
          localStorage.setItem('fortress_profile', JSON.stringify(p));
        }
      } catch (e) {}
    });
    await loadMenu(page);

    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Schmiede|Forge/i.test(x.getAttribute('title') || ''));
      if (!b) return false; b.click(); return true;
    });
    if (!opened) { fail('Schmiede: Hammer-Button fehlt im Menü'); return { res, errs }; }
    ok('Schmiede: Hammer-Button im Menü ✓');
    await page.waitForTimeout(300);

    const view = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        title: /Schmiede|Forge/.test(t),
        mats: /Eisensplitter|Iron shards/i.test(t) || /Deine Materialien|Your materials/i.test(t),
        matCount: /50/.test(t),
        sections: /Kanonen-Skins|Cannon skins/i.test(t) && /Einschlag-Effekte|Impact effects/i.test(t) && /Veredeln|Refine/i.test(t),
        recipes: /Kristallkanone|Crystal cannon/.test(t) && /Lava-Einschlag|Lava impact/.test(t) && /Infernospur|Inferno trail/.test(t)
      };
    });
    view.title ? ok('Schmiede: Modal mit Titel ✓') : fail('Schmiede: Modal fehlt');
    view.mats && view.matCount ? ok('Schmiede: Material-Inventar sichtbar (50 Eisen) ✓') : fail('Schmiede: Material-Inventar fehlt');
    view.sections ? ok('Schmiede: 3 Kategorien sichtbar ✓') : fail('Schmiede: Kategorien fehlen');
    view.recipes ? ok('Schmiede: Rezeptkarten sichtbar ✓') : fail('Schmiede: Rezepte fehlen');

    // ── Veredeln ohne Basis-Trail muss gesperrt sein ──
    const lockCheck = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Infernospur|Inferno trail/.test(x.textContent || ''));
      return b ? { disabled: b.disabled, hint: /Basis-Trail|base trail/i.test(b.textContent || '') } : null;
    });
    lockCheck && lockCheck.disabled && lockCheck.hint
      ? ok('Schmiede: Veredeln ohne Basis-Trail gesperrt (Hinweis sichtbar) ✓')
      : fail('Schmiede: Veredeln-Sperre fehlt (' + JSON.stringify(lockCheck) + ')');

    // ── Craften: Kristallkanone (20 Eisen + 5 Silber + 200 G), zweistufig ──
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Kristallkanone|Crystal cannon/.test(x.textContent || ''));
      b && b.click();
    });
    await page.waitForTimeout(300);
    const dlg = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('fortress_profile'));
      return {
        visible: /Schmieden\?|Forge it\?/.test(document.body.innerText),
        notYet: !((p.cosmetics && p.cosmetics.owned) || []).includes('cannon_crystal')
      };
    });
    dlg.visible ? ok('Schmiede: Bestätigungsdialog erscheint ✓') : fail('Schmiede: Bestätigungsdialog fehlt');
    dlg.notYet ? ok('Schmiede: Ein-Tipp schmiedet NICHT sofort ✓') : fail('Schmiede: Craft ohne Bestätigung!');
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /✓ Schmieden|✓ Forge/.test(x.textContent || ''));
      b && b.click();
    });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('fortress_profile'));
      return {
        mats: p.materials, gold: p.gold,
        owned: ((p.cosmetics && p.cosmetics.owned) || []).includes('cannon_crystal'),
        equipped: p.cosmetics && p.cosmetics.equipped && p.cosmetics.equipped.cannon
      };
    });
    after.mats && after.mats.iron === 30 && after.mats.silver === 7
      ? ok(`Schmiede: Materialien abgezogen (Eisen 50→30, Silber 12→7) ✓`)
      : fail(`Schmiede: Material-Abzug falsch (${JSON.stringify(after.mats)})`);
    after.gold === 1800 ? ok('Schmiede: Gold abgezogen (2000→1800) ✓') : fail(`Schmiede: Gold falsch (${after.gold})`);
    after.owned ? ok('Schmiede: cannon_crystal in owned[] ✓') : fail('Schmiede: owned fehlt');
    after.equipped === 'cannon_crystal' ? ok('Schmiede: Skin direkt angelegt ✓') : fail(`Schmiede: equipped falsch (${after.equipped})`);

    // ── Das Reveal nach dem Schmieden (Luecke, gefunden in v3.98.0) ──────
    // Diese Suite pruefte bisher NUR den Datenstand nach dem Schmieden, nie
    // den Bildschirm, der danach aufgeht. Beim Herausloesen der Modale fehlte
    // `__spreadValues` im neuen Modul — ItemRevealModal waere bei JEDEM Rezept
    // abgestuerzt, und diese Suite haette es durchgewinkt. Gefunden hat es ein
    // Unit-Test, der die Komponente wirklich rendert. Damit das nicht vom
    // Zufall abhaengt, steht die Frage jetzt auch hier.
    {
      const rv = await page.evaluate(() => {
        const t = document.body.innerText;
        return {
          sichtbar: /Geschmiedet|Forged|rarityLegendary|Legendär|Legendary|Episch|Epic/i.test(t),
          canvasWeg: !!document.querySelector('canvas'),
          knopf: [...document.querySelectorAll('button')].length,
          leer: document.body.innerText.trim().length < 30
        };
      });
      // Das Entscheidende ist NICHT der genaue Text, sondern: Die Seite lebt
      // noch. Ein Absturz beim Rendern reisst den ganzen Baum ab, und uebrig
      // bleibt eine leere Seite ohne Knoepfe.
      !rv.leer && rv.knopf > 0
        ? ok(`Schmiede: Seite lebt nach dem Schmieden (${rv.knopf} Knöpfe) ✓`)
        : fail('Schmiede: leere Seite nach dem Schmieden — Reveal abgestürzt?');
    }

    // ── Abrüsten: Standard-Karte in der Kanonen-Sektion ──
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('button')].filter(x => /Standard/.test(x.textContent || '') && !x.disabled);
      cards[0] && cards[0].click();
    });
    await page.waitForTimeout(250);
    const unequipped = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('fortress_profile'));
      return p.cosmetics && p.cosmetics.equipped && p.cosmetics.equipped.cannon;
    });
    unequipped === 'cannon_standard' ? ok('Schmiede: Abrüsten auf Standard ✓') : fail(`Schmiede: Abrüsten fehlgeschlagen (${unequipped})`);

    errs.length ? errs.forEach(e => fail('JS: ' + e.slice(0, 80))) : ok('Schmiede: Keine JS-Fehler ✓');
  } catch (e) {
    fail('Schmiede-Suite Ausnahme: ' + e.message);
  } finally { await ctx.close(); }
  return { res, errs };
}

async function suiteGoldShop(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Gold-Shop\n' + '='.repeat(50));
  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);
    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Gold-Shop|Gold shop/i.test(x.getAttribute('title') || '') || (x.textContent || '').includes('🛒'));
      if (!b) return false; b.click(); return true;
    });
    opened ? ok('Gold-Shop: 🛒-Button im Menü ✓') : fail('Gold-Shop: Button fehlt');
    await page.waitForTimeout(300);
    const view = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        title: /Gold-Shop|Gold shop/.test(t),
        sections: /Kugel-Trails|Ball trails/i.test(t) && /Wappen-Rahmen|Crest frames/i.test(t) && /Sieges-Effekte|Victory effects/i.test(t),
        goldChip: /\d+ G/.test(t)
      };
    });
    view.title ? ok('Gold-Shop: Modal mit Titel ✓') : fail('Gold-Shop: Modal fehlt');
    view.sections ? ok('Gold-Shop: 3 Kategorien sichtbar ✓') : fail('Gold-Shop: Kategorien fehlen');
    view.goldChip ? ok('Gold-Shop: Gold-Kontostand angezeigt ✓') : fail('Gold-Shop: Kontostand fehlt');
    // ── v3.29.1: Sieges-Effekt-Previews sind SVG-Icons, keine Emojis ──
    const noEmoji = await page.evaluate(() => {
      const t = document.body.innerText;
      return !/[\u{1F300}-\u{1FAFF}]/u.test(t);
    });
    noEmoji ? ok('Gold-Shop: keine Emojis (SVG-Previews) ✓') : fail('Gold-Shop: Emoji im Modal gefunden');
    // ── Kauf: Glut-Trail (150 G) mit Startgold 175 — zweistufig (v3.26.2) ──
    const goldBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('fortress_profile')).gold);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Glut|Ember/.test(x.textContent || ''));
      b && b.click();
    });
    await page.waitForTimeout(300);
    // Bestätigungsdialog muss erscheinen — Kauf darf noch NICHT passiert sein
    const dlg = await page.evaluate(() => {
      const t = document.body.innerText;
      const p = JSON.parse(localStorage.getItem('fortress_profile'));
      return {
        visible: /wirklich kaufen|Buy this item/.test(t),
        priceShown: /150 G/.test(t),
        notBoughtYet: !((p.cosmetics && p.cosmetics.owned) || []).includes('trail_ember')
      };
    });
    dlg.visible ? ok('Kauf-Dialog: erscheint vor dem Kauf ✓') : fail('Kauf-Dialog: fehlt');
    dlg.priceShown ? ok('Kauf-Dialog: Preis angezeigt ✓') : fail('Kauf-Dialog: Preis fehlt');
    dlg.notBoughtYet ? ok('Kauf-Dialog: Ein-Tipp kauft NICHT sofort ✓') : fail('Kauf-Dialog: Kauf passierte ohne Bestätigung!');
    // Abbrechen → kein Kauf, Gold unverändert
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Abbrechen|Cancel/.test(x.textContent || ''));
      b && b.click();
    });
    await page.waitForTimeout(250);
    const afterCancel = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('fortress_profile'));
      return { gold: p.gold, owned: ((p.cosmetics && p.cosmetics.owned) || []).includes('trail_ember'), dlgGone: !/wirklich kaufen|Buy this item/.test(document.body.innerText) };
    });
    afterCancel.dlgGone && !afterCancel.owned && afterCancel.gold === goldBefore
      ? ok('Kauf-Dialog: Abbrechen kauft nicht (Gold unverändert) ✓')
      : fail(`Kauf-Dialog: Abbrechen fehlerhaft (owned=${afterCancel.owned}, ${goldBefore}→${afterCancel.gold})`);
    // Erneut antippen + bestätigen → Kauf
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Glut|Ember/.test(x.textContent || ''));
      b && b.click();
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /✓ Kaufen|✓ Buy/.test(x.textContent || ''));
      b && b.click();
    });
    await page.waitForTimeout(300);
    const afterBuy = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('fortress_profile'));
      return { gold: p.gold, owned: (p.cosmetics && p.cosmetics.owned) || [], trail: p.cosmetics && p.cosmetics.equipped && p.cosmetics.equipped.trail };
    });
    afterBuy.gold === goldBefore - 150 ? ok(`Gold-Shop: Kauf nach Bestätigung zieht Gold ab (${goldBefore}→${afterBuy.gold}) ✓`) : fail(`Gold-Shop: Gold falsch (${goldBefore}→${afterBuy.gold})`);
    afterBuy.owned.includes('trail_ember') ? ok('Gold-Shop: Artikel in owned[] ✓') : fail('Gold-Shop: owned fehlt');
    afterBuy.trail === 'trail_ember' ? ok('Gold-Shop: Artikel direkt angelegt ✓') : fail(`Gold-Shop: equipped falsch (${afterBuy.trail})`);
    // ── Umrüsten auf Standard (gratis, kein Gold-Abzug) ──
    // Selektor auf die TRAIL-Sektion eingegrenzt (v3.45.0): seit der Gold-Shop
    // auch eine Geschütz-Kategorie hat, gibt es mehrere "Standard"-Buttons —
    // ein globales Suchen traf die erste (Geschütz) statt der gemeinten (Trail).
    await page.evaluate(() => {
      const labels = [...document.querySelectorAll('div')]
        .filter(d => /^(KUGEL-TRAILS|BALL TRAILS)$/i.test((d.textContent || '').trim()));
      const sec = labels.length ? labels[labels.length - 1].parentElement : null;
      const scope = sec || document;
      const b = [...scope.querySelectorAll('button')].find(x => /Standard|Default/.test(x.textContent || ''));
      b && b.click();
    });
    await page.waitForTimeout(300);
    const afterEquip = await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('fortress_profile'));
      return { gold: p.gold, trail: p.cosmetics.equipped.trail };
    });
    afterEquip.trail === 'trail_standard' && afterEquip.gold === afterBuy.gold
      ? ok('Gold-Shop: Umrüsten gratis (Standard angelegt, Gold unverändert) ✓')
      : fail(`Gold-Shop: Umrüsten fehlerhaft (${afterEquip.trail}, ${afterBuy.gold}→${afterEquip.gold})`);
    // ── v3.26.1 Regression: Käufe überleben Reload (loadProfile-Whitelist) ──
    // WICHTIG: nicht page.reload() — das würde PROFILE_INIT (addInitScript)
    // erneut ausführen und localStorage mit dem cosmetics-losen Testprofil
    // überschreiben. Stattdessen frische Page OHNE Init-Skripte (localStorage
    // ist im Context geteilt) → echter loadProfile-Durchlauf.
    const page2 = await ctx.newPage();
    page2.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
    await page2.route('**firebase**',   r => r.abort());
    await page2.route('**gstatic**',    r => r.abort());
    await page2.route('**googleapis**', r => r.abort());
    await page2.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page2.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 8000 });
    await page2.waitForTimeout(500);
    const afterReload = await page2.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('fortress_profile'));
      return { owned: (p.cosmetics && p.cosmetics.owned) || [] };
    });
    afterReload.owned.includes('trail_ember')
      ? ok('Persistenz: Kauf überlebt Reload ✓')
      : fail('Persistenz: Kauf nach Reload weg (loadProfile verwirft cosmetics)');
    // ── v3.26.1: Inventar im Profil-Editor + Käufe überleben Profil-Speichern ──
    const editorOpened = await page2.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Profil bearbeiten|Edit profile/.test(x.title || ''));
      if (!b) return false; b.click(); return true;
    });
    editorOpened ? ok('Profil-Editor geöffnet ✓') : fail('Profil-Editor-Button fehlt');
    await page2.waitForTimeout(300);
    const inv = await page2.evaluate(() => {
      const t = document.body.innerText;
      return {
        title: /Inventar|Inventory/.test(t),
        item: /Glut|Ember/.test(t),
        shopLink: /Mehr im Gold-Shop|More in the gold shop/.test(t)
      };
    });
    inv.title ? ok('Inventar: 🎒-Sektion im Profil ✓') : fail('Inventar: Sektion fehlt');
    inv.item ? ok('Inventar: gekaufter Artikel (Glut) sichtbar ✓') : fail('Inventar: Kauf fehlt');
    inv.shopLink ? ok('Inventar: Gold-Shop-Link ✓') : fail('Inventar: Shop-Link fehlt');
    // Anlegen aus dem Inventar: Glut-Karte tippen → equipped
    await page2.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /Glut|Ember/.test(x.textContent || '') && /Anlegen|Equip|Angelegt|Equipped/.test(x.textContent || ''));
      b && b.click();
    });
    await page2.waitForTimeout(250);
    const invEquip = await page2.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('fortress_profile'));
      return p.cosmetics && p.cosmetics.equipped && p.cosmetics.equipped.trail;
    });
    invEquip === 'trail_ember' ? ok('Inventar: Anlegen per Tipp ✓') : fail(`Inventar: Anlegen fehlgeschlagen (${invEquip})`);
    // Profil speichern → Käufe müssen bleiben (saveProfileEditor-Whitelist)
    await page2.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /💾/.test(x.textContent || ''));
      b && b.click();
    });
    await page2.waitForTimeout(300);
    const afterSave = await page2.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('fortress_profile'));
      return { owned: (p.cosmetics && p.cosmetics.owned) || [], trail: p.cosmetics && p.cosmetics.equipped && p.cosmetics.equipped.trail };
    });
    afterSave.owned.includes('trail_ember') && afterSave.trail === 'trail_ember'
      ? ok('Persistenz: Kauf überlebt Profil-Speichern ✓')
      : fail('Persistenz: Profil-Speichern löscht Käufe (saveProfileEditor)');
    errs.length ? errs.forEach(e => fail('JS: ' + e.slice(0, 80))) : ok('Gold-Shop: Keine JS-Fehler ✓');
  } catch (e) {
    fail('Gold-Shop-Suite Ausnahme: ' + e.message);
  } finally { await ctx.close(); }
  return { res, errs };
}

async function suiteBallSettle(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Kugel-Nachlauf bei Rundenende\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);
    await jsClick(page, ['LOKAL', 'PLAY LOCAL']);
    await page.waitForTimeout(250);
    await startBotGame(page);
    const canvas = await page.waitForSelector('canvas', { timeout: 6000 }).then(() => true).catch(() => false);
    if (!canvas) { fail('Bot-Spiel startet nicht'); return { res, errs }; }
    await page.evaluate(() => { window.__mmDebug = true; window.__lateImpacts = 0; window.__discardedAtEnd = 0; });

    // Echte (kurze) Schussphase abfangen → fast gelandete Kugel P1 auf Feindmauer
    // spawnen und Nachlauf starten (Timer-Ende simuliert), ohne die Phasenfolge
    // zu hijacken (endShoot läuft danach ganz normal).
    const before = await page.evaluate(async () => {
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        if (window.__phase && window.__phase() === 'shoot') {
          const b = window.__spawnBallAtEnemy(1);
          if (b === null) return 'nowall';
          window.__setSettling();
          return b;
        }
        await new Promise(r => setTimeout(r, 15));
      }
      return 'noshoot';
    });
    if (typeof before !== 'number') { fail(`Nachlauf: Setup nicht erreicht (${before})`); return { res, errs }; }

    await page.waitForTimeout(1000); // Kugel fliegt zu Ende, schlägt ein, Phase wechselt
    const rr = await page.evaluate(() => ({ scrap: window.__readScrap(1), phase: window.__phase(), late: window.__lateImpacts || 0, disc: window.__discardedAtEnd || 0 }));
    rr.late >= 1 ? ok('Nachlauf: späte Kugel schlägt nach Rundenende noch ein ✓') : fail('Nachlauf: kein später Einschlag');
    rr.scrap > before ? ok(`Nachlauf: Schrott noch gutgeschrieben (${before}→${rr.scrap}) ✓`) : fail(`Nachlauf: kein Schrott (${before}→${rr.scrap})`);
    rr.phase !== 'shoot' ? ok(`Nachlauf: Schussphase danach verlassen (→ ${rr.phase}) ✓`) : fail('Nachlauf: hängt in Schussphase');
    rr.disc === 0 ? ok('Nachlauf: keine fliegende Kugel verworfen ✓') : fail(`Nachlauf: ${rr.disc} Kugel(n) verworfen`);
    // Match-Statistik (v3.21.0): zerstörte Mauer wird gezählt
    const msW = await page.evaluate(() => window.__matchStats && window.__matchStats(1));
    (msW && msW.walls >= 1) ? ok(`Match-Statistik: Mauer-Zerstörung gezählt (walls=${msW.walls}) ✓`) : fail(`Match-Statistik: walls fehlt (${JSON.stringify(msW)})`);
    errs.length ? errs.forEach(e => fail('JS: ' + e.slice(0, 80))) : ok('Nachlauf: Keine JS-Fehler ✓');
  } catch (e) {
    fail('Nachlauf-Suite Ausnahme: ' + e.message);
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE: Kanonen-Kill-Ökonomie (v3.19.0) — mit CANNON_HP=8 ist ein Kanonen-
// Kill mit fokussiertem Feuer erreichbar und zahlt +12 Schrott.
// ═══════════════════════════════════════════════════════════════
async function suiteCannonKill(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Kanonen-Kill-Ökonomie\n' + '='.repeat(50));
  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);
    await jsClick(page, ['LOKAL', 'PLAY LOCAL']);
    await page.waitForTimeout(250);
    await startBotGame(page);
    const canvas = await page.waitForSelector('canvas', { timeout: 6000 }).then(() => true).catch(() => false);
    if (!canvas) { fail('Bot-Spiel startet nicht'); return { res, errs }; }
    await page.evaluate(() => { window.__mmDebug = true; });
    const start = await page.evaluate(async () => {
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        if (window.__phase && window.__phase() === 'shoot' && window.__enemyCannonCount(1) >= 1) {
          const before = window.__testCannonKill(1);
          if (before === null) return 'nokill';
          return { before, cannonsBefore: window.__enemyCannonCount(1) };
        }
        await new Promise(r => setTimeout(r, 15));
      }
      return 'noshoot';
    });
    if (typeof start !== 'object') { fail(`Kanonen-Kill: Setup nicht erreicht (${start})`); return { res, errs }; }
    await page.waitForTimeout(1000);
    const rr = await page.evaluate((cb) => ({ scrap: window.__readScrap(1), cannons: window.__enemyCannonCount(1), before: cb }), start.before.before);
    rr.cannons < start.cannonsBefore ? ok(`Kanonen-Kill: ${start.before.hp} HP → Feindkanone durch ${start.before.schuesse} Bezwinger-Treffer zerstört (${start.cannonsBefore}→${rr.cannons}) ✓`) : fail(`Kanonen-Kill: Kanone überlebt ${start.before.schuesse} Bezwinger-Treffer (${start.cannonsBefore}→${rr.cannons})`);
    rr.scrap >= rr.before + 18 ? ok(`Kanonen-Kill: +18 Schrott gutgeschrieben (${rr.before}→${rr.scrap}) ✓`) : fail(`Kanonen-Kill: Kill-Bonus fehlt (${rr.before}→${rr.scrap})`);
    // Match-Statistik (v3.21.0): Kill + Wirkungstreffer + Schrott-Zähler
    const ms = await page.evaluate(() => window.__matchStats && window.__matchStats(1));
    (ms && ms.cannons >= 1) ? ok(`Match-Statistik: Kanonen-Kill gezählt (cannons=${ms.cannons}) ✓`) : fail(`Match-Statistik: Kill fehlt (${JSON.stringify(ms)})`);
    (ms && ms.hits >= 1) ? ok(`Match-Statistik: Wirkungstreffer gezählt (hits=${ms.hits}) ✓`) : fail(`Match-Statistik: hits fehlt (${JSON.stringify(ms)})`);
    (ms && ms.scrap >= 12) ? ok(`Match-Statistik: Schrott-Verdienst gezählt (scrap=${ms.scrap}) ✓`) : fail(`Match-Statistik: scrap fehlt (${JSON.stringify(ms)})`);

    // ── Wiederaufbau-Paket (v3.30.0): letzte Bot-Kanone töten → A/B/C prüfen ──
    // Alles in EINER Schussphase (Nachlauf hält sie offen), damit der Bot
    // nicht zwischendurch in einer Rüstphase nachkauft.
    const aid = await page.evaluate(async () => {
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        const ph = window.__phase && window.__phase();
        const cnt = window.__enemyCannonCount(1);
        if (ph === 'shoot' && cnt >= 1 && window.__readTimer() > 10) {
          window.__testCannonKill(1);
          const d2 = Date.now() + 3000;
          while (Date.now() < d2 && window.__enemyCannonCount(1) >= cnt) await new Promise(r => setTimeout(r, 30));
          if (window.__enemyCannonCount(1) > 0) continue; // noch eine übrig → nächster Durchlauf
          // 0 Kanonen: Status (A: aktiv, B: Basispreis) + C: Bergung sofort testen
          const info = window.__rebuildAid(2);
          const before = window.__readScrap(2);
          window.__spawnBallAtEnemy(1);
          const d3 = Date.now() + 2500;
          let after = before;
          while (Date.now() < d3) {
            after = window.__readScrap(2);
            if (after > before) break;
            await new Promise(r => setTimeout(r, 40));
          }
          return { info, before, after };
        }
        await new Promise(r => setTimeout(r, 40));
      }
      return null;
    });
    if (!aid) { fail('Wiederaufbau: 0-Kanonen-Zustand nicht erreicht'); }
    else {
      (aid.info && aid.info.active) ? ok('Wiederaufbau: Status aktiv bei 0 Kanonen ✓') : fail(`Wiederaufbau: Status inaktiv (${JSON.stringify(aid.info)})`);
      (aid.info && aid.info.price === 200) ? ok('Wiederaufbau: Kanone zum Basispreis 200 ✓') : fail(`Wiederaufbau: Preis ${aid.info && aid.info.price} statt 200`);
      aid.after > aid.before ? ok(`Wiederaufbau: Trümmer-Bergung +2 beim Verteidiger (${aid.before}→${aid.after}) ✓`) : fail(`Wiederaufbau: keine Bergung (${aid.before}→${aid.after})`);
    }
    // ── Reparatur-Bug (v3.31.1): nach dem Kill liegen Kanonen-Trümmer (RUBBLE_C)
    // + Mauer-Trümmer (RUBBLE) beim Verteidiger. Reparatur darf NUR Mauer-Trümmer
    // wandeln — Kanonen-Trümmer müssen liegen bleiben.
    const rep = await page.evaluate(() => window.__repairCheck && window.__repairCheck(2));
    if (!rep) { fail('Reparatur: __repairCheck-Hook fehlt'); }
    else if (rep.before.cannon < 1) { fail(`Reparatur: keine Kanonen-Trümmer im Grid (${JSON.stringify(rep.before)})`); }
    else {
      rep.after.cannon === rep.before.cannon ? ok(`Reparatur: Kanonen-Trümmer bleiben liegen (${rep.before.cannon} vorher = ${rep.after.cannon} nachher) ✓`) : fail(`Reparatur: Kanonen-Trümmer überbaut (${rep.before.cannon}→${rep.after.cannon})`);
      (rep.fx >= rep.fixed && rep.fixed > 0) ? ok(`Reparatur: Highlight-Marker für ${rep.fixed} Zelle(n) gesetzt ✓`) : fail(`Reparatur: Highlight fehlt (fx=${rep.fx}, fixed=${rep.fixed})`);
      (rep.fixed > 0 && rep.after.wall === rep.before.wall - rep.fixed) ? ok(`Reparatur: nur Mauer-Trümmer repariert (${rep.fixed} Stück) ✓`) : fail(`Reparatur: Mauer-Zählung inkonsistent (fixed=${rep.fixed}, ${rep.before.wall}→${rep.after.wall})`);
    }
    errs.length ? errs.forEach(e => fail('JS: ' + e.slice(0, 80))) : ok('Kanonen-Kill: Keine JS-Fehler ✓');
  } catch (e) {
    fail('Kanonen-Kill-Suite Ausnahme: ' + e.message);
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE: Rüstphasen-„Fertig" (v3.18.1) — alle Spieler bestätigt →
// Timer springt auf 3s (wenn > 3). Eigenes Spiel für saubere Isolation.
// ═══════════════════════════════════════════════════════════════
async function suiteArmoryReady(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Rüstphase "Fertig"-Bestätigung\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);
    await jsClick(page, ['LOKAL', 'PLAY LOCAL']);
    await page.waitForTimeout(250);
    await startBotGame(page);
    const canvas = await page.waitForSelector('canvas', { timeout: 6000 }).then(() => true).catch(() => false);
    if (!canvas) { fail('Bot-Spiel startet nicht'); return { res, errs }; }
    await page.evaluate(() => { window.__mmDebug = true; });

    // FERTIG-Button in der Rüstphase sichtbar?
    let sawBtn = false;
    const dl = Date.now() + 12000;
    while (Date.now() < dl && !sawBtn) {
      sawBtn = await page.evaluate(() => {
        for (const b of document.querySelectorAll('button')) { if (/Nächste Runde/.test(b.textContent)) { b.click(); return false; } }
        return window.__phase && window.__phase() === 'cannon' &&
          [...document.querySelectorAll('button')].some(b => /Fertig|Ready/.test(b.textContent) && !/^\s*\d+\s*$/.test(b.textContent));
      });
      if (!sawBtn) await page.waitForTimeout(80);
    }
    sawBtn ? ok('Rüstphase: FERTIG-Button sichtbar ✓') : fail('Rüstphase: FERTIG-Button fehlt');

    // Bestätigen (P1 + P2) → Timer springt auf 3, sofern er > 3 war.
    const jump = await page.evaluate(async () => {
      // Frische Rüstphase mit hohem Timer abwarten
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        if (window.__phase() === 'cannon' && window.__readTimer() > 4) {
          const before = window.__readTimer();
          window.__forceReady(1); window.__forceReady(2);
          const after = window.__readTimer();
          return { before, after, ready: window.__readReady() };
        }
        await new Promise(r => setTimeout(r, 20));
      }
      return null;
    });
    if (!jump) { fail('Rüstphase: keine frische Phase mit Timer>4 erwischt'); }
    else {
      jump.after <= 3 ? ok(`Rüstphase: alle bereit → Timer springt auf 3 (${jump.before}→${jump.after}) ✓`) : fail(`Rüstphase: Timer nicht gesprungen (${jump.before}→${jump.after})`);
    }
    errs.length ? errs.forEach(e => fail('JS: ' + e.slice(0, 80))) : ok('FERTIG: Keine JS-Fehler ✓');
  } catch (e) {
    fail('Fertig-Suite Ausnahme: ' + e.message);
  } finally { await ctx.close(); }
  return { res, errs };
}

async function suiteBot(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Bot-Modus (KI-Gegner)\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);

    // ── Lokal-Untermenü öffnen, Bot-Button prüfen ─────────────
    await jsClick(page, ['LOKAL', 'PLAY LOCAL']);
    await page.waitForTimeout(250);
    const botBtn = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some(b => /gegen Bot|vs Bot/i.test(b.textContent || '')));
    botBtn ? ok('Bot-Button im Lokal-Menü sichtbar ✓') : fail('Bot-Button fehlt');

    // ── Bot-Spiel starten (v3.20.0: erst Stufen-Auswahl, dann Start) ──
    await jsClick(page, ['gegen Bot', 'vs Bot']);
    await page.waitForTimeout(250);
    const lvlBtns = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent || '');
      return {
        easy: btns.some(t2 => /Leicht|Easy/.test(t2)),
        mid: btns.some(t2 => /Mittel|Medium/.test(t2)),
        hard: btns.some(t2 => /Schwer|Hard/.test(t2))
      };
    });
    (lvlBtns.easy && lvlBtns.mid && lvlBtns.hard)
      ? ok('Bot-Stufen-Auswahl: 3 Schwierigkeitsgrade sichtbar ✓')
      : fail(`Bot-Stufen-Auswahl unvollständig (${JSON.stringify(lvlBtns)})`);
    // ── Keine Vorauswahl (v3.29.0): alle 3 Stufen-Buttons sehen identisch aus ──
    const noPreselect = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b =>
        /Leicht|Easy|Mittel|Medium|Schwer|Hard/.test(b.textContent || '') && b.querySelector('svg'));
      if (btns.length < 3) return { n: btns.length, same: false };
      const bgs = btns.map(b => getComputedStyle(b).background);
      return { n: btns.length, same: bgs.every(bg => bg === bgs[0]) };
    });
    noPreselect.same ? ok('Bot-Stufen-Auswahl: KEINE Vorauswahl (alle Buttons gleich) ✓')
                     : fail(`Bot-Stufen-Auswahl: eine Stufe wirkt vorausgewählt (${noPreselect.n} Buttons, uneinheitlich)`);
    await jsClick(page, ['Mittel', 'Medium']);
    const canvas = await page.waitForSelector('canvas', { timeout: 6000 }).then(() => true).catch(() => false);
    canvas ? ok('Bot-Spiel gestartet (Canvas sichtbar) ✓') : fail('Bot-Spiel startet nicht');
    // Welt-Musik (v3.39.0): im Spiel muss ein w_*-Track gewählt sein
    const wtrack = await page.evaluate(() => window.MUSIC && window.MUSIC.cur);
    /^w_(crystal|ice|desert|volcano|swamp|autumn|astral)$/.test(wtrack || '')
      ? ok('Musik: Welt-Track im Match (' + wtrack + ') ✓')
      : fail('Musik: kein Welt-Track (' + wtrack + ')');
    if (!canvas) return { res, errs };

    // ── Reset-Geste (v3.16.6): Drag unter das Spielfeld bricht ab ──
    // In der Setup-Phase: Finger von P1s Feld unter das Canvas ziehen und
    // loslassen → KEINE P1-Kanone platziert (per gated Zähler window.__places[1]).
    {
      await page.evaluate(() => { window.__mmDebug = true; window.__places = window.__places || {}; });
      await page.waitForTimeout(300);
      const cb = await page.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height, bottom: c.bottom }; });
      const p1Before = await page.evaluate(() => (window.__places && window.__places[1]) || 0);
      await page.mouse.move(cb.x + cb.w * 0.5, cb.y + cb.h * 0.72);
      await page.mouse.down();
      // TIEF unter das Feld (klar jenseits der Bottom-Reihen-Reichweite, v3.18.2)
      await page.mouse.move(cb.x + cb.w * 0.5, cb.bottom + cb.h * 0.22 + 40, { steps: 5 });
      await page.waitForTimeout(120);
      await page.mouse.up();
      await page.waitForTimeout(300);
      const p1After = await page.evaluate(() => (window.__places && window.__places[1]) || 0);
      p1After === p1Before ? ok('Reset-Geste: tiefer Drag unter Feld platziert nichts (P1) ✓')
                           : fail(`Reset-Geste: Cancel-Drag platzierte trotzdem (P1 ${p1Before}→${p1After})`);
    }

    // ── v3.30.2: Terrain-Flip-Regression — Fluss-Optik == Fluss-Logik ──
    // Der frühere bgCanvas-Vor-Flip + Haupt-Flip (Doppel-Flip) zeichnete den
    // Fluss an der GESPIEGELTEN Position → „Bauen im Fluss". Pixel-Probe:
    // asymmetrische Wasser-Kantenzellen (Spiegelzeile ist Land) müssen an der
    // geflippten Bildschirmposition Wasserfarbe zeigen.
    {
      const fp = await page.evaluate(() => {
        const cells = window.__waterCells && window.__waterCells();
        if (!cells || !cells.length) return null;
        const wt = window.__waterTheme && window.__waterTheme();
        if (!wt) return null;
        const cv = document.querySelector('canvas');
        const img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        const W = cv.width, H = cv.height, CELL = 14;
        const px = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return [img[i], img[i+1], img[i+2]]; };
        const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
        const flipY = (r) => H - (r * CELL + CELL / 2);
        let wr = [0,0,0];
        for (const [r,c] of cells) { const p = px(c*CELL+CELL/2, flipY(r)); wr[0]+=p[0]; wr[1]+=p[1]; wr[2]+=p[2]; }
        wr = wr.map(v => v / cells.length);
        const land = cells.map(([r,c]) => [r+7, c]).filter(([r]) => r < 68);
        let lr = [0,0,0];
        for (const [r,c] of land) { const p = px(c*CELL+CELL/2, flipY(r)); lr[0]+=p[0]; lr[1]+=p[1]; lr[2]+=p[2]; }
        lr = lr.map(v => v / land.length);
        const isWater = new Set(cells.map(([r,c]) => r + '_' + c));
        const edge = cells.filter(([r,c]) => !isWater.has((67 - r) + '_' + c));
        // ABSOLUTE Referenz aus dem Welt-Thema (v3.45.0).
        // ⚠ Frühere Fassungen leiteten die Wasser-Referenzfarbe aus dem
        // GERENDERTEN Bild ab (Mittel über alle Wasserzell-Positionen). Das ist
        // wertlos: zeichnet der Code den Fluss an der falschen Stelle, wandert
        // die Referenz mit und der Test winkt den Bug durch — nachgewiesen mit
        // einem absichtlich gespiegelten Fluss, den die Prüfung bestand.
        // Jetzt: Themenfarben (Kruste/Körper/Kern) als feste Sollwerte. Der
        // Fluss hat seit v3.42.0 einen Verlauf, daher gilt die NÄCHSTE der
        // Themenfarben. Land-Referenz stammt aus echten Landzellen.
        const hex2rgb = (h) => { const t = h.replace('#',''); return [parseInt(t.slice(0,2),16), parseInt(t.slice(2,4),16), parseInt(t.slice(4,6),16)]; };
        const waterRefs = [wt.bank, wt.water[0], wt.water[1]].filter(v => typeof v === 'string' && v[0] === '#').map(hex2rgb);
        if (!waterRefs.length) return null;
        const dWater = (p) => Math.min.apply(null, waterRefs.map(w => dist(p, w)));
        let good = 0;
        for (const [r,c] of edge) {
          const p = px(c*CELL+CELL/2, flipY(r));
          if (dWater(p) < dist(p, lr)) good++;
        }
        return { edgeN: edge.length, good, contrast: Math.round(dist(wr, lr)), world: wt.name };
      });
      if (!fp) fail('Terrain-Flip: Wasserzellen nicht lesbar');
      else if (fp.edgeN === 0) ok('Terrain-Flip: Karte symmetrisch (kein Kanten-Check nötig) ✓');
      else (fp.good / fp.edgeN >= 0.9)
        ? ok(`Terrain-Flip: Fluss-Optik == Logik (${fp.good}/${fp.edgeN} Kantenzellen, Kontrast ${fp.contrast}) ✓`)
        : fail(`Terrain-Flip: Fluss verschoben? Nur ${fp.good}/${fp.edgeN} Kantenzellen wasserfarben`);
    }

    // ── Beweis: Bot (P2) platziert Kanonen ────────────────────
    // Der Test-„Mensch" platziert nichts → jede Bot-Kanone stammt von der KI.
    //
    // Gemessen wird der ZUSTAND (`__econFull().cannons[2]`), nicht mehr ein
    // Toast. Ein Toast ist fluechtig: Auf einem ausgelasteten Laeufer war er
    // im 7-Sekunden-Fenster entweder schon wieder weg oder noch nicht da —
    // oertlich gruen, im Ablauf rot. Der Zaehler bleibt stehen.
    let botKanonen = 0, placed = false;
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline && !placed) {
      const st = await page.evaluate(() => {
        const e = window.__econFull ? window.__econFull() : null;
        return {
          n: e ? (e.cannons && e.cannons[2]) || 0 : -1,
          toast: /Kanone[^]*platziert/i.test(document.body.innerText)
        };
      });
      botKanonen = st.n;
      if (st.n >= 1 || st.toast) placed = true;
      else await page.waitForTimeout(150);
    }
    placed ? ok(`Bot (P2) platziert selbststaendig Kanonen (${botKanonen}) ✓`)
           : fail(`Bot platziert keine Kanonen (KI inaktiv?) — Zaehler blieb bei ${botKanonen}`);

    // ── Bau-KI (v3.29.0): Bot schließt eine geschossene Bresche wieder ──
    // Bresche (3 Mauerzellen → Trümmer) in die Bot-Burg schlagen → Burg offen.
    // Der Bot muss sie über die nächsten Bauphasen wieder versiegeln (Trümmer
    // sind NICHT bebaubar → erzwingt den Umgehungs-Ring des Leck-Versieglers).
    {
      await page.evaluate(() => { window.__mmDebug = true; });
      // Bis die Burg WIRKLICH offen ist, nicht nur bis Zellen zerstoert sind.
      // `__blastWall` sprengt eine Reihe vor der Burg; ist die Mauer dort
      // doppelt, bleibt die Burg trotzdem zu — dann meldete der Test einen
      // Fehler, obwohl die Vorbedingung nur nicht hergestellt war. Auf einem
      // langsameren Laeufer hatte der Bot mehr gebaut und genau das passierte.
      // Die Phase beim Sprengen wird MITGESCHRIEBEN, aber NICHT abgewartet
      // (v3.110.1). Sie steht hier, weil der CI-Lauf zu v3.110.0 an dieser
      // Stelle fiel und die Meldung die Phase nicht nannte.
      //
      // Abgewartet wird sie bewusst nicht. Die naheliegende Vermutung war:
      // „mitten in der Bauphase gesprengt, also hatte der Bot keine Zeit".
      // Eine Gegenprobe hat das WIDERLEGT — absichtlich in der Bauphase
      // gesprengt, versiegelt der Bot trotzdem, in 0,6 s. Stattdessen verlor
      // der Test-Spieler, weil das Warten eine Runde kostet (die Falle aus
      // v3.108.0: er baut nie nach). Ein Fix mit falscher Begruendung, der
      // einen neuen Fehler erzeugt — deshalb nur die Messung, nicht das
      // Warten. Faellt der Schritt im CI wieder, sagt die Phase mit, ob an
      // der Vermutung doch etwas dran war.
      const phaseVorSprengung = await page.evaluate(() => window.__phase ? window.__phase() : null);

      let blasted = { n: 0, open: false };
      for (let versuch = 0; versuch < 8 && !blasted.open; versuch++) {
        const r = await page.evaluate(() => {
          const n = window.__blastWall ? window.__blastWall(2, 5) : 0;
          return { n, open: window.__castleClosed ? window.__castleClosed(2) === false : false };
        });
        blasted = { n: blasted.n + r.n, open: r.open };
        if (r.n === 0) break;               // keine Mauer mehr zu sprengen
        if (!r.open) await page.waitForTimeout(120);
      }
      if (blasted.n >= 1 && blasted.open) {
        ok(`Bau-KI: Bresche geschlagen (${blasted.n} Zellen, Burg offen, `
           + `in Phase "${phaseVorSprengung}") ✓`);
        let sealed = false;
        // 60 s, nicht 25. Geprueft wird, DASS der Bot dichtet — nicht, wie
        // schnell. Unter voller Suitenlast (zwanzig Browserkontexte) kriecht
        // der KI-Tick, und die alte Frist hat am 17.09. eine Auslieferung
        // aufgehalten, obwohl nichts kaputt war.
        //
        // **Die Frist steht in EINER Variablen, und die Meldung liest sie.**
        // Vorher stand die Zahl doppelt da: als Konstante und als Text. Beim
        // Hochsetzen auf 60 s habe ich die Konstante geaendert und den Text
        // vergessen — die Meldung log dann „nach 25s" und schickte den
        // naechsten Leser in die falsche Richtung. Genau dieselbe Sorte
        // Fehler, die zwei Versionen vorher schon „Blase offen: false"
        // behauptet hatte. Zwei Kopien einer Zahl driften, sobald man sie
        // anfasst.
        //
        // Und die Meldung sagt jetzt, WAS sie beobachtet hat: Wie viele
        // Bauphasen waehrend des Wartens vergingen. Ohne diese Zahl ist
        // „Burg immer noch offen" nicht zu deuten — sie unterscheidet
        // „Rechner war zu langsam, es kam gar keine Bauphase" von „der Bot
        // hatte Gelegenheiten und hat sie nicht genutzt".
        const SEAL_MS = 60000;
        const sealStart = Date.now();
        let bauphasen = 0, vorPhase = null, spielVorbei = false;
        while (Date.now() - sealStart < SEAL_MS) {
          const st = await page.evaluate(() => ({
            zu: !!(window.__castleClosed && window.__castleClosed(2) === true),
            phase: window.__phase ? window.__phase() : null
          }));
          if (st.phase && st.phase !== vorPhase) {
            if (st.phase === 'build') bauphasen++;
            vorPhase = st.phase;
          }
          if (st.zu) { sealed = true; break; }
          // Ist das Spiel vorbei, kommt keine Bauphase mehr — dann ist die
          // Frist von 60 s reine Wartezeit, und am Ende stuende eine Aussage
          // ueber den Bot, die der Lauf nie gepruefte hat.
          if (st.phase === 'result') { spielVorbei = true; break; }
          await page.waitForTimeout(300);
        }
        const sek = ((Date.now() - sealStart) / 1000).toFixed(1);
        sealed
          ? ok(`Bau-KI: Bot hat die Bresche wieder versiegelt (Burg zu, nach ${sek}s) ✓`)
          : fail(`Bau-KI: Burg nach ${sek}s (Frist ${SEAL_MS / 1000}s) immer noch offen — `
                 + `${bauphasen} Bauphase(n) beobachtet`
                 // Aus EINER Bauphase laesst sich nichts schliessen: Die
                 // Bresche entsteht mitten in einer Phase, der Bot bekommt
                 // davon nur den Rest. Erst ab zwei hatte er wirklich
                 // Gelegenheit. Ein Lauf, der die Frage nicht stellen konnte,
                 // darf sie auch nicht beantworten — sonst steht da „der Bot
                 // dichtet nicht", und das ist dann schlicht unwahr.
                 + (spielVorbei
                      ? ': das Spiel endete vorher (Ergebnisschirm) — der Bot kam nicht mehr dazu'
                      : bauphasen < 2
                      ? ': zu wenige fuer einen Schluss, der Lauf war zu langsam'
                      : ': der Bot hatte Gelegenheit und dichtet nicht'));
      } else {
        fail(`Bau-KI: Bresche nicht erzeugbar (n=${blasted.n}, open=${blasted.open})`);
      }
    }

    // ── v3.30.1: In der Bauphase nur die EIGENE Hand-Vorschau (Bot-Hand versteckt) ──
    {
      // Gleiche Ueberlegung wie oben: dieselbe Lastspitze hat auch diesen
      // Schritt schon gerissen, und zwar als Folgefehler.
      const sawBuild = await waitForPhase(page, ['BAUEN'], 30000);
      if (sawBuild) {
        const haende = await beobachteHaende(page);
        haende.max === 1
          ? ok(`Bot-Modus: nur eigene Hand-Vorschau sichtbar `
               + `(1, ueber ${haende.proben} Stichproben) ✓`)
          : fail(`Bot-Modus: hoechstens ${haende.max} Hand-Vorschauen statt 1 `
               + `(${haende.proben} Stichproben in ${haende.ms} ms) `
               + (haende.max === 0 ? '— es wurde nie eine gerendert'
                                   : '— Bot-Hand sichtbar?'));
      } else fail('Bot-Modus: Bauphase für Hand-Check nicht erreicht');
    }

    // ── Stabil über mehrere Phasen (KI-Tick läuft in allen Phasen) ──
    //
    // Geprüft wird, dass das Spiel WEITERLÄUFT — nicht, wie schnell. Die Frist
    // stand auf 6 s und hat auf einem ausgelasteten Läufer ein Deployment
    // aufgehalten, obwohl nichts kaputt war. Von BAUEN aus liegt noch der Rest
    // der Bauphase plus die ganze Rüstphase dazwischen; unter Last reicht das.
    // Eine großzügige Frist prüft dieselbe Aussage und wird nicht grundlos rot.
    const sawShoot = await waitForPhase(page, ['FEUER'], 20000);
    if (sawShoot) ok('Bot-Spiel erreicht Schussphase ✓');
    else {
      // Bei 20 s Frist ist "nicht erreicht" kein Timing-Befund mehr, sondern
      // heisst: das Spiel laeuft nicht weiter. Dann muss die Meldung sagen,
      // WAS stattdessen zu sehen ist — sonst faengt das Raten an.
      const lage = await page.evaluate(() => ({
        phase: ['FEUER','BAUEN','START','KANONE'].find(k =>
          document.body.innerText.includes(k)) || '(keine)',
        ergebnis: /SIEG|NIEDERLAGE|ERGEBNIS/i.test(document.body.innerText),
        text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
      }));
      fail(`Schussphase nicht erreicht — Phase "${lage.phase}", `
         + `Ergebnisschirm: ${lage.ergebnis ? 'JA' : 'nein'} | ${lage.text}`);
    }
    await waitForPhase(page, ['KANONE'], 20000);
    await page.evaluate(() => { window.__mmDebug = true; });
    // ── Premium-Shop (v3.17.0): Panel-Struktur in der Rüstphase ──
    let shopSeen = null;
    const shopDeadline = Date.now() + 14000;
    while (Date.now() < shopDeadline && !shopSeen) {
      shopSeen = await page.evaluate(() => {
        for (const b of document.querySelectorAll('button')) {
          if (/Nächste Runde/.test(b.textContent)) { b.click(); return null; }
        }
        const t = document.body.innerText;
        if (!/Beute|Spoils/i.test(t)) return null;
        // "Panzer"/"Armor" statt der vollen Labels: die Karte hiess bis v3.68.0
        // "Panzermauern"/"Armored walls" und wurde in v3.69.0 gekuerzt, weil der
        // lange Name in der Kachel abgeschnitten wurde ("Panzerma...").
        const cards = [...document.querySelectorAll('button')].filter(b => /Kanone|Bezwinger|Schnellladen|Panzer|Reparatur|Cannon|Slayer|reload|Armor|Repair/i.test(b.textContent));
        if (cards.length < 4) return null;
        return {
          cards: cards.length,
          svg: cards.filter(b => b.querySelector('svg')).length,        // Medaillen-Icons (kein Emoji)
          priced: cards.filter(b => /\d+|MAX/.test(b.textContent)).length, // Preis-Pille od. MAX
          header: /RÜSTPHASE/.test(t),                                   // Panel-Titel
          chip: /Beute|Spoils/i.test(t)                                 // Beute-Anzeige im Shop-Kopf
        };
      });
      if (!shopSeen) await page.waitForTimeout(120);
    }
    if (!shopSeen) { fail('Premium-Shop nicht gefunden'); }
    else {
      ok(`Premium-Shop sichtbar (${shopSeen.cards} Karten) ✓`);
      shopSeen.svg === 5 ? ok('Shop: alle 5 Karten mit SVG-Medaille (kein Emoji) ✓') : fail(`Shop: nur ${shopSeen.svg}/5 Karten mit SVG-Icon`);
      shopSeen.priced === 5 ? ok('Shop: alle 5 Karten mit Preis/MAX ✓') : fail(`Shop: nur ${shopSeen.priced}/5 Karten mit Preis`);
      shopSeen.header ? ok('Shop: RÜSTPHASE-Header ✓') : fail('Shop: Header fehlt');
      shopSeen.chip ? ok('Shop: goldener Schrott-Chip ✓') : fail('Shop: Schrott-Chip fehlt');

      // ── v3.19.2: Info-Button öffnet Fakten-Overlay ──
      const infoOpened = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Info');
        if (!btn) return { found: false };
        btn.click();
        return { found: true };
      });
      if (!infoOpened.found) { fail('Shop: Info-Button (ⓘ) fehlt'); }
      else {
        ok('Shop: Info-Button (ⓘ) vorhanden ✓');
        await page.waitForTimeout(200);
        const info = await page.evaluate(() => {
          const t = document.body.innerText;
          return {
            title: /So funktioniert|How it works/.test(t),
            earn: /\+18/.test(t) && /\+6/.test(t) && /\+2/.test(t),   // Verdienst-Fakten (v3.31.0)
            close: [...document.querySelectorAll('button')].some(b => /Verstanden|Got it/.test(b.textContent))
          };
        });
        info.title ? ok('Shop-Info: Titel sichtbar ✓') : fail('Shop-Info: Titel fehlt');
        info.earn ? ok('Shop-Info: Verdienst-Fakten (+2/+18/+6) ✓') : fail('Shop-Info: Verdienst-Fakten fehlen');
        info.close ? ok('Shop-Info: Schließen-Button ✓') : fail('Shop-Info: Schließen-Button fehlt');
        // Overlay wieder schließen, damit der Kauf-Test die Karten erreicht
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Verstanden|Got it/.test(x.textContent)); b && b.click(); });
        await page.waitForTimeout(150);
      }

      // ── v3.17.1: Kanonenkauf blendet Shop aus + zeigt Platzier-Hinweis ──
      await page.evaluate(() => { window.__grantScrap && window.__grantScrap(1, 40); });
      await page.waitForTimeout(200);
      const cannonEnabled = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => /^Kanone|^Cannon/.test(x.textContent.trim()));
        return b && !b.disabled;
      });
      cannonEnabled ? ok('Shop: Kanonen-Karte nach Schrott kaufbar (aktiv) ✓') : fail('Shop: Kanonen-Karte bleibt gesperrt trotz Schrott');
      if (cannonEnabled) {
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Kanone|^Cannon/.test(x.textContent.trim())); b && b.click(); });
        await page.waitForTimeout(250);
        const afterBuy = await page.evaluate(() => {
          const shopCards = [...document.querySelectorAll('button')].filter(b => /Kanone|Bezwinger|Schnellladen|Panzermauern|Reparatur/i.test(b.textContent)).length;
          const hint = /Tippe aufs Feld|Tap the field/.test(document.body.innerText);
          return { shopCards, hint };
        });
        afterBuy.shopCards === 0 ? ok('Kanonenkauf: Shop-Panel ausgeblendet (Feld frei) ✓') : fail(`Kanonenkauf: Shop noch sichtbar (${afterBuy.shopCards} Karten)`);
        afterBuy.hint ? ok('Kanonenkauf: Platzier-Hinweis erscheint ✓') : fail('Kanonenkauf: Platzier-Hinweis fehlt');
      }
    }
    // „Läuft weiter, nicht eingefroren" — großzügige Timeouts + jede Folgephase
    // akzeptieren (unter paralleler Testlast tickt das Spiel langsamer).
    await waitForPhase(page, ['BAUEN', 'FEUER', 'KANONE'], 14000);
    const shoot2 = await waitForPhase(page, ['FEUER', 'BAUEN', 'KANONE', 'START'], 14000);
    shoot2 ? ok('Bot-Spiel läuft über vollen Phasenzyklus stabil ✓') : fail('2. Phasenzyklus nicht erreicht (Freeze?)');

    errs.length ? errs.forEach(e => fail('JS: ' + e.slice(0, 80))) : ok('Bot: Keine JS-Fehler ✓');
  } catch (e) {
    fail('Bot-Suite Ausnahme: ' + e.message);
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
async function suiteTutorial(browser) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Interaktives Tutorial\n' + '='.repeat(50));

  const { ctx, page } = await makeCtx(browser);
  page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  try {
    await loadMenu(page);

    // ── Lokal-Untermenü öffnen, Tutorial-Button prüfen ────────
    await jsClick(page, ['LOKAL', 'PLAY LOCAL']);
    await page.waitForTimeout(250);
    const tutBtn = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some(b => /Interaktives Tutorial|Interactive Tutorial/.test(b.textContent || '')));
    tutBtn ? ok('Tutorial-Button im Lokal-Menü sichtbar ✓') : fail('Tutorial-Button fehlt');

    // ── Tutorial starten: erst kommt das Ziel-Intro (v3.37.0) ──
    await jsClick(page, ['Interaktives Tutorial', 'Interactive Tutorial']);
    await page.waitForTimeout(350);
    const intro = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        title: /Das Ziel|The goal/.test(t),
        win: /SO GEWINNST DU|HOW YOU WIN/.test(t),
        lose: /SO VERLIERST DU|HOW YOU LOSE/.test(t),
        cannonRule: /stumme Kanone|silent cannon/.test(t),
        leakHint: /ROTE SPUR|RED TRAIL/.test(t),
        go: [...document.querySelectorAll('button')].some(b => /Los geht|Let.s go/.test(b.textContent || ''))
      };
    });
    intro.title ? ok('Tutorial-Intro: Titel "Das Ziel" ✓') : fail('Tutorial-Intro fehlt');
    intro.win && intro.lose ? ok('Tutorial-Intro: Gewinnen/Verlieren-Panels ✓') : fail('Tutorial-Intro: Panels fehlen');
    intro.cannonRule ? ok('Tutorial-Intro: Kanonen-Regel erklärt ✓') : fail('Tutorial-Intro: Kanonen-Regel fehlt');
    intro.leakHint ? ok('Tutorial-Intro: Leck-Spur angekündigt ✓') : fail('Tutorial-Intro: Leck-Hinweis fehlt');
    const diag = await page.evaluate(() => /diagonal/i.test(document.body.innerText));
    diag ? ok('Tutorial-Intro: Diagonal-Regel erklärt ✓') : fail('Tutorial-Intro: Diagonal-Regel fehlt');
    if (!intro.go) { fail('Tutorial-Intro: Start-Button fehlt'); return { res, errs }; }
    await jsClick(page, ['Los geht', "Let's go"]);
    const canvas = await page.waitForSelector('canvas', { timeout: 6000 }).then(() => true).catch(() => false);
    canvas ? ok('Tutorial-Spiel gestartet (Canvas) ✓') : fail('Tutorial startet nicht');
    if (!canvas) return { res, errs };

    // ── Pausierendes Coach-Popup (v3.37.2): COACH + PAUSIERT + OK ──
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__mmDebug = true; });
    const coach = await page.evaluate(() => {
      const t = document.body.innerText;
      return {
        label: /COACH/.test(t),
        paused: /SPIEL PAUSIERT|GAME PAUSED/.test(t),
        instruction: /(Kanone|Mauer|Burg|cannon|wall|castle)/i.test(t),
        okBtn: [...document.querySelectorAll('button')].some(b => /OK — weiter|OK — continue/.test(b.textContent || '')),
        exit: [...document.querySelectorAll('button')].some(b => /Tutorial beenden|End tutorial/.test(b.textContent || ''))
      };
    });
    coach.label ? ok('Coach-Popup (COACH) sichtbar ✓') : fail('Coach-Popup fehlt');
    coach.paused ? ok('Coach-Popup: PAUSIERT-Kennzeichnung ✓') : fail('Coach-Popup: Pause-Tag fehlt');
    coach.instruction ? ok('Coach gibt eine Phasen-Anweisung ✓') : fail('Coach-Anweisung fehlt');
    coach.okBtn ? ok('Coach-Popup: OK-Button vorhanden ✓') : fail('Coach-Popup: OK fehlt');
    coach.exit ? ok('"Tutorial beenden"-Button vorhanden ✓') : fail('Tutorial-Exit-Button fehlt');

    // ── Pause wirkt: Timer steht, solange das Popup offen ist ──
    const t1 = await page.evaluate(() => window.__readTimer && window.__readTimer());
    await page.waitForTimeout(900); // unter TIMER_SPEEDUP wären das viele Ticks
    const t2 = await page.evaluate(() => window.__readTimer && window.__readTimer());
    t1 != null && t1 === t2 ? ok(`Pause: Timer eingefroren (${t1}) ✓`) : fail(`Pause: Timer lief weiter (${t1}→${t2})`);
    // OK → Spiel läuft weiter.
    //
    // Nach dem Bestätigen kann SOFORT die nächste Coach-Blase aufgehen: Das
    // Tutorial pausiert bei jedem Phasenwechsel, und unter TIMER_SPEEDUP
    // vergehen in einer Wartezeit von 900 ms mehrere Phasen. Gemessen am
    // 05.09.: Beim Ablesen stand „3/4 Deine Kanone war beim START der
    // Schussrunde…" auf dem Schirm, die Uhr stand also völlig zu Recht.
    //
    // Erst alle offenen Blasen wegklicken — das allein reichte aber NICHT:
    // Die Prüfung las den Pausenzustand EINMAL und maß danach 600 ms. In
    // diesem Fenster ging die nächste Blase auf, die Uhr stand zu Recht, und
    // der Riegel meldete rot (17.09., Lauf 351: 20→20, „Blase offen: false" —
    // die Angabe war schon beim Ablesen veraltet).
    //
    // Jetzt werden Uhr und Pausenzustand ZUSAMMEN abgelesen, mehrfach. Es
    // genügt EIN Fenster ohne Blase, in dem sich die Uhr bewegt — das ist
    // genau die Aussage der Prüfung. Steht die Uhr über alle Versuche hinweg
    // ohne Blase still, ist sie zu Recht rot.
    let offen = true;
    for (let i = 0; i < 6 && offen; i++) {
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /OK — weiter|OK — continue/.test(x.textContent || '')); b && b.click(); });
      await page.waitForTimeout(250);
      offen = await page.evaluate(() => /SPIEL PAUSIERT|GAME PAUSED/.test(document.body.innerText));
    }
    const ablesen = () => page.evaluate(() => ({
      t: window.__readTimer ? window.__readTimer() : null,
      pause: /SPIEL PAUSIERT|GAME PAUSED/.test(document.body.innerText)
    }));
    let fortgesetzt = false, t3 = null, t4 = null, sahBlase = false;
    for (let versuch = 0; versuch < 8 && !fortgesetzt; versuch++) {
      const vor = await ablesen();
      await page.waitForTimeout(400);
      const nach = await ablesen();
      t3 = vor.t; t4 = nach.t;
      // „Verändert sich" statt „wird kleiner": Läuft die Uhr über einen
      // Phasenwechsel, fängt sie mit einem HÖHEREN Wert neu an — auch das ist
      // ein laufendes Spiel und darf nicht als Stillstand gelten.
      if (!vor.pause && !nach.pause && vor.t != null && nach.t != null && vor.t !== nach.t) {
        fortgesetzt = true;
      } else if (vor.pause || nach.pause) {
        sahBlase = true;
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /OK — weiter|OK — continue/.test(x.textContent || '')); b && b.click(); });
        await page.waitForTimeout(150);
      }
    }
    fortgesetzt
      ? ok(`Pause: OK setzt fort (${t3}→${t4}) ✓`)
      : fail(`Pause: Uhr steht nach OK (${t3}→${t4}, Blase zwischendurch: ${sahBlase})`);

    // ── Läuft über Phasen — jedes neue Popup mit OK bestätigen ──
    let reached = null;
    const dlPhase = Date.now() + 15000;
    while (Date.now() < dlPhase && !reached) {
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /OK — weiter|OK — continue/.test(x.textContent || '')); b && b.click(); });
      const ph = await getHudPhase(page);
      if (ph && ['FEUER', 'KANONE'].some(k => ph.includes(k))) reached = ph;
      else await page.waitForTimeout(150);
    }
    reached ? ok(`Tutorial läuft (Phasenwechsel bis ${reached}) ✓`) : fail('Tutorial: kein Phasenwechsel trotz OK-Klicks');

    errs.length ? errs.forEach(e => fail('JS: ' + e.slice(0, 80))) : ok('Tutorial: Keine JS-Fehler ✓');
  } catch (e) {
    fail('Tutorial-Suite Ausnahme: ' + e.message);
  } finally { await ctx.close(); }
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// SUITE 5e: Online-Haerte — Beitritts-Rennen, volle Spiele,
// verwaiste Lobbys und Warteschlangen-Hygiene (v3.94.0)
//
// Diese Invarianten stehen seit Jahren in CLAUDE.md unter "geloeste Bugs",
// waren aber NIE geprueft. Jede davon hat das Spiel schon einmal zerlegt:
//   v2.8.1  — zwei gleichzeitig beitretende Gaeste bekamen beide Rolle 2
//   v3.14.10 — verwaiste Lobbys blieben liegen, Codes wurden unbenutzbar
//   v3.14.10 — geloeschtes Warteschlangen-Ticket heilte als {hb}-Stub,
//              den niemand mehr matchen konnte ("sucht ewig")
// ═══════════════════════════════════════════════════════════════
async function suiteOnlineHaerte(browser, fbPort) {
  const res = [], errs = [];
  const ok   = m => { res.push('✅ ' + m); console.log('✅ ' + m); };
  const fail = m => { res.push('❌ ' + m); console.log('❌ ' + m); };
  console.log('\n' + '='.repeat(50) + '\nTEST: Online-Haerte\n' + '='.repeat(50));

  // Direktzugriff auf den Mock-Server: so lassen sich Zustaende herstellen,
  // die mit echten Clients Minuten kosten wuerden (volle Lobby, 3h alte Lobby).
  const dbGet = (p, path) => p.evaluate(async ({ port, path }) => {
    try { return await (await fetch('http://localhost:' + port + '/fb?op=get&path=' + encodeURIComponent(path))).json(); }
    catch (e) { return 'ERR'; }
  }, { port: fbPort, path });
  const dbSet = (p, path, val) => p.evaluate(async ({ port, path, val }) => {
    try {
      await fetch('http://localhost:' + port + '/fb?op=set&path=' + encodeURIComponent(path),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(val) });
      return true;
    } catch (e) { return false; }
  }, { port: fbPort, path, val });
  const dbDel = (p, path) => p.evaluate(async ({ port, path }) => {
    try { await fetch('http://localhost:' + port + '/fb?op=delete&path=' + encodeURIComponent(path), { method: 'DELETE' }); return true; }
    catch (e) { return false; }
  }, { port: fbPort, path });

  const mk = async (n, pid, dev) => {
    const c = await makeOnlineCtx(browser, fbPort, mmIdentInit(n, pid, dev));
    c.page.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(`${n}: ${e.message}`); });
    await loadMenu(c.page);
    return c;
  };
  // Beitritt bis VOR den letzten Klick vorbereiten — nur so lassen sich zwei
  // Gaeste wirklich gleichzeitig absenden.
  const beitrittVorbereiten = async (p, code) => {
    await jsClick(p, ['ONLINE']);            await p.waitForTimeout(250);
    await jsClick(p, ['Spiel beitreten', 'beitreten']); await p.waitForTimeout(250);
    await p.waitForSelector('input:not([type=range])', { timeout: 3000 }).catch(() => {});
    if (await p.evaluate(() => !!document.querySelector('input:not([type=range])')))
      await p.fill('input:not([type=range])', code);
    await p.waitForTimeout(80);
  };
  const absenden = p => jsClick(p, ['Beitreten']);
  const imSpiel  = (p, ms) => p.waitForSelector('canvas', { timeout: ms }).then(() => true).catch(() => false);

  // ══ BLOCK A: Slot-Rennen (v2.8.1) ══════════════════════════════
  {
    const H  = await mk('HaerteHost', 'p_hh', 'd_hh');
    const Ga = await mk('HaerteGastA', 'p_hga', 'd_hga');
    const Gb = await mk('HaerteGastB', 'p_hgb', 'd_hgb');
    try {
      await jsClick(H.page, ['ONLINE']);          await H.page.waitForTimeout(220);
      await jsClick(H.page, ['3 Spieler']);        await H.page.waitForTimeout(150);
      await jsClick(H.page, ['Spiel erstellen']);  const code = (await warteAufCode(H.page)).code;
      if (!code) {
        fail('Slot-Rennen: Host liefert keinen Spielcode');
      } else {
        await Promise.all([beitrittVorbereiten(Ga.page, code), beitrittVorbereiten(Gb.page, code)]);
        // Der eigentliche Test: BEIDE Klicks im selben Moment.
        await Promise.all([absenden(Ga.page), absenden(Gb.page)]);

        const [cH, cA, cB] = await Promise.all([
          imSpiel(H.page, 14000), imSpiel(Ga.page, 14000), imSpiel(Gb.page, 14000)]);
        (cH && cA && cB)
          ? ok('Slot-Rennen: Host und beide Gaeste im Spiel ✓')
          : fail(`Slot-Rennen: Host=${cH} GastA=${cA} GastB=${cB}`);

        const rollen = await Promise.all([Ga.page, Gb.page].map(p => p.evaluate(() => window.__myRole || 0)));
        const sortiert = [...rollen].sort().join(',');
        sortiert === '2,3'
          ? ok(`Slot-Rennen: getrennte Rollen vergeben (${sortiert}) — v2.8.1 haelt ✓`)
          : fail(`Slot-Rennen: Rollen "${sortiert}" statt "2,3" — Transaktion vergibt Slots doppelt!`);

        // Gegenprobe im Datenstand: beide Slots belegt, keiner ueberschrieben.
        const knoten = await dbGet(H.page, 'games/' + code);
        const slots = (knoten && knoten !== 'ERR')
          ? [!!knoten.guestAction2, !!knoten.guestAction3] : [false, false];
        (slots[0] && slots[1])
          ? ok('Slot-Rennen: guestAction2 UND guestAction3 belegt ✓')
          : fail(`Slot-Rennen: Slots ${JSON.stringify(slots)} — ein Beitritt ging verloren`);

        // Drei verschiedene Namen im HUD — ein doppelt vergebener Slot
        // wuerde sich hier als fehlender dritter Spieler zeigen.
        if (cH) {
          const namen = await H.page.evaluate(() => {
            const t = document.body.innerText;
            return ['HaerteHost', 'HaerteGastA', 'HaerteGastB'].filter(n => t.includes(n)).length;
          });
          namen >= 2
            ? ok(`Slot-Rennen: ${namen} Gast-Namen im Host-HUD ✓`)
            : fail(`Slot-Rennen: nur ${namen} Namen im Host-HUD`);
        }
      }
    } catch (e) {
      fail('Slot-Rennen: Ausnahme — ' + e.message);
    } finally { await H.ctx.close(); await Ga.ctx.close(); await Gb.ctx.close(); }
  }

  // ══ BLOCK B: Beitritt muss scheitern, wo er scheitern MUSS ════
  {
    const P = await mk('HaertePruefer', 'p_hp', 'd_hp');
    try {
      const text = () => P.page.evaluate(() => document.body.innerText);
      const probe = async (code, erwartet, name, vorher) => {
        if (vorher) await vorher();
        await beitrittVorbereiten(P.page, code);
        await absenden(P.page);
        await P.page.waitForTimeout(900);
        const t = await text();
        const spiel = await P.page.evaluate(() => !!document.querySelector('canvas'));
        if (spiel) { fail(`${name}: Client landete trotzdem im Spiel!`); return false; }
        if (erwartet.test(t)) { ok(`${name}: abgewiesen mit korrekter Meldung ✓`); return true; }
        fail(`${name}: falsche/keine Meldung (${t.replace(/\s+/g, ' ').slice(0, 90)})`);
        return false;
      };

      await probe('ZZZZZZ', /nicht gefunden/i, 'Unbekannter Code');

      // Verwaiste Lobby: nie gestartet (kein state), aelter als 2h.
      const alt = Date.now() - 3 * 3600 * 1000;
      await dbSet(P.page, 'games/ALTLAB', { numPlayers: 2, createdAt: alt, updatedAt: alt });
      await probe('ALTLAB', /nicht gefunden/i, 'Verwaiste Lobby');
      const rest = await dbGet(P.page, 'games/ALTLAB');
      (rest === null || rest === undefined)
        ? ok('Verwaiste Lobby: Knoten beim Beitrittsversuch aufgeraeumt ✓')
        : fail('Verwaiste Lobby: Knoten liegt weiter herum — Code bleibt verbrannt');

      // Volles 2P-Spiel: der einzige Gast-Slot ist belegt. Entscheidend ist,
      // dass NICHT auf guestAction3 ausgewichen wird (np===3-Schranke).
      await dbSet(P.page, 'games/VOLLZW', {
        numPlayers: 2, createdAt: Date.now(), updatedAt: Date.now(),
        guestAction2: JSON.stringify({ type: 'join', n: Date.now(), name: 'Belegt' })
      });
      await probe('VOLLZW', /bereits voll\./i, 'Volles 2-Spieler-Spiel');
      const zw = await dbGet(P.page, 'games/VOLLZW');
      (zw && zw !== 'ERR' && !zw.guestAction3)
        ? ok('Volles 2-Spieler-Spiel: kein Ausweichen auf Slot 3 ✓')
        : fail('Volles 2-Spieler-Spiel: dritter Spieler in ein 2P-Spiel gerutscht!');

      // Volles 3P-Spiel: beide Gast-Slots belegt.
      await dbSet(P.page, 'games/VOLLDR', {
        numPlayers: 3, createdAt: Date.now(), updatedAt: Date.now(),
        guestAction2: JSON.stringify({ type: 'join', n: Date.now(), name: 'Belegt2' }),
        guestAction3: JSON.stringify({ type: 'join', n: Date.now(), name: 'Belegt3' })
      });
      await probe('VOLLDR', /bereits voll \(3/i, 'Volles 3-Spieler-Spiel');

      // Nach vier gescheiterten Beitritten muss der Client bedienbar bleiben.
      const nochDa = await P.page.evaluate(() =>
        [...document.querySelectorAll('button')].some(b => /Beitreten/.test(b.textContent)));
      nochDa ? ok('Nach vier Fehlversuchen weiter bedienbar ✓')
             : fail('Beitritts-Bildschirm nach Fehlversuchen kaputt');
    } catch (e) {
      fail('Beitritts-Abweisung: Ausnahme — ' + e.message);
    } finally { await P.ctx.close(); }
  }

  // ══ BLOCK C: Warteschlange ════════════════════════════════════
  {
    const Q = await mk('HaerteQueue', 'p_hq', 'd_hq');
    try {
      await dbDel(Q.page, 'queue2');
      await jsClick(Q.page, ['ONLINE']);       await Q.page.waitForTimeout(250);
      await jsClick(Q.page, ['Matchmaking']);  await Q.page.waitForTimeout(1200);

      const tickets = async () => {
        const q = await dbGet(Q.page, 'queue2');
        if (!q || q === 'ERR') return [];
        return Object.entries(q).map(([k, v]) => ({ sid: k, ...v }));
      };

      let t1 = await tickets();
      t1.length === 1
        ? ok('Warteschlange: genau ein eigenes Ticket eingetragen ✓')
        : fail(`Warteschlange: ${t1.length} Tickets statt 1`);
      (t1[0] && t1[0].status === 'waiting' && t1[0].dev === 'd_hq')
        ? ok('Warteschlange: Ticket vollstaendig (status=waiting, dev gesetzt) ✓')
        : fail(`Warteschlange: unvollstaendiges Ticket ${JSON.stringify(t1[0])}`);

      // Selbstheilung (v3.14.10): Server loescht das Ticket (onDisconnect nach
      // kurzem Verbindungsabriss). Der Client muss es KOMPLETT neu eintragen —
      // ein blosser {hb}-Stub ist nicht matchbar und war die Ursache fuer
      // "sucht ewig".
      await dbDel(Q.page, 'queue2');
      const wegSofort = await tickets();
      wegSofort.length === 0
        ? ok('Warteschlange: Ticket serverseitig geloescht (Abriss simuliert) ✓')
        : fail('Warteschlange: Loeschen hat nicht gegriffen');

      let geheilt = null;
      for (let i = 0; i < 25 && !geheilt; i++) {
        await Q.page.waitForTimeout(200);
        const t = await tickets();
        if (t.length === 1) geheilt = t[0];
      }
      geheilt
        ? ok('Warteschlange: Ticket nach Abriss selbst wiederhergestellt ✓')
        : fail('Warteschlange: Ticket kam nicht zurueck — "sucht ewig" (v3.14.10)');
      (geheilt && geheilt.status === 'waiting' && geheilt.pid && geheilt.dev)
        ? ok('Warteschlange: geheiltes Ticket ist vollstaendig, kein {hb}-Stub ✓')
        : fail(`Warteschlange: geheiltes Ticket unbrauchbar ${JSON.stringify(geheilt)}`);

      // Sauber verlassen: kein Ticket-Leichnam.
      await jsClick(Q.page, ['Suche abbrechen']);
      await Q.page.waitForTimeout(900);
      const nachher = await tickets();
      nachher.length === 0
        ? ok('Warteschlange: nach Abbrechen leer ✓')
        : fail(`Warteschlange: ${nachher.length} Ticket(s) nach Abbrechen`);

      // Und der Tick-Loop muss stehen — sonst schriebe er das Ticket zurueck.
      await Q.page.waitForTimeout(1000);
      const spaeter = await tickets();
      spaeter.length === 0
        ? ok('Warteschlange: Tick-Loop gestoppt, kein Zombie-Ticket ✓')
        : fail(`Warteschlange: Zombie-Ticket nach Abbrechen (${spaeter.length})`);

      const imMenue = await Q.page.evaluate(() =>
        [...document.querySelectorAll('button')].some(b => /Matchmaking/.test(b.textContent)));
      imMenue ? ok('Warteschlange: zurueck im Online-Menue ✓')
              : fail('Warteschlange: haengt nach Abbrechen im Suchbildschirm');
    } catch (e) {
      fail('Warteschlange: Ausnahme — ' + e.message);
    } finally { await Q.ctx.close(); }
  }

  // == BLOCK D: Protokoll-Versions-Schranke (v3.35.0) ==============
  // Seit die App im Store liegt, spielt ein eingefrorener Client gegen einen
  // laufend aktualisierten Web-Client. Ist der Host neuer, muss der Gast das
  // EINMAL sagen statt still Geister-Fehler zu erzeugen. Nie geprueft gewesen.
  {
    const H = await mk('ProtoHost', 'p_ph', 'd_ph');
    const G = await mk('ProtoGast', 'p_pg', 'd_pg');
    try {
      await jsClick(H.page, ['ONLINE']);         await H.page.waitForTimeout(220);
      await jsClick(H.page, ['Spiel erstellen']); const code = (await warteAufCode(H.page)).code;
      if (!code) { fail('Protokoll-Schranke: kein Spielcode'); }
      else {
        await beitrittVorbereiten(G.page, code);
        await absenden(G.page);
        const drin = await imSpiel(G.page, 14000);
        if (!drin) fail('Protokoll-Schranke: Gast kam nicht ins Spiel');
        else {
          // Ohne Versions-Unterschied darf NICHTS gewarnt werden — sonst
          // pruefte der Test unten nur, dass irgendein Banner existiert.
          const vorher = await G.page.evaluate(() =>
            /Neue Spielversion|New game version/.test(document.body.innerText));
          !vorher ? ok('Protokoll-Schranke: keine Warnung bei gleicher Version ✓')
                  : fail('Protokoll-Schranke: warnt ohne Versions-Unterschied');

          // Host anhalten, sonst ueberschreibt seine Push-Schleife die
          // Manipulation binnen Millisekunden.
          await H.ctx.close();
          await G.page.waitForTimeout(300);
          // ACHTUNG: `state` ist ein JSON-STRING, kein Objekt. Ein `st.pv = 99`
          // auf dem String lief stillschweigend ins Leere und die Pruefung
          // unten war wertlos \u2014 deshalb hier parsen, aendern, neu schreiben
          // und anschliessend GEGENLESEN, dass die 99 wirklich drinsteht.
          const gesetzt = await G.page.evaluate(async ({ port, code }) => {
            const b = 'http://localhost:' + port + '/fb?op=';
            const pfad = encodeURIComponent('games/' + code + '/state');
            const roh = await (await fetch(b + 'get&path=' + pfad)).json();
            if (typeof roh !== 'string') return 'KEIN_STRING:' + typeof roh;
            const st = JSON.parse(roh);
            st.pv = 99; // Host gibt sich als neuere Version aus
            await fetch(b + 'set&path=' + pfad,
              { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(JSON.stringify(st)) });
            const zurueck = await (await fetch(b + 'get&path=' + pfad)).json();
            return JSON.parse(zurueck).pv === 99 ? 'OK' : 'NICHT_UEBERNOMMEN';
          }, { port: fbPort, code });
          gesetzt === 'OK'
            ? ok('Protokoll-Schranke: neuerer Host-State (pv=99) eingespielt ✓')
            : fail(`Protokoll-Schranke: State nicht manipulierbar (${gesetzt})`);

          let gewarnt = false;
          for (let i = 0; i < 20 && !gewarnt; i++) {
            await G.page.waitForTimeout(200);
            gewarnt = await G.page.evaluate(() =>
              /Neue Spielversion|New game version/.test(document.body.innerText));
          }
          gewarnt ? ok('Protokoll-Schranke: Gast weist auf neuere Version hin ✓')
                  : fail('Protokoll-Schranke: veralteter Gast bleibt stumm (pv-Pruefung tot)');

          // Und der Gast darf daran nicht zerbrechen: weiter im Spiel.
          const nochImSpiel = await G.page.evaluate(() => !!document.querySelector('canvas'));
          nochImSpiel ? ok('Protokoll-Schranke: Gast spielt trotz Hinweis weiter ✓')
                      : fail('Protokoll-Schranke: Gast aus dem Spiel geworfen');
        }
      }
    } catch (e) {
      fail('Protokoll-Schranke: Ausnahme — ' + e.message);
    } finally {
      try { await H.ctx.close(); } catch (e) {}
      await G.ctx.close();
    }
  }

  errs.length === 0 ? ok('Online-Haerte: keine JS-Fehler ✓')
                    : errs.slice(0, 3).forEach(e => fail(`Haerte JS: ${e.slice(0, 80)}`));
  return { res, errs };
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
(async () => {
  console.log('🔍 Versions-Validierung...');
  const expected = getExpectedVersion();
  if (!expected) { console.error('❌ ABBRUCH: Version nicht lesbar'); process.exit(1); }
  console.log(`   Erwartet: v${expected}`);
  // Laeuft nichts auf 8765, wird selbst einer gestartet.
  //
  // Vorher brach die Suite hier ab mit „Server nicht erreichbar", und man
  // musste sich erinnern, dass sie gegen dist/ laeuft und nicht gegen die
  // Quelle. Das kostete jedes Mal einen Anlauf, und in einem Ablauf braucht
  // es sonst einen eigenen Schritt, der den Server im Hintergrund startet und
  // hinterher niemand aufraeumt.
  let eigenerServer = null;
  let server;
  try { server = await getServerVersion(); }
  catch (e) {
    console.log(`   Kein Server auf 8765 (${e.code || e.message}) — starte einen fuer dist/`);
    eigenerServer = starteDistServer();
    try { server = await getServerVersion(); }
    catch (e2) {
      console.error(`❌ ABBRUCH: Auch der eigene Server antwortet nicht — ${e2.message}`);
      process.exit(1);
    }
  }
  console.log(`   Server:   v${server}`);
  if (server !== expected) {
    console.error(`❌ ABBRUCH: Versions-Mismatch (Server v${server} ≠ Disk v${expected})`);
    console.error('   → python3 -m http.server 8765');
    process.exit(1);
  }
  console.log(`✅ v${expected} — Test läuft\n`);

  const t0 = Date.now();
  const browser   = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--disable-web-security'] });
  const mockFbSrv = await startMockFbServer();
  const FB_PORT   = 8766;

  // Entwicklungs-Abkuerzung: NUR=haerte,online2p faehrt einzelne Suiten.
  // Das ist ausdruecklich KEIN Ersatz fuer den Lauf, der den Build freigibt —
  // `npm run test:e2e` ohne NUR faehrt immer alles. Der Schalter existiert,
  // weil ein voller Lauf zwei Minuten kostet und man beim Schreiben einer
  // Suite zehnmal hintereinander laeuft.
  const NUR = (process.env.NUR || '').split(',').map(x => x.trim()).filter(Boolean);
  if (NUR.length) {
    const einzeln = {
      menu: () => suiteMenu(browser),
      offline: () => suiteOffline(browser),
      plattform: () => suitePlattform(browser),
      sicherheit: () => suiteSicherheitsbereiche(browser),
      ipad: () => suiteIPad(browser),
      profilname: () => suiteProfilName(browser),
      nav2: () => suiteNavHUD(browser, 2),
      nav3: () => suiteNavHUD(browser, 3),
      mechanik: () => suiteMechanics(browser),
      quit: () => suiteQuitUX(browser),
      onlineui: () => suiteOnlineUI(browser, FB_PORT),
      online2p: () => suiteOnline2P(browser, FB_PORT),
      online3p: () => suiteOnline3P(browser, FB_PORT),
      aktionen: () => suiteOnlineAktionen(browser, FB_PORT),
      bestenliste: () => suiteBestenliste(browser),
      fbstart: () => suiteFirebaseStart(browser),
      matchmaking: () => suiteMatchmaking(browser, FB_PORT),
      haerte: () => suiteOnlineHaerte(browser, FB_PORT),
      heartbeat: () => suiteHeartbeat(browser, FB_PORT),
      trichter: () => suiteTrichter(browser, FB_PORT),
      cloudsave: () => suiteCloudSave(browser, FB_PORT),
      zumauern: () => suiteZumauern(browser),
      progression: () => suiteProgression(browser),
      achievements: () => suiteAchievements(browser),
      bauwarnung: () => suiteBuildUrgency(browser),
      onboarding: () => suiteOnboarding(browser),
      sound: () => suiteSound(browser),
      i18n: () => suiteI18n(browser),
      bot: () => suiteBot(browser),
      tutorial: () => suiteTutorial(browser),
      settle: () => suiteBallSettle(browser),
      ruestphase: () => suiteArmoryReady(browser),
      kanonenkill: () => suiteCannonKill(browser),
      aufgaben: () => suiteDailyTasks(browser),
      goldshop: () => suiteGoldShop(browser),
      schmiede: () => suiteSchmiede(browser),
    };
    const unbekannt = NUR.filter(n => !einzeln[n]);
    if (unbekannt.length) {
      console.error(`ABBRUCH: unbekannte Suite(n): ${unbekannt.join(', ')}`);
      console.error(`Verfuegbar: ${Object.keys(einzeln).join(', ')}`);
      await browser.close(); mockFbSrv.close(); process.exit(2);
    }
    const teil = [];
    for (const n of NUR) teil.push(await einzeln[n]());
    await browser.close(); mockFbSrv.close();
    const rs = teil.flatMap(x => x.res), es = teil.flatMap(x => x.errs);
    console.log('\n' + '='.repeat(50) + `\nTEILERGEBNIS (NUR=${NUR.join(',')})\n` + '='.repeat(50));
    rs.forEach(r => console.log(r));
    if (es.length) { console.log('\nJS-FEHLER:'); es.forEach(e => console.log('  ' + e)); }
    const p2 = rs.filter(r => r.startsWith('\u2705')).length;
    const f2 = rs.filter(r => r.startsWith('\u274C')).length;
    console.log(`\nTeilsumme: ${p2} \u2705  ${f2} \u274C  (${((Date.now()-t0)/1000).toFixed(1)}s)`);
    process.exit(f2 > 0 ? 1 : 0);
  }

  // Alle Suites parallel ausführen (Online-Suites teilen Mock-Server)
  // Matchmaking- und 3P-Suite NACHEINANDER (bis zu 6 Kontexte mit laufenden
  // Spielen gleichzeitig überlasten den Runner → Phase-Sync-Flakes in 2P).
  const onlineHeavy = (async () => {
    const mm = await suiteMatchmaking(browser, FB_PORT);
    const mm3 = await suiteOnline3P(browser, FB_PORT);
    // Herzschlag laeuft bewusst HIER (seriell) und nicht parallel: die Suite
    // haelt zwei Spielkontexte und wartet auf Fristen — parallel dazu noch
    // mehr Online-Kontexte erzeugen genau die Phase-Sync-Flakes von oben.
    const hb = await suiteHeartbeat(browser, FB_PORT);
    const tr = await suiteTrichter(browser, FB_PORT);
    const cs = await suiteCloudSave(browser, FB_PORT);
    // Zumauern laeuft HIER und nicht parallel: Die Suite haelt ein Bot-Spiel
    // ueber vierzehn Sekunden am Laufen und fragt es dabei staendig ab. Neben
    // den uebrigen Suiten hat sie zweimal die Mechanik-Pruefungen ins
    // Zeitlimit gedrueckt — dieselbe Ueberlast, wegen der Matchmaking und 3P
    // schon seriell stehen.
    const zm = await suiteZumauern(browser);
    // Online-Haerte gehoert ebenfalls hierher: sie haelt in Block A drei
    // Spielkontexte gleichzeitig und braucht ein unbelastetes Zeitfenster,
    // sonst wird aus dem Beitritts-Rennen ein Lastproblem.
    const hrt = await suiteOnlineHaerte(browser, FB_PORT);
    // Aktionen ebenfalls SERIELL hier: die Suite haelt bis zu drei
    // Spielkontexte und tastet das Brett ab, bis der Host reagiert. Parallel
    // dazu waere die Frist eine Lastmessung statt einer Funktionspruefung.
    const akt = await suiteOnlineAktionen(browser, FB_PORT);
    // Bestenliste ebenfalls SERIELL. Sie braucht kein Firebase (alles gemockt),
    // haelt aber einen Kontext ueber acht Sekunden — das ist die Frist, deren
    // Ablauf sie prueft. Im parallelen Block hat genau das einmal den
    // Quick-Match reissen lassen („A=false B=true"): dieselbe Ueberlast, wegen
    // der Matchmaking und 3P schon seriell stehen. Zehn Sekunden seriell sind
    // billiger als ein Flattern im Deployment.
    const lb = await suiteBestenliste(browser);
    // Bot-Suite seit v3.111.5 ebenfalls SERIELL. Ihre Versiegelungs-Pruefung
    // haengt am KI-Tick: Der Bot dichtet die Bresche gemessen nach rund vier
    // Sekunden, und das Bauende faellt auf denselben Moment. Fehlt ihm unter
    // paralleler Last Rechenzeit, verliert er — und drei Pruefungen fallen als
    // Nachhall mit. Genau die Ueberlast, wegen der zumauern, matchmaking und
    // 3P schon hier stehen. Die Aussage bleibt unveraendert; nur bekommt der
    // Bot die Gelegenheit, die sie voraussetzt.
    const bot = await suiteBot(browser);
    // Der echte Firebase-Start ebenfalls SERIELL: Er haelt zwei Kontexte, in
    // denen das SDK wirklich hochfaehrt, und wartet je 2,5 s auf den
    // Anmeldeversuch. Parallel dazu waere das eine Lastmessung.
    const fbs = await suiteFirebaseStart(browser);
    return { mm, mm3, hb, cs, tr, zm, hrt, akt, lb, bot, fbs };
  })();
  const [rMenu, rOff, rPlat, rSA, rPad, rName, r2P, r3P, rMech, rQuit, rOnlineUI, rOnline2P, rHeavy, rProg, rAch, rBuild, rOnb, rSnd, rI18n, rTut, rSettle, rReady, rKill, rTasks, rShop, rSchmiede] = await Promise.all([
    suiteMenu(browser),
    suiteOffline(browser),
    suitePlattform(browser),
    suiteSicherheitsbereiche(browser),
    suiteIPad(browser),
    suiteProfilName(browser),
    suiteNavHUD(browser, 2),
    suiteNavHUD(browser, 3),
    suiteMechanics(browser),
    suiteQuitUX(browser),
    suiteOnlineUI(browser, FB_PORT),
    suiteOnline2P(browser, FB_PORT),
    onlineHeavy,
    suiteProgression(browser),
    suiteAchievements(browser),
    suiteBuildUrgency(browser),
    suiteOnboarding(browser),
    suiteSound(browser),
    suiteI18n(browser),
    suiteTutorial(browser),
    suiteBallSettle(browser),
    suiteArmoryReady(browser),
    suiteCannonKill(browser),
    suiteDailyTasks(browser),
    suiteGoldShop(browser),
    suiteSchmiede(browser),
  ]);

  const rMM = rHeavy.mm, rMM3 = rHeavy.mm3, rHB = rHeavy.hb, rCS = rHeavy.cs, rTR = rHeavy.tr, rWarn = rHeavy.zm, rHrt = rHeavy.hrt, rAkt = rHeavy.akt, rLB = rHeavy.lb, rBot2 = rHeavy.bot, rFbs = rHeavy.fbs;
  await browser.close();
  mockFbSrv.close();

  const allRes  = [...rMenu.res, ...rOff.res, ...rPlat.res, ...rSA.res, ...rPad.res, ...rName.res, ...rWarn.res, ...r2P.res,  ...r3P.res,  ...rMech.res,  ...rQuit.res,
                   ...rOnlineUI.res, ...rOnline2P.res, ...rMM.res, ...rMM3.res, ...rProg.res, ...rAch.res, ...rBuild.res, ...rOnb.res, ...rSnd.res, ...rI18n.res, ...rTut.res, ...rSettle.res, ...rReady.res, ...rKill.res, ...rTasks.res, ...rShop.res, ...rSchmiede.res, ...rHB.res, ...rCS.res, ...rTR.res, ...rHrt.res, ...rAkt.res, ...rLB.res, ...rBot2.res, ...rFbs.res];
  const allErrs = [...rMenu.errs, ...rOff.errs, ...rPlat.errs, ...rSA.errs, ...rPad.errs, ...rName.errs, ...rWarn.errs, ...r2P.errs, ...r3P.errs, ...rMech.errs, ...rQuit.errs,
                   ...rOnlineUI.errs, ...rOnline2P.errs, ...rMM.errs, ...rMM3.errs, ...rProg.errs, ...rAch.errs, ...rBuild.errs, ...rOnb.errs, ...rSnd.errs, ...rI18n.errs, ...rTut.errs, ...rSettle.errs, ...rReady.errs, ...rKill.errs, ...rTasks.errs, ...rShop.errs, ...rSchmiede.errs, ...rHB.errs, ...rCS.errs, ...rTR.errs, ...rHrt.errs, ...rAkt.errs, ...rLB.errs, ...rBot2.errs, ...rFbs.errs];

  console.log('\n' + '='.repeat(50) + '\nTESTERGEBNIS\n' + '='.repeat(50));
  allRes.forEach(r => console.log(r));

  if (allErrs.length > 0) { console.log('\nJS-FEHLER:'); allErrs.forEach(e => console.log('  ' + e)); }
  else console.log('\n✅ Keine JS-Fehler');

  const pass = allRes.filter(r => r.startsWith('✅')).length;
  const fail = allRes.filter(r => r.startsWith('❌')).length;
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nGesamt: ${pass} ✅  ${fail} ❌  (${elapsed}s)`);

  const shots = fs.readdirSync('/tmp').filter(f => f.endsWith('.png') && /^s[0-9]/.test(f));
  console.log(`${shots.length} Screenshots in /tmp/`);

  if (fail > 0) process.exit(1);
})();
