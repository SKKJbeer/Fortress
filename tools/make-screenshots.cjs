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

const ROOT = path.join(__dirname, '..');
const ZIELE = [
  { name: 'ios-6.7',  w: 430,  h: 932,  scale: 3, out: 'store/ios-6.7' },
  { name: 'ios-6.5',  w: 414,  h: 896,  scale: 3, out: 'store/ios-6.5' },
  // iPad ist PFLICHT, solange TARGETED_DEVICE_FAMILY "1,2" ist — Apple prueft
  // dann auch auf dem iPad und verlangt eigene Bilder. Wer das nicht liefern
  // will, muss die App auf iPhone beschraenken.
  { name: 'ipad-13',  w: 1032, h: 1376, scale: 2, out: 'store/ipad-13' },
  { name: 'ipad-12.9',w: 1024, h: 1366, scale: 2, out: 'store/ipad-12.9' },
  { name: 'play',     w: 360,  h: 780,  scale: 3, out: 'public/screenshots' },
  // Fuer die Website. JPEG statt PNG, und das ist keine Nachlaessigkeit: die
  // vier PNG der Play-Groesse wiegen zusammen ueber 3 MB. Auf einer Seite, die
  // jemand am Telefon im Zug aufmacht, entscheidet das darueber, ob er die
  // Bilder ueberhaupt sieht. Zweimal so gross wie angezeigt (2x) bleibt auf
  // einem scharfen Bildschirm scharf.
  // `sa` = Sicherheitsbereiche. Nur fuer die Website-Bilder: Dort stehen sie in
  // einem gezeichneten Geraeterahmen, und die Insel des iPhone liegt ueber dem
  // oberen Rand der Anzeige. Ohne oberen Bereich beginnt die Kopfzeile bei 0
  // und verschwindet unter der Insel — auf einem echten Geraet tut sie das nie.
  // Die Store-Bilder bleiben ohne: Apple zeigt sie ohne Rahmen.
  { name: 'website',  w: 390,  h: 844,  scale: 2, out: 'docs/website/bilder', jpeg: 82, sa: [59, 34] },
  // Zwei iPad-Aufnahmen fuer die Website. Die Rahmen dort zeigen ein iPad; ohne
  // Aufnahmen im Seitenverhaeltnis 3:4 waere das eine Behauptung mit einem
  // gestreckten Telefonbild darin. Faktor 1,4 statt 2 und Guete 72 statt 82:
  // Sie stehen rund 340-420 px breit, und die Seite hat eine harte
  // Gewichtsgrenze von 1400 kB fuer alle Bilder zusammen.
  { name: 'website-pad', w: 834, h: 1112, scale: 1.4, out: 'docs/website/bilder',
    jpeg: 72, praefix: 'pad-', bilder: ['game', 'shoot'], sa: [24, 20] }
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

// Die Sicherheitsbereiche als Initialskript — dieselbe Form wie in der
// Testsuite: setzen, sobald es ein Dokument gibt.
const saInit = (ziel) => `(function(){var s=function(){var d=document.documentElement;
  if(!d||!d.style)return false;
  d.style.setProperty('--sa-top','${ziel.sa[0]}px');
  d.style.setProperty('--sa-bottom','${ziel.sa[1]}px');return true;};
  if(!s())document.addEventListener('DOMContentLoaded',s);})();`;

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
  if (ziel.sa) await p.addInitScript(saInit(ziel));
  for (const b of ['**firebase**', '**gstatic**', '**googleapis**']) await p.route(b, r => r.abort());

  await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
  await p.waitForTimeout(1600);

  const endung = ziel.jpeg ? '.jpg' : '.png';
  const shot = async (name) => {
    // `bilder` waehlt aus, `praefix` benennt um. Beides fuer die iPad-Bilder der
    // Website: Der Ablauf zum Fuellen des Bretts ist derselbe, gebraucht werden
    // aber nur zwei Bilder — und sie duerfen die Telefonaufnahmen nicht
    // ueberschreiben, die im selben Ordner liegen.
    if (ziel.bilder && !ziel.bilder.includes(name.replace(/\.png$/, ''))) return;
    const datei = (ziel.praefix || '') + name.replace(/\.png$/, endung);
    await p.screenshot(ziel.jpeg
      ? { path: path.join(out, datei), type: 'jpeg', quality: ziel.jpeg }
      : { path: path.join(out, datei) });
    console.log('   ' + ziel.out + '/' + datei);
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
  for (const f of fs.readdirSync(out).filter(f => f.endsWith(endung))) {
    const h = crypto.createHash('md5').update(fs.readFileSync(path.join(out, f))).digest('hex');
    if (gesehen[h]) throw new Error('Identische Screenshots: ' + gesehen[h] + ' == ' + f);
    gesehen[h] = f;
  }
  if (errs.length) console.log('   ! JS-Fehler: ' + errs.slice(0, 2).join(' | '));
  await ctx.close();
}

// Bilder vom Spiel zu ZWEIT und zu DRITT an EINEM Geraet — nur fuer die Website.
//
// Sie entstehen in eigenen Durchgaengen, weil die Bot-Selbststeuerung hier
// nicht greift: `botTick` laeuft nur im Bot-Modus und bewegt hoechstens zwei
// Spieler. Eine lokale Partie hat keinen Bot, das Brett bliebe leer, wenn man
// auf gespielte Zuege wartet.
//
// Das schadet nichts, denn die Aussage der Bilder ist eine andere: UNTEN steht
// fuer jeden Mitspieler ein eigenes Bauteil-Feld. Genau das zeigt, dass hier
// zwei oder drei Leute gleichzeitig an einem Geraet spielen und nicht
// abwechselnd — und beim Dreier zusaetzlich der Fluss mit seinen drei Armen.
//
// Aufgenommen wird in TELEFON-Groesse. Ein Bild in Tablet-Format waere ein
// Versprechen, das die Seite nicht halten soll: Es geht auf jedem Geraet, auf
// dem das Spiel laeuft.
async function lokalePartie(browser, ziel, spieler) {
  const out = path.join(ROOT, ziel.out);
  fs.mkdirSync(out, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: ziel.w, height: ziel.h }, deviceScaleFactor: ziel.scale,
    isMobile: true, hasTouch: true, serviceWorkers: 'block'
  });
  const p = await ctx.newPage();
  await p.addInitScript(PROF); await p.addInitScript(SPEED);
  if (ziel.sa) await p.addInitScript(saInit(ziel));
  for (const b of ['**firebase**', '**gstatic**', '**googleapis**']) await p.route(b, r => r.abort());
  await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
  await p.waitForTimeout(1200);

  await click(p, ['LOKAL']); await p.waitForTimeout(300);
  await click(p, [spieler === 3 ? '3 Spieler' : '2 Spieler']);
  await p.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });

  // Auf die Bauphase OHNE Schild warten: Erstens deckt das Banner den oberen
  // Teil des Bretts ab, zweitens gibt es die Bauteil-Felder NUR in der
  // Bauphase — und genau die sind die Aussage des Bildes.
  //
  // **Zwei Minuten, und das ist kein grosszuegiger Puffer.** Runde 1 hat GAR
  // KEINE Bauphase: Nach dem Aufstellen folgt sofort Schiessen, dann Ruesten,
  // und erst in Runde 2 wird gebaut. Gemessen lag die erste Bauphase bei 65 s;
  // mit 60 s Frist lief der Aufnehmer genau davor ab.
  const ok = await warteAuf(p, async () => {
    if (await phase(p) !== 'build') return false;
    return await p.evaluate(() => !document.querySelector('div[style*="phasebanner"]'));
  }, 120000);
  if (!ok) throw new Error('kein sauberes Bild fuer die Partie zu ' + spieler);

  const datei = (spieler === 3 ? 'drei' : 'zwei') + (ziel.jpeg ? '.jpg' : '.png');
  await p.screenshot(ziel.jpeg
    ? { path: path.join(out, datei), type: 'jpeg', quality: ziel.jpeg }
    : { path: path.join(out, datei) });
  console.log('   ' + ziel.out + '/' + datei);
  await ctx.close();
}

