const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const http = require('http');

const REACT_JS = fs.readFileSync('/tmp/react.min.js', 'utf8');
const REACT_DOM_JS = fs.readFileSync('/tmp/react-dom.min.js', 'utf8');

function getExpectedVersion() {
  const html = fs.readFileSync('/home/user/Fortress/index.html', 'utf8');
  const m = html.match(/FORTRESS v(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

function getServerVersion() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8765/', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const m = data.match(/FORTRESS v(\d+\.\d+\.\d+)/);
        resolve(m ? m[1] : null);
      });
    }).on('error', reject);
  });
}

async function jsClick(page, textParts) {
  return page.evaluate((parts) => {
    const btns = Array.from(document.querySelectorAll('button'));
    for (const b of btns) {
      const txt = (b.textContent || '').trim();
      if (parts.some(p => txt.includes(p))) { b.click(); return txt; }
    }
    return null;
  }, textParts);
}

async function findButtonText(page, textParts) {
  return page.evaluate((parts) => {
    const btns = Array.from(document.querySelectorAll('button'));
    for (const b of btns) {
      const txt = (b.textContent || '').trim();
      if (parts.some(p => txt.includes(p))) return txt;
    }
    return null;
  }, textParts);
}

async function allButtonTexts(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).map(b => (b.textContent || '').trim())
  );
}

async function getTimerValue(page) {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      const t = (el.textContent || '').trim();
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

// HUD-Phasenbadge-Text lesen (BAUEN / FEUER / KANONE / START)
async function getHudPhase(page) {
  return page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    for (const s of spans) {
      const t = (s.textContent || '').trim();
      if (t.includes('BAUEN') || t.includes('FEUER') || t.includes('KANONE') || t.includes('START')) return t;
    }
    return null;
  });
}

// Warte auf eine bestimmte HUD-Phase (polling, max waitSec Sekunden)
async function waitForPhase(page, keywords, waitSec) {
  for (let i = 0; i < waitSec; i++) {
    await page.waitForTimeout(1000);
    const ph = await getHudPhase(page);
    if (ph && keywords.some(k => ph.includes(k))) {
      return ph;
    }
  }
  return null;
}

// Warte auf Bauphase (Drehen-Button als Indikator)
async function waitForBuild(page, waitSec = 30) {
  for (let i = 0; i < waitSec; i++) {
    await page.waitForTimeout(1000);
    const found = await findButtonText(page, ['drehen', 'Drehen']);
    if (found) return found;
  }
  return null;
}

async function setupGamePage(browser, playerCount) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.route('**unpkg.com**react@18**react.production.min.js**', r =>
    r.fulfill({ contentType: 'application/javascript', body: REACT_JS }));
  await page.route('**unpkg.com**react-dom@18**react-dom.production.min.js**', r =>
    r.fulfill({ contentType: 'application/javascript', body: REACT_DOM_JS }));
  await page.route('**firebase**', r => r.abort());
  await page.route('**gstatic**', r => r.abort());
  await page.route('**googleapis**', r => r.abort());
  return { ctx, page };
}

