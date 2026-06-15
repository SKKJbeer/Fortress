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

// JS click bypasses the overlay div that intercepts pointer events
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

async function getQuitButtonBoundingBox(page) {
  return page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    for (const b of btns) {
      if ((b.textContent || '').includes('beenden') || (b.textContent || '').trim() === '✕') {
        const r = b.getBoundingClientRect();
        const style = window.getComputedStyle(b);
        return {
          x: r.x, y: r.y, width: r.width, height: r.height,
          position: style.position
        };
      }
    }
    return null;
  });
}

async function getPlayerCardBoundingBox(page, player) {
  return page.evaluate((p) => {
    // Find player score spans — they contain single digits in colored divs
    const spans = Array.from(document.querySelectorAll('span'));
    const colorMap = { 1: '#93c5fd', 2: '#fca5a5' };
    for (const s of spans) {
      const style = window.getComputedStyle(s);
      if (style.color && s.parentElement) {
        const parent = s.parentElement.getBoundingClientRect();
        if (p === 1 && parent.x < window.innerWidth * 0.35 && parent.width > 60) {
          return { x: parent.x, y: parent.y, width: parent.width, height: parent.height };
        }
        if (p === 2 && parent.x > window.innerWidth * 0.65 && parent.width > 60) {
          return { x: parent.x, y: parent.y, width: parent.width, height: parent.height };
        }
      }
    }
    return null;
  }, player);
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

(async () => {
  // ── Versions-Validierung ──────────────────────────────────────────────────
  console.log('🔍 Versions-Validierung...');
  const expectedVersion = getExpectedVersion();
  if (!expectedVersion) {
    console.error('❌ ABBRUCH: Konnte Version nicht aus index.html lesen');
    process.exit(1);
  }
  console.log(`   Erwartet (index.html auf Disk): v${expectedVersion}`);

  let serverVersion;
  try { serverVersion = await getServerVersion(); }
  catch (e) {
    console.error(`❌ ABBRUCH: Server nicht erreichbar auf localhost:8765 — ${e.message}`);
    process.exit(1);
  }
  console.log(`   Server liefert:                 v${serverVersion}`);

  if (serverVersion !== expectedVersion) {
    console.error(`❌ ABBRUCH: Versions-Mismatch! Server hat v${serverVersion}, Disk hat v${expectedVersion}.`);
    console.error('   → Server neu starten: python3 -m http.server 8765');
    process.exit(1);
  }
  console.log(`✅ Versions-Match: v${expectedVersion} — Test läuft gegen aktuelle Version\n`);
  // ─────────────────────────────────────────────────────────────────────────

  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const errors = [];
  const results = [];
  const ok  = (msg) => { results.push('✅ ' + msg); console.log('✅ ' + msg); };
  const fail = (msg) => { results.push('❌ ' + msg); console.log('❌ ' + msg); };

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: Haupt-Spielflow (2-Spieler)
  // ═══════════════════════════════════════════════════════════════
  async function testGameFlow(label, playerCount) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`TEST: ${label}`);
    console.log('='.repeat(50));

    const { ctx, page } = await setupGamePage(browser, playerCount);
    const jsErrors = [];
    page.on('pageerror', e => {
      if (!e.message.includes('firebase') && !e.message.includes('Firebase'))
        jsErrors.push(e.message);
    });

    await page.goto('http://localhost:8765/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    const version = await page.evaluate(() => (document.title.match(/v(\d+\.\d+\.\d+)/) || [])[1]);
    version ? ok(`Version: ${version}`) : fail('Version nicht erkannt');

    await page.screenshot({ path: `/tmp/01_${playerCount}p_start.png` });

    // Profil-Editor
    const hasNameInput = await page.evaluate(() => !!document.querySelector('input[maxlength="16"]'));
    if (hasNameInput) {
      await page.evaluate(() => {
        const inp = document.querySelector('input[maxlength="16"]');
        if (inp) { inp.value = 'TestSpieler'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      await page.waitForTimeout(200);
      const saved = await jsClick(page, ['Speichern']);
      if (saved) { await page.waitForTimeout(500); ok('Profil gespeichert'); }
    }

    // Menü: Gold sichtbar
    const goldVisible = await page.evaluate(() =>
      Array.from(document.querySelectorAll('*')).some(el =>
        el.children.length === 0 && (el.textContent || '').includes('Gold')
      )
    );
    goldVisible ? ok('Gold-Anzeige im Menü vorhanden') : fail('Gold-Anzeige im Menü fehlt');

    await page.screenshot({ path: `/tmp/02_${playerCount}p_menu.png` });

    // LOKAL Button
    const lokalClicked = await jsClick(page, ['LOKAL']);
    if (!lokalClicked) { fail('Lokal-Button nicht gefunden'); await ctx.close(); return; }
    ok(`Lokal-Button geklickt: "${lokalClicked.slice(0, 30)}"`);
    await page.waitForTimeout(600);

    await page.screenshot({ path: `/tmp/03_${playerCount}p_localscreen.png` });

    // Spieler-Anzahl wählen
    const playerLabel = playerCount === 2 ? '2 Spieler' : '3 Spieler';
    const modeClicked = await jsClick(page, [playerLabel]);
    if (!modeClicked) {
      console.log(`   Buttons: ${JSON.stringify(await allButtonTexts(page))}`);
      fail(`${playerCount}-Spieler-Button nicht gefunden`);
      await ctx.close(); return;
    }
    ok(`${playerCount}-Spieler-Modus gestartet: "${modeClicked.slice(0, 40)}"`);
    await page.waitForTimeout(1500);

    // Canvas vorhanden
    const canvasBox = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { width: r.width, height: r.height, x: r.x, y: r.y };
    });
    canvasBox ? ok(`Canvas: ${Math.round(canvasBox.width)}×${Math.round(canvasBox.height)}px`) : fail('Canvas fehlt');

    await page.screenshot({ path: `/tmp/04_${playerCount}p_setup.png` });

    // ── Beenden-Button: integriert (kein absolutes Overlap) ──────
    const quitBox = await getQuitButtonBoundingBox(page);
    if (quitBox) {
      ok(`Beenden-Button gefunden (pos: ${Math.round(quitBox.x)},${Math.round(quitBox.y)})`);
      // Nicht absolut positioniert (kein float über Player-Cards)
      quitBox.position !== 'absolute'
        ? ok('Beenden-Button ist NICHT absolut positioniert (kein Overlap)')
        : fail(`Beenden-Button ist absolut positioniert (Overlap-Risiko)`);
      // Horizontale Mitte — soll im Center-Bereich liegen
      const centerX = quitBox.x + quitBox.width / 2;
      const inCenter = centerX > 100 && centerX < 290;
      inCenter
        ? ok(`Beenden-Button im HUD-Center (x=${Math.round(centerX)})`)
        : fail(`Beenden-Button außerhalb HUD-Center (x=${Math.round(centerX)})`);
    } else {
      fail('Beenden-Button nicht gefunden');
    }

    // Timer zählt in Setup-Phase
    const timerA = await getTimerValue(page);
    await page.waitForTimeout(2000);
    const timerB = await getTimerValue(page);
    if (timerA !== null && timerB !== null) {
      timerB < timerA
        ? ok(`Timer zählt runter: ${timerA} → ${timerB}`)
        : fail(`Timer zählt NICHT runter: ${timerA} → ${timerB}`);
    } else {
      fail('Timer-Wert nicht lesbar');
    }

    // Phase-Banner CSS-Animation vorhanden
    const hasBannerAnim = await page.evaluate(() => {
      const sheet = Array.from(document.styleSheets).find(s => {
        try { return Array.from(s.cssRules).some(r => r.name === 'phasebanner'); }
        catch { return false; }
      });
      return !!sheet;
    });
    hasBannerAnim ? ok('CSS-Animation "phasebanner" vorhanden') : fail('CSS-Animation "phasebanner" fehlt');

    // Auf Bauphase warten
    console.log('⏳ Warte auf Bauphase...');
    let buildReached = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const found = await findButtonText(page, ['drehen', 'Drehen']);
      if (found) { buildReached = true; console.log(`   Bauphase nach ${i+1}s`); break; }
    }

    if (!buildReached) { fail('Bauphase nicht erreicht'); await ctx.close(); return; }
    ok('Bauphase erreicht');

    await page.screenshot({ path: `/tmp/05_${playerCount}p_build.png` });

    // Drehen-Buttons zählen
    const allBtnsNow = await allButtonTexts(page);
    const drehButtons = allBtnsNow.filter(t => t.includes('drehen') || t.includes('Drehen'));
    console.log(`   Drehen-Buttons: [${drehButtons.join(' | ')}]`);

    if (playerCount === 2) {
      drehButtons.length >= 2
        ? ok(`2-Spieler: ${drehButtons.length} Drehen-Buttons ✓`)
        : fail(`2-Spieler: nur ${drehButtons.length} Drehen-Button(s)`);
    }
    if (playerCount === 3) {
      drehButtons.length >= 3
        ? ok(`3-Spieler: ${drehButtons.length} Drehen-Buttons ✓`)
        : fail(`3-Spieler: nur ${drehButtons.length}/3 Drehen-Button(s)`);
      drehButtons.some(t => t.includes('Grün'))
        ? ok('Grün-Drehen-Button vorhanden')
        : fail('Grün-Drehen-Button FEHLT');
    }

    // Drehen klicken
    const rotateLabel = playerCount === 2 ? ['Blau drehen'] : ['Grün drehen'];
    const rotateClicked = await jsClick(page, rotateLabel);
    if (rotateClicked) {
      await page.waitForTimeout(300);
      await page.screenshot({ path: `/tmp/06_${playerCount}p_rotated.png` });
      ok(`Drehen-Button klickbar: "${rotateClicked}"`);
    } else {
      fail(`Drehen-Button "${rotateLabel}" nicht klickbar`);
    }

    // Touch-Platzierung
    if (canvasBox) {
      const tapY = canvasBox.y + canvasBox.height * (playerCount === 2 ? 0.25 : 0.18);
      const tapX = canvasBox.x + canvasBox.width * 0.5;
      await page.touchscreen.tap(tapX, tapY);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `/tmp/07_${playerCount}p_touch.png` });
      ok('Touch-Event abgesetzt');
    }

    // Beenden-Dialog öffnen
    const quitClicked = await jsClick(page, ['beenden', '✕']);
    if (quitClicked) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `/tmp/08_${playerCount}p_quit_dialog.png` });
      const confirmFound = await findButtonText(page, ['Ja', 'beenden', 'Weiterspielen']);
      confirmFound ? ok(`Beenden-Dialog erscheint ("${confirmFound}")`) : fail('Beenden-Dialog fehlt');

      // "Weiterspielen" testen — soll Dialog schließen und Spiel fortsetzen
      const resumeClicked = await jsClick(page, ['Weiterspielen']);
      if (resumeClicked) {
        await page.waitForTimeout(400);
        await page.screenshot({ path: `/tmp/09_${playerCount}p_resumed.png` });
        // Dialog sollte weg sein
        const dialogGone = !(await findButtonText(page, ['Weiterspielen']));
        dialogGone ? ok('Weiterspielen schließt Dialog ✓') : fail('Dialog bleibt nach Weiterspielen geöffnet');
        // Spiel soll noch laufen (Canvas noch da)
        const canvasStillThere = await page.evaluate(() => !!document.querySelector('canvas'));
        canvasStillThere ? ok('Spiel läuft nach Weiterspielen weiter ✓') : fail('Canvas weg nach Weiterspielen');
      } else {
        fail('Weiterspielen-Button nicht gefunden');
      }
    } else {
      fail('Beenden-Button nicht klickbar');
    }

    // Spiel tatsächlich beenden (zurück ins Menü)
    const quitAgain = await jsClick(page, ['beenden', '✕']);
    if (quitAgain) {
      await page.waitForTimeout(400);
      const confirmed = await jsClick(page, ['Ja, beenden']);
      if (confirmed) {
        await page.waitForTimeout(800);
        await page.screenshot({ path: `/tmp/10_${playerCount}p_back_menu.png` });
        // Canvas sollte weg sein (zurück im Menü)
        const canvasGone = !(await page.evaluate(() => !!document.querySelector('canvas')));
        canvasGone ? ok('Zurück im Menü nach "Ja, beenden" ✓') : fail('Canvas noch da nach "Ja, beenden"');
      }
    }

    if (jsErrors.length > 0) {
      jsErrors.forEach(e => { errors.push(`[${label}] JS: ${e}`); fail(`JS-Fehler: ${e.slice(0, 80)}`); });
    } else {
      ok('Keine JS-Fehler');
    }

    await ctx.close();
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: Beenden-Button UX (eigenständiger Test)
  // ═══════════════════════════════════════════════════════════════
  async function testQuitButtonUX() {
    console.log(`\n${'='.repeat(50)}`);
    console.log('TEST: Beenden-Button UX & Overlap-Check');
    console.log('='.repeat(50));

    const { ctx, page } = await setupGamePage(browser, 2);
    page.on('pageerror', e => {
      if (!e.message.includes('firebase') && !e.message.includes('Firebase'))
        errors.push(`[QuitUX] JS: ${e.message}`);
    });

    await page.goto('http://localhost:8765/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);
    const hasNameInput = await page.evaluate(() => !!document.querySelector('input[maxlength="16"]'));
    if (hasNameInput) {
      await page.evaluate(() => {
        const inp = document.querySelector('input[maxlength="16"]');
        if (inp) { inp.value = 'UXTest'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      await page.waitForTimeout(200);
      await jsClick(page, ['Speichern']);
      await page.waitForTimeout(400);
    }

    await jsClick(page, ['LOKAL']);
    await page.waitForTimeout(600);
    await jsClick(page, ['2 Spieler']);
    await page.waitForTimeout(2000);

    // Alle Buttons im Spiel erfassen
    const allBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map(b => {
        const r = b.getBoundingClientRect();
        return {
          text: (b.textContent || '').trim(),
          x: r.x, y: r.y, w: r.width, h: r.height,
          position: window.getComputedStyle(b).position
        };
      })
    );

    // Quit-Button und P2-Karte auf Overlap prüfen
    const quitBtn = allBtns.find(b => b.text.includes('beenden') || b.text === '✕');
    if (!quitBtn) {
      fail('Beenden-Button nicht gefunden für Overlap-Test');
    } else {
      ok(`Beenden-Button: "${quitBtn.text}" bei x=${Math.round(quitBtn.x)}, y=${Math.round(quitBtn.y)}, ${Math.round(quitBtn.w)}×${Math.round(quitBtn.h)}px`);

      // Kein absolutes Positioning
      quitBtn.position !== 'absolute'
        ? ok(`Beenden-Button: position=${quitBtn.position} (kein absolutes Overlay)`)
        : fail(`Beenden-Button: position=absolute (überlagert andere Elemente)`);

      // Buttons dürfen sich nicht überlappen
      const overlapping = allBtns.filter(b => b !== quitBtn && b.text && b.w > 0).filter(b => {
        const overlapX = quitBtn.x < b.x + b.w && quitBtn.x + quitBtn.w > b.x;
        const overlapY = quitBtn.y < b.y + b.h && quitBtn.y + quitBtn.h > b.y;
        return overlapX && overlapY;
      });
      overlapping.length === 0
        ? ok('Beenden-Button überlappt keine anderen Buttons ✓')
        : fail(`Beenden-Button überlappt ${overlapping.length} Button(s): ${overlapping.map(b => `"${b.text.slice(0,15)}"`).join(', ')}`);
    }

    await page.screenshot({ path: '/tmp/quit_ux_check.png' });
    await ctx.close();
  }

  // Tests ausführen
  await testGameFlow('2-Spieler lokal', 2);
  await testGameFlow('3-Spieler lokal', 3);
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

  const passCount = results.filter(r => r.startsWith('✅')).length;
  const failCount = results.filter(r => r.startsWith('❌')).length;
  console.log(`\nGesamt: ${passCount} ✅  ${failCount} ❌`);

  const screenshots = fs.readdirSync('/tmp').filter(f => f.endsWith('.png') && f.match(/^\d|^quit/));
  console.log(`${screenshots.length} Screenshots gespeichert in /tmp/`);

  if (failCount > 0) process.exit(1);
})();
