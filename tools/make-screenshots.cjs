// Store-Screenshots aus dem ECHTEN Spiel aufnehmen — keine Montage, keine
// Attrappe. Aufruf:  node tools/make-screenshots.cjs
//
// Voraussetzung: `npm run build` und ein Server, der dist/ auf :8765 ausliefert.
// Seit v3.74.0 laeuft alles gebuendelt; React und Firebase kommen aus dem
// Bundle, es gibt also nichts mehr vom CDN nachzureichen.
//
// Groessen (Stand 2026):
//   Apple 6,7"  1290x2796  — Pflicht fuer die Einreichung
//   Apple 6,5"  1242x2688  — zweite Groesse, wird oft noch verlangt
//   Play        1080x2340  — Telefon-Screenshots
// Gerendert wird jeweils in CSS-Pixeln x Geraetefaktor, NICHT hochskaliert:
// hochskalierte Bilder sehen im Store sichtbar weich aus.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ZIELE = [
  { name: 'ios-6.7',  w: 430,  h: 932,  scale: 3, out: 'store/ios-6.7' },
  { name: 'ios-6.5',  w: 414,  h: 896,  scale: 3, out: 'store/ios-6.5' },
  // iPad ist PFLICHT, solange TARGETED_DEVICE_FAMILY "1,2" ist — Apple prueft
  // dann auch auf dem iPad und verlangt eigene Bilder. Wer das nicht liefern
  // will, muss die App auf iPhone beschraenken.
  { name: 'ipad-13',  w: 1032, h: 1376, scale: 2, out: 'store/ipad-13' },
  { name: 'ipad-12.9',w: 1024, h: 1366, scale: 2, out: 'store/ipad-12.9' },
  { name: 'play',     w: 360,  h: 780,  scale: 3, out: 'public/screenshots' }
];

const PROF = `try{localStorage.setItem('fortress_profile',JSON.stringify({
  id:'demo',name:'ARIN',wappen:'ritter',color:'#2563eb',
  stats:{wins:24,losses:11,games:35},stats3:{wins:6,losses:4,games:10},
  elo:1284,elo3:1120,peakElo:1310,peakElo3:1150,gold:640,level:12,xp:340,
  unlockedRewards:[],achievements:[],dailyTasks:[],seasonXp:820,
  materials:{iron:34,silver:9,dragon:2,star:1},
  historicalXpApplied:true,achievementsRetroApplied:true,
  cosmetics:{owned:['trail_ember'],equipped:{trail:'trail_ember'}}}));
localStorage.setItem('fortress_onboarded','1');
localStorage.setItem('fortress_tutorial_done','1');
localStorage.setItem('fortress_lang','de');
localStorage.setItem('fortress_daily',JSON.stringify({lastCollect:Date.now(),streak:3,lastStreakDay:new Date().toISOString().slice(0,10)}));
}catch(e){}`;

// Bot-Selbstspiel treibt das Brett in einen echten Spielstand.
//
// Der Bot-Takt bleibt schnell (90 ms): mit 400 ms bekommt der Bot in der
// 25-s-Bauphase zu wenige Zuege, versiegelt seine Burg nicht und scheidet in
// Runde 1 aus — dann gibt es gar keine Schussphase mehr aufzunehmen.
// Der Preis: beim Shop-Bild ist das Banner noch sichtbar. Das ist dort aber
// unschaedlich, weil die Aussage von den Karten UNTEN getragen wird; nur bei
// Bau- und Schussbild verdeckt es das Brett und wird abgewartet.
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

async function warteAuf(p, pred, ms = 45000) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) { if (await pred()) return true; await p.waitForTimeout(120); }
  return false;
}