// Ein Bild je WELT — nur das Brett, ohne Kopfzeile und Leiste.
//
// Die Welt haengt am Terrain-Seed (`worldThemeOf(seed) = seed % 7`), und der
// ist bei jedem lokalen Spiel zufaellig. Einen Seed vorzugeben hiesse, dafuer
// Spielcode zu aendern — fuer Werbebilder der falsche Preis. Also wird
// gewuerfelt, bis alle sieben einmal dran waren: Das Spiel verraet die Welt
// ueber den gesicherten Haken `__waterTheme().name`.
//
// Aufgenommen wird NUR das Spielfeld (`canvas`). Als Kachel in einer Galerie
// traegt das Brett die Aussage; Kopfzeile und Bauteil-Leiste wiederholen sich
// in jeder Welt und lenken ab.
async function welten(browser, ziel) {
  const out = path.join(ROOT, ziel.out);
  fs.mkdirSync(out, { recursive: true });
  // Kleiner und staerker komprimiert als die Telefonbilder: Sieben Kacheln
  // nebeneinander duerfen zusammen nicht so viel wiegen wie die ganze uebrige
  // Seite. Angezeigt werden sie rund 200 px breit.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.25,
    isMobile: true, hasTouch: true, serviceWorkers: 'block'
  });
  const p = await ctx.newPage();
  await p.addInitScript(PROF); await p.addInitScript(SPEED);
  if (ziel.sa) await p.addInitScript(saInit(ziel));
  for (const b of ['**firebase**', '**gstatic**', '**googleapis**']) await p.route(b, r => r.abort());

  const gesehen = new Set();
  for (let versuch = 0; versuch < 60 && gesehen.size < 7; versuch++) {
    await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
    await p.waitForTimeout(700);
    await click(p, ['LOKAL']); await p.waitForTimeout(220);
    await click(p, ['2 Spieler']);
    await p.waitForFunction(() => !!document.querySelector('canvas'), { timeout: 15000 });
    // Das Phasen-Schild wegwarten — es liegt sonst ueber dem Brett.
    const frei = await warteAuf(p, async () =>
      await p.evaluate(() => !document.querySelector('div[style*="phasebanner"]')), 12000);
    if (!frei) continue;
    const name = await p.evaluate(() => (window.__waterTheme && window.__waterTheme() || {}).name || null);
    if (!name || gesehen.has(name)) continue;
    gesehen.add(name);
    const datei = 'welt-' + name.toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-') + '.jpg';
    await p.locator('canvas').screenshot({ path: path.join(out, datei), type: 'jpeg', quality: 68 });
    console.log('   ' + ziel.out + '/' + datei + '  (' + name + ')');
  }
  if (gesehen.size < 7) {
    console.log('   ::warning::nur ' + gesehen.size + ' von 7 Welten erwischt: '
      + [...gesehen].join(', '));
  }
  await ctx.close();
}

