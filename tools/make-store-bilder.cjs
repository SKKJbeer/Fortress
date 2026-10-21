// Store-Plakate im Marketing-Stil (Nachtrag zu v3.131.2).
//
//   node tools/make-store-bilder.cjs aufnahmen [phone|pad] [de|en]
//   node tools/make-store-bilder.cjs plakate   [phone|pad] [de|en]
//   node tools/make-store-bilder.cjs alles
//
// **Warum neu.** Die alten Store-Bilder waren rohe Bildschirmfotos: ganz vorn
// das Menue mit Profil, ELO-Zahlen und der Versionsnummer, danach vier leere
// Bretter ohne Schlagzeile. Technisch waren sie scharf (gemessen: Laplace-
// Varianz 425-837 gegen 66-138 bei einer hochskalierten Kopie) — sie WIRKTEN
// weich, weil die Bedienung auf dem grossen Bild winzig ist, der gemalte Boden
// von Natur aus weich, und die Vorschau im Store auf ein Zehntel schrumpft.
//
// **Was jetzt anders ist.**
//   * Das staerkste Bild steht vorn: ein Gefecht mit Einschlaegen, nicht das
//     Menue. Apple zeigt in der Suche nur die ersten drei.
//   * Jedes Plakat traegt EINE Aussage als grosse Schlagzeile (auch in der
//     Vorschau lesbar) und darunter die ECHTE Aufnahme — keine Montage der
//     Spielinhalte, nur Rahmen, Hintergrund und Text darum.
//   * Aufnahmen entstehen mit hoher Aufloesung und werden fuer das Plakat
//     VERKLEINERT, nie vergroessert.
//   * Kein Profil mit ELO, keine Versionsnummer, keine Rechtslinks im Bild.
//
// Voraussetzung: `npm run build` und ein Server, der dist/ auf :8765 ausliefert.
// Die Aufnahmen landen in `build/store-roh/` (nicht eingecheckt), die Plakate
// in `store/ios-6.7[-en]` und `store/ipad-12.9[-en]`.
const { chromium } = (() => {
  try { return require('playwright'); }
  catch (e) { return require('/opt/node22/lib/node_modules/playwright'); }
})();
const fs = require('fs');
const path = require('path');
// Riegel gegen die PRODUKTIVDATENBANK — dieselbe Sperre wie in allen Werkzeugen.
const { FB_SPERRE } = require('../scripts/fb-sperre.cjs');

const ROOT = path.join(__dirname, '..');
const ROH = path.join(ROOT, 'build', 'store-roh');

// Geraete: CSS-Groesse x Faktor = Pixelgroesse der Aufnahme; `poster` ist die
// Groesse, die Apple verlangt.
const GERAETE = {
  phone: { w: 430, h: 932, scale: 3, poster: [1290, 2796], out: 'store/ios-6.7' },
  pad: { w: 1024, h: 1366, scale: 2, poster: [2048, 2732], out: 'store/ipad-12.9' },
};

// Reihenfolge = Rang im Store. Welt = `worldThemeOf(seed) = seed % 7`:
// 0 Kristalltal, 1 Frostreich, 2 Glutwueste, 3 Vulkanschlund, 4 Nebelmoor,
// 5 Herbstwald, 6 Astralebene. Jede Szene eine andere Welt — die Reihe soll
// abwechslungsreich sein, und jede Welt zeigt, was sie am besten kann
// (Vulkanschlund: Einschlaege leuchten, Glutwueste: der Zieler hebt sich ab).
//
// `ausschnitt` = [x0, y0, x1, y1] als Anteile der Aufnahme: Ohne Angabe zeigt das
// Plakat den ganzen Schirm; `aktion` zeigt nur das Schlachtfeld, gross, und
// `ruesten` die untere Haelfte — dort steht der Shop, und der darf nicht am
// Rand abgeschnitten werden. `kopf` skaliert die Schlagzeile.
const SZENEN = [
  { id: 'aktion', welt: process.env.AKTION_WELT !== undefined ? +process.env.AKTION_WELT : 3, ausschnitt: [0.14, 0.10, 0.86, 0.755], ausschnittPad: [0.13, 0.13, 0.87, 0.86], kopf: 1.25 },
  // Platz 2 und 3 gehoeren dem Alleinstellungsmerkmal: zu zweit bzw. zu dritt an EINEM Geraet,
  // ohne Internet (Apple zeigt in der Suche nur die ersten drei Bilder).
  { id: 'zuzweit', welt: 1, ganz: true }, { id: 'drei', welt: 0 }, { id: 'zieler', welt: 2 }, { id: 'bauen', welt: 5 },
  { id: 'ruesten', welt: 6, ausschnitt: [0, 0.165, 1, 1], ausschnittPad: [0, 0, 1, 1] },
  { id: 'helden', welt: 4, ausschnitt: [0, 0.2, 1, 0.94], ausschnittPad: [0.17, 0.2, 0.83, 0.8] }, { id: 'welten', collage: true },
];
const WELTNAMEN = ['Kristalltal', 'Frostreich', 'Glutwüste', 'Vulkanschlund', 'Nebelmoor', 'Herbstwald', 'Astralebene'];
// Das Gefechtsbild wird groesser aufgenommen, weil es zugeschnitten und gross
// gezeigt wird (das Spielfeld rechnet bis Faktor 2,5 — darueber haette es nichts
// Neues zu zeigen).
const AKTION_SKALA = { phone: 3.6, pad: 2.4 };