async function fuerZiel(browser, ziel) {
  const out = path.join(ROOT, ziel.out);
  fs.mkdirSync(out, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: ziel.w, height: ziel.h }, deviceScaleFactor: ziel.scale,
    isMobile: true, hasTouch: true,
    // Der Service Worker wuerde waehrend der Aufnahme die Seite uebernehmen.
    serviceWorkers: 'block'
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => { if (!/firebase/i.test(e.message)) errs.push(e.message); });
  await p.addInitScript(PROF); await p.addInitScript(SPEED);
  for (const b of ['**firebase**', '**gstatic**', '**googleapis**']) await p.route(b, r => r.abort());

  await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
  await p.waitForTimeout(1600);

  const shot = async (name) => {
    await p.screenshot({ path: path.join(out, name) });
    console.log('   ' + ziel.out + '/' + name);
  };

  await shot('menu.png');
  await click(p, ['LOKAL']); await p.waitForTimeout(250);
  await click(p, ['gegen Bot', 'vs Bot']); await p.waitForTimeout(300);
  await click(p, ['Mittel']);
  await p.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });

  // Ein paar Runden laufen lassen, damit Mauern, Truemmer und Kanonen stehen.
  await warteAuf(p, async () => await round(p) >= 3);

  // Phase HART abwarten UND den Treffer pruefen — ein stiller Timeout hatte
  // frueher zweimal denselben Frame gespeichert (shoot.png == shop.png).
  // Wartet auf ein Bild ohne Banner, in der richtigen Phase, mit den
  // geforderten Elementen. Schlaegt hart fehl statt still ein schlechtes Bild
  // zu speichern — ein Store-Screenshot, den niemand ansieht, ist wertlos.
  const BANNER = ['Kaufe Upgrades im Shop', 'Zieh von deiner Burg weg',
                  'Mauere deine Burg', 'Platziere 2 Kanonen'];
  const sauber = async (want, name, { muss = [], ohneBanner = true } = {}) => {
    const ok = await warteAuf(p, async () => {
      if (await phase(p) !== want) return false;
      return await p.evaluate((a) => {
        const t = document.body.innerText;
        if (a.ohneBanner && a.banner.some(b => t.includes(b))) return false;
        return a.muss.every(m => t.includes(m));
      }, { banner: BANNER, muss, ohneBanner });
    }, 90000);
    if (!ok) throw new Error('kein sauberes Bild fuer "' + want + '" — ' + name);
    await shot(name);
  };
  // Auf eine BEDINGUNG warten, nicht auf eine Dauer. Zwei Fallen liegen hier
  // dicht beieinander:
  //   zu frueh -> das Phasen-Banner ("FEUER FREI!") verdeckt das Brett
  //   zu spaet -> die Ruestphase ist durch, der Shop zugeklappt, das Bild leer
  // Eine feste Wartezeit trifft nie beides. Deshalb: warten, bis das Banner
  // WEG ist und das gewuenschte Element DA.
  await sauber('build',  'game.png');
  await sauber('shoot',  'shoot.png');
  // Banner hier zugelassen — siehe SPEED-Kommentar oben.
  await sauber('cannon', 'shop.png', { muss: ['Bezwinger', 'Schnellladen'], ohneBanner: false });

  // Duplikate erkennen, statt sie stillschweigend auszuliefern
  const crypto = require('crypto');
  const gesehen = {};
  for (const f of fs.readdirSync(out).filter(f => f.endsWith('.png'))) {
    const h = crypto.createHash('md5').update(fs.readFileSync(path.join(out, f))).digest('hex');
    if (gesehen[h]) throw new Error('Identische Screenshots: ' + gesehen[h] + ' == ' + f);
    gesehen[h] = f;
  }
  if (errs.length) console.log('   ! JS-Fehler: ' + errs.slice(0, 2).join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const ziel of ZIELE) {
    console.log(' ' + ziel.name + ' (' + (ziel.w * ziel.scale) + 'x' + (ziel.h * ziel.scale) + ')');
    await fuerZiel(browser, ziel);
  }
  await browser.close();
  console.log('\n fertig');
})();
