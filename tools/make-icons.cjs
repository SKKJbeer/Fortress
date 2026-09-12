// Store-Assets generieren (App-Icons + Feature-Graphic).
// Reproduzierbar: node tools/make-icons.js  (braucht Playwright + laufenden Server nicht)
// Zeichnet im Stil der Spiel-Sprites (Steinlagen, Fase, AO, farbiges Kernlicht,
// Licht von oben links wie SHADOW_DX/SHADOW_DY im Spiel).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

// ── PNG OHNE Alphakanal schreiben ─────────────────────────────────────────
//
// **Warum von Hand.** Apple lehnt ein App-Icon ab, das einen Alphakanal
// ENTHAELT — auch wenn jedes Pixel deckend ist. `canvas.toDataURL('image/png')`
// schreibt aber immer RGBA. Pillow und sharp liegen hier nicht vor, also wird
// der Farbtyp 2 (Echtfarbe, kein Alpha) direkt erzeugt: Signatur, IHDR, ein
// zlib-gepacktes IDAT mit Filterbyte 0 je Zeile, IEND.
//
// Die Deckung entsteht beim Zusammenrechnen: jedes Pixel wird ueber den
// Hintergrund gelegt, danach gibt es keine Transparenz mehr, die man
// mitschreiben muesste.
function crc32(buf) {
  let c, tabelle = crc32.t;
  if (!tabelle) {
    tabelle = crc32.t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabelle[n] = c >>> 0;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = tabelle[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloc(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length, 0);
  const koerper = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const pruef = Buffer.alloc(4);
  pruef.writeUInt32BE(crc32(koerper), 0);
  return Buffer.concat([laenge, koerper, pruef]);
}

function pngOhneAlpha(rgba, breite, hoehe, grund) {
  // Ueber den Hintergrund legen — danach ist nichts mehr durchsichtig.
  const zeilen = Buffer.alloc(hoehe * (1 + breite * 3));
  let z = 0;
  for (let y = 0; y < hoehe; y++) {
    zeilen[z++] = 0;                       // Filterbyte: keiner
    for (let x = 0; x < breite; x++) {
      const i = (y * breite + x) * 4;
      const a = rgba[i + 3] / 255;
      zeilen[z++] = Math.round(rgba[i]     * a + grund[0] * (1 - a));
      zeilen[z++] = Math.round(rgba[i + 1] * a + grund[1] * (1 - a));
      zeilen[z++] = Math.round(rgba[i + 2] * a + grund[2] * (1 - a));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8;      // 8 Bit je Kanal
  ihdr[9] = 2;      // Farbtyp 2 = Echtfarbe OHNE Alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr),
    bloc('IDAT', zlib.deflateSync(zeilen, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}



const DRAW = `
// ── gemeinsame Bausteine, Licht von oben links ────────────────────────────
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a+r,b); x.arcTo(a+w,b,a+w,b+h,r);
  x.arcTo(a+w,b+h,a,b+h,r); x.arcTo(a,b+h,a,b,r); x.arcTo(a,b,a+w,b,r); x.closePath(); }

// deterministische Koernung (kein Math.random -> identische Ausgabe bei jedem Lauf)
function grain(i) { return Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1; }

// Steinblock mit Fase, Koernung und Schlagschatten
function stone(x, px, py, s, base, hi, lo, seed) {
  x.fillStyle = 'rgba(0,0,0,0.34)';
  x.fillRect(px + s * 0.07, py + s * 0.09, s, s);
  x.fillStyle = base; x.fillRect(px, py, s, s);
  var g = x.createLinearGradient(px, py, px + s, py + s);
  g.addColorStop(0, hi); g.addColorStop(0.5, base); g.addColorStop(1, lo);
  x.fillStyle = g; x.fillRect(px, py, s, s);
  for (var i = 0; i < 7; i++) {
    var a = grain(seed + i), b = grain(seed + i + 40);
    x.fillStyle = 'rgba(0,0,0,' + (0.05 + a * 0.07).toFixed(3) + ')';
    x.fillRect(px + a * s * 0.8, py + b * s * 0.8, s * 0.14, s * 0.14);
  }
  x.fillStyle = 'rgba(255,255,255,0.24)'; x.fillRect(px, py, s, s * 0.10);
  x.fillStyle = 'rgba(255,255,255,0.13)'; x.fillRect(px, py, s * 0.10, s);
  x.fillStyle = 'rgba(0,0,0,0.30)'; x.fillRect(px, py + s * 0.88, s, s * 0.12);
  x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(px + s * 0.90, py, s * 0.10, s);
}

function turret(x, cx, cy, r, accent) {
  // Bewusst reduziert: bei 48-96 px zerfaellt jede Zinnen-Zeichnung zu Griess.
  // Der Turm muss als EIN dunkler Stein mit hellem Kern lesbar bleiben.
  x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.arc(cx + r*0.14, cy + r*0.18, r, 0, 7); x.fill();
  var g = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, '#77828f'); g.addColorStop(0.5, '#414b59'); g.addColorStop(1, '#252d39');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.20)'; x.lineWidth = r * 0.11;
  x.beginPath(); x.arc(cx, cy, r * 0.94, 3.6, 5.6); x.stroke();
  // heller Kern — das ist der Teil, der auch bei 48 px noch traegt
  x.fillStyle = '#0e131b'; x.beginPath(); x.arc(cx, cy, r * 0.46, 0, 7); x.fill();
  var cg = x.createRadialGradient(cx, cy, 0, cx, cy, r * 0.72);
  cg.addColorStop(0, accent); cg.addColorStop(0.45, 'rgba(96,165,250,0.55)'); cg.addColorStop(1, 'rgba(96,165,250,0)');
  x.fillStyle = cg; x.beginPath(); x.arc(cx, cy, r * 0.72, 0, 7); x.fill();
}

// ── Das Icon ──────────────────────────────────────────────────────────────
// pad = Sicherheitsrand (maskable braucht 20 % Luft rundum)
function icon(x, S, pad, rounded) {
  var bg = x.createRadialGradient(S * 0.35, S * 0.22, 0, S * 0.5, S * 0.5, S * 0.78);
  bg.addColorStop(0, '#16243c'); bg.addColorStop(0.55, '#0b1424'); bg.addColorStop(1, '#050a12');
  if (rounded) { rr(x, 0, 0, S, S, S * 0.22); x.clip(); }
  x.fillStyle = bg; x.fillRect(0, 0, S, S);

  var C = S * 0.5, inner = S * (1 - 2 * pad);
  var cell = inner / 9;                 // 9x9 Raster im Innenbereich
  var o = S * pad;
  var P = function (i) { return o + i * cell; };

  // ── Mauerring (7x7 Rahmen) mit EINER Bresche unten rechts ───────────────
  var wallBase = '#3d78e6', wallHi = '#84b2f7', wallLo = '#1b3c8f';
  var ring = [];
  for (var i = 1; i <= 7; i++) { ring.push([1, i]); ring.push([7, i]); }
  for (var j = 2; j <= 6; j++) { ring.push([j, 1]); ring.push([j, 7]); }
  var breach = { '6,7': 1, '7,7': 1, '7,6': 1 };   // Loch unten rechts
  ring.forEach(function (p, k) {
    var key = p[0] + ',' + p[1];
    if (breach[key]) return;
    stone(x, P(p[0]), P(p[1]), cell * 0.94, wallBase, wallHi, wallLo, k * 3.1);
  });
  // Truemmer in der Bresche
  Object.keys(breach).forEach(function (key, k) {
    var p = key.split(',').map(Number);
    var px = P(p[0]), py = P(p[1]), s = cell * 0.94;
    x.fillStyle = 'rgba(0,0,0,0.34)'; x.fillRect(px + s*0.05, py + s*0.07, s*0.8, s*0.8);
    x.fillStyle = '#2b3543'; x.fillRect(px + s*0.16, py + s*0.30, s*0.56, s*0.44);
    x.fillStyle = '#1b2330'; x.fillRect(px + s*0.34, py + s*0.46, s*0.20, s*0.20);
  });

  // ── Burg im Zentrum (3x3) ──────────────────────────────────────────────
  var kx = P(3), ky = P(3), ks = cell * 3;
  x.fillStyle = 'rgba(0,0,0,0.5)'; rr(x, kx + ks*0.05, ky + ks*0.07, ks, ks, ks*0.10); x.fill();
  var kg = x.createLinearGradient(kx, ky, kx + ks, ky + ks);
  kg.addColorStop(0, '#9aa4b4'); kg.addColorStop(0.5, '#6b7688'); kg.addColorStop(1, '#454f60');
  x.fillStyle = kg; rr(x, kx, ky, ks, ks, ks*0.10); x.fill();
  // Steinlagen
  x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = Math.max(1, S*0.004);
  for (var r2 = 1; r2 < 4; r2++) {
    x.beginPath(); x.moveTo(kx, ky + ks*r2/4); x.lineTo(kx + ks, ky + ks*r2/4); x.stroke();
  }
  x.fillStyle = 'rgba(255,255,255,0.20)'; rr(x, kx, ky, ks, ks*0.09, ks*0.05); x.fill();

  // Wappenscheibe
  var dr = ks * 0.26;
  x.fillStyle = 'rgba(0,0,0,0.45)'; x.beginPath(); x.arc(C + ks*0.03, C + ks*0.04, dr, 0, 7); x.fill();
  var dg = x.createLinearGradient(C - dr, C - dr, C + dr, C + dr);
  dg.addColorStop(0, '#5b9bf5'); dg.addColorStop(1, '#1d4ed8');
  x.fillStyle = dg; x.beginPath(); x.arc(C, C, dr, 0, 7); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = S*0.008;
  x.beginPath(); x.arc(C, C, dr*0.98, 0, 7); x.stroke();
  // Zinnenkrone im Wappen (statt Emoji/Buchstabe)
  x.fillStyle = '#e8f0ff';
  var bw = dr * 0.24;
  for (var m = -1; m <= 1; m++) x.fillRect(C + m*dr*0.46 - bw/2, C - dr*0.42, bw, dr*0.44);
  x.fillRect(C - dr*0.62, C - dr*0.06, dr*1.24, dr*0.30);

  // 4 Ecktuerme
  var tr = cell * 0.55;
  [[3,3],[6,3],[3,6],[6,6]].forEach(function (t) {
    turret(x, P(t[0]), P(t[1]), tr, 'rgba(96,165,250,0.95)');
  });

  // Einschlag-Glut an der Bresche (erzaehlt: bauen UND beschiessen)
  var ix = P(7) + cell*0.5, iy = P(7) + cell*0.5;
  var ig = x.createRadialGradient(ix, iy, 0, ix, iy, cell*1.9);
  ig.addColorStop(0, 'rgba(255,238,170,0.95)'); ig.addColorStop(0.35, 'rgba(249,115,22,0.55)');
  ig.addColorStop(1, 'rgba(239,68,68,0)');
  x.fillStyle = ig; x.beginPath(); x.arc(ix, iy, cell*1.9, 0, 7); x.fill();

  // Vignette
  var vg = x.createRadialGradient(C, C, S*0.30, C, C, S*0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  x.fillStyle = vg; x.fillRect(0, 0, S, S);
}

// ── Feature-Graphic 1024x500 (Play Store Pflicht) ─────────────────────────
function feature(x, W, H) {
  var bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#132441'); bg.addColorStop(0.5, '#0a1322'); bg.addColorStop(1, '#05090f');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  // Terrain-Andeutung: Flussband diagonal
  x.save(); x.globalAlpha = 0.5;
  var rg = x.createLinearGradient(0, H, W, 0);
  rg.addColorStop(0, 'rgba(30,64,110,0)'); rg.addColorStop(0.5, 'rgba(38,86,142,0.75)');
  rg.addColorStop(1, 'rgba(30,64,110,0)');
  x.fillStyle = rg;
  x.beginPath(); x.moveTo(-40, H*0.72); x.quadraticCurveTo(W*0.45, H*0.30, W+40, H*0.62);
  x.lineTo(W+40, H*0.86); x.quadraticCurveTo(W*0.45, H*0.56, -40, H*0.96); x.closePath(); x.fill();
  x.restore();
  // Icon links
  var S = H * 0.72, ox = H * 0.14, oy = H * 0.14;
  x.save(); x.translate(ox, oy);
  rr(x, 0, 0, S, S, S*0.22); x.clip();
  icon(x, S, 0.06, false);
  x.restore();
  x.save(); x.strokeStyle = 'rgba(255,255,255,0.16)'; x.lineWidth = 2;
  rr(x, ox, oy, S, S, S*0.22); x.stroke(); x.restore();
  // Titel — Schriftgroessen werden auf die verfuegbare Breite GEMESSEN,
  // nicht geraten: der Play-Store beschneidet die Grafik seitlich, und eine
  // fest gesetzte Groesse lief hier zuvor rechts aus dem Bild.
  var tx = ox + S + H*0.10;
  var avail = W - tx - H*0.12;
  function fitText(txt, weight, maxPx, family) {
    var px = maxPx;
    do { x.font = weight + ' ' + Math.round(px) + 'px ' + family; px -= 1; }
    while (x.measureText(txt).width > avail && px > 8);
    return Math.round(px + 1);
  }
  var SANS = '"Segoe UI", system-ui, sans-serif', MONO = 'ui-monospace, Menlo, monospace';
  x.textBaseline = 'alphabetic';

  var t1 = 'Stack & Siege';
  fitText(t1, '900', H*0.21, SANS);
  x.fillStyle = '#f2f6ff'; x.fillText(t1, tx, H*0.44);

  var t2 = 'Mauern bauen. Festungen brechen.';
  fitText(t2, '600', H*0.070, SANS);
  x.fillStyle = '#9db4d2'; x.fillText(t2, tx, H*0.585);

  var t3 = '2\u20133 SPIELER \u00B7 ONLINE \u00B7 KOSTENLOS';
  var s3 = fitText(t3, '700', H*0.050, MONO);
  x.fillStyle = '#5eb0ef'; x.fillText(t3, tx, H*0.735);
  x.strokeStyle = 'rgba(94,176,239,0.35)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(tx, H*0.775); x.lineTo(tx + x.measureText(t3).width, H*0.775); x.stroke();
}
`;

// **Die Icons gehoeren nach public/, nicht in die Wurzel.** Vor der
// Vite-Umstellung wurde die Wurzel ausgeliefert, seither public/ — die Pfade
// hier sind nie nachgezogen worden. Wer das Werkzeug laufen liess, bekam fuenf
// Dubletten in die Wurzel gelegt, waehrend die wirklich ausgelieferten Icons
// unberuehrt blieben. Aufgefallen ist es erst, als sie im Commit auftauchten.
const JOBS = [
  { file: 'public/icon-512.png', size: 512, pad: 0.10, rounded: true },
  { file: 'public/icon-192.png', size: 192, pad: 0.10, rounded: true },
  { file: 'public/icon-96.png', size: 96, pad: 0.10, rounded: true },
  { file: 'public/icon-maskable-512.png', size: 512, pad: 0.20, rounded: false },
  { file: 'public/icon-maskable-192.png', size: 192, pad: 0.20, rounded: false },
  { file: 'store/play-icon-512.png', size: 512, pad: 0.10, rounded: true }
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');
  await page.addScriptTag({ content: DRAW });

  for (const j of JOBS) {
    const b64 = await page.evaluate((jj) => {
      const c = document.getElementById('c');
      c.width = jj.size; c.height = jj.size;
      const x = c.getContext('2d');
      x.clearRect(0, 0, jj.size, jj.size);
      // eslint-disable-next-line no-undef
      icon(x, jj.size, jj.pad, jj.rounded);
      return c.toDataURL('image/png').split(',')[1];
    }, j);
    const out = path.join(ROOT, j.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log('  ✓', j.file, j.size + 'px');
  }

  const fb64 = await page.evaluate(() => {
    const c = document.getElementById('c');
    c.width = 1024; c.height = 500;
    const x = c.getContext('2d');
    // eslint-disable-next-line no-undef
    feature(x, 1024, 500);
    return c.toDataURL('image/png').split(',')[1];
  });
  fs.mkdirSync(path.join(ROOT, 'store'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'store/feature-graphic-1024x500.png'), Buffer.from(fb64, 'base64'));
  console.log('  ✓ store/feature-graphic-1024x500.png');

  // ── iOS: App-Icon und Startbild ────────────────────────────────────────
  //
  // Beide lagen bis v3.81.0 als Capacitor-Vorgabe im Projekt und sind nie
  // ersetzt worden. Das App-Icon war sogar KAPUTT: ein schwarzes Quadrat mit
  // dem Zeichen fuer ein fehlendes Bild in der Ecke — jemand hatte eine Seite
  // fotografiert, in der die Grafik nicht geladen hat. Aufgefallen ist es
  // erst auf dem Geraet, weil niemand das Bild je angesehen hat.
  //
  // Deshalb kommen beide jetzt aus DERSELBEN Zeichnung wie die Web-Icons.
  const GRUND = [5, 13, 5];     // #050d05 — der Hintergrund des Spiels

  const IOS = [
    // Kein abgerundeter Rahmen: iOS legt seine eigene Maske darueber. Wer hier
    // rundet, bekommt auf dem Geraet einen doppelt beschnittenen Rand.
    { file: 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
      size: 1024, pad: 0.06, rounded: false, anteil: 1 },
    // Startbild: quadratisch, wird von Capacitor auf jede Bildschirmform
    // zugeschnitten. Das Zeichen sitzt klein in der Mitte, der Rest ist der
    // Hintergrund des Spiels — sonst blitzt beim Start Weiss auf.
    { file: 'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png',
      size: 2732, pad: 0, rounded: false, anteil: 0.26 },
  ];

  for (const j of IOS) {
    const roh = await page.evaluate((jj) => {
      const c = document.getElementById('c');
      c.width = jj.size; c.height = jj.size;
      const x = c.getContext('2d');
      x.clearRect(0, 0, jj.size, jj.size);
      const s = Math.round(jj.size * jj.anteil);
      x.save();
      x.translate((jj.size - s) / 2, (jj.size - s) / 2);
      // eslint-disable-next-line no-undef
      icon(x, s, jj.pad, jj.rounded);
      x.restore();
      const d = x.getImageData(0, 0, jj.size, jj.size).data;
      return Array.from(d);
    }, j);
    const out = path.join(ROOT, j.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, pngOhneAlpha(Uint8Array.from(roh), j.size, j.size, GRUND));
    console.log('  ✓', j.file, j.size + 'px, ohne Alphakanal');
  }

  // Capacitor erwartet drei Dateinamen im Splash-Satz; alle drei zeigen
  // dasselbe Bild (hell/dunkel/Standard — das Spiel ist immer dunkel).
  const splash = path.join(ROOT, 'ios/App/App/Assets.xcassets/Splash.imageset');
  for (const name of ['splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    fs.copyFileSync(path.join(splash, 'splash-2732x2732.png'), path.join(splash, name));
    console.log('  ✓ ' + name + ' (Kopie)');
  }

  await browser.close();
})();