const PROF = (sprache) => `try{localStorage.setItem('fortress_profile',JSON.stringify({
  id:'demo',name:'ARIN',wappen:'pestdoktor',color:'#2563eb',
  stats:{wins:24,losses:11,games:35},stats3:{wins:6,losses:4,games:10},
  elo:1284,elo3:1120,peakElo:1310,peakElo3:1150,gold:640,level:12,xp:340,
  unlockedRewards:[],achievements:[],dailyTasks:[],seasonXp:820,
  materials:{iron:34,silver:9,dragon:2,star:1},
  historicalXpApplied:true,achievementsRetroApplied:true,
  cosmetics:{owned:['trail_ember'],equipped:{trail:'trail_ember'}}}));
localStorage.setItem('fortress_onboarded','1');localStorage.setItem('fortress_tutorial_done','1');
localStorage.setItem('fortress_lang','${sprache}');}catch(e){}`;

const klick = (p, tt) => p.evaluate((tt) => {
  for (const b of document.querySelectorAll('button')) {
    const x = (b.textContent || '').trim();
    if (tt.some((t) => x.includes(t))) { b.click(); return true; }
  }
  return false;
}, tt);
const phase = (p) => p.evaluate(() => (window.__econFull && window.__econFull() || {}).phase || null);
const runde = (p) => p.evaluate(() => (window.__econFull && window.__econFull() || {}).round || 0);
const bannerDa = (p) => p.evaluate(() => !!document.querySelector('div[style*="phasebanner"]'));

async function warte(p, pred, ms, was) {
  const ende = Date.now() + ms;
  while (Date.now() < ende) { if (await pred()) return true; await p.waitForTimeout(100); }
  throw new Error('Zeit abgelaufen: ' + was);
}

// Einschlag-Wertung: helle gelb-orange Pixel in der MITTE des Bretts. Ohne Kopfzeile
// und ohne die Baender oben — das gelbe „RUESTPHASE"-Band zaehlte beim ersten Anlauf
// als Einschlag, und das Werkzeug nahm Ruestphasen statt Gefechte.
async function wertung(seite, png, g) {
  return seite.evaluate(async ([b64, g]) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0);
    const y0 = Math.floor(i.height * 0.26), y1 = Math.floor(i.height * 0.72);
    const d = x.getImageData(0, y0, i.width, y1 - y0).data;
    let n = 0;
    for (let k = 0; k < d.length; k += 4) if (d[k] > 235 && d[k + 1] > 160 && d[k + 2] < 120) n++;
    return n;
  }, [png.toString('base64'), g]);
}

async function oeffne(browser, g, sprache, welt, extra = '') {
  const ctx = await browser.newContext({
    viewport: { width: g.w, height: g.h }, deviceScaleFactor: g.scale,
    isMobile: true, hasTouch: true, serviceWorkers: 'block',
  });
  await ctx.addInitScript(FB_SPERRE);
  await ctx.addInitScript(PROF(sprache));
  // Sanfter Zeitraffer (1 s -> 250 ms), Bot-Takt schnell.
  await ctx.addInitScript(`const _osi=window.setInterval;
    window.setInterval=(f,m,...a)=>_osi(f, m===600?90:(m===1000?250:m), ...a);
    window.__mmDebug=true; window.__weltSeed=${700 + welt}; ${extra}`);
  const p = await ctx.newPage();
  await p.goto('http://localhost:8765/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelectorAll('button').length > 3, null, { timeout: 15000 });
  await p.waitForTimeout(900);
  return { ctx, p };
}

async function botPartie(p) {
  await klick(p, ['LOKAL', 'LOCAL']); await p.waitForTimeout(250);
  await klick(p, ['gegen Bot', 'vs Bot']); await p.waitForTimeout(250);
  await klick(p, ['Mittel', 'Medium']);
  await p.waitForFunction(() => !!document.querySelector('canvas'), null, { timeout: 15000 });
}

const speichere = (dir, name, buf) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name + '.png'), buf); };