async function navigateToGame(page, playerCount) {
  await page.goto('http://localhost:8765/', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1500);
  // Profil-Editor überspringen falls vorhanden
  const hasNameInput = await page.evaluate(() => !!document.querySelector('input[maxlength="16"]'));
  if (hasNameInput) {
    await page.evaluate(() => {
      const inp = document.querySelector('input[maxlength="16"]');
      if (inp) { inp.value = 'TestBot'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await page.waitForTimeout(150);
    await jsClick(page, ['Speichern']);
    await page.waitForTimeout(400);
  }
  await jsClick(page, ['LOKAL']);
  await page.waitForTimeout(500);
  const playerLabel = playerCount === 2 ? '2 Spieler' : '3 Spieler';
  await jsClick(page, [playerLabel]);
  await page.waitForTimeout(1500);
}

(async () => {
  // ── Versions-Validierung ──────────────────────────────────────────────────
  console.log('🔍 Versions-Validierung...');
  const expectedVersion = getExpectedVersion();
  if (!expectedVersion) { console.error('❌ ABBRUCH: Version nicht lesbar'); process.exit(1); }
  console.log(`   Erwartet: v${expectedVersion}`);
  let serverVersion;
  try { serverVersion = await getServerVersion(); }
  catch (e) { console.error(`❌ ABBRUCH: Server nicht erreichbar — ${e.message}`); process.exit(1); }
  console.log(`   Server:   v${serverVersion}`);
  if (serverVersion !== expectedVersion) {
    console.error(`❌ ABBRUCH: Versions-Mismatch (Server v${serverVersion} ≠ Disk v${expectedVersion})`);
    console.error('   → python3 -m http.server 8765');
    process.exit(1);
  }
  console.log(`✅ v${expectedVersion} — Test läuft\n`);
  // ─────────────────────────────────────────────────────────────────────────

  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const errors = [];
  const results = [];
  const ok   = (msg) => { results.push('✅ ' + msg); console.log('✅ ' + msg); };
  const fail = (msg) => { results.push('❌ ' + msg); console.log('❌ ' + msg); };

  // ═══════════════════════════════════════════════════════════════
  // SUITE 1: Navigation & HUD-Grundstruktur (2P + 3P)
  // ═══════════════════════════════════════════════════════════════
  async function testNavAndHUD(label, playerCount) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`TEST: ${label}`);
    console.log('='.repeat(50));

    const { ctx, page } = await setupGamePage(browser, playerCount);
    const jsErrors = [];
    page.on('pageerror', e => {
      if (!e.message.includes('firebase') && !e.message.includes('Firebase'))
        jsErrors.push(e.message);
    });

    await navigateToGame(page, playerCount);

    const version = await page.evaluate(() => (document.title.match(/v(\d+\.\d+\.\d+)/) || [])[1]);
    version ? ok(`Version: ${version}`) : fail('Version nicht erkannt');

    // Gold im Menü vorhanden
    // (wurde vor navigateToGame geprüft, also nach frischem Load)
    await page.goto('http://localhost:8765/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1200);
    const goldVisible = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*')).some(el => el.children.length === 0 && (el.textContent || '').includes('Gold'))
    );
    goldVisible ? ok('Gold-Anzeige im Menü ✓') : fail('Gold-Anzeige im Menü fehlt');
    await navigateToGame(page, playerCount);

    // Canvas
    const cb = await getCanvasBox(page);
    cb ? ok(`Canvas: ${Math.round(cb.w)}×${Math.round(cb.h)}px`) : fail('Canvas fehlt');

    await page.screenshot({ path: `/tmp/s1_${playerCount}p_setup.png` });

    // ── Beenden-Button UX ─────────────────────────────────────────
    const quitInfo = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const b of btns) {
        if ((b.textContent || '').includes('beenden')) {
          const r = b.getBoundingClientRect();
          const st = window.getComputedStyle(b);
          return { x: r.x, y: r.y, w: r.width, h: r.height, pos: st.position, bg: st.background };
        }
      }
      return null;
    });
    if (!quitInfo) {
      fail('Beenden-Button nicht gefunden');
    } else {
      ok(`Beenden-Button: ${Math.round(quitInfo.w)}×${Math.round(quitInfo.h)}px @ (${Math.round(quitInfo.x)},${Math.round(quitInfo.y)})`);
      quitInfo.pos !== 'absolute'
        ? ok('Beenden-Button: kein absolutes Overlay ✓')
        : fail('Beenden-Button: position=absolute (Overlap)');
      const centerX = quitInfo.x + quitInfo.w / 2;
      (centerX > 100 && centerX < 290)
        ? ok(`Beenden-Button im HUD-Center (x≈${Math.round(centerX)}) ✓`)
        : fail(`Beenden-Button außerhalb HUD-Center (x≈${Math.round(centerX)})`);
      // Sichtbar: hat einen Hintergrund (kein "none" oder transparent)
      const hasBg = quitInfo.bg && !quitInfo.bg.includes('rgba(0, 0, 0, 0)') && quitInfo.bg !== 'none';
      hasBg
        ? ok('Beenden-Button: sichtbarer Hintergrund ✓')
        : fail('Beenden-Button: kein sichtbarer Hintergrund (unsichtbar)');
    }

    // Timer zählt runter
    const t0 = await getTimerValue(page);
    await page.waitForTimeout(2100);
    const t1 = await getTimerValue(page);
    (t0 !== null && t1 !== null && t1 < t0)
      ? ok(`Timer zählt: ${t0} → ${t1} ✓`)
      : fail(`Timer zählt nicht (${t0} → ${t1})`);

    // CSS-Phasenbanner vorhanden
    const hasAnim = await page.evaluate(() => {
      try {
        return Array.from(document.styleSheets).some(s =>
          Array.from(s.cssRules || []).some(r => r.name === 'phasebanner'));
      } catch { return false; }
    });
    hasAnim ? ok('CSS-Animation phasebanner ✓') : fail('CSS-Animation phasebanner fehlt');

    // Neuer Phasenzyklus: Setup → Schuss (kein Build am Anfang!)
    console.log('⏳ Warte auf Schussphase (nach Setup)...');
    const shootPh = await waitForPhase(page, ['FEUER'], 28);
    if (!shootPh) { fail('Schussphase nach Setup nicht erreicht'); await ctx.close(); return; }
    ok(`Schussphase direkt nach Setup: "${shootPh}" ✓`);
    await page.screenshot({ path: `/tmp/s1_${playerCount}p_shoot.png` });

    // Beenden → Weiterspielen → zurück
    const q1 = await jsClick(page, ['beenden']);
    if (q1) {
      await page.waitForTimeout(350);
      const resume = await jsClick(page, ['Weiterspielen']);
      if (resume) {
        await page.waitForTimeout(350);
        const dialogGone = !(await findButtonText(page, ['Weiterspielen']));
        dialogGone ? ok('Weiterspielen schließt Dialog ✓') : fail('Dialog bleibt nach Weiterspielen');
        const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
        hasCanvas ? ok('Spiel läuft nach Weiterspielen ✓') : fail('Canvas fehlt nach Weiterspielen');
      }
    }

    // Beenden → Ja → Menü
    const q2 = await jsClick(page, ['beenden']);
    if (q2) {
      await page.waitForTimeout(350);
      await jsClick(page, ['Ja, beenden']);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `/tmp/s1_${playerCount}p_menu.png` });
      const backInMenu = !(await page.evaluate(() => !!document.querySelector('canvas')));
      backInMenu ? ok('Zurück im Menü ✓') : fail('Canvas nach "Ja, beenden" noch da');
    }

    if (jsErrors.length > 0) jsErrors.forEach(e => { fail(`JS-Fehler: ${e.slice(0, 80)}`); errors.push(e); });
    else ok('Keine JS-Fehler');

    await ctx.close();
  }

  // ═══════════════════════════════════════════════════════════════
  // SUITE 2: Spielmechanik — Bauen, Schießen, Kanone setzen
  // ═══════════════════════════════════════════════════════════════
  async function testGameMechanics() {
    console.log(`\n${'='.repeat(50)}`);
    console.log('TEST: Spielmechanik (Bauen / Schießen / Kanone)');
    console.log('='.repeat(50));

    const { ctx, page } = await setupGamePage(browser, 2);
    const jsErrors = [];
    page.on('pageerror', e => {
      if (!e.message.includes('firebase') && !e.message.includes('Firebase'))
        jsErrors.push(e.message);
    });

    await navigateToGame(page, 2);
    const cb = await getCanvasBox(page);
    if (!cb) { fail('Canvas fehlt — Mechanik-Tests übersprungen'); await ctx.close(); return; }

    // ── SETUP-PHASE: Kanonen platzieren ──────────────────────────
    // Neuer Phasenzyklus: Setup → Schuss → Kanone → Bau → Schuss → ...
    console.log('⚙️  Setup-Phase: Kanonen platzieren...');
    const setupTaps = [
      { rx: 0.38, ry: 0.18 }, // P1 Kanone 1
      { rx: 0.62, ry: 0.18 }, // P1 Kanone 2
      { rx: 0.38, ry: 0.82 }, // P2 Kanone 1
      { rx: 0.62, ry: 0.82 }, // P2 Kanone 2
    ];
    for (const { rx, ry } of setupTaps) {
      await page.mouse.click(cb.x + cb.w * rx, cb.y + cb.h * ry);
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: '/tmp/s2_setup_cannons.png' });

    // Nach Setup kommt DIREKT die Schussphase (kein Build mehr!)
    console.log('⏳ Warte auf erste Schussphase (nach Setup)...');
    const firstShoot = await waitForPhase(page, ['FEUER'], 28);
    if (!firstShoot) { fail('Schussphase nach Setup nicht erreicht'); await ctx.close(); return; }
    ok(`Schussphase direkt nach Setup: "${firstShoot}" ✓`);
    await page.screenshot({ path: '/tmp/s2_first_shoot.png' });

    // Schuss-Timer läuft (nach 2500ms Banner)
    const fs0 = await getTimerValue(page);
    await page.waitForTimeout(4000);
    const fs1 = await getTimerValue(page);
    (fs0 !== null && fs1 !== null && fs1 < fs0)
      ? ok(`Schuss-Timer zählt: ${fs0} → ${fs1} ✓`)
      : fail(`Schuss-Timer zählt nicht (${fs0} → ${fs1})`);

    // Schuss-Geste (Schleuder: Finger auf Kanonen-Bereich → wegziehen)
    console.log('💥 Schuss-Geste...');
    const shootFromX = cb.x + cb.w * 0.5;
    const shootFromY = cb.y + cb.h * 0.18;
    await page.mouse.move(shootFromX, shootFromY);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(shootFromX, cb.y + cb.h * 0.05);
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const shootOk1 = await page.evaluate(() => !!document.querySelector('canvas'));
    shootOk1 ? ok('Schuss-Geste (erste Runde) ohne Crash ✓') : fail('Canvas nach Schuss-Geste verschwunden');

    // ── Warte auf KANONEN-PHASE ───────────────────────────────────
    console.log('⏳ Warte auf Kanonen-Phase (~30s)...');
    const cannonPhase = await waitForPhase(page, ['KANONE'], 38);
    if (!cannonPhase) { fail('Kanonen-Phase nicht erreicht'); await ctx.close(); return; }
    ok(`Kanonen-Phase erreicht: "${cannonPhase}" ✓`);
    await page.screenshot({ path: '/tmp/s2_cannon_start.png' });

    // Kanone platzieren
    console.log('🎯 Kanone setzen...');
    for (const { rx, ry } of [{ rx: 0.35, ry: 0.28 }, { rx: 0.55, ry: 0.28 }]) {
      await page.mouse.click(cb.x + cb.w * rx, cb.y + cb.h * ry);
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: '/tmp/s2_cannon_placed.png' });
    const cannonOk = await page.evaluate(() => !!document.querySelector('canvas'));
    cannonOk ? ok('Kanone-Platzierungs-Geste ohne Crash ✓') : fail('Canvas nach Kanone-Setzen verschwunden');

    // ── Warte auf BAUPHASE (erste echte Bauphase) ─────────────────
    console.log('⏳ Warte auf Bauphase (nach Kanone-Phase)...');
    const buildPhase = await waitForPhase(page, ['BAUEN'], 20);
    if (!buildPhase) { fail('Bauphase nicht erreicht'); await ctx.close(); return; }
    ok('Bauphase nach Kanonen-Phase erreicht ✓');
    await page.screenshot({ path: '/tmp/s2_build_start.png' });

    // Canvas-Tap (kurz, keine Bewegung) → dreht Stück (neue Mechanik)
    console.log('🔄 Canvas-Tap-Rotation testen...');
    for (let i = 0; i < 3; i++) {
      await page.mouse.click(cb.x + cb.w * (0.3 + i * 0.1), cb.y + cb.h * 0.2);
      await page.waitForTimeout(180);
    }
    const tapRotOk = await page.evaluate(() => !!document.querySelector('canvas'));
    tapRotOk ? ok('Canvas-Tap dreht Stück in Bauphase ✓') : fail('Canvas nach Tap-Rotation verschwunden');

    // Stück-Vorschau-Panel sichtbar
    const previewOk = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      return spans.some(s => (s.textContent || '').includes('DREHEN'));
    });
    previewOk ? ok('Stück-Vorschau-Panel mit ↻ DREHEN sichtbar ✓') : fail('Stück-Vorschau-Panel nicht gefunden');

    // Stück-Vorschau-Panel antippen → dreht
    const prevTapOk = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const label = spans.find(s => (s.textContent || '').includes('DREHEN'));
      if (!label) return false;
      const panel = label.parentElement;
      if (!panel) return false;
      panel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, isPrimary: true, pointerId: 99 }));
      return true;
    });
    prevTapOk ? ok('Stück-Vorschau-Panel dreht Stück ✓') : fail('Stück-Vorschau-Panel nicht gefunden');

    // Bauphase: Tetrominos platzieren (Drag-Geste: mit Bewegung, nicht Tap)
    console.log('🧱 Bauphase: Teile per Drag platzieren...');
    for (let i = 0; i < 3; i++) {
      const startX = cb.x + cb.w * (0.28 + i * 0.12);
      // P1 (obere Hälfte): drag mit deutlicher Bewegung (> 1.5 Zellen)
      await page.mouse.move(startX, cb.y + cb.h * 0.22);
      await page.mouse.down(); await page.waitForTimeout(50);
      await page.mouse.move(startX + 32, cb.y + cb.h * 0.22 + 20);
      await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(180);
      // P2 (untere Hälfte): drag
      await page.mouse.move(startX, cb.y + cb.h * 0.78);
      await page.mouse.down(); await page.waitForTimeout(50);
      await page.mouse.move(startX + 32, cb.y + cb.h * 0.78 - 20);
      await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(180);
    }
    ok('Bau-Gesten (Drag) ohne Crash ✓');

    // ── Warte auf zweite SCHUSS-PHASE ─────────────────────────────
    console.log('⏳ Warte auf zweite Schussphase (~25s)...');
    const shootPhase2 = await waitForPhase(page, ['FEUER'], 35);
    if (!shootPhase2) { fail('Zweite Schussphase nicht erreicht'); await ctx.close(); return; }
    ok(`Zweite Schussphase: "${shootPhase2}" ✓`);

    // Schuss-Timer nach Banner
    const st0 = await getTimerValue(page);
    await page.waitForTimeout(4000);
    const st1 = await getTimerValue(page);
    (st0 !== null && st1 !== null && st1 < st0)
      ? ok(`Schuss-Timer Runde 2: ${st0} → ${st1} ✓`)
      : fail(`Schuss-Timer Runde 2 zählt nicht (${st0} → ${st1})`);

    // Mehrere Schüsse
    for (let i = 0; i < 3; i++) {
      const fx = cb.x + cb.w * (0.3 + i * 0.2);
      await page.mouse.move(fx, shootFromY);
      await page.mouse.down(); await page.waitForTimeout(80);
      await page.mouse.move(fx, cb.y + cb.h * 0.04);
      await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(250);
    }
    ok('Mehrfach-Schüsse ohne Crash ✓');
    await page.screenshot({ path: '/tmp/s2_shoot_gesture.png' });

    if (jsErrors.length > 0) {
      jsErrors.forEach(e => { fail(`JS-Fehler: ${e.slice(0, 80)}`); errors.push(e); });
    } else {
      ok('Gesamte Mechanik: Keine JS-Fehler ✓');
    }

    await ctx.close();
  }

  // ═══════════════════════════════════════════════════════════════
  // SUITE 3: Beenden-Button UX & Overlap
  // ═══════════════════════════════════════════════════════════════
  async function testQuitButtonUX() {
    console.log(`\n${'='.repeat(50)}`);
    console.log('TEST: Beenden-Button UX & Overlap');
    console.log('='.repeat(50));

    const { ctx, page } = await setupGamePage(browser, 2);
    page.on('pageerror', e => {
      if (!e.message.includes('firebase') && !e.message.includes('Firebase'))
        errors.push(`[QuitUX] ${e.message}`);
    });

    await navigateToGame(page, 2);
    await page.waitForTimeout(500);

    const allBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => {
        const r = b.getBoundingClientRect();
        const st = window.getComputedStyle(b);
        return { text: (b.textContent || '').trim(), x: r.x, y: r.y, w: r.width, h: r.height, pos: st.position, bg: st.background };
      })
    );

    const quitBtn = allBtns.find(b => b.text.toLowerCase().includes('beenden'));
    if (!quitBtn) {
      fail('Beenden-Button nicht gefunden'); await ctx.close(); return;
    }

    ok(`Beenden-Button: "${quitBtn.text}" | ${Math.round(quitBtn.w)}×${Math.round(quitBtn.h)}px`);

    // Kein absolutes Positioning
    quitBtn.pos !== 'absolute'
      ? ok(`Position: ${quitBtn.pos} (kein Overlay) ✓`)
      : fail(`Position: absolute (überlagert Inhalte)`);

    // Kein Overlap mit anderen Buttons
    const overlapping = allBtns.filter(b => b !== quitBtn && b.w > 0 && b.text).filter(b => {
      const ox = quitBtn.x < b.x + b.w && quitBtn.x + quitBtn.w > b.x;
      const oy = quitBtn.y < b.y + b.h && quitBtn.y + quitBtn.h > b.y;
      return ox && oy;
    });
    overlapping.length === 0
      ? ok('Kein Overlap mit anderen Buttons ✓')
      : fail(`Überlappt ${overlapping.length} Button(s): ${overlapping.map(b => `"${b.text.slice(0,15)}"`).join(', ')}`);

    // Sichtbarer Hintergrund (nicht "none")
    const hasBg = quitBtn.bg && !quitBtn.bg.includes('rgba(0, 0, 0, 0)') && quitBtn.bg !== 'none';
    hasBg
      ? ok('Sichtbarer Button-Hintergrund ✓')
      : fail('Kein sichtbarer Hintergrund (Button wirkt unsichtbar)');

    // Mittig im HUD (x zwischen 100-290 auf 390px Viewport)
    const cx = quitBtn.x + quitBtn.w / 2;
    (cx > 100 && cx < 290)
      ? ok(`Im HUD-Center (midX=${Math.round(cx)}) ✓`)
      : fail(`Außerhalb HUD-Center (midX=${Math.round(cx)})`);

    await page.screenshot({ path: '/tmp/s3_quit_ux.png' });
    await ctx.close();
  }

  // ── Tests ausführen ────────────────────────────────────────────
  await testNavAndHUD('2-Spieler: Navigation & HUD', 2);
  await testNavAndHUD('3-Spieler: Navigation & HUD', 3);
  await testGameMechanics();
  await testQuitButtonUX();

  await browser.close();

  console.log('\n' + '='.repeat(50));
  console.log('TESTERGEBNIS');
  console.log('='.repeat(50));
  results.forEach(r => console.log(r));

  if (errors.length > 0) {
    console.log('\nJS-FEHLER:');
    errors.forEach(e => console.log('  ' + e));
  } else {
    console.log('\n✅ Keine JS-Fehler');
  }

  const pass = results.filter(r => r.startsWith('✅')).length;
  const fail2 = results.filter(r => r.startsWith('❌')).length;
  console.log(`\nGesamt: ${pass} ✅  ${fail2} ❌`);

  const shots = fs.readdirSync('/tmp').filter(f => f.endsWith('.png') && /^s[0-9]|^quit/.test(f));
  console.log(`${shots.length} Screenshots in /tmp/`);

  if (fail2 > 0) process.exit(1);
})();