// Die Menue-Fenster, die das Spiel sonst nirgends zeigt: Schmiede, Gold-Shop,
// Auszeichnungen, Tagesaufgaben. Sie tragen die Merkmale, von denen man auf
// einem Brett-Bildschirmfoto nichts sieht.
async function fenster(browser, ziel) {
  const out = path.join(ROOT, ziel.out);
  const ctx = await browser.newContext({
    viewport: { width: ziel.w, height: ziel.h }, deviceScaleFactor: ziel.scale,
    isMobile: true, hasTouch: true, serviceWorkers: 'block'
  });
  const p = await ctx.newPage();
  await p.addInitScript(PROF); await p.addInitScript(SPEED);
  if (ziel.sa) await p.addInitScript(saInit(ziel));
  await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
  await p.waitForTimeout(1400);

  const auf = (teil) => p.evaluate((t) => {
    const b = [...document.querySelectorAll('button')]
      .find(x => (x.getAttribute('title') || '').startsWith(t));
    if (b) { b.click(); return true; } return false;
  }, teil);

  // **Zwischen den Fenstern wird neu geladen, nicht geschlossen.** Vorher stand
  // hier `Escape` — und Escape schliesst diese Fenster nicht. Gemessen: Der
  // Text der Seite wurde nach jedem Druck NICHT kuerzer, die vier Fenster
  // stapelten sich also uebereinander, und aufgenommen wurde jeweils das mit
  // der hoechsten Lage. So entstanden zwei Bilder mit demselben Inhalt
  // („Auszeichnungen" auch dort, wo „Tagesaufgaben" stehen sollte) — ohne
  // Fehlermeldung, denn ein Bildschirmfoto gelingt immer.
  //
  // Neu laden haengt nicht davon ab, WIE ein Fenster schliesst.
  const frisch = async () => {
    await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelectorAll('button').length > 0, { timeout: 15000 });
    await p.waitForTimeout(1200);
  };

  // Jedes Fenster hat ein Merkmal, das NUR in ihm vorkommt. Ohne diese Probe
  // koennte wieder viermal dasselbe Bild entstehen, ohne dass es auffaellt.
  const FENSTER = [
    ['Schmiede',      'schmiede', 'DEINE MATERIALIEN'],
    ['Gold-Shop',     'goldshop', 'GESCHÜTZ-MODELL'],
    ['Achievements',  'erfolge',  'freigeschaltet'],
    ['Tagesaufgaben', 'aufgaben', 'Aufgaben jeden Tag']
  ];
  const gesehen = new Map();
  for (const [titel, datei, merkmal] of FENSTER) {
    await frisch();
    if (!(await auf(titel))) { console.error('   FEHLER: Knopf "' + titel + '" nicht gefunden'); process.exit(1); }
    await p.waitForTimeout(900);
    const da = await p.evaluate(m => document.body.innerText.includes(m), merkmal);
    if (!da) { console.error('   FEHLER: "' + titel + '" zeigt nicht "' + merkmal + '"'); process.exit(1); }
    const pfad = path.join(out, datei + '.jpg');
    await p.screenshot({ path: pfad, type: 'jpeg', quality: 78 });
    const summe = require('crypto').createHash('md5').update(fs.readFileSync(pfad)).digest('hex');
    if (gesehen.has(summe)) { console.error('   FEHLER: ' + datei + '.jpg ist Bild fuer Bild dasselbe wie ' + gesehen.get(summe)); process.exit(1); }
    gesehen.set(summe, datei);
    console.log('   ' + ziel.out + '/' + datei + '.jpg');
  }
  await ctx.close();
}

(async () => {
  // Ein Ziel allein aufnehmen: `node tools/make-screenshots.cjs website`.
  // Alle fuenf dauern rund zehn Minuten — wer nur die Website-Bilder braucht,
  // soll nicht auf die iPad-Groessen warten muessen.
  const nur = process.argv[2];
  if (nur && !ZIELE.some(z => z.name === nur)) {
    console.error('Unbekanntes Ziel: ' + nur + ' — bekannt sind: '
      + ZIELE.map(z => z.name).join(', '));
    process.exit(1);
  }
  const browser = await chromium.launch();
  for (const ziel of ZIELE) {
    if (nur && ziel.name !== nur) continue;
    console.log(' ' + ziel.name + ' (' + (ziel.w * ziel.scale) + 'x' + (ziel.h * ziel.scale) + ')');
    await fuerZiel(browser, ziel);
    if (ziel.name === 'website') {
      await lokalePartie(browser, ziel, 2);
      await lokalePartie(browser, ziel, 3);
      await fenster(browser, ziel);
      await welten(browser, ziel);
    }
  }
  await browser.close();
  console.log('\n fertig');
})();
