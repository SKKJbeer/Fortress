// Store-Screenshots aus dem ECHTEN Spiel aufnehmen (keine Montage).
// Voraussetzung: lokaler Server auf :8765.  Aufruf: node tools/make-screenshots.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'screenshots');
const REACT_JS = fs.readFileSync('/tmp/react.min.js', 'utf8');
const REACT_DOM_JS = fs.readFileSync('/tmp/react-dom.min.js', 'utf8');

// Play Store: Telefon-Screenshots 9:16, mind. 320 px. 1080x2340 ist der
// gaengige Geraeterahmen — wir rendern 360x780 @3x statt hochzuskalieren.
const VW = 360, VH = 780, SCALE = 3;

const PROF = `try{localStorage.setItem('fortress_profile',JSON.stringify({
  id:'demo',name:'ARIN',wappen:'ritter',color:'#2563eb',
  stats:{wins:24,losses:11,games:35},stats3:{wins:6,losses:4,games:10},
  elo:1284,elo3:1120,peakElo:1310,peakElo3:1150,gold:640,level:12,xp:340,
  unlockedRewards:[],achievements:[],dailyTasks:[],seasonXp:820,
  cosmetics:{owned:[],equipped:{}}}));
localStorage.setItem('fortress_onboarded','1');
localStorage.setItem('fortress_tutorial_done','1');
localStorage.setItem('fortress_lang','de');}catch(e){}`;

// Bot-Selbstspiel treibt das Brett in einen echten Spielstand — nur schneller.
const SPEED = `
  const _osi=window.setInterval;
  window.setInterval=(f,m,...a)=>_osi(f, m===600?90 : m, ...a);
  window.__mmDebug=true; window.__botSelfPlay=true;
`;

const click = (p, parts) => p.evaluate(pp => {
  for (const b of document.querySelectorAll('button')) {
    const t = (b.textContent || '').trim();
    if (pp.some(x => t.includes(x))) { b.click(); return t; }
  }
  return null;
}, parts);

const phase = p => p.evaluate(() => (window.__econFull && window.__econFull() || {}).phase || null);
const round = p => p.evaluate(() => (window.__econFull && window.__econFull() || {}).round || 0);

async function waitFor(p, pred, ms = 40000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await pred()) return true;
    await p.waitForTimeout(120);
  }
  return false;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  await p.addInitScript(PROF); await p.addInitScript(SPEED);
  await p.route('**unpkg.com**react@18**react.production.min.js**', r => r.fulfill({ contentType: 'application/javascript', body: REACT_JS }));
  await p.route('**unpkg.com**react-dom@18**react-dom.production.min.js**', r => r.fulfill({ contentType: 'application/javascript', body: REACT_DOM_JS }));
  for (const b of ['**firebase**', '**gstatic**', '**googleapis**']) await p.route(b, r => r.abort());

  await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
  await p.waitForTimeout(1400);   // Splash ausblenden lassen

  const shot = async (name) => {
    await p.screenshot({ path: path.join(OUT, name) });
    console.log('  ✓ screenshots/' + name);
  };

  await shot('menu.png');

  await click(p, ['LOKAL']); await p.waitForTimeout(250);
  await click(p, ['gegen Bot', 'vs Bot']); await p.waitForTimeout(300);
  await click(p, ['Mittel']);
  await p.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });

  // Ein paar Runden laufen lassen, damit Mauern, Truemmer und Kanonen stehen.
  await waitFor(p, async () => await round(p) >= 3);

  // Phase HART abwarten und den Treffer pruefen — ein stiller Timeout hatte
  // zuvor zweimal denselben Frame gespeichert (shoot.png == shop.png).
  const shotInPhase = async (want, name, settle) => {
    const ok = await waitFor(p, async () => await phase(p) === want, 60000);
    if (!ok) throw new Error('Phase "' + want + '" nie erreicht — ' + name + ' nicht aufgenommen');
    await p.waitForTimeout(settle);
    if (await phase(p) !== want) throw new Error('Phase "' + want + '" schon wieder vorbei — ' + name);
    await shot(name);
  };

  await shotInPhase('build', 'game.png', 900);
  await shotInPhase('shoot', 'shoot.png', 700);
  await shotInPhase('cannon', 'shop.png', 600);

  // Duplikate erkennen, statt sie stillschweigend auszuliefern
  const crypto = require('crypto');
  const seen = {};
  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.png'))) {
    const h = crypto.createHash('md5').update(fs.readFileSync(path.join(OUT, f))).digest('hex');
    if (seen[h]) throw new Error('Identische Screenshots: ' + seen[h] + ' == ' + f);
    seen[h] = f;
  }
  console.log(errs.length ? '  ! JS-Fehler: ' + errs.slice(0, 3).join(' | ') : '  ✓ keine JS-Fehler, keine Duplikate');
  await browser.close();
})();