// ── Szenen ───────────────────────────────────────────────────────────────

// Gefecht: viele Bilder der Schussphase, das mit den meisten Einschlaegen gewinnt.
async function aktion(browser, g, sprache, dir, geraet) {
  const welt = SZENEN.find((x) => x.id === 'aktion').welt;
  g = { ...g, scale: AKTION_SKALA[geraet] || g.scale };
  const { ctx, p } = await oeffne(browser, g, sprache, welt, 'window.__botSelfPlay=true;');
  try {
    await botPartie(p);
    await warte(p, async () => (await runde(p)) >= 3, 240000, 'Runde 3');
    let beste = null, bestePunkte = -1, n = 0;
    const ende = Date.now() + 170000;
    while (Date.now() < ende && n < 70) {
      // Nur ein echtes Gefecht: kein Phasenband, kein Warnband, kein Shop.
      const stoerend = await p.evaluate(() => /Kaufe Upgrades|Buy upgrades|BURG von|CASTLE of|Zieh von|Drag from|Bezwinger|Slayer|umgerüstet|reloading/i.test(document.body.innerText));
      if ((await phase(p)) === 'shoot' && !(await bannerDa(p)) && !stoerend) {
        const png = await p.screenshot({ type: 'png' });
        // Zwischen Pruefen und Aufnehmen kann ein Band aufgepoppt sein.
        const danach = await p.evaluate(() => /Kaufe Upgrades|Buy upgrades|BURG von|CASTLE of|Zieh von|Drag from|Bezwinger|Slayer|umgerüstet|reloading/i.test(document.body.innerText));
        if (danach) continue;
        const pt = await wertung(p, png, g); n++;
        if (pt > bestePunkte) { bestePunkte = pt; beste = png; }
      } else await p.waitForTimeout(100);
    }
    if (!beste) throw new Error('kein Gefechtsbild');
    console.log(`   aktion: ${n} Bilder, bestes mit ${bestePunkte} Einschlagpunkten`);
    speichere(dir, 'aktion', beste);
  } finally { await ctx.close(); }
}

// Zielen: der Finger zieht von der eigenen Burg weg, der Zieler liegt auf der gegnerischen.
async function zieler(browser, g, sprache, dir) {
  const { ctx, p } = await oeffne(browser, g, sprache, 2, 'window.__botSelfPlay=true;');
  try {
    await botPartie(p);
    await warte(p, async () => (await runde(p)) >= 3, 240000, 'Runde 3');
    for (let versuch = 0; versuch < 30; versuch++) {
      await warte(p, async () => (await phase(p)) === 'shoot' && !(await bannerDa(p)), 90000, 'Schussphase ohne Banner');
      const cb = await p.locator('canvas').boundingBox();
      const sx = (lx) => cb.x + lx * cb.width / 616, sy = (ly) => cb.y + ly * cb.height / 952;
      await p.evaluate(() => { window.__zielDbg = null; });
      await p.mouse.move(sx(308), sy(760)); await p.mouse.down();
      await p.mouse.move(sx(312), sy(800), { steps: 3 }); await p.waitForTimeout(60);
      let z = await p.evaluate(() => window.__zielDbg);
      if (!z) { await p.mouse.up(); await p.waitForTimeout(300); continue; }
      // Ziel auf die gegnerische Burg (oben, ca. 26 % der Hoehe) legen.
      const K = (z.ay - z.ty) / Math.max(1, z.py - z.ay);
      const d = (z.ay - 952 * 0.27) / Math.max(0.1, K);
      await p.mouse.move(sx(z.ax + 26), sy(z.ay + d), { steps: 5 });
      await p.waitForTimeout(140);
      z = await p.evaluate(() => window.__zielDbg);
      // Kein Warnband „BURG … offen" im Bild: Es erzaehlt ein Problem, kein Spiel.
      const warnt = await p.evaluate(() => /BURG von|CASTLE of/.test(document.body.innerText));
      if (z && z.ty < 952 * 0.4 && !warnt && (await phase(p)) === 'shoot') {
        const png = await p.screenshot({ type: 'png' });
        const warnt2 = await p.evaluate(() => /BURG von|CASTLE of/.test(document.body.innerText));
        await p.mouse.up();
        if (warnt2) continue;
        console.log(`   zieler: Ziel bei y=${Math.round(z.ty)} von 952`);
        speichere(dir, 'zieler', png); return;
      }
      await p.mouse.up();
      await warte(p, async () => (await phase(p)) !== 'shoot', 60000, 'Ende der Schussphase');
    }
    throw new Error('kein Zielbild');
  } finally { await ctx.close(); }
}

