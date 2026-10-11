// Spiel-Logo „Stack & Siege" als PNG mit Transparenz (v3.121.0).
//
// Comic-Stil passend zum Ladebild (assets/ladebild): Lilita One (OFL, aus
// @fontsource), goldene Fuellung mit Verlauf, dicke dunkle Kontur, 3D-Kante
// nach unten und weicher Schatten — lesbar auf JEDEM Hintergrund, auch auf
// Himmel, Flammen und Burgmauern.
//
// Text kommt NICHT aus dem Bildmodell: FLUX schreibt Buchstaben unzuverlaessig
// (falsche Zeichen, verschmolzene Glyphen). Das Logo wird gesetzt und dann
// auf das gemalte Bild gelegt (tools/ladebild-logo.py).
//
//   node tools/logo.cjs <schrift.woff2> <ausgabe.png> [breite=1600]
const fs = require('fs');
const path = require('path');
const { chromium } = (() => {
  try { return require('playwright'); }
  catch (e) { return require('/opt/node22/lib/node_modules/playwright'); }
})();

const [schrift, ausgabe, breiteArg] = process.argv.slice(2);
const B = Number(breiteArg || 1600), H = Math.round(B * 0.42);
const font = fs.readFileSync(schrift).toString('base64');

const html = `<!doctype html><style>
@font-face{font-family:Logo;src:url(data:font/woff2;base64,${font}) format('woff2')}
body{margin:0;background:transparent}</style><canvas id=c width=${B} height=${H}></canvas>
<script>
async function los(){
  await document.fonts.load('100px Logo');
  const c=document.getElementById('c'), x=c.getContext('2d'), W=${B}, H=${H};
  const zeilen=[['STACK', 0.40], ['& SIEGE', 0.86]];
  const groesse=W*0.205;
  x.textAlign='center'; x.textBaseline='alphabetic'; x.lineJoin='round'; x.miterLimit=2;
  x.font=groesse+'px Logo';
  for (const [t, yf] of zeilen) {
    const y=H*yf, cx=W/2;
    // weicher Schlagschatten
    x.save(); x.shadowColor='rgba(0,0,0,0.55)'; x.shadowBlur=groesse*0.12; x.shadowOffsetY=groesse*0.10;
    x.lineWidth=groesse*0.20; x.strokeStyle='#1a0d04'; x.strokeText(t,cx,y+groesse*0.07); x.restore();
    // 3D-Kante: dunkelbraune Kopien nach unten
    for (let k=groesse*0.075; k>0; k-=1.5) { x.lineWidth=groesse*0.20; x.strokeStyle='#2a1406'; x.strokeText(t,cx,y+k); x.fillStyle='#7a3c0c'; x.fillText(t,cx,y+k); }
    // dicke dunkle Kontur
    x.lineWidth=groesse*0.20; x.strokeStyle='#1a0d04'; x.strokeText(t,cx,y);
    // innere Kontur in Orange
    x.lineWidth=groesse*0.075; x.strokeStyle='#c2570c'; x.strokeText(t,cx,y);
    // goldene Fuellung mit Verlauf
    const g=x.createLinearGradient(0,y-groesse*0.78,0,y);
    g.addColorStop(0,'#fffbe0'); g.addColorStop(0.35,'#ffe14a'); g.addColorStop(0.7,'#ffb01f'); g.addColorStop(1,'#f07a12');
    x.fillStyle=g; x.fillText(t,cx,y);
    // Glanzkante oben
    x.save(); x.beginPath(); x.rect(0,y-groesse*0.80,W,groesse*0.30); x.clip();
    x.fillStyle='rgba(255,255,255,0.35)'; x.fillText(t,cx,y); x.restore();
  }
  window.__png=c.toDataURL('image/png');
}
los();
</script>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: B, height: H } });
  await p.setContent(html);
  await p.waitForFunction(() => window.__png, null, { timeout: 20000 });
  const d = await p.evaluate(() => window.__png);
  fs.mkdirSync(path.dirname(ausgabe), { recursive: true });
  fs.writeFileSync(ausgabe, Buffer.from(d.split(',')[1], 'base64'));
  await b.close();
  console.log('✓', ausgabe, B + 'x' + H);
})();
