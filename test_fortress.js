const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const http = require('http');

const REACT_JS = fs.readFileSync('/tmp/react.min.js', 'utf8');
const REACT_DOM_JS = fs.readFileSync('/tmp/react-dom.min.js', 'utf8');

// Liest die erwartete Version direkt aus index.html auf Disk
function getExpectedVersion() {
  const html = fs.readFileSync('/home/user/Fortress/index.html', 'utf8');
  const m = html.match(/FORTRESS v(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

// Holt den HTML-Quelltext vom lokalen Server und prüft die Version darin
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

(async () => {
  // ── Versions-Validierung vor dem Test ─────────────────────────────────────
  console.log('🔍 Versions-Validierung...');
  const expectedVersion = getExpectedVersion();
  if (!expectedVersion) {
    console.error('❌ ABBRUCH: Konnte Version nicht aus index.html lesen');
    process.exit(1);
  }
  console.log(`   Erwartet (index.html auf Disk): v${expectedVersion}`);

  let serverVersion;
  try {
    serverVersion = await getServerVersion();
  } catch (e) {
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
  // ──────────────────────────────────────────────────────────────────────────

  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const errors = [];
  const results = [];
  const ok = (msg) => { results.push('✅ ' + msg); console.log('✅ ' + msg); };
  const fail = (msg) => { results.push('❌ ' + msg); console.log('❌ ' + msg); };

  async function testMode(label, playerCount) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`TEST: ${label}`);
    console.log('='.repeat(50));

    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const page = await ctx.newPage();

    await page.route('**unpkg.com**react@18**react.production.min.js**', route => {
      route.fulfill({ contentType: 'application/javascript', body: REACT_JS });
    });
    await page.route('**unpkg.com**react-dom@18**react-dom.production.min.js**', route => {
      route.fulfill({ contentType: 'application/javascript', body: REACT_DOM_JS });
    });
    await page.route('**firebase**', route => route.abort());
    await page.route('**gstatic**', route => route.abort());
    await page.route('**googleapis**', route => route.abort());

    page.on('pageerror', e => {
      if (!e.message.includes('firebase') && !e.message.includes('Firebase'))
        errors.push(`[${label}] JS: ${e.message}`);
    });

    await page.goto('http://localhost:8765/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);

    const version = await page.evaluate(() => (document.title.match(/v(\d+\.\d+\.\d+)/) || [])[1]);
    version ? ok(`Version: ${version}`) : fail('Version nicht erkannt');

    await page.screenshot({ path: `/tmp/01_${playerCount}p_start.png` });

    // Profil-Editor falls vorhanden
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
      const allBtns = await allButtonTexts(page);
      console.log(`   Buttons auf Seite: ${JSON.stringify(allBtns)}`);
      fail(`${playerCount}-Spieler-Button nicht gefunden`);
      await ctx.close();
      return;
    }
    ok(`${playerCount}-Spieler-Modus gestartet: "${modeClicked.slice(0, 40)}"`);
    await page.waitForTimeout(1500);

    // Canvas
    const canvasBox = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { width: r.width, height: r.height, x: r.x, y: r.y };
    });
    if (canvasBox) {
      ok(`Canvas: ${Math.round(canvasBox.width)}×${Math.round(canvasBox.height)}px`);
    } else {
      fail('Canvas fehlt');
    }

    await page.screenshot({ path: `/tmp/04_${playerCount}p_setup.png` });

    // Beenden-Button
    const hasQuit = await findButtonText(page, ['✕']);
    hasQuit ? ok('Beenden-Button (✕) vorhanden') : fail('Beenden-Button (✕) fehlt');

    // Auf Bauphase warten
    console.log('⏳ Warte auf Bauphase...');
    let buildReached = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const found = await findButtonText(page, ['drehen', 'Drehen']);
      if (found) { buildReached = true; console.log(`   Bauphase nach ${i+1}s (Button: "${found}")`); break; }
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

    // Drehen-Button klicken
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

    // Beenden testen
    const quitClicked = await jsClick(page, ['✕']);
    if (quitClicked) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `/tmp/08_${playerCount}p_quit.png` });
      const confirmFound = await findButtonText(page, ['Ja', 'Beenden', 'Weiterspielen']);
      confirmFound ? ok(`Beenden-Dialog erscheint ("${confirmFound}")`) : fail('Beenden-Dialog fehlt');
    }

    await ctx.close();
  }

  await testMode('2-Spieler lokal', 2);
  await testMode('3-Spieler lokal', 3);

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

  const screenshots = fs.readdirSync('/tmp').filter(f => f.endsWith('.png') && f.match(/^\d/));
  console.log(`\n${screenshots.length} Screenshots gespeichert in /tmp/`);
})();