// Zu zweit an einem Geraet (seit v3.132.0 gegenueber): Ruestphase, beide Shops zugleich
// sichtbar — der obere um 180 Grad gedreht an der Kante des oberen Spielers.
async function zuzweit(browser, g, sprache, dir) {
  const { ctx, p } = await oeffne(browser, g, sprache, 1);
  try {
    await klick(p, ['LOKAL', 'LOCAL']); await p.waitForTimeout(300);
    await klick(p, ['2 Spieler', '2 Players']);
    await p.waitForFunction(() => !!document.querySelector('canvas'), null, { timeout: 15000 });
    await warte(p, async () => (await phase(p)) === 'cannon' && await p.evaluate(() => !!document.querySelector('[data-shopuhr="1"]') && !!document.querySelector('[data-shopuhr="2"]')), 150000, 'Ruestphase zu zweit mit beiden Shops');
    await p.waitForTimeout(700);
    speichere(dir, 'zuzweit', await p.screenshot({ type: 'png' }));
  } finally { await ctx.close(); }
}

// Zu dritt an einem Geraet: Bauphase ohne Banner, drei Bauteil-Felder unten.
async function drei(browser, g, sprache, dir) {
  const { ctx, p } = await oeffne(browser, g, sprache, 0);
  try {
    await klick(p, ['LOKAL', 'LOCAL']); await p.waitForTimeout(300);
    await klick(p, ['3 Spieler', '3 Players']);
    await p.waitForFunction(() => !!document.querySelector('canvas'), null, { timeout: 15000 });
    await warte(p, async () => (await phase(p)) === 'build' && !(await bannerDa(p)), 150000, 'Bauphase zu dritt');
    await p.waitForTimeout(400);
    speichere(dir, 'drei', await p.screenshot({ type: 'png' }));
  } finally { await ctx.close(); }
}

// Bauen: Bauphase im Lauf (Mauern stehen, Bauteil-Feld unten).
async function bauen(browser, g, sprache, dir) {
  const { ctx, p } = await oeffne(browser, g, sprache, 5, 'window.__botSelfPlay=true;');
  try {
    await botPartie(p);
    await warte(p, async () => (await runde(p)) >= 2, 240000, 'Runde 2');
    await warte(p, async () => (await phase(p)) === 'build' && !(await bannerDa(p)), 120000, 'Bauphase');
    await p.waitForTimeout(500);
    speichere(dir, 'bauen', await p.screenshot({ type: 'png' }));
  } finally { await ctx.close(); }
}

// Ruesten: Shop offen. Das Banner darf stehen (es ist Teil des Bildes), der Shop muss da sein.
async function ruesten(browser, g, sprache, dir) {
  const { ctx, p } = await oeffne(browser, g, sprache, 6, 'window.__botSelfPlay=true;');
  try {
    await botPartie(p);
    await warte(p, async () => (await runde(p)) >= 2, 240000, 'Runde 2');
    const muss = sprache === 'en' ? ['Slayer', 'Armor'] : ['Bezwinger', 'Schnellladen'];
    await warte(p, async () => (await phase(p)) === 'cannon' && await p.evaluate((m) => m.every((t) => document.body.innerText.includes(t)), muss), 120000, 'Ruestphase mit Shop');
    await p.waitForTimeout(700);
    speichere(dir, 'ruesten', await p.screenshot({ type: 'png' }));
  } finally { await ctx.close(); }
}

// Helden: der Profilbildschirm mit den gemalten Avataren.
async function helden(browser, g, sprache, dir) {
  const { ctx, p } = await oeffne(browser, g, sprache, 4);
  try {
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Profil|profile/i.test(x.title || ''))?.click());
    await p.waitForTimeout(900);
    await p.evaluate(() => document.fonts.ready);
    speichere(dir, 'helden', await p.screenshot({ type: 'png' }));
  } finally { await ctx.close(); }
}

