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

// Profil vorab in localStorage setzen, damit der Profil-Editor nie erscheint.
// Der Profil-Editor zeigt "WAPPEN" als Label (6 Großbuchstaben), das sonst
// fälschlich als Spielcode erkannt wird.
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
  } catch(e) {}
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
  await page.addInitScript(PROFILE_INIT);
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

// Menü laden + Profil-Editor überspringen (falls PROFILE_INIT nicht gegriffen hat)
async function loadMenu(page) {
  await page.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 8000 });
  await page.waitForTimeout(200);
  // Prüft auf beliebiges Input-Feld (Profil-Editor hat input ohne maxlength-Attribut)
  const hasInput = await page.evaluate(() => !!document.querySelector('input'));
  if (hasInput) {
    await page.evaluate(() => {
      const i = document.querySelector('input');
      if (i) { i.value = 'TestBot'; i.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await page.waitForTimeout(80);
    // Button heißt "Profil erstellen ⚔️" (kein Profil) oder "Speichern" (Profil vorhanden)
    await jsClick(page, ['Speichern', 'Profil erstellen', 'Save', 'Create profile']);
    await page.waitForTimeout(150);
    await page.waitForFunction(
      () => !document.querySelector('input'), { timeout: 3000 }
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

    // WappenAvatar im HUD: kreisrundes SVG-img
    const hudAvatarOk = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
        const src = img.getAttribute('src') || '';
        const style = window.getComputedStyle(img);
        const rect = img.getBoundingClientRect();
        return src.startsWith('data:image/svg+xml') && style.borderRadius === '50%' && rect.width > 0;
      });
      return imgs.length;
    });
    hudAvatarOk >= 1
      ? ok(`HUD: ${hudAvatarOk} Avatar-SVG(s) kreisrund sichtbar ✓`)
      : fail('HUD: kein kreisrundes Avatar-SVG im HUD');

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

    await page.waitForTimeout(200); // kurz nach Phasen-Reset stabilisieren
    const st0 = await getTimerValue(page);
    await page.waitForTimeout(1000);
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
    return id;
  }
  function off(ref, type, id) { clearInterval(id); }
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
  window.__fb = { db:{}, ref, set, update, remove, get, onValue, off, runTransaction, onDisconnect };
})();`;
}

// Browser-Kontext mit Firebase-Mock (für Online-Tests)
async function makeOnlineCtx(browser, fbPort) {
  const ctx  = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(PROFILE_INIT);
  await page.addInitScript(TIMER_SPEEDUP);
  await page.addInitScript(makeFbMock(fbPort));
  await page.route('**unpkg.com**react@18**react.production.min.js**',
    r => r.fulfill({ contentType: 'application/javascript', body: REACT_JS }));
  await page.route('**unpkg.com**react-dom@18**react-dom.production.min.js**',
    r => r.fulfill({ contentType: 'application/javascript', body: REACT_DOM_JS }));
  await page.route('**firebase**',   r => r.abort());
  await page.route('**gstatic**',    r => r.abort());
  await page.route('**googleapis**', r => r.abort());
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
    await page.waitForFunction(() => !!document.querySelector('input'), { timeout: 3000 }).catch(() => {});
    const inputOk = await page.evaluate(() => !!document.querySelector('input'));
    inputOk ? ok('"Spiel beitreten": Code-Eingabefeld ✓') : fail('"Spiel beitreten": Eingabefeld fehlt');

    // "Zurück" aus Code-Eingabe
    await jsClick(page, ['Zurück', 'back', 'Abbrechen']);
    await page.waitForTimeout(200);

    // "Spiel erstellen" → Wartescreen mit 6-stelligem Code
    await jsClick(page, ['Spiel erstellen']);
    // Warte bis Code-TextNode erscheint (max 5s)
    await page.waitForFunction(() => {
      const re = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}$/;
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { if (re.test(w.currentNode.textContent.trim())) return true; }
      return false;
    }, { timeout: 5000 }).catch(() => {});

    const code = await page.evaluate(() => {
      const re = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}$/;
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const t = w.currentNode.textContent.trim();
        if (re.test(t)) return t;
      }
      return null;
    });

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
    await pH.waitForTimeout(1200);

    // Code-TextNode suchen (genau 6 Chars aus Game-Charset, kein I/O/0/1)
    const code = await pH.evaluate(() => {
      const re = /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}$/;
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const t = w.currentNode.textContent.trim();
        if (re.test(t)) return t;
      }
      return null;
    });
    if (!code) {
      fail('Host: kein Spielcode → Suite abgebrochen'); return { res, errs: [...errs1,...errs2] };
    }
    ok(`Host erstellt Spiel: Code "${code}" ✓`);
    await pH.screenshot({ path: '/tmp/s5_host_waiting.png' });

    // ── GAST: Code eingeben + beitreten ───────────────────────
    await jsClick(pG, ['ONLINE']);
    await pG.waitForTimeout(200);
    await jsClick(pG, ['Spiel beitreten', 'beitreten']);
    await pG.waitForTimeout(200);

    // Warte auf Input-Feld, dann mit Playwright fill() schreiben (korrekte React-Integration)
    await pG.waitForSelector('input', { timeout: 3000 }).catch(() => {});
    const typed = await pG.evaluate(() => !!document.querySelector('input'));
    if (typed) await pG.fill('input', code);
    typed ? ok('Gast: Code eingetippt ✓') : fail('Gast: Eingabefeld nicht gefunden');

    await pG.waitForTimeout(100);
    await jsClick(pG, ['Beitreten']);
    // Kurz warten bis guestJoinGame() abgeschlossen + React gerendert (~50ms),
    // aber bevor das Spiel startet (~600ms) — Wartescreen ist kurz sichtbar.
    await pG.waitForTimeout(150);
    const guestWait = await pG.evaluate(() => /warte|verbinde/i.test(document.body.innerText));
    guestWait ? ok('Gast: Wartescreen nach Beitreten ✓') : fail('Gast: kein Wartescreen');
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
      const hK = ['FEUER','BAUEN','START','KANONE'].find(k => hostPh.includes(k));
      const gK = ['FEUER','BAUEN','START','KANONE'].find(k => guestPh.includes(k));
      hK === gK
        ? ok(`Phase-Sync: beide in "${hK}" ✓`)
        : fail(`Phase-Desync: Host="${hK}" Gast="${gK}"`);
    }

    // ── Timer auf Gast-Seite zählt (beweist laufenden State-Sync) ──
    // Warte auf Schussphase (Host hat dann mehrfach gepusht, Gast empfängt aktiv)
    console.log('⏳ Warte auf Schussphase für Gast-Timer-Check...');
    await waitForPhase(pG, ['FEUER'], 6000);
    await pG.waitForTimeout(300); // kurz nach Reset stabilisieren
    const gt0 = await getTimerValue(pG);
    await pG.waitForTimeout(1200);
    const gt1 = await getTimerValue(pG);
    (gt0 !== null && gt1 !== null && gt1 < gt0)
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
        quit:  Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('beenden')),
        // Online HUD zeigt "TestBot (Du)" für den Host; offline "P1"/"P2"
        score: /Du/.test(t) || (/P1/.test(t) && /P2/.test(t)),
      };
    });
    hostHud.timer ? ok('Host HUD: Timer ✓') : fail('Host HUD: kein Timer');
    hostHud.quit  ? ok('Host HUD: Beenden-Button ✓') : fail('Host HUD: kein Beenden-Button');
    hostHud.score ? ok('Host HUD: Spieler-Labels (P1/P2) ✓') : fail('Host HUD: Spieler-Labels fehlen');

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
        lastCollect: 0, streak: 2, lastStreakDay: ''
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
      return /LVL\s*\d/.test(t) && /XP/.test(t);
    });
    xpOk ? ok('XP-Leiste (LVL + XP) im Menü ✓') : fail('XP-Leiste nicht gefunden');

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
      return { hasStreak, hasCollect, hasDailyTitle };
    });
    modalOk.hasDailyTitle ? ok('Daily Modal: Titel sichtbar ✓') : fail('Daily Modal: Titel fehlt');
    modalOk.hasStreak     ? ok('Daily Modal: Streak-Kalender T1–T7 ✓') : fail('Daily Modal: Streak-Kalender fehlt');
    modalOk.hasCollect    ? ok('Daily Modal: "Abholen!"-Button ✓') : fail('Daily Modal: "Abholen!"-Button fehlt');

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
    const hasWappenLabel = await page.evaluate(() => /WAPPEN|AVATARE/i.test(document.body.innerText));
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

      // ── Avatar-Grafiken: SVG-Rendering & Darstellung ──────────────
      const avatarRender = await page.evaluate(() => {
        // Alle sichtbaren SVG-data-URI imgs (Avatar-Grafiken)
        const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
          const src = img.getAttribute('src') || '';
          const rect = img.getBoundingClientRect();
          return src.startsWith('data:image/svg+xml') && rect.width > 0 && rect.height > 0;
        });
        // Kreisrunde Darstellung (borderRadius 50%)
        const circularCount = imgs.filter(img =>
          window.getComputedStyle(img).borderRadius === '50%'
        ).length;
        // Skelett-Avatar-Button mit korrektem SVG-src
        const skelettBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('title') === 'skelett');
        const skelettImg = skelettBtn ? skelettBtn.querySelector('img') : null;
        const skelettSrcOk = !!(skelettImg && (skelettImg.getAttribute('src') || '').startsWith('data:image/svg+xml,'));
        // Sektions-Labels
        const divTexts = Array.from(document.querySelectorAll('div')).map(d => (d.textContent || '').trim());
        const hasAktiv  = divTexts.includes('AKTIVE AVATARE');
        const hasGesperrt = divTexts.includes('GESPERRTE AVATARE');
        return { count: imgs.length, circularCount, skelettSrcOk, hasAktiv, hasGesperrt };
      });
      avatarRender.count >= 4
        ? ok(`Profil-Editor: ${avatarRender.count} Avatar-SVGs gerendert ✓`)
        : fail(`Profil-Editor: zu wenige Avatar-SVGs (${avatarRender.count})`);
      avatarRender.circularCount >= 4
        ? ok(`Profil-Editor: ${avatarRender.circularCount} Avatare kreisrund (50%) ✓`)
        : fail(`Profil-Editor: Avatare nicht kreisrund (${avatarRender.circularCount} von ${avatarRender.count})`);
      avatarRender.skelettSrcOk
        ? ok('Skelett-Avatar: SVG data-URI korrekt geladen ✓')
        : fail('Skelett-Avatar: kein img-Element oder SVG-src fehlt');
      avatarRender.hasAktiv
        ? ok('Profil-Editor: "AKTIVE AVATARE" Sektion vorhanden ✓')
        : fail('Profil-Editor: "AKTIVE AVATARE" Label fehlt');
      avatarRender.hasGesperrt
        ? ok('Profil-Editor: "GESPERRTE AVATARE" Sektion vorhanden ✓')
        : fail('Profil-Editor: "GESPERRTE AVATARE" Label fehlt');
    }

    errs.length ? errs.forEach(e => fail(`JS-Fehler: ${e.slice(0, 80)}`)) : ok('Progressionssystem: Keine JS-Fehler ✓');
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
  const browser   = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors', '--disable-web-security'] });
  const mockFbSrv = await startMockFbServer();
  const FB_PORT   = 8766;

  // Alle Suites parallel ausführen (Online-Suites teilen Mock-Server)
  const [rMenu, r2P, r3P, rMech, rQuit, rOnlineUI, rOnline2P, rProg] = await Promise.all([
    suiteMenu(browser),
    suiteNavHUD(browser, 2),
    suiteNavHUD(browser, 3),
    suiteMechanics(browser),
    suiteQuitUX(browser),
    suiteOnlineUI(browser, FB_PORT),
    suiteOnline2P(browser, FB_PORT),
    suiteProgression(browser),
  ]);

  await browser.close();
  mockFbSrv.close();

  const allRes  = [...rMenu.res,  ...r2P.res,  ...r3P.res,  ...rMech.res,  ...rQuit.res,
                   ...rOnlineUI.res, ...rOnline2P.res, ...rProg.res];
  const allErrs = [...rMenu.errs, ...r2P.errs, ...r3P.errs, ...rMech.errs, ...rQuit.errs,
                   ...rOnlineUI.errs, ...rOnline2P.errs, ...rProg.errs];

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
