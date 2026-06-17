const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const http = require('http');

const REACT_JS = fs.readFileSync('/tmp/react.min.js', 'utf8');
const REACT_DOM_JS = fs.readFileSync('/tmp/react-dom.min.js', 'utf8');

// Speedup-Skript: setInterval >= 900ms → 50ms (Phasen 20× schneller)
//                 setTimeout >= 2000ms → /5   (Banner 5× schneller)
// Damit dauert ein kompletter Phasenzyklus ~10s statt ~100s.
const TIMER_SPEEDUP = `
  const _osi = window.setInterval;
  window.setInterval = (fn, ms, ...a) => _osi(fn, ms >= 900 ? 50 : ms, ...a);
  const _ost = window.setTimeout;
  window.setTimeout = (fn, ms, ...a) => _ost(fn, ms >= 2000 ? Math.round(ms / 5) : ms, ...a);
`;

// ── Versions-Helfer ───────────────────────────────────────────
function getExpectedVersion() {
  const html = fs.readFileSync('/home/user/Fortress/index.html', 'utf8');
  const m = html.match(/FORTRESS v(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}
function getServerVersion() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:8765/', (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { const m = d.match(/FORTRESS v(\d+\.\d+\.\d+)/); resolve(m ? m[1] : null); });
    }).on('error', reject);
  });
}

// ── Seiten-Helfer ─────────────────────────────────────────────
async function jsClick(page, parts) {
  return page.evaluate((parts) => {
    for (const b of document.querySelectorAll('button')) {
      const t = (b.textContent || '').trim();
      if (parts.some(p => t.includes(p))) { b.click(); return t; }
    }
    return null;
  }, parts);
}
async function findBtn(page, parts) {
  return page.evaluate((parts) => {
    for (const b of document.querySelectorAll('button')) {
      const t = (b.textContent || '').trim();
      if (parts.some(p => t.includes(p))) return t;
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
async function makeCtx(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(TIMER_SPEEDUP);
  await page.route('**unpkg.com**react@18**react.production.min.js**',
    r => r.fulfill({ contentType: 'application/javascript', body: REACT_JS }));
  await page.route('**unpkg.com**react-dom@18**react-dom.production.min.js**',
    r => r.fulfill({ contentType: 'application/javascript', body: REACT_DOM_JS }));
  await page.route('**firebase**',   r => r.abort());
  await page.route('**gstatic**',    r => r.abort());
  await page.route('**googleapis**', r => r.abort());
  return { ctx, page };
}

// Menü laden + Profil-Editor überspringen
async function loadMenu(page) {
  await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 8000 });
  await page.waitForTimeout(200);
  const hasInput = await page.evaluate(() => !!document.querySelector('input[maxlength="16"]'));
  if (hasInput) {
    await page.evaluate(() => {
      const i = document.querySelector('input[maxlength="16"]');
      if (i) { i.value = 'TestBot'; i.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await page.waitForTimeout(80);
    await jsClick(page, ['Speichern']);
    await page.waitForTimeout(150);
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

    // Gold-Anzeige
    const goldOk = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*')).some(el =>
        el.children.length === 0 && (el.textContent || '').includes('Gold'))
    );
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
        /(Schnellspiel|Quick|Spiel erstellen|Code)/i.test(b.textContent || ''))
    );
    onlineOk ? ok('Online-Overlay öffnet sich ✓') : fail('Online-Overlay fehlt');

    // Schnellspiel-Button hat Spieler-Anzahl-Text
    const mmBtn = await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if (/(Schnellspiel|Quick)/i.test(b.textContent || '')) return b.textContent.trim();
      }
      return null;
    });
    mmBtn ? ok(`Schnellspiel-Button: "${mmBtn.slice(0, 40)}" ✓`) : fail('Schnellspiel-Button fehlt');

    await page.screenshot({ path: '/tmp/s0_menu.png' });
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
        quit:  Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('beenden')),
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

    // Beenden-Button-Detail
    const qi = await page.evaluate(() => {
      for (const b of document.querySelectorAll('button')) {
        if (b.textContent.includes('beenden')) {
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

    // Timer zählt (in Schussphase messen — nach Reset auf 30, stabil)
    await page.waitForTimeout(200);
    const t0 = await getTimerValue(page);
    await page.waitForTimeout(600);
    const t1 = await getTimerValue(page);
    (t0 !== null && t1 !== null && t1 < t0)
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

    // Timer zählt
    const fs0 = await getTimerValue(page);
    await page.waitForTimeout(500);
    const fs1 = await getTimerValue(page);
    (fs0 !== null && fs1 !== null && fs1 < fs0)
      ? ok(`Schuss-Timer zählt: ${fs0} → ${fs1} ✓`)
      : fail(`Schuss-Timer zählt nicht (${fs0} → ${fs1})`);

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

    // Drehen-Panel
    const panelOk = await page.evaluate(() =>
      Array.from(document.querySelectorAll('span')).some(s => (s.textContent || '').includes('DREHEN'))
    );
    panelOk ? ok('Stück-Vorschau-Panel mit ↻ DREHEN sichtbar ✓') : fail('Stück-Vorschau-Panel fehlt');

    // Panel-Tap dreht
    const panelTap = await page.evaluate(() => {
      const lbl = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('DREHEN'));
      if (!lbl) return false;
      lbl.parentElement?.dispatchEvent(new PointerEvent('pointerdown',
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

    const st0 = await getTimerValue(page);
    await page.waitForTimeout(500);
    const st1 = await getTimerValue(page);
    (st0 !== null && st1 !== null && st1 < st0)
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
        return { text: (b.textContent || '').trim(), x: r.x, y: r.y, w: r.width, h: r.height,
                 pos: st.position, bg: st.background };
      })
    );
    const quit = allBtns.find(b => b.text.toLowerCase().includes('beenden'));
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
// MAIN
// ═══════════════════════════════════════════════════════════════
(async () => {
  console.log('🔍 Versions-Validierung...');
  const expected = getExpectedVersion();
  if (!expected) { console.error('❌ ABBRUCH: Version nicht lesbar'); process.exit(1); }
  console.log(`   Erwartet: v${expected}`);
  let server;
  try { server = await getServerVersion(); }
  catch (e) { console.error(`❌ ABBRUCH: Server nicht erreichbar — ${e.message}`); process.exit(1); }
  console.log(`   Server:   v${server}`);
  if (server !== expected) {
    console.error(`❌ ABBRUCH: Versions-Mismatch (Server v${server} ≠ Disk v${expected})`);
    console.error('   → python3 -m http.server 8765');
    process.exit(1);
  }
  console.log(`✅ v${expected} — Test läuft\n`);

  const t0 = Date.now();
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });

  // Alle Suites parallel ausführen
  const [rMenu, r2P, r3P, rMech, rQuit] = await Promise.all([
    suiteMenu(browser),
    suiteNavHUD(browser, 2),
    suiteNavHUD(browser, 3),
    suiteMechanics(browser),
    suiteQuitUX(browser),
  ]);

  await browser.close();

  const allRes  = [...rMenu.res,  ...r2P.res,  ...r3P.res,  ...rMech.res,  ...rQuit.res];
  const allErrs = [...rMenu.errs, ...r2P.errs, ...r3P.errs, ...rMech.errs, ...rQuit.errs];

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