// Welten: je Welt ein Brett (nur die Zeichenflaeche) mitten im Gefecht. Sprachunabhaengig:
// der Weltname steht im Spiel immer deutsch. Mehrere Welten gleichzeitig.
async function welten(browser, g, geraet, ziel) {
  const eins = async (w) => {
    const { ctx, p } = await oeffne(browser, g, 'de', w, 'window.__botSelfPlay=true;');
    try {
      await botPartie(p);
      await warte(p, async () => (await runde(p)) >= 2, 240000, 'Runde 2');
      await warte(p, async () => (await phase(p)) === 'shoot' && !(await bannerDa(p)), 120000, 'Schussphase');
      await p.waitForTimeout(500);
      speichere(ziel, 'welt-' + w, await p.locator('canvas').screenshot({ type: 'png' }));
    } finally { await ctx.close(); }
  };
  const warteschlange = [0, 1, 2, 3, 4, 5, 6];
  await Promise.all([0, 1, 2, 3].map(async () => {
    while (warteschlange.length) {
      const w = warteschlange.shift();
      for (let versuch = 1; versuch <= 3; versuch++) {
        try { await eins(w); console.log('   welt ' + w + ' ' + WELTNAMEN[w]); break; }
        catch (e) { console.log(`   ! welt ${w} (Versuch ${versuch}): ${e.message}`); if (versuch === 3) throw e; }
      }
    }
  }));
}

const SZENENFUNKTION = { aktion, zieler, zuzweit, drei, bauen, ruesten, helden };

async function aufnahmen(browser, geraet, sprache) {
  const g = GERAETE[geraet];
  const dir = path.join(ROH, `${geraet}-${sprache}`);
  console.log(`Aufnahmen ${geraet} ${sprache}`);
  const nur = (process.env.NUR || '').split(',').filter(Boolean);
  for (const s of SZENEN) {
    if (nur.length && !nur.includes(s.id)) continue;
    if (s.collage) {
      // Sprachunabhaengig: nur beim deutschen Durchlauf, im gemeinsamen Ordner.
      if (sprache === 'de') await welten(browser, g, geraet, path.join(ROH, `${geraet}-welten`));
      continue;
    }
    for (let versuch = 1; versuch <= 3; versuch++) {
      try { await SZENENFUNKTION[s.id](browser, g, sprache, dir, geraet); break; }
      catch (e) {
        console.log(`   ! ${s.id} (Versuch ${versuch}): ${e.message}`);
        if (versuch === 3) throw e;
      }
    }
  }
}

// ── Plakate ──────────────────────────────────────────────────────────────

// Schlagzeilen. Eine Aussage je Bild, kurz genug fuer die Vorschau; die Zeile
// darunter nennt den Nutzen. Nur, was das Spiel wirklich kann.
const TEXTE = {
  de: {
    aktion:  ['Feuer frei!', 'Bauen. Verteidigen. Zerstören.'],
    zuzweit: ['Zu zweit an<br>einem Gerät', 'Ohne Internet, Spieler gegenüber'],
    drei:    ['Zu dritt an<br>einem Gerät', 'Offline oder online mit Freunden'],
    zieler:  ['Ziehen. Zielen.<br>Feuern.', 'Einfach zu steuern – jede Kugel zählt'],
    bauen:   ['Baue deine<br>Festung', 'Stein für Stein – bevor die Kugeln fliegen'],
    ruesten: ['Rüste auf –<br>zerstöre mehr', 'Kanonen, Panzerung, Schnellladen'],
    helden:  ['Wähle deinen<br>Helden', 'Sammle Helden und Kanonen-Skins'],
    welten:  ['Sieben Welten', 'Jedes Schlachtfeld sieht anders aus'],
  },
  en: {
    aktion:  ['Open fire!', 'Build. Defend. Destroy.'],
    zuzweit: ['Two players,<br>one device', 'No internet – face to face'],
    drei:    ['Three players,<br>one screen', 'Offline, or online with friends'],
    zieler:  ['Drag. Aim.<br>Fire.', 'Simple controls – every shot counts'],
    bauen:   ['Build your<br>fortress', 'Brick by brick – before the cannonballs fly'],
    ruesten: ['Upgrade your<br>arsenal', 'Cannons, armor, faster reloads'],
    helden:  ['Choose your<br>hero', 'Collect heroes and cannon skins'],
    welten:  ['Seven worlds', 'Every battlefield looks different'],
  },
};

const daten = (rel, typ) => `data:${typ};base64,` + fs.readFileSync(path.join(ROOT, rel)).toString('base64');
const dataPng = (buf) => 'data:image/png;base64,' + buf.toString('base64');

// PNG-Breite und -Hoehe aus dem Kopf der Datei (ohne Bibliothek).
const pngMass = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

// Das Plakat in einer Groesse: Mass `k` = Breite / 1290, damit iPhone und iPad
// dieselbe Gestaltung tragen. Die Karte zeigt den `ausschnitt` der Aufnahme —
// VERKLEINERT oder 1:1, nie vergroessert (Karte schmaler als der Ausschnitt).
function plakatHtml(g, szene, sprache, bild, ausschnitt, kopfSkala, eigen) {
  const [W, H] = g.poster; const k = W / 1290;
  const [kopf, unter] = TEXTE[sprache][szene];
  const rand = Math.round(16 * k);
  const pad = g === GERAETE.pad;
  const [bw, bh] = bild ? pngMass(bild) : [1, 1];
  const [x0, y0, x1, y1] = ausschnitt;
  const mindestKopf = Math.round((pad ? 500 : 590) * k);
  // Verhaeltnis Hoehe/Breite des Ausschnitts (in Bildpunkten der Aufnahme).
  const verhaeltnis = ((y1 - y0) * bh) / ((x1 - x0) * bw);
  let kartenBreite = Math.round(W * (pad ? 0.84 : 0.88));
  // **iPad: die ganze Szene muss ins Bild** (v3.132.0). Das Brett steht dort
  // mitten im Schirm, Burgen, Shop und Bauteile liegen weit unten — mit der
  // Phone-Regel „unten anschneiden" fehlte der Shop und die halbe Burg.
  // Darum schrumpft die Karte, bis der Ausschnitt in den Platz unter der
  // Schlagzeile passt.
  // `ganz` (Szene "zuzweit"): auch auf dem Telefon die ganze Szene — beide Shops, oben
  // gedreht und unten aufrecht, sind der Beweis fuers Gegenueber-Sitzen.
  const ganz = !!(SZENEN.find((x) => x.id === szene) || {}).ganz;
  if (pad || ganz) kartenBreite = Math.min(kartenBreite, Math.floor((H - mindestKopf - rand) / verhaeltnis) + 2 * rand);
  // **Nie vergroessern.** Ist der Ausschnitt kleiner als die Karte (Profilfenster
  // auf dem iPad), wird die Karte schmaler statt die Aufnahme weich zu ziehen.
  kartenBreite = Math.min(kartenBreite, Math.floor((x1 - x0) * bw) + 2 * rand);
  const innen = kartenBreite - 2 * rand;
  const bildBreite = innen / (x1 - x0);             // angezeigte Breite der ganzen Aufnahme
  const bildHoehe = bildBreite * bh / bw;
  const innenHoehe = (y1 - y0) * bildHoehe;
  const kartenHoehe = innenHoehe + rand;            // oben Rand, unten angeschnitten
  // Reicht die Karte nicht bis unten, sitzt sie buendig am unteren Rand und die
  // Schlagzeile bekommt den freien Platz; sonst laeuft sie unten aus dem Bild.
  const kartenTop = eigen ? mindestKopf : Math.max(mindestKopf, Math.round(H - kartenHoehe));
  const skala = kopfSkala || 1;
  // Konturbreite waechst mit der Schrift (7 % in em) — dieselbe Regel wie KONTURTEXT.
  // Zahlen statt calc(): ein NEGATIVER calc im Schatten ist ungueltig und verwirft den
  // ganzen Schatten — die Schlagzeile stand dadurch ohne Kontur im Bild.
  const kw = '0.065em', kd = '0.047em';
  const kontur = [`${kw} 0 0`, `-${kw} 0 0`, `0 ${kw} 0`, `0 -${kw} 0`,
    `${kd} ${kd} 0`, `-${kd} ${kd} 0`, `${kd} -${kd} 0`, `-${kd} -${kd} 0`].map((x) => x + ' #1b0f06').join(',');
  const zeilen = kopf.split('<br>');
  const laengste = Math.max(...zeilen.map((z) => z.length));
  const groesse = Math.round(Math.min(168, 2050 / Math.max(laengste, 9)) * k * skala);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Lilita One';src:url(${daten('public/fonts/lilita-one.woff2', 'font/woff2')}) format('woff2')}
  @font-face{font-family:'Nunito';font-weight:200 1000;src:url(${daten('public/fonts/nunito.woff2', 'font/woff2')}) format('woff2')}
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${W}px;height:${H}px;overflow:hidden;position:relative;font-family:'Nunito',sans-serif;background:#0d1f45}
  .bg{position:absolute;inset:0;background:url(${daten('public/menu-hintergrund.jpg', 'image/jpeg')}) center 30%/cover}
  .bg::after{content:"";position:absolute;inset:0;
    background:linear-gradient(180deg,rgba(21,52,118,.5) 0%,rgba(13,31,69,.76) 42%,rgba(9,22,52,.92) 100%)}
  .glut{position:absolute;left:50%;top:${Math.round(kartenTop - W * 0.25)}px;width:${Math.round(W * 1.1)}px;height:${Math.round(W * 0.9)}px;
    transform:translateX(-50%);background:radial-gradient(closest-side,rgba(255,210,58,.34),rgba(255,210,58,0))}
  .kopf{position:absolute;left:0;right:0;top:0;height:${kartenTop}px;display:flex;flex-direction:column;
    justify-content:center;align-items:center;text-align:center;padding:${Math.round(40 * k)}px ${Math.round(60 * k)}px ${Math.round(70 * k)}px}
  h1{font-family:'Lilita One';font-weight:400;font-size:${groesse}px;line-height:1.02;color:#fff3a6;letter-spacing:.01em;
    text-shadow:0 ${Math.round(9 * k)}px 0 #f08a12,${kontur},0 ${Math.round(22 * k)}px ${Math.round(30 * k)}px rgba(0,0,0,.5)}
  .unter{margin-top:${Math.round(28 * k)}px;font-size:${Math.round(58 * k)}px;font-weight:900;line-height:1.2;color:#fffaf0;
    text-shadow:0 ${Math.round(4 * k)}px 0 #1b0f06,${Math.round(3 * k)}px 0 0 #1b0f06,-${Math.round(3 * k)}px 0 0 #1b0f06,0 -${Math.round(3 * k)}px 0 #1b0f06}
  .karte{position:absolute;left:50%;top:${kartenTop}px;width:${kartenBreite}px;height:${Math.round(kartenHoehe)}px;transform:translateX(-50%);
    border-radius:${Math.round(78 * k)}px ${Math.round(78 * k)}px 0 0;overflow:hidden;
    border:${rand}px solid #1b0f06;border-bottom:0;
    box-shadow:0 0 0 ${Math.round(8 * k)}px #ffd23a,0 ${Math.round(30 * k)}px ${Math.round(70 * k)}px rgba(0,0,0,.6)}
  .karte img{display:block;position:absolute;width:${bildBreite}px;left:${-x0 * bildBreite}px;top:${-y0 * bildHoehe}px}
  </style></head><body>
  <div class="bg"></div><div class="glut"></div>
  <div class="kopf"><h1>${kopf}</h1><div class="unter">${unter}</div></div>
  ${eigen ? eigen(kartenTop, k, W, H, g === GERAETE.pad) : `<div class="karte"><img src="${dataPng(bild)}"></div>`}
  </body></html>`;
}

// Collage der sieben Welten: Kacheln in versetzten Spalten, unten angeschnitten.
function weltenInhalt(geraet) {
  const dir = path.join(ROH, `${geraet}-welten`);
  const bilder = [0, 1, 2, 3, 4, 5, 6].map((w) => dataPng(fs.readFileSync(path.join(dir, `welt-${w}.png`))));
  return (top, k, W, H, pad) => {
    // Phone: 2 Spalten (4+3), iPad: 3 Spalten (3+2+2).
    const spalten = pad ? [[0, 1, 2], [3, 4], [5, 6]] : [[0, 2, 4, 6], [1, 3, 5]];
    const rand = Math.round((pad ? 110 : 85) * k), luecke = Math.round(44 * k);
    const tb = Math.floor((W - 2 * rand - (spalten.length - 1) * luecke) / spalten.length);
    const zeilen = pad ? 3 : 4;
    const th = Math.min(Math.round(tb * (pad ? 1.18 : 1.0)), Math.floor((H - top - Math.round(70 * k) - (zeilen - 1) * luecke) / zeilen));
    const versatz = Math.round((th + luecke) / 2);
    const kachel = (w, x, y) => `<div class="kachel" style="left:${x}px;top:${y}px;width:${tb}px;height:${th}px">
      <img src="${bilder[w]}"><span style="font-size:${Math.floor(Math.min(50 * k, (tb - 100 * k) / (WELTNAMEN[w].length * 0.56)))}px">${WELTNAMEN[w]}</span></div>`;
    let html = '';
    spalten.forEach((sp, ci) => sp.forEach((w, ri) => {
      const y = top + (ci % 2 === 1 ? versatz : 0) + ri * (th + luecke);
      html += kachel(w, rand + ci * (tb + luecke), y);
    }));
    return `<style>
      .kachel{position:absolute;border-radius:${Math.round(46 * k)}px;overflow:hidden;border:${Math.round(14 * k)}px solid #1b0f06;
        box-shadow:0 0 0 ${Math.round(7 * k)}px #ffd23a,0 ${Math.round(24 * k)}px ${Math.round(50 * k)}px rgba(0,0,0,.55)}
      .kachel img{width:100%;height:100%;object-fit:cover;object-position:50% 46%;display:block}
      .kachel span{position:absolute;left:${Math.round(20 * k)}px;bottom:${Math.round(18 * k)}px;font-family:'Lilita One';white-space:nowrap;
        color:#fffaf0;padding:${Math.round(2 * k)}px ${Math.round(24 * k)}px ${Math.round(6 * k)}px;border-radius:999px;background:rgba(13,31,69,.88);
        border:${Math.round(5 * k)}px solid #1b0f06;text-shadow:0 ${Math.round(3 * k)}px 0 #1b0f06}
    </style>${html}`;
  };
}

async function plakate(browser, geraet, sprache) {
  const g = GERAETE[geraet];
  const roh = path.join(ROH, `${geraet}-${sprache}`);
  const out = path.join(ROOT, g.out + (sprache === 'en' ? '-en' : ''));
  fs.mkdirSync(out, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: g.poster[0], height: g.poster[1] }, deviceScaleFactor: 1 });
  await ctx.addInitScript(FB_SPERRE);
  const p = await ctx.newPage();
  // Nummer = Platz in SZENEN (nicht Anzahl der gerenderten): so bleibt der Dateiname
  // stabil, auch wenn nur einzelne Plakate neu entstehen (NUR=zuzweit,drei).
  const nur = (process.env.NUR || '').split(',').filter(Boolean);
  for (const [i, s] of SZENEN.entries()) {
    if (nur.length && !nur.includes(s.id)) continue;
    const nr = i + 1;
    const datei = path.join(roh, s.id + '.png');
    if (s.collage) {
      if (!fs.existsSync(path.join(ROH, `${geraet}-welten`, 'welt-6.png'))) { console.log('   ! welten: keine Aufnahmen'); continue; }
      await p.setContent(plakatHtml(g, s.id, sprache, null, [0, 0, 1, 1], s.kopf, weltenInhalt(geraet)));
    } else {
      if (!fs.existsSync(datei)) { console.log(`   ! ${s.id}: keine Aufnahme (${datei})`); continue; }
      await p.setContent(plakatHtml(g, s.id, sprache, fs.readFileSync(datei), (geraet === 'pad' && s.ausschnittPad) || s.ausschnitt || [0, 0, 1, 1], s.kopf));
    }
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    const name = `${nr}-${s.id}.png`;
    await p.screenshot({ path: path.join(out, name) });
    console.log('   ' + path.relative(ROOT, path.join(out, name)));
  }
  await ctx.close();
}

module.exports = { GERAETE, SZENEN, ROH, ROOT, aufnahmen, plakate };

if (require.main === module) {
  (async () => {
    const [befehl, geraet, sprache] = process.argv.slice(2);
    const browser = await chromium.launch();
    try {
      if (befehl === 'aufnahmen') {
        for (const gr of geraet ? [geraet] : ['phone', 'pad'])
          for (const sp of sprache ? [sprache] : ['de', 'en']) await aufnahmen(browser, gr, sp);
      } else if (befehl === 'alles') {
        for (const gr of ['phone', 'pad']) for (const sp of ['de', 'en']) await aufnahmen(browser, gr, sp);
        for (const gr of ['phone', 'pad']) for (const sp of ['de', 'en']) await plakate(browser, gr, sp);
      } else if (befehl === 'plakate') {
        for (const gr of geraet ? [geraet] : ['phone', 'pad'])
          for (const sp of sprache ? [sprache] : ['de', 'en']) await plakate(browser, gr, sp);
      } else {
        console.log('Aufruf: node tools/make-store-bilder.cjs alles | aufnahmen|plakate [phone|pad] [de|en]');
      }
    } finally { await browser.close(); }
  })().catch((e) => { console.error(e); process.exit(1); });
}
